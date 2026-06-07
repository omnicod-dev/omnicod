import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { fileWatcher } from "./watcher.js"

export interface DependencyChange {
  added:   string[]
  removed: string[]
  changed: string[]
}

export interface DependencySnapshot {
  deps:       Record<string, string>
  hash:       string
  capturedAt: number
}

const DEP_FILES = ["package.json", "go.mod", "requirements.txt", "Cargo.toml", "pyproject.toml", "composer.json"]

function readDeps(projectDir: string): Record<string, string> {
  const deps: Record<string, string> = {}

  // Node.js
  try {
    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8")) as Record<string, unknown>
    const all = { ...(pkg["dependencies"] as Record<string, string> ?? {}), ...(pkg["devDependencies"] as Record<string, string> ?? {}) }
    for (const [k, v] of Object.entries(all)) deps[k] = v
  } catch { /* skip */ }

  // Go
  try {
    const mod = readFileSync(join(projectDir, "go.mod"), "utf8")
    for (const m of mod.matchAll(/^\s+([\S]+)\s+(v[\S]+)/gm)) {
      deps[m[1]!] = m[2]!
    }
  } catch { /* skip */ }

  // Python requirements.txt
  try {
    const req = readFileSync(join(projectDir, "requirements.txt"), "utf8")
    for (const line of req.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const [name, ver] = trimmed.split(/[>=<!~]/, 2)
      if (name) deps[name.trim().toLowerCase()] = ver?.trim() ?? "*"
    }
  } catch { /* skip */ }

  // Rust
  try {
    const cargo = readFileSync(join(projectDir, "Cargo.toml"), "utf8")
    for (const m of cargo.matchAll(/^([\w-]+)\s*=\s*"([^"]+)"/gm)) {
      deps[m[1]!] = m[2]!
    }
  } catch { /* skip */ }

  return deps
}

function hashDeps(deps: Record<string, string>): string {
  const sorted = Object.keys(deps).sort().map((k) => `${k}@${deps[k]}`).join("|")
  return createHash("sha1").update(sorted).digest("hex").slice(0, 12)
}

class DependencySentinel {
  private snapshots = new Map<string, DependencySnapshot>()

  async snapshot(projectDir: string): Promise<DependencySnapshot> {
    const deps = readDeps(projectDir)
    const snap: DependencySnapshot = { deps, hash: hashDeps(deps), capturedAt: Date.now() }
    this.snapshots.set(projectDir, snap)
    return snap
  }

  diff(before: DependencySnapshot, after: DependencySnapshot): DependencyChange {
    const added:   string[] = []
    const removed: string[] = []
    const changed: string[] = []

    for (const [k, v] of Object.entries(after.deps)) {
      if (!(k in before.deps))          added.push(k)
      else if (before.deps[k] !== v)    changed.push(k)
    }
    for (const k of Object.keys(before.deps)) {
      if (!(k in after.deps)) removed.push(k)
    }

    return { added, removed, changed }
  }

  watch(projectDir: string, onChange: (change: DependencyChange) => void): () => void {
    const cleanups: Array<() => void> = []

    for (const file of DEP_FILES) {
      const filePath = join(projectDir, file)
      const cleanup  = fileWatcher.watch(filePath, async () => {
        const before = this.snapshots.get(projectDir)
        const after  = await this.snapshot(projectDir)
        if (!before) return
        if (before.hash === after.hash) return
        const change = this.diff(before, after)
        if (change.added.length || change.removed.length || change.changed.length) {
          onChange(change)
        }
      })
      cleanups.push(cleanup)
    }

    return () => { for (const c of cleanups) c() }
  }
}

export const depSentinel = new DependencySentinel()
