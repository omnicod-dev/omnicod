import { z } from "zod"
import { execSync } from "child_process"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"

function git(cmd: string, cwd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: "utf8", stdio: ["pipe","pipe","pipe"] }).trim()
  } catch (e) {
    const msg = (e as { stderr?: string; message?: string }).stderr || (e as Error).message || String(e)
    throw new Error(msg.trim())
  }
}

export const gitTool: ToolDef = {
  id:          "git",
  description: `Git operations — status, diff, log, commit, branch.

Actions:
- status:  Show staged/modified/untracked files
- diff:    Show changes (optionally for a specific file)
- log:     Recent commits (default: last 10)
- commit:  Stage all changes and commit with a message
- branch:  List branches or switch to one
- stash:   Stash or pop changes

Use status before diff to understand the scope. Use log to understand context.`,

  parameters: z.object({
    action:  z.enum(["status","diff","log","commit","branch","stash"]),
    file:    z.string().optional().describe("Specific file for diff"),
    message: z.string().optional().describe("Commit message"),
    name:    z.string().optional().describe("Branch name to create or switch"),
    count:   z.number().optional().describe("Number of log entries (default: 10)"),
  }),

  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    const { action, file, message, name } = args as {
      action: string; file?: string; message?: string; name?: string; count?: number
    }
    const count = (args as { count?: number }).count ?? 10
    const cwd   = ctx.workdir

    try {
      switch (action) {
        case "status": {
          const out = git("status --short", cwd)
          return { output: out || "Working tree clean." }
        }

        case "diff": {
          const target = file ? `-- "${file}"` : ""
          const staged = git(`diff --cached ${target}`, cwd)
          const unstaged = git(`diff ${target}`, cwd)
          const combined = [
            staged    ? `=== Staged ===\n${staged}`    : "",
            unstaged  ? `=== Unstaged ===\n${unstaged}` : "",
          ].filter(Boolean).join("\n\n")
          return { output: combined || "No changes." }
        }

        case "log": {
          const out = git(`log --oneline -${count}`, cwd)
          return { output: out || "No commits yet." }
        }

        case "commit": {
          if (!message) return { output: "", error: "Commit message required." }
          git("add -A", cwd)
          const out = git(`commit -m "${message.replace(/"/g, "'")}"`, cwd)
          return { output: out }
        }

        case "branch": {
          if (name) {
            try {
              git(`checkout -b "${name}"`, cwd)
              return { output: `Created and switched to branch: ${name}` }
            } catch {
              git(`checkout "${name}"`, cwd)
              return { output: `Switched to branch: ${name}` }
            }
          }
          const out = git("branch -a", cwd)
          return { output: out }
        }

        case "stash": {
          const sub = file ?? "push"
          if (sub === "pop") {
            const out = git("stash pop", cwd)
            return { output: out }
          }
          const out = git("stash push", cwd)
          return { output: out }
        }

        default:
          return { output: "", error: `Unknown action: ${action}` }
      }
    } catch (err) {
      return { output: "", error: err instanceof Error ? err.message : String(err) }
    }
  },
}
