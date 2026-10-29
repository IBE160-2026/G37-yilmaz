import { describe, expect, it } from 'vitest'
import { createReplan, applyReplan } from '../../src/replanning.js'
import { validatePersonalActivity } from '../../src/planner.js'
import { deriveCapacity } from '../../src/capacity.js'
import { capacityNotice } from '../../src/capacity-notice.js'
import { canStartTask, taskBlockers } from '../../src/task-dependencies.js'
import { dailyOverview } from '../../src/daily-overview.js'

// Synthetic state reproduces the reported clock/labels; no owner's data is used.
const now = new Date('2026-10-29T16:48:00Z')
const task = { id: 'synthetic-task', title: 'Syntetisk innlevering', course: '', deadlineLocal: '2026-10-31T20:59', estimatedMinutes: null, remainingMinutes: 30, completed: false }
const session = { id: 'synthetic-session', taskId: task.id, dateLocal: '2026-10-29', startTime: '18:00', endTime: '18:30' }
const windows = [{ id: 'synthetic-window', start: '2026-10-29T17:00:00Z', end: '2026-10-29T19:00:00Z' }]

describe('owner-trial planning regressions', () => {
  it('explains the waiting field and preserves both the blocking rule and uncertain personal time', () => {
    const waiting = { ...task, waitingReason: 'Lesing' }
    const state = { tasks: [waiting], workWindows: windows, planner: { courses: [], sources: [], events: [validatePersonalActivity({ id: 'synthetic-activity', title: 'Syntetisk avtale', dateLocal: '2026-10-30' })] } }
    const before = structuredClone(state), preview = createReplan(state, { now })
    expect(preview.ok).toBe(true)
    expect(preview.proposed).toEqual([])
    expect(preview.blockedTasks).toEqual([{ taskId: task.id, title: task.title, waiting: true }])
    expect(preview.problems.join(' ')).toContain('Venter på: Lesing')
    expect(preview.problems.join(' ')).toContain('ukjent tidspunkt eller varighet')
    expect(canStartTask(waiting, state.tasks)).toBe(false)
    expect(taskBlockers(waiting, state.tasks)[0]).toMatchObject({ waiting: true })
    expect(state).toEqual(before)
  })

  it('proposes and applies ready work only within confirmed time before the deadline', () => {
    const state = { tasks: [task], sessions: [], workWindows: windows }
    const before = structuredClone(state), preview = createReplan(state, { now })
    expect(preview.proposed).toHaveLength(1)
    expect(preview.proposed[0]).toMatchObject({ taskId: task.id, startTime: '18:00', endTime: '18:30' })
    expect(state).toEqual(before)
    expect(applyReplan(state, preview, { now }).state.sessions).toEqual(preview.proposed)
    expect(applyReplan({ ...state, tasks: [{ ...task, waitingReason: 'Ny hindring' }] }, preview, { now }).ok).toBe(false)
  })

  it('reports sufficient reserved time consistently without claiming work was completed', () => {
    const planned = deriveCapacity([task], [session], now).tasks[0]
    expect(planned.state).toBe('planned')
    const notice = capacityNotice(task, [session], [], now, planned)
    expect(notice.text).toBe('Arbeidet har reservert tid.')
    expect(notice.detail).toContain('betyr ikke fullført arbeid')
    const shorter = { ...session, endTime: '18:10' }
    const insufficient = deriveCapacity([task], [shorter], now).tasks[0]
    expect(capacityNotice(task, [shorter], [], now, insufficient).text).toContain('gjenstår å planlegge')
    expect(capacityNotice(task, [{ ...session, taskId: 'other-task' }], [], now).text).toBe('Ingen studieøkt planlagt ennå.')
    expect(capacityNotice(task, [session], [], now).text).not.toContain('gjenstår å planlegge')
  })

  it('retains conflicts, waiting and elapsed time in the existing capacity calculation', () => {
    const waiting = { ...task, waitingReason: 'Avklaring' }
    const blocked = deriveCapacity([waiting], [session], now).tasks[0]
    expect(capacityNotice(waiting, [session], [], now, blocked).text).toBe('Oppgaven er blokkert.')
    const occupied = [{ start: windows[0].start, end: windows[0].end }]
    const conflict = deriveCapacity([task], [session], now, occupied).tasks[0]
    expect(capacityNotice(task, [session], occupied, now, conflict).text).not.toBe('Arbeidet har reservert tid.')
    const later = new Date('2026-10-29T17:20:00Z'), partial = deriveCapacity([task], [session], later).tasks[0]
    expect(partial.reservedMinutes).toBe(10)
    expect(capacityNotice(task, [session], [], later, partial).text).toContain('gjenstår å planlegge')
  })

  it('shows the actual blocker even when the work estimate is unknown', () => {
    const waiting = { ...task, waitingReason: 'Avklaring', remainingMinutes: null, estimatedMinutes: null }
    const planned = { state: 'blocked', reasons: ['Venter på: Avklaring'] }
    expect(capacityNotice(waiting, [], [], now, planned)).toMatchObject({ text: 'Oppgaven er blokkert.', detail: 'Venter på: Avklaring' })
    expect(capacityNotice({ ...waiting, completed: true }, [], [], now, planned)).toBeNull()
  })

  it('does not describe theoretical legacy free-session capacity as a saved task reservation', () => {
    const { taskId, ...freeSession } = session
    const theoretical = deriveCapacity([task], [freeSession], now).tasks[0]
    expect(theoretical).toMatchObject({ allocatedMinutes: 30, missingMinutes: 0 })
    expect(theoretical.state).toBeUndefined()
    expect(capacityNotice(task, [freeSession], [], now, theoretical).text).not.toBe('Arbeidet har reservert tid.')
  })

  it('finds the reported 18:00 session at 17:48 Oslo without moving it', () => {
    const data = dailyOverview({ tasks: [task], sessions: [session], now })
    expect(data.activity).toMatchObject({ id: session.id, kind: 'session', taskId: task.id })
    expect(data.rows[0].sessions[0].start).toBe(Date.parse('2026-10-29T17:00:00Z'))
  })
})
