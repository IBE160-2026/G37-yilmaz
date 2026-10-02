import { osloLocal, matchesCourse } from './planner.js'
import { extendedSessionInterval } from './work-capacity.js'
import { courseColor } from './calendar.js'
import { isExamEvent } from './event-kind.js'
import { deadlineInstant } from './tasks.js'

// One data source for the compact agenda, independent of the selected month.
export function upcomingAgenda({ tasks = [], sessions = [], planner = {}, courseFilter = '', now = new Date() }) {
  const courses = planner.courses || []
  const today = osloLocal(now.toISOString()).slice(0, 10)
  const course = courses.find(item => item.id === courseFilter)
  const entries = []
  for (const event of planner.events || []) {
    const personal = event.activityKind === 'personal'
    const sortTime = event.start ? Date.parse(event.start) : personal ? Date.parse(`${event.dateLocal}T12:00:00Z`) : NaN
    const expired = event.end ? Date.parse(event.end) <= +now : personal ? event.dateLocal < today : sortTime <= +now
    if (event.cancelled || event.deleted || expired || (courseFilter && event.courseId !== courseFilter)) continue
    const start = event.start ? osloLocal(event.start) : `${event.dateLocal}T`, end = event.end ? osloLocal(event.end) : ''
    const subject = courses.find(item => item.id === event.courseId)
    entries.push({ key: `event:${event.id}`, id: event.id, kind: personal ? 'personal' : 'teaching', isExam: isExamEvent(event), title: event.title, sortTime,
      date: start.slice(0, 10), time: personal && !event.start || event.allDay ? '' : start.slice(11), endTime: event.end ? end.slice(11) : '',
      endDate: event.end ? end.slice(0, 10) : '', ongoing: Boolean(event.start && event.end && Date.parse(event.start) <= +now),
      course: subject?.code || subject?.name || '', location: event.location || '', allDay: !!event.allDay })
  }
  for (const task of tasks) {
    let deadline
    try { deadline = task.deadlineLocal ? deadlineInstant(task.deadlineLocal) : NaN } catch { continue }
    if (!task.deadlineLocal || task.submitted || (task.completed && !task.requiresSubmission) || deadline <= +now) continue
    if (!matchesCourse(task, courseFilter, course)) continue
    const subject = courses.find(item => item.id === task.courseId)
    entries.push({ key: `task:${task.id}`, id: task.id, kind: 'deadline', title: task.title, sortTime: deadline,
      date: task.deadlineLocal.slice(0, 10), time: task.deadlineLocal.slice(11), allDay: task.deadlineLocal.length === 10, course: subject?.code || task.course,
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
      entries.push({ key: `session:${session.id}`, id: session.id, kind: 'session', title: task ? `Studieøkt: ${task.title}` : 'Studieøkt', sortTime: interval.start,
        date: start.slice(0, 10), time: start.slice(11), endTime: end.slice(11), endDate: end.slice(0, 10),
        ongoing: interval.start <= +now, course: subject?.code || subject?.name || task?.course || 'Avsatt studietid' })
    } catch { /* Invalid legacy sessions remain available for repair in the editor. */ }
  }
  return entries.sort((a, b) => Number(!!b.ongoing) - Number(!!a.ongoing) ||
    a.sortTime - b.sortTime || a.key.localeCompare(b.key))
}

const node = (tag, className, value) => {
  const element = document.createElement(tag)
  element.className = className
  if (value) element.textContent = value
  return element
}
const labels = { teaching: 'Undervisning', personal: 'Egen aktivitet', deadline: 'Frist', session: 'Studieøkt' }

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
      const li = node('li', `compact-agenda-item kind-${entry.kind}${entry.isExam ? ' is-exam' : ''}`)
      const button = node('button', 'agenda-entry')
      if (entry.course) button.style.setProperty('--course-color', courseColor(entry.course))
      button.type = 'button'
      button.disabled = disabled
      button.dataset.agendaKey = entry.key
      button.addEventListener('click', () => {
        if (['teaching', 'personal'].includes(entry.kind)) actions.editEvent(entry.id)
        else if (entry.kind === 'session') actions.editSession(entry.id)
        else actions.edit(entry.id)
      })
      const stamp = node('span', 'agenda-date-stamp')
      const date = new Date(`${entry.date}T12:00:00`)
      stamp.append(node('strong', '', entry.date.slice(-2)), node('span', '', new Intl.DateTimeFormat('nb-NO', { month: 'short' }).format(date).replace('.', '')))
      const content = node('span', 'agenda-item-content')
      const meta = node('span', 'agenda-item-meta')
      const time = entry.kind === 'deadline' && entry.allDay ? 'Frist – klokkeslett ikke oppgitt' : entry.kind === 'personal' && !entry.time ? 'Tid ikke oppgitt' : entry.kind === 'personal' && !entry.endTime ? `kl. ${entry.time} · Varighet ikke oppgitt` : entry.allDay ? 'Hele dagen' : `kl. ${entry.time}${entry.endTime ? `–${entry.endDate && entry.endDate !== entry.date ? `${entry.endDate} kl. ` : ''}${entry.endTime}` : ''}`
      meta.append(node('span', 'agenda-kind', entry.isExam ? '📝 Eksamen' : labels[entry.kind]), node('span', '', entry.ongoing ? `Pågår · ${time}` : time))
      const detail = [entry.course, entry.location, entry.ready ? 'Klar til levering' : ''].filter(Boolean).join(' · ')
      const title = entry.course && !entry.title.toLocaleUpperCase('nb').startsWith(entry.course.toLocaleUpperCase('nb')) ? `${entry.course} · ${entry.title}` : entry.title
      content.append(meta, node('span', 'agenda-item-title', title), node('span', 'agenda-item-details', detail))
      button.setAttribute('aria-label', `${entry.isExam ? 'Eksamen, ' : ''}${entry.title}, ${entry.date}, ${time}${detail ? `, ${detail}` : ''}`)
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
