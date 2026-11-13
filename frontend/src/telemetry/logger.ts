/**
 * Application logger. Every message goes to the browser console; when
 * telemetry is enabled it is also exported through OpenTelemetry, tagged with
 * the active trace so it lines up with the backend's logs for the same request.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogAttributes = Record<string, string | number | boolean | undefined>
export type LogSink = (level: LogLevel, message: string, attributes: LogAttributes) => void

let sink: LogSink | undefined

/** Called once telemetry has started, to forward logs to the exporter. */
export function setLogSink(next: LogSink): void {
  sink = next
}

function log(level: LogLevel, message: string, attributes: LogAttributes = {}): void {
  console[level](message, attributes)
  sink?.(level, message, attributes)
}

/** Describe a thrown value using OpenTelemetry's exception attribute names. */
export function errorAttributes(error: unknown): LogAttributes {
  if (error instanceof Error) {
    return {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    }
  }
  return { 'exception.message': String(error) }
}

export const logger = {
  debug: (message: string, attributes?: LogAttributes) => log('debug', message, attributes),
  info: (message: string, attributes?: LogAttributes) => log('info', message, attributes),
  warn: (message: string, attributes?: LogAttributes) => log('warn', message, attributes),
  error: (message: string, attributes?: LogAttributes) => log('error', message, attributes),
}
