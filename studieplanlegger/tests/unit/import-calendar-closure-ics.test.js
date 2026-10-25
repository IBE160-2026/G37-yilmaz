import { describe, expect, it } from 'vitest'
import { parseCalendar } from '../../src/calendar-import.js'
import { emptyPlanner, eventBlocksTime, mergeImport } from '../../src/planner.js'
import { normalizeTpCalendar, normalizeTpJsonEvents } from '../../server/providers/public-tp.js'

// Independently invented dates/UIDs. No private source or anonymized copy.
const calendar = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR', ''].join('\r\n')
const event = (uid, ...fields) => ['BEGIN:VEVENT', `UID:synthetic-closure-${uid}`, `SUMMARY:Oppdiktet ${uid}`, ...fields, 'END:VEVENT'].join('\r\n')
const parse = (...events) => parseCalendar(calendar(...events), { fileImport: true })
const utc = 'DTSTART:20440208T090000Z\r\nDTEND:20440208T100000Z'
const local = 'DTSTART;TZID=Europe/Oslo:20440208T100000\r\nDTEND;TZID=Europe/Oslo:20440208T110000'
const utcOccurrence = 'RECURRENCE-ID:20440209T090000Z'
const localOccurrence = 'RECURRENCE-ID;TZID=Europe/Oslo:20440209T100000'
const source = { id: 'synthetic-series-source', courseId: 'synthetic-course', kind: 'file', name: 'Oppdiktet kilde', groups: [] }
const saved = fields => mergeImport(emptyPlanner(), parse(event('series', fields, 'RRULE:FREQ=DAILY;COUNT=2')).events, source).planner

describe('canonical occurrence matching without identity replacement', () => {
  it.each([[utc, localOccurrence], [local, utcOccurrence]])('suppresses same-file cancellation across UTC/TZID: %s', (start, recurrence) => {
    const parsed = parse(event('series', start, 'RRULE:FREQ=DAILY;COUNT=2'), event('series', recurrence, 'STATUS:CANCELLED'))
    expect(parsed.events.map(row => row.start)).toEqual(['2044-02-08T09:00:00.000Z'])
    expect(parsed.cancellations[0].occurrenceInstant).toBe('2044-02-09T09:00:00.000Z')
  })

  it.each([[utc, localOccurrence], [local, utcOccurrence]])('cancels only the saved equivalent occurrence and retains its ID and edits: %s', (start, recurrence) => {
    const planner = saved(start), originalIds = planner.events.map(row => row.id)
    planner.events[1].notes = 'Oppdiktet lokalt notat'
    planner.events[1].start = '2044-02-09T09:15:00.000Z'
    const cancelled = parseCalendar(calendar('METHOD:CANCEL', event('series', recurrence)), { fileImport: true })
    const result = mergeImport(planner, [], source, { authoritative: false, cancellations: cancelled.cancellations })
    expect(result.counts.cancelled).toBe(1)
    expect(result.planner.events.map(row => row.id)).toEqual(originalIds)
    expect(result.planner.events[0].cancelled).toBe(false)
    expect(result.planner.events[1]).toMatchObject({ notes: 'Oppdiktet lokalt notat', start: '2044-02-09T09:15:00.000Z', cancelled: true })
    expect(result.planner.events.filter(eventBlocksTime)).toHaveLength(1)
    expect(mergeImport(result.planner, [], source, { authoritative: false, cancellations: cancelled.cancellations }).planner).toEqual(result.planner)
  })

  it('matches legacy UTC identity without relying on a locally edited time', () => {
    const planner = saved(utc)
    for (const row of planner.events) delete row.occurrenceInstant
    planner.events[1].start = '2044-02-09T09:15:00.000Z'
    const cancelled = parse(event('series', localOccurrence, 'STATUS:CANCELLED'))
    const result = mergeImport(planner, [], source, { authoritative: false, cancellations: cancelled.cancellations })
    expect(result.counts.cancelled).toBe(1)
    expect(result.planner.events[1].id).toBe(planner.events[1].id)
    expect(result.planner.events[1].start).toBe(planner.events[1].start)
  })

  it('uses the original source start for a legacy local occurrence, and preserves an unprovable moved exception', () => {
    const planner = saved(local)
    for (const row of planner.events) delete row.occurrenceInstant
    planner.events[1].start = '2044-02-09T09:15:00.000Z'
    const cancelled = parse(event('series', utcOccurrence, 'STATUS:CANCELLED'))
    expect(mergeImport(planner, [], source, { authoritative: false, cancellations: cancelled.cancellations }).counts.cancelled).toBe(1)
    planner.events[1].sourceBase.start = '2044-02-10T13:00:00.000Z'
    const uncertain = mergeImport(planner, [], source, { authoritative: false, cancellations: cancelled.cancellations })
    expect(uncertain.counts.cancelled).toBe(0)
    expect(uncertain.planner.events).toEqual(planner.events)
    expect(uncertain.planner.sources[0].syncWarnings.join(' ')).toMatch(/kan ikke knyttes entydig/)
  })

  it('keeps the original occurrence identity after a moved exception and then cancels it', () => {
    const initial = parse(event('series', utc, 'RRULE:FREQ=DAILY;COUNT=2'), event('series', localOccurrence, 'DTSTART:20440210T130000Z', 'DTEND:20440210T140000Z'))
    expect(initial.events.map(row => row.start)).toEqual(['2044-02-08T09:00:00.000Z', '2044-02-10T13:00:00.000Z'])
    const planner = mergeImport(emptyPlanner(), initial.events, source).planner
    const cancelled = parse(event('series', utcOccurrence, 'STATUS:CANCELLED'))
    const result = mergeImport(planner, [], source, { authoritative: false, cancellations: cancelled.cancellations })
    expect(result.counts.cancelled).toBe(1)
    expect(result.planner.events[1]).toMatchObject({ id: planner.events[1].id, start: '2044-02-10T13:00:00.000Z', cancelled: true })
  })

  it('preserves saved keys and IDs when a full series changes timezone representation', () => {
    const planner = saved(local), before = structuredClone(planner)
    const updated = parse(event('series', utc, 'RRULE:FREQ=DAILY;COUNT=2'))
    const result = mergeImport(planner, updated.events, source)
    expect(result.planner.events).toHaveLength(2)
    expect(result.planner.events.map(row => [row.id, row.sourceKey])).toEqual(before.events.map(row => [row.id, row.sourceKey]))
    expect(result.planner.events.every(row => !row.cancelled)).toBe(true)
  })

  it('does not confuse the two instants in an autumn fold', () => {
    const initial = parse(event('fold', 'DTSTART:20441030T003000Z', 'DURATION:PT5M', 'RDATE:20441030T013000Z'))
    const planner = mergeImport(emptyPlanner(), initial.events, source).planner
    const cancelled = parse(event('fold', 'RECURRENCE-ID;TZID=Europe/Oslo:20441030T023000', 'STATUS:CANCELLED'))
    const result = mergeImport(planner, [], source, { authoritative: false, cancellations: cancelled.cancellations })
    expect(result.planner.events.map(row => [row.start, row.cancelled])).toEqual([['2044-10-30T00:30:00.000Z', true], ['2044-10-30T01:30:00.000Z', false]])
  })

  it('retains DATE occurrence identity and only cancels the selected all-day instance', () => {
    const parsed = parse(event('days', 'DTSTART;VALUE=DATE:20440601', 'RRULE:FREQ=DAILY;COUNT=3'))
    const planner = mergeImport(emptyPlanner(), parsed.events, source).planner
    const cancelled = parse(event('days', 'RECURRENCE-ID;VALUE=DATE:20440602', 'STATUS:CANCELLED'))
    const result = mergeImport(planner, [], source, { authoritative: false, cancellations: cancelled.cancellations })
    expect(result.planner.events.map(row => [row.occurrenceInstant, row.cancelled])).toEqual([['2044-06-01', false], ['2044-06-02', true], ['2044-06-03', false]])
    expect(result.planner.events.map(row => row.id)).toEqual(planner.events.map(row => row.id))
  })

  it('does not merge equivalent cancellation with an unrelated source or UID', () => {
    const planner = saved(utc), otherSource = mergeImport(planner, parse(event('series', utc, 'RRULE:FREQ=DAILY;COUNT=2')).events, { ...source, id: 'synthetic-other-source' }).planner
    const cancelled = parse(event('series', localOccurrence, 'STATUS:CANCELLED'))
    const result = mergeImport(otherSource, [], source, { authoritative: false, cancellations: cancelled.cancellations })
    expect(result.planner.events.filter(row => row.cancelled)).toHaveLength(1)
    expect(result.planner.events.filter(row => row.sourceId === 'synthetic-other-source').every(row => !row.cancelled)).toBe(true)
    const unknown = parse(event('other', localOccurrence, 'STATUS:CANCELLED'))
    expect(mergeImport(planner, [], source, { authoritative: false, cancellations: unknown.cancellations }).planner.events).toEqual(planner.events)
  })

  it('does not duplicate detached equivalents or silently choose between conflicting payloads', () => {
    const first = event('detached', utcOccurrence, 'DTSTART:20440209T130000Z', 'DTEND:20440209T140000Z')
    const equivalent = event('detached', localOccurrence, 'DTSTART:20440209T130000Z', 'DTEND:20440209T140000Z')
    expect(parse(first, equivalent).events).toHaveLength(1)
    const conflicting = event('detached', localOccurrence, 'DTSTART:20440209T150000Z', 'DTEND:20440209T160000Z')
    expect(() => parse(first, conflicting)).toThrow(/samme identitet/)
  })
})

describe('bounded recurrence and complete automatic periods', () => {
  const endless = (...extra) => event('monthly', 'DTSTART:20440101T090000Z', 'DURATION:PT1H', 'RRULE:FREQ=MONTHLY', ...extra)
  it('retains explicit later dates while bounding an endless rule', () => {
    const parsed = parse(endless('RDATE:20440201T090000Z,20441010T090000Z'))
    expect(parsed.events).toHaveLength(7)
    expect(parsed.events.at(-1)).toMatchObject({ start: '2044-10-10T09:00:00.000Z', end: '2044-10-10T10:00:00.000Z' })
    expect(parsed.warnings.join(' ')).toMatch(/seks måneder/)
    expect(parsed.warnings.join(' ')).toMatch(/ekstra datoer|RDATE/i)
    expect(parsed.authoritative).toBe(false)
    expect(new Set(parsed.events.map(row => row.sourceKey)).size).toBe(7)
  })
  it('honors EXDATE and cancelled late exceptions while retaining other explicit periods', () => {
    const parsed = parse(endless('RDATE:20440910T090000Z,20441010T090000Z', 'RDATE;VALUE=PERIOD:20441110T090000Z/PT2H', 'EXDATE:20440910T090000Z'), event('monthly', 'RECURRENCE-ID;TZID=Europe/Oslo:20441010T110000', 'STATUS:CANCELLED'))
    expect(parsed.events).toHaveLength(7)
    expect(parsed.events.at(-1)).toMatchObject({ start: '2044-11-10T09:00:00.000Z', end: '2044-11-10T11:00:00.000Z' })
    expect(parsed.events.some(row => row.start.startsWith('2044-09') || row.start.startsWith('2044-10'))).toBe(false)
  })
  it('preserves moved late RDATE exceptions once, with the exception duration', () => {
    const parsed = parse(endless('RDATE;VALUE=PERIOD:20441010T090000Z/PT2H'), event('monthly', 'RECURRENCE-ID:20441010T090000Z', 'DTSTART:20441011T130000Z', 'DURATION:PT3H'))
    expect(parsed.events).toHaveLength(7)
    expect(parsed.events.at(-1)).toMatchObject({ start: '2044-10-11T13:00:00.000Z', end: '2044-10-11T16:00:00.000Z' })
  })
  it('honors equivalent TZID exclusions on a later UTC RDATE', () => {
    const parsed = parse(endless('RDATE:20441010T090000Z,20441110T090000Z', 'EXDATE;TZID=Europe/Oslo:20441010T110000'))
    expect(parsed.events).toHaveLength(7)
    expect(parsed.events.at(-1).start).toBe('2044-11-10T09:00:00.000Z')
  })
  it('keeps a requested semester filter and the existing excessive-expansion rejection', () => {
    const text = calendar(endless('RDATE:20441010T090000Z'))
    const filtered = parseCalendar(text, { fileImport: true, semester: 'spring', year: 2044 })
    expect(filtered.events).toHaveLength(6)
    expect(() => parse(event('large', 'DTSTART:20440101T090000Z', 'DURATION:PT1S', 'RRULE:FREQ=SECONDLY'))).toThrow(/omfattende/)
  })
  it.each(['DTSTART:20440601T090000Z\r\nDURATION:P12D', 'DTSTART;VALUE=DATE:20440601\r\nDURATION:P12D'])('includes the actual standalone DURATION end: %s', fields => {
    const parsed = parse(event('duration', fields))
    expect(Date.parse(parsed.period.end)).toBeGreaterThanOrEqual(Date.parse(parsed.events[0].end))
    expect(parsed.events[0].allDay).toBe(fields.includes('VALUE=DATE'))
  })
})

describe('source-owned published TP term', () => {
  const semester = { id: '44h', year: 2044, season: 'AUTUMN', pubexdate: true, pubextime: true, pubexroom: true }
  const selected = { id: 'SYN974¤1', code: 'SYN974', name: 'Oppdiktet vinteraktivitet', term: 1 }
  it('transports autumn through normalized ICS despite a January activity', () => {
    const normalized = normalizeTpCalendar(calendar(event('january', 'DTSTART:20450112T090000Z', 'DTEND:20450112T100000Z')), { institution: 'himolde', semester, selectedIds: [selected.id], selectedCourse: selected })
    expect(parseCalendar(normalized.calendar, { fileImport: true }).events[0].fileCourse).toMatchObject({ code: selected.code, year: 2044, semester: 'autumn' })
  })
  it('transports autumn through normalized TP JSON despite a January activity', () => {
    const normalized = normalizeTpJsonEvents({ events: [{ id: 'synthetic-published-january', eventid: 'synthetic-published-january', courseid: selected.code, terminnr: 1, semesterid: '44h', status: 'active', summary: 'Oppdiktet januarøkt', dtstart: '2045-01-12T10:00:00+01:00', dtend: '2045-01-12T11:00:00+01:00', alerts: [], staffnames: [], studentgroups: ['Felles'] }] }, { institution: 'himolde', semester, selected })
    expect(parseCalendar(normalized.calendar, { fileImport: true }).events[0].fileCourse).toMatchObject({ code: selected.code, year: 2044, semester: 'autumn' })
  })
})
