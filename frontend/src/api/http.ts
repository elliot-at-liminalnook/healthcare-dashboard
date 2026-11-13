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

/**
 * The single fetch wrapper every generated API hook goes through.
 * Resolves with the parsed response body, or throws `ApiError`.
 */
export async function http<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, options)
  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : undefined

  if (!response.ok) {
    throw new ApiError(response.status, body)
  }
  return body as T
}
