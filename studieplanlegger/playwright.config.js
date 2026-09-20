import { defineConfig } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT || '5174'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  testIgnore: '**/database-delivery.spec.js',
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    timezoneId: 'Europe/Oslo',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
})
