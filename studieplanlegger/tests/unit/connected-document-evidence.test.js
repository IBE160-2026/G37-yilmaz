import { describe, it, expect } from 'vitest'
import { parseDocumentIcs, parseDocumentCsv } from '../../src/document-parsers.js'
import { buildDocumentImportCommit, createDocumentImportPreview } from '../../src/import-preview.js'
import { DOCUMENT_DESCRIPTION_LIMIT, IMPORT_WARNING_LIMITS, validImportSources } from '../../src/import-source-contract.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { createStorage, STORAGE_KEY, validEnvelope } from '../../src/storage.js'
import { recordChange, undoLast } from '../../src/history.js'

const empty = () => ({ schemaVersion: 1, tasks: [] })
const now = new Date('2026-09-19T10:00:00Z')
const calendar = description => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:long-description', 'SUMMARY:Seminar', 'DTSTART:20260920T100000Z', 'DTEND:20260920T110000Z', `DESCRIPTION:${description}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
const parsedCalendar = description => ({ ...parseDocumentIcs(calendar(description), { semester: 'autumn', year: 2026 }), contentHash: 'a'.repeat(64), fileName: 'Seminar.ics' })
const preview = (state, parsed, options) => { const result = createDocumentImportPreview(state, parsed, options); result.rows.forEach(row => { row.selected = true }); return result }
const commit = (state, draft) => buildDocumentImportCommit(state, draft, { now })

describe('R8 correctable document fields and retained source evidence', () => {
  it('preserves a 10,001-character VEVENT description through actual storage, backup, restore and exact repeat', () => {
    const description = 'L'.repeat(10001), parsed = parsedCalendar(description)
    const result = commit(empty(), preview(empty(), parsed))
    expect(result.ok).toBe(true)
    expect(result.state.planner.events[0].description).toBe(description)
    expect(result.source.entries[0].sourceBase.description).toBe(description)
    let raw = null
    const local = { getItem: key => key === STORAGE_KEY ? raw : null, setItem: (key, value) => { if (key === STORAGE_KEY) raw = value } }
    const storage = createStorage(() => local); storage.read()
    expect(storage.writeEnvelope(result.state).ok).toBe(true)
    const reload = createStorage(() => local); expect(reload.read().ok).toBe(true)
    const restored = previewBackup(JSON.stringify(exportBackup(reload.snapshot(), now)), empty())
    expect(restored.ok).toBe(true)
    expect(restored.data.planner.events[0].description).toBe(description)
    const repeated = commit(restored.data, preview(restored.data, parsed))
    expect(repeated.ok).toBe(true); expect(repeated.counts.added).toBe(0)
    expect(repeated.source.revision).toBe(1)
    expect(repeated.state.planner.events[0].description).toBe(description)
  })

  it('returns a field correction for an oversized edit without losing the source or partial writes', () => {
    const state = empty(), draft = preview(state, parsedCalendar('Original description'))
    draft.rows[0].description = 'x'.repeat(DOCUMENT_DESCRIPTION_LIMIT + 1)
    const result = commit(state, draft)
    expect(result).toMatchObject({ ok: false, errors: [{ index: 0, field: 'description' }] })
    expect(state).toEqual(empty())
    draft.rows[0].description = 'Studentens rettede beskrivelse'
    const corrected = commit(state, draft)
    expect(corrected.ok).toBe(true)
    expect(corrected.state.planner.events[0].description).toBe('Studentens rettede beskrivelse')
    expect(corrected.source.entries[0].sourceBase.description).toBe('Original description')
  })

  it('associates invalid later rows with correction fields and preserves all prior edits', () => {
    const parsed = { ...parseDocumentCsv('tittel;frist\nFørste;\nAndre;16.09'), contentHash: 'b'.repeat(64) }
    const state = empty(), draft = preview(state, parsed)
    draft.rows[0].title = 'Rettet navn'; draft.rows[0].remainingMinutes = 45
    expect(commit(state, draft)).toMatchObject({ ok: false, errors: [{ index: 1, field: 'deadlineMode' }] })
    draft.rows[1].deadlineMode = 'none'
    expect(commit(state, draft).state.tasks[0]).toMatchObject({ title: 'Rettet navn', remainingMinutes: 45 })
  })

  it('persists dated partial evidence through reload, revision, history undo and backup privacy scrubbing', () => {
    const parsed = { ...parsedCalendar('Description'), format: 'pdf', complete: false, warnings: ['1 sider mangler lesbar tekst.', 'Kunne ikke lese https://calendar.example.invalid/private?pwd=synthetic-secret'] }
    const first = commit(empty(), preview(empty(), parsed)), state = JSON.parse(JSON.stringify(first.state))
    expect(state.importSources[0]).toMatchObject({ complete: false, warnings: parsed.warnings, revision: 1, lastUpdated: now.toISOString() })
    const nextParsed = { ...parsed, complete: true, warnings: ['Alle sider ble lest.'], contentHash: 'c'.repeat(64) }
    const next = commit(state, preview(state, nextParsed, { sourceId: first.source.id }))
    expect(next.source).toMatchObject({ revision: 2, complete: true, warnings: ['Alle sider ble lest.'] })
    next.state.history = recordChange(state, next.state, undefined, 'Oppdater dokumentkilde', now)
    const backup = exportBackup(next.state, now)
    expect(JSON.stringify(backup)).not.toContain('synthetic-secret')
    expect(JSON.stringify(backup)).not.toContain('calendar.example.invalid')
    const restored = previewBackup(JSON.stringify(backup), empty())
    expect(restored.ok).toBe(true)
    const undone = undoLast(restored.data, restored.data.history)
    expect(undone.ok).toBe(true)
    expect(undone.state.importSources[0]).toMatchObject({ complete: false, revision: 1, lastUpdated: now.toISOString() })
    expect(undone.state.importSources[0].warnings[0]).toBe(parsed.warnings[0])
    expect(undone.state.importSources[0].warnings[1]).toContain('[tilkobling utelatt]')
    expect(validEnvelope({ ...undone.state, history: undone.history }, { relations: true })).toBe(true)
  })

  it('bounds optional evidence including expanded redactions and keeps old sources valid without writes', () => {
    const parsed = parsedCalendar('Description')
    parsed.warnings = Array.from({ length: 102 }, (_, index) => `${index}: pwd=abc ${' abc'.repeat(900)}`)
    const result = commit(empty(), preview(empty(), parsed))
    expect(result.ok).toBe(true)
    expect(result.source.warnings).toHaveLength(IMPORT_WARNING_LIMITS.count)
    expect(result.source.warnings.at(-1)).toContain('3 ytterligere')
    expect(result.source.warnings[0]).toContain('forkortet kildevarsel')
    const backup = exportBackup(result.state, now)
    expect(JSON.stringify(backup)).not.toContain('abc')
    expect(backup.data.importSources[0].warnings.every(warning => warning.length <= IMPORT_WARNING_LIMITS.characters)).toBe(true)
    expect(previewBackup(JSON.stringify(backup), empty()).ok).toBe(true)
    const legacy = structuredClone(result.state); delete legacy.importSources[0].complete; delete legacy.importSources[0].warnings
    let writes = 0
    const storage = createStorage(() => ({ getItem: () => JSON.stringify(legacy), setItem: () => { writes++ } }))
    expect(storage.read().ok).toBe(true); expect(writes).toBe(0)
    expect(storage.snapshot()).toEqual(legacy)
    expect(validImportSources([{ ...result.source, complete: 'false' }])).toBe(false)
    expect(validImportSources([{ ...result.source, warnings: ['x'.repeat(IMPORT_WARNING_LIMITS.characters + 1)] }])).toBe(false)
  })

  it('keeps calendar omissions visibly incomplete after commit', () => {
    const text = calendar('Valid').replace('END:VCALENDAR', 'BEGIN:VEVENT\r\nUID:bad\r\nSUMMARY:Missing end\r\nDTSTART:20260920T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR')
    const parsed = { ...parseDocumentIcs(text, { semester: 'autumn', year: 2026 }), contentHash: 'd'.repeat(64) }
    expect(parsed.complete).toBe(false)
    const result = commit(empty(), preview(empty(), parsed))
    expect(result.ok).toBe(true); expect(result.source.complete).toBe(false)
    expect(result.source.warnings.join(' ')).toContain('utelatt')
  })
})
