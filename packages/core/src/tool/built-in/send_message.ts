import { z }              from "zod"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"

export const sendMessageTool: ToolDef = {
  id: "send_message",

  description: `Send a message to another agent worker by name, or broadcast to all with "*".

WHEN TO USE:
- Share intermediate findings with a sibling agent ("I found the bug in auth.ts")
- Ask a specialist agent to check something while you continue
- Coordinate parallel work ("I'm handling auth, you take the DB layer")
- Broadcast a discovery all agents need ("STOP: found critical security issue")

Messages are delivered immediately (in-memory). The recipient processes them
after its current LLM step finishes.

Use the role name exactly as it was given to the agent (e.g. "Security Auditor", "DB Layer").
"*" broadcasts to ALL currently running sibling agents.`,

  parameters: z.object({
    to:      z.string().describe('Recipient agent role name, or "*" for broadcast'),
    message: z.string().describe("The message content — be specific and actionable"),
    summary: z.string().optional().describe("5-10 word summary shown in UI (optional)"),
  }),

  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    if (!ctx.sendMessage) {
      return { output: "", error: "send_message is only available inside agent workers" }
    }
    const to      = args["to"]      as string
    const message = args["message"] as string
    ctx.sendMessage(to, message)
    return { output: `Message queued for "${to}"` }
  },
}
