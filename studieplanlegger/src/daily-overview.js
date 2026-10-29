import { calendarEntries, calendarToday, dayBounds, timeLabel } from './calendar-model.js'
import { formatDay, taskStatus } from './calendar.js'
import { OSLO, osloLocal } from './planner.js'
import { dailyStatus } from './daily-guidance.js'
import { applyCourseColor, resolvedCourseId } from './course-colors.js'
const pending = task => !task.completed || (task.requiresSubmission && !task.submitted)
const eventClock = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: OSLO })
const compactTime = (entry, date) => {
  const localDate = entry.local?.slice(0, 10) || osloLocal(new Date(entry.start).toISOString()).slice(0, 10)
  const day = localDate === date ? 'i dag' : formatDay(localDate, { year: true })
  if (entry.warning) return day + ' kl. ' + entry.local.slice(11) + ' (må presiseres)'
  if (entry.kind === 'personal' && entry.timingPrecision === 'date') return day + ' · Tid ikke oppgitt'
  if (entry.kind === 'personal' && entry.timingPrecision === 'start') return day + ' kl. ' + eventClock.format(new Date(entry.start)) + ' · Varighet ikke oppgitt'
  if (entry.kind === 'deadline' && entry.allDay) return day + ' · Frist – klokkeslett ikke oppgitt'
  if (entry.allDay) {
    if (entry.point) return day
    const lastDate = osloLocal(new Date(entry.end - 1).toISOString()).slice(0, 10)
    return day + ' · Hele dagen' + (lastDate !== localDate ? ' (til ' + formatDay(lastDate, { year: true }) + ')' : '')
  }
  if (entry.point) return day + ' kl. ' + eventClock.format(new Date(entry.start))
  const endDate = osloLocal(new Date(entry.end).toISOString()).slice(0, 10)
  return day + ' kl. ' + timeLabel(entry) + (endDate !== localDate ? ' (til ' + formatDay(endDate, { year: true }) + ')' : '')
}
export function dailyOverview(model) {
  const now = +model.now, date = calendarToday(model.now), bounds = dayBounds(date), entries = calendarEntries(model)
  const activity = entries.filter(e => !e.cancelled && ['teaching', 'personal', 'session'].includes(e.kind) && (e.end > now || e.point && (e.start >= now || e.kind === 'personal' && e.dateLocal >= date))).sort((a, b) => a.start - b.start || a.key.localeCompare(b.key))[0]
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
  const grid = document.createElement('div'); grid.className = 'ajour-plan-grid'; document.querySelector('#focus-panel').after(grid)
  const host = document.createElement('section'); host.id = 'daily-overview'; host.className = 'daily-overview panel'; host.setAttribute('aria-label', 'Status i dag')
  const planHost = document.createElement('section'); planHost.id = 'next-plan'; planHost.className = 'daily-overview panel next-plan'; planHost.setAttribute('aria-label', 'Neste på planen'); grid.append(planHost, host)
  const el = (tag, text) => { const node = document.createElement(tag); node.textContent = text; return node }
  const button = (text, key, fn) => { const node = el('button', text); node.type = 'button'; node.className = 'secondary'; node.dataset.dailyKey = key; node.onclick = fn; return node }
  let signature = '', statusTask
  // Keep the opener node alive while model.editing changes during a dialog.
  const replanControl = button('Se forslag til ny tid', 'status:replan', () => !statusTask ? actions.open() : statusTask.completed ? actions.summary('ready') : actions.replan(statusTask.id))
  return { render(model) {
    grid.hidden = host.hidden = planHost.hidden = model.view !== 'overview' || !model.readable || !(model.tasks.length || model.sessions?.length || model.planner?.courses?.length || model.planner?.events?.length); if (host.hidden) return
    const date = calendarToday(model.now), data = dailyOverview(model), entries = calendarEntries(model), status = dailyStatus(model), next = JSON.stringify([date, data, entries, status, model.planner?.courses, model.capacity, model.editing, data.activity && data.activity.start <= +model.now, data.rows.map(row => row.sessions.map(s => [s.start <= +model.now, s.end <= +model.now]))]); if (signature === next) return; signature = next
    const focused = host.contains(document.activeElement) || planHost.contains(document.activeElement) ? document.activeElement.dataset.dailyKey : null
    const opened = new Set([...planHost.querySelectorAll('details[open]')].map(node => node.dataset.dailyMenu))
    const companion = document.createElement('img'); companion.src = '/brand/notebook.svg'; companion.alt = ''; companion.width = companion.height = 44
    host.replaceChildren(companion, el('h2', 'Planen skal passe deg.'), el('p', 'Mistet en økt? Se over et forslag til endring før noe flyttes.'))
    const statusCard = el('div', ''); statusCard.className = `daily-status is-${status.tone}`; statusCard.setAttribute('role', 'status'); statusCard.append(el('p', status.text.includes(status.title) ? status.text : `${status.title}: ${status.text}`))
    statusTask = model.tasks.find(task => task.id === status.taskId)
    replanControl.textContent = !statusTask ? 'Legg til oppgave' : statusTask.completed ? 'Se oppgaver til levering' : status.tone === 'danger' ? 'Se realistisk forslag' : 'Se forslag til ny tid'
    host.append(statusCard, replanControl, el('p', 'Ingenting endres uten at du godkjenner.'))
    planHost.replaceChildren(el('h2', 'Neste på planen'))
    const visibleRows = data.rows.slice(0, 3), firstToday = data.rows.find(row => data.today.some(task => task.id === row.task.id))
    if (firstToday && !visibleRows.includes(firstToday)) visibleRows[Math.max(0, visibleRows.length - 1)] = firstToday
    const upcoming = entries.filter(entry => !entry.cancelled && ['teaching', 'personal', 'session'].includes(entry.kind) && (entry.end > +model.now || entry.point && (entry.start >= +model.now || entry.kind === 'personal' && entry.dateLocal >= date))).sort((a, b) => a.start - b.start || a.key.localeCompare(b.key)).slice(0, 3)
    const upcomingKeys = new Set(upcoming.map(entry => entry.key))
    if (upcoming.length) {
      planHost.append(el('h3', 'Kommende aktiviteter'))
      for (const entry of upcoming) {
        const row = el('div', ''); row.className = `daily-row${entry.isExam ? ' is-exam' : ''}${entry.kind === 'personal' ? ' is-personal' : ''}`; row.dataset.dailyRow = entry.key
        applyCourseColor(row, resolvedCourseId(entry))
        const course = model.planner?.courses?.find(item => item.id === entry.courseId)
        const context = [course ? [course.code, course.name].filter(Boolean).join(' ') : entry.courseCode || entry.course, entry.location].filter(Boolean)
        const sessionStatus = entry.kind === 'session' ? entry.start <= +model.now ? 'Pågår nå · ' : entry.key === data.activity?.key ? 'Neste aktivitet · ' : '' : ''
        const open = button('Åpne', `${entry.key}:open`, () => entry.kind === 'session' ? actions.editSession(entry.id) : actions.editEvent(entry.id)); open.setAttribute('aria-label', `Åpne ${entry.title} · ${compactTime(entry, date)}`)
        row.append(el('p', `${sessionStatus}${entry.kind === 'personal' ? 'Egen aktivitet · ' : entry.isExam ? '📝 Eksamen · ' : ''}${entry.title} · ${compactTime(entry, date)}${context.length ? ` · ${context.join(' · ')}` : ''}`), open); planHost.append(row)
      }
    } else if (!data.activity) planHost.append(el('p', 'Ingen kommende aktivitet er registrert.'))
    if (visibleRows.length) planHost.append(el('h3', 'Oppgaver å følge opp'))
    for (const { task, key, deadline, sessions } of visibleRows) {
      const row = el('article', ''); row.className = 'daily-row daily-task'; row.dataset.dailyRow = key
      applyCourseColor(row, resolvedCourseId(task))
      const copy = el('div', ''); copy.className = 'daily-task-copy'; copy.append(el('h4', task.title))
      const course = model.planner?.courses?.find(c => c.id === task.courseId)
      copy.append(el('p', `${course ? `${course.code} ${course.name}` : task.course || 'Emne ikke oppgitt'} · ${taskStatus(task)}`))
      if (deadline) {
        const deadlineLabel = compactTime(deadline, date)
        const deadlineStatus = deadline.start < +model.now && pending(task) ? 'Forfalt frist' : 'Frist'
        copy.append(el('p', `${deadlineStatus} ${deadlineLabel}${deadline.warning ? ` · ${deadline.warning}` : ''}`))
      }
      for (const session of sessions) {
        if (upcomingKeys.has(session.key)) continue
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
      row.append(copy, actionsRow); planHost.append(row)
    }
    const shownTaskIds = new Set(visibleRows.map(row => row.task.id))
    const deadlines = entries.filter(entry => entry.kind === 'deadline' && !entry.done && entry.start >= +model.now && !shownTaskIds.has(entry.id)).sort((a, b) => (a.local || '').localeCompare(b.local || '')).slice(0, 2)
    if (deadlines.length) planHost.append(el('h3', 'Kommende frister'))
    else if (!visibleRows.some(row => row.deadline?.start >= +model.now)) planHost.append(el('p', 'Ingen kommende frister er registrert.'))
    for (const entry of deadlines) { const row = el('div', ''); row.className = 'daily-row deadline-row'; applyCourseColor(row, resolvedCourseId(entry)); const open = button('Åpne', `deadline:${entry.id}:open`, () => actions.edit(entry.id)); open.setAttribute('aria-label', `Åpne fristen for ${entry.title}`); row.append(el('p', `${entry.title} · ${compactTime(entry, date)}`), open); planHost.append(row) }
    const controls = el('div', ''); controls.className = 'actions'; controls.append(button('Åpne kalender', 'navigation:calendar', () => actions.view('calendar')), button('Se alle oppgaver', 'navigation:tasks', () => actions.view('all'))); planHost.append(controls)
    for (const control of [...host.querySelectorAll('button'), ...planHost.querySelectorAll('button')]) control.disabled = Boolean(model.editing)
    if (focused) {
      const replacement = [...document.querySelectorAll('#daily-overview [data-daily-key], #next-plan [data-daily-key]')].find(node => node.dataset.dailyKey === focused && !node.disabled) || host.querySelector('button:not(:disabled)') || planHost.querySelector('button:not(:disabled)')
      if (replacement) { const menu = replacement.closest('details'); if (menu) menu.open = true; replacement.focus({ preventScroll: true }) }
    }
  } }
}
