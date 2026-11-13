import { test, expect } from '@playwright/test'
import { freeze, instrumentWrites, key, navigate, raw, saved, save, writes } from './helpers.js'

const repeated = '2027-10-31T02:30'
const course = { id: 'retro-course', name: 'Retroemne', code: 'TEST101', university: 'Testuniversitet', semester: 'autumn', year: 2027, credits: null, notes: '' }
const task = (id, deadlineLocal = repeated, patch = {}) => ({
  id, title: id, course: course.code, courseId: course.id, deadlineLocal, estimatedMinutes: 30, completed: false, ...patch,
})
async function seedAgenda(page, tasks, { now = '2027-10-30T12:00:00Z', events = [] } = {}) {
  await freeze(page, now)
  await page.goto('/')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key, data: { schemaVersion: 1, tasks, planner: { courses: [course], events, sources: [] } },
  })
  await instrumentWrites(page)
  await page.reload()
  await navigate(page, 'overview')
  expect(await writes(page)).toEqual([])
}

test.describe('subject agenda in a browser outside Oslo', () => {
test.use({ timezoneId: 'America/Los_Angeles' })
test('subject agenda renderer prioritizes repair and orders mixed offset instants with stable ties', async ({ page }, testInfo) => {
  const tasks = [task('Later deadline', repeated, { deadlineDisambiguation: 'later' }), task('Unresolved deadline')]
  const events = [
    { id: 'teaching-b', title: 'Undervisning med likt tidspunkt', courseId: course.id, start: '2027-10-31T02:15:00+02:00', end: '2027-10-31T02:20:00+02:00', location: 'Rom B', notes: '' },
    { id: 'teaching-a', title: 'Undervisning med likt tidspunkt', courseId: course.id, start: '2027-10-31T00:15:00Z', end: '2027-10-31T00:20:00Z', location: 'Rom A', notes: '' },
    { id: 'personal', title: 'Datoaktivitet uten klokkeslett', activityKind: 'personal', courseId: '', dateLocal: '2027-10-31', location: '', notes: '' },
  ]
  await seedAgenda(page, tasks, { events })
  const before = await raw(page)
  const entries = page.locator('#teaching-agenda li')
  // The current design hides this legacy renderer. Assert its DOM boundary and
  // invoke its real repair callback without claiming it is visible navigation.
  await expect(entries).toHaveCount(5)
  await expect(entries.nth(0)).toContainText('Unresolved deadline')
  await expect(entries.nth(0)).toContainText('velg første eller andre gang')
  await expect(entries.nth(1)).toContainText('Datoaktivitet uten klokkeslett')
  await expect(entries.nth(1)).toContainText('Tid ikke oppgitt')
  await expect(entries.nth(2)).toContainText('Rom A')
  await expect(entries.nth(3)).toContainText('Rom B')
  await expect(entries.nth(4)).toContainText('Later deadline')
  await expect(entries.nth(4)).toContainText('andre gang, UTC+01:00')
  await testInfo.attach('subject-agenda-order.txt', { body: (await entries.allTextContents()).join('\n'), contentType: 'text/plain' })
  await entries.nth(0).locator('button').evaluate(button => button.click())
  await expect(page.locator('#task-form')).toBeVisible()
  await expect(page.locator('#title')).toHaveValue('Unresolved deadline')
  await expect(page.locator('#deadlineDisambiguation')).toHaveValue('')
  expect(await raw(page)).toBe(before)
  expect(await writes(page)).toEqual([])
})
})

test('clock refresh keeps keyboard repair reachable when the focused legacy deadline moves beyond collapsed rows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const tasks = [task('Focused legacy repair'), ...Array.from({ length: 5 }, (_, i) => task(`Upcoming ${i + 1}`, '2027-11-01T12:00'))]
  await seedAgenda(page, tasks, { now: '2027-10-31T01:29:59.000Z' })
  await navigate(page, 'all')
  const before = await raw(page)
  const repair = page.locator('[data-agenda-key="task:Focused legacy repair"]')
  const more = page.locator('#compact-agenda .agenda-more')
  await repair.focus()
  await expect(repair).toBeFocused()
  await expect(more).toHaveAttribute('aria-expanded', 'false')

  // Equality with the latest possible instant is still unresolved, not expired.
  await page.clock.runFor(1000)
  await expect(repair).toBeFocused()
  // The next real controller refresh moves it to position six.
  await page.clock.runFor(1000)
  await expect(repair).toHaveCount(0)
  await expect(more).toBeFocused()
  await expect(more).toHaveText('Vis alle 6 hendelser')
  expect(await raw(page)).toBe(before)
  expect(await writes(page)).toEqual([])

  await page.keyboard.press('Enter')
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await expect(more).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(repair).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#title')).toHaveValue('Focused legacy repair')
  await expect(page.locator('#deadlineDisambiguation')).toHaveValue('')
  expect(await raw(page)).toBe(before)
  expect(await writes(page)).toEqual([])
  await save(page).click()
  await expect(page.locator('#deadlineDisambiguation')).toBeFocused()
  expect(await raw(page)).toBe(before)
})

for (const width of [1280, 360]) {
  test(`compact agenda keeps upcoming work visible and expired repairs reachable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const tasks = [...Array.from({ length: 5 }, (_, i) => task(`Expired repair ${i + 1}`)), task('Upcoming deadline', '2027-11-01T12:00')]
    await seedAgenda(page, tasks, { now: '2027-10-31T01:30:00.001Z' })
    // The current overview hides the calendar panel at both sizes; the task
    // view exposes the same compact agenda through normal navigation.
    await navigate(page, 'all')
    const before = await raw(page)
    const entries = page.locator('.compact-agenda-list .agenda-entry')
    await expect(entries).toHaveCount(5)
    await entries.first().scrollIntoViewIfNeeded()
    await page.clock.runFor(500)
    await expect(entries.first()).toBeVisible()
    await expect(entries.first()).toContainText('Upcoming deadline')
    await expect(page.locator('[data-agenda-key="task:Expired repair 5"]')).toHaveCount(0)
    await page.locator('#compact-agenda').screenshot({ path: testInfo.outputPath(`upcoming-first-${width}.png`) })
    await page.getByRole('button', { name: 'Vis alle 6 hendelser', exact: true }).click()
    await expect(entries).toHaveCount(6)
    const repair = page.locator('[data-agenda-key="task:Expired repair 5"]')
    await expect(repair).toContainText('Fristens klokkeslett må presiseres.')
    await repair.focus()
    await expect(repair).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath(`expired-repairs-${width}.png`), fullPage: true })
    await repair.press('Enter')
    await expect(page.locator('#title')).toHaveValue('Expired repair 5')
    await expect(page.locator('#deadlineDisambiguation')).toHaveValue('')
    expect(await raw(page)).toBe(before)
    expect(await writes(page)).toEqual([])
    await save(page).click()
    await expect(page.locator('#deadlineDisambiguation')).toBeFocused()
    expect(await raw(page)).toBe(before)
    await page.locator('#deadlineDisambiguation').selectOption('later')
    await save(page).click()
    await expect(page.locator('#task-form')).toBeHidden()
    const repaired = (await saved(page)).tasks
    expect(repaired.find(item => item.id === 'Expired repair 5').deadlineDisambiguation).toBe('later')
    expect(repaired.filter(item => item.id.startsWith('Expired repair') && item.id !== 'Expired repair 5').every(item => item.deadlineDisambiguation === undefined)).toBe(true)
  })
}
