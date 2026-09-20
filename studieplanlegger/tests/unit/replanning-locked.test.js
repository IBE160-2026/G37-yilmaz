import { describe, expect, it } from 'vitest'
import { createReplan, applyReplan } from '../../src/replanning.js'
import { extendedSessionInterval } from '../../src/work-capacity.js'

const now = new Date('2026-09-09T07:00:00Z')
const task = (id, patch = {}) => ({ id, title: id, course: '', estimatedMinutes: null, remainingMinutes: 30, deadlineLocal: '2026-09-10T14:00', completed: false, ...patch })
const lock = (id, taskId, patch = {}) => ({ id, taskId, dateLocal: '2026-09-10', startTime: '10:00', endTime: '10:30', locked: true, ...patch })
const state = (tasks, sessions) => ({ schemaVersion: 1, tasks, sessions, workWindows: [{ id: 'thursday', start: '2026-09-10T08:00:00Z', end: '2026-09-10T11:00:00Z' }] })
const start = session => extendedSessionInterval(session).start
const end = session => extendedSessionInterval(session).end

describe('A09/A10 retained locks are checked before they can unlock other work', () => {
  it('preserves a lock before its prerequisite, explains the conflict and reserves valid replacement work after the prerequisite', () => {
    const before = state([task('a'), task('b', { dependencyIds: ['a'] })], [lock('early-b', 'b')]), raw = JSON.stringify(before)
    const preview = createReplan(before, { now })
    expect(preview.problems.join(' ')).toContain('starter før forutsetningene')
    expect(preview.removedIds).not.toContain('early-b')
    const a = preview.proposed.find(item => item.taskId === 'a'), b = preview.proposed.find(item => item.taskId === 'b')
    expect(start(b)).toBeGreaterThanOrEqual(end(a))
    const result = applyReplan(before, preview, { now })
    expect(result.ok).toBe(true)
    expect(result.state.sessions).toContainEqual(before.sessions[0])
    expect(JSON.stringify(before)).toBe(raw)
  })

  it('rejects downstream proposals that rely on a locked task performed before its own prerequisite', () => {
    const before = state([task('a'), task('b', { dependencyIds: ['a'] }), task('c', { dependencyIds: ['b'] })], [lock('early-b', 'b')])
    const preview = createReplan(before, { now })
    preview.proposed = preview.proposed.filter(item => item.taskId !== 'b')
    preview.allocatedMinutes.b = 0
    const result = applyReplan(before, preview, { now })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('forutsetning') })
    expect(before.sessions).toEqual([lock('early-b', 'b')])
  })

  it('does not credit the same overlapping locked minutes to two prerequisites', () => {
    const before = state([task('a'), task('b'), task('c', { dependencyIds: ['a', 'b'] })], [lock('a-lock', 'a'), lock('b-lock', 'b')])
    const preview = createReplan(before, { now })
    expect(preview.problems.filter(message => message.includes('overlapper en annen reservasjon'))).toHaveLength(2)
    expect(preview.proposed.map(item => item.taskId)).toEqual(['a', 'b', 'c'])
    const c = preview.proposed.find(item => item.taskId === 'c')
    expect(start(c)).toBeGreaterThanOrEqual(Math.max(...preview.proposed.filter(item => item.taskId !== 'c').map(end)))
    const result = applyReplan(before, preview, { now })
    expect(result.ok).toBe(true)
    expect(result.state.sessions.filter(item => item.locked)).toEqual(before.sessions)
    // A previously constructed preview must not bypass the same protection at acceptance.
    preview.proposed = preview.proposed.filter(item => item.taskId === 'c')
    preview.allocatedMinutes.a = 0; preview.allocatedMinutes.b = 0
    expect(applyReplan(before, preview, { now })).toMatchObject({ ok: false, error: expect.stringContaining('forutsetning') })
  })

  it('explains missing work when conflicting locks leave no valid replacement time, while unrelated work remains usable', () => {
    const before = state([task('a'), task('b'), task('c', { dependencyIds: ['a', 'b'] }), task('independent')], [lock('a-lock', 'a'), lock('b-lock', 'b')])
    before.tasks[0].splittable = false; before.tasks[1].splittable = false
    const preview = createReplan(before, { now })
    expect(preview.proposed.map(item => item.taskId)).toEqual(['independent'])
    expect(preview.problems.join(' ')).toContain('30 min mangler')
    expect(preview.problems.join(' ')).toContain('Ingen startklar tid foreslås')
    expect(applyReplan(before, preview, { now }).ok).toBe(true)
    expect(before.sessions).toHaveLength(2)
  })

  it('allows valid sequential locked prerequisites to support a new dependent session', () => {
    const before = state([task('a'), task('b', { dependencyIds: ['a'] }), task('c', { dependencyIds: ['b'] })], [lock('a-lock', 'a'), lock('b-lock', 'b', { startTime: '10:40', endTime: '11:10' })])
    const preview = createReplan(before, { now })
    expect(preview.problems).toEqual([])
    expect(preview.proposed).toHaveLength(1)
    expect(preview.proposed[0]).toMatchObject({ taskId: 'c', startTime: '11:20' })
    expect(applyReplan(before, preview, { now }).ok).toBe(true)
  })

  it('keeps an unrelated ambiguous deadline unresolved without blocking valid new work', () => {
    const before = state([task('ambiguous', { deadlineLocal: '2026-10-25T02:30' }), task('independent')], [])
    const preview = createReplan(before, { now })
    expect(preview.problems.join(' ')).toContain('tvetydig')
    expect(preview.proposed.map(item => item.taskId)).toEqual(['independent'])
    expect(applyReplan(before, preview, { now }).ok).toBe(true)
  })
})
