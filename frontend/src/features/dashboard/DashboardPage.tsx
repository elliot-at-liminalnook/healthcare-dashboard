import { Badge, Card, Group, Loader, SimpleGrid, Skeleton, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import { useGetHealth } from '../../api/generated/health/health.ts'
import { PatientStatus } from '../../api/generated/model'
import { useListPatients } from '../../api/generated/patients/patients.ts'
import { STATUS_DISPLAY } from '../patients/status.ts'

/** A count of patients, linking to the list filtered the same way. */
function PatientCount({ status }: { status?: PatientStatus }) {
  // Only the total is needed, so ask for the smallest page.
  const { data } = useListPatients({ page_size: 1, status })
  const label = status ? STATUS_DISPLAY[status].label : 'All patients'
  const color = status ? STATUS_DISPLAY[status].color : 'brand'

  return (
    <Card
      component={Link}
      to={status ? `/patients?status=${status}` : '/patients'}
      style={{ borderTop: `3px solid var(--mantine-color-${color}-filled)` }}
    >
      <Text size="sm" c="dimmed" fw={500}>
        {label}
      </Text>
      {data ? (
        <Text fz={32} fw={700} lh={1.2}>
          {data.total.toLocaleString()}
        </Text>
      ) : (
        <Skeleton height={32} width={64} mt={6} />
      )}
    </Card>
  )
}

function ApiStatus() {
  const { data, isPending, isError } = useGetHealth()

  if (isPending) return <Loader size="xs" />
  if (isError) return <Badge color="red">API unreachable</Badge>
  return <Badge color="green">API {data.status}</Badge>
}

export function DashboardPage() {
  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Dashboard</Title>
        <ApiStatus />
      </Group>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <PatientCount />
        <PatientCount status={PatientStatus.active} />
        <PatientCount status={PatientStatus.critical} />
        <PatientCount status={PatientStatus.inactive} />
      </SimpleGrid>
    </>
  )
}
