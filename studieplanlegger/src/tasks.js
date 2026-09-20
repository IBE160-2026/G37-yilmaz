import { Temporal } from '@js-temporal/polyfill'
import { validateDependencyGraph, canStartTask, actionUrgency, preserveMissingDependencies } from './task-dependencies.js'

export function validDeadline(value) {
  if (typeof value !== 'string' || value.length !== 16 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false
  if (Number(value.slice(0, 4)) < 1) return false
  try {
    const plain = Temporal.PlainDateTime.from(value)
    return ['earlier', 'later'].some(disambiguation => plain.toZonedDateTime('Europe/Oslo', { disambiguation }).toPlainDateTime().equals(plain))
  } catch { return false }
}

export function validateDraft(draft, id = draft.id) {
  const errors = {}
  if (typeof draft.title !== 'string' || !draft.title.trim()) errors.title = 'Skriv et navn på oppgaven.'
  if (draft.course != null && typeof draft.course !== 'string') errors.course = 'Emne må være tekst.'
  if (draft.deadlineLocal && !validDeadline(draft.deadlineLocal)) errors.deadlineLocal = 'Oppgi en gyldig dato og et gyldig klokkeslett.'
  const unknown = draft.estimatedMinutes === '' || draft.estimatedMinutes == null
  if (!unknown && !validateAvailableMinutes(draft.estimatedMinutes).ok) errors.estimatedMinutes = 'Oppgi et positivt heltall i minutter, eller la feltet stå tomt.'
  if (draft.remainingMinutes != null && draft.remainingMinutes !== '' && (!/^\d+$/.test(String(draft.remainingMinutes)) || !Number.isSafeInteger(Number(draft.remainingMinutes)))) errors.remainingMinutes = 'Oppgi et heltall på 0 eller mer, eller velg Vet ikke.'
  if (draft.requiresSubmission !== undefined && typeof draft.requiresSubmission !== 'boolean') errors.requiresSubmission = 'Velg om oppgaven skal leveres.'
  if (draft.priority && !['1', '2', '3'].includes(String(draft.priority))) errors.priority = 'Velg en gyldig prioritet.'
  if (Object.keys(errors).length) return { ok: false, errors }
  const task = { id, title: draft.title.trim(), course: (draft.course || '').trim(), deadlineLocal: draft.deadlineLocal || '', estimatedMinutes: unknown ? null : Number(draft.estimatedMinutes), completed: false }
  if (draft.remainingMinutes !== undefined) task.remainingMinutes = draft.remainingMinutes === '' || draft.remainingMinutes === null ? null : Number(draft.remainingMinutes)
  if (draft.requiresSubmission !== undefined) { task.requiresSubmission = draft.requiresSubmission; task.submitted = false }
  if (draft.priority) task.priority = Number(draft.priority)
  if (draft.courseId) task.courseId = draft.courseId
  if (draft.dependencyIds !== undefined) task.dependencyIds = draft.dependencyIds
  if (draft.waitingReason !== undefined) task.waitingReason = String(draft.waitingReason).trim()
  if (draft.taskType !== undefined) task.taskType = String(draft.taskType).trim()
  if (draft.splittable !== undefined) task.splittable = draft.splittable
  if (!validTasks([task])) return { ok: false, errors: { dependencyIds: 'Kontroller avhengigheter og planleggingsvalg.' } }
  return { ok: true, task }
}

// Optional fields extend the existing v1 envelope. Missing flags always mean false,
// and a legacy completed value is never evidence of submission.
export function validTasks(tasks) {
  if (!Array.isArray(tasks)) return false
  const ids = new Set()
  return tasks.every(task => {
    if (!task || typeof task.id !== 'string' || !task.id.trim() || task.id !== task.id.trim() || ids.has(task.id)) return false
    ids.add(task.id)
    return typeof task.title === 'string' && !!task.title.trim() && task.title === task.title.trim() &&
      typeof task.course === 'string' && task.course === task.course.trim() &&
      (task.deadlineLocal === '' || task.deadlineLocal == null || validDeadline(task.deadlineLocal)) &&
      (task.estimatedMinutes == null || (Number.isSafeInteger(task.estimatedMinutes) && task.estimatedMinutes > 0)) && typeof task.completed === 'boolean' &&
      (task.remainingMinutes == null || (Number.isSafeInteger(task.remainingMinutes) && task.remainingMinutes >= 0)) &&
      (task.requiresSubmission === undefined || typeof task.requiresSubmission === 'boolean') &&
      (task.submitted === undefined || typeof task.submitted === 'boolean') &&
      (!task.submitted || (task.requiresSubmission === true && task.completed)) &&
      (task.nextStep == null || validNextStep(task.nextStep)) &&
      (task.priority === undefined || [1, 2, 3].includes(task.priority)) &&
      (task.courseId === undefined || typeof task.courseId === 'string') &&
      ['waitingReason', 'taskType', 'importSourceId', 'importEntryKey'].every(key => task[key] === undefined || typeof task[key] === 'string' && task[key].length <= 2000) &&
      (task.splittable === undefined || typeof task.splittable === 'boolean')
  }) && validateDependencyGraph(tasks).ok
}

export function editTask(tasks, id, draft) {
  const saved = tasks.find(task => task.id === id)
  if (!saved) return { ok: false, reason: 'not-found' }
  if (saved.submitted && draft.requiresSubmission === false) {
    return { ok: false, reason: 'submitted', errors: {
      requiresSubmission: 'Angre levering før du endrer innleveringskravet.',
    } }
  }
  const result = validateDraft({ ...draft, id: saved.id })
  if (!result.ok) return result
  const edited = { ...saved, ...result.task, completed: saved.completed,
    ...(saved.submitted === undefined ? {} : { submitted: saved.submitted }) }
  if (draft.courseId === '') delete edited.courseId
  if (draft.priority === '') delete edited.priority
  // An unchecked type field does not turn an ordinary legacy edit into a data
  // migration. Keep the old shape unless the user actually adds a requirement.
  if (saved.requiresSubmission === undefined && saved.submitted === undefined && draft.requiresSubmission === false) {
    delete edited.requiresSubmission
    delete edited.submitted
  }
  const candidate = preserveMissingDependencies(tasks.map(task => task.id === id ? edited : task))
  const graph = validateDependencyGraph(candidate)
  return graph.ok ? { ok: true, tasks: candidate } : { ok: false, errors: { dependencyIds: graph.error } }
}

export function deleteTask(tasks, id) {
  if (!tasks.some(task => task.id === id)) return { ok: false, reason: 'not-found' }
  return { ok: true, tasks: preserveMissingDependencies(tasks.filter(task => task.id !== id)) }
}

export function sortedTasks(tasks) {
  return tasks.map((task, index) => ({ task, index })).sort((a, b) =>
    Number(!a.task.deadlineLocal) - Number(!b.task.deadlineLocal) ||
    (a.task.deadlineLocal || '').localeCompare(b.task.deadlineLocal || '') ||
    (b.task.priority ?? 2) - (a.task.priority ?? 2) || a.index - b.index
  ).map(entry => entry.task)
}

export function setTaskCompleted(tasks, id, completed) {
  if (typeof completed !== 'boolean') return { ok: false, reason: 'invalid' }
  const saved = tasks.find(task => task.id === id)
  if (!saved) return { ok: false, reason: 'not-found' }
  if (!completed && saved.submitted) return { ok: false, reason: 'submitted' }
  const reopenWithUnknown = saved.completed && !completed && saved.remainingMinutes === 0
  return { ok: true, tasks: tasks.map(task => task.id === id ? { ...task, completed, ...(reopenWithUnknown ? { remainingMinutes: null } : {}) } : task) }
}

export function setTaskSubmitted(tasks, id, submitted) {
  if (typeof submitted !== 'boolean') return { ok: false, reason: 'invalid' }
  const saved = tasks.find(task => task.id === id)
  if (!saved) return { ok: false, reason: 'not-found' }
  if (saved.requiresSubmission !== true) return { ok: false, reason: 'invalid' }
  if (submitted && !saved.completed) return { ok: false, reason: 'unfinished' }
  return { ok: true, tasks: tasks.map(task => task.id === id ? { ...task, submitted } : task) }
}

function validNextStep(step) {
  return typeof step === 'object' && !Array.isArray(step) &&
    typeof step.description === 'string' && step.description.trim().length > 0 &&
    step.description === step.description.trim() && Number.isSafeInteger(step.estimatedMinutes) &&
    step.estimatedMinutes > 0 && (step.unblocksWaiting === undefined || typeof step.unblocksWaiting === 'boolean')
}

export function validateNextStepDraft(draft) {
  const errors = {}
  if (typeof draft?.description !== 'string' || !draft.description.trim()) {
    errors.description = 'Beskriv neste steg.'
  }
  const estimated = validateAvailableMinutes(draft?.estimatedMinutes)
  if (!estimated.ok) errors.estimatedMinutes = estimated.error
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, nextStep: { description: draft.description.trim(), estimatedMinutes: estimated.minutes, ...(draft.unblocksWaiting ? { unblocksWaiting: true } : {}) } }
}

export function setNextStep(tasks, id, draft) {
  if (!tasks.some(task => task.id === id)) return { ok: false, reason: 'not-found' }
  const result = validateNextStepDraft(draft)
  if (!result.ok) return result
  return { ok: true, tasks: tasks.map(task => task.id === id ? { ...task, nextStep: result.nextStep } : task) }
}

export function clearNextStep(tasks, id) {
  if (!tasks.some(task => task.id === id)) return { ok: false, reason: 'not-found' }
  return { ok: true, tasks: tasks.map(task => {
    if (task.id !== id) return task
    const updated = { ...task }
    delete updated.nextStep
    return updated
  }) }
}

// Only one active step is kept; completing it makes room for a new step. Neither
// completion status nor the main estimate or submission flag is changed.
export function completeNextStep(tasks, id) {
  const task = tasks.find(item => item.id === id)
  if (!task) return { ok: false, reason: 'not-found' }
  if (!task.completed && !canStartTask(task, tasks, { nextStep: true })) return { ok: false, reason: 'blocked' }
  const result = clearNextStep(tasks, id)
  if (task.nextStep?.unblocksWaiting) result.tasks = result.tasks.map(item => item.id === id ? { ...item, waitingReason: '' } : item)
  return result
}

export function getActionMinutes(task) {
  return task.nextStep?.estimatedMinutes ?? getRemainingMinutes(task)
}

export function getRemainingMinutes(task) {
  return task.completed || task.submitted ? 0 : task.remainingMinutes !== undefined ? task.remainingMinutes : task.estimatedMinutes ?? null
}

export function validateAvailableMinutes(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || value.trim() !== value ||
      !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    return { ok: false, error: 'Skriv et positivt helt antall minutter (maks 9007199254740991).' }
  }
  return { ok: true, minutes: Number(value) }
}

// Calendar arithmetic keeps Monday at local midnight across daylight-saving changes.
function localMidnightLabel(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00`
}

export function weekBounds(now) {
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)
  return { start: localMidnightLabel(monday), end: localMidnightLabel(nextMonday) }
}

export function tasksThisWeek(tasks, now) {
  const { start, end } = weekBounds(now)
  return sortedTasks(tasks.filter(task => task.deadlineLocal >= start && task.deadlineLocal < end))
}

export function isOverdue(task, now) {
  if (!task.deadlineLocal) return false
  if (task.completed && (!task.requiresSubmission || task.submitted)) return false
  const pad = value => String(value).padStart(2, '0')
  const localMinute = `${localMidnightLabel(now).slice(0, 10)}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  // Stored deadlines have no offset: both occurrences of a repeated minute share one wall-clock label.
  return localMinute > task.deadlineLocal || (localMinute === task.deadlineLocal &&
    (now.getSeconds() > 0 || now.getMilliseconds() > 0))
}

export function overdueCount(tasks, now) {
  return tasks.filter(task => isOverdue(task, now)).length
}

export function selectTasksForMinutes(tasks, minutes, { includePartial = false } = {}) {
  if (!Number.isSafeInteger(minutes) || minutes <= 0) return []
  return tasks.map((task, index) => ({ task, index }))
    .filter(({ task }) => canStartTask(task, tasks, { nextStep: Boolean(task.nextStep) }) && getRemainingMinutes(task) !== 0 && Number.isSafeInteger(getActionMinutes(task)) && getActionMinutes(task) > 0 && (getActionMinutes(task) <= minutes || includePartial && task.splittable !== false))
    .map(entry => ({ ...entry, urgency: actionUrgency(entry.task, tasks) }))
    .sort((a, b) => (a.urgency.deadlineLocal || '9999-99').localeCompare(b.urgency.deadlineLocal || '9999-99') || b.urgency.count - a.urgency.count || (b.task.priority ?? 2) - (a.task.priority ?? 2) || a.index - b.index)
    .map(entry => entry.task)
}

export function suggestionReason(task, minutes, now = new Date(), index = 0, allTasks = []) {
  const fit = task.nextStep ? `${getActionMinutes(task) <= minutes ? `Passer innen ${minutes} minutter. ` : ''}Neste steg: «${task.nextStep.description}», ${Math.min(getActionMinutes(task), minutes)} min${getActionMinutes(task) > minutes ? ' som deløkt' : ''}. Hele oppgaven er ikke ferdig etter steget`
    : getRemainingMinutes(task) > minutes ? `En deløkt på ${minutes} min av anslått ${getRemainingMinutes(task)} min gjenstående arbeid`
      : 'Passer innen ' + minutes + ' minutter'
  const { downstream } = actionUrgency(task, allTasks)
  const downstreamReason = downstream && (!task.deadlineLocal || downstream.deadlineLocal <= task.deadlineLocal)
    ? ` Oppgaven er en forutsetning for «${downstream.title}», med registrert frist ${downstream.deadlineLocal.replace('T', ' kl. ')}.` : ''
  if (task.waitingReason && task.nextStep?.unblocksWaiting) return `${fit}. Du har registrert dette som handlingen som avklarer: ${task.waitingReason}.${downstreamReason}`
  if (downstreamReason) return `${fit}.${downstreamReason}`
  if (isOverdue(task, now)) return fit + ' og har en forfalt frist.'
  if (task.deadlineLocal) {
    const earlier = allTasks.some(other => other.id !== task.id && !other.completed && other.deadlineLocal && other.deadlineLocal < task.deadlineLocal)
    return fit + (index === 0 && !earlier ? ' og har nærmeste frist.' : ' og har en kommende frist.')
  }
  return fit + '. Ingen frist er registrert.'
}
