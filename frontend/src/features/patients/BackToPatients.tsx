import { Button } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { Link } from 'react-router'

/** The "← Patients" link at the top of a patient's pages. */
export function BackToPatients() {
  return (
    <div>
      <Button
        component={Link}
        to="/patients"
        variant="subtle"
        size="compact-sm"
        leftSection={<IconArrowLeft size={16} />}
        ml={-8}
      >
        Patients
      </Button>
    </div>
  )
}
