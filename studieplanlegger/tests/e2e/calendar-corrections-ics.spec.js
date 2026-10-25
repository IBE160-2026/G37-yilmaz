import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { eventBlocksTime } from '../../src/planner.js'
import { navigate, reveal } from './helpers.js'
import { preview, eventRows, openPreviewRow, confirmTpImport, captureTp, runtimeUrl, runtimeScenario, savedTpState } from './tp-csv-helpers.js'

// Independently invented calendar; no private or anonymized source content.
const fileName = 'synthetic-calendar-corrections.ics'
const fixture = (partial = false) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...[
  ['invalid', 'Oppdiktet ugyldig aprildato', 'DTSTART:20430431T071503Z'],
  ['duplicate-uid', 'Oppdiktet flertydig identitet', 'UID:synthetic-correction-utc\r\nSTATUS:cancelled'],
  ['end-duration', 'Oppdiktet dobbel slutt', 'DTSTART:20430501T071503Z\r\nDTEND:20430501T081503Z\r\nDURATION:PT1H'],
  ['until', 'Oppdiktet feil gjentakelsestype', 'DTSTART:20430501T071503Z\r\nRRULE:freq=daily;until=20430503'],
  ['utc', 'Oppdiktet UTC-intervall', 'DTSTART:20430501T071503Z\r\nDTEND:20430501T071507Z\r\nTRANSP:trAnsParent\r\nDESCRIPTION:Syntetisk UTC-kilde med fire sekunder.'],
  ['floating', 'Oppdiktet flytende intervall', 'DTSTART:20430502T091503\r\nDTEND:20430502T091507'],
  ['tzid', 'Oppdiktet tidssoneintervall', 'DTSTART;TZID=Europe/Oslo:20430503T091503\r\nDTEND;TZID=Europe/Oslo:20430503T091507'],
  ['date', 'Oppdiktet heldagsaktivitet', `DTSTART;VALUE=DATE:${partial ? '20430431' : '20430504'}`],
  ['point', 'Oppdiktet punkt uten slutt', 'DTSTART:20430505T071511Z'],
].flatMap(([uid, title, fields]) => ['BEGIN:VEVENT', `UID:synthetic-correction-${uid}`, `SUMMARY:${title}`, fields, 'END:VEVENT']), 'END:VCALENDAR', ''].join('\r\n')

const expectedEvents = [
  { title: 'Oppdiktet UTC-intervall', start: '2043-05-01T07:15:03.000Z', end: '2043-05-01T07:15:07.000Z', allDay: false, point: false },
  { title: 'Oppdiktet flytende intervall', start: '2043-05-02T07:15:03.000Z', end: '2043-05-02T07:15:07.000Z', allDay: false, point: false },
  { title: 'Oppdiktet tidssoneintervall', start: '2043-05-03T07:15:03.000Z', end: '2043-05-03T07:15:07.000Z', allDay: false, point: false },
  { title: 'Oppdiktet heldagsaktivitet', start: '2043-05-03T22:00:00.000Z', end: '2043-05-04T22:00:00.000Z', allDay: true, point: false },
  { title: 'Oppdiktet punkt uten slutt', start: '2043-05-05T07:15:11.000Z', end: '2043-05-05T07:15:11.000Z', allDay: false, point: true },
]

test.use({ trace: 'off' })
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic ICS tests do not contact external sources.' } }))
  await page.goto(runtimeUrl || '/')
})

async function openCalendar(page, sourceId, partial = false) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  if (sourceId) await (await reveal(page.getByLabel('Ny kilde eller oppdatering', { exact: true }))).selectOption(sourceId)
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: fileName, mimeType: 'text/calendar', buffer: Buffer.from(fixture(partial)) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(preview(page)).toBeVisible()
  await expect(eventRows(page)).toHaveCount(partial ? 4 : 5)
  await expect(preview(page).locator(':scope > [role=status]').first()).toContainText('0 må avklares')
  await expect(preview(page).locator('.document-selection-summary')).toContainText(`${partial ? 4 : 5} aktiviteter valgt · 0 aktiviteter utelatt`)
  await expect(preview(page).getByText(`${partial ? 5 : 4} kildeoppføringer er avvist og 0 delvis beholdt.`, { exact: false })).toBeVisible()
  await expect(preview(page).getByText('VEVENT 1 (Oppdiktet ugyldig aprildato) har ugyldig dato eller klokkeslett i DTSTART og er utelatt.', { exact: true })).toBeVisible()
  const details = preview(page).locator('.document-source-details')
  if (!await details.evaluate(element => element.open)) await details.locator(':scope > summary').click()
  await expect(details.getByText('Kalenderkilden:', { exact: false })).toContainText(`9 kildeoppføringer · ${partial ? 4 : 5} beholdt · 0 delvis beholdt · 0 utenfor periode eller uten forekomster · ${partial ? 5 : 4} avvist · 0 avlyst`)
  await expect(details).toContainText('UID')
  await expect(preview(page).getByText('VEVENT 3 (Oppdiktet dobbel slutt) har ugyldig dato eller klokkeslett i DTEND, DURATION og er utelatt.', { exact: true })).toBeVisible()
  await expect(preview(page).getByText('VEVENT 4 (Oppdiktet feil gjentakelsestype) har ugyldig dato eller klokkeslett i RRULE UNTIL og er utelatt.', { exact: true })).toBeVisible()
  await expect(details.getByText('Klokkeslett uten tidssone tolkes som Europe/Oslo.', { exact: true })).toBeVisible()
  return preview(page)
}

function assertCalendar(state, partial = false) {
  expect(state.tasks).toEqual([])
  expect(state.planner.courses).toEqual([])
  expect(state.importSources).toHaveLength(1)
  const source = state.importSources[0]
  expect(source).toMatchObject({ name: fileName, kind: 'document', format: 'ics', complete: false, origin: { kind: 'file' }, accounting: { total: 9, retained: partial ? 4 : 5, rejected: partial ? 5 : 4, filtered: 0, cancelled: 0, occurrences: partial ? 4 : 5 } })
  expect(source.entries).toHaveLength(5)
  expect(source.excludedKeys).toEqual([])
  expect(state.planner.events.map(({ title, start, end, allDay, point }) => ({ title, start, end, allDay: Boolean(allDay), point: Boolean(point) }))).toEqual(expectedEvents)
  expect(new Set(state.planner.events.map(event => event.id)).size).toBe(5)
  expect(state.planner.events.filter(eventBlocksTime)).toHaveLength(3)
  expect(state.planner.events.find(event => event.title === 'Oppdiktet UTC-intervall').transparent).toBe(true)
  for (const event of state.planner.events) {
    expect(event).toMatchObject({ importSourceId: source.id, courseId: '' })
    expect(source.entries.find(entry => entry.key === event.importEntryKey)?.targetId).toBe(event.id)
  }
  return source
}

async function repeatCalendar(page, expected) {
  const source = expected.importSources[0]
  await openCalendar(page, source.id, true)
  await expect(preview(page).locator('[data-field^="conflict:"]')).toHaveCount(0)
  await confirmTpImport(page)
  const repeated = await savedTpState(page)
  assertCalendar(repeated, true)
  expect(repeated.planner).toEqual(expected.planner)
  // The rejected all-day replacement leaves four parsed rows. Only the last
  // retained row's source-position label changes; identities and baselines stay.
  const pointId = expected.planner.events.find(event => event.title === 'Oppdiktet punkt uten slutt').id
  expect(repeated.importSources[0].entries).toEqual(source.entries.map(entry => entry.targetId === pointId ? { ...entry, position: 'VEVENT 4' } : entry))
  expect(repeated.importSources[0].excludedKeys).toEqual(source.excludedKeys)
  return repeated
}

test('Calendar corrections ICS: invalid identities and times are counted while partial reimport retains prior events and notes', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'corrections-ics', 'Needs its own isolated database.')
  await openCalendar(page)
  expect((await savedTpState(page))?.planner?.events || []).toEqual([])
  const utc = eventRows(page).filter({ hasText: 'Oppdiktet UTC-intervall' })
  await openPreviewRow(utc)
  await utc.getByText('Vis kildeutdrag', { exact: true }).click()
  await expect(utc.locator('blockquote')).toBeVisible()
  await expect(utc.locator('blockquote')).toContainText('Syntetisk UTC-kilde med fire sekunder.')
  await expect(utc.locator('blockquote')).toContainText('2043-05-01T07:15:03.000Z – 2043-05-01T07:15:07.000Z')
  await captureTp(page, info, 'calendar-corrections-ics-preview.png', { target: preview(page).getByRole('heading', { name: 'Dette fant jeg', exact: true }), align: 'start' })
  await confirmTpImport(page)
  await expect(page.getByText('0 aktiviteter eller oppgaver utelatt av utvalget.', { exact: false })).toContainText('4 avviste og 0 delvis beholdte')
  const initial = await savedTpState(page)
  assertCalendar(initial)
  await page.reload()
  expect(await savedTpState(page)).toEqual(initial)
  await navigate(page, 'subjects')
  await expect(page.locator('#event-list .event-card')).toHaveCount(5)
  for (const event of expectedEvents) await expect(page.locator('#event-list')).toContainText(event.title)
  const retained = initial.planner.events.find(event => event.title === 'Oppdiktet heldagsaktivitet')
  await page.locator(`[data-event-id="${retained.id}"]`).getByRole('button', { name: `Rediger undervisning ${retained.title}`, exact: true }).click()
  const editor = page.locator('#subject-editor')
  await editor.getByLabel('Egne notater', { exact: true }).fill('Oppdiktet notat bevares når kildens erstatning avvises.')
  await editor.getByRole('button', { name: 'Lagre undervisning', exact: true }).click()
  await expect(editor).toBeHidden()
  const edited = await savedTpState(page)
  const repeated = await repeatCalendar(page, edited)
  expect(repeated.planner.events.find(event => event.id === retained.id).notes).toBe('Oppdiktet notat bevares når kildens erstatning avvises.')
  await page.reload()
  expect(await savedTpState(page)).toEqual(repeated)
})

test('Calendar corrections persisted ICS: fresh browser and reimport preserve exact source identities and instants', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'corrections-ics' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime harness only.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected)
  assertCalendar(expected, true)
  expect(expected.planner.events.find(event => event.title === 'Oppdiktet heldagsaktivitet').notes).toBe('Oppdiktet notat bevares når kildens erstatning avvises.')
  await navigate(page, 'subjects')
  await expect(page.locator('#event-list .event-card')).toHaveCount(5)
  const repeated = await repeatCalendar(page, expected)
  await page.reload()
  expect(await savedTpState(page)).toEqual(repeated)
})
