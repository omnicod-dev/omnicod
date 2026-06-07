import type { HatDef } from "./types.js"

export const HATS: HatDef[] = [
  {
    id: "none",
    name: "No hat",
    xpRequired: 0,
    art: "",
  },
  {
    id: "tophat",
    name: "Top Hat",
    xpRequired: 50,
    art: " _____",
  },
  {
    id: "party",
    name: "Party Hat",
    xpRequired: 150,
    art: "  /\\  ",
  },
  {
    id: "crown",
    name: "Crown",
    xpRequired: 500,
    art: "^v^v^",
  },
  {
    id: "wizard",
    name: "Wizard Hat",
    xpRequired: 800,
    art: "  /\\★ ",
  },
  {
    id: "halo",
    name: "Halo",
    xpRequired: 1000,
    art: " (◯)  ",
  },
  {
    id: "santa",
    name: "Santa Hat",
    xpRequired: 1200,
    art: " _/\\_  ",
  },
  {
    id: "rainbow",
    name: "Rainbow",
    xpRequired: 2000,
    art: "≋≋≋≋≋",
  },
]

export const HATS_MAP = new Map(HATS.map(h => [h.id, h]))
