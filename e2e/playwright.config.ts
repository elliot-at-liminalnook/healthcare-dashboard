import { defineConfig } from '@playwright/test'

// End-to-end specs run against the stack started by `docker compose up`.
export default defineConfig({
  testDir: './specs',
  outputDir: process.env.RESULTS_DIR ?? './test-results',
  workers: 1,
  timeout: 180_000,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    viewport: { width: 1200, height: 750 },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  },
})
