import { describe, expect, it } from 'vitest'
import ICAL from 'ical.js'
import { calendarExportItems, calendarExportOmissions, calendarExportTime, calendarUid, generateCalendarIcs } from '../../src/calendar-export.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { eventBlocksTime, validPlanner, validateEvent } from '../../src/planner.js'

// Independent synthetic legacy records: the accepted planner contract permits
// finer timestamps than the CSV editor, so export must inspect the originals.
const course = { id: 'synthetic-course', code: 'SYN842', name: 'Oppdiktet emne', university: '', year: 2041, semester: 'autumn', credits: null }
const stateFor = events => ({ tasks: [], sessions: [], planner: { courses: [course], events, sources: [] } })
const event = extra => ({ id: 'synthetic-event', title: 'Oppdiktet aktivitet', courseId: course.id, start: '2041-11-01T10:00:00Z', end: '2041-11-01T11:00:00Z', ...extra })
const output = source => new ICAL.Component(ICAL.parse(source)).getAllSubcomponents('vevent')
const options = { includeTeaching: true, includePersonal: true }

describe('export accepted precision without truncation', () => {
  it.each(['000001', '000000001'])('omits original .%s seconds and retains exact UTC evidence and Oslo labels', fraction => {
    const start = `2041-11-01T10:00:00.${fraction}Z`, end = `2041-11-01T11:00:00.${fraction}Z`
    const state = stateFor([event({ start, end })]), before = structuredClone(state)
    expect(validPlanner(state.planner)).toBe(true)
    expect(calendarExportItems(state, options)).toEqual([])
    const omitted = calendarExportOmissions(state, options)
    expect(omitted).toHaveLength(1)
    expect(omitted[0].time).toBe(`${start} – ${end}`)
    expect(calendarExportTime(omitted[0])).toBe(`2041-11-01 11:00:00.${fraction} (+01:00) – 2041-11-01 12:00:00.${fraction} (+01:00)`)
    expect(output(generateCalendarIcs(state, options))).toEqual([])
    expect(state).toEqual(before)
  })

  it('checks personal endpoints and legacy deadlines before reducing their precision', () => {
    const state = stateFor([event({ activityKind: 'personal', courseId: '', dateLocal: '2041-11-01', end: '2041-11-01T11:00:00.000001Z' })])
    state.tasks = [{ id: 'synthetic-legacy-deadline', title: 'Oppdiktet presis frist', deadlineLocal: '2041-11-01T12:00:00.000000001' }]
    expect(calendarExportItems(state, options)).toEqual([])
    const omitted = calendarExportOmissions(state, options)
    expect(omitted).toHaveLength(2)
    expect(omitted.find(item => item.kind === 'personal').time).toContain('11:00:00.000001Z')
    expect(omitted.find(item => item.kind === 'deadline').time).toBe('2041-11-01T11:00:00.000000001Z')
  })

  it('shows both repeated-hour offsets in review while retaining exact whole-second output', () => {
    const state = stateFor([event({ start: '2026-10-25T00:30:07Z', end: '2026-10-25T01:30:07Z' })])
    expect(calendarExportTime(calendarExportItems(state, options)[0])).toBe('2026-10-25 02:30:07 (+02:00) – 2026-10-25 02:30:07 (+01:00)')
    expect(output(generateCalendarIcs(state, options))[0].getFirstPropertyValue('dtend').toString()).toBe('2026-10-25T01:30:07Z')
  })
})

describe('personal intervals and imported calendar dates', () => {
  it.each(['teaching', 'personal'])('omits %s dates whose accepted edits no longer represent whole Oslo days', kind => {
    const source = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:synthetic-edited-days', 'SUMMARY:Oppdiktede redigerte dager', ...(kind === 'personal' ? ['X-STUDIEPLAN-ACTIVITY-KIND:personal'] : []), 'DTSTART;VALUE=DATE:20450418', 'DTEND;VALUE=DATE:20450420', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const previous = { ...parseCalendar(source, { fileImport: true, courseId: course.id }).events[0], id: 'synthetic-edited-days', importSourceId: 'synthetic-source', importEntryKey: 'synthetic-entry' }
    for (const [startLocal, endLocal] of [
      ['2045-04-18T10:00', '2045-04-18T11:00'],
      ['2045-04-18T00:00', '2045-04-19T11:00'],
      ['2045-04-18T00:00:00.000001', '2045-04-19T00:00'],
      ['2045-04-18T00:00', '2045-04-19T00:00:00.000000001'],
    ]) {
      const edited = validateEvent({ title: previous.title, courseId: kind === 'personal' ? '' : course.id, startLocal, endLocal }, previous)
      const state = stateFor([edited]), before = structuredClone(state)
      expect(edited.allDay).toBe(true)
      expect(validPlanner(state.planner)).toBe(true)
      expect(calendarExportItems(state, options)).toEqual([])
      const omitted = calendarExportOmissions(state, options)
      expect(omitted).toHaveLength(1)
      expect(omitted[0].reason).toContain('Hele kalenderdager krever midnatt i norsk tid')
      expect(calendarExportTime(omitted[0])).toContain('(+02:00)')
      expect(omitted[0].time).toContain(edited.start.replace('Z', '').replace(/\.0+$/, ''))
      expect(output(generateCalendarIcs(state, options))).toEqual([])
      expect(state).toEqual(before)
    }
  })

  it('keeps exact Oslo whole-day boundaries across the 23-hour daylight-saving day', () => {
    const state = stateFor([event({ allDay: true, start: '2026-03-28T23:00:00Z', end: '2026-03-29T22:00:00Z' })])
    expect(calendarExportOmissions(state, options)).toEqual([])
    const [exported] = output(generateCalendarIcs(state, options))
    expect(exported.getFirstPropertyValue('dtstart').toString()).toBe('2026-03-29')
    expect(exported.getFirstPropertyValue('dtend').toString()).toBe('2026-03-30')
  })

  it('keeps the existing nonblocking-teaching exclusion visible in review', () => {
    const state = stateFor([event({ transparent: true }), event({ id: 'synthetic-information', information: true })]), before = structuredClone(state)
    expect(calendarExportItems(state, options)).toEqual([])
    const omitted = calendarExportOmissions(state, options)
    expect(omitted.map(item => item.id)).toEqual(['synthetic-event', 'synthetic-information'])
    expect(omitted.every(item => item.reason.includes('reserverer ikke tid'))).toBe(true)
    expect(calendarExportOmissions(state, { ...options, includeTeaching: false })).toEqual([])
    expect(calendarExportOmissions(state, { ...options, from: '2041-11-02' })).toEqual([])
    expect(output(generateCalendarIcs(state, options))).toEqual([])
    expect(state).toEqual(before)
  })

  it('retains teaching DATE semantics and exclusive end without changing the stored interval', () => {
    const state = stateFor([event({ allDay: true, start: '2041-10-31T23:00:00Z', end: '2041-11-02T23:00:00Z' })]), before = structuredClone(state)
    expect(validPlanner(state.planner)).toBe(true)
    const [exported] = output(generateCalendarIcs(state, { ...options, from: '2041-11-02', to: '2041-11-02' }))
    expect(exported.getFirstPropertyValue('dtstart').isDate).toBe(true)
    expect(exported.getFirstPropertyValue('dtstart').toString()).toBe('2041-11-01')
    expect(exported.getFirstPropertyValue('dtend').isDate).toBe(true)
    expect(exported.getFirstPropertyValue('dtend').toString()).toBe('2041-11-03')
    expect(exported.getFirstPropertyValue('uid')).toBe(calendarUid('teaching', 'synthetic-event'))
    expect(exported.getFirstPropertyValue('transp')).toBe('OPAQUE')
    expect(state).toEqual(before)
  })

  it('includes the overlapping continuation, but excludes the exclusive end boundary', () => {
    const state = stateFor([event({ activityKind: 'personal', courseId: '', dateLocal: '2041-11-01', start: '2041-11-01T22:00:00Z', end: '2041-11-02T01:00:00Z' })])
    const selected = { ...options, from: '2041-11-02', to: '2041-11-02' }
    expect(calendarExportItems(state, selected)).toHaveLength(1)
    expect(output(generateCalendarIcs(state, selected))[0].getFirstPropertyValue('dtstart').toString()).toBe('2041-11-01T22:00:00Z')
    const midnight = stateFor([event({ ...state.planner.events[0], end: '2041-11-01T23:00:00Z' })])
    expect(calendarExportItems(midnight, selected)).toEqual([])
  })

  it('keeps imported personal DATE semantics, exclusive end, UID, transparency and source state', () => {
    const source = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:synthetic-personal-days', 'SUMMARY:Oppdiktede hele dager', 'X-STUDIEPLAN-ACTIVITY-KIND:personal', 'DTSTART;VALUE=DATE:20411101', 'DTEND;VALUE=DATE:20411103', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const parsed = parseCalendar(source, { fileImport: true, courseId: '' }).events[0]
    const original = { ...parsed, id: 'synthetic-personal-days', dateLocal: '2041-11-01', importSourceId: 'synthetic-source', importEntryKey: 'synthetic-entry' }
    const state = stateFor([original]), before = structuredClone(state), selected = { ...options, from: '2041-11-02', to: '2041-11-02' }
    expect(validPlanner(state.planner)).toBe(true)
    const items = calendarExportItems(state, selected)
    expect(items).toHaveLength(1)
    expect(calendarExportTime(items[0])).toBe('2041-11-01 – 2041-11-03 (sluttdato ikke inkludert)')
    const [exported] = output(generateCalendarIcs(state, selected))
    expect(exported.getFirstPropertyValue('dtstart').isDate).toBe(true)
    expect(exported.getFirstPropertyValue('dtstart').toString()).toBe('2041-11-01')
    expect(exported.getFirstPropertyValue('dtend').isDate).toBe(true)
    expect(exported.getFirstPropertyValue('dtend').toString()).toBe('2041-11-03')
    expect(exported.getFirstPropertyValue('uid')).toBe(calendarUid('personal', original.id))
    expect(exported.getFirstPropertyValue('transp')).toBe(eventBlocksTime(original) ? 'OPAQUE' : 'TRANSPARENT')
    expect(calendarExportItems(state, { ...options, from: '2041-11-03', to: '2041-11-03' })).toEqual([])
    expect(calendarExportOmissions(state, selected)).toEqual([])
    expect(state).toEqual(before)
  })
})
