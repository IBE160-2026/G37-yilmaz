import { describe, it, expect } from 'vitest'
import { validateEvent, validPlanner, emptyPlanner } from '../../src/planner.js'

describe('unassigned imported event editing', () => {
  const previous = { id: 'synthetic-event', importSourceId: 'synthetic-file', importEntryKey: 'uid:synthetic', courseId: '', title: 'Forelesning', start: '2026-10-20T08:00:00Z', end: '2026-10-20T09:00:00Z', notes: '', sourceBase: { title: 'Forelesning' } }
  const draft = { title: 'Forelesning', courseId: '', startLocal: '2026-10-20T10:00', endLocal: '2026-10-20T11:00', notes: 'Eget notat' }
  it('retains unknown course, import identity and time while editing notes', () => {
    const edited = validateEvent(draft, previous)
    expect(edited).toMatchObject({ ...previous, notes: 'Eget notat' })
    expect(validPlanner({ ...emptyPlanner(), events: [edited] })).toBeTruthy()
    expect(previous.notes).toBe('')
  })
  it('does not admit unassigned new teaching or incomplete import identity', () => {
    expect(() => validateEvent(draft)).toThrow('Velg et emne')
    expect(() => validateEvent(draft, { ...previous, importEntryKey: undefined })).toThrow('Velg et emne')
    expect(() => validateEvent(draft, { ...previous, importSourceId: undefined, sourceId: 'legacy' })).toThrow('Velg et emne')
  })
  it('still rejects invalid times for an unassigned import', () => {
    expect(() => validateEvent({ ...draft, endLocal: draft.startLocal }, previous)).toThrow('Slutt må være etter start')
  })
})

it('preserves exact repeated-hour instants for unchanged inputs but rejects changed ambiguous values', () => {
  const previous = { id: 'dst', importSourceId: 'file', importEntryKey: 'uid:dst', courseId: '', title: 'Repeated hour', start: '2026-10-25T00:15:37Z', end: '2026-10-25T01:45:23Z' }
  const draft = { title: previous.title, courseId: '', startLocal: '2026-10-25T02:15:37', endLocal: '2026-10-25T02:45:23', notes: 'Only notes' }
  expect(validateEvent(draft, previous)).toMatchObject({ ...previous, notes: 'Only notes' })
  expect(() => validateEvent({ ...draft, startLocal: '2026-10-25T02:20' }, previous)).toThrow('tvetydig')
  expect(() => validateEvent({ ...draft, endLocal: '2026-10-25T02:50' }, previous)).toThrow('tvetydig')
})
