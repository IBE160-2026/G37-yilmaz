import { suggestionReason } from './tasks.js'
import { isOverdue, getRemainingMinutes } from './tasks.js'
import { courseColor, formatDeadline, taskStatus } from './calendar.js'
import { taskBlockers, unblocksCount, canStartTask } from './task-dependencies.js'

const node = (tag, className = '', text = '') => {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}
const setText = (element, value) => { if (element.textContent !== value) element.textContent = value }

// Each list keeps its own DOM nodes while all actions go through the same controller.
export function createTaskList(list, actions) {
  const rows = new Map()
  let renderAnimationTimer = null
  let renderSignature = ''
  function create(task) {
    const item = node('li', 'task-card')
    item.dataset.taskId = task.id
    const kicker = node('p', 'suggestion-label')
    const top = node('div', 'task-top')
    const course = node('span', 'course-tag')
    const status = node('span', 'status-badge')
    top.append(course, status)
    const title = node('h3', 'task-title')
    const meta = node('div', 'task-meta')
    const deadline = node('time', 'task-deadline')
    const estimate = node('span', 'task-estimate')
    const remaining = node('span', 'task-remaining')
    const capacityWarning = node('p', 'capacity-warning')
    const overdue = node('span', 'overdue', 'Forfalt')
    meta.append(deadline, estimate, remaining, overdue)
    const stepBox = node('div', 'next-step-box')
    const stepLabel = node('span', 'eyebrow', 'Neste steg')
    const stepText = node('p', 'next-action')
    const stepEstimate = node('p', 'action-estimate')
    stepBox.append(stepLabel, stepText, stepEstimate)
    const reason = node('p', 'suggestion-reason')
    const blockers = node('p', 'task-blockers')
    const submissionHint = node('p', 'muted', 'Angre levering før du endrer arbeidsstatus.')
    const controls = node('div', 'task-actions')
    const primary = node('button', 'task-primary')
    primary.type = 'button'
    const menu = node('details', 'task-menu')
    const summary = node('summary', '', 'Flere ···')
    summary.addEventListener('click', () => {
      for (const other of document.querySelectorAll('.task-menu[open]')) if (other !== menu) other.open = false
    })
    summary.setAttribute('aria-label', `Flere handlinger «${task.title}»`)
    const menuItems = node('div', 'task-menu-items')
    const label = node('label', 'completion-control')
    const complete = node('input')
    complete.type = 'checkbox'
    const completeText = node('span')
    label.append(complete, completeText)
    menuItems.append(label)
    const buttons = { complete }
    const row = { item, kicker, course, status, title, deadline, estimate, remaining, capacityWarning, overdue, stepBox, stepText,
      stepEstimate, reason, blockers, submissionHint, primary, menu, summary, buttons, completeText, task, primaryAction: null }
    function invoke(action) {
      if (action === 'complete') actions.complete(task.id, true, 'primary')
      else if (action === 'openStep') actions.step(task.id)
      else if (action === 'open') actions.edit(task.id)
      else actions[action](task.id)
    }
    primary.addEventListener('click', () => invoke(row.primaryAction))
    complete.addEventListener('change', () => actions.complete(task.id, complete.checked))
    for (const [action, caption] of [['edit', 'Rediger'], ['closeWork', 'Registrer arbeid'], ['step', 'Legg til neste steg'],
      ['completeStep', 'Neste steg gjort'], ['removeStep', 'Fjern neste steg'], ['submit', 'Angre levering'], ['delete', 'Slett']]) {
      const button = node('button', action === 'delete' ? 'danger-button' : '', caption)
      button.type = 'button'
      button.addEventListener('click', () => invoke(action))
      menuItems.append(button)
      buttons[action] = button
    }
    menu.append(summary, menuItems)
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); menu.open = false; summary.focus() }
    })
    controls.append(primary, menu)
    const feedback = node('p', 'task-feedback')
    feedback.setAttribute('role', 'alert')
    feedback.hidden = true
    row.feedback = feedback
    item.append(kicker, top, title, meta, capacityWarning, stepBox, blockers, reason, submissionHint, controls, feedback)
    return row
  }
  function setDisabled(row, disabled) {
    row.primary.disabled = disabled
    for (const [action, button] of Object.entries(row.buttons)) {
      button.disabled = disabled || (action === 'complete' && Boolean(row.task.submitted)) ||
        (action === 'submit' && !row.task.completed)
    }
  }
  return {
    rows,
    disable(disabled) { for (const row of rows.values()) setDisabled(row, disabled) },
    render(tasks, { now, disabled, minutes = 30, suggestion = false, compact = false, alternatives = false, capacity = [], allTasks = tasks }) {
      const signature = `${suggestion ? 'suggest-' : 'list-'}${tasks.map(task => task.id).join(',')}`
      if (signature !== renderSignature) {
        renderSignature = signature
        list.classList.remove('is-updating')
        if (renderAnimationTimer) window.clearTimeout(renderAnimationTimer)
        void list.getBoundingClientRect()
        list.classList.add('is-updating')
        renderAnimationTimer = window.setTimeout(() => list.classList.remove('is-updating'), 280)
      }
      const wanted = new Set(tasks.map(task => task.id))
      for (const [id, row] of rows) if (!wanted.has(id)) { row.item.remove(); rows.delete(id) }
      let position = list.firstElementChild
      for (const [index, task] of tasks.entries()) {
        let row = rows.get(task.id)
        if (!row) { row = create(task); rows.set(task.id, row) }
        row.item.style.setProperty('--reveal-delay', `${Math.min(6, index) * 28}ms`)
        row.task = task
        row.item.hidden = suggestion && index > 0 && !alternatives
        row.item.classList.toggle('primary-suggestion', suggestion && index === 0)
        row.item.style.setProperty('--course-color', courseColor(task.course))
        row.kicker.hidden = !suggestion
        setText(row.kicker, index === 0 ? 'Ditt hovedforslag' : 'Et annet forslag')
        setText(row.title, task.title)
        setText(row.course, task.course || 'Uten emne')
        const ready = Boolean(task.requiresSubmission && task.completed && !task.submitted)
        setText(row.status, taskStatus(task))
        row.status.className = `status-badge ${task.submitted ? 'is-submitted' : ready ? 'is-ready' : task.completed ? 'is-completed' : 'is-open'}`
        setText(row.deadline, formatDeadline(task.deadlineLocal, { year: Number((task.deadlineLocal || '').slice(0, 4)) !== now.getFullYear() }))
        row.deadline.dateTime = task.deadlineLocal || ''
        setText(row.estimate, task.estimatedMinutes == null ? 'Tidsestimat ukjent' : `Hele oppgaven: ${task.estimatedMinutes} min`)
        setText(row.remaining, getRemainingMinutes(task) == null ? 'Gjenstående arbeid: ukjent' : `Gjenstående arbeid: ${getRemainingMinutes(task)} min${task.remainingMinutes === undefined && !task.completed ? ' (hovedestimat)' : ''}`)
        const planned = capacity.find(entry => entry.taskId === task.id)
        row.capacityWarning.hidden = !planned || task.completed || (!planned.missingMinutes && planned.requiredMinutes !== 0)
        setText(row.capacityWarning, planned ? `${planned.missingMinutes && task.deadlineLocal ? `Mangler ${planned.missingMinutes} min før fristen. ` : ''}${planned.reasons.join(' ')}` : '')
        row.overdue.hidden = !isOverdue(task, now)
        row.stepBox.hidden = !task.nextStep
        setText(row.stepText, task.nextStep?.description || '')
        setText(row.stepEstimate, task.nextStep ? `${task.nextStep.estimatedMinutes} min · bare neste steg` : '')
        row.reason.hidden = !suggestion
        const unblocks = unblocksCount(task, allTasks)
        setText(row.reason, `${suggestionReason(task, minutes, now, index, allTasks)}${unblocks ? ` Kan åpne for ${unblocks} registrerte oppgaver som avhenger av denne.` : ''}`)
        const blocked = taskBlockers(task, allTasks); row.blockers.hidden = !blocked.length; setText(row.blockers, blocked.map(item => item.reason).join(' '))
        row.submissionHint.hidden = !task.submitted
        row.buttons.complete.checked = task.completed
        setText(row.completeText, task.requiresSubmission ? 'Ferdig med arbeidet' : 'Fullført')
        row.buttons.complete.setAttribute('aria-label', `${row.completeText.textContent} «${task.title}»`)
        row.summary.setAttribute('aria-label', `Flere handlinger «${task.title}»`)
        row.primaryAction = suggestion || compact ? 'open'
          : ready ? 'submit' : task.completed ? 'open' : task.nextStep ? 'completeStep' : 'complete'
        const primaryLabels = { openStep: 'Åpne neste steg', open: 'Åpne oppgave', submit: 'Bekreft levert',
          completeStep: 'Neste steg gjort', complete: 'Marker ferdig' }
        const primaryLabel = primaryLabels[row.primaryAction]
        setText(row.primary, primaryLabel)
        row.primary.setAttribute('aria-label', `${primaryLabel} «${task.title}»`)
        setText(row.buttons.step, task.nextStep ? 'Rediger neste steg' : 'Legg til neste steg')
        setText(row.buttons.submit, task.submitted ? 'Angre levering' : 'Bekreft levert')
        row.buttons.submit.hidden = !task.requiresSubmission || !task.completed || row.primaryAction === 'submit'
        row.buttons.completeStep.hidden = !task.nextStep || row.primaryAction === 'completeStep'
        row.buttons.removeStep.hidden = !task.nextStep
        row.buttons.closeWork.hidden = task.completed || task.submitted
        for (const [action, button] of Object.entries(row.buttons)) {
          if (action !== 'complete') button.setAttribute('aria-label', `${button.textContent} «${task.title}»`)
        }
        setDisabled(row, disabled)
        row.buttons.completeStep.disabled ||= !canStartTask(task, allTasks, { nextStep: true })
        if (row.primaryAction === 'completeStep') row.primary.disabled ||= !canStartTask(task, allTasks, { nextStep: true })
        if (row.item !== position) list.insertBefore(row.item, position)
        position = row.item.nextElementSibling
      }
    },
    focus(id, action = 'edit') {
      const row = rows.get(id)
      if (!row || row.item.closest('[hidden]')) return false
      let control = action === 'primary' || (action !== 'complete' && row.primaryAction === action) ? row.primary : row.buttons[action]
      if (!control || control.hidden || control.disabled) control = row.primary
      if (control.disabled) return false
      if (row.menu.contains(control)) {
        for (const other of document.querySelectorAll('.task-menu[open]')) if (other !== row.menu) other.open = false
        row.menu.open = true
      }
      control.focus()
      control.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' })
      return true
    },
  }
}
