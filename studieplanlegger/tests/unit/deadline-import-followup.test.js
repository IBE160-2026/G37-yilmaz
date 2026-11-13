import { describe, expect, it } from 'vitest'
import { parseDocumentCsv } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit } from '../../src/import-preview.js'
import { editTask } from '../../src/tasks.js'
import { validEnvelope } from '../../src/storage.js'
import { recordChange, undoLast, validHistory } from '../../src/history.js'

const now = new Date('2026-11-12T18:00:00Z')
const originalText = 'id;tittel;frist;minutter\n1;Skriv rapport;2027-10-30T12:00;45'
const repeatedTime = '2027-10-31T02:30'
const empty = () => ({ schemaVersion: 1, tasks: [] })
const preview = (state, text = originalText, revised = false) => createDocumentImportPreview(state,
  { ...parseDocumentCsv(text), contentHash: (revised ? 'b' : 'a').repeat(64) },
  revised ? { sourceId: state.importSources[0].id } : {})
const commit = (state, draft) => buildDocumentImportCommit(state, draft, { now })
const success = result => {
  expect(result.ok, `${result.error || ''} ${JSON.stringify(result.errors || [])}`).toBe(true)
  expect(validEnvelope(result.state, { relations: true })).toBe(true)
  return result.state
}
function resolvedImportedTask(occurrence = 'later') {
  const state = success(commit(empty(), preview(empty())))
  const current = state.tasks[0]
  const edit = editTask(state.tasks, current.id, { ...current, deadlineLocal: repeatedTime, deadlineDisambiguation: occurrence })
  expect(edit.ok).toBe(true)
  state.tasks = edit.tasks
  return state
}

describe('document reimport after the user resolves a repeated deadline', () => {
  it.each(['earlier', 'later'])('preserves the %s occurrence on an identical source reimport', occurrence => {
    const state = resolvedImportedTask(occurrence), before = structuredClone(state)
    const result = commit(state, preview(state))
    const updated = success(result)
    expect(updated.tasks).toEqual(state.tasks)
    expect(updated.importSources[0].revision).toBe(1)
    expect(state).toEqual(before)
  })

  it('clears the old occurrence when an incoming source deadline replaces it, and undo restores the pair', () => {
    const state = resolvedImportedTask()
    const draft = preview(state, originalText.replace('2027-10-30T12:00', '2027-11-02T14:00'), true)
    draft.rows[0].conflictChoices.deadlineLocal = 'incoming'
    const updated = success(commit(state, draft))
    expect(updated.tasks[0].deadlineLocal).toBe('2027-11-02T14:00')
    expect(updated.tasks[0]).not.toHaveProperty('deadlineDisambiguation')
    const history = recordChange(state, updated, undefined, 'Oppdatert dokumentfrist', now)
    expect(validHistory(history, updated)).toBe(true)
    const undone = undoLast(updated, history)
    expect(undone.ok).toBe(true)
    expect(undone.state.tasks).toEqual(state.tasks)
  })

  it('keeps the occurrence when the user retains their local deadline in a source conflict', () => {
    const state = resolvedImportedTask()
    const draft = preview(state, originalText.replace('2027-10-30T12:00', '2027-11-02T14:00'), true)
    draft.rows[0].conflictChoices.deadlineLocal = 'local'
    const updated = success(commit(state, draft))
    expect(updated.tasks[0]).toMatchObject({ deadlineLocal: repeatedTime, deadlineDisambiguation: 'later' })
  })

  describe.each(['parsed', 'entered'])('%s ambiguous source conflict', path => {
    function changedPreview(state, sourceDeadline = '2027-10-31T02:45') {
      // The extra valid row proves that rejecting the selected source deadline
      // also rejects unrelated additions from this same import transaction.
      const draft = preview(state, originalText.replace('2027-10-30T12:00', sourceDeadline)
        + '\n2;Ny oppgave;2027-11-03T12:00;30', true)
      if (path === 'entered') {
        draft.rows[0].deadlineMode = 'value'
        draft.rows[0].deadlineLocal = sourceDeadline
      }
      return draft
    }

    it.each(['earlier', 'later'])('retains the local %s pair and the changed source baseline', occurrence => {
      const state = resolvedImportedTask(occurrence), before = structuredClone(state)
      const draft = changedPreview(state)
      expect(draft.rows[0].conflicts.some(conflict => conflict.field === 'deadlineLocal')).toBe(true)
      if (path === 'parsed') expect(draft.rows[0].deadlineMode).toBe('?')
      draft.rows[0].conflictChoices.deadlineLocal = 'local'
      const updated = success(commit(state, draft))
      expect(updated.tasks[0]).toEqual(state.tasks[0])
      expect(updated.tasks[0]).toMatchObject({ deadlineLocal: repeatedTime, deadlineDisambiguation: occurrence })
      expect(updated.tasks).toHaveLength(2)
      expect(updated.importSources[0].revision).toBe(2)
      expect(updated.importSources[0].entries[0].sourceBase.deadlineLocal).toBe(draft.rows[0].sourceRow.deadlineLocal || '')
      expect(updated.importSources[0].entries[0].sourceBase).not.toHaveProperty('deadlineDisambiguation')
      expect(state).toEqual(before)
    })

    it.each(['2027-10-31T02:45', '2027-03-28T02:30'])('rejects selected source %s atomically', sourceDeadline => {
      const state = resolvedImportedTask(), before = structuredClone(state)
      const draft = changedPreview(state, sourceDeadline)
      draft.rows[0].conflictChoices.deadlineLocal = 'incoming'
      const result = commit(state, draft)
      expect(result.ok).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({
        index: 0, field: path === 'parsed' ? 'deadlineMode' : 'deadlineLocal',
      }))
      expect(result).not.toHaveProperty('state')
      expect(state).toEqual(before)
    })

    it('requires a conflict choice without changing tasks or source history', () => {
      const state = resolvedImportedTask(), before = structuredClone(state)
      const result = commit(state, changedPreview(state))
      expect(result.ok).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({ index: 0, field: 'conflict:deadlineLocal' }))
      expect(state).toEqual(before)
    })
  })

  it('clears the occurrence when the preview explicitly removes the deadline', () => {
    const state = resolvedImportedTask(), draft = preview(state)
    draft.rows[0].deadlineMode = 'none'
    const updated = success(commit(state, draft))
    expect(updated.tasks[0].deadlineLocal).toBe('')
    expect(updated.tasks[0]).not.toHaveProperty('deadlineDisambiguation')
  })

  it('does not apply the old occurrence to a different ambiguous wall-clock deadline', () => {
    const state = resolvedImportedTask(), before = structuredClone(state), draft = preview(state)
    draft.rows[0].deadlineLocal = '2027-10-31T02:45'
    const result = commit(state, draft)
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'deadlineLocal' })]))
    expect(state).toEqual(before)
  })

  it('keeps a new ambiguous source deadline unresolved when no occurrence has been chosen', () => {
    const state = empty(), draft = preview(state)
    draft.rows[0].deadlineLocal = repeatedTime
    const result = commit(state, draft)
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'deadlineLocal' })]))
    expect(state).toEqual(empty())
  })
})
