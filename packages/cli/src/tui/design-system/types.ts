/**
 * Design System — Ortak tipler ve Box wrapper
 *
 * Ink 5.2.1 notları:
 * - `BoxProps` (Ink'in export ettiği tip) aslında Box'ın parametre tipi DEĞİL,
 *   sadece `Styles`tan derive edilmiş. Bu yüzden `children` içermez.
 * - `backgroundColor` render'da çalışır ama type signature'da yok.
 *
 * `DesignBoxProps` ve `DesignBox` bu iki eksiği kapatır.
 */

import React from "react"
import { Box as InkBox, type BoxProps } from "ink"

export type DesignBoxProps = BoxProps & {
  /** Arkaplan rengi — Ink render ANSI bg escape'ine çevirir */
  readonly backgroundColor?: string
  /** React children (Ink BoxProps'ta yok) */
  children?: React.ReactNode
}

/**
 * Tip-güvenli Box alias'ı. `backgroundColor` ve `children` prop'larını kabul eder.
 *
 * Kullanım: `import { DesignBox as Box } from "./types.js"`
 */
export const DesignBox = InkBox as React.ComponentType<DesignBoxProps>
