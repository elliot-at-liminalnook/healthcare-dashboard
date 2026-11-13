import { Button } from '@mantine/core'
import { Link } from 'react-router'
import { MessagePage } from './MessagePage.tsx'

export function NotFoundPage() {
  return (
    <MessagePage
      title="Page not found"
      description="Sorry, this page does not exist."
      action={
        <Button component={Link} to="/">
          Back to dashboard
        </Button>
      }
    />
  )
}
