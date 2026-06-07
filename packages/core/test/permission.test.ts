import { describe, it, expect } from "bun:test"
import { PermissionEvaluator } from "../src/permission/evaluator.js"

describe("PermissionEvaluator.evaluate", () => {
  // ── Always-allow tools ────────────────────────────────────────────────────

  it("read is always allowed", () => {
    expect(PermissionEvaluator.evaluate("read", "src/index.ts")).toBe("allow")
    expect(PermissionEvaluator.evaluate("read", "/etc/passwd")).toBe("allow")
  })

  it("glob is always allowed", () => {
    expect(PermissionEvaluator.evaluate("glob", "**/*.ts")).toBe("allow")
  })

  it("grep is always allowed", () => {
    expect(PermissionEvaluator.evaluate("grep", "TODO")).toBe("allow")
  })

  it("websearch is always allowed", () => {
    expect(PermissionEvaluator.evaluate("websearch", "bun runtime")).toBe("allow")
  })

  it("lsp is always allowed", () => {
    expect(PermissionEvaluator.evaluate("lsp", "typescript")).toBe("allow")
  })

  // ── Deny rules ────────────────────────────────────────────────────────────

  it("sudo shell is denied", () => {
    expect(PermissionEvaluator.evaluate("shell", "sudo rm -rf /")).toBe("deny")
  })

  it("write to /etc/ is denied", () => {
    expect(PermissionEvaluator.evaluate("write", "/etc/hosts")).toBe("deny")
  })

  it("write to /usr/ is denied", () => {
    expect(PermissionEvaluator.evaluate("write", "/usr/local/bin/evil")).toBe("deny")
  })

  it("write to /sys/ is denied", () => {
    expect(PermissionEvaluator.evaluate("write", "/sys/kernel")).toBe("deny")
  })

  // ── Ask rules ─────────────────────────────────────────────────────────────

  it("rm shell is ask", () => {
    expect(PermissionEvaluator.evaluate("shell", "rm file.txt")).toBe("ask")
  })

  it("rm -rf shell is ask", () => {
    expect(PermissionEvaluator.evaluate("shell", "rm -rf dist/")).toBe("ask")
  })

  it("curl shell is ask", () => {
    expect(PermissionEvaluator.evaluate("shell", "curl https://example.com")).toBe("ask")
  })

  // ── Unknown tool defaults to ask ──────────────────────────────────────────

  it("unknown tool defaults to ask", () => {
    expect(PermissionEvaluator.evaluate("unknowntool", "something")).toBe("ask")
  })

  // ── Wildcard pattern matching ─────────────────────────────────────────────

  it("wildcard * matches any value", () => {
    expect(PermissionEvaluator.evaluate("task", "anything")).toBe("allow")
    expect(PermissionEvaluator.evaluate("memory", "random-pattern")).toBe("allow")
  })
})
