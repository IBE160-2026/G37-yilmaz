import { describe, expect, it } from 'vitest'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, refreshDocumentImportPreview } from '../../src/import-preview.js'
import { validPlanner, validateEvent, eventBlocksTime, osloLocal } from '../../src/planner.js'
import { validEnvelope } from '../../src/storage.js'
import { calendarEntries, entriesForDay, timeLabel } from '../../src/calendar-model.js'
import { generateCalendarIcs } from '../../src/calendar-export.js'
import { recordChange, undoLast } from '../../src/history.js'

// Invented calendars only; no original or anonymized student data.
const calendar = (...entries) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${entries.join('\r\n')}\r\nEND:VCALENDAR`
const event = (id, fields = '', title = 'Syntetisk markering') => `BEGIN:VEVENT\r\nUID:${id}\r\nSUMMARY:${title}\r\nDTSTART:20261026T090000Z\r\n${fields}\r\nEND:VEVENT`
const empty = () => ({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } })
const preview = (state, text, hash = 'a', sourceId) => createDocumentImportPreview(state, { ...parseDocumentIcs(text), contentHash: hash.repeat(64) }, { sourceId })
const save = (state, draft) => { const result = buildDocumentImportCommit(state, draft); expect(result.ok, JSON.stringify(result)).toBe(true); return result.state }

describe('implicit calendar points and visible import periods', () => {
  it('preserves mixed points as events, with no tasks or capacity, through save, reload, repeat, editing and export', () => {
    const text = calendar(event('generic'), event('deadline', 'TRANSP:TRANSPARENT', 'Syntetisk innleveringsfrist'), event('interval', 'DTEND:20261026T100000Z'), event('personal', 'X-STUDIEPLAN-ACTIVITY-KIND:personal'), 'BEGIN:VEVENT\r\nUID:day\r\nSUMMARY:Syntetisk dag\r\nDTSTART;VALUE=DATE:20261027\r\nEND:VEVENT')
    const parsed = parseDocumentIcs(text)
    expect(parsed.complete).toBe(true)
    expect(parsed.warnings).toEqual([])
    expect(parsed.accounting).toMatchObject({ total: 5, retained: 5, filtered: 0, rejected: 0, cancelled: 0, occurrences: 5 })
    const state = save(empty(), preview(empty(), text))
    expect(state.tasks).toEqual([])
    expect(state.planner.events.filter(e => e.point)).toHaveLength(3)
    expect(state.planner.events.filter(eventBlocksTime)).toHaveLength(2)
    expect(validEnvelope(state)).toBe(true)
    expect(state.importSources[0].accounting).toEqual(parsed.accounting)
    expect(state.importSources[0].period).toEqual(parsed.period)
    const reload = JSON.parse(JSON.stringify(state)); reload.planner.events[0].notes = 'Syntetisk notat'
    expect(save(reload, preview(reload, text)).planner).toEqual(reload.planner)
    const points = entriesForDay(calendarEntries(state), '2026-10-26').filter(e => e.point)
    expect(points).toHaveLength(3)
    expect(points.every(e => !timeLabel(e).startsWith('Frist'))).toBe(true)
    const first = state.planner.events.find(e => e.point && !e.transparent && e.activityKind !== 'personal')
    const moved = validateEvent({ ...first, startLocal: '2026-10-26T12:00', endLocal: '' }, first)
    expect(moved).toMatchObject({ id: first.id, point: true, start: moved.end })
    expect(eventBlocksTime(moved)).toBe(false)
    const interval = validateEvent({ ...first, startLocal: osloLocal(first.start), endLocal: '2026-10-26T12:00' }, first)
    expect(interval.point).toBe(false)
    expect(eventBlocksTime(interval)).toBe(true)
    const exported = parseDocumentIcs(generateCalendarIcs(state, { includeTeaching: true, includePersonal: true }))
    expect(exported.rows.filter(row => row.point)).toHaveLength(3)
    expect(validPlanner({ ...state.planner, events: [{ ...first, point: false }] })).toBe(false)
  })

  it('accounts for rejected ends, missing start, cancelled entries and a disjoint filter', () => {
    const text = calendar(event('point'), event('equal', 'DTEND:20261026T090000Z'), event('reversed', 'DTEND:20261026T080000Z'), event('zero', 'DURATION:PT0S'), event('negative', 'DURATION:-PT1H'), event('cancel', 'STATUS:CANCELLED'), 'BEGIN:VEVENT\r\nUID:missing\r\nSUMMARY:Syntetisk uten start\r\nEND:VEVENT')
    const parsed = parseDocumentIcs(text)
    expect(parsed.accounting).toMatchObject({ total: 7, retained: 1, rejected: 5, cancelled: 1, filtered: 0 })
    const filtered = parseDocumentIcs(calendar(event('point')), { semester: 'spring', year: 2025 })
    expect(filtered.rows).toHaveLength(0)
    expect(filtered.accounting).toMatchObject({ total: 1, retained: 0, filtered: 1, rejected: 0 })
    expect(filtered.period.mode).toBe('filter')
    expect(parseDocumentIcs(calendar(event('point'))).period.mode).toBe('automatic')
    const malformed = parseDocumentIcs(calendar(event('valid'), event('malformed', 'DURATION:INVALID')))
    expect(malformed.rows).toHaveLength(1)
    expect(malformed.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1 })
  })

  it('keeps point recurrence identity, moved exceptions, period duration and cancellation', () => {
    const text = calendar(event('series', 'RRULE:FREQ=DAILY;COUNT=3'), event('series', 'RECURRENCE-ID:20261027T090000Z').replace('DTSTART:20261026T090000Z', 'DTSTART:20261027T110000Z'), event('series', 'RECURRENCE-ID:20261028T090000Z\r\nSTATUS:CANCELLED'), event('period', 'RDATE;VALUE=PERIOD:20261102T090000Z/PT2H'))
    const parsed = parseDocumentIcs(text), rows = parsed.rows.filter(row => row.kind === 'event')
    expect(rows).toHaveLength(4)
    expect(rows.filter(row => row.point)).toHaveLength(3)
    expect(rows.find(row => row.originalStart === '2026-11-02T09:00:00.000Z').originalEnd).toBe('2026-11-02T11:00:00.000Z')
    expect(parsed.accounting).toMatchObject({ total: 4, retained: 3, cancelled: 1, rejected: 0 })
    expect(new Set(rows.map(row => row.key)).size).toBe(4)
  })

  it('rejects explicit zero RDATE periods and accounts for series outside the bounded expansion', () => {
    const invalid = parseDocumentIcs(calendar(event('period', 'RDATE;VALUE=PERIOD:20261102T090000Z/20261102T090000Z')))
    expect(invalid.rows.filter(row => row.kind === 'event')).toHaveLength(1)
    expect(invalid.complete).toBe(false)
    expect(invalid.accounting).toMatchObject({ total: 1, retained: 0, partial: 1, rejected: 0, occurrences: 1, rejectedOccurrences: 1 })
    expect(validEnvelope(save(empty(), preview(empty(), calendar(event('period', 'RDATE;VALUE=PERIOD:20261102T090000Z/20261102T090000Z')))))).toBe(true)
    const filtered = parseDocumentIcs(calendar(event('series', 'RRULE:FREQ=DAILY;COUNT=3')), { semester: 'spring', year: 2025 })
    expect(filtered.accounting).toMatchObject({ total: 1, filtered: 1, occurrences: 0, filteredOccurrences: 0 })
  })

  it('suppresses the original occurrence of a rejected moved recurrence exception', () => {
    const moved = event('series', 'RECURRENCE-ID:20261027T090000Z\r\nDURATION:INVALID').replace('DTSTART:20261026T090000Z', 'DTSTART:20261027T120000Z')
    const result = parseDocumentIcs(calendar(event('series', 'RRULE:FREQ=DAILY;COUNT=3'), moved))
    expect(result.rows.map(row => row.originalStart)).toEqual(['2026-10-26T09:00:00.000Z', '2026-10-28T09:00:00.000Z'])
    expect(result.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1, occurrences: 2 })
  })

  it('rejects missing source identity before period filtering', () => {
    const result = parseDocumentIcs(calendar(event('missing-name').replace('SUMMARY:Syntetisk markering\r\n', ''), event('missing-uid').replace('UID:missing-uid\r\n', '')), { semester: 'spring', year: 2025 })
    expect(result.accounting).toMatchObject({ total: 2, filtered: 0, rejected: 2 })
    expect(result.complete).toBe(false)
  })

  it('uses inclusive semester start and exclusive end for points, including second neighbours', () => {
    const times = ['20260630T215959Z', '20260630T220000Z', '20260630T220001Z', '20261231T225959Z', '20261231T230000Z', '20261231T230001Z']
    const result = parseDocumentIcs(calendar(...times.map((time, i) => event(`boundary-${i}`).replace('20261026T090000Z', time))), { semester: 'autumn', year: 2026 })
    expect(result.rows.map(row => row.originalStart)).toEqual(['2026-06-30T22:00:00.000Z', '2026-06-30T22:00:01.000Z', '2026-12-31T22:59:59.000Z'])
    expect(result.accounting).toMatchObject({ retained: 3, filtered: 3 })
  })

  it('preserves repeated-hour instants and source transparency while exporting nonblocking points as transparent', () => {
    const text = calendar(event('early', 'TRANSP:OPAQUE', 'Syntetisk tidlig').replace('20261026T090000Z', '20261025T003000Z'), event('late', 'TRANSP:TRANSPARENT', 'Syntetisk sen').replace('20261026T090000Z', '20261025T013000Z'), event('personal', 'X-STUDIEPLAN-ACTIVITY-KIND:personal\r\nTRANSP:OPAQUE', 'Syntetisk egen').replace('20261026T090000Z', '20261025T013000Z'))
    const state = save(empty(), preview(empty(), text))
    for (const item of state.planner.events) {
      expect(osloLocal(item.start)).toBe('2026-10-25T02:30')
      Object.assign(item, validateEvent({ ...item, startLocal: osloLocal(item.start), endLocal: '', notes: 'Syntetisk notat' }, item))
    }
    const exported = parseDocumentIcs(generateCalendarIcs(state, { includeTeaching: true, includePersonal: true }))
    expect(exported.rows.map(row => [row.originalStart, row.transparent]).sort()).toEqual([
      ['2026-10-25T00:30:00.000Z', true], ['2026-10-25T01:30:00.000Z', true], ['2026-10-25T01:30:00.000Z', true],
    ].sort())
    expect(state.planner.events.every(item => item.start === item.end && !eventBlocksTime(item))).toBe(true)
    expect(state.planner.events.map(item => item.transparent)).toEqual([false, true, false])
  })

  it('turns a point into an interval when a positive end is supplied in preview', () => {
    const draft = preview(empty(), calendar(event('point')))
    draft.rows[0].endLocal = '2026-10-26T11:00'
    const state = save(empty(), draft)
    expect(state.planner.events[0]).toMatchObject({ point: false, start: '2026-10-26T09:00:00.000Z', end: '2026-10-26T10:00:00Z' })
    expect(eventBlocksTime(state.planner.events[0])).toBe(true)
  })

  it('retains reviewed course mappings and field corrections through an empty period and changed row indices', () => {
    const text = calendar(event('early', 'X-COURSE-CODE:SYN101\r\nX-COURSE-NAME:Syntetisk A').replace('20261026', '20260326'), event('late', 'X-COURSE-CODE:SYN102\r\nX-COURSE-NAME:Syntetisk B'))
    const state = empty(), draft = preview(state, text)
    const late = draft.rows.find(row => row.title === 'Syntetisk markering' && row.originalStart.startsWith('2026-10'))
    late.title = 'Rettet tittel'; late.location = 'Syntetisk rom'
    const selectedCourse = draft.rows[Number(late.courseChoice.slice(4))]
    selectedCourse.title = 'Rettet emnenavn'
    const spring = refreshDocumentImportPreview(state, draft, { ...parseDocumentIcs(text, { semester: 'spring', year: 2025 }), contentHash: draft.contentHash })
    expect(spring.rows).toHaveLength(0)
    const autumn = refreshDocumentImportPreview(state, spring, { ...parseDocumentIcs(text, { semester: 'autumn', year: 2026 }), contentHash: draft.contentHash })
    const restored = autumn.rows.find(row => row.kind === 'event')
    expect(restored).toMatchObject({ title: 'Rettet tittel', location: 'Syntetisk rom', courseChoice: 'row:0' })
    expect(autumn.rows[0].title).toBe('Rettet emnenavn')
    expect(save(state, autumn).planner.events[0].courseId).toBe(autumn.rows[0].targetId)
  })

  it('guards stale commits and undo and preserves notes and IDs across source point movement', () => {
    const text = calendar(event('stable')), initial = empty(), state = save(initial, preview(initial, text)), old = state.planner.events[0]
    const history = recordChange(initial, state, undefined, 'Syntetisk punktimport')
    expect(undoLast(state, history).state).toEqual(initial)
    const draft = preview(state, text.replace('T090000Z', 'T110000Z'), 'b', state.importSources[0].id)
    state.planner.events[0].notes = 'Behold notatet'
    expect(buildDocumentImportCommit(state, draft).ok).toBe(false)
    expect(undoLast(state, history).ok).toBe(false)
    const updated = save(state, refreshDocumentImportPreview(state, draft))
    expect(updated.planner.events).toHaveLength(1)
    expect(updated.planner.events[0]).toMatchObject({ id: old.id, notes: 'Behold notatet', point: true, start: '2026-10-26T11:00:00.000Z', end: '2026-10-26T11:00:00.000Z' })
  })
})
