import { z } from "zod"
import { readFile, writeFile } from "fs/promises"
import { resolve } from "path"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"
import { snapshotManager } from "../../snapshot/snapshot.js"

export const editTool: ToolDef = {
  id:   "edit",
  spec: { category: "write", riskLevel: "medium", permissionSummary: "Edit a file (string replacement)" },
  description: "Replace an exact string in a file. Fails if old_string is not found or is not unique.",
  parameters:  z.object({
    path:       z.string().describe("Path to the file to edit"),
    old_string: z.string().describe("The exact string to replace (must be unique in the file)"),
    new_string: z.string().describe("The replacement string"),
  }),
  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    const filePath  = resolve(ctx.workdir, String(args["path"] ?? ""))
    const oldString = String(args["old_string"] ?? "")
    const newString = String(args["new_string"] ?? "")

    await snapshotManager.takeSnapshot(filePath)

    let content: string
    try {
      content = await readFile(filePath, "utf8")
    } catch (err) {
      return { output: "", error: `Cannot read file: ${err}` }
    }


    const count = content.split(oldString).length - 1
    if (count === 0) return { output: "", error: "old_string not found in file. You likely pattern-completed the content from memory instead of reading it. Use the `read` tool to see the actual current content, then retry with an exact verbatim match." }
    if (count > 1)   return { output: "", error: `old_string found ${count} times — must be unique` }

    const updated = content.replace(oldString, newString)
    try {
      await writeFile(filePath, updated, "utf8")
      // Diff bilgisini output'a göm — UI bunu parse edip DiffView ile gösterir
      return { output: `Replaced 1 occurrence in ${filePath}\n__DIFF__\n${oldString}\n__NEW__\n${newString}` }
    } catch (err) {
      return { output: "", error: `Cannot write file: ${err}` }
    }
  },
}
