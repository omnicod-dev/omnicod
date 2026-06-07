import { db } from "./db.js"
import { sessions, parts, config, memories } from "./schema.js"
import { eq, desc, and, isNull, or, sql } from "drizzle-orm"

export function createSession(data: {
  id: string
  title?: string
  config?: string
  parentId?: string
}) {
  const now = Date.now()
  db.insert(sessions).values({
    id: data.id,
    title: data.title ?? null,
    createdAt: now,
    updatedAt: now,
    parentId: data.parentId ?? null,
    config: data.config ?? null,
    status: "active",
  }).run()
}

export function getSession(id: string) {
  return db.select().from(sessions).where(eq(sessions.id, id)).get()
}

export function listSessions(limit = 50) {
  return db.select().from(sessions).orderBy(desc(sessions.createdAt)).limit(limit).all()
}

export function updateSession(id: string, data: Partial<{ title: string; status: string }>) {
  db.update(sessions)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(sessions.id, id))
    .run()
}

function isSqliteBusy(err: unknown): boolean {
  return err instanceof Error && (
    err.message.includes("database is locked") ||
    (err as NodeJS.ErrnoException).code === "SQLITE_BUSY"
  )
}

export function addPart(data: {
  id: string
  sessionId: string
  sequence: number
  role: string
  type: string
  content: string
  tokens?: number
}) {
  const MAX_RETRIES = 5
  let attempt = 0
  while (true) {
    try {
      db.insert(parts).values({ ...data, createdAt: Date.now() }).run()
      return
    } catch (err) {
      if (isSqliteBusy(err) && attempt < MAX_RETRIES) {
        attempt++
        // Senkron meşgul bekleme: Bun'da Atomics.wait kısıtlı, setTimeout non-blocking
        // Busy_timeout zaten 8s bekliyor — bu sadece ek güvenlik katmanı
        const delay = 50 * (2 ** attempt) + Math.random() * 50  // 100-1650ms exponential
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay)
        continue
      }
      throw err
    }
  }
}

export function getSessionParts(sessionId: string) {
  return db.select().from(parts)
    .where(eq(parts.sessionId, sessionId))
    .orderBy(parts.sequence)
    .all()
}

export function getSessionPartsCount(sessionId: string): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(parts)
    .where(eq(parts.sessionId, sessionId))
    .get()
  return row?.n ?? 0
}

// Returns last `limit` parts in ascending sequence order (for display without loading full history)
export function getSessionPartsTail(sessionId: string, limit: number) {
  return db.select().from(parts)
    .where(eq(parts.sessionId, sessionId))
    .orderBy(desc(parts.sequence))
    .limit(limit)
    .all()
    .reverse()
}

export function getConfig(key: string): string | undefined {
  return db.select().from(config).where(eq(config.key, key)).get()?.value
}

export function setConfig(key: string, value: string) {
  db.insert(config)
    .values({ key, value })
    .onConflictDoUpdate({ target: config.key, set: { value } })
    .run()
}

// ── Memory CRUD ────────────────────────────────────────────────────────────────

export function insertMemory(data: {
  id: string
  content: string
  category: string
  scope: string
  project?: string
  timestamp: number
  source: string
  tags?: string
}) {
  db.insert(memories).values({
    ...data,
    project: data.project ?? null,
    tags:    data.tags    ?? null,
  }).run()
}

export function deleteMemory(id: string) {
  db.delete(memories).where(eq(memories.id, id)).run()
}

export function listMemories(scope?: string, project?: string) {
  if (scope === "global") {
    return db.select().from(memories)
      .where(eq(memories.scope, "global"))
      .orderBy(desc(memories.timestamp))
      .all()
  }
  if (project) {
    // project-scoped memories for this workdir + all global ones
    return db.select().from(memories)
      .where(or(
        and(eq(memories.scope, "project"), eq(memories.project, project)),
        eq(memories.scope, "global"),
      ))
      .orderBy(desc(memories.timestamp))
      .all()
  }
  return db.select().from(memories).orderBy(desc(memories.timestamp)).all()
}

export function clearMemories(scope: string, project?: string) {
  if (scope === "global") {
    db.delete(memories).where(eq(memories.scope, "global")).run()
  } else if (scope === "project" && project) {
    db.delete(memories).where(
      and(eq(memories.scope, "project"), eq(memories.project, project))
    ).run()
  } else {
    db.delete(memories).run()
  }
}
