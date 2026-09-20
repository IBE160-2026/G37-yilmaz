import { Temporal } from '@js-temporal/polyfill'
import { toInstant, osloLocal, eventBlocksTime, OSLO } from './planner.js'
import { getRemainingMinutes } from './tasks.js'
import { taskBlockers } from './task-dependencies.js'
import { capacityPlanningNote, validPlanningRules } from './planning-rules.js'

const minute = 60000
export function windowInterval(value) {
  const start = Date.parse(value?.start), end = Date.parse(value?.end)
  if (!value || typeof value.id !== 'string' || !value.id.trim() || !/(Z|[+-]\d\d:\d\d)$/.test(value.start) || !/(Z|[+-]\d\d:\d\d)$/.test(value.end) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Oppgi et gyldig tidsrom med slutt etter start.')
  return { start, end, id: value.id }
}
export function validWindows(values) {
  try { return Array.isArray(values) && new Set(values.map(value => value.id)).size === values.length && values.every(value => Boolean(windowInterval(value))) } catch { return false }
}
export function validateWorkWindow(draft) {
  try {
    const value = { id: draft.id || crypto.randomUUID(), label: draft.label?.trim() || '', start: toInstant(draft.startLocal), end: toInstant(draft.endLocal) }
    windowInterval(value)
    return value
  } catch { throw new Error('Oppgi start og slutt i norsk tid. Slutt må være senere; et tvetydig eller manglende klokkeslett ved tidsskifte må presiseres.') }
}
export function extendedSessionInterval(session) {
  if (!session || Array.isArray(session) || typeof session.id !== 'string' || !session.id.trim()) throw new Error('Studieøkten må ha en gyldig, unik ID.')
  if (![session.dateLocal, session.endDateLocal ?? session.dateLocal].every(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(date.slice(0, 4)) >= 1) || ![session.startTime, session.endTime].every(time => typeof time === 'string' && /^\d{2}:\d{2}$/.test(time))) throw new Error('Velg gyldige datoer og klokkeslett med timer og minutter.')
  const start = Date.parse(toInstant(`${session.dateLocal}T${session.startTime}`))
  const end = Date.parse(toInstant(`${session.endDateLocal || session.dateLocal}T${session.endTime}`))
  if (!session.id?.trim() || end <= start || (session.taskId !== undefined && typeof session.taskId !== 'string')) throw new Error('Slutt må være etter start. Velg sluttdato for en økt over midnatt.')
  if (session.locked !== undefined && typeof session.locked !== 'boolean') throw new Error('Låsing av studieøkten må være et valg.')
  if (!session.endDateLocal && Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO(OSLO).offset !== Temporal.Instant.fromEpochMilliseconds(end).toZonedDateTimeISO(OSLO).offset) throw new Error('Oppgi eksplisitt sluttdato for en økt som krysser sommer- eller vintertid.')
  return { start, end, sessionId: session.id, taskId: session.taskId }
}
export function unionIntervals(intervals) {
  const result = []
  for (const item of intervals.filter(i => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start).map(i => ({ start: i.start, end: i.end })).sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = result.at(-1)
    if (last && last.end >= item.start) last.end = Math.max(last.end, item.end)
    else result.push(item)
  }
  return result
}
export function subtractIntervals(windows, busy) {
  let free = unionIntervals(windows)
  for (const cut of unionIntervals(busy)) free = free.flatMap(item => cut.end <= item.start || cut.start >= item.end ? [item] : [cut.start > item.start ? { start: item.start, end: cut.start } : null, cut.end < item.end ? { start: cut.end, end: item.end } : null].filter(Boolean))
  return free
}
export const intersectIntervals = (a, b) => unionIntervals(a.flatMap(x => b.map(y => ({ start: Math.max(x.start, y.start), end: Math.min(x.end, y.end) }))))
export const intervalMinutes = intervals => Math.floor(unionIntervals(intervals).reduce((sum, item) => sum + item.end - item.start, 0) / minute)
export const wholeMinuteIntervals = intervals => intervals.map(item => ({ ...item, start: Math.ceil(item.start / minute) * minute, end: Math.floor(item.end / minute) * minute })).filter(item => item.end > item.start)

export const contiguousWorkInterval = (intervals, minutes) => unionIntervals(wholeMinuteIntervals(intervals)).find(item => (item.end - item.start) / minute >= minutes)

// Reservations allocate time, never evidence that any work has been performed.
export function deriveWorkCapacity(tasks, sessions = [], now = new Date(), events = [], workWindows, busyWindows = [], planningRules) {
  const warnings = [], known = Boolean(workWindows?.length)
  const floor = Math.ceil(+now / minute) * minute
  const reservations = sessions.flatMap(session => { try { return [extendedSessionInterval(session)] } catch { warnings.push('En ugyldig studieøkt er utelatt.'); return [] } })
  const busy = [...busyWindows, ...events.filter(eventBlocksTime)].map(e => ({ start: Date.parse(e.start), end: Date.parse(e.end) }))
  const windows = (workWindows || []).map(windowInterval)
  const future = unionIntervals((known ? windows : reservations).map(i => ({ start: Math.max(i.start, floor), end: i.end })))
  const available = wholeMinuteIntervals(subtractIntervals(future, busy))
  const totalCapacityMinutes = intervalMinutes(available)
  let reservedCovered = [], free = available
  const reservedIntervals = new Map(tasks.map(task => [task.id, []]))
  const entries = tasks.map(task => ({ taskId: task.id, requiredMinutes: getRemainingMinutes(task) ?? 0, allocatedMinutes: 0, reservedMinutes: 0, missingMinutes: 0, allocations: [], reasons: [], state: 'unplanned' }))
  // Make conflicting reservations explicit and count each minute for at most one task.
  for (const reservation of reservations.filter(r => r.taskId).sort((a, b) => a.start - b.start || a.sessionId.localeCompare(b.sessionId))) {
    const index = tasks.findIndex(t => t.id === reservation.taskId), task = tasks[index], entry = entries[index]
    if (!task) { warnings.push('En reservasjon mangler tilknyttet oppgave.'); continue }
    if (task.completed || task.submitted) { warnings.push('En eldre reservasjon for fullført arbeid bruker ikke kapasitet.'); continue }
    let deadline = Infinity
    try { if (task.deadlineLocal) deadline = Date.parse(toInstant(task.deadlineLocal)) } catch { deadline = -Infinity; entry.reasons.push('Fristen er tvetydig ved tidsskifte. Presiser fristen.'); }
    const occupied = intersectIntervals(available, [reservation])
    const usable = subtractIntervals(intersectIntervals(available, [{ ...reservation, end: Math.min(reservation.end, deadline) }]), reservedCovered)
    if (intervalMinutes(intersectIntervals(occupied, reservedCovered))) warnings.push('Overlappende reservasjoner er telt én gang; rediger oppgavevalget eller tidsrommet.')
    if (intervalMinutes(occupied) < intervalMinutes([reservation])) entry.reasons.push('Deler av reservasjonen er passert, opptatt eller utenfor arbeidstiden.')
    reservedCovered = unionIntervals([...reservedCovered, ...occupied])
    entry.reservedMinutes += intervalMinutes(usable)
    reservedIntervals.get(task.id).push(...usable)
    for (const i of usable) entry.allocations.push({ sessionId: reservation.sessionId, startLocal: osloLocal(new Date(i.start).toISOString()), endLocal: osloLocal(new Date(i.end).toISOString()), minutes: intervalMinutes([i]), reserved: true })
  }
  free = subtractIntervals(available, reservedCovered)
  for (const { task, index } of tasks.map((task, index) => ({ task, index })).sort((a, b) => (a.task.deadlineLocal || '9999').localeCompare(b.task.deadlineLocal || '9999'))) {
    const entry = entries[index], required = getRemainingMinutes(task)
    if (task.completed || task.submitted) { entry.state = 'done'; continue }
    const blockers = taskBlockers(task, tasks)
    if (blockers.length) { entry.state = 'blocked'; entry.missingMinutes = required ?? 0; entry.reasons.push(...blockers.map(item => item.reason)); continue }
    if (required === null) { entry.state = 'unknown'; entry.reasons.push('Gjenstående arbeid er ukjent. Legg til et estimat.'); continue }
    const indivisible = task.splittable === false
    const ownReservations = reservations.filter(item => item.taskId === task.id && item.end > floor)
    const reservedFits = indivisible ? ownReservations.length === 1 && Boolean(contiguousWorkInterval(reservedIntervals.get(task.id), required)) : entry.reservedMinutes >= required
    entry.allocatedMinutes = indivisible ? reservedFits ? required : 0 : Math.min(required, entry.reservedMinutes)
    let need = required - entry.allocatedMinutes, deadline = Infinity
    try { if (task.deadlineLocal) deadline = Date.parse(toInstant(task.deadlineLocal)) } catch { deadline = -Infinity; entry.reasons.push('Fristen er tvetydig eller ugyldig. Ingen tid foreslås.'); }
    const retainedReservation = ownReservations.length > 0
    if (indivisible && need > 0) entry.reasons.push(`Arbeidet kan ikke deles: ${required} min må få plass sammenhengende${retainedReservation ? '. Kontroller reservasjonene; atskilte deler kan ikke fullføre oppgaven' : ''}.`)
    const exceedsMaximum = indivisible && need > 0 && validPlanningRules(planningRules) && need > planningRules.maximumMinutes
    if (exceedsMaximum) entry.reasons.push(`${need} min må holdes samlet, mer enn valgt maksimal øktlengde ${planningRules.maximumMinutes} min.`)
    if (known && !exceedsMaximum && !(indivisible && retainedReservation)) for (const interval of free) {
      const availableMinutes = Math.max(0, Math.floor((Math.min(deadline, interval.end) - interval.start) / minute))
      const take = indivisible && availableMinutes < need ? 0 : Math.min(need, availableMinutes)
      if (!take) continue
      entry.allocations.push({ startLocal: osloLocal(new Date(interval.start).toISOString()), endLocal: osloLocal(new Date(interval.start + take * minute).toISOString()), minutes: take, reserved: false })
      interval.start += take * minute; need -= take; entry.allocatedMinutes += take
    }
    entry.missingMinutes = need
    entry.state = !known && !reservedFits ? 'unknown' : need > 0 ? 'insufficient' : reservedFits ? 'planned' : 'unplanned'
    entry.reasons.push({ unknown: 'Tilgjengelig arbeidstid er ukjent. Registrer arbeidstidsvinduer.', insufficient: `${need} min mangler før fristen i registrert arbeidstid.`, planned: 'Arbeidet har reservert tid. Oppdater gjenstående arbeid selv etter økten.', unplanned: capacityPlanningNote(planningRules) }[entry.state])
  }
  const sum = field => Math.min(Number.MAX_SAFE_INTEGER, entries.reduce((n, e) => n + e[field], 0))
  return { tasks: entries, known, unknownTaskCount: tasks.filter(task => getRemainingMinutes(task) === null).length, totalCapacityMinutes, totalRequiredMinutes: sum('requiredMinutes'), totalAllocatedMinutes: sum('allocatedMinutes'), totalReservedMinutes: intervalMinutes(reservedCovered), totalMissingMinutes: sum('missingMinutes'), spareMinutes: intervalMinutes(free), totalLostMinutes: 0, warnings: [...new Set(warnings)] }
}
