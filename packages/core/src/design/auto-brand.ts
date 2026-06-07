import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

export interface ProjectBrand {
  name?:        string
  description?: string
  colors:       string[]   // unique hex values found in CSS/HTML
  fonts:        string[]   // font-family values
}

const HEX_RE   = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g
const FONT_RE  = /font-family\s*:\s*([^;,"]+)/gi
const RGB_RE   = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(n => n.toString(16).padStart(2, "0")).join("")
}

function expandShortHex(hex: string): string {
  if (hex.length === 4) {
    return "#" + hex[1]! + hex[1]! + hex[2]! + hex[2]! + hex[3]! + hex[3]!
  }
  return hex
}

function extractColors(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(HEX_RE)) {
    found.add(expandShortHex(m[0].toLowerCase()))
  }
  for (const m of text.matchAll(RGB_RE)) {
    found.add(rgbToHex(parseInt(m[1]!), parseInt(m[2]!), parseInt(m[3]!)))
  }
  // Filter out pure black/white and very dark/light values that are just text defaults
  return [...found].filter(c => c !== "#000000" && c !== "#ffffff" && c !== "#000" && c !== "#fff")
}

function extractFonts(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(FONT_RE)) {
    const family = m[1]!.trim().replace(/['"]/g, "").split(",")[0]!.trim()
    if (family && family !== "inherit" && family !== "sans-serif" && family !== "monospace") {
      found.add(family)
    }
  }
  return [...found]
}

function scanFiles(dir: string, exts: string[], maxFiles = 10): string[] {
  const results: string[] = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (results.length >= maxFiles) break
      if (entry.isFile() && exts.some(e => entry.name.endsWith(e))) {
        results.push(join(dir, entry.name))
      }
    }
  } catch { /* ignore unreadable dirs */ }
  return results
}

export function extractProjectBrand(workdir: string): ProjectBrand {
  const brand: ProjectBrand = { colors: [], fonts: [] }

  // package.json → name + description
  const pkgPath = join(workdir, "package.json")
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>
      if (typeof pkg["name"]        === "string") brand.name        = pkg["name"]
      if (typeof pkg["description"] === "string") brand.description = pkg["description"]
    } catch { /* ignore */ }
  }

  // README.md → first paragraph as description fallback
  if (!brand.description) {
    const readmePath = join(workdir, "README.md")
    if (existsSync(readmePath)) {
      try {
        const lines = readFileSync(readmePath, "utf8").split("\n").filter(l => l.trim())
        const para  = lines.find(l => !l.startsWith("#") && !l.startsWith(">") && l.length > 20)
        if (para) brand.description = para.trim().slice(0, 150)
      } catch { /* ignore */ }
    }
  }

  // Scan CSS/HTML/JS files for colors and fonts
  const allColors: string[] = []
  const allFonts:  string[] = []

  const searchDirs = [
    workdir,
    join(workdir, "src"),
    join(workdir, "styles"),
    join(workdir, "css"),
    join(workdir, "public"),
    join(workdir, "assets"),
    join(workdir, "app"),
  ]

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue
    const files = scanFiles(dir, [".css", ".scss", ".sass", ".html", ".tsx", ".jsx"])
    for (const file of files) {
      try {
        const content = readFileSync(file, "utf8")
        allColors.push(...extractColors(content))
        allFonts.push(...extractFonts(content))
      } catch { /* ignore */ }
    }
  }

  // Deduplicate + take top N most common colors
  const colorCount: Record<string, number> = {}
  for (const c of allColors) colorCount[c] = (colorCount[c] ?? 0) + 1
  brand.colors = Object.entries(colorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c]) => c)

  brand.fonts = [...new Set(allFonts)].slice(0, 4)

  return brand
}

export function brandToContext(brand: ProjectBrand): string {
  const lines: string[] = ["## Project Brand Context"]
  if (brand.name)        lines.push(`- Project name: ${brand.name}`)
  if (brand.description) lines.push(`- Description: ${brand.description}`)
  if (brand.colors.length > 0) lines.push(`- Detected colors: ${brand.colors.join(", ")}`)
  if (brand.fonts.length  > 0) lines.push(`- Detected fonts: ${brand.fonts.join(", ")}`)
  lines.push("Incorporate the above colors and fonts into the design where appropriate.")
  return lines.join("\n")
}
