import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/http.ts'
import { errorAttributes, logger } from '../telemetry/logger.ts'

function apiErrorAttributes(error: unknown) {
  return {
    ...errorAttributes(error),
    'http.response.status_code': error instanceof ApiError ? error.status : undefined,
  }
}

/** One place where every failed API read or write is logged. */
export const queryClient = new QueryClient({
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
