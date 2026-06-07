import React from "react"
import { Box, Text } from "ink"
import { computeDiff } from "@omnicod/core"
import { useTheme } from "../utils/theme.js"

interface Props {
  oldText:  string
  newText:  string
  fileName?: string
  maxHunks?: number
}

export function DiffView({ oldText, newText, fileName, maxHunks = 3 }: Props) {
  const theme = useTheme()
  const hunks = computeDiff(oldText, newText, 2)
  if (!hunks.length) return null

  const shown = hunks.slice(0, maxHunks)
  const hidden = hunks.length - shown.length

  return (
    <Box flexDirection="column" marginTop={1}>
      {fileName && (
        <Text color={theme.textDim} dimColor>── {fileName} ──</Text>
      )}
      {shown.map((hunk, hi) => (
        <Box key={hi} flexDirection="column">
          <Text color={theme.borderBright} dimColor>
            @@ -{hunk.oldStart} +{hunk.newStart} @@
          </Text>
          {hunk.lines.map((line, li) => {
            if (line.type === "add")    return <Text key={li} color="#4ade80">{`+ ${line.content}`}</Text>
            if (line.type === "remove") return <Text key={li} color="#f87171">{`- ${line.content}`}</Text>
            return <Text key={li} color={theme.textDim} dimColor>{`  ${line.content}`}</Text>
          })}
        </Box>
      ))}
      {hidden > 0 && (
        <Text color={theme.borderBright} dimColor>⋯ {hidden} more hunk{hidden > 1 ? "s" : ""} [Ctrl+O]</Text>
      )}
    </Box>
  )
}
