import { getRemainingMinutes } from './tasks.js'
import { taskBlockers, validateDependencyGraph } from './task-dependencies.js'
import { DEFAULT_PLANNING_RULES, validPlanningRules } from './planning-rules.js'
import { extendedSessionInterval, unionIntervals, subtractIntervals, wholeMinuteIntervals, windowInterval, intervalMinutes, intersectIntervals, contiguousWorkInterval } from './work-capacity.js'
import { eventBlocksTime, osloLocal, toInstant } from './planner.js'

const minute = 60000
export const planningFingerprint = state => JSON.stringify([state.tasks, state.sessions, state.workWindows, state.busyWindows, state.planner?.events, state.planningPreferences])
function sessionFrom(id, taskId, start, end, rules) {
  const a = osloLocal(new Date(start).toISOString()), b = osloLocal(new Date(end).toISOString())
  const session = { id, taskId, dateLocal: a.slice(0, 10), startTime: a.slice(11, 16), endDateLocal: b.slice(0, 10), endTime: b.slice(11, 16), locked: false, planningRules: { ...rules } }
  // The stored local fields have no offset. Both endpoints must round-trip to
  // the exact proposed instants, including a session crossing a clock change.
  try {
    const represented = extendedSessionInterval(session)
    return represented.start === start && represented.end === end ? session : null
  } catch { return null }
}
function deadline(task) { return task.deadlineLocal ? Date.parse(toInstant(task.deadlineLocal)) : Infinity }
function fixedBusy(state) {
  return [...(state.busyWindows || []), ...(state.planner?.events || []).filter(eventBlocksTime)].map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) }))
}
const occupies = (session, state) => !session.taskId || !state.tasks.some(task => task.id === session.taskId && (task.completed || task.submitted))

function orderedActiveTasks(tasks) {
  const active = tasks.filter(task => !task.completed && !task.submitted), ordered = [], seen = new Set(), byId = new Map(active.map(task => [task.id, task]))
  for (const first of active.sort((a, b) => (a.deadlineLocal || '9999').localeCompare(b.deadlineLocal || '9999') || (b.priority || 2) - (a.priority || 2))) {
    const stack = [{ task: first, after: false }]
    while (stack.length) {
      const { task, after } = stack.pop()
      if (after) { ordered.push(task); continue }
      if (seen.has(task.id)) continue
      seen.add(task.id); stack.push({ task, after: true })
      for (const id of [...(task.dependencyIds || [])].reverse()) if (byId.has(id)) stack.push({ task: byId.get(id), after: false })
    }
  }
  return ordered
}

// A retained reservation is not evidence that its task can be finished unless
// its prerequisites can precede it and no other task claims the same time.
// Invalid locks stay in the plan, but cannot unlock downstream work.
function retainedWork(task, kept, state, { floor, after, limit, windows, busy, breakMs }) {
  const intervals = [], problems = [], occupied = kept.filter(session => occupies(session, state)).map(extendedSessionInterval)
  for (const session of kept.filter(session => session.taskId === task.id)) {
    const value = extendedSessionInterval(session)
    if (value.end <= floor) continue
    const label = `«${task.title}»: den låste økten ${session.dateLocal} ${session.startTime}–${session.endTime}`
    let issue
    if (after > floor && value.start < after) issue = 'starter før forutsetningene har nok reservert tid'
    else if (occupied.some(other => other.sessionId !== value.sessionId && other.taskId !== task.id && Math.max(value.start, floor) < other.end && Math.max(other.start, floor) < value.end)) issue = 'overlapper en annen reservasjon; samme tid kan ikke brukes til begge'
    else if (occupied.some(other => other.sessionId !== value.sessionId && value.start < other.end + breakMs && value.end + breakMs > other.start)) issue = 'mangler valgt pause mellom reservasjonene'
    else if (value.end > limit) issue = 'slutter etter oppgavens frist'
    if (issue) { problems.push(`${label} ${issue}. Den er beholdt, men regnes ikke som gjennomførbart arbeid. Juster låsen selv.`); continue }
    const usable = wholeMinuteIntervals(subtractIntervals(intersectIntervals([{ ...value, start: Math.max(value.start, floor) }], windows), busy))
    if (intervalMinutes(usable) < intervalMinutes([value])) problems.push(`${label} er delvis passert, opptatt eller utenfor bekreftet arbeidstid. Den er beholdt. Kontroller låsen; atskilte deler kan ikke fullføre arbeid som ikke kan deles.`)
    intervals.push(...usable)
  }
  return { intervals: unionIntervals(intervals), problems }
}

export function createReplan(state, { now = new Date(), rules = state.planningPreferences || DEFAULT_PLANNING_RULES, exploratory = {} } = {}) {
  const problems = [], proposed = [], changes = []
  if (!validPlanningRules(rules)) return { ok: false, error: 'Kontroller lengde og pauser for øktene.' }
  const graph = validateDependencyGraph(state.tasks, { relations: true })
  if (!graph.ok) return graph
  if (!Number.isFinite(+now)) return { ok: false, error: 'Klokken er ugyldig.' }
  const active = state.tasks.filter(task => !task.completed && !task.submitted)
  const movable = (state.sessions || []).filter(session => session.taskId && !session.locked && active.some(task => task.id === session.taskId))
  const kept = (state.sessions || []).filter(session => !movable.some(item => item.id === session.id))
  const breakMs = rules.breakMinutes * minute, floor = Math.ceil(+now / minute) * minute
  const occupied = kept.filter(session => occupies(session, state)).map(extendedSessionInterval).map(item => ({ start: item.start - breakMs, end: item.end + breakMs }))
  let free = wholeMinuteIntervals(subtractIntervals((state.workWindows || []).map(windowInterval).map(item => ({ start: Math.max(floor, item.start), end: item.end })), [...fixedBusy(state), ...occupied]))
  if (!state.workWindows?.length) problems.push('Tilgjengelig arbeidstid er ukjent. Registrer og bekreft arbeidstidsvinduer før nye økter kan foreslås.')
  const doneAt = new Map(state.tasks.filter(task => task.completed || task.submitted).map(task => [task.id, floor]))
  for (const task of orderedActiveTasks(state.tasks)) {
    let limit
    try { limit = deadline(task) } catch { problems.push(`«${task.title}»: fristen er tvetydig ved tidsskifte. Presiser den.`); continue }
    const blockers = taskBlockers(task, state.tasks)
    if (blockers.some(item => item.waiting || item.missing || !doneAt.has(item.id))) { problems.push(`«${task.title}»: ${blockers.map(item => item.reason).join(' ')} Ingen startklar tid foreslås.`); continue }
    let after = Math.max(floor, ...(task.dependencyIds || []).map(id => doneAt.get(id) || floor))
    const remaining = getRemainingMinutes(task), exploration = exploratory[task.id]
    if (remaining === null && !(Number.isSafeInteger(exploration) && exploration >= rules.minimumMinutes && exploration <= rules.maximumMinutes)) { problems.push(`«${task.title}»: gjenstående arbeid er ukjent. Velg en utforskende økt eller oppgi et estimat; fullføring kan ikke beregnes.`); continue }
    if (remaining === 0) { problems.push(`«${task.title}»: 0 min er registrert. Bekreft arbeidsstatus selv.`); continue }
    const locked = kept.filter(session => session.taskId === task.id).map(extendedSessionInterval).filter(item => item.end > floor)
    const retained = retainedWork(task, kept, state, { floor, after, limit, windows: (state.workWindows || []).map(windowInterval), busy: fixedBusy(state), breakMs })
    problems.push(...retained.problems)
    const reserved = task.splittable === false
      ? locked.length === 1 && contiguousWorkInterval(retained.intervals, remaining ?? exploration) ? intervalMinutes(retained.intervals) : 0
      : intervalMinutes(retained.intervals)
    let need = Math.max(0, (remaining ?? exploration) - reserved), endAt = Math.max(after, ...retained.intervals.map(item => item.end))
    const old = movable.filter(item => item.taskId === task.id), used = []
    if (task.splittable === false && locked.length && (need > 0 || locked.length > 1)) problems.push(`«${task.title}»: arbeidet kan ikke deles. Kontroller den låste reservasjonen før du legger til en ny økt.`)
    else if (task.splittable === false && need > rules.maximumMinutes) problems.push(`«${task.title}»: ${need} min må holdes samlet, mer enn valgt maksimal øktlengde ${rules.maximumMinutes} min.`)
    else while (need > 0 && proposed.length < 500) {
      let placed = false
      for (const slot of free) {
        let start = Math.max(slot.start, after)
        const available = Math.floor((Math.min(slot.end, limit) - start) / minute)
        const length = task.splittable === false ? Math.max(rules.minimumMinutes, need) : Math.max(rules.minimumMinutes, Math.min(need, rules.sessionMinutes, rules.maximumMinutes, available))
        if (length > available || length > rules.maximumMinutes) continue
        const original = old[used.length], id = original?.id || crypto.randomUUID()
        let end = start + length * minute, session = sessionFrom(id, task.id, start, end, rules)
        if (!session) {
          const problem = `«${task.title}»: et foreslått klokkeslett forekommer to ganger ved skiftet til vintertid. Velg en økt utenfor den gjentatte klokketimeperioden, eller et tidsrom med entydig start og slutt. Tvetydige økter er ikke foreslått.`
          if (!problems.includes(problem)) problems.push(problem)
          // Keep looking inside this window: later unambiguous time is still
          // usable, and a representable crossing must not discard the whole day.
          while (!session && end + minute <= Math.min(slot.end, limit)) {
            start += minute; end += minute; session = sessionFrom(id, task.id, start, end, rules)
          }
          if (!session) continue
        }
        proposed.push(session); used.push(session)
        changes.push({ taskId: task.id, title: task.title, original: original || null, proposed: session, exploratory: remaining === null, dependencyNote: task.dependencyIds?.length ? 'Forutsetningene må være fullført før arbeidet starter. Tidene bygger på registrerte estimater.' : '', deadlineLocal: task.deadlineLocal || '' })
        // A break can cross into a separately registered work window. Reserve
        // both sides against the complete free set before placing any next task.
        free = wholeMinuteIntervals(subtractIntervals(free, [{ start: start - breakMs, end: end + breakMs }]))
        after = end + breakMs; endAt = Math.max(endAt, end)
        need = Math.max(0, need - length)
        placed = true
        break
      }
      if (!placed) break
    }
    for (const removed of old.slice(used.length)) changes.push({ taskId: task.id, title: task.title, original: removed, proposed: null, deadlineLocal: task.deadlineLocal || '' })
    if (need > 0) problems.push(`«${task.title}»: ${need} min mangler${task.deadlineLocal ? ' før fristen' : ''} innen bekreftet arbeidstid, pauser og øktregler.`)
    else if (remaining !== null) doneAt.set(task.id, endAt)
  }
  for (const old of movable) if (!changes.some(change => change.original?.id === old.id)) {
    const task = state.tasks.find(item => item.id === old.taskId)
    changes.push({ taskId: task.id, title: task.title, original: old, proposed: null, deadlineLocal: task.deadlineLocal || '' })
  }
  if (proposed.length >= 500) problems.push('Forslaget er avgrenset til 500 økter. Gjenstående arbeid er fortsatt oppgitt; del opp planleggingsperioden før du planlegger videre.')
  const allocatedMinutes = Object.fromEntries(active.map(task => [task.id, intervalMinutes(proposed.filter(item => item.taskId === task.id).map(extendedSessionInterval))]))
  return { ok: true, baseline: planningFingerprint(state), createdAt: now.toISOString(), rules: { ...rules }, exploratory: { ...exploratory }, allocatedMinutes, proposed, removedIds: movable.map(item => item.id), changes, problems, known: Boolean(state.workWindows?.length) }
}

export function applyReplan(state, preview, { now = new Date() } = {}) {
  if (!Number.isFinite(+now)) return { ok: false, error: 'Klokken er ugyldig.' }
  if (!preview?.ok || preview.baseline !== planningFingerprint(state)) return { ok: false, stale: true, error: 'Dataene har endret seg. Beregn et nytt forslag før du godtar.' }
  if (!validPlanningRules(preview.rules)) return { ok: false, error: 'Ugyldige øktregler.' }
  const kept = (state.sessions || []).filter(session => !preview.removedIds.includes(session.id)), intervals = []
  const windows = unionIntervals((state.workWindows || []).map(windowInterval)), busy = fixedBusy(state), rules = preview.rules
  try {
    if (preview.removedIds.some(id => !(state.sessions || []).some(item => item.id === id && item.taskId && !item.locked && state.tasks.some(task => task.id === item.taskId && !task.completed && !task.submitted)))) throw new Error('En låst eller uvedkommende reservasjon kan ikke fjernes.')
    if (new Set(preview.proposed.map(item => item.id)).size !== preview.proposed.length) throw new Error('To foreslåtte økter har samme ID.')
    for (const session of preview.proposed) {
      const task = state.tasks.find(item => item.id === session.taskId), value = extendedSessionInterval(session), length = (value.end - value.start) / minute
      if (!task || task.completed || task.submitted || task.waitingReason || taskBlockers(task, state.tasks).some(item => item.missing)) throw new Error('En oppgave er fullført eller blokkert. Beregn på nytt.')
      if (value.start < Math.ceil(+now / minute) * minute) return { ok: false, stale: true, error: 'Et foreslått starttidspunkt er passert. Beregn på nytt.' }
      if (length < rules.minimumMinutes || length > rules.maximumMinutes || value.end > deadline(task)) throw new Error('Økten bryter lengderegelen eller går forbi fristen.')
      if (intervalMinutes(intersectIntervals([value], windows)) !== length || intervalMinutes(intersectIntervals([value], busy))) throw new Error('Økten ligger utenfor bekreftet arbeidstid eller overlapper opptatt tid.')
      const others = [...kept.filter(session => occupies(session, state)).map(extendedSessionInterval), ...intervals]
      if (others.some(other => value.start < other.end + rules.breakMinutes * minute && value.end + rules.breakMinutes * minute > other.start)) throw new Error('Øktene overlapper eller mangler valgt pause.')
      if (kept.some(other => other.id === session.id)) throw new Error('Økt-ID-en finnes allerede.')
      intervals.push(value)
    }
    const floor = Math.ceil(+now / minute) * minute
    const doneAt = new Map(state.tasks.filter(task => task.completed || task.submitted).map(task => [task.id, floor]))
    for (const task of orderedActiveTasks(state.tasks)) {
      const own = intervals.filter(item => item.taskId === task.id)
      if (intervalMinutes(own) < (preview.allocatedMinutes?.[task.id] || 0)) throw new Error(`«${task.title}»: de redigerte øktene gir mindre tid enn forhåndsvisningen. Beregn et nytt forslag med ønsket øktlengde, slik at manglende arbeid vises før du godtar.`)
      const blockers = taskBlockers(task, state.tasks)
      if (blockers.some(item => item.waiting || item.missing || !doneAt.has(item.id))) {
        if (own.length) throw new Error(`«${task.title}»: en forutsetning har ikke nok gjennomførbar reservert tid. Kontroller også låste økter før du beregner på nytt.`)
        continue
      }
      const after = Math.max(floor, ...(task.dependencyIds || []).map(id => doneAt.get(id) || floor))
      if (own.some(item => item.start < after)) throw new Error('En forutsetning har ikke nok reservert tid før denne oppgaven.')
      let limit
      try { limit = deadline(task) } catch (error) { if (own.length) throw error; continue }
      const retained = retainedWork(task, kept, state, { floor, after, limit, windows, busy, breakMs: rules.breakMinutes * minute })
      const available = [...own, ...retained.intervals], need = getRemainingMinutes(task)
      const reservationCount = own.length + kept.filter(item => item.taskId === task.id && extendedSessionInterval(item).end > +now).length
      const finishable = task.splittable === false ? reservationCount === 1 && contiguousWorkInterval(available, need) : intervalMinutes(available) >= need
      if (need !== null && need > 0 && finishable) doneAt.set(task.id, Math.max(after, ...available.map(item => item.end)))
      if (own.length && task.splittable === false && reservationCount > 1) throw new Error('Oppgaven kan ikke deles i flere økter.')
    }
    return { ok: true, state: { ...state, sessions: [...kept, ...structuredClone(preview.proposed)], planningPreferences: { ...rules } } }
  } catch (error) { return { ok: false, error: error.message } }
}
