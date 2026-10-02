import { describe, expect, it } from 'vitest'
import { parseOsloDeadline, parseRemainingMinutes, parseTextRegistration } from '../../src/text-registration.js'

const now = new Date('2026-09-29T10:00:00Z')
const tasks = [{ id: 't1', title: 'Les kapittel 4', course: 'IBE160', deadlineLocal: '2026-10-01', remainingMinutes: 60, estimatedMinutes: null, completed: false }]
const courses = [{ id: 'c1', code: 'IBE160', name: 'Digitalisering' }]

describe('local rule-based text registration', () => {
  it('parses Oslo-local dates without fabricating a time', () => {
    expect(parseOsloDeadline('i morgen', now)).toEqual({ ok: true, deadlineLocal: '2026-09-30' })
    expect(parseOsloDeadline('30.09.2026 kl. 14:05', now)).toEqual({ ok: true, deadlineLocal: '2026-09-30T14:05' })
    expect(parseOsloDeadline('fredag kl. 14.', now)).toEqual({ ok: true, deadlineLocal: '2026-10-02T14:00' })
    expect(parseOsloDeadline('12. oktober.', now)).toEqual({ ok: true, deadlineLocal: '2026-10-12' })
    expect(parseOsloDeadline('2. januar', new Date('2026-12-30T12:00:00Z'))).toMatchObject({ ok: false, needsYearChoice: true, yearChoices: [2026, 2027] })
    expect(parseOsloDeadline('31. februar', now).ok).toBe(false)
    expect(parseTextRegistration('Lever rapport innen i morgen', { tasks, courses, now }).proposal.referenceTime).toBe(now.toISOString())
  })

  it('accepts safe bare tasks and innen without inventing optional values', () => {
    expect(parseTextRegistration('Øve på koding', { tasks, courses, now })).toMatchObject({ ok: true, proposal: { action: 'create', title: 'Øve på koding', courseId: '', deadlineLocal: '', remainingMinutes: null } })
    expect(parseTextRegistration('Lever fysikkoppgave innen 4.10', { tasks, courses, now })).toMatchObject({ ok: true, proposal: { title: 'Lever fysikkoppgave', deadlineLocal: '2026-10-04' } })
    expect(parseTextRegistration('Skal jeg øve?', { tasks, courses, now }).ok).toBe(false)
    expect(parseTextRegistration('Flytt fysikkoppgaven', { tasks, courses, now }).ok).toBe(false)
    for (const unsafe of ['Flytte fysikkoppgaven', 'Slette fysikkoppgaven', 'Fjerne fysikkoppgaven', 'Avlyse fysikkoppgaven', 'Utsette fysikkoppgaven', 'Jeg vil flytte fysikkoppgaven', 'Jeg lurer på om jeg skal øve']) expect(parseTextRegistration(unsafe, { tasks, courses, now }).ok).toBe(false)
    expect(parseTextRegistration('Plan for flytting', { tasks, courses, now })).toMatchObject({ ok: true, proposal: { action: 'create', title: 'Plan for flytting' } })
  })

  it('keeps no-course and unknown-work semantics explicit', () => {
    expect(parseTextRegistration('Lag oppgave Les pensum i uten emne arbeid vet ikke', { tasks, courses, now })).toMatchObject({ ok: true, proposal: { title: 'Les pensum', course: '', remainingMinutes: null } })
    expect(parseRemainingMinutes('mye')).toEqual({ ok: true, minutes: null, unknown: true })
  })

  it('parses personal activities without fabricating duration', () => {
    expect(parseTextRegistration('Tannlege 4.10 kl. 12–13', { tasks, courses, now })).toMatchObject({ ok: true, proposal: { action: 'activity', title: 'Tannlege', dateLocal: '2026-10-04', startLocal: '12:00', endLocal: '13:00' } })
    expect(parseTextRegistration('Egen aktivitet: Ring banken 4.10', { tasks, courses, now })).toMatchObject({ ok: true, proposal: { action: 'activity', dateLocal: '2026-10-04', startLocal: '', endLocal: '' } })
  })

  it.each([['30 min', 30], ['90 minutter', 90], ['to timer', 120], ['1,5 timer', 90]])('parses bounded work units %s', (input, minutes) => {
    const result = parseRemainingMinutes(input)
    if (minutes === undefined) expect(result.ok).toBe(false)
    else expect(result).toEqual({ ok: true, minutes })
  })

  it('creates an editable proposal with exact course resolution', () => {
    expect(parseTextRegistration('Lag oppgave Skriv rapport i IBE160 frist i morgen arbeid 1,5 timer', { tasks, courses, now }).proposal).toMatchObject({ action: 'create', title: 'Skriv rapport', courseId: 'c1', deadlineLocal: '2026-09-30', remainingMinutes: 90 })
  })

  it('supports the exact ordered examples and does not consume title numbers', () => {
    expect(parseTextRegistration('Legg til rapport i IBE160 med frist fredag kl. 14.', { tasks, courses, now }).proposal).toMatchObject({ action: 'create', title: 'rapport', courseId: 'c1', deadlineLocal: '2026-10-02T14:00' })
    expect(parseTextRegistration('Ny oppgave: Les kapittel 3.', { tasks, courses, now }).proposal).toMatchObject({ action: 'create', title: 'Les kapittel 3', deadlineLocal: '', remainingMinutes: null })
    const report = [{ ...tasks[0], id: 'report', title: 'rapport' }]
    expect(parseTextRegistration('Endre fristen på rapporten til 12. oktober.', { tasks: report, courses, now }).proposal).toMatchObject({ action: 'deadline', taskId: 'report', deadlineLocal: '2026-10-12' })
    expect(parseTextRegistration('Sett gjenstående arbeid på rapporten til to timer.', { tasks: report, courses, now }).proposal).toMatchObject({ action: 'remaining', taskId: 'report', remainingMinutes: 120 })
  })

  it('uses only a narrow definite-form alias after exact matching', () => {
    expect(parseTextRegistration('Endre fristen på rapporten til i morgen', { tasks: [{ ...tasks[0], title: 'rapport' }], courses, now }).proposal.taskId).toBe('t1')
    const ambiguous = parseTextRegistration('Endre fristen på rapporten til i morgen', { tasks: [{ ...tasks[0], id: 'a', title: 'rapport' }, { ...tasks[0], id: 'b', title: 'rapport' }], courses, now })
    expect(ambiguous.ok).toBe(false); expect(ambiguous.proposal.taskChoices).toHaveLength(2)
    expect(parseTextRegistration('Endre fristen på raporten til i morgen', { tasks: [{ ...tasks[0], title: 'rapport' }], courses, now }).ok).toBe(false)
  })

  it('supports aliases for create, deadline and remaining work', () => {
    expect(parseTextRegistration('Opprett Notat leveres i morgen', { tasks, courses, now }).proposal).toMatchObject({ title: 'Notat', deadlineLocal: '2026-09-30' })
    expect(parseTextRegistration('Legg til oppgave Notat gjenstår 30 min', { tasks, courses, now }).proposal).toMatchObject({ title: 'Notat', remainingMinutes: 30 })
    expect(parseTextRegistration('Sett gjenstår på Les kapittel 4 til 30 min', { tasks, courses, now }).proposal).toMatchObject({ remainingMinutes: 30 })
  })

  it('carries old values for stale-safe changes', () => {
    expect(parseTextRegistration('Endre fristen for Les kapittel 4 til 02.10.2026', { tasks, courses, now }).proposal).toMatchObject({ action: 'deadline', taskId: 't1', oldValue: '2026-10-01', deadlineLocal: '2026-10-02' })
    expect(parseTextRegistration('Sett gjenstående arbeid for Les kapittel 4 til 2 timer', { tasks, courses, now }).proposal).toMatchObject({ action: 'remaining', oldValue: 60, remainingMinutes: 120 })
  })

  it('rejects ambiguity and multiple actions without partial execution', () => {
    const ambiguous = parseTextRegistration('Endre fristen for Les kapittel 4 til i morgen', { tasks: [...tasks, { ...tasks[0], id: 't2', course: 'MAT100' }], courses, now })
    expect(ambiguous.ok).toBe(false); expect(ambiguous.proposal.taskChoices).toHaveLength(2)
    const multiple = parseTextRegistration('Legg til A og sett gjenstående arbeid på B til 30 min', { tasks, courses, now })
    expect(multiple.ok).toBe(false); expect(multiple.proposal).toBeNull(); expect(multiple.errors[0]).toContain('én handling')
  })

  it('preserves understood fields for focused correction', () => {
    const unknown = parseTextRegistration('Legg til rapport i IBE999 med frist i morgen arbeid 90 min', { tasks, courses, now })
    expect(unknown.ok).toBe(false)
    expect(unknown.proposal).toMatchObject({ title: 'rapport', course: 'IBE999', deadlineLocal: '2026-09-30', remainingMinutes: 90 })
    const invalid = parseTextRegistration('Legg til rapport i IBE160 med frist 31. februar arbeid 90 min', { tasks, courses, now })
    expect(invalid.ok).toBe(false)
    expect(invalid.proposal).toMatchObject({ title: 'rapport', courseId: 'c1', deadlineInput: '31. februar', remainingMinutes: 90 })
  })
})
