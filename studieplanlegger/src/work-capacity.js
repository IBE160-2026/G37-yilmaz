import { Temporal } from '@js-temporal/polyfill'
import { toInstant, osloLocal, eventBlocksTime, OSLO, uncertainPersonalTiming } from './planner.js'
import { getRemainingRange, deadlineInstant } from './tasks.js'
import { compareDeadlines } from './deadline.js'
import { taskBlockers } from './task-dependencies.js'
import { capacityPlanningNote, DEFAULT_PLANNING_RULES, validPlanningRules } from './planning-rules.js'

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

export function reservationConflict(value, reservations, floor, breakMs, { lockedOnly = false } = {}) {
  const others = reservations.filter(other => other.sessionId !== value.sessionId && (!lockedOnly || other.locked || value.locked))
  if (others.some(other => Math.max(value.start, other.start, floor) < Math.min(value.end, other.end))) return 'overlap'
  return breakMs > 0 && others.some(other => Math.max(value.start, floor) < other.end + breakMs && value.end + breakMs > other.start) ? 'pause' : null
}

export function reservationWorkIntervals(reservation, floor, deadline, windows, busy = []) {
  const beforeDeadline = { start: Math.max(reservation.start, floor), end: Math.min(reservation.end, deadline) }
  return wholeMinuteIntervals(subtractIntervals(intersectIntervals([beforeDeadline], windows), busy))
}

// Reservations allocate time, never evidence that any work has been performed.
export function deriveWorkCapacity(tasks, sessions = [], now = new Date(), events = [], workWindows, busyWindows = [], planningRules) {
  const warnings = [], known = Boolean(workWindows?.length)
  const uncertainPersonal = events.filter(event => uncertainPersonalTiming(event, now)).length
  if (uncertainPersonal) warnings.push(`${uncertainPersonal} ${uncertainPersonal === 1 ? 'egen aktivitet har' : 'egne aktiviteter har'} ukjent tidspunkt eller varighet. Tiden behandles ikke som sikkert ledig.`)
  const floor = Math.ceil(+now / minute) * minute
  const reservations = sessions.flatMap(session => { try { return [{ ...extendedSessionInterval(session), locked: session.locked }] } catch { warnings.push('En ugyldig studieøkt er utelatt.'); return [] } })
  const activeReservations = reservations.filter(reservation => !tasks.some(task => task.id === reservation.taskId && (task.completed || task.submitted)))
  const breakMs = (planningRules || DEFAULT_PLANNING_RULES).breakMinutes * minute
  const busy = [...busyWindows, ...events.filter(eventBlocksTime)].map(e => ({ start: Date.parse(e.start), end: Date.parse(e.end) }))
  const windows = (workWindows || []).map(windowInterval)
  const future = unionIntervals((known ? windows : reservations).map(i => ({ start: Math.max(i.start, floor), end: i.end })))
  const available = wholeMinuteIntervals(subtractIntervals(future, busy))
  const totalCapacityMinutes = intervalMinutes(available)
  // Manual and review sessions have no task workload, but still occupy time.
  let reservedCovered = intersectIntervals(available, reservations.filter(item => !item.taskId))
  const reservedIntervals = new Map(tasks.map(task => [task.id, []]))
  const entries = tasks.map(task => {
    const range = getRemainingRange(task)
    const calendarReservedMinutes = intervalMinutes(reservations.filter(item => item.taskId === task.id).map(item => ({ start: Math.max(item.start, floor), end: item.end })))
    return { taskId: task.id, requiredMinutes: range?.maxMinutes ?? null, requiredMinMinutes: range?.minMinutes ?? null, requiredMaxMinutes: range?.maxMinutes ?? null,
      allocatedMinutes: 0, reservedMinutes: 0, calendarReservedMinutes, coveredByReservationsMinutes: 0, availableBeforeMinutes: null, missingMinutes: 0, missingMinMinutes: 0, missingMaxMinutes: 0, allocations: [], reasons: [], state: 'unplanned' }
  })
  // Make conflicting reservations explicit and count each minute for at most one task.
  for (const reservation of reservations.filter(r => r.taskId).sort((a, b) => a.start - b.start || a.sessionId.localeCompare(b.sessionId))) {
    const index = tasks.findIndex(t => t.id === reservation.taskId), task = tasks[index], entry = entries[index]
    if (!task) { warnings.push('En reservasjon mangler tilknyttet oppgave.'); continue }
    if (task.completed || task.submitted) { warnings.push('En eldre reservasjon for fullført arbeid bruker ikke kapasitet.'); continue }
    let deadline = Infinity
    try { if (task.deadlineLocal) deadline = deadlineInstant(task.deadlineLocal, task.deadlineDisambiguation) } catch { deadline = -Infinity; entry.reasons.push('Fristen er tvetydig ved tidsskifte. Presiser fristen.'); }
    const occupied = intersectIntervals(available, [reservation])
    const conflict = reservation.end > floor && reservationConflict(reservation, activeReservations, floor, breakMs, { lockedOnly: true })
    const usable = conflict ? [] : reservationWorkIntervals(reservation, floor, deadline, available, reservedCovered)
    if (conflict) entry.reasons.push(conflict === 'overlap' ? 'En låst reservasjon overlapper en annen reservasjon. Kontroller tidene.' : 'En låst reservasjon mangler valgt pause. Kontroller tidene.')
    if (intervalMinutes(intersectIntervals(occupied, reservedCovered))) warnings.push('Overlappende reservasjoner er telt én gang; rediger oppgavevalget eller tidsrommet.')
    if (intervalMinutes(occupied) < intervalMinutes([reservation])) entry.reasons.push('Deler av reservasjonen er passert, opptatt eller utenfor arbeidstiden.')
    reservedCovered = unionIntervals([...reservedCovered, ...occupied])
    entry.reservedMinutes += intervalMinutes(usable)
    reservedIntervals.get(task.id).push(...usable)
    for (const i of usable) entry.allocations.push({ sessionId: reservation.sessionId, startLocal: osloLocal(new Date(i.start).toISOString()), endLocal: osloLocal(new Date(i.end).toISOString()), minutes: intervalMinutes([i]), reserved: true })
  }
  const pauses = activeReservations.filter(item => item.locked || planningRules).map(item => ({ start: item.start - breakMs, end: item.end + breakMs }))
  const free = subtractIntervals(available, [...reservedCovered, ...pauses])
  for (const { task, index } of tasks.map((task, index) => ({ task, index })).sort((a, b) => compareDeadlines(a.task, b.task))) {
    const entry = entries[index], range = getRemainingRange(task), required = range?.maxMinutes ?? range?.minMinutes ?? null
    if (task.completed || task.submitted) { entry.state = 'done'; continue }
    const blockers = taskBlockers(task, tasks)
    if (blockers.length) { entry.state = 'blocked'; entry.missingMinutes = required ?? 0; entry.missingMinMinutes = range?.minMinutes ?? 0; entry.missingMaxMinutes = range?.maxMinutes ?? null; entry.reasons.push(...blockers.map(item => item.reason)); continue }
    if (required === null) { entry.state = 'unknown'; entry.missingMaxMinutes = null; entry.reasons.push('Gjenstående arbeid er ukjent. Legg til et estimat.'); continue }
    const indivisible = task.splittable === false
    const ownReservations = reservations.filter(item => item.taskId === task.id && item.end > floor)
    const reservedFits = indivisible ? ownReservations.length === 1 && Boolean(contiguousWorkInterval(reservedIntervals.get(task.id), required)) : entry.reservedMinutes >= required
    entry.allocatedMinutes = indivisible ? reservedFits ? required : 0 : Math.min(required, entry.reservedMinutes)
    entry.coveredByReservationsMinutes = entry.allocatedMinutes
    let deadline = Infinity
    try { if (task.deadlineLocal) deadline = deadlineInstant(task.deadlineLocal, task.deadlineDisambiguation) } catch { deadline = -Infinity; entry.reasons.push('Fristen er tvetydig eller ugyldig. Ingen tid foreslås.'); }
    if (known && Number.isFinite(deadline)) {
      const beforeDeadline = free.map(item => ({ start: item.start, end: Math.min(item.end, deadline) }))
      entry.availableBeforeMinutes = range.maxMinutes === null && indivisible
        ? Math.max(0, ...[...beforeDeadline, ...reservedIntervals.get(task.id)].map(item => intervalMinutes([item])))
        : entry.reservedMinutes + intervalMinutes(beforeDeadline)
    }
    if (range.maxMinutes === null) {
      entry.state = 'unknown'
      entry.missingMinutes = entry.missingMinMinutes = required - entry.allocatedMinutes
      entry.missingMaxMinutes = null
      if (entry.missingMinMinutes && indivisible) entry.reasons.push(`Minst ${required} min må få plass i én sammenhengende økt.`)
      if (entry.missingMinMinutes) entry.reasons.push(`Minst ${entry.missingMinMinutes} min gjenstår å planlegge.`)
      else if (required > 0) entry.reasons.push('Reserverte økter dekker det kjente minimumet.')
      entry.reasons.push('Øvre grense for gjenstående arbeid er ukjent.')
      continue
    }
    let need = required - entry.allocatedMinutes
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
    entry.missingMinMinutes = Math.max(0, (range?.minMinutes ?? 0) - entry.allocatedMinutes)
    entry.missingMaxMinutes = need
    entry.state = !known && !reservedFits ? 'unknown' : need > 0 ? 'insufficient' : reservedFits ? 'planned' : 'unplanned'
    entry.reasons.push({ unknown: 'Tilgjengelig arbeidstid er ukjent. Registrer arbeidstidsvinduer.', insufficient: `${need} min mangler${task.deadlineLocal ? ' før fristen' : ''} i registrert arbeidstid.`, planned: 'Arbeidet har reservert tid. Oppdater gjenstående arbeid selv etter økten.', unplanned: capacityPlanningNote(planningRules) }[entry.state])
  }
  for (const entry of entries) entry.reasons = [...new Set(entry.reasons)]
  const sum = field => Math.min(Number.MAX_SAFE_INTEGER, entries.reduce((n, e) => n + e[field], 0))
  const openRequired = entries.some(entry => entry.requiredMaxMinutes === null && entry.requiredMinMinutes !== null)
  const openMissing = entries.some(entry => entry.missingMaxMinutes === null && entry.missingMinMinutes !== null)
  return { tasks: entries, known, unknownTaskCount: tasks.filter(task => getRemainingRange(task)?.maxMinutes == null).length, totalCapacityMinutes,
    totalRequiredMinutes: sum('requiredMinutes'), totalRequiredMinMinutes: sum('requiredMinMinutes'), totalRequiredMaxMinutes: openRequired ? null : sum('requiredMinutes'),
    totalAllocatedMinutes: sum('allocatedMinutes'), totalReservedMinutes: intervalMinutes(reservedCovered), totalMissingMinutes: sum('missingMinutes'),
    totalMissingMinMinutes: sum('missingMinMinutes'), totalMissingMaxMinutes: openMissing ? null : sum('missingMaxMinutes'), spareMinutes: intervalMinutes(free), totalLostMinutes: 0, uncertainPersonalCount: uncertainPersonal, warnings: [...new Set(warnings)] }
}
