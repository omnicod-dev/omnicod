export interface MCPServerConfig {
  command:  string
  args?:    string[]
  env?:     Record<string, string>
  enabled?: boolean    // default: true
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>
}

export interface MCPToolInfo {
  server:      string
  name:        string
  description: string
  inputSchema: Record<string, unknown>
}
