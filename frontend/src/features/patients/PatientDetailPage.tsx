import { Text, Title } from '@mantine/core'
import { useParams } from 'react-router'

export function PatientDetailPage() {
  const { patientId } = useParams()

  return (
    <>
      <Title order={2} mb="md">
        Patient
      </Title>
      <Text c="dimmed">Details for patient {patientId} will appear here.</Text>
    </>
  )
}
