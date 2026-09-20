import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { parseNhfhPlan } from '../../server/providers/nhfh-programs.js'
import { navigate, openImportMethod, key, raw, saved, freeze, instrumentWrites, writes } from './helpers.js'

const fixture = JSON.parse(readFileSync(new URL('../fixtures/nhfh-programs.json', import.meta.url), 'utf8'))
const code = 'bachelor-i-ernaering', sourceUrl = `https://nhfh.no/${code}/`
const initial = {
  schemaVersion: 1,
  tasks: [{ id: 'existing-task', title: 'Behold oppgavekoblingen', course: 'OLD101', courseId: 'existing-course', deadlineLocal: '', estimatedMinutes: null, completed: false }],
  planner: {
    courses: [{ id: 'existing-course', name: 'Lagret emne', code: 'OLD101', university: 'Lokalt testlærested', year: 2026, semester: 'autumn', notes: 'Behold emnenotatet' }],
    events: [{ id: 'existing-event', courseId: 'existing-course', sourceId: 'existing-source', title: 'Lagret undervisning', start: '2026-10-15T10:00:00Z', end: '2026-10-15T11:00:00Z', notes: 'Behold undervisningsnotatet' }],
    sources: [{ id: 'existing-source', courseId: 'existing-course', kind: 'file', name: 'Lagret kalenderfil', groups: [], lastUpdated: '2026-09-19T10:00:00Z' }],
  },
}

test('R11 captured NHFH unavailable academic year blocks both semesters without writes and allows corrected period', async ({ page }, info) => {
  const plan = parseNhfhPlan(fixture.nutrition, { code, sourceUrl, cohort: 2026 })
  await freeze(page, '2026-09-19T12:00:00+02:00')
  await page.route('**/api/import/**', route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs' ? { status: 'ok', results: [{ code, name: 'Bachelor i ernæring', sourceUrl }] }
      : action === 'program-cohorts' ? { status: 'ok', results: [{ cohort: 'current', label: 'Gjeldende studieside · oppgi eget opptakskull', sourceUrl, requiresStudentCohort: true }] }
      : action === 'program-plan' ? plan : { status: 'not-supported', error: 'Bare den lokale, tidligere innsamlede NHFH-fixturen er tilgjengelig i testen.' }
    return route.fulfill({ json: data })
  })
  await page.goto('/')
  await page.evaluate(({ key, initial }) => localStorage.setItem(key, JSON.stringify(initial)), { key, initial })
  await instrumentWrites(page); await page.reload(); await navigate(page, 'subjects')
  const before = await raw(page)
  await openImportMethod(page, 'institution')
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('nhfh')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.locator('[name=studentCohort]').fill('2026')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('Studiet tilbys ikke studieåret 2026/2027')
  await host.locator('[name=model]').selectOption('published-current')
  await host.locator('[name=studySemester]').selectOption('1')
  await host.locator('[name=programCampus]').selectOption('Oslo')
  await host.locator('.activity-choices').getByRole('checkbox').first().check()
  await expect(host.locator('.activity-choices')).toContainText('Studiet tilbys ikke studieåret 2026/2027')
  const preview = host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true })
  const confirm = host.getByRole('button', { name: 'Bekreft programimport', exact: true })
  for (const [year, semester] of [['2026', 'autumn'], ['2027', 'spring']]) {
    await host.locator('[name=clarifiedYear]').fill(year)
    await host.locator('[name=clarifiedSemester]').selectOption(semester)
    await preview.click()
    await expect(host.getByRole('status')).toContainText('kilden sier uttrykkelig at emnet ikke tilbys i dette kalendersemesteret')
    await expect(host.getByRole('status')).toContainText('Lagrede data er beholdt')
    await expect(confirm).toBeHidden()
    await expect(preview).toBeEnabled()
    await expect(host.locator('[name=clarifiedYear]')).toHaveValue(year)
    await expect(host.locator('[name=clarifiedSemester]')).toHaveValue(semester)
    expect(await raw(page)).toBe(before)
    expect(await writes(page)).toEqual([])
  }
  await page.setViewportSize({ width: 390, height: 900 })
  await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
  await host.getByRole('status').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('nhfh-unavailable-academic-year-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)

  // This is the student's explicit calendar clarification; the current source
  // page must still not claim to verify their cohort or a 2027/2028 edition.
  await host.locator('[name=clarifiedSemester]').selectOption('autumn')
  await preview.click(); await expect(confirm).toBeVisible()
  await expect(host.locator('.import-preview')).toContainText('Høst 2027')
  expect(await raw(page)).toBe(before)
  expect(await writes(page)).toEqual([])
  await confirm.click()
  await expect(host.getByRole('status')).toContainText('1 emner og valgte undervisningsøkter er lagret')
  const committed = await saved(page), imported = committed.planner.courses.find(course => course.id !== 'existing-course')
  expect(committed.planner.courses).toHaveLength(2)
  expect(imported).toMatchObject({ name: 'Anatomi og fysiologi', year: 2027, semester: 'autumn', programBinding: { cohort: '2026', cohortFromStudent: true, calendarYear: 2027, calendarSemester: 'autumn', calendarClarifiedByStudent: true } })
  expect(imported.programBinding.sourceNotes).toContain('Studiet tilbys ikke studieåret 2026/2027')
  expect(committed.planner.courses[0]).toEqual(initial.planner.courses[0])
  expect(committed.tasks).toEqual(initial.tasks)
  expect(committed.planner.events).toEqual(initial.planner.events)
  expect(committed.planner.sources).toEqual(initial.planner.sources)
  await page.reload(); await navigate(page, 'subjects')
  expect(await saved(page)).toEqual(committed)
  expect(await writes(page)).toEqual([])
  const card = page.locator('.course-card').filter({ has: page.getByRole('heading', { name: 'Anatomi og fysiologi', exact: true }) })
  await expect(card.locator('.import-warning')).toHaveCount(1)
  await expect(card.locator('.import-warning')).toContainText('Studiet tilbys ikke studieåret 2026/2027')
})
