import { createReplan, applyReplan, planningFingerprint } from './replanning.js'
import { getRemainingRange, deadlineInstant } from './tasks.js'
import { extendedSessionInterval, intersectIntervals, intervalMinutes, unionIntervals, windowInterval, subtractIntervals } from './work-capacity.js'
import { eventBlocksTime } from './planner.js'

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze) }
  return value
}
const metrics = preview => ({
  allocatedMinutes: Object.values(preview.allocatedMinutes || {}).reduce((sum, value) => sum + value, 0),
  missingMinMinutes: preview.totalMissingMinMinutes || 0,
  missingMaxMinutes: preview.totalMissingMaxMinutes,
  movedSessions: (preview.changes || []).filter(item => item.original && item.proposed && JSON.stringify(item.original) !== JSON.stringify(item.proposed)).length,
  omittedTasks: Object.keys(preview.deficits || {}).length,
  uncertainty: (preview.problems || []).filter(value => /ukjent|tvetydig|kan mangle|utforsk/i.test(value)),
  reviewSessions: (preview.proposed || []).filter(item => item.reviewKey).length,
  remainingCapacityMinutes: preview.remainingCapacityMinutes ?? Math.max(0, intervalMinutes((preview.availability?.windows || []).map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) }))) - (preview.occupiedMinutes ?? Object.values(preview.allocatedMinutes || {}).reduce((sum, value) => sum + value, 0))),
  deadlineRisk: preview.totalMissingMaxMinutes === null || (preview.totalMissingMaxMinutes || 0) > 0,
})

function currentPlanPreview(state, template, now) {
  const proposed = structuredClone(state.sessions || []), floor = +now, allocatedMinutes = {}, taskIntervals = new Map(), deficits = {}, deficitRanges = {}, problems = (template.problems || []).filter(value => /egen aktivitet|egne aktiviteter|Tilgjengelig studietid/iu.test(value))
  const availability = (template.availability?.windows || state.workWindows || []).map(windowInterval).map(item => ({ start: Math.max(item.start, floor), end: item.end })).filter(item => item.end > item.start)
  const fixedBusy = [...(state.busyWindows || []), ...(state.planner?.events || []).filter(eventBlocksTime)].map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) }))
  const usableAvailability = subtractIntervals(availability, fixedBusy)
  const occupied = []
  const credited = []
  // Taskless reservations consume capacity before any task receives credit.
  for (const session of [...proposed].sort((a, b) => Number(Boolean(a.taskId)) - Number(Boolean(b.taskId)))) {
    try {
      const interval = extendedSessionInterval(session)
      if (interval.end > floor) occupied.push({ start: Math.max(interval.start, floor), end: interval.end })
      const task = state.tasks.find(item => item.id === session.taskId)
      const end = Math.min(interval.end, task?.deadlineLocal ? deadlineInstant(task.deadlineLocal) : Infinity)
      if (task && !task.completed && !task.submitted && end > Math.max(interval.start, floor)) taskIntervals.set(task.id, [...(taskIntervals.get(task.id) || []), ...subtractIntervals([{ start: Math.max(interval.start, floor), end }], credited)])
      credited.push(interval)
    } catch { problems.push('En eksisterende økt har ugyldig tidspunkt og kan ikke regnes som kapasitet.') }
  }
  const occupiedMinutes = intervalMinutes(intersectIntervals(unionIntervals(occupied), usableAvailability))
  for (const [taskId, intervals] of taskIntervals) allocatedMinutes[taskId] = intervalMinutes(intersectIntervals(unionIntervals(intervals), usableAvailability))
  let totalMissingMinMinutes = 0, totalMissingMaxMinutes = 0, openMax = false
  for (const task of state.tasks.filter(item => !item.completed && !item.submitted)) {
    const range = getRemainingRange(task), allocated = allocatedMinutes[task.id] || 0
    if (!range) { problems.push(`«${task.title}» har ukjent arbeidsmengde.`); continue }
    const min = Math.max(0, range.minMinutes - allocated), max = range.maxMinutes === null ? null : Math.max(0, range.maxMinutes - allocated)
    if (min > 0 || max === null || max > 0) { deficits[task.id] = min; deficitRanges[task.id] = { minMinutes: min, maxMinutes: max } }
    totalMissingMinMinutes += min
    if (max === null) openMax = true; else totalMissingMaxMinutes += max
  }
  return { ...template, proposed, changes: [], removedIds: [], allocatedMinutes, occupiedMinutes, remainingCapacityMinutes: Math.max(0, intervalMinutes(usableAvailability) - occupiedMinutes), deficits, deficitRanges, totalMissingMinMinutes, totalMissingMaxMinutes: openMax ? null : totalMissingMaxMinutes, problems }
}

function reducedWindows(windows, fraction) {
  return (windows || []).map(window => {
    const start = Date.parse(window.start), end = Date.parse(window.end)
    return { ...window, end: new Date(start + Math.floor((end - start) * fraction / 60000) * 60000).toISOString() }
  }).filter(window => Date.parse(window.end) > Date.parse(window.start))
}

export function comparePlans(state, { now = new Date(), reducedFraction = 0.75, priorityTaskIds } = {}) {
  if (!Number.isFinite(+now) || !(reducedFraction > 0 && reducedFraction < 1)) return { ok: false, error: 'Sammenligningsgrunnlaget er ugyldig.' }
  const baseline = planningFingerprint(state), createdAt = new Date(now).toISOString()
  const requests = [
    ['current', 'Behold dagens plan', { keep: true }],
    ['reduced', `Redusert kapasitet (${Math.round(reducedFraction * 100)} %)`, { availability: { kind: 'confirmed', label: `${Math.round(reducedFraction * 100)} % av registrert kapasitet`, conditional: true, windows: reducedWindows(state.workWindows, reducedFraction), preferenceAction: 'keep' } }],
    ['priority', 'Valgte prioriterte oppgaver', { priorityTaskIds: Array.isArray(priorityTaskIds) ? [...priorityTaskIds] : [] }],
  ]
  const scenarios = requests.map(([id, label, options]) => {
    const keep = options.keep, preview = createReplan(state, { ...options, keep: undefined, now: new Date(now) })
    const finalPreview = keep && preview.ok ? currentPlanPreview(state, preview, now) : preview
    if (finalPreview.ok && !keep) {
      const sessions = [...(state.sessions || []).filter(item => !finalPreview.removedIds.includes(item.id)), ...finalPreview.proposed]
      const full = currentPlanPreview({ ...state, sessions }, finalPreview, now)
      finalPreview.remainingCapacityMinutes = full.remainingCapacityMinutes
      finalPreview.reviewSessions = sessions.filter(item => item.reviewKey).length
    }
    const values = finalPreview.ok ? metrics(finalPreview) : { error: finalPreview.error }
    if (finalPreview.reviewSessions !== undefined) values.reviewSessions = finalPreview.reviewSessions
    return { id, label, baseline, createdAt, keep, preview: finalPreview, feasible: finalPreview.ok && finalPreview.totalMissingMaxMinutes === 0 && !values.uncertainty?.length, ...values }
  })
  const mutable = scenarios
  const comparable = scenario => JSON.stringify([
    (scenario.preview?.proposed || []).map(({ id, ...session }) => session).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    scenario.preview?.deficitRanges,
  ])
  for (let index = 0; index < mutable.length; index++) {
    const signature = comparable(mutable[index])
    const match = mutable.findIndex((item, other) => other < index && comparable(item) === signature)
    if (match >= 0) mutable[index].identicalTo = mutable[match].id
  }
  return freeze({ ok: true, baseline, createdAt, scenarios: mutable })
}

export function applyComparedPlan(state, comparison, scenarioId, { now = new Date() } = {}) {
  if (!comparison?.ok || comparison.baseline !== planningFingerprint(state)) return { ok: false, stale: true, error: 'Dataene har endret seg. Sammenlign planene på nytt.' }
  const scenario = comparison.scenarios.find(item => item.id === scenarioId)
  if (!scenario?.preview?.ok) return { ok: false, error: 'Dette alternativet kan ikke brukes.' }
  if (scenario.keep) return { ok: true, state: structuredClone(state), unchanged: true, undo: structuredClone(state), scenarioId }
  const applied = applyReplan(state, scenario.preview, { now })
  return applied.ok ? { ...applied, undo: structuredClone(state), scenarioId } : applied
}
