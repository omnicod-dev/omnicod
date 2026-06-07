import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../utils/theme.js"

const PAGE_SIZE = process.stdout.rows ? process.stdout.rows - 6 : 30

interface Props {
  content:  string
  toolName: string
  onClose:  () => void
}

export function ExpandableOutput({ content, toolName, onClose }: Props) {
  const theme = useTheme()
  const lines = content.split("\n")
  const [offset, setOffset] = useState(0)

  useInput((_char, key) => {
    if (key.escape || key.return) { onClose(); return }
    if (key.upArrow)   setOffset((o) => Math.max(0, o - 1))
    if (key.downArrow) setOffset((o) => Math.min(lines.length - PAGE_SIZE, o + 1))
    if (key.ctrl && _char === "u") setOffset((o) => Math.max(0, o - Math.floor(PAGE_SIZE / 2)))
    if (key.ctrl && _char === "d") setOffset((o) => Math.min(lines.length - PAGE_SIZE, o + Math.floor(PAGE_SIZE / 2)))
  })

  const visible     = lines.slice(offset, offset + PAGE_SIZE)
  const totalLines  = lines.length
  const pct         = totalLines <= PAGE_SIZE ? 100 : Math.round(((offset + PAGE_SIZE) / totalLines) * 100)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.borderActive} width="100%">
      {/* Başlık */}
      <Box paddingX={1} justifyContent="space-between" borderStyle="single"
           borderColor={theme.borderDim} borderTop={false} borderLeft={false} borderRight={false}>
        <Text color={theme.accent} bold>⊞ {toolName}</Text>
        <Text color={theme.textDim}>{totalLines} satır  {pct}%  ↑↓ scroll  Esc kapat</Text>
      </Box>

      {/* İçerik */}
      <Box flexDirection="column" paddingX={1}>
        {visible.map((line, i) => {
          const lineNo = offset + i + 1
          return (
            <Box key={i} gap={1}>
              <Text color={theme.borderBright} dimColor>{String(lineNo).padStart(4)}</Text>
              <Text color={theme.textSecondary} wrap="wrap">{line}</Text>
            </Box>
          )
        })}
      </Box>

      {/* Sayfalama */}
      {totalLines > PAGE_SIZE && (
        <Box paddingX={1} borderStyle="single" borderColor={theme.borderDim}
             borderBottom={false} borderLeft={false} borderRight={false}>
          <Text color={theme.textDim}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, totalLines)} / {totalLines}
            {"  "}Ctrl+U/D yarım sayfa  ↑↓ satır satır
          </Text>
        </Box>
      )}
    </Box>
  )
}
