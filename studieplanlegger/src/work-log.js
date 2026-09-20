import { validTasks, getRemainingMinutes } from './tasks.js'
import { extendedSessionInterval } from './work-capacity.js'

const nonnegative = value => value === null || Number.isSafeInteger(value) && value >= 0
export function validWorkLogs(values, envelope) {
  if (!Array.isArray(values)) return false
  const ids = new Set(), operations = new Set(), sessions = new Set()
  return values.every(log => {
    if (!log || typeof log.id !== 'string' || !log.id.trim() || ids.has(log.id) || typeof log.operationId !== 'string' || !log.operationId.trim() || operations.has(log.operationId)) return false
    ids.add(log.id); operations.add(log.operationId)
    if (log.sessionId !== undefined) {
      if (typeof log.sessionId !== 'string' || !log.sessionId || sessions.has(log.sessionId)) return false
      sessions.add(log.sessionId)
    }
    return typeof log.taskId === 'string' && ['done', 'more', 'not-started'].includes(log.outcome) &&
      Number.isFinite(Date.parse(log.at)) && nonnegative(log.actualMinutes) && nonnegative(log.plannedMinutes) && nonnegative(log.remainingMinutes) &&
      typeof log.interrupted === 'boolean' && typeof log.historyComplete === 'boolean' &&
      (!log.historyComplete || log.outcome === 'done') &&
      (log.outcome !== 'not-started' || log.actualMinutes === null && !log.historyComplete) &&
      validTasks([log.taskSnapshot]) && log.taskSnapshot.id === log.taskId &&
      (log.sessionSnapshot === undefined || (() => { try { return log.sessionSnapshot.id === log.sessionId && Boolean(extendedSessionInterval(log.sessionSnapshot)) } catch { return false } })()) &&
      (log.taskDeleted === undefined || typeof log.taskDeleted === 'boolean') &&
      (!envelope || envelope.tasks.some(task => task.id === log.taskId) || log.taskDeleted === true)
  })
}

function minutes(value, title) {
  if (value === '' || value === null || value === undefined) return null
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error(`${title}: oppgi hele minutter på 0 eller mer, eller velg Vet ikke.`)
  return Number(value)
}

export function futureReservations(state, taskId, now = new Date()) {
  return (state.sessions || []).filter(session => session.taskId === taskId && extendedSessionInterval(session).end > +now)
}

export function closeWork(state, draft, { now = new Date() } = {}) {
  const existing = (state.workLogs || []).find(log => log.operationId === draft.operationId || draft.sessionId && log.sessionId === draft.sessionId)
  if (existing) {
    try {
      const actual = draft.outcome === 'not-started' ? null : minutes(draft.actualMinutes, 'Faktisk arbeidstid')
      const task = state.tasks.find(item => item.id === draft.taskId)
      const remaining = draft.outcome === 'done' ? 0 : draft.outcome === 'not-started' ? getRemainingMinutes(task) : minutes(draft.remainingMinutes, 'Gjenstående arbeid')
      const same = existing.operationId === draft.operationId && existing.taskId === draft.taskId && existing.sessionId === (draft.sessionId || undefined) && existing.outcome === draft.outcome && existing.actualMinutes === actual && existing.remainingMinutes === remaining && existing.interrupted === (draft.outcome === 'not-started' ? false : Boolean(draft.interrupted)) && existing.historyComplete === (draft.outcome === 'done' && Boolean(draft.historyComplete))
      if (!same) throw new Error('Operasjons- eller økt-ID-en er allerede brukt med andre opplysninger. Åpne registreringen på nytt.')
      return { ok: true, state, repeated: true, log: existing, released: [] }
    } catch (error) { return { ok: false, error: error.message } }
  }
  try {
    if (typeof draft.operationId !== 'string' || !draft.operationId.trim()) throw new Error('Arbeidsregistreringen mangler operasjons-ID.')
    const task = state.tasks.find(item => item.id === draft.taskId)
    if (!task || task.submitted) throw new Error('Oppgaven finnes ikke eller er allerede levert.')
    if (!['done', 'more', 'not-started'].includes(draft.outcome)) throw new Error('Velg hvordan økten gikk.')
    const session = draft.sessionId ? (state.sessions || []).find(item => item.id === draft.sessionId && item.taskId === task.id) : undefined
    if (draft.sessionId && !session) throw new Error('Studieøkten er endret eller mangler. Åpne registreringen på nytt.')
    const actual = draft.outcome === 'not-started' ? null : minutes(draft.actualMinutes, 'Faktisk arbeidstid')
    const remaining = draft.outcome === 'done' ? 0 : draft.outcome === 'not-started' ? getRemainingMinutes(task) : minutes(draft.remainingMinutes, 'Gjenstående arbeid')
    const released = draft.outcome === 'done' ? futureReservations(state, task.id, now) : []
    if (released.length && !draft.confirmRelease) return { ok: false, requiresRelease: true, released, error: 'Bekreft frigjøring av de viste reservasjonene før du fullfører.' }
    const interval = session && extendedSessionInterval(session)
    const log = { id: `work-${draft.operationId}`, operationId: draft.operationId, taskId: task.id,
      at: now.toISOString(), outcome: draft.outcome, actualMinutes: actual,
      plannedMinutes: interval ? Math.floor((interval.end - interval.start) / 60000) : null,
      remainingMinutes: remaining, interrupted: draft.outcome === 'not-started' ? false : Boolean(draft.interrupted),
      historyComplete: draft.outcome === 'done' && Boolean(draft.historyComplete), taskSnapshot: structuredClone(task),
      ...(session ? { sessionId: session.id, sessionSnapshot: structuredClone(session) } : {}) }
    const next = structuredClone(state)
    next.workLogs = [...(next.workLogs || []), log]
    if (draft.outcome !== 'not-started') next.tasks = next.tasks.map(item => item.id === task.id ? { ...item, remainingMinutes: remaining, completed: draft.outcome === 'done' } : item)
    const remove = new Set([...released.map(item => item.id), ...(session ? [session.id] : [])])
    if (next.sessions) next.sessions = next.sessions.filter(item => !remove.has(item.id))
    return { ok: true, state: next, log, released }
  } catch (error) { return { ok: false, error: error.message } }
}

// Purging removes complete compound undo entries, so undo cannot restore half
// of a closeout or recover the private work history. Unrelated history survives.
export function purgeWorkHistory(state) {
  const next = structuredClone(state)
  delete next.workLogs
  if (next.history) for (const kind of ['undo', 'trash']) next.history[kind] = next.history[kind].filter(entry => !entry.changes.some(change => change.path === 'workLogs'))
  return next
}
