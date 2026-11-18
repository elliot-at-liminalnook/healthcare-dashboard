import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  TextInput,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { errorMessage, fieldErrors } from '../../api/errors.ts'
import { BloodType, PatientStatus, type PatientWrite } from '../../api/generated/model'
import {
  COMMON_ALLERGIES,
  EMPTY_PATIENT,
  COMMON_CONDITIONS,
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
}

/** The create and edit form for a patient. */
export function PatientForm({ initialValues, submitLabel, cancelTo, onSubmit }: PatientFormProps) {
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

        <Card component="fieldset">
          <Title order={3} size="h5" mb="md" component="legend">
            Personal information
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="First name"
              withAsterisk
              autoComplete="off"
              {...field('first_name')}
            />
            <TextInput label="Last name" withAsterisk autoComplete="off" {...field('last_name')} />
            <TextInput
              label="Preferred name"
              autoComplete="off"
              description="2-50 characters; letters, spaces, hyphens, apostrophes, and periods"
              {...field('preferred_name')}
            />
            <DateInput
              label="Date of birth"
              withAsterisk
              placeholder="Jan 31, 1980"
              valueFormat={DATE_FORMAT}
              maxDate={today}
              {...field('date_of_birth')}
            />
            <TextInput label="Phone" type="tel" autoComplete="off" {...field('phone')} />
            <TextInput label="Email" type="email" autoComplete="off" {...field('email')} />
            <TextInput label="Address" autoComplete="off" {...field('address_line1')} />
            <TextInput
              label="Apartment, unit or suite"
              autoComplete="off"
              {...field('address_line2')}
            />
            <TextInput label="City" autoComplete="off" {...field('city')} />
            <TextInput label="State" autoComplete="off" {...field('state')} />
            <TextInput label="Postal code" autoComplete="off" {...field('postal_code')} />
          </SimpleGrid>
        </Card>

        <Card component="fieldset">
          <Title order={3} size="h5" mb="md" component="legend">
            Medical information
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Status"
              withAsterisk
              data={STATUS_OPTIONS}
              allowDeselect={false}
              {...field('status')}
            />
            <Select
              label="Blood type"
              placeholder="Not on file"
              data={Object.values(BloodType)}
              clearable
              {...field('blood_type')}
            />
            <TagsInput
              label="Conditions"
              description="Press Enter after each one"
              data={COMMON_CONDITIONS}
              {...field('conditions')}
            />
            <TagsInput
              label="Allergies"
              description="Press Enter after each one"
              data={COMMON_ALLERGIES}
              {...field('allergies')}
            />
            <DateInput
              label="Last visit"
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
