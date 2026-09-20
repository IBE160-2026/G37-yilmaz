import { describe, expect, it } from 'vitest'
import { selectTasksForMinutes, getRemainingMinutes, validateDraft, sortedTasks, editTask } from '../../src/tasks.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { emptyPlanner, mergeImport, osloLocal, teachingOverlap, subtractTeaching, validateEvent } from '../../src/planner.js'
import { parseNtnuPage, isPublicIPv4 } from '../../server/import-api.js'
import { deriveCapacity } from '../../src/capacity.js'
import { eventsOnDay } from '../../src/teaching-calendar.js'

const task = (id, patch = {}) => ({ id, title: `Test ${id}`, course: 'ISOLERT', estimatedMinutes: 30, deadlineLocal: '2026-09-09T12:00', completed: false, ...patch })
const calendar = body => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Isolated tests//EN\r\n${body}\r\nEND:VCALENDAR\r\n`
const event = (extra = '') => `BEGIN:VEVENT\r\nUID:isolated-lesson\r\nDTSTART;TZID=Europe/Oslo:20261019T100000\r\nDTEND;TZID=Europe/Oslo:20261019T110000\r\nSUMMARY:Testforelesning\r\n${extra}\r\nEND:VEVENT`
const selection = { courseId: 'isolated-course', semester: 'autumn', year: 2026 }
const course = { id: 'isolated-course', name: 'Isolert testemne', code: 'TEST101', university: 'Test', semester: 'autumn', year: 2026, notes: '' }
const source = { id: 'isolated-source', name: 'test.ics', kind: 'file', courseId: course.id, groups: ['Testforelesning'], lastUpdated: '2026-09-01T10:00:00Z' }

describe('remaining-work suggestions', () => {
  it('uses a registered next step before whole remaining work, excluding unknown/completed/delivered/zero', () => {
    const tasks = [task('fits', { remainingMinutes: 20, nextStep: { description: 'Step', estimatedMinutes: 45 } }), task('too-large', { remainingMinutes: 60, nextStep: { description: 'Step', estimatedMinutes: 5 } }), task('unknown', { estimatedMinutes: null }), task('done', { completed: true }), task('delivered', { submitted: true }), task('zero', { remainingMinutes: 0 })]
    expect(selectTasksForMinutes(tasks, 30).map(t => t.id)).toEqual(['too-large'])
    expect(selectTasksForMinutes(tasks, 60).map(t => t.id)).toEqual(['fits', 'too-large'])
    expect(getRemainingMinutes(tasks[2])).toBeNull()
  })
  it('orders overdue, upcoming, priority ties, then no deadline stably', () => {
    const tasks = [task('no-date', { deadlineLocal: '' }), task('normal'), task('high', { priority: 3 }), task('tie'), task('overdue', { deadlineLocal: '2026-01-01T12:00' })]
    expect(sortedTasks(tasks).map(t => t.id)).toEqual(['overdue', 'high', 'normal', 'tie', 'no-date'])
  })
  it('accepts unknown estimates and optional deadlines without inventing work', () => {
    const result = validateDraft({ title: 'Oppgave', course: 'TEST', estimatedMinutes: '', deadlineLocal: '' }, 'test')
    expect(result.ok).toBe(true); expect(result.task.estimatedMinutes).toBeNull(); expect(selectTasksForMinutes([result.task], 60)).toEqual([])
  })
  it('allows a task to be detached from a course and its priority reset', () => {
    const saved = task('linked', { courseId: 'old-course', priority: 3 })
    const result = editTask([saved], saved.id, { ...saved, course: 'Nytt emne', courseId: '', priority: '', estimatedMinutes: '30' })
    expect(result.ok).toBe(true); expect(result.tasks[0]).not.toHaveProperty('courseId'); expect(result.tasks[0]).not.toHaveProperty('priority')
    expect(saved.courseId).toBe('old-course')
  })
})
describe('calendar parsing and updates', () => {
  it('expands across winter time, excludes EXDATE, and uses moved exceptions', () => {
    const input = calendar(event('RRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE;TZID=Europe/Oslo:20261102T100000') + '\r\n' + `BEGIN:VEVENT\r\nUID:isolated-lesson\r\nRECURRENCE-ID;TZID=Europe/Oslo:20261026T100000\r\nDTSTART;TZID=Europe/Oslo:20261026T120000\r\nDTEND;TZID=Europe/Oslo:20261026T130000\r\nSUMMARY:Flyttet forelesning\r\nEND:VEVENT`)
    const result = parseCalendar(input, selection)
    expect(result.events.map(e => e.start)).toEqual(['2026-10-19T08:00:00.000Z', '2026-10-26T11:00:00.000Z', '2026-11-09T09:00:00.000Z'])
    expect(result.events.map(e => osloLocal(e.start))).toEqual(['2026-10-19T10:00', '2026-10-26T12:00', '2026-11-09T10:00'])
  })
  it('keeps stable recurrence identities when moved and handles cancelled exceptions', () => {
    const initial = parseCalendar(calendar(event('RRULE:FREQ=WEEKLY;COUNT=2')), selection)
    const updated = parseCalendar(calendar(event('RRULE:FREQ=WEEKLY;COUNT=2') + '\r\nBEGIN:VEVENT\r\nUID:isolated-lesson\r\nRECURRENCE-ID;TZID=Europe/Oslo:20261026T100000\r\nSTATUS:CANCELLED\r\nEND:VEVENT'), selection)
    expect(updated.events).toHaveLength(1)
    const first = mergeImport(emptyPlanner(), initial.events, source, { course })
    const second = mergeImport(first.planner, updated.events, source)
    expect(second.planner.events.filter(e => e.cancelled)).toHaveLength(1)
  })
  it('handles summer time, RDATE, UTC and floating times', () => {
    const spring = parseCalendar(calendar(event('RRULE:FREQ=WEEKLY;COUNT=2').replaceAll('20261019', '20260323')), { ...selection, semester: 'spring' })
    expect(spring.events.map(e => e.start)).toEqual(['2026-03-23T09:00:00.000Z', '2026-03-30T08:00:00.000Z'])
    const extra = parseCalendar(calendar(event('RDATE;TZID=Europe/Oslo:20261026T100000')), selection)
    expect(extra.events).toHaveLength(2)
    const floating = parseCalendar(calendar(event().replaceAll(';TZID=Europe/Oslo', '')), selection)
    expect(floating.events[0].start).toBe('2026-10-19T08:00:00.000Z'); expect(floating.warnings.join(' ')).toContain('uten tidssone')
  })
  it('imports twice without duplicates, merges changes, preserves notes and exposes conflicts', () => {
    const parsed = parseCalendar(calendar(event()), selection)
    const first = mergeImport(emptyPlanner(), parsed.events, source, { course })
    first.planner.events[0].notes = 'Mitt notat'; first.planner.events[0].location = 'Mitt rom'
    const second = mergeImport(first.planner, parsed.events, source)
    expect(second.planner.events).toHaveLength(1); expect(second.planner.events[0].notes).toBe('Mitt notat')
    const third = mergeImport(second.planner, [{ ...parsed.events[0], location: 'Nytt kilderom' }], source)
    expect(third.counts.conflicts).toBe(1); expect(third.planner.events[0].location).toBe('Mitt rom')
    const cancelled = mergeImport(third.planner, [], source)
    expect(cancelled.planner.events[0].cancelled).toBe(true); expect(cancelled.planner.events[0].notes).toBe('Mitt notat')
  })
  it('deduplicates TP calendars despite regenerated UIDs', () => {
    const first = parseCalendar(calendar(event()).replace('-//Isolated tests//EN', '-//UiO//TP'), selection)
    const second = parseCalendar(calendar(event().replace('UID:isolated-lesson', 'UID:brand-new-id')).replace('-//Isolated tests//EN', '-//UiO//TP'), selection)
    expect(first.identityMode).toBe('content'); expect(first.events[0].sourceKey).toBe(second.events[0].sourceKey)
  })
  it('applies a partial cancellation without cancelling unrelated lessons and restores a reappearing lesson', () => {
    const parsed = parseCalendar(calendar(event() + '\r\n' + event().replace('UID:isolated-lesson', 'UID:other')), selection)
    const first = mergeImport(emptyPlanner(), parsed.events, source, { course })
    const cancel = parseCalendar(calendar('METHOD:CANCEL\r\nBEGIN:VEVENT\r\nUID:isolated-lesson\r\nEND:VEVENT'), selection)
    const next = mergeImport(first.planner, cancel.events, source, cancel)
    expect(next.planner.events.filter(e => e.cancelled)).toHaveLength(1)
    const restored = mergeImport(next.planner, parsed.events, source)
    expect(restored.planner.events.filter(e => e.cancelled)).toHaveLength(0)
    expect(restored.planner.events).toHaveLength(2)
  })
  it('uses embedded VTIMEZONE definitions and does not turn VTODO into teaching', () => {
    const zone = 'BEGIN:VTIMEZONE\r\nTZID:Custom/Test\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0300\r\nTZOFFSETTO:+0300\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n'
    const parsed = parseCalendar(calendar(zone + event().replaceAll('Europe/Oslo', 'Custom/Test') + '\r\nBEGIN:VTODO\r\nUID:todo\r\nSUMMARY:Explicit task\r\nDUE:20261020T100000Z\r\nEND:VTODO'), selection)
    expect(parsed.events).toHaveLength(1); expect(parsed.events[0].start).toBe('2026-10-19T07:00:00.000Z')
    expect(parsed.warnings.join(' ')).toContain('gjøremål')
  })
  it('rejects invalid and unknown-zone data and bounds infinite recurrences', () => {
    expect(() => parseCalendar('<html>Login</html>', selection)).toThrow('fullstendig')
    expect(() => parseCalendar(calendar(event().replaceAll('Europe/Oslo', 'Unknown/Nowhere')), selection)).toThrow('Ukjent tidssone')
    expect(() => parseCalendar(calendar(event('RRULE:FREQ=SECONDLY')), selection)).toThrow(/omfattende|5000/)
  })
  it('retains short bounded second-level recurrences and sparse intervals', () => {
    expect(parseCalendar(calendar(event('RRULE:FREQ=SECONDLY;COUNT=3')), selection).events).toHaveLength(3)
    expect(parseCalendar(calendar(event('RRULE:FREQ=SECONDLY;INTERVAL=604800;COUNT=2')), selection).events).toHaveLength(2)
  })
})
describe('teaching and official provider', () => {
  it('subtracts union of teaching intervals and warns about overlap', () => {
    const events = [{ start: '2026-09-07T10:15:00Z', end: '2026-09-07T10:45:00Z' }, { start: '2026-09-07T10:30:00Z', end: '2026-09-07T10:50:00Z' }]
    const free = subtractTeaching([{ start: Date.parse('2026-09-07T10:00:00Z'), end: Date.parse('2026-09-07T11:00:00Z') }], events)
    expect(free.reduce((n, i) => n + (i.end - i.start) / 60000, 0)).toBe(25)
    expect(teachingOverlap(events, new Date('2026-09-07T10:00:00Z'), 30).availableMinutes).toBe(15)
    const capacity = deriveCapacity([task('work', { estimatedMinutes: 60, deadlineLocal: '2026-09-07T14:00' })], [{ id: 'study', dateLocal: '2026-09-07', startTime: '12:00', endTime: '13:00' }], new Date('2026-09-07T10:00:00Z'), events)
    expect(capacity.totalCapacityMinutes).toBe(25)
    expect(capacity.totalAllocatedMinutes).toBe(25)
    expect(capacity.warnings.join(' ')).toContain('35 min undervisning')
    expect(eventsOnDay([{ ...events[0], title: 'Test' }], '2026-09-07')).toHaveLength(1)
    expect(eventsOnDay([{ ...events[0], title: 'Test' }], '2026-09-08')).toHaveLength(0)
  })
  it('validates manual teaching in Oslo independently of the computer timezone', () => {
    const value = validateEvent({ title: 'Test', courseId: course.id, startLocal: '2026-10-26T10:00', endLocal: '2026-10-26T11:00' })
    expect(value.start).toBe('2026-10-26T09:00:00Z')
    expect(() => validateEvent({ title: 'Test', courseId: course.id, startLocal: '2026-10-25T02:30', endLocal: '2026-10-25T04:00' })).toThrow('tvetydig')
  })
  it('extracts only official page fields and verifies the academic year', () => {
    const html = '<div id="course-details" data-coursecode="TEST101"><h1 class="course-name">Testemne</h1><select id="selectedYear"><option selected value="2026">2026/2027</option></select><div class="course-fact"><span class="course-fact-label">Studiepoeng</span><span class="course-fact-value">7,5</span></div><p class="content-course-content">Testbeskrivelse</p><a class="ical" href="https://tp.educloud.no/ntnu/timeplan/ical.php?sem=26h&amp;id[0]=TEST101&amp;type=course">Kalender</a></div>'
    const result = parseNtnuPage(html, { code: 'TEST101', semester: 'spring', year: 2027, sourceUrl: 'https://www.ntnu.no/studier/emner/TEST101/2026' })
    expect(result.course.credits).toBe(7.5); expect(result.calendarUrl).toContain('sem=27v')
    expect(() => parseNtnuPage(html, { code: 'TEST101', semester: 'autumn', year: 2025 })).toThrow('studieår')
    expect(isPublicIPv4('127.0.0.1')).toBe(false); expect(isPublicIPv4('169.254.169.254')).toBe(false); expect(isPublicIPv4('10.0.0.1')).toBe(false); expect(isPublicIPv4('129.241.160.102')).toBe(true)
  })
})
