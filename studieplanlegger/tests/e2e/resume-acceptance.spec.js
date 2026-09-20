import { test, expect } from '@playwright/test'
import { navigate, saved, key, openImportMethod, openTaskDetails } from './helpers.js'

const recoveryKey = 'studieplanlegger:recovery:v1'
const courses = ['NTNU', 'HVL'].map((university, index) => ({ id: `resume-course-${index}`, code: 'MAT100', name: 'Matematikk', university, semester: 'autumn', year: 2026, credits: 10, notes: '' }))
const task = (id, courseId = courses[0].id) => ({ id, title: `Isolated task ${id}`, course: 'MAT100', courseId, deadlineLocal: '2026-09-08T16:00', estimatedMinutes: 60, remainingMinutes: 30, completed: false })
const initial = tasks => ({ schemaVersion: 1, tasks, planner: { courses, sources: [], events: [] } })
const backup = data => ({ name: 'isolated-recovery.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'studieplan-local-backup', backupVersion: 1, createdAt: '2026-09-08T06:00:00Z', data })) })
async function seed(page, data = initial([]), now = '2026-09-08T06:00:00Z') {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.clock.setFixedTime(new Date(now))
  await page.addInitScript(({ key, raw }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, raw) }, { key, raw: typeof data === 'string' ? data : JSON.stringify(data) })
  await page.goto('/'); return errors
}
async function menu(page) {
  await navigate(page, 'settings')
  const details = page.locator('.data-menu')
  if (!await details.evaluate(node => node.open)) await details.locator('summary').click()
}
async function previewFile(page, value) {
  await menu(page)
  const control = page.getByRole('button', { name: 'Importer sikkerhetskopi', exact: true })
  await expect(control).toBeEnabled()
  const choosing = page.waitForEvent('filechooser'); await control.click()
  await (await choosing).setFiles(backup(value))
  await expect(page.locator('.data-dialog')).toBeVisible()
}

test('a valid local file repairs corrupt storage without discarding its raw before-image', async ({ page }) => {
  const corrupt = '{LOCAL_CORRUPT_RAW_RESUME_ACCEPTANCE_731', errors = await seed(page, corrupt)
  const restored = initial([task('recovered')])
  await previewFile(page, restored)
  await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect.poll(async () => (await saved(page))?.tasks).toEqual(restored.tasks)
  expect(await page.evaluate(() => Object.entries(localStorage).filter(([name]) => name.startsWith('studieplanlegger:')).map(([, value]) => value).join('\n'))).toContain(corrupt)
  await page.reload(); expect((await saved(page)).tasks).toEqual(restored.tasks)
  await navigate(page, 'all'); await expect(page.locator('#task-list')).toContainText('Isolated task recovered')
  expect(errors).toEqual([])
})

test('a failed second replacement preserves both active data and the older recovery copy', async ({ page }) => {
  const a = initial([task('A')]), b = initial([task('B')]), c = initial([task('C')])
  const errors = await seed(page, a)
  await previewFile(page, b); await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect.poll(async () => (await saved(page)).tasks).toEqual(b.tasks)
  const priorRecovery = await page.evaluate(key => localStorage.getItem(key), recoveryKey)
  expect(priorRecovery).toContain('Isolated task A')
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key && JSON.parse(value).tasks?.some(task => task.id === 'C')) throw new DOMException('Isolated replacement fault', 'QuotaExceededError')
      return original.call(this, name, value)
    }
  }, key)
  await previewFile(page, c); await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  expect((await saved(page)).tasks).toEqual(b.tasks)
  expect(await page.evaluate(key => localStorage.getItem(key), recoveryKey)).toBe(priorRecovery)
  await expect(page.locator('.data-dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Gjenopprett forrige kopi', exact: true }).click()
  await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect.poll(async () => (await saved(page)).tasks).toEqual(a.tasks)
  expect(errors).toEqual([])
})

test('teaching without a course cannot lock subsequent manual task registration', async ({ page }) => {
  const errors = await seed(page, { schemaVersion: 1, tasks: [] })
  await navigate(page, 'subjects'); await page.locator('#event-new').click()
  await page.locator('#new-task').click(); await expect(page.locator('#task-form')).toBeVisible()
  await page.locator('#title').fill('Manual task after prerequisite warning')
  await openTaskDetails(page)
  await page.locator('#course').fill('Unlinked manual course')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect.poll(async () => (await saved(page)).tasks.length).toBe(1)
  await page.reload(); expect((await saved(page)).tasks[0].title).toBe('Manual task after prerequisite warning')
  expect(errors).toEqual([])
})

test('same-code explicit course links stay isolated in every full-calendar mode and compact agenda', async ({ page }) => {
  const a = task('NTNU'), b = task('HVL', courses[1].id), data = initial([a, b])
  data.sessions = [{ id: 'hvl-session', dateLocal: '2026-09-08', startTime: '12:00', endTime: '13:00', taskId: b.id }]
  const errors = await seed(page, data)
  await navigate(page, 'calendar'); await page.locator('.full-calendar-filters summary').click()
  await page.locator('#full-calendar-course').selectOption(courses[1].id)
  for (const mode of ['day', 'week', 'month', 'agenda']) {
    await page.locator(`[data-calendar-view=${mode}]`).click()
    await expect(page.locator('.full-calendar-viewport [data-calendar-key="task:NTNU"]')).toHaveCount(0)
    await expect(page.locator('.full-calendar-viewport [data-calendar-key="task:HVL"]').first()).toBeAttached()
  }
  await navigate(page, 'overview'); await page.locator('#calendar-course-filter').selectOption(courses[1].id)
  await expect(page.locator('#compact-agenda')).not.toContainText('Isolated task NTNU')
  await expect(page.locator('#compact-agenda')).toContainText('Isolated task HVL')
  await expect(page.locator('#compact-agenda')).toContainText('12:00')
  expect(errors).toEqual([])
})

test('a clock-only transition updates the ongoing activity label', async ({ page }) => {
  const data = initial([])
  data.planner.events = [{ id: 'clock-lecture', title: 'Clock transition lecture', courseId: courses[0].id, start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z', location: 'Room 201', notes: '' }]
  const errors = await seed(page, data, '2026-09-08T07:59:00Z')
  await navigate(page, 'overview'); await expect(page.locator('#daily-overview')).toContainText('Neste aktivitet: Clock transition lecture')
  await page.clock.setFixedTime(new Date('2026-09-08T08:01:00Z'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('#daily-overview')).toContainText('P\u00e5g\u00e5r n\u00e5: Clock transition lecture')
  expect(errors).toEqual([])
})

test('zero selected file events cannot commit unpreviewed destructive changes', async ({ page }) => {
  const errors = await seed(page), calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:isolated-resume-event', 'DTSTART:20260908T080000Z', 'DTEND:20260908T090000Z', 'SUMMARY:Isolated lecture', 'X-GROUP:Lecture', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
  await navigate(page, 'subjects')
  await openImportMethod(page, 'calendar')
  const form = page.locator('form').filter({ has: page.locator('input[name=file]') })
  await form.locator('[name=courseId]').selectOption(courses[0].id)
  await form.locator('input[name=file]').setInputFiles({ name: 'isolated-resume.ics', mimeType: 'text/calendar', buffer: Buffer.from(calendar) })
  await page.locator('#ics-preview').click(); await page.getByRole('button', { name: 'Bekreft import', exact: true }).click()
  const before = (await saved(page)).planner.events.filter(event => !event.cancelled && !event.deleted).length
  expect(before).toBe(1)
  await page.locator('#ics-preview').click(); await page.locator('#import-preview .preview-events input[type=checkbox]').first().uncheck()
  const preview = await page.locator('#import-preview').innerText()
  const cancelled = Number(preview.match(/(\d+) fjernet\/avlyst/)?.[1] || 0), hidden = Number(preview.match(/(\d+) (?:lokalt )?skjult/)?.[1] || 0)
  await page.getByRole('button', { name: 'Bekreft import', exact: true }).click()
  const after = (await saved(page)).planner.events.filter(event => !event.cancelled && !event.deleted).length
  expect(before - after).toBe(cancelled + hidden)
  expect(errors).toEqual([])
})
