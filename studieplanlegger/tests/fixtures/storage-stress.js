import { createHash } from 'node:crypto'
import { stressCalendar } from './stress-calendar.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit } from '../../src/import-preview.js'
import { emptyHistory, recordChange } from '../../src/history.js'
import { exportBackup } from '../../src/backup.js'

// Entirely invented data, derived from stress-calendar.js, never a user backup.
// Retain the pre-fix journal shape explicitly: two timestamp-only imports copied
// all 525 source entries into before/after history. New code must read and preserve
// this old history even though it must no longer generate these redundant entries.
let cached
export function storageStressFixture() {
  if (cached) return structuredClone(cached)
  const calendar = stressCalendar()
  const parsed = { ...parseDocumentIcs(calendar), contentHash: createHash('sha256').update(calendar).digest('hex'), fileName: 'synthetic-stress-500.ics' }
  const empty = { schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] }, onboarding: { dismissed: true, completed: true } }
  const preview = createDocumentImportPreview(empty, parsed)
  for (const course of preview.rows.filter(row => row.kind === 'course')) course.title = `Syntetisk emne ${course.code}`
  const firstCommit = buildDocumentImportCommit(empty, preview, { now: new Date('2026-11-01T15:00:00Z') })
  if (!firstCommit.ok) throw new Error('The synthetic 500-event fixture must remain valid.')
  const first = { ...firstCommit.candidate, history: recordChange(empty, firstCommit.candidate, emptyHistory(), 'Syntetisk kalenderimport', new Date('2026-11-01T15:00:00Z')) }
  first.history.undo[0].id = 'synthetic-storage-initial-import'
  let legacy = structuredClone(first)
  for (const minute of [1, 2]) {
    const at = `2026-11-01T15:0${minute}:00.000Z`
    const before = structuredClone(legacy.importSources[0]), after = { ...structuredClone(before), lastUpdated: at }
    legacy.importSources[0] = after
    legacy.history.undo.push({
      id: `synthetic-storage-old-timestamp-${minute}`, label: 'Syntetisk kalenderimport', at,
      plannerExisted: true,
      changes: [{ path: 'importSources', id: after.id, index: 0, before, after: structuredClone(after), existed: true }],
    })
  }
  cached = { calendar, first, legacy }
  return structuredClone(cached)
}

export const syntheticStorageBackup = state => JSON.stringify(exportBackup(state, new Date('2026-11-01T15:02:00Z')), null, 2)

export function smallStorageFixture(title = 'Syntetisk tidligere oppgave') {
  return {
    schemaVersion: 1,
    tasks: [{ id: 'synthetic-storage-prior-task', title, course: '', deadlineLocal: '', estimatedMinutes: null, completed: false }],
    onboarding: { dismissed: true, completed: true },
  }
}

export const syntheticLegacyRecovery = data => JSON.stringify({ savedAt: '2026-10-31T15:00:00Z', data, raw: JSON.stringify(data) })
