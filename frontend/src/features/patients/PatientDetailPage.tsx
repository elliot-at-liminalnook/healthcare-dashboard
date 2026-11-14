import {
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { PatientRead } from '../../api/generated/model'
import { useGetPatient } from '../../api/generated/patients/patients.ts'
import { ApiError } from '../../api/http.ts'
import { MessagePage } from '../../app/MessagePage.tsx'
import { NotesSection } from '../notes/NotesSection.tsx'
import { PatientSummaryCard } from '../notes/PatientSummaryCard.tsx'
import { BackToPatients } from './BackToPatients.tsx'
import { DeletePatientButton } from './DeletePatientButton.tsx'
import { formatDate, fullName } from './format.ts'
import { StatusBadge } from './StatusBadge.tsx'

const NOT_ON_FILE = (
  <Text span c="dimmed" inherit>
    Not on file
  </Text>
)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" lts={0.4}>
        {label}
      </Text>
      <Text component="div" mt={2} style={{ overflowWrap: 'anywhere' }}>
        {children ?? NOT_ON_FILE}
      </Text>
    </div>
  )
}

function TagList({ items, color, empty }: { items: string[]; color: string; empty: string }) {
  if (items.length === 0) {
    return (
      <Text span c="dimmed" inherit>
        {empty}
      </Text>
    )
  }
  return (
    <Group gap={6} mt={2}>
      {items.map((item) => (
        <Badge key={item} color={color} tt="none" size="lg" fw={500}>
          {item}
        </Badge>
      ))}
    </Group>
  )
}

function address(patient: PatientRead): ReactNode {
  const cityLine = [patient.city, [patient.state, patient.postal_code].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const lines = [patient.address_line1, patient.address_line2, cityLine].filter(Boolean)
  if (lines.length === 0) return null
  return lines.map((line) => <div key={line}>{line}</div>)
}

function PatientDetails({ patient }: { patient: PatientRead }) {
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group gap="md" wrap="nowrap">
          <Avatar size={56} radius="xl" color="brand" name={fullName(patient)} />
          <div>
            <Group gap="sm">
              <Title order={2}>{fullName(patient)}</Title>
              <StatusBadge status={patient.status} />
            </Group>
            <Text c="dimmed">
              {patient.age} years old · born {formatDate(patient.date_of_birth)}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <Button
            component={Link}
            to={`/patients/${patient.id}/edit`}
            variant="default"
            leftSection={<IconPencil size={16} />}
          >
            Edit
          </Button>
          <DeletePatientButton patient={patient} />
        </Group>
      </Group>

      <PatientSummaryCard patientId={patient.id} />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card>
          <Title order={3} size="h5" mb="md">
            Personal information
          </Title>
          <Grid gap="md">
            <Grid.Col span={6}>
              <Field label="Date of birth">{formatDate(patient.date_of_birth)}</Field>
            </Grid.Col>
            <Grid.Col span={6}>
              <Field label="Phone">{patient.phone}</Field>
            </Grid.Col>
            <Grid.Col span={12}>
              <Field label="Email">
                {patient.email && <Anchor href={`mailto:${patient.email}`}>{patient.email}</Anchor>}
              </Field>
            </Grid.Col>
            <Grid.Col span={12}>
              <Field label="Address">{address(patient)}</Field>
            </Grid.Col>
          </Grid>
        </Card>

        <Card>
          <Title order={3} size="h5" mb="md">
            Medical information
          </Title>
          <Grid gap="md">
            <Grid.Col span={6}>
              <Field label="Blood type">{patient.blood_type}</Field>
            </Grid.Col>
            <Grid.Col span={6}>
              <Field label="Last visit">
                {patient.last_visit ? formatDate(patient.last_visit) : 'Not yet seen'}
              </Field>
            </Grid.Col>
            <Grid.Col span={12}>
              <Field label="Conditions">
                <TagList items={patient.conditions} color="brand" empty="None recorded" />
              </Field>
            </Grid.Col>
            <Grid.Col span={12}>
              <Field label="Allergies">
                <TagList items={patient.allergies} color="orange" empty="None recorded" />
              </Field>
            </Grid.Col>
          </Grid>
        </Card>
      </SimpleGrid>

      <NotesSection patientId={patient.id} />
    </Stack>
  )
}

function LoadingDetails() {
  return (
    <Stack gap="lg" aria-busy="true" aria-label="Loading patient">
      <Group gap="md">
        <Skeleton circle height={56} />
        <div>
          <Skeleton height={28} width={220} />
          <Skeleton height={16} width={180} mt={8} />
        </div>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Skeleton height={190} radius="lg" />
        <Skeleton height={190} radius="lg" />
      </SimpleGrid>
    </Stack>
  )
}

export function PatientDetailPage() {
  const { patientId = '' } = useParams()
  const { data: patient, error, refetch } = useGetPatient(patientId)

  // A malformed id is rejected by the API (422); to the user it is the same as not found.
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
    <Stack gap="md">
      <BackToPatients />
      {patient ? <PatientDetails patient={patient} /> : <LoadingDetails />}
    </Stack>
  )
}
