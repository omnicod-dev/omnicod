/**
 * Design System — Spinner
 *
 * Çoklu animasyon tipi: dots, line, arc, pulse, bounce, braille, ascii.
 * Openclaude'dan ilham, OmniCod'un Spinner.tsx'inin halefi.
 *
 * Her spinner:
 * - frames[]: unicode karakter dizisi
 * - intervalMs: frame süresi
 * - label: opsiyonel "thinking" gibi etiket
 *
 * API: <Spinner variant="dots" label="Thinking" />
 */

import React, { useState, useEffect } from "react"
import { Text } from "ink"
import { useTheme } from "../../utils/theme.js"

// ── Spinner varyantları ────────────────────────────────────────────────────────

export type SpinnerVariant =
  | "dots"      // ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ (braille)
  | "line"      // -\|/
  | "arc"       // ◜◠◝◞◡◟
  | "pulse"     // ●○●○
  | "bounce"    // ⠁⠂⠄⠂
  | "ascii"     // |/-\
  | "wave"      // ▁▂▃▄▅▆▇█
  | "moon"      // 🌑🌒🌓🌔🌕🌖🌗🌘 (unicode emoji)
  | "clock"     // 🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕛

interface SpinnerDef {
  frames:     string[]
  intervalMs: number
  label?:     string
}

const SPINNER_DEFS: Record<SpinnerVariant, SpinnerDef> = {
  dots:    { frames: ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"], intervalMs: 80 },
  line:    { frames: ["-","\\","|","/"],                                       intervalMs: 130 },
  arc:     { frames: ["◜","◠","◝","◞","◡","◟"],                              intervalMs: 100 },
  pulse:   { frames: ["●","○","●","○"],                                        intervalMs: 200 },
  bounce:  { frames: ["⠁","⠂","⠄","⠂"],                                     intervalMs: 120 },
  ascii:   { frames: ["|","/","-","\\"],                                       intervalMs: 130 },
  wave:    { frames: ["▁","▂","▃","▄","▅","▆","▇","█","▇","▆","▅","▄","▃","▂"], intervalMs: 100 },
  moon:    { frames: ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"],                intervalMs: 200 },
  clock:   { frames: ["🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛"], intervalMs: 100 },
}

export const DEFAULT_SPINNER: SpinnerVariant = "dots"

// ── Spinner hooks ─────────────────────────────────────────────────────────────

export function useSpinnerFrame(variant: SpinnerVariant = DEFAULT_SPINNER): string {
  const def = SPINNER_DEFS[variant]
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % def.frames.length), def.intervalMs)
    return () => clearInterval(t)
  }, [variant, def.intervalMs, def.frames.length])
  return def.frames[frame]!
}

// ── Bileşen ───────────────────────────────────────────────────────────────────

export interface SpinnerProps {
  variant?:  SpinnerVariant
  label?:    string
  color?:    string
  showLabel?: boolean
}

export function Spinner({ variant = DEFAULT_SPINNER, label, color, showLabel = true }: SpinnerProps) {
  const theme = useTheme()
  const frame = useSpinnerFrame(variant)
  const c     = color ?? theme.accent
  return (
    <>
      <Text color={c}>{frame}</Text>
      {showLabel && label && (
        <>
          {" "}
          <Text color={theme.textSecondary}>{label}</Text>
        </>
      )}
    </>
  )
}

// ── Specialized spinners (geriye uyumluluk) ───────────────────────────────────

export function ThinkingSpinner() {
  return <Spinner variant="dots" label="thinking…" />
}

export function WorkingSpinner({ tool }: { tool?: string }) {
  return <Spinner variant="arc" label={tool ? `${tool}…` : "working…"} />
}

export function LoadingSpinner() {
  return <Spinner variant="pulse" label="loading…" />
}
