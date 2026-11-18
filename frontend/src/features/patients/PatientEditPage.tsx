import { Button, Skeleton, Stack, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import type { PatientConflict, PatientWrite } from '../../api/generated/model'
import { getGetPatientSummaryQueryKey } from '../../api/generated/notes/notes.ts'
import {
  getGetPatientQueryKey,
  getListPatientsQueryKey,
  useGetPatient,
  useReplacePatient,
} from '../../api/generated/patients/patients.ts'
import { ApiError } from '../../api/http.ts'
import { MessagePage } from '../../app/MessagePage.tsx'
import { BackToPatients } from './BackToPatients.tsx'
import { fullName } from './format.ts'
import { PatientForm } from './PatientForm.tsx'
import { toFormValues } from './patientForm.ts'

/** How often to check whether someone else has saved the patient being edited. */
const CHECK_FOR_CHANGES_MS = 10_000

function isConflict(error: unknown): error is ApiError & { body: PatientConflict } {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    typeof error.body === 'object' &&
    error.body !== null &&
    'current' in error.body
  )
}

export function PatientEditPage() {
  const { patientId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Re-read while the form is open, so a change saved in another session shows up here.
  const {
    data: patient,
    error,
    refetch,
  } = useGetPatient(patientId, { query: { refetchInterval: CHECK_FOR_CHANGES_MS } })
  const replacePatient = useReplacePatient()

  async function save(data: PatientWrite) {
    let updated
    try {
      // The server refuses the save if the patient is no longer at this version.
      updated = await replacePatient.mutateAsync({
        patientId,
        data: { ...data, version: patient!.version },
      })
    } catch (error) {
      // Refused: someone saved first. Hand their copy to the form, which shows what changed.
      if (isConflict(error)) {
        queryClient.setQueryData(getGetPatientQueryKey(patientId), error.body.current)
      }
      throw error
    }
    // Show the saved record at once; lists and the summary refetch.
    queryClient.setQueryData(getGetPatientQueryKey(patientId), updated)
    queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetPatientSummaryQueryKey(patientId) })
    notifications.show({
      message: 'Changes saved',
      color: 'brand',
      icon: <IconCheck size={16} />,
    })
    navigate(`/patients/${patientId}`)
  }

  if (error instanceof ApiError && (error.status === 404 || error.status === 422)) {
    return (
      <MessagePage
        title="Patient not found"
        description="This patient does not exist or has been removed."
        action={
          <Button component={Link} to="/patients">
            Back to patients
          </Button>
        }
      />
    )
  }
  // A failed re-read must not take the form, and what has been typed, off the screen.
  if (error && !patient) {
    return (
      <MessagePage
        title="Could not load this patient"
        description="Check your connection and try again."
        action={<Button onClick={() => refetch()}>Retry</Button>}
      />
    )
  }

  return (
    <Stack gap="md" maw={880}>
      <BackToPatients />
      {patient ? (
        <>
          <Title order={2}>Edit {fullName(patient)}</Title>
          <PatientForm
            initialValues={toFormValues(patient)}
            submitLabel="Save changes"
            cancelTo={`/patients/${patientId}`}
            onSubmit={save}
            saved={{ version: patient.version, values: toFormValues(patient) }}
          />
        </>
      ) : (
        <Stack gap="lg" aria-busy="true" aria-label="Loading patient">
          <Skeleton height={32} width={260} />
          <Skeleton height={320} radius="lg" />
          <Skeleton height={220} radius="lg" />
        </Stack>
      )}
    </Stack>
  )
}
