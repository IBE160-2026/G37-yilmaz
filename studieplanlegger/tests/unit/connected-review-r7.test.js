import { describe, expect, it } from 'vitest'
import { createReplan, applyReplan } from '../../src/replanning.js'
import { setTaskCompleted, getRemainingMinutes } from '../../src/tasks.js'
import { closeWork } from '../../src/work-log.js'
import { completedWorkSamples } from '../../src/personal-estimates.js'

const now = new Date('2026-09-09T06:00:00Z')
const task = (id, remainingMinutes, patch = {}) => ({ id, title: id, course: '', deadlineLocal: '', estimatedMinutes: 120, remainingMinutes, completed: false, ...patch })
const window = (id, start, end) => ({ id, start: `2026-09-10T${start}:00+02:00`, end: `2026-09-10T${end}:00+02:00` })
const session = (id, taskId, startTime, endTime, locked = true) => ({ id, taskId, dateLocal: '2026-09-10', startTime, endTime, locked })
const rules = { minimumMinutes: 15, sessionMinutes: 60, maximumMinutes: 60, breakMinutes: 10 }

describe('R7 connected planning and reopening', () => {
  it('reserves a generated break into the next separately registered window and applies untouched', () => {
    const state = { tasks: [task('a', 60), task('b', 25)], sessions: [], workWindows: [window('first', '09:00', '10:00'), window('second', '10:05', '10:35')] }
    const preview = createReplan(state, { now, rules })
    expect(preview.problems).toEqual([])
    expect(preview.proposed.map(({ taskId, startTime, endTime }) => ({ taskId, startTime, endTime }))).toEqual([
      { taskId: 'a', startTime: '09:00', endTime: '10:00' }, { taskId: 'b', startTime: '10:10', endTime: '10:35' },
    ])
    expect(applyReplan(state, preview, { now }).ok).toBe(true)
  })

  it('also removes the required break from an earlier free interval when the first task needs a later long window', () => {
    const state = { tasks: [task('a', 60, { splittable: false }), task('b', 30)], sessions: [], workWindows: [window('first', '09:00', '09:30'), window('second', '09:35', '10:35')] }
    const preview = createReplan(state, { now, rules })
    expect(preview.proposed.find(item => item.taskId === 'b')).toMatchObject({ startTime: '09:00', endTime: '09:25' })
    expect(preview.problems.join(' ')).toContain('5 min mangler')
    expect(applyReplan(state, preview, { now }).ok).toBe(true)
  })

  it.each([false, true])('does not credit insufficient locked breaks across same-task=%s and rejects forged dependent work', sameTask => {
    const tasks = sameTask ? [task('a', 60), task('dependent', 30, { dependencyIds: ['a'] })] : [task('a', 30), task('b', 30), task('dependent', 30, { dependencyIds: ['a', 'b'] })]
    const state = { tasks, sessions: [session('first', 'a', '09:00', '09:30'), session('second', sameTask ? 'a' : 'b', '09:35', '10:05')], workWindows: [window('available', '09:00', '10:45')] }
    const preview = createReplan(state, { now, rules })
    expect(preview.problems.filter(message => message.includes('mangler valgt pause'))).toHaveLength(2)
    expect(preview.proposed.some(item => item.taskId === 'dependent')).toBe(false)
    const result = applyReplan(state, preview, { now })
    expect(result.ok).toBe(true)
    expect(result.state.sessions.filter(item => item.locked)).toEqual(state.sessions)
    const forged = { ...preview, proposed: [session('forged', 'dependent', '10:15', '10:45', false)], allocatedMinutes: { dependent: 30 } }
    expect(applyReplan(state, forged, { now })).toMatchObject({ ok: false, error: expect.stringContaining('forutsetning') })
  })

  it('allows exact locked breaks and leaves completed reservations out of break conflicts', () => {
    const state = { tasks: [task('a', 60), task('completed', 0, { completed: true }), task('dependent', 30, { dependencyIds: ['a'] })], sessions: [session('first', 'a', '09:00', '09:30'), session('second', 'a', '09:40', '10:10'), session('old', 'completed', '10:12', '10:18')], workWindows: [window('available', '09:00', '10:50')] }
    const preview = createReplan(state, { now, rules })
    expect(preview.problems).toEqual([])
    expect(preview.proposed).toHaveLength(1)
    expect(preview.proposed[0]).toMatchObject({ taskId: 'dependent', startTime: '10:20' })
    expect(applyReplan(state, preview, { now }).ok).toBe(true)
  })

  it('reopens completion-generated zero as unknown without restoring reservations or learning completion', () => {
    const initial = { tasks: [task('a', 45)], sessions: [session('reservation', 'a', '09:00', '09:45')] }
    const closed = closeWork(initial, { taskId: 'a', outcome: 'done', operationId: 'completion', actualMinutes: 45, historyComplete: true, confirmRelease: true }, { now }).state
    expect(completedWorkSamples(closed)).toHaveLength(1)
    const reopened = { ...closed, tasks: setTaskCompleted(closed.tasks, 'a', false).tasks }
    expect(reopened.tasks[0]).toMatchObject({ completed: false, remainingMinutes: null, estimatedMinutes: 120 })
    expect(getRemainingMinutes(reopened.tasks[0])).toBeNull()
    expect(reopened.sessions).toEqual([])
    expect(reopened.workLogs).toEqual(closed.workLogs)
    expect(completedWorkSamples(reopened)).toEqual([])
    expect(closed.tasks[0]).toMatchObject({ completed: true, remainingMinutes: 0 })
  })

  it('preserves legacy remaining values, absent fields, submitted guards and no-op transitions', () => {
    for (const remaining of [45, null, undefined]) {
      const saved = task('a', remaining, { completed: true })
      if (remaining === undefined) delete saved.remainingMinutes
      const reopened = setTaskCompleted([saved], 'a', false).tasks[0]
      expect(reopened).toEqual({ ...saved, completed: false })
    }
    const zero = task('zero', 0)
    expect(setTaskCompleted([zero], 'zero', false).tasks).toEqual([zero])
    const completed = { ...zero, completed: true }
    expect(setTaskCompleted([completed], 'zero', true).tasks).toEqual([completed])
    expect(setTaskCompleted([{ ...completed, requiresSubmission: true, submitted: true }], 'zero', false)).toMatchObject({ ok: false, reason: 'submitted' })
  })
})
