const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

/**
 * Format an API date ("2026-03-14") for display ("Mar 14, 2026").
 * The parts are read directly so the date never shifts with the viewer's time zone.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return DATE_FORMAT.format(new Date(year, month - 1, day))
}

export function fullName(patient: { first_name: string; last_name: string }): string {
  return `${patient.first_name} ${patient.last_name}`
}
