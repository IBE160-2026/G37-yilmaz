import { describe, expect, it } from 'vitest'
import { createReplan, applyReplan } from '../../src/replanning.js'
import { deriveWorkCapacity, extendedSessionInterval } from '../../src/work-capacity.js'
import { deriveCapacity } from '../../src/capacity.js'
import { DEFAULT_PLANNING_RULES } from '../../src/planning-rules.js'

const now = new Date('2026-09-19T07:00:00Z')
const task = (id, patch = {}) => ({ id, title: id, course: '', completed: false, remainingMinutes: 40, deadlineLocal: '', ...patch })
const window = (id, start, end) => ({ id, start, end })
const lock = (id, taskId, patch = {}) => ({ id, taskId, dateLocal: '2026-09-20', startTime: '10:00', endTime: '11:00', locked: true, ...patch })
const rules = { sessionMinutes: 30, minimumMinutes: 15, maximumMinutes: 60, breakMinutes: 0 }
const state = patch => ({ tasks: [task('work')], sessions: [], planningPreferences: rules, workWindows: [window('w', '2026-09-20T08:00:00Z', '2026-09-20T12:00:00Z')], ...patch })

describe('R1 generated sessions around the autumn clock change', () => {
  it('keeps an ambiguous-only window nonmutating and explains the recovery choice without throwing', () => {
    const before = state({ workWindows: [window('fall', '2026-10-25T00:00:00Z', '2026-10-25T02:00:00Z')] }), raw = JSON.stringify(before)
    const preview = createReplan(before, { now })
    expect(preview.ok).toBe(true)
    expect(preview.proposed).toEqual([])
    expect(preview.problems.join(' ')).toMatch(/forekommer to ganger.*Velg en økt/)
    expect(preview.problems.join(' ')).toContain('40 min mangler')
    expect(JSON.stringify(before)).toBe(raw)
    expect(applyReplan(before, preview, { now }).ok).toBe(true)
  })

  it.each(['2026-10-24T23:30:00Z', '2026-10-25T00:15:00Z', '2026-10-25T01:15:00Z'])('finds later representable time after an ambiguous endpoint from %s', start => {
    const before = state({ workWindows: [window('fall', start, '2026-10-25T03:00:00Z')] })
    const preview = createReplan(before, { now })
    expect(preview.proposed[0]).toMatchObject({ startTime: '03:00', endTime: '03:30' })
    expect(preview.proposed.every(session => extendedSessionInterval(session).end > extendedSessionInterval(session).start)).toBe(true)
    expect(preview.problems.join(' ')).toContain('forekommer to ganger')
    expect(applyReplan(before, preview, { now }).ok).toBe(true)
  })

  it.each([
    ['2026-10-24T23:30:00Z', '2026-10-25T02:00:00Z', 150, '01:30', '03:00'],
    ['2027-03-28T00:30:00Z', '2027-03-28T01:30:00Z', 60, '01:30', '03:30'],
  ])('retains representable sessions crossing a clock change from %s', (start, end, minutes, startTime, endTime) => {
    const before = state({ tasks: [task('work', { remainingMinutes: minutes, splittable: false })], workWindows: [window('crossing', start, end)], planningPreferences: { ...rules, maximumMinutes: minutes } })
    const preview = createReplan(before, { now })
    expect(preview.proposed).toHaveLength(1)
    expect(preview.proposed[0]).toMatchObject({ startTime, endTime })
    expect(preview.allocatedMinutes.work).toBe(minutes)
    expect(preview.problems).toEqual([])
    expect(applyReplan(before, preview, { now }).ok).toBe(true)
  })
})

describe('R1 indivisible work needs one sufficiently long usable reservation', () => {
  it('retains a lock with a midpoint conflict but cannot unlock its dependent from two 20-minute fragments', () => {
    const before = state({ tasks: [task('work', { splittable: false }), task('dependent', { remainingMinutes: 15, dependencyIds: ['work'] })], sessions: [lock('locked', 'work')], busyWindows: [window('busy', '2026-09-20T08:20:00Z', '2026-09-20T08:40:00Z')] }), raw = JSON.stringify(before)
    const preview = createReplan(before, { now })
    expect(preview.proposed).toEqual([])
    expect(preview.problems.join(' ')).toMatch(/låste økten.*opptatt/)
    expect(preview.problems.join(' ')).toContain('40 min mangler')
    expect(preview.problems.join(' ')).toContain('Ingen startklar tid foreslås')
    expect(applyReplan(before, preview, { now }).state.sessions).toEqual(before.sessions)
    expect(JSON.stringify(before)).toBe(raw)
    const forged = structuredClone(preview)
    forged.proposed.push({ id: 'forged', taskId: 'dependent', dateLocal: '2026-09-20', startTime: '11:00', endTime: '11:15' })
    expect(applyReplan(before, forged, { now })).toMatchObject({ ok: false, error: expect.stringContaining('forutsetning') })
    const capacity = deriveWorkCapacity(before.tasks, before.sessions, now, [], before.workWindows, before.busyWindows)
    expect(capacity.tasks[0]).toMatchObject({ reservedMinutes: 40, allocatedMinutes: 0, missingMinutes: 40, state: 'insufficient' })
    expect(capacity.tasks[0].reasons.join(' ')).toContain('kan ikke deles')
  })

  it('does not add two separated locks or a short lock plus free time into indivisible completion', () => {
    for (const sessions of [[lock('first', 'work', { endTime: '10:20' }), lock('second', 'work', { startTime: '10:40' })], [lock('first', 'work', { endTime: '10:20' })]]) {
      const before = state({ tasks: [task('work', { splittable: false }), task('dependent', { dependencyIds: ['work'] })], sessions })
      const preview = createReplan(before, { now })
      expect(preview.proposed).toEqual([])
      expect(preview.problems.join(' ')).toContain('kan ikke deles')
      expect(deriveWorkCapacity(before.tasks, sessions, now, [], before.workWindows).tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 40 })
    }
  })

  it('allows a clipped lock when one usable contiguous portion really is sufficient', () => {
    const before = state({ tasks: [task('work', { remainingMinutes: 30, splittable: false }), task('dependent', { remainingMinutes: 15, dependencyIds: ['work'] })], sessions: [lock('locked', 'work')], busyWindows: [window('busy', '2026-09-20T08:00:00Z', '2026-09-20T08:20:00Z')] })
    const preview = createReplan(before, { now })
    expect(preview.proposed.map(item => item.taskId)).toEqual(['dependent'])
    expect(preview.proposed[0].startTime).toBe('11:00')
    expect(preview.problems.join(' ')).toContain('låste økten')
    expect(applyReplan(before, preview, { now }).ok).toBe(true)
  })
})

describe('R1 capacity never promises indivisible completion from disconnected windows', () => {
  const work = task('work', { remainingMinutes: 60, splittable: false, deadlineLocal: '2026-09-20T14:00' })
  it('leaves separate 30-minute windows available for other tasks', () => {
    const before = state({ tasks: [work, task('small', { remainingMinutes: 30 })], workWindows: [window('one', '2026-09-20T08:00:00Z', '2026-09-20T08:30:00Z'), window('two', '2026-09-20T09:00:00Z', '2026-09-20T09:30:00Z')] })
    const capacity = deriveWorkCapacity(before.tasks, [], now, [], before.workWindows)
    expect(capacity.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 60, state: 'insufficient', allocations: [] })
    expect(capacity.tasks[0].reasons.join(' ')).not.toContain('Arbeidet får plass')
    expect(capacity.tasks[1].allocatedMinutes).toBe(30)
    expect(capacity.spareMinutes).toBe(30)
    expect(createReplan(before, { now }).problems.join(' ')).toContain('60 min mangler')
  })

  it('keeps the legacy unassigned-session path truthful across separated and adjacent intervals', () => {
    const first = { id: 'one', dateLocal: '2026-09-20', startTime: '10:00', endTime: '10:30' }
    const second = { id: 'two', dateLocal: '2026-09-20', startTime: '11:00', endTime: '11:30' }
    const split = deriveCapacity([work], [first, second], now)
    expect(split.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 60, allocations: [] })
    expect(split.tasks[0].reasons.join(' ')).toContain('sammenhengende')
    expect(split.spareMinutes).toBe(60)
    const contiguous = deriveCapacity([work], [first, { ...second, startTime: '10:30', endTime: '11:00' }], now)
    expect(contiguous.tasks[0]).toMatchObject({ allocatedMinutes: 60, missingMinutes: 0 })
    expect(contiguous.spareMinutes).toBe(0)
  })

  it('uses a later sufficiently long free interval and keeps earlier fragments spare', () => {
    const windows = [window('short', '2026-09-20T08:00:00Z', '2026-09-20T08:30:00Z'), window('long', '2026-09-20T09:00:00Z', '2026-09-20T10:00:00Z')]
    const capacity = deriveWorkCapacity([work], [], now, [], windows)
    expect(capacity.tasks[0]).toMatchObject({ allocatedMinutes: 60, missingMinutes: 0 })
    expect(capacity.tasks[0].allocations).toEqual([expect.objectContaining({ startLocal: '2026-09-20T11:00', minutes: 60 })])
    expect(capacity.spareMinutes).toBe(30)
  })
})

describe('R1 short usable sessions and limits of capacity minute totals', () => {
  const separatedWindows = [window('one', '2026-09-20T08:00:00Z', '2026-09-20T08:20:00Z'), window('two', '2026-09-20T09:00:00Z', '2026-09-20T09:20:00Z')]

  it('plans splittable 40-minute work as 20 + 20 with the usual 30-minute preference', () => {
    const before = state({ workWindows: separatedWindows, planningPreferences: DEFAULT_PLANNING_RULES }), raw = JSON.stringify(before)
    const preview = createReplan(before, { now })
    expect(preview.proposed.map(item => [item.startTime, item.endTime])).toEqual([['10:00', '10:20'], ['11:00', '11:20']])
    expect(preview.allocatedMinutes.work).toBe(40)
    expect(preview.problems).toEqual([])
    expect(applyReplan(before, preview, { now }).ok).toBe(true)
    expect(JSON.stringify(before)).toBe(raw)
    const indivisible = createReplan({ ...before, tasks: [task('work', { splittable: false })] }, { now })
    expect(indivisible.proposed).toEqual([])
    expect(indivisible.problems.join(' ')).toContain('40 min mangler')
  })

  it('still rejects an available fragment shorter than the minimum', () => {
    const before = state({ workWindows: [window('short', '2026-09-20T08:00:00Z', '2026-09-20T08:14:00Z'), separatedWindows[1]], planningPreferences: DEFAULT_PLANNING_RULES })
    const preview = createReplan(before, { now })
    expect(preview.proposed).toHaveLength(1)
    expect(preview.proposed[0]).toMatchObject({ startTime: '11:00', endTime: '11:20' })
    expect(preview.problems.join(' ')).toContain('20 min mangler')
  })

  it('does not call a raw 60-minute total a feasible plan when the selected breaks leave work missing', () => {
    const before = state({ tasks: [task('work', { remainingMinutes: 60 })], workWindows: [window('hour', '2026-09-20T08:00:00Z', '2026-09-20T09:00:00Z')], planningPreferences: DEFAULT_PLANNING_RULES })
    const capacity = deriveCapacity(before.tasks, [], now, [], before)
    expect(capacity.tasks[0].allocatedMinutes).toBe(60)
    expect(capacity.tasks[0].reasons.join(' ')).toMatch(/Minuttsummen.*ikke kontrollert som en gjennomførbar plan.*10 min pause/)
    expect(capacity.tasks[0].reasons.join(' ')).not.toContain('Arbeidet får plass')
    const preview = createReplan(before, { now })
    expect(preview.allocatedMinutes.work).toBe(50)
    expect(preview.problems.join(' ')).toContain('10 min mangler')
    const legacy = deriveCapacity(before.tasks, [{ id: 'legacy', dateLocal: '2026-09-20', startTime: '10:00', endTime: '11:00' }], now, [], { planningPreferences: DEFAULT_PLANNING_RULES })
    expect(legacy.planningNote).toMatch(/ikke kontrollert som en gjennomførbar plan.*10 min pause/)
  })

  it('applies an explicit indivisible maximum in both modern and legacy capacity callers', () => {
    const work = task('work', { remainingMinutes: 90, splittable: false, deadlineLocal: '2026-09-20T14:00' })
    const before = state({ tasks: [work], planningPreferences: DEFAULT_PLANNING_RULES })
    const modern = deriveCapacity(before.tasks, [], now, [], before)
    const legacy = deriveCapacity(before.tasks, [{ id: 'legacy', dateLocal: '2026-09-20', startTime: '10:00', endTime: '12:00' }], now, [], { planningPreferences: DEFAULT_PLANNING_RULES })
    for (const capacity of [modern, legacy]) {
      expect(capacity.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 90 })
      expect(capacity.tasks[0].reasons.join(' ')).toContain('maksimal øktlengde 60 min')
    }
  })
})
