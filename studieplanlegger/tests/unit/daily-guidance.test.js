import { describe, expect, it } from 'vitest'
import { deriveCapacity } from '../../src/capacity.js'
import { dailyStatus, rankedSuggestions } from '../../src/daily-guidance.js'
import { closeWork, validWorkLogs } from '../../src/work-log.js'
import { createReplan, applyReplan } from '../../src/replanning.js'
import { editTask, validTasks } from '../../src/tasks.js'

const now = new Date('2026-09-07T09:00:00+02:00')
const task = (id, patch = {}) => ({ id, title: `Oppgave ${id}`, course: 'IBE160', deadlineLocal: '2026-09-07T15:00', estimatedMinutes: 60, completed: false, ...patch })
const session = (id, startTime, endTime, patch = {}) => ({ id, dateLocal: '2026-09-07', startTime, endTime, ...patch })

describe('dagsstatus med intervaller og faktisk kapasitet', () => {
  it('viser at det kan mangle opptil 45 minutter for 1–2 timer med 75 minutter ledig', () => {
    const tasks = [task('presentasjon', { title: 'Presentasjonen', estimatedMinutes: undefined, remainingEstimate: { minMinutes: 60, maxMinutes: 120 } })]
    const capacity = deriveCapacity(tasks, [session('ledig', '10:00', '11:15')], now)
    const status = dailyStatus({ tasks, capacity, now })
    expect(status).toMatchObject({ tone: 'danger', availableMinutes: 75, missingMinMinutes: 0, missingMaxMinutes: 45 })
    expect(status.text).toContain('1–2 timer')
    expect(status.text).toContain('Det kan mangle opptil 45 minutter')
  })

  it('trekker konkurrerende oppgaver og overlapp fra uten dobbelttelling', () => {
    const tasks = [
      task('først', { deadlineLocal: '2026-09-07T12:00', estimatedMinutes: 45 }),
      task('etter', { deadlineLocal: '2026-09-07T15:00', estimatedMinutes: 60 }),
    ]
    const capacity = deriveCapacity(tasks, [session('a', '10:00', '11:00'), session('b', '10:30', '11:30')], now)
    const later = capacity.tasks.find(item => item.taskId === 'etter')
    expect(capacity.totalCapacityMinutes).toBe(90)
    expect(later).toMatchObject({ allocatedMinutes: 45, missingMinutes: 15 })
  })

  it('sier at grunnlaget ikke kan vurderes når tid eller frist er ukjent', () => {
    const tasks = [task('ukjent', { deadlineLocal: '', estimatedMinutes: undefined })]
    expect(dailyStatus({ tasks, capacity: deriveCapacity(tasks, [], now), now }).text).toMatch(/^Kan ikke vurderes ennå/)
  })

  it('viser at planen går opp og skiller ferdig arbeid fra ubekreftet levering', () => {
    const tasks = [task('kort', { estimatedMinutes: 60 })]
    const status = dailyStatus({ tasks, capacity: deriveCapacity(tasks, [session('ledig', '10:00', '11:15')], now), now })
    expect(status).toMatchObject({ tone: 'good', missingMinMinutes: 0, missingMaxMinutes: 0 })
    expect(status.text).toContain('Planen går opp')

    const pendingSubmission = task('levering', { completed: true, requiresSubmission: true, submitted: false })
    expect(dailyStatus({ tasks: [pendingSubmission], capacity: deriveCapacity([pendingSubmission], [], now), now })).toMatchObject({ tone: 'neutral', assessable: true })
    expect(dailyStatus({ tasks: [pendingSubmission], capacity: deriveCapacity([pendingSubmission], [], now), now }).text).toContain('levering er ikke bekreftet')
  })

  it('bevarer åpne maksimum som ukjent i kapasitetstotalene', () => {
    const tasks = [task('åpen', { estimatedMinutes: null, remainingEstimate: { minMinutes: 241, maxMinutes: null } })]
    const capacity = deriveCapacity(tasks, [session('ledig', '10:00', '11:15')], now)
    expect(capacity).toMatchObject({ totalRequiredMinMinutes: 241, totalRequiredMaxMinutes: null, totalMissingMinMinutes: 241, totalMissingMaxMinutes: null })
  })
})

describe('Jeg har tid nå', () => {
  it('gir opptil tre forskjellige, registrerte arbeidssteg i rangert rekkefølge', () => {
    const tasks = [
      task('a', { nextStep: 'Skriv innledning', estimatedMinutes: 30 }),
      task('b', { nextStep: 'Les kilden', estimatedMinutes: 15, deadlineLocal: '2026-09-08T12:00' }),
      task('c', { nextStep: 'Lag disposisjon', estimatedMinutes: 45, deadlineLocal: '2026-09-09T12:00' }),
      task('d', { nextStep: 'Kontroller referanser', estimatedMinutes: 20, deadlineLocal: '2026-09-10T12:00' }),
    ]
    const suggestions = rankedSuggestions(tasks, 45)
    expect(suggestions.map(item => item.id)).toEqual(['a', 'c', 'b'])
    expect(suggestions).toHaveLength(3)
    expect(new Set(suggestions.map(item => item.id)).size).toBe(3)
    expect(suggestions.every(item => item.nextStep)).toBe(true)
  })

  it('dikter ikke opp et delsteg når ingen bekreftet aktivitet passer', () => {
    expect(rankedSuggestions([task('lang', { estimatedMinutes: 90 })], 30)).toEqual([])
  })
})

describe('øktslutt og realistisk omplanlegging', () => {
  const base = () => ({ tasks: [task('a', { nextStep: { description: 'Skriv første avsnitt', estimatedMinutes: 30 }, remainingEstimate: { minMinutes: 60, maxMinutes: 120 }, estimatedMinutes: undefined })], sessions: [], workLogs: [] })

  it('fullfører bare arbeidssteget når hele oppgaven ikke er bekreftet ferdig', () => {
    const result = closeWork(base(), { taskId: 'a', operationId: 'step', outcome: 'done', actualMinutes: 30, stepOnly: true, completeTask: false }, { now })
    expect(result.ok).toBe(true)
    expect(result.state.tasks[0].completed).toBe(false)
    expect(result.state.tasks[0].nextStep).toBeUndefined()
    expect(result.log).toMatchObject({ stepCompleted: true, historyComplete: false })
  })

  it('bevarer nytt intervall ved mer tid og registrerer ingen fremdrift ved ikke utført', () => {
    const more = closeWork(base(), { taskId: 'a', operationId: 'more', outcome: 'more', actualMinutes: 20, remainingEstimate: { minMinutes: 120, maxMinutes: 240 } }, { now })
    expect(more.state.tasks[0].remainingEstimate).toEqual({ minMinutes: 120, maxMinutes: 240 })
    const missed = closeWork(base(), { taskId: 'a', operationId: 'missed', outcome: 'not-started', actualMinutes: 60 }, { now })
    expect(missed.log.actualMinutes).toBeNull()
    expect(missed.state.tasks[0]).toEqual(base().tasks[0])
  })

  it('replaces an exact remainder with a range after a step and clears the step on whole-task completion', () => {
    const exact = { tasks: [task('a', { nextStep: { description: 'Les', estimatedMinutes: 30 }, remainingMinutes: 90 })], sessions: [], workLogs: [] }
    const ranged = closeWork(exact, { taskId: 'a', operationId: 'range-after-step', outcome: 'more', actualMinutes: 20, stepOnly: true, remainingEstimate: { minMinutes: 60, maxMinutes: 120 } }, { now })
    expect(ranged.state.tasks[0]).toMatchObject({ remainingMinutes: null, remainingEstimate: { minMinutes: 60, maxMinutes: 120 } })
    expect(validTasks(ranged.state.tasks)).toBe(true)
    const finished = closeWork(exact, { taskId: 'a', operationId: 'whole-done', outcome: 'done', actualMinutes: 90, historyComplete: true }, { now })
    expect(finished.state.tasks[0].nextStep).toBeUndefined()
  })

  it('avviser utfallsfelt som ikke passer arbeidsloggen', () => {
    const completedStep = closeWork(base(), { taskId: 'a', operationId: 'step-shape', outcome: 'done', actualMinutes: 20, stepOnly: true }, { now }).log
    expect(validWorkLogs([{ ...completedStep, outcome: 'more' }])).toBe(false)
    expect(validWorkLogs([{ ...completedStep, stepCompleted: undefined, remainingEstimate: { minMinutes: 30, maxMinutes: 60 } }])).toBe(false)
  })

  it('fullfører hele oppgaven separat fra steget og krever frigjøring av framtidige reservasjoner', () => {
    const withSession = { ...base(), sessions: [session('future', '12:00', '12:30', { taskId: 'a' })] }
    const draft = { taskId: 'a', operationId: 'whole', outcome: 'done', actualMinutes: 30, stepOnly: true, completeTask: true, historyComplete: true }
    expect(closeWork(withSession, draft, { now })).toMatchObject({ ok: false, requiresRelease: true })
    const result = closeWork(withSession, { ...draft, confirmRelease: true }, { now })
    expect(result.state.tasks[0]).toMatchObject({ completed: true, remainingMinutes: 0 })
    expect(result.state.tasks[0].nextStep).toBeUndefined()
    expect(result.state.tasks[0].remainingEstimate).toBeUndefined()
    expect(result.state.sessions).toEqual([])
  })

  it('viser og bevarer et ærlig restunderskudd før planen brukes', () => {
    const state = {
      tasks: [task('a', { estimatedMinutes: 90, deadlineLocal: '2026-09-07T13:00' })],
      sessions: [], busyWindows: [], planner: { events: [] },
      workWindows: [{ id: 'w', start: '2026-09-07T08:00:00Z', end: '2026-09-07T09:15:00Z' }],
      planningPreferences: { minimumMinutes: 15, sessionMinutes: 45, maximumMinutes: 60, breakMinutes: 0 },
    }
    const preview = createReplan(state, { now })
    expect(preview.ok).toBe(true)
    expect(preview.allocatedMinutes.a).toBe(75)
    expect(preview.deficits.a).toBe(15)
    expect(preview.totalMissingMinutes).toBe(15)
    const applied = applyReplan(state, preview, { now })
    expect(applied.ok).toBe(true)
    expect(applied.state.sessions).toHaveLength(2)
  })

  it('bevarer et mulig restintervall i omplanleggingsforslaget', () => {
    const state = {
      tasks: [task('a', { estimatedMinutes: null, remainingEstimate: { minMinutes: 60, maxMinutes: 120 }, deadlineLocal: '2026-09-07T13:00' })],
      sessions: [], busyWindows: [], planner: { events: [] },
      workWindows: [{ id: 'w', start: '2026-09-07T08:00:00Z', end: '2026-09-07T09:15:00Z' }],
      planningPreferences: { minimumMinutes: 15, sessionMinutes: 45, maximumMinutes: 60, breakMinutes: 0 },
    }
    const preview = createReplan(state, { now })
    expect(preview.deficitRanges.a).toEqual({ minMinutes: 0, maxMinutes: 45 })
    expect(preview).toMatchObject({ totalMissingMinMinutes: 0, totalMissingMaxMinutes: 45 })
    expect(preview.problems.join(' ')).toContain('opptil 45 min kan mangle')
  })

  it('bevarer kjent minimum når en åpen rest bare får en utforskende økt', () => {
    const state = {
      tasks: [task('a', { estimatedMinutes: null, remainingEstimate: { minMinutes: 241, maxMinutes: null }, deadlineLocal: '2026-09-07T13:00' })],
      sessions: [], busyWindows: [], planner: { events: [] },
      workWindows: [{ id: 'w', start: '2026-09-07T08:00:00Z', end: '2026-09-07T08:30:00Z' }],
      planningPreferences: { minimumMinutes: 15, sessionMinutes: 45, maximumMinutes: 60, breakMinutes: 0 },
    }
    const preview = createReplan(state, { now, exploratory: { a: 30 } })
    expect(preview.deficitRanges.a).toEqual({ minMinutes: 211, maxMinutes: null })
    expect(preview).toMatchObject({ totalMissingMinMinutes: 211, totalMissingMaxMinutes: null })
    expect(preview.problems.join(' ')).toContain('minst 211 min mangler')
  })
})

describe('lagringskontrakt for usikre anslag', () => {
  it('godtar intervall og manglende frist uten å gjøre ukjent til null', () => {
    expect(validTasks([task('a', { deadlineLocal: '', estimatedMinutes: undefined, remainingEstimate: { minMinutes: 30, maxMinutes: 60 }, deadlinePromptDismissed: true })])).toBe(true)
    expect(validTasks([task('b', { deadlineLocal: '', estimatedMinutes: undefined })])).toBe(true)
  })

  it('bevarer en åpen øvre grense for mer enn fire timer uten å dikte opp et maksimum', () => {
    expect(validTasks([task('a', { estimatedMinutes: null, remainingEstimate: { minMinutes: 241, maxMinutes: null } })])).toBe(true)
    expect(validTasks([task('b', { remainingMinutes: 90, remainingEstimate: { minMinutes: 60, maxMinutes: 120 } })])).toBe(false)
  })

  it('bevarer et intervall gjennom ordinær redigering når eksaktfeltet står urørt', () => {
    const saved = task('a', { estimatedMinutes: null, remainingEstimate: { minMinutes: 60, maxMinutes: 120 } })
    const result = editTask([saved], 'a', { ...saved, title: 'Rettet', remainingMinutes: '' })
    expect(result.ok).toBe(true)
    expect(result.tasks[0].remainingEstimate).toEqual({ minMinutes: 60, maxMinutes: 120 })
    expect(result.tasks[0].remainingMinutes).toBeUndefined()
  })
})
