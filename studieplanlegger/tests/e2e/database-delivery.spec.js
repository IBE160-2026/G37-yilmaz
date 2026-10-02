import { expect, test } from '@playwright/test'
import { deleteTask, edit, navigate, openMenu } from './helpers.js'

test.describe.configure({ mode: 'serial' })

const legacy = {
  schemaVersion: 1,
  tasks: [{ id: 'legacy-task', title: 'Migrated linked task', course: 'TEST101', courseId: 'legacy-course', deadlineLocal: '2026-09-28T12:00', estimatedMinutes: null, remainingMinutes: null, remainingEstimate: { minMinutes: 241, maxMinutes: null }, deadlinePromptDismissed: true, completed: false }],
  sessions: [{ id: 'legacy-session', taskId: 'legacy-task', dateLocal: '2026-09-24', startTime: '10:00', endTime: '10:30' }],
  planner: { courses: [{ id: 'legacy-course', code: 'TEST101', name: 'Migration course', university: 'Test', semester: 'autumn', year: 2026, notes: '', sourceExtra: 'retained' }], events: [{ id: 'legacy-personal', title: 'Syntetisk avtale', activityKind: 'personal', courseId: '', dateLocal: '2026-10-04', start: '2026-10-04T10:00:00Z', end: '2026-10-04T11:00:00Z', location: '', notes: '', cancelled: false }], sources: [] },
  studyTimePreference: { kind: 'evening', label: 'På kvelden i ukedagene', days: [1, 2, 3, 4, 5], startTime: '18:00', endTime: '20:00' },
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
  expect(updated.envelope.tasks[0]).toMatchObject({ id: 'legacy-task', title: 'Database-confirmed edit', courseId: 'legacy-course', remainingEstimate: { minMinutes: 241, maxMinutes: null }, deadlinePromptDismissed: true })
  expect(updated.envelope.tasks[0].remainingMinutes).toBeUndefined()
  expect(updated.envelope.sessions[0]).toMatchObject({ id: 'legacy-session', taskId: 'legacy-task' })
  expect(updated.envelope.planner.events[0]).toMatchObject({ id: 'legacy-personal', activityKind: 'personal', courseId: '', dateLocal: '2026-10-04', start: '2026-10-04T10:00:00Z', end: '2026-10-04T11:00:00Z' })
  expect(updated.envelope.studyTimePreference).toEqual(legacy.studyTimePreference)

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

test('programme import persists across reload, remains repeat-safe and is undoable in SQLite', async ({ page }) => {
  const sourceUrl = 'https://www.himolde.no/studier/programmer/database-test/studieplaner/2026.html'
  const importedId = 'himolde:database-test:2026:1:DBP101'
  await page.route('**/api/import/providers/himolde/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const responses = {
      programs: { results: [{ code: 'DBTEST', name: 'Databaseprogram', sourceUrl }], completeness: { complete: true } },
      'program-cohorts': { results: [{ cohort: '2026', sourceUrl }] },
      'program-plan': { program: { code: 'DBTEST', name: 'Databaseprogram', cohort: '2026', sourceUrl, campuses: [] }, models: [{ id: 'common', name: 'Felles', periods: [{ id: '1', label: '1. semester', studySemester: 1, year: 2026, semester: 'autumn', requiredCourseIds: [importedId], alternativeGroups: [], courses: [{ id: importedId, code: 'DBP101', name: 'Persistens i programimport', credits: 10, choice: 'O', university: 'Høgskolen i Molde', sourceProvider: 'himolde', sourceRecordId: 'DBP101', sourceVersion: '2026', sourceUrl, description: '', notes: '' }] }] }], warnings: [] },
      'teaching-search': { results: [] },
    }
    await route.fulfill({ json: { status: 'ok', ...(responses[action] || { status: 'not-supported', error: 'Uventet database-testkall' }) } })
  })
  const importProgramme = async () => {
    await navigate(page, 'subjects')
    const importButton=page.getByRole('button', { name: 'Importer emner og plan', exact: true })
    if(await importButton.getAttribute('aria-expanded')!=='true')await importButton.click()
    await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
    const host = page.locator('.program-import')
    await host.locator('[name=institution]').selectOption('himolde')
    await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
    await host.locator('[name=program]').selectOption('0')
    await host.locator('[name=cohort]').selectOption('0')
    await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
    await host.locator('[name=model]').selectOption('common')
    await host.locator('[name=studySemester]').selectOption('1')
    await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
    await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
    await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  }
  const importedCount = () => page.evaluate(async () => {
    const saved = await (await fetch('/api/state')).json()
    return saved.envelope.planner.courses.filter(course => course.code === 'DBP101').length
  })

  await page.goto('/')
  await importProgramme()
  await expect.poll(importedCount).toBe(1)
  await page.locator('.contextual-undo').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  await expect.poll(importedCount).toBe(0)
  await importProgramme()
  await page.reload()
  await expect.poll(importedCount).toBe(1)
  await importProgramme()
  await expect.poll(importedCount).toBe(1)
  await page.reload()
  await expect.poll(importedCount).toBe(1)
})
