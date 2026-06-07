import { join } from "path"
import { homedir } from "os"
import type { MCPConfig, MCPServerConfig } from "./types.js"

export function loadMCPConfig(workdir: string): MCPConfig {
  const merged: MCPConfig = { mcpServers: {} }

  // Önce global (~/.omnicod/mcp.json), sonra proje (.omnicod/mcp.json) — proje override eder
  const paths = [
    join(homedir(), ".omnicod", "mcp.json"),
    join(workdir, ".omnicod", "mcp.json"),
  ]

  for (const p of paths) {
    try {
      const raw = require("fs").readFileSync(p, "utf8") as string
      const cfg = JSON.parse(raw) as Partial<MCPConfig>
      if (cfg.mcpServers) {
        Object.assign(merged.mcpServers, cfg.mcpServers)
      }
    } catch { /* dosya yoksa atla */ }
  }

  return merged
}

export function enabledServers(cfg: MCPConfig): Record<string, MCPServerConfig> {
  const result: Record<string, MCPServerConfig> = {}
  for (const [name, server] of Object.entries(cfg.mcpServers)) {
    if (server.enabled !== false) result[name] = server
  }
  return result
}
