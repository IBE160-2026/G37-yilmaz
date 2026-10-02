import { describe, expect, it } from 'vitest'
import { assessmentSessionContext, purgeAssessments, recordAssessment, removeAssessmentReview, updateReviewTopic, validAssessments } from '../../src/review-planning.js'
import { closeWork } from '../../src/work-log.js'
import { validEnvelope } from '../../src/storage.js'

const task = { id: 'assessment-task', title: 'Syntetisk hovedoppgave', course: '', deadlineLocal: '', estimatedMinutes: 90, remainingMinutes: 90, completed: false }
const otherTask = { ...task, id: 'other-task', title: 'Syntetisk annen oppgave' }
const topic = { id: 'topic', title: 'Syntetisk tema', taskId: task.id, examDate: '2026-10-10' }
const assessment = { id: 'assessment', topicId: topic.id, rating: 4, assessedAt: '2026-09-28T10:00:00Z' }
const session = { id: 'actual-session', taskId: task.id, dateLocal: '2026-09-28', startTime: '10:00', endTime: '10:30' }
const state = () => ({ schemaVersion: 1, tasks: [task, otherTask], topics: [topic], assessments: [assessment], sessions: [session] })
const close = (value, sessionId = session.id) => closeWork(value, { taskId: task.id, operationId: 'synthetic-close', ...(sessionId ? { sessionId } : {}), outcome: 'more', actualMinutes: '30', remainingMinutes: '60' }, { now: new Date('2026-09-28T10:30:00Z') })
const independentlyReferencedReview = () => {
  const review = { ...session, reviewKey: `review:${topic.id}:${assessment.id}`, reviewTopicId: topic.id }
  return { ...state(), sessions: [review], topics: [topic, { id: 'independent-topic', title: 'Uavhengig vurdert tema', taskId: otherTask.id }],
    assessments: [assessment, { ...assessment, id: 'independent-assessment', topicId: 'independent-topic', sessionId: review.id }],
    reviewDecisions: [{ id: 'review-decision', reviewKey: review.reviewKey, assessmentId: assessment.id, status: 'approved', sessionId: review.id, decidedAt: assessment.assessedAt }] }
}

describe('bounded assessment topic and session contract', () => {
  it('reports an unknown historical task name when the stored task and session snapshots refer to different tasks', () => {
    const closed = close(state())
    const historical = { ...closed.state, workLogs: closed.state.workLogs.map(log => ({ ...log, sessionSnapshot: { ...log.sessionSnapshot, taskId: otherTask.id } })) }
    const before = structuredClone(historical)
    expect(validEnvelope(historical, { relations: true })).toBe(true)
    expect(assessmentSessionContext(historical, { sessionId: session.id })).toBe('Historisk økt: 2026-09-28 kl. 10:00–10:30 · Oppgave: historisk navn ukjent.')
    expect(historical).toEqual(before)
  })

  it('purges retained session topic context even after its review decision key was detached', () => {
    const initial = independentlyReferencedReview()
    const detached = removeAssessmentReview({ ...initial, assessments: initial.assessments.filter(value => value.id !== assessment.id) }, assessment.id)
    const ordinary = { ...session, id: 'ordinary-session', startTime: '11:00', endTime: '11:30' }
    detached.sessions.push(ordinary)
    const before = structuredClone(detached)
    expect(detached.sessions[0].reviewTopicId).toBe(topic.id)
    expect(detached.sessions[0]).not.toHaveProperty('reviewKey')
    const result = purgeAssessments(detached)
    expect(result.sessions).toEqual([ordinary])
    expect(result).not.toHaveProperty('topics')
    expect(result).not.toHaveProperty('assessments')
    expect(result).not.toHaveProperty('reviewDecisions')
    expect(validEnvelope(result, { relations: true })).toBe(true)
    expect(detached).toEqual(before)
  })

  for (const changes of [{ examDate: '' }, { reviewSuggestionsDisabled: true }]) it(`preserves a live review used as another topic's assessment context when updating ${Object.keys(changes)[0]}`, () => {
    const initial = independentlyReferencedReview(), before = structuredClone(initial)
    expect(validEnvelope(initial, { relations: true })).toBe(true)
    const result = updateReviewTopic(initial, topic.id, changes)
    expect(result.ok).toBe(true)
    expect(validEnvelope(result.state, { relations: true })).toBe(true)
    expect(result.state.assessments).toEqual(initial.assessments)
    expect(result.state.reviewDecisions).toEqual(initial.reviewDecisions)
    expect(result.state.sessions).toEqual(initial.sessions)
    expect(initial).toEqual(before)
  })

  for (const deleting of [false, true]) it(`preserves independent live context when ${deleting ? 'deleting' : 'rerating'} the assessment that owns its review decision`, () => {
    const initial = independentlyReferencedReview(), before = structuredClone(initial)
    const changed = { ...initial, assessments: deleting ? initial.assessments.filter(value => value.id !== assessment.id) : initial.assessments.map(value => value.id === assessment.id ? { ...value, rating: 5 } : value) }
    const result = removeAssessmentReview(changed, assessment.id)
    const { reviewKey, ...preservedSession } = initial.sessions[0]
    expect(result.reviewDecisions).toEqual([])
    expect(result.sessions).toEqual([preservedSession])
    expect(result.assessments.find(value => value.id === 'independent-assessment')).toEqual(initial.assessments[1])
    expect(validEnvelope(result, { relations: true })).toBe(true)
    expect(initial).toEqual(before)
  })

  it('does not retain a removed assessment self-reference and never modifies logged review snapshots', () => {
    const initial = independentlyReferencedReview()
    const selfOnly = { ...initial, assessments: [{ ...assessment, sessionId: session.id }] }
    expect(removeAssessmentReview({ ...selfOnly, assessments: [] }, assessment.id).sessions).toEqual([])
    const completed = closeWork(initial, { taskId: task.id, sessionId: session.id, operationId: 'completed-reference', outcome: 'done', actualMinutes: '30' }, { now: new Date('2026-09-28T10:30:00Z') })
    expect(completed.ok).toBe(true)
    const remaining = { ...completed.state, assessments: completed.state.assessments.filter(value => value.id !== assessment.id) }
    const result = removeAssessmentReview(remaining, assessment.id)
    expect(result.reviewDecisions).toEqual([])
    expect(result.workLogs).toEqual(completed.state.workLogs)
    expect(result.assessments).toEqual([initial.assessments[1]])
    expect(validEnvelope(result, { relations: true })).toBe(true)
  })

  it('preserves an omitted exam date and removes an explicitly empty date without mutating historical assessments or unrelated topics', () => {
    const initial = { ...state(), topics: [topic, { id: 'unrelated', title: 'Uavhengig tema', examDate: '2026-11-10' }] }
    const before = structuredClone(initial)
    const retained = updateReviewTopic(initial, topic.id, { reviewSuggestionsDisabled: true })
    expect(retained.ok).toBe(true)
    expect(retained.state.topics[0].examDate).toBe('2026-10-10')
    expect(updateReviewTopic(initial, topic.id, { examDate: undefined }).topic.examDate).toBe('2026-10-10')
    const cleared = updateReviewTopic(initial, topic.id, { examDate: '' })
    expect(cleared.ok).toBe(true)
    expect(cleared.state.topics[0]).not.toHaveProperty('examDate')
    expect(cleared.state.assessments).toEqual(initial.assessments)
    expect(cleared.state.topics[1]).toEqual(initial.topics[1])
    expect(validEnvelope(cleared.state, { relations: true })).toBe(true)
    expect(initial).toEqual(before)
  })

  it('reconciles future shared-topic plans while preserving completed review sessions and assessments exactly', () => {
    const completed = { ...session, reviewKey: 'review:topic:assessment', reviewTopicId: topic.id }
    const logged = closeWork({ ...state(), sessions: [completed] }, { taskId: task.id, sessionId: completed.id, operationId: 'completed', outcome: 'done', actualMinutes: '30', confirmRelease: true }, { now: new Date('2026-09-28T10:30:00Z') })
    expect(logged.ok).toBe(true)
    const futureAssessment = { ...assessment, id: 'future-assessment', rating: 2 }
    const completedDecision = { id: 'completed-decision', assessmentId: assessment.id, reviewKey: completed.reviewKey, status: 'approved', sessionId: completed.id, decidedAt: assessment.assessedAt }
    const initial = { ...logged.state, assessments: [assessment, futureAssessment],
      sessions: [{ ...session, id: 'future-session', dateLocal: '2026-10-01', reviewKey: 'review:topic:future-assessment', reviewTopicId: topic.id }],
      reviewDecisions: [completedDecision, { ...completedDecision, id: 'future-decision', assessmentId: futureAssessment.id, reviewKey: 'review:topic:future-assessment', sessionId: 'future-session' }] }
    const changed = updateReviewTopic(initial, topic.id, { examDate: '' })
    expect(changed.ok).toBe(true)
    expect(changed.state.reviewDecisions).toEqual([completedDecision])
    expect(changed.state.sessions).toEqual([])
    expect(changed.state.assessments).toEqual(initial.assessments)
    expect(changed.state.workLogs).toEqual(initial.workLogs)
    expect(validEnvelope(changed.state, { relations: true })).toBe(true)
  })

  it('binds the actual validated closeout session even when another session is more recent', () => {
    const otherSession = { ...session, id: 'newer-session', startTime: '11:00', endTime: '11:30' }
    const initial = { ...state(), sessions: [session, otherSession] }
    const result = close(initial)
    expect(result.ok).toBe(true)
    const recorded = recordAssessment(result.state, { ...assessment, id: 'new-assessment', sessionId: result.log.sessionId })
    expect(recorded.ok).toBe(true)
    expect(recorded.state.assessments.at(-1).sessionId).toBe(session.id)
    expect(recorded.state.sessions).toEqual([otherSession])
    expect(result.log.sessionSnapshot).toEqual(session)
    expect(validEnvelope(recorded.state, { relations: true })).toBe(true)
    expect(assessmentSessionContext(recorded.state, recorded.state.assessments.at(-1))).toBe('Historisk økt: 2026-09-28 kl. 10:00–10:30 · Oppgave: Syntetisk hovedoppgave.')
    expect(close(initial, 'unknown-session').ok).toBe(false)
    expect(close({ ...initial, sessions: [{ ...session, taskId: otherTask.id }] }).ok).toBe(false)
    expect(close(initial, '').log).not.toHaveProperty('sessionId')
  })

  for (const linkedTask of [task.id, otherTask.id, undefined]) it(`accepts actual optional live and historical context for task ${linkedTask || 'none'}`, () => {
    const actual = { ...session }; if (linkedTask) actual.taskId = linkedTask; else delete actual.taskId
    const initial = { ...state(), sessions: [actual] }
    const linked = { ...assessment, id: 'linked', sessionId: actual.id }
    expect(recordAssessment(initial, linked).ok).toBe(true)
    expect(validAssessments([linked], initial)).toBe(true)
    const taskLabel = linkedTask === task.id ? task.title : linkedTask === otherTask.id ? otherTask.title : 'Uten oppgave'
    expect(assessmentSessionContext(initial, linked)).toContain(taskLabel)
    const historical = { ...initial, sessions: [], workLogs: [{ ...close(state()).log, taskId: linkedTask || task.id, taskSnapshot: linkedTask === otherTask.id ? otherTask : task, sessionSnapshot: actual }] }
    expect(recordAssessment(historical, linked).ok).toBe(true)
    expect(assessmentSessionContext(historical, linked)).toContain('Historisk økt: 2026-09-28 kl. 10:00–10:30')
    expect(assessmentSessionContext(historical, linked)).toContain(taskLabel)
    expect(validEnvelope(recordAssessment(historical, linked).state, { relations: true })).toBe(true)
  })

  it('uses the historical task snapshot after a rename and states absent context honestly', () => {
    const result = close(state())
    const renamed = { ...result.state, tasks: [{ ...task, title: 'Nytt navn' }, otherTask] }
    expect(assessmentSessionContext(renamed, { sessionId: session.id })).toContain(task.title)
    expect(assessmentSessionContext(renamed, {})).toBe('Ingen økt knyttet til vurderingen.')
    expect(assessmentSessionContext(renamed, { sessionId: 'missing' })).toBe('Tilknyttet økt finnes ikke lenger.')
    const snapshotless = { ...renamed, sessions: [{ ...session, startTime: '14:00', endTime: '15:00' }], workLogs: result.state.workLogs.map(({ sessionSnapshot, ...log }) => log) }
    expect(assessmentSessionContext(snapshotless, { sessionId: session.id })).toContain('tidspunkt ikke registrert')
  })

  it('allows a taskless topic and rejects unknown topic, task, course or session references without writes', () => {
    const initial = state(), before = structuredClone(initial)
    expect(recordAssessment({ ...initial, topics: [{ id: topic.id, title: topic.title }] }, { ...assessment, id: 'taskless' }).ok).toBe(true)
    for (const invalid of [{ ...assessment, id: 'unknown', topicId: 'unknown' }, { ...assessment, id: 'unknown', sessionId: 'unknown' }]) expect(recordAssessment(initial, invalid).ok).toBe(false)
    for (const relation of [{ taskId: 'unknown' }, { courseId: 'unknown' }]) {
      expect(updateReviewTopic(initial, topic.id, relation).ok).toBe(false)
      expect(recordAssessment({ ...initial, topics: [{ ...topic, ...relation }] }, { ...assessment, id: 'new' }).ok).toBe(false)
    }
    expect(updateReviewTopic(initial, topic.id, { examDate: '2026-02-30' }).ok).toBe(false)
    expect(initial).toEqual(before)
  })
})
