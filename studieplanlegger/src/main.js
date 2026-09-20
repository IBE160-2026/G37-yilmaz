import { emptyPlanner } from './planner.js'
import { createSubjectsView } from './subjects-view.js'
import './redesign.css'
import { validateDraft, editTask, deleteTask, setTaskCompleted, setTaskSubmitted,
  setNextStep, clearNextStep, completeNextStep, sortedTasks,
  tasksThisWeek, selectTasksForMinutes, validateAvailableMinutes, isOverdue } from './tasks.js'
import { createStorage } from './storage.js'
import { createUI } from './redesigned-ui.js'
import { deriveCapacity, validateSession } from './capacity.js'

import { recordChange, emptyHistory, undoLast, restoreTrash } from './history.js'
import { createDataTools } from './data-tools.js'
import { createCalendarSync } from './calendar-sync.js'
import { validateWorkWindow } from './work-capacity.js'
import { createWorkLogView } from './work-log-view.js'
import { closeWork, futureReservations } from './work-log.js'
import { createReplanningView } from './replanning-view.js'
import { createOnboarding } from './onboarding.js'
import { preserveMissingDependencies } from './task-dependencies.js'

const storage = createStorage()
let extras = {}, dataTools, sync, workView, replanView, onboarding, planActions
let tasks = []
let planner
let subjects
let courseFilter = ''
let sessions
let sessionId = null
let editingSession = false
let readable = false
let draftId = null
let editing = false
let stepId = null
let showAlternatives = false
let view = 'overview'
let minutes = 30
let minuteError = ''
let visibleTasks = []
const ui = createUI({
  closeWork(id, sessionId) { if (canEdit()) { workView.open(id, sessionId); refresh() } },
  replan() { if (canEdit()) { replanView.open(); refresh() } },
  saveCalendarPreferences(preferences) {
    if (!canEdit()) return { ok: false }
    const result = commitState({ ...snapshot(), calendarPreferences: preferences }, 'Kalenderinnstillinger', { history: false })
    if (!result.ok) ui.message('Kalenderinnstillingene ble ikke lagret. Tidligere data er beholdt.')
    return result
  },
  saveWindow(draft, kind, id) {
    if (!canEdit()) return { ok: false, error: 'Lagre eller avbryt utkastet først.' }
    try {
      const item = validateWorkWindow({ ...draft, id }), key = kind === 'busy' ? 'busyWindows' : 'workWindows'
      const other = key === 'busyWindows' ? 'workWindows' : 'busyWindows'
      const existing = extras[key] || [], values = id && existing.some(value => value.id === id) ? existing.map(value => value.id === id ? item : value) : [...existing, item]
      const next = { ...snapshot(), [key]: values }
      if (id && extras[other]?.some(value => value.id === id)) next[other] = extras[other].filter(value => value.id !== id)
      const result = commitState(next, 'Arbeidstid / opptatt tid')
      if (result.ok) refresh()
      return result
    } catch (error) { return { ok: false, error: error.message } }
  },
  deleteWindow(id, kind) {
    if (!canEdit()) return false
    const key = kind === 'busy' ? 'busyWindows' : 'workWindows'
    const result = commitState({ ...snapshot(), [key]: (extras[key] || []).filter(value => value.id !== id) }, 'Slettet tidsrom')
    if (result.ok) refresh()
    return result.ok
  },
  editEvent(id) { if (canEdit()) subjects?.openEvent(id) },
  openSession() {
    refresh()
    if (!canEdit()) return
    editingSession = false
    do { sessionId = crypto.randomUUID() } while ((sessions || []).some(session => session.id === sessionId))
    ui.openSession()
  },
  editSession(id) {
    refresh()
    if (!canEdit()) return
    const session = (sessions || []).find(session => session.id === id)
    if (!session) return
    sessionId = id
    editingSession = true
    ui.openSession(session)
  },
  saveSession(draft) {
    if (!readable || sessionId === null) return
    const session = { ...(editingSession ? sessions.find(s => s.id === sessionId) : {}), id: sessionId, ...draft }
    if (!session.endDateLocal) delete session.endDateLocal
    if (!session.taskId) delete session.taskId
    if (session.taskId && !tasks.some(task => task.id === session.taskId && !task.completed && !task.submitted)) { ui.sessionErrors('Velg en oppgave som fortsatt har arbeid igjen.'); return }
    const reserving = (sessions || []).filter(item => !item.taskId || !tasks.some(task => task.id === item.taskId && (task.completed || task.submitted)))
    const result = validateSession(session, reserving, editingSession ? sessionId : null)
    ui.sessionErrors(result.valid ? '' : result.error)
    if (!result.valid) return
    const candidate = editingSession ? sessions.map(saved => saved.id === sessionId ? session : saved) : [...(sessions || []), session]
    if (!commitState({ ...snapshot(), sessions: candidate }, 'Studieøkt').ok) {
      ui.writeError('Studieøkten ble ikke lagret. Utkastet er beholdt. Prøv Lagre studieøkt igjen.')
      return
    }
    const savedId = sessionId
    sessions = candidate
    sessionId = null
    editingSession = false
    refresh()
    ui.closeSession(savedId)
    ui.message('Studieøkt lagret. Forslaget er oppdatert.')
  },
  cancelSession() {
    const id = editingSession ? sessionId : null
    sessionId = null
    editingSession = false
    ui.closeSession(id)
    refresh()
    ui.message('')
  },
  deleteSession(id) {
    if (!canEdit()) return
    const session = (sessions || []).find(session => session.id === id)
    if (!session || !ui.confirmDeleteSession(session)) return
    const candidate = sessions.filter(session => session.id !== id)
    if (!commitState({ ...snapshot(), sessions: candidate }, 'Slettet studieøkt').ok) {
      ui.focusSession(id, 'delete')
      ui.sessionMessage(id, 'Studieøkten ble ikke slettet. Lagrede data er beholdt. Prøv Slett økt igjen.')
      return
    }
    sessions = candidate
    refresh()
    ui.focusSession(candidate[0]?.id)
    ui.message('Studieøkt slettet. Forslaget er oppdatert.')
  },
  open(options) {
    refresh()
    if (!canEdit()) return
    editing = false
    do { draftId = crypto.randomUUID() } while (tasks.some(task => task.id === draftId))
    const course = planner?.courses.find(item => item.id === options?.courseId) || (!tasks.length ? planner?.courses.at(-1) : null)
    ui.open(course ? { courseId: course.id, course: course.code || course.name } : undefined)
  },
  edit(id) {
    refresh()
    if (!canEdit()) return
    const task = tasks.find(task => task.id === id)
    if (!task) return
    draftId = id
    editing = true
    ui.open(task)
  },
  delete(id) {
    refresh()
    if (!canEdit()) return
    const task = tasks.find(task => task.id === id)
    if (!task) return
    if (!ui.confirmDelete(task)) {
      ui.message('Sletting avbrutt.')
      ui.focusTask(id, 'delete')
      return
    }
    const result = deleteTask(tasks, id)
    if (!result.ok) return
    if (!writeTasks(result.tasks).ok) {
      ui.focusTask(id, 'delete')
      ui.taskMessage(id, 'Oppgaven ble ikke slettet. Lagrede oppgaver er beholdt. Prøv Slett igjen.')
      return
    }
    const index = visibleTasks.findIndex(task => task.id === id)
    const nextId = (visibleTasks[index + 1] || visibleTasks[index - 1])?.id
    tasks = result.tasks
    refresh()
    ui.focusTask(nextId)
    ui.message('Oppgave slettet')
  },
  complete(id, completed, focusAction = 'complete') {
    if (!canEdit()) { refresh(); return }
    if (tasks.find(task => task.id === id)?.completed === completed) return
    const result = setTaskCompleted(tasks, id, completed)
    if (!result.ok) { refresh(); return }
    let outcome
    if (completed) {
      const released = futureReservations(snapshot(), id)
      if (released.length && !window.confirm(`Arbeidet markeres ferdig. Disse reservasjonene frigjøres:\n${released.map(item => `${item.dateLocal} ${item.startTime}–${item.endTime}${item.locked ? ' (låst)' : ''}`).join('\n')}\nBekreft frigjøring? En eventuell innlevering bekreftes separat.`)) { refresh(); return }
      const closed = closeWork(snapshot(), { taskId: id, operationId: crypto.randomUUID(), outcome: 'done', actualMinutes: null, confirmRelease: true })
      if (!closed.ok) { ui.message(closed.error); refresh(); return }
      result.tasks = closed.state.tasks
      outcome = commitState(closed.state, 'Arbeid fullført og reservasjoner frigjort')
    } else outcome = writeTasks(result.tasks)
    if (!outcome.ok) {
      refresh()
      ui.focusTask(id, focusAction)
      ui.taskMessage(id, 'Statusen ble ikke lagret. Tidligere status er beholdt. Prøv avkrysningen igjen.')
      return
    }
    const index = visibleTasks.findIndex(task => task.id === id)
    const nextId = (visibleTasks[index + 1] || visibleTasks[index - 1])?.id
    tasks = result.tasks
    refresh()
    ui.focusTask(visibleTasks.some(task => task.id === id) ? id : nextId, focusAction)
    const task = tasks.find(task => task.id === id)
    ui.message(completed ? task.requiresSubmission ? 'Klar til levering' : 'Oppgave fullført' : task.remainingMinutes === null ? 'Oppgaven er åpen igjen. Gjenstående arbeid er ukjent. Rediger oppgaven for å oppgi et nytt estimat.' : 'Oppgaven er åpen igjen')
  },
  submit(id) {
    if (!canEdit()) return
    const task = tasks.find(task => task.id === id)
    if (!task) return
    persistAction(setTaskSubmitted(tasks, id, !task.submitted), id, 'submit',
      task.submitted ? 'Levering angret – klar til levering' : 'Levering bekreftet')
  },
  step(id) {
    refresh()
    if (!canEdit()) return
    const task = tasks.find(task => task.id === id)
    if (!task) return
    stepId = id
    ui.openStep(task)
  },
  removeStep(id) {
    if (!canEdit()) return
    persistAction(clearNextStep(tasks, id), id, 'step', 'Steg fjernet', id)
  },
  completeStep(id) {
    if (!canEdit()) return
    persistAction(completeNextStep(tasks, id), id, 'step', 'Steg fullført', id)
  },
  saveStep(draft) {
    if (!readable || stepId === null) return
    const result = setNextStep(tasks, stepId, draft)
    ui.stepErrors(result.errors)
    if (!result.ok) { ui.message('Neste steg er ikke lagret. Kontroller feltene.'); return }
    if (!writeTasks(result.tasks).ok) {
      ui.writeError('Neste steg ble ikke lagret. Utkastet er beholdt. Prøv Lagre neste steg igjen.')
      return
    }
    const savedId = stepId
    tasks = result.tasks
    stepId = null
    refresh()
    ui.closeStep(savedId)
    ui.message('Steg lagret')
  },
  cancelStep() {
    const id = stepId
    stepId = null
    ui.closeStep(id)
    refresh()
    ui.message('')
  },
  smallerStep() {
    view = 'all'
    refresh()
    ui.focusTask(visibleTasks.find(task => !task.completed)?.id, 'step')
    ui.message('Velg et lite neste steg du rekker nå.')
  },
  summary(kind) {
    view = 'all'
    refresh()
    const target = visibleTasks.find(task => kind === 'ready'
      ? task.requiresSubmission && task.completed && !task.submitted : isOverdue(task, new Date()))
    ui.focusTask(target?.id, 'primary')
  },
  alternatives() {
    showAlternatives = !showAlternatives
    refresh()
  },
  view(nextView) {
    view = nextView
    refresh()
  },
  filter(value) {
    const result = validateAvailableMinutes(value)
    minuteError = result.ok ? '' : result.error
    if (result.ok) minutes = result.minutes
    refresh()
    if (!result.ok) ui.focusMinutes()
  },
  changeMinutes() {
    refresh()
    ui.focusMinutes()
  },
  cancel() {
    refresh()
    const focusId = editing ? draftId : null
    const message = editing ? 'Redigering avbrutt.' : 'Oppretting avbrutt.'
    draftId = null
    editing = false
    refresh()
    ui.close(focusId)
    ui.message('')
  },
  retry() {
    read()
    if (readable) {
      ui.focusCreate()
      ui.message('Oppgavene er lest. Du kan endre oppgavene igjen.')
    }
  },
  save(draft) {
    refresh()
    if (!readable || !draftId) return
    const result = editing ? editTask(tasks, draftId, draft) : validateDraft({ ...draft, id: draftId })
    ui.errors(result.errors)
    if (!result.ok) { ui.message('Oppgaven er ikke lagret. Kontroller feltene.'); return }
    const candidate = editing ? result.tasks : [...tasks, result.task]
    let nextPlanner = planner
    if (draft.newCourse) {
      nextPlanner = structuredClone(planner || emptyPlanner())
      if (nextPlanner.courses.some(course => course.id === draft.newCourse.id)) { ui.writeError('Emne-ID-en finnes allerede. Utkastet er beholdt.'); return }
      nextPlanner.courses.push(draft.newCourse)
    }
    if (!writeTasks(candidate, nextPlanner).ok) {
      ui.writeError('Endringen ble ikke lagret. Utkastet er beholdt. Prøv Lagre igjen.')
      return
    }
    tasks = candidate
    const savedId = draftId
    const focusId = editing ? draftId : null
    let message = editing ? 'Endringer lagret' : 'Oppgave lagret'
    draftId = null
    editing = false
    refresh()
    if (!visibleTasks.some(task => task.id === savedId)) {
      message += '. Du finner oppgaven under «Alle oppgaver».'
    }
    ui.close(focusId)
    ui.message(message)
  },
})
function hasEditor() { return draftId !== null || stepId !== null || sessionId !== null || Boolean(subjects?.isEditing()) || Boolean(workView?.isOpen()) || Boolean(replanView?.isOpen()) }
function canEdit() { return readable && !hasEditor() }
function snapshot() { return storage.snapshot() }
function commitState(candidate, label = 'Studiedata', { history = true } = {}) {
  const before = snapshot()
  candidate = { ...candidate, tasks: preserveMissingDependencies(candidate.tasks) }
  if (candidate.workLogs) candidate.workLogs = candidate.workLogs.map(log => {
    const exists = candidate.tasks.some(task => task.id === log.taskId)
    if (exists && log.taskDeleted) { const value = { ...log }; delete value.taskDeleted; return value }
    return !exists && !log.taskDeleted ? { ...log, taskDeleted: true } : log
  })
  if (candidate.calendarPreferences?.courseId && !candidate.planner?.courses.some(course => course.id === candidate.calendarPreferences.courseId)) candidate = { ...candidate, calendarPreferences: { ...candidate.calendarPreferences, courseId: '' } }
  if (candidate.sessions) candidate = { ...candidate, sessions: candidate.sessions.map(session => {
    if (!session.taskId || candidate.tasks.some(task => task.id === session.taskId)) return session
    const value = { ...session }; delete value.taskId; return value
  }) }
  const nextHistory = history ? recordChange(before, candidate, before.history || emptyHistory(), label) : candidate.history
  const { schemaVersion, tasks: nextTasks, sessions: nextSessions, planner: nextPlanner, ...rest } = candidate
  if (nextHistory !== undefined) rest.history = nextHistory
  const result = storage.writeEnvelope({ schemaVersion: 1, ...rest, tasks: nextTasks, ...(nextSessions === undefined ? {} : { sessions: nextSessions }), ...(nextPlanner === undefined ? {} : { planner: nextPlanner }) })
  if (result.ok) {
    tasks = nextTasks; sessions = nextSessions; planner = nextPlanner; extras = rest
    if (history && nextHistory?.undo.at(-1)?.id !== before.history?.undo.at(-1)?.id) dataTools?.changed(nextHistory?.undo.at(-1))
  }
  return result.ok ? result : { ...result, error: result.reason === 'conflict' ? 'En annen fane har endret dataene. Last inn på nytt før du lagrer.' : 'Kunne ikke lagre. Tidligere data og utkast er beholdt.' }
}
function writeTasks(candidate, nextPlanner = planner) {
  const changed = tasks.find(task => JSON.stringify(task) !== JSON.stringify(candidate.find(t => t.id === task.id))) || candidate.find(task => !tasks.some(t => t.id === task.id))
  return commitState({ ...snapshot(), tasks: candidate, planner: nextPlanner }, changed ? `Oppgave: ${changed.title}` : 'Oppgave')
}
function persistAction(result, id, action, message, stepActionId = null) {
  if (!result.ok) { refresh(); return }
  if (!writeTasks(result.tasks).ok) {
    refresh()
    ui.focusTask(id, action)
    ui.taskMessage(id, 'Endringen ble ikke lagret. Tidligere status er beholdt. Prøv igjen.')
    return
  }
  const index = visibleTasks.findIndex(task => task.id === id)
  const nextId = (visibleTasks[index + 1] || visibleTasks[index - 1])?.id
  tasks = result.tasks
  refresh()
  ui.focusTask(visibleTasks.some(task => task.id === id) ? id : nextId, action)
  ui.message(message, stepActionId)
  if (action === 'complete' || action === 'completeStep') {
    ui.celebrate()
  }
}
function refresh() {
  const now = new Date()
  const candidates = minuteError ? [] : selectTasksForMinutes(tasks, minutes, { includePartial: true })
  const pending = sortedTasks(tasks.filter(task => !task.completed || (task.requiresSubmission && !task.submitted)))
  visibleTasks = view === 'week' ? tasksThisWeek(tasks, now)
    : view === 'all' ? sortedTasks(tasks)
      : view === 'overview' ? [...pending.filter(task => isOverdue(task, now)).slice(0, 3),
        ...pending.filter(task => !isOverdue(task, now)).slice(0, 3)] : candidates
  subjects?.render({ tasks, planner, view, now, minutes, minuteError, readable })
  const model = { ...extras, planner, courseFilter, tasks, sessions, capacity: deriveCapacity(tasks, sessions || [], now, planner?.events || [], extras), readable, visibleTasks, candidates, view, now, minutes, minuteError, showAlternatives, editing: hasEditor() }
  ui.render(model)
  if (planActions) {
    planActions.hidden = !readable || ['calendar', 'subjects', 'settings'].includes(view)
    for (const button of planActions.children) button.disabled = model.editing
  }
  onboarding?.render(model)
  dataTools?.render(model)
}
function read() {
  const result = storage.read()
  readable = result.ok
  if (result.ok) { tasks = result.tasks
    planner = result.planner; sessions = result.sessions
    const { ok, tasks: _tasks, planner: _planner, sessions: _sessions, ...rest } = result; extras = rest }
  refresh()
}
read()
window.addEventListener('focus', refresh)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh()
})
window.setInterval(() => {
  if (!document.hidden) refresh()
}, 1000)

subjects = createSubjectsView({
  getState: snapshot,
  commit: (candidate, label) => { const result = commitState(candidate, label); if (result.ok) refresh(); return result },
  refresh,
  view: next => { view = next; refresh() },
  courseFilter: id => { courseFilter = id },
  openTask(courseId) {
    if (!canEdit()) return
    const course = planner?.courses.find(item => item.id === courseId)
    if (!course) return
    editing = false; draftId = crypto.randomUUID()
    ui.open({ courseId: course.id, course: course.code || course.name })
  },
  minutes: value => { minutes = value; minuteError = ''; document.querySelector('#available-minutes').value = String(value); refresh() },
  editTask: id => {
    refresh()
    if (!canEdit()) return
    const task = tasks.find(item => item.id === id)
    if (!task) return
    draftId = id; editing = true; ui.open(task)
  },
  save: (next, nextTasks = tasks) => {
    if (!readable || draftId !== null || stepId !== null || sessionId !== null) return false
    const removed = (planner?.courses || []).find(course => !next.courses.some(c => c.id === course.id)) || (planner?.events || []).find(event => !next.events.some(e => e.id === event.id && !e.deleted))
    const result = commitState({ ...snapshot(), tasks: nextTasks, planner: next }, removed ? `Slettet: ${removed.name || removed.title}` : 'Emner og undervisning')
    if (!result.ok) return false
    planner = next; tasks = nextTasks; refresh(); return true
  },
})
dataTools = createDataTools({
  personalize(enabled) {
    if (!canEdit()) return { ok: false, error: 'Lagre eller avbryt utkastet først.' }
    const result = commitState({ ...snapshot(), personalization: { enabled } }, 'Personlige forslag', { history: false }); if (result.ok) refresh(); return result
  },
  purgeWork() {
    if (!canEdit()) return { ok: false, error: 'Lagre eller avbryt utkastet først.' }
    const result = storage.purgeWorkHistory()
    if (result.ok) read()
    return result.ok ? result : { ...result, error: result.error || (result.reason === 'conflict' ? 'En annen fane har endret dataene. Last inn på nytt før du sletter historikken.' : 'Arbeidshistorikken kunne ikke slettes. Tidligere data er beholdt. Prøv igjen.') }
  },
  resumeOnboarding() { const result = commitState({ ...snapshot(), onboarding: { dismissed: false, completed: false } }, 'Fortsett oppstart', { history: false }); if (result.ok) { view = 'overview'; refresh() }; return result },
  state: snapshot,
  recovery: () => storage.recovery(),
  undo() {
    if (!canEdit()) return { ok: false, error: 'Lagre eller avbryt utkastet først.' }
    const result = undoLast(snapshot(), extras.history)
    if (!result.ok) return result
    const saved = commitState({ ...result.state, history: result.history }, 'Angre', { history: false }); if (saved.ok) refresh(); return saved
  },
  restoreTrash(id) {
    if (!canEdit()) return { ok: false, error: 'Lagre eller avbryt utkastet først.' }
    const result = restoreTrash(snapshot(), extras.history || emptyHistory(), id)
    if (!result.ok) return result
    const saved = commitState({ ...result.state, history: result.history }, 'Gjenopprett', { history: false }); if (saved.ok) refresh(); return saved
  },
  replace(candidate) {
    if (hasEditor() || subjects?.hasDraft()) return { ok: false, error: 'Lagre eller avbryt utkastet først.' }
    const result = storage.replace(candidate); if (result.ok) read(); return result
  },
})
workView = createWorkLogView({ state: snapshot, commit: commitState, onClose: refresh,
  offerTime: () => { ui.message('Arbeidet er registrert. Bruk «Jeg ligger etter» for å finne ny tid.'); refresh() } })
replanView = createReplanningView({ state: snapshot, commit: commitState, onClose: refresh })
planActions = document.createElement('div'); planActions.className = 'connected-plan-actions'; planActions.innerHTML = '<button type="button" class="secondary">Planlegg uken</button><button type="button" class="secondary">Jeg ligger etter</button>'
document.querySelector('#workspace').before(planActions)
planActions.children[0].onclick = () => { view = 'capacity'; refresh(); document.querySelector('.work-window-form input[name=startLocal]')?.focus() }
planActions.children[1].onclick = () => { if (canEdit()) { replanView.open(); refresh() } }
onboarding = createOnboarding({
  begin() { if (!extras.onboarding) commitState({ ...snapshot(), onboarding: { dismissed: false, completed: false } }, 'Startet oppstart', { history: false }) },
  dismiss(completed) { if (commitState({ ...snapshot(), onboarding: { dismissed: true, completed } }, 'Oppstart satt på pause', { history: false }).ok) refresh() },
  view(next) { view = next; refresh() },
  open(options) { if (!canEdit()) return; editing = false; draftId = crypto.randomUUID(); const course = planner?.courses.find(item => item.id === options?.courseId); ui.open(course ? { courseId: course.id, course: course.code || course.name } : undefined) },
  edit(id) { const task = tasks.find(item => item.id === id); if (task && canEdit()) { draftId = id; editing = true; ui.open(task) } },
  replan() { if (canEdit()) { replanView.open({ firstSession: true }); refresh() } },
})
sync = createCalendarSync({
  getState: snapshot,
  isEditing: () => !canEdit() || subjects?.hasDraft() || document.querySelector('dialog[open], .work-window-form[data-dirty]'),
  commit(nextPlanner) { const result = commitState({ ...snapshot(), planner: nextPlanner }, 'Automatisk kalenderoppdatering', { history: false }); if (result.ok) refresh(); return result.ok },
})
window.addEventListener('focus', () => sync.tick())
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync.tick() })
window.setInterval(() => sync.tick(), 60_000)
window.addEventListener('beforeunload', event => { if (draftId || stepId || sessionId || subjects?.hasDraft() || document.querySelector('.work-window-form[data-dirty]')) { event.preventDefault(); event.returnValue = '' } })
sync.tick()
refresh()
