import { z } from "zod"
import { agentPool } from "../../agent/pool.js"
import { AGENT_TYPE_TOOLS } from "../../agent/protocol.js"
import { getAgentPrompt } from "../../agent/agent-prompts.js"
import type { AgentType } from "../../agent/protocol.js"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"

const AGENT_TYPES = Object.keys(AGENT_TYPE_TOOLS) as [AgentType, ...AgentType[]]

export const subagentTool: ToolDef = {
  id: "subagent",
  timeoutMs: 600_000,  // 10 min — pool's own WORKER_TIMEOUT is 5 min, this gives safe headroom
  description: `Spawn a parallel worker agent to perform a specific task.

WHEN TO USE:
- Scanning/searching a large codebase (always delegate this)
- Research that can run independently while you plan
- Long file operations (read + analyze + summarize many files)
- Parallel tasks: spawn multiple subagents simultaneously for independent work
- Any task that would take >5 tool calls and doesn't need your direct attention

DO NOT USE FOR:
- Simple single tool calls (use bash/read/edit directly)
- Tasks that need results from a previous subagent (await them in order)
- Short tasks (<3 steps)

Agent types and their tools:
- explore:     read, glob, grep, webfetch, websearch  (read-only research)
- code:        read, write, edit, apply_patch, glob, grep, bash, lsp, undo  (full coding)
- review:      read, glob, grep, lsp  (code review + diagnostics)
- test:        read, glob, grep, bash  (run tests, check results)
- docs:        read, write, edit, glob, grep  (documentation)
- performance: read, glob, grep, bash  (profiling, bundle analysis)
- security:    read, glob, grep, lsp  (security scanning)
- debug:       read, glob, grep, bash, lsp  (debugging)

The subagent CANNOT see your conversation history — include ALL needed context in the prompt.
Write the prompt as if the subagent has never seen this codebase before.`,

  parameters: z.object({
    type:   z.enum(AGENT_TYPES)
              .default("explore")
              .describe("Agent type — determines which tools the worker can use"),
    role:   z.string().describe("Brief worker title, e.g. 'Codebase Scanner', 'Test Runner', 'Code Reviewer'"),
    prompt: z.string().describe("Complete, self-contained instructions. Include: goal, relevant file paths or patterns, expected output format."),
  }),

  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    const { role, prompt } = args as { role: string; prompt: string }
    const agentType = ((args as Record<string, unknown>)["type"] as AgentType | undefined) ?? "explore"
    const allowedTools = AGENT_TYPE_TOOLS[agentType]

    const provider = ctx.provider ?? (process.env["ANTHROPIC_API_KEY"] ? "anthropic" : "opencode")
    const model    = ctx.model ?? undefined

    const id      = `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const session = `${id}-session`

    try {
      const result = await agentPool.spawn({
        id,
        agentType,
        desc:           role,
        prompt,
        provider,
        model:          model ?? "claude-sonnet-4-6",
        workdir:        ctx.workdir,
        sessionId:      ctx.sessionId ?? "main",
        workerSessionId: session,
        allowedTools,
      })

      return {
        output: `Subagent [${role}] completed:\n\n${result}`,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Pool dolu ise fallback: runAgent direkt
      if (msg.includes("dolu") || msg.includes("max")) {
        const { runAgent } = await import("../../agent/loop.js")
        const r = await runAgent({
          provider,
          ...(model !== undefined ? { model } : {}),
          workdir:  ctx.workdir,
          system:   getAgentPrompt(agentType),
          messages: [{ role: "user", content: prompt }],
        })
        return { output: `Subagent [${role}] (direct):\n\n${r.text}` }
      }
      return { output: "", error: `Subagent [${role}] failed: ${msg}` }
    }
  },
}
