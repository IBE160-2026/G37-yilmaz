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
