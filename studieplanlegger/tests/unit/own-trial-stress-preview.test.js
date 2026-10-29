import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { emptyPlanner } from '../../src/planner.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, chooseDocumentCourse } from '../../src/import-preview.js'
import { stressCalendar, stressCourses, stressCourseCode } from '../fixtures/stress-calendar.js'

const parse = calendar => ({ ...parseDocumentIcs(calendar), contentHash: createHash('sha256').update(calendar).digest('hex') })
describe('F01 large calendar with existing courses', () => {
  it('requires explicit shared mappings, saves all 500 correctly, repeats without duplicates and updates one stable UID', () => {
    const courses = stressCourses(), state = { schemaVersion: 1, tasks: [], planner: { ...emptyPlanner(), courses } }
    const parsed = parse(stressCalendar()), preview = createDocumentImportPreview(state, parsed)
    const before = structuredClone(state)
    expect(buildDocumentImportCommit(state, preview).ok).toBe(false)
    expect(state).toEqual(before)
    for (const course of courses) chooseDocumentCourse(preview, preview.rows.filter(row => row.kind === 'event' && row.courseHint === course.code), course.id)
    const first = buildDocumentImportCommit(state, preview)
    expect(first.ok).toBe(true)
    expect(first.candidate.planner.courses).toEqual(courses)
    expect(first.candidate.planner.events).toHaveLength(500)
    for (let index = 0; index < 500; index++) {
      const event = first.candidate.planner.events.find(event => event.title === `[${stressCourseCode(index)}] Syntetisk aktivitet ${index}`)
      const day = String(1 + Math.floor(index / 25)).padStart(2, '0')
      expect(event).toMatchObject({ courseId: courses[index % 25].id, start: `2026-11-${day}T09:00:00.000Z`, end: `2026-11-${day}T10:00:00.000Z`, location: `Syntetisk rom ${index % 25 + 1}` })
    }
    const repeat = buildDocumentImportCommit(first.candidate, createDocumentImportPreview(first.candidate, parsed))
    expect(repeat.ok).toBe(true)
    expect(repeat.counts).toEqual({ added: 0, updated: 0, unchanged: 500, omitted: 25 })
    expect(repeat.candidate.planner).toEqual(first.candidate.planner)
    const revision = buildDocumentImportCommit(repeat.candidate, createDocumentImportPreview(repeat.candidate, parse(stressCalendar({ revised: true })), { sourceId: first.source.id }))
    expect(revision.ok).toBe(true)
    expect(revision.counts).toEqual({ added: 0, updated: 1, unchanged: 499, omitted: 25 })
    expect(revision.candidate.planner.events.map(event => event.id)).toEqual(first.candidate.planner.events.map(event => event.id))
    expect(revision.candidate.planner.courses).toEqual(courses)
  })
})
