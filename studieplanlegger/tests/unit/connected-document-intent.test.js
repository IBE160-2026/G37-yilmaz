import { describe, expect, it } from 'vitest'
import { parseDocumentIcs, parseDocumentText } from '../../src/document-parsers.js'
import { buildDocumentImportCommit, createDocumentImportPreview } from '../../src/import-preview.js'
import { exportBackup, previewBackup } from '../../src/backup.js'

const now = new Date('2026-09-19T10:00:00Z')
const empty = () => ({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } })
const calendar = (body, method = '') => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...(method ? [`METHOD:${method}`] : []), 'BEGIN:VTODO', 'UID:intent-task', 'SUMMARY:Skriv rapport', 'DUE:20260921T120000Z', ...body, 'END:VTODO', 'END:VCALENDAR'].join('\r\n')
const preview = parsed => createDocumentImportPreview(empty(), { ...parsed, contentHash: 'a'.repeat(64) })

describe('Norwegian activity and action word boundaries', () => {
  it.each(['Øving', 'øving', '(ØVING)', 'Felles: Øving'])('recognizes %s as an activity with its complete time range', word => {
    const { rows: [row] } = parseDocumentText(`${word} 2026-09-21 kl. 12:00–14:00`)
    expect(row).toMatchObject({ kind: 'event', selected: true, unsupported: false, startLocal: '2026-09-21T12:00', endLocal: '2026-09-21T14:00' })
  })

  it.each(['Øv programmering', 'øv programmering', '(ØV) programmering'])('recognizes %s as an undated task', text => {
    expect(parseDocumentText(text).rows[0]).toMatchObject({ kind: 'task', selected: true, unsupported: false, deadlineRaw: '', deadlineLocal: '' })
  })

  it.each(['Øving før oppgave', 'Øving og øv programmering', 'Seminar før øv'])('retains the earlier activity marker in %s', text => {
    expect(parseDocumentText(text).rows[0]).toMatchObject({ kind: 'event', selected: true })
  })

  it.each(['Øv til forelesning', 'Oppgave til øving', 'Les før seminar'])('retains the earlier task marker in %s', text => {
    expect(parseDocumentText(text).rows[0]).toMatchObject({ kind: 'task', selected: true })
  })

  it.each(['prøving', 'øvingstime', 'øvelse', 'αseminar', 'seminarø', '9øving', 'øving2', 'αread', 'readø', '9øv', 'øv2', 'øving\u0301', 'øv\u0301'])('does not interpret part of the longer word %s', text => {
    expect(parseDocumentText(text).rows[0]).toMatchObject({ kind: 'task', selected: false, unsupported: true, requiresSubmission: false })
  })

  it('does not infer submission or a deadline from a word with Unicode neighbours', () => {
    expect(parseDocumentText('Øv med ølever og øfrist senere').rows[0]).toMatchObject({ selected: true, requiresSubmission: false, deadlineRaw: '' })
    expect(parseDocumentText('Lever rapport').rows[0]).toMatchObject({ selected: true, requiresSubmission: true })
  })
})

describe('unsupported VTODO recurrence and calendar cancellation', () => {
  it.each([
    'RDATE:20260928T120000Z',
    'RDATE:20260928T120000Z,20261005T120000Z',
    'RDATE;TZID=Europe/Oslo:20260928T140000',
    'RRULE:FREQ=WEEKLY;COUNT=3',
    'RECURRENCE-ID:20260928T120000Z',
  ])('preserves incomplete recurrence evidence for %s until explicitly selecting one task', recurrence => {
    const parsed = parseDocumentIcs(calendar([recurrence]))
    expect(parsed.complete).toBe(false)
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]).toMatchObject({ selected: false, unsupported: true, deadlineLocal: '2026-09-21T14:00' })
    expect(parsed.rows[0].snippet).toContain(recurrence.split(/[:;]/)[0])
    expect(parsed.warnings.join(' ')).toContain('Avklar én konkret oppgave')
    const draft = preview(parsed), initial = buildDocumentImportCommit(empty(), draft, { now })
    expect(initial.ok).toBe(false)
    draft.rows[0].selected = true
    draft.rows[0].title = 'Skriv rapport – bare denne forekomsten'
    const selected = buildDocumentImportCommit(empty(), draft, { now })
    expect(selected.ok, selected.error).toBe(true)
    expect(selected.state.tasks).toHaveLength(1)
    expect(selected.state.tasks[0]).toMatchObject({ title: draft.rows[0].title, deadlineLocal: '2026-09-21T14:00' })
    expect(selected.state.importSources[0]).toMatchObject({ complete: false, warnings: parsed.warnings })
    const restored = previewBackup(JSON.stringify(exportBackup(selected.state, now)), empty())
    expect(restored.ok).toBe(true)
    expect(restored.data.importSources[0]).toMatchObject({ complete: false, warnings: parsed.warnings })
  })

  it.each(['', 'NEEDS-ACTION', 'IN-PROCESS', 'COMPLETED'])('calendar CANCEL requires clarification even with component status %s', status => {
    const parsed = parseDocumentIcs(calendar(status ? [`STATUS:${status}`] : [], 'CANCEL'))
    expect(parsed.complete).toBe(false)
    expect(parsed.rows[0]).toMatchObject({ selected: false, statusNeedsChoice: true, statusChoice: '?' })
    expect(parsed.rows[0].sourceStatus).toContain('METHOD:CANCEL (avlyst)')
    expect(parsed.rows[0].snippet).toContain('METHOD:CANCEL')
    if (status) expect(parsed.rows[0].snippet).toContain(`Status: ${status}`)
    const draft = preview(parsed)
    draft.rows[0].selected = true
    const unresolved = buildDocumentImportCommit(empty(), draft, { now })
    expect(unresolved.ok).toBe(false)
    expect(unresolved.errors[0].message).toContain('Velg uttrykkelig')
    draft.rows[0].statusChoice = 'open'
    const selected = buildDocumentImportCommit(empty(), draft, { now })
    expect(selected.ok, selected.error).toBe(true)
    expect(selected.state.tasks[0]).toMatchObject({ completed: false, submitted: false })
    expect(selected.state.importSources[0]).toMatchObject({ complete: false, warnings: parsed.warnings })
    expect(selected.state.importSources[0].entries[0].snippet).toContain('METHOD:CANCEL')
  })

  it('keeps cancellation and recurrence evidence in the bounded excerpt despite a long description', () => {
    const parsed = parseDocumentIcs(calendar(['STATUS:NEEDS-ACTION', 'RDATE:20260928T120000Z', `DESCRIPTION:${'Lang beskrivelse '.repeat(100)}`], 'CANCEL'))
    expect(parsed.rows[0].snippet.length).toBeLessThanOrEqual(600)
    expect(parsed.rows[0].snippet).toContain('METHOD:CANCEL')
    expect(parsed.rows[0].snippet).toContain('Status: NEEDS-ACTION')
    expect(parsed.rows[0].snippet).toContain('Gjentakelse: RDATE')
  })

  it.each(['', 'PUBLISH', 'REQUEST'])('keeps ordinary nonrecurring active tasks usable for method %s', method => {
    const parsed = parseDocumentIcs(calendar(['STATUS:NEEDS-ACTION'], method))
    expect(parsed.complete).toBe(true)
    expect(parsed.rows[0]).toMatchObject({ selected: true, unsupported: false, statusNeedsChoice: false, statusChoice: 'open' })
  })
})
