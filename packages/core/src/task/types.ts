export type TaskStatus = "pending" | "in_progress" | "done" | "error"

export interface Task {
  id: string
  subject: string
  owner?: string       // Hangi ajan (agentId veya role) bu görevi aldı
  status: TaskStatus
  blockedBy: string[]  // Bu görevin başlayabilmesi için bitmesi gereken diğer görevlerin ID'leri
  context?: string     // Üst görevlerden (bağımlılıklardan) gelen aktarılmış veriler (Context Passing)
  error?: string
  result?: string
  startedAt?: number
}
