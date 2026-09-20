import { test, expect } from '@playwright/test'

function pdf(text) {
  const stream = `BT /F1 12 Tf 40 750 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let content = '%PDF-1.4\n', offsets = [0]
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n` }
  const start = Buffer.byteLength(content)
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${start}\n%%EOF`
  return Buffer.from(content)
}
async function mount(page) {
  await page.goto('/tests/fixtures/document-component.html')
  await page.evaluate(async () => {
    const { mountDocumentImport } = await import('/src/document-import.js')
    const { createStorage } = await import('/src/storage.js')
    const storage = createStorage(() => localStorage); storage.read()
    let state = { schemaVersion: 1, tasks: [] }
    const main = document.createElement('main'); document.body.replaceChildren(main)
    mountDocumentImport(main, { getState: () => state, onCommit: candidate => { const { tasks, sessions, planner, ...extra } = candidate; const result = storage.write(tasks, sessions, planner, extra); if (result.ok) state = candidate; return result }, onCancel: () => {} })
  })
}

test('real local PDF worker extracts preview and saves an unassigned task', async ({ page }) => {
  const requests = []; page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) requests.push(request.url()) })
  await mount(page)
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'privat-test.pdf', mimeType: 'application/pdf', buffer: pdf('Innlevering 1 frist 2026-09-16 kl. 14:00') })
  await page.getByRole('button', { name: 'Lag forhåndsvisning' }).click()
  await page.waitForFunction(() => document.querySelector('.document-preview') || document.querySelector('[role=alert]')?.textContent, undefined, { timeout: 35000 })
  await expect(page.getByRole('heading', { name: 'Kontroller planen før import' })).toBeVisible({ timeout: 35000 })
  await expect(page.locator('blockquote')).toContainText('Side 1')
  await page.getByRole('button', { name: 'Bekreft valgt plan' }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('studieplanlegger:v1')))
  expect(state.tasks[0]).toMatchObject({ deadlineLocal: '2026-09-16T14:00', course: '', remainingMinutes: null })
  expect(state.importSources[0]).toMatchObject({ format: 'pdf', revision: 1 })
  expect(JSON.stringify(state)).not.toContain('%PDF')
  expect(requests).toEqual([])
})

test('missing year needs explicit omission and untrusted text stays inert on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mount(page)
  await page.getByLabel('Eller lim inn tekst').fill('Innlevering <img src=x onerror=alert(1)> frist 16.09')
  await page.getByRole('button', { name: 'Lag forhåndsvisning' }).click()
  await expect(page.getByRole('heading', { name: 'Kontroller planen før import' })).toBeVisible()
  await page.getByRole('button', { name: 'Bekreft valgt plan' }).click()
  await expect(page.getByRole('alert')).toContainText('Ingen del av planen er lagret')
  await page.getByLabel('Frist', { exact: true }).selectOption('none')
  await expect(page.locator('img')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Bekreft valgt plan' }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
})

test('saved source can be reopened and updated in the same mounted importer', async ({ page }) => {
  await mount(page)
  const file = page.getByLabel('Velg fil', { exact: true })
  await file.setInputFiles({ name: 'plan.csv', mimeType: 'text/csv', buffer: Buffer.from('id;tittel;minutter\na;Les første utkast;30') })
  await page.getByRole('button', { name: 'Lag forhåndsvisning' }).click()
  await page.getByRole('button', { name: 'Bekreft valgt plan' }).click()
  await page.getByRole('button', { name: 'Tilbake til Mine emner' }).click()
  const source = page.getByLabel('Ny kilde eller oppdatering', { exact: true })
  await expect(page.getByRole('heading', { name: 'Importer dokument eller tekst' })).toBeVisible()
  await expect(source).not.toHaveValue('')
  await file.setInputFiles({ name: 'plan.csv', mimeType: 'text/csv', buffer: Buffer.from('id;tittel;minutter\na;Les revidert utkast;45') })
  await page.getByRole('button', { name: 'Lag forhåndsvisning' }).click()
  await page.getByRole('button', { name: 'Bekreft valgt plan' }).click()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('studieplanlegger:v1')))
  expect(state.tasks).toHaveLength(1)
  expect(state.tasks[0]).toMatchObject({ title: 'Les revidert utkast', remainingMinutes: 45 })
  expect(state.importSources).toHaveLength(1)
  expect(state.importSources[0].revision).toBe(2)
})

test('row rebuild preserves unfinished native number input and keyboard focus', async ({ page }) => {
  await page.goto('/tests/fixtures/document-component.html')
  await page.evaluate(async () => {
    const { parseDocumentCsv } = await import('/src/document-parsers.js')
    const { createDocumentImportPreview, buildDocumentImportCommit } = await import('/src/import-preview.js')
    const { renderDocumentImportPreview } = await import('/src/document-import.js')
    const empty = { schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } }
    const firstParsed = { ...parseDocumentCsv('id;tittel;minutter\na;Les kapitlet;45'), contentHash: 'a'.repeat(64) }
    const first = buildDocumentImportCommit(empty, createDocumentImportPreview(empty, firstParsed))
    window.documentState = first.state
    const revised = { ...parseDocumentCsv('id;tittel;minutter\nb;Les kapitlet;45'), contentHash: 'b'.repeat(64) }
    const preview = createDocumentImportPreview(window.documentState, revised, { sourceId: first.source.id })
    const entry = first.source.entries[0]
    preview.rows[0].matchCandidates = [{ key: entry.key, kind: entry.kind, targetId: entry.targetId, title: entry.sourceBase.title }]
    preview.rows[0].matchChoice = '?'
    renderDocumentImportPreview(document.body, preview, { getState: () => window.documentState, onConfirm: () => ({ ok: true }), onBack: () => {} })
  })
  const remaining = page.getByLabel('Gjenstående minutter (tomt = vet ikke)', { exact: true })
  await remaining.fill(''); await remaining.press('e')
  expect(await remaining.evaluate(input => input.validity.badInput)).toBe(true)
  const match = page.getByLabel('Koble til tidligere oppføring', { exact: true })
  await match.focus(); await match.selectOption('new')
  await expect(page.getByLabel('Koble til tidligere oppføring', { exact: true })).toBeFocused()
  expect(await remaining.evaluate(input => input.isConnected && input.validity.badInput)).toBe(true)
  await page.getByRole('button', { name: 'Bekreft valgt plan' }).click()
  await expect(remaining).toBeFocused()
  await expect(remaining).toHaveAttribute('aria-invalid', 'true')
})
