/**
 * DiffRenderer — Index
 *
 * Gelişmiş diff görüntüleyici. Raw diff veya eski/yeni metin alır, üç modda
 * (unified/side-by-side/raw) renderlar. Hunk navigasyonu ve mode toggle
 * keybinding'ler ile entegre.
 */

export {
  DiffRenderer,
  type DiffRendererProps,
} from "./DiffRenderer.js"

export {
  parseRawDiff,
  diffTexts,
  wordDiff,
  suggestDiffMode,
  type LineType,
  type DiffLine,
  type Hunk,
  type ParsedDiff,
  type DiffMode,
} from "./logic.js"
