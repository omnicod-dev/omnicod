import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema.js"
import { join } from "path"
import { homedir } from "os"
import { mkdirSync } from "fs"

// SQL gömülü sabit olarak — bun --compile ile build edildiğinde dosya sistemine erişim gerekmez
const INIT_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT    PRIMARY KEY NOT NULL,
  title      TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  parent_id  TEXT,
  config     TEXT,
  status     TEXT    NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS parts (
  id         TEXT    PRIMARY KEY NOT NULL,
  session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence   INTEGER NOT NULL,
  role       TEXT    NOT NULL,
  type       TEXT    NOT NULL,
  content    TEXT    NOT NULL,
  tokens     INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tool_calls (
  id          TEXT    PRIMARY KEY NOT NULL,
  part_id     TEXT    NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  tool_name   TEXT    NOT NULL,
  args        TEXT,
  result      TEXT,
  duration_ms INTEGER,
  status      TEXT    NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_servers (
  id      TEXT    PRIMARY KEY NOT NULL,
  name    TEXT    NOT NULL UNIQUE,
  command TEXT    NOT NULL,
  args    TEXT,
  env     TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);
`

function createDb() {
  const dir = join(homedir(), ".omnicod")
  mkdirSync(dir, { recursive: true })

  const sqlite = new Database(join(dir, "omnicod.db"), { create: true })
  sqlite.run("PRAGMA journal_mode = WAL")
  sqlite.run("PRAGMA busy_timeout = 8000")
  sqlite.run("PRAGMA synchronous = NORMAL")
  sqlite.run("PRAGMA foreign_keys = ON")

  // Her tablo için ayrı CREATE TABLE IF NOT EXISTS — idempotent, migration gerekmez
  for (const stmt of INIT_SQL.split(";").map(s => s.trim()).filter(s => s.length > 0)) {
    try { sqlite.run(stmt) } catch { /* tablo zaten varsa yoksay */ }
  }

  return drizzle(sqlite, { schema })
}

export const db = createDb()
export type DB = typeof db
