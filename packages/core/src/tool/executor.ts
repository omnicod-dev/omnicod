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

// Max time a single tool call is allowed to run before it's aborted.
// Prevents glob on huge trees, hanging bash, stuck network calls, etc.
const TOOL_EXEC_TIMEOUT_MS = 120_000  // 2 minutes

function withToolTimeout<T>(promise: Promise<T>, toolId: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`Tool '${toolId}' timed out after ${TOOL_EXEC_TIMEOUT_MS / 1000}s — aborted to prevent freeze`))
    }, TOOL_EXEC_TIMEOUT_MS)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

// Returns true when the file path is safely inside the project workdir.
// Subagents auto-approve writes inside their workdir scope.
function isInsideWorkdir(filePath: string, workdir: string): boolean {
  const resolved = filePath.startsWith("/") ? filePath : filePath
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

  // --- Execute (timeout korumalı) ---
  const start = Date.now()
  let result: ExecuteResult
  let execError: string | null = null

  try {
    result = await withToolTimeout(def.execute(args, ctx), def.id)
  } catch (err) {
    execError = String(err)
    result    = { output: "", error: execError }
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
