import '@fontsource-variable/inter'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import { Notifications } from '@mantine/notifications'
import '@mantine/notifications/styles.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { queryClient } from './app/queryClient.ts'
import { router } from './app/router.tsx'
import { theme } from './app/theme.ts'
import { initTelemetry } from './telemetry/index.ts'
import { errorAttributes, logger } from './telemetry/logger.ts'

function logRenderError(error: unknown, info: { componentStack?: string }): void {
  logger.error('React render error', {
    ...errorAttributes(error),
    'react.component_stack': info.componentStack,
  })
}

function render(): void {
  createRoot(document.getElementById('root')!, {
    onCaughtError: logRenderError,
    onUncaughtError: logRenderError,
  }).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme}>
          <Notifications position="top-right" />
          <RouterProvider router={router} />
        </MantineProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

// Start telemetry first so the initial API calls are traced; render regardless.
initTelemetry().finally(render)
