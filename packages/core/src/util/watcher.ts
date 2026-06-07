import * as fs from "node:fs"
import * as path from "node:path"

class FileWatcher {
  /**
   * targetPath'i izler (dosya veya klasör, recursive).
   * 300ms debounce — hızlı ardışık değişiklikleri tek callback'e sıkıştırır.
   * @returns cleanup fonksiyonu — izlemeyi durdurmak için çağır
   */
  watch(targetPath: string, onChange: (changedFile: string) => void): () => void {
    const absolute = path.resolve(targetPath)
    let debounce: ReturnType<typeof setTimeout> | null = null
    let lastFile = absolute

    let watcher: fs.FSWatcher
    try {
      watcher = fs.watch(absolute, { recursive: true }, (_event, filename) => {
        lastFile = filename ? path.join(absolute, filename) : absolute
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => {
          debounce = null
          onChange(lastFile)
        }, 300)
      })
    } catch {
      // path mevcut değilse ya da desteklenmiyorsa sessizce fail
      return () => {}
    }

    return () => {
      if (debounce) clearTimeout(debounce)
      try { watcher.close() } catch { /* ignore */ }
    }
  }
}

export const fileWatcher = new FileWatcher()
