import { Badge } from '@mantine/core'
import type { PatientStatus } from '../../api/generated/model'
import { STATUS_DISPLAY } from './status.ts'

export function StatusBadge({ status }: { status: PatientStatus }) {
  const { label, color } = STATUS_DISPLAY[status]
  return <Badge color={color}>{label}</Badge>
}
