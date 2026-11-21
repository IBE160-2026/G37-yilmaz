import { getRemainingRange, deadlineInstant } from './tasks.js'
import { taskBlockers, validateDependencyGraph } from './task-dependencies.js'
import { DEFAULT_PLANNING_RULES, validPlanningRules } from './planning-rules.js'
import { extendedSessionInterval, unionIntervals, subtractIntervals, wholeMinuteIntervals, windowInterval, intervalMinutes, intersectIntervals, contiguousWorkInterval, validWindows, reservationConflict, reservationWorkIntervals } from './work-capacity.js'
import { eventBlocksTime, osloLocal, uncertainPersonalTiming } from './planner.js'
import { availabilityFor, validStudyTimePreference } from './study-time.js'

const minute = 60000
export const planningFingerprint = state => JSON.stringify([state.tasks, state.sessions, state.workWindows, state.busyWindows, state.planner?.events, state.planningPreferences, state.studyTimePreference])
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
function deadline(task) { return task.deadlineLocal ? deadlineInstant(task.deadlineLocal, task.deadlineDisambiguation) : Infinity }
function deadlineOrder(task) { try { return deadline(task) } catch { return Infinity } }
function fixedBusy(state) {
  return [...(state.busyWindows || []), ...(state.planner?.events || []).filter(eventBlocksTime)].map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) }))
}
export const occupies = (session, state) => !session.taskId || !state.tasks.some(task => task.id === session.taskId && (task.completed || task.submitted))
export const sameSessionTime = (a, b) => a.dateLocal === b.dateLocal && a.startTime === b.startTime && a.endTime === b.endTime && (a.endDateLocal || a.dateLocal) === (b.endDateLocal || b.dateLocal)

function usableExploration(session, sessions, state, { floor, limit, rules, windows, busy }) {
  const value = extendedSessionInterval(session)
  const length = intervalMinutes([value])
  const pause = rules.breakMinutes * minute
  return value.start >= floor && value.end <= limit && length >= rules.minimumMinutes && length <= rules.maximumMinutes
    && (!windows || intervalMinutes(intersectIntervals([value], windows)) === length)
    && !intersectIntervals([value], busy).length
    && !sessions.some(other => {
      if (other.id === session.id || !occupies(other, state)) return false
      const interval = extendedSessionInterval(other)
      return value.start < interval.end + pause && value.end + pause > interval.start
    })
}

export function orderedActiveTasks(tasks, priorityTaskIds = []) {
  const active = tasks.filter(task => !task.completed && !task.submitted), ordered = [], seen = new Set(), byId = new Map(active.map(task => [task.id, task]))
  const selected = new Set(priorityTaskIds)
  for (const first of active.sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || deadlineOrder(a) - deadlineOrder(b) || (b.priority || 2) - (a.priority || 2))) {
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

export function planningBlock(task, tasks, doneAt) {
  const blockers = taskBlockers(task, tasks).filter(item => item.waiting || item.missing || !doneAt.has(item.id))
  if (!blockers.length) return null
  return { taskId: task.id, title: task.title, waiting: blockers.some(item => item.waiting), reason: blockers.map(item => item.reason).join(' ') }
}

// A retained reservation is not evidence that its task can be finished unless
// its prerequisites can precede it and no other task claims the same time.
// Invalid locks stay in the plan, but cannot unlock downstream work.
function retainedWork(task, kept, state, { floor, after, limit, windows, busy, breakMs, windowLabel = 'bekreftet arbeidstid' }) {
  const intervals = [], problems = [], occupied = kept.filter(session => occupies(session, state)).map(extendedSessionInterval)
  for (const session of kept.filter(session => session.taskId === task.id)) {
    const value = extendedSessionInterval(session)
    if (value.end <= floor) continue
    const label = `«${task.title}»: den ${session.locked ? 'låste ' : ''}økten ${session.dateLocal} ${session.startTime}–${session.endTime}`
    const conflict = reservationConflict(value, occupied, floor, breakMs)
    let issue
    if (after > floor && value.start < after) issue = 'starter før forutsetningene har nok reservert tid'
    else if (conflict === 'overlap') issue = 'overlapper en annen reservasjon; samme tid kan ikke brukes til begge'
    else if (conflict === 'pause') issue = 'mangler valgt pause mellom reservasjonene'
    if (issue) { problems.push(`${label} ${issue}. Den er beholdt, men regnes ikke som gjennomførbart arbeid. Juster låsen selv.`); continue }
    const usable = reservationWorkIntervals(value, floor, limit, windows, busy)
    if (value.end > limit) problems.push(`${label} slutter etter oppgavens frist. Økten beholdes, og bare brukbar tid før fristen dekker arbeid.`)
    if (intervalMinutes(usable) < intervalMinutes([{ start: value.start, end: Math.min(value.end, limit) }])) problems.push(`${label} er delvis passert, opptatt eller utenfor ${windowLabel}. Den er beholdt. Kontroller låsen; atskilte deler kan ikke fullføre arbeid som ikke kan deles.`)
    intervals.push(...usable)
  }
  return { intervals: unionIntervals(intervals), problems }
}

export function previewStudyPlan(state, { now = new Date(), rules = state.planningPreferences || DEFAULT_PLANNING_RULES, choice = 'assumption', taskId } = {}) {
  const availability = availabilityFor(state, { now, choice: state.workWindows?.length ? 'saved' : choice })
  const exploratory = Object.fromEntries(state.tasks
    .filter(task => (!taskId || task.id === taskId) && !task.completed && !getRemainingRange(task))
    .map(task => [task.id, rules.sessionMinutes]))
  return createReplan(state, { now, rules, exploratory, availability, taskIds: taskId ? [taskId] : undefined })
}

export function createReplan(state, { now = new Date(), rules = state.planningPreferences || DEFAULT_PLANNING_RULES, exploratory = {}, availability, taskIds, priorityTaskIds = [] } = {}) {
  const problems = [], proposed = [], changes = [], deficits = Object.create(null), deficitRanges = Object.create(null), blockedTasks = []
  const uncertainPersonal = (state.planner?.events || []).filter(event => uncertainPersonalTiming(event, now)).length
  if (uncertainPersonal) problems.push(`${uncertainPersonal} ${uncertainPersonal === 1 ? 'egen aktivitet har' : 'egne aktiviteter har'} ukjent tidspunkt eller varighet. Forslaget kan ikke garantere at denne tiden er ledig.`)
  if (!validPlanningRules(rules)) return { ok: false, error: 'Kontroller lengde og pauser for øktene. Vanlig økt må være mellom minste og lengste økt.' }
  const graph = validateDependencyGraph(state.tasks, { relations: true })
  if (!graph.ok) return graph
  if (!Number.isFinite(+now)) return { ok: false, error: 'Klokken er ugyldig.' }
  const scope = taskIds?.length ? new Set(taskIds) : null
  const active = state.tasks.filter(task => !task.completed && !task.submitted && (!scope || scope.has(task.id)))
  const breakMs = rules.breakMinutes * minute, floor = Math.ceil(+now / minute) * minute
  const sourceWindows = availability?.windows || state.workWindows || []
  const windowLabel = availability?.conditional ? 'de foreslåtte studietidene' : 'bekreftet arbeidstid'
  if (!validWindows(sourceWindows)) return { ok: false, error: 'Studietidene i forslaget er ugyldige.' }
  const windows = sourceWindows.map(windowInterval), busy = fixedBusy(state), sessions = state.sessions || []
  try {
    if (!Array.isArray(sessions) || new Set(sessions.map(session => extendedSessionInterval(session).sessionId)).size !== sessions.length) throw new Error()
  } catch {
    return { ok: false, error: 'Planen inneholder en ugyldig studieøkt eller gjentatt økt-ID. Rett studieøktene og beregn på nytt.' }
  }
  const lockedWindows = availability?.reduced ? (state.workWindows || []).map(windowInterval) : windows
  const reusableExplorations = new Set()
  const movable = sessions.filter(session => {
    const task = active.find(item => item.id === session.taskId)
    if (!task || ((scope || !state.workWindows?.length) && taskBlockers(task, state.tasks).length)) return false
    const unknown = !getRemainingRange(task)
    if (unknown && !Object.hasOwn(exploratory, task.id)) return false
    if (unknown && usableExploration(session, sessions, state, { floor, limit: deadlineOrder(task), rules, windows: state.workWindows?.length ? lockedWindows : null, busy })) {
      reusableExplorations.add(session.id)
      return false
    }
    return !session.locked
  })
  const kept = sessions.filter(session => !movable.some(item => item.id === session.id))
  const occupied = kept.filter(session => occupies(session, state)).map(extendedSessionInterval).map(item => ({ start: item.start - breakMs, end: item.end + breakMs }))
  let free = wholeMinuteIntervals(subtractIntervals(windows.map(item => ({ start: Math.max(floor, item.start), end: item.end })), [...busy, ...occupied]))
  const retainedMinutes = Object.create(null)
  if (!sourceWindows.length) problems.push('Tilgjengelig studietid er ukjent. Velg vanlig studietid eller registrer detaljerte arbeidstidsvinduer.')
  const doneAt = new Map(state.tasks.filter(task => task.completed || task.submitted).map(task => [task.id, floor]))
  for (const task of orderedActiveTasks(active, priorityTaskIds)) {
    const remainingRange = getRemainingRange(task), blocked = planningBlock(task, state.tasks, doneAt)
    if (blocked) {
      const range = remainingRange || { minMinutes: 0, maxMinutes: null }
      blockedTasks.push(blocked)
      if (range.maxMinutes !== 0) {
        deficits[task.id] = range.maxMinutes ?? range.minMinutes
        deficitRanges[task.id] = range
      }
      problems.push(`«${task.title}»: ${blocked.reason} Ingen startklar tid foreslås før hindringen er avklart.`)
      continue
    }
    let limit
    try { limit = deadline(task) } catch { problems.push(`«${task.title}»: fristen er tvetydig ved tidsskifte. Presiser den.`); continue }
    let after = Math.max(floor, ...(task.dependencyIds || []).map(id => doneAt.get(id) || floor))
    // An open upper bound still leaves a known minimum to schedule.
    const remaining = remainingRange?.maxMinutes ?? (remainingRange?.minMinutes || null), exploration = Object.hasOwn(exploratory, task.id) ? exploratory[task.id] : null
    const validExploration = Number.isSafeInteger(exploration) && exploration >= rules.minimumMinutes && exploration <= rules.maximumMinutes
    if (remaining === 0) { problems.push(`«${task.title}»: 0 min er registrert. Bekreft arbeidsstatus selv.`); continue }
    const retainedSessions = kept.filter(session => session.taskId === task.id)
    const locked = retainedSessions.map(extendedSessionInterval).filter(item => item.end > floor)
    // An explicitly reserved exploration can be kept even if the only study
    // windows shown are conditional suggestions for new work.
    const retainedWindows = state.workWindows?.length ? lockedWindows : [...lockedWindows, ...retainedSessions.filter(session => reusableExplorations.has(session.id)).map(extendedSessionInterval)]
    const retained = retainedWork(task, kept, state, { floor, after, limit, windows: retainedWindows, busy, breakMs, windowLabel })
    problems.push(...retained.problems)
    const retainedDuration = intervalMinutes(retained.intervals)
    if (remaining === null && !validExploration) {
      retainedMinutes[task.id] = retainedDuration
      deficitRanges[task.id] = { minMinutes: 0, maxMinutes: null }
      problems.push(`«${task.title}»: gjenstående arbeid er ukjent. ${exploration === null ? 'Bruk Planlegg uken for å foreslå en utforskende økt.' : 'Velg en lengde innenfor øktreglene.'} Fullføring kan ikke beregnes.`)
      continue
    }
    const target = remaining ?? (retainedDuration >= rules.minimumMinutes ? retainedDuration : exploration)
    const openEnded = remainingRange?.maxMinutes === null
    const reserved = task.splittable === false
      ? locked.length === 1 && contiguousWorkInterval(retained.intervals, target) ? retainedDuration : 0
      : retainedDuration
    retainedMinutes[task.id] = reserved
    let need = Math.max(0, target - reserved), endAt = Math.max(after, ...retained.intervals.map(item => item.end))
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
        changes.push({ taskId: task.id, title: task.title, original: original || null, proposed: session, exploratory: remaining === null, dependencyNote: task.dependencyIds?.length ? 'Forutsetningene må være fullført før arbeidet starter. Tidene bygger på registrerte estimater.' : '', deadlineLocal: task.deadlineLocal || '', ...(task.deadlineDisambiguation ? { deadlineDisambiguation: task.deadlineDisambiguation } : {}) })
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
    for (const removed of old.slice(used.length)) changes.push({ taskId: task.id, title: task.title, original: removed, proposed: null, deadlineLocal: task.deadlineLocal || '', ...(task.deadlineDisambiguation ? { deadlineDisambiguation: task.deadlineDisambiguation } : {}) })
    const allocated = reserved + intervalMinutes(used.map(extendedSessionInterval))
    if (remaining === null) {
      deficitRanges[task.id] = { minMinutes: 0, maxMinutes: null }
      if (need > 0) problems.push(`«${task.title}»: det mangler sammenhengende tid til en utforskende økt på ${target} min. Endre tilgjengelig tid eller øktlengde og pauser.`)
      else if (reserved > 0) problems.push(`«${task.title}»: behold registrert økt på ${reserved} min. Gjenstående arbeid er ukjent.`)
      continue
    }
    const minimumNeed = Math.max(0, remainingRange.minMinutes - allocated)
    if (need > 0 || minimumNeed > 0 || openEnded) {
      deficits[task.id] = need
      deficitRanges[task.id] = { minMinutes: minimumNeed, maxMinutes: openEnded ? null : need }
      const amount = openEnded ? minimumNeed ? `minst ${minimumNeed} min mangler; øvre grense er ukjent` : 'mer arbeid kan gjenstå; øvre grense er ukjent' : minimumNeed === need ? `${need} min mangler` : minimumNeed ? `${minimumNeed}–${need} min mangler` : `opptil ${need} min kan mangle`
      problems.push(`«${task.title}»: ${amount}${task.deadlineLocal ? ' før fristen' : ''} innen ${windowLabel}, pauser og øktregler.`)
    }
    else if (remaining !== null) doneAt.set(task.id, endAt)
  }
  for (const old of movable) if (!changes.some(change => change.original?.id === old.id)) {
    const task = state.tasks.find(item => item.id === old.taskId)
    changes.push({ taskId: task.id, title: task.title, original: old, proposed: null, deadlineLocal: task.deadlineLocal || '', ...(task.deadlineDisambiguation ? { deadlineDisambiguation: task.deadlineDisambiguation } : {}) })
  }
  if (breakMs && !problems.some(message => message.includes('mangler valgt pause'))) {
    const locks = kept.filter(session => session.locked && occupies(session, state)).map(extendedSessionInterval).filter(item => item.end > floor).sort((a, b) => a.start - b.start)
    if (locks.some((item, index) => index > 0 && item.start >= locks[index - 1].end && item.start - locks[index - 1].end < breakMs)) {
      problems.push(`Pausekonflikt mellom låste økter. Valgt pause er ${rules.breakMinutes} min. Øktene er beholdt.`)
    }
  }
  if (!problems.some(message => message.includes('overlapper en annen reservasjon'))) {
    const locks = kept.filter(session => session.locked && occupies(session, state)).map(extendedSessionInterval)
    if (locks.some(item => item.end > floor && reservationConflict(item, locks, floor, 0) === 'overlap')) {
      problems.push('Låst økt overlapper en annen reservasjon. Øktene beholdes.')
    }
  }
  if (proposed.length >= 500) problems.push('Forslaget er avgrenset til 500 økter. Gjenstående arbeid er fortsatt oppgitt; del opp planleggingsperioden før du planlegger videre.')
  const allocatedMinutes = Object.fromEntries(active.map(task => [task.id, intervalMinutes(proposed.filter(item => item.taskId === task.id).map(extendedSessionInterval))]))
  const totalMissingMinMinutes = Object.values(deficitRanges).reduce((sum, value) => sum + value.minMinutes, 0)
  const totalMissingMinutes = Object.values(deficits).reduce((sum, value) => sum + value, 0)
  const openMissing = Object.values(deficitRanges).some(value => value.maxMinutes === null)
  return { ok: true, baseline: planningFingerprint(state), createdAt: now.toISOString(), rules: { ...rules }, exploratory: { ...exploratory }, allocatedMinutes, retainedMinutes, deficits, deficitRanges,
    totalMissingMinutes, totalMissingMinMinutes, totalMissingMaxMinutes: openMissing ? null : totalMissingMinutes, proposed, removedIds: movable.map(item => item.id), changes, problems, blockedTasks,
    known: availability?.kind === 'confirmed' || !availability && Boolean(state.workWindows?.length), availability: availability ? structuredClone(availability) : { kind: 'confirmed', label: 'Registrert tilgjengelig tid', conditional: false, windows: structuredClone(sourceWindows), preferenceAction: 'keep' }, taskIds: scope ? [...scope] : null }
}

export function applyReplan(state, preview, { now = new Date() } = {}) {
  if (!Number.isFinite(+now)) return { ok: false, error: 'Klokken er ugyldig.' }
  if (!preview?.ok || preview.baseline !== planningFingerprint(state)) return { ok: false, stale: true, error: 'Dataene har endret seg. Beregn et nytt forslag før du godtar.' }
  if (!validPlanningRules(preview.rules)) return { ok: false, error: 'Ugyldige øktregler.' }
  if (!Array.isArray(preview.removedIds) || !Array.isArray(preview.proposed) || new Set(preview.removedIds).size !== preview.removedIds.length) return { ok: false, error: 'Planforslaget er ugyldig. Beregn et nytt forslag før du godtar.' }
  const kept = (state.sessions || []).filter(session => !preview.removedIds.includes(session.id)), intervals = []
  const sourceWindows = preview.availability?.windows || state.workWindows || []
  const windowLabel = preview.availability?.conditional ? 'de foreslåtte studietidene' : 'bekreftet arbeidstid'
  if (!validWindows(sourceWindows)) return { ok: false, error: 'Studietidene i forslaget er ugyldige.' }
  if (preview.availability?.preferenceAction === 'set' && !validStudyTimePreference(preview.availability.preference)) return { ok: false, error: 'Studietidspreferansen er ugyldig.' }
  const windows = unionIntervals(sourceWindows.map(windowInterval)), busy = fixedBusy(state), rules = preview.rules
  const lockedWindows = preview.availability?.reduced ? (state.workWindows || []).map(windowInterval) : windows
  try {
    if (preview.removedIds.some(id => !(state.sessions || []).some(item => item.id === id && item.taskId && !item.locked && state.tasks.some(task => task.id === item.taskId && !task.completed && !task.submitted)))) throw new Error('En låst eller uvedkommende reservasjon kan ikke fjernes.')
    if (new Set(preview.proposed.map(item => item.id)).size !== preview.proposed.length) throw new Error('To foreslåtte økter har samme ID.')
    for (const session of preview.proposed) {
      const task = state.tasks.find(item => item.id === session.taskId), value = extendedSessionInterval(session), length = (value.end - value.start) / minute
      const original = (state.sessions || []).find(item => item.id === session.id)
      if (original && original.taskId !== session.taskId) throw new Error('En eksisterende økt-ID kan ikke knyttes til en annen oppgave.')
      if (!task || task.completed || task.submitted || task.waitingReason || taskBlockers(task, state.tasks).some(item => item.missing)) throw new Error('En oppgave er fullført eller blokkert. Beregn på nytt.')
      if (value.start < Math.ceil(+now / minute) * minute) return { ok: false, stale: true, error: 'Et foreslått starttidspunkt er passert. Beregn på nytt.' }
      if (length < rules.minimumMinutes || length > rules.maximumMinutes || value.end > deadline(task)) throw new Error('Økten bryter lengderegelen eller går forbi fristen.')
      if (intervalMinutes(intersectIntervals([value], windows)) !== length || intervalMinutes(intersectIntervals([value], busy))) throw new Error(`Økten ligger utenfor ${windowLabel} eller overlapper opptatt tid.`)
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
      const retained = retainedWork(task, kept, state, { floor, after, limit, windows: lockedWindows, busy, breakMs: rules.breakMinutes * minute, windowLabel })
      const available = [...own, ...retained.intervals], need = getRemainingRange(task)?.maxMinutes ?? null
      const reservationCount = own.length + kept.filter(item => item.taskId === task.id && extendedSessionInterval(item).end > +now).length
      const finishable = task.splittable === false ? reservationCount === 1 && contiguousWorkInterval(available, need) : intervalMinutes(available) >= need
      if (need !== null && need > 0 && finishable) doneAt.set(task.id, Math.max(after, ...available.map(item => item.end)))
      if (own.length && task.splittable === false && reservationCount > 1) throw new Error('Oppgaven kan ikke deles i flere økter.')
    }
    const next = { ...state, sessions: [...kept, ...structuredClone(preview.proposed)], planningPreferences: { ...rules } }
    if (preview.availability?.preferenceAction === 'set') next.studyTimePreference = structuredClone(preview.availability.preference)
    else if (preview.availability?.preferenceAction === 'clear') delete next.studyTimePreference
    return { ok: true, state: next }
  } catch (error) { return { ok: false, error: error.message } }
}

export function replanMoveAlternatives(state, preview, sessionId, { now = new Date(), limit = 3 } = {}) {
  if (!preview?.ok || preview.baseline !== planningFingerprint(state)) return []
  const current = preview.proposed.find(item => item.id === sessionId)
  if (!current) return []
  let value
  try { value = extendedSessionInterval(current) } catch { return [] }
  const duration = value.end - value.start, floor = Math.ceil(+now / minute) * minute, results = [], seen = new Set()
  for (const source of preview.availability?.windows || state.workWindows || []) {
    const interval = windowInterval(source)
    let start = Math.ceil(Math.max(floor, interval.start) / (15 * minute)) * 15 * minute
    for (; start + duration <= interval.end && results.length < limit; start += 30 * minute) {
      if (start === value.start || seen.has(start)) continue
      const candidate = sessionFrom(current.id, current.taskId, start, start + duration, preview.rules)
      if (!candidate) continue
      const draft = structuredClone(preview), index = draft.proposed.findIndex(item => item.id === sessionId)
      draft.proposed[index] = candidate
      if (!applyReplan(state, draft, { now }).ok) continue
      seen.add(start); results.push(candidate)
    }
    if (results.length >= limit) break
  }
  return results
}
