import { Button } from '@mantine/core'
import { MessagePage } from './MessagePage.tsx'

/** Shown when a page throws while rendering. The error itself is logged in main.tsx. */
export function ErrorPage() {
  return (
    <MessagePage
      title="Something went wrong"
      description="The error has been recorded. Reloading the page may help."
      action={<Button onClick={() => window.location.reload()}>Reload</Button>}
    />
  )
}
