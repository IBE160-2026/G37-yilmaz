import { test, expect } from '@playwright/test'
import { emptyPlanner, validateCourse } from '../../src/planner.js'
import { freeze, navigate, key } from './helpers.js'

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
async function boot(page, state) {
  await freeze(page, '2026-09-09T09:00:00+02:00')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload()
}
async function open(page, text, { filename = 'kontroll.csv', sourceId } = {}) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra dokument eller tekst', exact: true }).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: filename, mimeType: filename.endsWith('.ics') ? 'text/calendar' : filename.endsWith('.txt') ? 'text/plain' : 'text/csv', buffer: Buffer.from(text) })
  if (sourceId) await page.getByLabel('Ny kilde eller oppdatering', { exact: true }).selectOption(sourceId)
  await page.getByRole('button', { name: 'Lag forhåndsvisning', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Kontroller planen før import', exact: true })).toBeVisible()
}
async function confirm(page) {
  await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
}

test('R2 mapped course stays a reference through actual repeat and revised document imports', async ({ page }) => {
  const manual = validateCourse({ id: 'manual', code: 'MAN100', name: 'Mitt lokalt redigerte emne', university: 'Eget lærested', year: 2026, semester: 'autumn', credits: 5, notes: 'Mine notater' })
  await boot(page, { schemaVersion: 1, tasks: [], planner: { ...emptyPlanner(), courses: [manual] } })
  const text = 'id;type;tittel;emne;år;semester\nc;emne;Navnet fra dokumentet;DOC100;2026;høst'
  await open(page, text)
  await page.getByLabel('Eksisterende eller nytt emne', { exact: true }).selectOption(manual.id)
  await confirm(page)
  const first = await stored(page), sourceId = first.importSources[0].id
  expect(first.planner.courses).toEqual([manual])
  expect(first.importSources[0].entries[0]).toMatchObject({ targetId: manual.id, reference: true })
  await page.reload(); await open(page, text)
  await expect(page.getByLabel('Eksisterende eller nytt emne', { exact: true })).toHaveValue(manual.id)
  await confirm(page)
  expect((await stored(page)).planner.courses).toEqual([manual])
  await page.reload(); await open(page, text.replace('Navnet fra dokumentet', 'Nytt kildenavn'), { sourceId })
  await confirm(page)
  expect((await stored(page)).planner.courses).toEqual([manual])
  await page.reload()
  expect((await stored(page)).planner.courses).toEqual([manual])
})

test('R2 corrected entry type survives exact repeat; a revised cross-kind update requires explicit atomic replacement', async ({ page }) => {
  await boot(page, { schemaVersion: 1, tasks: [] })
  const text = 'id;type;tittel;start;slutt\ne;undervisning;Korriger denne aktiviteten;2026-09-16T10:00;2026-09-16T11:00'
  await open(page, text)
  await page.getByLabel('Type oppføring', { exact: true }).selectOption('task')
  await confirm(page)
  const first = await stored(page), id = first.tasks[0].id, sourceId = first.importSources[0].id
  expect(first.planner.events).toHaveLength(0)
  await page.reload(); await open(page, text)
  await expect(page.getByLabel('Type oppføring', { exact: true })).toHaveValue('task')
  await confirm(page)
  expect((await stored(page)).tasks).toEqual(first.tasks)
  await page.reload(); await open(page, text.replace('Korriger denne aktiviteten', 'Revidert aktivitet'), { sourceId })
  await expect(page.getByLabel('Type oppføring', { exact: true })).toHaveValue('event')
  const before = await stored(page)
  await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
  await expect(page.locator('.document-preview [role=alert]')).toContainText('Typen er endret')
  expect(await stored(page)).toEqual(before)
  await page.getByLabel('Avklar endret type', { exact: true }).selectOption('replace')
  await confirm(page)
  const after = await stored(page)
  expect(after.tasks).toHaveLength(0)
  expect(after.planner.events).toHaveLength(1)
  expect(after.planner.events[0]).toMatchObject({ id, title: 'Revidert aktivitet' })
  expect(after.importSources[0].entries).toHaveLength(1)
  expect(after.importSources[0].entries[0]).toMatchObject({ kind: 'event', targetId: id })
  await page.reload(); expect((await stored(page)).planner.events).toEqual(after.planner.events)
})

test('R2 completed and cancelled VTODO status is visible, omitted by default and explicitly clarified before creating open work', async ({ page }) => {
  await boot(page, { schemaVersion: 1, tasks: [] })
  for (const status of ['COMPLETED', 'CANCELLED']) {
    const text = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:todo-${status}\r\nSUMMARY:Oppgave ${status}\r\nSTATUS:${status}\r\nDUE:20260916T120000Z\r\nEND:VTODO\r\nEND:VCALENDAR`
    await open(page, text, { filename: 'status.ics' })
    await expect(page.locator('.document-preview')).toContainText(`Oppgavestatus i kilden: Status: ${status}`)
    const include = page.getByLabel('Ta med i planen', { exact: true })
    await expect(include).not.toBeChecked()
    const before = await stored(page)
    await include.check()
    await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
    await expect(page.locator('.document-preview [role=alert]')).toContainText('Velg uttrykkelig')
    expect(await stored(page)).toEqual(before)
    await page.getByLabel('Avklar oppgavestatus', { exact: true }).selectOption('open')
    await confirm(page)
    const after = await stored(page)
    expect(after.tasks.find(task => task.title === `Oppgave ${status}`)).toMatchObject({ completed: false, submitted: false, deadlineLocal: '2026-09-16T14:00' })
    await page.reload()
  }
})

test('R2 text time ranges and full ISO offsets remain precise while unsupported zones require clarification', async ({ page }) => {
  await boot(page, { schemaVersion: 1, tasks: [] })
  await open(page, 'Seminar 2026-09-20 kl. 12:00-13:00\nInnlevering med forskyvning frist 2026-09-20T12:00+00:00\nInnlevering med sone frist 20.09.2026 12:00 UTC', { filename: 'tidsavklaring.txt' })
  const rows = page.locator('.document-preview-row')
  await expect(rows.nth(0).getByLabel('Start i norsk tid', { exact: true })).toHaveValue('2026-09-20T12:00')
  await expect(rows.nth(0).getByLabel('Slutt i norsk tid', { exact: true })).toHaveValue('2026-09-20T13:00')
  await expect(rows.nth(1).getByLabel('Dato og klokkeslett i norsk tid', { exact: true })).toHaveValue('2026-09-20T14:00')
  await expect(rows.nth(2).getByLabel('Frist', { exact: true })).toHaveValue('?')
  await expect(rows.nth(2).locator('blockquote')).toContainText('UTC')
  const before = await stored(page)
  await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
  await expect(page.locator('.document-preview [role=alert]')).toContainText('Avklar dato og klokkeslett')
  expect(await stored(page)).toEqual(before)
  await rows.nth(2).getByLabel('Frist', { exact: true }).selectOption('none')
  await confirm(page)
  const after = await stored(page)
  expect(after.planner.events[0]).toMatchObject({ start: '2026-09-20T10:00:00Z', end: '2026-09-20T11:00:00Z' })
  expect(after.tasks.map(task => task.deadlineLocal)).toEqual(['2026-09-20T14:00', ''])
})
