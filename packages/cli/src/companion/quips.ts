import type { Mood } from "./types.js"

type QuipCategory = "tool_bash" | "tool_read" | "tool_write" | "tool_search" | "tool_generic"
  | "milestone_xp" | "milestone_calls" | "idle" | "greeting"

interface QuipEntry {
  mood:  Mood
  texts: string[]
}

const QUIPS: Record<QuipCategory, QuipEntry[]> = {
  idle: [
    { mood: "idle",     texts: ["ready when you are.", "waiting patiently…", "here to help!", "what are we building?"] },
    { mood: "sleeping", texts: ["zzz…", "*yawn*", "just resting my eyes…"] },
    { mood: "happy",    texts: ["this is fun!", "I love coding with you.", "we make a great team!"] },
  ],
  greeting: [
    { mood: "happy",    texts: ["let's go!", "good to see you!", "what are we making today?", "hello! ✨"] },
    { mood: "idle",     texts: ["hi there.", "ready.", "at your service."] },
  ],
  tool_bash: [
    { mood: "working",  texts: ["running it…", "executing…", "here goes!", "shell time!"] },
    { mood: "thinking", texts: ["let me try that…", "running the command…"] },
  ],
  tool_read: [
    { mood: "thinking", texts: ["reading the file…", "let me check…", "scanning…"] },
    { mood: "working",  texts: ["got it.", "file loaded!", "reading…"] },
  ],
  tool_write: [
    { mood: "working",  texts: ["writing…", "saving changes…", "putting it all together…"] },
    { mood: "happy",    texts: ["done! ✓", "saved!", "nice edit!"] },
  ],
  tool_search: [
    { mood: "thinking", texts: ["searching…", "looking it up…", "on it!"] },
    { mood: "working",  texts: ["scanning the web…", "fetching…"] },
  ],
  tool_generic: [
    { mood: "working",  texts: ["on it!", "working…", "just a sec…"] },
    { mood: "thinking", texts: ["hmm…", "let me handle that…"] },
  ],
  milestone_xp: [
    { mood: "happy",    texts: ["level up! 🎉", "we're growing!", "look at that XP!", "you're amazing!"] },
  ],
  milestone_calls: [
    { mood: "happy",    texts: ["100 tool calls! impressive.", "we've been busy!", "on a roll!"] },
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function getQuip(category: QuipCategory): { mood: Mood; text: string } {
  const entries = QUIPS[category]
  const entry   = pickRandom(entries)
  const text    = pickRandom(entry.texts)
  return { mood: entry.mood, text }
}

export function getToolQuip(tool: string): { mood: Mood; text: string } {
  if (["bash", "shell"].includes(tool))                         return getQuip("tool_bash")
  if (["read", "glob", "grep", "lsp"].includes(tool))          return getQuip("tool_read")
  if (["write", "edit", "apply_patch"].includes(tool))         return getQuip("tool_write")
  if (["websearch", "webfetch"].includes(tool))                 return getQuip("tool_search")
  return getQuip("tool_generic")
}
