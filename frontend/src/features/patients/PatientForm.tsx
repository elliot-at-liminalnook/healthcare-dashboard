import {
  Alert,
  Button,
  Card,
  Group,
  List,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { IconAlertTriangle, IconUsers } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage, fieldErrors } from '../../api/errors.ts'
import { BloodType, PatientStatus, type PatientWrite } from '../../api/generated/model'
import {
  COMMON_ALLERGIES,
  EMPTY_PATIENT,
  COMMON_CONDITIONS,
  displayValue,
  FIELD_LABELS,
  incomingChanges,
  type IncomingChanges,
  type PatientField,
  type PatientFormValues,
  toPatientWrite,
  validatePatient,
} from './patientForm.ts'
import { STATUS_DISPLAY } from './status.ts'

const STATUS_OPTIONS = Object.values(PatientStatus).map((status) => ({
  value: status,
  label: STATUS_DISPLAY[status].label,
}))
const DATE_FORMAT = 'MMM D, YYYY'
// EMPTY_PATIENT lists the fields in the order the form shows them.
const FIELD_ORDER = Object.keys(EMPTY_PATIENT)
const DATE_FIELDS = new Set(['date_of_birth', 'last_visit'])

interface PatientFormProps {
  initialValues: PatientFormValues
  submitLabel: string
  /** Where Cancel goes. */
  cancelTo: string
  /** Save the patient. Reject to report a failure; the form shows it. */
  onSubmit: (patient: PatientWrite) => Promise<unknown>
  /**
   * When editing: the record as the server has it now. When a newer version
   * arrives (someone else saved), the form takes it in and says what changed.
   */
  saved?: { version: number; values: PatientFormValues }
}

/** The create and edit form for a patient. */
export function PatientForm({
  initialValues,
  submitLabel,
  cancelTo,
  onSubmit,
  saved,
}: PatientFormProps) {
  const [submitting, setSubmitting] = useState(false)
  // Dates after today cannot be picked. Read once, so rendering stays pure.
  const [today] = useState(() => new Date())
  // A failure that is not about one field: no connection, server error, record gone.
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<PatientFormValues>({
    mode: 'uncontrolled',
    initialValues,
    validate: validatePatient,
    validateInputOnBlur: true,
  })

  // The copy of the record that this form's edits are measured against.
  const baseline = useRef({ version: saved?.version, values: initialValues })
  // What another session changed while this form was open, until dismissed.
  const [changes, setChanges] = useState<IncomingChanges | null>(null)

  useEffect(() => {
    if (!saved || saved.version === baseline.current.version) return
    const current = form.getValues()
    const { updated, conflicts } = incomingChanges(baseline.current.values, current, saved.values)
    baseline.current = saved
    // Fields this user has not touched simply show the new value.
    for (const name of updated) form.setFieldValue(name, saved.values[name])

    setChanges((earlier) => {
      // Differences reported earlier still stand, unless the two sides now agree.
      for (const name of Object.keys(earlier?.conflicts ?? {}) as PatientField[]) {
        if (
          !(name in conflicts) &&
          JSON.stringify(current[name]) !== JSON.stringify(saved.values[name])
        ) {
          Object.assign(conflicts, { [name]: saved.values[name] })
        }
      }
      const allUpdated = [...new Set([...(earlier?.updated ?? []), ...updated])].filter(
        (name) => !(name in conflicts),
      )
      const nothingToReport = allUpdated.length === 0 && Object.keys(conflicts).length === 0
      return nothingToReport ? null : { updated: allUpdated, conflicts }
    })
    // Only a new version is news; `saved.values` is rebuilt on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.version])

  function useTheirValue(name: PatientField) {
    form.setFieldValue(name, changes!.conflicts[name]!)
    form.clearFieldError(name)
    setChanges((now) => {
      if (!now) return now
      const { [name]: _taken, ...conflicts } = now.conflicts
      return { updated: [...now.updated, name], conflicts }
    })
  }

  /** Bring the first field with a problem, in the order they appear on screen, into view. */
  function focusFirstError(errors: Record<string, unknown>) {
    const first = FIELD_ORDER.find((name) => name in errors)
    if (!first) return
    const input = form.getInputNode(first)
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // Focusing a date field opens its calendar, which would cover the message.
    if (!DATE_FIELDS.has(first)) input?.focus({ preventScroll: true })
  }

  const submit = form.onSubmit(async (values) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(toPatientWrite(values))
    } catch (error) {
      // The server has the final say. Show what it rejected under the field
      // concerned, and anything else above the form. Nothing typed is lost.
      const { '': general, ...byField } = fieldErrors(error)
      form.setErrors(byField)
      focusFirstError(byField)
      if (general || Object.keys(byField).length === 0) setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }, focusFirstError)

  const field = (name: keyof PatientFormValues) => ({
    key: form.key(name),
    ...form.getInputProps(name),
  })

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        {submitError && (
          <Alert
            color="red"
            icon={<IconAlertTriangle size={18} />}
            title="The patient was not saved"
            withCloseButton
            onClose={() => setSubmitError(null)}
          >
            {submitError} Nothing you entered has been lost.
          </Alert>
        )}

        {changes && (
          <ChangedElsewhere
            changes={changes}
            onUseTheirs={useTheirValue}
            onClose={() => setChanges(null)}
          />
        )}

        <Card component="fieldset">
          <Title order={3} size="h5" mb="md" component="legend">
            Personal information
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label={FIELD_LABELS.first_name}
              withAsterisk
              autoComplete="off"
              {...field('first_name')}
            />
            <TextInput
              label={FIELD_LABELS.last_name}
              withAsterisk
              autoComplete="off"
              {...field('last_name')}
            />
            <TextInput
              label={FIELD_LABELS.preferred_name}
              autoComplete="off"
              description="2-50 characters; letters, spaces, hyphens, apostrophes, and periods"
              {...field('preferred_name')}
            />
            <DateInput
              label={FIELD_LABELS.date_of_birth}
              withAsterisk
              placeholder="Jan 31, 1980"
              valueFormat={DATE_FORMAT}
              maxDate={today}
              {...field('date_of_birth')}
            />
            <TextInput
              label={FIELD_LABELS.phone}
              type="tel"
              autoComplete="off"
              {...field('phone')}
            />
            <TextInput
              label={FIELD_LABELS.email}
              type="email"
              autoComplete="off"
              {...field('email')}
            />
            <TextInput
              label={FIELD_LABELS.address_line1}
              autoComplete="off"
              {...field('address_line1')}
            />
            <TextInput
              label={FIELD_LABELS.address_line2}
              autoComplete="off"
              {...field('address_line2')}
            />
            <TextInput label={FIELD_LABELS.city} autoComplete="off" {...field('city')} />
            <TextInput label={FIELD_LABELS.state} autoComplete="off" {...field('state')} />
            <TextInput
              label={FIELD_LABELS.postal_code}
              autoComplete="off"
              {...field('postal_code')}
            />
          </SimpleGrid>
        </Card>

        <Card component="fieldset">
          <Title order={3} size="h5" mb="md" component="legend">
            Medical information
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label={FIELD_LABELS.status}
              withAsterisk
              data={STATUS_OPTIONS}
              allowDeselect={false}
              {...field('status')}
            />
            <Select
              label={FIELD_LABELS.blood_type}
              placeholder="Not on file"
              data={Object.values(BloodType)}
              clearable
              {...field('blood_type')}
            />
            <TagsInput
              label={FIELD_LABELS.conditions}
              description="Press Enter after each one"
              data={COMMON_CONDITIONS}
              {...field('conditions')}
            />
            <TagsInput
              label={FIELD_LABELS.allergies}
              description="Press Enter after each one"
              data={COMMON_ALLERGIES}
              {...field('allergies')}
            />
            <DateInput
              label={FIELD_LABELS.last_visit}
              placeholder="Not yet seen"
              valueFormat={DATE_FORMAT}
              maxDate={today}
              clearable
              {...field('last_visit')}
            />
          </SimpleGrid>
        </Card>

        <Group justify="flex-end">
          <Button component={Link} to={cancelTo} variant="default">
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

/** Tells the user that someone else saved this patient while they were editing it. */
function ChangedElsewhere({
  changes,
  onUseTheirs,
  onClose,
}: {
  changes: IncomingChanges
  onUseTheirs: (name: PatientField) => void
  onClose: () => void
}) {
  const conflicts = Object.keys(changes.conflicts) as PatientField[]
  return (
    <Alert
      color="yellow"
      icon={<IconUsers size={18} />}
      title="This patient was changed in another session"
      withCloseButton
      closeButtonLabel="Dismiss"
      onClose={onClose}
      // Stays in view below the header, wherever in the form the user is.
      pos="sticky"
      top={72}
      style={{ zIndex: 5 }}
    >
      <Stack gap="xs">
        {changes.updated.length > 0 && (
          <Text size="sm">
            Now showing their new {changes.updated.length === 1 ? 'value' : 'values'} for:{' '}
            <b>{changes.updated.map((name) => FIELD_LABELS[name]).join(', ')}</b>.
          </Text>
        )}
        {conflicts.length > 0 && (
          <>
            <Text size="sm">
              You have both changed the following. Your value is kept, and will replace theirs when
              you save.
            </Text>
            <List size="sm" spacing={4}>
              {conflicts.map((name) => (
                <List.Item key={name}>
                  <b>{FIELD_LABELS[name]}</b>: they entered{' '}
                  <b>{displayValue(name, changes.conflicts[name]!)}</b>{' '}
                  <Button variant="default" size="compact-xs" onClick={() => onUseTheirs(name)}>
                    Use their {FIELD_LABELS[name].toLowerCase()}
                  </Button>
                </List.Item>
              ))}
            </List>
          </>
        )}
      </Stack>
    </Alert>
  )
}
