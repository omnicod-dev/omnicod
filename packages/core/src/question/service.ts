// ─── Question Service ──────────────────────────────────────────────────────
// AI, çalışma sırasında kullanıcıya interaktif sorular sorabilir.
// ask() → TUI'ye event yayar, cevabı async bekler.

export interface QuestionOption {
  label:       string
  description: string
}

export interface QuestionInfo {
  header:   string          // kısa başlık (max 30 karakter)
  question: string          // tam soru metni
  options:  QuestionOption[]
  multiple?: boolean        // çoklu seçim
  custom?:   boolean        // serbest metin cevabı (varsayılan: true)
}

export interface QuestionRequest {
  id:        string
  sessionId: string
  questions: QuestionInfo[]
}

// Her soru için seçilen label'ların array'i
export type QuestionAnswer = string[]

// ──────────────────────────────────────────────────────────────────────────

class QuestionService {
  private pending = new Map<string, {
    request: QuestionRequest
    resolve: (answers: QuestionAnswer[]) => void
    reject:  (err: Error) => void
  }>()

  private listeners = new Set<(req: QuestionRequest) => void>()

  /** TUI bu metodu çağırarak soru event'lerine abone olur */
  onQuestion(cb: (req: QuestionRequest) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** AI tool çağırdığında burası çağrılır — cevap gelene kadar bekler */
  async ask(params: { sessionId: string; questions: QuestionInfo[] }): Promise<QuestionAnswer[]> {
    const id: string = crypto.randomUUID()
    const request: QuestionRequest = { id, sessionId: params.sessionId, questions: params.questions }

    return new Promise<QuestionAnswer[]>((resolve, reject) => {
      this.pending.set(id, { request, resolve, reject })
      // TUI'ye bildir
      this.listeners.forEach((cb) => cb(request))
    })
  }

  /** TUI kullanıcı cevabını gönderdiğinde çağırır */
  answer(requestId: string, answers: QuestionAnswer[]): void {
    const p = this.pending.get(requestId)
    if (!p) return
    this.pending.delete(requestId)
    p.resolve(answers)
  }

  /** TUI kullanıcı ESC yapınca çağırır */
  reject(requestId: string): void {
    const p = this.pending.get(requestId)
    if (!p) return
    this.pending.delete(requestId)
    p.reject(new Error("Question dismissed by user"))
  }

  /** Aktif bekleyen sorular */
  listPending(): QuestionRequest[] {
    return [...this.pending.values()].map((p) => p.request)
  }
}

export const questionService = new QuestionService()
