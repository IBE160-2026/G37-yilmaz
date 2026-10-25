import { describe, expect, it, vi } from 'vitest'
import ICAL from 'ical.js'
import { calendarExportItems, calendarExportOmissions, calendarUid, downloadCalendarIcs, generateCalendarIcs } from '../../src/calendar-export.js'
import { calendarEntries, timeLabel } from '../../src/calendar-model.js'

// Independently invented records. No source fixture or personal calendar is used.
const options = { includeTeaching: true, includePersonal: true }
const start = '2041-11-18T10:00:07.125Z', end = '2041-11-18T10:00:07.875Z'
const event = extra => ({ id: 'synthetic-fraction', title: 'Oppdiktet presis aktivitet', start, end, ...extra })
const stateFor = extra => ({ tasks: [], sessions: [], planner: { courses: [], events: [event(extra)] } })
const events = source => new ICAL.Component(ICAL.parse(source)).getAllSubcomponents('vevent')

describe('calendar export precision boundary', () => {
  it.each([
    ['teaching interval', {}],
    ['teaching point', { point: true, end: start }],
    ['personal interval', { activityKind: 'personal', dateLocal: '2041-11-18' }],
    ['personal point', { activityKind: 'personal', dateLocal: '2041-11-18', point: true, end: start }],
    ['personal start only', { activityKind: 'personal', dateLocal: '2041-11-18', end: undefined }],
    ['fractional end only', { start: '2041-11-18T10:00:07Z' }],
  ])('omits %s with exact instants and no mutation or rounded output', (_name, extra) => {
    const state = stateFor(extra), before = structuredClone(state)
    expect(calendarExportItems(state, options)).toEqual([])
    const omitted = calendarExportOmissions(state, options)
    expect(omitted).toHaveLength(1)
    expect(omitted[0]).toMatchObject({ id: 'synthetic-fraction', title: 'Oppdiktet presis aktivitet', reason: expect.stringContaining('hele sekunder') })
    expect(omitted[0].time).toContain(new Date(extra.start || start).toISOString())
    if (!extra.point && (extra.end === undefined ? !Object.hasOwn(extra, 'end') : true)) expect(omitted[0].time).toContain(new Date(extra.end || end).toISOString())
    expect(events(generateCalendarIcs(state, options))).toEqual([])
    expect(state).toEqual(before)
  })

  it('respects selected types and dates for omissions', () => {
    const state = stateFor({})
    expect(calendarExportOmissions(state)).toEqual([])
    expect(calendarExportOmissions(state, { ...options, from: '2041-11-19' })).toEqual([])
    expect(calendarExportOmissions(state, { ...options, to: '2041-11-17' })).toEqual([])
  })

  it('does not truncate a fractional legacy deadline accepted by the time converter', () => {
    const state = { tasks: [{ id: 'synthetic-fractional-deadline', title: 'Oppdiktet presis frist', deadlineLocal: '2041-11-18T12:00:07.125' }] }, before = structuredClone(state)
    expect(calendarExportItems(state)).toEqual([])
    expect(calendarExportOmissions(state)[0]).toMatchObject({ kind: 'deadline', time: '2041-11-18T11:00:07.125Z', reason: expect.stringContaining('hele sekunder') })
    expect(events(generateCalendarIcs(state))).toEqual([])
    expect(state).toEqual(before)
  })

  it('keeps all representable selected types, stable UIDs and capacities while excluding fractions', () => {
    const state = stateFor({})
    state.tasks = [{ id: 'synthetic-deadline', title: 'Oppdiktet frist', deadlineLocal: '2041-11-18T12:00' }]
    state.sessions = [{ id: 'synthetic-session', taskId: 'synthetic-deadline', dateLocal: '2041-11-18', startTime: '13:00', endTime: '13:30' }]
    state.planner.events.push(event({ id: 'synthetic-whole', start: '2041-11-18T10:00:07.000Z', end: '2041-11-18T10:00:17.000Z' }),
      event({ id: 'synthetic-date', activityKind: 'personal', dateLocal: '2041-11-18', start: undefined, end: undefined }))
    const before = structuredClone(state), source = generateCalendarIcs(state, options), output = events(source)
    expect(output).toHaveLength(4)
    expect(calendarExportOmissions(state, options)).toHaveLength(1)
    expect(output.map(item => item.getFirstPropertyValue('uid')).sort()).toEqual(['deadline:synthetic-deadline', 'session:synthetic-session', 'teaching:synthetic-whole', 'personal:synthetic-date'].map(value => calendarUid(...value.split(':'))).sort())
    const teaching = output.find(item => item.getFirstPropertyValue('uid') === calendarUid('teaching', 'synthetic-whole'))
    expect(teaching.getFirstPropertyValue('dtstart').toString()).toBe('2041-11-18T10:00:07Z')
    expect(teaching.getFirstPropertyValue('dtend').toString()).toBe('2041-11-18T10:00:17Z')
    expect(teaching.getFirstPropertyValue('transp')).toBe('OPAQUE')
    expect(state).toEqual(before)
  })

  it('does not create a download when every selected item is unrepresentable', () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL')
    try {
      expect(() => downloadCalendarIcs(stateFor({}), options)).toThrow('Ingen aktiviteter')
      expect(createUrl).not.toHaveBeenCalled()
    } finally { createUrl.mockRestore() }
  })
})

describe('repeated autumn hour labels', () => {
  it.each([
    ['teaching point', { point: true }],
    ['personal point', { activityKind: 'personal', dateLocal: '2026-10-25', point: true }],
    ['personal start only', { activityKind: 'personal', dateLocal: '2026-10-25', end: undefined }],
  ])('distinguishes both occurrences of a %s without changing stored instants', (_name, extra) => {
    const times = ['2026-10-25T00:30:07Z', '2026-10-25T01:30:07Z']
    const state = { planner: { events: times.map((time, index) => event({ id: `synthetic-fold-${index}`, start: time, end: time, ...extra })) } }, before = structuredClone(state)
    const labels = calendarEntries(state).map(timeLabel)
    expect(labels[0]).toContain('02:30:07 (+02:00)')
    expect(labels[1]).toContain('02:30:07 (+01:00)')
    expect(state).toEqual(before)
  })

  it('retains offset distinctions for intervals and ordinary compact times elsewhere', () => {
    expect(timeLabel({ start: Date.parse('2026-10-25T00:30:00Z'), end: Date.parse('2026-10-25T01:30:00Z') })).toBe('02:30 (+02:00)–02:30 (+01:00)')
    expect(timeLabel({ start: Date.parse('2026-10-25T01:30:00Z'), end: Date.parse('2026-10-25T02:30:00Z') })).toBe('02:30 (+01:00)–03:30 (+01:00)')
    expect(timeLabel({ point: true, start: Date.parse('2026-10-26T01:30:00Z') })).toContain('Kl. 02:30 ·')
  })
})
