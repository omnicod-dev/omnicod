import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { ProviderRegistry } from "../provider/registry.js"
import { SessionManager } from "../session/manager.js"
import { sseManager } from "./sse.js"
import { bearerAuth } from "./auth.js"
import { runAgent } from "../agent/loop.js"
import { mcpManager } from "../mcp/manager.js"
import type { SessionConfig } from "../session/types.js"
import type { MCPServerConfig } from "../mcp/types.js"

export function createApp() {
  const app = new Hono()
  app.use("*", bearerAuth)

  app.get("/v1/health", (c) => {
    return c.json({ status: "ok", version: "0.0.1" })
  })

  app.get("/v1/provider", (c) => {
    const providers = ProviderRegistry.list().map((p) => ({
      id: p.id,
      name: p.name,
      defaultModel: p.defaultModel(),
      models: p.listModels(),
    }))
    return c.json(providers)
  })

  app.get("/v1/session", (c) => {
    return c.json(SessionManager.list())
  })

  app.post("/v1/session", async (c) => {
    const body = await c.req.json<{ provider?: string; model?: string; system?: string; title?: string }>()
    const provider = body.provider ?? "anthropic"
    const cfg: SessionConfig = {
      provider,
      model: body.model ?? ProviderRegistry.get(provider).defaultModel(),
      ...(body.system !== undefined ? { system: body.system } : {}),
    }
    const id = SessionManager.create(cfg, body.title !== undefined ? { title: body.title } : {})
    return c.json({ id }, 201)
  })

  app.get("/v1/session/:id", (c) => {
    const session = SessionManager.get(c.req.param("id"))
    if (!session) return c.json({ error: "Not found" }, 404)
    return c.json(session)
  })

  app.post("/v1/session/:id/message", async (c) => {
    const sessionId = c.req.param("id")
    const session = SessionManager.get(sessionId)
    if (!session) return c.json({ error: "Not found" }, 404)

    const body = await c.req.json<{ content: string }>()
    const cfg = session.config
      ? JSON.parse(session.config) as SessionConfig
      : { provider: "anthropic", model: "claude-sonnet-4-6" } satisfies SessionConfig

    SessionManager.addPart({ sessionId, role: "user", type: "text", content: body.content })
    const parts = SessionManager.getParts(sessionId)

    return streamSSE(c, async (stream) => {
      await runAgent({
        sessionId,
        stream: true,
        provider: cfg.provider,
        model: cfg.model,
        ...(cfg.system !== undefined ? { system: cfg.system } : {}),
        messages: parts
          .filter((p) => p.role === "user" || p.role === "assistant")
          .map((p) => ({ role: p.role as "user" | "assistant", content: p.content })),
        onText: async (delta) => {
          await sseManager.emit(sessionId, { type: "text", data: { delta, sessionId } })
          await stream.writeSSE({ data: JSON.stringify({ type: "text", delta }) })
        },
        onFinish: async ({ tokens }) => {
          await stream.writeSSE({
            data: JSON.stringify({ type: "done", tokens }),
            event: "done",
          })
        },
      })
    })
  })

  app.get("/v1/session/:id/events", (c) => {
    const sessionId = c.req.param("id")
    return streamSSE(c, async (stream) => {
      const unsub = sseManager.subscribe(sessionId, async (event) => {
        await stream.writeSSE({ data: JSON.stringify(event) })
      })
      await new Promise<void>((resolve) => {
        stream.onAbort(resolve)
      })
      unsub()
    })
  })

  // ── MCP endpoints ───────────────────────────────────────────────────────────

  app.get("/v1/mcp", (c) => {
    return c.json(mcpManager.list())
  })

  app.post("/v1/mcp", async (c) => {
    const body = await c.req.json<{ name: string } & MCPServerConfig>()
    const { name, ...config } = body
    if (!name || !config.command) return c.json({ error: "name ve command zorunlu" }, 400)
    await mcpManager.connect(name, config)
    return c.json({ ok: true, name })
  })

  app.delete("/v1/mcp/:name", async (c) => {
    await mcpManager.disconnect(c.req.param("name"))
    return c.json({ ok: true })
  })

  return app
}
