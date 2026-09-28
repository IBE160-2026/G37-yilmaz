import { defineConfig } from '@playwright/test'

const port = process.env.STUDIEPLAN_DOCKER_TEST_PORT
if (!port) throw new Error('Docker recreation verification requires STUDIEPLAN_DOCKER_TEST_PORT.')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'docker-recreation.spec.js',
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
