import React from "react"
import { Box, Text } from "ink"

interface Props {
  content:  string
  maxLines?: number
}

export function DiffView({ content, maxLines = 60 }: Props) {
  const allLines = content.split("\n")
  const lines    = allLines.slice(0, maxLines)
  const hasMore  = allLines.length > maxLines

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#3b4048" paddingX={1} marginY={1}>
      {lines.map((line, i) => {
        if (line.startsWith("+++") || line.startsWith("---")) {
          return <Text key={i} color="#7ab4e8" bold>{line}</Text>
        }
        if (line.startsWith("@@")) {
          return <Text key={i} color="#d77757">{line}</Text>
        }
        if (line.startsWith("+")) {
          return (
            <Text key={i}>
              <Text color="#4eba65" bold>+</Text>
              <Text color="#4eba65">{line.slice(1)}</Text>
            </Text>
          )
        }
        if (line.startsWith("-")) {
          return (
            <Text key={i}>
              <Text color="#ff6b6b" bold>-</Text>
              <Text color="#ff6b6b">{line.slice(1)}</Text>
            </Text>
          )
        }
        return <Text key={i} color="#8b949e">{line}</Text>
      })}
      {hasMore && (
        <Text color="#52525b" dimColor>  ⋯ {allLines.length - maxLines} satır daha</Text>
      )}
    </Box>
  )
}

export function looksLikeDiff(text: string): boolean {
  const first10 = text.split("\n").slice(0, 10)
  return first10.some((l) => l.startsWith("---") || l.startsWith("+++") || /^@@.*@@/.test(l))
}
