import { describe, expect, it } from 'vitest'
import { eventBlocksTime, mergeImport, validPlanner, validatePersonalActivity } from '../../src/planner.js'
import { calendarEntries, timeLabel } from '../../src/calendar-model.js'
import { calendarExportItems, generateCalendarIcs } from '../../src/calendar-export.js'
import { deriveWorkCapacity } from '../../src/work-capacity.js'
import { dailyOverview } from '../../src/daily-overview.js'
import { eventsOnDay } from '../../src/teaching-calendar.js'
import { subjectEventAgendaEntries } from '../../src/subjects-view.js'
import { parseTextRegistration } from '../../src/text-registration.js'
import { isExamEvent } from '../../src/event-kind.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { recordChange, undoLast } from '../../src/history.js'

const base = { courses: [], sources: [] }

describe('personal calendar activities', () => {
  it('validates date-only, start-only and known intervals without a course or source', () => {
    const date = validatePersonalActivity({ id: 'date', title: 'Avtale', dateLocal: '2026-10-04' })
    const start = validatePersonalActivity({ id: 'start', title: 'Telefon', dateLocal: '2026-10-04', startLocal: '12:00' })
    const interval = validatePersonalActivity({ id: 'interval', title: 'Tannlege', dateLocal: '2026-10-04', startLocal: '12:00', endLocal: '13:00' })
    expect(validPlanner({ ...base, events: [date, start, interval] })).toBe(true)
    expect([eventBlocksTime(date), eventBlocksTime(start), eventBlocksTime(interval)]).toEqual([false, false, true])
    expect(() => validatePersonalActivity({ id: 'wrong-day', title: 'Natt', dateLocal: '2026-10-04', startLocal: '2026-10-05T00:30', endLocal: '2026-10-05T01:00' })).toThrow(/valgt dato/)
    expect(validPlanner({ ...base, events: [{ ...interval, dateLocal: '2026-10-05' }] })).toBe(false)
  })

  it('normalizes parsed clocks and keeps date/start-only entries on every agenda surface', () => {
    const parsed = parseTextRegistration('Legg til møte 4.10 kl. 12–13', { now: new Date('2026-09-29T10:00:00Z') })
    expect(parsed).toMatchObject({ ok: true, proposal: { action: 'activity', title: 'møte', startLocal: '12:00', endLocal: '13:00' } })
    expect(() => validatePersonalActivity(parsed.proposal)).not.toThrow()
    const date = validatePersonalActivity({ id: 'date', title: 'Avtale', dateLocal: '2026-10-04' }), start = validatePersonalActivity({ id: 'start', title: 'Telefon', dateLocal: '2026-10-04', startLocal: '12:00' })
    expect(eventsOnDay([start, date], '2026-10-04').map(event => event.id)).toEqual(['date', 'start'])
    expect(subjectEventAgendaEntries({ ...base, events: [start, date] }, new Date('2026-10-04T18:00:00Z')).map(entry => [entry.event.id, entry.kind, entry.title])).toEqual([
      ['date', 'personal', 'E · Egen aktivitet · Avtale'], ['start', 'personal', 'E · Egen aktivitet · Telefon'],
    ])
  })

  it('offers one explicit choice for a bare title plus date', () => {
    expect(parseTextRegistration('Tannlege 4.10', { now: new Date('2026-09-29T10:00:00Z') })).toMatchObject({ ok: true, proposal: { action: 'ambiguous-date', title: 'Tannlege', dateLocal: '2026-10-04' } })
    expect(parseTextRegistration('Lever oppgave innen 4.10 kl. 13', { now: new Date('2026-09-29T10:00:00Z') }).proposal.action).toBe('create')
  })

  it('renders honest timing labels and reserves only a known interval', () => {
    const events = [
      validatePersonalActivity({ id: 'date', title: 'Avtale', dateLocal: '2026-10-04' }),
      validatePersonalActivity({ id: 'start', title: 'Telefon', dateLocal: '2026-10-04', startLocal: '12:00' }),
      validatePersonalActivity({ id: 'interval', title: 'Tannlege', dateLocal: '2026-10-04', startLocal: '13:00', endLocal: '14:00' }),
    ]
    const entries = calendarEntries({ planner: { ...base, events } })
    expect(entries.map(timeLabel)).toEqual(['Tid ikke oppgitt', '12:00 · Varighet ikke oppgitt', '13:00–14:00'])
    const result = deriveWorkCapacity([], [], new Date('2026-10-04T08:00:00Z'), events, [{ id: 'w', start: '2026-10-04T10:00:00Z', end: '2026-10-04T14:00:00Z' }])
    expect(result.warnings.join(' ')).toContain('ukjent tidspunkt eller varighet')
    expect(dailyOverview({ now: new Date('2026-10-04T18:00:00Z'), tasks: [], sessions: [], planner: { ...base, events } }).activity).toMatchObject({ id: 'date', kind: 'personal' })
    const afterDay = deriveWorkCapacity([], [], new Date('2026-10-05T08:00:00Z'), events, [{ id: 'w', start: '2026-10-05T10:00:00Z', end: '2026-10-05T14:00:00Z' }])
    expect(afterDay.uncertainPersonalCount).toBe(0)
  })

  it('exports personal activities only by explicit choice and keeps precision', () => {
    const events = [
      validatePersonalActivity({ id: 'date', title: 'Avtale', dateLocal: '2026-10-04' }),
      validatePersonalActivity({ id: 'interval', title: 'Tannlege', dateLocal: '2026-10-04', startLocal: '12:00', endLocal: '13:00' }),
    ]
    const state = { tasks: [], sessions: [], planner: { ...base, events } }
    expect(calendarExportItems(state, { from: '2026-10-04', to: '2026-10-04' })).toEqual([])
    const source = generateCalendarIcs(state, { from: '2026-10-04', to: '2026-10-04', includeSessions: false, includeDeadlines: false, includePersonal: true })
    expect(source).toContain('SUMMARY:Egen aktivitet: Avtale')
    expect(source).toContain('DTSTART;VALUE=DATE:20261004')
    expect(source).toContain('DTEND:20261004T110000Z')
    expect(calendarExportItems(state, { from: '2026-10-04', to: '2026-10-04', includeTeaching: true, includePersonal: true })).toHaveLength(2)
    expect(isExamEvent({ ...events[1], title: 'Eksamen middag' })).toBe(false)
  })

  it('roundtrips backup/history and remains isolated from source refresh', () => {
    const activity = validatePersonalActivity({ id: 'local-activity', title: 'Tannlege', dateLocal: '2026-10-04', startLocal: '12:00', endLocal: '13:00' })
    const before = { schemaVersion: 1, tasks: [], planner: { ...base, events: [] } }
    const after = { ...before, planner: { ...base, events: [activity] } }
    const restored = previewBackup(JSON.stringify(exportBackup(after, new Date('2026-09-29T10:00:00Z'))), before)
    expect(restored.ok).toBe(true)
    expect(restored.data.planner.events).toEqual([activity])
    expect(undoLast(after, recordChange(before, after)).state).toEqual(before)

    const source = { id: 'remote-source', courseId: 'remote-course', kind: 'file', name: 'Syntetisk kalender', lastUpdated: '2026-09-29T10:00:00Z', groups: [], identityMode: 'uid' }
    const planner = { courses: [], events: [activity], sources: [source] }
    expect(mergeImport(planner, [], source, { authoritative: true }).planner.events).toEqual([activity])
  })
})
