import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dailyOverview } from '../../src/daily-overview.js'
import { displayTimestamp } from '../../src/data-tools.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { validateCourse, resolveImportedCourse, mergeCourseOnly } from '../../src/planner.js'
import { coursePage, sectionText, publicCourseUrl } from '../../server/providers/public-course.js'
import { searchUit, uitDetails } from '../../server/providers/uit.js'

const fixtures = Object.fromEntries(['uit-search', 'uit-course'].map(name => [name, readFileSync(new URL(`../fixtures/public-courses/${name}.html`, import.meta.url), 'utf8')]))
const query = { q: 'FYS-3000', code: 'FYS-3000', semester: 'autumn', year: '2026', sourceRecordId: '923370', sourceUrl: 'https://uit.no/utdanning/emner/emne?p_document_id=923370' }
const course = { id: 'remote', name: 'Physics', code: 'FYS-3000', university: 'UiT', semester: 'autumn', year: 2026, credits: 10, description: 'Public description', notes: '', campus: 'Tromsø', sourceProvider: 'uit', sourceRecordId: '923370', sourceVersion: '2026H', sourceUrl: query.sourceUrl }
const legacy = { id: 'local', name: 'Physics', code: 'FYS-3000', university: 'UiT', semester: 'autumn', year: 2026, credits: null, description: '', notes: 'Keep local notes' }
const planner = courses => ({ courses, events: [], sources: [] })
const task = (id, deadlineLocal) => ({ id, title: 'Same title', course: 'FYS-3000', deadlineLocal, completed: false, estimatedMinutes: 60 })

describe('review: relevant daily ordering', () => {
  it('sorts overdue, ongoing/nearby and next-deadline rows independently of storage order', () => {
    const tasks = [task('later', '2026-09-08T16:00'), task('tie-b', '2026-09-08T14:00'), task('overdue', '2026-09-07T12:00'), task('near', '2026-09-08T18:00'), task('tie-a', '2026-09-08T14:00')]
    const sessions = [{ id: 'second', taskId: 'near', dateLocal: '2026-09-08', startTime: '12:00', endTime: '12:30' }, { id: 'first', taskId: 'near', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }]
    const result = dailyOverview({ tasks, sessions, now: new Date('2026-09-08T07:00:00Z') })
    expect(result.rows.map(row => row.task.id)).toEqual(['overdue', 'near', 'tie-a', 'tie-b', 'later'])
    expect(result.rows.find(row => row.task.id === 'near').sessions.map(session => session.id)).toEqual(['first', 'second'])
    expect(result.rows).toHaveLength(5)
  })
})

describe('review: display-only backup timestamps', () => {
  it.each(['2026-09-08', '2026-09-08T10:00:00', 'September 8, 2026', 'Tue, 08 Sep 2026 08:00:00 GMT', '2026-09-08T08:00:00Z', 0, ['2026-09-08']])('safely displays accepted metadata %j without changing backup data', createdAt => {
    const state = { schemaVersion: 1, tasks: [] }, backup = { ...exportBackup(state), createdAt }
    const before = JSON.stringify(backup), preview = previewBackup(before, state)
    expect(preview.ok).toBe(true)
    expect(() => displayTimestamp(preview.createdAt)).not.toThrow()
    expect(displayTimestamp(preview.createdAt)).toBeTruthy()
    expect(preview.data).toEqual(state); expect(JSON.stringify(backup)).toBe(before)
  })
  it('does not invent a clock or timezone for missing/ambiguous metadata', () => {
    expect(displayTimestamp('2026-09-08')).toBe('8. september 2026 (klokkeslett ikke oppgitt)')
    expect(displayTimestamp('2026-09-08T10:00')).toContain('tidssone eller klokkeslett ikke entydig')
    expect(displayTimestamp(undefined)).toContain('ikke oppgitt')
  })
})

describe('review: verified and stale course identities', () => {
  it('prefers a unique exact verified identity over an unbound manual lookalike', () => {
    const state = planner([{ ...course, id: 'verified', notes: 'Verified local note' }, legacy])
    const result = mergeCourseOnly(state, course)
    expect(result.courses).toHaveLength(2)
    expect(result.courses.find(c => c.id === 'verified')).toMatchObject({ notes: 'Verified local note', sourceRecordId: '923370' })
    expect(result.courses.find(c => c.id === 'local')).toEqual(legacy)
    expect(resolveImportedCourse(state, course).id).toBe('verified')
  })
  it('still rejects duplicate exact identities, duplicate manual targets and campus conflicts', () => {
    for (const courses of [[{ ...course, id: 'a' }, { ...course, id: 'b' }, legacy], [legacy, { ...legacy, id: 'b' }], [{ ...course, campus: 'Alta' }, legacy]]) {
      expect(() => resolveImportedCourse(planner(courses), course)).toThrow(/campus\/emneversjon/)
    }
  })
  it('binds a genuinely unbound legacy course, retaining its local identity and relations, then rejects another record', () => {
    const state = planner([legacy])
    state.events.push({ id: 'event-local', courseId: 'local', title: 'Keep dates', start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z' })
    state.sources.push({ id: 'source-local', courseId: 'local', kind: 'file', name: 'Original file', groups: [], lastUpdated: '2026-09-08T06:00:00Z' })
    expect(legacy).not.toHaveProperty('sourceRecordId')
    const result = mergeCourseOnly(state, course)
    expect(result.courses[0]).toMatchObject({ id: 'local', notes: 'Keep local notes', sourceProvider: 'uit', sourceRecordId: '923370', sourceVersion: '2026H' })
    expect(result.events).toEqual(state.events); expect(result.sources).toEqual(state.sources)
    expect(() => mergeCourseOnly(result, { ...course, sourceRecordId: '923371' })).toThrow(/campus\/emneversjon/)
  })
  it('invalidates manual period changes and archives old provenance only on a verified rebind', () => {
    const original = { ...course, id: 'local', notes: 'Keep local notes' }
    const edited = validateCourse({ ...original, semester: 'spring' }, original)
    expect(edited).toMatchObject({ id: 'local', semester: 'spring', sourceVersion: '2026H', sourceRecordId: '923370', sourceBindingStale: { semester: 'autumn', year: 2026, sourceVersion: '2026H', sourceUrl: query.sourceUrl } })
    expect(() => resolveImportedCourse(planner([edited]), { ...legacy, semester: 'spring' })).toThrow()
    const result = mergeCourseOnly(planner([edited]), { ...course, semester: 'spring', sourceVersion: '2026V', sourceRecordId: '923371', sourceUrl: 'https://uit.no/utdanning/emner/emne?p_document_id=923371' })
    expect(result.courses[0]).toMatchObject({ id: 'local', notes: 'Keep local notes', sourceVersion: '2026V', sourceRecordId: '923371' })
    expect(result.courses[0]).not.toHaveProperty('sourceBindingStale')
    expect(result.courses[0].sourceBindingHistory).toEqual([edited.sourceBindingStale])
    expect(edited.sourceVersion).toBe('2026H')
  })
})

describe('review: bounded public HTML fields', () => {
  it.each(['<p>Tromsø</p><a href="/more">Read more</a>', '<p>Tromsø <a href="/more">Read more</a></p><p>More card text</p>'])('extracts only the campus field with trailing card content', replacement => {
    return searchUit(query, async () => fixtures['uit-search'].replace('<p>Tromsø</p>', replacement)).then(result => {
      expect(result.results[0]).toMatchObject({ campus: 'Tromsø', campusVerified: true, sourceRecordId: '923370' })
    })
  })
  it('marks an unstructured campus field unknown instead of absorbing trailing prose', async () => {
    const result = await searchUit(query, async () => fixtures['uit-search'].replace('<p>1 semestre</p><p>Tromsø</p>', '<p>1 semestre Tromsø Read more</p>'))
    expect(result.results[0]).toMatchObject({ campus: '', campusVerified: false })
  })
  it.each([undefined, '923370'])('rejects contradicting path and query records even without a selected record', record => {
    expect(() => publicCourseUrl('https://uit.no/utdanning/emner/emne/923370/fys-3000?p_document_id=923371', 'uit', record)).toThrow(/motstridende/)
    expect(publicCourseUrl('https://uit.no/utdanning/emner/emne/923370/fys-3000?p_document_id=923370', 'uit', record).hostname).toBe('uit.no')
  })
  it.each([
    '<div><h2>About the course</h2></div><section><h2>Admission requirements</h2><p>Not a description</p></section>',
    '<section><h2>About the course</h2></section><section><p>Unrelated content without a heading</p></section>',
  ])('does not borrow another section when the requested description is empty', html => {
    expect(sectionText(coursePage(html), ['about the course'])).toBe('')
  })
  it('reads the actual nested section and stops at the next heading', () => {
    const html = '<article><div><h2>About the course</h2></div><div><p>Own <em>description</em>.</p></div><div><h2>Admission requirements</h2><p>Unrelated</p></div></article>'
    expect(sectionText(coursePage(html), ['about the course'])).toBe('Own description .')
  })
  it('reports an empty description as missing in the UiT adapter', async () => {
    const html = fixtures['uit-course'].replace('<h2>About the course</h2><div>Isolated description for a course in space physics.</div>', '<div><h2>About the course</h2></div>')
    const result = await uitDetails(query, async () => html)
    expect(result.course.description).toBe(''); expect(result.warnings.join(' ')).toContain('Beskrivelse mangler')
    expect(result.course.campus).toBe('Tromsø')
  })
})
