import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"
import { ProviderPlugin, type ModelInfo } from "./plugin.js"

// Model ID'den capability flag'lerini tahmin et
function inferCapabilities(id: string): Pick<ModelInfo, "supportsTools" | "supportsVision" | "supportsThinking"> {
  const lower = id.toLowerCase()
  const isVision   = lower.includes("llava") || lower.includes("vision") || lower.includes("bakllava")
                  || lower.includes("gemma3") || lower.includes("minicpm-v")
  const noTools    = lower.includes("deepseek-r1") || lower.includes("llama3.2:1b")
                  || lower.includes("llava") || lower.includes("bakllava")
                  || lower.includes("phi3:mini")
  const hasThink   = lower.includes("deepseek-r1") || lower.includes("qwq")
                  || lower.includes("thinking") || lower.includes("reflection")
  return {
    supportsTools:    !noTools,
    supportsVision:   isVision,
    supportsThinking: hasThink,
  }
}

export class OllamaPlugin extends ProviderPlugin {
  readonly id      = "ollama"
  readonly name    = "Ollama (Local)"
  readonly sdkType = "openai-compatible" as const

  private readonly baseURL: string
  private readonly apiBase: string   // Ollama native API (non-OpenAI compat)

  constructor() {
    super()
    const host    = process.env["OLLAMA_HOST"] ?? "http://localhost:11434"
    this.apiBase  = host.replace(/\/+$/, "")
    this.baseURL  = process.env["OLLAMA_BASE_URL"] ?? `${this.apiBase}/v1`
  }

  private get client() {
    return createOpenAI({ apiKey: "ollama", baseURL: this.baseURL })
  }

  getModel(modelId: string): LanguageModel {
    return this.client(modelId) as LanguageModel
  }

  defaultModel(): string {
    return process.env["OLLAMA_DEFAULT_MODEL"] ?? "llama3.2"
  }

  // Fallback: Ollama yokken gösterilecek yaygın modeller
  listModels(): ModelInfo[] {
    return [
      { id: "llama3.2",          name: "Llama 3.2 3B",       contextWindow: 131_072, maxOutput: 8_192, supportsTools: true,  supportsVision: false, supportsThinking: false },
      { id: "llama3.1",          name: "Llama 3.1 8B",        contextWindow: 131_072, maxOutput: 8_192, supportsTools: true,  supportsVision: false, supportsThinking: false },
      { id: "qwen2.5-coder:7b",  name: "Qwen2.5 Coder 7B",  contextWindow: 131_072, maxOutput: 8_192, supportsTools: true,  supportsVision: false, supportsThinking: false },
      { id: "deepseek-r1:7b",    name: "DeepSeek R1 7B",     contextWindow: 64_000,  maxOutput: 8_192, supportsTools: false, supportsVision: false, supportsThinking: true  },
      { id: "deepseek-r1:14b",   name: "DeepSeek R1 14B",    contextWindow: 64_000,  maxOutput: 8_192, supportsTools: false, supportsVision: false, supportsThinking: true  },
      { id: "phi4",              name: "Phi-4 14B",           contextWindow: 16_384,  maxOutput: 4_096, supportsTools: true,  supportsVision: false, supportsThinking: false },
      { id: "gemma3:9b",         name: "Gemma 3 9B",          contextWindow: 131_072, maxOutput: 8_192, supportsTools: true,  supportsVision: true,  supportsThinking: false },
      { id: "llava",             name: "LLaVA (vision)",      contextWindow: 4_096,   maxOutput: 4_096, supportsTools: false, supportsVision: true,  supportsThinking: false },
    ]
  }

  // Gerçek kurulu modelleri Ollama API'sinden çek
  override async listModelsRemote(): Promise<ModelInfo[]> {
    try {
      const res  = await fetch(`${this.apiBase}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return this.listModels()
      const data = await res.json() as { models?: Array<{ name: string; details?: { parameter_size?: string; family?: string } }> }
      const models = data.models ?? []
      if (!models.length) return this.listModels()

      return models.map((m): ModelInfo => {
        const id    = m.name
        const caps  = inferCapabilities(id)
        // Parametre boyutundan context window ve output tahmini
        const ps    = (m.details?.parameter_size ?? "").toLowerCase()
        const ctx   = ps.includes("70b") || ps.includes("72b") ? 131_072
                    : ps.includes("32b") ? 131_072
                    : ps.includes("14b") ? 131_072
                    : ps.includes("7b")  ? 131_072
                    : ps.includes("3b")  ? 131_072
                    : 4_096
        return {
          id,
          name:          id,
          contextWindow: ctx,
          maxOutput:     Math.min(8_192, Math.floor(ctx / 8)),
          ...caps,
        }
      })
    } catch {
      return this.listModels()
    }
  }
}
