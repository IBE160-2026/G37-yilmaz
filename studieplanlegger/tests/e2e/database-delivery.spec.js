import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { deleteTask, edit, navigate, openMenu } from './helpers.js'
import { storageStressFixture, syntheticStorageBackup } from '../fixtures/storage-stress.js'

test.describe.configure({ mode: 'serial' })

const legacy = {
  schemaVersion: 1,
  tasks: [{ id: 'legacy-task', title: 'Migrated linked task', course: 'TEST101', courseId: 'legacy-course', deadlineLocal: '2026-09-28T12:00', estimatedMinutes: null, remainingMinutes: null, remainingEstimate: { minMinutes: 241, maxMinutes: null }, deadlinePromptDismissed: true, completed: false }],
  sessions: [{ id: 'legacy-session', taskId: 'legacy-task', dateLocal: '2026-09-24', startTime: '10:00', endTime: '10:30' }],
  planner: { courses: [{ id: 'legacy-course', code: 'TEST101', name: 'Migration course', university: 'Test', semester: 'autumn', year: 2026, notes: '', sourceExtra: 'retained' }], events: [{ id: 'legacy-personal', title: 'Syntetisk avtale', activityKind: 'personal', courseId: '', dateLocal: '2026-10-04', start: '2026-10-04T10:00:00Z', end: '2026-10-04T11:00:00Z', location: '', notes: '', cancelled: false }], sources: [] },
  studyTimePreference: { kind: 'evening', label: 'På kvelden i ukedagene', days: [1, 2, 3, 4, 5], startTime: '18:00', endTime: '20:00' },
}

test('production API explicitly migrates once, persists exact relations and rejects stale writes', async ({ page }) => {
  for (const filename of ['manrope-0.ttf', 'manrope-1.ttf', 'manrope-2.ttf']) {
    const font = await page.request.get(`/fonts/${filename}`)
    expect(font.ok()).toBe(true)
    expect(font.headers()['content-type']).toBe('font/ttf')
    expect(font.headers()['x-content-type-options']).toBe('nosniff')
    expect((await font.body()).subarray(0, 4).toString('hex')).toBe('00010000')
  }
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

test('production API rejects malformed task and course lists without changing the saved revision', async ({ request }) => {
  const saved = await (await request.get('/api/state')).json()
  const envelopes = [
    { ...saved.envelope, tasks: [null] },
    { ...saved.envelope, tasks: {} },
    { ...saved.envelope, planner: { ...saved.envelope.planner, courses: {} } },
  ]
  const recovery = await (await request.get('/api/state/recovery')).json()
  for (const envelope of envelopes) {
    const data = { envelope, expectedRevision: saved.revision }
    for (const response of [await request.put('/api/state', { data }), await request.post('/api/state/replace', { data })]) {
      expect(response.status()).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid-envelope', message: 'Planen inneholder ugyldige data eller koblinger. Tidligere data er beholdt.' })
    }
    expect(await (await request.get('/api/state')).json()).toEqual(saved)
    expect(await (await request.get('/api/state/recovery')).json()).toEqual(recovery)
  }
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
    const importButton=page.getByRole('button', { name: 'Finn studieprogram', exact: true })
    if(await importButton.getAttribute('aria-expanded')!=='true')await importButton.click()
    await page.getByRole('button', { name: 'Studieprogram', exact: true }).click()
    const host = page.locator('.program-import')
    await host.locator('[name=institution]').selectOption('himolde')
    await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
    await host.locator('[name=program]').selectOption('0')
    await host.locator('[name=cohort]').selectOption('0')
    await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
    await host.locator('[name=model]').selectOption('common')
    await host.locator('[name=studySemester]').selectOption('1')
    await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
    await host.getByRole('button', { name: /^(Forbered og kontroller undervisning for|Forhåndsvis (?:1 emne|\d+ emner)|Velg emner$)/ }).click()
    await host.getByRole('button', { name: /^Legg til (?:1 emne|\d+ emner)$/ }).click()
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

test('SQLite exports 500 events and 11 undo entries to a restorable file and retains the earlier recovery', async ({ page }, info) => {
  // Several full-size HTTP/SQLite round trips share this test's time budget.
  test.setTimeout(240_000)
  const { legacy } = storageStressFixture()
  const sample = legacy.history.undo.at(-1)
  for (let i = 0; i < 8; i++) legacy.history.undo.push({ ...sample, id: `synthetic-sqlite-backup-undo-${i}` })
  expect(legacy.planner.events).toHaveLength(500)
  expect(legacy.history.undo).toHaveLength(11)
  expect(Buffer.byteLength(syntheticStorageBackup(legacy))).toBeGreaterThan(20_000_000)

  const readState = async () => (await page.request.get('/api/state')).json()
  const writeState = async envelope => {
    const { revision } = await readState()
    expect((await page.request.put('/api/state', { data: { expectedRevision: revision, envelope } })).ok()).toBe(true)
  }
  await writeState(legacy)
  await page.goto('/')
  await navigate(page, 'settings')
  const download = async name => {
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name, exact: true }).click()
    return readFile(await (await pending).path())
  }
  const file = await download('Eksporter sikkerhetskopi')
  expect(file.length).toBeLessThanOrEqual(20_000_000)
  expect(JSON.parse(file.toString()).data).toEqual(legacy)
  await info.attach('syntetisk-stor-sikkerhetskopi', { body: JSON.stringify({ events: 500, undo: 11, utf8Bytes: file.length }), contentType: 'application/json' })

  const empty = { schemaVersion: 1, tasks: [] }
  await writeState(empty)
  await page.reload()
  await navigate(page, 'settings')
  const preview = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting' })
  const restore = async file => {
    await page.locator('#backup-file').setInputFiles({ name: 'syntetisk-stor.json', mimeType: 'application/json', buffer: file })
    await expect(preview).toContainText('Undervisning:')
    await preview.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
    await expect(preview).not.toBeVisible()
  }
  await restore(file)
  await page.reload()
  await navigate(page, 'settings')
  const restored = await readState()
  expect(restored.envelope).toEqual(legacy)
  const readRecovery = async () => (await page.request.get('/api/state/recovery')).json()
  const recovery = await readRecovery()
  expect(recovery.recovery.data).toEqual(empty)
  await restore(file)
  await expect(page.locator('#settings-panel > [role=status]')).toContainText('Planen og eventuell tidligere gjenopprettingskopi er beholdt')
  expect(await readState()).toEqual(restored)
  expect(await readRecovery()).toEqual(recovery)

  const oversized = { ...legacy, syntheticPadding: 'x'.repeat(8_000_000) }
  await writeState(oversized)
  await page.reload()
  await navigate(page, 'settings')
  const unexpectedDownloads = []
  page.on('download', item => unexpectedDownloads.push(item))
  await page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
  await expect(page.locator('#settings-panel > [role=status]')).toContainText('Ingen fil ble lastet ned')
  expect(unexpectedDownloads).toHaveLength(0)
  const smaller = await download('Eksporter uten Angre-historikk')
  expect(smaller.length).toBeLessThan(20_000_000)
  const slimPlan = { ...oversized, history: { ...oversized.history, undo: [] } }
  expect(JSON.parse(smaller.toString()).data).toEqual(slimPlan)
  expect((await readState()).envelope).toEqual(oversized)
  await restore(smaller)
  await page.reload()
  expect((await readState()).envelope).toEqual(slimPlan)
})
