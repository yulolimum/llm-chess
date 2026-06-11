import { Box, Text } from 'ink'
import React from 'react'

export function Demo() {
  return (
    <Box borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">
        LLM Chess
      </Text>
      <Text>Terminal UI scaffold powered by Ink.</Text>
      <Text color="gray">Chess board UI will live here next.</Text>
    </Box>
  )
}
