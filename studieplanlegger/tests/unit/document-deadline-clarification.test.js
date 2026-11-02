import { describe, expect, it } from 'vitest'
import { parseDocumentDate, parseDocumentText } from '../../src/document-parsers.js'
import { buildDocumentImportCommit, createDocumentImportPreview } from '../../src/import-preview.js'
import { createStorage, STORAGE_KEY, validEnvelope } from '../../src/storage.js'
import { exportBackup, previewBackup } from '../../src/backup.js'

// Synthetic reproductions of the Friday deadline report; no private documents.
const unresolvedText = 'Les kapittel 4 innen fredag kl. 14'
const explicitText = 'Innlevering syntetisk test, frist 2026-11-06 kl. 14:00'
const now = new Date('2026-11-02T09:00:00Z')
const empty = () => ({ schemaVersion: 1, tasks: [] })
const preview = (state, text, hash = 'b') => createDocumentImportPreview(state, {
  ...parseDocumentText(text), contentHash: hash.repeat(64), fileName: 'syntetisk-frist.txt',
})
const commit = (state, draft) => buildDocumentImportCommit(state, draft, { now })
function existingState() {
  const state = empty()
  const saved = commit(state, preview(state, 'Les syntetisk tidligere oppgave', 'a')).state
  saved.tasks.push({ id: 'synthetic-manual-task', title: 'Syntetisk tidligere manuell oppgave', course: '', deadlineLocal: '2026-12-01', estimatedMinutes: 30, completed: false })
  return saved
}
function memoryStorage(state) {
  const values = new Map([[STORAGE_KEY, JSON.stringify(state)]])
  const backing = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const storage = createStorage(() => backing)
  expect(storage.read().ok).toBe(true)
  return { storage, backing, reload: () => { const next = createStorage(() => backing); expect(next.read().ok).toBe(true); return next.snapshot() } }
}
function oldParserState(deadlineLocal = '') {
  const state = existingState(), parsed = parseDocumentText(unresolvedText)
  // Reproduce the old parser's omission, retaining the actual text identity.
  Object.assign(parsed.rows[0], { deadlineLocal, deadlineRaw: '', deadlineIssues: [] })
  const draft = createDocumentImportPreview(state, { ...parsed, contentHash: 'b'.repeat(64), fileName: 'syntetisk-frist.txt' })
  const saved = commit(state, draft).state
  expect(saved.importSources.at(-1).entries[0].deadlineDecision).toBeUndefined()
  return saved
}

describe('unparsed document deadlines require an explicit decision', () => {
  it.each([unresolvedText, `${unresolvedText}\n${explicitText}`, `${explicitText}\n${unresolvedText}`])('blocks the entire stored envelope for %s', text => {
    const state = existingState(), before = structuredClone(state), { backing, storage } = memoryStorage(state)
    const raw = backing.getItem(STORAGE_KEY), draft = preview(state, text)
    const row = draft.rows.find(item => item.title === unresolvedText)
    expect(row).toMatchObject({ selected: true, kind: 'task', deadlineLocal: '', deadlineRaw: 'innen fredag kl. 14', deadlineMode: '?' })
    expect(row.deadlineIssues.length).toBeGreaterThan(0)
    const result = commit(state, draft)
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(expect.objectContaining({ index: row.index, field: 'deadlineMode' }))
    expect(result.candidate).toBeUndefined()
    expect(result.state).toBeUndefined()
    expect(state).toEqual(before)
    expect(storage.snapshot()).toEqual(before)
    expect(backing.getItem(STORAGE_KEY)).toBe(raw)
  })

  it.each(['Les kapittel 4 senest fredag kl. 14', 'Oppgave innen neste uke', 'Les pensum, frist før neste seminar', 'Les notater innen i morgen', 'Les notater senest kl. 14', 'Les notater innen slutten av semesteret', 'Les kapittel 4 innen en uke', 'Les kapittel 4 senest om 2 dager', 'Les kapittel 4 innen ett døgn'])('keeps deadline cue unresolved: %s', text => {
    const row = preview(empty(), text).rows[0]
    expect(row).toMatchObject({ kind: 'task', selected: true, deadlineMode: '?', deadlineLocal: '' })
    expect(row.deadlineRaw).not.toBe('')
  })

  it.each([
    'Les notater fra 2026-11-01 kl. 12:00 innen fredag kl. 14',
    'Les notater innen fredag kl. 14 fra forelesningen 2026-11-01 kl. 12:00',
    'Les notater fra 2026-11-01T12:00 innen en uke',
    'Les notater senest om 2 dager fra møtet 2026-11-01T12:00',
  ])('does not borrow an unrelated explicit date to resolve %s', text => {
    const state = existingState(), before = structuredClone(state), draft = preview(state, text)
    expect(draft.rows[0]).toMatchObject({ selected: true, deadlineLocal: '', deadlineMode: '?' })
    expect(commit(state, draft).ok).toBe(false)
    expect(state).toEqual(before)
  })

  it.each(['innen', 'senest', 'frist'])('preserves a directly stated explicit deadline after %s', cue => {
    const state = empty(), draft = preview(state, `Les syntetiske notater ${cue} 2026-11-06 kl. 14:00`)
    expect(draft.rows[0]).toMatchObject({ deadlineMode: 'value', deadlineLocal: '2026-11-06T14:00' })
    expect(commit(state, draft).state.tasks[0].deadlineLocal).toBe('2026-11-06T14:00')
  })

  it.each(['innen 06.11.2026 kl. 14:00', 'senest 06.11.2026 kl. 14:00', 'innen 6. november 2026 kl. 14:00', 'senest 2026-11-06T14:00'])('preserves direct explicit-date parsing for %s', expression => {
    const state = empty(), draft = preview(state, `Les syntetiske notater ${expression}`)
    expect(draft.rows[0]).toMatchObject({ deadlineMode: 'value', deadlineLocal: '2026-11-06T14:00' })
    expect(commit(state, draft).state.tasks[0].deadlineLocal).toBe('2026-11-06T14:00')
  })

  it.each(['Les kapittel 4', 'Les kapittel 4 om fredag', 'Les notater fra mandag', 'Les om fredagens seminar', 'Les om innenfor og senestilling', 'Les om forskning innen informatikk', 'Les de senest publiserte notatene'])('allows ordinary task without a deadline: %s', text => {
    const state = empty(), draft = preview(state, text)
    expect(draft.rows[0]).toMatchObject({ kind: 'task', selected: true, deadlineRaw: '', deadlineLocal: '', deadlineMode: 'none' })
    expect(commit(state, draft).state.tasks[0].deadlineLocal).toBe('')
  })

  it('leaves unknown prose unselected and permits explicitly selecting and editing it', () => {
    const state = empty(), draft = preview(state, `Bakgrunnstekst om fredag\n${explicitText}`)
    expect(draft.rows[0]).toMatchObject({ selected: false, unsupported: true, deadlineMode: 'none' })
    expect(commit(state, draft).state.tasks).toHaveLength(1)
    Object.assign(draft.rows[0], { selected: true, title: 'Syntetisk manuelt valgt arbeid' })
    expect(commit(state, draft).state.tasks.map(task => task.title)).toEqual(['Syntetisk manuelt valgt arbeid', explicitText])
  })

  it('retains a clear deadline cue on unknown prose if the user selects the row', () => {
    const state = empty(), draft = preview(state, `Syntetisk materiale innen fredag\n${explicitText}`)
    expect(draft.rows[0]).toMatchObject({ selected: false, unsupported: true, deadlineMode: '?', deadlineRaw: 'innen fredag' })
    expect(commit(state, draft).ok).toBe(true)
    draft.rows[0].selected = true
    expect(commit(state, draft).ok).toBe(false)
    draft.rows[0].deadlineMode = 'none'
    expect(commit(state, draft).state.tasks).toHaveLength(2)
  })

  it.each([
    ['2026-11-06T14:00', '2026-11-06T14:00'],
    ['2026-11-06T13:00:00Z', '2026-11-06T14:00'],
    ['06.11.2026 kl. 14:00', '2026-11-06T14:00'],
    ['6. november 2026 kl. 14:00', '2026-11-06T14:00'],
  ])('preserves supported explicit deadline %s', (raw, expected) => {
    const state = empty(), draft = preview(state, `Les syntetisk oppgave, frist ${raw}`)
    expect(draft.rows[0]).toMatchObject({ deadlineMode: 'value', deadlineLocal: expected })
    expect(commit(state, draft).state.tasks[0].deadlineLocal).toBe(expected)
  })

  it.each(['06/11/2026 14:00', '2026-11-06', '6. november 2026'])('still requires a deliberate correction for automatic date input %s', raw => {
    expect(parseDocumentDate(raw).value).toBe('')
    const state = empty(), draft = preview(state, `Les syntetisk oppgave, frist ${raw}`)
    expect(draft.rows[0].deadlineMode).toBe('?')
    expect(commit(state, draft).ok).toBe(false)
    Object.assign(draft.rows[0], { deadlineMode: 'value', deadlineLocal: '2026-11-06' })
    expect(commit(state, draft).state.tasks[0].deadlineLocal).toBe('2026-11-06')
  })
})

describe('explicit document deadline corrections retain storage precision and previous data', () => {
  it.each([
    ['dated time', { deadlineMode: 'value', deadlineLocal: '2026-11-06T14:00' }, '2026-11-06T14:00'],
    ['date only', { deadlineMode: 'value', deadlineLocal: '2026-11-06' }, '2026-11-06'],
    ['without deadline', { deadlineMode: 'none' }, ''],
    ['omitted row', { selected: false }, undefined],
  ])('commits %s and preserves old tasks and sources through storage reload', (_name, correction, expected) => {
    const state = existingState(), before = structuredClone(state), { storage, reload } = memoryStorage(state)
    const text = `${unresolvedText}\n${explicitText}`, draft = preview(state, text)
    Object.assign(draft.rows[0], correction)
    const result = commit(state, draft)
    expect(result.ok).toBe(true)
    expect(state).toEqual(before)
    expect(validEnvelope(result.state, { relations: true })).toBe(true)
    expect(storage.writeEnvelope(result.state).ok).toBe(true)
    const loaded = reload()
    expect(loaded.tasks.filter(task => before.tasks.some(old => old.id === task.id))).toEqual(before.tasks)
    expect(loaded.importSources.find(source => source.id === before.importSources[0].id)).toEqual(before.importSources[0])
    expect(loaded.tasks.find(task => task.title === unresolvedText)?.deadlineLocal).toBe(expected)
    expect(loaded.tasks.find(task => task.title === explicitText)?.deadlineLocal).toBe('2026-11-06T14:00')
    expect(loaded.tasks).toHaveLength(before.tasks.length + (expected === undefined ? 1 : 2))
    if (expected !== undefined) {
      const repeated = preview(loaded, text)
      expect(repeated.rows[0].deadlineMode).toBe(expected ? 'value' : 'none')
      const repeatedResult = commit(loaded, repeated)
      expect(repeatedResult.ok).toBe(true)
      expect(repeatedResult.state.tasks).toEqual(loaded.tasks)
      expect(repeatedResult.state.importSources).toEqual(loaded.importSources)
    }
  })

  it.each(['', '2026-02-30', '2026-13-01', '2026-11-06T25:00', '2026-11-06T14:', 'T14:00', '2026-03-29T02:30', '2026-10-25T02:30'])('rejects invalid or ambiguous manual value %s without partial writes', deadlineLocal => {
    const state = existingState(), before = structuredClone(state), draft = preview(state, `${explicitText}\n${unresolvedText}`)
    Object.assign(draft.rows[1], { deadlineMode: 'value', deadlineLocal })
    const result = commit(state, draft)
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(expect.objectContaining({ index: 1, field: 'deadlineLocal' }))
    expect(result.state).toBeUndefined()
    expect(result.candidate).toBeUndefined()
    expect(state).toEqual(before)
    draft.rows[1].selected = false
    expect(commit(state, draft).state.tasks).toHaveLength(before.tasks.length + 1)
  })
})

describe('historical silent omissions versus proven no-deadline choices', () => {
  it('asks once for an old empty import and preserves the confirmed decision in storage and backup', () => {
    const state = oldParserState(), before = structuredClone(state), { storage, backing, reload } = memoryStorage(state)
    const originalRaw = backing.getItem(STORAGE_KEY), draft = preview(state, unresolvedText)
    expect(draft.rows[0]).toMatchObject({ deadlineMode: '?', deadlineRaw: 'innen fredag kl. 14', retainedCorrection: false })
    expect(commit(state, draft).ok).toBe(false)
    expect(state).toEqual(before)
    expect(backing.getItem(STORAGE_KEY)).toBe(originalRaw)
    draft.rows[0].deadlineMode = 'none'
    const confirmed = commit(state, draft)
    expect(confirmed.ok).toBe(true)
    expect(confirmed.state.tasks).toEqual(before.tasks)
    expect(confirmed.source.entries[0].deadlineDecision).toBe('none')
    expect(state).toEqual(before)
    expect(storage.writeEnvelope(confirmed.state).ok).toBe(true)
    const loaded = reload()
    expect(loaded.importSources.at(-1).entries[0].deadlineDecision).toBe('none')
    const restored = previewBackup(JSON.stringify(exportBackup(loaded, now)), empty())
    expect(restored.ok).toBe(true)
    expect(restored.data.importSources).toEqual(loaded.importSources)
    const repeated = preview(restored.data, unresolvedText)
    expect(repeated.rows[0]).toMatchObject({ deadlineMode: 'none', retainedCorrection: true })
    const result = commit(restored.data, repeated)
    expect(result.ok).toBe(true)
    expect(result.state).toEqual(loaded)
  })

  it('preserves a newly confirmed Uten frist decision on identical reimport', () => {
    const state = existingState(), first = preview(state, unresolvedText)
    first.rows[0].deadlineMode = 'none'
    const saved = commit(state, first).state
    expect(saved.importSources.at(-1).entries[0].deadlineDecision).toBe('none')
    const repeated = preview(saved, unresolvedText)
    expect(repeated.rows[0].deadlineMode).toBe('none')
    expect(commit(saved, repeated).state).toEqual(saved)
  })

  it.each(['2026-11-08', '2026-11-08T16:30'])('preserves a valid historical local deadline %s without changing input', deadlineLocal => {
    const state = oldParserState()
    state.tasks.find(task => task.title === unresolvedText).deadlineLocal = deadlineLocal
    const before = structuredClone(state), draft = preview(state, unresolvedText)
    expect(draft.rows[0]).toMatchObject({ deadlineMode: 'value', deadlineLocal })
    expect(state).toEqual(before)
    const result = commit(state, draft)
    expect(result.ok).toBe(true)
    expect(result.state.tasks).toEqual(before.tasks)
    expect(state).toEqual(before)
  })

  it('keeps a proven historical local deadline removal', () => {
    const state = oldParserState('2026-11-06T14:00')
    state.tasks.find(task => task.title === unresolvedText).deadlineLocal = ''
    const before = structuredClone(state), draft = preview(state, unresolvedText)
    expect(draft.rows[0].deadlineMode).toBe('none')
    expect(commit(state, draft).state.tasks).toEqual(before.tasks)
    expect(state).toEqual(before)
  })

  it.each(['automatic', 'value', true, { mode: 'none' }])('rejects malformed decision metadata %j while accepting old envelopes', deadlineDecision => {
    const state = oldParserState()
    expect(validEnvelope(state, { relations: true })).toBe(true)
    state.importSources.at(-1).entries[0].deadlineDecision = deadlineDecision
    expect(validEnvelope(state, { relations: true })).toBe(false)
    expect(() => exportBackup(state, now)).toThrow()
  })
})
