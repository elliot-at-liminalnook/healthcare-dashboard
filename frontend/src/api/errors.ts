import type { HTTPValidationError } from './generated/model'
import { ApiError, NetworkError } from './http.ts'

function isValidationBody(body: unknown): body is Required<HTTPValidationError> {
  return typeof body === 'object' && body !== null && Array.isArray((body as any).detail)
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Turn the API's validation response (422) into one message per form field.
 * The API reports each problem at `["body", <field>, ...]`; problems that are
 * not about a single field are returned under the empty key.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 422 || !isValidationBody(error.body)) {
    return {}
  }
  const errors: Record<string, string> = {}
  for (const { loc, msg } of error.body.detail) {
    const field = loc[0] === 'body' && typeof loc[1] === 'string' ? loc[1] : ''
    // Keep the first message for each field.
    errors[field] ??= capitalise(msg)
  }
  return errors
}

/** A sentence a person can act on, for errors that are not about a form field. */
export function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (error instanceof ApiError) {
    if (error.status === 404) return 'This record no longer exists. It may have been deleted.'
    if (error.status === 409) {
      return 'This record was changed in another session while you were editing. Review the changes shown here, then save again.'
    }
    if (error.status === 422) return fieldErrors(error)[''] ?? 'Some fields need attention.'
    if (error.status >= 500) return 'The server ran into a problem. Please try again shortly.'
  }
  return 'Something went wrong. Please try again.'
}
