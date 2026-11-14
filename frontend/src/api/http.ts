/** Base path the API is served under (proxied to the backend by Vite and nginx). */
const API_BASE_URL = '/api'

/** A non-2xx response from the API, carrying the status and parsed body. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** The request never got a response: offline, DNS failure, server unreachable. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Could not reach the server', { cause })
    this.name = 'NetworkError'
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
 */
export async function http<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${url}`, options)
  } catch (cause) {
    // An aborted request (the component unmounted) is not a network failure.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new NetworkError(cause)
  }

  const body = parseBody(await response.text())
  if (!response.ok) {
    throw new ApiError(response.status, body)
  }
  return body as T
}
