import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { MCPServerConfig, MCPToolInfo } from "./types.js"

export class MCPClient {
  private client:    Client
  private connected: boolean = false

  constructor(
    readonly serverName: string,
    private config: MCPServerConfig,
  ) {
    this.client = new Client({ name: "omnicod", version: "0.0.1" })
  }

  async connect(): Promise<void> {
    const transport = new StdioClientTransport({
      command: this.config.command,
      args:    this.config.args ?? [],
      env:     { ...process.env, ...(this.config.env ?? {}) } as Record<string, string>,
    })

    await this.client.connect(transport)
    this.connected = true
  }

  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.connected) return []
    try {
      const { tools } = await this.client.listTools()
      return tools.map((t) => ({
        server:      this.serverName,
        name:        t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema as Record<string, unknown>,
      }))
    } catch { return [] }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.client.callTool({ name, arguments: args })
    const content = result.content
    if (Array.isArray(content)) {
      return content
        .map((c) => {
          const part = c as { type: string; text?: string }
          return part.type === "text" ? (part.text ?? "") : JSON.stringify(c)
        })
        .join("\n")
    }
    return JSON.stringify(content)
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close()
      this.connected = false
    }
  }

  get isConnected() { return this.connected }
}
