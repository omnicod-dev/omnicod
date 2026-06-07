import { z } from "zod"
import { memoryStore } from "../../memory/store.js"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"
import type { Category, Scope } from "../../memory/types.js"

const CATEGORIES = ["preference","project","fact","decision","pattern"] as const
const SCOPES     = ["global","project"] as const

export const memoryTool: ToolDef = {
  id: "memory",
  description:
    "Manage persistent memory across sessions.\n\n" +
    "Actions:\n" +
    "- remember: Store a fact for future sessions\n" +
    "- forget: Remove a memory by ID\n" +
    "- list: Show all memories (optionally filter by category)\n" +
    "- search: Find memories matching a query\n" +
    "- clear: Delete all project memories (use carefully)\n\n" +
    "When to use:\n" +
    "- User states a preference → remember(category: preference, scope: global)\n" +
    "- Important project decision made → remember(category: decision, scope: project)\n" +
    "- You notice a recurring pattern → remember(category: pattern, scope: project)\n" +
    "- Memory is outdated/wrong → forget(id)\n\n" +
    "Prefer scope:'project' for codebase-specific facts, 'global' for user preferences.",

  parameters: z.object({
    action:   z.enum(["remember","forget","list","search","clear"])
               .describe("Action to perform"),
    content:  z.string().optional()
               .describe("Fact to store — one clear, specific sentence (for 'remember')"),
    category: z.enum(CATEGORIES).optional()
               .describe("Category: preference | project | fact | decision | pattern"),
    scope:    z.enum(SCOPES).optional()
               .describe("Scope: 'project' (this codebase) or 'global' (all projects). Default: project"),
    id:       z.string().optional()
               .describe("Memory ID to remove (for 'forget')"),
    query:    z.string().optional()
               .describe("Search query (for 'search')"),
  }),

  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    const action   = String(args["action"])
    const workdir  = ctx.workdir

    // ── remember ──────────────────────────────────────────────────────────────
    if (action === "remember") {
      const content  = String(args["content"] ?? "").trim()
      if (!content) return { output: "", error: "content is required for remember" }

      const category = (args["category"] as Category | undefined) ?? "fact"
      const scope    = (args["scope"]    as Scope    | undefined) ?? "project"

      const addData: Parameters<typeof memoryStore.add>[0] = {
        content, category, scope, source: "tool",
      }
      if (scope === "project") addData.project = workdir
      const m = memoryStore.add(addData)
      memoryStore.exportToFile(workdir)
      return { output: `Remembered [${m.id.slice(0,8)}] [${category}] ${content}` }
    }

    // ── forget ────────────────────────────────────────────────────────────────
    if (action === "forget") {
      const id = String(args["id"] ?? "").trim()
      if (!id) return { output: "", error: "id is required for forget" }
      const ok = memoryStore.remove(id)
      memoryStore.exportToFile(workdir)
      return ok
        ? { output: `Forgotten: ${id}` }
        : { output: "", error: `Memory not found: ${id}` }
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (action === "list") {
      const all = memoryStore.list(workdir)
      if (!all.length) return { output: "(no memories stored yet)" }
      const lines = all.map((m) =>
        `[${m.id.slice(0,8)}] [${m.scope}/${m.category}] ${m.content}`
      )
      return { output: `${all.length} memories:\n\n${lines.join("\n")}` }
    }

    // ── search ────────────────────────────────────────────────────────────────
    if (action === "search") {
      const query = String(args["query"] ?? "").trim()
      if (!query) return { output: "", error: "query is required for search" }
      const results = memoryStore.search(query, workdir)
      if (!results.length) return { output: `No memories matching: "${query}"` }
      const lines = results.map((m) =>
        `[${m.id.slice(0,8)}] [${m.category}] ${m.content}`
      )
      return { output: `Found ${results.length}:\n\n${lines.join("\n")}` }
    }

    // ── clear ─────────────────────────────────────────────────────────────────
    if (action === "clear") {
      const n = memoryStore.clear("project", workdir)
      memoryStore.exportToFile(workdir)
      return { output: `Cleared ${n} project memories.` }
    }

    return { output: "", error: `Unknown action: ${action}` }
  },
}
