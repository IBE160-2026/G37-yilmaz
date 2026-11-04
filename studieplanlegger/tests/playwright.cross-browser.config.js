import { defineConfig } from '@playwright/test'
import { isAbsolute } from 'node:path'

const baseURL = process.env.AJOUR_BUILT_URL || ''
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL) || !isAbsolute(process.env.AJOUR_BUILT_RESULTS || '')) {
  throw new Error('Use the isolated cross-browser runner.')
}

// Deliberately bounded smoke coverage; the full deterministic suite remains
// Chromium-only. These checks do not claim equivalent coverage of all engines.
export default defineConfig({
  testDir: './cross-browser',
  testMatch: 'core-smoke.spec.js',
  outputDir: process.env.AJOUR_BUILT_RESULTS,
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  use: { baseURL, timezoneId: 'Europe/Oslo', trace: 'retain-on-failure' },
  projects: [
    { name: 'firefox-smoke', use: { browserName: 'firefox' } },
    { name: 'webkit-smoke', use: { browserName: 'webkit' } },
  ],
})
