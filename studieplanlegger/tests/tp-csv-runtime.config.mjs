import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

// Invoked only by the owned-resource runner, never against a default service.
if (!process.env.TP_CSV_RUNTIME_URL || !process.env.TP_CSV_EVIDENCE_DIR) throw new Error('Use node tests/run-tp-csv-persistence.mjs node|docker|both.')
export default defineConfig({
  testDir: resolve('tests/e2e'), testMatch: ['tp-csv-main-flow.spec.js', 'import-clarity.spec.js', 'calendar-corrections-decisions.spec.js', 'calendar-corrections-ui.spec.js', 'calendar-corrections-ics.spec.js', 'calendar-corrections-backup.spec.js', 'import-calendar-closure-*.spec.js'],
  fullyParallel: false, workers: 1, timeout: 120000,
  outputDir: resolve(process.env.TP_CSV_EVIDENCE_DIR, 'test-results'),
  reporter: [['list'], ...(process.env.TP_CSV_REPORT_FILE ? [['json', { outputFile: process.env.TP_CSV_REPORT_FILE }]] : [])],
  use: { baseURL: process.env.TP_CSV_RUNTIME_URL, browserName: 'chromium', timezoneId: 'Europe/Oslo', trace: 'off' },
})
