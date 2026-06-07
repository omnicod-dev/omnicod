import { z } from "zod"
import { questionService } from "../../question/service.js"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"

const QUESTION_TIMEOUT_MS = 5 * 60 * 1000 // 5 dakika

export const questionTool: ToolDef = {
  id: "question",
  description:
    "Ask the user one or more questions during execution. Use when you need:\n" +
    "1. User preference or decision between options\n" +
    "2. Clarification of ambiguous instructions\n" +
    "3. Implementation direction choices\n" +
    "4. Confirmation before a significant action\n\n" +
    "Usage notes:\n" +
    "- custom: true (default) adds a 'Type your own answer' option automatically\n" +
    "- multiple: true allows selecting more than one option\n" +
    "- Keep option labels concise (1-5 words)\n" +
    "- If you recommend an option, list it first and mark it '(Recommended)'\n" +
    "- Batch related questions in one call rather than calling repeatedly",

  parameters: z.object({
    questions: z.array(
      z.object({
        header:   z.string().describe("Very short label (max 30 chars), e.g. 'Database Type'"),
        question: z.string().describe("The full question text"),
        options:  z.array(
          z.object({
            label:       z.string().describe("Short option label (1-5 words)"),
            description: z.string().describe("Explanation of this choice"),
          })
        ).describe("Available choices"),
        multiple: z.boolean().optional().describe("Allow selecting multiple options (default: false)"),
        custom:   z.boolean().optional().describe("Allow typing a custom answer (default: true)"),
      })
    ).describe("Questions to ask the user"),
  }),

  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    const questions = args["questions"] as Array<{
      header: string
      question: string
      options: Array<{ label: string; description: string }>
      multiple?: boolean
      custom?: boolean
    }>

    if (!questions || questions.length === 0) {
      return { output: "", error: "No questions provided" }
    }

    // Timeout race
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Question timed out after 5 minutes")),
        QUESTION_TIMEOUT_MS,
      )
    })

    try {
      const answers = await Promise.race([
        questionService.ask({ sessionId: ctx.sessionId, questions }),
        timeoutPromise,
      ])

      clearTimeout(timeoutId)

      // Formatlanmış cevap döndür
      const lines = questions.map((q, idx) => {
        const ans = answers[idx] ?? []
        return `Question: ${q.question}\nAnswer: ${ans.length > 0 ? ans.join(", ") : "(no answer)"}`
      })

      return { output: lines.join("\n\n") }
    } catch (err) {
      clearTimeout(timeoutId)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("dismissed") || msg.includes("rejected")) {
        return { output: "", error: "User dismissed the question — continue without the answer or use a default" }
      }
      return { output: "", error: msg }
    }
  },
}
