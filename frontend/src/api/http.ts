import { SpanStatusCode, trace } from '@opentelemetry/api'
import { logger } from '../telemetry/logger.ts'

/** Base path the API is served under (proxied to the backend by Vite and nginx). */
const API_BASE_URL = '/api'

// A no-op unless telemetry is enabled, in which case each API call gets a span.
const tracer = trace.getTracer('healthcare-frontend')
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Identifies the trace an API call belongs to, so its logs can be found with the backend's. */
export interface TraceIds {
  trace_id?: string
  span_id?: string
}

/** A non-2xx response from the API, carrying the status and parsed body. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly trace: TraceIds

  constructor(status: number, body: unknown, traceIds: TraceIds = {}) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.trace = traceIds
  }
}

/** The request never got a response: offline, DNS failure, server unreachable. */
export class NetworkError extends Error {
  readonly trace: TraceIds

  constructor(cause: unknown, traceIds: TraceIds = {}) {
    super('Could not reach the server', { cause })
    this.name = 'NetworkError'
    this.trace = traceIds
  }
}

function parseBody(text: string): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    // Not JSON, for example an HTML error page from a proxy.
    return text
  }
}

/**
 * The single fetch wrapper every generated API hook goes through.
 * Resolves with the parsed response body, or throws `ApiError` or `NetworkError`.
 *
 * Each call runs inside a span. The request carries that span's trace id to
 * the backend, and the same id is attached to anything logged about the call.
 */
export async function http<T>(url: string, options?: RequestInit): Promise<T> {
  const method = options?.method ?? 'GET'
  const path = url.split('?')[0]

  // Span names should not contain ids, so that calls to one route group together.
  return tracer.startActiveSpan(`${method} ${path.replace(UUID, '{id}')}`, async (span) => {
    const context = span.spanContext()
    const traceIds: TraceIds = trace.isSpanContextValid(context)
      ? { trace_id: context.traceId, span_id: context.spanId }
      : {}
    const started = performance.now()

    try {
      let response: Response
      try {
        response = await fetch(`${API_BASE_URL}${url}`, options)
      } catch (cause) {
        // An aborted request (the component unmounted) is not a network failure.
        if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
        throw new NetworkError(cause, traceIds)
      }

      const body = parseBody(await response.text())
      if (!response.ok) {
        throw new ApiError(response.status, body, traceIds)
      }
      // Record each change a user makes. Reads are not logged; failures are
      // logged where they are handled (see app/queryClient.ts).
      if (method !== 'GET') {
        logger.info('API request', {
          method,
          path,
          status: response.status,
          duration_ms: Math.round(performance.now() - started),
          ...traceIds,
        })
      }
      return body as T
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    } finally {
      span.end()
    }
  })
}
