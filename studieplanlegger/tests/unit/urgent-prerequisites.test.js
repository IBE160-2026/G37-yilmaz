import { describe, expect, it } from 'vitest'
import { selectTasksForMinutes, suggestionReason } from '../../src/tasks.js'
import { actionUrgency, reachableUnfinishedDependents } from '../../src/task-dependencies.js'

const task = (id, patch = {}) => ({ id, title: id, course: '', completed: false, deadlineLocal: '', remainingMinutes: 20, ...patch })
const now = new Date('2026-09-19T08:00:00Z')
const ids = tasks => tasks.map(item => item.id)

describe('R4 downstream recorded deadlines determine next-action urgency', () => {
  it('puts a September prerequisite ahead of work with two December dependents and explains the motivating task', () => {
    const tasks = [task('december'), task('september'), task('December one', { dependencyIds: ['december'], deadlineLocal: '2026-12-01T12:00' }), task('December two', { dependencyIds: ['december'], deadlineLocal: '2026-12-02T12:00' }), task('September hand-in', { dependencyIds: ['september'], deadlineLocal: '2026-09-20T12:00' })]
    const before = structuredClone(tasks)
    expect(ids(selectTasksForMinutes(tasks, 30))).toEqual(['september', 'december'])
    expect(suggestionReason(tasks[1], 30, now, 0, tasks)).toContain('forutsetning for «September hand-in», med registrert frist 2026-09-20 kl. 12:00')
    expect(tasks).toEqual(before)
  })

  it('follows transitive unfinished paths and counts a diamond only once', () => {
    const tasks = [task('start'), task('left', { dependencyIds: ['start'] }), task('right', { dependencyIds: ['start'] }), task('end', { dependencyIds: ['left', 'right'], deadlineLocal: '2026-09-20T12:00' }), task('other', { deadlineLocal: '2026-09-21T12:00' })]
    expect(ids(reachableUnfinishedDependents(tasks[0], tasks))).toEqual(['left', 'right', 'end'])
    expect(actionUrgency(tasks[0], tasks)).toMatchObject({ deadlineLocal: '2026-09-20T12:00', count: 3, downstream: { id: 'end' } })
    expect(ids(selectTasksForMinutes(tasks, 30))).toEqual(['start', 'other'])
    expect(suggestionReason(tasks[0], 30, now, 0, tasks)).toContain('«end»')
  })

  it('does not propagate urgency through completed, submitted or deleted intermediary work', () => {
    for (const flags of [{ completed: true }, { submitted: true }]) {
      const tasks = [task('start'), task('finished', { dependencyIds: ['start'], ...flags }), task('urgent', { dependencyIds: ['finished'], deadlineLocal: '2026-09-20T12:00' })]
      expect(actionUrgency(tasks[0], tasks)).toEqual({ deadlineLocal: '', downstream: null, count: 0 })
      expect(suggestionReason(tasks[0], 30, now, 0, tasks)).not.toContain('«urgent»')
    }
    const tasks = [task('start'), task('urgent', { dependencyIds: ['deleted'], missingDependencyIds: ['deleted'], deadlineLocal: '2026-09-20T12:00' })]
    expect(actionUrgency(tasks[0], tasks).downstream).toBeNull()
    expect(ids(selectTasksForMinutes(tasks, 30))).toEqual(['start'])
    expect(reachableUnfinishedDependents(task('deleted'), tasks)).toEqual([])
  })

  it('uses own deadlines before dependent count, then preserves count, priority and stable ordering', () => {
    const tasks = [task('stable-first'), task('stable-second'), task('priority', { priority: 3 }), task('prerequisite'), task('dependent', { dependencyIds: ['prerequisite'] }), task('own-urgent', { deadlineLocal: '2026-09-20T10:00', priority: 1 })]
    expect(ids(selectTasksForMinutes(tasks, 30))).toEqual(['own-urgent', 'prerequisite', 'priority', 'stable-first', 'stable-second'])
  })

  it('retains step, partial, unknown and blocking distinctions under downstream urgency', () => {
    const tasks = [task('step', { remainingMinutes: null, nextStep: { description: 'Les kravene', estimatedMinutes: 20 } }), task('partial', { remainingMinutes: 240 }), task('indivisible', { remainingMinutes: 240, splittable: false }), task('unknown', { remainingMinutes: null }), task('urgent', { dependencyIds: ['step', 'partial', 'indivisible', 'unknown'], deadlineLocal: '2026-09-20T12:00' })]
    expect(ids(selectTasksForMinutes(tasks, 30))).toEqual(['step'])
    expect(ids(selectTasksForMinutes(tasks, 30, { includePartial: true }))).toEqual(['step', 'partial'])
    expect(suggestionReason(tasks[0], 30, now, 0, tasks)).toContain('Hele oppgaven er ikke ferdig etter steget')
    expect(suggestionReason(tasks[1], 30, now, 1, tasks)).toContain('En deløkt på 30 min')
  })
})
