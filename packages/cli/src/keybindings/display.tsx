/**
 * Keybindings — Display components
 *
 * Action → display binding'leri UI'da göstermek için kullanılan bileşenler.
 * Platform-aware: macOS'ta ⌘, win/linux'ta Ctrl sembolleri otomatik.
 *
 * Kullanım:
 *   <KeyHint action="submit" context="ready" />     → "enter" (veya ⏎)
 *   <KeyHintHint action="abort" />                   → "⎋"
 *   <KeyHintBar hints={[...]} />                     → status bar satırı
 */

import React from "react"
import { Box, Text } from "ink"
import { detectPlatform } from "./persistence.js"
import { useKeybindings, useBindingHints } from "./context.js"
import { Kbd, KeyHint as DsKeyHint } from "../tui/design-system/index.js"
import type { Action, Context } from "./types.js"

// ── Platform detection (memoized) ────────────────────────────────────────────

let _platform: ReturnType<typeof detectPlatform> | null = null
export function platform(): ReturnType<typeof detectPlatform> {
  if (_platform === null) _platform = detectPlatform()
  return _platform
}

// ── Public: <KeyHint action="..." /> ─────────────────────────────────────────

export interface KeyHintProps {
  /** Action ismi */
  action:  Action
  /** Bağlama etiketi (örn. "send", "abort") */
  label?:  string
  /** Belirli bir context'te ara (default: mevcut context) */
  context?: Context
  /** Style (design-system Kbd'den) */
  variant?: "default" | "subtle" | "primary"
}

/**
 * Tek bir action için keybinding göstergesi.
 * Design-system Kbd/KeyHint'i kullanır, ama action'dan otomatik key çıkarır.
 */
export function KeyHint({ action, label, context, variant }: KeyHintProps) {
  const { store, currentContext } = useKeybindings()
  const ctx = context ?? currentContext
  const keys = store.display[ctx]?.[action] ?? store.display.global?.[action] ?? []
  if (keys.length === 0) return null

  const key = keys[0]!
  return (
    <DsKeyHint
      keys={key}
      action={label ?? action}
    />
  )
}

// ── Public: <KeyHintBar /> ──────────────────────────────────────────────────

export interface KeyHintBarProps {
  /** Gösterilecek action listesi */
  actions: Array<{ action: Action; label?: string; context?: Context }>
  /** Ayırıcı (default: " · ") */
  separator?: string
}

/**
 * Status bar için yatay keybinding ipuçları.
 *
 * Kullanım:
 *   <KeyHintBar actions={[
 *     { action: "submit",  label: "send" },
 *     { action: "abort",   label: "abort" },
 *     { action: "ui.toggle-tasks", label: "tasks" },
 *   ]} />
 */
export function KeyHintBar({ actions, separator = " · " }: KeyHintBarProps) {
  const { hints } = useBindingHints({ actions })
  return (
    <>
      {hints.map((h, i) => (
        <React.Fragment key={h.action}>
          {i > 0 && <Text>{separator}</Text>}
          {h.key && <Kbd k={h.key} />}
          {h.label && <Text> {h.label}</Text>}
        </React.Fragment>
      ))}
    </>
  )
}

// ── Public: <KeybindingsHelp /> ─────────────────────────────────────────────

/**
 * Tüm mevcut binding'leri context grupları halinde listeler.
 * /keys komutu için.
 */
export function KeybindingsHelp({ context }: { context?: Context }) {
  const { store, currentContext } = useKeybindings()
  const ctx = context ?? currentContext

  // Context'teki tüm action'ları, key'i olanlar için
  const items: Array<{ action: Action; key: string; source: "default" | "user" }> = []
  const ctxBindings = store.display[ctx] ?? {}
  for (const action of Object.keys(ctxBindings) as Action[]) {
    const keys = ctxBindings[action] ?? []
    if (keys.length === 0) continue
    items.push({
      action,
      key: keys[0]!,
      source: store.sources[ctx]?.[action] ?? "default",
    })
  }

  return (
    <Box flexDirection="column">
      {items.map(({ action, key, source }) => (
        <Box key={action} flexDirection="row" gap={1}>
          <Kbd k={key} />
          <Text>{action}{source === "user" ? " (custom)" : ""}</Text>
        </Box>
      ))}
    </Box>
  )
}
