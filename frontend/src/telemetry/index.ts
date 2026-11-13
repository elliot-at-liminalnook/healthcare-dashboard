import { errorAttributes, logger, setLogSink } from './logger.ts'

declare global {
  interface Window {
    /** Runtime configuration, set by /config.js before the app loads. */
    __APP_CONFIG__?: { telemetryEnabled?: boolean }
  }
}

function telemetryEnabled(): boolean {
  return (
    window.__APP_CONFIG__?.telemetryEnabled === true ||
    import.meta.env.VITE_TELEMETRY_ENABLED === 'true'
  )
}

/** Log errors nothing else caught, so they are never silently lost. */
function logUnhandledErrors(): void {
  window.addEventListener('error', (event) => {
    logger.error('Uncaught error', errorAttributes(event.error ?? event.message))
  })
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', errorAttributes(event.reason))
  })
}

/** Set up logging, and start OpenTelemetry export when it is enabled. */
export async function initTelemetry(): Promise<void> {
  logUnhandledErrors()
  if (!telemetryEnabled()) return

  const { startOtel } = await import('./otel.ts')
  setLogSink(startOtel())
}
