import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { importMiddleware } from '../../server/import-api.js'
import { eventBlocksTime } from '../../src/planner.js'
import { navigate, openImportMethod, reveal } from './helpers.js'
import { preview, confirmTpImport, savedTpState, runtimeUrl, runtimeScenario, captureTp } from './tp-csv-helpers.js'

// Independent invented TP publication. The real middleware/adapter consumes an
// in-memory upstream; no public service, private URL or real calendar is used.
const code = 'HST682', year = 2045, term = '45h'
const address = `https://tp.educloud.no/himolde/app/schedule?semester=${term}&scheduleType=course&course=${code}`
const sourceEvents = [
  { id: 'invented-term-september', eventid: 'invented-term-september', summary: 'Oppdiktet høstverksted', dtstart: '2045-09-13T10:00:07+02:00', dtend: '2045-09-13T11:00:17+02:00' },
  { id: 'invented-term-january', eventid: 'invented-term-january', summary: 'Oppdiktet januarsamling', dtstart: '2046-01-09T10:00:07+01:00', dtend: '2046-01-09T11:00:17+01:00' },
].map(event => ({ ...event, semesterid: term, courseid: code, terminnr: 1, status: 'active', studentgroups: ['Oppdiktet publisert utvalg'] }))

async function fixture(page) {
  const calls = []
  const server = createServer((req, res) => importMiddleware(req, res, () => { res.writeHead(404); res.end() }, {
    fetchTextImpl: async (input, _redirects, guard) => {
      const url = new URL(input); guard?.(url); calls.push(url.pathname)
      expect(url.origin).toBe('https://tp.educloud.no')
      if (url.pathname.endsWith('semesters.php')) return JSON.stringify([{ id: term, year, season: 'AUTUMN', fromdate: '2045-08-01', todate: '2046-01-20', random_int: 68245, publish_timetable: true }])
      if (url.pathname.endsWith('info.php')) return JSON.stringify([{ id: code, semesterid: term, nameNb: 'Oppdiktet verksted over årsskiftet', campusid: 'INVENTED-CAMPUS', term: [{ term: 1 }] }])
      if (url.pathname.endsWith('/ws/timeplan/')) return JSON.stringify({ events: sourceEvents })
      if (url.pathname.endsWith('/app/schedule')) return '<!doctype html><title>Independent synthetic TP</title>'
      if (url.pathname.endsWith('inst.php') || url.pathname.endsWith('session.php')) return '{}'
      throw new Error(`Unexpected invented upstream path: ${url.pathname}`)
    },
  }))
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const local = `http://127.0.0.1:${server.address().port}`
  // Block unrelated automatic lookups, then install the specific tested route.
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'No external source is used by this synthetic test.' } }))
  await page.route('**/api/import/calendar', async route => {
    const response = await fetch(`${local}/api/import/calendar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: route.request().postData() })
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() })
  })
  return { calls, close: async () => { server.closeAllConnections(); await new Promise(done => server.close(done)) } }
}

async function openLink(page, sourceAddress = address) {
  await navigate(page, 'subjects'); await openImportMethod(page, 'calendar')
  await (await reveal(page.getByLabel('Kalenderlenke (HTTPS eller webcal)'))).fill(sourceAddress)
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  await expect(preview(page)).toContainText('Oppdiktet verksted over årsskiftet')
  await expect(preview(page).locator('[data-field=courseTarget]')).toHaveCount(1)
  await expect(preview(page)).toContainText('Høst')
  await expect(preview(page)).toContainText('2045')
  await (await reveal(preview(page).getByRole('button', { name: 'Velg alle aktiviteter', exact: true, includeHidden: true }))).click()
  await expect(preview(page)).toContainText('2 valgte kalenderhendelser')
}

function assertTerm(state) {
  expect(state.planner.courses).toHaveLength(1)
  expect(state.planner.courses[0]).toMatchObject({ code, university: 'himolde', year: 2045, semester: 'autumn', campusCode: 'INVENTED-CAMPUS' })
  expect(state.planner.events).toHaveLength(2)
  expect(state.planner.events.map(event => ({ title: event.title, start: event.start, end: event.end, courseId: event.courseId })).sort((a, b) => a.start.localeCompare(b.start))).toEqual([
    { title: 'Oppdiktet høstverksted', start: '2045-09-13T08:00:07.000Z', end: '2045-09-13T09:00:17.000Z', courseId: state.planner.courses[0].id },
    { title: 'Oppdiktet januarsamling', start: '2046-01-09T09:00:07.000Z', end: '2046-01-09T10:00:17.000Z', courseId: state.planner.courses[0].id },
  ])
  expect(state.planner.events.every(eventBlocksTime)).toBe(true)
  expect(state.planner.events.every(event => event.publishedGroups?.[0] === 'Oppdiktet publisert utvalg')).toBe(true)
  expect(state.importSources).toHaveLength(1)
  expect(state.importSources[0].entries).toHaveLength(3)
  expect(state.importSources[0].origin.kind).toBe('link')
  for (const event of state.planner.events) expect(state.importSources[0].entries.find(entry => entry.key === event.importEntryKey)?.targetId).toBe(event.id)
}

test.use({ trace: 'off' })
test('Closure term: published autumn survives January through real TP adapter and visible import', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-term', 'Different owned scenario.')
  const source = await fixture(page)
  try {
    await page.goto(runtimeUrl || '/')
    await openLink(page)
    await captureTp(page, info, 'closure-term-preview.png', { target: preview(page).getByRole('button', { name: 'Importer valgte', exact: true }) })
    await confirmTpImport(page)
    const first = await savedTpState(page); assertTerm(first)
    await page.reload(); expect(await savedTpState(page)).toEqual(first)
    await navigate(page, 'calendar')
    await page.locator('[data-calendar-view=day]').click()
    await page.locator('#full-calendar-date').fill('2046-01-09'); await page.locator('#full-calendar-date').press('Tab')
    await expect(page.locator('#full-calendar')).toContainText('Oppdiktet januarsamling')
    await captureTp(page, info, 'closure-term-january-calendar.png')
    await openLink(page); await confirmTpImport(page)
    const repeated = await savedTpState(page); assertTerm(repeated)
    expect(repeated.planner).toEqual(first.planner)
    expect(repeated.importSources[0].id).toBe(first.importSources[0].id)
    expect(source.calls).toContain('/himolde/ws/timeplan/')
    expect(source.calls).toContain('/himolde/ws/services/semesters.php')
  } finally { await source.close() }
})

test('Closure persisted term: exact published course and January event survive reimport', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-term' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime snapshot required.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  const source = await fixture(page)
  try {
    await page.goto(runtimeUrl)
    expect(await savedTpState(page)).toEqual(expected); assertTerm(expected)
    await openLink(page); await confirmTpImport(page)
    const repeated = await savedTpState(page); assertTerm(repeated)
    expect(repeated.planner).toEqual(expected.planner)
    expect(repeated.importSources[0].id).toBe(expected.importSources[0].id)
    await page.reload(); expect(await savedTpState(page)).toEqual(repeated)
  } finally { await source.close() }
})

// Built once with the preserved pre-correction parser/adapter, using the
// independent publication above. This is a real old-format backup, not a
// post-fix model with its year changed to make the test pass.
const legacyBackupBytes = readFileSync(new URL('../fixtures/synthetic-calendar-closure/legacy-term.json', import.meta.url))
const legacy = JSON.parse(legacyBackupBytes.toString('utf8')).data
function assertLegacyPreserved(state) {
  assertTerm(state)
  expect(state.planner.courses[0].id).toBe(legacy.planner.courses[0].id)
  expect(state.planner.courses[0].notes).toBe(legacy.planner.courses[0].notes)
  const january = state.planner.events.find(event => event.title === 'Oppdiktet januarsamling')
  expect(january.id).toBe(legacy.planner.events[0].id)
  expect(january.notes).toBe(legacy.planner.events[0].notes)
  expect(january.importEntryKey).toBe(legacy.planner.events[0].importEntryKey)
  expect(state.importSources[0].id).toBe(legacy.importSources[0].id)
  expect(state.tasks).toEqual(legacy.tasks)
}

test('Closure legacy term: visible backup and reimport repair one owned semester without losing IDs or notes', async ({ page }) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-term-legacy', 'Different owned scenario.')
  const source = await fixture(page)
  try {
    await page.goto(runtimeUrl || '/')
    await navigate(page, 'settings')
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Importer sikkerhetskopi', exact: true }).click()
    await (await chooser).setFiles({ name: 'independent-legacy-term.json', mimeType: 'application/json', buffer: legacyBackupBytes })
    const dialog = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
    await dialog.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(await savedTpState(page)).toEqual(legacy)
    expect(legacy.planner.courses[0]).toMatchObject({ year: 2046, semester: 'spring' })
    await openLink(page, legacy.importSources[0].origin.publicUrl)
    await expect(preview(page).getByRole('button', { name: 'Importer valgte', exact: true })).toBeEnabled()
    await confirmTpImport(page)
    const corrected = await savedTpState(page); assertLegacyPreserved(corrected)
    await page.reload(); expect(await savedTpState(page)).toEqual(corrected)
    await openLink(page, legacy.importSources[0].origin.publicUrl); await confirmTpImport(page)
    const repeated = await savedTpState(page); assertLegacyPreserved(repeated)
    expect(repeated.planner).toEqual(corrected.planner)
  } finally { await source.close() }
})

test('Closure persisted legacy term: exact repaired semester and retained manual data survive reimport', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-term-legacy' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime snapshot required.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  const source = await fixture(page)
  try {
    await page.goto(runtimeUrl)
    expect(await savedTpState(page)).toEqual(expected); assertLegacyPreserved(expected)
    await openLink(page, legacy.importSources[0].origin.publicUrl); await confirmTpImport(page)
    const repeated = await savedTpState(page); assertLegacyPreserved(repeated)
    expect(repeated.planner).toEqual(expected.planner)
    await page.reload(); expect(await savedTpState(page)).toEqual(repeated)
  } finally { await source.close() }
})
