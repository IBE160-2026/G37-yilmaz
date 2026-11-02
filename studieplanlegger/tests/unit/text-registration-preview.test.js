import { describe, expect, it, vi } from 'vitest'
import { parseOsloDeadline, parseTextRegistration } from '../../src/text-registration.js'
import { editTextRegistrationProposal, textRegistrationDeadlineSummary } from '../../src/text-registration-view.js'

// Synthetic task text; no student data or historical F03 fixture is used here.
const now = new Date('2026-11-02T10:00:00Z')
const proposal = text => parseTextRegistration(text, { now }).proposal
const edited = (current, values = {}) => editTextRegistrationProposal(current, {
  deadlineInput: current.deadlineLocal || current.deadlineInput || '', ...values,
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
    } finally { vi.useRealTimers() }
  })
})
