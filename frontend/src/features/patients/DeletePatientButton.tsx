import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconTrash } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { errorMessage } from '../../api/errors.ts'
import type { PatientRead } from '../../api/generated/model'
import { getListPatientsQueryKey, useDeletePatient } from '../../api/generated/patients/patients.ts'
import { fullName } from './format.ts'

/** Delete a patient, after confirming. Returns to the list when done. */
export function DeletePatientButton({ patient }: { patient: PatientRead }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [opened, { open, close }] = useDisclosure(false)
  const deletePatient = useDeletePatient()

  function confirm() {
    deletePatient.mutate(
      { patientId: patient.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() })
          notifications.show({ message: `${fullName(patient)} was deleted`, color: 'gray' })
          navigate('/patients')
        },
        onError: (error) => {
          close()
          notifications.show({
            title: 'The patient was not deleted',
            message: errorMessage(error),
            color: 'red',
          })
        },
      },
    )
  }

  return (
    <>
      <Button variant="default" c="red" leftSection={<IconTrash size={16} />} onClick={open}>
        Delete
      </Button>
      <Modal opened={opened} onClose={close} title={`Delete ${fullName(patient)}?`} centered>
        <Stack gap="md">
          <Text size="sm">
            This permanently deletes the patient and all of their clinical notes. It cannot be
            undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button color="red" loading={deletePatient.isPending} onClick={confirm}>
              Delete patient
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
