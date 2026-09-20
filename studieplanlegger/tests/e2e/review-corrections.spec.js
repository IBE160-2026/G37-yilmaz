import { test, expect } from '@playwright/test'
import { freeze, navigate, saved, key, openImportMethod, openCourseImport } from './helpers.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { mergeImport } from '../../src/planner.js'

test.use({ timezoneId: 'UTC' })
const course = { id: 'c', code: 'MAT100', name: 'Matematikk', university: 'NTNU', semester: 'autumn', year: 2026, credits: 10 }
const task = { id: 't', title: 'Task', course: 'MAT100', courseId: 'c', deadlineLocal: '2026-09-08T16:00', estimatedMinutes: 60, completed: false }
const initial = () => ({ schemaVersion: 1, tasks: [task], planner: { courses: [course], sources: [], events: [] } })
const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', ...['A', 'B'].flatMap((group, index) => ['BEGIN:VEVENT', `UID:${group}`, `SUMMARY:Teaching ${group}`, `X-GROUP:Group ${group}`, `DTSTART:20260908T${index ? '09' : '08'}0000Z`, `DTEND:20260908T${index ? '10' : '09'}0000Z`, 'LOCATION:Room', 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n')
async function seed(page, data = initial(), now = '2026-09-08T06:00:00Z') {
  await freeze(page, now)
  await page.addInitScript(({ key, raw }) => { if (!sessionStorage.reviewSeeded) { localStorage.setItem(key, raw); sessionStorage.reviewSeeded = 'yes' } }, { key, raw: typeof data === 'string' ? data : JSON.stringify(data) })
  await page.goto('/')
}
const backup = data => ({ format: 'studieplan-local-backup', backupVersion: 1, createdAt: '2026-09-08T06:00:00Z', data })

test('repairs malformed JSON through a valid selected backup file without enabling normal edits', async ({ page }) => {
  const raw = '{ malformed local JSON'; await seed(page, raw)
  await expect(page.getByRole('button', { name: 'Ny oppgave', exact: true, includeHidden: true }).first()).toBeDisabled()
  if (!await page.locator('.data-menu').evaluate(node => node.open)) await page.locator('.data-menu summary').click()
  await expect(page.getByRole('button', { name: 'Importer sikkerhetskopi', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true })).toBeDisabled()
  await page.locator('#backup-file').setInputFiles({ name: 'repair.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup(initial()))) })
  await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  expect(await saved(page)).toEqual(initial())
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('studieplanlegger:recovery:v1')).raw)).toBe(raw)
  await page.reload(); await expect(page.getByRole('button', { name: 'Ny oppgave', exact: true }).first()).toBeEnabled()
})

test('missing course prerequisite does not lock Ny oppgave or Nytt emne', async ({ page }) => {
  await seed(page, { schemaVersion: 1, tasks: [] }); await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Ny undervisning', exact: true }).click()
  await expect(page.locator('#subject-message')).toContainText('Opprett et emne')
  await page.getByRole('button', { name: 'Ny oppgave', exact: true }).first().click()
  await expect(page.locator('#task-form')).toBeVisible()
  await page.locator('#task-form').getByRole('button', { name: 'Avbryt', exact: true }).click()
  await navigate(page, 'subjects'); await page.getByRole('button', { name: 'Nytt emne', exact: true }).click()
  await expect(page.locator('#subject-editor [name=name]')).toBeVisible()
})

test('clock transition updates Neste aktivitet to Paagar without moving focused action', async ({ page }) => {
  const data = initial(); data.planner.events = [{ id: 'event', courseId: 'c', title: 'Teaching', start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z' }]
  await seed(page, data, '2026-09-08T07:59:59Z')
  const host = page.locator('#daily-overview'), action = host.getByRole('button', { name: 'Åpne aktivitet', exact: true })
  await expect(host).toContainText('Neste aktivitet'); await action.focus()
  await page.clock.runFor(2100)
  await expect(host).toContainText('Pågår nå'); await expect(action).toBeFocused()
  expect(await saved(page)).toEqual(data)
})

for (const conflict of [false, true]) test(`selected verified campus survives details and save, conflicting campus=${conflict}`, async ({ page }) => {
  await page.route('**/api/import/providers/ntnu/search?**', route => route.fulfill({ json: { status: 'ok', results: [{ ...course, campus: 'Trondheim' }] } }))
  await page.route('**/api/import/providers/ntnu/details?**', route => route.fulfill({ json: { status: 'ok', course: { ...course, ...(conflict ? { campus: 'Bergen' } : {}) }, warnings: [] } }))
  await seed(page, { schemaVersion: 1, tasks: [] }); await navigate(page, 'subjects')
  await openCourseImport(page)
  await page.getByRole('button', { name: 'Neste: søk og semester', exact: true }).click()
  await page.locator('#course-import-form [name=code]').fill('MAT100')
  await page.locator('#course-import-form [name=campus]').fill('Trondheim')
  await page.getByRole('button', { name: 'Søk emner', exact: true }).click()
  await page.getByRole('button', { name: 'MAT100 · Matematikk · Trondheim', exact: true }).click()
  if (conflict) { await expect(page.locator('#subject-message')).toContainText('campus'); expect((await saved(page)).planner).toBeUndefined(); return }
  await expect(page.locator('#import-preview')).toContainText('Beskrivelse er ikke hentet')
  await expect(page.getByRole('button', { name: 'Avbryt import', exact: true })).toHaveClass(/secondary/)
  await page.getByRole('button', { name: 'Importer bare emnet', exact: true }).click()
  expect((await saved(page)).planner.courses[0]).toMatchObject({ code: 'MAT100', university: 'NTNU', campus: 'Trondheim' })
})

for (const kind of ['file', 'url']) for (const selection of ['group', 'individual']) for (const count of [1, 2]) test(`${kind} ${selection} deselection ${count}: accurate preview, refresh and reselect preserve local data`, async ({ page }) => {
  const data = initial(), source = { id: 's', courseId: 'c', kind, name: 'review.ics', groups: ['Group A', 'Group B'], allGroups: ['Group A', 'Group B'], lastUpdated: '2026-09-08T06:00:00Z', autoRefresh: false, ...(kind === 'url' ? { url: 'https://calendar.example/unknown.ics' } : {}) }
  data.planner = mergeImport(data.planner, parseCalendar(calendar, { ...course, courseId: 'c' }).events, source).planner
  data.planner.events.forEach(event => { event.notes = `Local ${event.sourceUid}` })
  const ids = data.planner.events.map(event => event.id)
  await page.route('**/api/import/calendar', route => route.fulfill({ json: { calendar } }))
  await seed(page, data); await navigate(page, 'subjects')
  const prepare = async () => {
    if (kind === 'file') await openImportMethod(page, 'calendar')
    if (kind === 'file') { await page.locator('#calendar-import-form [name=file]').setInputFiles({ name: 'review.ics', mimeType: 'text/calendar', buffer: Buffer.from(calendar) }); await page.locator('#ics-preview').click() }
    else await page.getByRole('button', { name: 'Oppdater nå', exact: true }).click()
    await expect(page.locator('#import-preview')).toBeVisible()
  }
  await prepare()
  for (let i = 0; i < count; i++) {
    if (selection === 'group') await page.locator(`.activity-choices input[value="Group ${i ? 'B' : 'A'}"]`).setChecked(false)
    else await page.locator('.preview-events input').nth(i).setChecked(false)
  }
  await expect(page.locator('#import-preview')).toContainText(`${count} skjult lokalt`)
  expect(await saved(page)).toEqual(data)
  await page.getByRole('button', { name: 'Bekreft import', exact: true }).click()
  let stored = await saved(page)
  expect(stored.planner.events.filter(event => event.excluded && event.cancelled)).toHaveLength(count)
  await prepare(); await page.getByRole('button', { name: 'Bekreft import', exact: true }).click()
  expect((await saved(page)).planner.events.filter(event => event.excluded && event.cancelled)).toHaveLength(count)
  await prepare()
  for (const group of ['A', 'B']) await page.locator(`.activity-choices input[value="Group ${group}"]`).setChecked(true)
  for (let i = 0; i < 2; i++) await page.locator('.preview-events input').nth(i).setChecked(true)
  await page.getByRole('button', { name: 'Bekreft import', exact: true }).click()
  stored = await saved(page)
  expect(stored.planner.events.map(event => event.id)).toEqual(ids)
  expect(stored.planner.events.map(event => event.notes)).toEqual(['Local A', 'Local B'])
  expect(stored.planner.events.every(event => !event.cancelled && !event.excluded)).toBe(true)
  expect(stored.tasks).toEqual(data.tasks)
})

test('same-code explicit courses stay separate in all full-calendar modes and compact agenda', async ({ page }) => {
  const data = initial(); data.planner.courses.push({ ...course, id: 'hvl', university: 'HVL' })
  data.tasks.push({ ...task, id: 'hvl-task', title: 'HVL task', courseId: 'hvl' })
  data.sessions = [{ id: 'linked', taskId: 'hvl-task', dateLocal: '2026-09-08', startTime: '23:00', endTime: '01:00', endDateLocal: '2026-09-09' }]
  await seed(page, data); await page.locator('#calendar-course-filter').selectOption('hvl')
  await expect(page.locator('[data-agenda-key="task:t"]')).toHaveCount(0)
  await expect(page.locator('[data-agenda-key="session:linked"]')).toContainText('2026-09-09')
  await navigate(page, 'calendar'); await page.getByText('Filtre og hjelp', { exact: true }).click(); await page.locator('#full-calendar-course').selectOption('hvl')
  for (const view of ['day', 'week', 'month', 'agenda']) {
    await page.locator(`[data-calendar-view=${view}]`).click()
    await expect(page.locator('.full-calendar-viewport [data-calendar-key="task:t"]')).toHaveCount(0)
    await expect(page.locator('.full-calendar-viewport [data-calendar-key="task:hvl-task"]').first()).toBeAttached()
  }
})
