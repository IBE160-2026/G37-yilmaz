import { describe, expect, it } from 'vitest'
import { upcomingAgenda } from '../../src/agenda-view.js'
import { isOverdue } from '../../src/tasks.js'

const repeated = '2027-10-31T02:30'
const task = (id, deadlineLocal = repeated, patch = {}) => ({
  id, title: id, course: 'TEST101', deadlineLocal, estimatedMinutes: 30, completed: false, ...patch,
})

describe('Epic 4 agenda occurrence boundaries', () => {
  it.each([
    ['before either occurrence', '2027-10-31T00:29:59.999Z', false],
    ['at the first occurrence', '2027-10-31T00:30:00.000Z', false],
    ['between occurrences', '2027-10-31T01:00:00.000Z', false],
    ['at the last occurrence', '2027-10-31T01:30:00.000Z', false],
    ['strictly after the last occurrence', '2027-10-31T01:30:00.001Z', true],
  ])('keeps the unresolved record repairable %s', (_, instant, expired) => {
    const legacy = task('legacy')
    const upcoming = task('upcoming', '2027-11-01T12:00')
    const model = { now: new Date(instant), tasks: [legacy, upcoming] }
    const before = structuredClone(model)

    const entries = upcomingAgenda(model)

    expect(isOverdue(legacy, model.now)).toBe(expired)
    expect(entries.map(entry => entry.id)).toEqual(expired ? ['upcoming', 'legacy'] : ['legacy', 'upcoming'])
    expect(entries.find(entry => entry.id === 'legacy')).toMatchObject({
      warning: 'Fristens klokkeslett må presiseres.', date: '2027-10-31', time: '02:30',
    })
    expect(entries.find(entry => entry.id === 'legacy').occurrence).toBe('')
    expect(model).toEqual(before)
    expect(legacy).not.toHaveProperty('deadlineDisambiguation')
  })

  it('keeps upcoming work in the compact first five when five unresolved records have expired', () => {
    const tasks = [...Array.from({ length: 5 }, (_, i) => task(`legacy-${i}`)), task('upcoming', '2027-11-01T12:00')]
    const before = structuredClone(tasks)
    const entries = upcomingAgenda({ tasks, now: new Date('2027-10-31T01:30:00.001Z') })

    expect(entries[0].id).toBe('upcoming')
    expect(entries.slice(0, 5).map(entry => entry.id)).toContain('upcoming')
    expect(entries.slice(1).map(entry => entry.id)).toEqual(tasks.slice(0, 5).map(item => item.id))
    expect(entries.slice(1).every(entry => entry.warning && !entry.occurrence)).toBe(true)
    expect(tasks).toEqual(before)
  })

  it('orders mixed offset teaching and a selected later deadline by instant, with deterministic ties', () => {
    const model = {
      now: new Date('2027-10-30T12:00:00Z'),
      tasks: [task('later', repeated, { deadlineDisambiguation: 'later' })],
      planner: { courses: [], events: [
        { id: 'teaching-b', title: 'Same time', start: '2027-10-31T02:15:00+02:00', end: '2027-10-31T02:20:00+02:00' },
        { id: 'teaching-a', title: 'Same time', start: '2027-10-31T00:15:00Z', end: '2027-10-31T00:20:00Z' },
      ] },
    }
    expect(upcomingAgenda(model).map(entry => entry.id)).toEqual(['teaching-a', 'teaching-b', 'later'])
    expect(upcomingAgenda(model).at(-1).occurrence).toBe('Andre 02:30 (vintertid, UTC+01:00)')
  })
})
