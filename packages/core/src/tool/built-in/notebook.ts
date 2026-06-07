import { z } from "zod"
import { readFile, writeFile } from "node:fs/promises"
import type { ToolDef, ToolContext, ExecuteResult } from "../types.js"

export const notebookEditTool: ToolDef = {
  id: "notebook_edit",
  description: "Safely read or edit Jupyter Notebooks (.ipynb) without breaking their JSON structure. Actions: 'read' (view cells), 'update' (modify cell source), 'add' (insert cell), 'delete' (remove cell).",
  parameters: z.object({
    path: z.string().describe("Absolute path to the .ipynb file"),
    action: z.enum(["read", "update", "add", "delete"]).describe("Action to perform"),
    cellIndex: z.number().optional().describe("Index of the cell to read/update/delete (0-based)"),
    cellType: z.enum(["code", "markdown"]).optional().describe("Type of the new cell (only for 'add')"),
    source: z.string().optional().describe("Source code or markdown content for 'update' and 'add'"),
  }),
  async execute(args, ctx: ToolContext): Promise<ExecuteResult> {
    const path = String(args["path"])
    const action = String(args["action"])
    
    let nb: any
    try {
      const content = await readFile(path, "utf-8")
      nb = JSON.parse(content)
      if (!nb.cells || !Array.isArray(nb.cells)) throw new Error("Invalid notebook format")
    } catch (err) {
      if (action === "add" && (err as any).code === "ENOENT") {
        nb = { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 }
      } else {
        return { output: "", error: `Failed to read notebook: ${err}` }
      }
    }

    if (action === "read") {
      const cells = nb.cells.map((c: any, i: number) => {
        const source = Array.isArray(c.source) ? c.source.join("") : (c.source || "")
        return `[Cell ${i}] (${c.cell_type})\n${source}`
      })
      return { output: `Notebook has ${cells.length} cells:\n\n${cells.join("\n\n-----------------\n\n")}` }
    }

    const index = Number(args["cellIndex"] ?? -1)

    if (action === "update") {
      if (index < 0 || index >= nb.cells.length) return { output: "", error: `Invalid cellIndex: ${index}` }
      if (!args["source"]) return { output: "", error: "source is required for update" }
      nb.cells[index].source = String(args["source"]).split("\n").map((line, i, arr) => line + (i === arr.length - 1 ? "" : "\n"))
    } 
    else if (action === "delete") {
      if (index < 0 || index >= nb.cells.length) return { output: "", error: `Invalid cellIndex: ${index}` }
      nb.cells.splice(index, 1)
    } 
    else if (action === "add") {
      if (!args["source"]) return { output: "", error: "source is required for add" }
      const newCell = {
        cell_type: args["cellType"] ?? "code",
        metadata: {},
        source: String(args["source"]).split("\n").map((line, i, arr) => line + (i === arr.length - 1 ? "" : "\n")),
        ...(args["cellType"] === "code" ? { execution_count: null, outputs: [] } : {})
      }
      if (index >= 0 && index <= nb.cells.length) {
        nb.cells.splice(index, 0, newCell)
      } else {
        nb.cells.push(newCell)
      }
    }

    try {
      await writeFile(path, JSON.stringify(nb, null, 1))
      return { output: `Notebook action '${action}' successful on ${path}` }
    } catch (err) {
      return { output: "", error: `Failed to save notebook: ${err}` }
    }
  }
}
