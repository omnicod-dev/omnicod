import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { PickerItem } from "../commands/types.js"
import { useTheme } from "../utils/theme.js"

const PAGE_SIZE = 10

interface Props {
  title:    string
  items:    PickerItem[]
  onSelect: (item: PickerItem) => void
  onCancel: () => void
}

export function Picker({ title, items, onSelect, onCancel }: Props) {
  const theme = useTheme()
  const [idx, setIdx] = useState(0)
  const [offset, setOffset] = useState(0)

  useInput((_input, key) => {
    if (key.upArrow) {
      const next = Math.max(0, idx - 1)
      setIdx(next)
      if (next < offset) setOffset(next)
    }
    if (key.downArrow) {
      const next = Math.min(items.length - 1, idx + 1)
      setIdx(next)
      if (next >= offset + PAGE_SIZE) setOffset(next - PAGE_SIZE + 1)
    }
    if (key.return) {
      const item = items[idx]
      if (item) onSelect(item)
    }
    if (key.escape) onCancel()
  })

  const visible = items.slice(offset, offset + PAGE_SIZE)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.borderActive} paddingX={1} marginY={1}>
      <Text color={theme.accent} bold>{title}</Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((item, i) => {
          const selected = offset + i === idx
          return (
            <Box key={item.id}>
              <Text color={selected ? theme.accent : theme.textSecondary} bold={selected}>
                {selected ? "▶ " : "  "}
              </Text>
              <Text color={selected ? theme.accent : theme.textPrimary}>{item.label}</Text>
              {item.hint && (
                <Text color={theme.textDim} dimColor>{"  "}{item.hint}</Text>
              )}
            </Box>
          )
        })}
        {items.length > PAGE_SIZE && (
          <Text color={theme.textDim} dimColor>
            {"  "}{offset + 1}-{Math.min(offset + PAGE_SIZE, items.length)} / {items.length}
          </Text>
        )}
      </Box>
      <Box marginTop={1}><Text color={theme.textDim} dimColor>↑↓ select  Enter confirm  Esc cancel</Text></Box>
    </Box>
  )
}
