export type { Rarity, Mood, Frame, SpeciesColors, SpeciesDef, HatDef, CompanionState } from "./types.js"
export { SPECIES, SPECIES_MAP } from "./species.js"
export { HATS, HATS_MAP } from "./hats.js"
export { getQuip, getToolQuip } from "./quips.js"
export {
  loadCompanion, saveCompanion, addXP,
  setSpecies, setHat, setCustomName,
} from "./persistence.js"
export type { XPResult } from "./persistence.js"
export { CompanionSprite } from "./CompanionSprite.js"
