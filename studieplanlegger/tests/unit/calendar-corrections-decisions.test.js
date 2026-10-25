import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { previewBackup } from '../../src/backup.js'
import { parseDocumentCsv } from '../../src/document-parsers.js'
import { buildDocumentImportCommit, chooseDocumentTime, createDocumentImportPreview, refreshDocumentImportPreview } from '../../src/import-preview.js'
import { emptyPlanner, eventBlocksTime } from '../../src/planner.js'
import { validEnvelope } from '../../src/storage.js'

// Independently invented calendar values, never copied from a student source.
const empty = () => ({ schemaVersion: 1, tasks: [], planner: emptyPlanner(), importSources: [] })
const csv = ({ start = '2041-11-18T10:00:07Z', end = start, title = 'Syntetisk tidspunkt' } = {}) => {
  const text = `eventid;title;dtstart;dtend\nsynthetic-correction;${title};${start};${end}`
  return { ...parseDocumentCsv(text), contentHash: createHash('sha256').update(text).digest('hex') }
}
const preview = (state, parsed) => createDocumentImportPreview(state, parsed, { sourceId: state.importSources[0]?.id })
const save = (state, draft) => {
  const result = buildDocumentImportCommit(state, draft)
  expect(result.ok, JSON.stringify(result.errors || result.error)).toBe(true)
  expect(validEnvelope(result.state, { relations: true })).toBe(true)
  return JSON.parse(JSON.stringify(result.state))
}
const pointState = parsed => {
  const state = empty(), draft = preview(state, parsed)
  chooseDocumentTime(draft.rows[0], 'point')
  return save(state, draft)
}

describe('persisted source timing validation at storage and backup boundaries', () => {
  const backup = data => JSON.stringify({ format: 'studieplan-local-backup', backupVersion: 1, createdAt: '2041-11-20T08:00:00Z', data })
  const remove = key => value => { delete value[key]; return value }
  const replace = (key, replacement) => value => ({ ...value, [key]: replacement })

  it.each([
    ['null', () => null],
    ['array', () => []],
    ['string', () => 'synthetic provenance'],
    ['missing start', remove('start')],
    ['missing end', remove('end')],
    ['missing point', remove('point')],
    ['missing allDay', remove('allDay')],
    ['unexpected property', replace('unexpected', true)],
    ['numeric start', replace('start', 2041)],
    ['null end', replace('end', null)],
    ['empty start', replace('start', '')],
    ['invalid end without raw marker', replace('end', 'independently-invented-invalid-time')],
    ['invalid instant', replace('start', '2041-99-99T10:00:07Z')],
    ['start without offset', replace('start', '2041-11-18T10:00:07')],
    ['end without offset', replace('end', '2041-11-18T10:30:17')],
    ['string point', replace('point', 'false')],
    ['numeric allDay', replace('allDay', 0)],
    ['oversized raw source', replace('end', `raw:${'x'.repeat(1_999_997)}`)],
  ])('rejects %s without changing the candidate or current planner', (_name, corrupt) => {
    const current = pointState(csv({ end: '', title: 'Syntetisk beholdt aktivitet' })), before = structuredClone(current)
    const candidate = structuredClone(current), entry = candidate.importSources[0].entries[0]
    entry.sourceTiming = corrupt(entry.sourceTiming)
    const candidateBefore = structuredClone(candidate)

    expect(validEnvelope(candidate, { relations: true })).toBe(false)
    const result = previewBackup(backup(candidate), current)
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Lagrede data er beholdt') })
    expect(result.data).toBeUndefined()
    expect(candidate).toEqual(candidateBefore)
    expect(current).toEqual(before)
  })

  it.each([
    ['valid instant', '2041-11-18T10:00:07Z', false],
    ['missing raw time', '', false],
    ['invalid raw time', 'independently-invented-invalid-time', false],
    ['absent legacy provenance', '', true],
  ])('accepts %s without changing the current planner', (_name, end, legacy) => {
    const candidate = pointState(csv({ end })), current = pointState(csv({ title: 'Syntetisk beholdt aktivitet' }))
    if (legacy) delete candidate.importSources[0].entries[0].sourceTiming
    const before = structuredClone(current), candidateBefore = structuredClone(candidate)

    expect(validEnvelope(candidate, { relations: true })).toBe(true)
    const result = previewBackup(backup(candidate), current)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual(candidate)
    expect(candidate).toEqual(candidateBefore)
    expect(current).toEqual(before)
  })
})

describe('source-bound calendar timing decisions', () => {
  it('asks once when changed legacy unresolved timing has no raw source provenance', () => {
    const original = csv({ end: '' }), state = pointState(original)
    delete state.importSources[0].entries[0].sourceTiming
    expect(preview(state, original).rows[0].point).toBe(true)
    const draft = preview(state, csv({ end: 'synthetic-invalid-end' }))
    expect(draft.rows[0].point).not.toBe(true)
    expect(buildDocumentImportCommit(state, draft).ok).toBe(false)
    chooseDocumentTime(draft.rows[0], 'point')
    const confirmed = save(state, draft)
    expect(confirmed.importSources[0].entries[0].sourceTiming.end).toBe('raw:synthetic-invalid-end')
    expect(preview(confirmed, csv({ end: 'synthetic-invalid-end', title: 'Syntetisk ny tittel' })).rows[0].point).toBe(true)
  })

  it('retains a legacy point on a title-only revision when both original source instants are valid and unchanged', () => {
    const state = pointState(csv())
    delete state.importSources[0].entries[0].sourceTiming
    const draft = preview(state, csv({ title: 'Syntetisk ny tittel' }))
    expect(draft.rows[0]).toMatchObject({ point: true, pointProvenance: 'user' })
    expect(save(state, draft).planner.events[0]).toMatchObject({ id: state.planner.events[0].id, point: true, title: 'Syntetisk ny tittel' })
  })

  it.each(['', '2041-11-18T10:00:07Z', 'synthetic-invalid-end'])('retains a point for unchanged timing and title-only updates: %s', end => {
    const state = pointState(csv({ end })), draft = preview(state, csv({ end, title: 'Oppdatert syntetisk tittel' }))
    expect(draft.rows[0]).toMatchObject({ point: true, pointProvenance: 'user', timeChoice: 'point' })
    const next = save(state, draft)
    expect(next.planner.events[0]).toMatchObject({ id: state.planner.events[0].id, title: 'Oppdatert syntetisk tittel', point: true, pointProvenance: 'user' })
  })

  it.each(['', '2041-11-18T10:00:07Z', 'synthetic-invalid-end'])('reassesses the old point when source start changes: %s', end => {
    const state = pointState(csv({ end })), draft = preview(state, csv({ start: '2041-11-19T10:00:07Z', end }))
    expect(draft.rows[0].point).not.toBe(true)
    expect(draft.rows[0].pointProvenance).toBeUndefined()
    expect(buildDocumentImportCommit(state, draft).ok).toBe(false)
    chooseDocumentTime(draft.rows[0], 'point')
    for (const conflict of draft.rows[0].conflicts) draft.rows[0].conflictChoices[conflict.field] = 'incoming'
    const next = save(state, draft)
    expect(next.planner.events[0]).toMatchObject({ id: state.planner.events[0].id, start: '2041-11-19T10:00:07Z', end: '2041-11-19T10:00:07Z', point: true, pointProvenance: 'user' })
  })

  it('distinguishes missing and invalid source ends after reload', () => {
    const state = pointState(csv({ end: '' })), draft = preview(state, csv({ end: 'synthetic-invalid-end' }))
    expect(draft.rows[0].point).not.toBe(true)
    expect(buildDocumentImportCommit(state, draft).ok).toBe(false)
  })

  it.each(['', '2041-11-18T10:00:07Z', 'synthetic-invalid-end'])('uses a new valid interval without retaining the old point or asking a false conflict: %s', end => {
    const state = pointState(csv({ end })), draft = preview(state, csv({ end: '2041-11-18T10:30:17Z' }))
    expect(draft.rows[0].conflicts).toEqual([])
    const next = save(state, draft), event = next.planner.events[0]
    expect(event).toMatchObject({ id: state.planner.events[0].id, start: '2041-11-18T10:00:07Z', end: '2041-11-18T10:30:17Z', point: false })
    expect(event.pointProvenance).toBeUndefined()
    expect(eventBlocksTime(event)).toBe(true)
  })

  it('retains a local interval correction for unchanged timing and reassesses changed unresolved timing', () => {
    const state = empty(), initial = csv({ end: '' }), draft = preview(state, initial)
    chooseDocumentTime(draft.rows[0], 'interval')
    draft.rows[0].endLocal = '2041-11-18T12:00:17'
    const saved = save(state, draft)
    expect(save(saved, preview(saved, csv({ end: '', title: 'Oppdatert tittel' }))).planner.events[0].end).toBe('2041-11-18T11:00:17Z')
    const changed = preview(saved, csv({ start: '2041-11-19T10:00:07Z', end: '' }))
    expect(changed.rows[0].endLocal).toBe('')
    expect(buildDocumentImportCommit(saved, changed).ok).toBe(false)
  })

  it('preserves a deliberate local interval when the source publishes a conflicting interval', () => {
    const state = empty(), draft = preview(state, csv({ end: '' }))
    chooseDocumentTime(draft.rows[0], 'interval'); draft.rows[0].endLocal = '2041-11-18T12:00:17'
    const saved = save(state, draft), next = preview(saved, csv({ end: '2041-11-18T10:45:17Z' }))
    expect(next.rows[0].conflicts.some(conflict => conflict.field === 'end')).toBe(true)
    expect(buildDocumentImportCommit(saved, next).ok).toBe(false)
    next.rows[0].conflictChoices.end = 'local'
    expect(save(saved, next).planner.events[0].end).toBe(saved.planner.events[0].end)
  })

  it('invalidates a draft point when a refreshed parse changes timing while retaining its title and omission', () => {
    const state = empty(), draft = preview(state, csv({ end: '' }))
    chooseDocumentTime(draft.rows[0], 'point'); draft.rows[0].title = 'Syntetisk lokalt navn'
    const changed = csv({ start: '2041-11-19T10:00:07Z', end: '' }), next = refreshDocumentImportPreview(state, draft, changed)
    expect(next.rows[0]).toMatchObject({ title: 'Syntetisk lokalt navn', startLocal: '2041-11-19T11:00:07' })
    expect(next.rows[0].point).not.toBe(true)
    expect(buildDocumentImportCommit(state, next).ok).toBe(false)
    chooseDocumentTime(draft.rows[0], 'omit')
    expect(refreshDocumentImportPreview(state, draft, changed).rows[0].selected).toBe(false)
  })
})

describe('same-code courses after omitted source affiliation', () => {
  const courses = (omit = false, conflicting = false) => {
    const rows = [
      ['one', 'Oppdiktet keramikk', 'HiMolde'], ['two', 'Oppdiktet astronomi', 'NTNU'],
      ...(conflicting ? [['three', 'Oppdiktet motstridende navn', 'HiMolde']] : []),
    ]
    const text = `eventid;title;courseid;coursename;university;year;semester;dtstart;dtend\n${rows.map(([id, name, institution]) => `${id};Syntetisk økt;SYN744;${name};${omit ? '' : institution};2041;autumn;2041-11-18T10:00:07Z;2041-11-18T11:00:17Z`).join('\n')}`
    return { ...parseDocumentCsv(text), contentHash: createHash('sha256').update(text).digest('hex') }
  }
  it('resolves source names within each proven UID/course relationship, retaining separate names and IDs', () => {
    const state = empty(), first = save(state, preview(state, courses()))
    const incoming = courses(true)
    expect(incoming.rows.find(row => row.kind === 'course').courseNameConflict).toBe(true)
    const draft = preview(first, incoming)
    expect(draft.rows.filter(row => row.kind === 'course').map(row => row.title)).toEqual(['Oppdiktet keramikk', 'Oppdiktet astronomi'])
    const next = save(first, draft)
    expect(next.planner).toEqual(first.planner)
    expect(save(next, preview(next, incoming)).planner).toEqual(first.planner)
  })
  it('does not attach an unmatched same-code UID to one of the known affiliations', () => {
    const state = empty(), first = save(state, preview(state, courses())), next = preview(first, courses(true, true))
    const unmatched = next.rows.find(row => row.kind === 'event' && !row.matchEntryKey)
    expect(unmatched).toMatchObject({ university: '', courseChoice: '?' })
    expect(buildDocumentImportCommit(first, next).ok).toBe(false)
  })
})
