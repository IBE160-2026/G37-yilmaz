import { Temporal } from '@js-temporal/polyfill'
import ICAL from 'ical.js'
import { extendedSessionInterval } from './work-capacity.js'
import { toInstant, eventBlocksTime } from './planner.js'
import { calendarInstantLabel } from './calendar-model.js'

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

const instant = value => typeof value === 'number' ? Temporal.Instant.fromEpochMilliseconds(value) : Temporal.Instant.from(value)
function inRange(value, from, to) {
  const date = instant(value).toZonedDateTimeISO('Europe/Oslo').toPlainDate().toString()
  return (!from || date >= from) && (!to || date <= to)
}
function overlapsRange(start, end, from, to) {
  try {
    const lower = from ? Temporal.PlainDate.from(from).toZonedDateTime('Europe/Oslo').epochNanoseconds : null
    const upper = to ? Temporal.PlainDate.from(to).add({ days: 1 }).toZonedDateTime('Europe/Oslo').epochNanoseconds : null
    return (upper === null || instant(start).epochNanoseconds < upper) && (lower === null || instant(end).epochNanoseconds > lower)
  } catch { return false }
}

function calendarExportCandidates(state, { from, to, includeSessions = true, includeDeadlines = true, includeTeaching = false, includePersonal = false } = {}) {
  const items = []
  if (includeDeadlines) for (const task of state.tasks || []) if (task.deadlineLocal) {
    try {
      const allDay = task.deadlineLocal.length === 10
      const dueInstant = allDay ? undefined : toInstant(task.deadlineLocal)
      const due = allDay ? Temporal.PlainDate.from(task.deadlineLocal).toString() : instant(dueInstant).epochMilliseconds
      if (allDay ? (!from || due >= from) && (!to || due <= to) : inRange(dueInstant, from, to)) items.push({ kind: 'deadline', id: task.id, title: task.title, due, ...(dueInstant ? { dueInstant } : {}), allDay, course: task.course })
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
  if (includeTeaching) for (const event of state.planner?.events || []) if (event.activityKind !== 'personal' && !event.deleted && !event.cancelled && !event.excluded && event.start && event.end) {
    try {
      const start = instant(event.start), end = instant(event.end), duration = Temporal.Instant.compare(end, start)
      const course = state.planner?.courses?.find(item => item.id === event.courseId)
      const omittedInformation = !event.point && (event.transparent || event.information || event.transparency === 'TRANSPARENT')
      const dates = event.allDay ? { allDay: true, date: start.toZonedDateTimeISO('Europe/Oslo').toPlainDate().toString(), endDate: end.toZonedDateTimeISO('Europe/Oslo').toPlainDate().toString() } : {}
      if ((duration > 0 || event.point && duration === 0) && (event.point ? inRange(start, from, to) : overlapsRange(start, end, from, to))) items.push({ kind: 'teaching', point: Boolean(event.point), transparent: !eventBlocksTime(event), id: event.id, title: event.title, start: start.epochMilliseconds, end: end.epochMilliseconds, startInstant: start.toString(), endInstant: end.toString(), ...dates, ...(omittedInformation ? { omissionReason: 'Oppføringen er informasjon eller reserverer ikke tid. Slike intervaller er ikke med i undervisningskopien; oppføringen beholdes i planen.' } : {}), location: event.location, course: course?.code || course?.name })
    } catch { /* invalid legacy values are not exported */ }
  }
  if (includePersonal) for (const event of state.planner?.events || []) if (event.activityKind === 'personal' && !event.deleted && !event.cancelled && !event.excluded) {
    try {
      const day = Temporal.PlainDate.from(event.dateLocal).toString()
      const start = event.start ? instant(event.start) : null, end = event.end && !event.point ? instant(event.end) : null
      if (start && end ? !overlapsRange(start, end, from, to) : (from && day < from) || (to && day > to)) continue
      const allDay = Boolean(event.allDay || !start)
      const endDate = allDay && end ? end.toZonedDateTimeISO('Europe/Oslo').toPlainDate().toString() : undefined
      items.push({ kind: 'personal', point: Boolean(event.point), transparent: !eventBlocksTime(event), id: event.id, title: event.title, date: day, start: start?.epochMilliseconds, end: end?.epochMilliseconds, ...(start ? { startInstant: start.toString() } : {}), ...(end ? { endInstant: end.toString() } : {}), ...(endDate ? { endDate } : {}), allDay, location: event.location })
    } catch { /* invalid legacy values are not exported */ }
  }
  const timestamp = item => item.start ?? (item.allDay ? Temporal.PlainDate.from(item.due || item.date).toZonedDateTime('Europe/Oslo').toInstant().epochMilliseconds : item.due)
  return items.sort((a, b) => timestamp(a) - timestamp(b) || `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))
}

// RFC DATE-TIME has whole seconds. A selected record is either represented
// exactly or listed as omitted; never round its endpoints or invent duration.
const itemInstants = item => (item.kind === 'deadline' ? [item.dueInstant ?? item.due] : [item.startInstant ?? item.start, ...(item.point ? [] : [item.endInstant ?? item.end])]).filter(value => value !== undefined)
function representableCalendarDates(item) {
  if (!item.allDay || item.kind === 'deadline') return true
  const startValue = item.startInstant ?? item.start, endValue = item.endInstant ?? item.end
  if (startValue === undefined && endValue === undefined) return item.kind === 'personal'
  if (startValue === undefined || endValue === undefined || item.point) return false
  const start = instant(startValue).toZonedDateTimeISO('Europe/Oslo'), end = instant(endValue).toZonedDateTimeISO('Europe/Oslo')
  return start.toPlainTime().equals('00:00') && end.toPlainTime().equals('00:00')
    && start.toPlainDate().toString() === item.date && end.toPlainDate().toString() === item.endDate
    && Temporal.PlainDate.compare(item.endDate, item.date) > 0
}
const fractionalTime = item => !item.allDay && itemInstants(item).some(value => instant(value).epochNanoseconds % 1_000_000_000n !== 0n)
const exactExportTime = item => itemInstants(item).map(value => {
  const time = instant(value)
  return time.toString({ fractionalSecondDigits: time.epochNanoseconds % 1_000_000n === 0n ? 3 : 'auto' })
}).join(' – ')
export const calendarExportTime = item => item.allDay && representableCalendarDates(item) ? `${item.due || item.date}${item.endDate ? ` – ${item.endDate} (sluttdato ikke inkludert)` : ''}` : item.deadlineLocal && item.due === undefined ? item.deadlineLocal : itemInstants(item).map(value => calendarInstantLabel(value, { includeDate: true, forceOffset: true })).join(' – ')
export const calendarExportItems = (state, options = {}) => calendarExportCandidates(state, options).filter(item => !item.omissionReason && representableCalendarDates(item) && !fractionalTime(item))

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

export function calendarExportOmissions(state, options = {}) {
  const { from, to, includeDeadlines = true } = options
  const omitted = []
  for (const task of includeDeadlines ? state.tasks || [] : []) if (task.deadlineLocal) {
    const date = String(task.deadlineLocal).match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (date && ((from && date < from) || (to && date > to))) continue
    try {
      if (task.deadlineLocal.length === 10) Temporal.PlainDate.from(task.deadlineLocal)
      else toInstant(task.deadlineLocal)
    } catch { omitted.push({ ...task, kind: 'deadline', time: task.deadlineLocal, reason: deadlineOmissionReason(task.deadlineLocal) }) }
  }
  for (const item of calendarExportCandidates(state, options)) {
    const reason = [item.omissionReason, !representableCalendarDates(item) ? 'Hele kalenderdager krever midnatt i norsk tid og en senere sluttdato som ikke er inkludert. Heldagsmerkingen stemmer ikke med tidspunktene. Oppføringen utelates fra kopien; de nøyaktige tidspunktene beholdes i planen.' : '', fractionalTime(item) ? 'ICS støtter bare hele sekunder. Oppføringen utelates fra kopien; de nøyaktige tidspunktene beholdes i planen.' : ''].filter(Boolean).join(' ')
    if (reason) omitted.push({ ...item, time: exactExportTime(item), reason })
  }
  return omitted
}

export function generateCalendarIcs(state, options = {}) {
  const lines = ['BEGIN:VCALENDAR', 'PRODID:-//Ajour//Lokal eksport//NO', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Ajour']
  for (const item of calendarExportItems(state, options)) {
    const summary = [item.course ? `[${item.course}]` : '', item.kind === 'deadline' ? 'Frist:' : '', item.title].filter(Boolean).join(' ')
    if (item.kind === 'deadline') lines.push('BEGIN:VEVENT', `UID:${calendarUid(item.kind, item.id)}`, 'DTSTAMP:19700101T000000Z', item.allDay ? `DTSTART;VALUE=DATE:${item.due.replaceAll('-', '')}` : `DTSTART:${utcStamp(item.due)}`, `SUMMARY:${escapeText(summary)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT')
    else if (item.kind === 'personal') lines.push('BEGIN:VEVENT', `UID:${calendarUid(item.kind, item.id)}`, 'DTSTAMP:19700101T000000Z', item.allDay ? `DTSTART;VALUE=DATE:${item.date.replaceAll('-', '')}` : `DTSTART:${utcStamp(item.start)}`, ...(item.endDate ? [`DTEND;VALUE=DATE:${item.endDate.replaceAll('-', '')}`] : item.end !== undefined && !item.allDay ? [`DTEND:${utcStamp(item.end)}`] : []), `SUMMARY:${escapeText(`Egen aktivitet: ${item.title}`)}`, ...(item.location ? [`LOCATION:${escapeText(item.location)}`] : []), `TRANSP:${item.transparent ? 'TRANSPARENT' : 'OPAQUE'}`, 'END:VEVENT')
    else lines.push('BEGIN:VEVENT', `UID:${calendarUid(item.kind, item.id)}`, 'DTSTAMP:19700101T000000Z', item.allDay ? `DTSTART;VALUE=DATE:${item.date.replaceAll('-', '')}` : `DTSTART:${utcStamp(item.start)}`, ...(item.point ? [] : [item.allDay ? `DTEND;VALUE=DATE:${item.endDate.replaceAll('-', '')}` : `DTEND:${utcStamp(item.end)}`]), `TRANSP:${item.transparent ? 'TRANSPARENT' : 'OPAQUE'}`, `SUMMARY:${escapeText(summary)}`, ...(item.location ? [`LOCATION:${escapeText(item.location)}`] : []), 'END:VEVENT')
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
  const link = document.createElement('a'); link.href = url; link.download = options.filename || 'ajour.ics'; link.click()
  queueMicrotask(() => URL.revokeObjectURL(url))
  return source
}
