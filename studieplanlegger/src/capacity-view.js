import { formatDay, formatDeadline, taskStatus } from './calendar.js'
import { capacityNotice } from './capacity-notice.js'
import { getRemainingMinutes } from './tasks.js'
import { osloLocal } from './planner.js'

const $ = selector => document.querySelector(selector)
const setText = (node, text) => { if (node.textContent !== text) node.textContent = text }
const element = (tag, className = '', text = '') => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

// Derived views retain their controls; the controller alone owns saved sessions.
export function createCapacityView(actions) {
  const form = $('#session-form')
  const lock = element('label', 'check-label'); lock.innerHTML = '<input name="locked" type="checkbox">Lås økten mot omplanlegging'; form.querySelector('.form-grid').append(lock)
  const fields = ['dateLocal', 'startTime', 'endTime', 'endDateLocal', 'taskId']
  let windowEditing = null, windowSignature = '', taskSignature = ''
  const windowHost = element('section', 'work-windows')
  windowHost.innerHTML = `<h3>Arbeidstid og opptatt tid</h3><p class="muted">Registrer faktiske tidsrom i norsk tid, også over midnatt. Overlapp telles én gang. Uten arbeidstid er kapasiteten ukjent.</p><form class="work-window-form"><label>Type<select name="kind"><option value="work">Tilgjengelig arbeidstid</option><option value="busy">Opptatt tid</option></select></label><label>Navn (valgfritt)<input name="label"></label><label>Start (norsk tid)<input name="startLocal" type="datetime-local" required></label><label>Slutt (norsk tid)<input name="endLocal" type="datetime-local" required></label><div class="actions wide"><button type="submit">Lagre tidsrom</button><button type="button" class="secondary">Avbryt</button></div><p class="wide" role="alert"></p></form><div class="work-window-list"></div>`
  $('#capacity-summary').before(windowHost)
  const windowForm = windowHost.querySelector('form'), windowList = windowHost.querySelector('.work-window-list')
  windowForm.addEventListener('input', () => { windowForm.dataset.dirty = 'true' })
  windowForm.onsubmit = event => {
    event.preventDefault()
    const draft = Object.fromEntries(new FormData(windowForm)), result = actions.saveWindow(draft, draft.kind, windowEditing)
    windowForm.querySelector('[role=alert]').textContent = result.ok ? '' : result.error
    if (result.ok) { windowEditing = null; windowForm.reset(); delete windowForm.dataset.dirty; windowForm.elements.kind.disabled = false }
  }
  windowForm.querySelector('[type=button]').onclick = () => { windowEditing = null; windowForm.reset(); delete windowForm.dataset.dirty; windowForm.querySelector('[role=alert]').textContent = ''; windowForm.elements.kind.disabled = false }
  const sessions = new Map()
  const tasks = new Map()
  let disabled = true
  $('#new-session').addEventListener('click', actions.openSession)
  $('#cancel-session').addEventListener('click', actions.cancelSession)
  form.addEventListener('submit', event => {
    event.preventDefault()
    actions.saveSession({ ...Object.fromEntries(fields.map(name => [name, form.elements[name].value])), locked: form.elements.locked.checked })
  })
  function button(text, action) {
    const node = element('button', 'secondary', text)
    node.type = 'button'
    node.addEventListener('click', action)
    return node
  }
  function errors(error = '') {
    setText($('#session-error'), error)
    for (const field of fields) form.elements[field].setAttribute('aria-invalid', String(Boolean(error)))
    if (error) form.elements.dateLocal.focus()
  }
  function focus(id, action = 'edit') {
    const control = sessions.get(id)?.[action] || $('#new-session')
    if (!control.disabled && !control.closest('[hidden]')) {
      control.focus()
      control.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' })
      return true
    }
    return false
  }
  return {
    form, errors, focus,
    clearMessages() {
      for (const row of sessions.values()) { row.feedback.hidden = true; setText(row.feedback, '') }
    },
    message(id, text) {
      const row = sessions.get(id)
      if (!row) return
      setText(row.feedback, text)
      row.feedback.hidden = false
      row.feedback.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    },
    isOpen: () => !form.hidden,
    open(session) {
      form.reset()
      errors()
      setText($('#session-form-heading'), session ? 'Rediger studieøkt' : 'Ny studieøkt')
      for (const field of fields) form.elements[field].value = session?.[field] || ''
      form.elements.locked.checked = Boolean(session?.locked)
      form.hidden = false
      form.elements.dateLocal.focus()
      form.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    },
    close() { form.hidden = true; form.reset(); errors() },
    disable(value) {
      disabled = value
      $('#new-session').disabled = value
      for (const row of sessions.values()) { row.edit.disabled = value; row.delete.disabled = value; row.close.disabled = value }
      for (const row of tasks.values()) row.edit.disabled = value
    },
    render(model) {
      const { capacity, sessions: savedSessions = [], tasks: savedTasks } = model
      const nextTaskSignature = JSON.stringify(savedTasks.map(task => [task.id, task.title]))
      if (nextTaskSignature !== taskSignature) { taskSignature = nextTaskSignature; const selected = form.elements.taskId.value; form.elements.taskId.replaceChildren(new Option('Ufordelt studieøkt', '')); for (const task of savedTasks) form.elements.taskId.append(new Option(task.title, task.id)); form.elements.taskId.value = selected }
      const nextWindows = JSON.stringify([model.workWindows, model.busyWindows])
      if (nextWindows !== windowSignature) {
        windowSignature = nextWindows; windowList.replaceChildren()
        for (const [kind, values] of [['work', model.workWindows || []], ['busy', model.busyWindows || []]]) for (const value of values) {
          const row = element('div', 'work-window-row'); row.append(element('p', '', `${kind === 'work' ? 'Arbeidstid' : 'Opptatt'}: ${value.label || ''} ${osloLocal(value.start).replace('T', ' ')} - ${osloLocal(value.end).replace('T', ' ')}`))
          row.append(button('Rediger tidsrom', () => { windowEditing = value.id; for (const [key, v] of Object.entries({ kind, label: value.label, startLocal: osloLocal(value.start), endLocal: osloLocal(value.end) })) windowForm.elements[key].value = v || ''; windowForm.elements.startLocal.focus() }), button('Slett tidsrom', () => actions.deleteWindow(value.id, kind))); windowList.append(row)
        }
      }
      setText($('#capacity-summary'), `${capacity.totalRequiredMinutes} min kjent arbeid${capacity.unknownTaskCount ? ` · ${capacity.unknownTaskCount} oppgaver med ukjent arbeidstid` : ''} · ${capacity.totalAllocatedMinutes} min satt av · ${capacity.totalMissingMinutes} min ikke planlagt · ${capacity.spareMinutes} min ledig i øktene.`)
      setText($('#capacity-warnings'), capacity.warnings.join(' '))
      $('#capacity-warnings').hidden = !capacity.warnings.length
      $('#sessions-empty').hidden = savedSessions.length > 0
      $('#capacity-empty').hidden = savedTasks.length > 0
      const sessionIds = new Set(savedSessions.map(session => session.id))
      for (const [id, row] of sessions) if (!sessionIds.has(id)) { row.item.remove(); sessions.delete(id) }
      let position = $('#session-list').firstElementChild
      for (const session of [...savedSessions].sort((a, b) => `${a.dateLocal}T${a.startTime}`.localeCompare(`${b.dateLocal}T${b.startTime}`))) {
        let row = sessions.get(session.id)
        if (!row) {
          const item = element('li', 'session-card')
          item.dataset.sessionId = session.id
          const label = element('p')
          const controls = element('div', 'actions')
          const edit = button('Rediger økt', () => actions.editSession(session.id))
          const remove = button('Slett økt', () => actions.deleteSession(session.id))
          const close = button('Avslutt økt', () => { const saved = sessions.get(session.id)?.value; if (saved?.taskId) actions.closeWork?.(saved.taskId, saved.id) })
          const feedback = element('p', 'task-feedback')
          feedback.setAttribute('role', 'status')
          feedback.hidden = true
          controls.append(edit, close, remove)
          item.append(label, controls, feedback)
          row = { item, label, edit, delete: remove, close, feedback }
          sessions.set(session.id, row)
        }
        row.value = session
        row.close.hidden = !session.taskId || savedTasks.some(task => task.id === session.taskId && task.completed)
        row.close.disabled = disabled
        const label = `Studieøkt ${formatDay(session.dateLocal, { year: true })} kl. ${session.startTime}–${session.endTime}${session.locked ? ' · Låst' : ''}`
        setText(row.label, label)
        row.edit.setAttribute('aria-label', `Rediger ${label.toLowerCase()}`)
        row.delete.setAttribute('aria-label', `Slett ${label.toLowerCase()}`)
        row.edit.disabled = disabled
        row.delete.disabled = disabled
        if (row.item !== position) $('#session-list').insertBefore(row.item, position)
        position = row.item.nextElementSibling
      }
      const taskIds = new Set(savedTasks.map(task => task.id))
      for (const [id, row] of tasks) if (!taskIds.has(id)) { row.item.remove(); tasks.delete(id) }
      position = $('#capacity-task-list').firstElementChild
      for (const planned of capacity.tasks) {
        const task = savedTasks.find(task => task.id === planned.taskId)
        if (!task) continue
        let row = tasks.get(task.id)
        if (!row) {
          const item = element('li', 'capacity-task')
          item.dataset.capacityTask = task.id
          const title = element('h4')
          const deadline = element('p', 'muted')
          const minutes = element('p', 'capacity-minutes')
          const explanation = element('p')
          const allocations = element('p', 'muted')
          const edit = button('Oppdater arbeid', () => actions.edit(task.id))
          item.append(title, deadline, minutes, explanation, allocations, edit)
          row = { item, title, deadline, minutes, explanation, allocations, edit }
          tasks.set(task.id, row)
        }
        setText(row.title, `${task.course} · ${task.title}`)
        setText(row.deadline, `Frist: ${formatDeadline(task.deadlineLocal, { year: true })} · ${taskStatus(task)}`)
        setText(row.minutes, getRemainingMinutes(task) === null ? 'Gjenstående arbeid: ukjent' : `Gjenstående: ${planned.requiredMinutes} min · Satt av: ${planned.allocatedMinutes} min · Ikke planlagt: ${planned.missingMinutes} min`)
        const notice = capacityNotice(task, savedSessions, model.planner?.events || [], model.now)
        setText(row.explanation, task.completed ? 'Arbeidet er ferdig.' : getRemainingMinutes(task) === 0 ? 'Ingen arbeidstid gjenstår. Bekreft om oppgaven er fullført.' : notice && (planned.missingMinutes || !planned.requiredMinutes || notice.tone === 'danger' || notice.tone === 'warning') ? notice.text : planned.reasons?.join(' ') || capacity.planningNote || 'Minuttsummen dekker estimatet. Kontroller øktlengder og pauser i Planlegg uken før du bekrefter en plan.')
        row.explanation.className = ['danger', 'warning'].includes(notice?.tone) ? 'capacity-warning' : 'muted'
        setText(row.allocations, planned.allocations.map(allocation => `${formatDay(allocation.startLocal, { year: true })} kl. ${allocation.startLocal.slice(11, 16)}–${allocation.endLocal.slice(11, 16)}: ${allocation.minutes} min`).join(' · '))
        if (planned.state) {
          const stateLabel = { unknown: 'Ukjent', unplanned: 'Ikke planlagt', planned: 'Planlagt', insufficient: 'Utilstrekkelig kapasitet', done: 'Ferdig', blocked: 'Blokkert' }[planned.state]
          setText(row.explanation, `${stateLabel}. ${planned.reasons.join(' ')}`)
          setText(row.minutes, `${getRemainingMinutes(task) === null ? 'Gjenstående: ukjent' : `Gjenstående: ${planned.requiredMinutes} min`} · Reservert: ${planned.reservedMinutes} min · Forslag inkludert: ${planned.allocatedMinutes} min`)
        }
        row.allocations.hidden = !planned.allocations.length
        row.edit.setAttribute('aria-label', `Oppdater arbeid «${task.title}»`)
        row.edit.disabled = disabled
        if (row.item !== position) $('#capacity-task-list').insertBefore(row.item, position)
        position = row.item.nextElementSibling
      }
    },
  }
}
