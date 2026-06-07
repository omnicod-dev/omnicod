import { streamText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"

async function run() {
  const provider = createAnthropic({ apiKey: "sk-ant-dummy" }) // intentionally invalid
  const result = streamText({
    model: provider("claude-3-haiku-20240307"),
    messages: [{ role: "user", content: "merhaba" }]
  })

  for await (const part of result.fullStream) {
    console.log("PART:", part)
  }
}

run().catch(console.error)
