import { expect, test } from '@playwright/test'
import { deleteTask, edit, openMenu } from './helpers.js'

test.describe.configure({ mode: 'serial' })

const legacy = {
  schemaVersion: 1,
  tasks: [{ id: 'legacy-task', title: 'Migrated linked task', course: 'TEST101', courseId: 'legacy-course', deadlineLocal: '2026-09-28T12:00', estimatedMinutes: 60, remainingMinutes: 45, completed: false }],
  sessions: [{ id: 'legacy-session', taskId: 'legacy-task', dateLocal: '2026-09-24', startTime: '10:00', endTime: '10:30' }],
  planner: { courses: [{ id: 'legacy-course', code: 'TEST101', name: 'Migration course', university: 'Test', semester: 'autumn', year: 2026, notes: '', sourceExtra: 'retained' }], events: [], sources: [] },
}

test('production API explicitly migrates once, persists exact relations and rejects stale writes', async ({ page }) => {
  const font = await page.request.get('/fonts/manrope-0.woff2')
  expect(font.ok()).toBe(true)
  expect(font.headers()['content-type']).toBe('font/woff2')
  expect(font.headers()['x-content-type-options']).toBe('nosniff')
  await page.addInitScript(value => localStorage.setItem('studieplanlegger:v1', JSON.stringify(value)), legacy)
  let confirmations = 0
  page.on('dialog', async dialog => { confirmations++; expect(dialog.type()).toBe('confirm'); await dialog.accept() })
  await page.goto('/')
  await page.locator('#view-all').click()
  await expect(page.locator('.task-title', { hasText: 'Migrated linked task' })).toBeVisible()
  expect(confirmations).toBe(1)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('studieplanlegger:v1')))).toEqual(legacy)

  const saved = await page.evaluate(async () => (await fetch('/api/state')).json())
  expect(saved.envelope).toEqual(legacy)
  await openMenu(page, 'Migrated linked task')
  await edit(page, 'Migrated linked task').click()
  await page.locator('#title').fill('Database-confirmed edit')
  await page.getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(page.locator('.task-title', { hasText: 'Database-confirmed edit' })).toBeVisible()
  const updated = await page.evaluate(async () => (await fetch('/api/state')).json())
  expect(updated.envelope.tasks[0]).toMatchObject({ id: 'legacy-task', title: 'Database-confirmed edit', courseId: 'legacy-course' })
  expect(updated.envelope.sessions[0]).toMatchObject({ id: 'legacy-session', taskId: 'legacy-task' })

  await page.locator('#new-task').click()
  await page.locator('#title').fill('Database-created task')
  await page.getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(page.locator('.task-title', { hasText: 'Database-created task' })).toBeVisible()
  const created = await page.evaluate(async () => (await fetch('/api/state')).json())
  const createdTask = created.envelope.tasks.find(task => task.title === 'Database-created task')
  expect(createdTask?.id).toBeTruthy()
  page.removeAllListeners('dialog')
  await deleteTask(page, 'Database-created task')
  await expect(page.locator('.task-title', { hasText: 'Database-created task' })).toHaveCount(0)
  const deleted = await page.evaluate(async () => (await fetch('/api/state')).json())
  expect(deleted.envelope.tasks.some(task => task.id === createdTask.id)).toBe(false)

  const stale = await page.evaluate(async ({ envelope }) => {
    const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: 0, envelope: { ...envelope, tasks: envelope.tasks.map(task => ({ ...task, title: 'Stale draft' })) } }) })
    return { status: response.status, body: await response.json() }
  }, deleted)
  expect(stale).toMatchObject({ status: 409, body: { error: 'stale-revision' } })

  await page.reload()
  await page.locator('#view-all').click()
  await expect(page.locator('.task-title', { hasText: 'Database-confirmed edit' })).toBeVisible()
  expect(confirmations).toBe(1)
  const reloaded = await page.evaluate(async () => (await fetch('/api/state')).json())
  expect(reloaded.envelope).toEqual(deleted.envelope)
})

test('production API restores recovery data and purges work history from live and recoverable state', async ({ page }) => {
  await page.goto('/')
  const initial = await page.evaluate(async () => (await fetch('/api/state')).json())
  const task = initial.envelope.tasks[0]
  expect(task).toBeTruthy()
  const log = {
    id: 'production-work-log', operationId: 'production-operation', taskId: task.id,
    at: '2026-09-20T09:00:00.000Z', outcome: 'more', actualMinutes: 20,
    plannedMinutes: 30, remainingMinutes: 25, interrupted: false, historyComplete: false,
    taskSnapshot: structuredClone(task),
  }
  const withHistory = { ...initial.envelope, workLogs: [log] }
  const saved = await page.evaluate(async ({ revision, envelope }) => {
    const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: revision, envelope }) })
    return { status: response.status, body: await response.json() }
  }, { revision: initial.revision, envelope: withHistory })
  expect(saved.status).toBe(200)

  const withoutHistory = structuredClone(withHistory)
  delete withoutHistory.workLogs
  const replaced = await page.evaluate(async ({ revision, envelope }) => {
    const response = await fetch('/api/state/replace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: revision, envelope }) })
    return { status: response.status, body: await response.json() }
  }, { revision: saved.body.revision, envelope: withoutHistory })
  expect(replaced.status).toBe(200)
  const recovery = await page.evaluate(async () => (await fetch('/api/state/recovery')).json())
  expect(recovery.recovery.data.workLogs).toEqual([log])

  const restored = await page.evaluate(async ({ revision, envelope }) => {
    const response = await fetch('/api/state/replace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: revision, envelope }) })
    return { status: response.status, body: await response.json() }
  }, { revision: replaced.body.revision, envelope: recovery.recovery.data })
  expect(restored.body.envelope.workLogs).toEqual([log])

  const purged = await page.evaluate(async revision => {
    const response = await fetch('/api/state/purge-work-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: revision }) })
    return { status: response.status, body: await response.json() }
  }, restored.body.revision)
  expect(purged.status).toBe(200)
  expect(purged.body.envelope.workLogs).toBeUndefined()
  const purgedRecovery = await page.evaluate(async () => (await fetch('/api/state/recovery')).json())
  expect(purgedRecovery.recovery.data.workLogs).toBeUndefined()

  const invalid = await page.evaluate(async () => {
    const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: 'null' })
    return { status: response.status, body: await response.json() }
  })
  expect(invalid).toMatchObject({ status: 400, body: { error: 'state-operation-failed' } })
})
