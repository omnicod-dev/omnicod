import { getEncoding, type TiktokenEncoding } from "js-tiktoken"

const MODEL_ENCODINGS: Record<string, TiktokenEncoding> = {
  // Anthropic (cl100k_base yaklaşımı)
  "claude-opus-4-8":            "cl100k_base",
  "claude-sonnet-4-6":          "cl100k_base",
  "claude-haiku-4-5-20251001":  "cl100k_base",
  // OpenAI — GPT-4o ve sonrası o200k_base kullanır
  "gpt-4o":                     "o200k_base",
  "gpt-4o-mini":                "o200k_base",
  "o3":                         "o200k_base",
  "o3-mini":                    "o200k_base",
  "o4-mini":                    "o200k_base",
  "gpt-4-turbo":                "cl100k_base",
  "gpt-4":                      "cl100k_base",
  "gpt-3.5-turbo":              "cl100k_base",
}

const cache = new Map<TiktokenEncoding, ReturnType<typeof getEncoding>>()

function getEncoder(encoding: TiktokenEncoding) {
  if (!cache.has(encoding)) {
    cache.set(encoding, getEncoding(encoding))
  }
  return cache.get(encoding)!
}

function resolveEncoding(modelId: string): TiktokenEncoding {
  if (MODEL_ENCODINGS[modelId]) return MODEL_ENCODINGS[modelId]!
  // OpenRouter format: "provider/model-name"
  if (modelId.includes("/")) {
    const sub = modelId.split("/")[1] ?? ""
    if (sub.startsWith("gpt-4o") || sub.startsWith("o3") || sub.startsWith("o4")) return "o200k_base"
    if (sub.startsWith("claude")) return "cl100k_base"
  }
  return "cl100k_base"
}

export function countTokens(text: string, modelId?: string): number {
  const encoding = resolveEncoding(modelId ?? "")
  return getEncoder(encoding).encode(text).length
}

export function estimateMessages(
  messages: Array<{ role: string; content: string }>,
  modelId?: string,
): number {
  return messages.reduce((sum, m) => sum + countTokens(m.content, modelId) + 4, 0)
}
