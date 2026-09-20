import { createTeachingLayer } from './teaching-calendar.js'
import { isOverdue, sortedTasks } from './tasks.js'

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const COURSE_COLORS = ['#7963c6', '#367f73', '#b56c3f', '#4879ae', '#a35786', '#7c8135', '#b45858', '#557c89']
const pad = value => String(value).padStart(2, '0')

// Local noon is used only for calendar arithmetic. A deadline's stored clock
// text is never parsed as an instant, converted to UTC, or reformatted as AM/PM.
function localDate(year, month, day = 1) {
  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month, day)
  return date
}

function dateParts(label) { return label.split('T')[0].split('-').map(Number) }

export function dateKey(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function monthLabel(year, month) {
  const name = MONTHS[month]
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`
}

export function formatDay(label, { weekday = false, year = false } = {}) {
  const [yearNumber, month, day] = dateParts(label)
  const dayName = weekday ? `${WEEKDAYS[localDate(yearNumber, month - 1, day).getDay()]} ` : ''
  return `${dayName}${day}. ${MONTHS[month - 1]}${year ? ` ${yearNumber}` : ''}`
}

export function formatDeadline(localLabel, options) {
  if (!localLabel) return 'Ingen frist'
  return `${formatDay(localLabel, options)} kl. ${localLabel.slice(11, 16)}`
}

export function monthGrid(year, month) {
  const first = localDate(year, month)
  const mondayOffset = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = localDate(year, month, index + 1 - mondayOffset)
    return { date: dateKey(date), day: date.getDate(), inMonth: date.getFullYear() === year && date.getMonth() === month }
  })
}

export function tasksForMonth(tasks, year, month) {
  const prefix = `${String(year).padStart(4, '0')}-${pad(month + 1)}-`
  return sortedTasks(tasks.filter(task => (task.deadlineLocal || '').startsWith(prefix)))
}

export function tasksForDay(tasks, date) {
  return sortedTasks(tasks.filter(task => (task.deadlineLocal || '').slice(0, 10) === date))
}

function sortedSessions(sessions) {
  return sessions.map((session, index) => ({ session, index })).sort((a, b) =>
    a.session.dateLocal.localeCompare(b.session.dateLocal) ||
    a.session.startTime.localeCompare(b.session.startTime) || a.index - b.index).map(entry => entry.session)
}

export function sessionsForMonth(sessions, year, month) {
  const prefix = `${String(year).padStart(4, '0')}-${pad(month + 1)}-`
  return sortedSessions(sessions.filter(session => session.dateLocal.startsWith(prefix)))
}

export function sessionsForDay(sessions, date) {
  return sortedSessions(sessions.filter(session => session.dateLocal === date))
}

export function taskStatus(task) {
  if (task.submitted) return 'Levert (bekreftet manuelt)'
  if (task.completed) return task.requiresSubmission ? 'Klar til levering' : 'Fullført'
  return 'Ikke fullført'
}

export function courseColor(course) {
  let hash = 0
  for (const letter of String(course).trim().toUpperCase()) hash = (Math.imul(hash, 31) + letter.codePointAt(0)) >>> 0
  return COURSE_COLORS[hash % COURSE_COLORS.length]
}

function createDeadlineCalendar(host, { edit, editSession }) {
  const document = host.ownerDocument
  const browser = document.defaultView
  const headingId = `${host.id || 'study-calendar'}-month-heading`
  const dayHeadingId = `${host.id || 'study-calendar'}-day-heading`
  let period = null
  let selectedDate = null
  let mode = browser.matchMedia('(max-width: 700px)').matches ? 'agenda' : 'month'
  let snapshot = { tasks: [], sessions: [], now: new Date(), disabled: true }
  let monthTransition = null
  const days = new Map()
  const groups = new Map()

  function element(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }
  function setText(node, text) { if (node.textContent !== text) node.textContent = text }
  function button(text, className, handler) {
    const node = element('button', className, text)
    node.type = 'button'
    node.addEventListener('click', handler)
    return node
  }

  const toolbar = element('div', 'calendar-toolbar')
  const navigation = element('div', 'calendar-navigation')
  const previous = button('‹', 'calendar-nav-button secondary', () => shiftMonth(-1))
  previous.setAttribute('aria-label', 'Forrige måned')
  const heading = element('h3', 'calendar-month-heading')
  heading.id = headingId
  heading.setAttribute('aria-live', 'polite')
  const next = button('›', 'calendar-nav-button secondary', () => shiftMonth(1))
  next.setAttribute('aria-label', 'Neste måned')
  navigation.append(previous, heading, next)
  const today = button('I dag', 'calendar-today-button secondary', () => selectDate(dateKey(snapshot.now)))
  const modes = element('div', 'calendar-mode')
  modes.setAttribute('role', 'group')
  modes.setAttribute('aria-label', 'Kalendervisning')
  const monthMode = button('Månedsvisning', 'secondary', () => setMode('month'))
  const agendaMode = button('Agenda', 'secondary', () => setMode('agenda'))
  modes.append(monthMode, agendaMode)
  toolbar.append(navigation, today, modes)
  const legend = element('div', 'calendar-legend')
  legend.append(element('span', 'calendar-deadline-kind', 'Frist · F'),
    element('span', 'calendar-session-kind', 'Studieøkt · Ø'))

  const monthView = element('div', 'calendar-month-view')
  const weekdays = element('div', 'calendar-weekdays')
  weekdays.setAttribute('aria-hidden', 'true')
  for (const name of ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']) weekdays.append(element('span', '', name))
  const grid = element('div', 'calendar-grid')
  grid.setAttribute('role', 'group')
  grid.setAttribute('aria-labelledby', headingId)
  grid.setAttribute('aria-describedby', `${headingId}-help`)
  const help = element('p', 'calendar-keyboard-help', 'Velg en dag for å se frister og studieøkter. Bruk piltastene for å flytte mellom dager.')
  help.id = `${headingId}-help`
  const dayList = element('section', 'calendar-day-list')
  dayList.setAttribute('aria-labelledby', dayHeadingId)
  const selectedHeading = element('h3', 'calendar-day-heading')
  selectedHeading.id = dayHeadingId
  const daySummary = element('p', 'calendar-day-summary')
  const selectedTasks = element('ul', 'calendar-task-list')
  const selectedSessions = element('ul', 'calendar-task-list calendar-session-list')
  const dayEmpty = element('p', 'calendar-empty', 'Ingen frister denne dagen.')
  dayList.append(selectedHeading, daySummary, selectedSessions, selectedTasks, dayEmpty)
  monthView.append(weekdays, grid, help, dayList)

  const agenda = element('div', 'calendar-agenda')
  agenda.setAttribute('role', 'region')
  agenda.setAttribute('aria-label', 'Frister og studieøkter i måneden')
  const agendaEmpty = element('p', 'calendar-empty')
  agenda.append(agendaEmpty)
  host.append(toolbar, legend, monthView, agenda)
  function setMode(nextMode) {
    if (mode === nextMode) return
    mode = nextMode
    draw()
  }

  function taskListRenderer(list) {
    const cards = new Map()
    return function renderTaskList(tasks) {
      const ids = new Set(tasks.map(task => task.id))
      for (const [id, card] of cards) {
        if (!ids.has(id)) { card.item.remove(); cards.delete(id) }
      }
      let position = list.firstElementChild
      for (const task of tasks) {
        let card = cards.get(task.id)
        if (!card) {
          const item = element('li', 'calendar-task')
          item.dataset.calendarTask = task.id
          const time = element('time', 'calendar-task-time')
          const content = element('div', 'calendar-task-content')
          const metadata = element('div', 'calendar-task-meta')
          const kind = element('span', 'calendar-event-kind calendar-deadline-kind', 'Frist')
          const course = element('span', 'calendar-task-course')
          const title = element('h4', 'calendar-task-title')
          const status = element('span', 'calendar-task-status')
          const overdue = element('span', 'calendar-task-overdue', 'Forfalt')
          const editButton = button('Rediger', 'calendar-task-edit secondary', () => {
            if (!snapshot.disabled) edit(task.id)
          })
          editButton.dataset.calendarEdit = task.id
          metadata.append(kind, time, course)
          content.append(metadata, title, status, overdue)
          item.append(content, editButton)
          card = { item, time, course, title, status, overdue, editButton }
          cards.set(task.id, card)
        }
        card.item.style.setProperty('--course-color', courseColor(task.course))
        card.item.classList.toggle('is-ready', Boolean(task.requiresSubmission && task.completed && !task.submitted))
        card.item.classList.toggle('is-completed', task.completed)
        setText(card.time, `kl. ${(task.deadlineLocal || '').slice(11, 16)}`)
        card.time.dateTime = task.deadlineLocal
        setText(card.course, task.course)
        setText(card.title, task.title)
        setText(card.status, taskStatus(task))
        card.overdue.hidden = !isOverdue(task, snapshot.now)
        card.editButton.disabled = snapshot.disabled
        card.editButton.setAttribute('aria-label', `Rediger «${task.title}»`)
        if (card.item !== position) list.insertBefore(card.item, position)
        position = card.item.nextElementSibling
      }
    }
  }
  const renderSelectedTasks = taskListRenderer(selectedTasks)

  function sessionListRenderer(list) {
    const cards = new Map()
    return function renderSessionList(sessions) {
      const ids = new Set(sessions.map(session => session.id))
      for (const [id, card] of cards) {
        if (!ids.has(id)) { card.item.remove(); cards.delete(id) }
      }
      list.hidden = sessions.length === 0
      let position = list.firstElementChild
      for (const session of sessions) {
        let card = cards.get(session.id)
        if (!card) {
          const item = element('li', 'calendar-task calendar-session')
          item.dataset.calendarSession = session.id
          const content = element('div', 'calendar-task-content')
          const title = element('h4', 'calendar-task-title calendar-session-kind', 'Studieøkt')
          const time = element('time', 'calendar-task-time calendar-session-time')
          const status = element('span', 'calendar-task-status', 'Avsatt studietid')
          const editButton = button('Rediger økt', 'calendar-task-edit secondary', () => {
            if (!snapshot.disabled && typeof editSession === 'function') editSession(session.id)
          })
          editButton.dataset.calendarSessionEdit = session.id
          content.append(title, time, status)
          item.append(content, editButton)
          card = { item, time, editButton }
          cards.set(session.id, card)
        }
        setText(card.time, `kl. ${session.startTime}–${session.endTime}`)
        card.time.dateTime = `${session.dateLocal}T${session.startTime}`
        card.editButton.disabled = snapshot.disabled || typeof editSession !== 'function'
        card.editButton.setAttribute('aria-label',
          `Rediger studieøkt ${formatDay(session.dateLocal, { year: true })} kl. ${session.startTime}–${session.endTime}`)
        if (card.item !== position) list.insertBefore(card.item, position)
        position = card.item.nextElementSibling
      }
    }
  }
  const renderSelectedSessions = sessionListRenderer(selectedSessions)

  function selectDate(label, focus = false) {
    const [year, month] = dateParts(label)
    if (year < 1 || year > 9999) return
    selectedDate = label
    period = { year, month: month - 1 }
    draw()
    if (focus) days.get(label)?.button.focus()
  }

  function shiftMonth(amount) {
    monthTransition = amount > 0 ? 'forward' : 'backward'
    const first = localDate(period.year, period.month + amount)
    if (first.getFullYear() < 1 || first.getFullYear() > 9999) { monthTransition = null; return }
    const lastDay = localDate(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const currentDay = dateParts(selectedDate)[2]
    selectDate(dateKey(localDate(first.getFullYear(), first.getMonth(), Math.min(currentDay, lastDay))))
  }

  grid.addEventListener('keydown', event => {
    const target = event.target.closest('[data-calendar-date]')
    if (!target || event.altKey || event.ctrlKey || event.metaKey) return
    const [year, month, day] = dateParts(target.dataset.calendarDate)
    const date = localDate(year, month - 1, day)
    const weekday = (date.getDay() + 6) % 7
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday }
    if (!(event.key in offsets)) return
    event.preventDefault()
    date.setDate(date.getDate() + offsets[event.key])
    selectDate(dateKey(date), true)
  })

  function draw() {
    if (!period) return
    if (monthTransition) {
      const directionClass = monthTransition === 'forward' ? 'is-shift-forward' : 'is-shift-backward'
      if (monthView._calendarShift) browser.clearTimeout(monthView._calendarShift)
      monthView.classList.remove('is-shift-forward', 'is-shift-backward')
      if (browser.requestAnimationFrame) {
        browser.requestAnimationFrame(() => {
          monthView.classList.add(directionClass)
          monthView._calendarShift = browser.setTimeout(() => {
            monthView.classList.remove(directionClass)
            monthView._calendarShift = null
          }, 340)
        })
      } else {
        monthView.classList.add(directionClass)
        monthView._calendarShift = browser.setTimeout(() => {
          monthView.classList.remove(directionClass)
          monthView._calendarShift = null
        }, 340)
      }
      monthTransition = null
    }
    const active = document.activeElement
    const hadFocus = host.contains(active)
    const focusedTask = active?.dataset.calendarEdit
    const focusedSession = active?.dataset.calendarSessionEdit
    const { year, month } = period
    const currentDay = dateKey(snapshot.now)
    const monthTasks = tasksForMonth(snapshot.tasks, year, month)
    const monthSessions = sessionsForMonth(snapshot.sessions, year, month)
    const selected = tasksForDay(snapshot.tasks, selectedDate)
    const selectedStudySessions = sessionsForDay(snapshot.sessions, selectedDate)
    setText(heading, monthLabel(year, month))
    previous.disabled = year === 1 && month === 0
    next.disabled = year === 9999 && month === 11
    monthMode.setAttribute('aria-pressed', String(mode === 'month'))
    agendaMode.setAttribute('aria-pressed', String(mode === 'agenda'))
    monthView.hidden = mode !== 'month'
    agenda.hidden = mode !== 'agenda'

    const cells = monthGrid(year, month)
    const cellKeys = new Set(cells.map(cell => cell.date))
    for (const [key, cell] of days) {
      if (!cellKeys.has(key)) { cell.button.remove(); days.delete(key) }
    }
    const byDate = new Map()
    for (const task of snapshot.tasks) {
      const key = (task.deadlineLocal || '').slice(0, 10)
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key).push(task)
    }
    const sessionsByDate = new Map()
    for (const session of snapshot.sessions) {
      if (!sessionsByDate.has(session.dateLocal)) sessionsByDate.set(session.dateLocal, [])
      sessionsByDate.get(session.dateLocal).push(session)
    }
    let position = grid.firstElementChild
    for (const cell of cells) {
      let entry = days.get(cell.date)
      if (!entry) {
        const dayButton = button('', 'calendar-day', () => selectDate(cell.date))
        dayButton.dataset.calendarDate = cell.date
        const number = element('span', 'calendar-day-number')
        const count = element('span', 'calendar-day-count')
        const sessionCount = element('span', 'calendar-day-session-count')
        const dots = element('span', 'calendar-dots')
        dots.setAttribute('aria-hidden', 'true')
        dayButton.append(number, count, sessionCount, dots)
        entry = { button: dayButton, number, count, sessionCount, dots, courseSignature: null }
        days.set(cell.date, entry)
      }
      const dayTasks = byDate.get(cell.date) || []
      const daySessions = sessionsByDate.get(cell.date) || []
      const isToday = cell.date === currentDay
      const isSelected = cell.date === selectedDate
      const cellYear = Number(cell.date.split('-')[0])
      entry.button.disabled = cellYear < 1 || cellYear > 9999
      entry.button.tabIndex = isSelected ? 0 : -1
      entry.button.classList.toggle('is-outside', !cell.inMonth)
      entry.button.classList.toggle('is-today', isToday)
      entry.button.classList.toggle('is-selected', isSelected)
      entry.button.classList.toggle('has-tasks', dayTasks.length > 0)
      entry.button.classList.toggle('has-sessions', daySessions.length > 0)
      entry.button.setAttribute('aria-pressed', String(isSelected))
      if (isToday) entry.button.setAttribute('aria-current', 'date')
      else entry.button.removeAttribute('aria-current')
      entry.button.setAttribute('aria-label', `${formatDay(cell.date, { weekday: true, year: true })}, ${dayTasks.length} ${dayTasks.length === 1 ? 'oppgave' : 'oppgaver'} med frist, ${daySessions.length} ${daySessions.length === 1 ? 'studieøkt' : 'studieøkter'}${isToday ? ', i dag' : ''}`)
      setText(entry.number, String(cell.day))
      setText(entry.count, dayTasks.length ? `F ${dayTasks.length}` : '')
      entry.count.hidden = dayTasks.length === 0
      setText(entry.sessionCount, daySessions.length ? `Ø ${daySessions.length}` : '')
      entry.sessionCount.hidden = daySessions.length === 0
      const courses = [...new Set(dayTasks.map(task => task.course))].sort().slice(0, 3)
      const signature = JSON.stringify(courses)
      if (entry.courseSignature !== signature) {
        entry.dots.replaceChildren(...courses.map(course => {
          const dot = element('span', 'course-dot')
          dot.style.setProperty('--course-color', courseColor(course))
          dot.title = course
          return dot
        }))
        entry.courseSignature = signature
      }
      if (entry.button !== position) grid.insertBefore(entry.button, position)
      position = entry.button.nextElementSibling
    }
    setText(selectedHeading, formatDay(selectedDate, { weekday: true, year: true }))
    setText(daySummary, `${selected.length} ${selected.length === 1 ? 'oppgave' : 'oppgaver'} med frist denne dagen. ${selectedStudySessions.length} ${selectedStudySessions.length === 1 ? 'studieøkt' : 'studieøkter'}.`)
    dayEmpty.hidden = selected.length > 0 || selectedStudySessions.length > 0
    renderSelectedTasks(selected)
    renderSelectedSessions(selectedStudySessions)

    const monthDates = new Map()
    for (const task of monthTasks) {
      const key = (task.deadlineLocal || '').slice(0, 10)
      if (!monthDates.has(key)) monthDates.set(key, { tasks: [], sessions: [] })
      monthDates.get(key).tasks.push(task)
    }
    for (const session of monthSessions) {
      if (!monthDates.has(session.dateLocal)) monthDates.set(session.dateLocal, { tasks: [], sessions: [] })
      monthDates.get(session.dateLocal).sessions.push(session)
    }
    for (const [key, group] of groups) {
      if (!monthDates.has(key)) { group.section.remove(); groups.delete(key) }
    }
    agendaEmpty.hidden = monthDates.size > 0
    setText(agendaEmpty, `Ingen frister i ${monthLabel(year, month).toLowerCase()}.`)
    let groupPosition = agendaEmpty.nextElementSibling
    for (const [key, entries] of [...monthDates].sort(([a], [b]) => a.localeCompare(b))) {
      let group = groups.get(key)
      if (!group) {
        const section = element('section', 'calendar-date-group')
        section.dataset.calendarAgendaDate = key
        const title = element('h3', 'calendar-agenda-date', formatDay(key, { weekday: true }))
        const list = element('ul', 'calendar-task-list')
        const sessionList = element('ul', 'calendar-task-list calendar-session-list')
        section.append(title, sessionList, list)
        group = { section, title, render: taskListRenderer(list), renderSessions: sessionListRenderer(sessionList) }
        groups.set(key, group)
      }
      group.section.classList.toggle('is-today', key === currentDay)
      group.render(entries.tasks)
      group.renderSessions(entries.sessions)
      if (group.section !== groupPosition) agenda.insertBefore(group.section, groupPosition)
      groupPosition = group.section.nextElementSibling
    }

    // Unchanged DOM nodes keep focus across every clock refresh. If a task is
    // removed or moved outside this view, return focus to a remaining control.
    if (hadFocus && (!active.isConnected || active.closest('[hidden]'))) {
      const visible = mode === 'month' ? monthView : agenda
      const edits = [...visible.querySelectorAll('[data-calendar-edit], [data-calendar-session-edit]')].filter(node => !node.disabled)
      const replacement = edits.find(node => focusedTask !== undefined ? node.dataset.calendarEdit === focusedTask
        : focusedSession !== undefined && node.dataset.calendarSessionEdit === focusedSession) || edits[0]
      if (replacement) replacement.focus()
      else if (mode === 'month') days.get(selectedDate)?.button.focus()
      else agendaMode.focus()
    }
  }

  return {
    render({ tasks, sessions = [], now, disabled = false }) {
      snapshot = { tasks, sessions, now, disabled }
      if (!period) {
        selectedDate = dateKey(now)
        period = { year: now.getFullYear(), month: now.getMonth() }
      }
      draw()
    },
  }
}

export function createCalendar(host, actions) {
  const calendar = createDeadlineCalendar(host, actions)
  const teaching = createTeachingLayer(host, actions)
  let model = { events: [] }
  const update = () => teaching.render(model)
  host.addEventListener('click', update)
  host.addEventListener('keydown', () => queueMicrotask(update))
  return { ...calendar, render(next) { model = next; calendar.render(next); teaching.render(next) } }
}
