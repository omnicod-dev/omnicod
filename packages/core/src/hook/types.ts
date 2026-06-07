export interface HookPayloads {
  "v1.session.start": { sessionId: string }
  "v1.session.end": { sessionId: string; reason: string }
  "v1.session.compact": { sessionId: string; tokensBefore: number; tokensAfter: number }
  "v1.chat.message": { role: string; content: string }
  "v1.chat.system": { prompt: string }
  "v1.tool.before": { tool: string; args: Record<string, unknown> }
  "v1.tool.after": { tool: string; args: Record<string, unknown>; result: unknown; durationMs: number }
  "v1.permission.ask": { tool: string; pattern: string }
  "v1.context.inject": { skillIds: string[] }
  "v1.agent.spawn": { childSessionId: string; type: string; prompt: string }
  "v1.agent.complete": { childSessionId: string; result: string }
  "v1.agent.error": { childSessionId: string; error: string }
  "v1.mcp.connected":    { serverName: string; tools: string[] }
  "v1.mcp.disconnected": { serverName: string }
  // Compaction hooks
  "v1.compact.before":   { sessionId: string; tokenCount: number }
  "v1.compact.after":    { sessionId: string; tokensBefore: number; tokensAfter: number }
  // Worktree hooks
  "v1.worktree.enter":   { branch: string; path: string }
  "v1.worktree.exit":    { branch: string; action: "keep" | "remove" }
  // Tool error
  "v1.tool.error": { tool: string; args: Record<string, unknown>; error: string; durationMs: number }
}

export type HookName = keyof HookPayloads
