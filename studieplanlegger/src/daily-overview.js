import { calendarEntries, calendarToday, dayBounds, timeLabel } from './calendar-model.js'
import { formatDay, taskStatus } from './calendar.js'
import { OSLO, osloLocal } from './planner.js'
const pending = task => !task.completed || (task.requiresSubmission && !task.submitted)
const eventClock = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: OSLO })
const compactTime = (entry, date) => {
  const localDate = entry.local?.slice(0, 10) || osloLocal(new Date(entry.start).toISOString()).slice(0, 10)
  const day = localDate === date ? 'i dag' : formatDay(localDate, { year: true })
  if (entry.warning) return day + ' kl. ' + entry.local.slice(11) + ' (må presiseres)'
  if (entry.point) return day + ' kl. ' + eventClock.format(new Date(entry.start))
  if (entry.allDay) {
    const lastDate = osloLocal(new Date(entry.end - 1).toISOString()).slice(0, 10)
    return day + ' · Hele dagen' + (lastDate !== localDate ? ' (til ' + formatDay(lastDate, { year: true }) + ')' : '')
  }
  const endDate = osloLocal(new Date(entry.end).toISOString()).slice(0, 10)
  return day + ' kl. ' + timeLabel(entry) + (endDate !== localDate ? ' (til ' + formatDay(endDate, { year: true }) + ')' : '')
}
export function dailyOverview(model) {
  const now = +model.now, date = calendarToday(model.now), bounds = dayBounds(date), entries = calendarEntries(model)
  const activity = entries.filter(e => !e.cancelled && ['teaching', 'session'].includes(e.kind) && e.end > now).sort((a, b) => a.start - b.start || a.key.localeCompare(b.key))[0]
  const deadlines = entries.filter(e => e.kind === 'deadline' && !e.done).sort((a, b) => (a.local || '').localeCompare(b.local || '') || a.key.localeCompare(b.key))
  const today = model.tasks.filter(task => pending(task) && (task.deadlineLocal?.slice(0, 10) === date || entries.some(e => e.kind === 'session' && e.taskId === task.id && e.start < bounds.end && e.end > bounds.start)))
  const deadline = deadlines.find(e => e.start >= now) || deadlines.at(-1)
  const relevant = new Set([...today.map(t => t.id), ...deadlines.filter(e => e.start < now).map(e => e.id), deadline?.id, activity?.kind === 'session' ? activity.taskId : null].filter(Boolean))
  const rows = model.tasks.filter(task => relevant.has(task.id)).map(task => ({
    task, key: `task:${task.id}`, deadline: entries.find(e => e.kind === 'deadline' && e.id === task.id),
    sessions: entries.filter(e => e.kind === 'session' && e.taskId === task.id && (e.start < bounds.end && e.end > bounds.start || e.key === activity?.key)).sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id)),
  }))
  const nextTime = row => Math.min(
    pending(row.task) && Number.isFinite(row.deadline?.start) ? row.deadline.start : Infinity,
    ...row.sessions.filter(session => session.end > now).map(session => Math.max(now, session.start)),
  )
  rows.sort((a, b) => { const first = nextTime(a), second = nextTime(b); return (first === second ? 0 : first - second) || a.task.id.localeCompare(b.task.id) })
  return { activity, deadline, overdue: deadlines.filter(e => e.start < now), today, rows }
}
export function createDailyOverview(actions) {
  const host = document.createElement('section'); host.id = 'daily-overview'; host.className = 'daily-overview panel'; host.setAttribute('aria-label', 'Dagen din'); document.querySelector('.work-area').prepend(host)
  const el = (tag, text) => { const node = document.createElement(tag); node.textContent = text; return node }
  const button = (text, key, fn) => { const node = el('button', text); node.type = 'button'; node.className = 'secondary'; node.dataset.dailyKey = key; node.onclick = fn; return node }
  let signature = ''
  return { render(model) {
    host.hidden = model.view !== 'overview' || !model.readable || !(model.tasks.length || model.sessions?.length || model.planner?.courses?.length || model.planner?.events?.length); if (host.hidden) return
    const date = calendarToday(model.now), data = dailyOverview(model), next = JSON.stringify([date, data, model.editing, data.activity && data.activity.start <= +model.now, data.rows.map(row => row.sessions.map(s => [s.start <= +model.now, s.end <= +model.now]))]); if (signature === next) return; signature = next
    const focused = host.contains(document.activeElement) ? document.activeElement.dataset.dailyKey : null
    const opened = new Set([...host.querySelectorAll('details[open]')].map(node => node.dataset.dailyMenu))
    host.replaceChildren(el('h2', 'Dagen din'))
    const activityInTask = data.activity?.kind === 'session' && data.rows.some(row => row.task.id === data.activity.taskId)
    if (data.activity && !activityInTask) {
      const entry = data.activity, row = el('div', ''); row.className = 'daily-row'; row.dataset.dailyRow = entry.key
      row.append(el('p', `${entry.start <= +model.now ? 'Pågår nå' : 'Neste aktivitet'}: ${entry.title} · ${compactTime(entry, date)}`), button('Åpne aktivitet', `${entry.key}:open`, () => entry.kind === 'session' ? actions.editSession(entry.id) : actions.editEvent(entry.id))); host.append(row)
    } else if (!data.activity) host.append(el('p', 'Ingen kommende aktivitet er registrert.'))
    if (data.overdue.length) host.append(button(`${data.overdue.length} forfalte frister`, 'summary:overdue', () => actions.summary('overdue')))
    host.append(el('h3', 'Oppgaver og frister'))
    if (!data.today.length) host.append(el('p', 'Ingen oppgaver har frist eller reservert studietid i dag.'))
    for (const { task, key, deadline, sessions } of data.rows) {
      const row = el('article', ''); row.className = 'daily-row daily-task'; row.dataset.dailyRow = key
      const copy = el('div', ''); copy.className = 'daily-task-copy'; copy.append(el('h4', task.title))
      const course = model.planner?.courses?.find(c => c.id === task.courseId)
      copy.append(el('p', `${course ? `${course.code} ${course.name}` : task.course || 'Emne ikke oppgitt'} · ${taskStatus(task)}`))
      if (deadline) {
        const deadlineLabel = compactTime(deadline, date)
        const deadlineStatus = deadline.start < +model.now && pending(task) ? 'Forfalt frist' : 'Frist'
        copy.append(el('p', `${deadlineStatus} ${deadlineLabel}${deadline.warning ? ` · ${deadline.warning}` : ''}`))
      }
      for (const session of sessions) {
        const sessionStatus = session.end <= +model.now ? 'Avsluttet studieøkt' : session.start <= +model.now ? 'Pågår nå' : session.key === data.activity?.key ? 'Neste aktivitet' : 'Studieøkt'
        copy.append(el('p', `${sessionStatus}: ${compactTime(session, date)}`))
      }
      const primary = task.completed && task.requiresSubmission && !task.submitted ? button('Bekreft levering', `${key}:primary`, () => actions.submit(task.id)) : pending(task) ? button('Marker arbeid ferdig', `${key}:primary`, () => actions.complete(task.id, true)) : button('Åpne oppgave', `${key}:primary`, () => actions.edit(task.id))
      const menu = el('details', ''); menu.className = 'daily-menu'; menu.dataset.dailyMenu = key; menu.open = opened.has(key)
      const summary = el('summary', 'Flere handlinger'); summary.dataset.dailyKey = `${key}:menu`; summary.setAttribute('aria-label', `Flere handlinger for ${task.title}`); menu.append(summary)
      menu.append(button('Åpne oppgave og frist', `${key}:edit`, () => actions.edit(task.id)))
      if (!task.completed && actions.closeWork) menu.append(button('Registrer arbeid', `${key}:work`, () => actions.closeWork(task.id)))
      for (const session of sessions) menu.append(button(`Rediger studieøkt ${timeLabel(session)}`, `session:${session.id}:edit`, () => actions.editSession(session.id)))
      if (!task.completed && actions.closeWork) for (const session of sessions) menu.append(button(`Avslutt økt ${timeLabel(session)}`, `session:${session.id}:close`, () => actions.closeWork(task.id, session.id)))
      menu.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); menu.open = false; summary.focus() } })
      const actionsRow = el('div', ''); actionsRow.className = 'daily-task-actions'; actionsRow.append(primary, menu)
      row.append(copy, actionsRow); host.append(row)
    }
    const controls = el('div', ''); controls.className = 'actions'; controls.append(button('Åpne kalender', 'navigation:calendar', () => actions.view('calendar')), button('Legg til oppgave', 'task:new', actions.open)); if (actions.replan) controls.append(button('Jeg ligger etter', 'plan:recover', actions.replan)); host.append(controls)
    for (const control of host.querySelectorAll('button')) control.disabled = Boolean(model.editing)
    if (focused) {
      const replacement = [...host.querySelectorAll('[data-daily-key]')].find(node => node.dataset.dailyKey === focused && !node.disabled) || host.querySelector('button:not(:disabled)')
      if (replacement) { const menu = replacement.closest('details'); if (menu) menu.open = true; replacement.focus({ preventScroll: true }) }
    }
  } }
}
