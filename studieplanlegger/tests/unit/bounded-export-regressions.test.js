import { describe, expect, it, vi } from 'vitest'
import ICAL from 'ical.js'
import { calendarExportItems, calendarExportOmissions, calendarUid, downloadCalendarIcs, generateCalendarIcs } from '../../src/calendar-export.js'

const events = source => new ICAL.Component(ICAL.parse(source)).getAllSubcomponents('vevent')
const session = (id, extra = {}) => ({ id, dateLocal: '2026-10-25', startTime: '10:00', endTime: '10:30', ...extra })

describe('bounded calendar export regressions', () => {
  it('exports the actual taskless review topic with escaping, stable UID and Oslo winter time', () => {
    const title = 'Ærlig, tema; med \\ tegn\nog ny linje ' + 'Ø'.repeat(70)
    const state = { tasks: [], topics: [{ id: 'topic', title }], sessions: [session('review', { reviewTopicId: 'topic' })] }
    const before = structuredClone(state), source = generateCalendarIcs(state), [event] = events(source)
    expect(event.getFirstPropertyValue('summary')).toBe(`Repetisjon: ${title}`)
    expect(event.getFirstPropertyValue('uid')).toBe(calendarUid('session', 'review'))
    expect(event.getFirstPropertyValue('dtstart').toString()).toBe('2026-10-25T09:00:00Z')
    expect(event.getFirstPropertyValue('dtend').toString()).toBe('2026-10-25T09:30:00Z')
    expect(source.split('\r\n').every(line => Buffer.byteLength(line) <= 75)).toBe(true)
    expect(generateCalendarIcs(state)).toBe(source)
    expect(state).toEqual(before)
  })

  it('uses an honest missing-topic fallback and preserves ordinary linked study titles and summer time', () => {
    const state = { tasks: [{ id: 'task', title: 'Oppgave', course: 'TEST101' }], sessions: [
      session('missing', { reviewTopicId: 'unavailable' }),
      session('ordinary', { taskId: 'task', dateLocal: '2026-10-24' }),
      session('unlinked'),
    ] }
    const byId = new Map(events(generateCalendarIcs(state)).map(event => [event.getFirstPropertyValue('uid'), event]))
    expect(byId.get(calendarUid('session', 'missing')).getFirstPropertyValue('summary')).toBe('Repetisjon (tema ikke tilgjengelig)')
    expect(byId.get(calendarUid('session', 'ordinary')).getFirstPropertyValue('summary')).toBe('[TEST101] Studieøkt: Oppgave')
    expect(byId.get(calendarUid('session', 'ordinary')).getFirstPropertyValue('dtstart').toString()).toBe('2026-10-24T08:00:00Z')
    expect(byId.get(calendarUid('session', 'unlinked')).getFirstPropertyValue('summary')).toBe('Studieøkt')
  })

  it('names each omitted deadline and distinguishes invalid dates, skipped and repeated Oslo clock times', () => {
    const state = { tasks: [
      { id: 'date', title: 'Datofrist', deadlineLocal: '2026-10-25' },
      { id: 'valid', title: 'Gyldig tid', deadlineLocal: '2026-10-25T10:00' },
      { id: 'repeat', title: 'Gjentatt time', deadlineLocal: '2026-10-25T02:30' },
      { id: 'gap', title: 'Manglende time', deadlineLocal: '2026-03-29T02:30' },
      { id: 'invalid', title: 'Ugyldig dato', deadlineLocal: '2026-02-30' },
      { id: 'no-deadline', title: 'Ingen frist' },
    ] }
    const before = structuredClone(state), omissions = calendarExportOmissions(state)
    expect(omissions.map(item => item.id)).toEqual(['repeat', 'gap', 'invalid'])
    expect(omissions[0]).toMatchObject({ title: 'Gjentatt time', reason: expect.stringContaining('to ganger') })
    expect(omissions[1].reason).toContain('finnes ikke')
    expect(omissions[2].reason).toContain('ugyldig')
    const october = { from: '2026-10-25', to: '2026-10-25' }
    expect(calendarExportOmissions(state, october).map(item => item.id)).toEqual(['repeat'])
    expect(calendarExportOmissions(state, { includeDeadlines: false })).toEqual([])
    expect(calendarExportItems(state, october)).toHaveLength(2)
    const exported = events(generateCalendarIcs(state, october))
    expect(exported).toHaveLength(2)
    const date = exported.find(event => event.getFirstPropertyValue('uid') === calendarUid('deadline', 'date'))
    expect(date.getFirstPropertyValue('dtstart').isDate).toBe(true)
    expect(date.getFirstPropertyValue('dtstart').toString()).toBe('2026-10-25')
    expect(date.getFirstPropertyValue('transp')).toBe('TRANSPARENT')
    expect(date.hasProperty('dtend')).toBe(false)
    expect(state).toEqual(before)
  })

  it('does not create a download when all selected deadlines are omitted', () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL')
    try {
      expect(() => downloadCalendarIcs({ tasks: [{ id: 'ambiguous', title: 'Tvetydig frist', deadlineLocal: '2026-10-25T02:30' }] })).toThrow('Ingen aktiviteter')
      expect(createUrl).not.toHaveBeenCalled()
    } finally { createUrl.mockRestore() }
  })

  it('keeps excluded recovered events out of explicit teaching and personal exports', () => {
    const planner = { courses: [], sources: [], events: [
      { id: 'teaching', title: 'Skjult undervisning', courseId: '', start: '2026-10-25T09:00:00Z', end: '2026-10-25T10:00:00Z', excluded: true },
      { id: 'personal', title: 'Skjult aktivitet', activityKind: 'personal', courseId: '', dateLocal: '2026-10-25', excluded: true },
    ] }
    expect(calendarExportItems({ tasks: [], sessions: [], planner }, { includeTeaching: true, includePersonal: true })).toEqual([])
  })
})
