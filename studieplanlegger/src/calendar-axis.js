import { Temporal } from '@js-temporal/polyfill'
import { OSLO } from './planner.js'
import { dayBounds } from './calendar-model.js'

// Shared local-clock slots. A repeated autumn hour has two distinct slots;
// days without that occurrence show a gap, never invented elapsed time.
export function calendarAxis(dates) {
  const days = new Map(), shared = new Map()
  for (const date of dates) {
    const bounds = dayBounds(date), hours = [], occurrences = new Map()
    for (let start = bounds.start; start < bounds.end; start += 3600000) {
      const zone = Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO(OSLO)
      const occurrence = occurrences.get(zone.hour) || 0; occurrences.set(zone.hour, occurrence + 1)
      const key = `${zone.hour}:${occurrence}`, hour = { key, hour: zone.hour, occurrence, offset: zone.offset, start, end: Math.min(start + 3600000, bounds.end) }
      hours.push(hour); shared.set(key, { key, hour: zone.hour, occurrence })
    }
    days.set(date, { hours, actualMinutes: (bounds.end - bounds.start) / 60000 })
  }
  const slots = [...shared.values()].sort((a, b) => a.hour - b.hour || a.occurrence - b.occurrence).map((slot, index) => ({ ...slot, top: index * 60, label: `${String(slot.hour).padStart(2, '0')}:00${shared.has(`${slot.hour}:1`) ? ` (${slot.occurrence + 1})` : ''}` }))
  for (const day of days.values()) {
    day.hours = day.hours.map(hour => ({ ...hour, top: slots.find(slot => slot.key === hour.key).top }))
    day.gaps = slots.filter(slot => !day.hours.some(hour => hour.key === slot.key))
  }
  return { days, slots, minutes: slots.length * 60 }
}
export function axisSegments(entry, day) {
  const segments = []
  for (const hour of day.hours) {
    const start = Math.max(entry.clippedStart, hour.start), end = Math.min(entry.clippedEnd, hour.end)
    if (!(end > start)) continue
    const top = hour.top + (start - hour.start) / 60000, minutes = (end - start) / 60000, previous = segments.at(-1)
    if (previous && previous.top + previous.minutes === top && previous.end === start) { previous.end = end; previous.minutes += minutes }
    else segments.push({ start, end, top, minutes })
  }
  return segments
}
