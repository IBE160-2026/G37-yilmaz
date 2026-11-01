import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import { createStorage, RECOVERY_KEY, STORAGE_KEY, validEnvelope } from '../../src/storage.js'
import { storageFailure } from '../../src/storage-errors.js'
import { decodeRecoveryJournal, encodeRecoveryJournal } from '../../src/recovery-codec.js'
import * as recoveryCodec from '../../src/recovery-codec.js'
import { previewBackup } from '../../src/backup.js'
import { recordChange, undoLast } from '../../src/history.js'
import { closeWork, purgeWorkHistory } from '../../src/work-log.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { buildDocumentImportCommit, createDocumentImportPreview } from '../../src/import-preview.js'
import { stressCalendar } from '../fixtures/stress-calendar.js'
import { smallStorageFixture, storageStressFixture, syntheticLegacyRecovery, syntheticStorageBackup } from '../fixtures/storage-stress.js'

const now = new Date('2026-11-02T15:00:00Z')
const parsedCalendar = calendar => ({ ...parseDocumentIcs(calendar), contentHash: createHash('sha256').update(calendar).digest('hex'), fileName: 'synthetic-stress-500.ics' })
function backing(state, recovery = null) {
  const values = new Map([[STORAGE_KEY, JSON.stringify(state)]])
  if (recovery !== null) values.set(RECOVERY_KEY, recovery)
  const backend = {
    values, beforeSet: () => {}, getItem: key => values.get(key) ?? null,
    setItem: vi.fn((key, value) => { backend.beforeSet(key, value); values.set(key, value) }),
    removeItem: vi.fn(key => values.delete(key)),
  }
  const store = createStorage(() => backend)
  expect(store.read().ok).toBe(true)
  return { backend, store }
}
const namedError = name => Object.assign(new Error('Synthetic storage failure; text is not evidence of quota.'), { name })
const journal = data => ({ savedAt: now.toISOString(), data, raw: JSON.stringify(data) })
const reversedObjectKeys = value => Array.isArray(value) ? value.map(reversedObjectKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reversedObjectKeys(item)])) : value

describe('500-event reimports preserve useful history without metadata-only growth', () => {
  it('keeps 525 unchanged rows byte-identical through repeated confirmation with zero storage writes', () => {
    const { calendar, legacy } = storageStressFixture(), parsed = parsedCalendar(calendar)
    const original = JSON.stringify(legacy), { backend, store } = backing(legacy)
    expect(legacy.planner.courses).toHaveLength(25)
    expect(legacy.planner.events).toHaveLength(500)
    expect(legacy.history.undo).toHaveLength(3)
    let current = legacy
    for (let repeat = 0; repeat < 3; repeat++) {
      const result = buildDocumentImportCommit(current, createDocumentImportPreview(current, parsed), { now: new Date(+now + repeat * 60_000) })
      expect(result.ok).toBe(true)
      expect(result.counts).toEqual({ added: 0, updated: 0, unchanged: 525, omitted: 0 })
      expect(JSON.stringify(result.candidate)).toBe(original)
      current = { ...result.candidate, history: recordChange(current, result.candidate, current.history, 'Synthetic repeated import', now) }
      expect(JSON.stringify(current)).toBe(original)
      expect(store.writeEnvelope(current)).toEqual({ ok: true })
    }
    expect(backend.setItem).not.toHaveBeenCalled()
    expect(backend.getItem(STORAGE_KEY)).toBe(original)
    expect(JSON.stringify(legacy)).toBe(original)
  }, 20_000)

  it('updates one existing UID, retains every identity and permits one complete undo', () => {
    const { legacy } = storageStressFixture(), before = JSON.stringify(legacy)
    const parsed = parsedCalendar(stressCalendar({ revised: true }))
    const result = buildDocumentImportCommit(legacy, createDocumentImportPreview(legacy, parsed), { now })
    expect(result.ok).toBe(true)
    expect(result.counts).toEqual({ added: 0, updated: 1, unchanged: 524, omitted: 0 })
    expect(result.candidate.planner.events.map(event => event.id)).toEqual(legacy.planner.events.map(event => event.id))
    expect(result.candidate.planner.courses).toEqual(legacy.planner.courses)
    expect(result.candidate.importSources[0].id).toBe(legacy.importSources[0].id)
    expect(result.candidate.importSources[0].entries.map(({ key, targetId }) => ({ key, targetId }))).toEqual(legacy.importSources[0].entries.map(({ key, targetId }) => ({ key, targetId })))
    expect(result.candidate.planner.events.filter((event, index) => JSON.stringify(event) !== JSON.stringify(legacy.planner.events[index]))).toHaveLength(1)
    expect(result.candidate.planner.events.at(-1).title).toMatch(/revidert$/)
    const history = recordChange(legacy, result.candidate, legacy.history, 'Synthetic changed UID', now)
    expect(history.undo).toHaveLength(4)
    const restored = undoLast({ ...result.candidate, history }, history)
    expect(restored.ok).toBe(true)
    expect(restored.state.importSources[0]).toMatchObject({ contentHash: legacy.importSources[0].contentHash, revision: legacy.importSources[0].revision, lastUpdated: legacy.importSources[0].lastUpdated })
    expect({ ...restored.state, history: restored.history }).toEqual(legacy)
    expect(JSON.stringify(legacy)).toBe(before)
  }, 20_000)

  it('does not add history for lastUpdated alone and retains previously recorded legacy entries', () => {
    const { legacy } = storageStressFixture(), original = JSON.stringify(legacy.history)
    const after = structuredClone(legacy)
    after.importSources[0].lastUpdated = now.toISOString()
    const history = recordChange(legacy, after, legacy.history, 'Synthetic refresh metadata', now)
    expect(JSON.stringify(history)).toBe(original)
    expect(history.undo.map(entry => entry.id)).toEqual(['synthetic-storage-initial-import', 'synthetic-storage-old-timestamp-1', 'synthetic-storage-old-timestamp-2'])
    expect(JSON.stringify(legacy.history)).toBe(original)
  })

  it('keeps all 525 rows and source metadata unchanged after storage reconstructs object-key order', () => {
    const { calendar, legacy } = storageStressFixture()
    const reconstructed = { ...legacy, importSources: legacy.importSources.map(reversedObjectKeys) }
    expect(JSON.stringify(reconstructed.importSources)).not.toBe(JSON.stringify(legacy.importSources))
    const result = buildDocumentImportCommit(reconstructed, createDocumentImportPreview(reconstructed, parsedCalendar(calendar)), { now })
    expect(result.ok).toBe(true)
    expect(result.counts).toEqual({ added: 0, updated: 0, unchanged: 525, omitted: 0 })
    expect(result.source).toMatchObject({ revision: legacy.importSources[0].revision, lastUpdated: legacy.importSources[0].lastUpdated, contentHash: legacy.importSources[0].contentHash })
    expect(JSON.stringify(result.candidate)).toBe(JSON.stringify(reconstructed))
    const history = recordChange(reconstructed, result.candidate, legacy.history, 'Synthetic reconstructed import', now)
    expect(history).toEqual(legacy.history)
    const { backend, store } = backing(legacy), original = backend.getItem(STORAGE_KEY)
    expect(store.writeEnvelope({ ...result.candidate, history })).toEqual({ ok: true })
    expect(backend.setItem).not.toHaveBeenCalled()
    expect(backend.getItem(STORAGE_KEY)).toBe(original)
  }, 20_000)

  it('undoes a source-name-only edit while retaining newer source bookkeeping', () => {
    const { legacy } = storageStressFixture(), renamed = structuredClone(legacy)
    renamed.importSources[0].name = 'Syntetisk redigert kildenavn'
    const history = recordChange(legacy, renamed, legacy.history, 'Synthetic source name', now)
    expect(history.undo).toHaveLength(legacy.history.undo.length + 1)
    const metadata = { contentHash: 'a'.repeat(64), revision: legacy.importSources[0].revision + 1, lastUpdated: '2026-11-02T16:00:00.000Z' }
    const current = structuredClone(renamed)
    Object.assign(current.importSources[0], metadata)
    const restored = undoLast(current, history)
    expect(restored.ok).toBe(true)
    expect(restored.state.importSources[0]).toEqual({ ...legacy.importSources[0], ...metadata })
    expect(restored.state.planner).toEqual(legacy.planner)
    expect(restored.history).toEqual(legacy.history)
    expect(current.importSources[0].name).toBe('Syntetisk redigert kildenavn')
  })

  it('refreshes file fingerprint metadata without an undo copy when only ICS DTSTAMP changes', () => {
    const { calendar, legacy } = storageStressFixture()
    const stamped = calendar.replaceAll('BEGIN:VEVENT\r\n', 'BEGIN:VEVENT\r\nDTSTAMP:20261102T150000Z\r\n')
    const result = buildDocumentImportCommit(legacy, createDocumentImportPreview(legacy, parsedCalendar(stamped)), { now })
    expect(result.ok).toBe(true)
    expect(result.counts).toEqual({ added: 0, updated: 0, unchanged: 525, omitted: 0 })
    expect(result.candidate.planner).toEqual(legacy.planner)
    expect(result.source.entries).toEqual(legacy.importSources[0].entries)
    expect(result.source.contentHash).not.toBe(legacy.importSources[0].contentHash)
    expect(result.source.revision).toBe(legacy.importSources[0].revision + 1)
    expect(result.source.lastUpdated).toBe(now.toISOString())
    const history = recordChange(legacy, result.candidate, legacy.history, 'Synthetic file metadata refresh', now)
    expect(history).toEqual(legacy.history)
    const { backend, store } = backing(legacy)
    expect(store.writeEnvelope({ ...result.candidate, history })).toEqual({ ok: true })
    expect(backend.setItem).toHaveBeenCalledTimes(1)
    const repeat = buildDocumentImportCommit(store.snapshot(), createDocumentImportPreview(store.snapshot(), parsedCalendar(stamped)), { now })
    expect(store.writeEnvelope(repeat.candidate)).toEqual({ ok: true })
    expect(backend.setItem).toHaveBeenCalledTimes(1)
  }, 20_000)
})

describe('large lossless recovery and guarded restoration', () => {
  it('treats reordered object keys as a no-op without bypassing stale-tab guards or ignoring reordered arrays', () => {
    const first = smallStorageFixture()
    const state = { ...first, tasks: [...first.tasks, { ...first.tasks[0], id: 'synthetic-second-task', title: 'Syntetisk andre oppgave' }] }
    const recovery = syntheticLegacyRecovery(first), { backend, store } = backing(state, recovery)
    const before = backend.getItem(STORAGE_KEY)
    const reordered = {
      onboarding: Object.fromEntries(Object.entries(state.onboarding).reverse()),
      tasks: state.tasks.map(task => Object.fromEntries(Object.entries(task).reverse())),
      schemaVersion: state.schemaVersion,
    }
    expect(JSON.stringify(reordered)).not.toBe(before)
    expect(store.writeEnvelope(reordered)).toEqual({ ok: true })
    expect(store.replace(reordered)).toEqual({ ok: true, unchanged: true })
    expect(backend.setItem).not.toHaveBeenCalled()
    expect(backend.getItem(STORAGE_KEY)).toBe(before)
    expect(backend.getItem(RECOVERY_KEY)).toBe(recovery)

    // Even an equivalent external write invalidates the exact loaded revision.
    backend.values.set(STORAGE_KEY, JSON.stringify(reordered))
    expect(store.writeEnvelope(reordered)).toEqual({ ok: false, reason: 'conflict' })
    expect(store.replace(reordered)).toEqual({ ok: false, reason: 'conflict' })
    expect(backend.setItem).not.toHaveBeenCalled()
    const reloaded = createStorage(() => backend)
    expect(reloaded.read().ok).toBe(true)
    const changed = { ...reordered, tasks: [...reordered.tasks].reverse() }
    expect(reloaded.writeEnvelope(changed)).toEqual({ ok: true })
    expect(backend.setItem).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY, JSON.stringify(changed))
    expect(JSON.parse(backend.getItem(STORAGE_KEY)).tasks.map(task => task.id)).toEqual(['synthetic-second-task', first.tasks[0].id])
    expect(backend.getItem(RECOVERY_KEY)).toBe(recovery)
  })

  it('reads a large portable backup, restores it to an empty profile, and makes identical restore a zero-write operation', () => {
    const { legacy } = storageStressFixture(), backup = syntheticStorageBackup(legacy)
    expect(Buffer.byteLength(backup)).toBeGreaterThan(6_000_000)
    const empty = { schemaVersion: 1, tasks: [] }, preview = previewBackup(backup, empty)
    expect(preview.ok).toBe(true)
    expect(preview.data).toEqual(legacy)
    const { backend, store } = backing(empty)
    expect(store.replace(preview.data)).toEqual({ ok: true })
    const reloaded = createStorage(() => backend)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(legacy)
    const recovery = backend.getItem(RECOVERY_KEY), raw = backend.getItem(STORAGE_KEY)
    backend.setItem.mockClear()
    expect(reloaded.replace(previewBackup(backup, reloaded.snapshot()).data)).toEqual({ ok: true, unchanged: true })
    expect(backend.setItem).not.toHaveBeenCalled()
    expect(backend.getItem(STORAGE_KEY)).toBe(raw)
    expect(backend.getItem(RECOVERY_KEY)).toBe(recovery)
  }, 20_000)

  it('compresses the large recovery journal without losing raw bytes, old history or the previous recovery', () => {
    const { legacy } = storageStressFixture(), previous = smallStorageFixture('Syntetisk eldre gjenoppretting')
    const previousRaw = syntheticLegacyRecovery(previous), raw = JSON.stringify(legacy)
    const { backend, store } = backing(legacy, previousRaw)
    const replacement = smallStorageFixture('Syntetisk erstatning')
    expect(store.replace(replacement)).toEqual({ ok: true })
    const packed = backend.getItem(RECOVERY_KEY)
    expect(JSON.parse(packed)).toMatchObject({ version: 2, encoding: 'deflate-base64' })
    expect(packed.length).toBeLessThan(raw.length / 2)
    const decoded = decodeRecoveryJournal(packed)
    expect(decoded.raw).toBe(raw)
    expect(JSON.parse(decoded.raw)).toEqual(legacy)
    const reloaded = createStorage(() => backend)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(replacement)
    expect(reloaded.recovery().data).toEqual(legacy)
    expect(reloaded.recovery().raw).toBe(raw)
    expect(reloaded.recovery().previous).toMatchObject({ data: previous, raw: JSON.stringify(previous) })
  }, 20_000)

  it('still reads legacy uncompressed data/raw recovery without rewriting either key', () => {
    const previous = smallStorageFixture(), legacyRaw = syntheticLegacyRecovery(previous)
    const { backend, store } = backing(smallStorageFixture('Syntetisk nyere oppgave'), legacyRaw)
    expect(store.recovery()).toEqual(JSON.parse(legacyRaw))
    expect(backend.setItem).not.toHaveBeenCalled()
    expect(backend.getItem(RECOVERY_KEY)).toBe(legacyRaw)
  })

  it('preserves large unreadable raw bytes exactly in compressed recovery during an explicit repair', () => {
    const previous = smallStorageFixture('Syntetisk eldre gyldig kopi')
    const { backend } = backing(previous, syntheticLegacyRecovery(previous))
    const unreadable = '{\n' + 'syntetisk uleselig innhold æøå\n'.repeat(10_000)
    backend.values.set(STORAGE_KEY, unreadable)
    const store = createStorage(() => backend)
    expect(store.read()).toEqual({ ok: false, reason: 'invalid' })
    const replacement = smallStorageFixture('Syntetisk uttrykkelig reparasjon')
    expect(store.replace(replacement)).toEqual({ ok: true })
    const packed = backend.getItem(RECOVERY_KEY)
    expect(JSON.parse(packed).encoding).toBe('deflate-base64')
    const decoded = decodeRecoveryJournal(packed)
    expect(decoded.raw).toBe(unreadable)
    expect(decoded).not.toHaveProperty('data')
    const reloaded = createStorage(() => backend)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(replacement)
    expect(reloaded.recovery().data).toEqual(previous)
  })

  it.each([
    ['recovery', 'QuotaExceededError', 'quota'], ['main', 'QuotaExceededError', 'quota'],
    ['recovery', 'SecurityError', 'storage-denied'], ['main', 'SecurityError', 'storage-denied'],
    ['recovery', 'Error', 'recovery-failed'], ['main', 'Error', 'unwritable'],
  ])('preserves exact data and older recovery after %s write raises %s, including reload', (stage, name, reason) => {
    const { legacy } = storageStressFixture(), previous = smallStorageFixture('Syntetisk eldre kopi')
    const recovery = syntheticLegacyRecovery(previous), { backend, store } = backing(legacy, recovery)
    const before = backend.getItem(STORAGE_KEY)
    backend.beforeSet = key => { if (key === (stage === 'main' ? STORAGE_KEY : RECOVERY_KEY)) throw namedError(name) }
    expect(store.replace(smallStorageFixture('Syntetisk mislykket erstatning'))).toEqual({ ok: false, reason, ...(name !== 'Error' ? { stage } : {}) })
    expect(backend.getItem(STORAGE_KEY)).toBe(before)
    expect(backend.getItem(RECOVERY_KEY)).toBe(recovery)
    expect(store.snapshot()).toEqual(legacy)
    const reloaded = createStorage(() => backend)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(legacy)
    expect(reloaded.recovery().data).toEqual(previous)
  }, 20_000)

  it('keeps the older recovery accessible when both main write and journal rollback fail', () => {
    const { legacy } = storageStressFixture(), previous = smallStorageFixture('Syntetisk eldre kopi')
    const { backend, store } = backing(legacy, syntheticLegacyRecovery(previous))
    const before = backend.getItem(STORAGE_KEY)
    let recoveryWrites = 0
    backend.beforeSet = key => { if (key === STORAGE_KEY || key === RECOVERY_KEY && ++recoveryWrites > 1) throw namedError('QuotaExceededError') }
    expect(store.replace(smallStorageFixture('Syntetisk mislykket erstatning'))).toMatchObject({ ok: false, reason: 'quota', stage: 'main', recoveryJournalRetained: true })
    expect(backend.getItem(STORAGE_KEY)).toBe(before)
    expect(JSON.parse(backend.getItem(RECOVERY_KEY)).encoding).toBe('deflate-base64')
    const reloaded = createStorage(() => backend)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(legacy)
    expect(reloaded.recovery().data).toEqual(previous)
  }, 20_000)

  it('purges private work history from compressed recovery and its previous copy while preserving imported data and unrelated undo', () => {
    const { legacy } = storageStressFixture()
    const before = { ...legacy, tasks: smallStorageFixture().tasks }
    const closed = closeWork(before, { taskId: before.tasks[0].id, operationId: 'synthetic-private-work', outcome: 'more', actualMinutes: 17, remainingMinutes: 30 }, { now })
    expect(closed.ok).toBe(true)
    const state = { ...closed.state, history: recordChange(before, closed.state, before.history, 'Synthetic work outcome', now) }
    expect(validEnvelope(state, { relations: true })).toBe(true)
    const journal = { savedAt: now.toISOString(), raw: JSON.stringify(state), data: state }
    const packed = encodeRecoveryJournal({ ...journal, previous: journal })
    expect(JSON.parse(packed).encoding).toBe('deflate-base64')
    const { backend, store } = backing(state, packed)
    expect(store.purgeWorkHistory()).toEqual({ ok: true })
    const expected = purgeWorkHistory(state)
    expect(expected.history.undo).toEqual(legacy.history.undo)
    expect(store.snapshot()).toEqual(expected)
    const reloaded = createStorage(() => backend)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(expected)
    const recovery = reloaded.recovery()
    expect(recovery.data).toEqual(expected)
    expect(JSON.parse(recovery.raw)).toEqual(expected)
    const decoded = decodeRecoveryJournal(backend.getItem(RECOVERY_KEY))
    expect(JSON.parse(decoded.previous.raw)).toEqual(expected)
    expect(JSON.stringify(decoded)).not.toContain('synthetic-private-work')
    expect(expected.planner).toEqual(legacy.planner)
    expect(expected.importSources).toEqual(legacy.importSources)
  }, 20_000)
})

describe('storage failure classification uses exception type, not guessed message text', () => {
  it.each([
    ['QuotaExceededError', 'quota'], ['NS_ERROR_DOM_QUOTA_REACHED', 'quota'],
    ['SecurityError', 'storage-denied'], ['Error', 'unwritable'],
  ])('classifies %s', (name, reason) => {
    expect(storageFailure(namedError(name), 'unwritable', 'main')).toEqual({ ok: false, reason, ...(reason !== 'unwritable' ? { stage: 'main' } : {}) })
  })
})

describe('bounded deflate recovery, concurrent encoding and cached reads', () => {
  const unicodeState = () => ({ ...smallStorageFixture(), syntheticPadding: 'Syntetisk norsk æøå · 漢字 · 🙂𝄞\n'.repeat(8000) })

  it('roundtrips large Unicode raw exactly and declares the actual expanded UTF-8 byte count', () => {
    const data = unicodeState(), original = journal(data), packed = encodeRecoveryJournal(original)
    const envelope = JSON.parse(packed), decoded = decodeRecoveryJournal(packed)
    expect(envelope).toMatchObject({ version: 2, encoding: 'deflate-base64' })
    expect(envelope.payload).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    expect(decoded.raw).toBe(original.raw)
    expect(JSON.parse(decoded.raw)).toEqual(data)
    expect(envelope.length).toBe(Buffer.byteLength(JSON.stringify(decoded), 'utf8'))
    expect(envelope.length).toBeGreaterThan(JSON.stringify(decoded).length)
    expect(original.data).toEqual(data)
  })

  it.each([
    ['corrupt deflate data', value => ({ ...value, payload: Buffer.from('synthetic invalid compressed stream').toString('base64') })],
    ['checksum mismatch', value => { const bytes = Buffer.from(value.payload, 'base64'); bytes[bytes.length - 1] ^= 1; return { ...value, payload: bytes.toString('base64') } }],
    ['truncated payload', value => ({ ...value, payload: value.payload.slice(0, -4) })],
    ['trailing input bytes', value => ({ ...value, payload: Buffer.concat([Buffer.from(value.payload, 'base64'), Buffer.from([0, 0, 0, 0])]).toString('base64') })],
    ['longer declared length', value => ({ ...value, length: value.length + 1 })],
    ['shorter declared length', value => ({ ...value, length: value.length - 1 })],
    ['unknown version', value => ({ ...value, version: 99 })],
    ['unknown encoding', value => ({ ...value, encoding: 'synthetic-unknown-compression' })],
    ['oversized declared length', value => ({ ...value, length: 50_000_001 })],
    ['unexpected wrapper field', value => ({ ...value, syntheticExtra: true })],
  ])('rejects %s instead of presenting it as legacy recovery', (_label, change) => {
    const envelope = JSON.parse(encodeRecoveryJournal(journal(unicodeState())))
    expect(() => decodeRecoveryJournal(JSON.stringify(change(envelope)))).toThrow()
  })

  it('rejects a valid compressed stream whose actual expansion exceeds its declared bound', () => {
    // Independent zlib producer: the wrapper lies about a highly compressible
    // 2 MB expansion. It must not be accepted as a ten-byte recovery journal.
    const text = JSON.stringify({ raw: 'S'.repeat(2_000_000) })
    const payload = deflateSync(Buffer.from(text, 'utf8')).toString('base64')
    expect(() => decodeRecoveryJournal(JSON.stringify({ version: 2, encoding: 'deflate-base64', length: 10, payload }))).toThrow()
  })

  it('leaves both main data and a corrupt compressed journal untouched during recovery read and purge', () => {
    const before = smallStorageFixture(), closed = closeWork(before, { taskId: before.tasks[0].id, operationId: 'synthetic-corrupt-journal-work', outcome: 'more', actualMinutes: 17, remainingMinutes: 30 }, { now })
    expect(closed.ok).toBe(true)
    const envelope = JSON.parse(encodeRecoveryJournal(journal(unicodeState())))
    const corrupt = JSON.stringify({ ...envelope, length: envelope.length + 1 })
    const { backend, store } = backing(closed.state, corrupt), raw = backend.getItem(STORAGE_KEY)
    expect(store.recovery()).toBeNull()
    expect(store.purgeWorkHistory()).toMatchObject({ ok: false, reason: 'unreadable-recovery' })
    expect(backend.getItem(STORAGE_KEY)).toBe(raw)
    expect(backend.getItem(RECOVERY_KEY)).toBe(corrupt)
    expect(backend.setItem).not.toHaveBeenCalled()
    expect(backend.removeItem).not.toHaveBeenCalled()
    const reloaded = createStorage(() => backend)
    expect(reloaded.read().ok).toBe(true)
    expect(reloaded.snapshot()).toEqual(closed.state)
    expect(reloaded.recovery()).toBeNull()
  })

  it('rejects another tab changing main and recovery during encoding without overwriting either newer value', () => {
    const before = smallStorageFixture('Syntetisk opprinnelig hoveddata'), previous = smallStorageFixture('Syntetisk opprinnelig kopi')
    const { backend, store } = backing(before, syntheticLegacyRecovery(previous))
    const newer = smallStorageFixture('Syntetisk annen fanes hoveddata'), newerRaw = JSON.stringify(newer)
    const newerRecovery = syntheticLegacyRecovery(smallStorageFixture('Syntetisk annen fanes gjenoppretting'))
    const encode = recoveryCodec.encodeRecoveryJournal
    const encoding = vi.spyOn(recoveryCodec, 'encodeRecoveryJournal').mockImplementation(value => {
      const packed = encode(value)
      backend.values.set(STORAGE_KEY, newerRaw)
      backend.values.set(RECOVERY_KEY, newerRecovery)
      return packed
    })
    try {
      expect(store.replace(smallStorageFixture('Syntetisk foreldet erstatning'))).toEqual({ ok: false, reason: 'conflict' })
      expect(encoding).toHaveBeenCalledTimes(1)
      expect(backend.getItem(STORAGE_KEY)).toBe(newerRaw)
      expect(backend.getItem(RECOVERY_KEY)).toBe(newerRecovery)
      expect(backend.setItem).not.toHaveBeenCalled()
      expect(backend.removeItem).not.toHaveBeenCalled()
      expect(store.snapshot()).toEqual(before)
    } finally { encoding.mockRestore() }
  })

  it('returns independent recovery copies and invalidates the decoded cache whenever raw changes', () => {
    const data = unicodeState(), previous = smallStorageFixture('Syntetisk tidligere kopidata')
    const packed = encodeRecoveryJournal({ ...journal(data), previous: journal(previous) })
    const { backend, store } = backing(smallStorageFixture('Syntetisk nåværende hoveddata'), packed)
    const first = store.recovery()
    expect(first.data).toEqual(data)
    first.data.tasks[0].title = 'Syntetisk mutert returverdi'
    first.previous.data.tasks[0].title = 'Syntetisk mutert tidligere returverdi'
    first.raw = 'synthetic tampered raw'
    const second = store.recovery()
    expect(second).toMatchObject({ data, raw: JSON.stringify(data), previous: { data: previous } })
    expect(second).not.toBe(first)
    // Selection of the older fallback still depends on today's main value,
    // even when the encoded journal itself remains cached and unchanged.
    const mainRaw = backend.getItem(STORAGE_KEY)
    backend.values.set(STORAGE_KEY, JSON.stringify(data))
    expect(store.recovery().data).toEqual(previous)
    backend.values.set(STORAGE_KEY, mainRaw)
    expect(store.recovery().data).toEqual(data)
    const replacement = { ...data, tasks: [{ ...data.tasks[0], title: 'Syntetisk nyere gjenopprettingsdata' }] }
    backend.values.set(RECOVERY_KEY, encodeRecoveryJournal(journal(replacement)))
    expect(store.recovery().data).toEqual(replacement)
    backend.values.set(RECOVERY_KEY, 'synthetic corrupt recovery')
    expect(store.recovery()).toBeNull()
    backend.values.set(RECOVERY_KEY, packed)
    expect(store.recovery().data).toEqual(data)
    expect(backend.setItem).not.toHaveBeenCalled()
    expect(backend.getItem(RECOVERY_KEY)).toBe(packed)
  })
})
