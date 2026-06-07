import { z } from "zod"
import { resolve } from "path"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"

export const grepTool: ToolDef = {
  id:          "grep",
  description: "Search for a pattern in files. Returns matching lines with file names and line numbers.",
  parameters:  z.object({
    pattern:  z.string().describe("Search pattern (string or regex)"),
    path:     z.string().optional().describe("File or directory to search (defaults to project root)"),
    glob:     z.string().optional().describe("File glob filter e.g. '*.ts'"),
    case_sensitive: z.boolean().optional().describe("Case-sensitive search (default: false)"),
  }),
  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    const pattern       = String(args["pattern"] ?? "")
    const searchPath    = resolve(ctx.workdir, String(args["path"] ?? "."))
    const globPattern   = String(args["glob"] ?? "**/*")
    const caseSensitive = args["case_sensitive"] === true

    const re = new RegExp(pattern, caseSensitive ? "g" : "gi")
    const fileGlob = new Bun.Glob(globPattern)
    const matches: string[] = []

    for await (const file of fileGlob.scan({ cwd: searchPath, absolute: true })) {
      let content: string
      try { content = await Bun.file(file).text() } catch { continue }

      const lines = content.split("\n")
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]!)) {
          const rel = file.replace(ctx.workdir + "/", "")
          matches.push(`${rel}:${i + 1}: ${lines[i]!.trim()}`)
          if (matches.length >= 200) { matches.push("... (truncated at 200)"); break }
        }
        re.lastIndex = 0
      }
      if (matches.length >= 200) break
    }

    if (matches.length === 0) return { output: "(no matches)" }
    return { output: matches.join("\n") }
  },
}
