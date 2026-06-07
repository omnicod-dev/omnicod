/**
 * models.dev entegrasyonu — model capability'leri için harici kaynak.
 * Tek sorumluluk: hangi model "reasoning" destekliyor?
 */

interface ModelsDevModel {
  id:        string
  reasoning: boolean
  tool_call?: boolean
  attachment?: boolean
}

interface ModelsDevEntry {
  models?: ModelsDevModel[]
}

type ModelsDevResponse = Record<string, ModelsDevEntry>

// 24 saatlik cache — TTL
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
let cachedAt = 0
let cache: Map<string, boolean> = new Map()   // modelId → reasoning supported

async function fetchReasoningMap(): Promise<Map<string, boolean>> {
  try {
    const res  = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return new Map()
    const data = await res.json() as ModelsDevResponse
    const map  = new Map<string, boolean>()
    for (const entry of Object.values(data)) {
      for (const m of entry.models ?? []) {
        map.set(m.id, m.reasoning ?? false)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

async function getCache(): Promise<Map<string, boolean>> {
  if (Date.now() - cachedAt < CACHE_TTL_MS && cache.size > 0) return cache
  const fresh = await fetchReasoningMap()
  if (fresh.size > 0) { cache = fresh; cachedAt = Date.now() }
  return cache
}

/**
 * Verilen model ID'nin reasoning/thinking destekleyip desteklemediğini döner.
 * Hata veya bilinmeyen model → false (güvenli varsayılan).
 */
export async function supportsReasoning(modelId: string): Promise<boolean> {
  const map = await getCache()
  // Tam eşleşme
  if (map.has(modelId)) return map.get(modelId)!
  // Suffix eşleşmesi: "anthropic/claude-sonnet-4-6" → "claude-sonnet-4-6"
  const suffix = modelId.includes("/") ? modelId.split("/").pop()! : modelId
  return map.get(suffix) ?? false
}

/**
 * Bir model listesi için reasoning flag'lerini toplu çek.
 * Remote model listelerinde kullanılır.
 */
export async function enrichWithReasoning<T extends { id: string; supportsThinking?: boolean }>(
  models: T[]
): Promise<T[]> {
  const map = await getCache()
  if (map.size === 0) return models   // fetch başarısız → dokunma
  return models.map((m) => {
    const suffix   = m.id.includes("/") ? m.id.split("/").pop()! : m.id
    const reasoned = map.get(m.id) ?? map.get(suffix)
    if (reasoned === undefined) return m
    return { ...m, supportsThinking: reasoned }
  })
}
