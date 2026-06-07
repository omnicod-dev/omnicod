import type { HookName, HookPayloads } from "./types.js"

export type HookOutcome = "success" | "error" | "timeout" | "cancelled"

export type HookHandler<N extends HookName> = (
  payload: HookPayloads[N],
) => HookPayloads[N] | Promise<HookPayloads[N]>

export type OutcomeHandler<N extends HookName> = (
  payload:  HookPayloads[N],
  meta:     { outcome: HookOutcome; durationMs: number },
) => void | Promise<void>

interface Registration {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler:  (payload: any) => any
  priority: number
}

interface OutcomeRegistration {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler:        (payload: any, meta: { outcome: HookOutcome; durationMs: number }) => void | Promise<void>
  outcomes:       HookOutcome[]
  cooldownMs:     number
  dedupWindowMs:  number
  priority:       number
  lastFiredAt:    Map<string, number>
}

class HookEmitter {
  private handlers        = new Map<string, Registration[]>()
  private outcomeHandlers = new Map<string, OutcomeRegistration[]>()

  on<N extends HookName>(
    name: N,
    handler: HookHandler<N>,
    opts: { priority?: number } = {},
  ): () => void {
    const list = this.handlers.get(name) ?? []
    const reg: Registration = { handler, priority: opts.priority ?? 50 }
    list.push(reg)
    list.sort((a, b) => a.priority - b.priority)
    this.handlers.set(name, list)
    return () => {
      const updated = this.handlers.get(name) ?? []
      const idx = updated.indexOf(reg)
      if (idx !== -1) updated.splice(idx, 1)
    }
  }

  onOutcome<N extends HookName>(
    name:    N,
    handler: OutcomeHandler<N>,
    opts: { outcomes?: HookOutcome[]; cooldownMs?: number; dedupWindowMs?: number; priority?: number } = {},
  ): () => void {
    const list = this.outcomeHandlers.get(name) ?? []
    const reg: OutcomeRegistration = {
      handler,
      outcomes:      opts.outcomes      ?? [],
      cooldownMs:    opts.cooldownMs    ?? 0,
      dedupWindowMs: opts.dedupWindowMs ?? 0,
      priority:      opts.priority      ?? 50,
      lastFiredAt:   new Map(),
    }
    list.push(reg)
    list.sort((a, b) => a.priority - b.priority)
    this.outcomeHandlers.set(name, list)
    return () => {
      const updated = this.outcomeHandlers.get(name) ?? []
      const idx = updated.indexOf(reg)
      if (idx !== -1) updated.splice(idx, 1)
    }
  }

  async emit<N extends HookName>(name: N, payload: HookPayloads[N]): Promise<HookPayloads[N]> {
    const list = this.handlers.get(name) ?? []
    let current: HookPayloads[N] = payload
    for (const { handler } of list) {
      current = await handler(current) as HookPayloads[N]
    }
    return current
  }

  async emitWithOutcome<N extends HookName>(
    name:       N,
    payload:    HookPayloads[N],
    outcome:    HookOutcome,
    durationMs: number,
  ): Promise<void> {
    // Önce normal emit
    await this.emit(name, payload)

    // Sonra outcome handler'ları
    const list = this.outcomeHandlers.get(name) ?? []
    const now  = Date.now()

    for (const reg of list) {
      if (reg.outcomes.length > 0 && !reg.outcomes.includes(outcome)) continue

      // Cooldown + dedup kontrolü
      const dedupKey = `${name}:${outcome}`
      if (reg.cooldownMs > 0 || reg.dedupWindowMs > 0) {
        const window  = Math.max(reg.cooldownMs, reg.dedupWindowMs)
        const lastFired = reg.lastFiredAt.get(dedupKey) ?? 0
        if (now - lastFired < window) continue
      }
      reg.lastFiredAt.set(dedupKey, now)

      try {
        await reg.handler(payload, { outcome, durationMs })
      } catch { /* outcome handler hataları ana akışı kesmez */ }
    }
  }
}

export const hooks = new HookEmitter()
