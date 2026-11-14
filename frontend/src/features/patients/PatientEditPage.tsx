import { Button, Skeleton, Stack, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import type { PatientWrite } from '../../api/generated/model'
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

export function PatientEditPage() {
  const { patientId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: patient, error, refetch } = useGetPatient(patientId)
  const replacePatient = useReplacePatient()

  async function save(data: PatientWrite) {
    const updated = await replacePatient.mutateAsync({ patientId, data })
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
  if (error) {
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
