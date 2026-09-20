import { describe, expect, it, vi } from 'vitest'
import {
  clearNextStep, completeNextStep, editTask, getActionMinutes, isOverdue, overdueCount,
  selectTasksForMinutes, setNextStep, setTaskCompleted, setTaskSubmitted, sortedTasks,
  tasksThisWeek, validateDraft, validateNextStepDraft, validTasks,
} from '../../src/tasks.js'
import { createStorage, STORAGE_KEY } from '../../src/storage.js'

const makeTask = (id = 'rapport', patch = {}) => ({
  id, title: 'Skriv rapport i IBE160', course: 'IBE160', deadlineLocal: '2026-09-10T12:00',
  estimatedMinutes: 240, completed: false, ...patch,
})
const step = { description: 'Les oppgaveteksten og lag en disposisjon', estimatedMinutes: 20 }
const draft = task => ({ ...task, estimatedMinutes: String(task.estimatedMinutes) })
const ids = tasks => tasks.map(task => task.id)

describe('ett aktivt neste steg', () => {
  it('trimmer beskrivelse og deler den eksisterende regelen for positive hele minutter', () => {
    expect(validateNextStepDraft({ description: ' Les oppgaveteksten ', estimatedMinutes: '020' }))
      .toEqual({ ok: true, nextStep: { description: 'Les oppgaveteksten', estimatedMinutes: 20 } })
    expect(validateNextStepDraft({ description: 'Les', estimatedMinutes: String(Number.MAX_SAFE_INTEGER) }).ok).toBe(true)
    expect(validateNextStepDraft({ description: ' ', estimatedMinutes: '0' })).toEqual({
      ok: false, errors: { description: expect.any(String), estimatedMinutes: expect.any(String) },
    })
  })

  it.each(['', ' ', '0', '-1', '1.5', '1e2', '20 ', ' 20', 'Infinity', '9007199254740992', 20, null, undefined])(
    'avviser ugyldig stegvarighet %j uten å endre lagrede oppgaver', estimatedMinutes => {
      const saved = Object.freeze(makeTask())
      const tasks = Object.freeze([saved])
      const result = setNextStep(tasks, saved.id, { description: step.description, estimatedMinutes })
      expect(result.ok).toBe(false)
      expect(result.errors.estimatedMinutes).toEqual(expect.any(String))
      expect(tasks).toEqual([makeTask()])
    },
  )

  it.each(['', ' ', null, undefined, 12])('avviser tom eller ugyldig stegbeskrivelse %j', description => {
    expect(validateNextStepDraft({ description, estimatedMinutes: '20' }).errors.description).toEqual(expect.any(String))
  })

  it('oppretter, erstatter, fullfører og legger inn et nytt steg uten andre status- eller estimatendringer', () => {
    const saved = Object.freeze(makeTask('valgt["id"]', { requiresSubmission: true, submitted: false }))
    const tasks = Object.freeze([Object.freeze(makeTask('først')), saved, Object.freeze(makeTask('sist'))])
    const added = setNextStep(tasks, saved.id, { ...step, estimatedMinutes: '20' })
    expect(added).toEqual({ ok: true, tasks: [tasks[0], { ...saved, nextStep: step }, tasks[2]] })
    expect(tasks[1]).not.toHaveProperty('nextStep')

    const edited = setNextStep(added.tasks, saved.id, { description: ' Skriv innledningen ', estimatedMinutes: '30' })
    expect(edited.tasks[1].nextStep).toEqual({ description: 'Skriv innledningen', estimatedMinutes: 30 })
    expect(added.tasks[1].nextStep).toEqual(step)
    const completed = completeNextStep(edited.tasks, saved.id)
    expect(completed.tasks).toEqual(tasks)
    expect(completed.tasks[1]).not.toHaveProperty('nextStep')
    expect(completed.tasks[1]).toMatchObject({ completed: false, submitted: false, estimatedMinutes: 240 })

    const next = setNextStep(completed.tasks, saved.id, { description: 'Finn en kilde', estimatedMinutes: '10' })
    expect(next.tasks[1].nextStep.description).toBe('Finn en kilde')
    expect(clearNextStep(next.tasks, saved.id).tasks).toEqual(tasks)
    expect(validTasks(next.tasks)).toBe(true)
    expect(ids(next.tasks)).toEqual(ids(tasks))
  })

  it.each([clearNextStep, completeNextStep])('fjerner bare steget, også fra en allerede levert oppgave', action => {
    const saved = Object.freeze(makeTask('a', { completed: true, requiresSubmission: true, submitted: true, nextStep: Object.freeze(step) }))
    const result = action(Object.freeze([saved]), saved.id)
    expect(result.tasks[0]).toEqual(makeTask('a', { completed: true, requiresSubmission: true, submitted: true }))
    expect(saved.nextStep).toEqual(step)
    expect(validTasks(result.tasks)).toBe(true)
  })

  it('avviser manglende ID og lar manglende steg være uten betydning for hovedoppgaven', () => {
    const tasks = [makeTask()]
    expect(setNextStep(tasks, 'missing', { ...step, estimatedMinutes: '20' })).toEqual({ ok: false, reason: 'not-found' })
    expect(clearNextStep(tasks, 'missing')).toEqual({ ok: false, reason: 'not-found' })
    expect(completeNextStep(tasks, 'missing')).toEqual({ ok: false, reason: 'not-found' })
    expect(completeNextStep(tasks, tasks[0].id).tasks).toEqual(tasks)
  })

  it('beholder steg og manuell leveringsstatus ved vanlig redigering', () => {
    const saved = makeTask('a', { nextStep: step, completed: true, requiresSubmission: true, submitted: true })
    const result = editTask([saved], saved.id, { ...draft(saved), title: 'Rettet rapport', nextStep: null, submitted: false })
    expect(result.tasks[0]).toEqual({ ...saved, title: 'Rettet rapport' })
  })
})

describe('hovedforslag og alternativer fra samme fristsorterte utvalg', () => {
  it('bruker registrert neste steg når det finnes, sorterer på frist og ekskluderer ferdig arbeid', () => {
    const tasks = Object.freeze([
      makeTask('senere-steg', { nextStep: step }),
      makeTask('stor-forfalt', { deadlineLocal: '2026-01-01T12:00' }),
      makeTask('steg-for-stort', { estimatedMinutes: 10, nextStep: { ...step, estimatedMinutes: 31 } }),
      makeTask('kort-hovedoppgave', { estimatedMinutes: 30, deadlineLocal: '2026-09-09T12:00' }),
      makeTask('første-steg', { nextStep: { ...step, estimatedMinutes: 30 }, deadlineLocal: '2026-09-08T12:00' }),
      makeTask('ferdig-steg', { nextStep: step, completed: true, deadlineLocal: '2026-09-07T12:00' }),
      makeTask('klar-til-levering', { nextStep: step, completed: true, requiresSubmission: true, submitted: false }),
      makeTask('uten-steg', { nextStep: null, estimatedMinutes: 20, deadlineLocal: '2026-09-11T12:00' }),
    ])
    const original = JSON.stringify(tasks)
    const candidates = selectTasksForMinutes(tasks, 30)
    expect(ids(candidates)).toEqual(['første-steg', 'kort-hovedoppgave', 'senere-steg', 'uten-steg'])
    expect(getActionMinutes(candidates[0])).toBe(30)
    expect(candidates[0].estimatedMinutes).toBe(240)
    expect(getActionMinutes(candidates[1])).toBe(30)
    expect(JSON.stringify(tasks)).toBe(original)
  })

  it('holder stabil rekkefølge ved like frister, også etter stegbytte, fullføring og gjenåpning', () => {
    const tasks = [makeTask('først', { remainingMinutes: 20, nextStep: step }), makeTask('andre', { estimatedMinutes: 15 }), makeTask('tredje', { remainingMinutes: 20, nextStep: step })]
    expect(ids(selectTasksForMinutes(tasks, 20))).toEqual(['først', 'andre', 'tredje'])
    const edited = setNextStep(tasks, 'først', { description: 'Les', estimatedMinutes: '15' }).tasks
    const done = completeNextStep(edited, 'først').tasks
    expect(ids(selectTasksForMinutes(done, 20))).toEqual(['først', 'andre', 'tredje'])
    const added = setNextStep(done, 'først', { description: 'Skriv', estimatedMinutes: '20' }).tasks
    const reopened = createStorage(() => ({ getItem: () => JSON.stringify({ schemaVersion: 1, tasks: added }) })).read().tasks
    expect(ids(selectTasksForMinutes(reopened, 20))).toEqual(['først', 'andre', 'tredje'])
  })

  it('tomt tidsutvalg skjuler ingen store, nære eller forfalte oppgaver fra fristoversiktene', () => {
    const tasks = [
      makeTask('forfalt', { deadlineLocal: '2026-09-07T12:00' }),
      makeTask('nær', { deadlineLocal: '2026-09-09T12:01' }),
      makeTask('stor', { deadlineLocal: '2026-09-13T12:00', estimatedMinutes: 480 }),
      makeTask('gammel', { deadlineLocal: '2026-08-01T12:00' }),
      makeTask('klar', { completed: true, requiresSubmission: true, submitted: false }),
    ]
    const now = new Date('2026-09-09T12:00:00')
    expect(selectTasksForMinutes(tasks, 20)).toEqual([])
    expect(ids(tasksThisWeek(tasks, now))).toEqual(['forfalt', 'nær', 'klar', 'stor'])
    expect(ids(sortedTasks(tasks))).toEqual(['gammel', 'forfalt', 'nær', 'klar', 'stor'])
    expect(overdueCount(tasks, now)).toBe(2)
    expect(ids(selectTasksForMinutes(setNextStep(tasks, 'stor', { ...step, estimatedMinutes: '20' }).tasks, 20))).toEqual(['stor'])
    expect(ids(selectTasksForMinutes(tasks, 240))).toEqual(['gammel', 'forfalt', 'nær'])
  })
})

describe('ferdig arbeid og bekreftet levering', () => {
  it('nye innleveringer starter uferdige og uten leveringsbekreftelse', () => {
    expect(validateDraft(draft(makeTask('a', { requiresSubmission: true, submitted: true, completed: true }))).task)
      .toEqual(makeTask('a', { requiresSubmission: true, submitted: false }))
    expect(validateDraft(draft(makeTask('a', { requiresSubmission: false }))).task)
      .toEqual(makeTask('a', { requiresSubmission: false, submitted: false }))
    expect(validateDraft(draft(makeTask('a', { requiresSubmission: 'true' }))).errors.requiresSubmission).toEqual(expect.any(String))
  })

  it('lar brukeren fullføre, bekrefte levering, angre levering og åpne arbeidet igjen', () => {
    const saved = Object.freeze(makeTask('a', { requiresSubmission: true, submitted: false, nextStep: Object.freeze(step) }))
    const tasks = Object.freeze([saved, Object.freeze(makeTask('b'))])
    const now = new Date('2026-09-10T12:00:00.001')
    const finished = setTaskCompleted(tasks, saved.id, true).tasks
    expect(finished[0]).toEqual({ ...saved, completed: true })
    expect(isOverdue(finished[0], now)).toBe(true)
    expect(selectTasksForMinutes(finished, 20)).toEqual([])
    expect(tasksThisWeek(finished, now)).toContainEqual(finished[0])

    const submitted = setTaskSubmitted(finished, saved.id, true).tasks
    expect(submitted[0]).toEqual({ ...saved, completed: true, submitted: true })
    expect(isOverdue(submitted[0], now)).toBe(false)
    expect(setTaskCompleted(submitted, saved.id, false)).toEqual({ ok: false, reason: 'submitted' })
    expect(editTask(submitted, saved.id, { ...draft(submitted[0]), requiresSubmission: false })).toEqual({
      ok: false, reason: 'submitted', errors: { requiresSubmission: expect.any(String) },
    })
    const undone = setTaskSubmitted(submitted, saved.id, false).tasks
    expect(undone[0]).toEqual(finished[0])
    expect(isOverdue(undone[0], now)).toBe(true)
    expect(setTaskCompleted(undone, saved.id, false).tasks).toEqual(tasks)
    expect(ids(undone)).toEqual(ids(tasks))
    expect(tasks[0]).toEqual(saved)
  })

  it('utleder aldri levering fra en eldre fullførtmarkering eller et nytt innleveringskrav', () => {
    const legacy = makeTask('a', { completed: true })
    const changed = editTask([legacy], legacy.id, { ...draft(legacy), requiresSubmission: true }).tasks[0]
    expect(changed).toEqual({ ...legacy, requiresSubmission: true, submitted: false })
    expect(isOverdue(legacy, new Date('2026-09-11T12:00:00'))).toBe(false)
    expect(isOverdue(changed, new Date('2026-09-11T12:00:00'))).toBe(true)
    const ordinary = editTask([changed], changed.id, { ...draft(changed), requiresSubmission: false }).tasks[0]
    expect(ordinary.completed).toBe(true)
    expect(isOverdue(ordinary, new Date('2026-09-11T12:00:00'))).toBe(false)
  })

  it('beholder eldre oppgavers feltsett når redigeringsskjemaet sender et uendret innleveringskrav', () => {
    const legacy = Object.freeze(makeTask('a', { completed: true, nextStep: Object.freeze(step) }))
    const result = editTask(Object.freeze([legacy]), legacy.id, {
      ...draft(legacy), title: 'Rettet rapport', requiresSubmission: false,
    })
    expect(result.tasks[0]).toEqual({ ...legacy, title: 'Rettet rapport' })
    expect(result.tasks[0]).not.toHaveProperty('requiresSubmission')
    expect(result.tasks[0]).not.toHaveProperty('submitted')
    expect(validTasks(result.tasks)).toBe(true)
  })

  it('ferdig innlevering er ikke forfalt før eller nøyaktig på fristen', () => {
    const ready = makeTask('a', { completed: true, requiresSubmission: true, submitted: false })
    expect(isOverdue(ready, new Date('2026-09-10T11:59:59.999'))).toBe(false)
    expect(isOverdue(ready, new Date('2026-09-10T12:00:00'))).toBe(false)
    expect(isOverdue(ready, new Date('2026-09-10T12:00:00.001'))).toBe(true)
  })

  it('avviser levering uten innleveringskrav eller ferdig arbeid og avviser ukjent ID/ugyldig status', () => {
    const tasks = [makeTask('vanlig'), makeTask('innlevering', { requiresSubmission: true, submitted: false })]
    expect(setTaskSubmitted(tasks, 'vanlig', true)).toEqual({ ok: false, reason: 'invalid' })
    expect(setTaskSubmitted(tasks, 'innlevering', true)).toEqual({ ok: false, reason: 'unfinished' })
    expect(setTaskSubmitted(tasks, 'missing', true)).toEqual({ ok: false, reason: 'not-found' })
    for (const value of [undefined, null, 0, 'true']) expect(setTaskSubmitted(tasks, 'innlevering', value)).toEqual({ ok: false, reason: 'invalid' })
    expect(setTaskCompleted(tasks, 'vanlig', true).tasks[0]).toEqual({ ...tasks[0], completed: true })
  })
})

describe('bakoverkompatibel v1-lagring', () => {
  it('leser en blanding av eldre, nye og ferdige oppgaver uten migrering eller automatisk leveringsbekreftelse', () => {
    const tasks = [makeTask('eldre-ferdig', { completed: true }), makeTask('eldre-uferdig'),
      makeTask('steg', { nextStep: step, requiresSubmission: true, submitted: false }),
      makeTask('klar', { completed: true, requiresSubmission: true }),
      makeTask('levert', { completed: true, requiresSubmission: true, submitted: true }),
      makeTask('uten-steg', { nextStep: null, requiresSubmission: false, submitted: false }),
    ]
    let raw = JSON.stringify({ schemaVersion: 1, tasks })
    const backing = { getItem: () => raw, setItem: vi.fn((key, value) => { expect(key).toBe(STORAGE_KEY); raw = value }) }
    const storage = createStorage(() => backing)
    expect(storage.read()).toEqual({ ok: true, tasks })
    expect(storage.read().tasks[0]).not.toHaveProperty('submitted')
    expect(backing.setItem).not.toHaveBeenCalled()
    const changed = setNextStep(storage.read().tasks, 'eldre-uferdig', { ...step, estimatedMinutes: '20' }).tasks
    expect(storage.write(changed)).toEqual({ ok: true })
    expect(JSON.parse(raw).schemaVersion).toBe(1)
    expect(createStorage(() => backing).read()).toEqual({ ok: true, tasks: changed })
    expect(backing.setItem).toHaveBeenCalledTimes(1)
    expect(changed[0]).toEqual(tasks[0])
  })

  it.each([
    { nextStep: [] }, { nextStep: 'Les' }, { nextStep: {} },
    { nextStep: { ...step, description: ' ' } }, { nextStep: { ...step, description: ' Les ' } },
    { nextStep: { ...step, estimatedMinutes: '20' } }, { nextStep: { ...step, estimatedMinutes: 0 } },
    { nextStep: { ...step, estimatedMinutes: 1.5 } }, { nextStep: { ...step, estimatedMinutes: Number.MAX_SAFE_INTEGER + 1 } },
    { requiresSubmission: null }, { requiresSubmission: 'true' }, { submitted: 'false' },
    { submitted: true }, { requiresSubmission: true, submitted: true, completed: false },
  ])('bevarer rådata med ugyldige nye felt %j og blokkerer skriving', patch => {
    const tasks = [makeTask('a', patch)]
    const raw = JSON.stringify({ schemaVersion: 1, tasks })
    const backing = { getItem: () => raw, setItem: vi.fn() }
    const storage = createStorage(() => backing)
    expect(validTasks(tasks)).toBe(false)
    expect(storage.read()).toEqual({ ok: false, reason: 'invalid' })
    expect(storage.write(tasks)).toEqual({ ok: false, reason: 'invalid' })
    expect(backing.getItem()).toBe(raw)
    expect(backing.setItem).not.toHaveBeenCalled()
  })

  it.each(['set-step', 'clear-step', 'complete-step', 'complete-work', 'submit', 'undo-submit'])(
    'lagrer hele %s-kandidaten én gang, bevarer gamle data ved skrivefeil og støtter nytt forsøk', action => {
      const saved = [makeTask('a', { nextStep: step, requiresSubmission: true, submitted: action === 'undo-submit', completed: true }), makeTask('b')]
      let raw = JSON.stringify({ schemaVersion: 1, tasks: saved })
      const original = raw
      let fail = true
      const backing = { getItem: () => raw, setItem: vi.fn((_key, value) => { if (fail) throw Error('blocked'); raw = value }) }
      const storage = createStorage(() => backing)
      const mutations = {
        'set-step': () => setNextStep(saved, 'a', { description: 'Ny handling', estimatedMinutes: '10' }),
        'clear-step': () => clearNextStep(saved, 'a'),
        'complete-step': () => completeNextStep(saved, 'a'),
        'complete-work': () => setTaskCompleted(saved, 'b', true),
        submit: () => setTaskSubmitted(saved, 'a', true),
        'undo-submit': () => setTaskSubmitted(saved, 'a', false),
      }
      const candidate = mutations[action]().tasks
      expect(storage.write(candidate)).toEqual({ ok: false, reason: 'unwritable' })
      expect(raw).toBe(original)
      expect(storage.read()).toEqual({ ok: true, tasks: saved })
      fail = false
      expect(storage.write(candidate)).toEqual({ ok: true })
      expect(storage.read()).toEqual({ ok: true, tasks: candidate })
      expect(backing.setItem).toHaveBeenCalledTimes(2)
    },
  )
})
