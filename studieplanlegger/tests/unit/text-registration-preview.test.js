import { describe, expect, it, vi } from 'vitest'
import { parseOsloDeadline, parseTextRegistration, validateTextRegistrationProposal } from '../../src/text-registration.js'
import { editTextRegistrationProposal, textRegistrationDeadlineSummary, textRegistrationSummary } from '../../src/text-registration-view.js'

// Synthetic task text; no student data or historical F03 fixture is used here.
const now = new Date('2026-11-02T10:00:00Z')
const proposal = text => parseTextRegistration(text, { now }).proposal
const edited = (current, values = {}) => editTextRegistrationProposal(current, {
  deadlineInput: current.deadlineLocal || current.deadlineInput || '', ...values,
})

describe('edited registration summaries and saved values', () => {
  const courses = [{ id: 'synthetic-course', code: 'IBE160', name: 'Syntetisk emne' }]

  it('normalizes the edited task title, work, deadline and exact course without mutating the proposal', () => {
    const current = proposal('Syntetisk oppgave arbeid 30 min'), before = structuredClone(current)
    const pending = edited(current, { title: '  Ny syntetisk oppgave  ', course: ' syntetisk emne ', remainingInput: '1,5 timer', deadlineInput: '2026-11-06T09:30' })
    expect(textRegistrationSummary(pending, courses)).toMatchObject({ title: 'Ny syntetisk oppgave', course: 'IBE160', remaining: '90 min', deadline: '6. november 2026 kl. 09:30' })
    expect(validateTextRegistrationProposal(pending, { courses, id: 'synthetic-task' })).toMatchObject({ ok: true, task: { id: 'synthetic-task', title: 'Ny syntetisk oppgave', course: 'IBE160', courseId: 'synthetic-course', remainingMinutes: 90, deadlineLocal: '2026-11-06T09:30' } })
    expect(current).toEqual(before)
  })

  it('normalizes the edited activity title, date and interval together', () => {
    const current = proposal('Tannlege 5.11.2026 kl. 09:00–09:30'), before = structuredClone(current)
    const pending = editTextRegistrationProposal(current, { title: '  Lege  ', dateInput: '6.11.2026', startLocal: '10:15', endLocal: '11:00' })
    expect(textRegistrationSummary(pending)).toMatchObject({ title: 'Lege', date: '6. november 2026', time: '10:15–11:00', course: 'Uten emne' })
    expect(validateTextRegistrationProposal(pending, { id: 'synthetic-activity' })).toMatchObject({ ok: true, activity: { id: 'synthetic-activity', title: 'Lege', dateLocal: '2026-11-06', start: '2026-11-06T09:15:00Z', end: '2026-11-06T10:00:00Z' } })
    expect(current).toEqual(before)
  })

  it('keeps the valid activity interval visible when its title is cleared without allowing it to be saved', () => {
    const pending = editTextRegistrationProposal(proposal('Tannlege 5.11.2026 kl. 09:00–09:30'), { title: '' })
    expect(textRegistrationSummary(pending)).toMatchObject({ date: '5. november 2026', time: '09:00–09:30' })
    expect(textRegistrationSummary(pending).title).toContain('må avklares')
    expect(validateTextRegistrationProposal(pending)).toMatchObject({ ok: false, activity: undefined })
    const invalidTime = { ...pending, endLocal: '08:30' }
    expect(textRegistrationSummary(invalidTime).time).toContain('må avklares')
    expect(validateTextRegistrationProposal(invalidTime)).toMatchObject({ ok: false, activity: undefined })
  })

  it('keeps cleared optional values unknown and start-only duration unspecified', () => {
    const task = edited(proposal('Syntetisk oppgave frist 6.11.2026 arbeid 30 min'), { deadlineInput: '', remainingInput: '', course: 'uten emne' })
    expect(textRegistrationSummary(task)).toMatchObject({ deadline: 'ikke oppgitt', remaining: 'ikke oppgitt', course: 'Uten emne' })
    expect(validateTextRegistrationProposal(task).task).not.toHaveProperty('remainingMinutes')
    const activity = editTextRegistrationProposal(proposal('Tannlege 5.11.2026 kl. 09:00–09:30'), { startLocal: '', endLocal: '' })
    expect(textRegistrationSummary(activity).time).toBe('ikke oppgitt')
    expect(validateTextRegistrationProposal(activity).activity).not.toHaveProperty('start')
    expect(validateTextRegistrationProposal(activity).activity).not.toHaveProperty('end')
    expect(textRegistrationSummary({ ...activity, startLocal: '09:00' }).time).toBe('09:00 · Varighet ikke oppgitt')
  })

  it.each([
    [{ title: '  ' }, 'title'], [{ remainingInput: '-30 min' }, 'remaining'],
    [{ deadlineInput: '2026-11-31' }, 'deadline'], [{ course: 'ukjent emne' }, 'course'],
  ])('marks invalid task edits unresolved: %j', (values, summaryField) => {
    const pending = edited(proposal('Syntetisk oppgave frist 6.11.2026 arbeid 30 min'), values)
    expect(textRegistrationSummary(pending, courses)[summaryField]).toContain('må avklares')
    expect(validateTextRegistrationProposal(pending, { courses }).ok).toBe(false)
  })

  it('keeps valid edited fields visible while an exact course match is ambiguous', () => {
    const pending = edited(proposal('Syntetisk oppgave arbeid 30 min'), { title: 'Ny tittel', course: 'IBE160', deadlineInput: '2026-11-06', remainingInput: '90 min' })
    const choices = [...courses, { ...courses[0], id: 'synthetic-duplicate' }]
    expect(textRegistrationSummary(pending, choices)).toMatchObject({ title: 'Ny tittel', deadline: '6. november 2026', remaining: '90 min' })
    expect(textRegistrationSummary(pending, choices).course).toContain('må avklares')
    expect(validateTextRegistrationProposal(pending, { courses: choices }).ok).toBe(false)
  })

  it.each([
    [{ title: '  ' }, 'title'], [{ dateInput: '2026-11-31' }, 'date'],
    [{ startLocal: '25:00' }, 'time'], [{ startLocal: '', endLocal: '09:30' }, 'time'],
    [{ endLocal: '08:30' }, 'time'], [{ endLocal: '09:00' }, 'time'],
    [{ dateInput: '2027-03-28', startLocal: '02:15', endLocal: '03:30' }, 'time'],
    [{ dateInput: '2027-10-31', startLocal: '02:15', endLocal: '03:30' }, 'time'],
  ])('marks invalid activity edits unresolved: %j', (values, summaryField) => {
    const pending = editTextRegistrationProposal(proposal('Tannlege 5.11.2026 kl. 09:00–09:30'), values)
    expect(textRegistrationSummary(pending)[summaryField]).toContain('må avklares')
    expect(validateTextRegistrationProposal(pending).ok).toBe(false)
  })

  it.each(['create', 'activity'])('uses the edited ambiguous date with its selected year and type: %s', actionChoice => {
    const current = proposal('Syntetisk avtale 4.10')
    const pending = editTextRegistrationProposal(current, { title: 'Endret syntetisk avtale', dateInput: '12. mai', yearChoice: '2027', actionChoice })
    const summary = textRegistrationSummary(pending)
    expect(summary.title).toBe('Endret syntetisk avtale')
    expect(summary[actionChoice === 'create' ? 'deadline' : 'date']).toBe('12. mai 2027')
    const checked = validateTextRegistrationProposal(pending)
    expect(checked.ok).toBe(true)
    expect(actionChoice === 'create' ? checked.task.deadlineLocal : checked.activity.dateLocal).toBe('2027-05-12')
  })
})

describe('new-task confirmation deadline', () => {
  it.each([
    ['Les kapittel 4', 'ikke oppgitt', ''],
    ['Innlevering syntetisk test frist 2026-11-06', '6. november 2026', '2026-11-06'],
    ['Innlevering syntetisk test frist 2026-11-06 kl. 14:00', '6. november 2026 kl. 14:00', '2026-11-06T14:00'],
  ])('preserves deadline precision for %s', (text, expected, deadlineLocal) => {
    const current = proposal(text), before = structuredClone(current), pending = edited(current)
    expect(textRegistrationDeadlineSummary(pending)).toBe(expected)
    expect(pending.deadlineInput ? parseOsloDeadline(pending.deadlineInput, now).deadlineLocal : '').toBe(deadlineLocal)
    expect(current).toEqual(before)
  })

  it('reflects changing the clock, removing it, and clearing the entire deadline', () => {
    const current = proposal('Syntetisk rapport frist 2026-11-06 kl. 14:00')
    for (const [deadlineInput, expected, stored] of [
      ['2026-11-07T09:45', '7. november 2026 kl. 09:45', '2026-11-07T09:45'],
      ['2026-11-07', '7. november 2026', '2026-11-07'],
      ['', 'ikke oppgitt', ''],
    ]) {
      const pending = edited(current, { deadlineInput })
      expect(textRegistrationDeadlineSummary(pending)).toBe(expected)
      expect(pending.deadlineInput ? parseOsloDeadline(pending.deadlineInput, now).deadlineLocal : '').toBe(stored)
    }
  })

  it('shows invalid edits as unresolved instead of the previous valid deadline', () => {
    const current = proposal('Syntetisk rapport frist 2026-11-06 kl. 14:00')
    for (const deadlineInput of ['2026-11-31', '2026-11-06T25:00', '2027-03-28T02:30']) {
      const pending = edited(current, { deadlineInput })
      expect(parseOsloDeadline(pending.deadlineInput, now).ok).toBe(false)
      expect(textRegistrationDeadlineSummary(pending)).toContain('må avklares')
      expect(textRegistrationDeadlineSummary(pending)).not.toContain('6. november')
    }
  })

  it.each([
    ['12. mai kl. 14', '12. mai 2027 kl. 14:00', '2027-05-12T14:00'],
    ['12.5 kl. 14:30', '12. mai 2027 kl. 14:30', '2027-05-12T14:30'],
    ['12.5', '12. mai 2027', '2027-05-12'],
  ])('shows the selected year without changing precision for %s', (date, expected, deadlineLocal) => {
    const current = proposal(`Syntetisk vårarbeid frist ${date}`)
    expect(textRegistrationDeadlineSummary(edited(current))).toContain('må avklares')
    const pending = edited(current, { yearChoice: '2027' })
    expect(textRegistrationDeadlineSummary(pending)).toBe(expected)
    expect(parseOsloDeadline(pending.deadlineInput, now).deadlineLocal).toBe(deadlineLocal)
  })

  it('keeps an explicitly cleared deadline empty even after choosing a year', () => {
    const current = proposal('Syntetisk vårarbeid frist 12. mai kl. 14')
    const pending = edited(current, { yearChoice: '2027', deadlineInput: '' })
    expect(pending.deadlineInput).toBe('')
    expect(textRegistrationDeadlineSummary(pending)).toBe('ikke oppgitt')
  })

  it.each([
    ['2027-05-12', '12. mai 2027', '2027-05-12'],
    ['2027-05-12T14:00', '12. mai 2027 kl. 14:00', '2027-05-12T14:00'],
    ['12.05.2028 kl. 09:45', '12. mai 2028 kl. 09:45', '2028-05-12T09:45'],
    ['12. mai 2028 kl. 09:45', '12. mai 2028 kl. 09:45', '2028-05-12T09:45'],
    ['i morgen kl. 09', '3. november 2026 kl. 09:00', '2026-11-03T09:00'],
  ])('preserves corrected date %s despite an earlier year choice', (deadlineInput, expected, deadlineLocal) => {
    const current = proposal('Syntetisk vårarbeid frist 12. mai kl. 14')
    const pending = edited(current, { yearChoice: '2027', deadlineInput })
    expect(pending.deadlineInput).toBe(deadlineInput)
    expect(textRegistrationDeadlineSummary(pending)).toBe(expected)
    expect(parseOsloDeadline(pending.deadlineInput, now).deadlineLocal).toBe(deadlineLocal)
  })

  it('uses the same frozen reference as confirmation after a relative-date edit', () => {
    const current = proposal('Syntetisk rapport frist 2026-11-06 kl. 14:00')
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2028-01-15T10:00:00Z'))
      const pending = edited(current, { deadlineInput: 'i morgen kl. 09' })
      expect(textRegistrationDeadlineSummary(pending)).toBe('3. november 2026 kl. 09:00')
      expect(parseOsloDeadline(pending.deadlineInput, new Date(pending.referenceTime)).deadlineLocal).toBe('2026-11-03T09:00')
      expect(textRegistrationSummary(pending).deadline).toBe('3. november 2026 kl. 09:00')
      expect(validateTextRegistrationProposal(pending).task.deadlineLocal).toBe('2026-11-03T09:00')
    } finally { vi.useRealTimers() }
  })
})
