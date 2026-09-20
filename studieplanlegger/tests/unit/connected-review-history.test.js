import { describe, it, expect } from 'vitest'
import { createStorage, STORAGE_KEY, RECOVERY_KEY, validEnvelope } from '../../src/storage.js'
import { closeWork, purgeWorkHistory } from '../../src/work-log.js'
import { recordChange, undoLast } from '../../src/history.js'
import { completedWorkSamples, personalEstimate } from '../../src/personal-estimates.js'
import { exportBackup } from '../../src/backup.js'

const now = new Date('2026-09-19T08:00:00Z')
const task = (id, patch = {}) => ({ id, title: id, course: '', deadlineLocal: '', estimatedMinutes: null, remainingMinutes: 40, completed: false, ...patch })
function fixture() {
  const before = { schemaVersion: 1, tasks: [task('sample'), task('next')], sessions: [{ id: 'reserved', taskId: 'next', dateLocal: '2026-09-20', startTime: '10:00', endTime: '10:40' }], workWindows: [{ id: 'available', start: '2026-09-20T08:00:00Z', end: '2026-09-20T09:00:00Z' }] }
  const closed = closeWork(before, { taskId: 'sample', operationId: 'completed', outcome: 'done', actualMinutes: 40, historyComplete: true }, { now }).state
  closed.history = recordChange(before, closed, undefined, 'Finished work', now)
  const after = { ...closed, tasks: closed.tasks.map(t => t.id === 'next' ? { ...t, title: 'Unrelated edit' } : t) }
  after.history = recordChange(closed, after, closed.history, 'Unrelated title', now)
  expect(validEnvelope(after, { relations: true })).toBe(true)
  return after
}
const journal = state => ({ savedAt: now.toISOString(), data: state, raw: JSON.stringify(state) })
function backend(state = fixture(), recovery = JSON.stringify(journal(state))) {
  const values = new Map([[STORAGE_KEY, JSON.stringify(state)]])
  if (recovery !== null) values.set(RECOVERY_KEY, recovery)
  const storage = {
    values, beforeSet: () => {},
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { storage.beforeSet(key, value); values.set(key, value) },
    removeItem(key) { values.delete(key) },
  }
  const store = createStorage(() => storage)
  expect(store.read().ok).toBe(true)
  return { storage, store, state }
}

describe('review R3: private work-history purge reaches recovery', () => {
  it('undo restores source meaning while preserving newer refresh bookkeeping', () => {
    const source = { id: 'source', courseId: 'course', kind: 'ics', url: 'https://example.org/a.ics', label: 'Original', lastAttempt: '2026-09-19T08:00:00Z', failures: 0 }
    const before = { schemaVersion: 1, tasks: [], planner: { courses: [{ id: 'course', name: 'Course', code: '', university: '', semester: null, year: null, credits: null, notes: '', description: '' }], events: [], sources: [source] } }
    const after = structuredClone(before); after.planner.sources[0].label = 'Changed'
    const history = recordChange(before, after, undefined, 'Edit source', now)
    after.planner.sources[0].lastAttempt = '2026-09-19T10:00:00Z'; after.planner.sources[0].lastError = 'temporary'; after.planner.sources[0].failures = 1
    const restored = undoLast(after, history)
    expect(restored.ok).toBe(true)
    expect(restored.state.planner.sources[0]).toMatchObject({ label: 'Original', lastAttempt: '2026-09-19T10:00:00Z', lastError: 'temporary', failures: 1 })
  })
  it('preserves unrelated tasks, reservations and undo while purging every recoverable copy, then survives recovery/reload/export', () => {
    const state = fixture(), recovery = { ...journal(state), previous: journal(state) }
    const { storage, store } = backend(state, JSON.stringify(recovery))
    expect(store.purgeWorkHistory()).toEqual({ ok: true })
    const purged = purgeWorkHistory(state)
    expect(store.snapshot()).toEqual(purged)
    expect(purged.history.undo).toHaveLength(1)
    expect(store.recovery().data).toEqual(purged)
    const raw = storage.getItem(RECOVERY_KEY)
    expect(raw).not.toContain('actualMinutes')
    expect(raw).not.toContain('workLogs')
    expect(JSON.parse(JSON.parse(raw).previous.raw)).toEqual(purged)
    const reloaded = createStorage(() => storage)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.replace(reloaded.recovery().data).ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(purged)
    expect(storage.getItem(RECOVERY_KEY)).not.toContain('actualMinutes')
    const undone = undoLast(purged, purged.history)
    expect(undone.ok).toBe(true)
    expect(undone.state.tasks.find(t => t.id === 'next').title).toBe('next')
    expect(undone.state.workLogs).toBeUndefined()
    expect(JSON.stringify(exportBackup(reloaded.snapshot()))).not.toContain('actualMinutes')
    expect(reloaded.snapshot().sessions).toEqual(state.sessions)
    expect(reloaded.snapshot().tasks).toEqual(state.tasks)
  })

  it('does not create a recovery snapshot when none exists and is safe to repeat', () => {
    const { store, storage } = backend(fixture(), null)
    expect(store.purgeWorkHistory().ok).toBe(true)
    const saved = storage.getItem(STORAGE_KEY)
    expect(store.purgeWorkHistory().ok).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe(saved)
    expect(storage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it.each(['{', JSON.stringify({ savedAt: now.toISOString(), raw: '{' }), JSON.stringify({ ...journal(fixture()), unexpectedCopy: fixture() }), JSON.stringify({ ...journal(fixture()), previous: { raw: 'null' } })])('refuses unreadable/unknown recovery without writing either key: %s', recovery => {
    const { store, storage } = backend(fixture(), recovery)
    const before = [...storage.values]
    expect(store.purgeWorkHistory()).toMatchObject({ ok: false, reason: 'unreadable-recovery', error: expect.stringContaining('ikke slettet') })
    expect([...storage.values]).toEqual(before)
  })

  it('leaves both exact raw values intact when recovery cannot be written', () => {
    const { store, storage } = backend(), before = [...storage.values]
    storage.beforeSet = key => { if (key === RECOVERY_KEY) throw new Error('quota') }
    expect(store.purgeWorkHistory()).toMatchObject({ ok: false, reason: 'recovery-failed' })
    expect([...storage.values]).toEqual(before)
  })

  it('rolls back only its recovery write when committing the main envelope fails, and permits retry', () => {
    const { store, storage, state } = backend(), before = [...storage.values]
    storage.beforeSet = key => { if (key === STORAGE_KEY) throw new Error('quota') }
    expect(store.purgeWorkHistory()).toEqual({ ok: false, reason: 'unwritable' })
    expect([...storage.values]).toEqual(before)
    expect(store.snapshot()).toEqual(state)
    storage.beforeSet = () => {}
    expect(store.purgeWorkHistory().ok).toBe(true)
  })

  it('reports incomplete deletion if recovery rollback also fails, retains main data, and can retry', () => {
    const { store, storage, state } = backend()
    let recoveryWrites = 0
    storage.beforeSet = key => {
      if (key === STORAGE_KEY || key === RECOVERY_KEY && ++recoveryWrites > 1) throw new Error('quota')
    }
    expect(store.purgeWorkHistory()).toMatchObject({ ok: false, recoveryJournalRetained: true, error: expect.stringContaining('ikke fullført') })
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual(state)
    expect(store.recovery().data.workLogs).toBeUndefined()
    storage.beforeSet = () => {}
    expect(store.purgeWorkHistory().ok).toBe(true)
    expect(store.snapshot().workLogs).toBeUndefined()
  })

  it('preserves another writer main data and restores only this operation staged recovery', () => {
    const { store, storage, state } = backend(), oldRecovery = storage.getItem(RECOVERY_KEY)
    const other = JSON.stringify({ ...state, tasks: [...state.tasks, task('another-tab')] })
    storage.beforeSet = key => { if (key === RECOVERY_KEY) storage.values.set(STORAGE_KEY, other) }
    expect(store.purgeWorkHistory()).toEqual({ ok: false, reason: 'conflict' })
    expect(storage.getItem(STORAGE_KEY)).toBe(other)
    expect(storage.getItem(RECOVERY_KEY)).toBe(oldRecovery)
  })

  it('never overwrites a concurrent recovery change when main commit fails', () => {
    const { store, storage, state } = backend(), otherRecovery = JSON.stringify(journal({ ...state, tasks: [...state.tasks, task('other-copy')] }))
    storage.beforeSet = key => {
      if (key === STORAGE_KEY) { storage.values.set(RECOVERY_KEY, otherRecovery); throw new Error('quota') }
    }
    expect(store.purgeWorkHistory()).toEqual({ ok: false, reason: 'unwritable' })
    expect(storage.getItem(RECOVERY_KEY)).toBe(otherRecovery)
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toEqual(state)
  })
})

describe('review R3: only currently complete whole tasks train estimates', () => {
  it('excludes a reopening even before another work entry, and keeps session samples separate', () => {
    const state = fixture()
    expect(completedWorkSamples(state)).toMatchObject([{ minutes: 40 }])
    state.tasks[0].completed = false
    expect(completedWorkSamples(state)).toEqual([])
    expect(personalEstimate(state, {}, { kind: 'task' })).toMatchObject({ available: false, count: 0 })
    expect(personalEstimate(state, {}, { kind: 'session' })).toMatchObject({ available: false, count: 1 })
  })

  it('does not treat an older completion as whole work after later partial work, even if status was separately checked', () => {
    let state = fixture()
    state.tasks[0].completed = false
    state = closeWork(state, { taskId: 'sample', operationId: 'partial', outcome: 'more', actualMinutes: 20, remainingMinutes: 40 }, { now: new Date('2026-09-19T09:00:00Z') }).state
    expect(completedWorkSamples(state)).toEqual([])
    state.tasks[0].completed = true
    expect(completedWorkSamples(state)).toEqual([])
    state.tasks[0].completed = false
    state = closeWork(state, { taskId: 'sample', operationId: 'finished-again', outcome: 'done', actualMinutes: 40, historyComplete: true }, { now: new Date('2026-09-19T10:00:00Z') }).state
    expect(completedWorkSamples(state)).toMatchObject([{ minutes: 100 }])
    // Imported arrays may be reordered: use instants, not their ISO spelling.
    state.workLogs[0].at = '2026-09-19T10:00:00+02:00'
    state.workLogs.reverse()
    expect(completedWorkSamples(state)).toMatchObject([{ minutes: 100 }])
  })

  it('excludes missing/deleted tasks and incomplete/interruptive work, without learning missed time as zero', () => {
    const state = fixture(), completion = state.workLogs[0]
    state.workLogs.push({ ...completion, id: 'missed', operationId: 'missed', at: '2026-09-19T09:00:00Z', outcome: 'not-started', actualMinutes: null, historyComplete: false })
    expect(completedWorkSamples(state)).toMatchObject([{ minutes: 40 }])
    completion.interrupted = true
    expect(completedWorkSamples(state)).toEqual([])
    completion.interrupted = false
    completion.actualMinutes = null
    expect(completedWorkSamples(state)).toEqual([])
    completion.actualMinutes = 40
    state.tasks = state.tasks.filter(t => t.id !== 'sample')
    state.workLogs.forEach(log => { log.taskDeleted = true })
    expect(completedWorkSamples(state)).toEqual([])
  })
})
