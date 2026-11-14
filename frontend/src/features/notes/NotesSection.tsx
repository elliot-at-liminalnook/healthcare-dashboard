import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconNotes, IconTrash } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage } from '../../api/errors.ts'
import type { NoteRead } from '../../api/generated/model'
import {
  getGetPatientSummaryQueryKey,
  getListNotesQueryKey,
  useDeleteNote,
  useListNotes,
} from '../../api/generated/notes/notes.ts'
import { NoteForm } from './NoteForm.tsx'

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatTimestamp(iso: string): string {
  return TIMESTAMP_FORMAT.format(new Date(iso))
}

/** A patient's clinical notes: add one, read them newest first, delete one. */
export function NotesSection({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient()
  const { data: notes, isError, refetch } = useListNotes(patientId)
  const deleteNote = useDeleteNote()
  // The note awaiting confirmation in the delete dialog, if any.
  const [pendingDelete, setPendingDelete] = useState<NoteRead | null>(null)

  function confirmDelete(note: NoteRead) {
    deleteNote.mutate(
      { patientId, noteId: note.id },
      {
        onSuccess: () => {
          notifications.show({ message: 'Note deleted', color: 'gray' })
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(patientId) })
          queryClient.invalidateQueries({ queryKey: getGetPatientSummaryQueryKey(patientId) })
        },
        onError: (error) => {
          notifications.show({
            title: 'The note was not deleted',
            message: errorMessage(error),
            color: 'red',
          })
        },
        onSettled: () => setPendingDelete(null),
      },
    )
  }

  return (
    <Card component="section" aria-label="Clinical notes">
      <Group gap="sm" mb="md">
        <Title order={3} size="h5">
          Clinical notes
        </Title>
        {notes && <Badge color="gray">{notes.length}</Badge>}
      </Group>

      <NoteForm patientId={patientId} />
      <Divider my="lg" />

      {isError ? (
        <Group gap="sm">
          <Text c="dimmed">The notes could not be loaded.</Text>
          <Button variant="subtle" size="compact-sm" onClick={() => refetch()}>
            Retry
          </Button>
        </Group>
      ) : !notes ? (
        <Stack gap="md" aria-busy="true" aria-label="Loading notes">
          <Skeleton height={48} />
          <Skeleton height={48} />
        </Stack>
      ) : notes.length === 0 ? (
        <Text c="dimmed">No notes yet. The first one you add will appear here.</Text>
      ) : (
        <Timeline bulletSize={26} lineWidth={2}>
          {notes.map((note) => (
            <Timeline.Item
              key={note.id}
              bullet={<IconNotes size={14} />}
              title={
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={600}>
                    {formatTimestamp(note.timestamp)}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Delete note from ${formatTimestamp(note.timestamp)}`}
                    onClick={() => setPendingDelete(note)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              }
            >
              <Text style={{ whiteSpace: 'pre-wrap' }}>{note.content}</Text>
            </Timeline.Item>
          ))}
        </Timeline>
      )}

      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this note?"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed" lineClamp={3}>
            {pendingDelete?.content}
          </Text>
          <Text size="sm">This cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteNote.isPending}
              onClick={() => pendingDelete && confirmDelete(pendingDelete)}
            >
              Delete note
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
