import type { SSEEvent } from "./types.js"

type Subscriber = (event: SSEEvent) => void | Promise<void>

class SSEManager {
  private subscribers = new Map<string, Set<Subscriber>>()

  subscribe(sessionId: string, handler: Subscriber): () => void {
    const subs = this.subscribers.get(sessionId) ?? new Set()
    subs.add(handler)
    this.subscribers.set(sessionId, subs)
    return () => {
      subs.delete(handler)
      if (subs.size === 0) this.subscribers.delete(sessionId)
    }
  }

  async emit(sessionId: string, event: SSEEvent): Promise<void> {
    const subs = this.subscribers.get(sessionId)
    if (!subs || subs.size === 0) return
    await Promise.all([...subs].map((h) => h(event)))
  }

  subscriberCount(sessionId: string): number {
    return this.subscribers.get(sessionId)?.size ?? 0
  }
}

export const sseManager = new SSEManager()
