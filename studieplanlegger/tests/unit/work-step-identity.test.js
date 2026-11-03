import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeWork, validWorkLogs } from '../../src/work-log.js'
import { taskSteps, reorderWorkSteps, saveWorkSteps, removeWorkStep } from '../../src/work-steps.js'
import { getRemainingRange, setTaskSubmitted } from '../../src/tasks.js'
import { canStartTask } from '../../src/task-dependencies.js'
import { createReplan, applyReplan } from '../../src/replanning.js'
import { recordChange, undoLast } from '../../src/history.js'
import { createStorage, STORAGE_KEY, validEnvelope } from '../../src/storage.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { StateDatabase } from '../../server/database.js'

// Independent synthetic tasks, dates and temporary stores; no user data.
const now = new Date('2026-11-02T09:00:00Z')
const task = (patch = {}) => ({ id: 'synthetic-task', title: 'Syntetisk oppgave', course: '', deadlineLocal: '2026-11-03T16:00',
  estimatedMinutes: 60, remainingMinutes: 60, completed: false, requiresSubmission: true, submitted: false,
  steps: [
    { id: 'step-a', title: 'Samme stegtittel', estimatedMinutes: 30, completed: false },
    { id: 'step-b', title: 'Samme stegtittel', estimatedMinutes: 30, completed: false },
  ], ...patch })
const state = (patch = {}) => ({ schemaVersion: 1, tasks: [task()], sessions: [], ...patch })
const draft = (patch = {}) => ({ taskId: 'synthetic-task', operationId: 'synthetic-operation', stepId: 'step-a',
  outcome: 'more', actualMinutes: 30, remainingMinutes: 75, ...patch })
const close = (source, input) => closeWork(source, input, { now })
const browserStore = initial => {
  const values = new Map([[STORAGE_KEY, JSON.stringify(initial)]])
  const browser = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  return { values, browser }
}

describe('explicit work-step identity and independent task remainder', () => {
  it('clears waiting only for the captured unblocking step and restores it with the complete closeout on undo', () => {
    const original = task({ waitingReason: 'Avklar den syntetiske oppgaven', steps: task().steps.map(step =>
      step.id === 'step-a' ? { ...step, unblocksWaiting: true } : step) })
    const capturedId = taskSteps(original)[0].id
    const reordered = reorderWorkSteps(original, ['step-b', 'step-a']).task
    const initial = state({ tasks: [reordered], sessions: [{ id: 'keep-reservation', taskId: original.id,
      dateLocal: '2026-11-03', startTime: '10:00', endTime: '10:30' }] })
    const before = structuredClone(initial)
    const result = close(initial, draft({ stepId: capturedId, outcome: 'done' }))
    expect(result.ok).toBe(true)
    expect(result.state.tasks[0]).toMatchObject({ waitingReason: '', remainingMinutes: 60, completed: false, submitted: false })
    expect(result.state.tasks[0].steps.map(step => [step.id, step.completed])).toEqual([['step-b', false], ['step-a', true]])
    expect(canStartTask(result.state.tasks[0], result.state.tasks, { nextStep: true })).toBe(true)
    expect(result.state.sessions).toEqual(initial.sessions)
    expect(result.log).toMatchObject({ stepId: capturedId, stepCompleted: true, taskCompleted: false, taskSnapshot: reordered })
    expect(validEnvelope(result.state, { relations: true })).toBe(true)
    expect(initial).toEqual(before)
    const restored = undoLast(result.state, recordChange(initial, result.state, undefined, 'Syntetisk avklaringssteg', now))
    expect(restored.ok).toBe(true)
    expect(restored.state).toEqual(initial)
  })

  it.each([
    { stepId: 'step-b', outcome: 'done' },
    { stepId: 'step-a', outcome: 'more' },
    { stepId: 'step-a', outcome: 'not-started' },
    { stepId: undefined, outcome: 'done' },
  ])('does not infer a resolved wait from a different step or incomplete unblocking work: %j', input => {
    const initial = state({ tasks: [task({ waitingReason: 'Avklar den syntetiske oppgaven', steps: task().steps.map(step =>
      step.id === 'step-a' ? { ...step, unblocksWaiting: true } : step) })] })
    const result = close(initial, draft(input))
    expect(result.ok).toBe(true)
    expect(result.state.tasks[0].waitingReason).toBe(initial.tasks[0].waitingReason)
    expect(result.log.taskSnapshot).toEqual(initial.tasks[0])
    expect(validEnvelope(result.state, { relations: true })).toBe(true)
  })

  it.each(['done', 'more', 'not-started'])('retains the selected identity for %s even with equal step titles', outcome => {
    const initial = state(), before = structuredClone(initial)
    const result = close(initial, draft({ stepId: 'step-b', outcome }))
    expect(result.ok).toBe(true)
    expect(result.log).toMatchObject({ stepId: 'step-b', taskId: task().id, outcome, taskSnapshot: before.tasks[0] })
    expect(result.log).not.toHaveProperty('sessionId')
    expect(result.state.tasks[0].steps.map(step => step.completed)).toEqual([false, outcome === 'done'])
    expect(result.state.tasks[0].completed).toBe(false)
    expect(result.state.tasks[0].submitted).toBe(false)
    expect(result.log.actualMinutes).toBe(outcome === 'not-started' ? null : 30)
    expect(result.log.remainingMinutes).toBe(outcome === 'more' ? 75 : 60)
    expect(validEnvelope(result.state, { relations: true })).toBe(true)
    expect(initial).toEqual(before)
  })

  it.each([0, 1, 2])('keeps approved calendar work at task level with %i optional steps', count => {
    const initial = state({ tasks: [task({ steps: task().steps.slice(0, count) })],
      workWindows: [{ id: 'synthetic-window', start: '2026-11-02T10:00:00Z', end: '2026-11-02T12:00:00Z' }],
      planningPreferences: { minimumMinutes: 15, sessionMinutes: 30, maximumMinutes: 60, breakMinutes: 0 } })
    const preview = createReplan(initial, { now })
    expect(preview.ok).toBe(true)
    expect(initial.sessions).toEqual([])
    const approved = applyReplan(initial, preview, { now })
    expect(approved.ok).toBe(true)
    const session = approved.state.sessions[0]
    expect(session.taskId).toBe(task().id)
    expect(session).not.toHaveProperty('stepId')
    const result = closeWork(approved.state, draft({ stepId: undefined, sessionId: session.id }), { now: new Date('2026-11-02T10:31:00Z') })
    expect(result.ok).toBe(true)
    expect(result.log).toMatchObject({ taskId: task().id, sessionId: session.id, sessionSnapshot: session, actualMinutes: 30, remainingMinutes: 75 })
    expect(result.log).not.toHaveProperty('stepId')
    expect(result.state.tasks[0].steps).toEqual(initial.tasks[0].steps)
    expect(validEnvelope(result.state, { relations: true })).toBe(true)
  })

  for (const prior of [{ remainingMinutes: 60 }, { remainingMinutes: null, remainingEstimate: { minMinutes: 30, maxMinutes: 60 } }]) {
    it.each([
      { choice: 'exact', input: { remainingMinutes: '75' }, expected: { minMinutes: 75, maxMinutes: 75 } },
      { choice: 'range', input: { remainingMinutes: '', remainingEstimate: { minMinutes: 60, maxMinutes: 120 } }, expected: { minMinutes: 60, maxMinutes: 120 } },
      { choice: 'unknown', input: { remainingMinutes: '' }, expected: null },
    ])(`stores $choice independently of actual minutes after ${prior.remainingEstimate ? 'range' : 'exact'} remainder`, ({ input, expected }) => {
      const result = close(state({ tasks: [task(prior)] }), draft(input))
      expect(result.ok).toBe(true)
      expect(result.log.actualMinutes).toBe(30)
      expect(getRemainingRange(result.state.tasks[0])).toEqual(expected)
      expect(result.state.tasks[0].remainingMinutes).toBe(input.remainingEstimate || expected === null ? null : 75)
      if (!input.remainingEstimate) expect(result.state.tasks[0]).not.toHaveProperty('remainingEstimate')
      expect(validEnvelope(result.state, { relations: true })).toBe(true)
    })

    it(`preserves the ${prior.remainingEstimate ? 'range' : 'exact'} remainder on step-only completion`, () => {
      const initial = state({ tasks: [task(prior)] })
      const result = close(initial, draft({ outcome: 'done', remainingMinutes: 0 }))
      expect(result.ok).toBe(true)
      expect(getRemainingRange(result.state.tasks[0])).toEqual(getRemainingRange(initial.tasks[0]))
      expect(result.state.tasks[0].completed).toBe(false)
      if (prior.remainingEstimate) expect(result.state.tasks[0].remainingEstimate).toEqual(prior.remainingEstimate)
    })
  }

  it.each([
    { remainingMinutes: '-1' }, { remainingMinutes: '1.5' }, { remainingMinutes: 'mange' },
    { remainingEstimate: { minMinutes: 80, maxMinutes: 30 } }, { remainingEstimate: { minMinutes: -1, maxMinutes: 30 } },
  ])('rejects invalid explicitly chosen task remainder %j', invalid => {
    const initial = state(), before = structuredClone(initial)
    expect(close(initial, draft(invalid))).toMatchObject({ ok: false })
    expect(initial).toEqual(before)
  })

  it('completes the captured ID after reorder and rename and retains a readable immutable snapshot', () => {
    const initial = state(), capturedId = taskSteps(initial.tasks[0])[0].id
    const reordered = reorderWorkSteps(initial.tasks[0], ['step-b', 'step-a']).task
    const renamed = saveWorkSteps(reordered, reordered.steps.map(step => step.id === capturedId ? { ...step, title: 'Nytt navn på samme steg' } : step)).task
    const result = close(state({ tasks: [renamed] }), draft({ stepId: capturedId, outcome: 'done' }))
    expect(result.ok).toBe(true)
    expect(result.state.tasks[0].steps).toEqual([{ ...renamed.steps[0], completed: false }, { ...renamed.steps[1], completed: true }])
    const removed = removeWorkStep(result.state.tasks[0], capturedId).task
    const afterRemoval = { ...result.state, tasks: [removed] }
    expect(validEnvelope(afterRemoval, { relations: true })).toBe(true)
    expect(taskSteps(result.log.taskSnapshot).find(step => step.id === result.log.stepId).title).toBe('Nytt navn på samme steg')
    expect(validWorkLogs([{ ...result.log, stepId: 'unknown' }], afterRemoval)).toBe(false)
    expect(validWorkLogs([{ ...result.log, taskSnapshot: removed }], afterRemoval)).toBe(false)
  })

  it.each(['done', 'more', 'not-started'])('rejects missing, removed or already completed targets for %s without guessing', outcome => {
    const initial = state(), before = structuredClone(initial)
    for (const stepId of ['unknown', '', null, 1]) expect(close(initial, draft({ stepId, outcome }))).toMatchObject({ ok: false })
    expect(close(initial, draft({ stepId: undefined, stepOnly: true, outcome }))).toMatchObject({ ok: false })
    const removed = state({ tasks: [removeWorkStep(task(), 'step-a').task] })
    expect(close(removed, draft({ outcome }))).toMatchObject({ ok: false })
    const completed = state({ tasks: [task({ steps: task().steps.map(step => ({ ...step, completed: true })) })] })
    expect(close(completed, draft({ outcome }))).toMatchObject({ ok: false })
    expect(initial).toEqual(before)
  })

  it('honors the captured step dependencies, including whole-task completion', () => {
    const initial = state({ tasks: [task({ steps: task().steps.map(step => step.id === 'step-a' ? { ...step, dependencyIds: ['step-b'] } : step) })] })
    for (const completeTask of [false, true]) expect(close(initial, draft({ outcome: 'done', completeTask }))).toMatchObject({ ok: false, error: 'Fullfør stegets forutsetninger først.' })
  })

  it.each([
    { remainingMinutes: undefined },
    { remainingMinutes: null, remainingEstimate: { minMinutes: 60, maxMinutes: 60 } },
  ])('preserves the task estimate representation when only its step is completed: %j', remainder => {
    const initial = state({ tasks: [task(remainder)] })
    const result = close(initial, draft({ outcome: 'done' }))
    expect(result.ok).toBe(true)
    expect(result.state.tasks[0]).toEqual({ ...initial.tasks[0], steps: [{ ...initial.tasks[0].steps[0], completed: true }, initial.tasks[0].steps[1]] })
    expect(validEnvelope(result.state, { relations: true })).toBe(true)
  })

  it('keeps step, task and submission completion separate and requires reservation release confirmation', () => {
    const initial = state({ sessions: [{ id: 'future', taskId: task().id, dateLocal: '2026-11-02', startTime: '14:00', endTime: '14:30' }] })
    const stepped = close(initial, draft({ outcome: 'done' }))
    expect(stepped.ok).toBe(true)
    expect(stepped.state.sessions).toEqual(initial.sessions)
    expect(stepped.state.tasks[0]).toMatchObject({ remainingMinutes: 60, completed: false, submitted: false })
    expect(setTaskSubmitted(stepped.state.tasks, task().id, true).ok).toBe(false)
    const finish = draft({ operationId: 'finish-task', stepId: undefined, outcome: 'done' })
    expect(close(stepped.state, finish)).toMatchObject({ ok: false, requiresRelease: true, released: initial.sessions })
    const done = close(stepped.state, { ...finish, confirmRelease: true })
    expect(done.ok).toBe(true)
    expect(done.state.tasks[0]).toMatchObject({ remainingMinutes: 0, completed: true, submitted: false })
    expect(done.state.sessions).toEqual([])
    expect(setTaskSubmitted(done.state.tasks, task().id, true).tasks[0].submitted).toBe(true)
  })

  it.each(['more', 'done', 'not-started'])('repeats %s idempotently from its original snapshot and rejects changed targets', outcome => {
    const input = draft({ outcome }), saved = close(state(), input)
    expect(saved.ok).toBe(true)
    const changed = { ...saved.state, tasks: [task({ remainingMinutes: 999, steps: [] })] }
    expect(close(changed, input)).toMatchObject({ ok: true, repeated: true, state: changed, log: saved.log })
    for (const stepId of ['step-b', undefined]) expect(close(changed, { ...input, stepId }).ok).toBe(false)
    expect(changed.workLogs).toHaveLength(1)
  })

  it('isolates the completed task, its nested fields and snapshot from subsequent mutations', () => {
    const initial = state({ tasks: [task({ remainingMinutes: null, remainingEstimate: { minMinutes: 30, maxMinutes: 60 }, dependencyIds: ['synthetic-prerequisite'] }),
      task({ id: 'synthetic-prerequisite', completed: true })] })
    const before = structuredClone(initial), result = close(initial, draft({ outcome: 'done' }))
    expect(result.ok).toBe(true)
    const completed = result.state.tasks[0]
    expect(completed.remainingEstimate).not.toBe(initial.tasks[0].remainingEstimate)
    expect(completed.dependencyIds).not.toBe(initial.tasks[0].dependencyIds)
    completed.remainingEstimate.maxMinutes = 120
    completed.dependencyIds.push('synthetic-other-prerequisite')
    completed.steps[0].title = 'Endret etter fullføring'
    result.log.taskSnapshot.remainingEstimate.minMinutes = 10
    expect(initial).toEqual(before)
    initial.tasks[0].remainingEstimate.minMinutes = 5
    expect(completed.remainingEstimate.minMinutes).toBe(30)
    expect(result.log.taskSnapshot.remainingEstimate.minMinutes).toBe(10)
  })

  it.each([false, true])('records completion scope at zero remainder and rejects its reversal from %s', completeTask => {
    const initial = state({ tasks: [task({ remainingMinutes: 0 })] })
    const input = draft({ outcome: 'done', completeTask }), saved = close(initial, input)
    expect(saved.ok).toBe(true)
    expect(saved.log).toMatchObject({ remainingMinutes: 0, stepCompleted: true, taskCompleted: completeTask })
    expect(saved.state.tasks[0].completed).toBe(completeTask)
    expect(close(saved.state, input)).toMatchObject({ ok: true, repeated: true, state: saved.state })
    expect(close(saved.state, { ...input, completeTask: !completeTask })).toMatchObject({ ok: false })
    const later = { ...saved.state, tasks: [task({ title: 'Endret senere', remainingMinutes: 999, steps: [] })] }
    expect(close(later, input)).toMatchObject({ ok: true, repeated: true, state: later, log: saved.log })
    expect(close(later, { ...input, completeTask: !completeTask })).toMatchObject({ ok: false })
    expect(later.workLogs).toHaveLength(1)
  })

  it('validates explicit completion scope and linked step completion while retaining unmodified historical logs', () => {
    const saved = close(state(), draft({ outcome: 'done' })).state
    const log = saved.workLogs[0], backup = exportBackup(saved, now)
    for (const patch of [
      { taskCompleted: 'false' }, { taskCompleted: true }, { taskCompleted: false, historyComplete: true },
      { stepCompleted: false }, { stepCompleted: undefined },
      { outcome: 'more', stepCompleted: undefined, taskCompleted: true, remainingMinutes: 0 },
      { outcome: 'not-started', stepCompleted: undefined, taskCompleted: true, actualMinutes: null, remainingMinutes: 0 },
    ]) {
      const invalid = { ...log, ...patch }
      expect(validWorkLogs([invalid])).toBe(false)
      expect(previewBackup(JSON.stringify({ ...backup, data: { ...saved, workLogs: [invalid] } }), saved).ok).toBe(false)
    }
    const whole = close(state(), draft({ outcome: 'done', stepId: undefined })).log
    expect(validWorkLogs([{ ...whole, taskCompleted: false }])).toBe(false)
    const historical = structuredClone(log)
    delete historical.stepId
    delete historical.taskCompleted
    delete historical.stepCompleted
    const historicalState = { ...saved, workLogs: [historical] }, { browser, values } = browserStore(historicalState)
    const raw = values.get(STORAGE_KEY), storage = createStorage(() => browser)
    expect(storage.read().ok).toBe(true)
    expect(storage.snapshot()).toEqual(historicalState)
    expect(values.get(STORAGE_KEY)).toBe(raw)
    const restored = previewBackup(JSON.stringify(exportBackup(historicalState, now)), state({ tasks: [] }))
    expect(restored.ok).toBe(true)
    expect(restored.data.workLogs).toEqual([historical])
  })
})

describe('work identity preservation across history and real storage adapters', () => {
  it('keeps known identities through replan/apply/undo without attributing task reservations to a step', () => {
    const initial = state({ workWindows: [{ id: 'synthetic-window', start: '2026-11-02T10:00:00Z', end: '2026-11-02T12:00:00Z' }] })
    const logged = close(initial, draft()).state
    const preview = createReplan(logged, { now }), applied = applyReplan(logged, preview, { now })
    expect(applied.ok).toBe(true)
    expect(applied.state.sessions.length).toBeGreaterThan(0)
    expect(applied.state.sessions.every(session => !Object.hasOwn(session, 'stepId'))).toBe(true)
    const history = recordChange(logged, applied.state, undefined, 'Syntetisk omplanlegging', now)
    const restored = undoLast(applied.state, history)
    expect(restored.ok).toBe(true)
    expect(restored.state.workLogs).toEqual(logged.workLogs)
    expect(restored.state.tasks).toEqual(logged.tasks)
    expect(restored.state.sessions).toEqual(logged.sessions)
    const closeHistory = recordChange(initial, logged, undefined, 'Syntetisk utfall', now)
    const undoneClose = undoLast(logged, closeHistory)
    expect(undoneClose.ok).toBe(true)
    expect(undoneClose.state).toEqual(initial)
  })

  it('retains absent historical identity and legacy snapshots without a migration write on read', () => {
    const legacyTask = task({ steps: undefined, nextStep: { description: 'Eldre syntetisk steg', estimatedMinutes: 30 } })
    delete legacyTask.steps
    const oldLog = { id: 'old-log', operationId: 'old-operation', taskId: legacyTask.id, outcome: 'done', at: now.toISOString(),
      actualMinutes: 10, plannedMinutes: 30, remainingMinutes: 60, interrupted: false, historyComplete: false, stepCompleted: true, taskSnapshot: structuredClone(legacyTask) }
    const initial = state({ tasks: [legacyTask], workLogs: [oldLog] }), { browser, values } = browserStore(initial)
    const raw = values.get(STORAGE_KEY), storage = createStorage(() => browser)
    expect(storage.read().ok).toBe(true)
    expect(storage.snapshot()).toEqual(initial)
    expect(values.get(STORAGE_KEY)).toBe(raw)
    const explicitId = taskSteps(legacyTask)[0].id
    const logged = close(storage.snapshot(), draft({ stepId: explicitId }))
    expect(logged.ok).toBe(true)
    expect(logged.state.tasks[0]).not.toHaveProperty('nextStep')
    expect(logged.state.tasks[0].steps[0].id).toBe(explicitId)
    expect(logged.log.taskSnapshot).toEqual(legacyTask)
    expect(logged.state.workLogs[0]).toEqual(oldLog)
    expect(logged.state.workLogs[0]).not.toHaveProperty('stepId')
    const backup = previewBackup(JSON.stringify(exportBackup(logged.state, now)), state({ tasks: [] }))
    expect(backup.ok).toBe(true)
    expect(backup.data.workLogs).toEqual(logged.state.workLogs)
  })

  it('round-trips new/old logs, immutable snapshots and undo through browser storage, backup restore and SQLite reopening', () => {
    const initial = state(), logged = close(initial, draft()).state
    const old = { ...logged.workLogs[0], id: 'historical-log', operationId: 'historical-operation' }
    delete old.stepId
    logged.workLogs.push(old)
    const history = recordChange(initial, logged, undefined, 'Syntetisk arbeid', now)
    const editedTask = removeWorkStep(logged.tasks[0], 'step-a').task
    const saved = { ...logged, tasks: [editedTask], history }
    const { browser, values } = browserStore(initial), storage = createStorage(() => browser)
    expect(storage.read().ok).toBe(true)
    expect(storage.writeEnvelope(saved).ok).toBe(true)
    const reloaded = createStorage(() => browser)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(saved)
    const backup = previewBackup(JSON.stringify(exportBackup(saved, now)), initial)
    expect(backup.ok).toBe(true)
    expect(backup.data).toEqual(saved)
    expect(reloaded.replace(initial).ok).toBe(true)
    expect(reloaded.replace(backup.data).ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(saved)
    expect(reloaded.recovery().data).toEqual(initial)
    const invalid = structuredClone(saved); invalid.workLogs[0].stepId = 'unknown'
    const before = values.get(STORAGE_KEY)
    expect(reloaded.writeEnvelope(invalid)).toMatchObject({ ok: false })
    expect(values.get(STORAGE_KEY)).toBe(before)
    expect(previewBackup(JSON.stringify({ ...exportBackup(saved, now), data: invalid }), saved).ok).toBe(false)
    const invalidHistory = structuredClone(saved)
    invalidHistory.history.undo[0].changes.find(change => change.path === 'workLogs').after.stepId = 'unknown'
    expect(validEnvelope(invalidHistory, { relations: true })).toBe(false)

    const directory = mkdtempSync(join(tmpdir(), 'ajour-synthetic-step-identity-')), filename = join(directory, 'test.sqlite')
    let database
    try {
      database = new StateDatabase(filename)
      database.save(initial, 0)
      database.save(saved, 1, { snapshot: true }); database.close()
      database = new StateDatabase(filename)
      expect(database.read()).toEqual({ revision: 2, envelope: saved })
      expect(database.recovery().data).toEqual(initial)
      expect(() => database.save(invalid, 2)).toThrow()
      expect(database.read()).toEqual({ revision: 2, envelope: saved })
      database.save(backup.data, 2, { snapshot: true }); database.close()
      database = new StateDatabase(filename)
      expect(database.read().envelope).toEqual(saved)
      expect(database.db.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok')
      expect(database.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally { database?.close(); rmSync(directory, { recursive: true, force: true }) }
  })
})
