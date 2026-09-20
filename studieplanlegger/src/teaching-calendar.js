import { osloLocal } from './planner.js'

export function eventsOnDay(events, day) {
  return events.filter(event => !event.cancelled && !event.deleted && osloLocal(event.start).slice(0, 10) <= day && osloLocal(new Date(Date.parse(event.end) - 1).toISOString()).slice(0, 10) >= day)
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'nb'))
}

// Composes with the existing calendar's date selection and keyboard navigation.
export function createTeachingLayer(host, actions) {
  const section = document.createElement('section'); section.className = 'calendar-teaching'; section.setAttribute('aria-label', 'Undervisning i kalenderen')
  const rows = new Map()
  let signature = ''
  let preparedSignature = '', prepared = []
  return {
    render({ events = [], disabled = false }) {
      const nextPrepared = JSON.stringify(events)
      if (nextPrepared !== preparedSignature) {
        preparedSignature = nextPrepared
        prepared = events.filter(e => !e.cancelled && !e.deleted).map(event => ({ event, start: osloLocal(event.start).slice(0, 10), end: osloLocal(new Date(Date.parse(event.end) - 1).toISOString()).slice(0, 10) }))
      }
      const onDay = day => prepared.filter(e => e.start <= day && e.end >= day).map(e => e.event).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'nb'))
      if (!host.querySelector('.calendar-teaching-kind')) {
        const legend = document.createElement('span'); legend.className = 'calendar-teaching-kind'; legend.textContent = 'Undervisning · U'; host.querySelector('.calendar-legend')?.append(legend)
      }
      for (const day of host.querySelectorAll('[data-calendar-date]')) {
        const count = onDay(day.dataset.calendarDate).length
        let marker = day.querySelector('.calendar-day-teaching-count')
        if (!marker) { marker = document.createElement('span'); marker.className = 'calendar-day-teaching-count'; day.append(marker) }
        marker.hidden = !count; marker.textContent = count ? `U ${count}` : ''
        const label = day.getAttribute('aria-label').replace(/, \d+ undervisningsøkter$/, '')
        day.setAttribute('aria-label', count ? `${label}, ${count} undervisningsøkter` : label)
      }
      const selected = host.querySelector('[data-calendar-date][aria-pressed="true"]')?.dataset.calendarDate
      const month = host.querySelector('[data-calendar-date]:not(.is-outside)')?.dataset.calendarDate.slice(0, 7)
      const agendaMode = host.querySelector('.calendar-month-view')?.hidden
      const items = agendaMode ? prepared.filter(e => e.start.slice(0, 7) <= month && e.end.slice(0, 7) >= month).map(e => e.event).sort((a, b) => a.start.localeCompare(b.start)) : onDay(selected || '')
      const nextSignature = JSON.stringify([items, selected, month, agendaMode, disabled])
      if (nextSignature === signature && section.isConnected) return
      signature = nextSignature
      if (!section.isConnected) host.append(section)
      const wanted = new Set(items.map(e => e.id))
      for (const [id, row] of rows) if (!wanted.has(id)) { row.remove(); rows.delete(id) }
      let heading = section.querySelector('h4')
      if (!heading) { heading = document.createElement('h4'); section.prepend(heading) }
      heading.textContent = agendaMode ? 'Undervisning denne måneden' : 'Undervisning på valgt dag'
      section.hidden = !events.some(e => !e.cancelled && !e.deleted)
      let empty = section.querySelector('.calendar-teaching-empty')
      if (!empty) { empty = document.createElement('p'); empty.className = 'calendar-teaching-empty'; empty.textContent = 'Ingen undervisning i dette tidsrommet.'; section.append(empty) }
      empty.hidden = !!items.length
      let previous = empty
      for (const event of items) {
        let row = rows.get(event.id)
        if (!row) { row = document.createElement('button'); row.type = 'button'; row.dataset.calendarEvent = event.id; row.addEventListener('click', () => actions.editEvent?.(event.id)); rows.set(event.id, row) }
        const start = osloLocal(event.start), end = osloLocal(event.end)
        row.textContent = `U · ${event.title} · ${agendaMode ? `${start.slice(0, 10)} ` : ''}${event.allDay ? 'Hele dagen' : `${start.slice(11)}–${end.slice(0, 10) === start.slice(0, 10) ? '' : `${end.slice(0, 10)} `}${end.slice(11)}`} · ${event.location || 'Sted ikke oppgitt'}`
        row.disabled = disabled
        if (previous.nextElementSibling !== row) previous.after(row)
        previous = row
      }
    },
  }
}
