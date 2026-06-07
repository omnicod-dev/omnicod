import type { PermissionDecision } from "./types.js"

// Session boyunca onaylanan/reddedilen izinleri tutar
const approved = new Set<string>()

function key(tool: string, pattern: string) {
  return `${tool}:${pattern}`
}

export const PermissionStore = {
  isApproved(tool: string, pattern: string): boolean {
    return approved.has(key(tool, pattern))
  },
  approve(tool: string, pattern: string): void {
    approved.add(key(tool, pattern))
  },
  clear(): void {
    approved.clear()
  },
}

// TUI → executor köprüsü: ask kararlarını bekler
type Resolver = (decision: PermissionDecision) => void
const pending = new Map<string, Resolver>()

export const PermissionGate = {
  // Executor tarafından çağrılır — kullanıcı kararını bekler
  wait(id: string): Promise<PermissionDecision> {
    return new Promise((resolve) => {
      pending.set(id, resolve)
    })
  },

  // TUI tarafından çağrılır — kullanıcı Y/N'ye bastı
  respond(id: string, decision: PermissionDecision): void {
    const resolve = pending.get(id)
    if (resolve) {
      resolve(decision)
      pending.delete(id)
    }
  },

  hasPending(): boolean {
    return pending.size > 0
  },

  // Abort / Ctrl+C sırasında çağrılır — bekleyen tüm izin isteklerini reddet
  cancelPending(): void {
    for (const resolve of pending.values()) {
      resolve("deny")
    }
    pending.clear()
  },
}
