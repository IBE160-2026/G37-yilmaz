import { describe, expect, it } from 'vitest'
import { rankedSuggestions, suggestionExclusions } from '../../src/daily-guidance.js'
import { getActionMinutes, getSessionMinutes, suggestionReason } from '../../src/tasks.js'

// Synthetic SC-07 report: remaining work is set independently of the original estimate.
const task = (patch = {}) => ({ id: 'synthetic-sc07', title: 'Syntetisk stor oppgave', course: '', deadlineLocal: '2026-11-15T20:00', estimatedMinutes: null, remainingMinutes: 1200, completed: false, requiresSubmission: true, submitted: false, splittable: true, ...patch })

describe('SC-07: total remaining work and a short session', () => {
  it.each(['2026-11-15T20:00', ''])('offers 30 minutes without steps, with deadline %j, without mutating the task', deadlineLocal => {
    const original = Object.freeze(task({ deadlineLocal }))
    const tasks = Object.freeze([original])
    expect(rankedSuggestions(tasks, 30)).toEqual([original])
    expect(getActionMinutes(original)).toBe(1200)
    expect(getSessionMinutes(original, 30)).toBe(30)
    expect(suggestionReason(original, 30)).toContain('deløkt på 30 min av 20 timer')
    expect(original).toEqual(task({ deadlineLocal }))
    expect(original).not.toHaveProperty('steps')
  })

  it.each([undefined, true])('supports the existing default split setting %j', splittable => {
    const original = task({ splittable })
    expect(rankedSuggestions([original], 30)).toEqual([original])
  })

  it('preserves waiting and unfinished or missing prerequisites', () => {
    const prerequisite = task({ id: 'synthetic-prerequisite', splittable: false })
    const waiting = task({ waitingReason: 'Syntetisk tilbakemelding' })
    const blocked = task({ dependencyIds: [prerequisite.id] })
    expect(rankedSuggestions([waiting], 30)).toEqual([])
    expect(rankedSuggestions([prerequisite, blocked], 30)).toEqual([])
    expect(rankedSuggestions([blocked], 30)).toEqual([])
    expect(rankedSuggestions([{ ...prerequisite, completed: true }, blocked], 30)).toEqual([blocked])
  })

  it('requires the full duration for indivisible work', () => {
    const original = task({ splittable: false })
    expect(rankedSuggestions([original], 30)).toEqual([])
    expect(rankedSuggestions([original], 1200)).toEqual([original])
    expect(suggestionExclusions([original], 30)[0].reason).toContain('1200 minutter sammenhengende')
    expect(suggestionExclusions([original], 1200)).toEqual([])
  })

  it.each([{ remainingMinutes: null }, { remainingMinutes: 0 }, { completed: true }, { completed: true, submitted: true }])('does not invent work or duration for %j', patch => {
    expect(rankedSuggestions([task(patch)], 30)).toEqual([])
  })

  it('keeps the explicit unblocking-step exception, without bypassing prerequisites', () => {
    const original = task({ waitingReason: 'Syntetisk svar', steps: [{ id: 'synthetic-step', title: 'Be om avklaring', estimatedMinutes: 15, completed: false, unblocksWaiting: true }] })
    expect(rankedSuggestions([original], 30)).toEqual([original])
    expect(rankedSuggestions([{ ...original, dependencyIds: ['missing'] }], 30)).toEqual([])
    expect(suggestionExclusions([original], 30)).toEqual([])
    const excluded = suggestionExclusions([{ ...original, dependencyIds: ['missing'] }], 30)
    expect(excluded[0].reason).toContain('slettet eller mangler')
    expect(excluded[0].reason).not.toContain('Venter på: Syntetisk svar')
  })

  it('explains the actual exclusions individually without inventing a capacity problem', () => {
    const tasks = [task({ id: 'wait', waitingReason: 'Syntetisk svar' }), task({ id: 'prereq', dependencyIds: ['wait'] }), task({ id: 'unknown', remainingMinutes: null }), task({ id: 'zero', remainingMinutes: 0 })]
    const before = structuredClone(tasks)
    const reasons = suggestionExclusions(tasks, 30)
    expect(reasons.map(item => item.reason)).toEqual([
      expect.stringContaining('Venter på: Syntetisk svar'),
      expect.stringContaining('Venter på «Syntetisk stor oppgave»'),
      expect.stringContaining('Tiden for arbeidet er ukjent'),
      expect.stringContaining('Gjenstående arbeid er satt til 0'),
    ])
    expect(tasks).toEqual(before)
    expect(suggestionExclusions([task()], 30)).toEqual([])
  })

  it('caps a partial session at the remaining total when an older step estimate is larger', () => {
    const original = task({ remainingMinutes: 15, steps: [{ id: 'synthetic-old-step', title: 'Syntetisk steg', estimatedMinutes: 1200, completed: false }] })
    expect(rankedSuggestions([original], 30)).toEqual([original])
    expect(getSessionMinutes(original, 30)).toBe(15)
    expect(suggestionReason(original, 30)).toContain('15 min som deløkt')
    expect(original.remainingMinutes).toBe(15)
    expect(original.steps[0].estimatedMinutes).toBe(1200)
  })

  it('never shortens an indivisible step when its older estimate exceeds the remaining total', () => {
    const original = task({ splittable: false, remainingMinutes: 15, steps: [{ id: 'synthetic-indivisible-step', title: 'Syntetisk sammenhengende steg', estimatedMinutes: 60, completed: false }] })
    expect(rankedSuggestions([original], 30)).toEqual([])
    expect(getSessionMinutes(original, 30)).toBeNull()
    expect(rankedSuggestions([original], 60)).toEqual([original])
    expect(getSessionMinutes(original, 60)).toBe(60)
    expect(suggestionReason(original, 60)).not.toContain('deløkt')
  })
})
