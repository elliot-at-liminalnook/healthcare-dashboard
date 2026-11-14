import { Stack, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import type { PatientWrite } from '../../api/generated/model'
import { getListPatientsQueryKey, useCreatePatient } from '../../api/generated/patients/patients.ts'
import { BackToPatients } from './BackToPatients.tsx'
import { fullName } from './format.ts'
import { PatientForm } from './PatientForm.tsx'
import { EMPTY_PATIENT } from './patientForm.ts'

export function PatientCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createPatient = useCreatePatient()

  async function save(data: PatientWrite) {
    const patient = await createPatient.mutateAsync({ data })
    // Every list and count now has one more patient in it.
    queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() })
    notifications.show({
      message: `${fullName(patient)} was added`,
      color: 'brand',
      icon: <IconCheck size={16} />,
    })
    navigate(`/patients/${patient.id}`)
  }

  return (
    <Stack gap="md" maw={880}>
      <BackToPatients />
      <Title order={2}>New patient</Title>
      <PatientForm
        initialValues={EMPTY_PATIENT}
        submitLabel="Add patient"
        cancelTo="/patients"
        onSubmit={save}
      />
    </Stack>
  )
}
