import { osloLocal, matchesCourse } from './planner.js'
import { extendedSessionInterval } from './work-capacity.js'

// One data source for the compact agenda, independent of the selected month.
export function upcomingAgenda({ tasks = [], sessions = [], planner = {}, courseFilter = '', now = new Date() }) {
  const localNow = osloLocal(now.toISOString())
  const courses = planner.courses || []
  const course = courses.find(item => item.id === courseFilter)
  const entries = []
  for (const event of planner.events || []) {
    if (event.cancelled || event.deleted || Date.parse(event.end) <= +now || (courseFilter && event.courseId !== courseFilter)) continue
    const start = osloLocal(event.start), end = osloLocal(event.end)
    const subject = courses.find(item => item.id === event.courseId)
    entries.push({ key: `event:${event.id}`, id: event.id, kind: 'teaching', title: event.title,
      date: start.slice(0, 10), time: event.allDay ? '' : start.slice(11), endTime: event.allDay ? '' : end.slice(11),
      endDate: end.slice(0, 10), ongoing: Date.parse(event.start) <= +now,
      course: subject?.code || subject?.name || '', location: event.location || '', allDay: !!event.allDay })
  }
  for (const task of tasks) {
    if (!task.deadlineLocal || task.submitted || (task.completed && !task.requiresSubmission) || task.deadlineLocal < localNow) continue
    if (!matchesCourse(task, courseFilter, course)) continue
    entries.push({ key: `task:${task.id}`, id: task.id, kind: 'deadline', title: task.title,
      date: task.deadlineLocal.slice(0, 10), time: task.deadlineLocal.slice(11), course: task.course,
      ready: !!task.completed })
  }
  for (const session of sessions) {
    const task = tasks.find(item => item.id === session.taskId)
    if (!matchesCourse(task, courseFilter, course)) continue
    try {
      const interval = extendedSessionInterval(session)
      if (interval.end <= +now) continue
      const start = osloLocal(new Date(interval.start).toISOString()), end = osloLocal(new Date(interval.end).toISOString())
      const subject = courses.find(item => item.id === task?.courseId)
      entries.push({ key: `session:${session.id}`, id: session.id, kind: 'session', title: task ? `Studieøkt: ${task.title}` : 'Studieøkt',
        date: start.slice(0, 10), time: start.slice(11), endTime: end.slice(11), endDate: end.slice(0, 10),
        ongoing: interval.start <= +now, course: subject?.code || subject?.name || task?.course || 'Avsatt studietid' })
    } catch { /* Invalid legacy sessions remain available for repair in the editor. */ }
  }
  return entries.sort((a, b) => Number(!!b.ongoing) - Number(!!a.ongoing) ||
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`) || a.key.localeCompare(b.key))
}

const node = (tag, className, value) => {
  const element = document.createElement(tag)
  element.className = className
  if (value) element.textContent = value
  return element
}
const labels = { teaching: 'Undervisning', deadline: 'Frist', session: 'Studieøkt' }

export function createAgenda(host, actions) {
  let signature = '', expanded = false, currentModel
  function render(model) {
    currentModel = model
    const entries = upcomingAgenda(model)
    // Native modal dialogs make the background inert. Do not persist their
    // transient state in the agenda between controller renders.
    const disabled = !model.readable
    const nextSignature = JSON.stringify([entries, expanded, disabled, model.courseFilter])
    if (signature === nextSignature) return
    signature = nextSignature
    const focusKey = host.contains(document.activeElement) ? document.activeElement.dataset.agendaKey : null
    const list = node('ul', 'compact-agenda-list')
    host.replaceChildren(node('p', 'agenda-section-label', 'Det neste på planen'), list)
    for (const entry of expanded ? entries : entries.slice(0, 5)) {
      const li = node('li', `compact-agenda-item kind-${entry.kind}`)
      const button = node('button', 'agenda-entry')
      button.type = 'button'
      button.disabled = disabled
      button.dataset.agendaKey = entry.key
      button.addEventListener('click', () => {
        if (entry.kind === 'teaching') actions.editEvent(entry.id)
        else if (entry.kind === 'session') actions.editSession(entry.id)
        else actions.edit(entry.id)
      })
      const stamp = node('span', 'agenda-date-stamp')
      const date = new Date(`${entry.date}T12:00:00`)
      stamp.append(node('strong', '', entry.date.slice(-2)), node('span', '', new Intl.DateTimeFormat('nb-NO', { month: 'short' }).format(date).replace('.', '')))
      const content = node('span', 'agenda-item-content')
      const meta = node('span', 'agenda-item-meta')
      const time = entry.allDay ? 'Hele dagen' : `kl. ${entry.time}${entry.endTime ? `–${entry.endDate && entry.endDate !== entry.date ? `${entry.endDate} kl. ` : ''}${entry.endTime}` : ''}`
      meta.append(node('span', 'agenda-kind', labels[entry.kind]), node('span', '', entry.ongoing ? `Pågår · ${time}` : time))
      const detail = [entry.course, entry.location, entry.ready ? 'Klar til levering' : ''].filter(Boolean).join(' · ')
      content.append(meta, node('span', 'agenda-item-title', entry.title), node('span', 'agenda-item-details', detail))
      button.setAttribute('aria-label', `${entry.title}, ${entry.date}, ${time}${detail ? `, ${detail}` : ''}`)
      button.append(stamp, content)
      li.append(button)
      list.append(li)
    }
    if (!entries.length) {
      const empty = node('div', 'agenda-empty')
      empty.append(node('strong', '', model.courseFilter ? 'Ingen kommende hendelser i emnet' : 'Luft i kalenderen'),
        node('p', '', 'Undervisning, studieøkter og frister vises her når du legger dem til.'))
      const add = node('button', 'text-button', 'Legg til en studieøkt')
      add.type = 'button'; add.disabled = disabled
      add.addEventListener('click', actions.openSession)
      empty.append(add); host.append(empty)
    }
    if (entries.length > 5) {
      const more = node('button', 'text-button agenda-more', expanded ? 'Vis færre' : `Vis alle ${entries.length} hendelser`)
      more.type = 'button'; more.dataset.agendaKey = 'more'
      more.setAttribute('aria-expanded', String(expanded))
      more.addEventListener('click', () => { expanded = !expanded; render(currentModel); host.querySelector('.agenda-more')?.focus({ preventScroll: true }) })
      host.append(more)
    }
    if (focusKey) [...host.querySelectorAll('button')].find(button => button.dataset.agendaKey === focusKey)?.focus({ preventScroll: true })
  }
  return { render }
}
