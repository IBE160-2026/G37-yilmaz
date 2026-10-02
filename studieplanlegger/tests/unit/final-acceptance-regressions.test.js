import { describe, expect, it } from 'vitest'
import { proposeReview, decideReview, purgeAssessments, detachMissingTopicRelations, detachRemovedReviewSessions } from '../../src/review-planning.js'
import { deriveWorkCapacity } from '../../src/work-capacity.js'
import { purgeWorkHistory } from '../../src/work-log.js'
import { recordChange, undoLast, restoreTrash } from '../../src/history.js'
import { validEnvelope } from '../../src/storage.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { comparePlans } from '../../src/plan-comparison.js'

const now = new Date('2026-10-01T07:00:00Z')
const task = { id: 'task', title: 'Syntetisk oppgave', course: '', deadlineLocal: '', estimatedMinutes: 60, completed: false }
const assessment = { id: 'assessment', topicId: 'topic', rating: 1, assessedAt: now.toISOString() }
const base = () => ({ schemaVersion: 1, tasks: [task], topics: [{ id: 'topic', title: 'Syntetisk tema', taskId: task.id, examDate: '2026-10-03' }], assessments: [assessment], sessions: [], workWindows: [{ id: 'window', start: '2026-10-02T08:00:00Z', end: '2026-10-02T09:00:00Z' }] })
const event = patch => ({ id: 'event', title: 'Syntetisk aktivitet', start: '2026-10-02T08:00:00Z', end: '2026-10-02T09:00:00Z', ...patch })
const decision = session => ({ status: 'adjusted', decidedAt: now.toISOString(), session })
const session = patch => ({ id: 'session', dateLocal: '2026-10-02', startTime: '10:00', endTime: '10:30', ...patch })

describe('sluttaksept: kapasitet, relasjoner og privat historikk', () => {
  it.each([{ cancelled: true }, { deleted: true }, { transparent: true }, { transparency: 'TRANSPARENT' }, { information: true }])('repetisjon bruker samme ikke-blokkerende kontrakt: %j', patch => {
    const state = { ...base(), planner: { courses: [], sources: [], events: [event(patch)] } }
    expect(proposeReview(state, assessment, { now }).proposedSession).toMatchObject({ startTime: '10:00', endTime: '10:30' })
  })
  it('avviser manuelt valgt repetisjon etter eksamen, i fortiden og under opptatt tid uten å mutere', () => {
    const state = { ...base(), planner: { courses: [], sources: [], events: [event({})] } }
    const proposal = proposeReview(state, assessment, { now }), raw = JSON.stringify(state)
    for (const value of [session({ dateLocal: '2026-10-03' }), session({ dateLocal: '2026-09-30' }), session({})]) {
      expect(decideReview(state, proposal, decision(value)).ok).toBe(false)
      expect(JSON.stringify(state)).toBe(raw)
    }
    const busy = { ...base(), busyWindows: [event({})] }
    expect(decideReview(busy, proposeReview(busy, assessment, { now }), decision(session({}))).ok).toBe(false)
    expect(decideReview(state, proposal, decision(session({ startTime: '11:00', endTime: '11:30' }))).ok).toBe(false)
    const adjacent = { ...base(), workWindows: [{ id: 'a', start: '2026-10-02T08:00:00Z', end: '2026-10-02T08:15:00Z' }, { id: 'b', start: '2026-10-02T08:15:00Z', end: '2026-10-02T08:30:00Z' }] }
    expect(decideReview(adjacent, proposeReview(adjacent, assessment, { now }), decision(session({}))).ok).toBe(true)
  })
  it('teller taskless manuelle og review-økter som opptatt kapasitet én gang', () => {
    const state = base(), sessions = [session({}), session({ id: 'review', startTime: '10:15', endTime: '10:45', reviewKey: 'synthetic' })]
    const result = deriveWorkCapacity(state.tasks, sessions, now, [], state.workWindows)
    expect(result.totalReservedMinutes).toBe(45)
    expect(result.totalAllocatedMinutes).toBe(15)
    expect(result.tasks[0].missingMinutes).toBe(45)
    expect(result.tasks[0].allocations[0].startLocal).toBe('2026-10-02T10:45')
  })
  it('task deletion detaches the topic atomically, retains learning records and undo restores relation', () => {
    const state = base(), next = detachMissingTopicRelations({ ...state, tasks: [] })
    expect(next.topics[0].taskId).toBeUndefined()
    expect(next.assessments).toEqual(state.assessments)
    const history = recordChange(state, next)
    expect(validEnvelope({ ...next, history }, { relations: true })).toBe(true)
    expect(undoLast(next, history).state.topics).toEqual(state.topics)
    expect(previewBackup(JSON.stringify(exportBackup({ ...next, history })), next).ok).toBe(true)
  })
  it.each([purgeWorkHistory, purgeAssessments])('purges private session-only undo/trash and keeps unrelated history', purge => {
    const state = { ...base(), reviewDecisions: [{ id: 'decision', reviewKey: 'review:topic:assessment', assessmentId: 'assessment', status: 'approved', decidedAt: now.toISOString(), sessionId: 'session' }], sessions: [session({ reviewKey: 'review:topic:assessment', reviewTopicId: 'topic' })] }
    const edited = structuredClone(state); edited.sessions[0].endTime = '10:45'
    let history = recordChange(state, edited)
    const removed = { ...edited, sessions: [] }
    history = recordChange(edited, removed, history)
    const renamed = structuredClone(removed); renamed.tasks[0].title = 'Ny syntetisk tittel'
    history = recordChange(removed, renamed, history)
    const purged = purge({ ...renamed, history })
    expect(purged.history.undo).toHaveLength(1)
    expect(purged.history.trash).toHaveLength(0)
    expect(JSON.stringify(exportBackup(purged))).not.toContain('review:topic:assessment')
    expect(undoLast(purged, purged.history).state.sessions).toEqual([])
    expect(restoreTrash(purged, purged.history, history.trash[0].id).ok).toBe(false)
  })
  it('session deletion retains assessment and rejects its reservation atomically; undo restores exact records', () => {
    const state = { ...base(), assessments: [{ ...assessment, sessionId: 'session' }], reviewDecisions: [{ id: 'decision', reviewKey: 'review:topic:assessment', assessmentId: 'assessment', status: 'approved', decidedAt: now.toISOString(), sessionId: 'session' }], sessions: [session({ reviewKey: 'review:topic:assessment', reviewTopicId: 'topic' })] }
    const next = detachRemovedReviewSessions({ ...state, sessions: [] }, now)
    expect(next.assessments).toEqual([assessment])
    expect(next.reviewDecisions[0]).toMatchObject({ status: 'rejected' })
    expect(next.reviewDecisions[0].sessionId).toBeUndefined()
    const history = recordChange(state, next)
    expect(validEnvelope({ ...next, history }, { relations: true })).toBe(true)
    expect(undoLast(next, history).state.sessions).toEqual(state.sessions)
    expect(undoLast(next, history).state.reviewDecisions).toEqual(state.reviewDecisions)
  })
  it('reviews expose uncertain personal occupancy without fabricating a duration', () => {
    const state = { ...base(), planner: { courses: [], sources: [], events: [{ id: 'uncertain', title: 'Ukjent varighet', activityKind: 'personal', courseId: '', dateLocal: '2026-10-02', start: '2026-10-02T08:00:00Z', startLocal: '10:00' }] } }
    const proposal = proposeReview(state, assessment, { now })
    expect(proposal.proposedSession).toMatchObject({ startTime: '10:00' })
    expect(proposal.uncertainty.join(' ')).toContain('ukjent tidspunkt eller varighet')
    expect(state.planner.events[0].end).toBeUndefined()
  })
  it('relational validation rejects a non-derived review key', () => {
    const state = { ...base(), reviewDecisions: [{ id: 'decision', assessmentId: assessment.id, reviewKey: 'incorrect', status: 'rejected', decidedAt: now.toISOString() }] }
    expect(validEnvelope(state, { relations: true })).toBe(false)
  })
  it('comparison retains review occupancy and clips a crossing task session at its deadline', () => {
    const state = { ...base(), tasks: [{ ...task, deadlineLocal: '2026-10-02T10:30', estimatedMinutes: 30 }], sessions: [session({ taskId: task.id, endTime: '10:45' }), session({ id: 'review', startTime: '10:45', endTime: '11:00', reviewKey: 'review:topic:assessment', reviewTopicId: 'topic' })] }
    const comparison = comparePlans(state, { now })
    expect(comparison.scenarios[0]).toMatchObject({ allocatedMinutes: 30, remainingCapacityMinutes: 0, reviewSessions: 1 })
    for (const alternative of comparison.scenarios.slice(1)) expect(alternative.reviewSessions).toBe(1)
    const ranged = { ...base(), tasks: [{ ...task, estimatedMinutes: null, remainingEstimate: { minMinutes: 0, maxMinutes: 90 } }] }
    expect(comparePlans(ranged, { now }).scenarios[0]).toMatchObject({ feasible: false, deadlineRisk: true })
  })
})
