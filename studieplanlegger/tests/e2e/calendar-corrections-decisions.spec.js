import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import ICAL from 'ical.js'
import { calendarUid } from '../../src/calendar-export.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { eventBlocksTime } from '../../src/planner.js'
import { key, navigate, reveal } from './helpers.js'
import { confirmTpImport, eventRows, fixtureRows, openPreviewRow, openTpImport, preview, savedTpState, tpCsvRows, runtimeUrl, runtimeScenario } from './tp-csv-helpers.js'

// Invented fixtures. Runtime mode uses only the runner's new isolated SQLite.
const fileName = 'synthetic-calendar-deletion.csv'
const code = 'SYN864'
const input = () => tpCsvRows(fixtureRows().slice(0, 3).map((row, index) => ({ ...row, courseid: code, 'title-intro': code, eventid: `synthetic-delete-${index}`, dtstart: `2041-11-0${index + 1}T11:00:07+01:00`, dtend: `2041-11-0${index + 1}T11:30:17+01:00`, 'teaching-title_nb': `Oppdiktet sletteøvelse ${index + 1}` })))
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic tests do not contact external sources.' } }))
  await page.goto(runtimeUrl || '/')
})

test('Calendar corrections deletion: provisional course receipt, reload, links and exact undo', async ({ page }) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'corrections-deletion', 'Needs its own isolated database.')
  await openTpImport(page, { text: input(), name: fileName }); await confirmTpImport(page)
  await page.getByRole('button', { name: 'Tilbake til Mine emner', exact: true }).click()
  const imported = await savedTpState(page)
  expect(imported.planner.courses).toHaveLength(1)
  expect(imported.planner.courses[0]).toMatchObject({ code, name: '', nameStatus: 'provisional' })
  await page.getByRole('button', { name: `Ny oppgave i ${code}`, exact: true }).click()
  await page.locator('#title').fill('Oppdiktet oppgave som beholder identiteten')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  await navigate(page, 'subjects')
  const before = await savedTpState(page)
  if (runtimeUrl) {
    const reject = route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, json: { error: 'synthetic-deletion-write-failure' } }) : route.continue()
    await page.route('**/api/state', reject)
    page.once('dialog', dialog => dialog.accept())
    const rejected = page.waitForResponse(response => response.url().endsWith('/api/state') && response.request().method() === 'PUT')
    await page.getByRole('button', { name: `Slett emne ${code}`, exact: true }).click()
    expect((await rejected).status()).toBe(500)
    await expect(page.locator('#subject-message')).toHaveAttribute('role', 'alert')
    expect(await savedTpState(page)).toEqual(before)
    await expect(page.locator('.contextual-undo')).not.toContainText(`Slettet: ${code}`)
    await page.unroute('**/api/state', reject)
    const current = await (await page.request.get(`${runtimeUrl}/api/state`)).json()
    expect((await page.request.put(`${runtimeUrl}/api/state`, { data: { expectedRevision: current.revision, envelope: current.envelope } })).status()).toBe(200)
    page.once('dialog', dialog => dialog.accept())
    const conflict = page.waitForResponse(response => response.url().endsWith('/api/state') && response.request().method() === 'PUT')
    await page.getByRole('button', { name: `Slett emne ${code}`, exact: true }).click()
    expect((await conflict).status()).toBe(409)
    await expect(page.locator('#subject-message')).toHaveAttribute('role', 'alert')
    expect(await savedTpState(page)).toEqual(before)
    await expect(page.locator('.contextual-undo')).not.toContainText(`Slettet: ${code}`)
    await page.reload(); await navigate(page, 'subjects')
  }
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: `Slett emne ${code}`, exact: true }).click()
  await expect(page.locator('.contextual-undo')).toContainText(`Slettet: ${code}`)
  await expect(page.locator('.contextual-undo')).not.toContainText('undefined')
  const deleted = await savedTpState(page)
  expect(deleted.history.undo.at(-1).label).toBe(`Slettet: ${code}`)
  expect(deleted.history.trash.at(-1).label).toBe(`Slettet: ${code}`)
  expect(deleted.planner.courses).toHaveLength(0); expect(deleted.planner.events).toHaveLength(0)
  expect(deleted.tasks[0]).toMatchObject({ id: before.tasks[0].id, course: before.tasks[0].course })
  expect(deleted.tasks[0].courseId).toBeUndefined()
  expect(deleted.importSources).toEqual(before.importSources)
  await page.reload(); expect(await savedTpState(page)).toEqual(deleted)
  await navigate(page, 'settings')
  await (await reveal(page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }))).click()
  const restored = await savedTpState(page)
  expect(restored.planner).toEqual(before.planner); expect(restored.tasks).toEqual(before.tasks); expect(restored.importSources).toEqual(before.importSources)
  await page.reload(); expect(await savedTpState(page)).toEqual(restored)
})

const timeFile = 'synthetic-calendar-time-corrections.csv'
const timingInput = (revision = 'initial') => tpCsvRows([
  { eventid: 'synthetic-time-point', title: 'Oppdiktet vurdering uten klassifisering', dtstart: '2041-11-18T10:00:07Z', dtend: revision === 'initial' ? '' : '2041-11-18T10:30:17Z', activitykind: '', transparent: '' },
  { eventid: 'synthetic-time-correction', title: 'Oppdiktet korrigert intervall', dtstart: '2041-11-18T11:00:07Z', dtend: revision === 'uncertain' ? 'synthetic-invalid-end' : '', activitykind: '', transparent: '' },
  { eventid: 'synthetic-time-omit', title: 'Oppdiktet utelatt tidspunkt', dtstart: '2041-11-18T12:00:07Z', dtend: 'synthetic-invalid-end', activitykind: '', transparent: '' },
  { eventid: 'synthetic-time-transparent', title: 'Oppdiktet ledig egen aktivitet', dtstart: '2041-11-18T13:00:07Z', dtend: '2041-11-18T14:00:17Z', activitykind: 'personal', transparent: 'true' },
  { eventid: 'synthetic-time-busy', title: 'Oppdiktet opptatt intervall', dtstart: '2041-11-18T15:00:07Z', dtend: '2041-11-18T16:00:17Z', activitykind: '', transparent: '' },
])
async function downloadedCalendar(page, state, { point }) {
  await navigate(page, 'calendar')
  const calendar = page.locator('#full-calendar')
  await calendar.getByRole('button', { name: 'Dag', exact: true }).click()
  await calendar.locator('#full-calendar-date').fill('2041-11-18')
  await calendar.locator('#full-calendar-date').press('Tab')
  await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
  await dialog.getByLabel('Undervisning', { exact: true }).check()
  await dialog.getByLabel('Egne aktiviteter', { exact: true }).check()
  await expect(dialog.locator('[data-export-status]')).toHaveText('4 aktiviteter blir eksportert.')
  const pending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Last ned .ics', exact: true }).click()
  const bytes = readFileSync(await (await pending).path(), 'utf8')
  const components = new ICAL.Component(ICAL.parse(bytes)).getAllSubcomponents('vevent')
  expect(components).toHaveLength(4)
  expect(bytes).not.toContain('Oppdiktet utelatt tidspunkt')
  for (const event of state.planner.events) {
    const component = components.find(item => item.getFirstPropertyValue('uid') === calendarUid(event.activityKind === 'personal' ? 'personal' : 'teaching', event.id))
    expect(component, event.title).toBeTruthy()
    expect(component.getFirstPropertyValue('transp')).toBe(eventBlocksTime(event) ? 'OPAQUE' : 'TRANSPARENT')
    if (event.point) expect(component.hasProperty('dtend')).toBe(false)
    else expect(component.getFirstPropertyValue('dtend').toJSDate().getTime()).toBe(Date.parse(event.end))
  }
  const reread = parseDocumentIcs(bytes)
  expect(reread.complete).toBe(true); expect(reread.rows.filter(row => row.kind === 'event')).toHaveLength(4)
  expect(reread.rows.filter(row => row.point)).toHaveLength(point ? 1 : 0)
  expect((await savedTpState(page)).planner).toEqual(state.planner)
  return components.map(item => item.getFirstPropertyValue('uid')).sort()
}

test('Calendar corrections times and export: decisions follow source timing and downloaded capacity', async ({ page }) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'corrections-time-export', 'Needs its own isolated database.')
  await openTpImport(page, { text: timingInput(), name: timeFile })
  await openPreviewRow(eventRows(page).nth(0))
  await eventRows(page).nth(0).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('point')
  await openPreviewRow(eventRows(page).nth(1))
  await eventRows(page).nth(1).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('interval')
  await eventRows(page).nth(1).locator('[data-field=endLocal]').fill('2041-11-18T13:00:17')
  await openPreviewRow(eventRows(page).nth(2))
  await eventRows(page).nth(2).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('omit')
  await confirmTpImport(page)
  const first = await savedTpState(page)
  expect(first.planner.events).toHaveLength(4); expect(first.importSources[0].excludedKeys).toHaveLength(1)
  expect(first.planner.events[0]).toMatchObject({ point: true, pointProvenance: 'user' })
  expect(first.planner.events[1].end).toBe('2041-11-18T12:00:17Z')
  const uids = await downloadedCalendar(page, first, { point: true })
  await page.reload()
  await openTpImport(page, { text: timingInput('valid'), name: timeFile, sourceId: first.importSources[0].id })
  await expect(preview(page).locator('[data-field^="conflict:"]')).toHaveCount(0)
  await confirmTpImport(page)
  const revised = await savedTpState(page)
  expect(revised.planner.events[0]).toMatchObject({ id: first.planner.events[0].id, point: false, end: '2041-11-18T10:30:17Z' })
  expect(revised.planner.events[0].pointProvenance).toBeUndefined()
  expect(revised.planner.events[1]).toEqual(first.planner.events[1])
  expect(await downloadedCalendar(page, revised, { point: false })).toEqual(uids)
  await openTpImport(page, { text: timingInput('uncertain'), name: timeFile, sourceId: first.importSources[0].id })
  await expect(eventRows(page).nth(1).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true })).toHaveValue('?')
  await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
  await expect(preview(page).getByRole('alert')).not.toBeEmpty()
  expect((await savedTpState(page)).planner).toEqual(revised.planner)
  await openPreviewRow(eventRows(page).nth(1))
  await eventRows(page).nth(1).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('interval')
  await eventRows(page).nth(1).locator('[data-field=endLocal]').fill('2041-11-18T13:00:17')
  await confirmTpImport(page)
  expect((await savedTpState(page)).planner).toEqual(revised.planner)
})

test('Calendar corrections persisted time-export: fresh browser and reimport retain exact timing and UIDs', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'corrections-time-export' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime harness only.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected)
  await openTpImport(page, { text: timingInput('uncertain'), name: timeFile, sourceId: expected.importSources[0].id }); await confirmTpImport(page)
  const repeated = await savedTpState(page)
  expect(repeated.planner).toEqual(expected.planner)
  expect(repeated.importSources[0].entries).toEqual(expected.importSources[0].entries)
  await downloadedCalendar(page, repeated, { point: false })
})

test('Calendar corrections persisted deletion: fresh browser preserves restored exact links', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'corrections-deletion' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime harness only.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected)
  await openTpImport(page, { text: input(), name: fileName }); await confirmTpImport(page)
  const repeated = await savedTpState(page)
  expect(repeated.planner).toEqual(expected.planner); expect(repeated.tasks).toEqual(expected.tasks)
  expect(repeated.importSources[0].entries).toEqual(expected.importSources[0].entries)
})

test('Calendar corrections deletion: earlier tombstone never names a later deletion or an unrelated edit', async ({ page }) => {
  test.skip(Boolean(runtimeUrl), 'Legacy imported tombstone fixture is isolated to Vite localStorage.')
  const prior = { schemaVersion: 1, tasks: [], planner: { courses: [{ id: 'synthetic-delete-course', code, name: 'Oppdiktet tavlekunst', university: 'HiMolde', semester: 'autumn', year: 2041, credits: null }], sources: [{ id: 'synthetic-delete-source', courseId: 'synthetic-delete-course', kind: 'file', name: 'Oppdiktet tidligere kalender', lastUpdated: '2041-09-01T08:00:00Z', groups: [] }], events: [{ id: 'synthetic-old-deleted', title: 'Tidligere slettet oppdiktet samling', courseId: 'synthetic-delete-course', sourceId: 'synthetic-delete-source', start: '2041-11-01T10:00:07Z', end: '2041-11-01T10:30:17Z', deleted: true }, { id: 'synthetic-new-delete', title: 'Ny sletting av oppdiktet samling', courseId: 'synthetic-delete-course', sourceId: 'synthetic-delete-source', start: '2041-11-02T10:00:07Z', end: '2041-11-02T10:30:17Z' }] } }
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state: prior })
  await page.reload(); await navigate(page, 'subjects')
  await page.getByRole('button', { name: `Rediger emne ${code}`, exact: true }).click()
  await page.locator('#subject-editor [name=name]').fill('Oppdiktet endret emnenavn')
  await page.getByRole('button', { name: 'Lagre emne', exact: true }).click()
  expect((await savedTpState(page)).history.undo.at(-1).label).toBe('Emner og undervisning')
  const before = await savedTpState(page)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Slett undervisning Ny sletting av oppdiktet samling', exact: true }).click()
  await expect(page.locator('.contextual-undo')).toContainText('Slettet: Ny sletting av oppdiktet samling')
  const deleted = await savedTpState(page)
  expect(deleted.planner.events.every(event => event.deleted)).toBe(true)
  expect(deleted.history.undo.at(-1).label).toBe('Slettet: Ny sletting av oppdiktet samling')
  await page.locator('.contextual-undo').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  expect((await savedTpState(page)).planner).toEqual(before.planner)
})
