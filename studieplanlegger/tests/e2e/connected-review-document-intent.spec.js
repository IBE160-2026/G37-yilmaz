import { test, expect } from '@playwright/test'
import { freeze, navigate, key } from './helpers.js'

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
const calendar = (body, method = '') => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...(method ? [`METHOD:${method}`] : []), 'BEGIN:VTODO', 'UID:intent-task', 'SUMMARY:Skriv rapport', 'DUE:20260921T120000Z', ...body, 'END:VTODO', 'END:VCALENDAR'].join('\r\n')

async function boot(page, { width = 1440, size = 16 } = {}) {
  await page.route('**/*', route => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await page.setViewportSize({ width, height: 900 })
  await freeze(page, '2026-09-19T09:00:00+02:00')
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [] })), key)
  await page.reload()
  await page.addStyleTag({ content: `html { font-size: ${size}px !important; }` })
}

async function open(page, text, filename, sourceId) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra dokument eller tekst', exact: true }).click()
  if (sourceId) {
    await page.getByLabel('Ny kilde eller oppdatering', { exact: true }).selectOption(sourceId)
    await expect(page.locator('.document-source-evidence')).toContainText('Kilden var ufullstendig')
  }
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: filename, mimeType: filename.endsWith('.ics') ? 'text/calendar' : 'text/plain', buffer: Buffer.from(text) })
  await page.getByRole('button', { name: 'Lag forhåndsvisning', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Kontroller planen før import', exact: true })).toBeVisible()
}

async function confirm(page) {
  await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
}

async function capture(page, info, filename) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.locator('.document-preview').screenshot({ path: info.outputPath(filename) })
}

test('R13 Norwegian words create the selected activity and task without substring imports', async ({ page }, info) => {
  await boot(page)
  const text = 'Øving 2026-09-21 kl. 12:00–14:00\nØv programmering\nPrøving\nøvingstime\nreadø'
  await open(page, text, 'norske-ord.txt')
  const rows = page.locator('.document-preview-row')
  await expect(rows.nth(0).getByLabel('Type oppføring', { exact: true })).toHaveValue('event')
  await expect(rows.nth(0).getByLabel('Start i norsk tid', { exact: true })).toHaveValue('2026-09-21T12:00')
  await expect(rows.nth(0).getByLabel('Slutt i norsk tid', { exact: true })).toHaveValue('2026-09-21T14:00')
  await expect(rows.nth(1).getByLabel('Type oppføring', { exact: true })).toHaveValue('task')
  for (const index of [0, 1]) await expect(rows.nth(index).getByLabel('Ta med i planen', { exact: true })).toBeChecked()
  for (const index of [2, 3, 4]) await expect(rows.nth(index).getByLabel('Ta med i planen', { exact: true })).not.toBeChecked()
  await capture(page, info, 'r13-norwegian-desktop.png')
  await confirm(page)
  const saved = await stored(page)
  expect(saved.tasks).toHaveLength(1)
  expect(saved.tasks[0]).toMatchObject({ title: 'Øv programmering', deadlineLocal: '', remainingMinutes: null })
  expect(saved.planner.events).toHaveLength(1)
  expect(saved.planner.events[0]).toMatchObject({ start: '2026-09-21T10:00:00Z', end: '2026-09-21T12:00:00Z' })
  await page.reload()
  await open(page, text, 'norske-ord.txt')
  await confirm(page)
  expect((await stored(page)).tasks).toEqual(saved.tasks)
  expect((await stored(page)).planner.events).toEqual(saved.planner.events)
})

test('R13 RDATE remains unselected and visibly incomplete; explicit concrete task and evidence survive reload and backup', async ({ page }, info) => {
  await boot(page, { width: 390, size: 24 })
  const text = calendar(['RDATE:20260928T120000Z,20261005T120000Z'])
  await open(page, text, 'gjentakelse.ics')
  await expect(page.locator('.document-preview')).toContainText('Kilden er ufullstendig')
  await expect(page.locator('.document-preview')).toContainText('Avklar én konkret oppgave')
  await expect(page.locator('.document-preview-row blockquote')).toContainText('Gjentakelse: RDATE')
  await expect(page.getByLabel('Ta med i planen', { exact: true })).not.toBeChecked()
  expect((await stored(page)).tasks).toHaveLength(0)
  await capture(page, info, 'r13-rdate-mobile-24px.png')
  await page.getByLabel('Ta med i planen', { exact: true }).check()
  await page.getByLabel('Navn', { exact: true }).fill('Skriv rapport – bare 21. september')
  await confirm(page)
  const saved = await stored(page), sourceId = saved.importSources[0].id
  expect(saved.tasks).toHaveLength(1)
  expect(saved.tasks[0]).toMatchObject({ title: 'Skriv rapport – bare 21. september', deadlineLocal: '2026-09-21T14:00' })
  expect(saved.importSources[0].complete).toBe(false)
  expect(saved.importSources[0].warnings.join(' ')).toContain('Gjentakende gjøremål')
  await page.reload()
  const backup = await page.evaluate(async key => {
    const { exportBackup, previewBackup } = await import('/src/backup.js')
    return previewBackup(JSON.stringify(exportBackup(JSON.parse(localStorage.getItem(key)))), { schemaVersion: 1, tasks: [] })
  }, key)
  expect(backup.ok).toBe(true)
  expect(backup.data.importSources[0]).toMatchObject({ complete: false, warnings: saved.importSources[0].warnings })
  await open(page, text, 'gjentakelse.ics', sourceId)
  await expect(page.getByLabel('Ta med i planen', { exact: true })).not.toBeChecked()
  await page.getByLabel('Ta med i planen', { exact: true }).check()
  await confirm(page)
  expect((await stored(page)).tasks).toEqual(saved.tasks)
})

for (const [status, width, size] of [['', 1440, 16], ['NEEDS-ACTION', 390, 24]]) {
  test(`R13 METHOD:CANCEL requires an explicit status choice with ${status || 'no component status'}`, async ({ page }, info) => {
    await boot(page, { width, size })
    const text = calendar([...(status ? [`STATUS:${status}`] : []), `DESCRIPTION:${'Beskrivelse '.repeat(80)}`], 'CANCEL')
    await open(page, text, 'avlysning.ics')
    const row = page.locator('.document-preview-row')
    await expect(row.locator('blockquote')).toContainText('METHOD:CANCEL (avlyst)')
    if (status) await expect(row.locator('blockquote')).toContainText(`Status: ${status}`)
    await expect(page.getByLabel('Ta med i planen', { exact: true })).not.toBeChecked()
    await expect(page.getByLabel('Avklar oppgavestatus', { exact: true })).toHaveValue('?')
    const before = await stored(page)
    await page.getByLabel('Ta med i planen', { exact: true }).check()
    await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
    await expect(page.getByLabel('Avklar oppgavestatus', { exact: true })).toBeFocused()
    await expect(page.locator('.document-preview [role=alert]').first()).toContainText('Velg uttrykkelig')
    expect(await stored(page)).toEqual(before)
    await capture(page, info, `r13-cancel-${width}px.png`)
    await page.getByLabel('Avklar oppgavestatus', { exact: true }).selectOption('open')
    await confirm(page)
    const saved = await stored(page)
    expect(saved.tasks).toHaveLength(1)
    expect(saved.tasks[0]).toMatchObject({ completed: false, submitted: false })
    expect(saved.importSources[0].complete).toBe(false)
    expect(saved.importSources[0].warnings.join(' ')).toContain('METHOD:CANCEL')
    expect(saved.importSources[0].entries[0].snippet).toContain('METHOD:CANCEL')
    await page.reload()
    expect((await stored(page)).tasks).toEqual(saved.tasks)
    expect((await stored(page)).importSources).toEqual(saved.importSources)
  })
}
