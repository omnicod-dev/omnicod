// ─── Attachment (Multimodal) Yardımcıları ──────────────────────────────────
// AI SDK v4 için dosya/görsel okuma ve dönüştürme.

import { readFile } from "node:fs/promises"
import path from "node:path"

export interface Attachment {
  type:     "image" | "document"
  name:     string
  mimeType: string
  base64?:  string
  url?:     string
}

// Desteklenen MIME tipler
const IMAGE_EXTS: Record<string, string> = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * Lokal dosyayı okur, base64'e çevirir, Attachment döndürür.
 * Sadece görseller destekleniyor (PNG, JPG, GIF, WebP, SVG).
 */
export async function readAttachmentFromPath(filePath: string): Promise<Attachment> {
  const ext      = path.extname(filePath).toLowerCase()
  const mimeType = IMAGE_EXTS[ext]

  if (!mimeType) {
    const supported = Object.keys(IMAGE_EXTS).join(", ")
    throw new Error(`Unsupported file type: ${ext}. Supported types: ${supported}`)
  }

  const buf = await readFile(filePath)
  if (buf.length > MAX_FILE_SIZE) {
    const sizeMB = (buf.length / 1024 / 1024).toFixed(1)
    throw new Error(`File too large: ${sizeMB}MB (maximum 5MB)`)
  }

  return {
    type:     "image",
    name:     path.basename(filePath),
    mimeType,
    base64:   buf.toString("base64"),
  }
}

/**
 * URL'den attachment oluşturur (base64 indirme yapılmaz — URL doğrudan AI SDK'ya geçilir).
 */
export function attachmentFromUrl(url: string, name?: string): Attachment {
  const ext      = path.extname(new URL(url).pathname).toLowerCase()
  const mimeType = IMAGE_EXTS[ext] ?? "image/jpeg"
  return {
    type:     "image",
    name:     name ?? (path.basename(new URL(url).pathname) || "image"),
    mimeType,
    url,
  }
}

/**
 * Attachment'ı Vercel AI SDK v4 content block formatına dönüştürür.
 * streamText/generateText messages dizisindeki user mesajına eklenir.
 */
export function attachmentToAIContent(
  attachment: Attachment,
): { type: "image"; image: string | URL; mimeType?: string } {
  if (attachment.url) {
    return { type: "image", image: new URL(attachment.url) }
  }
  if (attachment.base64) {
    return {
      type:     "image",
      image:    attachment.base64,
      mimeType: attachment.mimeType,
    }
  }
  throw new Error(`Attachment '${attachment.name}' has neither base64 nor url`)
}

/** Desteklenen uzantılar listesi (kullanıcıya gösterilecek) */
export const SUPPORTED_ATTACHMENT_EXTENSIONS = Object.keys(IMAGE_EXTS)
