import { streamText, generateText, tool } from "ai"
import type { CoreMessage, ToolSet } from "ai"
import { resolve } from "path"
import { ProviderRegistry } from "../provider/registry.js"
import { ToolRegistry } from "../tool/registry.js"
import { executeTool } from "../tool/executor.js"
import { SessionManager } from "../session/manager.js"
import { isOverflow, isOverflowByMessages, compact, DEFAULT_TAIL_TURNS } from "../session/compaction.js"
import { buildSystemPrompt } from "../skill/injector.js"
import { attachmentToAIContent } from "../util/attachments.js"
import { createThinkTagFilter } from "../util/think-tag-filter.js"
import { getUndercoverInstructions } from "./undercover.js"
import { loadConfig } from "../config/config.js"
import { extractAndStoreMemories } from "../memory/extractor.js"
import { buildGitSection, buildProactiveFileSection } from "../skill/injector.js"
import type { AgentRunOptions, AgentFinishResult } from "./types.js"

const MAX_STEPS = 20

// AI SDK tool() fonksiyonunun dönüş tipiyle exactOptionalPropertyTypes çakışıyor
// — ToolSet cast'i kullanıyoruz
function buildAITools(
  workdir: string,
  sessionId: string,
  provider: string,
  model: string,
  onChunk?: (chunk: string) => void,
  failureTracker?: Map<string, number>,
  recentReads?: Map<string, number>,
  toolCallIndexRef?: { current: number },
): ToolSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {}
  for (const def of ToolRegistry.list()) {
    const captured = def
    result[def.id] = tool({
      description: def.description,
      parameters:  def.parameters as never,
      execute: async (args: Record<string, unknown>) => {
        if (toolCallIndexRef) toolCallIndexRef.current++
        const currentIdx = toolCallIndexRef?.current ?? 0

        // B: Re-read gating — if file not read in last 10 calls, inject current content
        if (recentReads && captured.id === "edit") {
          const rawPath = String(args["path"] ?? "")
          if (rawPath) {
            const absPath   = resolve(workdir, rawPath)
            const lastRead  = recentReads.get(absPath)
            const isFresh   = lastRead !== undefined && (currentIdx - lastRead) <= 10
            if (!isFresh) {
              try {
                const content = await Bun.file(absPath).text()
                const excerpt = content.slice(0, 6_000)
                const trunc   = content.length > 6_000 ? "\n... [truncated]" : ""
                const staleness = lastRead !== undefined
                  ? `${currentIdx - lastRead} tool calls ago`
                  : "never in this turn"
                return `[Re-read gate] '${rawPath}' was last read ${staleness}. Current content:\n\`\`\`\n${excerpt}${trunc}\n\`\`\`\n\nReview the actual content above, then re-issue your edit with an exact verbatim match from what you see.`
              } catch {
                // Can't read file — let edit run and fail with its own error
              }
            }
          }
        }

        const ctx = {
          sessionId, workdir, signal: new AbortController().signal, provider, model,
          ...(onChunk !== undefined ? { onChunk } : {}),
        }
        const res = await executeTool(captured, args, ctx)

        // Track file reads and writes so re-read gate stays accurate
        if (recentReads && !res.error && (captured.id === "read" || captured.id === "write")) {
          const rawPath = String(args["path"] ?? "")
          if (rawPath) recentReads.set(resolve(workdir, rawPath), currentIdx)
        }

        let out = res.error ? `ERROR: ${res.error}\n${res.output}` : res.output

        if (res.error && failureTracker) {
          const fingerprint = `${captured.id}:${String(res.error).slice(0, 80)}`
          const count = (failureTracker.get(fingerprint) ?? 0) + 1
          failureTracker.set(fingerprint, count)
          if (count >= 2) {
            out += `\n\n[SYSTEM: You have hit this exact error ${count} times in a row. DO NOT retry the same approach. Stop, identify the root cause, and try a fundamentally different solution.]`
          }
        }

        return out
      },
    })
  }
  return result as ToolSet
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentFinishResult> {
  const providerName = opts.provider ?? "anthropic"
  const plugin       = ProviderRegistry.get(providerName)
  const modelId      = opts.model ?? plugin.defaultModel()
  const model        = plugin.getModel(modelId)
  const workdir      = opts.workdir ?? process.cwd()
  const sessionId    = opts.sessionId

  let messages: CoreMessage[] = [...opts.messages]

  // --- Multimodal attachment injection ---
  // Attachments varsa son user mesajını array formatına çevir
  if (opts.attachments && opts.attachments.length > 0) {
    const lastIdx = messages.length - 1
    const last = messages[lastIdx]
    if (last && last.role === "user" && typeof last.content === "string") {
      const textBlock = { type: "text" as const, text: last.content }
      const imageBlocks = opts.attachments.map((a) => attachmentToAIContent(a))
      messages = [
        ...messages.slice(0, lastIdx),
        { role: "user", content: [textBlock, ...imageBlocks] } as CoreMessage,
      ]
    }
  }

  // --- Compaction kontrolü ---
  const compCfg          = loadConfig(workdir).compaction
  const tailTurns        = compCfg?.tailTurns            ?? DEFAULT_TAIL_TURNS
  const strategy         = compCfg?.strategy             ?? "balanced"
  const msgThreshold     = compCfg?.messageCountThreshold
  const modelInfo = plugin.listModels().find((m) => m.id === modelId)
  const compCfgFull = {
    contextLimit:          modelInfo?.contextWindow ?? 200_000,
    maxOutput:             modelInfo?.maxOutput     ?? 8_000,
    tailTurns,
    strategy,
    provider:              providerName,
    model:                 modelId,
    workdir,
    ...(msgThreshold !== undefined ? { messageCountThreshold: msgThreshold } : {}),
  }
  if (modelInfo && (isOverflow(messages, compCfgFull) || isOverflowByMessages(messages, compCfgFull))) {
    // Extract memories from messages about to be lost to compaction (fire-and-forget)
    extractAndStoreMemories(providerName, modelId, messages, workdir).catch(() => {})
    const compacted = await compact(messages, compCfgFull)
    if (!compacted) return { text: "", tokens: { input: 0, output: 0 }, newMessages: [], ...(sessionId !== undefined ? { sessionId } : {}) }
    messages  = compacted
    opts.onCompaction?.()
  }

  // supportsTools: false olan modeller tool API'si desteklemez — boş geç
  const hasToolSupport   = modelInfo?.supportsTools !== false
  const failureTracker   = new Map<string, number>()
  const recentReads      = new Map<string, number>()
  const toolCallIndexRef = { current: 0 }
  const rawTools = hasToolSupport
    ? buildAITools(workdir, sessionId ?? "", providerName, modelId, opts.onChunk, failureTracker, recentReads, toolCallIndexRef)
    : ({} as ToolSet)

  // toolsOverride: session agent kısıtlaması — sadece izin verilen tool'lar
  const aiTools: ToolSet = opts.toolsOverride
    ? Object.fromEntries(
        Object.entries(rawTools).filter(([id]) => opts.toolsOverride!.includes(id))
      ) as ToolSet
    : rawTools

  // --- Proactive file injection: dosya adları user mesajında geçiyorsa önceden inject et ---
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")
  const lastUserText = lastUserMsg
    ? (typeof lastUserMsg.content === "string" ? lastUserMsg.content : "")
    : ""
  const proactiveSection = await buildProactiveFileSection(lastUserText, workdir).catch(() => "")

  // --- Skill injection (otomatik proje tespiti) ---
  // Git context buildSystemPrompt dışında tutulur — Anthropic'te ayrı uncached blok olarak inject edilir
  const baseSystem = await buildSystemPrompt(workdir, opts.system, false)
  const extraSystem = [proactiveSection].filter(Boolean).join("\n\n")
  let system = extraSystem ? `${baseSystem}\n\n${extraSystem}` : baseSystem

  if (opts.undercover) {
    system = [system, getUndercoverInstructions()].filter(Boolean).join("\n\n---\n\n")
  }

  // Git context her turn'de fresh — Anthropic cache'e girmemeli
  const gitSection = buildGitSection(workdir)

  // Anthropic prompt caching: statik kısım cache'lenir, git context cache'lenmez
  let systemParam: string | undefined = system || undefined
  if (plugin.sdkType === "anthropic") {
    const contentBlocks: Array<{ type: "text"; text: string; experimental_providerMetadata?: unknown }> = []
    if (system) {
      contentBlocks.push({
        type: "text",
        text: system,
        experimental_providerMetadata: { anthropic: { cacheControl: { type: "ephemeral" } } },
      })
    }
    if (gitSection) {
      contentBlocks.push({ type: "text", text: gitSection })
    }
    if (contentBlocks.length > 0) {
      const sysMsg: CoreMessage = { role: "system", content: contentBlocks as never }
      messages = [sysMsg, ...messages]
      systemParam = undefined
    }
  } else if (system || gitSection) {
    // Non-Anthropic: git context dahil tek string
    const fullSystem = [system, gitSection].filter(Boolean).join("\n\n")
    systemParam = fullSystem || undefined
  }

  const shared = {
    model,
    messages,
    tools:    aiTools,
    maxSteps: MAX_STEPS,
    ...(systemParam ? { system: systemParam } : {}),
    ...(opts.signal !== undefined ? { abortSignal: opts.signal } : {}),
    ...(opts.effort ? (() => {
      const thinkOpts = plugin.buildThinkingOptions(modelId, opts.effort!)
      return thinkOpts ? { providerOptions: thinkOpts } : {}
    })() : {})
  }

  let fullText     = ""
  let inputTokens  = 0
  let outputTokens = 0

  // opts.stream=false → pipe/non-interactive mod, kesinlikle generate
  // opts.stream=true veya undefined → provider'ın streaming desteğine bak
  const useStream = opts.stream !== false && plugin.supportsStreaming
  let newMessages: CoreMessage[] = []

  if (useStream) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = streamText(shared as any) as any
    const seenToolResults  = new Set<string>()
    const toolCallTimes    = new Map<string, number>()
    // Embedded <think>...</think> tag'lerini text stream'den ayıran filter
    // (DeepSeek-R1, Qwen, Ollama modeller)
    const thinkFilter = createThinkTagFilter()

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        const raw = (part.textDelta as string) || ""
        if (!raw) continue
        const { text, thinking } = thinkFilter.feed(raw)
        if (thinking) opts.onText?.(thinking, true)
        if (text) {
          fullText += text
          opts.onText?.(text, false)
        }
      } else if (
        part.type === "reasoning"       ||
        part.type === "reasoning-delta" ||
        part.type === "thinking"
      ) {
        // Native reasoning events (Anthropic extended thinking, AI SDK)
        const delta: string =
          (part as any).text      ??
          (part as any).textDelta ??
          (part as any).reasoning ??
          (part as any).delta     ?? ""
        if (delta) opts.onText?.(delta, true)
      } else if (part.type === "reasoning-start" || part.type === "reasoning-end") {
        // lifecycle sinyalleri — delta taşımaz, ignore
      } else if (part.type === "error") {
        const errMsg = `API Error: ${(part as any).error?.message || String((part as any).error)}`
        throw new Error(errMsg)
      } else if (part.type === "tool-call") {
        toolCallTimes.set(part.toolCallId, Date.now())
        opts.onToolCall?.({ id: part.toolCallId, tool: part.toolName, args: part.args })
      } else if (part.type === "tool-result") {
        // tool-result tek kaynak — step-finish'te tekrar emit edilmez
        if (!seenToolResults.has(part.toolCallId)) {
          seenToolResults.add(part.toolCallId)
          const durationMs = Date.now() - (toolCallTimes.get(part.toolCallId) ?? Date.now())
          toolCallTimes.delete(part.toolCallId)
          // @ts-ignore: part.result
          opts.onToolResult?.({ id: part.toolCallId, result: String(part.result), durationMs })
        }
      } else if (part.type === "step-finish") {
        // Yalnızca step tamamlama sinyali — tool result emission yok (race condition önleme)
        opts.onStepFinish?.()
      }
    }

    // Stream bitti — buffer'da kalan fragmentleri boşalt
    const tail = thinkFilter.flush()
    if (tail.thinking) opts.onText?.(tail.thinking, true)
    if (tail.text) { fullText += tail.text; opts.onText?.(tail.text, false) }

    const u      = await result.usage as Record<string, unknown>
    inputTokens  = normalizeTokens(u, "input")
    outputTokens = normalizeTokens(u, "output")

    const finalResponse = await result.response
    newMessages = finalResponse.messages
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateText(shared as any)
    fullText      = result.text
    opts.onText?.(fullText)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const step of (result as any).steps ?? []) {
      for (const tc of step.toolCalls ?? []) {
        opts.onToolCall?.({ id: tc.toolCallId, tool: tc.toolName, args: tc.args })
      }
      for (const tr of step.toolResults ?? []) {
        opts.onToolResult?.({ id: tr.toolCallId, result: String(tr.result), durationMs: 0 })
      }
    }

    const u      = result.usage as Record<string, unknown>
    inputTokens  = normalizeTokens(u, "input")
    outputTokens = normalizeTokens(u, "output")
    newMessages  = result.response.messages
  }

  if (sessionId !== undefined && fullText) {
    SessionManager.ensureExists(sessionId, { provider: providerName, model: modelId })
    SessionManager.addPart({ sessionId, role: "assistant", type: "text", content: fullText, tokens: outputTokens })
  }

  const finish: AgentFinishResult = {
    text:      fullText,
    tokens:    { input: inputTokens, output: outputTokens },
    newMessages,
    ...(sessionId !== undefined ? { sessionId } : {}),
  }

  opts.onFinish?.(finish)
  return finish
}

// Eski buildThinkingOptions kaldırıldı — her plugin kendi buildThinkingOptions()'ını implemente eder

function normalizeTokens(u: Record<string, unknown>, side: "input" | "output"): number {
  if (side === "input") return Number(u["promptTokens"]     ?? u["inputTokens"]  ?? u["prompt_tokens"]     ?? 0)
  return                       Number(u["completionTokens"] ?? u["outputTokens"] ?? u["completion_tokens"] ?? 0)
}
