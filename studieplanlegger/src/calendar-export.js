import { Temporal } from '@js-temporal/polyfill'
import ICAL from 'ical.js'
import { extendedSessionInterval } from './work-capacity.js'
import { toInstant } from './planner.js'

const encoder = new TextEncoder()
const utcStamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const escapeText = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const stableHash = input => {
  const bytes = encoder.encode(input), mask = (1n << 64n) - 1n
  const fnv64 = seed => {
    let value = seed
    for (const byte of bytes) { value ^= BigInt(byte); value = (value * 1099511628211n) & mask }
    return value.toString(16).padStart(16, '0')
  }
  return fnv64(14695981039346656037n) + fnv64(7809847782465536322n)
}
export const calendarUid = (kind, id) => `${kind}-${stableHash(`${kind}\0${id}`)}@studieplanlegger.local`

export function foldIcsLine(line) {
  const result = []; let current = ''
  for (const character of line) {
    const candidate = current + character, limit = result.length ? 74 : 75
    if (encoder.encode(candidate).length > limit) { result.push((result.length ? ' ' : '') + current); current = character } else current = candidate
  }
  result.push((result.length ? ' ' : '') + current)
  return result.join('\r\n')
}

function inRange(ms, from, to) {
  const date = Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO('Europe/Oslo').toPlainDate().toString()
  return (!from || date >= from) && (!to || date <= to)
}
function overlapsRange(start, end, from, to) {
  try {
    const lower = from ? Temporal.PlainDate.from(from).toZonedDateTime('Europe/Oslo').toInstant().epochMilliseconds : -Infinity
    const upper = to ? Temporal.PlainDate.from(to).add({ days: 1 }).toZonedDateTime('Europe/Oslo').toInstant().epochMilliseconds : Infinity
    return start < upper && end > lower
  } catch { return false }
}

export function calendarExportItems(state, { from, to, includeSessions = true, includeDeadlines = true, includeTeaching = false, includePersonal = false } = {}) {
  const items = []
  if (includeDeadlines) for (const task of state.tasks || []) if (task.deadlineLocal) {
    try {
      const allDay = task.deadlineLocal.length === 10
      const due = allDay ? Temporal.PlainDate.from(task.deadlineLocal).toString() : Date.parse(toInstant(task.deadlineLocal))
      if (allDay ? (!from || due >= from) && (!to || due <= to) : inRange(due, from, to)) items.push({ kind: 'deadline', id: task.id, title: task.title, due, allDay, course: task.course })
    } catch { /* invalid legacy values are not exported */ }
  }
  if (includeSessions) for (const session of state.sessions || []) {
    try {
      const interval = extendedSessionInterval(session)
      if (!overlapsRange(interval.start, interval.end, from, to)) continue
      const task = state.tasks?.find(item => item.id === session.taskId)
      const topic = state.topics?.find(item => item.id === session.reviewTopicId)
      const title = task ? `Studieøkt: ${task.title}` : session.reviewTopicId
        ? topic?.title?.trim() ? `Repetisjon: ${topic.title}` : 'Repetisjon (tema ikke tilgjengelig)'
        : 'Studieøkt'
      items.push({ kind: 'session', id: session.id, title, start: interval.start, end: interval.end, course: task?.course })
    } catch { /* rejected by the persisted-envelope validator in normal use */ }
  }
  if (includeTeaching) for (const event of state.planner?.events || []) if (event.activityKind !== 'personal' && !event.deleted && !event.cancelled && !event.excluded && !event.transparent && !event.information && event.transparency !== 'TRANSPARENT' && event.start && event.end) {
    const start = Date.parse(event.start), end = Date.parse(event.end)
    const course = state.planner?.courses?.find(item => item.id === event.courseId)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && overlapsRange(start, end, from, to)) items.push({ kind: 'teaching', id: event.id, title: event.title, start, end, location: event.location, course: course?.code || course?.name })
  }
  if (includePersonal) for (const event of state.planner?.events || []) if (event.activityKind === 'personal' && !event.deleted && !event.cancelled && !event.excluded) {
    try {
      const day = Temporal.PlainDate.from(event.dateLocal).toString()
      if ((from && day < from) || (to && day > to)) continue
      items.push({ kind: 'personal', id: event.id, title: event.title, date: day, start: event.start ? Date.parse(event.start) : undefined, end: event.end ? Date.parse(event.end) : undefined, allDay: !event.start, location: event.location })
    } catch { /* invalid legacy values are not exported */ }
  }
  const timestamp = item => item.start ?? (item.allDay ? Temporal.PlainDate.from(item.due || item.date).toZonedDateTime('Europe/Oslo').toInstant().epochMilliseconds : item.due)
  return items.sort((a, b) => timestamp(a) - timestamp(b) || `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))
}

function deadlineOmissionReason(value) {
  try {
    const local = Temporal.PlainDateTime.from(value)
    const earlier = local.toZonedDateTime('Europe/Oslo', { disambiguation: 'earlier' })
    const later = local.toZonedDateTime('Europe/Oslo', { disambiguation: 'later' })
    if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) return 'Klokkeslettet finnes ikke ved overgangen til sommertid i norsk tid. Rett fristen i oppgaven.'
    if (earlier.epochMilliseconds !== later.epochMilliseconds) return 'Klokkeslettet forekommer to ganger ved overgangen til vintertid i norsk tid. Velg et entydig klokkeslett i oppgaven.'
  } catch { /* malformed dates and times share the correction below */ }
  return 'Datoen eller klokkeslettet er ugyldig. Rett fristen i oppgaven.'
}

export function calendarExportOmissions(state, { from, to, includeDeadlines = true } = {}) {
  if (!includeDeadlines) return []
  const omitted = []
  for (const task of state.tasks || []) if (task.deadlineLocal) {
    const date = String(task.deadlineLocal).match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (date && ((from && date < from) || (to && date > to))) continue
    try {
      if (task.deadlineLocal.length === 10) Temporal.PlainDate.from(task.deadlineLocal)
      else toInstant(task.deadlineLocal)
    } catch { omitted.push({ ...task, reason: deadlineOmissionReason(task.deadlineLocal) }) }
  }
  return omitted
}

export function generateCalendarIcs(state, options = {}) {
  const lines = ['BEGIN:VCALENDAR', 'PRODID:-//Studieplanlegger//Lokal eksport//NO', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Studieplanlegger']
  for (const item of calendarExportItems(state, options)) {
    const summary = [item.course ? `[${item.course}]` : '', item.kind === 'deadline' ? 'Frist:' : '', item.title].filter(Boolean).join(' ')
    if (item.kind === 'deadline') lines.push('BEGIN:VEVENT', `UID:${calendarUid(item.kind, item.id)}`, 'DTSTAMP:19700101T000000Z', item.allDay ? `DTSTART;VALUE=DATE:${item.due.replaceAll('-', '')}` : `DTSTART:${utcStamp(item.due)}`, `SUMMARY:${escapeText(summary)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT')
    else if (item.kind === 'personal') lines.push('BEGIN:VEVENT', `UID:${calendarUid(item.kind, item.id)}`, 'DTSTAMP:19700101T000000Z', item.allDay ? `DTSTART;VALUE=DATE:${item.date.replaceAll('-', '')}` : `DTSTART:${utcStamp(item.start)}`, ...(item.end ? [`DTEND:${utcStamp(item.end)}`] : []), `SUMMARY:${escapeText(`Egen aktivitet: ${item.title}`)}`, ...(item.location ? [`LOCATION:${escapeText(item.location)}`] : []), ...(!item.end ? ['TRANSP:TRANSPARENT'] : []), 'END:VEVENT')
    else lines.push('BEGIN:VEVENT', `UID:${calendarUid(item.kind, item.id)}`, 'DTSTAMP:19700101T000000Z', `DTSTART:${utcStamp(item.start)}`, `DTEND:${utcStamp(item.end)}`, `SUMMARY:${escapeText(summary)}`, ...(item.location ? [`LOCATION:${escapeText(item.location)}`] : []), 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

export function validateGeneratedIcs(source) {
  try {
    const data = ICAL.parse(source), component = new ICAL.Component(data)
    return component.name === 'vcalendar' && component.getFirstPropertyValue('version') === '2.0'
  } catch { return false }
}

export function downloadCalendarIcs(state, options = {}) {
  if (!calendarExportItems(state, options).length) throw new Error('Ingen aktiviteter finnes i valgt periode med valgte typer.')
  const source = generateCalendarIcs(state, options)
  if (!validateGeneratedIcs(source)) throw new Error('Kalenderfilen kunne ikke valideres.')
  const url = URL.createObjectURL(new Blob([source], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = options.filename || 'studieplan.ics'; link.click()
  queueMicrotask(() => URL.revokeObjectURL(url))
  return source
}
