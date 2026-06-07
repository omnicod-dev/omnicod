/**
 * Streaming think-tag filter.
 *
 * Modeller (DeepSeek-R1, Qwen, yerel modeller) thinking içeriğini
 * `<think>...</think>` tag'leriyle normal metin akışının içine gömer.
 * Bu filter, her delta geldiğinde thinking bölümlerini ayırır.
 *
 * Desteklenen tag isimleri (büyük/küçük harf fark etmez):
 *   think | thinking | reasoning | thought | reasoning_scratchpad
 */

const TAGS = "think|thinking|reasoning|thought|reasoning_scratchpad"
const OPEN_RE  = new RegExp(`<\\s*(?:${TAGS})\\b[^>]*>`,  "i")
const CLOSE_RE = new RegExp(`<\\s*/\\s*(?:${TAGS})\\s*>`, "i")

// Delta sonu potansiyel bir tag başlangıcı içeriyorsa bu kadar karakteri buffer'la
const MAX_BUF = 72  // uzun tag isimler için güvenli üst sınır

export interface FeedResult {
  text:     string   // görünür metin — kullanıcıya gösterilecek
  thinking: string   // thinking içeriği — ThinkingBlock'a gidecek
}

export interface ThinkTagFilter {
  feed(delta: string): FeedResult
  flush(): FeedResult   // stream bittiğinde bekleyen buffer'ı boşalt
}

export function createThinkTagFilter(): ThinkTagFilter {
  let inside = false   // şu an thinking block içinde miyiz?
  let buffer = ""      // potansiyel tag sınırında bekletilen fragment

  function feed(delta: string): FeedResult {
    let text    = ""
    let thought = ""
    let input   = buffer + delta
    buffer      = ""

    while (input.length > 0) {
      if (!inside) {
        // — Normal metin modunda — açılış tag'i ara
        const m = OPEN_RE.exec(input)
        if (!m) {
          // Tag bulunamadı — ama son kısım `<` ile başlayan fragment olabilir
          const ltIdx = input.lastIndexOf("<")
          if (ltIdx >= 0 && input.length - ltIdx <= MAX_BUF) {
            text  += input.slice(0, ltIdx)
            buffer = input.slice(ltIdx)   // sonraki delta'ya taşı
          } else {
            text += input
          }
          break
        }
        // Açılış tag bulundu
        text  += input.slice(0, m.index)   // tag öncesi metin
        input  = input.slice(m.index + m[0].length)
        inside = true

      } else {
        // — Thinking block içinde — kapanış tag'i ara
        const m = CLOSE_RE.exec(input)
        if (!m) {
          const ltIdx = input.lastIndexOf("<")
          if (ltIdx >= 0 && input.length - ltIdx <= MAX_BUF) {
            thought += input.slice(0, ltIdx)
            buffer   = input.slice(ltIdx)
          } else {
            thought += input
          }
          break
        }
        // Kapanış tag bulundu
        thought += input.slice(0, m.index)
        input    = input.slice(m.index + m[0].length)
        inside   = false
      }
    }

    return { text, thinking: thought }
  }

  function flush(): FeedResult {
    const held  = buffer
    const wasIn = inside
    buffer      = ""
    inside      = false

    if (!held) return { text: "", thinking: "" }
    // Buffer `<` ile başlıyorsa yarım tag — at
    if (/^</.test(held)) return { text: "", thinking: "" }
    // Tag içindeyken biten fragment → thinking'e say
    if (wasIn) return { text: "", thinking: held }
    return { text: held, thinking: "" }
  }

  return { feed, flush }
}
