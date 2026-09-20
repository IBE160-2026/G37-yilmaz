import { Temporal } from '@js-temporal/polyfill'
import { subtractTeaching, osloLocal, toInstant, OSLO } from './planner.js'
import { extendedSessionInterval, deriveWorkCapacity, wholeMinuteIntervals, contiguousWorkInterval } from './work-capacity.js'
import { getRemainingMinutes } from './tasks.js'
import { taskBlockers } from './task-dependencies.js'
import { capacityPlanningNote, validPlanningRules } from './planning-rules.js'
const MINUTE = 60_000
const MAX_MINUTES = Number.MAX_SAFE_INTEGER

function localLabel(date) {
  return osloLocal(date.toISOString())
}

function localDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  if (Number(value.slice(0, 4)) < 1) return null
  try { const date = new Date(Temporal.PlainDateTime.from(value).toZonedDateTime(OSLO, { disambiguation: 'compatible' }).epochMilliseconds); return localLabel(date) === value ? date : null } catch { return null }
}

// Offset-free input cannot distinguish the two occurrences of an autumn clock
// time. Reject either occurrence, even when both session endpoints share offset.
function ambiguousTime(date) {
  try { toInstant(localLabel(date)); return false } catch { return true }
}

function sessionInterval(session) {
  try { return extendedSessionInterval(session) } catch (error) { return { error: error.message } }
}

export function validateSession(session, existingSessions = [], excludeId = null) {
  const interval = sessionInterval(session)
  if (interval.error) return { valid: false, error: interval.error }
  if (!Array.isArray(existingSessions)) return { valid: false, error: 'Listen over studieøkter er ugyldig.' }
  for (const existing of existingSessions) {
    if (excludeId !== null && existing?.id === excludeId) continue
    if (existing?.id === session.id) return { valid: false, error: 'Studieøkten må ha en unik ID.' }
    const other = sessionInterval(existing)
    if (!other.error && interval.start < other.end && other.start < interval.end) {
      return { valid: false, error: 'Studieøkten overlapper en annen økt. Velg et ledig tidsrom.' }
    }
  }
  return { valid: true }
}

export function validSessions(sessions) {
  if (!Array.isArray(sessions)) return false
  const ids = new Set()
  for (const session of sessions) {
    const interval = sessionInterval(session)
    if (interval.error || ids.has(session.id)) return false
    ids.add(session.id)
  }
  // Existing structurally valid overlaps remain readable and repairable. Forms
  // enforce non-overlap for the changed session; the planner counts union once.
  return true
}

function disjointIntervals(sessions, warnings) {
  const ids = new Set()
  let invalid = false
  let overlapping = false
  const intervals = []
  for (const [index, session] of (Array.isArray(sessions) ? sessions : []).entries()) {
    const interval = sessionInterval(session)
    if (interval.error || ids.has(session.id)) {
      invalid = true
      continue
    }
    ids.add(session.id)
    intervals.push({ ...interval, index })
  }
  intervals.sort((a, b) => a.start - b.start || a.index - b.index)
  const result = []
  let coveredUntil = -Infinity
  for (const interval of intervals) {
    if (interval.start < coveredUntil) overlapping = true
    const start = Math.max(interval.start, coveredUntil)
    if (start < interval.end) result.push({ ...interval, start })
    coveredUntil = Math.max(coveredUntil, interval.end)
  }
  if (invalid || !Array.isArray(sessions)) warnings.push('Ugyldige studieøkter eller gjentatte økt-ID-er er utelatt fra beregningen.')
  if (overlapping) warnings.push('Overlappende studieøkter er bare telt én gang. Rediger øktene slik at de ikke overlapper.')
  return result
}

function minutesBefore(intervals, deadline = Infinity) {
  return intervals.reduce((sum, interval) => sum + Math.max(0, Math.floor((Math.min(interval.end, deadline) - interval.start) / MINUTE)), 0)
}

function sumMinutes(entries, field) {
  let total = 0
  for (const entry of entries) {
    if (total > MAX_MINUTES - entry[field]) return MAX_MINUTES
    total += entry[field]
  }
  return total
}

// This is a suggestion only. It never changes tasks, sessions, next steps,
// completion or submission. Next-step estimates are part of the parent work.
export function deriveCapacity(tasks, sessions = [], now = new Date(), events = [], options = {}) {
  if (options.workWindows !== undefined || options.busyWindows !== undefined || (Array.isArray(sessions) && sessions.some(session => session?.taskId || session?.endDateLocal))) return deriveWorkCapacity(tasks, sessions, now, events, options.workWindows, options.busyWindows, options.planningPreferences)
  const warnings = []
  const originalIntervals = disjointIntervals(sessions, warnings)
  const intervals = wholeMinuteIntervals(subtractTeaching(originalIntervals, events))
  const occupiedMinutes = minutesBefore(originalIntervals) - minutesBefore(intervals)
  if (occupiedMinutes > 0) warnings.push(`${occupiedMinutes} min undervisning overlapper studieøktene og er trukket fra kapasiteten.`)
  const validNow = now instanceof Date && Number.isFinite(now.getTime())
  // Subtract the local seconds without setting local clock fields, which could
  // silently jump to the first occurrence of a repeated autumn clock minute.
  const nextMinute = validNow ? now.getTime() - now.getSeconds() * 1000 - now.getMilliseconds() +
    (now.getSeconds() || now.getMilliseconds() ? MINUTE : 0) : Infinity
  if (!validNow) warnings.push('Klokken er ugyldig. Ingen studietid er fordelt.')
  const future = intervals.map(interval => ({ ...interval, start: Math.max(interval.start, nextMinute) }))
    .filter(interval => interval.start < interval.end)
  const totalCapacityMinutes = minutesBefore(future)
  const totalLostMinutes = validNow ? minutesBefore(intervals) - totalCapacityMinutes : 0
  if (totalLostMinutes > 0) warnings.push(`${totalLostMinutes} min av studieøktene er passert eller ligger i et påbegynt minutt, og kan ikke brukes.`)
  const free = future.map(interval => ({ ...interval }))
  const entries = tasks.map(task => ({
    taskId: task.id,
    requiredMinutes: getRemainingMinutes(task),
    allocatedMinutes: 0,
    missingMinutes: 0,
    allocations: [],
    reasons: [],
  }))
  const order = tasks.map((task, index) => ({ task, index }))
    .sort((a, b) => (a.task.deadlineLocal || '9999').localeCompare(b.task.deadlineLocal || '9999') || a.index - b.index)
  for (const { task, index } of order) {
    const entry = entries[index]
    if (task.completed) continue
    if (!Number.isSafeInteger(entry.requiredMinutes) || entry.requiredMinutes < 0) {
      entry.requiredMinutes = 0
      entry.reasons.push(getRemainingMinutes(task) === null ? 'Gjenstående arbeid er ukjent. Legg inn tidsestimat for å beregne kapasitet.' : 'Gjenstående arbeid er ugyldig og må rettes før tiden kan fordeles.')
      continue
    }
    if (entry.requiredMinutes === 0) {
      entry.reasons.push('Gjenstående arbeid er satt til 0 min. Bekreft om oppgaven er fullført.')
      continue
    }
    entry.missingMinutes = entry.requiredMinutes
    const blockers = taskBlockers(task, tasks)
    if (blockers.length) {
      entry.reasons.push(...blockers.map(blocker => blocker.reason), 'Blokkert arbeid er ikke fordelt i frie studieøkter. Avklar forutsetningene, eller bruk Planlegg uken for et forslag med riktig rekkefølge.')
      continue
    }
    const deadlineDate = localDate(task.deadlineLocal)
    if (!deadlineDate || !validNow) {
      entry.reasons.push(!task.deadlineLocal ? 'Ingen frist er registrert. Legg til en frist for å fordele studietid.' : 'Fristen eller klokken er ugyldig. Ingen studietid er fordelt.')
      continue
    }
    const deadline = deadlineDate.getTime()
    if (ambiguousTime(deadlineDate)) entry.reasons.push('Fristen forekommer to ganger ved skiftet til vintertid. Beregningen bruker den første forekomsten.')
    if (deadline <= now.getTime()) {
      entry.reasons.push(`Fristen er nådd eller passert. ${entry.requiredMinutes} min gjenstår; framtidige økter brukes ikke til denne oppgaven.`)
      continue
    }
    const availableBefore = minutesBefore(free, deadline)
    if (task.splittable === false && validPlanningRules(options.planningPreferences) && entry.requiredMinutes > options.planningPreferences.maximumMinutes) {
      entry.reasons.push(`${entry.requiredMinutes} min må holdes samlet, mer enn valgt maksimal øktlengde ${options.planningPreferences.maximumMinutes} min.`)
      continue
    }
    const contiguous = task.splittable === false ? contiguousWorkInterval(free.map(interval => ({ ...interval, end: Math.min(interval.end, deadline) })), entry.requiredMinutes) : null
    if (task.splittable === false && !contiguous) {
      entry.reasons.push(`Arbeidet kan ikke deles: ${entry.requiredMinutes} min må få plass sammenhengende før fristen. Atskilt ledig tid fullfører ikke oppgaven; ${entry.requiredMinutes} min mangler.`)
      continue
    }
    for (const interval of free) {
      if (entry.missingMinutes === 0 || interval.start >= deadline) break
      if (contiguous && (interval.end <= contiguous.start || interval.start >= contiguous.end)) continue
      const available = Math.max(0, Math.floor((Math.min(interval.end, deadline) - interval.start) / MINUTE))
      const minutes = Math.min(entry.missingMinutes, available)
      if (!minutes) continue
      const end = interval.start + minutes * MINUTE
      entry.allocations.push({ sessionId: interval.sessionId, startLocal: localLabel(new Date(interval.start)), endLocal: localLabel(new Date(end)), minutes })
      interval.start = end
      entry.allocatedMinutes += minutes
      entry.missingMinutes -= minutes
    }
    if (entry.missingMinutes > 0) {
      const beforeOtherTasks = minutesBefore(future, deadline)
      if (beforeOtherTasks > availableBefore) {
        entry.reasons.push(`Andre oppgaver med tidligere eller lik frist bruker tid først. ${availableBefore} min er tilgjengelig før denne fristen; ${entry.missingMinutes} min mangler.`)
      } else {
        entry.reasons.push(`Studieøktene gir ${availableBefore} hele framtidige minutter før fristen, men oppgaven trenger ${entry.requiredMinutes} min. ${entry.missingMinutes} min mangler.`)
      }
    }
  }
  const totalRequiredMinutes = sumMinutes(entries, 'requiredMinutes')
  const totalAllocatedMinutes = sumMinutes(entries, 'allocatedMinutes')
  const totalMissingMinutes = sumMinutes(entries, 'missingMinutes')
  if (entries.reduce((sum, entry) => sum + BigInt(entry.requiredMinutes), 0n) > BigInt(MAX_MINUTES)) {
    warnings.push(`Samlet arbeid overstiger ${MAX_MINUTES} min. Totalene for gjenstående og manglende arbeid er begrenset til dette tallet; hver oppgave vises med nøyaktige minutter.`)
  }
  return { tasks: entries, unknownTaskCount: tasks.filter(task => getRemainingMinutes(task) === null).length, totalRequiredMinutes, totalAllocatedMinutes, totalMissingMinutes,
    totalCapacityMinutes, spareMinutes: totalCapacityMinutes - totalAllocatedMinutes, totalLostMinutes, warnings, planningNote: capacityPlanningNote(options.planningPreferences) }
}
