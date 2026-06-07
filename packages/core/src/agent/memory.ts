import type { CoreMessage } from "ai"
import { generateText } from "ai"
import { ProviderRegistry } from "../provider/registry.js"

export async function generateAwaySummary(
  providerId: string,
  modelId: string,
  messages: CoreMessage[],
  durationMs: number
): Promise<string | null> {
  // Sadece 15 saniyeden uzun süren görevler için özet oluştur
  if (durationMs < 15000) return null;
  if (messages.length === 0) return null;

  const plugin = ProviderRegistry.get(providerId)
  if (!plugin) return null

  const prompt = "The user stepped away and is coming back. Write exactly 1-3 short sentences in Turkish summarizing what was just done. Start by stating the high-level task. Next: the concrete next step. Skip status reports and commit recaps."
  
  try {
    const response = await generateText({
      model: plugin.getModel(modelId),
      messages: [
        ...messages.slice(-30),
        { role: "user", content: prompt }
      ]
    })
    return response.text
  } catch (e) {
    return null
  }
}

