import { Temporal } from '@js-temporal/polyfill'
import { validateSession } from './capacity.js'
import { extendedSessionInterval, subtractIntervals } from './work-capacity.js'
import { eventBlocksTime, uncertainPersonalTiming } from './planner.js'

const clean = value => typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= 2000
const isoInstant = value => { try { Temporal.Instant.from(value); return typeof value === 'string' } catch { return false } }
const isoDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  try { return Temporal.PlainDate.from(value).toString() === value } catch { return false }
}

export function validTopics(topics) {
  if (!Array.isArray(topics)) return false
  const ids = new Set()
  return topics.every(topic => topic && clean(topic.id) && !ids.has(topic.id) && ids.add(topic.id) && clean(topic.title) &&
    (topic.courseId === undefined || clean(topic.courseId)) && (topic.taskId === undefined || clean(topic.taskId)) &&
    (topic.reviewSuggestionsDisabled === undefined || typeof topic.reviewSuggestionsDisabled === 'boolean') &&
    (topic.examDate === undefined || isoDate(topic.examDate)) &&
    (topic.sourceExcerpt === undefined || typeof topic.sourceExcerpt === 'string' && topic.sourceExcerpt.length <= 2000))
}

export function validAssessments(values, state) {
  if (!Array.isArray(values)) return false
  const ids = new Set()
  return values.every(value => {
    if (!value) return false
    const related = !state || state.topics?.some(topic => topic.id === value.topicId) &&
      (!value.sessionId || state.sessions?.some(session => session.id === value.sessionId) || state.workLogs?.some(log => log.sessionId === value.sessionId))
    return clean(value.id) && !ids.has(value.id) && ids.add(value.id) && clean(value.topicId) &&
      Number.isInteger(value.rating) && value.rating >= 1 && value.rating <= 5 && isoInstant(value.assessedAt) &&
      (value.sessionId === undefined || clean(value.sessionId)) &&
      (value.note === undefined || typeof value.note === 'string' && value.note.length <= 2000) && related
  })
}

export function validReviewDecisions(values, state) {
  if (!Array.isArray(values)) return false
  const ids = new Set(), keys = new Set()
  return values.every(value => value && clean(value.id) && !ids.has(value.id) && ids.add(value.id) && clean(value.reviewKey) && !keys.has(value.reviewKey) && keys.add(value.reviewKey) &&
    clean(value.assessmentId) && ['approved', 'adjusted', 'deferred', 'rejected'].includes(value.status) && isoInstant(value.decidedAt) &&
    (value.sessionId === undefined || clean(value.sessionId)) && (value.deferUntil === undefined || isoDate(value.deferUntil)) &&
    (!state || state.assessments?.some(item => item.id === value.assessmentId && value.reviewKey === reviewKey(item))))
}

export const reviewKey = assessment => `review:${assessment.topicId}:${assessment.id}`

export function hasCompletedReviewSession(state, decision) {
  const matches = session => session?.id === decision.sessionId && session.reviewKey === decision.reviewKey && session.reviewTopicId === state.assessments?.find(item => item.id === decision.assessmentId)?.topicId
  return Boolean(decision.sessionId && state.workLogs?.some(log => log.sessionId === decision.sessionId && log.outcome === 'done' && matches(log.sessionSnapshot)))
}

export const hasReviewSession = (state, decision) => Boolean(decision.sessionId && (state.sessions?.some(session => session.id === decision.sessionId && session.reviewKey === decision.reviewKey) || hasCompletedReviewSession(state, decision)))

const isAssessmentContext = (state, decision) => Boolean(decision.sessionId && state.assessments?.some(value => value.sessionId === decision.sessionId))

// Explicit assessment edits/deletion remove its decision. A session used by a
// remaining assessment keeps its identity and context, with only the obsolete
// decision key detached. Historical work-log snapshots are never rewritten.
export function removeAssessmentReview(state, assessmentId) {
  const removedKeys = new Set((state.reviewDecisions || []).filter(value => value.assessmentId === assessmentId).map(value => value.reviewKey))
  const next = { ...state }
  if (state.reviewDecisions) next.reviewDecisions = state.reviewDecisions.filter(value => !removedKeys.has(value.reviewKey))
  if (state.sessions) next.sessions = state.sessions.flatMap(session => {
    if (!removedKeys.has(session.reviewKey)) return [session]
    if (!(state.assessments || []).some(value => value.sessionId === session.id)) return []
    const preserved = { ...session }; delete preserved.reviewKey; return [preserved]
  })
  return next
}

// An omitted field preserves the shared topic; an explicitly empty date clears it.
// Shared settings invalidate unused future plans, never existing assessment context.
export function updateReviewTopic(state, topicId, changes) {
  const previous = state.topics?.find(topic => topic.id === topicId)
  if (!previous) return { ok: false, error: 'Temaet finnes ikke lenger.' }
  const topic = { ...previous, ...changes, id: previous.id }
  if (changes.examDate === undefined && previous.examDate !== undefined) topic.examDate = previous.examDate
  if (changes.examDate === '') delete topic.examDate
  if (!validTopics([topic]) || topic.taskId && !state.tasks?.some(task => task.id === topic.taskId) || topic.courseId && !state.planner?.courses.some(course => course.id === topic.courseId)) return { ok: false, error: 'Temaet eller tilknytningen er ugyldig.' }
  const next = { ...state, topics: state.topics.map(value => value.id === topic.id ? topic : value) }
  if (previous.examDate !== topic.examDate || Boolean(previous.reviewSuggestionsDisabled) !== Boolean(topic.reviewSuggestionsDisabled)) {
    const assessmentIds = new Set((state.assessments || []).filter(value => value.topicId === topic.id).map(value => value.id))
    const removedKeys = new Set((state.reviewDecisions || []).filter(value => assessmentIds.has(value.assessmentId) && !hasCompletedReviewSession(state, value) && !isAssessmentContext(state, value)).map(value => value.reviewKey))
    if (state.reviewDecisions) next.reviewDecisions = state.reviewDecisions.filter(value => !removedKeys.has(value.reviewKey))
    if (state.sessions) next.sessions = state.sessions.filter(value => !removedKeys.has(value.reviewKey))
  }
  return { ok: true, state: next, topic }
}

export function recordAssessment(state, assessment) {
  const topic = state.topics?.find(value => value.id === assessment?.topicId)
  if (!topic || !validTopics([topic]) || topic.taskId && !state.tasks?.some(task => task.id === topic.taskId) || topic.courseId && !state.planner?.courses.some(course => course.id === topic.courseId) ||
    !validAssessments([...(state.assessments || []), assessment], state)) return { ok: false, error: 'Egenvurderingen eller tilknytningen er ugyldig.' }
  return { ok: true, state: { ...state, assessments: [...(state.assessments || []), assessment] } }
}

// The topic is what is rated. The session is independent optional context, including
// sessions from another task or no task. Read snapshots without relinking history.
export function assessmentSessionContext(state, assessment) {
  if (!assessment.sessionId) return 'Ingen økt knyttet til vurderingen.'
  const log = state.workLogs?.find(value => value.sessionId === assessment.sessionId)
  const session = log ? log.sessionSnapshot : state.sessions?.find(value => value.id === assessment.sessionId)
  if (!session && !log) return 'Tilknyttet økt finnes ikke lenger.'
  const historical = Boolean(log)
  const when = session ? `${session.dateLocal} kl. ${session.startTime}–${session.endDateLocal && session.endDateLocal !== session.dateLocal ? `${session.endDateLocal} ` : ''}${session.endTime}` : 'tidspunkt ikke registrert'
  const taskId = session ? session.taskId : log.taskId
  const task = historical ? (log.taskSnapshot?.id === taskId ? log.taskSnapshot : undefined) : state.tasks?.find(value => value.id === taskId)
  const taskLabel = taskId ? `Oppgave: ${task?.title || (historical ? 'historisk navn ukjent' : 'ukjent oppgave')}` : 'Uten oppgave'
  return `${historical ? 'Historisk økt' : 'Tilknyttet økt'}: ${when} · ${taskLabel}.`
}

function freeReviewSession(state, now, examDate) {
  if (!examDate || !isoDate(examDate) || !state.workWindows?.length) return null
  const lower = +now, upper = Temporal.PlainDate.from(examDate).toZonedDateTime('Europe/Oslo').toInstant().epochMilliseconds
  const occupied = [
    ...(state.busyWindows || []).map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) })),
    ...(state.planner?.events || []).filter(eventBlocksTime).map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) })),
    ...(state.sessions || []).map(item => { try { return extendedSessionInterval(item) } catch { return null } }).filter(Boolean),
  ]
  for (const window of state.workWindows) {
    let start = Math.max(lower, Date.parse(window.start)), end = Math.min(upper, Date.parse(window.end))
    start = Math.ceil(start / 1_800_000) * 1_800_000
    while (start + 1_800_000 <= end) {
      const finish = start + 1_800_000
      if (!occupied.some(item => item.start < finish && item.end > start)) {
        const a = Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO('Europe/Oslo').toPlainDateTime().toString().slice(0, 16)
        const b = Temporal.Instant.fromEpochMilliseconds(finish).toZonedDateTimeISO('Europe/Oslo').toPlainDateTime().toString().slice(0, 16)
        return { dateLocal: a.slice(0, 10), startTime: a.slice(11), ...(b.slice(0, 10) !== a.slice(0, 10) ? { endDateLocal: b.slice(0, 10) } : {}), endTime: b.slice(11) }
      }
      start += 1_800_000
    }
  }
  return null
}

// Deliberately simple and documented: ratings 1–2 suggest review; 3–5 do not.
// A missing exam date or capacity never fabricates a date.
export function proposeReview(state, assessment, { now = new Date() } = {}) {
  if (!Number.isFinite(+now) || !validAssessments([assessment], state)) return { ok: false, error: 'Egenvurderingen er ugyldig.' }
  const key = reviewKey(assessment)
  const existing = (state.reviewDecisions || []).find(item => item.reviewKey === key)
  if (existing && !(existing.status === 'deferred' && isoDate(existing.deferUntil) && +now >= Temporal.PlainDate.from(existing.deferUntil).toZonedDateTime('Europe/Oslo').toInstant().epochMilliseconds)) return { ok: true, duplicate: true, reviewKey: key, decision: structuredClone(existing) }
  if (assessment.rating >= 3) return { ok: true, reviewKey: key, suggested: false, explanation: 'Vurderingen er 3 eller høyere. Regelen foreslår derfor ikke en ekstra repetisjon.' }
  const topic = state.topics.find(item => item.id === assessment.topicId)
  if (topic.reviewSuggestionsDisabled) return { ok: true, reviewKey: key, suggested: false, explanation: 'Repetisjonsforslag er slått av for dette temaet.' }
  const examDate = topic.examDate || state.examDate
  if (examDate && !isoDate(examDate)) return { ok: false, error: 'Eksamensdatoen er ikke en gyldig kalenderdato.' }
  const session = freeReviewSession(state, now, examDate)
  const uncertainty = []
  if ((state.planner?.events || []).some(item => uncertainPersonalTiming(item, now))) uncertainty.push('Egne aktiviteter har ukjent tidspunkt eller varighet. Foreslått tid kan være opptatt; kontroller aktivitetene før godkjenning.')
  if (!examDate) uncertainty.push('Eksamensdato er ukjent.')
  if (!session) uncertainty.push(examDate ? 'Ingen kollisjonsfri kapasitet er registrert før eksamen; velg tidspunkt eller registrer kapasitet.' : 'Kapasitet før eksamen kan ikke beregnes uten eksamensdato; velg tidspunkt før godkjenning.')
  return { ok: true, reviewKey: key, assessmentId: assessment.id, suggested: true, topicId: topic.id, title: `Repetisjon: ${topic.title}`, rating: assessment.rating,
    explanation: `Du vurderte temaet til ${assessment.rating} av 5. Den deterministiske regelen foreslår repetisjon ved vurdering 1 eller 2.`,
    uncertainty, proposedSession: session ? { dateLocal: session.dateLocal, startTime: session.startTime, ...(session.endDateLocal ? { endDateLocal: session.endDateLocal } : {}), endTime: session.endTime } : null, ...(existing ? { replaceDecisionId: existing.id } : {}), createdAt: new Date(now).toISOString() }
}

export function decideReview(state, proposal, decision, { id, sessionId } = {}) {
  if (!proposal?.suggested || !['approved', 'adjusted', 'deferred', 'rejected'].includes(decision?.status)) return { ok: false, error: 'Velg en gyldig beslutning.' }
  const decidedAt = decision.decidedAt || new Date().toISOString()
  if (!isoInstant(decidedAt)) return { ok: false, error: 'Beslutningstidspunktet er ugyldig.' }
  if (decision.status === 'deferred' && !isoDate(decision.deferUntil)) return { ok: false, error: 'Velg en gyldig dato repetisjonen utsettes til.' }
  const assessment = (state.assessments || []).find(item => item.id === proposal.assessmentId)
  if (!assessment || reviewKey(assessment) !== proposal.reviewKey || assessment.topicId !== proposal.topicId || assessment.rating !== proposal.rating) return { ok: false, stale: true, error: 'Egenvurderingen er endret. Lag et nytt repetisjonsforslag.' }
  const current = proposeReview(state, assessment, { now: new Date(decidedAt) })
  if (!current.ok || !current.suggested || current.reviewKey !== proposal.reviewKey) return { ok: false, stale: true, error: current.error || 'Repetisjonsforslaget gjelder ikke lenger.' }
  const existing = (state.reviewDecisions || []).find(item => item.reviewKey === proposal.reviewKey)
  if (existing && current.replaceDecisionId !== existing.id) return { ok: false, duplicate: true, error: 'Forslaget er allerede behandlet.' }
  const record = { id: id || existing?.id || crypto.randomUUID(), reviewKey: current.reviewKey, assessmentId: assessment.id, status: decision.status, decidedAt,
    ...(decision.status === 'deferred' ? { deferUntil: decision.deferUntil } : {}) }
  const next = { ...structuredClone(state), reviewDecisions: [...(state.reviewDecisions || []).filter(item => item.id !== existing?.id), record] }
  if (existing?.sessionId) next.sessions = (next.sessions || []).filter(item => item.id !== existing.sessionId)
  if (['approved', 'adjusted'].includes(decision.status)) {
    const value = decision.session || current.proposedSession
    if (!value) return { ok: false, error: 'Velg et tidspunkt før repetisjonen godkjennes.' }
    const sid = sessionId || crypto.randomUUID()
    record.sessionId = sid
    const session = { id: sid, ...value, reviewKey: current.reviewKey, reviewTopicId: assessment.topicId, locked: false }
    const checked = validateSession(session, next.sessions || [])
    if (!checked.valid) return { ok: false, error: checked.error }
    const interval = extendedSessionInterval(session)
    const topic = state.topics.find(item => item.id === assessment.topicId)
    const examDate = topic.examDate || state.examDate
    if (interval.start < Date.parse(decidedAt)) return { ok: false, error: 'Velg et fremtidig tidspunkt for repetisjonen.' }
    if (examDate && interval.end > Temporal.PlainDate.from(examDate).toZonedDateTime('Europe/Oslo').toInstant().epochMilliseconds) return { ok: false, error: 'Repetisjonen må avsluttes før eksamensdatoen.' }
    const busy = [...(state.busyWindows || []), ...(state.planner?.events || []).filter(eventBlocksTime)]
    if (busy.some(item => Date.parse(item.start) < interval.end && Date.parse(item.end) > interval.start)) return { ok: false, error: 'Repetisjonen overlapper opptatt tid. Velg et ledig tidsrom.' }
    if (state.workWindows?.length && subtractIntervals([interval], state.workWindows.map(item => ({ start: Date.parse(item.start), end: Date.parse(item.end) }))).length) return { ok: false, error: 'Repetisjonen må ligge innenfor registrert arbeidstid.' }
    next.sessions = [...(next.sessions || []), session]
  }
  return { ok: true, state: next }
}

export function purgeAssessments(state) {
  const next = structuredClone(state)
  delete next.assessments; delete next.reviewDecisions; delete next.topics
  next.sessions = (next.sessions || []).filter(session => !session.reviewKey && !session.reviewTopicId)
  if (next.history) for (const kind of ['undo', 'trash']) next.history[kind] = next.history[kind].filter(entry => !entry.changes.some(privateReviewChange))
  return next
}

export const privateReviewChange = change => ['topics', 'assessments', 'reviewDecisions'].includes(change.path) ||
  change.path === 'sessions' && [change.before, change.after].some(session => session?.reviewKey || session?.reviewTopicId)

// Removing an ordinary task/course must preserve independent learning history.
// Detach only the vanished relation; the compound history entry restores it.
export function detachMissingTopicRelations(state) {
  if (!state.topics) return state
  return { ...state, topics: state.topics.map(topic => {
    const value = { ...topic }
    if (value.taskId && !state.tasks.some(task => task.id === value.taskId)) delete value.taskId
    if (value.courseId && !state.planner?.courses.some(course => course.id === value.courseId)) delete value.courseId
    return value
  }) }
}

export function detachRemovedReviewSessions(state, now = new Date()) {
  const hasSession = id => state.sessions?.some(session => session.id === id) || state.workLogs?.some(log => log.sessionId === id)
  const next = { ...state }
  if (next.assessments) next.assessments = next.assessments.map(item => {
    if (!item.sessionId || hasSession(item.sessionId)) return item
    const value = { ...item }; delete value.sessionId; return value
  })
  if (next.reviewDecisions) next.reviewDecisions = next.reviewDecisions.map(item => {
    if (!item.sessionId || hasReviewSession(state, item)) return item
    const value = { ...item, status: 'rejected', decidedAt: now.toISOString() }; delete value.sessionId; return value
  })
  return next
}
