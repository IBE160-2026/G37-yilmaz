import { describe, expect, it } from 'vitest'
import { parseDocumentCsv, parseDocumentDate, parseDocumentIcs, parseDocumentText } from '../../src/document-parsers.js'
import { buildDocumentImportCommit, changeDocumentRowKind, createDocumentImportPreview, refreshDocumentConflicts } from '../../src/import-preview.js'
import { validImportSources } from '../../src/import-source-contract.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { recordChange, undoLast, validHistory } from '../../src/history.js'

const now = new Date('2026-09-19T10:00:00Z')
const empty = () => ({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } })
const course = { id: 'manual', name: 'Mitt emne', code: 'ABC100', university: 'Mitt lærested', semester: 'autumn', year: 2026, credits: 10, notes: 'Mine notater', description: 'Min beskrivelse' }
const courseCsv = 'id;type;tittel;emne;år;semester;studiepoeng\nc;emne;Kildens emne;ABC100;2026;høst;5'
const eventCsv = 'id;type;tittel;start;slutt\na;event;Seminar;2026-09-21T12:00;2026-09-21T13:00'
const preview = (state, parsed, revision = false) => createDocumentImportPreview(state, { ...parsed, contentHash: (revision ? 'b' : 'a').repeat(64) }, revision ? { sourceId: state.importSources[0].id } : {})
const commit = (state, draft) => buildDocumentImportCommit(state, draft, { now })
const saved = result => { expect(result.ok, result.error + JSON.stringify(result.errors || [])).toBe(true); return result.state }
const vtodos = body => parseDocumentIcs(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:todo\r\nSUMMARY:Skriv rapport\r\n${body}\r\nEND:VTODO\r\nEND:VCALENDAR`)

describe('document course references and corrected identities', () => {
  it.each(['PERCENT-COMPLETE:-1', 'PERCENT-COMPLETE:101'])('requires confirmation for invalid VTODO progress: %s', field => {
    const parsed = vtodos(field)
    expect(parsed.rows[0]).toMatchObject({ selected: false, statusNeedsChoice: true, statusChoice: '?' })
  })
  it('preserves manual course fields and reference ownership through repeat, local edits and source revision', () => {
    const original = empty(); original.planner.courses.push(structuredClone(course))
    const parsed = parseDocumentCsv(courseCsv), first = preview(original, parsed)
    first.rows[0].courseTarget = course.id
    const imported = saved(commit(original, first))
    expect(imported.planner.courses).toEqual([course])
    expect(imported.importSources[0].entries[0].reference).toBe(true)
    imported.planner.courses[0].name = 'Lokalt endret emne'
    const local = structuredClone(imported.planner.courses[0])
    const repeated = saved(commit(imported, preview(imported, parsed)))
    expect(repeated.planner.courses).toEqual([local])
    const revised = preview(repeated, parseDocumentCsv(courseCsv.replace('Kildens emne', 'Kildens nye navn').replace(';5', ';15')), true)
    expect(revised.rows[0].conflicts).toEqual([])
    expect(saved(commit(repeated, revised)).planner.courses).toEqual([local])
  })

  it('retains another document ownership and detects legacy references without a marker', () => {
    const owner = saved(commit(empty(), preview(empty(), parseDocumentCsv(courseCsv))))
    const owned = structuredClone(owner.planner.courses[0])
    const parsed = parseDocumentCsv(courseCsv.replace('Kildens emne', 'Annen kilde'))
    const draft = createDocumentImportPreview(owner, { ...parsed, contentHash: 'c'.repeat(64) })
    draft.rows[0].courseTarget = owned.id
    const mapped = saved(commit(owner, draft))
    delete mapped.importSources[1].entries[0].reference
    const repeat = createDocumentImportPreview(mapped, { ...parsed, contentHash: 'c'.repeat(64) })
    const result = saved(commit(mapped, repeat))
    expect(result.planner.courses).toEqual([owned])
    expect(result.importSources[1].entries[0].reference).toBe(true)
    expect(validImportSources(result.importSources, result)).toBe(true)
  })

  it('roundtrips reference provenance through backup and compound undo, rejecting reference-owned targets', () => {
    const before = empty(); before.planner.courses.push(structuredClone(course))
    const parsed = parseDocumentCsv(courseCsv), draft = preview(before, parsed); draft.rows[0].courseTarget = course.id
    const state = saved(commit(before, draft)); state.history = recordChange(before, state, undefined, 'Importer', now)
    expect(validHistory(state.history, state)).toBe(true)
    const restored = previewBackup(JSON.stringify(exportBackup(state, now)), empty())
    expect(restored.ok).toBe(true)
    expect(restored.data.importSources[0].entries[0].reference).toBe(true)
    expect(saved(commit(restored.data, preview(restored.data, parsed))).planner.courses).toEqual([course])
    const undone = undoLast(restored.data, restored.data.history)
    expect(undone.ok).toBe(true); expect(undone.state.planner.courses).toEqual([course]); expect(undone.state.importSources).toBeUndefined()
    state.planner.courses[0].importSourceId = state.importSources[0].id
    state.planner.courses[0].importEntryKey = state.importSources[0].entries[0].key
    expect(validImportSources(state.importSources, state)).toBe(false)
  })

  it('never recreates a deleted mapped course as an owned course', () => {
    const before = empty(); before.planner.courses.push(structuredClone(course))
    const parsed = parseDocumentCsv(courseCsv), first = preview(before, parsed); first.rows[0].courseTarget = course.id
    const state = saved(commit(before, first)); state.planner.courses = []
    const draft = preview(state, parsed); draft.rows[0].recreate = true
    const unchanged = structuredClone(state), result = commit(state, draft)
    expect(result.ok).toBe(false); expect(state).toEqual(unchanged)
    expect(result.errors[0].message).toContain('eksisterende emnet finnes ikke')
  })

  it('clears the previous target when a matched source row becomes new', () => {
    const state = saved(commit(empty(), preview(empty(), parseDocumentCsv(courseCsv))))
    const draft = preview(state, parseDocumentCsv(courseCsv.replace('id;type', 'id;type').replace('\nc;', '\nd;')), true)
    const oldTarget = draft.rows[0].targetId
    expect(draft.rows[0].matchChoice).not.toBe('new')
    draft.rows[0].matchChoice = 'new'
    refreshDocumentConflicts(state, draft)
    expect(draft.rows[0]).toMatchObject({ matchEntryKey: '', courseTarget: '', sourceBase: null, reference: false })
    expect(draft.rows[0].targetId).not.toBe(oldTarget)
  })

  it('uses the final referenced course identity for linked task labels without requiring source period metadata', () => {
    const before = empty(); before.planner.courses.push(structuredClone(course))
    const parsed = parseDocumentCsv('id;type;tittel;emne;år;semester\nc;emne;Kildens navn;DOC100;;\nt;oppgave;Les dokumentet;DOC100;;')
    const draft = preview(before, parsed)
    draft.rows[0].courseTarget = course.id
    const result = saved(commit(before, draft))
    expect(result.planner.courses).toEqual([course])
    expect(result.tasks[0]).toMatchObject({ courseId: course.id, course: course.code })
    expect(result.importSources[0].entries[0]).toMatchObject({ targetId: course.id, reference: true })
  })

  it('stores accepted numeric corrections as a valid baseline and keeps the original excerpt', () => {
    const parsed = parseDocumentCsv('id;type;title;course;year;semester;credits\nc;course;Source course;BAD100;99999;autumn;-5')
    const draft = preview(empty(), parsed), originalSnippet = draft.rows[0].snippet
    Object.assign(draft.rows[0], { year: 2026, credits: 5 })
    const result = saved(commit(empty(), draft))
    expect(result.importSources[0].entries[0]).toMatchObject({ sourceBase: { year: 2026, credits: 5 }, snippet: originalSnippet })
    expect(validImportSources(result.importSources, result)).toBe(true)
    const restored = previewBackup(JSON.stringify(exportBackup(result, now)), empty())
    expect(restored.ok).toBe(true)
    const repeat = preview(restored.data, parsed, true)
    Object.assign(repeat.rows[0], { year: 2026, credits: 5 })
    expect(saved(commit(restored.data, repeat)).planner.courses).toHaveLength(1)
  })

  it('retains corrected event-to-task type, ID, omitted deadline and local edits on identical bytes', () => {
    const parsed = parseDocumentCsv(eventCsv), first = preview(empty(), parsed)
    changeDocumentRowKind(empty(), first, first.rows[0], 'task')
    first.rows[0].deadlineMode = 'none'; first.rows[0].remainingMinutes = 45
    const state = saved(commit(empty(), first)); state.tasks[0].title = 'Min oppgave'; state.tasks[0].remainingMinutes = 60
    const repeat = preview(state, parsed)
    expect(repeat.rows[0]).toMatchObject({ kind: 'task', targetId: state.tasks[0].id, deadlineMode: 'none' })
    const result = saved(commit(state, repeat))
    expect(result.tasks).toEqual(state.tasks); expect(result.planner.events).toEqual([])
    expect(result.importSources[0].revision).toBe(1)
  })

  it('requires explicit atomic replacement on a changed type and can undo the whole replacement', () => {
    const parsed = parseDocumentCsv(eventCsv), state = saved(commit(empty(), preview(empty(), parsed)))
    state.planner.events[0].notes = 'Lokalt notat'
    const draft = preview(state, parsed)
    changeDocumentRowKind(state, draft, draft.rows[0], 'task')
    const before = structuredClone(state)
    expect(commit(state, draft).ok).toBe(false); expect(state).toEqual(before)
    draft.rows[0].typeChangeChoice = 'replace'; draft.rows[0].deadlineMode = 'none'
    const result = saved(commit(state, draft))
    expect(result.planner.events).toEqual([]); expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].id).toBe(state.planner.events[0].id)
    expect(validImportSources(result.importSources, result)).toBe(true)
    const history = recordChange(state, result, undefined, 'Bytt oppføringstype', now)
    expect(validHistory(history, result)).toBe(true)
    const restored = undoLast(result, history)
    expect(restored.ok).toBe(true); expect(restored.state).toEqual(state)
  })

  it('requires clarification when a revised source disagrees with the previously corrected type', () => {
    const parsed = parseDocumentCsv(eventCsv), first = preview(empty(), parsed)
    changeDocumentRowKind(empty(), first, first.rows[0], 'task')
    const state = saved(commit(empty(), first))
    const draft = preview(state, parseDocumentCsv(eventCsv.replace('T13:00', 'T14:00')), true)
    expect(draft.rows[0]).toMatchObject({ kind: 'event', previousKind: 'task', typeChanged: true, targetId: state.tasks[0].id })
    expect(commit(state, draft).ok).toBe(false)
    changeDocumentRowKind(state, draft, draft.rows[0], 'task')
    expect(saved(commit(state, draft)).tasks).toEqual(state.tasks)
  })

  it('refuses to replace an owned task while another task depends on it', () => {
    const parsed = parseDocumentCsv('id;tittel\na;Forbered seminar'), state = saved(commit(empty(), preview(empty(), parsed)))
    state.tasks.push({ id: 'dependent', title: 'Etterarbeid', course: '', deadlineLocal: '', estimatedMinutes: null, completed: false, dependencyIds: [state.tasks[0].id] })
    const draft = preview(state, parsed)
    changeDocumentRowKind(state, draft, draft.rows[0], 'event')
    Object.assign(draft.rows[0], { typeChangeChoice: 'replace', startLocal: '2026-09-21T12:00', endLocal: '2026-09-21T13:00' })
    const before = structuredClone(state), result = commit(state, draft)
    expect(result.ok).toBe(false); expect(result.errors[0].message).toContain('andre koblinger'); expect(state).toEqual(before)
  })

  it('explicitly matches and replaces a source row that changed kind, then repeats it with the same target', () => {
    const parsed = parseDocumentCsv(eventCsv), state = saved(commit(empty(), preview(empty(), parsed)))
    const changed = parseDocumentCsv('id;type;tittel\na;task;Skriv seminarnotat'), draft = preview(state, changed, true)
    expect(draft.rows[0].matchChoice).toBe('?')
    draft.rows[0].matchChoice = state.importSources[0].entries[0].key
    expect(commit(state, draft).ok).toBe(false)
    draft.rows[0].typeChangeChoice = 'replace'
    const result = saved(commit(state, draft))
    expect(result.tasks[0].id).toBe(state.planner.events[0].id); expect(result.planner.events).toEqual([])
    expect(saved(commit(result, preview(result, changed, true))).tasks).toEqual(result.tasks)
  })

  it('refuses a cross-kind target ID collision without modifying either record', () => {
    const parsed = parseDocumentCsv(eventCsv), state = saved(commit(empty(), preview(empty(), parsed)))
    state.tasks.push({ id: state.planner.events[0].id, title: 'Uavhengig lokal oppgave', course: '', deadlineLocal: '', estimatedMinutes: null, completed: false })
    const draft = preview(state, parsed); changeDocumentRowKind(state, draft, draft.rows[0], 'task'); draft.rows[0].typeChangeChoice = 'replace'
    const before = structuredClone(state), result = commit(state, draft)
    expect(result.ok).toBe(false); expect(result.errors[0].message).toContain('tilhører ikke'); expect(state).toEqual(before)
  })
})

describe('calendar work status requires student choice', () => {
  it.each(['STATUS:COMPLETED', 'STATUS:CANCELLED', 'PERCENT-COMPLETE:100', 'COMPLETED:20260918T100000Z', 'STATUS:COMPLETED\r\nPERCENT-COMPLETE:100'])('shows %s and never selects it as open work', status => {
    const parsed = vtodos(status), row = parsed.rows[0]
    expect(row.selected).toBe(false); expect(row.sourceStatus).toBeTruthy(); expect(row.snippet).toContain(row.sourceStatus)
    const draft = preview(empty(), parsed); draft.rows[0].selected = true
    expect(commit(empty(), draft).ok).toBe(false)
    draft.rows[0].statusChoice = 'open'
    const state = saved(commit(empty(), draft))
    expect(state.tasks[0]).toMatchObject({ completed: false, submitted: false })
    const repeat = preview(state, parsed)
    expect(repeat.rows[0]).toMatchObject({ selected: false, statusChoice: '?' })
  })

  it('keeps an existing locally completed task completed without inferring submission', () => {
    const first = vtodos('STATUS:IN-PROCESS'), state = saved(commit(empty(), preview(empty(), first)))
    state.tasks[0].completed = true
    const draft = preview(state, vtodos('STATUS:COMPLETED'), true)
    draft.rows[0].selected = true; draft.rows[0].statusChoice = 'open'
    expect(saved(commit(state, draft)).tasks[0]).toMatchObject({ completed: true, submitted: false })
  })
})

describe('complete timestamp extraction and honest precision', () => {
  it.each(['2026-09-20 kl. 12:00-13:00', '2026-09-20 12:00-13:00', '2026-09-20 12:00 – 13:00', '20.09.2026 12:00-13:00', '20. september 2026 kl. 12:00-13:00'])('preserves the supported local teaching range %s', range => {
    const parsed = parseDocumentText(`Seminar ${range}`)
    expect(parsed.rows[0]).toMatchObject({ startLocal: '2026-09-20T12:00', endLocal: '2026-09-20T13:00' })
    expect(saved(commit(empty(), preview(empty(), parsed))).planner.events[0]).toMatchObject({ start: '2026-09-20T10:00:00Z', end: '2026-09-20T11:00:00Z' })
  })

  it.each(['20.09.2026 12:00 UTC', '20. september 2026 12:00 UTC', '20.09.2026 12:00 CET', '20.09.2026 12:00 PST', '20.09.2026 12:00+00:00', '2026-09-20 12:00 UTC', '2026-09-20T12:00+00:00 UTC', '2026-09-20T12:00 PST', '20.09.2026 12:00:30'])('keeps unsupported local timestamp precision %s unresolved', timestamp => {
    const parsed = parseDocumentText(`Innlevering ${timestamp}`)
    expect(parsed.rows[0]).toMatchObject({ deadlineRaw: timestamp, deadlineLocal: '' })
    expect(commit(empty(), preview(empty(), parsed)).ok).toBe(false)
  })

  it.each(['2026-09-20 kl. 12:00-13:00 UTC', '20.09.2026 12:00 - 13:00 CET'])('requires zone clarification for the local teaching range %s', range => {
    const parsed = parseDocumentText(`Seminar ${range}`)
    expect(parsed.rows[0]).toMatchObject({ startLocal: '', endLocal: '' })
    expect(commit(empty(), preview(empty(), parsed)).ok).toBe(false)
  })

  it('does not invent an event end from the offset in a T-form ISO timestamp', () => {
    const parsed = parseDocumentText('Seminar 2026-09-20T21:00-06:00')
    expect(parsed.rows[0]).toMatchObject({ startLocal: '2026-09-21T05:00', endLocal: '' })
    expect(commit(empty(), preview(empty(), parsed)).ok).toBe(false)
  })

  it.each([
    ['2026-09-20T12:00Z - 13:00', '2026-09-20T14:00', '2026-09-20T15:00'],
    ['2026-09-20T12:00-04:00 - 13:30', '2026-09-20T18:00', '2026-09-20T19:30'],
    ['2026-09-20T23:30+02:00 - 01:00', '2026-09-20T23:30', '2026-09-21T01:00'],
  ])('uses the explicit start offset and source-local date for teaching range %s', (range, startLocal, endLocal) => {
    const parsed = parseDocumentText(`Seminar ${range}`)
    expect(parsed.rows[0]).toMatchObject({ startLocal, endLocal })
    expect(commit(empty(), preview(empty(), parsed)).ok).toBe(true)
  })

  it.each(['2026-09-20T12:00Z - 12:00', '2026-09-20T12:00Z - 25:00', '2026-09-20T12:00 CET - 13:00'])('requires clarification for invalid explicit teaching range %s', range => {
    const parsed = parseDocumentText(`Seminar ${range}`)
    expect(parsed.rows[0].endLocal).toBe('')
    expect(commit(empty(), preview(empty(), parsed)).ok).toBe(false)
  })

  it.each([
    ['2026-09-20T12:00+00:00', '2026-09-20T14:00'],
    ['2026-09-20T12:00Z', '2026-09-20T14:00'],
    ['2026-09-20T12:00:00Z', '2026-09-20T14:00'],
    ['2026-09-20T12:00-04:00', '2026-09-20T18:00'],
  ])('preserves %s through text, preview and saved deadline', (timestamp, expected) => {
    const parsed = parseDocumentText(`Innlevering med frist ${timestamp}`)
    expect(parsed.rows[0]).toMatchObject({ deadlineRaw: timestamp, deadlineLocal: expected })
    expect(saved(commit(empty(), preview(empty(), parsed))).tasks[0].deadlineLocal).toBe(expected)
  })

  it.each(['2026-09-20T12:00:30Z', '2026-09-20T12:00:00.123Z', '2026-09-20T12:00.5Z', '2026-09-20T12:00:3Z', '2026-09-20T12:00+00:00:30', '2026-09-20T12:00Z+00:00', '2026-09-20T12:00+25:00', '2026-09-20T12:00+0000', '2026-09-20T12:00 CET', '2026-09-20T12:00[Europe/Oslo]', '2026-10-25T02:30', '2026-10-25T00:30Z', '2026-03-29T02:30'])('leaves unsupported or unrepresentable precision %s unresolved', timestamp => {
    expect(parseDocumentDate(timestamp).value).toBe('')
    const parsed = parseDocumentText(`Innlevering med frist ${timestamp}`)
    expect(parsed.rows[0]).toMatchObject({ deadlineRaw: timestamp, deadlineLocal: '' })
    const draft = preview(empty(), parsed)
    expect(draft.rows[0].deadlineMode).toBe('?'); expect(commit(empty(), draft).ok).toBe(false)
  })

  it.each(['DUE;TZID=Europe/Oslo:20260920T120030', 'DUE;TZID=Europe/Oslo:20261025T023000', 'DUE:20261025T003000Z'])('does not lose VTODO seconds or ambiguous Oslo offsets for %s', due => {
    const parsed = vtodos(due)
    expect(parsed.rows[0].deadlineLocal).toBe(''); expect(parsed.rows[0].deadlineIssues.length).toBeGreaterThan(0)
    const draft = preview(empty(), parsed)
    expect(commit(empty(), draft).ok).toBe(false)
    Object.assign(draft.rows[0], { deadlineLocal: '2026-10-25T02:30', deadlineMode: 'value' })
    expect(commit(empty(), draft).ok).toBe(false)
    draft.rows[0].deadlineMode = 'none'
    expect(commit(empty(), draft).ok).toBe(true)
  })
})
