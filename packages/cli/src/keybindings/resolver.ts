/**
 * Keybindings — Resolver
 *
 * Context + Action → KeyCombo çözümlemesi.
 *
 * Akış:
 *   1. Önce context-specific binding'lere bak
 *   2. Bulunamazsa global binding'e düş
 *   3. Override varsa onu uygula
 *   4. İlk key'i al (primary binding)
 *
 * Kullanım:
 *   const key = resolveKey("submit", "ready")
 *   if (inkInputMatch(event, key)) onSubmit()
 */

import { parseKeyString, inkKeyEventToCombo, keyCombosEqual } from "./parser.js"
import { DEFAULT_BINDINGS } from "./defaults.js"
import type {
  Action, Context, BindingOverride, KeyCombo, ResolvedBinding,
} from "./types.js"

// ── Resolved store ───────────────────────────────────────────────────────────

export interface ResolvedStore {
  /** Context → Action → KeyCombo[] (parsed) */
  bindings: Record<Context, Record<Action, KeyCombo[]>>
  /** Display için Context → Action → key string[] */
  display:  Record<Context, Record<Action, string[]>>
  /** Action'ı hangi tuşa bağladık (debug için) */
  sources:  Record<Context, Record<Action, "default" | "user">>
}

// ── Build ────────────────────────────────────────────────────────────────────

/**
 * Default bindings + kullanıcı override'larını birleştirip parse edilmiş
 * (KeyCombo[]) bir store oluşturur.
 */
export function buildResolvedStore(override: BindingOverride = {}): ResolvedStore {
  const bindings: Record<Context, Record<Action, KeyCombo[]>> = {} as any
  const display:  Record<Context, Record<Action, string[]>>  = {} as any
  const sources:  Record<Context, Record<Action, "default" | "user">> = {} as any

  // Her context için
  for (const ctx of Object.keys(DEFAULT_BINDINGS) as Context[]) {
    bindings[ctx] = {} as any
    display[ctx]  = {} as any
    sources[ctx]  = {} as any

    const defaults = DEFAULT_BINDINGS[ctx]
    for (const action of Object.keys(defaults) as Action[]) {
      // Kullanıcı override var mı?
      const overrideKey = override[action]
      let keyStrings: string[]
      let source: "default" | "user"

      if (overrideKey !== undefined) {
        keyStrings = [overrideKey]
        source = "user"
      } else {
        keyStrings = defaults[action]
        source = "default"
      }

      display[ctx][action] = keyStrings
      sources[ctx][action] = source
      bindings[ctx][action] = keyStrings
        .map(k => parseKeyString(k))
        .filter((c): c is KeyCombo => c !== null)
    }
  }

  return { bindings, display, sources }
}

// ── Single key resolve ──────────────────────────────────────────────────────

/**
 * Context + Action için primary key combo'yu döner.
 * Önce context-specific, sonra global fallback.
 * Override varsa override uygulanır.
 */
export function resolveKey(
  action: Action,
  context: Context,
  store: ResolvedStore,
): KeyCombo | null {
  // Önce context-specific
  const ctxSpecific = store.bindings[context]?.[action]
  if (ctxSpecific && ctxSpecific.length > 0) return ctxSpecific[0]!

  // Fallback: global
  if (context !== "global") {
    const global = store.bindings.global?.[action]
    if (global && global.length > 0) return global[0]!
  }

  return null
}

/**
 * Tüm key'ler (alternatifler dahil) — bir action birden fazla tuşa bağlı olabilir.
 */
export function resolveKeys(
  action: Action,
  context: Context,
  store: ResolvedStore,
): KeyCombo[] {
  const ctxSpecific = store.bindings[context]?.[action] ?? []
  if (ctxSpecific.length > 0) return ctxSpecific
  if (context !== "global") {
    return store.bindings.global?.[action] ?? []
  }
  return []
}

/**
 * Action için primary display string'i döner (örn. "ctrl+c").
 */
export function resolveDisplayKey(
  action: Action,
  context: Context,
  store: ResolvedStore,
): string | null {
  const ctxSpecific = store.display[context]?.[action]
  if (ctxSpecific && ctxSpecific.length > 0) return ctxSpecific[0]!
  if (context !== "global") {
    const global = store.display.global?.[action]
    if (global && global.length > 0) return global[0]!
  }
  return null
}

// ── Event matching ──────────────────────────────────────────────────────────

/**
 * Ink useInput event'ini alır, store'daki tüm binding'lerle karşılaştırır.
 * Eşleşen action'ı döner (veya null).
 */
export function matchInkEvent(
  event: Parameters<typeof inkKeyEventToCombo>[0],
  context: Context,
  store: ResolvedStore,
): Action | null {
  const combo = inkKeyEventToCombo(event)

  // Tüm action'ları tara — herhangi bir eşleşme varsa onu döner
  // (önce context-specific, sonra global)
  const ctxBindings = store.bindings[context] ?? {}
  for (const action of Object.keys(ctxBindings) as Action[]) {
    const combos = ctxBindings[action] ?? []
    for (const c of combos) {
      if (keyCombosEqual(c, combo)) return action
    }
  }

  if (context !== "global") {
    const globalBindings = store.bindings.global ?? {}
    for (const action of Object.keys(globalBindings) as Action[]) {
      const combos = globalBindings[action] ?? []
      for (const c of combos) {
        if (keyCombosEqual(c, combo)) return action
      }
    }
  }

  return null
}

// ── Full resolved binding (display + meta) ──────────────────────────────────

export function resolveFull(
  action: Action,
  context: Context,
  store: ResolvedStore,
): ResolvedBinding | null {
  const combo = resolveKey(action, context, store)
  if (!combo) return null
  const display = resolveDisplayKey(action, context, store)
  const source  = store.sources[context]?.[action] ?? "default"
  return {
    key:     display ?? "",
    combo,
    source,
    action,
    context,
  }
}
