export interface PlanStep {
  index:   number
  text:    string
  approved: boolean
}

export interface PlanRequest {
  id:          string
  title:       string
  description: string
  steps:       PlanStep[]
}

export type PlanDecision =
  | { type: "approved"; approvedSteps: number[] }
  | { type: "rejected" }

type Resolver = (d: PlanDecision) => void
const pending = new Map<string, Resolver>()

// Emits new plan request to TUI
type Listener = (req: PlanRequest) => void
const listeners = new Set<Listener>()

export const PlanGate = {
  // Tool calls this — blocks until TUI responds
  wait(req: PlanRequest): Promise<PlanDecision> {
    for (const l of listeners) l(req)
    return new Promise((resolve) => {
      pending.set(req.id, resolve)
    })
  },

  respond(id: string, decision: PlanDecision): void {
    const resolve = pending.get(id)
    if (resolve) { resolve(decision); pending.delete(id) }
  },

  onRequest(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  cancelPending(): void {
    for (const resolve of pending.values()) resolve({ type: "rejected" })
    pending.clear()
  },

  hasPending(): boolean { return pending.size > 0 },
}
