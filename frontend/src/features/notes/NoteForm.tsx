import { Alert, Button, Group, Stack, Textarea } from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconCheck, IconPlus } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { errorMessage, fieldErrors } from '../../api/errors.ts'
import {
  getGetPatientSummaryQueryKey,
  getListNotesQueryKey,
  useCreateNote,
} from '../../api/generated/notes/notes.ts'

const MAX_LENGTH = 5000
const PICKER_FORMAT = 'YYYY-MM-DD HH:mm:ss'

function now(): string {
  return dayjs().format(PICKER_FORMAT)
}

/** Add a clinical note: what was observed, and when. */
export function NoteForm({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient()
  const createNote = useCreateNote()

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { content: '', timestamp: now() },
    validate: {
      content: (value) => {
        const text = value.trim()
        if (!text) return 'Write the note before adding it'
        if (text.length > MAX_LENGTH)
          return `Must be ${MAX_LENGTH.toLocaleString()} characters or fewer`
        return null
      },
      timestamp: (value) => {
        if (!value) return 'Choose when the note was taken'
        if (dayjs(value).isAfter(dayjs().add(5, 'minute'))) return 'Cannot be in the future'
        return null
      },
    },
  })

  const submit = form.onSubmit((values) => {
    createNote.mutate(
      {
        patientId,
        data: { content: values.content, timestamp: dayjs(values.timestamp).toISOString() },
      },
      {
        onSuccess: () => {
          form.setValues({ content: '', timestamp: now() })
          notifications.show({
            message: 'Note added',
            color: 'brand',
            icon: <IconCheck size={16} />,
          })
          // The summary is written from the notes, so it is stale too.
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(patientId) })
          queryClient.invalidateQueries({ queryKey: getGetPatientSummaryQueryKey(patientId) })
        },
        // Problems with a field appear under that field; anything else, above the form.
        onError: (error) => form.setErrors(fieldErrors(error)),
      },
    )
  })

  const showAlert = createNote.isError && Object.keys(fieldErrors(createNote.error)).length === 0

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="sm">
        {showAlert && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} title="The note was not saved">
            {errorMessage(createNote.error)} Your text is still here.
          </Alert>
        )}
        <Textarea
          label="New note"
          placeholder="What happened at this visit?"
          autosize
          minRows={3}
          maxRows={10}
          key={form.key('content')}
          {...form.getInputProps('content')}
        />
        <Group justify="space-between" align="flex-end">
          <DateTimePicker
            label="When"
            valueFormat="MMM D, YYYY h:mm A"
            maxDate={dayjs().endOf('day').toDate()}
            w={230}
            key={form.key('timestamp')}
            {...form.getInputProps('timestamp')}
          />
          <Button type="submit" loading={createNote.isPending} leftSection={<IconPlus size={16} />}>
            Add note
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
