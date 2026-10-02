import { osloLocal } from './planner.js'
import { courseColor } from './calendar.js'
import { eventPresentation } from './event-kind.js'
const eventOrder = event => event.start || `${event.dateLocal || ''}T00:00`

export function eventsOnDay(events, day) {
  return events.filter(event => !event.cancelled && !event.deleted && (event.activityKind === 'personal' ? event.dateLocal === day : osloLocal(event.start).slice(0, 10) <= day && osloLocal(new Date(Date.parse(event.end) - 1).toISOString()).slice(0, 10) >= day))
    .sort((a, b) => (a.start || a.dateLocal).localeCompare(b.start || b.dateLocal) || a.title.localeCompare(b.title, 'nb'))
}

// Composes with the existing calendar's date selection and keyboard navigation.
export function createTeachingLayer(host, actions) {
  const section = document.createElement('section'); section.className = 'calendar-teaching'; section.setAttribute('aria-label', 'Undervisning i kalenderen')
  const rows = new Map()
  let signature = ''
  let preparedSignature = '', prepared = []
  return {
    render({ events = [], courses = [], disabled = false }) {
      const nextPrepared = JSON.stringify(events)
      if (nextPrepared !== preparedSignature) {
        preparedSignature = nextPrepared
        prepared = events.filter(e => !e.cancelled && !e.deleted).map(event => event.activityKind === 'personal' ? { event, start: event.dateLocal, end: event.dateLocal } : ({ event, start: osloLocal(event.start).slice(0, 10), end: osloLocal(new Date(Date.parse(event.end) - 1).toISOString()).slice(0, 10) }))
      }
      const onDay = day => prepared.filter(e => e.start <= day && e.end >= day).map(e => e.event).sort((a, b) => eventOrder(a).localeCompare(eventOrder(b)) || a.title.localeCompare(b.title, 'nb'))
      if (!host.querySelector('.calendar-teaching-kind')) {
        const legend = document.createElement('span'); legend.className = 'calendar-teaching-kind'; legend.textContent = 'Undervisning · U · Egen aktivitet · E'; host.querySelector('.calendar-legend')?.append(legend)
      }
      for (const day of host.querySelectorAll('[data-calendar-date]')) {
        const values = onDay(day.dataset.calendarDate), teachingCount = values.filter(event => event.activityKind !== 'personal').length, personalCount = values.length - teachingCount, count = values.length
        let marker = day.querySelector('.calendar-day-teaching-count')
        if (!marker) { marker = document.createElement('span'); marker.className = 'calendar-day-teaching-count'; day.append(marker) }
        marker.hidden = !count; marker.textContent = [teachingCount ? `U ${teachingCount}` : '', personalCount ? `E ${personalCount}` : ''].filter(Boolean).join(' · ')
        const label = day.getAttribute('aria-label').replace(/, \d+ kalenderaktiviteter$/, '')
        day.setAttribute('aria-label', count ? `${label}, ${teachingCount} undervisningsøkter, ${personalCount} egne aktiviteter` : label)
      }
      const selected = host.querySelector('[data-calendar-date][aria-pressed="true"]')?.dataset.calendarDate
      const month = host.querySelector('[data-calendar-date]:not(.is-outside)')?.dataset.calendarDate.slice(0, 7)
      const agendaMode = host.querySelector('.calendar-month-view')?.hidden
      const items = agendaMode ? prepared.filter(e => e.start.slice(0, 7) <= month && e.end.slice(0, 7) >= month).map(e => e.event).sort((a, b) => eventOrder(a).localeCompare(eventOrder(b))) : onDay(selected || '')
      const nextSignature = JSON.stringify([items, selected, month, agendaMode, disabled, courses.map(course => [course.id, course.code])])
      if (nextSignature === signature && section.isConnected) return
      signature = nextSignature
      if (!section.isConnected) host.append(section)
      const wanted = new Set(items.map(e => e.id))
      for (const [id, row] of rows) if (!wanted.has(id)) { row.remove(); rows.delete(id) }
      let heading = section.querySelector('h4')
      if (!heading) { heading = document.createElement('h4'); section.prepend(heading) }
      heading.textContent = agendaMode ? 'Kalenderaktiviteter denne måneden' : 'Kalenderaktiviteter på valgt dag'
      section.hidden = !events.some(e => !e.cancelled && !e.deleted)
      let empty = section.querySelector('.calendar-teaching-empty')
      if (!empty) { empty = document.createElement('p'); empty.className = 'calendar-teaching-empty'; empty.textContent = 'Ingen undervisning i dette tidsrommet.'; section.append(empty) }
      empty.hidden = !!items.length
      let previous = empty
      for (const event of items) {
        const code = courses.find(course => course.id === event.courseId)?.code || ''
        const presentation = eventPresentation(event)
        let row = rows.get(event.id)
        if (!row) { row = document.createElement('button'); row.type = 'button'; row.dataset.calendarEvent = event.id; row.addEventListener('click', () => actions.editEvent?.(event.id)); rows.set(event.id, row) }
        const personal = event.activityKind === 'personal', start = event.start ? osloLocal(event.start) : `${event.dateLocal}T`, end = event.end ? osloLocal(event.end) : ''
        const timing = personal && !event.start ? 'Tid ikke oppgitt' : personal && !event.end ? `${start.slice(11)} · Varighet ikke oppgitt` : event.allDay ? 'Hele dagen' : `${start.slice(11)}–${end.slice(0, 10) === start.slice(0, 10) ? '' : `${end.slice(0, 10)} `}${end.slice(11)}`
        row.textContent = `${personal ? 'Egen aktivitet' : `${presentation.symbol} · ${presentation.label}`} · ${code ? `${code} · ` : ''}${event.title} · ${agendaMode ? `${start.slice(0, 10)} ` : ''}${timing} · ${event.location || 'Sted ikke oppgitt'}`
        row.classList.toggle('is-personal', personal)
        row.classList.toggle('is-exam', presentation.isExam)
        row.setAttribute('aria-label', `${personal ? 'Egen aktivitet' : presentation.label}: ${code ? `${code}, ` : ''}${event.title}`)
        if (code) row.style.setProperty('--course-color', courseColor(code))
        else row.style.removeProperty('--course-color')
        row.disabled = disabled
        if (previous.nextElementSibling !== row) previous.after(row)
        previous = row
      }
    },
  }
}
