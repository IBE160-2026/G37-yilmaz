import { describe, expect, it } from 'vitest'
import { documentDeadlineNeedsChoice } from '../../src/document-import.js'
import { parseDocumentCsv } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit } from '../../src/import-preview.js'
import { editTask } from '../../src/tasks.js'

const repeated = '2027-10-31T02:30'
const row = { kind: 'task', targetId: 'imported-task', deadlineMode: 'value', deadlineLocal: repeated }
const current = { id: 'imported-task', deadlineLocal: repeated, deadlineDisambiguation: 'later' }

describe('deadline clarification in document import preview', () => {
  it.each(['earlier', 'later'])('recognizes the saved %s occurrence when review retains the same imported task and wall clock', occurrence => {
    const empty = { schemaVersion: 1, tasks: [] }
    const parsed = { ...parseDocumentCsv('id;tittel;frist;minutter\n1;Syntetisk rapport;2027-10-30T12:00;45'), contentHash: 'a'.repeat(64) }
    const initial = buildDocumentImportCommit(empty, createDocumentImportPreview(empty, parsed))
    expect(initial.ok).toBe(true)
    const state = initial.state, task = state.tasks[0]
    const edited = editTask(state.tasks, task.id, { ...task, deadlineLocal: repeated, deadlineDisambiguation: occurrence })
    expect(edited.ok).toBe(true)
    state.tasks = edited.tasks
    const next = { ...parseDocumentCsv(`id;tittel;frist;minutter\n1;Syntetisk rapport;${repeated};45`), contentHash: 'b'.repeat(64) }
    const preview = createDocumentImportPreview(state, next, { sourceId: state.importSources[0].id })
    const incoming = preview.rows.find(item => item.kind === 'task')
    // Parsing leaves a repeated source clock unresolved. The reviewer enters
    // the same clock already chosen in the task; this must honor that choice.
    incoming.deadlineLocal = repeated
    incoming.deadlineMode = 'value'
    incoming.conflictChoices.deadlineLocal = 'local'
    expect(documentDeadlineNeedsChoice(incoming, state.tasks[0])).toBe(false)
    const result = buildDocumentImportCommit(state, preview)
    expect(result.ok, JSON.stringify(result.errors || result.error)).toBe(true)
  })

  it('keeps a changed minute, changed target or unresolved legacy occurrence visibly unresolved', () => {
    expect(documentDeadlineNeedsChoice({ ...row, deadlineLocal: '2027-10-31T02:45' }, current)).toBe(true)
    expect(documentDeadlineNeedsChoice({ ...row, targetId: 'another-task' }, current)).toBe(true)
    expect(documentDeadlineNeedsChoice(row, { ...current, deadlineDisambiguation: undefined })).toBe(true)
    expect(documentDeadlineNeedsChoice(row)).toBe(true)
  })

  it('preserves date-only and no-deadline choices while still flagging spring gaps', () => {
    expect(documentDeadlineNeedsChoice({ ...row, deadlineLocal: '2027-10-31' }, current)).toBe(false)
    expect(documentDeadlineNeedsChoice({ ...row, deadlineMode: 'none', deadlineLocal: '' }, current)).toBe(false)
    expect(documentDeadlineNeedsChoice({ ...row, deadlineMode: '?' }, current)).toBe(true)
    expect(documentDeadlineNeedsChoice({ ...row, deadlineLocal: '2027-03-28T02:30' }, current)).toBe(true)
  })
})
