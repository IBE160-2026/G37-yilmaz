import { describe, expect, it } from 'vitest'
import { deriveCapacity, validateSession, validSessions } from '../../src/capacity.js'

const now = () => new Date('2026-09-07T09:00:00+02:00')
const task = (id = 'task', patch = {}) => ({ id, title: `Oppgave ${id}`, course: 'IBE160',
  deadlineLocal: '2026-09-07T15:00', estimatedMinutes: 90, completed: false, ...patch })
const session = (id = 'session', patch = {}) => ({ id, dateLocal: '2026-09-07', startTime: '10:00', endTime: '11:00', ...patch })
const plan = (tasks = [task()], sessions = [session()], time = now()) => deriveCapacity(tasks, sessions, time)

describe('lokale studieøkter', () => {
  it('godtar tom samling, gyldig økt, skuddag og kalenderår før 100', () => {
    expect(validSessions([])).toBe(true)
    for (const dateLocal of ['2026-09-07', '2024-02-29', '0001-01-01', '9999-12-31']) {
      expect(validateSession(session('a', { dateLocal }))).toEqual({ valid: true })
    }
  })

  it.each([
    null, [], {}, { id: '' }, { id: ' ' }, { id: 42 }, { dateLocal: '' }, { dateLocal: '2026-02-30' },
    { dateLocal: '2026-02-29' }, { dateLocal: '0000-01-01' }, { dateLocal: '2026-9-07' },
    { dateLocal: '2026-09-07T00:00' }, { dateLocal: '2026-09-07Z' }, { startTime: '9:00' },
    { startTime: '10:00:00' }, { startTime: ' 10:00' }, { startTime: null },
    { endTime: '24:00' }, { endTime: '11:60' }, { endTime: '10:00' }, { endTime: '09:59' },
  ])('avviser ugyldige felt: %j', patch => {
    const candidate = patch === null || Array.isArray(patch) || Object.keys(patch).length === 0 ? patch : session('a', patch)
    expect(validateSession(candidate)).toEqual({ valid: false, error: expect.any(String) })
    expect(validSessions([candidate])).toBe(false)
  })

  it('godtar ett minutt og tilstøtende økter, men avviser alle overlappsformer', () => {
    const existing = session('a', { startTime: '10:00', endTime: '12:00' })
    for (const [startTime, endTime] of [['09:59', '10:00'], ['12:00', '12:01']]) {
      expect(validateSession(session('b', { startTime, endTime }), [existing]).valid).toBe(true)
    }
    for (const [startTime, endTime] of [['09:00', '10:01'], ['11:59', '13:00'], ['10:30', '11:00'], ['09:00', '13:00'], ['10:00', '12:00']]) {
      const candidate = session('b', { startTime, endTime })
      expect(validateSession(candidate, [existing]).error).toMatch(/overlapper/)
      expect(validSessions([candidate, existing])).toBe(true)
    }
    expect(validateSession(session('b', { dateLocal: '2026-09-08' }), [existing]).valid).toBe(true)
  })

  it('avviser duplikate ID-er og kan utelate egen lagret økt ved redigering', () => {
    const existing = [session('a'), session('b', { startTime: '12:00', endTime: '13:00' })]
    expect(validateSession(session('a', { dateLocal: '2026-09-08' }), existing).error).toMatch(/unik ID/)
    expect(validSessions([existing[0], session('a', { dateLocal: '2026-09-08' })])).toBe(false)
    expect(validateSession(session('a', { endTime: '11:30' }), existing, 'a').valid).toBe(true)
    expect(validateSession(session('a', { endTime: '12:01' }), existing, 'a').error).toMatch(/overlapper/)
    expect(validateSession(session('b'), existing, 'a').error).toMatch(/unik ID/)
    for (const value of [null, {}, '']) expect(validSessions(value)).toBe(false)
    expect(validateSession(session(), null).valid).toBe(false)
  })

  it.each([
    ['2026-03-29', '02:00', '03:00'], ['2026-03-29', '01:00', '03:00'],
    ['2026-03-29', '01:59', '03:01'], ['2026-10-25', '01:00', '03:00'],
    ['2026-10-25', '02:00', '02:30'], ['2026-10-25', '01:00', '02:30'], ['2026-10-25', '02:30', '03:30'],
  ])('avviser manglende, tvetydig eller kryssende sommertid: %s %s–%s', (dateLocal, startTime, endTime) => {
    expect(validateSession(session('a', { dateLocal, startTime, endTime })).valid).toBe(false)
  })

  it.each([
    ['2026-03-29', '00:00', '01:59'], ['2026-03-29', '03:00', '04:00'],
    ['2026-10-25', '00:00', '01:59'], ['2026-10-25', '03:00', '04:00'],
  ])('godtar økter utenfor tidsskiftet på samme dato: %s %s–%s', (dateLocal, startTime, endTime) => {
    expect(validateSession(session('a', { dateLocal, startTime, endTime })).valid).toBe(true)
  })
})

describe('deterministisk fordeling av gjenstående arbeid', () => {
  it('deler 90 minutter over to økter og lar 30 minutter stå ledig', () => {
    const result = plan([task()], [session('a'), session('b', { startTime: '11:00', endTime: '12:00' })])
    expect(result.tasks[0]).toEqual({ taskId: 'task', requiredMinutes: 90, allocatedMinutes: 90, missingMinutes: 0, reasons: [], allocations: [
      { sessionId: 'a', startLocal: '2026-09-07T10:00', endLocal: '2026-09-07T11:00', minutes: 60 },
      { sessionId: 'b', startLocal: '2026-09-07T11:00', endLocal: '2026-09-07T11:30', minutes: 30 },
    ] })
    expect(result).toMatchObject({ totalRequiredMinutes: 90, totalAllocatedMinutes: 90, totalMissingMinutes: 0,
      totalCapacityMinutes: 120, spareMinutes: 30, totalLostMinutes: 0, warnings: [] })
  })

  it('forklarer manglende kapasitet og har fortsatt alle arbeidsminuttene', () => {
    const entry = plan().tasks[0]
    expect(entry).toMatchObject({ requiredMinutes: 90, allocatedMinutes: 60, missingMinutes: 30 })
    expect(entry.reasons.join(' ')).toMatch(/60 hele framtidige minutter.*30 min mangler/)
    const empty = deriveCapacity([task()], undefined, now())
    expect(empty.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 90 })
    expect(empty.tasks[0].reasons.join(' ')).toMatch(/0 hele framtidige minutter/)
  })

  it('prioriterer frist og kildeorden ved lik frist, mens resultatet beholder kildeorden', () => {
    const tasks = [task('late', { deadlineLocal: '2026-09-07T16:00' }), task('first'), task('second')]
    const result = plan(tasks, [session('a', { endTime: '12:00' })])
    expect(result.tasks.map(entry => [entry.taskId, entry.allocatedMinutes])).toEqual([['late', 0], ['first', 90], ['second', 30]])
    expect(result.tasks[0].reasons.join(' ')).toMatch(/Andre oppgaver/)
    expect(result.tasks[2].reasons.join(' ')).toMatch(/tidligere eller lik frist/)
    expect(result.totalMissingMinutes).toBe(150)
    expect(result.spareMinutes).toBe(0)
  })

  it('avkorter økten ved en frist midt på dagen og gir resten til neste oppgave', () => {
    const result = plan([task('first', { estimatedMinutes: 120, deadlineLocal: '2026-09-07T11:30' }), task('second')],
      [session('a', { endTime: '13:00' })])
    expect(result.tasks[0]).toMatchObject({ allocatedMinutes: 90, missingMinutes: 30 })
    expect(result.tasks[0].allocations[0].endLocal).toBe('2026-09-07T11:30')
    expect(result.tasks[1].allocations[0].startLocal).toBe('2026-09-07T11:30')
    expect(result.tasks[1].allocatedMinutes).toBe(90)
  })

  it('utelater alle minutter på og etter fristen', () => {
    const result = plan([task('a', { deadlineLocal: '2026-09-07T10:00' })], [session()])
    expect(result.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 90 })
    expect(result.spareMinutes).toBe(60)
  })

  it('teller overlappende intervaller én gang også ved innkapsling og lik start', () => {
    const result = plan([task('a', { estimatedMinutes: 300 })], [
      session('first', { endTime: '12:00' }), session('nested', { startTime: '10:30', endTime: '11:00' }),
      session('overlap', { startTime: '11:00', endTime: '13:00' }), session('same-start'),
    ])
    expect(result).toMatchObject({ totalCapacityMinutes: 180, totalAllocatedMinutes: 180, totalMissingMinutes: 120, spareMinutes: 0 })
    expect(result.tasks[0].allocations.map(a => [a.sessionId, a.minutes])).toEqual([['first', 120], ['overlap', 60]])
    expect(result.warnings.join(' ')).toMatch(/bare telt én gang/)
  })

  it('fordeler uavhengig av øktenes rekkefølge og hopper over hull', () => {
    const sessions = [session('late', { startTime: '12:00', endTime: '13:00' }), session('early')]
    const result = plan([task()], sessions)
    expect(result.tasks[0].allocations.map(a => [a.sessionId, a.startLocal, a.minutes])).toEqual([
      ['early', '2026-09-07T10:00', 60], ['late', '2026-09-07T12:00', 30],
    ])
    expect(plan([task()], sessions.toReversed())).toEqual(result)
  })

  it('utelater ugyldige økter og duplikate ID-er med synlig forklaring', () => {
    const result = plan([task()], [session(), session('session', { startTime: '12:00', endTime: '13:00' }),
      session('invalid', { endTime: '25:00' }), null])
    expect(result.totalCapacityMinutes).toBe(60)
    expect(result.warnings.join(' ')).toMatch(/Ugyldige studieøkter.*utelatt/)
  })

  it('bruker gjenstående arbeid én gang uavhengig av neste steg', () => {
    const result = plan([task('a', { remainingMinutes: 20, nextStep: { description: 'Les', estimatedMinutes: 45 } })])
    expect(result.tasks[0]).toMatchObject({ requiredMinutes: 20, allocatedMinutes: 20, missingMinutes: 0 })
    expect(result.spareMinutes).toBe(40)
  })

  it('fordeler ikke ferdig arbeid uavhengig av innlevering og beholder eksplisitt null uferdig', () => {
    const tasks = [task('completed', { completed: true }), task('pending', { completed: true, requiresSubmission: true, submitted: false }),
      task('submitted', { completed: true, requiresSubmission: true, submitted: true }), task('zero', { remainingMinutes: 0 }), task('active')]
    const result = plan(tasks)
    expect(result.tasks.slice(0, 4).map(entry => [entry.requiredMinutes, entry.allocatedMinutes, entry.missingMinutes])).toEqual([
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    ])
    expect(result.tasks[3].reasons.join(' ')).toMatch(/0 min.*Bekreft/)
    expect(result.tasks[4].allocatedMinutes).toBe(60)
    expect(tasks[3].completed).toBe(false)
    expect(tasks[1].submitted).toBe(false)
  })

  it('muterer verken oppgaver, økter, neste steg eller klokke og gir samme resultat hver gang', () => {
    const tasks = Object.freeze([Object.freeze(task('a', { nextStep: Object.freeze({ description: 'Les', estimatedMinutes: 15 }) }))])
    const sessions = Object.freeze([Object.freeze(session())])
    const clock = now()
    const before = JSON.stringify({ tasks, sessions, clock })
    expect(plan(tasks, sessions, clock)).toEqual(plan(tasks, sessions, clock))
    expect(JSON.stringify({ tasks, sessions, clock })).toBe(before)
    expect(tasks[0]).not.toHaveProperty('remainingMinutes')
  })

  it('bevarer nøyaktige oppgaveminutter og varsler ved for store summer', () => {
    const result = plan([task('a', { remainingMinutes: Number.MAX_SAFE_INTEGER }), task('b', { remainingMinutes: Number.MAX_SAFE_INTEGER })])
    expect(result.totalRequiredMinutes).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.totalMissingMinutes).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.tasks[0].missingMinutes).toBe(Number.MAX_SAFE_INTEGER - 60)
    expect(result.tasks[1].missingMinutes).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.warnings.join(' ')).toMatch(/Totalene.*begrenset/)
    expect(Number.isSafeInteger(result.totalRequiredMinutes)).toBe(true)
  })
})

describe('tid som gjenstår før fristen', () => {
  it.each([
    ['2026-09-07T10:30:00+02:00', 30, '2026-09-07T10:30'],
    ['2026-09-07T10:30:00.001+02:00', 29, '2026-09-07T10:31'],
    ['2026-09-07T10:30:59.999+02:00', 29, '2026-09-07T10:31'],
    ['2026-09-07T10:59:00+02:00', 1, '2026-09-07T10:59'],
  ])('bruker bare hele framtidige minutter ved %s', (time, minutes, startLocal) => {
    const result = plan([task()], [session()], new Date(time))
    expect(result.totalCapacityMinutes).toBe(minutes)
    expect(result.totalLostMinutes).toBe(60 - minutes)
    expect(result.tasks[0].allocations[0]).toMatchObject({ minutes, startLocal, endLocal: '2026-09-07T11:00' })
    expect(result.warnings.join(' ')).toMatch(/passert eller ligger i et påbegynt minutt/)
  })

  it.each(['2026-09-07T10:59:00.001+02:00', '2026-09-07T11:00:00+02:00', '2026-09-08T09:00:00+02:00'])('gir ingen kapasitet fra avsluttet økt eller siste påbegynte minutt: %s', time => {
    const result = plan([task()], [session()], new Date(time))
    expect(result).toMatchObject({ totalCapacityMinutes: 0, totalAllocatedMinutes: 0, totalLostMinutes: 60 })
    expect(result.tasks[0].allocations).toEqual([])
  })

  it('lar en økt som begynner ved neste hele minutt beholde hele kapasiteten', () => {
    const result = plan([task()], [session()], new Date('2026-09-07T09:59:59.999+02:00'))
    expect(result.totalCapacityMinutes).toBe(60)
    expect(result.totalLostMinutes).toBe(0)
  })

  it.each(['2026-09-07T08:59', '2026-09-07T09:00'])('lar nådd eller passert frist beholde alt arbeid uten å bruke framtidige økter: %s', deadlineLocal => {
    const result = plan([task('overdue', { deadlineLocal }), task('future')])
    expect(result.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 90, allocations: [] })
    expect(result.tasks[0].reasons.join(' ')).toMatch(/Fristen er nådd eller passert/)
    expect(result.tasks[1].allocatedMinutes).toBe(60)
  })

  it('behandler 30 sekunder før fristen som null hele minutter', () => {
    const result = plan([task('a', { deadlineLocal: '2026-09-07T11:00' })], [session()], new Date('2026-09-07T10:59:30+02:00'))
    expect(result.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 90 })
    expect(result.tasks[0].reasons.join(' ')).not.toMatch(/Fristen er nådd/)
  })

  it('bruker lokal dato gjennom midnatt og årsskifte', () => {
    const result = plan([task('a', { deadlineLocal: '2027-01-01T00:30' })], [
      session('old', { dateLocal: '2026-12-31', startTime: '23:00', endTime: '23:59' }),
      session('new', { dateLocal: '2027-01-01', startTime: '00:00', endTime: '01:00' }),
    ], new Date('2026-12-31T23:30:00+01:00'))
    expect(result.tasks[0]).toMatchObject({ allocatedMinutes: 59, missingMinutes: 31 })
    expect(result.tasks[0].allocations.map(a => a.minutes)).toEqual([29, 30])
    expect(result.spareMinutes).toBe(30)
  })

  it.each([
    ['2026-03-29', '2026-03-29T01:30:00+01:00'],
    ['2026-10-25', '2026-10-25T02:30:00+02:00'],
    ['2026-10-25', '2026-10-25T02:30:00+01:00'],
  ])('gir én time for en gyldig økt etter tidsskiftet: %s %s', (dateLocal, time) => {
    const result = plan([task('a', { deadlineLocal: `${dateLocal}T05:00` })],
      [session('a', { dateLocal, startTime: '03:00', endTime: '04:00' })], new Date(time))
    expect(result.totalCapacityMinutes).toBe(60)
    expect(result.tasks[0].allocatedMinutes).toBe(60)
  })

  it('bruker første forekomst av tvetydig frist og forklarer begrensningen', () => {
    const result = plan([task('a', { deadlineLocal: '2026-10-25T02:30' })],
      [session('a', { dateLocal: '2026-10-25', startTime: '03:00', endTime: '04:00' })], new Date('2026-10-25T02:15:00+01:00'))
    expect(result.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 90 })
    expect(result.tasks[0].reasons.join(' ')).toMatch(/første forekomsten.*Fristen er nådd/)
    expect(result.spareMinutes).toBe(60)
  })

  it('utelater ugyldig klokke og fordeler ingen tid', () => {
    const result = plan([task()], [session()], new Date('invalid'))
    expect(result.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 90 })
    expect(result.warnings.join(' ')).toMatch(/Klokken er ugyldig/)
  })
})
