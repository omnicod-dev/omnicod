import React, { useState, useEffect, memo } from "react"
import { Box, Text } from "ink"
import type { Mood } from "./types.js"
import { SPECIES_MAP } from "./species.js"
import { HATS_MAP } from "./hats.js"

interface Props {
  speciesId:  string
  hatId?:     string
  mood:       Mood
  quip?:      string
}

const FRAME_INTERVAL = 600  // ms per idle animation frame

export const CompanionSprite = memo(function CompanionSprite({ speciesId, hatId, mood, quip }: Props) {
  const [frameIdx, setFrameIdx] = useState(0)

  const species = SPECIES_MAP.get(speciesId) ?? SPECIES_MAP.get("cat")!
  const hat     = hatId ? HATS_MAP.get(hatId) : undefined
  const color   = species.colors[mood]

  // Idle animation — only cycle frames during idle mood
  useEffect(() => {
    if (mood !== "idle") { setFrameIdx(0); return }
    const timer = setInterval(() => {
      setFrameIdx(i => (i + 1) % species.frames.idle.length)
    }, FRAME_INTERVAL)
    return () => clearInterval(timer)
  }, [mood, species.frames.idle.length])

  const frame: string[] = mood === "idle"
    ? (species.frames.idle[frameIdx] ?? species.frames.idle[0]!)
    : species.frames[mood]

  const hatArt = hat?.art && hat.art.length > 0 ? hat.art : null

  return (
    <Box flexDirection="column" alignItems="center" flexShrink={0}>
      {hatArt && <Text color={color}>{hatArt}</Text>}
      {frame.map((line, i) => (
        <Text key={i} color={color}>{line}</Text>
      ))}
      {quip && (
        <Box marginTop={0}>
          <Text color={color} dimColor italic>{quip}</Text>
        </Box>
      )}
    </Box>
  )
})
