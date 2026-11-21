import { describe, expect, it } from 'vitest'
import { dailyStatus, rankedSuggestions, suggestionExclusions } from '../../src/daily-guidance.js'
import { capacityNotice } from '../../src/capacity-notice.js'
import { deriveCapacity } from '../../src/capacity.js'
import { toInstant } from '../../src/planner.js'
import { applyComparedPlan, comparePlans } from '../../src/plan-comparison.js'
import { applyReplan, createReplan } from '../../src/replanning.js'
import { availabilityFor } from '../../src/study-time.js'
import { getSessionMinutes, selectTasksForMinutes, suggestionReason } from '../../src/tasks.js'
import { deriveWorkCapacity, extendedSessionInterval } from '../../src/work-capacity.js'

const now = new Date('2026-11-19T07:00:00Z')
const date = '2026-11-20'
const time = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const instant = minutes => toInstant(`${date}T${time(minutes)}`)
const window = (start, end) => ({ id: `window-${start}-${end}`, start: instant(start), end: instant(end) })
const task = (id, options = {}) => ({ id, title: id, course: '', deadlineLocal: '', estimatedMinutes: null, remainingMinutes: 30, completed: false, ...options })
const session = (id, taskId, start, end, locked = true) => ({ id, taskId, dateLocal: date, startTime: time(start), endTime: time(end), locked })
const state = (tasks, sessions, workWindows, planningPreferences) => ({ schemaVersion: 1, tasks, sessions, workWindows, planningPreferences })
const open = { remainingMinutes: null, remainingEstimate: { minMinutes: 241, maxMinutes: null } }
const lengthRules = { sessionMinutes: 30, minimumMinutes: 15, maximumMinutes: 500, breakMinutes: 10 }

describe('delivery plan regressions', () => {
  it('P02 keeps the scoped reservation and keeps or moves it after its locked prerequisite in a full plan', () => {
    const prerequisite = task('A'), dependent = task('B', { dependencyIds: ['A'] })
    const sessions = [session('A-lock', 'A', 540, 570), session('B-reserved', 'B', 600, 630, false)]
    const before = state([dependent, prerequisite], sessions, [window(540, 720)])
    expect(createReplan(before, { now, taskIds: ['B'] })).toMatchObject({ removedIds: [], changes: [], blockedTasks: [{ taskId: 'B' }] })
    const comparison = comparePlans(before, { now })
    for (const scenario of comparison.scenarios) {
      const result = applyComparedPlan(before, comparison, scenario.id, { now })
      expect(result.ok).toBe(true)
      const next = result.state.sessions.find(item => item.id === 'B-reserved')
      expect(next.taskId).toBe('B')
      expect(extendedSessionInterval(next).start).toBeGreaterThanOrEqual(Date.parse(instant(580)))
      expect(result.undo).toEqual(before)
    }
  })

  const workPatterns = [
    ['ni halve timer', Array.from({ length: 9 }, (_, index) => [540 + 45 * index, 570 + 45 * index])],
    ['120 og 121 min', [[540, 660], [675, 796]]],
    ['én kort økt', [[540, 570]]],
  ]
  it.each(workPatterns)('P03 krever én sammenhengende økt, med %s', (_, parts) => {
    const actual = task('indivisible', { ...open, splittable: false })
    const reservations = parts.map(([start, end], index) => session(`lock-${index}`, actual.id, start, end))
    const before = state([actual], reservations, [window(540, 960)], lengthRules)
    expect(deriveWorkCapacity(before.tasks, reservations, now, [], before.workWindows, [], lengthRules).tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinMinutes: 241, missingMaxMinutes: null })
    const comparison = comparePlans(before, { now })
    for (const scenario of comparison.scenarios) expect(scenario).toMatchObject({ allocatedMinutes: 0, missingMinMinutes: 241, missingMaxMinutes: null })
    expect(applyComparedPlan(before, comparison, 'current', { now }).state.sessions).toEqual(reservations)
  })

  it('P04 credits a valid locked half hour even when reduced capacity cuts into its interval', () => {
    const before = state([task('locked')], [session('confirmed', 'locked', 540, 570)], [window(540, 570)])
    for (const card of comparePlans(before, { now }).scenarios) {
      expect(card).toMatchObject({ allocatedMinutes: 30, retainedMinutes: 30, newOrMovableMinutes: 0, missingMaxMinutes: 0, movedSessions: 0 })
    }
  })

  it('P04 shows a preserved half hour for an open task with zero remaining work on every card', () => {
    const reservations = [session('zero-lock', 'zero', 540, 570)]
    const before = state([task('zero', { remainingMinutes: 0 })], reservations, [window(540, 600)])
    const comparison = comparePlans(before, { now })
    for (const card of comparison.scenarios) {
      expect(card).toMatchObject({ calendarRetainedMinutes: 30, retainedMinutes: 0, allocatedMinutes: 0, missingMaxMinutes: 0 })
      expect(applyComparedPlan(before, comparison, card.id, { now }).state.sessions).toEqual(reservations)
    }
  })

  it('credits 09:00–09:30 of a 09:00–10:00 lock towards the 09:30 deadline before and after approval', () => {
    const reservations = [session('deadline-lock', 'deadline', 540, 600)]
    const before = state([task('deadline', { deadlineLocal: `${date}T09:30` }), task('other')], reservations, [window(540, 720)], lengthRules)
    const draft = createReplan(before, { now })
    expect(draft.retainedMinutes.deadline).toBe(30)
    expect(draft.deficitRanges.deadline).toBeUndefined()
    expect(draft.problems.join(' ')).toContain('slutter etter oppgavens frist')
    expect(draft.proposed.map(item => item.taskId)).toEqual(['other'])
    const next = applyReplan(before, draft, { now }).state
    expect(next.sessions).toContainEqual(reservations[0])
    expect(deriveWorkCapacity(next.tasks, next.sessions, now, [], next.workWindows, [], lengthRules).tasks[0])
      .toMatchObject({ calendarReservedMinutes: 60, coveredByReservationsMinutes: 30, missingMaxMinutes: 0 })
    expect(comparePlans(next, { now }).scenarios[0]).toMatchObject({ calendarRetainedMinutes: 90, allocatedMinutes: 60, missingMaxMinutes: 0 })
  })

  it.each([
    [555, 'overlapper en annen reservasjon', 45],
    [570, 'mangler valgt pause', 60],
  ])('keeps both locks with a second start at %i, without credit before or after approval', (start, warning, reserved) => {
    const reservations = [session('first-lock', 'first', 540, 570), session('second-lock', 'second', start, start + 30)]
    const before = state([
      task('first', { deadlineLocal: `${date}T10:00` }),
      task('second', { deadlineLocal: `${date}T10:00` }),
      task('other'),
    ], reservations, [window(540, 720)], lengthRules)
    const comparison = comparePlans(before, { now })
    expect(comparison.scenarios[0]).toMatchObject({ calendarRetainedMinutes: reserved, retainedMinutes: 0, missingMaxMinutes: 90 })
    const prioritized = comparison.scenarios.find(card => card.id === 'priority')
    expect(prioritized).toMatchObject({ calendarRetainedMinutes: reserved, retainedMinutes: 0, missingMaxMinutes: 60 })
    expect(prioritized.preview.problems.join(' ')).toContain(warning)
    const result = applyComparedPlan(before, comparison, 'priority', { now })
    expect(result.state.sessions.filter(item => item.locked)).toEqual(reservations)
    expect(result.undo).toEqual(before)
    const capacity = deriveWorkCapacity(result.state.tasks, result.state.sessions, now, [], before.workWindows, [], lengthRules)
    expect(capacity.totalMissingMaxMinutes).toBe(60)
    expect(capacity.tasks.slice(0, 2).map(entry => entry.coveredByReservationsMinutes)).toEqual([0, 0])
  })

  it('P05 reports insufficient pause on every card while keeping both locks', () => {
    const sessions = [session('first-lock', 'first', 540, 570), session('second-lock', 'second', 570, 600)]
    const before = state([task('first'), task('second')], sessions, [window(540, 660)], lengthRules)
    const comparison = comparePlans(before, { now })
    for (const scenario of comparison.scenarios) expect(scenario.pauseWarnings.join(' ')).toMatch(/pausekonflikt|mangler valgt pause/i)
    expect(applyComparedPlan(before, comparison, 'current', { now }).state.sessions).toEqual(sessions)
    const waiting = { ...before, tasks: before.tasks.map(task => ({ ...task, waitingReason: 'Venter på veileder' })) }
    for (const scenario of comparePlans(waiting, { now }).scenarios) expect(scenario.pauseWarnings).not.toHaveLength(0)
  })

  it('preserves the pause requirement when the first locked reservation has just ended', () => {
    const currentTime = new Date(instant(540))
    const sessions = [session('ended-lock', 'first', 510, 540), session('next-lock', 'second', 545, 575)]
    const before = state([task('first', { remainingMinutes: 0 }), task('second')], sessions, [window(545, 575)], lengthRules)
    for (const card of comparePlans(before, { now: currentTime }).scenarios) {
      expect(card).toMatchObject({ calendarRetainedMinutes: 30, retainedMinutes: 0, missingMaxMinutes: 30 })
      expect(card.pauseWarnings).not.toHaveLength(0)
    }
    expect(deriveWorkCapacity(before.tasks, sessions, currentTime, [], before.workWindows, [], lengthRules).totalMissingMaxMinutes).toBe(30)
  })

  it('P06 only warns about the deadline when the uncovered task has one', () => {
    for (const deadlineLocal of ['', `${date}T09:00`]) {
      const before = state([task('known', { deadlineLocal })], [], [window(540, 550)])
      for (const scenario of comparePlans(before, { now }).scenarios) {
        expect(scenario).toMatchObject({ deadlineRisk: Boolean(deadlineLocal), missingMinMinutes: 30, missingMaxMinutes: 30, omittedTasks: 1 })
      }
    }
  })

  it('P07 reports unknown missing work consistently in all three options', () => {
    const before = state([task('unknown', { remainingMinutes: null })], [], [window(540, 600)])
    for (const scenario of comparePlans(before, { now }).scenarios) {
      expect(scenario).toMatchObject({ missingMinMinutes: 0, missingMaxMinutes: null, deadlineRisk: false, omittedTasks: 0, feasible: false })
    }
  })

  it('does not unlock a dependent on an open estimate, and frees reservations for completed tasks', () => {
    const before = state([task('open', open), task('dependent', { dependencyIds: ['open'] }), task('complete', { completed: true, remainingMinutes: 0 })], [session('finished-work', 'complete', 540, 570)], [window(540, 900)], lengthRules)
    const comparison = comparePlans(before, { now })
    expect(comparison.scenarios[0].remainingCapacityMinutes).toBe(360)
    for (const scenario of comparison.scenarios) expect(scenario.blockedTasks).toContainEqual(expect.objectContaining({ taskId: 'dependent' }))
    expect(comparison.scenarios[2].preview.proposed[0].startTime).toBe('09:00')
  })

  it('keeps the existing half hour and adds eight sessions to cover the known minimum in the ordinary week plan', () => {
    const existing = session('first-half-hour', 'open', 540, 570)
    const before = state([task('open', open)], [existing], [window(540, 1020)])
    const draft = createReplan(before, { now })
    expect(draft.proposed).toHaveLength(8)
    expect(draft.removedIds).toEqual([])
    expect(draft.retainedMinutes.open).toBe(30)
    expect(draft.deficitRanges.open).toEqual({ minMinutes: 0, maxMinutes: null })
  })

  it('compares actual timings and recognizes an unchanged session even with generated metadata', () => {
    const before = state([task('same')], [session('existing', 'same', 540, 570, false)], [window(540, 600)])
    const [current, , prioritized] = comparePlans(before, { now }).scenarios
    expect(prioritized).toMatchObject({ movedSessions: 0, identicalTo: current.id })
    expect(prioritized.preview.proposed[0]).toHaveProperty('planningRules')
  })

  it('P08 offers a 30-minute partial start for open or exact divisible effort and asks for a whole estimate when indivisible', () => {
    const divisible = task('divisible', open), exact = task('exact', { remainingMinutes: 241 }), indivisible = task('indivisible', { ...open, splittable: false })
    expect(rankedSuggestions([divisible, exact, indivisible], 30)).toEqual([divisible, exact])
    expect(getSessionMinutes(divisible, 30)).toBe(30)
    expect(suggestionExclusions([indivisible], 30)[0].reason).toContain('om den får plass i én økt')
  })

  it('keeps a title-only task unknown in both capacity totals', () => {
    const tasks = [{ id: 'title-only', title: 'Bare en tittel' }]
    for (const capacity of [deriveCapacity(tasks, [], now), deriveWorkCapacity(tasks, [], now, [], [window(540, 1020)])]) {
      expect(capacity.tasks[0]).toMatchObject({ requiredMinutes: null, requiredMaxMinutes: null, missingMaxMinutes: null })
      expect(capacity).toMatchObject({ unknownTaskCount: 1, totalRequiredMaxMinutes: null, totalMissingMaxMinutes: null })
    }
  })

  it('excludes open-ended effort from completion within 480 minutes and offers a marked partial session', () => {
    const divisible = task('open', open)
    const known = task('known', { remainingMinutes: 480 })
    const unknownWithStep = task('open-step', { ...open, nextStep: { description: 'Les oppgaven', estimatedMinutes: 20 } })
    const tasks = [divisible, known, unknownWithStep]
    expect(selectTasksForMinutes([divisible], 480)).toEqual([])
    expect(rankedSuggestions(tasks, 480, { completeOnly: true })).toEqual([known])
    expect(rankedSuggestions([divisible], 480)).toEqual([divisible])
    expect(getSessionMinutes(divisible, 480)).toBe(241)
    expect(suggestionReason(divisible, 480)).toContain('En deløkt på 241 min')
  })

  it('P09 shows the known shortage with 30 minutes available of at least 241', () => {
    const work = task('minimum', { ...open, deadlineLocal: `${date}T09:30` })
    const capacity = deriveWorkCapacity([work], [], now, [], [window(540, 570)])
    const status = dailyStatus({ now, workWindows: [window(540, 570)], tasks: [work] })
    expect(status).toMatchObject({ availableMinutes: 30, missingMinMinutes: 211, missingMaxMinutes: null, assessable: true })
    expect(status.text).toContain('Minst 211 minutter mangler. Du har oppgitt mer enn fire timer. Øvre anslag er ukjent.')
    expect(capacityNotice(work, [], [], now, capacity.tasks[0])).toMatchObject({ tone: 'danger', text: 'Minst 211 minutter mangler.' })
  })

  it('rejects a damaged draft and a reassigned session ID without changing the saved plan', () => {
    const reservation = session('owned-session', 'owner', 540, 570, false)
    const before = state([task('owner'), task('other')], [reservation], [window(540, 720)])
    const original = structuredClone(before)
    const draft = createReplan(before, { now })
    expect(draft.proposed.find(item => item.taskId === 'owner').id).toBe(reservation.id)
    expect(applyReplan(before, { ...draft, removedIds: null }, { now })).toMatchObject({ ok: false })
    expect(applyReplan(before, { ...draft, proposed: null }, { now })).toMatchObject({ ok: false })
    const hijacked = { ...draft, proposed: [{ ...draft.proposed[0], taskId: 'other' }] }
    expect(applyReplan(before, hijacked, { now })).toMatchObject({ ok: false, error: expect.stringContaining('eksisterende økt-ID') })
    expect(before).toEqual(original)
  })

  it('reports damaged saved sessions and availability without crashing or offering a plan', () => {
    const reservation = session('single-id', 'owner', 540, 570)
    const before = state([task('owner')], [reservation], [window(540, 720)])
    for (const sessions of [[{ ...reservation, startTime: '29:00' }], [reservation, reservation]]) {
      const damaged = { ...before, sessions }
      expect(createReplan(damaged, { now })).toMatchObject({ ok: false, error: expect.stringContaining('ugyldig studieøkt') })
      const comparison = comparePlans(damaged, { now })
      expect(comparison.scenarios.every(scenario => !scenario.feasible && !scenario.preview.ok)).toBe(true)
    }
    expect(comparePlans({ ...before, workWindows: [{ ...before.workWindows[0], end: 'ugyldig' }] }, { now })).toMatchObject({ ok: false })
    expect(before.sessions).toEqual([reservation])
  })

  it('P12 keeps a valid exploration outside the conditional fallback window when no work time is registered', () => {
    const existing = session('existing', 'unknown', 540, 570, false)
    const before = state([task('unknown', { remainingMinutes: null })], [existing], [])
    const availability = availabilityFor(before, { now, choice: 'assumption' })
    const preview = createReplan(before, { now, availability, exploratory: { unknown: 30 } })
    expect(preview).toMatchObject({ removedIds: [], proposed: [], changes: [], totalMissingMaxMinutes: null, retainedMinutes: { unknown: 30 } })
    expect(preview.problems.join(' ')).toContain('behold registrert økt på 30 min')
  })

  const workloads = [
    [task('A')],
    [task('A', { deadlineLocal: `${date}T09:30` })],
    [task('A', { remainingMinutes: 100 })],
    [task('A', { remainingMinutes: 241, splittable: false })],
    [task('A', open)],
    [task('A', { ...open, splittable: false })],
    [task('A', { remainingMinutes: null })],
    [task('A', { remainingMinutes: null }), task('B', { dependencyIds: ['A'] })],
    [task('A', { completed: true, remainingMinutes: 0 }), task('B', open)],
    [task('A'), task('B', { dependencyIds: ['A'] })],
  ]
  const reservationSets = [
    [],
    [session('first', 'A', 540, 570)],
    [session('first', 'A', 540, 570), session('second', 'A', 580, 610, false)],
  ]
  it.each(workloads.map((tasks, index) => ({ tasks, index })))('comparison matrix workload $index checks 180 cards', ({ tasks, index }) => {
    for (let size = 30; size <= 315; size += 15) {
      for (const reservations of reservationSets) {
        const before = state(tasks, structuredClone(reservations), [window(540, 540 + size)], lengthRules)
        const comparison = comparePlans(before, { now, priorityTaskIds: ['B'] })
        expect(comparison.scenarios).toHaveLength(3)
        expect(Object.isFrozen(before.sessions[0])).toBe(!reservations.length)
        for (const card of comparison.scenarios) {
          const result = applyComparedPlan(before, comparison, card.id, { now })
          expect(result.ok).toBe(true)
          expect(result.undo).toEqual(before)
          expect(card.allocatedMinutes).toBe(card.retainedMinutes + card.newOrMovableMinutes)
          if (index !== 1) expect(card.deadlineRisk).toBe(false)
          if ([4, 5, 6, 7, 8].includes(index)) expect(card.missingMaxMinutes).toBeNull()
          if (index === 7 && !card.keep) expect(card.preview.proposed.some(item => item.taskId === 'B')).toBe(false)
          if (card.keep) {
            expect(result.state.sessions).toEqual(reservations)
            expect(card.movedSessions).toBe(0)
            expect(card.newOrMovableMinutes).toBe(0)
            if (index === 8) expect(card.remainingCapacityMinutes).toBe(size)
            if ([3, 5].includes(index)) expect(card.missingMinMinutes).toBe(241)
          }
        }
      }
    }
  }, 20_000)
})
