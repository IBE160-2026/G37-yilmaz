import { describe, it, expect } from 'vitest'
import { parseDocumentCsv } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit } from '../../src/import-preview.js'

// Entirely invented calendar; no personal export or runtime storage is read.
const hash = 'a'.repeat(64)
const empty = () => ({ schemaVersion: 1, tasks: [] })
const csv = (count = 30) => ['title;summary;name;courseid;coursename;university;dtstart;dtend', ...Array.from({ length: count }, (_, i) => {
  const date = new Date(Date.UTC(2041, 2, i + 1)).toISOString().slice(0, 10)
  return `Seminar;Seminar;Alternative;SYN731;Invented course;uio;${date}T10:00:00+01:00;${date}T11:00:00+01:00`
})].join('\n')
const parsed = (column = 'title', text = csv()) => ({ ...parseDocumentCsv(text, { columns: { title: column } }), contentHash: hash })
const preview = (state, input = parsed()) => createDocumentImportPreview(state, input)
function save(state, draft = preview(state)) { const result = buildDocumentImportCommit(state, draft); expect(result.ok, JSON.stringify(result.errors || result.error)).toBe(true); return result.state }

describe('reimport repair using qualified evidence', () => {
  it('collapses fully equivalent columns and compares different values on the same dated rows', () => {
    let clarification
    try { parseDocumentCsv(csv()) } catch (error) { clarification = error.clarification }
    expect(clarification.fields[0].options).toEqual(['title', 'name'])
    expect(clarification.fields[0].comparison[0]).toEqual({ date: '2041-03-01T10:00:00+01:00', course: 'SYN731' })
  })
  it('retains 30 IDs but adopts the newly selected title interpretation after reload', () => {
    const first = save(empty()), draft = preview(JSON.parse(JSON.stringify(first)), parsed('name'))
    expect(draft.rows.every(row => row.matchChoice !== '?')).toBe(true)
    const second = save(first, draft)
    expect(second.planner.events.map(event => event.id)).toEqual(first.planner.events.map(event => event.id))
    expect(second.planner.events.every(event => event.title === 'Alternative')).toBe(true)
    expect(save(second, preview(second, parsed('name'))).planner).toEqual(second.planner)
  })
  it('preserves manual edits and requires a three-way choice when interpretation changes', () => {
    const first = save(empty()); first.planner.events[0].title = 'My edit'
    const draft = preview(first, parsed('name'))
    expect(draft.rows[1].conflicts.map(item => item.field)).toContain('title')
    expect(buildDocumentImportCommit(first, draft).ok).toBe(false)
    draft.rows[1].conflictChoices.title = 'local'
    expect(save(first, draft).planner.events[0].title).toBe('My edit')
  })
  it('keeps explicit exclusions across title interpretation changes', () => {
    const draft = preview(empty()); draft.rows[3].selected = false
    const first = save(empty(), draft), repeat = preview(first, parsed('name'))
    expect(repeat.rows[3].selected).toBe(false)
    expect(save(first, repeat).planner.events).toHaveLength(29)
  })
  it('uses source time and qualified course to reconcile a unique legacy title-derived key', () => {
    const old = parsed(); old.rows.forEach((row, i) => { if (row.kind === 'event') { row.key = `event:legacy${i}`; delete row.csvIdentity } })
    const first = save(empty(), preview(empty(), old)), draft = preview(first, parsed('name'))
    expect(draft.rows.every(row => row.matchChoice !== '?')).toBe(true)
    expect(save(first, draft).planner.events.map(event => event.id)).toEqual(first.planner.events.map(event => event.id))
  })
  it('does not infer deletion causes or silently recreate missing activities', () => {
    const first = save(empty()); first.planner.events.splice(0, 2)
    const original = structuredClone(first), draft = preview(first, parsed('name'))
    expect(draft.rows.filter(row => row.deletedLocally)).toHaveLength(2)
    expect(buildDocumentImportCommit(first, draft).ok).toBe(false)
    expect(first).toEqual(original)
    draft.rows.filter(row => row.deletedLocally).forEach(row => { row.selected = false })
    expect(save(first, draft).planner.events).toHaveLength(28)
  })
  it('rejects stale commits without applying historical repairs', () => {
    const first = save(empty()), draft = preview(first); first.planner.events[0].notes = 'Later edit'
    const before = structuredClone(first)
    expect(buildDocumentImportCommit(first, draft)).toMatchObject({ ok: false, stale: true })
    expect(first).toEqual(before)
  })
  it('normalizes omitted legacy scope suffixes without conflating institutions', () => {
    const text = 'uid;title;courseid;coursename;university;dtstart;dtend\nx;Seminar;SYN731;Invented;uio;2041-03-01T10:00:00Z;2041-03-01T11:00:00Z'
    const input = parsed('title', text), first = save(empty(), preview(empty(), input))
    first.importSources[0].entries.find(entry => entry.kind === 'event').identityScope = JSON.stringify(['uio', 'syn731', 2041, 'spring'])
    const draft = preview(first, input)
    expect(draft.rows[1].matchEntryKey).toBe(first.importSources[0].entries[1].key)
    const other = parsed('title', text.replace(';uio;', ';ntnu;')); other.contentHash = 'b'.repeat(64)
    expect(createDocumentImportPreview(first, other).previousRevision).toBe(0)
  })
})
import legacyFixture from '../fixtures/synthetic-reimport/legacy.json'
import { validEnvelope } from '../../src/storage.js'
import { recordChange, undoLast } from '../../src/history.js'

it('loads actual pre-repair synthetic history and preserves its deletion and exclusion across title changes', () => {
  const state = structuredClone(legacyFixture.state)
  expect(validEnvelope(state, { relations: true })).toBe(true)
  const draft = preview(state, parsed('name', legacyFixture.csv))
  expect(draft.rows[1].matchChoice).not.toBe('?')
  expect(draft.rows[2].deletedLocally).toBe(true)
  expect(draft.rows[3].selected).toBe(false)
  expect(draft.rows[3].matchCandidates).toEqual([])
  expect(draft.rows[3].matchChoice).toBe('new')
  draft.rows[2].recreate = true
  const next = save(state, draft)
  expect(next.planner.events).toHaveLength(2)
  expect(next.planner.events[0].id).toBe(state.planner.events[0].id)
  expect(next.planner.events[1].id).toBe(state.importSources[0].entries[2].targetId)
  const undo = undoLast(next, recordChange(state, next))
  expect(undo.ok).toBe(true)
  expect(undo.state.planner).toEqual(state.planner)
  const reopened = preview(undo.state, parsed('name', legacyFixture.csv))
  expect(reopened.rows[1].targetId).toBe(state.planner.events[0].id)
  expect(reopened.rows[2]).toMatchObject({ deletedLocally: true, recreate: false })
  expect(reopened.rows[3]).toMatchObject({ selected: false, matchChoice: 'new' })
  expect(reopened.rows.every(row => row.matchChoice !== '?')).toBe(true)
})

it('does not offer unrelated courses as event matching candidates and shows dates', () => {
  const first = save(empty()), changed = parsed('name', csv().replaceAll('T10:00:00', 'T12:00:00').replaceAll('T11:00:00', 'T13:00:00'))
  changed.contentHash = 'b'.repeat(64)
  const draft = createDocumentImportPreview(first, changed, { sourceId: first.importSources[0].id })
  expect(draft.rows[1].matchCandidates.length).toBeGreaterThan(0)
  expect(draft.rows[1].matchCandidates.every(item => item.kind === 'event' && item.start && item.course === 'SYN731' && item.reason)).toBe(true)
})
it('can confirm keeping every missing entry omitted without recreating anything', () => {
  const first = save(empty()); first.planner.events = []; first.planner.courses = []
  const draft = preview(first)
  expect(draft.rows.every(row => row.deletedLocally)).toBe(true)
  draft.rows.forEach(row => { row.selected = false })
  const result = save(first, draft)
  expect(result.planner.events).toEqual([]); expect(result.planner.courses).toEqual([])
  expect(result.importSources[0].excludedKeys).toHaveLength(30)
})
it('a missing code-only course exposes one name clarification instead of an invisible missing target', () => {
  const input = parsed('title', csv(2).replaceAll('Invented course', ''))
  const initial = preview(empty(), input); initial.rows[0].title = 'Accepted local name'
  const first = save(empty(), initial), deleted = structuredClone(first)
  deleted.planner.courses = []; deleted.planner.events = []
  const draft = preview(deleted, input)
  expect(draft.rows[0]).toMatchObject({ title: '', courseTarget: '', deletedLocally: true })
  draft.rows.forEach(row => { row.recreate = true; row.selected = true })
  expect(buildDocumentImportCommit(deleted, draft).errors).toEqual(expect.arrayContaining([expect.objectContaining({ index: 0, field: 'title' })]))
  draft.rows[0].title = 'New accepted name'
  expect(save(deleted, draft).planner.courses[0].id).toBe(first.planner.courses[0].id)
})

it('exact deletion history preserves an accepted course name and context, but still requires recreation consent', () => {
  const input = parsed('title', csv(2).replaceAll('Invented course', ''))
  const initial = preview(empty(), input); initial.rows[0].title = 'Accepted local name'
  const first = save(empty(), initial), deleted = structuredClone(first)
  deleted.planner.courses = []; deleted.planner.events = []
  deleted.history = recordChange(first, deleted)
  expect(validEnvelope(deleted, { relations: true })).toBe(true)
  const draft = preview(deleted, input)
  expect(draft.rows[0]).toMatchObject({ title: 'Accepted local name', university: 'uio', deletedLocally: true, recreate: false, courseTarget: '' })
  expect(buildDocumentImportCommit(deleted, draft).ok).toBe(false)
  draft.rows.forEach(row => { row.recreate = true; row.selected = true })
  expect(save(deleted, draft).planner.courses).toEqual(first.planner.courses)
})
it('compares shared rows that distinguish every non-equivalent title column, including a late pairwise difference', () => {
  const text = ['title;summary;name;courseid;dtstart;dtend', ...Array.from({ length: 4 }, (_, i) => `${i === 3 ? 'Late A' : 'Shared'};${i === 3 ? 'Late B' : 'Shared'};Different C;SYN731;2041-03-0${i+1}T10:00:00Z;2041-03-0${i+1}T11:00:00Z`)].join('\n')
  let question
  try { parseDocumentCsv(text) } catch (error) { question = error.clarification.fields[0] }
  expect(question.options).toEqual(['title', 'summary', 'name'])
  expect(question.comparison.some(row => row.date === '2041-03-04T10:00:00Z' && row.course === 'SYN731')).toBe(true)
  const labels = question.options.map(column => question.examples.find(example => example.column === column).values.join(' / '))
  expect(new Set(labels).size).toBe(3)
  expect(labels[0]).toContain('Late A'); expect(labels[1]).toContain('Late B'); expect(labels[2]).toContain('Different C')
})
import { refreshDocumentConflicts, refreshDocumentImportPreview } from '../../src/import-preview.js'
it('recreation consent is bound to one tombstone and survives refresh only for that same target', () => {
  const state = save(empty(), preview(empty(), parsed('title', csv(2))))
  state.planner.events = []
  const input = parsed('title', csv(1).replaceAll('T10:00:00', 'T12:00:00').replaceAll('T11:00:00', 'T13:00:00'))
  input.contentHash = 'b'.repeat(64)
  const draft = createDocumentImportPreview(state, input, { sourceId: state.importSources[0].id }), row = draft.rows[1]
  const [first, second] = state.importSources[0].entries.filter(entry => entry.kind === 'event')
  row.matchChoice = first.key; refreshDocumentConflicts(state, draft)
  expect(row.deletedLocally).toBe(true); row.recreate = true
  expect(refreshDocumentImportPreview(state, draft).rows[1].recreate).toBe(true)
  row.matchChoice = second.key; refreshDocumentConflicts(state, draft)
  expect(row.recreate).toBe(false)
  expect(buildDocumentImportCommit(state, draft).errors).toEqual(expect.arrayContaining([expect.objectContaining({ index: 1, field: 'recreate' })]))
  row.recreate = true
  expect(save(state, draft).planner.events[0].id).toBe(second.targetId)
})
import ambiguousLegacy from '../fixtures/synthetic-reimport/ambiguous-exclusions.json'
it('requires explicit selection when valid old title interpretations disagree on dated omissions', () => {
  const state = structuredClone(ambiguousLegacy.state)
  expect(validEnvelope(state, { relations: true })).toBe(true)
  const draft = preview(state, parsed('title', ambiguousLegacy.csv))
  expect(draft.rows.slice(2).every(row => row.selectionUncertain && !row.groupChoiceResolved)).toBe(true)
  expect(buildDocumentImportCommit(state, draft)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.objectContaining({ field: 'selected' })]) })
  const original = [...state.importSources[0].excludedKeys]
  draft.rows[2].selected = true; draft.rows[2].groupChoiceResolved = true
  draft.rows[3].selected = false; draft.rows[3].groupChoiceResolved = true
  const next = save(state, draft)
  expect(next.planner.events).toHaveLength(2)
  expect(next.importSources[0].excludedKeys).toContain(original[0])
  const repeated = preview(next, parsed('title', ambiguousLegacy.csv))
  expect(repeated.rows[2].selected).toBe(true); expect(repeated.rows[3].selected).toBe(false)
})
it('deliberately including a proven legacy exclusion removes its stale alias and stays included on reimport', () => {
  const state = structuredClone(legacyFixture.state), draft = preview(state, parsed('name', legacyFixture.csv))
  expect(draft.rows[3].provenAliasKeys).toEqual(state.importSources[0].excludedKeys)
  draft.rows[2].recreate = true; draft.rows[3].selected = true
  const next = save(state, draft)
  expect(next.importSources[0].excludedKeys).toEqual([])
  const repeated = preview(next, parsed('name', legacyFixture.csv))
  expect(repeated.rows.every(row => row.selected)).toBe(true)
  expect(save(next, repeated).planner).toEqual(next.planner)
})
it.each(['startLocal;emne', 'startLocal;coursecode'])('uses supported context aliases %s in shared examples', aliases => {
  let field
  try { parseDocumentCsv(`title;name;${aliases};endLocal\nA;B;2041-03-01T10:00;SYN731;2041-03-01T11:00`) } catch (error) { field = error.clarification.fields[0] }
  expect(field.comparison).toEqual([{ date: '2041-03-01T10:00', course: 'SYN731' }])
})
it.each([
  ['https://example.invalid/one', 'https://example.invalid/two'],
  ['x'.repeat(650) + ' Meaningful A', 'x'.repeat(650) + ' Meaningful B'],
])('shows actual bounded title distinctions while retaining snippet redaction', (first, second) => {
  const text = `title;name;dtstart;dtend\n${first};${second};2041-03-01T10:00;2041-03-01T11:00`
  let field; try { parseDocumentCsv(text) } catch (error) { field = error.clarification.fields[0] }
  const values = field.examples.map(example => example.values[0])
  expect(values).toEqual([first, second]); expect(new Set(values).size).toBe(2)
  const row = parseDocumentCsv(text, { columns: { title: 'title' } }).rows[0]
  expect(row.title).toBe(first)
  expect(row.snippet.length).toBeLessThanOrEqual(600)
  if (first.startsWith('https:')) expect(row.snippet).not.toContain('https:')
})
it.each([false, true])('does not infer simultaneous legacy identities or incompatible campus/source-object evidence (missing=%s)', missing => {
  const text = 'title;courseid;coursename;university;campus;sourceobjectid;dtstart;dtend\nFirst;SYN735;Invented;uio;North;public-A;2041-03-01T10:00Z;2041-03-01T11:00Z\nSecond;SYN735;Invented;uio;North;public-A;2041-03-01T10:00Z;2041-03-01T11:00Z'
  const old = parsed('title', text)
  old.rows.filter(row => row.kind === 'event').forEach((row, index) => { row.key = `legacy-simultaneous-${index}` })
  const state = save(empty(), preview(empty(), old))
  if (missing) state.planner.events.splice(0, 1)
  expect(validEnvelope(state, { relations: true })).toBe(true)
  const compatible = preview(state, parsed('title', text.replace('First;', 'Changed;').replace('Second;', 'Changed;')))
  expect(compatible.rows.filter(row => row.kind === 'event').every(row => row.matchChoice === '?' && !row.deletedLocally)).toBe(true)
  const incompatible = preview(state, parsed('title', text.replaceAll(';North;public-A;', ';South;public-B;')))
  expect(incompatible.rows.filter(row => row.kind === 'event').every(row => !row.matchEntryKey && !row.deletedLocally && row.matchCandidates.length === 0)).toBe(true)
})
it('exact source identity preserves a deliberate mapping to a differently named course', () => {
  const state = { schemaVersion: 1, tasks: [], planner: { courses: [{ id: 'chosen', code: 'OTHER731', name: 'Chosen course', university: 'uio', year: 2041, semester: 'spring', credits: null, description: '' }], events: [], sources: [] } }
  const input = parsed('title', csv(2)), draft = preview(state, input)
  draft.rows[0].selected = false
  draft.rows.filter(row => row.kind === 'event').forEach(row => { row.courseChoice = 'chosen' })
  const first = save(state, draft), repeat = preview(first, input)
  expect(repeat.rows[0].selected).toBe(false)
  expect(repeat.rows.filter(row => row.kind === 'event').every(row => row.matchEntryKey && row.courseChoice === 'chosen')).toBe(true)
  expect(save(first, repeat).planner).toEqual(first.planner)
})
import mappedLegacy from '../fixtures/synthetic-reimport/legacy-mapped-course.json'
it.each([false, true])('preserves actual pre-fix alias identity with a deliberate different-course mapping (missing=%s)', missing => {
  const state = structuredClone(mappedLegacy.state)
  if (missing) state.planner.events.splice(1, 1)
  expect(validEnvelope(state, { relations: true })).toBe(true)
  const draft = preview(state, parsed('name', mappedLegacy.csv))
  expect(draft.rows[0].selected).toBe(false)
  expect(draft.rows[1]).toMatchObject({ matchEntryKey: state.importSources[0].entries[0].key, courseChoice: 'chosen-legacy' })
  expect(draft.rows[2].matchEntryKey).toBe(state.importSources[0].entries[1].key)
  expect(draft.rows[2].deletedLocally).toBe(missing)
  expect(draft.rows[3].selected).toBe(false)
  if (missing) draft.rows[2].selected = false
  const next = save(state, draft)
  expect(next.planner.events.map(event => event.id)).toEqual(state.planner.events.map(event => event.id))
  expect(next.planner.events.every(event => event.courseId === 'chosen-legacy')).toBe(true)
})
