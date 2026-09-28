import { describe, expect, it } from 'vitest'
import { availabilityFor, materializeStudyTime, preferenceFor, validStudyTimePreference } from '../../src/study-time.js'
import { createReplan, applyReplan, replanMoveAlternatives } from '../../src/replanning.js'
import { emptyHistory, recordChange, undoLast } from '../../src/history.js'
import { validEnvelope } from '../../src/storage.js'
import { exportBackup, previewBackup } from '../../src/backup.js'

const now = new Date('2026-09-25T09:00:00+02:00')
const task = (id = 'task', patch = {}) => ({ id, title: `Oppgave ${id}`, course: '', deadlineLocal: '', estimatedMinutes: null, remainingMinutes: null, completed: false, ...patch })
const state = patch => ({ schemaVersion: 1, tasks: [task()], sessions: [], ...patch })

describe('simple study-time contract', () => {
  it('keeps presets explicit and gives no-choice only one conditional 30-minute window', () => {
    const preference = preferenceFor('evening')
    expect(preference).toEqual({ kind: 'evening', label: 'På kvelden i ukedagene', days: [1, 2, 3, 4, 5], startTime: '18:00', endTime: '20:00' })
    expect(validStudyTimePreference(preference)).toBe(true)
    expect(validStudyTimePreference({ ...preference, label: 'Older translated label' })).toBe(true)
    expect(materializeStudyTime({ now, preference: { ...preference, label: 'Older translated label' } }).label).toBe(preference.label)
    expect(validEnvelope(state({ studyTimePreference: preference }))).toBe(true)
    expect(validStudyTimePreference({ ...preference, endTime: '22:00' })).toBe(false)
    const assumption = materializeStudyTime({ now, mode: 'assumption' })
    expect(assumption).toMatchObject({ kind: 'assumption', conditional: true })
    expect(assumption.windows).toHaveLength(1)
    expect((Date.parse(assumption.windows[0].end) - Date.parse(assumption.windows[0].start)) / 60000).toBe(30)
  })

  it('uses a short exploratory session without turning an assumption into a recurring preference', () => {
    const before = state(), availability = availabilityFor(before, { now, choice: 'assumption' })
    const preview = createReplan(before, { now, availability, exploratory: { task: 30 }, taskIds: ['task'] })
    expect(preview.proposed).toHaveLength(1)
    expect(preview.changes[0]).toMatchObject({ taskId: 'task', exploratory: true })
    const applied = applyReplan(before, preview, { now })
    expect(applied.ok).toBe(true)
    expect(applied.state.sessions).toHaveLength(1)
    expect(applied.state.studyTimePreference).toBeUndefined()
    expect(applied.state.tasks[0].remainingMinutes).toBeNull()
    expect(applyReplan(applied.state, preview, { now })).toMatchObject({ ok: false, stale: true })
  })

  it('persists an explicitly selected preference, preserves unrelated sessions and undoes exactly', () => {
    const other = task('other', { remainingMinutes: 30 })
    const before = state({ tasks: [task('task', { remainingMinutes: 30 }), other], sessions: [{ id: 'other-session', taskId: 'other', dateLocal: '2026-09-28', startTime: '19:00', endTime: '19:30', locked: false }] })
    const availability = availabilityFor(before, { now, choice: 'evening' })
    const preview = createReplan(before, { now, availability, taskIds: ['task'] })
    const applied = applyReplan(before, preview, { now })
    expect(applied.ok).toBe(true)
    expect(applied.state.studyTimePreference).toEqual(preferenceFor('evening'))
    expect(applied.state.sessions.find(item => item.id === 'other-session')).toEqual(before.sessions[0])
    expect(applied.state.sessions.filter(item => item.taskId === 'other')).toEqual([before.sessions[0]])
    expect(applied.state.sessions.filter(item => item.taskId === 'task')).toHaveLength(1)
    const history = recordChange(before, applied.state, emptyHistory(), 'Ny samlet studieplan', now)
    const undone = undoLast({ ...applied.state, history }, history)
    expect(undone.ok).toBe(true)
    expect(undone.state.sessions).toEqual(before.sessions)
    expect(undone.state.studyTimePreference).toBeUndefined()
  })

  it('keeps an explicit study-time preference through portable backup and restore preview', () => {
    const before = state({ studyTimePreference: preferenceFor('weekend') })
    const backup = exportBackup(before, now)
    const restored = previewBackup(JSON.stringify(backup), state())
    expect(restored.ok).toBe(true)
    expect(restored.data.studyTimePreference).toEqual(preferenceFor('weekend'))
  })

  it('offers only alternatives that pass the same apply rules', () => {
    const before = state({ tasks: [task('task', { remainingMinutes: 30 })] })
    const preview = createReplan(before, { now, availability: availabilityFor(before, { now, choice: 'evening' }), taskIds: ['task'] })
    const alternatives = replanMoveAlternatives(before, preview, preview.proposed[0].id, { now })
    expect(alternatives.length).toBeGreaterThan(0)
    for (const candidate of alternatives) {
      const draft = structuredClone(preview)
      draft.proposed[draft.proposed.findIndex(item => item.id === candidate.id)] = candidate
      expect(applyReplan(before, draft, { now }).ok).toBe(true)
    }
  })

  it('respects known busy time, deadline shortage, varies semantics and estimate ranges', () => {
    const assumption = availabilityFor(state(), { now, choice: 'assumption' })
    const blocked = state({ busyWindows: [{ id: 'busy', label: 'Avtale', start: assumption.windows[0].start, end: assumption.windows[0].end }] })
    const noSpace = createReplan(blocked, { now, availability: assumption, exploratory: { task: 30 }, taskIds: ['task'] })
    expect(noSpace.proposed).toHaveLength(0)
    expect(noSpace.problems.join(' ')).toContain('mangler')

    const urgent = state({ tasks: [task('task', { remainingMinutes: 30, deadlineLocal: '2026-09-25T12:00' })] })
    const tooLate = createReplan(urgent, { now, availability: availabilityFor(urgent, { now, choice: 'assumption' }), taskIds: ['task'] })
    expect(tooLate.proposed).toHaveLength(0)
    expect(tooLate.totalMissingMinutes).toBe(30)

    const ranged = state({ tasks: [task('task', { remainingMinutes: undefined, estimatedMinutes: null, remainingEstimate: { minMinutes: 60, maxMinutes: 120 } })], studyTimePreference: preferenceFor('evening') })
    const varied = availabilityFor(ranged, { now, choice: 'varies' })
    const rangedPreview = createReplan(ranged, { now, availability: varied, taskIds: ['task'] })
    expect(rangedPreview.deficitRanges.task?.minMinutes ?? 0).toBeLessThanOrEqual(rangedPreview.deficitRanges.task?.maxMinutes ?? 0)
    const applied = applyReplan(ranged, rangedPreview, { now })
    expect(applied.ok).toBe(true)
    expect(applied.state.studyTimePreference).toBeUndefined()
    expect(applied.state.tasks[0].remainingEstimate).toEqual({ minMinutes: 60, maxMinutes: 120 })
  })

  it('rejects a preview after task, calendar or preference state changes', () => {
    const before = state({ tasks: [task('task', { remainingMinutes: 30 })] })
    const preview = createReplan(before, { now, availability: availabilityFor(before, { now, choice: 'weekend' }), taskIds: ['task'] })
    expect(applyReplan({ ...before, busyWindows: [{ id: 'new', label: '', start: '2026-09-26T08:00:00Z', end: '2026-09-26T09:00:00Z' }] }, preview, { now })).toMatchObject({ ok: false, stale: true })
    expect(applyReplan({ ...before, studyTimePreference: preferenceFor('daytime') }, preview, { now })).toMatchObject({ ok: false, stale: true })
  })
})
