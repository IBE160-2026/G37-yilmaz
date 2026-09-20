import { test, expect } from '@playwright/test'
import { freeze, navigate, key, openMenu, checkbox } from './helpers.js'

const task = (id, remainingMinutes = 45, patch = {}) => ({ id, title: id, course: '', deadlineLocal: '', estimatedMinutes: 120, remainingMinutes, completed: false, ...patch })
const window = (id, start, end) => ({ id, start: `2026-09-10T${start}:00+02:00`, end: `2026-09-10T${end}:00+02:00` })
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
async function boot(page, state) {
  await freeze(page, '2026-09-09T09:00:00+02:00'); await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state }); await page.reload()
}

test('R7 untouched recovery honours breaks across adjacent registered windows and undoes atomically', async ({ page }, info) => {
  const state = { schemaVersion: 1, tasks: [task('Lang økt', 60), task('Kort økt', 25)], sessions: [], workWindows: [window('first', '09:00', '10:00'), window('second', '10:05', '10:35')], planningPreferences: { minimumMinutes: 15, sessionMinutes: 60, maximumMinutes: 60, breakMinutes: 10 } }
  await boot(page, state)
  await page.locator('.connected-plan-actions').getByRole('button', { name: 'Jeg ligger etter', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Jeg ligger etter', exact: true })
  await expect(dialog.getByLabel('Ny start', { exact: true }).nth(1)).toHaveValue('10:10')
  await page.screenshot({ path: info.outputPath('cross-window-break-preview.png') })
  await dialog.getByRole('button', { name: 'Godta hele planen', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect((await stored(page)).sessions.map(item => [item.startTime, item.endTime])).toEqual([['09:00', '10:00'], ['10:10', '10:35']])
  await navigate(page, 'settings'); await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  expect((await stored(page)).sessions).toEqual([])
})

test('R7 insufficient locked breaks stay visible and cannot make dependent work start-ready', async ({ page }, info) => {
  const state = { schemaVersion: 1, tasks: [task('Forutsetning', 60), task('Avhengig arbeid', 30, { dependencyIds: ['Forutsetning'] })], sessions: [{ id: 'first', taskId: 'Forutsetning', dateLocal: '2026-09-10', startTime: '09:00', endTime: '09:30', locked: true }, { id: 'second', taskId: 'Forutsetning', dateLocal: '2026-09-10', startTime: '09:35', endTime: '10:05', locked: true }], workWindows: [window('available', '09:00', '10:45')] }
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, state)
  await page.locator('.connected-plan-actions').getByRole('button', { name: 'Jeg ligger etter', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Jeg ligger etter', exact: true })
  await expect(dialog).toContainText('mangler valgt pause mellom reservasjonene')
  await expect(dialog).toContainText('«Avhengig arbeid»:')
  await expect(dialog.locator('.replan-row').filter({ hasText: 'Avhengig arbeid' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('locked-break-warning-mobile.png') })
  await dialog.getByRole('button', { name: 'Godta hele planen', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const after = await stored(page)
  expect(after.sessions.filter(item => item.locked)).toEqual(state.sessions)
  expect(after.sessions.some(item => item.taskId === 'Avhengig arbeid')).toBe(false)
})

test('R7 reopening a completed task persists unknown work, retains the released plan and can be undone', async ({ page }, info) => {
  const state = { schemaVersion: 1, tasks: [task('Skriv rapport')], sessions: [{ id: 'reserved', taskId: 'Skriv rapport', dateLocal: '2026-09-10', startTime: '09:00', endTime: '09:45' }] }
  await boot(page, state); await navigate(page, 'all'); await openMenu(page, 'Skriv rapport')
  page.once('dialog', dialog => dialog.accept())
  await checkbox(page, 'Skriv rapport').check()
  const closed = await stored(page)
  expect(closed.tasks[0]).toMatchObject({ completed: true, remainingMinutes: 0 })
  expect(closed.sessions).toEqual([])
  await openMenu(page, 'Skriv rapport'); await checkbox(page, 'Skriv rapport').uncheck()
  await expect(page.locator('#feedback')).toContainText('oppgi et nytt estimat')
  await expect(page.locator('#task-list [data-task-id="Skriv rapport"]')).toContainText('Gjenstående arbeid: ukjent')
  await page.screenshot({ path: info.outputPath('reopened-unknown-work.png') })
  const reopened = await stored(page)
  expect(reopened.tasks[0]).toMatchObject({ completed: false, remainingMinutes: null, estimatedMinutes: 120 })
  expect(reopened.sessions).toEqual([]); expect(reopened.workLogs).toEqual(closed.workLogs)
  await page.reload(); expect((await stored(page)).tasks[0].remainingMinutes).toBeNull()
  await navigate(page, 'settings'); await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const undone = await stored(page)
  expect(undone.tasks).toEqual(closed.tasks); expect(undone.sessions).toEqual(closed.sessions); expect(undone.workLogs).toEqual(closed.workLogs)
})

test('R7 inline course selection refreshes the visible local estimate before acceptance', async ({ page }, info) => {
  const courses = ['A', 'B'].map(id => ({ id, name: `Emne ${id}`, code: id, university: '', semester: 'autumn', year: 2026, credits: null, notes: '' }))
  const state = { schemaVersion: 1, tasks: [task('Rediger meg', 45, { course: 'A', courseId: 'A', taskType: 'lesing' })], planner: { courses, events: [], sources: [] }, workLogs: [] }
  for (const course of courses) for (let index = 0; index < 5; index++) {
    const snapshot = task(`${course.id}-${index}`, 45, { course: course.code, courseId: course.id, taskType: 'lesing' })
    state.tasks.push({ ...snapshot, completed: true, remainingMinutes: 0 })
    state.workLogs.push({ id: `log-${snapshot.id}`, operationId: `op-${snapshot.id}`, taskId: snapshot.id, at: '2026-09-08T12:00:00Z', outcome: 'done', actualMinutes: course.id === 'A' ? 20 : 100, plannedMinutes: null, remainingMinutes: 0, interrupted: false, historyComplete: true, taskSnapshot: snapshot })
  }
  await boot(page, state); await navigate(page, 'all'); await openMenu(page, 'Rediger meg')
  await page.getByRole('button', { name: 'Rediger «Rediger meg»', exact: true }).click()
  const form = page.locator('#task-form'), estimate = form.locator('.personal-estimate')
  await estimate.locator('summary').click(); await expect(estimate).toContainText('Forslag: 20 min.')
  await form.locator('.inline-course summary').click()
  await form.locator('[name=inlineName]').fill('Nytt emne')
  await form.locator('[name=inlineCode]').fill('NEW')
  await form.getByRole('button', { name: 'Bruk nytt emne', exact: true }).click()
  await expect(estimate).toContainText('Forslag: 60 min.')
  await expect(estimate).toContainText('fra samme oppgavetype;')
  await estimate.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('inline-course-current-estimate.png') })
  await estimate.getByRole('button', { name: 'Bruk som gjenstående estimat', exact: true }).click()
  await expect(form.locator('[name=remainingMinutes]')).toHaveValue('60')
  await form.getByRole('button', { name: 'Lagre', exact: true }).click()
  const after = await stored(page), course = after.planner.courses.find(item => item.code === 'NEW')
  expect(after.tasks[0]).toMatchObject({ courseId: course.id, remainingMinutes: 60 })
})
