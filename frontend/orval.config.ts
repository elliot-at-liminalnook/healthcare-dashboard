import { defineConfig } from 'orval'

// Generates, from the backend's OpenAPI schema:
//   - typed TanStack Query hooks (src/api/generated)
//   - Zod schemas carrying the same validation rules (src/api/generated/zod)
// Regenerate with `make client` from the repository root.
export default defineConfig({
  api: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      prettier: true,
      override: {
        mutator: { path: 'src/api/http.ts', name: 'http' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  validation: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/zod',
      client: 'zod',
      fileExtension: '.zod.ts',
      clean: true,
      prettier: true,
    },
  },
})
