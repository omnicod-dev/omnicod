/**
 * Basit unified diff üretici.
 * Myers algoritması yerine satır bazlı LCS (yeterince hızlı ve doğru).
 */

export interface DiffLine {
  type:    "add" | "remove" | "context"
  content: string
  oldLine?: number
  newLine?: number
}

export interface DiffHunk {
  oldStart: number
  newStart: number
  lines:    DiffLine[]
}

export function computeDiff(oldText: string, newText: string, context = 3): DiffHunk[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")

  // LCS ile değişmeyen satırları bul
  const lcs = longestCommonSubsequence(oldLines, newLines)

  // Change map: oldIdx → "keep" | "delete", newIdx → "keep" | "insert"
  const changes: Array<{ type: "keep"|"delete"|"insert"; old?: number; new?: number }> = []

  let oi = 0, ni = 0, li = 0
  while (li < lcs.length) {
    const [lcsOld, lcsNew] = lcs[li]!
    while (oi < lcsOld) { changes.push({ type: "delete", old: oi++ }) }
    while (ni < lcsNew) { changes.push({ type: "insert", new: ni++ }) }
    changes.push({ type: "keep", old: oi++, new: ni++ })
    li++
  }
  while (oi < oldLines.length) { changes.push({ type: "delete", old: oi++ }) }
  while (ni < newLines.length) { changes.push({ type: "insert", new: ni++ }) }

  // Context window ile hunk'lara böl
  const hunks: DiffHunk[] = []
  let i = 0
  while (i < changes.length) {
    if (changes[i]!.type === "keep") { i++; continue }

    // Değişiklik bloğu başladı — context satırlarıyla birlikte hunk oluştur
    const start = Math.max(0, i - context)
    let end     = i
    while (end < changes.length && changes[end]!.type !== "keep") end++
    end = Math.min(changes.length - 1, end + context)

    const hunkLines: DiffLine[] = []
    let oldStart = -1, newStart = -1

    for (let j = start; j <= end; j++) {
      const c = changes[j]!
      if (c.type === "keep") {
        if (oldStart === -1) oldStart = c.old! + 1
        if (newStart === -1) newStart = c.new! + 1
        hunkLines.push({ type: "context", content: oldLines[c.old!] ?? "", oldLine: c.old! + 1, newLine: c.new! + 1 })
      } else if (c.type === "delete") {
        if (oldStart === -1) oldStart = c.old! + 1
        hunkLines.push({ type: "remove", content: oldLines[c.old!] ?? "", oldLine: c.old! + 1 })
      } else {
        if (newStart === -1) newStart = c.new! + 1
        hunkLines.push({ type: "add", content: newLines[c.new!] ?? "", newLine: c.new! + 1 })
      }
    }

    if (oldStart === -1) oldStart = 1
    if (newStart === -1) newStart = 1
    hunks.push({ oldStart, newStart, lines: hunkLines })
    i = end + 1
  }

  return hunks
}

// Basit LCS — small files için yeterli
function longestCommonSubsequence(a: string[], b: string[]): Array<[number, number]> {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i]![j] = a[i-1] === b[j-1] ? dp[i-1]![j-1]! + 1 : Math.max(dp[i-1]![j]!, dp[i]![j-1]!)

  const result: Array<[number, number]> = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) { result.unshift([i-1, j-1]); i--; j-- }
    else if (dp[i-1]![j]! > dp[i]![j-1]!) i--
    else j--
  }
  return result
}
