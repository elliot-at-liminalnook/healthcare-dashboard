import { Button, Card, Group, Loader, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import { useGetPatientSummary } from '../../api/generated/notes/notes.ts'
import classes from './PatientSummaryCard.module.css'

/** The generated summary of a patient: who they are, key clinical facts, and their notes. */
export function PatientSummaryCard({ patientId }: { patientId: string }) {
  const { data, isError, isFetching, refetch } = useGetPatientSummary(patientId)

  return (
    <Card component="section" aria-label="Summary" className={classes.card}>
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <ThemeIcon variant="light" size={30} radius="md" aria-hidden>
            <IconFileText size={18} />
          </ThemeIcon>
          <Title order={3} size="h5">
            Summary
          </Title>
          {/* Shown while the summary refreshes after a note is added or removed. */}
          {data && isFetching && <Loader size="xs" aria-label="Updating summary" />}
        </Group>
        {data && (
          <Text size="xs" c="dimmed">
            Written from the profile and {data.note_count}{' '}
            {data.note_count === 1 ? 'note' : 'notes'}
          </Text>
        )}
      </Group>

      {isError ? (
        <Group gap="sm">
          <Text c="dimmed">The summary could not be loaded.</Text>
          <Button variant="subtle" size="compact-sm" onClick={() => refetch()}>
            Retry
          </Button>
        </Group>
      ) : data ? (
        <Stack gap="xs">
          {data.summary.split('\n\n').map((paragraph) => (
            <Text key={paragraph} lh={1.6}>
              {paragraph}
            </Text>
          ))}
        </Stack>
      ) : (
        <Stack gap={10} aria-busy="true" aria-label="Loading summary">
          <Skeleton height={14} width="70%" />
          <Skeleton height={14} width="55%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="85%" />
        </Stack>
      )}
    </Card>
  )
}
