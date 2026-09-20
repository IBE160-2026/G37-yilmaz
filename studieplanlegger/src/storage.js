import { validPlanner } from './planner.js'
import { validTasks } from './tasks.js'
import { validSessions } from './capacity.js'
import { validWindows } from './work-capacity.js'
import { validHistory } from './history.js'
import { validCalendarPreferences } from './calendar-preferences.js'
import { validWorkLogs, purgeWorkHistory } from './work-log.js'
import { validImportSources } from './import-source-contract.js'
import { validConnectedPreferences } from './planning-rules.js'
import { validateDependencyGraph } from './task-dependencies.js'
import { createServerStorage } from './server-storage.js'

export const STORAGE_KEY = 'studieplanlegger:v1'
export const RECOVERY_KEY = 'studieplanlegger:recovery:v1'
// A privacy purge also reaches the copies that Restore can bring back. Refuse
// unknown/corrupt journal formats instead of deleting unrelated recovery data.
function purgeRecoveryJournal(raw) {
  const scrubEnvelope = value => {
    if (!validEnvelope(value)) throw new Error('unreadable-recovery')
    return purgeWorkHistory(value)
  }
  const scrub = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 32 ||
      Object.keys(value).some(key => !['savedAt', 'raw', 'data', 'previous'].includes(key)) ||
      !('raw' in value) && !('data' in value)) throw new Error('unreadable-recovery')
    const copy = { ...value }
    if ('data' in value) copy.data = scrubEnvelope(value.data)
    if ('raw' in value && value.raw !== null) {
      if (typeof value.raw !== 'string') throw new Error('unreadable-recovery')
      const parsed = JSON.parse(value.raw), purged = scrubEnvelope(parsed)
      copy.raw = JSON.stringify(parsed) === JSON.stringify(purged) ? value.raw : JSON.stringify(purged)
    }
    if ('previous' in value) copy.previous = scrub(value.previous, depth + 1)
    return copy
  }
  const parsed = JSON.parse(raw), purged = scrub(parsed)
  return JSON.stringify(parsed) === JSON.stringify(purged) ? raw : JSON.stringify(purged)
}
export function validEnvelope(value, { relations = false } = {}) {
  if (!value || !validConnectedPreferences(value) || value.workLogs !== undefined && !validWorkLogs(value.workLogs, relations ? value : undefined) || value.importSources !== undefined && !validImportSources(value.importSources, relations ? value : undefined)) return false
  if (relations && !validImportSources(value.importSources || [], value)) return false
  if (value?.calendarPreferences !== undefined && (!validCalendarPreferences(value.calendarPreferences) || relations && value.calendarPreferences.courseId && !value.planner?.courses.some(course => course.id === value.calendarPreferences.courseId))) return false
  if (!value || value.schemaVersion !== 1 || !validTasks(value.tasks) || (value.sessions !== undefined && !validSessions(value.sessions)) || (value.planner !== undefined && !validPlanner(value.planner)) || (value.workWindows !== undefined && !validWindows(value.workWindows)) || (value.busyWindows !== undefined && !validWindows(value.busyWindows)) || (value.history !== undefined && !validHistory(value.history, value))) return false
  return !relations || (validateDependencyGraph(value.tasks, { relations: true }).ok && value.tasks.every(task => (!task.courseId || value.planner?.courses.some(course => course.id === task.courseId)) && (!task.importSourceId || value.importSources?.some(source => source.id === task.importSourceId && source.entries.some(entry => entry.key === task.importEntryKey && entry.targetId === task.id)))) && (value.sessions || []).every(session => !session.taskId || value.tasks.some(task => task.id === session.taskId)) && (value.planner?.events || []).every(event => !event.sourceId || value.planner.sources.some(source => source.id === event.sourceId && source.courseId === event.courseId)))
}
export function createStorage(getStorage) {
  if (getStorage === undefined && globalThis.__STUDIEPLAN_API__ === true) return createServerStorage()
  getStorage ||= () => window.localStorage
  let envelope = { schemaVersion: 1, tasks: [] }
  let lastRaw, loaded = false, writable = true
  function persist(value, { repair = false, expectedRecovery } = {}) {
    if (!validEnvelope(value, { relations: true })) return { ok: false, reason: 'invalid' }
    if (!writable && !repair) return { ok: false, reason: 'unreadable' }
    try {
      const storage = getStorage()
      if (loaded && storage.getItem(STORAGE_KEY) !== lastRaw) return { ok: false, reason: 'conflict' }
      if (expectedRecovery !== undefined && storage.getItem(RECOVERY_KEY) !== expectedRecovery) return { ok: false, reason: 'conflict' }
      const raw = JSON.stringify(value)
      storage.setItem(STORAGE_KEY, raw)
      envelope = structuredClone(value); lastRaw = raw; loaded = true; writable = true
      return { ok: true }
    } catch { return { ok: false, reason: 'unwritable' } }
  }
  return {
    read() {
      let raw
      try { raw = getStorage().getItem(STORAGE_KEY) } catch { writable = false; return { ok: false, reason: 'unreadable' } }
      lastRaw = raw; loaded = true; writable = false
      if (raw === null) { envelope = { schemaVersion: 1, tasks: [] }; writable = true; return { ok: true, tasks: [] } }
      try {
        const value = JSON.parse(raw)
        if (!validEnvelope(value, { relations: true })) return { ok: false, reason: 'invalid' }
        envelope = value; writable = true
        const { schemaVersion, ...state } = structuredClone(value)
        return { ok: true, ...state }
      } catch { return { ok: false, reason: 'invalid' } }
    },
    snapshot() { return structuredClone(envelope) },
    writeEnvelope: persist,
    purgeWorkHistory() {
      if (!loaded || !writable) return { ok: false, reason: 'unreadable' }
      const candidate = purgeWorkHistory(envelope)
      if (!validEnvelope(candidate, { relations: true })) return { ok: false, reason: 'invalid' }
      let storage, priorRecovery, stagedRecovery, recoveryWritten = false
      try {
        storage = getStorage()
        if (storage.getItem(STORAGE_KEY) !== lastRaw) return { ok: false, reason: 'conflict' }
        priorRecovery = storage.getItem(RECOVERY_KEY)
        try { stagedRecovery = priorRecovery === null ? null : purgeRecoveryJournal(priorRecovery) }
        catch { return { ok: false, reason: 'unreadable-recovery', error: 'Arbeidshistorikken er ikke slettet. Gjenopprettingskopien kan ikke leses sikkert; behold eller reparer kopien før du prøver igjen.' } }
        if (storage.getItem(STORAGE_KEY) !== lastRaw || storage.getItem(RECOVERY_KEY) !== priorRecovery) return { ok: false, reason: 'conflict' }
        if (stagedRecovery !== priorRecovery) {
          storage.setItem(RECOVERY_KEY, stagedRecovery)
          recoveryWritten = true
        }
      } catch { return { ok: false, reason: 'recovery-failed' } }
      // Main data is committed last. A failed write restores only our own staged
      // journal; another writer's recovery copy is never overwritten.
      const result = persist(candidate, { expectedRecovery: stagedRecovery })
      if (!result.ok && recoveryWritten) {
        try {
          if (storage.getItem(RECOVERY_KEY) === stagedRecovery) storage.setItem(RECOVERY_KEY, priorRecovery)
        } catch { return { ...result, recoveryJournalRetained: true, error: 'Slettingen ble ikke fullført. Oppgavene og arbeidshistorikken er beholdt, men historikken er fjernet fra gjenopprettingskopien. Prøv igjen.' } }
      }
      return result
    },
    write(tasks, sessions, planner, extra = {}) {
      const value = { ...envelope, ...extra, schemaVersion: 1, tasks }
      if (sessions === undefined) delete value.sessions; else value.sessions = sessions
      if (planner === undefined) delete value.planner; else value.planner = planner
      return persist(value)
    },
    replace(value) {
      if (!validEnvelope(value, { relations: true })) return { ok: false, reason: 'invalid' }
      let storage, currentRaw, priorRecovery, staged
      try {
        storage = getStorage(); currentRaw = storage.getItem(STORAGE_KEY)
        if (loaded && currentRaw !== lastRaw) return { ok: false, reason: 'conflict' }
        priorRecovery = storage.getItem(RECOVERY_KEY)
        let data, previous
        try { const parsed = currentRaw === null ? { schemaVersion: 1, tasks: [] } : JSON.parse(currentRaw); if (validEnvelope(parsed)) data = parsed } catch { /* Preserve unreadable input verbatim, not an empty snapshot. */ }
        try { const old = JSON.parse(priorRecovery); const copy = old?.raw === currentRaw && old.previous ? old.previous : old; if (validEnvelope(copy?.data)) previous = { savedAt: copy.savedAt, data: copy.data, raw: copy.raw } } catch { /* Older raw recovery is still retained for rollback. */ }
        staged = JSON.stringify({ savedAt: new Date().toISOString(), raw: currentRaw, ...(data ? { data } : {}), ...(previous ? { previous } : {}) })
        storage.setItem(RECOVERY_KEY, staged)
      } catch { return { ok: false, reason: 'recovery-failed' } }
      // Establish a guard even when replace is the first operation on this store.
      if (!loaded) { loaded = true; lastRaw = currentRaw }
      const result = persist(value, { repair: true, expectedRecovery: staged })
      if (!result.ok) {
        try {
          // Never roll back a concurrent writer's data or recovery entry.
          if (storage.getItem(RECOVERY_KEY) === staged) {
            if (priorRecovery === null) storage.removeItem(RECOVERY_KEY)
            else storage.setItem(RECOVERY_KEY, priorRecovery)
          }
        } catch { return { ...result, recoveryJournalRetained: true } }
      }
      return result
    },
    recovery() {
      try {
        const storage = getStorage(); let copy = JSON.parse(storage.getItem(RECOVERY_KEY))
        // A retained staging journal keeps the older copy accessible even if
        // quota/access failure also prevented rollback of the recovery key.
        if (copy?.previous && (copy.raw === storage.getItem(STORAGE_KEY) || !validEnvelope(copy.data))) copy = copy.previous
        return copy && validEnvelope(copy.data) ? copy : null
      } catch { return null }
    },
  }
}
