import { overdueCount, tasksThisWeek, weekBounds } from './tasks.js'
import { createCalendar, dateKey, formatDay } from './calendar.js'
import { createTaskList } from './task-view.js'
import { createCapacityView } from './capacity-view.js'
import { createTaskForm } from './task-form.js'

const $ = selector => document.querySelector(selector)
const setText = (element, value) => { if (element.textContent !== value) element.textContent = value }
const pending = task => !task.completed || (task.requiresSubmission && !task.submitted)

export function createUI(actions) {
  const main = $('#hovedinnhold')
  const focusMain = () => {
    main.focus({ preventScroll: true })
    main.scrollIntoView({ behavior: 'instant', block: 'start' })
  }
  $('.skip-link').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    focusMain()
  })
  if (window.location.hash === '#hovedinnhold') {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    focusMain()
  }

  const form = $('#task-form')
  const taskForm = createTaskForm(form)
  const stepForm = $('#step-form')
  const unblocks = document.createElement('label'); unblocks.className = 'check-label'; unblocks.innerHTML = '<input type="checkbox" name="unblocksWaiting">Dette registrerte steget avklarer det oppgaven venter på'; stepForm.querySelector('.form-grid').after(unblocks)
  const create = $('#new-task')
  const feedback = $('#feedback')
  const feedbackBar = $('#feedback-bar')
  const minuteInput = $('#available-minutes')
  const list = $('#task-list')
  const empty = $('#empty-tasks')
  const emptyDashboard = $('#empty-dashboard')
  const emptyDashboardText = $('#empty-dashboard-text')
  const fields = ['title', 'course', 'deadlineLocal', 'estimatedMinutes', 'remainingMinutes', 'priority', 'courseId']
  const stepFields = ['description', 'estimatedMinutes']
  const taskList = createTaskList(list, actions)
  const suggestions = createTaskList($('#dashboard-suggestions'), actions)
  const collections = [taskList, suggestions]
  const calendar = createCalendar($('#calendar-host'), { edit: actions.edit, editSession: actions.editSession, editEvent: actions.editEvent })
  const capacity = createCapacityView(actions)
  const draftOpen = () => !form.hidden || !stepForm.hidden || capacity.isOpen()
  let canChange = false
  let currentView = 'overview'
  let returnFocus = null
  let nextStepId = null
  let latestModel = null
  const rows = () => collections.flatMap(collection => [...collection.rows.values()])
  const visible = element => element?.isConnected && !element.closest('[hidden]') && element.getClientRects().length > 0
  let completionTimer = null
  const calendarPanel = $('.calendar-panel')

  function keepFocusVisible() {
    const focused = document.activeElement
    if (!focused.matches('button,input,summary')) return
    const rect = focused.getBoundingClientRect()
    if (rect.top < 8 || rect.bottom > innerHeight - 8 || rect.left < 8 || rect.right > innerWidth - 8) {
      focused.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' })
    }
  }
  function focusTask(id, action = 'edit') {
    if (currentView === 'capacity') {
      const edit = [...$('#capacity-task-list').querySelectorAll('button')].find(button => button.parentElement.dataset.capacityTask === id)
      if (edit && !edit.disabled) { edit.focus(); return }
    }
    for (const collection of collections) if (collection.focus(id, action)) return
    if (currentView === 'time' && canChange) { minuteInput.focus(); return }
    const calendarEdit = [...document.querySelectorAll('[data-calendar-edit]')].find(button =>
      button.dataset.calendarEdit === id && visible(button) && !button.disabled)
    if (calendarEdit) { calendarEdit.focus(); return }
    if (['overview', 'time'].includes(currentView) && canChange) minuteInput.focus()
    else if (!create.hidden && !create.disabled) create.focus()
    else $(`#view-${currentView}`).focus()
  }
  function disableActions(disabled) {
    for (const collection of collections) collection.disable(disabled)
    capacity.disable(disabled)
    for (const id of ['empty-create', 'suggestion-new', 'empty-onboard-task', 'empty-onboard-subject', 'empty-step', 'suggestion-step', 'feedback-next-step']) $( `#${id}`).disabled = disabled
    if (latestModel) calendar.render({ tasks: latestModel.tasks.filter(task => !latestModel.courseFilter || task.courseId === latestModel.courseFilter || latestModel.planner?.courses.some(course => course.id === latestModel.courseFilter && (task.course === course.code || task.course === course.name))), events: (latestModel.planner?.events || []).filter(event => !latestModel.courseFilter || event.courseId === latestModel.courseFilter), sessions: latestModel.sessions, now: latestModel.now, disabled })
  }
  function message(text, stepActionId = null) {
    capacity.clearMessages()
    $('#read-error').after(feedbackBar)
    for (const row of rows()) { row.feedback.hidden = true; row.feedback.textContent = '' }
    feedback.textContent = text
    feedbackBar.hidden = !text
    nextStepId = stepActionId
    $('#feedback-next-step').hidden = !stepActionId
    $('#feedback-next-step').disabled = !canChange || draftOpen()
    queueMicrotask(keepFocusVisible)
  }
  function syncDeadline() {
    form.elements.deadlineLocal.value = $('#deadlineDate').value || $('#deadlineTime').value
      ? `${$('#deadlineDate').value}T${$('#deadlineTime').value}` : ''
  }
  $('#deadlineDate').addEventListener('input', syncDeadline)
  $('#deadlineTime').addEventListener('input', syncDeadline)
  function errors(values = {}) {
    for (const name of [...fields, 'requiresSubmission', 'dependencyIds']) {
      form.elements[name].setAttribute('aria-invalid', String(Boolean(values[name])))
      const error = $(`#${name}-error`)
      if (error) error.textContent = values[name] || ''
    }
    for (const id of ['deadlineDate', 'deadlineTime']) $(`#${id}`).setAttribute('aria-invalid', String(Boolean(values.deadlineLocal)))
    const first = [...fields, 'requiresSubmission', 'dependencyIds'].find(name => values[name])
    if (first) { const details = form.elements[first].closest('details'); if (details) details.open = true }
    if (first === 'deadlineLocal') ($('#deadlineDate').value ? $('#deadlineTime') : $('#deadlineDate')).focus()
    else if (first) form.elements[first].focus()
  }
  function celebrate() {
    const badge = $('#completion-badge')
    if (!badge) return
    badge.hidden = false
    badge.classList.remove('is-visible')
    void badge.getBoundingClientRect()
    badge.classList.add('is-visible')
    if (completionTimer) window.clearTimeout(completionTimer)
    completionTimer = window.setTimeout(() => {
      badge.classList.remove('is-visible')
      badge.hidden = true
    }, 1250)
  }
  function stepErrors(values = {}) {
    for (const name of stepFields) {
      stepForm.elements[name].setAttribute('aria-invalid', String(Boolean(values[name])))
      $(`#step-${name}-error`).textContent = values[name] || ''
    }
    const first = stepFields.find(name => values[name])
    if (first) stepForm.elements[first].focus()
  }
  function restoreDailyFocus() {
    const key = returnFocus?.dataset.dailyKey, host = document.querySelector('#daily-overview')
    if (!key || !visible(host)) return false
    const control = [...host.querySelectorAll('[data-daily-key]')].find(node => node.dataset.dailyKey === key && !node.disabled) || host.querySelector('button:not(:disabled)')
    if (!control) return false
    const menu = control.closest('details'); if (menu) menu.open = true
    control.focus({ preventScroll: true }); return true
  }
  function restoreFocus(id, action) {
    if (returnFocus?.dataset.dailyKey) {
      // Resolve the stable key after the editor's model and DOM updates.
      queueMicrotask(() => { if (!restoreDailyFocus()) focusTask(id, action); keepFocusVisible() })
      return
    }
    if (visible(returnFocus) && !returnFocus.disabled) {
      const menu = returnFocus.closest('details')
      if (menu) menu.open = true
      returnFocus.focus()
    } else focusTask(id, action)
    keepFocusVisible()
  }

  create.addEventListener('click', actions.open)
  $('#cancel-task').addEventListener('click', actions.cancel)
  $('#cancel-step').addEventListener('click', actions.cancelStep)
  $('#retry-read').addEventListener('click', actions.retry)
  $('#feedback-next-step').addEventListener('click', () => { if (nextStepId) actions.step(nextStepId) })
  for (const name of ['overview', 'week', 'all', 'time', 'capacity', 'calendar', 'settings']) $(`#view-${name}`).addEventListener('click', () => actions.view(name))
  for (const id of ['overdue-all', 'empty-all', 'overview-all', 'suggestion-all']) $(`#${id}`).addEventListener('click', () => {
    actions.view('all')
    $('#view-all').focus()
  })
  for (const id of ['empty-create', 'suggestion-new', 'empty-onboard-task']) $(`#${id}`).addEventListener('click', actions.open)
  $('#empty-onboard-subject').addEventListener('click', () => { actions.view('subjects'); $('#course-new')?.click() })
  for (const id of ['empty-step', 'suggestion-step']) $(`#${id}`).addEventListener('click', actions.smallerStep)
  for (const id of ['empty-minutes', 'suggestion-minutes']) $(`#${id}`).addEventListener('click', actions.changeMinutes)
  $('#summary-week').addEventListener('click', () => {
    actions.view('week')
    const target = $('#view-week')
    ;(target.getClientRects().length ? target : $('#mobile-navigation-more')).focus()
  })
  for (const kind of ['overdue', 'ready']) $(`#summary-${kind}`).addEventListener('click', () => actions.summary(kind))
  $('#toggle-alternatives').addEventListener('click', actions.alternatives)
  $('#time-form').addEventListener('submit', event => { event.preventDefault(); actions.filter(minuteInput.value) })
  for (const button of document.querySelectorAll('[data-minutes]')) button.addEventListener('click', () => {
    minuteInput.value = button.dataset.minutes
    actions.filter(minuteInput.value)
  })
  minuteInput.addEventListener('input', () => {
    actions.filter(minuteInput.value)
    for (const button of document.querySelectorAll('[data-minutes]')) button.setAttribute('aria-pressed',
      String(Number(button.dataset.minutes) === Number(minuteInput.value) && Number(minuteInput.value) === latestModel?.minutes))
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    syncDeadline()
    actions.save({ ...Object.fromEntries(fields.map(name => [name, form.elements[name].value])), ...taskForm.draft(), requiresSubmission: form.elements.requiresSubmission.checked })
  })
  stepForm.addEventListener('submit', event => {
    event.preventDefault()
    actions.saveStep({ ...Object.fromEntries(stepFields.map(name => [name, stepForm.elements[name].value])), unblocksWaiting: stepForm.elements.unblocksWaiting.checked })
  })

  return {
    errors, stepErrors, focusTask, message,
    celebrate,
    sessionErrors: capacity.errors,
    sessionMessage(id, text) { message(''); capacity.message(id, text) },
    focusSession(id, action) { if (!capacity.focus(id, action)) $('#view-capacity').focus() },
    confirmDeleteSession(session) { return window.confirm(`Vil du slette studieøkten ${session.dateLocal} kl. ${session.startTime}–${session.endTime}?`) },
    openSession(session) {
      returnFocus = document.activeElement
      capacity.open(session)
      create.hidden = true
      disableActions(true)
      message('')
    },
    closeSession(id) {
      $('#read-error').after(feedbackBar)
      capacity.close()
      $('#session-form').closest('dialog')?.close()
      create.hidden = false
      disableActions(!canChange)
      const agendaKey = returnFocus?.dataset.agendaKey
      queueMicrotask(() => {
        if (restoreDailyFocus()) { keepFocusVisible(); return }
        const agendaControl = [...document.querySelectorAll('[data-agenda-key]')].find(button => button.dataset.agendaKey === agendaKey)
        if (agendaControl && !agendaControl.disabled) agendaControl.focus()
        else if (visible(returnFocus) && !returnFocus.disabled) returnFocus.focus()
        else if (!capacity.focus(id)) {
          const target = $('#view-capacity')
          ;(target.getClientRects().length ? target : $('#mobile-navigation-more')).focus()
        }
        keepFocusVisible()
      })
    },
    focusMinutes() { minuteInput.focus() },
    focusCreate() { create.focus() },
    confirmDelete(task) { return window.confirm(`Vil du slette «${task.title}»?`) },
    writeError(text) {
      message(text)
      const activeForm = capacity.isOpen() ? capacity.form : stepForm.hidden ? form : stepForm
      activeForm.append(feedbackBar)
      activeForm.querySelector('button[type="submit"]').focus()
      feedbackBar.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    },
    taskMessage(id, text) {
      const focusedRow = rows().find(row => row.item.contains(document.activeElement))
      message('')
      const row = focusedRow?.task.id === id ? focusedRow : rows().find(row => row.task.id === id && visible(row.item))
      if (!row) { message(text); return }
      row.feedback.textContent = text
      row.feedback.hidden = false
      row.feedback.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    },
    open(task) {
      returnFocus = document.activeElement
      form.reset()
      errors()
      $('#form-heading').textContent = task?.id ? 'Rediger oppgave' : 'Ny oppgave'
      for (const name of fields) form.elements[name].value = task?.[name] == null ? '' : String(task[name])
      taskForm.open(task)
      $('#deadlineDate').value = task?.deadlineLocal?.slice(0, 10) || ''
      $('#deadlineTime').value = task?.deadlineLocal?.slice(11) || ''
      form.elements.requiresSubmission.checked = Boolean(task?.requiresSubmission)
      form.elements.requiresSubmission.disabled = Boolean(task?.submitted)
      $('#submission-locked').hidden = !task?.submitted
      form.hidden = false
      create.hidden = true
      disableActions(true)
      $('#draft-info').hidden = !latestModel?.tasks.length
      message('')
      form.elements.title.focus()
      keepFocusVisible()
    },
    close(id) {
      $('#read-error').after(feedbackBar)
      form.reset()
      taskForm.reset()
      errors()
      form.hidden = true
      form.closest('dialog')?.close()
      create.hidden = false
      disableActions(!canChange)
      restoreFocus(id, 'edit')
    },
    openStep(task) {
      returnFocus = document.activeElement
      stepForm.reset()
      stepErrors()
      $('#step-form-heading').textContent = task.nextStep ? 'Rediger neste steg' : 'Legg til neste steg'
      $('#step-task-title').textContent = task.title
      for (const name of stepFields) stepForm.elements[name].value = task.nextStep ? String(task.nextStep[name]) : ''
      stepForm.elements.unblocksWaiting.checked = Boolean(task.nextStep?.unblocksWaiting)
      stepForm.hidden = false
      create.hidden = true
      disableActions(true)
      message('')
      stepForm.elements.description.focus()
      keepFocusVisible()
    },
    closeStep(id) {
      $('#read-error').after(feedbackBar)
      stepForm.reset()
      stepErrors()
      stepForm.hidden = true
      stepForm.closest('dialog')?.close()
      create.hidden = false
      disableActions(!canChange)
      restoreFocus(id, 'step')
    },
    render(model) {
      latestModel = model
      taskForm.render(model)
      const { tasks, readable, visibleTasks, candidates, view, now, minutes, minuteError, showAlternatives } = model
      const focused = document.activeElement
      const focusRect = focused.getBoundingClientRect()
      const focusWasVisible = focusRect.bottom > 0 && focusRect.top < innerHeight && focusRect.right > 0 && focusRect.left < innerWidth
      const focusedRow = rows().find(row => row.item.contains(focused))
      const focusedEmpty = empty.contains(focused) || $('#suggestion-empty').contains(focused)
      canChange = readable
      currentView = view
      document.body.dataset.designView = view
      create.disabled = !readable
      $('#read-error').hidden = readable
      $('#workspace').hidden = !readable
      const isFocusView = view === 'overview' || view === 'time'
      const hasSubjectContext = Boolean(model.planner?.courses?.length || model.planner?.events?.length || model.planner?.sources?.length || model.sessions?.length)
      const isBareAccount = tasks.length === 0 && !hasSubjectContext
      const hasNoTasks = tasks.length === 0
      const showOnboarding = isFocusView && hasNoTasks && !model.onboarding?.dismissed
      document.body.dataset.accountState = isBareAccount ? 'empty' : hasNoTasks ? 'partial' : 'populated'
      create.hidden = draftOpen() || showOnboarding || view === 'settings'
      $('#overview-summary').hidden = view !== 'overview' || tasks.length === 0 || isBareAccount
      $('#focus-panel').hidden = !isFocusView || hasNoTasks
      $('.focus-results').hidden = !isFocusView || hasNoTasks
      $('#tasks-panel').hidden = ['time', 'capacity', 'subjects', 'calendar', 'settings'].includes(view) || showOnboarding
      $('#capacity-panel').hidden = view !== 'capacity'
      $('#overview-all').hidden = view !== 'overview' || isBareAccount
      $('#dashboard-suggestions').hidden = view !== 'overview' || isBareAccount
      const mount = view === 'time' ? $('#focus-list-mount') : $('#task-list-mount')
      if (list.parentElement !== mount) mount.append(list)
      const emptyMount = view === 'time' ? $('#focus-list-mount') : $('#task-content')
      if (empty.parentElement !== emptyMount) emptyMount.prepend(empty)
      if (emptyDashboard) {
        emptyDashboard.hidden = !showOnboarding
        setText(emptyDashboard.querySelector('h2'), isBareAccount ? 'Gjør plass til en enklere studieuke.' : 'Gi oppgavene dine en plass.')
        setText(emptyDashboardText, isBareAccount ? 'Samle emner, undervisning og oppgaver. Få oversikt over hva som passer å gjøre nå.' : 'Du har startet oversikten din. Legg til en oppgave, så finner du enkelt arbeid som passer tiden du har.')
        $('#empty-onboard-subject').hidden = Boolean(model.planner?.courses?.length)
      }
      if (calendarPanel) calendarPanel.hidden = (isBareAccount && isFocusView) || ['subjects', 'capacity', 'calendar', 'settings'].includes(view)
      const titles = { overview: 'Kommende frister', week: 'Denne uken', all: 'Alle oppgaver', time: 'Hva kan jeg gjøre nå?', capacity: 'Kapasitet', subjects: 'Mine emner', calendar: 'Kalender', settings: 'Innstillinger' }
      setText($('#tasks-heading'), titles[view])
      for (const name of Object.keys(titles)) $(`#view-${name}`).setAttribute('aria-pressed', String(name === view))
      const subjectButton = $('#view-subjects')
      if (subjectButton) subjectButton.setAttribute('aria-pressed', String(view === 'subjects'))
      setText($('#today-label'), formatDay(dateKey(now), { weekday: true, year: true }))
      setText($('#summary-week-count'), String(tasksThisWeek(tasks, now).filter(pending).length))
      setText($('#summary-overdue-count'), String(overdueCount(tasks, now)))
    const readyCount = tasks.filter(task => task.requiresSubmission && task.completed && !task.submitted).length
      setText($('#summary-ready-count'), String(readyCount))
      $('#week-info').hidden = view !== 'week'
      const bounds = weekBounds(now)
      const sunday = new Date(now)
      sunday.setDate(sunday.getDate() - (sunday.getDay() + 6) % 7 + 6)
      setText($('#week-range'), `${formatDay(bounds.start.slice(0, 10))} – ${formatDay(dateKey(sunday))}`)
      setText($('#overdue-count'), `${overdueCount(tasks, now)} forfalte oppgaver på tvers av alle uker.`)
      $('#draft-info').hidden = form.hidden || !tasks.length
      minuteInput.setAttribute('aria-invalid', String(Boolean(minuteError)))
      setText($('#available-minutes-error'), minuteError)
      setText($('#filter-summary'), minuteError ? 'Skriv et gyldig antall minutter for å se forslag.'
        : hasNoTasks ? 'Legg til en oppgave for å få forslag for gitt tid.' : `${candidates.length} forslag innen ${minutes} minutter.`)
      for (const button of document.querySelectorAll('[data-minutes]')) button.setAttribute('aria-pressed',
        String(!minuteError && Number(button.dataset.minutes) === minutes && Number(minuteInput.value) === Number(button.dataset.minutes)))
      const allDone = tasks.length > 0 && !tasks.some(task => !task.completed)
    const readyText = readyCount === 1 ? 'Én oppgave er klar til levering.' : `${readyCount} oppgaver er klare til levering.`
    const timeEmptyText = hasNoTasks
      ? hasSubjectContext ? 'Ingen oppgaver enda. Du har undervisning eller emner registrert. Legg til din første oppgave for å få forslag.' : 'Ingen oppgaver ennå – legg til din første oppgave.'
      : allDone ? readyCount ? readyText : 'Alt registrert arbeid er ferdig. Ta en pause, eller legg til en ny oppgave.'
      : 'Ingen oppgaver passer tiden. Prøv flere minutter eller se alle oppgaver. Oppgaver uten tidsestimat er ikke med.'
    const taskListEmptyText = hasNoTasks
      ? hasSubjectContext ? 'Ingen oppgaver ennå. Legg til den første oppgaven din for å starte planen.' : 'Ingen oppgaver ennå – legg til din første oppgave.'
      : allDone ? readyCount ? readyText : 'Alt registrert arbeid er ferdig. Ta en pause, eller legg til en ny oppgave.'
        : 'Ingen oppgaver passer tiden. Prøv flere minutter eller se alle oppgaver. Oppgaver uten tidsestimat er ikke med.'
      empty.hidden = visibleTasks.length > 0 || (view === 'time' && Boolean(minuteError))
      setText($('#empty-text'), view === 'time' ? timeEmptyText : !tasks.length ? taskListEmptyText
        : view === 'week' ? 'Ingen frister denne uken. Se alle oppgaver eller legg til en ny.'
          : 'Ingen frister å følge opp. Ferdige oppgaver ligger under «Alle oppgaver».')
      $('#empty-all').hidden = view === 'all' || !tasks.length
      $('#empty-minutes').hidden = view !== 'time' || allDone || !tasks.length
      $('#empty-step').hidden = true
      $('#empty-create').hidden = view === 'time' && tasks.some(task => !task.completed)
      $('#suggestion-empty').hidden = view !== 'overview' || candidates.length > 0 || Boolean(minuteError)
      setText($('#suggestion-empty-text'), timeEmptyText)
      $('#suggestion-new').hidden = tasks.some(task => !task.completed)
      $('#suggestion-minutes').hidden = allDone || !tasks.length
      $('#suggestion-step').hidden = true
      $('#suggestion-all').hidden = !tasks.length
      const toggle = $('#toggle-alternatives')
      toggle.hidden = !isFocusView || candidates.length < 2
      toggle.setAttribute('aria-expanded', String(showAlternatives))
      toggle.setAttribute('aria-controls', view === 'time' ? 'task-list' : 'dashboard-suggestions')
      setText(toggle, showAlternatives ? 'Skjul alternativer' : `Vis alternativer (${Math.max(0, candidates.length - 1)})`)
      taskList.render(visibleTasks, { now, disabled: !readable || draftOpen(), minutes, suggestion: view === 'time', compact: view === 'overview', alternatives: showAlternatives, capacity: model.capacity.tasks, allTasks: tasks })
      suggestions.render(view === 'overview' ? candidates : [], { now, disabled: !readable || draftOpen(), minutes, suggestion: true, alternatives: showAlternatives, capacity: model.capacity.tasks, allTasks: tasks })
      capacity.render(model)
      disableActions(!readable || draftOpen())
      if ((focusedRow && (!focused.isConnected || focused.closest('[hidden]'))) ||
          (focusedEmpty && focused.closest('[hidden]')) || (focused === toggle && toggle.hidden)) {
        focusTask(visibleTasks[0]?.id)
      } else if (focusedRow && document.activeElement !== focused && !focused.disabled) {
        const menu = focused.closest('details')
        if (menu) menu.open = true
        focused.focus({ preventScroll: !focusWasVisible })
      }
      if (focusWasVisible) keepFocusVisible()
    },
  }
}
