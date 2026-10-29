import { defineConfig } from '@playwright/test'
import { isAbsolute } from 'node:path'

const baseURL = process.env.AJOUR_BUILT_URL || ''
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL) || !isAbsolute(process.env.AJOUR_BUILT_RESULTS || '')) {
  throw new Error('Use the isolated built-browser runner.')
}

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'connected-root-acceptance.spec.js', 'simple-planning-flow.spec.js',
    'connected-delivery-acceptance.spec.js', 'ajour-theme.spec.js',
    'himolde-program-repeat.spec.js', 'import-reimport-repair.spec.js',
  ],
  outputDir: process.env.AJOUR_BUILT_RESULTS,
  fullyParallel: true, workers: 2, timeout: 60_000,
  use: { baseURL, browserName: 'chromium', timezoneId: 'Europe/Oslo', trace: 'retain-on-failure' },
})
