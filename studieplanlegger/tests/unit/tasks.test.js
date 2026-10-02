import { it, expect } from 'vitest'
import { validDeadline, validateDraft, validTasks, sortedTasks, editTask, deleteTask, deadlineInstant, tasksThisWeek, setNextStep } from '../../src/tasks.js'
const draft = { id: 'a', title: ' Title ', course: ' Course ', deadlineLocal: '2026-09-10T12:30', estimatedMinutes: '45' }
const task = () => validateDraft(draft).task
it('clears an existing waiting bypass when the same next step is edited with the checkbox unchecked', () => {
  const initial = setNextStep([task()], 'a', { description: 'Kontakt gruppen', estimatedMinutes: '10', unblocksWaiting: true })
  expect(initial.ok).toBe(true)
  const updated = setNextStep(initial.tasks, 'a', { description: 'Kontakt gruppen', estimatedMinutes: '10', unblocksWaiting: false })
  expect(updated.ok).toBe(true)
  expect(updated.tasks[0].steps[0]).toMatchObject({ id: initial.tasks[0].steps[0].id, unblocksWaiting: false })
})
it('uses Oslo', () => expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Oslo'))
it.each(['2026-02-30T12:00', '2026-03-29T02:30', '2026-09-10T', '2026-13-01T12:00', '2026-01-01T24:00', '', null])('rejects deadline %s', value => expect(validDeadline(value)).toBe(false))
it.each(['2026-09-10', '2024-02-29T12:00', '2026-10-25T02:30', '2026-01-01T00:00'])('accepts deadline %s', value => expect(validDeadline(value)).toBe(true))
it('trims and creates unfinished', () => expect(task()).toEqual({ ...draft, title: 'Title', course: 'Course', estimatedMinutes: 45, completed: false }))
it.each(['0', '-1', '1.5', '9007199254740992', '1e2', ' '])('rejects minutes %s', value => expect(validateDraft({ ...draft, estimatedMinutes: value }).errors.estimatedMinutes).toBeTruthy())
it.each(['1', '9007199254740991'])('accepts minutes %s', value => expect(validateDraft({ ...draft, estimatedMinutes: value }).ok).toBe(true))
it('requires only a title, allowing unassigned course, unknown time and deadline', () => expect(Object.keys(validateDraft({ title: ' ', course: '', deadlineLocal: '', estimatedMinutes: '' }).errors)).toEqual(['title']))
it.each([{ id: '' }, { id: ' ' }, { title: ' Title' }, { course: null }, { completed: 0 }, { estimatedMinutes: '1' }, { estimatedMinutes: 0 }, { deadlineLocal: '2026-03-29T02:30' }])('rejects stored field %j', patch => expect(validTasks([{ ...task(), ...patch }])).toBe(false))
it('rejects containers and duplicate ids', () => {
  for (const value of [null, {}, [null], [task(), task()]]) expect(validTasks(value)).toBe(false)
  expect(validTasks([])).toBe(true)
})
it('sorts a copy stably', () => {
  const tasks = Object.freeze([task(), { ...task(), id: 'b', deadlineLocal: '2026-01-01T00:00' }, { ...task(), id: 'c' }])
  expect(sortedTasks(tasks).map(t => t.id)).toEqual(['b', 'a', 'c'])
  expect(tasks.map(t => t.id)).toEqual(['a', 'b', 'c'])
})

it('uses the exclusive next Oslo midnight for date-only deadlines and orders mixed boundaries', () => {
  expect(new Date(deadlineInstant('2026-07-01')).toISOString()).toBe('2026-07-01T22:00:00.000Z')
  expect(new Date(deadlineInstant('2026-12-01')).toISOString()).toBe('2026-12-01T23:00:00.000Z')
  const dateOnly = { ...task(), id: 'date', deadlineLocal: '2026-07-01' }, timed = { ...task(), id: 'timed', deadlineLocal: '2026-07-01T23:00' }
  expect(sortedTasks([dateOnly, timed]).map(item => item.id)).toEqual(['timed', 'date'])
  expect(tasksThisWeek([{ ...dateOnly, deadlineLocal: '2026-07-05' }], new Date('2026-07-01T12:00:00Z'))).toHaveLength(1)
})

it('edits only the selected ID, retaining identity, completed status and storage position', () => {
  const tasks = Object.freeze([
    Object.freeze({ ...task(), id: 'first' }),
    Object.freeze({ ...task(), id: 'selected', completed: true }),
    Object.freeze({ ...task(), id: 'last' }),
  ])
  const result = editTask(tasks, 'selected', {
    ...draft, id: 'replacement-id', completed: false, title: ' Rettet ', course: ' IBE200 ',
    deadlineLocal: '2026-09-01T13:45', estimatedMinutes: '90',
  })
  expect(result).toEqual({ ok: true, tasks: [tasks[0], {
    id: 'selected', title: 'Rettet', course: 'IBE200', deadlineLocal: '2026-09-01T13:45',
    estimatedMinutes: 90, completed: true,
  }, tasks[2]] })
  expect(tasks[1]).toEqual({ ...task(), id: 'selected', completed: true })
  expect(sortedTasks(result.tasks).map(task => task.id)).toEqual(['selected', 'first', 'last'])
  expect(result.tasks.map(task => task.id)).toEqual(['first', 'selected', 'last'])
  expect(validTasks(result.tasks)).toBe(true)
})

it.each([
  { title: '' }, { title: '   ' }, { course: 42 },
  { deadlineLocal: '2026-02-30T12:00' }, { deadlineLocal: '2026-03-29T02:30' },
  { estimatedMinutes: '0' }, { estimatedMinutes: '-1' },
  { estimatedMinutes: '1.5' }, { estimatedMinutes: '9007199254740992' },
])('invalid edit shares create errors and leaves the saved task unchanged: %j', patch => {
  const saved = Object.freeze({ ...task(), completed: true })
  const tasks = Object.freeze([saved])
  const changedDraft = { ...draft, ...patch }
  expect(editTask(tasks, saved.id, changedDraft)).toEqual(validateDraft(changedDraft))
  expect(tasks).toEqual([{ ...task(), completed: true }])
})

it('keeps tie ordering and an unfinished status when editing', () => {
  const tasks = [task(), { ...task(), id: 'second' }]
  const result = editTask(tasks, 'a', { ...draft, title: 'Rettet' })
  expect(result.tasks[0].completed).toBe(false)
  expect(sortedTasks(result.tasks).map(task => task.id)).toEqual(['a', 'second'])
})

it('deletes the exact ID immutably and retains remaining values and order', () => {
  const tasks = Object.freeze([
    Object.freeze(task()),
    Object.freeze({ ...task(), id: 'a["quoted"]', completed: true }),
    Object.freeze({ ...task(), id: 'last' }),
  ])
  expect(deleteTask(tasks, 'a["quoted"]')).toEqual({ ok: true, tasks: [tasks[0], tasks[2]] })
  expect(tasks).toHaveLength(3)
  expect(deleteTask([tasks[1]], tasks[1].id)).toEqual({ ok: true, tasks: [] })
})

it('rejects a missing target without editing or deleting another task', () => {
  const tasks = Object.freeze([Object.freeze(task())])
  expect(editTask(tasks, 'missing', draft)).toEqual({ ok: false, reason: 'not-found' })
  expect(deleteTask(tasks, 'missing')).toEqual({ ok: false, reason: 'not-found' })
  expect(tasks).toEqual([task()])
})
