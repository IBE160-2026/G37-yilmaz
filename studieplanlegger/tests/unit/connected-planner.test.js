import { describe, it, expect, vi } from 'vitest'
import { validateDraft, editTask, getRemainingMinutes, selectTasksForMinutes, completeNextStep, deleteTask } from '../../src/tasks.js'
import { validateDependencyGraph, taskBlockers } from '../../src/task-dependencies.js'
import { closeWork, purgeWorkHistory } from '../../src/work-log.js'
import { createStorage, validEnvelope } from '../../src/storage.js'
import { recordChange, undoLast } from '../../src/history.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { createReplan, applyReplan } from '../../src/replanning.js'
import { completedWorkSamples, personalEstimate } from '../../src/personal-estimates.js'
import { deriveWorkCapacity } from '../../src/work-capacity.js'

const now = new Date('2026-09-09T07:00:00Z')
const task = (id = 'task', patch = {}) => ({ id, title: `Arbeid ${id}`, course: '', estimatedMinutes: 120, remainingMinutes: 45, deadlineLocal: '2026-09-11T16:00', completed: false, ...patch })
const session = (id = 'missed', patch = {}) => ({ id, taskId: 'task', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30', ...patch })
const initial = (patch = {}) => ({ schemaVersion: 1, tasks: [task()], sessions: [session()], workWindows: [{ id: 'thursday', start: '2026-09-10T08:00:00Z', end: '2026-09-10T10:00:00Z' }], ...patch })
const closure = (state, patch = {}) => closeWork(state, { taskId: 'task', sessionId: 'missed', operationId: 'op-1', outcome: 'more', actualMinutes: '30', remainingMinutes: '45', ...patch }, { now })

describe('connected quick capture and dependency graph', () => {
  it('A04 saves a title alone; explicit unknown overrides an old positive estimate; zero is open', () => {
    const saved = validateDraft({ title: 'Les teksten' }, 'quick')
    expect(saved.ok).toBe(true); expect(saved.task).toMatchObject({ course: '', deadlineLocal: '', estimatedMinutes: null, completed: false })
    const old = task('legacy'); delete old.remainingMinutes
    expect(getRemainingMinutes(old)).toBe(120)
    const edited = editTask([old], old.id, { ...old, estimatedMinutes: '120', remainingMinutes: '' }).tasks[0]
    expect(getRemainingMinutes(edited)).toBeNull(); expect(edited.estimatedMinutes).toBe(120)
    expect(getRemainingMinutes(task('zero', { remainingMinutes: 0 }))).toBe(0)
    expect(task('zero', { remainingMinutes: 0 }).completed).toBe(false)
  })
  it('A12 rejects whole-graph cycles; deletion keeps explicit missing prerequisite and undo restores both', () => {
    const before = initial({ tasks: [task('a'), task('b', { dependencyIds: ['a'] })], sessions: [] })
    expect(validateDependencyGraph([task('a', { dependencyIds: ['b'] }), task('b', { dependencyIds: ['a'] })]).ok).toBe(false)
    const after = { ...before, tasks: deleteTask(before.tasks, 'a').tasks }
    expect(after.tasks[0].missingDependencyIds).toEqual(['a']); expect(taskBlockers(after.tasks[0], after.tasks)[0].missing).toBe(true)
    const restored = undoLast(after, recordChange(before, after))
    expect(restored.ok).toBe(true); expect(restored.state.tasks).toEqual(before.tasks)
  })
  it('A12 offers a registered 20-minute step on 240-minute work and a real unblocking action', () => {
    const before = task('a', { remainingMinutes: 240, nextStep: { description: 'Les oppgaveteksten', estimatedMinutes: 20 } })
    expect(selectTasksForMinutes([before], 30)).toEqual([before])
    const waiting = { ...before, waitingReason: 'Avklar innhold', nextStep: { ...before.nextStep, unblocksWaiting: true } }
    expect(selectTasksForMinutes([waiting], 30)).toEqual([waiting])
    expect(completeNextStep([waiting], waiting.id).tasks[0].waitingReason).toBe('')
    expect(selectTasksForMinutes([{ ...waiting, nextStep: { ...waiting.nextStep, unblocksWaiting: false } }], 30)).toEqual([])
    const blocked = task('b', { dependencyIds: ['a'], nextStep: { description: 'Skriv', estimatedMinutes: 10 } })
    expect(selectTasksForMinutes([before, blocked], 30).map(item => item.id)).toEqual(['a'])
  })
})

describe('connected atomic work closure and privacy', () => {
  it('A07 records actual 30 and remaining 45 independently from planned 30/original 120 and idempotently reloads', () => {
    const before = initial(), result = closure(before)
    expect(result.ok).toBe(true); expect(result.state.workLogs[0]).toMatchObject({ actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 45 })
    expect(result.state.tasks[0]).toMatchObject({ estimatedMinutes: 120, remainingMinutes: 45, completed: false })
    expect(result.state.sessions).toEqual([]); expect(before.sessions).toHaveLength(1)
    const again = closure(JSON.parse(JSON.stringify(result.state)))
    expect(again.repeated).toBe(true); expect(again.state.workLogs).toHaveLength(1)
    expect(closure(before, { remainingMinutes: '' }).state.tasks[0].remainingMinutes).toBeNull()
    expect(closure(result.state, { remainingMinutes: '46' })).toMatchObject({ ok: false, error: expect.stringContaining('allerede brukt') })
    expect(closure(result.state, { operationId: 'different-operation', remainingMinutes: '45' })).toMatchObject({ ok: false, error: expect.stringContaining('allerede brukt') })
  })
  it('A08 skipped work records no actual minutes, progress or productive sample even when a time was typed', () => {
    const before = initial(), result = closure(before, { outcome: 'not-started', actualMinutes: '30', historyComplete: true })
    expect(result.state.tasks).toEqual(before.tasks)
    expect(result.state.workLogs[0]).toMatchObject({ actualMinutes: null, historyComplete: false, outcome: 'not-started' })
    expect(personalEstimate(result.state, before.tasks[0], { kind: 'session' }).count).toBe(0)
  })
  it('A11 confirmation releases all future reservations and one undo restores the full connected operation', () => {
    const before = initial({ sessions: [session(), session('future', { dateLocal: '2026-09-10', locked: true })], tasks: [task('task', { requiresSubmission: true, submitted: false })] })
    expect(closure(before, { outcome: 'done' }).requiresRelease).toBe(true)
    const closed = closure(before, { outcome: 'done', confirmRelease: true }).state
    expect(closed.tasks[0]).toMatchObject({ completed: true, submitted: false, remainingMinutes: 0 })
    expect(closed.sessions).toEqual([])
    const undo = undoLast(closed, recordChange(before, closed))
    expect(undo.ok).toBe(true); expect(undo.state).toEqual(before)
  })
  it('A14 old data is not written on load; failed closeout writes leave all stored records untouched', () => {
    const before = initial(), raw = JSON.stringify(before), backing = { getItem: () => raw, setItem: vi.fn(() => { throw new Error('quota') }) }, storage = createStorage(() => backing)
    expect(storage.read().ok).toBe(true); expect(backing.setItem).not.toHaveBeenCalled()
    const closed = closure(before).state; closed.history = recordChange(before, closed)
    expect(storage.writeEnvelope(closed).reason).toBe('unwritable'); expect(storage.snapshot()).toEqual(before); expect(backing.setItem).toHaveBeenCalledTimes(1)
  })
  it('refuses persisted dangling relations during read without rewriting user data', () => {
    const dangling = initial({ sessions: [session('orphan', { taskId: 'missing' })] }), raw = JSON.stringify(dangling)
    const backing = { getItem: () => raw, setItem: vi.fn() }, storage = createStorage(() => backing)
    expect(storage.read()).toEqual({ ok: false, reason: 'invalid' })
    expect(backing.setItem).not.toHaveBeenCalled()
  })
  it('A13/A14 purge preserves tasks/estimates/reservations and unrelated undo; failed purge retains everything', () => {
    const before = initial(), closed = closure(before).state; closed.history = recordChange(before, closed)
    const renamed = { ...closed, tasks: [{ ...closed.tasks[0], title: 'Rettet navn' }] }; renamed.history = recordChange(closed, renamed, closed.history)
    let raw = JSON.stringify(renamed), fail = true
    const storage = createStorage(() => ({ getItem: () => raw, setItem: (key, value) => { if (fail) throw Error('quota'); raw = value } })); storage.read()
    const purged = purgeWorkHistory(renamed)
    expect(purged.history.undo).toHaveLength(1); expect(purged.tasks).toEqual(renamed.tasks); expect(purged.sessions).toEqual(renamed.sessions)
    expect(storage.writeEnvelope(purged).ok).toBe(false); expect(JSON.parse(raw)).toEqual(renamed)
    fail = false; expect(storage.writeEnvelope(purged).ok).toBe(true)
    const undone = undoLast(purged, purged.history); expect(undone.ok).toBe(true); expect(undone.state.workLogs).toBeUndefined()
    expect(JSON.stringify(exportBackup(purged))).not.toContain('actualMinutes')
    expect(storage.read().workLogs).toBeUndefined()
  })
  it('A14 backup roundtrip validates new relations and removes credentials from dependency IDs and log snapshots', () => {
    const before = initial(), closed = closure(before).state; closed.history = recordChange(before, closed)
    const backup = exportBackup(closed), restored = previewBackup(JSON.stringify(backup), before)
    expect(restored.ok).toBe(true); expect(restored.data).toEqual(closed); expect(validEnvelope(restored.data, { relations: true })).toBe(true)
    const bad = structuredClone(closed); bad.workLogs[0].operationId = ''; expect(validEnvelope(bad)).toBe(false)
    const wrong = initial({ tasks: [task('orphan', { dependencyIds: ['missing'] })], sessions: [] }); expect(validEnvelope(wrong, { relations: true })).toBe(false)
  })
})

describe('connected recovery planning', () => {
  it('A09 moves missed Tuesday work to confirmed Thursday time with breaks and no doubled minutes', () => {
    const before = initial({ busyWindows: [{ id: 'busy', start: '2026-09-10T08:00:00Z', end: '2026-09-10T08:10:00Z' }, { id: 'overlap', start: '2026-09-10T08:05:00Z', end: '2026-09-10T08:15:00Z' }] })
    const preview = createReplan(before, { now })
    expect(preview.ok).toBe(true); expect(preview.proposed).toHaveLength(2); expect(preview.proposed[0]).toMatchObject({ id: 'missed', dateLocal: '2026-09-10', startTime: '10:15', endTime: '10:45' })
    expect(preview.proposed[1]).toMatchObject({ startTime: '10:55', endTime: '11:10' })
    expect(applyReplan(before, preview, { now }).ok).toBe(true); expect(before.sessions[0].dateLocal).toBe('2026-09-08')
  })
  it('A10 rejects edits that overlap, lack breaks, violate windows, stale data or elapsed start, with atomic undo', () => {
    const before = initial(), preview = createReplan(before, { now }), changed = structuredClone(preview)
    changed.proposed[1].startTime = '10:20'; expect(applyReplan(before, changed, { now }).ok).toBe(false)
    expect(applyReplan({ ...before, tasks: [task('task', { remainingMinutes: 90 })] }, preview, { now }).stale).toBe(true)
    expect(applyReplan(before, preview, { now: new Date('2026-09-10T08:01:00Z') }).stale).toBe(true)
    const applied = applyReplan(before, preview, { now }); expect(applied.ok).toBe(true)
    expect(undoLast(applied.state, recordChange(before, applied.state)).state).toEqual(before)
  })
  it('A09 preserves locks, rejects missing windows and keeps unknown workload explicit', () => {
    const locked = initial({ sessions: [session('lock', { dateLocal: '2026-09-10', locked: true })] }), preview = createReplan(locked, { now })
    expect(preview.removedIds).not.toContain('lock'); expect(applyReplan(locked, preview, { now }).state.sessions).toContainEqual(locked.sessions[0])
    const unknown = createReplan(initial({ tasks: [task('task', { remainingMinutes: null })] }), { now }); expect(unknown.proposed).toEqual([]); expect(unknown.problems.join()).toContain('ukjent')
    const none = createReplan(initial({ workWindows: [] }), { now }); expect(none.known).toBe(false); expect(none.proposed).toEqual([])
  })
  it('completed reservations do not secretly occupy new capacity', () => {
    const state = initial({ tasks: [task('task', { completed: true }), task('open')], sessions: [session('old-done', { dateLocal: '2026-09-10' })] })
    const capacity = deriveWorkCapacity(state.tasks, state.sessions, now, [], state.workWindows)
    expect(capacity.totalReservedMinutes).toBe(0); expect(capacity.tasks.find(item => item.taskId === 'open').allocatedMinutes).toBe(45)
  })
  it('A09 waits for all locked prerequisite work and never splits an indivisible task around a lock', () => {
    const state = initial({ tasks: [task('task'), task('after', { remainingMinutes: 15, dependencyIds: ['task'] })], sessions: [session('lock', { dateLocal: '2026-09-10', startTime: '11:00', endTime: '11:30', locked: true })] })
    const preview = createReplan(state, { now })
    expect(preview.proposed.find(item => item.taskId === 'after').startTime).toBe('11:40')
    expect(applyReplan(state, preview, { now }).ok).toBe(true)
    state.tasks[0].splittable = false
    const indivisible = createReplan(state, { now })
    expect(indivisible.proposed.filter(item => item.taskId === 'task')).toEqual([])
    expect(indivisible.problems.join(' ')).toContain('kan ikke deles')
  })
  it('A10 shortened edited sessions cannot silently introduce an undisclosed shortfall', () => {
    const state = initial(), preview = createReplan(state, { now })
    preview.proposed[0].endTime = '10:15'
    expect(applyReplan(state, preview, { now })).toMatchObject({ ok: false, error: expect.stringContaining('mindre tid') })
    expect(state.sessions).toEqual([session()])
  })
})

describe('local estimates', () => {
  it('A13 requires five complete relevant tasks; performed sessions remain distinct and changes need explicit acceptance', () => {
    let state = initial({ tasks: [], sessions: [] })
    for (let i = 0; i < 5; i++) {
      state.tasks.push(task(String(i), { taskType: 'lesing' }))
      const result = closeWork(state, { taskId: String(i), operationId: `op-${i}`, outcome: 'done', actualMinutes: [30, 40, 50, 60, 120][i], historyComplete: true }, { now })
      state = result.state
      if (i === 3) expect(personalEstimate(state, task())).toMatchObject({ available: false, count: 4 })
    }
    const raw = JSON.stringify(state), suggestion = personalEstimate(state, task('new', { taskType: 'lesing' }))
    expect(suggestion).toMatchObject({ available: true, minutes: 50, count: 5, scope: 'samme oppgavetype' })
    expect(completedWorkSamples(state)).toHaveLength(5); expect(JSON.stringify(state)).toBe(raw)
    expect(personalEstimate({ ...state, personalization: { enabled: false } }, task()).available).toBe(false)
    state.workLogs[0].interrupted = true; expect(completedWorkSamples(state)).toHaveLength(4)
  })
})
