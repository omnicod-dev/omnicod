import { join, resolve } from "path"
import { hooks } from "../hook/emitter.js"
import { PermissionEvaluator } from "../permission/evaluator.js"
import { PermissionGate, PermissionStore } from "../permission/store.js"
import { gateGuard } from "../permission/gateguard.js"
import { addPart } from "../storage/queries.js"
import { classifyCommand } from "../terminal/classifier.js"
import type { ToolDef, ToolContext, ExecuteResult } from "./types.js"
import type { PermissionRequest } from "../permission/types.js"

export interface ExecutionEvent {
  type:    "permission_ask"
  request: PermissionRequest
}

type EventCallback = (event: ExecutionEvent) => void
const listeners = new Set<EventCallback>()

export const ExecutorEvents = {
  on(cb: EventCallback): () => void {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  emit(event: ExecutionEvent): void {
    listeners.forEach((cb) => cb(event))
  },
}

// Default max time a single tool call is allowed to run before it's aborted.
// Individual tools can override this with ToolDef.timeoutMs.
const TOOL_EXEC_TIMEOUT_MS = 120_000  // 2 minutes default

// ── Dual-Path: TypeScript verification after edit/write ───────────────────────
const TYPED_FILE_RE    = /\.(ts|tsx|js|jsx|mts|cts)$/
const TSC_TIMEOUT_MS   = 4_000
const TSC_CACHE_TTL_MS = 8_000

interface TscCacheEntry { output: string; ts: number }
const tscResultCache = new Map<string, TscCacheEntry>()

async function runTscCheck(workdir: string): Promise<string> {
  const cached = tscResultCache.get(workdir)
  if (cached && Date.now() - cached.ts < TSC_CACHE_TTL_MS) return cached.output

  try {
    const { spawn } = await import("bun")
    const proc  = spawn(["bunx", "tsc", "--noEmit", "--pretty", "false"], {
      cwd: workdir, stdout: "pipe", stderr: "pipe",
    })
    const timer = setTimeout(() => { try { proc.kill() } catch {} }, TSC_TIMEOUT_MS)
    const out   = await new Response(proc.stdout).text()
    const err   = await new Response(proc.stderr).text()
    await proc.exited
    clearTimeout(timer)
    const result = (out + err).trim() || "✓"
    tscResultCache.set(workdir, { output: result, ts: Date.now() })
    return result
  } catch {
    return ""
  }
}

function filterTscForFile(tscOut: string, filePath: string): string {
  if (!tscOut || tscOut === "✓") return tscOut
  const name    = filePath.split("/").pop() ?? ""
  const relevant = tscOut.split("\n").filter(l => l.includes(name)).slice(0, 12)
  return relevant.length > 0 ? relevant.join("\n") : ""
}

// Outputs longer than this get heuristically summarized before being returned to the model.
const OUTPUT_SUMMARIZE_THRESHOLD = 4_000

function analyzeToolError(toolId: string, error: string): string {
  const e = error.toLowerCase()
  let hint = ""
  if (/cannot find module|module not found/.test(e))
    hint = "Module resolution failure — check path spelling, file existence, or whether a build step is needed."
  else if (/error ts\d+|\.tsx?.*:\d+:\d+/.test(e))
    hint = "TypeScript error — run 'tsc --noEmit' for the full error list before retrying."
  else if (/permission denied|eacces/.test(e))
    hint = "Permission denied — check file/directory permissions."
  else if (toolId === "bash" && /command not found|not found/.test(e))
    hint = "Binary not in PATH — check if it's installed: which <binary>"
  else if (/eaddrinuse|address already in use/.test(e))
    hint = "Port already in use — find the process: lsof -i :<port>"
  else if (/no such file or directory|enoent/.test(e))
    hint = "Path doesn't exist — verify with: ls -la <parent-dir>"
  else if (/syntax error/.test(e))
    hint = "Syntax error — check for mismatched quotes, braces, or missing semicolons."
  else if (/out of memory|killed/.test(e))
    hint = "Process killed (OOM or ulimit) — operation requires too much memory."
  return hint ? `${error}\n[Hint] ${hint}` : error
}

function summarizeToolOutput(toolId: string, output: string): string {
  const lines = output.split("\n")

  if (toolId === "grep") {
    const files = new Set(lines.map(l => l.split(":")[0]).filter(Boolean))
    const kept  = lines.slice(0, 50).join("\n")
    const note  = lines.length > 50
      ? `\n[${lines.length} matches across ${files.size} file(s) — showing first 50]`
      : `\n[${lines.length} matches across ${files.size} file(s)]`
    return kept + note
  }

  // Generic: head + tail with omission notice
  const head    = output.slice(0, 2_500)
  const tail    = output.slice(-600)
  const omitted = output.length - 2_500 - 600
  if (omitted <= 0) return output
  return `${head}\n\n[... ${omitted} chars / ${lines.length} total lines omitted ...]\n\n${tail}`
}

// C: Pre-verify named imports from existing local modules before write/edit
const MAX_IMPORT_CHECKS  = 4
const MAX_TARGET_BYTES   = 100_000

function escapeRegexC(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function verifyLocalImports(
  content:     string,
  absFilePath: string,
  workdir:     string,
): Promise<string | null> {
  const dir    = absFilePath.includes("/") ? absFilePath.slice(0, absFilePath.lastIndexOf("/")) : workdir
  const re     = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g
  const issues: string[] = []
  let m: RegExpExecArray | null
  let checks = MAX_IMPORT_CHECKS

  while ((m = re.exec(content)) !== null && checks-- > 0) {
    const namesRaw = m[1] ?? ""
    const fromPath = m[2] ?? ""
    if (!fromPath) continue

    const base = resolve(dir, fromPath)
    const candidates = [
      base, base + ".ts", base + ".tsx", base + ".js", base + ".jsx", base + ".mts",
      base + "/index.ts", base + "/index.tsx", base + "/index.js",
    ]

    let targetFile: string | null = null
    for (const c of candidates) {
      try { if (await Bun.file(c).exists()) { targetFile = c; break } } catch {}
    }
    if (!targetFile) continue  // doesn't exist yet — skip (may be created later)

    try {
      const f = Bun.file(targetFile)
      if (f.size > MAX_TARGET_BYTES) continue
      const src = await f.text()

      const names = namesRaw.split(",")
        .map(n => n.trim().replace(/\s+as\s+\w+$/, "").replace(/^type\s+/, "").trim())
        .filter(n => n && n !== "*")

      for (const name of names) {
        const escaped = escapeRegexC(name)
        const exportRe = new RegExp(`\\bexport\\b[^;\\n]*\\b${escaped}\\b`)
        if (!exportRe.test(src)) issues.push(`'${name}' not exported from ${fromPath}`)
      }
    } catch {}
  }

  return issues.length > 0 ? issues.join("; ") : null
}

function withToolTimeout<T>(promise: Promise<T>, def: ToolDef): Promise<T> {
  const ms = def.timeoutMs ?? TOOL_EXEC_TIMEOUT_MS
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`Tool '${def.id}' timed out after ${ms / 1000}s — aborted to prevent freeze`))
    }, ms)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

// Returns true when the file path is safely inside the project workdir.
// Subagents auto-approve writes inside their workdir scope.
function isInsideWorkdir(filePath: string, workdir: string): boolean {
  const resolved = filePath.startsWith("/") ? filePath : join(workdir, filePath)
  const norm     = workdir.endsWith("/") ? workdir : workdir + "/"
  return resolved.startsWith(norm) || resolved === workdir
}

export async function executeTool(
  def:     ToolDef,
  rawArgs: Record<string, unknown>,
  ctx:     ToolContext,
): Promise<ExecuteResult> {
  // --- v1.tool.before hook ---
  const before = await hooks.emit("v1.tool.before", { tool: def.id, args: rawArgs })

  // --- Zod runtime validation (defense in depth) ---
  const parseResult = def.parameters.safeParse(before.args)
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map(i => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`)
      .join("; ")
    return { output: "", error: `[${def.id}] invalid args: ${issues}` }
  }
  const args: Record<string, unknown> = parseResult.data

  // --- GateGuard kontrolü (write/edit araçları için) ---
  if (def.id === "write" || def.id === "edit") {
    const filePath = String(args["path"] ?? "")
    if (filePath) {
      const gateDecision = gateGuard.check(filePath)
      if (gateDecision === "deny") {
        gateGuard.audit({ ts: Date.now(), tool: def.id, path: filePath, action: "deny", allowed: false })
        return { output: "", error: `GateGuard: write to '${filePath}' is blocked by protection rules.` }
      }
      if (gateDecision === "ask" && !PermissionStore.isApproved(def.id, filePath)) {
        // Subagent context: PermissionGate is isolated per Bun Worker thread — TUI never sees it.
        // Auto-approve if the path is inside the project workdir; still block otherwise.
        if (ctx.isSubagent) {
          if (isInsideWorkdir(filePath, ctx.workdir)) {
            PermissionStore.approve(def.id, filePath)
          } else {
            gateGuard.audit({ ts: Date.now(), tool: def.id, path: filePath, action: "deny", allowed: false })
            return { output: "", error: `GateGuard: subagent write to '${filePath}' is outside project workdir and requires user approval.` }
          }
        } else {
          const id = crypto.randomUUID()
          ExecutorEvents.emit({
            type: "permission_ask",
            request: { id, tool: def.id, pattern: filePath, level: "warning", reason: "Protected file — GateGuard" },
          })
          const userDecision = await PermissionGate.wait(id)
          gateGuard.audit({ ts: Date.now(), tool: def.id, path: filePath, action: gateDecision, allowed: userDecision !== "deny" })
          if (userDecision === "deny") {
            return { output: "", error: `GateGuard: write to '${filePath}' denied by user.` }
          }
          if (userDecision === "allow") PermissionStore.approve(def.id, filePath)
        }
      }
    }
  }

  // --- Permission kontrolü ---
  const pattern = extractPattern(def.id, args)
  let decision = PermissionEvaluator.evaluate(def.id, pattern)
  let level: "safe" | "warning" | "danger" = "warning"
  let reason = ""

  // Spec tabanlı risk override
  if (def.spec) {
    const specConfirm = typeof def.spec.requiresConfirmation === "function"
      ? def.spec.requiresConfirmation(args)
      : def.spec.requiresConfirmation === true

    if (def.spec.riskLevel === "critical") {
      decision = "ask"
      level    = "danger"
    } else if (def.spec.riskLevel === "high" && decision !== "allow") {
      decision = "ask"
      level    = "warning"
    } else if (specConfirm && decision === "allow") {
      decision = "ask"
    }

    if (def.spec.permissionSummary) reason = def.spec.permissionSummary
  }

  if (def.id === "bash") {
    const analysis = classifyCommand(pattern)
    level = analysis.level
    reason = analysis.reason
    if (analysis.isReadOnly) {
      decision = "allow" // Auto-approve zararsız komutlar
    } else if (analysis.level === "danger") {
      decision = "ask"   // Yıkıcı komutlarda mutlaka sor (eğer global izin yoksa)
    }
  }

  if (decision === "deny") {
    return { output: "", error: `Permission denied: [${def.id}] ${pattern}` }
  }

  if (decision === "ask" && !PermissionStore.isApproved(def.id, pattern)) {
    // Subagent: PermissionGate.wait() would hang forever — auto-approve non-critical asks
    if (ctx.isSubagent) {
      // Danger-level in subagent → block; warning-level → allow (agent was authorized by user)
      if (level === "danger") {
        return { output: "", error: `Permission denied: [${def.id}] is too risky to auto-approve in subagent context. Level: danger.` }
      }
      PermissionStore.approve(def.id, pattern)
    } else {
      const id = crypto.randomUUID()
      ExecutorEvents.emit({ type: "permission_ask", request: { id, tool: def.id, pattern, level, reason } })

      const userDecision = await PermissionGate.wait(id)
      if (userDecision === "deny") {
        return { output: "", error: `Permission denied by user: [${def.id}] ${pattern}` }
      }
      // allow_once → sadece bu kez, session'a kaydetme
      // allow      → session boyunca hatırla
      if (userDecision === "allow") {
        PermissionStore.approve(def.id, pattern)
      }
    }
  }

  // --- C: Symbol pre-verification for named imports ---
  if ((def.id === "edit" || def.id === "write") && TYPED_FILE_RE.test(String(args["path"] ?? ""))) {
    const newContent = def.id === "edit" ? String(args["new_string"] ?? "") : String(args["content"] ?? "")
    if (newContent.includes("from '") || newContent.includes('from "')) {
      const absPath = resolve(ctx.workdir, String(args["path"] ?? ""))
      const importIssues = await verifyLocalImports(newContent, absPath, ctx.workdir)
      if (importIssues) {
        return { output: "", error: `[Import pre-check] ${importIssues}. Verify the export names exist before writing.` }
      }
    }
  }

  // --- Execute (timeout korumalı) ---
  const start = Date.now()
  let result: ExecuteResult
  let execError: string | null = null

  try {
    result = await withToolTimeout(def.execute(args, ctx), def)
  } catch (err) {
    execError = String(err)
    result    = { output: "", error: execError }
  }

  // --- Post-process: error hints + output summarization ---
  if (result.error) {
    result = { ...result, error: analyzeToolError(def.id, result.error) }
  } else if (result.output && result.output.length > OUTPUT_SUMMARIZE_THRESHOLD) {
    result = { ...result, output: summarizeToolOutput(def.id, result.output) }
  }

  // --- Dual-path: TypeScript verification after edit/write ---
  if (!result.error && (def.id === "edit" || def.id === "write")) {
    const filePath = String(args["path"] ?? "")
    if (TYPED_FILE_RE.test(filePath)) {
      const tscOut  = await runTscCheck(ctx.workdir)
      const fileErr = filterTscForFile(tscOut, filePath)
      if (fileErr && fileErr !== "✓") {
        result = { ...result, output: result.output + `\n\n[TypeScript] Errors in this file after edit:\n${fileErr}` }
      } else if (tscOut === "✓") {
        result = { ...result, output: result.output + "\n[TypeScript] ✓ No errors" }
      }
    }
  }

  const durationMs = Date.now() - start

  // --- v1.tool.after hook (outcome-aware) ---
  const outcome = execError || result.error ? "error" : "success"
  const afterPayload = { tool: def.id, args, result, durationMs }
  await hooks.emitWithOutcome("v1.tool.after", afterPayload, outcome, durationMs)
  const after = afterPayload

  if (outcome === "error") {
    await hooks.emit("v1.tool.error", {
      tool:       def.id,
      args,
      error:      execError ?? result.error ?? "unknown",
      durationMs,
    })
  }

  // --- SQLite kayıt ---
  if (ctx.sessionId) {
    const partId = crypto.randomUUID()
    try {
      addPart({
        id:        partId,
        sessionId: ctx.sessionId,
        sequence:  -1,            // manager sıralamayı halleder
        role:      "tool",
        type:      "tool_result",
        content:   JSON.stringify({ tool: def.id, args, result: after.result }),
      })
    } catch (e) {
      // veritabanı loglama hatası execute sürecini durdurmasın
    }
  }

  return after.result as ExecuteResult
}

function extractPattern(tool: string, args: Record<string, unknown>): string {
  if (tool === "bash")         return String(args["command"] ?? "*")
  if (tool === "write" || tool === "read" || tool === "edit") return String(args["path"] ?? "")
  if (tool === "apply_patch")  return "*"
  return "*"
}
