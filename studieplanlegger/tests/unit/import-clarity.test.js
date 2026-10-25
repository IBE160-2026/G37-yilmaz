import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseDocumentCsv, parseDocumentIcs } from '../../src/document-parsers.js'
import * as imports from '../../src/import-preview.js'
import { emptyPlanner, eventBlocksTime, osloLocalExact, validateEvent, validPlanner } from '../../src/planner.js'
import { validImportSources } from '../../src/import-source-contract.js'
import { validEnvelope } from '../../src/storage.js'
import { recordChange, undoLast } from '../../src/history.js'
import { eventPresentation, isExamEvent } from '../../src/event-kind.js'
import { calendarEntries } from '../../src/calendar-model.js'

// Entirely invented examples; no student calendar or private source is used.
const empty = () => ({ schemaVersion: 1, tasks: [], planner: emptyPlanner(), importSources: [] })
const parse = (text, format = 'csv') => ({ ...(format === 'ics' ? parseDocumentIcs(text) : parseDocumentCsv(text)), contentHash: createHash('sha256').update(text).digest('hex') })
const preview = (state, parsed, sourceId) => imports.createDocumentImportPreview(state, parsed, { sourceId })
const save = (state, draft) => {
  const result = imports.buildDocumentImportCommit(state, draft)
  expect(result.ok, JSON.stringify(result.errors || result.error)).toBe(true)
  return result.state
}
const csv = (end = '', title = 'Syntetisk tidspunkt', start = '2041-11-18T10:00:07Z') => parse(`eventid;title;dtstart;dtend\nsynthetic-point;${title};${start};${end}`)
const calendar = (institutions = ['HiMolde'], codes = ['SYN851'], uidPrefix = 'synthetic-affiliation') => parse(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${institutions.map((university, index) => `BEGIN:VEVENT\r\nUID:${uidPrefix}-${index}\r\nSUMMARY:Syntetisk aktivitet ${index}\r\nDTSTART:20411118T100007Z\r\nDTEND:20411118T110017Z\r\nX-COURSE-CODE:${codes[index] || codes[0]}\r\nX-COURSE-NAME:Syntetisk emne\r\n${university ? `X-UNIVERSITY:${university}\r\n` : ''}END:VEVENT`).join('\r\n')}\r\nEND:VCALENDAR`, 'ics')

describe('unique saved affiliation context', () => {
  it('restores an omitted institution by UID, retains IDs, and reloads the accepted context', () => {
    const state = empty(), first = save(state, preview(state, calendar()))
    const incoming = calendar(['']), draft = preview(first, incoming)
    expect(draft.sourceId).toBe(first.importSources[0].id)
    expect(draft.rows.find(row => row.kind === 'course')).toMatchObject({ university: 'HiMolde', courseTarget: first.planner.courses[0].id })
    const second = save(first, draft)
    expect(second.planner).toEqual(first.planner)
    const loaded = JSON.parse(JSON.stringify(second))
    expect(save(loaded, preview(loaded, incoming)).planner).toEqual(first.planner)
  })

  it('restores separately saved affiliations when omitted same-code proposals collapse', () => {
    const state = empty(), first = save(state, preview(state, calendar(['HiMolde', 'NTNU'])))
    const incoming = calendar(['', ''])
    expect(incoming.rows.filter(row => row.kind === 'course')).toHaveLength(1)
    const draft = preview(first, incoming, first.importSources[0].id)
    expect(draft.rows.filter(row => row.kind === 'course').map(row => row.university).sort()).toEqual(['HiMolde', 'NTNU'])
    expect(save(first, draft).planner).toEqual(first.planner)
  })

  it('restores an explicit same-source CSV affiliation chosen by the user', () => {
    const parsed = parse('eventid;title;courseid;coursename;dtstart;dtend\nsynthetic-csv;Syntetisk økt;SYN853;Syntetisk emne;2041-11-18T10:00Z;2041-11-18T11:00Z')
    const state = empty(), draft = preview(state, parsed)
    draft.rows.find(row => row.kind === 'course').university = 'NTNU'
    const first = save(state, draft), revised = parse('eventid;title;courseid;coursename;dtstart;dtend\nsynthetic-csv;Syntetisk revidert økt;SYN853;Syntetisk emne;2041-11-18T10:00Z;2041-11-18T11:00Z')
    const next = preview(first, revised, first.importSources[0].id)
    expect(next.rows.find(row => row.kind === 'course')).toMatchObject({ university: 'NTNU', courseTarget: first.planner.courses[0].id })
    const second = save(first, next)
    expect(second.planner.courses).toEqual(first.planner.courses)
    expect(second.planner.events[0]).toMatchObject({ id: first.planner.events[0].id, title: 'Syntetisk revidert økt', courseId: first.planner.courses[0].id })
  })

  it('retains an accepted local affiliation correction when the next source omits affiliation', () => {
    const state = empty(), first = save(state, preview(state, calendar()))
    first.planner.courses[0].university = 'NTNU'
    const draft = preview(first, calendar(['']), first.importSources[0].id)
    expect(draft.rows.find(row => row.kind === 'course').conflicts).toEqual([])
    expect(save(first, draft).planner).toEqual(first.planner)
  })

  it('retains an explicitly approved unknown institution only through the saved source and UID relationship', () => {
    const state = empty(), first = save(state, preview(state, calendar()))
    const correction = preview(first, calendar()), course = correction.rows.find(row => row.kind === 'course')
    course.university = ''
    course.institutionCorrection = JSON.stringify([course.targetId, 'HiMolde', ''])
    const cleared = save(first, correction), sourceId = cleared.importSources[0].id
    expect(cleared.planner.courses[0].university).toBe('')
    const incoming = calendar(['']), draft = preview(cleared, incoming, sourceId)
    expect(draft.rows.find(row => row.kind === 'course')).toMatchObject({ university: '', courseTarget: cleared.planner.courses[0].id })
    const next = save(cleared, draft)
    expect(next.planner).toEqual(cleared.planner)
    const loaded = JSON.parse(JSON.stringify(next))
    expect(save(loaded, preview(loaded, incoming)).planner).toEqual(cleared.planner)
    const newUid = preview(cleared, calendar([''], ['SYN851'], 'synthetic-unrelated-unknown'), sourceId)
    expect(newUid.rows.find(row => row.kind === 'event').matchEntryKey).toBe('')
    const contradictory = preview(cleared, calendar(['NTNU']), sourceId)
    expect(contradictory.rows.find(row => row.kind === 'event').matchEntryKey).toBe('')
    expect(imports.buildDocumentImportCommit(cleared, contradictory).ok).toBe(false)
  })

  it('keeps excluded unknown rows from creating an unused course during affiliation restoration', () => {
    const state = empty(), codes = ['SYN851', 'SYN852', 'SYN853', 'SYN851']
    const draft = preview(state, calendar(['HiMolde', 'NTNU', '', 'HiMolde'], codes))
    draft.rows.filter(row => row.kind === 'event').at(-1).selected = false
    const first = save(state, draft), next = preview(first, calendar(['', '', '', ''], codes), first.importSources[0].id)
    expect(next.rows.filter(row => row.kind === 'event').at(-1).selected).toBe(false)
    expect(save(first, next).planner).toEqual(first.planner)
  })

  it('retains mixed affiliations, local edits and exclusions through successive identical omitted-affiliation imports', () => {
    const state = empty(), codes = ['SYN851', 'SYN852', 'SYN853', 'SYN851']
    const draft = preview(state, calendar(['HiMolde', 'NTNU', '', 'HiMolde'], codes))
    draft.rows.filter(row => row.kind === 'event').at(-1).selected = false
    let saved = save(state, draft)
    saved.planner.courses[0].name = 'Syntetisk lokalt emnenavn'
    saved.planner.events[1].notes = 'Syntetisk lokalt notat som beholdes'
    const expected = structuredClone(saved), incoming = calendar(['', '', '', ''], codes)
    let entries
    for (let repeat = 0; repeat < 3; repeat++) {
      saved = JSON.parse(JSON.stringify(saved))
      const next = preview(saved, incoming, saved.importSources[0].id)
      expect(next.rows.filter(row => row.kind === 'event').at(-1).selected).toBe(false)
      saved = save(saved, next)
      expect(saved.planner).toEqual(expected.planner)
      expect(saved.importSources[0].excludedKeys).toEqual(expected.importSources[0].excludedKeys)
      expect(saved.importSources[0].entries.map(entry => entry.targetId)).toEqual(expected.importSources[0].entries.map(entry => entry.targetId))
      if (entries) expect(saved.importSources[0].entries).toEqual(entries)
      entries = structuredClone(saved.importSources[0].entries)
    }
  })

  it.each([false, true])('keeps distinct saved proposals with an omitted unknown event and mixed institutions %s', mixed => {
    const state = empty(), institutions = mixed ? ['HiMolde', '', ''] : ['', ''], parsed = calendar(institutions), draft = preview(state, parsed)
    for (const event of draft.rows.filter(row => row.kind === 'event')) event.courseChoice = `row:${draft.rows.find(row => row.kind === 'course' && row.university === event.university).index}`
    draft.rows.filter(row => row.kind === 'event').at(-1).selected = false
    const first = save(state, draft), next = preview(first, calendar(institutions.map(() => '')), first.importSources[0].id)
    expect(next.rows.filter(row => row.kind === 'course')).toHaveLength(mixed ? 2 : 1)
    expect(next.rows.filter(row => row.kind === 'event').at(-1)).toMatchObject({ selected: false, university: '' })
    expect(save(first, next).planner).toEqual(first.planner)
  })

  it('keeps a genuinely new unknown UID unresolved among same-code known and unknown courses', () => {
    const state = empty(), draft = preview(state, calendar(['HiMolde', '']))
    for (const event of draft.rows.filter(row => row.kind === 'event')) event.courseChoice = `row:${draft.rows.find(row => row.kind === 'course' && row.university === event.university).index}`
    const first = save(state, draft)
    const next = preview(first, calendar(['', '', '']), first.importSources[0].id)
    expect(next.rows.filter(row => row.kind === 'course')).toHaveLength(2)
    const added = next.rows.filter(row => row.kind === 'event').at(-1)
    expect(added).toMatchObject({ selected: true, university: '', matchEntryKey: '', courseChoice: '?' })
    expect(imports.buildDocumentImportCommit(first, next).ok).toBe(false)
    added.selected = false
    expect(save(first, next).planner).toEqual(first.planner)
  })

  it.each(['sourceObjectId', 'campus', 'campusCode'])('requires clarification for contradictory %s despite an unchanged UID', field => {
    const state = empty(), first = save(state, preview(state, calendar()))
    const incoming = calendar([''])
    for (const row of incoming.rows) row[field] = 'SYNTHETIC-CONTRADICTION'
    const draft = preview(first, incoming, first.importSources[0].id)
    expect(draft.rows.find(row => row.kind === 'event').matchEntryKey).toBe('')
    expect(draft.rows.find(row => row.kind === 'course').university).toBe('')
    expect(imports.buildDocumentImportCommit(first, draft).ok).toBe(false)
  })

  it('does not restore from a code alone, contradictory source context, or ambiguous source UIDs', () => {
    const state = empty(), first = save(state, preview(state, calendar()))
    const newUid = calendar([''], ['SYN851'], 'synthetic-unrelated-affiliation')
    expect(preview(first, newUid).sourceId).not.toBe(first.importSources[0].id)
    const contradictory = preview(first, calendar(['NTNU']), first.importSources[0].id)
    expect(contradictory.rows.find(row => row.kind === 'event').matchEntryKey).toBe('')
    expect(imports.buildDocumentImportCommit(first, contradictory).ok).toBe(false)
    const wrongCode = preview(first, calendar([''], ['SYN999']), first.importSources[0].id)
    expect(wrongCode.rows.find(row => row.kind === 'course').university).toBe('')
    expect(imports.buildDocumentImportCommit(first, wrongCode).ok).toBe(false)
    const second = save(first, preview(first, calendar(['NTNU'])))
    expect(() => preview(second, calendar(['']))).toThrow(/flere kilder/)
  })
})

describe('explicit user time clarification', () => {
  it('does not infer exam or deadline presentation from a confirmed user point title', () => {
    const state = empty(), draft = preview(state, csv('', 'Eksamen i oppdiktet SYN953'))
    imports.chooseDocumentTime(draft.rows[0], 'point')
    const saved = save(state, draft), point = saved.planner.events[0]
    expect(eventPresentation(point)).toMatchObject({ isExam: false, label: 'Undervisning', className: '' })
    expect(calendarEntries(saved)).toEqual([expect.objectContaining({ id: point.id, kind: 'teaching', isExam: false, point: true })])
    expect(saved.tasks).toEqual([])
    expect(isExamEvent({ ...point, activityKind: 'exam' })).toBe(true)
    const legacy = { ...point, importSourceId: undefined, importEntryKey: undefined, pointProvenance: undefined }
    expect(isExamEvent(legacy)).toBe(true)
    expect(isExamEvent({ ...legacy, point: false })).toBe(true)
  })

  it('keeps document timing edits free of title-based exam inference while preserving explicit source kinds', () => {
    const state = empty(), parsed = csv('', 'Eksamen i oppdiktet SYN953'), draft = preview(state, parsed)
    imports.chooseDocumentTime(draft.rows[0], 'point')
    const saved = save(state, draft), point = saved.planner.events[0]
    const interval = validateEvent({ title: point.title, courseId: point.courseId, startLocal: osloLocalExact(point.start), endLocal: '2041-11-18T12:00:17' }, point)
    expect(interval).toMatchObject({ point: false, activityKind: '' })
    expect(interval.pointProvenance).toBeUndefined()
    expect(eventPresentation(interval)).toMatchObject({ isExam: false, className: '' })
    saved.planner.events[0] = interval
    const loaded = JSON.parse(JSON.stringify(saved)), next = preview(loaded, parsed)
    expect(eventPresentation(next.rows[0]).isExam).toBe(false)
    expect(eventPresentation(preview(state, parsed).rows[0]).isExam).toBe(false)
    expect(save(loaded, next).planner).toEqual(saved.planner)
    expect(calendarEntries(saved)).toEqual([expect.objectContaining({ id: point.id, kind: 'teaching', isExam: false, point: false })])
    expect(isExamEvent({ title: interval.title, sourceId: 'synthetic-legacy-calendar' })).toBe(true)
    const explicit = preview(state, parse('eventid;title;dtstart;dtend;activitykind\nsynthetic-structured-exam;Oppdiktet avsluttende prøve;2041-11-18T10:00Z;2041-11-18T11:00Z;exam'))
    expect(eventPresentation(explicit.rows[0]).isExam).toBe(true)
    expect(eventPresentation(save(state, explicit).planner.events[0]).isExam).toBe(true)
  })

  it.each(['', '2041-11-18T10:00:07Z', 'ikke en sluttid'])('preserves a user point for unresolved end %s through refresh, save, reload and reimport', end => {
    const state = empty(), parsed = csv(end), draft = preview(state, parsed), row = draft.rows[0]
    expect(imports.buildDocumentImportCommit(state, draft).ok).toBe(false)
    imports.chooseDocumentTime(row, 'point')
    const refreshed = imports.refreshDocumentImportPreview(state, draft)
    expect(refreshed.rows[0]).toMatchObject({ point: true, pointProvenance: 'user', timeChoice: 'point', endLocal: '' })
    const first = save(state, refreshed), event = first.planner.events[0]
    expect(event).toMatchObject({ point: true, pointProvenance: 'user', start: '2041-11-18T10:00:07Z', end: '2041-11-18T10:00:07Z' })
    expect(eventBlocksTime(event)).toBe(false)
    expect(event.activityKind).toBe('')
    expect(first.tasks).toEqual([])
    expect(first.importSources[0].entries[0].sourceBase.point).toBe(false)
    expect(first.importSources[0].entries[0].sourceBase.pointProvenance).toBeUndefined()
    expect(validEnvelope(JSON.parse(JSON.stringify(first)), { relations: true })).toBe(true)
    expect(save(first, preview(first, parsed)).planner).toEqual(first.planner)
    const revised = preview(first, csv(end, 'Syntetisk revidert tidspunkt'), first.importSources[0].id)
    expect(revised.rows[0]).toMatchObject({ point: true, pointProvenance: 'user' })
    expect(save(first, revised).planner.events[0]).toMatchObject({ id: event.id, point: true, pointProvenance: 'user', title: 'Syntetisk revidert tidspunkt' })
  })

  it('still rejects an invalid or ambiguous start and forged provenance', () => {
    const state = empty(), draft = preview(state, csv('', 'Syntetisk ugyldig start', 'ikke en start'))
    imports.chooseDocumentTime(draft.rows[0], 'point')
    expect(imports.buildDocumentImportCommit(state, draft)).toMatchObject({ ok: false, errors: [expect.objectContaining({ field: 'startLocal' })] })
    draft.rows[0].startLocal = '2026-10-25T02:15'
    expect(imports.buildDocumentImportCommit(state, draft).ok).toBe(false)
    const good = preview(state, csv()); imports.chooseDocumentTime(good.rows[0], 'point')
    const saved = save(state, good)
    for (const value of ['source', 'automatic', {}, true]) {
      const bad = structuredClone(saved); bad.planner.events[0].pointProvenance = value
      expect(validPlanner(bad.planner)).toBe(false)
      bad.importSources[0].entries[0].sourceBase.pointProvenance = value
      expect(validImportSources(bad.importSources)).toBe(false)
    }
    const bad = structuredClone(saved); bad.planner.events[0].point = false; bad.planner.events[0].end = '2041-11-18T11:00:07Z'
    expect(validPlanner(bad.planner)).toBe(false)
    bad.importSources[0].entries[0].sourceBase.pointProvenance = 'user'
    expect(validImportSources(bad.importSources)).toBe(false)
  })

  it('restores interval behavior after a positive end edit and retains it on reimport', () => {
    const state = empty(), parsed = csv(), draft = preview(state, parsed)
    imports.chooseDocumentTime(draft.rows[0], 'point')
    draft.rows[0].endLocal = '2041-11-18T12:00:17'
    const interval = save(state, draft).planner.events[0]
    expect(interval.point).toBe(false); expect(interval.pointProvenance).toBeUndefined(); expect(eventBlocksTime(interval)).toBe(true)
    const pointDraft = preview(state, parsed); imports.chooseDocumentTime(pointDraft.rows[0], 'point')
    const first = save(state, pointDraft), point = first.planner.events[0]
    first.planner.events[0] = validateEvent({ title: point.title, courseId: '', startLocal: osloLocalExact(point.start), endLocal: '2041-11-18T12:00:17' }, point)
    expect(first.planner.events[0].pointProvenance).toBeUndefined()
    expect(save(first, preview(first, parsed)).planner).toEqual(first.planner)
  })

  it('keeps an edited point start on a source title revision and supports undo and stale rejection', () => {
    const state = empty(), parsed = csv(), draft = preview(state, parsed)
    imports.chooseDocumentTime(draft.rows[0], 'point')
    const first = save(state, draft), point = first.planner.events[0]
    first.planner.events[0] = validateEvent({ title: point.title, courseId: '', startLocal: '2041-11-18T12:15:09', endLocal: '', notes: 'Syntetisk lokalt notat' }, point)
    const update = preview(first, csv('', 'Syntetisk tittelrevisjon'), first.importSources[0].id)
    const second = save(first, update)
    expect(second.planner.events[0]).toMatchObject({ start: first.planner.events[0].start, end: first.planner.events[0].end, point: true, pointProvenance: 'user', notes: 'Syntetisk lokalt notat', title: 'Syntetisk tittelrevisjon' })
    const history = recordChange(first, second)
    expect(validEnvelope({ ...second, history }, { relations: true })).toBe(true)
    const undone = undoLast(second, history)
    expect(undone.ok).toBe(true); expect(undone.state.planner).toEqual(first.planner)
    expect(imports.buildDocumentImportCommit(second, update)).toMatchObject({ ok: false, stale: true })
  })

  it('accepts a later valid source interval after the old conditional point decision expires', () => {
    const state = empty(), draft = preview(state, csv())
    imports.chooseDocumentTime(draft.rows[0], 'point')
    const first = save(state, draft), revised = csv('2041-11-18T11:00:17Z')
    const update = preview(first, revised, first.importSources[0].id)
    expect(update.rows[0].conflicts).toEqual([])
    expect(imports.buildDocumentImportCommit(first, update).ok).toBe(true)
    const second = save(first, update)
    expect(second.planner.events[0]).toMatchObject({ point: false, end: '2041-11-18T11:00:17Z' })
    expect(second.planner.events[0].pointProvenance).toBeUndefined()
    expect(save(second, preview(second, revised)).planner).toEqual(second.planner)
  })

  it('retains explicit omissions and clears point provenance when interval correction is chosen', () => {
    const state = empty(), draft = preview(state, csv('ikke en sluttid'))
    imports.chooseDocumentTime(draft.rows[0], 'point')
    imports.chooseDocumentTime(draft.rows[0], 'interval')
    expect(draft.rows[0].point).toBe(false); expect(draft.rows[0].pointProvenance).toBeUndefined()
    expect(imports.buildDocumentImportCommit(state, draft).ok).toBe(false)
    imports.chooseDocumentTime(draft.rows[0], 'omit')
    expect(imports.refreshDocumentImportPreview(state, draft).rows[0]).toMatchObject({ selected: false, timeChoice: 'omit' })
  })
})
