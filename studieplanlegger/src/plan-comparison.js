import { createReplan, applyReplan, orderedActiveTasks, planningBlock, planningFingerprint, occupies, sameSessionTime } from './replanning.js'
import { getRemainingRange, deadlineInstant } from './tasks.js'
import { extendedSessionInterval, intersectIntervals, intervalMinutes, unionIntervals, wholeMinuteIntervals, windowInterval, subtractIntervals } from './work-capacity.js'
import { eventBlocksTime } from './planner.js'

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze) }
  return value
}
function metrics(preview, tasks, keep) {
  const blockedTasks = preview.blockedTasks || []
  const blockedIds = new Set(blockedTasks.map(task => task.taskId))
  const omittedIds = new Set(Object.entries(preview.deficitRanges || {})
    .filter(([taskId, range]) => range.minMinutes > 0 || range.maxMinutes > 0 || blockedIds.has(taskId))
    .map(([taskId]) => taskId))
  const newOrMovableMinutes = keep ? 0 : Object.values(preview.allocatedMinutes || {}).reduce((sum, value) => sum + value, 0)
  const retainedMinutes = Object.values(preview.retainedMinutes || {}).reduce((sum, value) => sum + value, 0)
  const allocatedMinutes = retainedMinutes + newOrMovableMinutes
  return {
    allocatedMinutes,
    newOrMovableMinutes,
    retainedMinutes,
    missingMinMinutes: preview.totalMissingMinMinutes || 0,
    missingMaxMinutes: preview.totalMissingMaxMinutes,
    movedSessions: (preview.changes || []).filter(item => item.original && item.proposed && !sameSessionTime(item.original, item.proposed)).length,
    omittedTasks: omittedIds.size,
    blockedTasks,
    uncertainty: (preview.problems || []).filter(value => /ukjent|tvetydig|kan mangle|utforsk/i.test(value)),
    pauseWarnings: (preview.problems || []).filter(value => /pausekonflikt|mangler valgt pause/i.test(value)),
    reviewSessions: (preview.proposed || []).filter(item => item.reviewKey).length,
    remainingCapacityMinutes: preview.remainingCapacityMinutes ?? Math.max(0, intervalMinutes((preview.availability?.windows || []).map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) }))) - (preview.occupiedMinutes ?? allocatedMinutes)),
    deadlineRisk: tasks.some(task => task.deadlineLocal && omittedIds.has(task.id)),
  }
}

function completionTime(intervals, minutes, splittable) {
  let remaining = minutes * 60000
  for (const { start, end } of intervals) {
    if (end - start >= remaining) return start + remaining
    if (splittable !== false) remaining -= end - start
  }
  return null
}

function currentPlanPreview(state, template, now) {
  const proposed = structuredClone(state.sessions || []), floor = Math.ceil(+now / 60000) * 60000, retainedMinutes = Object.create(null), taskIntervals = new Map(), deficits = Object.create(null), deficitRanges = Object.create(null), problems = (template.problems || []).filter(value => /^(?:\d+ (?:egen aktivitet|egne aktiviteter)|Tilgjengelig studietid)/u.test(value))
  const availability = (template.availability?.windows || state.workWindows || []).map(windowInterval).map(item => ({ start: Math.max(item.start, floor), end: item.end })).filter(item => item.end > item.start)
  const fixedBusy = [...(state.busyWindows || []), ...(state.planner?.events || []).filter(eventBlocksTime)].map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) }))
  const usableAvailability = subtractIntervals(availability, fixedBusy)
  const occupied = []
  const credited = []
  const futureReservations = new Map()
  const pause = template.rules.breakMinutes * 60000
  const conflictingLocks = new Set()
  const reservationIntervals = []
  // Taskless reservations consume capacity before any task receives credit.
  for (const session of [...proposed].sort((a, b) => Number(Boolean(a.taskId)) - Number(Boolean(b.taskId)))) {
    try {
      if (!occupies(session, state)) continue
      const interval = extendedSessionInterval(session)
      if (interval.end > floor) {
        occupied.push({ start: Math.max(interval.start, floor), end: interval.end })
        reservationIntervals.push({ ...interval, locked: session.locked })
      }
      const task = state.tasks.find(item => item.id === session.taskId)
      const end = Math.min(interval.end, task?.deadlineLocal ? deadlineInstant(task.deadlineLocal, task.deadlineDisambiguation) : Infinity)
      if (task && !task.completed && !task.submitted && interval.end > floor) {
        futureReservations.set(task.id, (futureReservations.get(task.id) || 0) + 1)
        const start = Math.max(interval.start, floor)
        if (end > start) {
          const credit = subtractIntervals([{ start, end }], credited).map(item => ({ ...item, reservationStart: interval.start, sessionId: session.id }))
          taskIntervals.set(task.id, [...(taskIntervals.get(task.id) || []), ...credit])
        }
      }
      credited.push(interval)
    } catch { problems.push('En eksisterende økt har ugyldig tidspunkt og kan ikke regnes som kapasitet.') }
  }
  for (const item of reservationIntervals) {
    if (pause > 0 && reservationIntervals.some(other => other.sessionId !== item.sessionId && item.start < other.end + pause && item.end + pause > other.start)) {
      if (item.locked) conflictingLocks.add(item.sessionId)
      const warning = `Pausekonflikt: minst én reservasjon mangler valgt pause på ${template.rules.breakMinutes} min. Øktene kan beholdes.`
      if (!problems.includes(warning)) problems.push(warning)
    }
  }
  const occupiedMinutes = intervalMinutes(intersectIntervals(unionIntervals(occupied), usableAvailability))
  const blockedTasks = [], doneAt = new Map(state.tasks.filter(task => task.completed || task.submitted).map(task => [task.id, floor]))
  let totalMissingMinMinutes = 0, totalMissingMinutes = 0, openMax = false
  for (const task of orderedActiveTasks(state.tasks)) {
    const blocked = planningBlock(task, state.tasks, doneAt)
    const range = getRemainingRange(task) || { minMinutes: 0, maxMinutes: null }
    const after = Math.max(floor, ...(task.dependencyIds || []).map(id => doneAt.get(id) || floor))
    const intervals = (taskIntervals.get(task.id) || []).filter(interval => !conflictingLocks.has(interval.sessionId) && (after === floor || interval.reservationStart >= after))
    const usable = blocked ? [] : wholeMinuteIntervals(intersectIntervals(intervals, usableAvailability))
    const minimum = range.maxMinutes ?? range.minMinutes
    const needsWholeReservation = task.splittable === false && minimum > 0
    const fitsReservationCount = !needsWholeReservation || futureReservations.get(task.id) === 1
    const end = minimum > 0 && fitsReservationCount ? completionTime(usable, minimum, task.splittable) : null
    const allocated = needsWholeReservation && end === null ? 0 : intervalMinutes(usable)
    if (taskIntervals.has(task.id)) retainedMinutes[task.id] = allocated
    if (blocked) {
      blockedTasks.push(blocked)
      problems.push(`«${task.title}»: ${blocked.reason}`)
    }
    if (!getRemainingRange(task)) problems.push(`«${task.title}» har ukjent arbeidsmengde.`)
    const min = Math.max(0, range.minMinutes - allocated), max = range.maxMinutes === null ? null : Math.max(0, range.maxMinutes - allocated)
    if (min > 0 || max === null || max > 0) { deficits[task.id] = max ?? min; deficitRanges[task.id] = { minMinutes: min, maxMinutes: max } }
    totalMissingMinMinutes += min
    totalMissingMinutes += max ?? min
    if (max === null) openMax = true
    if (range.maxMinutes !== null && end !== null) doneAt.set(task.id, end)
  }
  return { ...template, proposed, changes: [], removedIds: [], allocatedMinutes: retainedMinutes, retainedMinutes, occupiedMinutes, remainingCapacityMinutes: Math.max(0, intervalMinutes(usableAvailability) - occupiedMinutes), deficits, deficitRanges, totalMissingMinutes, totalMissingMinMinutes, totalMissingMaxMinutes: openMax ? null : totalMissingMinutes, problems, blockedTasks }
}

function reducedWindows(windows, fraction) {
  return (windows || []).map(window => {
    const start = Date.parse(window.start), end = Date.parse(window.end)
    return { ...window, end: new Date(start + Math.floor((end - start) * fraction / 60000) * 60000).toISOString() }
  }).filter(window => Date.parse(window.end) > Date.parse(window.start))
}

export function comparePlans(state, { now = new Date(), reducedFraction = 0.75, priorityTaskIds, rules } = {}) {
  if (!Number.isFinite(+now) || !(reducedFraction > 0 && reducedFraction < 1)) return { ok: false, error: 'Sammenligningsgrunnlaget er ugyldig.' }
  const baseline = planningFingerprint(state), createdAt = new Date(now).toISOString()
  const requests = [
    ['current', 'Behold dagens plan', { keep: true }],
    ['reduced', `Redusert kapasitet (${Math.round(reducedFraction * 100)} %)`, { availability: { kind: 'confirmed', label: `${Math.round(reducedFraction * 100)} % av registrert kapasitet`, conditional: true, reduced: true, windows: reducedWindows(state.workWindows, reducedFraction), preferenceAction: 'keep' } }],
    ['priority', 'Valgte prioriterte oppgaver', { priorityTaskIds: Array.isArray(priorityTaskIds) ? [...priorityTaskIds] : [] }],
  ]
  const scenarios = requests.map(([id, label, options]) => {
    const keep = options.keep, preview = createReplan(state, { ...options, keep: undefined, now: new Date(now), rules })
    const finalPreview = keep && preview.ok ? currentPlanPreview(state, preview, now) : preview
    let sessions = state.sessions || []
    if (finalPreview.ok && !keep) {
      sessions = [...sessions.filter(item => !finalPreview.removedIds.includes(item.id)), ...finalPreview.proposed]
      const full = currentPlanPreview({ ...state, sessions }, finalPreview, now)
      finalPreview.remainingCapacityMinutes = full.remainingCapacityMinutes
      finalPreview.reviewSessions = sessions.filter(item => item.reviewKey).length
    }
    const values = finalPreview.ok ? metrics(finalPreview, state.tasks, keep) : { error: finalPreview.error }
    if (finalPreview.reviewSessions !== undefined) values.reviewSessions = finalPreview.reviewSessions
    return { id, label, baseline, createdAt, keep, preview: finalPreview, sessions, feasible: finalPreview.ok && values.missingMaxMinutes === 0 && !values.blockedTasks.length && !values.uncertainty.length && !values.pauseWarnings.length, ...values }
  })
  const mutable = scenarios
  const comparable = scenario => JSON.stringify([
    scenario.sessions.map(session => JSON.stringify([session.taskId, session.dateLocal, session.startTime, session.endDateLocal || session.dateLocal, session.endTime, Boolean(session.locked), session.reviewKey])).sort(),
    Object.entries(scenario.preview?.deficitRanges || {}).sort(([a], [b]) => a.localeCompare(b)),
    scenario.blockedTasks?.slice().sort((a, b) => a.taskId.localeCompare(b.taskId)),
    scenario.remainingCapacityMinutes,
  ])
  for (let index = 0; index < mutable.length; index++) {
    const signature = comparable(mutable[index])
    const match = mutable.findIndex((item, other) => other < index && comparable(item) === signature)
    if (match >= 0) mutable[index].identicalTo = mutable[match].id
  }
  return freeze(structuredClone({ ok: true, baseline, createdAt, scenarios: mutable.map(({ sessions, ...scenario }) => scenario) }))
}

export function applyComparedPlan(state, comparison, scenarioId, { now = new Date() } = {}) {
  if (!comparison?.ok || comparison.baseline !== planningFingerprint(state)) return { ok: false, stale: true, error: 'Dataene har endret seg. Sammenlign planene på nytt.' }
  const scenario = comparison.scenarios.find(item => item.id === scenarioId)
  if (!scenario?.preview?.ok) return { ok: false, error: 'Dette alternativet kan ikke brukes.' }
  if (scenario.keep) return { ok: true, state: structuredClone(state), unchanged: true, undo: structuredClone(state), scenarioId }
  const applied = applyReplan(state, scenario.preview, { now })
  return applied.ok ? { ...applied, undo: structuredClone(state), scenarioId } : applied
}
