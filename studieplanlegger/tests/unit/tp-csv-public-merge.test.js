import { describe, expect, it } from 'vitest'
import { emptyPlanner, mergeCourseOnly, mergeImport, validPlanner } from '../../src/planner.js'

const provisional = () => ({
  id: 'synthetic-local-course', code: 'SYN742', name: '', nameStatus: 'provisional', university: 'NTNU', semester: 'autumn', year: 2041,
  credits: null, description: '', notes: 'Syntetisk lokalt notat',
})
const named = () => ({
  id: 'synthetic-public-course', code: 'SYN742', name: 'Syntetisk publisert emnenavn', university: 'NTNU', semester: 'autumn', year: 2041,
  credits: 7.5, description: 'Syntetisk emnebeskrivelse',
})
const plannerWith = course => ({
  ...emptyPlanner(), courses: [course],
  events: [{ id: 'synthetic-linked-event', courseId: course.id, title: 'Syntetisk aktivitet', start: '2041-11-11T10:00:07Z', end: '2041-11-11T10:00:17Z', importSourceId: 'synthetic-document', importEntryKey: 'synthetic-entry' }],
})
const routes = [
  ['metadata', (planner, course) => mergeCourseOnly(planner, course)],
  ['calendar', (planner, course) => mergeImport(planner, [], {
    id: 'synthetic-calendar-source', courseId: planner.courses[0].id, kind: 'file', name: 'Syntetisk kalender', groups: [], lastUpdated: '2041-10-01T10:00:00Z',
  }, { course: { ...course, id: planner.courses[0].id }, authoritative: false }).planner],
]

describe.each(routes)('%s import after a provisional CSV course', (_route, merge) => {
  it('confirms the accepted actual name and preserves the course identity, links and local notes', () => {
    const original = plannerWith(provisional()), before = structuredClone(original)
    expect(validPlanner(original)).toBe(true)
    const result = merge(original, named())
    expect(result.courses).toHaveLength(1)
    expect(result.courses[0]).toMatchObject({ id: 'synthetic-local-course', name: 'Syntetisk publisert emnenavn', nameStatus: 'confirmed', notes: 'Syntetisk lokalt notat', sourceBase: { name: 'Syntetisk publisert emnenavn' } })
    expect(result.events).toEqual(original.events)
    expect(validPlanner(result)).toBe(true)
    expect(original).toEqual(before)
    const repeated = merge(result, named())
    expect(repeated.courses).toEqual(result.courses)
    expect(repeated.events).toEqual(result.events)
    expect(validPlanner(repeated)).toBe(true)
  })

  it('preserves a manually accepted name when the public source changes', () => {
    const original = plannerWith({ ...provisional(), name: 'Syntetisk manuelt valgt navn', nameStatus: 'confirmed', sourceBase: { name: 'Syntetisk tidligere kildenavn', credits: null, description: '' } })
    const result = merge(original, named())
    expect(result.courses[0]).toMatchObject({ id: original.courses[0].id, name: 'Syntetisk manuelt valgt navn', nameStatus: 'confirmed', sourceBase: { name: 'Syntetisk publisert emnenavn' } })
    expect(result.courses[0].conflict).toContain('name')
    expect(result.events).toEqual(original.events)
    expect(validPlanner(result)).toBe(true)
  })

  it('retains provisional status when the source still has no actual name', () => {
    const original = plannerWith(provisional())
    const result = merge(original, { ...named(), name: '' })
    expect(result.courses[0]).toMatchObject({ id: original.courses[0].id, name: '', nameStatus: 'provisional', credits: 7.5 })
    expect(result.events).toEqual(original.events)
    expect(validPlanner(result)).toBe(true)
  })
})
