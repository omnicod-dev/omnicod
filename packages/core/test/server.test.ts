import { describe, it, expect, beforeAll } from "bun:test"
import { createApp } from "../src/server/hono.js"
import { setActiveToken } from "../src/server/auth.js"

const TEST_TOKEN = "test-token-abcdef1234567890abcdef1234567890"

beforeAll(() => {
  setActiveToken(TEST_TOKEN)
})

function authHeaders() {
  return { "Authorization": `Bearer ${TEST_TOKEN}`, "Content-Type": "application/json" }
}

describe("GET /v1/health", () => {
  it("returns 200 without auth token", async () => {
    const app = createApp()
    const res = await app.fetch(new Request("http://localhost/v1/health"))
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe("ok")
  })
})

describe("Auth middleware", () => {
  it("rejects request without token", async () => {
    const app = createApp()
    const res = await app.fetch(new Request("http://localhost/v1/session"))
    expect(res.status).toBe(401)
  })

  it("rejects request with wrong token", async () => {
    const app = createApp()
    const res = await app.fetch(new Request("http://localhost/v1/session", {
      headers: { "Authorization": "Bearer wrong-token" }
    }))
    expect(res.status).toBe(401)
  })

  it("accepts request with correct token", async () => {
    const app = createApp()
    const res = await app.fetch(new Request("http://localhost/v1/session", {
      headers: authHeaders()
    }))
    expect(res.status).toBe(200)
  })
})

describe("GET /v1/provider", () => {
  it("returns provider list", async () => {
    const app = createApp()
    const res = await app.fetch(new Request("http://localhost/v1/provider", {
      headers: authHeaders()
    }))
    expect(res.status).toBe(200)
    const providers = await res.json() as Array<{ id: string; name: string }>
    expect(Array.isArray(providers)).toBe(true)
    expect(providers.length).toBeGreaterThan(0)
    expect(providers[0]).toHaveProperty("id")
    expect(providers[0]).toHaveProperty("name")
  })
})

describe("POST /v1/session", () => {
  it("creates a new session", async () => {
    const app = createApp()
    const res = await app.fetch(new Request("http://localhost/v1/session", {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({ provider: "anthropic", model: "claude-sonnet-4-6" }),
    }))
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string }
    expect(typeof body.id).toBe("string")
    expect(body.id.length).toBeGreaterThan(0)
  })

  it("created session appears in GET /v1/session", async () => {
    const app = createApp()
    const create = await app.fetch(new Request("http://localhost/v1/session", {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({ provider: "anthropic", model: "claude-sonnet-4-6", title: "test-session" }),
    }))
    const { id } = await create.json() as { id: string }

    const list = await app.fetch(new Request("http://localhost/v1/session", {
      headers: authHeaders()
    }))
    const sessions = await list.json() as Array<{ id: string }>
    expect(sessions.some((s) => s.id === id)).toBe(true)
  })
})

describe("GET /v1/session/:id", () => {
  it("returns 404 for unknown session", async () => {
    const app = createApp()
    const res = await app.fetch(new Request("http://localhost/v1/session/nonexistent-id-xyz", {
      headers: authHeaders()
    }))
    expect(res.status).toBe(404)
  })

  it("returns session for valid id", async () => {
    const app = createApp()
    const create = await app.fetch(new Request("http://localhost/v1/session", {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({ provider: "anthropic" }),
    }))
    const { id } = await create.json() as { id: string }

    const get = await app.fetch(new Request(`http://localhost/v1/session/${id}`, {
      headers: authHeaders()
    }))
    expect(get.status).toBe(200)
    const session = await get.json() as { id: string }
    expect(session.id).toBe(id)
  })
})
