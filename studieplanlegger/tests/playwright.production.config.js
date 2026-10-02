import { defineConfig } from '@playwright/test'
import { isAbsolute } from 'node:path'

const port = process.env.STUDIEPLAN_ACCEPTANCE_PORT
if (!/^\d+$/.test(port || '') || Number(port) === 80) throw new Error('Set an owned loopback STUDIEPLAN_ACCEPTANCE_PORT other than 80.')
if (!['create', 'restore'].includes(process.env.STUDIEPLAN_ACCEPTANCE_PHASE || 'create')) throw new Error('Acceptance phase must be create or restore.')
if (!isAbsolute(process.env.STUDIEPLAN_ACCEPTANCE_SNAPSHOT || '')) throw new Error('Set an absolute STUDIEPLAN_ACCEPTANCE_SNAPSHOT shared by both phases.')
export default defineConfig({
  testDir: './production', testMatch: '**/*.spec.js', workers: 1, fullyParallel: false,
  timeout: 120_000, outputDir: process.env.STUDIEPLAN_ACCEPTANCE_OUTPUT || '../test-results/production-acceptance',
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', timezoneId: 'Europe/Oslo', trace: 'retain-on-failure' },
})
