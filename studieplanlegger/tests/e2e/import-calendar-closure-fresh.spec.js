import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { navigate } from './helpers.js'
import { preview, courseRows, eventRows, confirmTpImport, savedTpState, runtimeUrl, runtimeScenario } from './tp-csv-helpers.js'

// One explicit, independently invented source course qualifies three title-only
// codes at different positions. No title implies a task or examination record.
const titles = ['Oppdiktet kildeaktivitet', 'SYN975 oppdiktet verksted', 'Forberedelse i SYN975 til eksamen', 'Oppdiktet arbeid mot frist for SYN975']
const name = 'synthetic-fresh-title-codes.ics'
const input = ['BEGIN:VCALENDAR', 'VERSION:2.0', ...titles.flatMap((title, i) => [
  'BEGIN:VEVENT', `UID:synthetic-fresh-code-${i}`, `DTSTART:204504${21 + i}T080007Z`, `DTEND:204504${21 + i}T090017Z`, `SUMMARY:${title}`,
  ...(i === 0 ? ['X-COURSE-CODE:SYN975', 'X-COURSE-NAME:Oppdiktet samlet emne', 'X-UNIVERSITY:HiMolde'] : []), 'END:VEVENT',
]), 'END:VCALENDAR', ''].join('\r\n')

async function open(page) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name, mimeType: 'text/calendar', buffer: Buffer.from(input) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(preview(page)).toBeVisible()
  await expect(courseRows(page)).toHaveCount(1)
  await expect(eventRows(page)).toHaveCount(4)
  await expect(preview(page).locator('.document-confirmation-summary')).toContainText('4 av 4 aktiviteter klare · 0 må avklares')
  await expect(preview(page).locator('.document-course-groups > details')).toHaveCount(1)
  const existing = (await savedTpState(page))?.planner?.courses.find(course => course.code === 'SYN975')
  for (const select of await preview(page).locator('[data-field=courseChoice]').all()) await expect(select).toHaveValue(existing?.id || 'row:0')
  for (const summary of await eventRows(page).locator(':scope > summary').all()) await expect(summary).toContainText('Fast undervisning / aktivitet')
}
function assertFresh(state) {
  expect(state.tasks).toEqual([])
  expect(state.planner.courses).toHaveLength(1)
  expect(state.planner.courses[0]).toMatchObject({ code: 'SYN975', university: 'HiMolde', name: 'Oppdiktet samlet emne' })
  expect(state.planner.events).toHaveLength(4)
  expect(state.planner.events.map(event => event.title)).toEqual(titles)
  expect(state.planner.events.every(event => event.courseId === state.planner.courses[0].id && !event.activityKind)).toBe(true)
  expect(state.importSources).toHaveLength(1)
  expect(state.importSources[0].entries.filter(entry => entry.kind === 'event').every(entry => entry.courseDecision.origin === 'automatic')).toBe(true)
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Independent file metadata needs no external lookup.' } }))
  await page.goto(runtimeUrl || '/')
})
test('Closure fresh courses: first middle and later title codes share one qualified course automatically', async ({ page }) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-fresh-courses', 'Needs its own isolated database.')
  await open(page)
  expect((await savedTpState(page))?.planner?.events || []).toEqual([])
  await confirmTpImport(page)
  const first = await savedTpState(page); assertFresh(first)
  await page.reload(); await open(page); await confirmTpImport(page)
  const repeated = await savedTpState(page); assertFresh(repeated)
  expect(repeated.planner).toEqual(first.planner)
  expect(repeated.importSources[0].entries).toEqual(first.importSources[0].entries)
})
test('Closure persisted fresh courses: unique title links survive recreation and repeat', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-fresh-courses' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned persisted snapshot required.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected); assertFresh(expected)
  await open(page); await confirmTpImport(page)
  const repeated = await savedTpState(page); assertFresh(repeated)
  expect(repeated.planner).toEqual(expected.planner)
  expect(repeated.importSources[0].entries).toEqual(expected.importSources[0].entries)
})
