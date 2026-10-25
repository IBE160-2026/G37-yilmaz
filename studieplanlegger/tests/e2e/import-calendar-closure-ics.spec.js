import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { importMiddleware } from '../../server/import-api.js'
import { eventBlocksTime } from '../../src/planner.js'
import { navigate, openImportMethod, reveal } from './helpers.js'
import { preview, eventRows, confirmTpImport, captureTp, runtimeUrl, runtimeScenario, savedTpState } from './tp-csv-helpers.js'

// Independently invented fixtures: no private originals or calendar structure copied.
const fileName = 'synthetic-closure-recurrences.ics'
const event = (uid, title, ...fields) => ['BEGIN:VEVENT', `UID:synthetic-closure-${uid}`, `SUMMARY:${title}`, ...fields, 'END:VEVENT'].join('\r\n')
const fixture = (revision = false) => ['BEGIN:VCALENDAR', 'VERSION:2.0',
  event('utc', 'Oppdiktet UTC-serie', 'DTSTART:20440208T090000Z', 'DTEND:20440208T100000Z', 'RRULE:FREQ=DAILY;COUNT=3'),
  event('oslo', 'Oppdiktet Oslo-serie', 'DTSTART;TZID=Europe/Oslo:20440212T100000', 'DTEND;TZID=Europe/Oslo:20440212T110000', 'RRULE:FREQ=DAILY;COUNT=2'),
  event('monthly', 'Oppdiktet månedsserie', 'DTSTART:20440101T090000Z', 'DURATION:PT1H', 'RRULE:FREQ=MONTHLY', 'RDATE;VALUE=PERIOD:20441010T090000Z/PT2H', 'RDATE:20441110T090000Z', 'EXDATE:20441110T090000Z'),
  event('duration', 'Oppdiktet lang aktivitet', 'DTSTART:20441220T090000Z', 'DURATION:P12D'),
  ...(revision ? [event('utc', 'Oppdiktet avlysning fra UTC-serie', 'RECURRENCE-ID;TZID=Europe/Oslo:20440209T100000', 'STATUS:CANCELLED'), event('oslo', 'Oppdiktet avlysning fra Oslo-serie', 'RECURRENCE-ID:20440213T090000Z', 'STATUS:CANCELLED')] : []),
  'END:VCALENDAR', ''].join('\r\n')

test.use({ trace: 'off' })
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Only independent synthetic sources are permitted in this test.' } }))
  await page.goto(runtimeUrl || '/')
})

async function openCalendar(page, { sourceId, revision = false } = {}) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  if (sourceId) await (await reveal(page.getByLabel('Ny kilde eller oppdatering', { exact: true }))).selectOption(sourceId)
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: fileName, mimeType: 'text/calendar', buffer: Buffer.from(fixture(revision)) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(preview(page)).toBeVisible()
  await expect(eventRows(page)).toHaveCount(13)
  await expect(preview(page).locator(':scope > [role=status]').first()).toContainText('0 må avklares')
  await expect(preview(page).locator('.document-selection-summary')).toContainText('2045-01-01')
  await expect(preview(page).getByText(/Uttrykkelige ekstra datoer \(RDATE\) beholdes/)).toBeVisible()
}

function assertRecurrences(state, { cancelled = true, notes = true } = {}) {
  expect(state.tasks).toEqual([])
  expect(state.planner.courses).toEqual([])
  expect(state.importSources).toHaveLength(1)
  const source = state.importSources[0], events = state.planner.events
  expect(source).toMatchObject({ name: fileName, format: 'ics', kind: 'document', complete: false, origin: { kind: 'file' } })
  expect(source.entries).toHaveLength(13)
  expect(events).toHaveLength(13)
  expect(new Set(events.map(row => row.id)).size).toBe(13)
  expect(events.filter(eventBlocksTime)).toHaveLength(cancelled ? 11 : 13)
  expect(events.filter(row => row.cancelled).map(row => row.start).sort()).toEqual(cancelled ? ['2044-02-09T09:00:00.000Z', '2044-02-13T09:00:00.000Z'] : [])
  const monthly = events.filter(row => row.title === 'Oppdiktet månedsserie')
  expect(monthly.map(row => row.start)).toEqual(['2044-01-01T09:00:00.000Z', '2044-02-01T09:00:00.000Z', '2044-03-01T09:00:00.000Z', '2044-04-01T09:00:00.000Z', '2044-05-01T09:00:00.000Z', '2044-06-01T09:00:00.000Z', '2044-10-10T09:00:00.000Z'])
  expect(monthly.at(-1).end).toBe('2044-10-10T11:00:00.000Z')
  const long = events.find(row => row.title === 'Oppdiktet lang aktivitet')
  expect(long).toMatchObject({ start: '2044-12-20T09:00:00.000Z', end: '2045-01-01T09:00:00.000Z' })
  expect(Date.parse(source.period.end)).toBeGreaterThanOrEqual(Date.parse(long.end))
  if (notes) expect(long.notes).toBe('Oppdiktet lokalt notat som skal beholdes.')
  for (const row of events) {
    const entry = source.entries.find(entry => entry.key === row.importEntryKey)
    expect(entry).toMatchObject({ targetId: row.id, kind: 'event', calendarUid: expect.stringMatching(/^[a-f0-9]{16}$/) })
    expect(row).toMatchObject({ importSourceId: source.id, courseId: '' })
    if (row.title !== 'Oppdiktet lang aktivitet') expect(entry.calendarOccurrenceInstant).toBe(row.start)
  }
  return { source, events, long }
}

async function repeatCalendar(page, state) {
  const before = assertRecurrences(state)
  await openCalendar(page, { sourceId: before.source.id, revision: true })
  await confirmTpImport(page)
  const repeated = await savedTpState(page)
  assertRecurrences(repeated)
  expect(repeated.planner).toEqual(state.planner)
  expect(repeated.importSources[0].entries).toEqual(before.source.entries)
  return repeated
}

test('Import closure ICS: late dates, long duration and equivalent cancellations survive visible save and reimport', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-ics', 'Needs its own isolated database.')
  await openCalendar(page)
  expect((await savedTpState(page))?.planner?.events || []).toEqual([])
  await captureTp(page, info, 'closure-ics-before-save.png', { target: preview(page).getByRole('heading', { name: 'Dette fant jeg', exact: true }), align: 'start' })
  await confirmTpImport(page)
  const initial = await savedTpState(page), { long } = assertRecurrences(initial, { cancelled: false, notes: false })
  await navigate(page, 'subjects')
  await page.locator(`[data-event-id="${long.id}"]`).getByRole('button', { name: `Rediger undervisning ${long.title}`, exact: true }).click()
  const editor = page.locator('#subject-editor')
  await editor.getByLabel('Egne notater', { exact: true }).fill('Oppdiktet lokalt notat som skal beholdes.')
  await editor.getByRole('button', { name: 'Lagre undervisning', exact: true }).click()
  await expect(editor).toBeHidden()
  const edited = await savedTpState(page)
  assertRecurrences(edited, { cancelled: false })
  await page.reload()
  expect(await savedTpState(page)).toEqual(edited)
  await openCalendar(page, { sourceId: edited.importSources[0].id, revision: true })
  await expect(preview(page)).toContainText('Avlysning fra kalenderen')
  await confirmTpImport(page)
  const updated = await savedTpState(page)
  assertRecurrences(updated)
  expect(updated.planner.events.map(row => row.id)).toEqual(edited.planner.events.map(row => row.id))
  expect(updated.planner.events.map(row => row.importEntryKey)).toEqual(edited.planner.events.map(row => row.importEntryKey))
  await page.reload()
  expect(await savedTpState(page)).toEqual(updated)
  await navigate(page, 'calendar')
  const calendar = page.locator('#full-calendar')
  await calendar.getByRole('button', { name: 'Dag', exact: true }).click()
  await calendar.locator('#full-calendar-date').fill('2044-10-10')
  await calendar.locator('#full-calendar-date').press('Tab')
  await expect(calendar.getByRole('button', { name: /Oppdiktet månedsserie/ }).first()).toBeVisible()
  await captureTp(page, info, 'closure-ics-explicit-date-calendar.png', { target: calendar.getByRole('button', { name: /Oppdiktet månedsserie/ }).first() })
  const repeated = await repeatCalendar(page, updated)
  await page.reload()
  expect(await savedTpState(page)).toEqual(repeated)
})

test('Import closure persisted ICS: fresh browser preserves recurrence IDs, source decisions and cancellations', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-ics' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime harness only.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected)
  assertRecurrences(expected)
  const repeated = await repeatCalendar(page, expected)
  await page.reload()
  expect(await savedTpState(page)).toEqual(repeated)
})

async function withTpFixture(page, run) {
  const calls = []
  const fetchTextImpl = async (input, _redirects, guard) => {
    const url = new URL(input); guard?.(url); calls.push(url.pathname)
    if (url.pathname.endsWith('semesters.php')) return JSON.stringify([{ id: '44h', year: 2044, season: 'AUTUMN', fromdate: '2044-08-01', todate: '2045-01-31', random_int: 974, publish_timetable: true }])
    if (url.pathname.endsWith('info.php')) return JSON.stringify([{ id: 'SYN974', semesterid: '44h', nameNb: 'Oppdiktet høstemne', term: [{ term: 1 }] }])
    if (url.pathname.endsWith('/ws/timeplan/')) return JSON.stringify({ events: ['2044-11-20', '2045-01-12'].map((date, index) => ({ id: `synthetic-term-${index}`, eventid: `synthetic-term-${index}`, summary: `Oppdiktet terminaktivitet ${index + 1}`, courseid: 'SYN974', semesterid: '44h', terminnr: 1, status: 'active', dtstart: `${date}T10:00:07+01`, dtend: `${date}T11:00:09+01`, teachingMethodName: 'Forelesning', studentgroups: ['Oppdiktet fellesgruppe'] })) })
    if (url.pathname.endsWith('/app/schedule')) return '<!doctype html><title>Synthetic public TP</title>'
    if (url.pathname.endsWith('inst.php') || url.pathname.endsWith('session.php')) return '{}'
    throw new Error('Unexpected synthetic term request')
  }
  const server = createServer((request, response) => importMiddleware(request, response, () => { response.writeHead(404); response.end() }, { fetchTextImpl }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = `http://127.0.0.1:${server.address().port}`
  const intercept = async route => {
    const response = await fetch(`${address}/api/import/calendar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: route.request().postData() })
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() })
  }
  await page.route('**/api/import/calendar', intercept)
  try { await run(calls) } finally {
    try { if (!page.isClosed()) await page.unroute('**/api/import/calendar', intercept) }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  }
}

async function openTerm(page) {
  await navigate(page, 'subjects')
  await openImportMethod(page, 'calendar')
  await (await reveal(page.getByLabel('Kalenderlenke (HTTPS eller webcal)'))).fill('https://tp.educloud.no/himolde/app/schedule?semester=44h&scheduleType=course&course=SYN974')
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  await expect(preview(page)).toBeVisible()
  await expect(preview(page).locator('[data-field=courseTarget]')).toHaveCount(1)
  const group = preview(page).getByRole('checkbox', { name: /^Ta med gruppen Oppdiktet fellesgruppe/, includeHidden: true })
  await (await reveal(group)).check()
  await expect(preview(page).locator('.document-selection-summary')).toContainText('2 aktiviteter valgt')
}

function assertTerm(state) {
  expect(state.importSources).toHaveLength(1)
  expect(state.planner.courses).toHaveLength(1)
  expect(state.planner.events).toHaveLength(2)
  const course = state.planner.courses[0], source = state.importSources[0]
  expect(course).toMatchObject({ code: 'SYN974', name: 'Oppdiktet høstemne', university: 'himolde', semester: 'autumn', year: 2044 })
  expect(source).toMatchObject({ format: 'ics', origin: { kind: 'link' }, complete: false })
  expect(state.planner.events.map(row => [row.courseId, row.start, row.end])).toEqual([[course.id, '2044-11-20T09:00:07.000Z', '2044-11-20T10:00:09.000Z'], [course.id, '2045-01-12T09:00:07.000Z', '2045-01-12T10:00:09.000Z']])
  expect(state.planner.events.filter(eventBlocksTime)).toHaveLength(2)
  for (const target of [course, ...state.planner.events]) expect(source.entries.find(entry => entry.key === target.importEntryKey)?.targetId).toBe(target.id)
}

test('Import closure term: published autumn owns January activities through the visible TP link flow', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-term-second', 'Needs its own isolated database.')
  await withTpFixture(page, async calls => {
    await openTerm(page)
    await confirmTpImport(page)
    const initial = await savedTpState(page)
    assertTerm(initial)
    await page.reload()
    expect(await savedTpState(page)).toEqual(initial)
    await navigate(page, 'subjects')
    await expect(page.locator('.course-card')).toContainText('Høst 2044')
    await captureTp(page, info, 'closure-term-course.png', { target: page.locator('.course-card').first() })
    await openTerm(page)
    await confirmTpImport(page)
    const repeated = await savedTpState(page)
    assertTerm(repeated)
    expect(repeated.planner).toEqual(initial.planner)
    expect(repeated.importSources[0].entries).toEqual(initial.importSources[0].entries)
    expect(calls.filter(path => path.endsWith('/ws/timeplan/'))).toHaveLength(2)
  })
})

test('Import closure persisted term: fresh browser and TP reimport preserve autumn course and exact January instants', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-term-second' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime harness only.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected)
  assertTerm(expected)
  await withTpFixture(page, async () => {
    await openTerm(page)
    await confirmTpImport(page)
    const repeated = await savedTpState(page)
    assertTerm(repeated)
    expect(repeated.planner).toEqual(expected.planner)
    expect(repeated.importSources[0].entries).toEqual(expected.importSources[0].entries)
  })
})
