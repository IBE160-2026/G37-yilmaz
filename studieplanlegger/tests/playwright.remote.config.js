import { defineConfig } from '@playwright/test'

// Deliberately starts no server. Every request goes to the explicitly selected
// deployment (or an explicitly labelled loopback harness check).
const supplied = process.env.AJOUR_REMOTE_URL
if (!supplied) throw new Error('Set AJOUR_REMOTE_URL to the actual preview or production origin.')
const remote = new URL(supplied)
const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(remote.hostname)
if (remote.username || remote.password || remote.search || remote.hash || remote.pathname !== '/' ||
    (remote.protocol !== 'https:' && !(loopback && remote.protocol === 'http:'))) {
  throw new Error('AJOUR_REMOTE_URL must be an HTTPS origin without credentials, path, query or fragment (HTTP loopback is allowed for harness checks).')
}
const phase = process.env.AJOUR_REMOTE_PHASE || 'create'
if (!['create', 'verify'].includes(phase)) throw new Error('AJOUR_REMOTE_PHASE must be create or verify.')
const runId = new Date().toISOString().replace(/[:.]/g, '-')

export default defineConfig({
  testDir: './remote', workers: 1, fullyParallel: false, retries: 0,
  timeout: 120_000, expect: { timeout: 15_000 },
  // Later live/redeploy runs must not erase the preceding 30 review images.
  outputDir: `../test-results/remote-acceptance/${runId}`,
  reporter: [['list'], ['html', { outputFolder: `playwright-report/remote-acceptance/${runId}`, open: 'never' }]],
  use: {
    baseURL: remote.origin, browserName: 'chromium', timezoneId: 'Europe/Oslo',
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'remote-core', testMatch: 'core.spec.js' },
    { name: 'remote-visual', testMatch: 'visual.spec.js' },
    { name: 'remote-failures', testMatch: 'failures.spec.js' },
    { name: 'remote-live', testMatch: 'live.spec.js', grep: /live HiMolde IT|live public teaching for saved course: himolde|live NTNU course and teaching/ },
    { name: 'remote-persistence', testMatch: 'persistence.spec.js' },
  ],
})
