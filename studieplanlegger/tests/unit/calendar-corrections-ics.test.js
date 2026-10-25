import { describe, expect, it } from 'vitest'
import ICAL from 'ical.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { calendarUid, generateCalendarIcs } from '../../src/calendar-export.js'
import { eventBlocksTime } from '../../src/planner.js'
import { createDocumentImportPreview, buildDocumentImportCommit } from '../../src/import-preview.js'

// Independently invented fixtures. RFC 5545 sections 3.3.4–3.3.5 and 3.8.2.7.
const calendar = (...entries) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...entries, 'END:VCALENDAR', ''].join('\r\n')
const event = (uid, fields = 'DTSTART:20430430T071503Z') => ['BEGIN:VEVENT', `UID:synthetic-${uid}`, `SUMMARY:Syntetisk ${uid}`, fields, 'END:VEVENT'].join('\r\n')
const parse = (...entries) => parseCalendar(calendar(...entries), { fileImport: true })

describe('raw ICS date rejection before ICAL hydration', () => {
  it.each([
    'DTSTART:20430431T071503Z', 'DTSTART;VALUE=DATE:20430431',
    'DTSTART:20430229T071503Z', 'DTSTART:20431301T071503Z',
    'DTSTART:20430001T071503Z', 'DTSTART:20430100T071503Z',
    'DTSTART:20430430T241503Z', 'DTSTART:20430430T076003Z',
    'DTSTART:20430430T071561Z',
    'DTSTART:20430430T071503.5Z', 'DTSTART;VALUE=DATE:204304300',
    'DTSTART:20430430T071503+0200', 'DTSTART:20430430X071503Z',
    'DTSTART:20430430T071503Z,20430501T071503Z',
    'DTSTART:20430430T071503Z\r\nDTEND:20430431T081503Z',
    'DTSTART:20430430T071503Z\r\nRDATE:20430501T071503Z,20430431T071503Z',
    'DTSTART:20430430T071503Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEXDATE:20430431T071503Z',
    'DTSTART:20430430T071503Z\r\nRRULE:FREQ=DAILY;UNTIL=20430431T071503Z',
    'DTSTART;VALUE=DATE:20430430\r\nRRULE:FREQ=DAILY;UNTIL=20430431',
    'DTSTART:20430430T071503Z\r\nRDATE;VALUE=PERIOD:20430431T071503Z/PT1H',
    'DTSTART:20430430T071503Z\r\nRDATE;VALUE=PERIOD:20430430T071503Z/20430431T081503Z',
    'DTSTART:20430430T071503Z\r\nRDATE;VALUE=PERIOD:20430501T071503Z/PTbroken',
  ])('quarantines only the component with %s, even outside a chosen period', fields => {
    const source = calendar(event('bad', fields), event('valid'))
    const parsed = parseCalendar(source, { fileImport: true })
    expect(parsed.events.map(item => item.sourceUid)).toEqual(['synthetic-valid'])
    expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1, cancelled: 0 })
    expect(parsed.authoritative).toBe(false)
    expect(parsed.warnings.join(' ')).toMatch(/VEVENT 1.*ugyldig/i)
    const filtered = parseCalendar(source, { fileImport: true, semester: 'spring', year: 2042 })
    expect(filtered.accounting).toMatchObject({ total: 2, filtered: 1, rejected: 1 })
  })

  it.each([
    'DTSTART;VALUE=DATE:20430430\r\nDTEND:20430501T081503Z',
    'DTSTART:20430430T071503Z\r\nDTEND;VALUE=DATE:20430501',
  ])('rejects mismatched DTSTART/DTEND value types without losing valid siblings: %s', fields => {
    const source = calendar(event('mismatched-types', fields), event('valid'))
    const parsed = parseCalendar(source, { fileImport: true })
    expect(parsed.events.map(item => item.sourceUid)).toEqual(['synthetic-valid'])
    expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1, rejectedOccurrences: 0 })
    expect(parsed.authoritative).toBe(false)
    expect(parsed.warnings.join(' ')).toMatch(/VEVENT 1.*DTSTART.*DTEND.*utelatt/i)
    const document = parseDocumentIcs(source)
    expect(document.rows.map(row => row.title)).toEqual(['Syntetisk valid'])
    expect(document.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1 })
    expect(document.complete).toBe(false)
  })

  it('never normalizes an invalid cancellation recurrence ID into another occurrence', () => {
    const cancelled = 'BEGIN:VEVENT\r\nUID:synthetic-series\r\nSTATUS:CANCELLED\r\nRECURRENCE-ID:20430431T071503Z\r\nEND:VEVENT'
    const parsed = parse(event('series', 'DTSTART:20430430T071503Z\r\nRRULE:FREQ=DAILY;COUNT=3'), cancelled)
    expect(parsed.events.map(item => item.start)).toEqual(['2043-04-30T07:15:03.000Z', '2043-05-01T07:15:03.000Z', '2043-05-02T07:15:03.000Z'])
    expect(parsed.cancellations).toEqual([])
    expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1, cancelled: 0 })
    expect(parsed.authoritative).toBe(false)
  })

  it('still suppresses a rejected moved exception when its recurrence identity is valid', () => {
    const parsed = parse(event('series', 'DTSTART:20430430T071503Z\r\nRRULE:FREQ=DAILY;COUNT=3'), event('series', 'RECURRENCE-ID:20430501T071503Z\r\nDTSTART:20430431T081503Z'))
    expect(parsed.events.map(item => item.start)).toEqual(['2043-04-30T07:15:03.000Z', '2043-05-02T07:15:03.000Z'])
    expect(parsed.accounting).toMatchObject({ retained: 1, rejected: 1 })
  })

  it.each(['DUE:20430431T071503Z', 'DUE;VALUE=DATE:20430229', 'DTSTART:20430431T071503Z\r\nDUE:20430502T071503Z', 'DUE:20430502T071503Z\r\nRRULE:FREQ=DAILY;UNTIL=20430431T071503Z'])('rejects VTODO %s without normalizing its deadline or losing valid siblings', fields => {
    const parsed = parseDocumentIcs(calendar(`BEGIN:VTODO\r\nUID:synthetic-task\r\nSUMMARY:Syntetisk oppgave\r\n${fields}\r\nEND:VTODO`, event('valid')))
    expect(parsed.rows.map(row => row.kind)).toEqual(['event'])
    expect(parsed.complete).toBe(false)
    expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1 })
    expect(parsed.warnings.join(' ')).toMatch(/VTODO 1.*ugyldig/i)
  })

  it('preserves previously saved events when a later partial calendar omits their source rows', () => {
    const empty = { schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } }
    const first = createDocumentImportPreview(empty, { ...parseDocumentIcs(calendar(event('retained'), event('missing-later'))), contentHash: 'a'.repeat(64) })
    const saved = buildDocumentImportCommit(empty, first)
    expect(saved.ok).toBe(true)
    const next = createDocumentImportPreview(saved.state, { ...parseDocumentIcs(calendar(event('retained'), event('bad', 'DTSTART:20430431T071503Z'))), contentHash: 'b'.repeat(64) }, { sourceId: saved.source.id })
    const update = buildDocumentImportCommit(saved.state, next)
    expect(update.ok).toBe(true)
    expect(update.state.planner.events).toEqual(saved.state.planner.events)
  })
})

describe('valid RFC calendar times remain supported', () => {
  it.each([
    ['DTSTART:20440229T071503Z\r\nDTEND:20440229T071507Z', '2044-02-29T07:15:03.000Z', '2044-02-29T07:15:07.000Z', false],
    ['DTSTART:20430501T091503\r\nDTEND:20430501T091507', '2043-05-01T07:15:03.000Z', '2043-05-01T07:15:07.000Z', false],
    ['DTSTART;TZID=Europe/Oslo:20430501T091503\r\nDTEND;TZID=Europe/Oslo:20430501T091507', '2043-05-01T07:15:03.000Z', '2043-05-01T07:15:07.000Z', false],
    ['DTSTART;VALUE=DATE:20430502', '2043-05-01T22:00:00.000Z', '2043-05-02T22:00:00.000Z', false, true],
    ['DTSTART;VALUE=DATE:20430502\r\nDTEND;VALUE=DATE:20430504', '2043-05-01T22:00:00.000Z', '2043-05-03T22:00:00.000Z', false, true],
    ['DTSTART;VALUE=DATE:20430502\r\nDURATION:P2D', '2043-05-01T22:00:00.000Z', '2043-05-03T22:00:00.000Z', false, true],
    ['DTSTART:20430503T071503Z', '2043-05-03T07:15:03.000Z', '2043-05-03T07:15:03.000Z', true],
    ['DTSTART:20430503T071503Z\r\nDURATION:PT37M', '2043-05-03T07:15:03.000Z', '2043-05-03T07:52:03.000Z', false],
    ['DTSTART;TZID=Europe/Oslo:20270328T023000', '2027-03-28T01:30:00.000Z', '2027-03-28T01:30:00.000Z', true],
    ['DTSTART;TZID=Europe/Oslo:20271031T023000', '2027-10-31T00:30:00.000Z', '2027-10-31T00:30:00.000Z', true],
    ['DTSTART:20150630T235960Z', '2015-06-30T23:59:59.000Z', '2015-06-30T23:59:59.000Z', true],
  ])('retains exact instants for %s', (fields, start, end, point, allDay = false) => {
    const parsed = parse(event('valid', fields))
    expect(parsed.authoritative).toBe(true)
    expect(parsed.events).toHaveLength(1)
    expect(parsed.events[0]).toMatchObject({ start, end, allDay })
    expect(Boolean(parsed.events[0].point)).toBe(point)
  })

  it('retains both supported recurrence PERIOD variants with seconds', () => {
    const parsed = parse(event('periods', 'DTSTART:20430503T071503Z\r\nRDATE;VALUE=PERIOD:20430504T071503Z/PT37M,20430505T071503Z/20430505T081507Z'))
    expect(parsed.events.map(item => [item.start, item.end])).toEqual([
      ['2043-05-03T07:15:03.000Z', '2043-05-03T07:15:03.000Z'], ['2043-05-04T07:15:03.000Z', '2043-05-04T07:52:03.000Z'], ['2043-05-05T07:15:03.000Z', '2043-05-05T08:15:07.000Z'],
    ])
  })

  it('uses RFC leap-second fallback in recurrence limits, dates and exclusions', () => {
    const parsed = parse(event('leaps', 'DTSTART:20150629T235960Z\r\nRRULE:FREQ=DAILY;UNTIL=20150630T235960Z\r\nEXDATE:20150629T235960Z\r\nRDATE:20150630T235960Z'))
    expect(parsed.events.map(item => item.start)).toEqual(['2015-06-30T23:59:59.000Z'])
    expect(parsed.authoritative).toBe(true)
  })

  it('keeps floating recurrence periods in the same fallback timezone as DTSTART', () => {
    const parsed = parse(event('floating-period', 'DTSTART:20430503T091503\r\nRDATE;VALUE=PERIOD:20430504T091503/PT37M'))
    expect(parsed.events.map(item => [item.start, item.end])).toEqual([
      ['2043-05-03T07:15:03.000Z', '2043-05-03T07:15:03.000Z'], ['2043-05-04T07:15:03.000Z', '2043-05-04T07:52:03.000Z'],
    ])
  })

  it('preserves custom VTIMEZONE, quoted TZID parameters and folded dates', () => {
    const zone = 'BEGIN:VTIMEZONE\r\nTZID:Synthetic/Clock:1\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0130\r\nTZOFFSETTO:+0130\r\nEND:STANDARD\r\nEND:VTIMEZONE'
    const parsed = parse(zone, event('custom-zone', 'DTSTART;TZID="Synthetic/Clock:1":20430501T0915\r\n 03\r\nDTEND;TZID="Synthetic/Clock:1":20430501T091507'))
    expect(parsed.events[0]).toMatchObject({ start: '2043-05-01T07:45:03.000Z', end: '2043-05-01T07:45:07.000Z' })
    expect(parsed.authoritative).toBe(true)
  })

  it('applies RFC gap interpretation to a minute-precision VTODO deadline', () => {
    const parsed = parseDocumentIcs(calendar('BEGIN:VTODO\r\nUID:synthetic-gap\r\nSUMMARY:Syntetisk frist\r\nDUE;TZID=Europe/Oslo:20270328T023000\r\nEND:VTODO'))
    expect(parsed.rows[0]).toMatchObject({ deadlineLocal: '2027-03-28T03:30', deadlineIssues: [] })
  })

  it('retains valid DATE, UTC and unresolved floating VTODO deadline forms', () => {
    const todo = (id, due) => `BEGIN:VTODO\r\nUID:synthetic-${id}\r\nSUMMARY:Syntetisk ${id}\r\n${due}\r\nEND:VTODO`
    const parsed = parseDocumentIcs(calendar(todo('day', 'DUE;VALUE=DATE:20440229'), todo('utc', 'DUE:20430501T071500Z'), todo('floating', 'DUE:20430501T091503')))
    // Existing task deadlines require minute precision and a chosen clock;
    // DATE and floating values retain their evidence and clarification.
    expect(parsed.rows.map(row => [row.deadlineLocal, row.deadlineIssues.length])).toEqual([['', 1], ['2043-05-01T09:15', 0], ['', 1]])
    expect(parsed.rows.map(row => row.deadlineRaw)).toEqual(['2044-02-29', '2043-05-01T07:15:00Z', '2043-05-01T09:15:03'])
    expect(parsed.accounting).toMatchObject({ total: 3, retained: 3, rejected: 0 })
  })
})

describe('export transparency follows current capacity without mutating source provenance', () => {
  it('exports blocking intervals as OPAQUE and all retained nonblocking items as TRANSPARENT', () => {
    const base = { title: 'Syntetisk aktivitet', dateLocal: '2043-05-06', start: '2043-05-06T07:15:03.000Z', end: '2043-05-06T08:15:03.000Z' }
    const events = [
      { ...base, id: 'personal-transparent', activityKind: 'personal', transparent: true },
      { ...base, id: 'personal-information', activityKind: 'personal', information: true },
      { ...base, id: 'personal-opaque', activityKind: 'personal' },
      { ...base, id: 'personal-point', activityKind: 'personal', point: true, end: base.start, transparent: false },
      { ...base, id: 'teaching-point', point: true, end: base.start, transparent: false },
      { ...base, id: 'teaching-opaque' },
      { ...base, id: 'teaching-transparent-excluded', transparent: true },
    ]
    const state = { tasks: [], planner: { courses: [], events } }, before = structuredClone(state)
    const source = generateCalendarIcs(state, { includeTeaching: true, includePersonal: true })
    const output = new ICAL.Component(ICAL.parse(source)).getAllSubcomponents('vevent')
    expect(output).toHaveLength(6)
    for (const item of events.filter(item => item.id !== 'teaching-transparent-excluded')) {
      const component = output.find(value => value.getFirstPropertyValue('uid') === calendarUid(item.activityKind === 'personal' ? 'personal' : 'teaching', item.id))
      expect(component.getFirstPropertyValue('transp')).toBe(eventBlocksTime(item) ? 'OPAQUE' : 'TRANSPARENT')
      expect(component.hasProperty('dtend')).toBe(!item.point)
    }
    expect(parseDocumentIcs(source).rows.filter(row => row.point)).toHaveLength(2)
    expect(state).toEqual(before)
  })
})
