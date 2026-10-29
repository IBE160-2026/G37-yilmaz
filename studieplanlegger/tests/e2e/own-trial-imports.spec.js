import { test, expect } from '@playwright/test'
import { freeze, key, navigate, saved, reveal } from './helpers.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { mergeImport } from '../../src/planner.js'
import { checkedTeaching } from '../../src/teaching-check.js'

// Only synthetic records and intercepted source responses. Live source checks
// are separate in tests/remote/own-trial-imports-live.spec.js.
const source = 'https://example.test/synthetic-programme'
const calendar = content => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ajour synthetic regression//NO\r\n${content}END:VCALENDAR\r\n`
const validEvent = 'BEGIN:VEVENT\r\nUID:synthetic-valid\r\nSUMMARY:Synthetic teaching\r\nDTSTART:20261030T090000Z\r\nDTEND:20261030T100000Z\r\nEND:VEVENT\r\n'
const invalidEvent = 'BEGIN:VEVENT\r\nUID:synthetic-invalid\r\nSUMMARY:Synthetic invalid teaching\r\nDTSTART:bad\r\nEND:VEVENT\r\n'
function sample(institution, codes) {
  const campus = institution === 'bi' ? 'Oslo' : 'Trondheim'
  const courses = codes.map(code => ({ id: `${institution}:${code}:2026:autumn`, code, name: `Syntetisk ${code}`, university: institution.toUpperCase(), year: 2026, semester: 'autumn', credits: 7.5, campus: '', choice: 'O', notes: `Syntetisk kildeopplysning for ${code}.`, sourceUrl: source, sourceProvider: `${institution}-program`, sourceRecordId: code, sourceVersion: '2026H' }))
  return { status: 'ok', program: { code: 'SYNTHETIC', name: 'Syntetisk program', cohort: '2026', sourceUrl: source, campuses: [campus] }, models: [{ id: 'synthetic-model', name: 'Syntetisk modell', periods: [{ id: 'semester-1', label: '1. studiesemester', studySemester: 1, year: 2026, semester: 'autumn', courses, requirements: [] }] }], warnings: [] }
}

async function start(page) {
  await freeze(page, '2026-10-29T18:00:00+01:00')
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] }, onboarding: { dismissed: true, completed: true } })), key)
  await page.reload()
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Finn studieprogram', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  return page.locator('.program-import')
}

async function selectProgramme(host, institution, plan) {
  await host.locator('[name=institution]').selectOption(institution)
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.getByLabel('Studiemodell eller retning', { exact: true }).selectOption(plan.models[0].id)
  await host.locator('[name=studySemester]').selectOption('semester-1')
  await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
  await host.locator('[name=programCampus]').selectOption(plan.program.campuses[0])
}

async function routes(page, institution, plan, extra = () => null) {
  await page.route(`**/api/import/providers/${institution}/**`, async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1)
    const data = action === 'programs' ? { results: [plan.program], completeness: { complete: true } } : action === 'program-cohorts' ? { results: [{ cohort: '2026', sourceUrl: source }] } : action === 'program-plan' ? plan : extra(action, url)
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
}

test('BI declares course-only support before fetching, skips unsupported teaching and saves four courses without duplicate campus or notes', async ({ page }, info) => {
  const plan = sample('bi', ['EXC3401', 'EXC3420', 'EXC3430', 'EXC3460']), teachingRequests = []
  await routes(page, 'bi', plan, action => { teachingRequests.push(action); return { status: 'not-supported', error: 'Syntetisk, ikke støttet' } })
  const host = await start(page)
  await host.locator('[name=institution]').selectOption('bi')
  await expect(host.getByText(/Automatisk undervisningshenting støttes ikke for dette lærestedet/)).toBeVisible()
  await selectProgramme(host, 'bi', plan)
  await expect(host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true })).toHaveText('Forhåndsvis 4 emner uten undervisningshenting')
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.locator('.import-preview')).toContainText('Automatisk undervisningshenting støttes ikke')
  await expect(host.getByRole('button', { name: 'Prøv mislykkede undervisningskilder på nytt' })).toHaveCount(0)
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText('4 emner er lagret samlet. 0 undervisningshendelser')
  await expect(host.locator('.program-action-status')).toContainText('støttes ikke for 4 av emnene')
  expect(teachingRequests).toEqual([])
  const before = await saved(page)
  expect(before.planner.courses).toHaveLength(4)
  expect(before.planner.events).toEqual([])
  expect(before.planner.courses.every(course => !course.teachingCheck)).toBe(true)
  await page.reload(); await navigate(page, 'subjects')
  expect((await saved(page)).planner.courses.map(course => course.id)).toEqual(before.planner.courses.map(course => course.id))
  const card = page.locator('#course-list .course-card').filter({ has: page.getByRole('heading', { name: /EXC3401/ }) })
  await expect(card).toContainText('Campus valgt i studieplan: Oslo')
  await expect(card).not.toContainText('Campus: Ikke oppgitt')
  await expect(card.getByText('Syntetisk kildeopplysning for EXC3401.', { exact: true })).toHaveCount(1)
  await expect(card.getByRole('button', { name: 'Kontroller undervisning for EXC3401' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('bi-course-only-receipt.png'), fullPage: true })
})

for (const outcome of ['empty', 'invalid', 'transport']) test(`NTNU distinguishes ${outcome} calendar response and retains explicit campus`, async ({ page }) => {
  const plan = sample('ntnu', ['HMS0004']), course = plan.models[0].periods[0].courses[0]
  const calendarUrl = 'https://tp.educloud.no/ntnu/timeplan/ical.php?sem=26h&id%5B0%5D=HMS0004&type=course'
  await routes(page, 'ntnu', plan, () => ({ course: { ...course, campus: 'Trondheim' }, calendarUrl }))
  await page.route('**/api/import/calendar', route => route.fulfill(outcome === 'transport' ? { status: 502, json: { error: 'Syntetisk kildefeil HTTP 502' } } : { json: { calendar: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Synthetic Ajour//NO\r\n${outcome === 'invalid' ? 'BEGIN:VEVENT\r\nUID:synthetic\r\nSUMMARY:Synthetic\r\nDTSTART:bad\r\nEND:VEVENT\r\n' : ''}END:VCALENDAR\r\n` } }))
  const host = await start(page)
  await selectProgramme(host, 'ntnu', plan)
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  const preview = host.locator('.import-preview')
  await expect(preview).toContainText('Campus (emnekilden): Trondheim')
  await expect(preview).not.toContainText('Campus: Ikke oppgitt')
  await expect(preview.getByRole('link', { name: 'Valgt offentlig kalenderkilde' })).toHaveAttribute('href', calendarUrl)
  if (outcome === 'empty') {
    await expect(preview).toContainText('Det valgte offentlige kalenderuttrekket er tomt')
    await expect(preview).toContainText('bekrefter ikke at emnet mangler undervisning')
    await expect(preview.getByRole('button', { name: 'Prøv mislykkede undervisningskilder på nytt' })).toHaveCount(0)
  } else {
    await expect(preview).toContainText(outcome === 'invalid' ? 'Dette er en importfeil' : 'Kilden kunne ikke kontaktes')
    await expect(preview).not.toContainText('Ingen økter i valgt offentlig kalender')
    await expect(preview.getByRole('button', { name: 'Prøv mislykkede undervisningskilder på nytt' })).toBeVisible()
  }
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  const persisted = await saved(page)
  expect(persisted.planner.courses).toHaveLength(1)
  expect(persisted.planner.courses[0]).toMatchObject({ campus: 'Trondheim', teachingCheck: { status: outcome === 'invalid' ? 'invalid-response' : outcome === 'transport' ? 'transport-error' : 'empty' } })
  expect(persisted.planner.events).toHaveLength(0)
  await page.reload(); await navigate(page, 'subjects')
  await expect(page.locator('#course-list')).toContainText('Campus (emnekilden): Trondheim')
})

test('invalid saved-source refresh preserves teaching, source choices and notes across reload, with BI limitation separate from real source result', async ({ page }) => {
  const plan = sample('bi', ['EXC3401'])
  await routes(page, 'bi', plan)
  const host = await start(page)
  await selectProgramme(host, 'bi', plan)
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText('1 emne er lagret samlet')
  const envelope = await saved(page), course = envelope.planner.courses[0], stamp = '2026-10-28T08:00:00.000Z'
  const parsed = parseCalendar(calendar(validEvent), { courseId: course.id, year: 2026, semester: 'autumn' })
  const calendarSource = { id: 'saved-source', courseId: course.id, kind: 'url', url: 'https://example.test/synthetic.ics', name: 'Synthetic saved calendar', groups: [parsed.events[0].group], allGroups: [parsed.events[0].group], excludedKeys: ['hidden-choice'], autoRefresh: false, lastUpdated: stamp, lastSuccess: stamp }
  envelope.planner = mergeImport(envelope.planner, parsed.events, calendarSource, { course: checkedTeaching(course, 'unsupported', { now: new Date(stamp), source: 'bi-public-teaching' }) }).planner
  envelope.planner.events[0].notes = 'Behold studentens øktnotat'
  envelope.planner.courses[0].notes = 'Behold studentens emnenotat'
  await page.evaluate(({ key, envelope }) => localStorage.setItem(key, JSON.stringify(envelope)), { key, envelope })
  let invalid = false
  await page.route('**/api/import/calendar', route => route.fulfill({ json: { calendar: calendar(invalid ? invalidEvent : validEvent) } }))
  await page.reload(); await navigate(page, 'subjects')
  const card = page.locator('#course-list .course-card'), sourceCard = page.locator('#source-list .source-card')
  await expect(card.locator('[data-teaching-capability=unsupported]')).toHaveCount(1)
  await expect(card.locator('[data-teaching-check=unsupported]')).toHaveCount(0)
  await (await reveal(sourceCard.getByRole('button', { name: 'Oppdater nå', exact: true }))).click()
  await expect(card.locator('[data-teaching-check=success]')).toContainText('1 publiserte undervisningsøkter ble hentet')
  const successful = await saved(page)
  expect(successful.planner.events[0].notes).toBe('Behold studentens øktnotat')
  invalid = true
  await (await reveal(sourceCard.getByRole('button', { name: 'Oppdater nå', exact: true }))).click()
  await expect(card.locator('[data-teaching-check=invalid-response]')).toContainText('Siste vellykkede kontroll')
  await expect(card.locator('[data-teaching-check=invalid-response]')).toContainText('importfeil')
  await expect(card.locator('[data-teaching-capability=unsupported]')).toHaveCount(1)
  await expect(card.getByRole('button', { name: 'Kontroller undervisning for EXC3401' })).toHaveCount(0)
  const failed = await saved(page)
  expect(failed.planner.events).toEqual(successful.planner.events)
  expect(failed.planner.sources[0]).toMatchObject({ id: calendarSource.id, groups: calendarSource.groups, excludedKeys: calendarSource.excludedKeys, lastSuccess: successful.planner.sources[0].lastSuccess, lastUpdated: successful.planner.sources[0].lastUpdated, failures: 1 })
  expect(failed.planner.courses[0]).toMatchObject({ id: course.id, notes: 'Behold studentens emnenotat', teachingCheck: { status: 'invalid-response', eventCount: 1, lastSuccess: successful.planner.courses[0].teachingCheck.lastSuccess } })
  await page.reload(); await navigate(page, 'subjects')
  expect((await saved(page)).planner).toEqual(failed.planner)
  await expect(page.locator('#course-list [data-teaching-check=invalid-response]')).toContainText('importfeil')
})

test('switching from successful teaching to an all-invalid fetched calendar reports failure and keeps last success without saving the old selection', async ({ page }) => {
  const plan = sample('uit', ['TEST101']), options = [
    { code: 'TEST101', label: 'TEST101 Synthetic A', sourceObjectId: 'synthetic-good' },
    { code: 'TEST101', label: 'TEST101 Synthetic B', sourceObjectId: 'synthetic-invalid' },
  ]
  await routes(page, 'uit', plan, (action, url) => action === 'teaching-search' ? { results: options } : { calendar: calendar(url.searchParams.get('sourceObjectId') === 'synthetic-invalid' ? invalidEvent : validEvent), calendarUrl: `https://example.test/${url.searchParams.get('sourceObjectId')}.ics` })
  const host = await start(page)
  await selectProgramme(host, 'uit', plan)
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).selectOption('0')
  await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
  await expect(host.locator('.import-preview')).toContainText('1 publiserte undervisningsøkter ble hentet')
  await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).selectOption('1')
  await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
  await expect(host.locator('.import-preview')).toContainText('Kildesvaret kunne ikke valideres')
  await expect(host.locator('.import-preview')).toContainText('Siste vellykkede kontroll')
  await expect(host.getByRole('button', { name: 'Prøv mislykkede undervisningskilder på nytt' })).toBeVisible()
  await expect(host.locator('.import-preview .teaching-choice-list')).toHaveCount(0)
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  const envelope = await saved(page)
  expect(envelope.planner.courses[0].teachingCheck).toMatchObject({ status: 'invalid-response', eventCount: 1, lastSuccess: '2026-10-29T17:00:00.000Z', detail: expect.stringContaining('importfeil') })
  expect(envelope.planner.events).toEqual([])
  expect(envelope.planner.sources).toEqual([])
  await page.reload()
  expect((await saved(page)).planner).toEqual(envelope.planner)
})

test('UiT image-table limitation appears once with the selected PDF and manual fallback', async ({ page }) => {
  const pdf = 'https://uit.no/Content/931776/cache=20261310132856/Studieplan%20Bachelor%20i%20geovitenskap%20H-2025.pdf'
  const error = 'PDF-en har lesbar løpende tekst, men selve emnetabellen mangler lesbar tekst og kan være lagret som bilde. Lim inn tabellteksten eller registrer emnene manuelt; en eldre plan erstatter ikke denne utgaven.'
  await page.route('**/api/import/providers/uit/**', route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    return route.fulfill({ json: action === 'programs' ? { status: 'ok', results: [{ code: 'UIT-279541', name: 'Syntetisk geovitenskap', sourceUrl: source }] } : action === 'program-cohorts' ? { status: 'ok', results: [{ cohort: 'pdf-931776', label: 'PDF H-2025', sourceUrl: pdf, requiresStudentCohort: true }] } : { status: 'not-supported', error } })
  })
  const host = await start(page)
  await host.locator('[name=institution]').selectOption('uit')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0'); await host.locator('[name=cohort]').selectOption('0')
  await host.locator('[name=studentCohort]').fill('2025')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await expect(page.getByText(`${error} Lagrede data er beholdt.`, { exact: false })).toHaveCount(1)
  await expect(host.getByRole('link', { name: 'Åpne valgt PDF-kilde' })).toHaveAttribute('href', pdf)
  await expect(host.getByRole('button', { name: 'Registrer manuelt', exact: true })).toBeVisible()
  expect((await saved(page)).planner.courses).toEqual([])
})
