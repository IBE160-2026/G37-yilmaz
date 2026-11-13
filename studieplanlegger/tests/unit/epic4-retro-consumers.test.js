import { describe, expect, it } from 'vitest'
import { deriveWorkCapacity } from '../../src/work-capacity.js'
import { dailyOverview } from '../../src/daily-overview.js'

const task = (id, deadlineLocal, deadlineDisambiguation) => ({
  id, title: id, course: 'IBE160', completed: false, estimatedMinutes: 180,
  deadlineLocal, deadlineDisambiguation,
})
const now = new Date('2027-10-30T22:00:00Z')

describe('Epic 4: explicit occurrences at independent consumer boundaries', () => {
  it.each([['earlier', 90], ['later', 150]])('credits only the linked reservation before the %s deadline', (choice, credited) => {
    const tasks = [task('reserved', '2027-10-31T02:30', choice)]
    const sessions = [{ id: 'autumn', taskId: 'reserved', dateLocal: '2027-10-31', endDateLocal: '2027-10-31', startTime: '01:00', endTime: '03:00' }]
    const windows = [{ id: 'work', start: '2027-10-30T23:00:00Z', end: '2027-10-31T02:00:00Z' }]
    const original = JSON.stringify({ tasks, sessions, windows })
    const capacity = deriveWorkCapacity(tasks, sessions, now, [], windows)

    expect(capacity.totalCapacityMinutes).toBe(180)
    expect(capacity.totalReservedMinutes).toBe(180)
    expect(capacity.tasks[0]).toMatchObject({
      taskId: 'reserved', requiredMinutes: 180, reservedMinutes: credited,
      allocatedMinutes: credited, availableBeforeMinutes: credited, missingMinutes: 180 - credited,
      allocations: [{ sessionId: 'autumn', startLocal: '2027-10-31T01:00', endLocal: '2027-10-31T02:30', minutes: credited, reserved: true }],
    })
    expect(JSON.stringify({ tasks, sessions, windows })).toBe(original)
  })

  it('selects the earliest daily deadline by instant when wall-clock order is reversed', () => {
    const earlier = task('z-earlier', '2027-10-31T02:45', 'earlier')
    const later = task('a-later', '2027-10-31T02:15', 'later')
    const model = { tasks: [later, earlier], sessions: [], now }
    const before = JSON.stringify(model)
    const data = dailyOverview(model)

    expect(data.deadline.id).toBe(earlier.id)
    expect(data.deadline.start).toBe(Date.parse('2027-10-31T00:45:00Z'))
    expect(data.rows.map(row => row.task.id)).toEqual([earlier.id, later.id])
    expect(data.overdue).toEqual([])
    expect(JSON.stringify(model)).toBe(before)
    const afterBoth = dailyOverview({ ...model, now: new Date('2027-10-31T01:16:00Z') })
    expect(afterBoth.overdue.map(entry => entry.id)).toEqual([earlier.id, later.id])
  })
})
