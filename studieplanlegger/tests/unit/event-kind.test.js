import { describe, expect, it } from 'vitest'
import { eventPresentation, isExamEvent } from '../../src/event-kind.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { calendarExportItems } from '../../src/calendar-export.js'
import { calendarEntries, timeLabel } from '../../src/calendar-model.js'
import { subjectDeadlineTime, subjectDeadlineUpcoming } from '../../src/subjects-view.js'

describe('exam activity kind', () => {
  it('uses structured evidence and narrow legacy titles', () => {
    expect(isExamEvent({ title: 'Vanlig time', activityKind: 'exam' })).toBe(true)
    expect(isExamEvent({ title: 'Sluttvurdering', activityKind: 'assessment' })).toBe(false)
    expect(isExamEvent({ title: 'Eksamen IBE160', activityKind: 'assessment' })).toBe(false)
    expect(isExamEvent({ title: 'IBE160 skriftlig eksamen' })).toBe(true)
    expect(isExamEvent({ title: 'Eksamensforberedelse' })).toBe(false)
    expect(isExamEvent({ title: 'Mock exam' })).toBe(false)
    for (const title of ['Prøve eksamen', 'Prøve-eksamen', 'Mock-exam', 'Practice exam', 'Mock examination', 'Practice examination', 'Exam-preparation', 'Forberedelse til eksamen', 'Forelesning om eksamen', 'Lecture about the exam']) expect(isExamEvent({ title })).toBe(false)
    expect(isExamEvent({ title: 'Sluttvurdering' })).toBe(false)
    expect(eventPresentation({ title: 'Eksamen IBE160' })).toMatchObject({ symbol: '📝', label: 'Eksamen', isExam: true })
  })

  it('preserves generic structured assessment without presenting it as exam', () => {
    const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//NO', 'BEGIN:VEVENT', 'UID:assessment-1', 'DTSTART:20261001T080000Z', 'DTEND:20261001T080001Z', 'SUMMARY:Sluttvurdering', 'TRANSP:TRANSPARENT', 'X-STUDIEPLAN-ACTIVITY-KIND:assessment', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const result = parseCalendar(calendar, { courseId: 'c1', semester: 'autumn', year: 2026 })
    expect(result.events[0]).toMatchObject({ title: 'Sluttvurdering', activityKind: 'assessment', information: true })
    expect(isExamEvent(result.events[0])).toBe(false)
  })

  it('keeps exam inside the teaching export choice without changing title', () => {
    const state = { tasks: [], planner: { courses: [{ id: 'c1', code: 'IBE160', name: 'Digitalisering' }], events: [{ id: 'e1', title: 'Avsluttende prøve', activityKind: 'exam', courseId: 'c1', start: '2026-10-01T08:00:00Z', end: '2026-10-01T10:00:00Z' }] } }
    expect(calendarExportItems(state, { from: '2026-10-01', to: '2026-10-01' })).toEqual([])
    expect(calendarExportItems(state, { from: '2026-10-01', to: '2026-10-01', includeTeaching: true })[0]).toMatchObject({ kind: 'teaching', title: 'Avsluttende prøve', course: 'IBE160' })
  })

  it('keeps a date-only deadline date-only on calendar surfaces', () => {
    const entry = calendarEntries({ tasks: [{ id: 't1', title: 'Rapport', course: '', deadlineLocal: '2026-10-12', estimatedMinutes: null, completed: false }] }).find(item => item.key === 'task:t1')
    expect(entry).toMatchObject({ point: true, allDay: true })
    expect(timeLabel(entry)).toBe('Frist – klokkeslett ikke oppgitt')
    expect(subjectDeadlineTime({ deadlineLocal: '2026-07-01' })).toBe('2026-07-01T22:00:00.000Z')
    expect(subjectDeadlineTime({ deadlineLocal: '2026-12-01' })).toBe('2026-12-01T23:00:00.000Z')
    expect(subjectDeadlineUpcoming({ deadlineLocal: '2026-07-01' }, new Date('2026-07-01T21:59:59.999Z'))).toBe(true)
    expect(subjectDeadlineUpcoming({ deadlineLocal: '2026-07-01' }, new Date('2026-07-01T22:00:00.000Z'))).toBe(false)
    expect(subjectDeadlineTime({ deadlineLocal: '2026-10-25T02:30' })).toBeNull()
    expect(subjectDeadlineUpcoming({ deadlineLocal: '2026-10-25T02:30' }, new Date('2026-10-01T00:00:00Z'))).toBe(false)
  })

  it('preserves structured kind and original source title through ICS parsing', () => {
    const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//NO', 'BEGIN:VEVENT', 'UID:exam-1', 'DTSTART:20261001T080000Z', 'DTEND:20261001T100000Z', 'SUMMARY:Avsluttende prøve', 'X-STUDIEPLAN-ACTIVITY-KIND:exam', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const result = parseCalendar(calendar, { courseId: 'c1', semester: 'autumn', year: 2026 })
    expect(result.events[0]).toMatchObject({ title: 'Avsluttende prøve', activityKind: 'exam' })
  })
})
