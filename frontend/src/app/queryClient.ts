import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/http.ts'
import { errorAttributes, logger } from '../telemetry/logger.ts'

function apiErrorAttributes(error: unknown) {
  return {
    ...errorAttributes(error),
    'http.response.status_code': error instanceof ApiError ? error.status : undefined,
  }
}

/** The request itself was wrong (4xx), so sending it again cannot succeed. */
function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry network and server failures twice; never retry "not found" or "invalid".
      retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
    },
  },
  // One place where every failed API read or write is logged.
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error('API query failed', {
        ...apiErrorAttributes(error),
        'query.key': JSON.stringify(query.queryKey),
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      logger.error('API mutation failed', apiErrorAttributes(error))
    },
  }),
})
