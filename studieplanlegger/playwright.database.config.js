import { defineConfig } from '@playwright/test'

const port = process.env.PLAYWRIGHT_DATABASE_PORT
if (!port || !process.env.STUDIEPLAN_DB) throw new Error('Production database runner must provide an isolated port and STUDIEPLAN_DB.')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'database-delivery.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    timezoneId: 'Europe/Oslo',
    trace: 'retain-on-failure',
  },
})
