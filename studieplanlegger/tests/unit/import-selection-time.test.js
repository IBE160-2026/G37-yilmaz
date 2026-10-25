import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseDocumentCsv } from '../../src/document-parsers.js'
import * as imports from '../../src/import-preview.js'
import { emptyPlanner } from '../../src/planner.js'

// Invented input exercises selection without supplying an inferred duration.
const initial = () => ({ schemaVersion: 1, tasks: [], planner: emptyPlanner(), importSources: [] })
const fixture = () => {
  const text = 'eventid;title;dtstart;dtend\nselection-point;Oppdiktet punkt;2041-11-18T10:00:07Z;\nselection-unresolved;Oppdiktet uavklart;2041-11-18T12:00:07Z;\nselection-interval;Oppdiktet intervall;2041-11-18T14:00:07Z;2041-11-18T15:00:17Z'
  return { ...parseDocumentCsv(text), contentHash: createHash('sha256').update(text).digest('hex') }
}

describe('document selection preserves deliberate time decisions', () => {
  it.each(['individual', 'all', 'group'])('reselects an omitted user point through %s selection without inventing a duration', mode => {
    const state = initial(), draft = imports.createDocumentImportPreview(state, fixture())
    imports.chooseDocumentTime(draft.rows[0], 'point')
    imports.chooseDocumentTime(draft.rows[1], '?')
    for (const row of draft.rows) imports.chooseDocumentSelection(row, false)
    for (const row of draft.rows) imports.chooseDocumentSelection(row, false)
    expect(draft.rows.every(row => row.timeChoice === 'omit')).toBe(true)
    const refreshed = imports.refreshDocumentImportPreview(state, draft)
    const members = mode === 'individual' ? [refreshed.rows[0]] : mode === 'group' ? [refreshed.rows[0], refreshed.rows[2]] : refreshed.rows
    for (const row of members) imports.chooseDocumentSelection(row, true)
    expect(refreshed.rows[0]).toMatchObject({ selected: true, timeChoice: 'point', point: true, pointProvenance: 'user', endLocal: '', groupChoiceResolved: true })
    if (mode === 'all') {
      expect(refreshed.rows[1]).toMatchObject({ selected: true, timeChoice: '?', point: false, endLocal: '' })
      expect(imports.buildDocumentImportCommit(state, refreshed)).toMatchObject({ ok: false, errors: [expect.objectContaining({ index: 1, field: 'endLocal' })] })
      imports.chooseDocumentSelection(refreshed.rows[1], false)
    } else expect(refreshed.rows[1]).toMatchObject({ selected: false, timeChoice: 'omit' })
    if (mode !== 'individual') expect(refreshed.rows[2].timeChoice).toBeUndefined()
    const result = imports.buildDocumentImportCommit(state, refreshed)
    expect(result.ok, JSON.stringify(result.errors)).toBe(true)
    expect(result.state.planner.events).toHaveLength(mode === 'individual' ? 1 : 2)
    expect(result.state.planner.events[0]).toMatchObject({ point: true, pointProvenance: 'user', start: '2041-11-18T10:00:07Z', end: '2041-11-18T10:00:07Z' })
    expect(result.state.planner.events.some(event => event.title === 'Oppdiktet uavklart')).toBe(false)
    expect(result.state.planner.events.every(event => !Object.hasOwn(event, 'timeChoiceBeforeOmit'))).toBe(true)
    expect(result.state.tasks).toEqual([])
  })

  it('retains an explicit interval correction through time omission, refresh and reselection', () => {
    const state = initial(), draft = imports.createDocumentImportPreview(state, fixture()), row = draft.rows[0]
    imports.chooseDocumentTime(row, 'interval')
    row.endLocal = '2041-11-18T12:00:17'
    const times = [row.startLocal, row.endLocal, row.originalStart, row.originalEnd]
    imports.chooseDocumentTime(row, 'omit')
    const refreshed = imports.refreshDocumentImportPreview(state, draft), restored = refreshed.rows[0]
    imports.chooseDocumentSelection(restored, true)
    expect(restored).toMatchObject({ selected: true, timeChoice: 'interval', point: false })
    expect([restored.startLocal, restored.endLocal, restored.originalStart, restored.originalEnd]).toEqual(times)
    expect(restored.pointProvenance).toBeUndefined()
    expect(restored.timeChoiceBeforeOmit).toBeUndefined()
    imports.chooseDocumentSelection(refreshed.rows[1], false)
    const result = imports.buildDocumentImportCommit(state, refreshed)
    expect(result.ok).toBe(true)
    expect(result.state.planner.events[0]).toMatchObject({ start: '2041-11-18T10:00:07Z', end: '2041-11-18T11:00:17Z', point: false })
  })

  it('lets a new time decision replace the omitted point without resurrecting its provenance', () => {
    const state = initial(), draft = imports.createDocumentImportPreview(state, fixture()), row = draft.rows[0]
    imports.chooseDocumentTime(row, 'point')
    imports.chooseDocumentTime(row, 'omit')
    imports.chooseDocumentTime(row, 'interval')
    imports.chooseDocumentSelection(row, false)
    imports.chooseDocumentSelection(row, true)
    expect(row).toMatchObject({ selected: true, timeChoice: 'interval', point: false, endLocal: '' })
    expect(row.pointProvenance).toBeUndefined()
    expect(row.timeChoiceBeforeOmit).toBeUndefined()
    expect(imports.buildDocumentImportCommit(state, draft).ok).toBe(false)
  })
})
