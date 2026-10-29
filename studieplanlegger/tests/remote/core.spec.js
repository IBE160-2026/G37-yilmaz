import { test, expect } from '@playwright/test'
import { observe, browserMode } from './diagnostics.js'
import { freeze, navigate, openImportMethod, reveal, saved } from '../e2e/helpers.js'

// Same invented one-page PDF structure as connected-document.spec.js; no source
// attachment or personal document is uploaded during this deployed-worker check.
function syntheticPdf() {
  const stream = 'BT /F1 12 Tf 40 750 Td (Innlevering 1 frist 2026-09-16 kl. 14:00) Tj ET'
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let content = '%PDF-1.4\n'
  const offsets = []
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n` }
  const start = Buffer.byteLength(content)
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${start}\n%%EOF`
  return Buffer.from(content)
}

function securityHeaders(response, { api = false } = {}) {
  const headers = response.headers()
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['x-content-type-options']).toBe('nosniff')
  if (api) expect(headers['cache-control']).toContain('no-store')
}

// Reuse the existing browser contract, including title-only onboarding,
// reviewed plans, busy periods, outcomes, exact undo, file imports and backups.
// These suites use no /src module imports and work against a built deployment.
import '../e2e/connected-root-acceptance.spec.js'
import '../e2e/simple-planning-flow.spec.js'
import '../e2e/connected-delivery-acceptance.spec.js'
import '../e2e/himolde-program-repeat.spec.js'

const observations = new WeakMap()
test.beforeEach(async ({ page }) => { observations.set(page, observe(page)) })
test.afterEach(async ({ page }, info) => { await observations.get(page).finish(info) })

test('remote direct entry and built assets load with browser storage', async ({ page, request }) => {
  for (const entry of ['/', '/index.html', '/synthetic-direct-entry']) {
    const response = await page.goto(entry)
    expect(response.status()).toBe(200)
    securityHeaders(response)
    await browserMode(page)
    await expect(page.locator('#storage-location')).toHaveText('Lagret i denne nettleseren')
    const scripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src))
    expect(scripts.length).toBeGreaterThan(0)
    for (const script of scripts) {
      const asset = await request.get(script)
      expect(asset.ok(), new URL(script).pathname).toBe(true)
      expect(asset.headers()['content-type']).toMatch(/javascript/)
      securityHeaders(asset)
    }
    await page.reload()
    await browserMode(page)
  }
})

test('hosted API routes return JSON and expose no shared state', async ({ request }) => {
  for (const path of ['/api', '/api/unknown-remote-acceptance', '/api/state', '/api/state/recovery', '/api/backup']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    expect(response.headers()['content-type'], path).toContain('application/json')
    securityHeaders(response, { api: true })
    expect(await response.json()).toHaveProperty('error')
  }
  const rejected = await request.post('/api/import/calendar', { data: { url: 'https://synthetic.example.test/calendar.ics' } })
  expect(rejected.status()).toBeGreaterThanOrEqual(400)
  expect(rejected.headers()['content-type']).toContain('application/json')
  securityHeaders(rejected, { api: true })
  expect(await rejected.json()).toHaveProperty('error')
  const unsupported = await request.delete('/api/import/calendar')
  expect(unsupported.status()).toBe(405)
  expect(unsupported.headers()['content-type']).toContain('application/json')
  securityHeaders(unsupported, { api: true })
})

test('synthetic PDF uses the deployed worker and commits only after confirmation', async ({ page }) => {
  await freeze(page, '2026-09-09T09:00:00+02:00')
  await page.goto('/')
  await browserMode(page)
  await navigate(page, 'subjects')
  await openImportMethod(page, 'document')
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-acceptance.pdf', mimeType: 'application/pdf', buffer: syntheticPdf() })
  const before = await saved(page)
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  await expect(page.getByRole('heading', { name: 'Dette fant jeg' })).toBeVisible({ timeout: 35000 })
  await expect(page.locator('blockquote')).toContainText('Side 1')
  expect(await saved(page)).toEqual(before)
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const state = await saved(page)
  expect(state.tasks).toHaveLength(1)
  expect(state.tasks[0]).toMatchObject({ deadlineLocal: '2026-09-16T14:00', remainingMinutes: null })
  expect(state.importSources[0]).toMatchObject({ format: 'pdf', revision: 1 })
  expect(JSON.stringify(state)).not.toContain('%PDF')
  await page.reload()
  expect(await saved(page)).toEqual(state)
})
