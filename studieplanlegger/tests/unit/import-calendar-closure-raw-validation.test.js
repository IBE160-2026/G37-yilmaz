import { describe, expect, it } from 'vitest'
import { parseCalendar } from '../../src/calendar-import.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'

// Independently invented source values; no personal calendar or copied export.
const calendar = (...components) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...components, 'END:VCALENDAR', ''].join('\r\n')
const event = (id, fields) => `BEGIN:VEVENT\r\nUID:synthetic-raw-${id}\r\nSUMMARY:Oppdiktet ${id}\r\n${fields}\r\nEND:VEVENT`
const start = 'DTSTART:20450418T090007Z'
const good = event('valid', `${start}\r\nDTEND:20450418T100017Z`)
const parse = (...components) => parseCalendar(calendar(...components), { fileImport: true })

describe('raw calendar value types, durations and singleton fields', () => {
  it.each([
    ['DTSTART', 'DTSTART;VALUE=DATE:20450418T090007Z'],
    ['DTSTART', 'DTSTART;VALUE=DATE-TIME:20450418'],
    ['DTSTART', 'DTSTART:20450418'],
    ['DTEND', `${start}\r\nDTEND;VALUE=DATE:20450419T100017Z`],
    ['RDATE', `${start}\r\nRDATE;VALUE=DATE:20450419T090007Z`],
    ['EXDATE', `${start}\r\nRRULE:FREQ=DAILY;COUNT=2\r\nEXDATE;VALUE=DATE:20450419T090007Z`],
    ['RECURRENCE-ID', `${start}\r\nRECURRENCE-ID;VALUE=DATE:20450418T090007Z`],
    ['DURATION', `${start}\r\nDURATION:PT1.5H`],
    ['DURATION', `${start}\r\nDURATION:PT1Hgarbage`],
    ['DURATION', `${start}\r\nDURATION:PT1H30`],
    ['DTSTART', `${start}\r\nDTSTART:20450419T090007Z`],
    ['DTSTART', `${start}\r\n${start}`],
    ['DTEND', `${start}\r\nDTEND:20450418T100017Z\r\nDTEND:20450418T110017Z`],
    ['DURATION', `${start}\r\nDURATION:PT1H\r\nDURATION:PT2H`],
    ['DURATION', `${start}\r\nDTEND:20450418T100007Z\r\nDURATION:PT1H`],
    ['RRULE UNTIL', `${start}\r\nRRULE:FREQ=DAILY;UNTIL=20450420`],
    ['RRULE UNTIL', `${start}\r\nRRULE:FREQ=DAILY;UNTIL=20450420T090007`],
    ['RRULE UNTIL', 'DTSTART;VALUE=DATE:20450418\r\nRRULE:FREQ=DAILY;UNTIL=20450420T090007Z'],
    ['RRULE UNTIL', 'DTSTART;TZID=Europe/Oslo:20450418T110007\r\nRRULE:FREQ=DAILY;UNTIL=20450420T110007'],
    ['RRULE UNTIL', 'DTSTART:20450418T110007\r\nRRULE:FREQ=DAILY;UNTIL=20450420T090007Z'],
    ['RECURRENCE-ID', `${start}\r\nRECURRENCE-ID:20450418T090007Z\r\nRECURRENCE-ID:20450419T090007Z`],
  ])('rejects the affected %s component and preserves its valid sibling: %s', (field, fields) => {
    const parsed = parse(event('invalid', fields), good)
    expect(parsed.events.map(item => item.sourceUid)).toEqual(['synthetic-raw-valid'])
    expect(parsed.events[0]).toMatchObject({ start: '2045-04-18T09:00:07.000Z', end: '2045-04-18T10:00:17.000Z' })
    expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1, cancelled: 0 })
    expect(parsed.authoritative).toBe(false)
    expect(parsed.warnings.join(' ')).toContain(field)
    const document = parseDocumentIcs(calendar(event('invalid', fields), good))
    expect(document.rows.map(row => row.title)).toEqual(['Oppdiktet valid'])
    expect(document.complete).toBe(false)
  })

  it.each([
    'DUE;VALUE=DATE:20450418T090007Z',
    'DUE:20450418T090007Z\r\nDUE:20450419T090007Z',
    'DTSTART:20450418T090007Z\r\nDURATION:PT1.5H',
    'DTSTART:20450418T090007Z\r\nDURATION:PT1H\r\nDURATION:PT2H',
    'DTSTART:20450418T090007Z\r\nDUE:20450418T100007Z\r\nDURATION:PT1H',
  ])('applies the same raw validation to VTODO: %s', fields => {
    const todo = `BEGIN:VTODO\r\nUID:synthetic-raw-task\r\nSUMMARY:Oppdiktet oppgave\r\n${fields}\r\nEND:VTODO`
    const parsed = parseDocumentIcs(calendar(todo, good))
    expect(parsed.rows.map(row => row.title)).toEqual(['Oppdiktet valid'])
    expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1 })
    expect(parsed.complete).toBe(false)
    expect(parsed.warnings.join(' ')).toMatch(/VTODO 1.*utelatt/)
  })

  it('retains DATE points, full integer durations and repeatable date-list properties', () => {
    const parsed = parse(
      event('day', 'DTSTART;VALUE=DATE:20450417'),
      event('point', start),
      event('duration', `${start}\r\nDURATION:P1DT2H3M4S`),
      event('dates', `${start}\r\nDURATION:PT1H\r\nRDATE:20450419T090007Z\r\nRDATE;VALUE=PERIOD:20450420T090007Z/PT2H\r\nEXDATE:20450418T090007Z\r\nEXDATE:20450419T090007Z`),
    )
    expect(parsed.authoritative).toBe(true)
    expect(parsed.events).toHaveLength(4)
    expect(parsed.events.find(item => item.sourceUid === 'synthetic-raw-day').allDay).toBe(true)
    expect(parsed.events.find(item => item.sourceUid === 'synthetic-raw-point').point).toBe(true)
    expect(parsed.events.find(item => item.sourceUid === 'synthetic-raw-duration').end).toBe('2045-04-19T11:03:11.000Z')
    expect(parsed.events.find(item => item.sourceUid === 'synthetic-raw-dates')).toMatchObject({ start: '2045-04-20T09:00:07.000Z', end: '2045-04-20T11:00:07.000Z' })
  })
})

describe('case-insensitive calendar symbols and unambiguous identity', () => {
  it('rejects repeated METHOD in either order before any calendar result is produced', () => {
    for (const methods of [['METHOD:PUBLISH', 'METHOD:cancel'], ['METHOD:cancel', 'METHOD:PUBLISH']]) {
      const text = calendar(...methods, good)
      expect(() => parseCalendar(text, { fileImport: true })).toThrow(/flere METHOD/)
      expect(() => parseDocumentIcs(text)).toThrow(/flere METHOD/)
    }
  })

  it.each([['STATUS', 'CONFIRMED', 'cancelled'], ['TRANSP', 'OPAQUE', 'transparent']])('rejects repeated %s in either order without cancellation effects', (name, first, second) => {
    for (const values of [[first, second], [second, first]]) {
      const invalid = event('repeated-symbol', `${start}\r\n${values.map(value => `${name}:${value}`).join('\r\n')}`)
      const parsed = parse(invalid, good)
      expect(parsed.events.map(item => item.sourceUid)).toEqual(['synthetic-raw-valid'])
      expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1, cancelled: 0 })
      expect(parsed.cancellations).toEqual([])
      expect(parsed.authoritative).toBe(false)
      const document = parseDocumentIcs(calendar(invalid, good))
      expect(document).toMatchObject({ complete: false, cancellations: [], accounting: { total: 2, retained: 1, rejected: 1, cancelled: 0 } })
    }
  })

  it('rejects repeated VTODO STATUS in either order while preserving safe siblings', () => {
    for (const values of [['NEEDS-ACTION', 'cancelled'], ['cancelled', 'NEEDS-ACTION']]) {
      const todo = ['BEGIN:VTODO', 'UID:synthetic-repeated-task-status', 'SUMMARY:Oppdiktet gjøremål', ...values.map(value => `STATUS:${value}`), 'END:VTODO'].join('\r\n')
      const result = parseDocumentIcs(calendar(todo, good))
      expect(result.rows.map(row => row.title)).toEqual(['Oppdiktet valid'])
      expect(result).toMatchObject({ complete: false, cancellations: [], accounting: { total: 2, retained: 1, rejected: 1, cancelled: 0 } })
    }
  })

  it.each(['cancel', 'CaNcEl'])('honours METHOD:%s without turning cancellations into events', method => {
    const text = calendar(`METHOD:${method}`, event('cancelled', start))
    const result = parseCalendar(text, { fileImport: true })
    expect(result.events).toEqual([])
    expect(result.cancellations).toEqual([{ uid: 'synthetic-raw-cancelled', recurrence: null }])
    expect(result.accounting).toMatchObject({ total: 1, cancelled: 1, retained: 0 })
    expect(parseDocumentIcs(text)).toMatchObject({ complete: false, rows: [], cancellations: [expect.any(Object)] })
  })

  it('normalizes recurrence symbols, status and transparency while retaining source casing', () => {
    const fields = 'DTSTART;TZID=Europe/Oslo:20450418T110007\r\nDURATION:PT1H\r\nRRULE:freq=daily;count=3;byday=tu,we,th,fr,sa,su,mo;wkst=mo\r\nTRANSP:trAnsParEnt'
    const text = calendar(event('MiXeD', fields), event('MiXeD', 'RECURRENCE-ID:20450419T090007Z\r\nSTATUS:caNCellEd'))
    const result = parseCalendar(text, { fileImport: true })
    expect(result.events.map(item => item.start)).toEqual(['2045-04-18T09:00:07.000Z', '2045-04-20T09:00:07.000Z'])
    expect(result.events.every(item => item.transparent && item.sourceUid === 'synthetic-raw-MiXeD' && item.title === 'Oppdiktet MiXeD')).toBe(true)
    expect(result.cancellations).toHaveLength(1)
  })

  it.each([
    'DTSTART;VALUE=date:20450418\r\nRRULE:freq=daily;until=20450420',
    'DTSTART:20450418T090007Z\r\nRRULE:freq=daily;until=20450420T090007Z',
    'DTSTART:20450418T110007\r\nRRULE:freq=daily;until=20450420T110007',
    'DTSTART;TZID=Europe/Oslo:20450418T110007\r\nRRULE:freq=daily;until=20450420T090007Z',
  ])('retains valid UNTIL/DTSTART forms: %s', fields => {
    const result = parse(event('until', fields))
    expect(result.events).toHaveLength(3)
    expect(result.authoritative).toBe(true)
  })

  it.each(['UID:synthetic-raw-series', 'UID:synthetic-other', 'UID:'])('a multiple-UID exception cannot suppress or cancel a valid occurrence: %s', extra => {
    const result = parse(event('series', `${start}\r\nRRULE:FREQ=DAILY;COUNT=2`), event('series', `RECURRENCE-ID:20450419T090007Z\r\nSTATUS:cancelled\r\n${extra}`))
    expect(result.events.map(item => item.start)).toEqual(['2045-04-18T09:00:07.000Z', '2045-04-19T09:00:07.000Z'])
    expect(result.cancellations).toEqual([])
    expect(result.accounting).toMatchObject({ total: 2, rejected: 1, retained: 1, cancelled: 0 })
    expect(result.warnings.join(' ')).toContain('UID')
  })

  it('rejects multiple-UID tasks and UID-less cancellations while preserving safe siblings', () => {
    const text = calendar('BEGIN:VTODO\r\nUID:synthetic-task-a\r\nUID:synthetic-task-b\r\nSUMMARY:Oppdiktet tvetydig oppgave\r\nEND:VTODO', 'BEGIN:VEVENT\r\nSTATUS:cancelled\r\nEND:VEVENT', good)
    const result = parseDocumentIcs(text)
    expect(result.rows.map(row => row.title)).toEqual(['Oppdiktet valid'])
    expect(result.cancellations).toEqual([])
    expect(result.accounting).toMatchObject({ total: 3, retained: 1, rejected: 2, cancelled: 0 })
  })

  it.each(['TRANSP:TRANSPARENT', 'STATUS:CANCELLED', 'X-STUDIEPLAN-ACTIVITY-KIND:exam', 'X-STUDIEPLAN-ACTIVITY-TYPE:Seminar', 'X-COURSE-CODE:SYN902', 'X-COURSE-YEAR:2046', 'X-UNIVERSITY:Oppdiktet institusjon', 'X-GROUP:Oppdiktet gruppe'])('does not choose an arbitrary duplicate when %s changes', extra => {
    const original = event('duplicate', start), conflicting = event('duplicate', `${start}\r\n${extra}`)
    for (const items of [[original, conflicting], [conflicting, original]]) expect(() => parse(...items)).toThrow(/samme identitet/)
  })

  it('retains equivalent components and resolves revisions by valid sequence then UTC stamp', () => {
    const original = event('revision', `${start}\r\nSEQUENCE:1\r\nDTSTAMP:20450401T000000Z`)
    const duplicate = parse(original, original)
    expect(duplicate.events).toHaveLength(1)
    expect(duplicate.accounting).toMatchObject({ total: 2, retained: 1, filtered: 1 })
    const cancelled = event('revision', 'STATUS:cancelled\r\nSEQUENCE:2\r\nDTSTAMP:20450402T000000Z')
    const restored = event('revision', `${start}\r\nSEQUENCE:2\r\nDTSTAMP:20450403T000000Z\r\nTRANSP:transparent`)
    for (const items of [[original, cancelled, restored], [restored, cancelled, original]]) {
      const result = parse(...items)
      expect(result.events).toHaveLength(1)
      expect(result.events[0].transparent).toBe(true)
      expect(result.cancellations).toEqual([])
      expect(result.accounting).toMatchObject({ total: 3, retained: 1, filtered: 2, cancelled: 0 })
    }
    expect(parse(original, cancelled)).toMatchObject({ events: [], cancellations: [{ uid: 'synthetic-raw-revision', recurrence: null }] })
  })

  it('gives higher SEQUENCE precedence over a later DTSTAMP in both component orders', () => {
    for (const higherCancelled of [false, true]) {
      const higher = event('crossed-revision', `${higherCancelled ? 'STATUS:cancelled' : start}\r\nSEQUENCE:2\r\nDTSTAMP:20450401T000000Z`)
      const lower = event('crossed-revision', `${higherCancelled ? start : 'STATUS:cancelled'}\r\nSEQUENCE:1\r\nDTSTAMP:20450403T000000Z`)
      for (const items of [[higher, lower], [lower, higher]]) {
        const result = parse(...items)
        expect(result.events).toHaveLength(higherCancelled ? 0 : 1)
        if (!higherCancelled) expect(result.events[0]).toMatchObject({ sourceUid: 'synthetic-raw-crossed-revision', start: '2045-04-18T09:00:07.000Z', cancelled: false })
        expect(result.cancellations).toEqual(higherCancelled ? [{ uid: 'synthetic-raw-crossed-revision', recurrence: null }] : [])
        expect(result.accounting).toMatchObject({ total: 2, retained: higherCancelled ? 0 : 1, filtered: 1, rejected: 0, cancelled: higherCancelled ? 1 : 0 })
      }
    }
  })

  it('rejects a newer active component without DTSTART before it can suppress the older valid component', () => {
    const valid = event('required-start', `${start}\r\nSEQUENCE:1`), invalid = event('required-start', 'SEQUENCE:2')
    for (const items of [[valid, invalid], [invalid, valid]]) {
      const result = parse(...items)
      expect(result.events).toHaveLength(1)
      expect(result.events[0].start).toBe('2045-04-18T09:00:07.000Z')
      expect(result).toMatchObject({ authoritative: false, cancellations: [], accounting: { total: 2, retained: 1, rejected: 1, filtered: 0, cancelled: 0 } })
      expect(parseDocumentIcs(calendar(...items))).toMatchObject({ complete: false, accounting: { total: 2, retained: 1, rejected: 1 } })
    }
    expect(parse('BEGIN:VEVENT\r\nUID:synthetic-stable-cancellation\r\nSTATUS:cancelled\r\nEND:VEVENT')).toMatchObject({ events: [], cancellations: [{ uid: 'synthetic-stable-cancellation', recurrence: null }], accounting: { total: 1, rejected: 0, cancelled: 1 } })
  })

  it.each(['DTEND:20450418T080007Z', 'DURATION:PT0S', 'DURATION:-PT1H'])('rejects a newer invalid interval before revision selection: %s', interval => {
    const valid = event('interval-revision', `${start}\r\nDTEND:20450418T100017Z\r\nSEQUENCE:1`)
    const invalid = event('interval-revision', `${start}\r\n${interval}\r\nSEQUENCE:2`)
    for (const items of [[valid, invalid], [invalid, valid]]) {
      const result = parse(...items)
      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toMatchObject({ sourceUid: 'synthetic-raw-interval-revision', start: '2045-04-18T09:00:07.000Z', end: '2045-04-18T10:00:17.000Z', cancelled: false })
      expect(result.accounting).toEqual({ total: 2, retained: 1, partial: 0, filtered: 0, rejected: 1, cancelled: 0, occurrences: 1, filteredOccurrences: 0, rejectedOccurrences: 0 })
      expect(result.authoritative).toBe(false)
      expect(result.cancellations).toEqual([])
      const document = parseDocumentIcs(calendar(...items))
      expect(document.complete).toBe(false)
      expect(document.accounting).toEqual(result.accounting)
    }
  })

  it.each(['DTEND:20450418T080007Z', 'DURATION:PT0S', 'DURATION:-PT1H'])('retains a valid older recurrence exception when its newer interval is invalid: %s', interval => {
    const master = event('exception-interval', `${start}\r\nDURATION:PT1H\r\nRRULE:FREQ=DAILY;COUNT=2`)
    const identity = 'RECURRENCE-ID:20450418T090007Z\r\nDTSTART:20450418T120007Z'
    const valid = event('exception-interval', `${identity}\r\nDURATION:PT1H\r\nSEQUENCE:1`)
    const invalid = event('exception-interval', `${identity}\r\n${interval}\r\nSEQUENCE:2`)
    for (const items of [[valid, invalid], [invalid, valid]]) {
      const result = parse(master, ...items)
      expect(result.events.map(item => [item.start, item.end])).toEqual([['2045-04-18T12:00:07.000Z', '2045-04-18T13:00:07.000Z'], ['2045-04-19T09:00:07.000Z', '2045-04-19T10:00:07.000Z']])
      expect(result.accounting).toEqual({ total: 3, retained: 2, partial: 0, filtered: 0, rejected: 1, cancelled: 0, occurrences: 2, filteredOccurrences: 0, rejectedOccurrences: 0 })
      expect(result.authoritative).toBe(false)
      expect(result.cancellations).toEqual([])
    }
  })

  it.each([
    ['point', start, '2045-04-18T09:00:07.000Z', '2045-04-18T09:00:07.000Z', 1],
    ['all-day', 'DTSTART;VALUE=DATE:20450418', '2045-04-17T22:00:00.000Z', '2045-04-18T22:00:00.000Z', 1],
    ['positive-duration', `${start}\r\nDURATION:PT1H`, '2045-04-18T09:00:07.000Z', '2045-04-18T10:00:07.000Z', 1],
    ['recurrence', `${start}\r\nDURATION:PT1H\r\nRRULE:FREQ=DAILY;COUNT=2`, '2045-04-18T09:00:07.000Z', '2045-04-18T10:00:07.000Z', 2],
  ])('still accepts a newer valid %s revision in both orders', (kind, fields, expectedStart, expectedEnd, occurrences) => {
    const older = event('positive-interval-revision', `${start}\r\nDURATION:PT2H\r\nSEQUENCE:1`)
    const newer = event('positive-interval-revision', `${fields}\r\nSEQUENCE:2`)
    for (const items of [[older, newer], [newer, older]]) {
      const result = parse(...items)
      expect(result.events).toHaveLength(occurrences)
      expect(result.events[0]).toMatchObject({ start: expectedStart, end: expectedEnd, allDay: kind === 'all-day', cancelled: false })
      expect(Boolean(result.events[0].point)).toBe(kind === 'point')
      expect(result.accounting).toEqual({ total: 2, retained: 1, partial: 0, filtered: 1, rejected: 0, cancelled: 0, occurrences, filteredOccurrences: 0, rejectedOccurrences: 0 })
      expect(result.authoritative).toBe(true)
      expect(result.cancellations).toEqual([])
    }
  })

  it('keeps rule timezone semantics across DST instead of selecting by file order', () => {
    const utc = event('dst-rule', 'DTSTART:20261024T080007Z\r\nDURATION:PT1H\r\nRRULE:FREQ=DAILY;COUNT=3')
    const local = event('dst-rule', 'DTSTART;TZID=Europe/Oslo:20261024T100007\r\nDURATION:PT1H\r\nRRULE:FREQ=DAILY;COUNT=3')
    expect(parse(utc).events.map(item => item.start)).toEqual(['2026-10-24T08:00:07.000Z', '2026-10-25T08:00:07.000Z', '2026-10-26T08:00:07.000Z'])
    expect(parse(local).events.map(item => item.start)).toEqual(['2026-10-24T08:00:07.000Z', '2026-10-25T09:00:07.000Z', '2026-10-26T09:00:07.000Z'])
    for (const items of [[utc, local], [local, utc]]) expect(() => parse(...items)).toThrow(/samme identitet/)
  })

  it('does not equate recurring end and duration values that agree only during a DST transition', () => {
    const end = event('dst-duration', 'DTSTART;TZID=Europe/Oslo:20260329T013000\r\nDTEND;TZID=Europe/Oslo:20260329T033000\r\nRRULE:FREQ=DAILY;COUNT=2')
    const duration = end.replace('DTEND;TZID=Europe/Oslo:20260329T033000', 'DURATION:PT2H')
    for (const items of [[end, duration], [duration, end]]) expect(() => parse(...items)).toThrow(/samme identitet/)
  })

  it.each(['', '\r\nRRULE:FREQ=DAILY;COUNT=2'])('retains explicit OPAQUE and equivalent DTEND/DURATION duplicates: %s', recurrence => {
    const end = event('bounded-equivalent', `${start}\r\nDTEND:20450418T100017Z${recurrence}`)
    const duration = event('bounded-equivalent', `${start}\r\nDURATION:PT1H10S\r\nTRANSP:OPAQUE${recurrence}`)
    for (const items of [[end, duration], [duration, end]]) {
      const result = parse(...items)
      expect(result.events).toHaveLength(recurrence ? 2 : 1)
      expect(result.events[0]).toMatchObject({ start: '2045-04-18T09:00:07.000Z', end: '2045-04-18T10:00:17.000Z', transparent: false })
      expect(result).toMatchObject({ authoritative: true, cancellations: [], accounting: { total: 2, retained: 1, filtered: 1, rejected: 0 } })
    }
    expect(() => parse(end, duration.replace('TRANSP:OPAQUE', 'TRANSP:OPAQUE\r\nX-STUDIEPLAN-ACTIVITY-KIND:exam'))).toThrow(/samme identitet/)
  })

  it('retains equivalent non-recurring UTC and TZID instants in both orders', () => {
    const utc = event('single-zone', 'DTSTART:20261024T080007Z\r\nDTEND:20261024T090017Z')
    const local = event('single-zone', 'DTSTART;TZID=Europe/Oslo:20261024T100007\r\nDTEND;TZID=Europe/Oslo:20261024T110017\r\nTRANSP:OPAQUE')
    for (const items of [[utc, local], [local, utc]]) {
      const result = parse(...items)
      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toMatchObject({ start: '2026-10-24T08:00:07.000Z', end: '2026-10-24T09:00:17.000Z', transparent: false })
      expect(result.accounting).toMatchObject({ total: 2, retained: 1, filtered: 1, rejected: 0 })
    }
  })

  it('preserves equivalent recurrence exceptions and newer moved occurrences', () => {
    const master = event('series', `${start}\r\nDURATION:PT1H\r\nRRULE:FREQ=DAILY;COUNT=2`)
    const exception = event('series', 'RECURRENCE-ID:20450419T090007Z\r\nDTSTART:20450419T120007Z\r\nDURATION:PT2H\r\nSEQUENCE:1')
    const newer = exception.replace('SEQUENCE:1', 'SEQUENCE:2').replace('T120007Z', 'T130007Z')
    expect(parse(master, exception, exception).events.map(item => item.start)).toEqual(['2045-04-18T09:00:07.000Z', '2045-04-19T12:00:07.000Z'])
    expect(parse(master, exception, newer).events.map(item => item.start)).toEqual(['2045-04-18T09:00:07.000Z', '2045-04-19T13:00:07.000Z'])
  })

  it('rejects an unresolved cancelled master with an active exception', () => {
    expect(() => parse(event('series', 'STATUS:CANCELLED'), event('series', `${start}\r\nRECURRENCE-ID:20450418T090007Z`))).toThrow(/Avlyst serie og aktivt unntak/)
  })
})

describe('unusable event timezones stay local to their component', () => {
  it.each(['DTSTART', 'DTEND', 'RDATE', 'EXDATE', 'RECURRENCE-ID'])('rejects an unknown %s timezone without losing valid siblings', field => {
    const unknown = `${field};TZID=Synthetic/Nowhere:20450418T110007`
    const parsed = parse(event('unknown-zone', `${field === 'DTSTART' ? '' : start + '\r\n'}${unknown}`), good)
    expect(parsed.events.map(item => item.sourceUid)).toEqual(['synthetic-raw-valid'])
    expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1 })
    expect(parsed.authoritative).toBe(false)
    expect(parsed.warnings.join(' ')).toMatch(/TZID|tidssone/)
    expect(parsed.warnings.join(' ')).toContain('Synthetic/Nowhere')
  })

  it.each(['DTSTART;TZID=Synthetic/Nowhere:20450419T110007', 'DTSTART:20450419T100007Z\r\nDURATION:PT1.5H'])('suppresses the original occurrence when a rejected exception still has a valid identity: %s', fields => {
    const parsed = parse(event('series', `${start}\r\nDURATION:PT1H\r\nRRULE:FREQ=DAILY;COUNT=3`), event('series', `RECURRENCE-ID:20450419T090007Z\r\n${fields}`))
    expect(parsed.events.map(item => item.start)).toEqual(['2045-04-18T09:00:07.000Z', '2045-04-20T09:00:07.000Z'])
    expect(parsed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1 })
  })

  it('does not guess the identity of an exception whose recurrence timezone is invalid', () => {
    const parsed = parse(event('series', `${start}\r\nRRULE:FREQ=DAILY;COUNT=2`), event('series', 'RECURRENCE-ID;TZID=Synthetic/Nowhere:20450419T090007\r\nDTSTART:20450419T120007Z'))
    expect(parsed.events.map(item => item.start)).toEqual(['2045-04-18T09:00:07.000Z', '2045-04-19T09:00:07.000Z'])
    expect(parsed.accounting.rejected).toBe(1)
  })
})
