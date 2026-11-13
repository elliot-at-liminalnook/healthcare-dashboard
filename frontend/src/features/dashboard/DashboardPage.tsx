import { Badge, Card, Loader, Text, Title } from '@mantine/core'
import { useGetHealth } from '../../api/generated/health/health.ts'

function ApiStatus() {
  const { data, isPending, isError } = useGetHealth()

  if (isPending) return <Loader size="sm" />
  if (isError) return <Badge color="red">Unreachable</Badge>
  return <Badge color="green">Status: {data.status}</Badge>
}

export function DashboardPage() {
  return (
    <>
      <Title order={2} mb="md">
        Dashboard
      </Title>
      <Card withBorder maw={320}>
        <Text fw={600} mb="xs">
          API
        </Text>
        <ApiStatus />
      </Card>
    </>
  )
}
