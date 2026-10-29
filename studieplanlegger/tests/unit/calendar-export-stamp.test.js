import { describe, expect, it, vi } from 'vitest'
import ICAL from 'ical.js'
import { calendarUid, generateCalendarIcs } from '../../src/calendar-export.js'

const read = source => new ICAL.Component(ICAL.parse(source))
const value = (event, name) => event.getFirstPropertyValue(name)?.toString()
const allKinds = () => ({
  tasks: [
    { id: 'synthetic-timed', title: 'Syntetisk frist', deadlineLocal: '2026-10-29T20:00' },
    { id: 'synthetic-day', title: 'Syntetisk datofrist', deadlineLocal: '2026-10-30' },
  ],
  sessions: [
    { id: 'synthetic-summer', taskId: 'synthetic-timed', dateLocal: '2026-10-24', startTime: '10:00', endTime: '10:30' },
    { id: 'synthetic-winter', taskId: 'synthetic-timed', dateLocal: '2026-10-29', startTime: '10:00', endTime: '10:30' },
  ],
  planner: { courses: [], events: [
    { id: 'synthetic-teaching', title: 'Syntetisk undervisning', start: '2026-10-29T11:15:07Z', end: '2026-10-29T12:00:17Z' },
    { id: 'synthetic-personal', title: 'Syntetisk avtale', activityKind: 'personal', dateLocal: '2026-10-29', start: '2026-10-29T13:00:00Z', end: '2026-10-29T14:00:00Z' },
    { id: 'synthetic-all-day', title: 'Syntetisk heldag', activityKind: 'personal', dateLocal: '2026-10-30', allDay: true, start: '2026-10-29T23:00:00Z', end: '2026-10-30T23:00:00Z' },
  ] },
})
const options = { includeTeaching: true, includePersonal: true }

describe('RFC 5545 METHOD:PUBLISH creation timestamp', () => {
  it('reads the injected clock once and stamps every event kind in UTC whole seconds', () => {
    const state = allKinds(), before = structuredClone(state)
    const now = vi.fn(() => new Date('2026-10-29T18:22:32.789+01:00'))
    const calendar = read(generateCalendarIcs(state, { ...options, now }))
    expect(now).toHaveBeenCalledTimes(1)
    expect(calendar.getFirstPropertyValue('method')).toBe('PUBLISH')
    const events = calendar.getAllSubcomponents('vevent')
    expect(events).toHaveLength(7)
    for (const event of events) {
      expect(event.getAllProperties('dtstamp')).toHaveLength(1)
      expect(value(event, 'dtstamp')).toBe('2026-10-29T17:22:32Z')
      expect(event.getFirstPropertyValue('dtstamp').zone.tzid).toBe('UTC')
    }
    expect(state).toEqual(before)
  })

  it('changes only DTSTAMP on a later export while retaining UID, UTC endpoints and DATE values', () => {
    const state = allKinds()
    const first = generateCalendarIcs(state, { ...options, now: () => Date.parse('2026-10-29T17:00:00Z') })
    const second = generateCalendarIcs(state, { ...options, now: () => Date.parse('2026-10-29T18:00:00Z') })
    expect(second).not.toBe(first)
    expect(second.replaceAll('DTSTAMP:20261029T180000Z', 'DTSTAMP:20261029T170000Z')).toBe(first)
    const events = new Map(read(second).getAllSubcomponents('vevent').map(event => [value(event, 'uid'), event]))
    const event = (kind, id) => events.get(calendarUid(kind, `synthetic-${id}`))
    expect(value(event('session', 'summer'), 'dtstart')).toBe('2026-10-24T08:00:00Z')
    expect(value(event('session', 'winter'), 'dtstart')).toBe('2026-10-29T09:00:00Z')
    expect(value(event('session', 'winter'), 'dtend')).toBe('2026-10-29T09:30:00Z')
    expect(value(event('teaching', 'teaching'), 'dtstart')).toBe('2026-10-29T11:15:07Z')
    expect(value(event('teaching', 'teaching'), 'dtend')).toBe('2026-10-29T12:00:17Z')
    expect(value(event('deadline', 'timed'), 'dtstart')).toBe('2026-10-29T19:00:00Z')
    expect(value(event('deadline', 'day'), 'dtstart')).toBe('2026-10-30')
    expect(event('deadline', 'day').getFirstPropertyValue('dtstart').isDate).toBe(true)
    expect(event('deadline', 'day').hasProperty('dtend')).toBe(false)
    expect(value(event('personal', 'all-day'), 'dtstart')).toBe('2026-10-30')
    expect(value(event('personal', 'all-day'), 'dtend')).toBe('2026-10-31')
    expect(event('personal', 'all-day').getFirstPropertyValue('dtend').isDate).toBe(true)
  })

  it('retains an edited event UID while publishing its changed fields with the new creation time', () => {
    const state = allKinds(), uid = calendarUid('session', 'synthetic-winter')
    const first = read(generateCalendarIcs(state, { now: () => Date.parse('2026-10-29T17:00:00Z') }))
    state.sessions[1].startTime = '15:00'; state.sessions[1].endTime = '15:45'
    state.tasks[0].title = 'Endret syntetisk tittel'
    const before = structuredClone(state)
    const second = read(generateCalendarIcs(state, { now: () => Date.parse('2026-10-29T18:00:00Z') }))
    const find = calendar => calendar.getAllSubcomponents('vevent').find(event => value(event, 'uid') === uid)
    expect(value(find(first), 'dtstart')).toBe('2026-10-29T09:00:00Z')
    expect(value(find(second), 'dtstart')).toBe('2026-10-29T14:00:00Z')
    expect(value(find(second), 'dtend')).toBe('2026-10-29T14:45:00Z')
    expect(value(find(second), 'summary')).toBe('Studieøkt: Endret syntetisk tittel')
    expect(value(find(second), 'dtstamp')).toBe('2026-10-29T18:00:00Z')
    expect(state).toEqual(before)
  })

  it('uses the current system clock when none is injected', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-29T17:22:32Z'))
    try {
      expect(generateCalendarIcs(allKinds())).toContain('DTSTAMP:20261029T172232Z')
      expect(now).toHaveBeenCalledTimes(1)
    } finally { now.mockRestore() }
  })
})
