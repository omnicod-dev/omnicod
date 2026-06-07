import React from "react"
import { Box, Text, useInput } from "ink"
import type { Task } from "@omnicod/core"
import { useTheme } from "../utils/theme.js"

const STATUS_ICON: Record<Task["status"], string> = {
  done:        "✓",
  error:       "✗",
  pending:     "○",
  in_progress: "●",
}

interface Props {
  tasks:   Task[]
  onClose: () => void
}

export function TaskFloatingPanel({ tasks, onClose }: Props) {
  const theme = useTheme()

  const STATUS_COLOR: Record<Task["status"], string> = {
    done:        theme.success,
    error:       theme.error,
    pending:     theme.textDim,
    in_progress: theme.accent,
  }

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "t")) onClose()
  })

  const shown = tasks.slice(-12)

  return (
    <Box
      width={30}
      flexDirection="column"
      flexShrink={0}
      borderStyle="single"
      borderColor={theme.borderDim}
      paddingX={1}
    >
      {/* Başlık */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={theme.textSecondary} bold>Tasks ({tasks.length})</Text>
        <Text color={theme.textDim} dimColor>Esc</Text>
      </Box>

      {/* Boş durum */}
      {shown.length === 0 && (
        <Text color={theme.textDim} italic>No tasks yet</Text>
      )}

      {/* Task listesi */}
      {shown.map((t) => {
        const label = t.subject.length > 22 ? t.subject.slice(0, 21) + "…" : t.subject
        return (
          <Box key={t.id} gap={1} marginBottom={0}>
            <Text color={STATUS_COLOR[t.status]}>{STATUS_ICON[t.status]}</Text>
            <Text
              color={t.status === "done" ? theme.textDim : theme.textPrimary}
              strikethrough={t.status === "done"}
            >
              {label}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
