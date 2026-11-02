import { describe, expect, it } from 'vitest'
import { exportBackup, previewBackup, withoutConnections } from '../../src/backup.js'
import { validEnvelope } from '../../src/storage.js'
import { parseDocumentIcs, parseDocumentText } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit } from '../../src/import-preview.js'
import { closeWork } from '../../src/work-log.js'
import { recordChange, undoLast, restoreTrash } from '../../src/history.js'
import { taskSteps } from '../../src/work-steps.js'

const now = new Date('2026-09-12T10:00:00Z')
const secret = 'SYNTHETIC_CREDENTIAL_9147'
function importedState(parameter, { legacyId = false } = {}) {
  const url = `https://calendar.example.invalid/private.ics?${parameter}=${secret}`
  const taskId = legacyId ? `legacy:${url}` : 'a'
  const task = { id: taskId, title: 'Read', course: 'TEST101', courseId: 'c', deadlineLocal: '2026-09-14T12:00', estimatedMinutes: null, remainingMinutes: 90, completed: false, notes: `Calendar reference ${secret}` }
  let state = { schemaVersion: 1, tasks: [task, { ...task, id: 'b', title: 'Write', notes: '', dependencyIds: [taskId] }], sessions: [{ id: 'planned', taskId, dateLocal: '2026-09-12', startTime: '10:00', endTime: '10:30' }], planner: {
    courses: [{ id: 'c', code: 'TEST101', name: 'Isolated', university: 'Test', semester: 'autumn', year: 2026, notes: '' }], events: [],
    sources: [{ id: 'source', courseId: 'c', kind: 'url', url, name: 'Private calendar', groups: [], lastUpdated: now.toISOString(), lastError: `Failure ${url} ${secret}`, autoRefresh: true }],
  } }
  const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:isolated-event', 'DTSTART:20260914T080000Z', 'DTEND:20260914T090000Z', 'SUMMARY:Teaching', `DESCRIPTION:Calendar reference ${secret} ${url}`, 'X-GROUP:Explicit test class', 'END:VEVENT', 'BEGIN:VTODO', 'UID:isolated-deadline', `SUMMARY:Check calendar ${secret}`, 'DUE:20260916T100000Z', 'END:VTODO', 'END:VCALENDAR'].join('\r\n')
  const documents = [parseDocumentIcs(text, { year: 2026, semester: 'autumn' }), parseDocumentText(`Oppgave: Kontroller kalenderreferanse ${secret}`)].map((parsed, index) => ({ ...parsed, contentHash: String(index + 1).repeat(64), fileName: 'Isolated calendar' }))
  for (const parsed of documents) {
    const preview = createDocumentImportPreview(state, parsed)
    preview.rows.forEach(row => { row.selected = true })
    const imported = buildDocumentImportCommit(state, preview, { now })
    expect(imported.ok).toBe(true)
    state = imported.state
  }
  expect(validEnvelope(state, { relations: true })).toBe(true)
  return { before: state, taskId, url, documents }
}

describe('A14 portable privacy across connected records', () => {
  for (const taskId of ['https://example.invalid/synthetic-task/1', secret]) {
    for (const collision of [false, true]) {
      it.each(['more', 'not-started'])(`preserves legacy identity after task aliasing (${taskId}, collision ${collision}, %s)`, outcome => {
        const task = { id: taskId, title: `Syntetisk oppgave token=${secret}`, course: '', deadlineLocal: '',
          estimatedMinutes: 60, remainingMinutes: 60, completed: false,
          nextStep: { description: 'Eldre syntetisk steg', estimatedMinutes: 30 },
          ...(collision ? { steps: [{ id: `${taskId}:legacy-next-step`, title: 'Syntetisk kollisjon', completed: true }] } : {}) }
        const stepId = taskSteps(task).at(-1).id
        expect(stepId).toBe(`${taskId}:legacy-next-step${collision ? ':2' : ''}`)
        const session = { id: 'synthetic-legacy-session', taskId, dateLocal: '2026-09-12', startTime: '10:00', endTime: '10:30' }
        const historical = { id: 'synthetic-old-log', operationId: 'synthetic-old-operation', taskId, at: now.toISOString(),
          outcome: 'more', actualMinutes: 5, plannedMinutes: null, remainingMinutes: 60,
          interrupted: false, historyComplete: false, taskSnapshot: structuredClone(task) }
        const before = { schemaVersion: 1, tasks: [task], sessions: [session], workLogs: [historical] }
        const closed = closeWork(before, { taskId, stepId, sessionId: session.id, operationId: 'synthetic-legacy-close', outcome, actualMinutes: 0, remainingMinutes: 75 }, { now })
        expect(closed.ok).toBe(true)
        const state = { ...closed.state, history: recordChange(before, closed.state, undefined, 'Syntetisk legacyutfall', now) }
        const original = structuredClone(state), backup = exportBackup(state, now)
        expect(JSON.stringify(backup)).not.toContain(secret)
        const restored = previewBackup(JSON.stringify(backup), { schemaVersion: 1, tasks: [] })
        expect(restored.ok).toBe(true)
        expect(state).toEqual(original)
        expect(state.workLogs[0]).not.toHaveProperty('stepId')
        expect(state.workLogs[1].taskSnapshot.nextStep).toEqual(task.nextStep)
        const data = restored.data, log = data.workLogs[1], exportedId = log.stepId
        expect(data.tasks[0].id).toMatch(/^export-id-/)
        expect(exportedId).toMatch(/^export-id-/)
        expect(taskSteps(data.tasks[0]).at(-1).id).toBe(exportedId)
        expect(taskSteps(log.taskSnapshot).at(-1).id).toBe(exportedId)
        expect(data.workLogs[0]).not.toHaveProperty('stepId')
        expect(taskSteps(data.workLogs[0].taskSnapshot).at(-1).id).toBe(exportedId)
        expect(log.taskId).toBe(data.tasks[0].id)
        expect(log.sessionSnapshot.taskId).toBe(data.tasks[0].id)
        for (const entry of [...data.history.undo, ...data.history.trash]) {
          const historicalLog = entry.changes.find(change => change.path === 'workLogs').after
          expect(historicalLog.stepId).toBe(exportedId)
          expect(taskSteps(historicalLog.taskSnapshot).at(-1).id).toBe(exportedId)
          for (const change of entry.changes.filter(change => change.path === 'tasks')) {
            expect(taskSteps(change.before).at(-1).id).toBe(exportedId)
            expect(taskSteps(change.after).at(-1).id).toBe(exportedId)
          }
        }
        expect(data.history.trash).toHaveLength(1)
        for (const undone of [undoLast(data, data.history), restoreTrash(data, data.history, data.history.trash[0].id)]) {
          expect(undone.ok).toBe(true)
          expect(taskSteps(undone.state.tasks[0]).at(-1).id).toBe(exportedId)
          expect(undone.state.workLogs).toHaveLength(1)
          expect(undone.state.workLogs[0]).not.toHaveProperty('stepId')
          expect(validEnvelope({ ...undone.state, history: undone.history }, { relations: true })).toBe(true)
        }
      })
    }
  }

  // Deliberately synthetic credential markers exercise structural IDs versus
  // free text, including aliases for whole-token and URL-bearing identities.
  it.each([
    [`step ${secret} suffix`, false],
    [secret, true],
    [`step:https://calendar.example.invalid/synthetic.ics?token=${secret}`, true],
  ])('keeps explicit step identity consistent through portable snapshots and history: %s', (stepId, rekeyed) => {
    const task = { id: 'synthetic-step-task', title: `Syntetisk oppgave token=${secret}`, course: '', deadlineLocal: '',
      estimatedMinutes: 60, remainingMinutes: 60, completed: false, steps: [
        { id: stepId, title: 'Syntetisk første steg', completed: false, estimatedMinutes: 30 },
        { id: 'synthetic-dependent-step', title: 'Syntetisk neste steg', completed: false, dependencyIds: [stepId] },
      ] }
    const before = { schemaVersion: 1, tasks: [task] }
    const closed = closeWork(before, { taskId: task.id, stepId, operationId: 'synthetic-step-close', outcome: 'more', actualMinutes: 30, remainingMinutes: 75 }, { now })
    expect(closed.ok).toBe(true)
    const state = { ...closed.state, history: recordChange(before, closed.state, undefined, 'Syntetisk stegutfall', now) }
    const original = structuredClone(state)
    expect(validEnvelope(state, { relations: true })).toBe(true)
    const backup = exportBackup(state, now)
    const restored = previewBackup(JSON.stringify(backup), { schemaVersion: 1, tasks: [] })
    expect(restored.ok).toBe(true)
    expect(state).toEqual(original)
    const exportedId = restored.data.tasks[0].steps[0].id
    if (rekeyed) {
      expect(exportedId).toMatch(/^export-id-/)
      expect(JSON.stringify(backup)).not.toContain(secret)
    } else expect(exportedId).toBe(stepId)
    expect(restored.data.tasks[0].title).not.toContain(secret)
    expect(restored.data.tasks[0].steps[1].dependencyIds).toEqual([exportedId])
    const log = restored.data.workLogs[0]
    expect(log.stepId).toBe(exportedId)
    expect(log.taskSnapshot.steps[0].id).toBe(exportedId)
    expect(log.taskSnapshot.title).not.toContain(secret)
    const changes = restored.data.history.undo[0].changes
    const historicalLog = changes.find(change => change.path === 'workLogs').after
    expect(historicalLog.stepId).toBe(exportedId)
    expect(historicalLog.taskSnapshot.steps[0].id).toBe(exportedId)
    const historicalTask = changes.find(change => change.path === 'tasks')
    expect(historicalTask.before.steps[0].id).toBe(exportedId)
    expect(historicalTask.after.steps[0].id).toBe(exportedId)
    const undone = undoLast(restored.data, restored.data.history)
    expect(undone.ok).toBe(true)
    expect(undone.state.tasks[0].steps[0].id).toBe(exportedId)
    expect(undone.state.tasks[0].remainingMinutes).toBe(60)
    expect(undone.state.workLogs).toBeUndefined()
    expect(validEnvelope({ ...undone.state, history: undone.history }, { relations: true })).toBe(true)
  })

  it('redacts credential-bearing URL fragments and their encoded/repeated values while keeping ordinary anchors', () => {
    const { before } = importedState('access_token')
    const fragmentUrl = `https://calendar.example.invalid/private.ics#access_token=${secret}&token=${secret}`
    before.planner.sources[0].url = fragmentUrl
    before.tasks[0].notes = `${fragmentUrl} ${encodeURIComponent(secret)} ${secret} ${secret} https://docs.example.invalid/guide#section-2`
    before.importSources[0].warnings = [`Could not read ${fragmentUrl}`]
    const backup = exportBackup(before, now)
    const serialized = JSON.stringify(backup)
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain(encodeURIComponent(secret))
    expect(serialized).not.toContain('calendar.example.invalid')
    expect(serialized).toContain('https://docs.example.invalid/guide#section-2')
    expect(validEnvelope(backup.data, { relations: true })).toBe(true)
  })

  it.each(['access_token', 'pwd'])('redacts %s credentials in imported baselines, work snapshots, undo and trash without losing the plan', parameter => {
    const { before, taskId, url } = importedState(parameter)
    const closed = closeWork(before, { taskId, sessionId: 'planned', operationId: 'isolated-op', outcome: 'more', actualMinutes: '30', remainingMinutes: '45' }, { now })
    expect(closed.ok).toBe(true)
    const after = closed.state
    after.history = recordChange(before, after, undefined, `Close session from ${url}`, now)
    const original = structuredClone(after), backup = exportBackup(after, now)
    expect(JSON.stringify(backup)).not.toContain(secret)
    expect(JSON.stringify(backup)).not.toContain(secret.toLocaleLowerCase('nb-NO'))
    expect(JSON.stringify(backup)).not.toContain('calendar.example.invalid')
    expect(after).toEqual(original)
    const restored = previewBackup(JSON.stringify(backup), { schemaVersion: 1, tasks: [] })
    expect(restored.ok).toBe(true)
    expect(validEnvelope(restored.data, { relations: true })).toBe(true)
    expect(restored.data.tasks[1].dependencyIds).toEqual([taskId])
    expect(restored.data.workLogs).toHaveLength(1)
    expect(restored.data.workLogs[0]).toMatchObject({ actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 45, taskId })
    expect(restored.data.importSources).toHaveLength(2)
    expect(restored.data.importSources.map(source => source.entries.length)).toEqual([2, 1])
    expect(restored.data.planner.events[0]).toMatchObject({ start: '2026-09-14T08:00:00.000Z', end: '2026-09-14T09:00:00.000Z' })
    expect(restored.data.planner.sources[0]).toMatchObject({ reconnectRequired: true, autoRefresh: false })
    expect(restored.data.planner.sources[0]).not.toHaveProperty('url')
    expect(restored.data.planner.sources[0]).not.toHaveProperty('lastError')
    const undone = undoLast(restored.data, restored.data.history)
    expect(undone.ok).toBe(true)
    expect(undone.state.tasks).toEqual(withoutConnections(before).tasks)
    expect(undone.state.sessions).toEqual(before.sessions)
    expect(undone.state.workLogs).toBeUndefined()
    expect(undone.state.importSources).toEqual(restored.data.importSources)
    const deleted = structuredClone(after)
    deleted.planner.events = []
    deleted.history = recordChange(after, deleted, after.history, 'Remove imported event', now)
    const portable = exportBackup(deleted, now).data
    const trash = restoreTrash(portable, portable.history, portable.history.trash.at(-1).id)
    expect(trash.ok).toBe(true)
    expect(trash.state.planner.events).toEqual(restored.data.planner.events)
    expect(validEnvelope({ ...trash.state, history: trash.history }, { relations: true })).toBe(true)
    expect(JSON.stringify(trash)).not.toContain(secret)
  })

  it('keeps dependency, work-log and session references together when a legacy ID contains a private URL', () => {
    const { before, taskId } = importedState('pwd', { legacyId: true })
    const closed = closeWork(before, { taskId, sessionId: 'planned', operationId: 'isolated-op', outcome: 'more', actualMinutes: '30', remainingMinutes: '' }, { now })
    const state = closed.state
    state.history = recordChange(before, state, undefined, 'Close legacy task', now)
    const restored = previewBackup(JSON.stringify(exportBackup(state, now)), { schemaVersion: 1, tasks: [] })
    expect(restored.ok).toBe(true)
    const exportedId = restored.data.tasks[0].id
    expect(exportedId).toMatch(/^export-id-/)
    expect(restored.data.tasks[1].dependencyIds).toEqual([exportedId])
    expect(restored.data.workLogs[0].taskId).toBe(exportedId)
    expect(restored.data.workLogs[0].taskSnapshot.id).toBe(exportedId)
    expect(restored.data.workLogs[0].sessionSnapshot.taskId).toBe(exportedId)
    expect(restored.data.tasks[0].remainingMinutes).toBeNull()
    const undone = undoLast(restored.data, restored.data.history)
    expect(undone.ok).toBe(true)
    expect(undone.state.sessions[0].taskId).toBe(exportedId)
    expect(JSON.stringify(undone)).not.toContain(secret)
  })

  it('reimports restored sources by stable identity and requires clarification for a changed text row', () => {
    const { before, documents } = importedState('pwd')
    const state = previewBackup(JSON.stringify(exportBackup(before, now)), { schemaVersion: 1, tasks: [] }).data
    const ids = state.tasks.map(task => task.id), eventIds = state.planner.events.map(event => event.id)
    const calendar = createDocumentImportPreview(state, documents[0])
    expect(calendar.sourceId).toBe(state.importSources[0].id)
    expect(calendar.rows.every(row => !['?', 'new'].includes(row.matchChoice))).toBe(true)
    calendar.rows.forEach(row => { row.selected = true })
    const repeated = buildDocumentImportCommit(state, calendar, { now })
    expect(repeated.ok).toBe(true)
    expect(repeated.counts.added).toBe(0)
    expect(repeated.state.tasks.map(task => task.id)).toEqual(ids)
    expect(repeated.state.planner.events.map(event => event.id)).toEqual(eventIds)
    const changed = { ...parseDocumentText(`Oppgave: Kontroller kalenderreferanse ${secret} og dato`), contentHash: '3'.repeat(64) }
    const source = state.importSources[1], preview = createDocumentImportPreview(state, changed, { sourceId: source.id })
    expect(preview.rows[0].matchChoice).toBe('?')
    expect(preview.rows[0].matchCandidates.map(item => item.targetId)).toEqual([source.entries[0].targetId])
    const original = structuredClone(state)
    expect(buildDocumentImportCommit(state, preview, { now }).ok).toBe(false)
    expect(state).toEqual(original)
    preview.rows[0].matchChoice = source.entries[0].key
    const clarified = buildDocumentImportCommit(state, preview, { now })
    expect(clarified.ok).toBe(true)
    expect(clarified.counts.added).toBe(0)
    expect(clarified.state.tasks.map(task => task.id)).toEqual(ids)
    expect(validEnvelope(clarified.state, { relations: true })).toBe(true)
  })
})
