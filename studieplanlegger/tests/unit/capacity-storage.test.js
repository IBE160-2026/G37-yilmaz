import { expect, it, vi } from 'vitest'
import { createStorage } from '../../src/storage.js'
import { validateDraft, validTasks, editTask, getRemainingMinutes, selectTasksForMinutes,
  setTaskCompleted, setTaskSubmitted, setNextStep, completeNextStep, deleteTask } from '../../src/tasks.js'

const task = { id: 'work', title: 'Arbeid', course: 'IBE160', deadlineLocal: '2026-09-10T12:00', estimatedMinutes: 90, completed: false }
const session = { id: 'study', dateLocal: '2026-09-09', startTime: '10:00', endTime: '11:00' }

it('accepts optional zero remaining, validates numeric draft input and keeps legacy absence', () => {
  const draft = { ...task, estimatedMinutes: '90' }
  expect(validateDraft(draft).task).toEqual(task)
  expect(validateDraft({ ...draft, remainingMinutes: '' }).task).toEqual({ ...task, remainingMinutes: null })
  expect(validateDraft({ ...draft, remainingMinutes: '0' }).task).toEqual({ ...task, remainingMinutes: 0 })
  for (const value of ['-1', '1.5', ' 3', '3 ', '1e3', '9007199254740992']) {
    expect(validateDraft({ ...draft, remainingMinutes: value }).ok).toBe(false)
  }
  for (const value of [-1, 1.5, '30', Number.MAX_SAFE_INTEGER + 1]) expect(validTasks([{ ...task, remainingMinutes: value }])).toBe(false)
})

it('uses remaining work for quick suggestions and active next step once, excluding explicit zero', () => {
  const work = { ...task, remainingMinutes: 20 }
  expect(selectTasksForMinutes([work], 20)).toEqual([work])
  expect(selectTasksForMinutes([{ ...work, nextStep: { description: 'Stort steg', estimatedMinutes: 25 } }], 20)).toHaveLength(0)
  expect(selectTasksForMinutes([{ ...work, remainingMinutes: 0, nextStep: { description: 'Steg', estimatedMinutes: 10 } }], 20)).toEqual([])
  expect(getRemainingMinutes({ ...work, completed: true })).toBe(0)
})

it('retains remaining estimate through step, completion, undo and submission transitions; empty edit explicitly means unknown', () => {
  const source = [{ ...task, remainingMinutes: 45, requiresSubmission: true }]
  const step = setNextStep(source, task.id, { description: 'Les', estimatedMinutes: '10' }).tasks
  expect(completeNextStep(step, task.id).tasks).toEqual(source)
  const done = setTaskCompleted(source, task.id, true).tasks
  expect(done[0].remainingMinutes).toBe(45)
  expect(setTaskCompleted(done, task.id, false).tasks).toEqual(source)
  expect(setTaskSubmitted(done, task.id, true).tasks[0].remainingMinutes).toBe(45)
  const edited = editTask(source, task.id, { ...task, estimatedMinutes: '90', remainingMinutes: '', requiresSubmission: true })
  expect(edited.tasks[0].remainingMinutes).toBeNull()
  expect(source[0].remainingMinutes).toBe(45)
})

it('reads new and old envelopes without a write, validates sessions atomically and preserves raw on failure', () => {
  const initial = { schemaVersion: 1, tasks: [{ ...task, remainingMinutes: 30 }], sessions: [session] }
  let raw = JSON.stringify(initial)
  let fail = false
  const backing = { getItem: () => raw, setItem: vi.fn((key, value) => { if (fail) throw Error('unavailable'); raw = value }) }
  const storage = createStorage(() => backing)
  expect(storage.read()).toEqual({ ok: true, tasks: initial.tasks, sessions: initial.sessions })
  expect(backing.setItem).not.toHaveBeenCalled()
  expect(storage.write(initial.tasks, [session, { ...session, id: 'invalid', endTime: '09:00' }]).ok).toBe(false)
  expect(backing.setItem).not.toHaveBeenCalled()
  fail = true
  expect(storage.write(initial.tasks, []).reason).toBe('unwritable')
  expect(JSON.parse(raw)).toEqual(initial)
  fail = false
  expect(storage.write(initial.tasks, []).ok).toBe(true)
  expect(JSON.parse(raw).sessions).toEqual([])
  expect(storage.write([task]).ok).toBe(true)
  expect(JSON.parse(raw)).toEqual({ schemaVersion: 1, tasks: [task] })
})

it('existing immutable actions preserve sessions when the controller writes the complete envelope', () => {
  let raw = JSON.stringify({ schemaVersion: 1, tasks: [task], sessions: [session] })
  const storage = createStorage(() => ({ getItem: () => raw, setItem: (key, value) => { raw = value } }))
  let state = storage.read()
  for (const change of [tasks => editTask(tasks, task.id, { ...task, title: 'Endret', estimatedMinutes: '90', remainingMinutes: '35' }),
    tasks => setNextStep(tasks, task.id, { description: 'Les', estimatedMinutes: '10' }),
    tasks => completeNextStep(tasks, task.id), tasks => setTaskCompleted(tasks, task.id, true), tasks => deleteTask(tasks, task.id)]) {
    const result = change(state.tasks)
    expect(result.ok).toBe(true)
    expect(storage.write(result.tasks, state.sessions).ok).toBe(true)
    state = storage.read()
    expect(state.sessions).toEqual([session])
  }
})

it.each([null, {}, [{ ...session, endTime: '09:00' }], [session, session]])('blocks invalid saved sessions %j without rewriting', sessions => {
  const backing = { getItem: () => JSON.stringify({ schemaVersion: 1, tasks: [task], sessions }), setItem: vi.fn() }
  expect(createStorage(() => backing).read()).toEqual({ ok: false, reason: 'invalid' })
  expect(backing.setItem).not.toHaveBeenCalled()
})
