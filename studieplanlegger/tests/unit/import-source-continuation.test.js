import { describe, it, expect } from 'vitest'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, refreshDocumentImportPreview, addDocumentCourseDraft, chooseDocumentCourse } from '../../src/import-preview.js'
import { validEnvelope } from '../../src/storage.js'
import { recordChange } from '../../src/history.js'

// Invented source and identities, independent of all private calendar data.
const empty = () => ({ schemaVersion: 1, tasks: [] })
const input = (hash = 'a', title = 'Workshop', uidPrefix = 'continuation') => ({ ...parseDocumentIcs(['BEGIN:VCALENDAR', 'VERSION:2.0', ...Array.from({ length: 8 }, (_, index) => ['BEGIN:VEVENT', `UID:${uidPrefix}-${index}@example.invalid`, `SUMMARY:${title}`, `X-COURSE-CODE:SYN${810 + index % 2}`, `DTSTART:2041030${index + 1}T090000Z`, `DTEND:2041030${index + 1}T100000Z`, 'END:VEVENT'].join('\r\n')), 'END:VCALENDAR'].join('\r\n')), contentHash: hash.repeat(64) })
const preview = (state, parsed = input(), sourceId) => createDocumentImportPreview(state, parsed, { sourceId })
function save(state, draft) {
  const result = buildDocumentImportCommit(state, draft)
  expect(result.ok, JSON.stringify(result.errors || result.error)).toBe(true)
  expect(validEnvelope(result.state, { relations: true })).toBe(true)
  return result.state
}
function initial(hash = 'a') {
  const state = empty(), draft = preview(state, input(hash))
  for (const row of draft.rows) {
    row.selected = true; row.groupChoiceResolved = true
    if (row.kind === 'course') { row.university = row.code === 'SYN810' ? 'HiMolde' : 'NTNU'; row.title = `Accepted ${row.code}` }
  }
  return save(state, draft)
}

describe('source continuation through original identity and review', () => {
  it('resolves A after explicit B update using its original source identity and current revision', () => {
    const a = initial(), b = save(a, preview(a, input('b', 'Updated'), a.importSources[0].id))
    const draft = preview(b)
    expect(draft.sourceId).toBe(a.importSources[0].id)
    expect(draft.previousRevision).toBe(b.importSources[0].revision)
    const final = save(b, refreshDocumentImportPreview(b, draft))
    expect(final.importSources).toHaveLength(1)
    expect(final.planner.events.map(row => row.id)).toEqual(a.planner.events.map(row => row.id))
  })
  it('retains mixed known institutions and accepted names when changed bytes omit them', () => {
    const state = initial(), draft = preview(state, input('b', 'Updated'), state.importSources[0].id)
    expect(draft.rows.filter(row => row.kind === 'course').map(row => [row.university, row.title])).toEqual(state.planner.courses.map(row => [row.university, row.name]))
    expect(save(state, refreshDocumentImportPreview(state, draft)).planner.courses).toEqual(state.planner.courses)
  })
  it('rejects explicit reassignment of a matched course institution without partial writes', () => {
    const state = initial(), before = structuredClone(state), draft = preview(state, input('b'), state.importSources[0].id)
    draft.rows.find(row => row.kind === 'course').university = 'NTNU'
    const result = buildDocumentImportCommit(state, draft)
    expect(result.ok).toBe(false)
    expect(result.errors.some(error => error.field === 'university')).toBe(true)
    expect(state).toEqual(before)
    const course = draft.rows.find(row => row.kind === 'course'), saved = state.planner.courses.find(row => row.id === course.targetId)
    course.institutionCorrection = JSON.stringify([saved.id, saved.university, course.university])
    const corrected = save(state, refreshDocumentImportPreview(state, draft))
    expect(corrected.planner.courses.find(row => row.id === saved.id).university).toBe('NTNU')
    expect(corrected.planner.events.map(row => [row.id, row.courseId])).toEqual(state.planner.events.map(row => [row.id, row.courseId]))
  })
  it('requires source choice when current hash and original identity point to different sources', () => {
    const a = initial(), c = initial('c')
    const state = save(a, preview(a, input('b'), a.importSources[0].id))
    const other = save(c, preview(c, input(), c.importSources[0].id))
    state.importSources.push(...other.importSources)
    state.planner.courses.push(...other.planner.courses); state.planner.events.push(...other.planner.events)
    expect(validEnvelope(state, { relations: true })).toBe(true)
    expect(() => preview(state)).toThrow(/flere tidligere kilder/)
    expect(preview(state, input(), state.importSources[0].id).previousRevision).toBe(state.importSources[0].revision)
  })
  it.each([false, true])('keeps deleted targets and consent stable through refresh (restore=%s)', restore => {
    const state = initial(), original = structuredClone(state)
    const course = state.planner.courses.shift()
    state.planner.events = state.planner.events.filter(event => event.courseId !== course.id)
    state.history = recordChange(original, state)
    const draft = preview(state, input('b', 'Updated'), state.importSources[0].id)
    for (const row of draft.rows.filter(row => row.deletedLocally)) { row.selected = restore; row.recreate = restore }
    expect(draft.rows.find(row => row.deletedLocally && row.kind === 'course').university).toBe('HiMolde')
    const final = save(state, refreshDocumentImportPreview(state, draft))
    expect(final.planner.events.map(row => row.id).sort()).toEqual((restore ? original : state).planner.events.map(row => row.id).sort())
    expect(final.planner.courses.map(row => row.id).sort()).toEqual((restore ? original : state).planner.courses.map(row => row.id).sort())
  })
  it('retains manual edits and valid course decisions while a real stale draft remains atomic', () => {
    const state = initial(), draft = preview(state, input('b', 'Updated'), state.importSources[0].id)
    const members = draft.rows.filter(row => row.kind === 'event')
    chooseDocumentCourse(draft, [members[0]], '')
    const course = addDocumentCourseDraft(state, draft, [members[1]])
    Object.assign(course, { title: 'Invented new subject', university: 'NTNU', year: 2041, semester: 'spring' })
    state.planner.events[0].notes = 'Local note'
    const before = structuredClone(state)
    expect(buildDocumentImportCommit(state, draft)).toMatchObject({ ok: false, stale: true })
    expect(state).toEqual(before)
    const final = save(state, refreshDocumentImportPreview(state, draft))
    expect(final.planner.events[0].notes).toBe('Local note')
    expect(final.planner.events[0].courseId).toBe('')
    expect(final.planner.courses.find(row => row.id === final.planner.events[1].courseId).name).toBe('Invented new subject')
  })
  it('explains an unused new-course draft and retains its editable fields after refresh', () => {
    const state = initial(), draft = preview(state), members = draft.rows.filter(row => row.kind === 'event')
    const course = addDocumentCourseDraft(state, draft, [members[0]])
    chooseDocumentCourse(draft, [members[0]], '')
    const refreshed = refreshDocumentImportPreview(state, draft)
    const unused = refreshed.rows.find(row => row.key === course.key)
    expect(unused.selected).toBe(false)
    expect(unused.resolutionNote).toContain('blir ikke lagret')
    expect(save(state, refreshed).planner.courses).toHaveLength(2)
    chooseDocumentCourse(refreshed, [refreshed.rows.find(row => row.key === members[0].key)], `row:${unused.index}`)
    expect(unused.selected).toBe(true)
    expect(unused.resolutionNote).toBeUndefined()
  })
  it('requires consent for clearing, invalidates it after saved context changes and target changes', () => {
    const state = initial(), draft = preview(state), row = draft.rows.find(row => row.kind === 'course')
    const original = state.planner.courses.find(course => course.id === row.targetId)
    row.university = ''
    expect(buildDocumentImportCommit(state, draft).errors.some(error => error.field === 'university')).toBe(true)
    row.institutionCorrection = JSON.stringify([original.id, original.university, ''])
    expect(save(state, draft).planner.courses.find(course => course.id === original.id).university).toBe('')
    original.university = 'uio'
    const refreshed = refreshDocumentImportPreview(state, draft)
    expect(buildDocumentImportCommit(state, refreshed).errors.some(error => error.field === 'university')).toBe(true)
    const course = refreshed.rows.find(item => item.key === row.key), other = refreshed.rows.find(item => item.kind === 'course' && item.key !== row.key)
    course.matchChoice = other.matchEntryKey; course.courseTarget = other.targetId
    expect(buildDocumentImportCommit(state, refreshed).errors.some(error => error.index === course.index && error.field === 'university')).toBe(true)
  })
  it('preserves referenced course ownership and metadata without offering an unsavable correction', () => {
    // Distinct UIDs establish a separate source; reused UIDs now correctly
    // restore the established source even when affiliation is omitted.
    const separate = input('b', 'Workshop', 'independent-reference')
    const first = initial(), draft = preview(first, separate)
    for (const row of draft.rows) {
      row.selected = true; row.groupChoiceResolved = true
      if (row.kind === 'course') row.courseTarget = first.planner.courses.find(course => course.code === row.code).id
    }
    const state = save(first, draft), repeated = preview(state, separate)
    const course = repeated.rows.find(row => row.kind === 'course')
    expect(course.reference).toBe(true)
    course.university = ''
    expect(save(state, repeated).planner.courses).toEqual(first.planner.courses)
  })
  it('refuses multiple qualified UID candidates while explicit selection updates only its source', () => {
    const qualified = hash => { const parsed = input(hash); for (const row of parsed.rows) { row.university = 'HiMolde'; row.identityValidated = true; if (row.kind === 'course') row.title = row.code }; return parsed }
    const create = hash => { const state = empty(), draft = preview(state, qualified(hash)); for (const row of draft.rows) { row.selected = true; row.groupChoiceResolved = true }; return save(state, draft) }
    const state = create('a'), second = create('b')
    state.planner.courses.push(...second.planner.courses); state.planner.events.push(...second.planner.events); state.importSources.push(...second.importSources)
    expect(validEnvelope(state, { relations: true })).toBe(true)
    expect(() => preview(state, qualified('c'))).toThrow(/flere kilder/)
    const selected = preview(state, qualified('c'), state.importSources[0].id)
    const after = save(state, selected)
    expect(after.importSources[0].contentHash).toBe('c'.repeat(64))
    expect(after.importSources[1]).toEqual(state.importSources[1])
    expect(after.planner.events.map(row => row.id)).toEqual(state.planner.events.map(row => row.id))
  })
})
