import { describe, it, expect } from 'vitest'
import { upcomingAgenda } from '../../src/agenda-view.js'

const course = { id: 'test-course', name: 'Matematikk', code: 'TEST101' }
const event = (id, start, end, patch = {}) => ({ id, title: id, courseId: course.id, start, end, ...patch })
const model = { now: new Date('2026-09-30T08:00:00Z'), tasks: [], sessions: [], planner: { courses: [course], events: [] } }

describe('rolling agenda from registered data', () => {
  it('includes all event types across months, keeps ongoing teaching first and preserves source data', () => {
    const data = structuredClone(model)
    data.planner.events = [event('next-month', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', { location: 'Rom Æ' }), event('ongoing', '2026-09-30T07:30:00Z', '2026-09-30T08:30:00Z')]
    data.tasks = [{ id: 'task', title: 'Frist', course: 'TEST101', deadlineLocal: '2026-09-30T15:00', completed: false }]
    data.sessions = [{ id: 'session', dateLocal: '2026-11-01', startTime: '10:00', endTime: '11:00' }]
    const original = structuredClone(data)
    const rows = upcomingAgenda(data)
    expect(rows.map(row => row.id)).toEqual(['ongoing', 'task', 'next-month', 'session'])
    expect(rows[0].ongoing).toBe(true)
    expect(rows[2]).toMatchObject({ date: '2026-10-01', time: '12:00', endTime: '13:00', course: 'TEST101', location: 'Rom Æ' })
    expect(data).toEqual(original)
  })
  it('shows Norwegian summer and winter time', () => {
    const data = structuredClone(model)
    data.planner.events = [event('summer', '2026-10-19T08:00:00Z', '2026-10-19T09:00:00Z'), event('winter', '2026-10-26T09:00:00Z', '2026-10-26T10:00:00Z')]
    expect(upcomingAgenda(data).map(row => [row.time, row.endTime])).toEqual([['10:00', '11:00'], ['10:00', '11:00']])
  })
  it('excludes finished, cancelled, deleted and past entries while retaining delivery reminders', () => {
    const data = structuredClone(model)
    data.planner.events = [event('ended', '2026-09-30T06:00:00Z', '2026-09-30T08:00:00Z'), event('cancelled', '2026-10-01T08:00:00Z', '2026-10-01T09:00:00Z', { cancelled: true }), event('deleted', '2026-10-01T08:00:00Z', '2026-10-01T09:00:00Z', { deleted: true })]
    const task = { title: 'Test', course: 'TEST101', deadlineLocal: '2026-10-01T12:00', completed: true }
    data.tasks = [{ ...task, id: 'done' }, { ...task, id: 'ready', requiresSubmission: true }, { ...task, id: 'delivered', requiresSubmission: true, submitted: true }]
    expect(upcomingAgenda(data).map(row => row.id)).toEqual(['ready'])
  })
  it('filters course events and legacy task text, without misattributing general study sessions', () => {
    const data = structuredClone(model)
    data.courseFilter = course.id
    data.planner.events = [event('matching', '2026-10-01T08:00:00Z', '2026-10-01T09:00:00Z'), event('other', '2026-10-01T08:00:00Z', '2026-10-01T09:00:00Z', { courseId: 'other' })]
    data.tasks = [{ id: 'legacy', title: 'Task', course: 'TEST101', deadlineLocal: '2026-10-01T15:00' }]
    data.sessions = [{ id: 'general', dateLocal: '2026-10-01', startTime: '10:00', endTime: '11:00' }]
    expect(upcomingAgenda(data).map(row => row.id)).toEqual(['matching', 'legacy'])
  })
})
