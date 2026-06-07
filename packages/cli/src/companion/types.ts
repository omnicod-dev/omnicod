// Companion system — core types

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary"
export type Mood   = "idle" | "thinking" | "working" | "error" | "happy" | "sleeping"

export type Frame = string[]  // array of ASCII lines

export interface SpeciesColors {
  idle:     string
  thinking: string
  working:  string
  error:    string
  happy:    string
  sleeping: string
}

export interface SpeciesDef {
  id:          string
  name:        string
  rarity:      Rarity
  xpRequired:  number
  colors:      SpeciesColors
  frames: {
    idle:     Frame[]   // 2-4 frames for idle animation cycle
    thinking: Frame
    working:  Frame
    error:    Frame
    happy:    Frame
    sleeping: Frame
  }
}

export interface HatDef {
  id:          string
  name:        string
  xpRequired:  number
  art:         string  // single line placed above the sprite
}

export interface CompanionState {
  speciesId:        string
  hatId?:           string
  customName?:      string   // user-set name via /name
  xp:               number
  unlockedSpecies:  string[]
  unlockedHats:     string[]
  totalToolCalls:   number
  totalMessages:    number
}
