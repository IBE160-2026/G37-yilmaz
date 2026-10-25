import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import Papa from 'papaparse'
import { parseDocumentCsv, parseDocumentIcs } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, refreshDocumentImportPreview } from '../../src/import-preview.js'
import { resolveDocumentCourses } from '../../src/document-course-resolution.js'
import { emptyPlanner, validateCourse, validateEvent, validPlanner, osloLocalExact } from '../../src/planner.js'
import { nameFirstLabel } from '../../src/name-sort.js'
import { validImportSources } from '../../src/import-source-contract.js'
import { validEnvelope } from '../../src/storage.js'
import { recordChange, undoLast } from '../../src/history.js'

// Independent synthetic values in the publicly documented header structure.
const text = readFileSync(new URL('../fixtures/synthetic-tp-csv/main.csv', import.meta.url), 'utf8')
const exceptions = readFileSync(new URL('../fixtures/synthetic-tp-csv/time-exceptions.csv', import.meta.url), 'utf8')
const empty = () => ({ schemaVersion: 1, tasks: [], planner: emptyPlanner(), importSources: [] })
const parse = (input = text) => ({ ...parseDocumentCsv(input), fileName: 'synthetic-tp.csv', contentHash: createHash('sha256').update(input).digest('hex') })
const preview = (state, input = parse(), sourceId) => createDocumentImportPreview(state, input, { sourceId })
const save = (state, draft = preview(state)) => {
  const result = buildDocumentImportCommit(state, draft)
  expect(result.ok, JSON.stringify(result.errors || result.error)).toBe(true)
  return result
}

describe('recognized TP CSV collective confirmation', () => {
  it('saves all 30 rows without manual name repair, retaining actual names separately from display', async () => {
    const state = empty(), draft = preview(state), api = vi.fn()
    await resolveDocumentCourses(draft, { api })
    expect(api).not.toHaveBeenCalled()
    expect(draft.rows).toHaveLength(31)
    expect(draft.rows.slice(1).every(row => row.title.trim())).toBe(true)
    const result = save(state, draft), course = result.state.planner.courses[0]
    expect(course).toMatchObject({ name: '', nameStatus: 'provisional', code: 'SYN742', university: '' })
    expect(nameFirstLabel(course)).toBe('SYN742 (foreløpig navn)')
    expect(result.state.planner.events).toHaveLength(30)
    expect(result.state.planner.events.every(event => event.courseId === course.id)).toBe(true)
    expect(result.state.planner.events.filter(event => event.titleStatus === 'provisional')).toHaveLength(2)
    expect(result.source.entries[0]).toMatchObject({ titleOrigin: 'provisional', sourceBase: { name: '', nameStatus: 'provisional' } })
    expect(result.state.planner.events[0].description).toContain('Syntetisk beskrivelse med æ, ø og å.')
    expect(validEnvelope(JSON.parse(JSON.stringify(result.state)), { relations: true })).toBe(true)
  })

  it('retains exact short intervals and ambiguous-hour instants through unrelated edits and reload', () => {
    const first = save(empty()), event = first.state.planner.events[10]
    expect(event).toMatchObject({ start: '2041-11-11T10:00:07Z', end: '2041-11-11T10:00:17Z', point: false })
    const edited = validateEvent({ title: event.title, courseId: event.courseId, startLocal: osloLocalExact(event.start), endLocal: osloLocalExact(event.end), notes: 'Behold sekunder' }, event)
    expect([edited.start, edited.end]).toEqual([event.start, event.end])
    first.state.planner.events[10] = edited
    const loaded = JSON.parse(JSON.stringify(first.state)), repeated = save(loaded)
    expect(repeated.state.planner).toEqual(loaded.planner)
    const ambiguous = parse('id;title;dtstart;dtend\na;Syntetisk høst;2026-10-25T02:15:07+01:00;2026-10-25T02:15:17+01:00')
    const overlap = save(empty(), preview(empty(), ambiguous)).state.planner.events[0]
    expect(validateEvent({ title: overlap.title, courseId: '', startLocal: osloLocalExact(overlap.start), endLocal: osloLocalExact(overlap.end) }, overlap)).toMatchObject({ start: '2026-10-25T01:15:07Z', end: '2026-10-25T01:15:17Z' })
  })

  it('requires explicit omission of genuine time exceptions and remembers omissions', () => {
    const state = empty(), parsed = parse(exceptions), draft = preview(state, parsed), before = structuredClone(state)
    const rejected = buildDocumentImportCommit(state, draft)
    expect(rejected.ok).toBe(false)
    expect(rejected.errors).toHaveLength(4)
    expect(state).toEqual(before)
    for (const error of rejected.errors) draft.rows[error.index].selected = false
    const first = save(state, draft)
    expect(first.state.planner.events).toHaveLength(3)
    expect(first.source.excludedKeys).toHaveLength(4)
    expect(first.state.planner.events.filter(event => event.point)).toHaveLength(2)
    const loaded = JSON.parse(JSON.stringify(first.state)), repeated = preview(loaded, parsed)
    expect(repeated.rows.filter(row => !row.selected)).toHaveLength(4)
    expect(save(loaded, repeated).state.planner).toEqual(loaded.planner)
  })

  it.each(['', 'ikke en sluttid'])('does not reaffirm an old inferred point from the unresolved end %s', rawEnd => {
    const input = `id;title;dtstart;dtend\nlegacy-point;Syntetisk gammel markør;18.11.2041 10:00;${rawEnd}`
    const parsed = parse(input), legacy = structuredClone(parsed)
    legacy.rows[0].point = true
    legacy.rows[0].endLocal = ''
    legacy.rows[0].endIssues = []
    const first = save(empty(), preview(empty(), legacy)).state, before = structuredClone(first)
    const draft = preview(first, parsed)
    expect(draft.rows[0].point).toBe(false)
    expect(buildDocumentImportCommit(first, draft)).toMatchObject({ ok: false, errors: [expect.objectContaining({ field: 'endLocal' })] })
    expect(first).toEqual(before)
    draft.rows[0].selected = false
    expect(save(first, draft).state.planner.events).toEqual(first.planner.events)
    const corrected = structuredClone(first), event = corrected.planner.events[0]
    corrected.planner.events[0] = validateEvent({ title: event.title, courseId: '', startLocal: osloLocalExact(event.start), endLocal: '2041-11-18T11:00' }, event)
    expect(save(corrected, preview(corrected, parsed)).state.planner.events).toEqual(corrected.planner.events)
  })

  it('preserves IDs, linked work, accepted names, exclusions and undo across corrected names and reimport', () => {
    const initial = empty(), draft = preview(initial)
    draft.rows[3].selected = false
    const first = save(initial, draft).state, originalCourse = first.planner.courses[0]
    first.tasks.push({ id: 'synthetic-linked-task', title: 'Syntetisk arbeid', courseId: originalCourse.id, course: originalCourse.code, completed: false, submitted: false, estimatedMinutes: null, remainingMinutes: null, deadlineLocal: '' })
    const corrected = structuredClone(first)
    corrected.planner.courses[0] = validateCourse({ ...originalCourse, name: 'Mitt avklarte navn' }, originalCourse)
    expect(corrected.planner.courses[0]).toMatchObject({ id: originalCourse.id, nameStatus: 'confirmed' })
    const history = recordChange(first, corrected)
    const repeated = save(corrected).state
    expect(repeated.planner).toEqual(corrected.planner)
    expect(repeated.tasks).toEqual(first.tasks)
    expect(repeated.importSources[0].excludedKeys).toEqual(first.importSources[0].excludedKeys)
    const undone = undoLast(corrected, history)
    expect(undone.ok).toBe(true)
    const restored = save(undone.state).state
    expect(restored.planner.courses[0]).toMatchObject({ id: originalCourse.id, name: '', nameStatus: 'provisional' })
    expect(restored.planner.events.map(event => event.id)).toEqual(first.planner.events.map(event => event.id))
  })

  it.each(['Accepted legacy name', 'SYN742'])('retains a qualified legacy name %s without rewriting historical records', async name => {
    const state = empty(), parsed = parse(), course = parsed.rows[0]
    for (const row of parsed.rows) row.university = 'uio'
    const saved = { id: 'qualified-legacy', name, code: course.code, university: 'uio', year: course.year, semester: course.semester, campusCode: course.campusCode, credits: null, notes: '', description: '' }
    state.planner.courses.push(saved)
    const draft = preview(state, parsed), api = vi.fn()
    await resolveDocumentCourses(draft, { courses: state.planner.courses, api })
    expect(api).not.toHaveBeenCalled()
    const result = save(state, draft)
    expect(result.state.planner.courses).toEqual([saved])
    expect(result.state.planner.events.every(event => event.courseId === saved.id)).toBe(true)
    expect(result.source.entries[0]).toMatchObject({ reference: true, titleOrigin: 'saved' })
  })

  it('reuses qualified provisional courses and asks about ambiguous existing matches', async () => {
    const state = empty(), parsed = parse()
    for (const row of parsed.rows) row.university = 'uio'
    const saved = { id: 'saved-provisional', name: '', nameStatus: 'provisional', code: 'SYN742', university: 'uio', year: 2041, semester: 'autumn', campusCode: 'SYN-CAMPUS', credits: null, notes: '', description: '' }
    state.planner.courses.push(saved)
    const draft = preview(state, parsed)
    expect(save(state, draft).state.planner.courses).toEqual([saved])
    state.planner.courses.push({ ...saved, id: 'ambiguous-second' })
    const ambiguous = preview(state, parsed), api = vi.fn()
    await resolveDocumentCourses(ambiguous, { courses: state.planner.courses, api })
    expect(ambiguous.rows[0].courseTarget).toBe('?')
    expect(buildDocumentImportCommit(state, ambiguous).ok).toBe(false)
    expect(api).not.toHaveBeenCalled()
  })

  it('keeps actual conflicting names unresolved even if a provisional marker is supplied', () => {
    const state = empty(), parsed = parse()
    parsed.rows[0].courseNameConflict = true
    const draft = preview(state, parsed)
    expect(buildDocumentImportCommit(state, draft)).toMatchObject({ ok: false, errors: [expect.objectContaining({ index: 0, field: 'title' })] })
    draft.rows[0].title = 'Avklart konflikt'
    expect(save(state, draft).state.planner.courses[0]).toMatchObject({ name: 'Avklart konflikt', nameStatus: 'confirmed' })
  })

  it('retains a later public course correction and source event revisions without changing IDs', () => {
    const changedText = text.replace('Syntetisk undervisning 01', 'Syntetisk revidert økt')
    expect(changedText).not.toBe(text)
    const first = save(empty()).state, parsed = parse(changedText)
    parsed.rows[0].title = 'Publisert navn'
    delete parsed.rows[0].nameStatus
    parsed.contentHash = 'f'.repeat(64)
    const updated = save(first, preview(first, parsed, first.importSources[0].id)).state
    expect(updated.planner.courses[0]).toMatchObject({ id: first.planner.courses[0].id, name: 'Publisert navn' })
    expect(updated.planner.events.map(event => event.id)).toEqual(first.planner.events.map(event => event.id))
    expect(updated.planner.events[0].title).toBe('Syntetisk revidert økt')
    expect(validPlanner(updated.planner)).toBe(true)
  })

  it('does not replace previously accepted activity names with a new neutral fallback', () => {
    const state = empty(), parsed = parse(), legacy = structuredClone(parsed)
    for (const row of legacy.rows.filter(row => row.titleStatus === 'provisional')) { row.title = ''; delete row.titleStatus }
    const oldDraft = preview(state, legacy)
    for (const row of oldDraft.rows.filter(row => row.kind === 'event' && !row.title)) row.title = `Tidligere avklart navn ${row.index}`
    const first = save(state, oldDraft).state
    const repeated = save(first, preview(first, parsed)).state
    expect(repeated.planner.events).toEqual(first.planner.events)
    expect(repeated.planner.events.slice(-2).every(event => event.title.startsWith('Tidligere avklart navn'))).toBe(true)
  })

  it('keeps neutral activity names truthful after preview and saved time edits', () => {
    const state = empty(), draft = preview(state), neutral = draft.rows.find(row => row.titleStatus === 'provisional')
    expect(neutral.title).toBe('Aktivitet · SYN742 (foreløpig)')
    neutral.startLocal = '2041-12-01T09:00:07'; neutral.endLocal = '2041-12-01T09:00:17'
    const first = save(state, draft).state, event = first.planner.events.find(event => event.id === neutral.targetId)
    expect(event).toMatchObject({ title: 'Aktivitet · SYN742 (foreløpig)', titleStatus: 'provisional', start: '2041-12-01T08:00:07Z', end: '2041-12-01T08:00:17Z' })
    const edited = validateEvent({ title: event.title, courseId: event.courseId, startLocal: '2041-12-02T09:00:07', endLocal: '2041-12-02T09:00:17' }, event)
    expect(edited).toMatchObject({ title: 'Aktivitet · SYN742 (foreløpig)', titleStatus: 'provisional', start: '2041-12-02T08:00:07Z', end: '2041-12-02T08:00:17Z' })
    first.planner.events[first.planner.events.indexOf(event)] = edited
    expect(save(first).state.planner.events.find(item => item.id === edited.id)).toEqual(edited)
  })

  it.each([['course', 'local'], ['course', 'incoming'], ['event', 'local'], ['event', 'incoming']])('chooses the %s %s name and its status/provenance together', (kind, choice) => {
    const first = save(empty()).state
    const field = kind === 'course' ? 'name' : 'title', status = kind === 'course' ? 'nameStatus' : 'titleStatus'
    const collection = kind === 'course' ? first.planner.courses : first.planner.events
    const index = kind === 'course' ? 0 : 28, original = collection[index]
    collection[index] = kind === 'course'
      ? validateCourse({ ...original, name: 'Mitt lokale navn' }, original)
      : validateEvent({ title: 'Mitt lokale navn', courseId: original.courseId, startLocal: osloLocalExact(original.start), endLocal: osloLocalExact(original.end) }, original)
    expect(collection[index][status]).toBe('confirmed')
    const source = Papa.parse(text, { header: true, delimiter: ';', skipEmptyLines: 'greedy' })
    if (kind === 'course') { source.meta.fields.push('coursename'); for (const row of source.data) row.coursename = 'Nytt publisert navn' }
    else source.data[28]['teaching-title_nb'] = 'Nytt publisert navn'
    const changedText = Papa.unparse({ fields: source.meta.fields, data: source.data }, { delimiter: ';' })
    expect(changedText).not.toBe(text)
    const draft = preview(first, parse(changedText), first.importSources[0].id)
    const row = draft.rows.find(row => row.targetId === original.id)
    expect(row.conflicts.map(conflict => conflict.field)).toEqual([field])
    expect(buildDocumentImportCommit(first, draft).errors.map(error => error.field)).toEqual([`conflict:${field}`])
    row.conflictChoices[field] = choice
    const result = save(first, draft), merged = (kind === 'course' ? result.state.planner.courses : result.state.planner.events)[index]
    expect(merged).toMatchObject({ id: original.id, [field]: choice === 'local' ? 'Mitt lokale navn' : 'Nytt publisert navn', [status]: 'confirmed' })
    const entry = result.source.entries.find(entry => entry.targetId === original.id)
    expect(entry.titleOrigin).toBe(choice === 'local' ? 'user' : 'source')
    expect(entry.sourceBase[field]).toBe('Nytt publisert navn')
    const loaded = JSON.parse(JSON.stringify(result.state)), repeated = save(loaded, preview(loaded, parse(changedText)))
    expect(repeated.state.planner).toEqual(loaded.planner)
    expect(repeated.source.entries.find(entry => entry.targetId === original.id).titleOrigin).toBe(entry.titleOrigin)
  })

  it('keeps CSV separate from ICS unless deliberately selected, and rejects stale or invalid writes atomically', () => {
    const state = empty(), ics = { ...parseDocumentIcs('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-calendar\r\nSUMMARY:Syntetisk aktivitet\r\nDTSTART:20411101T100007Z\r\nDTEND:20411101T110017Z\r\nEND:VEVENT\r\nEND:VCALENDAR'), contentHash: 'a'.repeat(64), fileName: 'synthetic.ics' }
    const first = save(state, preview(state, ics)).state, draft = preview(first)
    expect(draft.sourceId).not.toBe(first.importSources[0].id)
    expect(save(first, draft).state.importSources.map(source => source.format)).toEqual(['ics', 'csv'])
    const deliberate = preview(first, parse(), first.importSources[0].id)
    const result = save(first, deliberate)
    expect(result.source).toMatchObject({ id: first.importSources[0].id, format: 'csv', name: 'synthetic-tp.csv', origin: { kind: 'file' } })
    expect(result.source.accounting).toBeUndefined(); expect(result.source.period).toBeUndefined()
    const before = structuredClone(first)
    first.planner.events[0].notes = 'Senere notat'
    const changed = structuredClone(first)
    expect(buildDocumentImportCommit(first, draft)).toMatchObject({ ok: false, stale: true })
    expect(first).toEqual(changed)
    expect(refreshDocumentImportPreview(first, draft).rows).toHaveLength(31)
    const invalid = structuredClone(result.state)
    invalid.planner.courses[0].nameStatus = 'guessed'
    expect(validEnvelope(invalid, { relations: true })).toBe(false)
    const invalidSources = structuredClone(result.source)
    invalidSources.entries[0].sourceBase.nameStatus = 'guessed'
    expect(validImportSources([invalidSources])).toBe(false)
    expect(before.planner.events[0].notes).toBe('')
  })
})
