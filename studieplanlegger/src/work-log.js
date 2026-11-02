import { validTasks, getRemainingMinutes, validEstimateRange } from './tasks.js'
import { extendedSessionInterval } from './work-capacity.js'
import { taskSteps, completeWorkStep, migrateLegacyStep } from './work-steps.js'
import { privateReviewChange } from './review-planning.js'

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
      (log.stepCompleted === undefined || typeof log.stepCompleted === 'boolean') &&
      (log.taskCompleted === undefined || typeof log.taskCompleted === 'boolean' &&
        (!log.taskCompleted || log.outcome === 'done' && log.remainingMinutes === 0) &&
        (log.taskCompleted || !log.historyComplete) &&
        (log.outcome !== 'done' || log.stepCompleted === true || log.taskCompleted)) &&
      (log.remainingEstimate === undefined || validEstimateRange(log.remainingEstimate)) &&
      (!log.stepCompleted || log.outcome === 'done') &&
      (log.remainingEstimate === undefined || log.outcome === 'more') &&
      validTasks([log.taskSnapshot]) && log.taskSnapshot.id === log.taskId &&
      (log.stepId === undefined || typeof log.stepId === 'string' && Boolean(log.stepId.trim()) && taskSteps(log.taskSnapshot).some(step => step.id === log.stepId) &&
        (log.outcome !== 'done' || log.stepCompleted === true)) &&
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
  const task = state.tasks.find(item => item.id === draft.taskId)
  const stepOnly = draft.stepId !== undefined || draft.stepOnly === true
  const finishTask = draft.outcome === 'done' && (!stepOnly || draft.completeTask === true)
  try {
    if (stepOnly && (typeof draft.stepId !== 'string' || !draft.stepId.trim())) throw new Error('Arbeidsregistreringen mangler et gyldig arbeidssteg. Åpne oppgaven på nytt.')
    if (draft.outcome === 'more' && draft.remainingEstimate != null && !validEstimateRange(draft.remainingEstimate)) throw new Error('Gjenstående arbeid: oppgi et gyldig tidsintervall.')
    const estimate = draft.outcome === 'more' && draft.remainingEstimate != null ? { ...draft.remainingEstimate } : null
    const actual = draft.outcome === 'not-started' ? null : minutes(draft.actualMinutes, 'Faktisk arbeidstid')
    // Repeated saves compare against the original task, including outcomes that
    // preserve its remainder. Later task edits must not change the operation.
    const remaining = finishTask ? 0 : draft.outcome === 'more' ? estimate ? null : minutes(draft.remainingMinutes, 'Gjenstående arbeid') : getRemainingMinutes(existing?.taskSnapshot || task)
    if (existing) {
      if (existing.operationId !== draft.operationId || existing.sessionId !== draft.sessionId) throw new Error('Operasjons- eller økt-ID-en er allerede brukt med andre opplysninger. Åpne registreringen på nytt.')
      const expectedPlanned = Number.isSafeInteger(draft.plannedMinutes) ? draft.plannedMinutes : existing.plannedMinutes
      const sameEstimate = JSON.stringify(existing.remainingEstimate ?? null) === JSON.stringify(estimate)
      const same = existing.taskId === draft.taskId && existing.stepId === draft.stepId && existing.outcome === draft.outcome && existing.actualMinutes === actual && existing.remainingMinutes === remaining &&
        (existing.taskCompleted === undefined || existing.taskCompleted === finishTask) &&
        existing.plannedMinutes === expectedPlanned && existing.interrupted === (draft.outcome === 'not-started' ? false : Boolean(draft.interrupted)) &&
        existing.historyComplete === (finishTask && Boolean(draft.historyComplete)) && Boolean(existing.stepCompleted) === Boolean(stepOnly && draft.outcome === 'done') && sameEstimate
      if (!same) throw new Error('Operasjons- eller økt-ID-en er allerede brukt med andre opplysninger. Åpne registreringen på nytt.')
      return { ok: true, state, repeated: true, log: existing, released: [] }
    }
    if (typeof draft.operationId !== 'string' || !draft.operationId.trim()) throw new Error('Arbeidsregistreringen mangler operasjons-ID.')
    if (!task || task.submitted) throw new Error('Oppgaven finnes ikke eller er allerede levert.')
    if (!['done', 'more', 'not-started'].includes(draft.outcome)) throw new Error('Velg hva som skjedde.')
    const step = stepOnly ? taskSteps(task).find(item => item.id === draft.stepId) : null
    if (stepOnly && (!step || step.completed)) throw new Error('Arbeidssteget er endret eller finnes ikke lenger. Åpne oppgaven på nytt.')
    const completedStep = stepOnly && draft.outcome === 'done' ? completeWorkStep(task, draft.stepId) : null
    if (completedStep && !completedStep.ok) throw new Error(completedStep.error)
    const session = draft.sessionId ? (state.sessions || []).find(item => item.id === draft.sessionId && item.taskId === task.id) : undefined
    if (draft.sessionId && !session) throw new Error('Studieøkten er endret eller mangler. Åpne registreringen på nytt.')
    const released = finishTask ? futureReservations(state, task.id, now) : []
    if (released.length && !draft.confirmRelease) return { ok: false, requiresRelease: true, released, error: 'Bekreft frigjøring av de viste reservasjonene før du fullfører.' }
    const interval = session && extendedSessionInterval(session)
    const log = { id: `work-${draft.operationId}`, operationId: draft.operationId, taskId: task.id,
      at: now.toISOString(), outcome: draft.outcome, actualMinutes: actual,
      plannedMinutes: interval ? Math.floor((interval.end - interval.start) / 60000) : Number.isSafeInteger(draft.plannedMinutes) ? draft.plannedMinutes : null,
      remainingMinutes: remaining, interrupted: draft.outcome === 'not-started' ? false : Boolean(draft.interrupted),
      historyComplete: finishTask && Boolean(draft.historyComplete), taskCompleted: finishTask, taskSnapshot: structuredClone(task),
      ...(stepOnly ? { stepId: draft.stepId } : {}),
      ...(completedStep ? { stepCompleted: true } : {}), ...(estimate ? { remainingEstimate: estimate } : {}),
      ...(session ? { sessionId: session.id, sessionSnapshot: structuredClone(session) } : {}) }
    const next = structuredClone(state)
    next.workLogs = [...(next.workLogs || []), log]
    if (draft.outcome !== 'not-started') next.tasks = next.tasks.map(item => {
      if (item.id !== task.id) return item
      const updated = completedStep ? structuredClone(completedStep.task) : migrateLegacyStep(item)
      if (finishTask || draft.outcome === 'more') { updated.remainingMinutes = remaining; updated.completed = finishTask }
      if (finishTask) { delete updated.nextStep; if (updated.steps) updated.steps = updated.steps.map(step => ({ ...step, completed: true })) }
      if (estimate) updated.remainingEstimate = estimate
      else if (draft.outcome === 'more' || finishTask) delete updated.remainingEstimate
      return updated
    })
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
  delete next.topics
  delete next.assessments
  delete next.reviewDecisions
  if (next.sessions) next.sessions = next.sessions.filter(session => !session.reviewKey && !session.reviewTopicId)
  if (next.history) for (const kind of ['undo', 'trash']) next.history[kind] = next.history[kind].filter(entry => !entry.changes.some(change => change.path === 'workLogs' || privateReviewChange(change)))
  return next
}
