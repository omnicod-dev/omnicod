import { z } from "zod"
import { ToolRegistry } from "../tool/registry.js"
import type { ToolDef, ToolContext } from "../tool/types.js"
import type { MCPClient } from "./client.js"
import type { MCPToolInfo } from "./types.js"

// JSON Schema → minimal Zod object
function jsonSchemaToZod(schema: Record<string, unknown>): z.AnyZodObject {
  if (schema["type"] !== "object") return z.object({}).passthrough()

  const props    = (schema["properties"] as Record<string, { type?: string; description?: string }>) ?? {}
  const required = (schema["required"]   as string[]) ?? []
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, prop] of Object.entries(props)) {
    let t: z.ZodTypeAny
    switch (prop.type) {
      case "string":  t = z.string();  break
      case "number":
      case "integer": t = z.number();  break
      case "boolean": t = z.boolean(); break
      case "array":   t = z.array(z.unknown()); break
      default:        t = z.unknown(); break
    }
    if (prop.description) t = (t as z.ZodString).describe(prop.description)
    if (!required.includes(key)) t = t.optional()
    shape[key] = t
  }

  return z.object(shape)
}

export function bridgeTool(client: MCPClient, info: MCPToolInfo): ToolDef {
  return {
    id:          `mcp:${info.server}:${info.name}`,
    description: `[MCP:${info.server}] ${info.description}`,
    parameters:  jsonSchemaToZod(info.inputSchema),
    async execute(args: Record<string, unknown>, _ctx: ToolContext) {
      try {
        const output = await client.callTool(info.name, args)
        return { output }
      } catch (err) {
        return { output: "", error: String(err) }
      }
    },
  }
}

export async function registerMCPTools(client: MCPClient): Promise<string[]> {
  const tools = await client.listTools()
  const ids: string[] = []

  for (const info of tools) {
    const def = bridgeTool(client, info)
    ToolRegistry.register(def)
    ids.push(def.id)
  }

  return ids
}
