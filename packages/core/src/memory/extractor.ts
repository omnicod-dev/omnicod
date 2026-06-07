import { generateText } from "ai"
import type { CoreMessage } from "ai"
import { ProviderRegistry } from "../provider/registry.js"
import { memoryStore } from "./store.js"
import type { Category, Scope } from "./types.js"

interface ExtractedFact {
  category: Category
  scope:    Scope
  content:  string
}

const EXTRACTION_PROMPT = `Review this conversation and identify 1-5 genuinely useful facts
worth remembering for FUTURE sessions. Focus on:
- User preferences (how they like things done, communication style)
- Project-specific facts (architecture, constraints, tech decisions)
- Recurring patterns (what they do often, their workflow)
- Key discoveries (important findings about the codebase)

For each fact output a JSON object:
{ "category": "preference|project|fact|decision|pattern", "scope": "global|project", "content": "one clear, specific sentence" }

Wrap facts in a JSON array.
Output "NONE" (the string) if there is nothing genuinely worth remembering.
Be selective — only store facts that would actually help in a future session.
Do NOT store trivial or session-specific details.`

export async function extractAndStoreMemories(
  provider:  string,
  model:     string,
  messages:  CoreMessage[],
  workdir:   string,
): Promise<void> {
  // Çok kısa session'larda çalıştırma
  if (messages.length < 4) return

  const plugin    = ProviderRegistry.get(provider)
  const aiModel   = plugin.getModel(model)
  const recent    = messages.slice(-30)  // son 30 mesaj — token tasarrufu

  let raw: string
  try {
    const result = await generateText({
      model:    aiModel,
      messages: [
        ...recent,
        { role: "user", content: EXTRACTION_PROMPT },
      ],
      maxTokens: 800,
    })
    raw = result.text.trim()
  } catch { return }

  if (!raw || raw === "NONE" || raw.includes("NONE")) return

  // JSON array'i çıkar
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return

  let facts: ExtractedFact[]
  try {
    facts = JSON.parse(jsonMatch[0]) as ExtractedFact[]
  } catch { return }

  if (!Array.isArray(facts) || facts.length === 0) return

  // Doğrula ve kaydet
  for (const fact of facts.slice(0, 5)) {
    if (!fact.content || !fact.category || !fact.scope) continue
    const validCategories = ["preference","project","fact","decision","pattern"]
    const validScopes     = ["global","project"]
    if (!validCategories.includes(fact.category)) continue
    if (!validScopes.includes(fact.scope))         continue

    const addData: Parameters<typeof memoryStore.add>[0] = {
      content:  fact.content,
      category: fact.category as Category,
      scope:    fact.scope    as Scope,
      source:   "auto",
    }
    if (fact.scope === "project") addData.project = workdir
    memoryStore.add(addData)
  }

  // Human-readable yedek
  memoryStore.exportToFile(workdir)
}
