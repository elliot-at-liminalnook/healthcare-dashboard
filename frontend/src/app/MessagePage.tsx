import { Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

interface MessagePageProps {
  title: string
  description: string
  action?: ReactNode
}

/** A centred full-page message, used for the 404 and error pages. */
export function MessagePage({ title, description, action }: MessagePageProps) {
  return (
    <Stack align="center" gap="sm" py={80}>
      <Title order={2}>{title}</Title>
      <Text c="dimmed">{description}</Text>
      {action}
    </Stack>
  )
}
