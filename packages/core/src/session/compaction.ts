import { generateText } from "ai"
import { readFile }     from "fs/promises"
import { resolve }      from "path"
import type { CoreMessage } from "ai"
import { ProviderRegistry }   from "../provider/registry.js"
import { countTokens }        from "../provider/tokenizer.js"
import { hooks }              from "../hook/emitter.js"
import {
  smartCompact,
  measureContextHealth,
  importanceScore,
  extractText,
  extractFilePaths,
} from "./context-compactor.js"

// ─── Constants ────────────────────────────────────────────────────────────────
export const COMPACTION_BUFFER     = 20_000
export const TOOL_OUTPUT_MAX_CHARS =  2_000
export const DEFAULT_TAIL_TURNS    =      2
export const PRUNE_MINIMUM         = 20_000
export const PRUNE_PROTECT         = 40_000
export const DEFAULT_MSG_THRESHOLD =    100

export type CompactionStrategy = "aggressive" | "balanced" | "conservative"

export interface CompactionConfig {
  contextLimit:           number
  maxOutput:              number
  tailTurns:              number
  provider:               string
  model:                  string
  strategy?:              CompactionStrategy
  messageCountThreshold?: number
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
const CB_MAX_FAILURES = 3
const CB_RESET_MS     = 60_000

export type CBStatus = "closed" | "open" | "half-open"
export interface CBState { status: CBStatus; failures: number; lastFailAt: number }

const cb: CBState = { status: "closed", failures: 0, lastFailAt: 0 }

export function getCircuitState(): Readonly<CBState> { return { ...cb } }

function cbRecordSuccess(): void { cb.failures = 0; cb.status = "closed" }

function cbRecordFailure(): void {
  cb.failures++
  cb.lastFailAt = Date.now()
  if (cb.failures >= CB_MAX_FAILURES) cb.status = "open"
}

function cbIsOpen(): boolean {
  if (cb.status === "closed") return false
  if (cb.status === "open" && Date.now() - cb.lastFailAt >= CB_RESET_MS) {
    cb.status = "half-open"
    return false
  }
  return cb.status === "open"
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export function estimateTokens(messages: CoreMessage[]): number {
  return messages.reduce((sum, m) => {
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content)
    return sum + countTokens(text) + 4
  }, 0)
}

export function isOverflow(messages: CoreMessage[], cfg: CompactionConfig): boolean {
  const usable = cfg.contextLimit - cfg.maxOutput - COMPACTION_BUFFER
  return estimateTokens(messages) >= usable
}

export function isOverflowByMessages(messages: CoreMessage[], cfg: CompactionConfig): boolean {
  return messages.length >= (cfg.messageCountThreshold ?? DEFAULT_MSG_THRESHOLD)
}

export interface ContextBreakdown {
  total:       number
  byRole:      Record<string, number>
  topMessages: Array<{ preview: string; tokens: number }>
  percentUsed: number
}

export function getContextBreakdown(messages: CoreMessage[], contextWindow: number): ContextBreakdown {
  const byRole: Record<string, number> = {}
  const withTokens: Array<{ preview: string; tokens: number; role: string }> = []

  for (const msg of messages) {
    const text   = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
    const tokens = countTokens(text) + 4
    byRole[msg.role] = (byRole[msg.role] ?? 0) + tokens
    withTokens.push({ preview: text.slice(0, 60).replace(/\n/g, " "), tokens, role: msg.role })
  }

  const total = Object.values(byRole).reduce((s, n) => s + n, 0)
  const topMessages = withTokens
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5)
    .map(({ preview, tokens }) => ({ preview, tokens }))

  return { total, byRole, topMessages, percentUsed: contextWindow > 0 ? total / contextWindow : 0 }
}

// ─── Strategy 1: microCompact ─────────────────────────────────────────────────
// Hiç LLM çağrısı yok. Küçük taşmalar için hızlı heuristik kırpma.
function microCompact(messages: CoreMessage[], targetBudget: number): CoreMessage[] {
  const annotated = messages.map((msg, idx) => ({
    msg,
    score:  importanceScore(msg, messages, idx),
    tokens: countTokens(extractText(msg)) + 4,
  }))

  // Önce: skor < 20 olan mesajları sil (çok düşük önem)
  const filtered = annotated.filter((a) => a.score >= 20)

  // Ardından: kalan bütçe için smartCompact ile kırp
  const budget = Math.max(PRUNE_MINIMUM, targetBudget)
  return smartCompact(filtered.map((a) => a.msg), budget)
}

// ─── Strategy 2: snipCompact ─────────────────────────────────────────────────
// Tool output ağırlıklı konuşmalar için. Bir LLM çağrısıyla araç bölümlerini özetler.
async function snipCompact(
  messages: CoreMessage[],
  cfg:      CompactionConfig,
): Promise<CoreMessage[] | null> {
  const tailBonus  = (cfg.strategy === "conservative" ? 2 : cfg.strategy === "aggressive" ? -1 : 0)
  const tailTurns  = Math.max(1, (cfg.tailTurns ?? DEFAULT_TAIL_TURNS) + tailBonus)
  const tail       = messages.slice(-tailTurns * 2)
  const head       = messages.slice(0, -tailTurns * 2)

  // Araç mesajlarını toplu özetle
  const toolMessages = head.filter((m) => m.role === "tool" || (m.role === "assistant" && (
    Array.isArray(m.content) && m.content.some((p: unknown) => {
      const part = p as Record<string, unknown>
      return part?.type === "tool-call"
    })
  )))

  const toolContext = toolMessages.slice(0, 30).map((m) => {
    const text = extractText(m).slice(0, 800)
    return `[${m.role}]: ${text}`
  }).join("\n\n")

  const plugin = ProviderRegistry.get(cfg.provider)
  const model  = plugin.getModel(cfg.model)

  let snipSummary: string
  try {
    const { text } = await generateText({
      model,
      messages: [
        { role: "user", content: `These are tool operations from a coding session. Summarize what was accomplished in 3-4 sentences, focusing on key files changed, commands run, and outcomes:\n\n${toolContext}` },
      ],
    })
    snipSummary = text
  } catch {
    cbRecordFailure()
    return null
  }

  // Araç mesajlarını özetle değiştir, konuşma mesajlarını koru
  const conversation = head.filter((m) => m.role !== "tool" && !(
    m.role === "assistant" && Array.isArray(m.content) && m.content.some((p: unknown) => {
      const part = p as Record<string, unknown>
      return part?.type === "tool-call"
    })
  ))

  const compacted: CoreMessage[] = [
    ...conversation,
    { role: "user",      content: "[Tool operations summary]" },
    { role: "assistant", content: snipSummary },
    ...tail,
  ]

  cbRecordSuccess()
  return compacted
}

// ─── Strategy 3: sessionCompact ──────────────────────────────────────────────
// Tam özet. Yapısal prompt + post-compact dosya re-injection + boundary marker.
async function sessionCompact(
  messages: CoreMessage[],
  cfg:      CompactionConfig,
): Promise<CoreMessage[] | null> {
  const tailBonus = (cfg.strategy === "conservative" ? 2 : cfg.strategy === "aggressive" ? -1 : 0)
  const tailTurns = Math.max(1, (cfg.tailTurns ?? DEFAULT_TAIL_TURNS) + tailBonus)

  const tail  = messages.slice(-tailTurns * 2)
  const head  = messages.slice(0, -tailTurns * 2)
  const budget = Math.max(0, estimateTokens(head) - PRUNE_MINIMUM)
  const pruned = smartCompact(head, budget)

  const summaryPrompt = cfg.strategy === "aggressive"
    ? "Summarize the key decisions and completed tasks in 3-5 bullet points. Be concise."
    : cfg.strategy === "conservative"
    ? [
        "Provide a structured summary of the work done so far. Include:",
        "**Completed:** What was finished.",
        "**Key files:** File paths touched and what changed.",
        "**Decisions:** Important architectural or design choices.",
        "**State:** Current state of the codebase/task.",
        "**Open:** Any unresolved issues or next steps.",
        "Preserve all code snippets, file paths, and error messages verbatim.",
      ].join("\n")
    : [
        "Summarize the conversation so far. Include:",
        "• What was accomplished",
        "• Key files changed (with paths)",
        "• Important decisions",
        "• Current state and next steps",
      ].join("\n")

  const plugin = ProviderRegistry.get(cfg.provider)
  const model  = plugin.getModel(cfg.model)

  let summary: string
  try {
    const { text } = await generateText({
      model,
      messages: [
        ...pruned,
        { role: "user", content: summaryPrompt },
      ],
    })
    summary = text
  } catch {
    cbRecordFailure()
    return null
  }

  // Post-compact file re-injection: summary'de geçen kaynak dosyaları ekle
  const filePaths  = extractFilePaths(summary)
  const fileBlocks: string[] = []

  for (const filePath of filePaths.slice(0, 3)) {
    try {
      const abs     = filePath.startsWith("/") ? filePath : resolve(process.cwd(), filePath)
      const content = await readFile(abs, "utf8")
      fileBlocks.push(`\n[Re-injected: ${filePath}]\n\`\`\`\n${content.slice(0, 4_000)}\n\`\`\``)
    } catch {
      // Dosya okunamazsa atla
    }
  }

  // Boundary marker: compaction noktasını izlenebilir kıl
  const boundaryId = crypto.randomUUID().slice(0, 8)
  const fullSummary = summary + fileBlocks.join("") + `\n\n[COMPACT:${boundaryId}]`

  const compacted: CoreMessage[] = [
    { role: "user",      content: "[Summary of previous conversation]" },
    { role: "assistant", content: fullSummary },
    ...tail,
  ]

  cbRecordSuccess()
  return compacted
}

// ─── Router ───────────────────────────────────────────────────────────────────
// Taşma miktarına ve context sağlığına göre en uygun stratejiyi seç.
export async function compact(
  messages: CoreMessage[],
  cfg:      CompactionConfig,
): Promise<CoreMessage[] | null> {
  if (cbIsOpen()) return null

  const usable   = cfg.contextLimit - cfg.maxOutput - COMPACTION_BUFFER
  const current  = estimateTokens(messages)
  const overflow = current - usable
  const health   = measureContextHealth(messages)

  const tokensBefore = current

  let result: CoreMessage[] | null = null
  let strategy: "micro" | "snip" | "session" = "session"

  // Küçük taşma (<8% of context): microCompact dene, yetersizse session'a geç
  if (overflow < cfg.contextLimit * 0.08) {
    strategy = "micro"
    const micro = microCompact(messages, usable)
    if (estimateTokens(micro) <= usable) {
      result = micro
    } else {
      strategy = "session"
    }
  }

  // Tool output ağırlıklı (>55%): snipCompact
  if (!result && health.toolOutputPct > 0.55) {
    strategy = "snip"
    result   = await snipCompact(messages, cfg)
  }

  // Varsayılan: tam session compaction
  if (!result) {
    strategy = "session"
    result   = await sessionCompact(messages, cfg)
  }

  if (!result) return null

  const tokensAfter = estimateTokens(result)

  await hooks.emit("v1.compact.before",  { sessionId: "unknown", tokenCount: tokensBefore })
  await hooks.emit("v1.session.compact", { sessionId: "unknown", tokensBefore, tokensAfter })
  await hooks.emit("v1.compact.after",   { sessionId: "unknown", tokensBefore, tokensAfter })

  return result
}
