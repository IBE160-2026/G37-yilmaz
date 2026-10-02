import { Temporal } from '@js-temporal/polyfill'
import { OSLO, osloLocal, toInstant, matchesCourse } from './planner.js'
import { extendedSessionInterval } from './work-capacity.js'
import { isExamEvent } from './event-kind.js'

export const calendarToday = (now = new Date()) => osloLocal(now.toISOString()).slice(0, 10)
export const addDays = (date, days) => Temporal.PlainDate.from(date).add({ days }).toString()
export function dayBounds(date) {
  const start = Temporal.PlainDate.from(date).toZonedDateTime(OSLO)
  return { start: start.epochMilliseconds, end: start.add({ days: 1 }).epochMilliseconds }
}
export function calendarRange(date, view, weekMode = 'full') {
  const day = Temporal.PlainDate.from(date)
  if (view === 'day') return [date]
  const start = view === 'month' ? day.with({ day: 1 }).subtract({ days: day.with({ day: 1 }).dayOfWeek - 1 }) : view === 'week' ? day.subtract({ days: day.dayOfWeek - 1 }) : day
  return Array.from({ length: view === 'month' ? 42 : view === 'week' ? weekMode === 'workweek' ? 5 : 7 : 31 }, (_, i) => start.add({ days: i }).toString())
}
export function calendarEntries({ tasks = [], sessions = [], planner = {}, workWindows = [], busyWindows = [] }) {
  const courseCode = courseId => (planner.courses || []).find(course => course.id === courseId)?.code || ''
  const entries = (planner.events || []).filter(e => !e.deleted).map(e => {
    if (e.activityKind !== 'personal') return { ...e, isExam: isExamEvent(e), courseCode: courseCode(e.courseId), key: `event:${e.id}`, kind: e.transparent || e.information || e.transparency === 'TRANSPARENT' ? 'information' : 'teaching', start: Date.parse(e.start), end: Date.parse(e.end) }
    const bounds = dayBounds(e.dateLocal), start = e.start ? Date.parse(e.start) : bounds.start, end = e.end ? Date.parse(e.end) : start
    return { ...e, key: `event:${e.id}`, kind: 'personal', courseCode: '', start, end, point: !e.end, allDay: !e.start, timingPrecision: e.end ? 'interval' : e.start ? 'start' : 'date' }
  })
  for (const task of tasks.filter(t => t.deadlineLocal)) {
    let start, warning = ''
    const allDay = task.deadlineLocal.length === 10
    try { start = allDay ? dayBounds(task.deadlineLocal).start : Date.parse(toInstant(task.deadlineLocal)) } catch { warning = 'Fristen har et tvetydig eller ugyldig klokkeslett i norsk tid. Rediger for å presisere.' }
    entries.push({ ...task, courseCode: courseCode(task.courseId), key: `task:${task.id}`, kind: 'deadline', point: true, allDay, start, end: start, local: task.deadlineLocal, warning, done: task.completed && (!task.requiresSubmission || task.submitted) })
  }
  for (const session of sessions) {
    try { const interval = extendedSessionInterval(session), task = tasks.find(t => t.id === session.taskId); entries.push({ ...session, ...interval, key: `session:${session.id}`, kind: 'session', title: task ? `Studieøkt: ${task.title}` : 'Studieøkt', courseId: task?.courseId, courseCode: courseCode(task?.courseId), course: task?.course }) } catch { /* Invalid legacy input stays in the editor. */ }
  }
  for (const [kind, values] of [['work', workWindows], ['busy', busyWindows]]) for (const value of values) entries.push({ ...value, start: Date.parse(value.start), end: Date.parse(value.end), kind, key: `${kind}:${value.id}`, title: value.label || (kind === 'work' ? 'Arbeidstid' : 'Opptatt') })
  return entries
}
export function entriesForDay(entries, date, filters = {}) {
  const bounds = dayBounds(date)
  return entries.filter(e => matchesCourse(e, filters.courseId, { code: filters.courseCode, name: filters.courseName }) && (!filters.kinds || filters.kinds.includes(e.kind)) && (filters.cancelled || !e.cancelled) && (filters.completed || !e.done) && (e.warning ? e.local.slice(0, 10) === date : e.point ? e.start >= bounds.start && e.start < bounds.end : e.start < bounds.end && e.end > bounds.start))
    .map(e => ({ ...e, clippedStart: Math.max(e.start ?? bounds.start, bounds.start), clippedEnd: Math.min(e.end ?? bounds.start, bounds.end) }))
    .sort((a, b) => a.clippedStart - b.clippedStart || a.clippedEnd - b.clippedEnd || a.key.localeCompare(b.key))
}
export function collisionLanes(entries) {
  const result = [], cluster = []; let clusterEnd = -Infinity
  const finish = () => { const count = Math.max(1, ...cluster.map(e => e.lane + 1)); for (const e of cluster) e.lanes = count; cluster.length = 0 }
  for (const entry of entries) {
    if (entry.clippedStart >= clusterEnd) { finish(); clusterEnd = -Infinity }
    let lane = 0
    while (cluster.some(e => e.lane === lane && e.clippedEnd > entry.clippedStart)) lane++
    const item = { ...entry, lane, lanes: 1 }; result.push(item); cluster.push(item)
    clusterEnd = Math.max(clusterEnd, entry.clippedEnd)
  }
  finish(); return result
}
export function timeLabel(entry) {
  if (entry.warning) return `${entry.local.slice(11)} (må presiseres)`
  const stamp = time => osloLocal(new Date(time).toISOString()).slice(11)
  if (entry.kind === 'personal' && entry.timingPrecision === 'date') return 'Tid ikke oppgitt'
  if (entry.kind === 'personal' && entry.timingPrecision === 'start') return `${stamp(entry.start)} · Varighet ikke oppgitt`
  if (entry.kind === 'deadline' && entry.allDay) return 'Frist – klokkeslett ikke oppgitt'
  if (entry.allDay) return 'Hele dagen'
  if (entry.point) return `Frist kl. ${stamp(entry.start)}`
  const start = Temporal.Instant.fromEpochMilliseconds(entry.start).toZonedDateTimeISO(OSLO), end = Temporal.Instant.fromEpochMilliseconds(entry.end).toZonedDateTimeISO(OSLO)
  const repeated = zone => zone.hour === 2 && zone.startOfDay().add({ days: 1 }).epochMilliseconds - zone.startOfDay().epochMilliseconds > 86400000
  return start.offset !== end.offset || repeated(start) || repeated(end) ? `${stamp(entry.start)} (${start.offset})–${stamp(entry.end)} (${end.offset})` : `${stamp(entry.start)}–${stamp(entry.end)}`
}
