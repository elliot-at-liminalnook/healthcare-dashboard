import type { z } from 'zod'

/**
 * Client-side validation against the Zod schemas generated from the API's
 * OpenAPI schema (`src/api/generated/zod`). The rules themselves are declared
 * once, in the backend's Pydantic models; this file only words the messages.
 */

/** Say what is wrong in plain language, instead of Zod's developer-facing default. */
function describe(issue: z.core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null ? 'Required' : undefined
    case 'too_small':
      if (issue.origin !== 'string') return undefined
      return issue.minimum === 1 ? 'Required' : `Must be at least ${issue.minimum} characters`
    case 'too_big':
      return issue.origin === 'string'
        ? `Must be ${Number(issue.maximum).toLocaleString()} characters or fewer`
        : undefined
    case 'invalid_format':
      if (issue.format === 'email') return 'Enter a valid email address, like name@example.com'
      if (issue.format === 'date') return 'Enter a valid date'
      return undefined
    case 'invalid_value':
      return 'Choose one of the listed options'
    default:
      return undefined
  }
}

/**
 * Check a value against a schema. Returns one message per top-level field
 * (an empty object when valid), in the shape form libraries expect.
 */
export function validate(schema: z.ZodType, value: unknown): Record<string, string> {
  const result = schema.safeParse(value, { error: describe })
  if (result.success) return {}

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    // Problems inside a list ("allergies.1") are shown on the list's field.
    errors[String(issue.path[0] ?? '')] ??= issue.message
  }
  return errors
}
