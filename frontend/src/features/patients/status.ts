import type { PatientStatus } from '../../api/generated/model'

/** How each patient status is shown, everywhere in the app. */
export const STATUS_DISPLAY: Record<PatientStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'brand' },
  inactive: { label: 'Inactive', color: 'gray' },
  critical: { label: 'Critical', color: 'red' },
}
