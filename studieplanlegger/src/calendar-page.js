import { Temporal } from '@js-temporal/polyfill'
import { calendarToday, calendarRange, calendarEntries, entriesForDay, collisionLanes, dayBounds, timeLabel, addDays } from './calendar-model.js'
import { OSLO } from './planner.js'
import { calendarAxis, axisSegments } from './calendar-axis.js'
import { formatDay, formatDeadline } from './calendar.js'
import './calendar-page.css'
import { createCalendarViewport } from './calendar-viewport.js'

const names = { day: 'Dag', week: 'Uke', month: 'Måned', agenda: 'Agenda' }
const kinds = { teaching: 'Undervisning', deadline: 'Frist', session: 'Studieøkt', work: 'Arbeidstid', busy: 'Opptatt', information: 'Informasjon' }
const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node }
const button = (text, fn, className = 'secondary') => { const node = el('button', text, className); node.type = 'button'; node.onclick = fn; return node }
export function createCalendarPage(actions) {
  let model, entries = [], signature = '', opener, pageScroll, viewportScroll, revealContent = false, preferencesSignature = 'null'
  const defaults = () => ({ version: 1, view: matchMedia('(max-width: 760px)').matches ? 'day' : 'week', weekMode: 'full', date: calendarToday(model?.now), courseId: '', kinds: Object.keys(kinds), scroll: {}, completed: false, cancelled: false })
  let state = defaults()
  const host = el('section', null, 'calendar-page panel'); host.id = 'full-calendar'; host.hidden = true
  document.querySelector('.work-area').prepend(host)
  const toolbar = el('div', null, 'full-calendar-toolbar'), modes = el('div', null, 'full-calendar-modes'); modes.setAttribute('aria-label', 'Kalendervisning')
  for (const [value, label] of Object.entries(names)) { const control = button(label, () => change({ view: value })); control.dataset.calendarView = value; modes.append(control) }
  const heading = el('h2'); heading.id = 'full-calendar-heading'; host.setAttribute('aria-labelledby', heading.id)
  const dateLabel = el('label', 'Dato'), dateInput = el('input'); dateInput.type = 'date'; dateInput.value = state.date; dateInput.id = 'full-calendar-date'; dateLabel.append(dateInput)
  dateInput.onchange = () => { if (dateInput.value) change({ date: dateInput.value }) }
  const move = direction => { const date = Temporal.PlainDate.from(state.date); change({ date: state.view === 'month' ? date.add({ months: direction }).toString() : addDays(state.date, direction * (state.view === 'week' ? 7 : state.view === 'agenda' ? 31 : 1)) }) }
  const previous = button('Forrige', () => move(-1)), following = button('Neste', () => move(1))
  previous.setAttribute('aria-label', 'Forrige periode'); following.setAttribute('aria-label', 'Neste periode')
  toolbar.append(previous, button('I dag', () => change({ date: calendarToday(model.now) })), following, dateLabel)
  const weekLabel = el('label', 'Ukedager'), weekSelect = el('select'); weekSelect.id = 'calendar-week-mode'
  weekSelect.append(new Option('Hele uken', 'full'), new Option('Arbeidsuke', 'workweek')); weekLabel.append(weekSelect); toolbar.append(weekLabel)
  weekSelect.onchange = () => change({ weekMode: weekSelect.value })
  const filter = el('details', null, 'full-calendar-filters'); filter.append(el('summary', 'Filtre og hjelp'))
  const courseLabel = el('label', 'Emnefilter'), courseSelect = el('select'); courseSelect.id = 'full-calendar-course'; courseLabel.append(courseSelect); filter.append(courseLabel)
  courseSelect.onchange = () => change({ courseId: courseSelect.value })
  for (const [kind, label] of Object.entries(kinds)) {
    const field = el('label', label), check = el('input'); check.type = 'checkbox'; check.checked = state.kinds.includes(kind)
    check.onchange = () => change({ kinds: check.checked ? [...state.kinds, kind] : state.kinds.filter(k => k !== kind) }); field.prepend(check); filter.append(field)
  }
  for (const [key, label] of [['completed', 'Vis ferdige frister'], ['cancelled', 'Vis avlysninger']]) { const field = el('label', label), check = el('input'); check.type = 'checkbox'; check.checked = state[key]; check.onchange = () => change({ [key]: check.checked }); field.prepend(check); filter.append(field) }
  const hint = el('p', 'Norsk tid. Frister er tidspunkter uten varighet. Alle døgnets timer og helgedager er tilgjengelige.', 'muted')
  const viewport = el('div', null, 'full-calendar-viewport'); viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Kalenderinnhold, rull for alle timer og dager')
  filter.append(hint); toolbar.append(filter)
  const scrollHint = el('p', 'Rull i kalenderen for alle timer. På smale skjermer kan ukevisningen rulles sidelengs; Dag og Agenda viser én kolonne.', 'calendar-scroll-hint')
  const readableList = el('details', null, 'calendar-readable-events calendar-point-extras'), readableSummary = el('summary'), readableContent = el('div', null, 'calendar-readable-content')
  readableList.open = true; readableList.hidden = true; readableContent.setAttribute('aria-label', 'Lesbar aktivitetsliste, rull for flere aktiviteter'); readableContent.tabIndex = 0
  readableList.append(readableSummary, readableContent)
  host.append(heading, modes, toolbar, scrollHint, readableList, viewport)
  let layoutFrame = 0
  function alignBands() {
    const grid = viewport.querySelector('.calendar-time-grid'); if (!grid) return
    const headers = [...grid.querySelectorAll('.calendar-time-day > h3')], points = [...grid.querySelectorAll('.calendar-points')]
    for (const node of [...headers, ...points]) node.style.height = ''
    const headerHeight = Math.max(0, ...headers.map(node => node.getBoundingClientRect().height))
    const pointHeight = Math.min(144, Math.max(0, ...points.map(node => node.scrollHeight)))
    for (const node of [...headers, grid.querySelector('.calendar-time-axis > h3')]) node.style.height = `${headerHeight}px`
    for (const node of [...points, grid.querySelector('.calendar-axis-points')]) { node.style.height = `${pointHeight}px`; node.style.top = `${headerHeight}px` }
  }
  function layout() { if (!layoutFrame) layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; if (!host.hidden) { alignBands(); fitViewport() } }) }
  function fitViewport(reveal = false) {
    if (host.hidden) return
    const nav = document.querySelector('.view-actions'), mobile = nav && getComputedStyle(nav).position === 'fixed'
    const bottom = mobile ? nav.getBoundingClientRect().top : innerHeight
    const minimum = Math.min(240, innerHeight * .35)
    if (reveal && bottom - viewport.getBoundingClientRect().top - 12 < minimum) {
      viewport.style.height = `${minimum}px`
      window.scrollBy({ top: viewport.getBoundingClientRect().top - (bottom - minimum - 12), behavior: 'instant' })
    }
    viewport.style.height = `${Math.max(100, bottom - viewport.getBoundingClientRect().top - 12)}px`
  }
  window.addEventListener('resize', layout)
  host.addEventListener('toggle', layout, true)
  const resizeObserver = new ResizeObserver(layout); resizeObserver.observe(toolbar)
  document.fonts.ready.then(layout)
  const dialog = el('dialog', null, 'editor-dialog calendar-details'); document.body.append(dialog)
  const persist = () => actions.saveCalendarPreferences?.(structuredClone(state))?.ok !== false
  const context = () => `${state.view}:${state.date}${state.view === 'week' && state.weekMode === 'workweek' ? ':workweek' : ''}`
  viewport.addEventListener('scroll', () => { state.scroll[context()] = { top: viewport.scrollTop, left: viewport.scrollLeft }; persist() }, { passive: true })
  function change(patch) { const previous = state; state = { ...state, ...patch }; if (!persist()) state = previous; dateInput.value = state.date; signature = ''; revealContent = Boolean(patch.view || patch.date); render(model) }
  function focusControl(control) {
    const current = control?.isConnected ? control : [...host.querySelectorAll('[data-calendar-focus-key]')].find(node => node.dataset.calendarFocusKey === control?.dataset.calendarFocusKey)
    current?.focus({ preventScroll: true })
  }
  function closeDetails() { dialog.close(); window.scrollTo(pageScroll.x, pageScroll.y); viewport.scrollTo(viewportScroll.x, viewportScroll.y); focusControl(opener) }
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDetails() })
  function showDetails(entry, control) {
    opener = control; pageScroll = { x: scrollX, y: scrollY }; viewportScroll = { x: viewport.scrollLeft, y: viewport.scrollTop }
    dialog.replaceChildren(el('p', kinds[entry.kind], 'eyebrow'), el('h2', entry.title)); dialog.querySelector('h2').id = 'calendar-details-title'; dialog.setAttribute('aria-labelledby', 'calendar-details-title')
    const course = model.planner?.courses.find(c => c.id === entry.courseId)
    const dateFormat = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'full', timeStyle: 'short', timeZone: OSLO })
    dialog.append(el('p', course ? `${course.code} ${course.name}` : entry.course || 'Emne ikke oppgitt'))
    dialog.append(el('p', entry.warning ? formatDeadline(entry.local, { year: true }) : entry.point ? dateFormat.format(new Date(entry.start)) : `${dateFormat.format(new Date(entry.start))} - ${dateFormat.format(new Date(entry.end))}`), el('p', `${timeLabel(entry)} · Europe/Oslo`), el('p', entry.location || 'Sted ikke oppgitt'))
    if (!entry.point && !entry.warning) dialog.append(el('p', `Faktisk varighet: ${(entry.end - entry.start) / 60000} minutter.`))
    for (const text of [entry.warning, entry.cancelled ? 'Avlyst i kilden' : '', entry.description, entry.notes, entry.conflict?.message]) if (text) dialog.append(el('p', text))
    const controls = el('div', null, 'actions')
    const edit = entry.kind === 'deadline' ? () => actions.edit(entry.id) : entry.kind === 'session' ? () => actions.editSession(entry.id) : ['teaching', 'information'].includes(entry.kind) ? () => actions.editEvent(entry.id) : () => actions.view('capacity')
    controls.append(button('Rediger', () => { closeDetails(); edit() }), button('Lukk detaljer', closeDetails)); dialog.append(controls); dialog.showModal(); controls.lastChild.focus({ preventScroll: true })
  }
  function entryButton(entry, date, compact = false) {
    const control = button('', () => showDetails(entry, control), `calendar-entry entry-${entry.kind}${entry.cancelled ? ' is-cancelled' : ''}${entry.point ? ' is-point' : ''}`)
    control.dataset.calendarKey = entry.key
    control.dataset.calendarFocusKey = entry.key
    const course = model.planner?.courses.find(c => c.id === entry.courseId), context = [course?.code || course?.name || entry.course, entry.location].filter(Boolean).join(' · ')
    const when = date ? `${formatDay(date, { year: true })} · ${timeLabel(entry)}` : timeLabel(entry)
    const kindLabel = `${kinds[entry.kind]}${context ? ` · ${context}` : ''}`
    const whenClass = compact ? 'entry-time entry-time-compact' : 'entry-time'
    control.append(el('span', when, whenClass), el('strong', entry.title), el('span', kindLabel, 'entry-kind'))
    if (compact) control.classList.add('is-short')
    const continuation = [entry.start < entry.clippedStart ? 'Fortsetter fra forrige dag' : '', entry.end > entry.clippedEnd ? 'Fortsetter neste dag' : ''].filter(Boolean).join(' · ')
    if (continuation) control.append(el('span', continuation, 'entry-continuation'))
    control.title = `${kinds[entry.kind]}: ${entry.title}. ${when}. ${kindLabel}`
    const description = `${kinds[entry.kind]}: ${entry.title}. ${when}. ${kindLabel}${continuation ? `. ${continuation}` : ''}`
    control.setAttribute('aria-label', compact ? `Kort varighet: ${description}` : description)
    return control
  }
  function addShortControls(timeline) {
    const segments = timeline.shortSegments || []
    if (!segments.length) return
    const height = 44, limit = parseFloat(timeline.style.height) - height, groups = []
    for (const item of segments.sort((a, b) => a.top - b.top || a.entry.key.localeCompare(b.entry.key))) {
      const top = Math.max(0, Math.min(item.top, limit)), previous = groups.at(-1)
      if (previous && top < previous.top + height) previous.items.push(item.entry)
      else groups.push({ top, items: [item.entry] })
    }
    timeline.classList.add('has-short-events')
    for (const group of groups) {
      const first = group.items[0]
      const control = button(group.items.length > 9 ? '9+' : group.items.length > 1 ? group.items.length + ' i' : 'i', () => {
        if (group.items.length === 1) showDetails(first, control)
        else {
          const chooser = el('dialog', null, 'editor-dialog calendar-details calendar-short-chooser')
          chooser.setAttribute('aria-label', 'Korte aktiviteter')
          chooser.append(el('h2', 'Korte aktiviteter'))
          for (const entry of group.items) chooser.append(button((entry.cancelled ? 'Avlyst: ' : '') + timeLabel(entry) + ' · ' + entry.title, () => {
            chooser.close(); showDetails(entry, control)
          }, 'calendar-entry entry-' + entry.kind + (entry.cancelled ? ' is-cancelled' : '')))
          chooser.append(button('Lukk detaljer', () => chooser.close()))
          chooser.addEventListener('close', () => { chooser.remove(); if (!dialog.open) focusControl(control) })
          host.append(chooser); chooser.showModal()
        }
      }, 'calendar-short-control secondary')
      control.dataset.calendarShort = group.items.map(entry => entry.key).join(' ')
      control.dataset.calendarFocusKey = 'short:' + timeline.closest('[data-date]').dataset.date + ':' + first.key
      control.style.top = group.top + 'px'
      control.classList.toggle('is-cancelled', group.items.every(entry => entry.cancelled))
      control.setAttribute('aria-label', 'Åpne detaljer: ' + group.items.map(entry => (entry.cancelled ? 'Avlyst: ' : '') + timeLabel(entry) + ' · ' + entry.title).join('; '))
      control.title = control.getAttribute('aria-label')
      timeline.append(control)
    }
  }
  function render(next) {
    if (!next) return; model = next
    const incomingPreferences = JSON.stringify(model.calendarPreferences || null)
    if (incomingPreferences !== preferencesSignature) { preferencesSignature = incomingPreferences; state = model.calendarPreferences ? structuredClone(model.calendarPreferences) : defaults(); dateInput.value = state.date }
    host.hidden = model.view !== 'calendar' || !model.readable
    if (host.hidden || dialog.open || host.querySelector('.calendar-short-chooser[open]')) return
    const nextSignature = JSON.stringify([model.tasks, model.sessions, model.planner, model.workWindows, model.busyWindows, state.view, state.weekMode, state.date, state.courseId, state.kinds, state.completed, state.cancelled])
    if (nextSignature === signature) { fitViewport(); return }; signature = nextSignature
    const previousFocus = document.activeElement?.dataset.calendarFocusKey
    entries = calendarEntries(model)
    const all = el('option', 'Alle emner'); all.value = ''; courseSelect.replaceChildren(all)
    for (const course of model.planner?.courses || []) { const choice = el('option', `${course.code} ${course.name}`); choice.value = course.id; courseSelect.append(choice) }
    if (!(model.planner?.courses || []).some(c => c.id === state.courseId)) state.courseId = ''
    courseSelect.value = state.courseId
    for (const mode of modes.children) mode.setAttribute('aria-pressed', String(mode.dataset.calendarView === state.view))
    const checks = [...filter.querySelectorAll('input[type=checkbox]')]
    Object.keys(kinds).forEach((kind, index) => { checks[index].checked = state.kinds.includes(kind) })
    checks.at(-2).checked = state.completed; checks.at(-1).checked = state.cancelled
    weekLabel.hidden = state.view !== 'week'; weekSelect.value = state.weekMode || 'full'
    const dates = calendarRange(state.date, state.view, state.weekMode), filters = { ...state, courseCode: model.planner?.courses.find(c => c.id === state.courseId)?.code }
    heading.textContent = `${names[state.view]} · ${state.view === 'week' ? `${formatDay(dates[0], { year: true })} – ${formatDay(dates.at(-1), { year: true })}` : formatDay(state.date, { year: true })}`
    viewport.replaceChildren(); viewport.dataset.mode = state.view
    readableContent.replaceChildren(); readableList.hidden = true
    const readableKeys = new Set()
    const readableItems = []
    if (['day', 'week'].includes(state.view)) {
      const grid = el('div', null, `calendar-time-grid ${state.view}`), clockAxis = calendarAxis(dates)
      grid.style.setProperty('--calendar-days', dates.length)
      const axis = el('section', null, 'calendar-time-axis'), axisHeader = el('h3', 'Tid'), axisPoints = el('div', null, 'calendar-axis-points'), axisTime = el('div', null, 'calendar-timeline')
      axisTime.style.height = `${clockAxis.minutes}px`
      axisHeader.title = 'Norsk klokketid. (1) og (2) skiller gjentatt høsttime. Skraverte felt er timer som ikke finnes på dagen.'
      for (const slot of clockAxis.slots) { const tick = el('div', slot.label, 'calendar-hour'); tick.style.top = `${slot.top}px`; axisTime.append(tick) }
      axis.append(axisHeader, axisPoints, axisTime); grid.append(axis)
      for (const date of dates) {
        const day = el('section', null, 'calendar-time-day'), bounds = dayBounds(date), dayAxis = clockAxis.days.get(date)
        day.dataset.date = date; day.dataset.actualMinutes = dayAxis.actualMinutes
        day.append(el('h3', new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: OSLO }).format(new Date(bounds.start))))
        const items = entriesForDay(entries, date, filters), points = el('div', null, 'calendar-points')
        for (const item of items.filter(e => e.point || e.allDay || e.warning)) points.append(entryButton(item))
        const timed = collisionLanes(items.filter(e => !e.point && !e.allDay && !e.warning && e.kind !== 'work'))
        const extras = items
          .filter(e => !e.point && !e.allDay && !e.warning && (e.kind === 'work' || timed.some(t => t.key === e.key && (t.lanes > 1 || t.start < t.clippedStart || t.end > t.clippedEnd || axisSegments(t, dayAxis).some(part => part.minutes < 88)))))
          .sort((a, b) => (a.start - b.start) || (a.end - b.end) || a.key.localeCompare(b.key))
        for (const item of extras) if (!readableKeys.has(item.key)) {
          readableKeys.add(item.key)
          readableItems.push({ item, date })
        }
        day.append(points)
        const timeline = el('div', null, 'calendar-timeline'); timeline.style.height = `${clockAxis.minutes}px`
        for (const gap of dayAxis.gaps) { const marker = el('div', 'Ingen lokal time', 'calendar-clock-gap'); marker.style.top = `${gap.top}px`; marker.setAttribute('aria-label', `${gap.label}: denne timen finnes ikke på ${date}. Feltet er ikke arbeidstid.`); timeline.append(marker) }
        for (const entry of items.filter(e => e.kind === 'work')) {
          for (const part of axisSegments(entry, dayAxis)) { const background = el('div', null, 'calendar-work-background'); background.setAttribute('aria-hidden', 'true'); background.style.top = `${part.top}px`; background.style.height = `${part.minutes}px`; timeline.append(background) }
        }
        for (const entry of timed) {
          for (const part of axisSegments(entry, dayAxis)) {
            if (part.minutes < 44) {
              const marker = el('div', null, 'short-event calendar-duration-marker entry-' + entry.kind)
              marker.dataset.calendarGeometry = entry.key
              marker.setAttribute('aria-hidden', 'true')
              marker.classList.toggle('is-cancelled', Boolean(entry.cancelled))
              marker.classList.toggle('continues-before', entry.start < entry.clippedStart)
              marker.classList.toggle('continues-after', entry.end > entry.clippedEnd)
              Object.assign(marker.style, { top: part.top + 'px', height: part.minutes + 'px', left: (100 * entry.lane / entry.lanes) + '%', width: 'calc(100% / ' + entry.lanes + ' - 2px)' })
              timeline.append(marker)
              ;(timeline.shortSegments ||= []).push({ entry, top: part.top })
              continue
            }
            const control = entryButton(entry)
            control.dataset.calendarGeometry = `${entry.key}`
            control.dataset.calendarFocusKey = `timeline:${date}:${part.top}:${entry.key}`
            if (entry.lanes > 1) control.classList.add('is-overlapping')
            if (entry.start < entry.clippedStart) control.classList.add('continues-before')
            if (entry.end > entry.clippedEnd) control.classList.add('continues-after')
            control.style.top = `${part.top}px`; control.style.height = `${part.minutes}px`; control.style.left = `${100 * entry.lane / entry.lanes}%`; control.style.width = `calc(100% / ${entry.lanes} - 2px)`; timeline.append(control)
          }
        }
        day.append(timeline); grid.append(day)
      }
      viewport.append(grid)
      readableItems.sort((a, b) => (String(a.date).localeCompare(String(b.date))) || (a.item.start - b.item.start) || (a.item.end - b.item.end) || a.item.key.localeCompare(b.item.key))
      readableContent.replaceChildren(...readableItems.map(({ item, date }) => {
        const control = entryButton(item, date)
        control.dataset.calendarFocusKey = `list:${date}:${item.key}`
        return control
      }))
      readableList.hidden = !readableItems.length
      const hasOverflow = readableContent.scrollHeight > readableContent.clientHeight + 2
      readableSummary.textContent = `Lesbar aktivitetsliste (${readableItems.length}) · sortert kronologisk${hasOverflow ? ' · rull for alle' : ''}`
      readableContent.classList.toggle('has-scroll', hasOverflow)
      alignBands()
    } else {
      const grid = el('div', null, state.view === 'month' ? 'calendar-month-grid' : 'calendar-full-agenda')
      for (const date of dates) {
        const items = entriesForDay(entries, date, filters)
        if (state.view === 'agenda' && !items.length) continue
        const day = el('section', null, 'calendar-date-cell'); day.dataset.date = date
        day.append(button(new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: OSLO }).format(new Date(dayBounds(date).start)), () => change({ date, view: 'day' })))
        for (const item of state.view === 'month' ? items.slice(0, 3) : items) day.append(entryButton(item))
        if (state.view === 'month' && items.length > 3) day.append(button(`+ ${items.length - 3} flere`, () => change({ date, view: 'day' })))
        grid.append(day)
      }
      if (!grid.childElementCount) grid.append(el('p', 'Ingen oppføringer i denne perioden med valgte filtre.'))
      viewport.append(grid)
    }
    fitViewport(revealContent); revealContent = false
    const scroll = state.scroll[context()] || { top: ['day', 'week'].includes(state.view) ? 440 : 0, left: 0 }
    viewport.scrollTo(scroll.left, scroll.top)
    viewport.querySelectorAll('.calendar-timeline').forEach(addShortControls)
    calendarViewport.refresh()
    if (previousFocus) [...host.querySelectorAll('[data-calendar-focus-key]')].find(e => e.dataset.calendarFocusKey === previousFocus)?.focus({ preventScroll: true })
  }
  const calendarViewport = createCalendarViewport(host, viewport, () => entries, entryButton, () => fitViewport())
  return { render, isOpen: () => dialog.open || Boolean(host.querySelector('.calendar-short-chooser[open]')) }
}
