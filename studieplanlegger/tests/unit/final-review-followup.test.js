import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { parseTextRegistration, parseOsloDeadline } from '../../src/text-registration.js'
import { createWorkStepProposal, approveWorkStepProposal } from '../../src/work-step-proposals.js'
import { comparePlans } from '../../src/plan-comparison.js'
import { detachRemovedReviewSessions } from '../../src/review-planning.js'
import { closeWork } from '../../src/work-log.js'
import { validEnvelope } from '../../src/storage.js'
import { teachingOutcome } from '../../src/teaching-check.js'
import { api } from '../../src/subjects-view.js'
import { importMiddleware } from '../../server/import-api.js'

const now = new Date('2026-09-28T08:00:00Z')
const task = { id: 'a', title: 'Rapport', course: '', deadlineLocal: '2026-10-10', remainingMinutes: 120, completed: false }
describe('bounded final review follow-up', () => {
  it('accepts validated local ISO clocks and explicit named-month activity years, but rejects questions and mutations before activity recognition', () => {
    expect(parseOsloDeadline('2026-10-02T14:00', now)).toEqual({ ok: true, deadlineLocal: '2026-10-02T14:00' })
    expect(parseOsloDeadline('2026-03-29T02:30', now).ok).toBe(false)
    expect(parseTextRegistration('Egen aktivitet: Møte 12. oktober 2027 kl. 12–13', { now }).proposal).toMatchObject({ action: 'activity', dateLocal: '2027-10-12', startLocal: '12:00', endLocal: '13:00' })
    for (const command of ['Kan jeg møte 12. oktober kl. 12?', 'Slett møte 12. oktober kl. 12', 'Flytt møte 12. oktober']) expect(parseTextRegistration(command, { now }).proposal).toBeNull()
    expect(parseTextRegistration('Endre fristen på Rapport til 12. oktober kl. 14', { tasks: [task], now }).ok).toBe(true)
  })
  it('keeps edited/completed same-source steps and migrates the existing legacy step when adding a new ID', () => {
    const proposal = createWorkStepProposal({ sourceId: 'source', taskId: task.id, rows: [{ key: '1', title: 'Original', kind: 'requirement' }, { key: '2', title: 'New', kind: 'requirement' }] })
    const existing = { id: 'step:source:1', title: 'Edited', completed: true, estimatedMinutes: 40, provenance: { kind: 'manual' } }
    const result = approveWorkStepProposal({ ...task, steps: [existing] }, proposal)
    expect(result.task.steps).toEqual([existing, expect.objectContaining({ id: 'step:source:2', title: 'New' })])
    const legacy = approveWorkStepProposal({ ...task, nextStep: { description: 'Legacy', estimatedMinutes: 10 } }, proposal)
    expect(legacy.task.steps[0]).toMatchObject({ id: 'a:legacy-next-step', title: 'Legacy' })
  })
  it('credits overlapping sessions once and gives taskless reservations priority while preserving personal-time uncertainty', () => {
    const session = (id, taskId, startTime, endTime) => ({ id, ...(taskId ? { taskId } : {}), dateLocal: '2026-09-29', startTime, endTime })
    const state = { schemaVersion: 1, tasks: [task, { ...task, id: 'b' }], workWindows: [{ id: 'w', start: '2026-09-29T08:00:00Z', end: '2026-09-29T10:00:00Z' }], sessions: [session('a', 'a', '10:00', '12:00'), session('b', 'b', '10:00', '12:00'), session('r', null, '10:00', '10:30')], planner: { courses: [], sources: [], events: [{ id: 'p', title: 'Unknown', activityKind: 'personal', courseId: '', dateLocal: '2026-09-29', start: '', end: '', notes: '' }] } }
    const current = comparePlans(state, { now }).scenarios[0]
    expect(current.allocatedMinutes).toBe(90)
    expect(current.preview.allocatedMinutes).toEqual({ a: 90, b: 0 })
    expect(current.uncertainty.join(' ')).toContain('ukjent tidspunkt')
    expect(current.feasible).toBe(false)
  })
  it('retains approved review history backed by the completed session snapshot and rejects a mismatched snapshot', () => {
    const key = 'review:t:assessment', session = { id: 's', taskId: task.id, reviewKey: key, reviewTopicId: 't', dateLocal: '2026-09-28', startTime: '08:00', endTime: '08:30' }
    const state = { schemaVersion: 1, tasks: [task], sessions: [session], topics: [{ id: 't', title: 'Topic', taskId: task.id }], assessments: [{ id: 'assessment', topicId: 't', rating: 2, assessedAt: now.toISOString() }], reviewDecisions: [{ id: 'd', assessmentId: 'assessment', reviewKey: key, sessionId: 's', status: 'approved', decidedAt: now.toISOString() }] }
    const closed = closeWork(state, { taskId: task.id, sessionId: 's', operationId: 'close-s', outcome: 'done', actualMinutes: 30, remainingMinutes: 0 }, { now })
    expect(closed.ok).toBe(true)
    const retained = detachRemovedReviewSessions(closed.state, now)
    expect(retained.reviewDecisions).toEqual(state.reviewDecisions)
    expect(validEnvelope(retained, { relations: true })).toBe(true)
    retained.workLogs[0].sessionSnapshot.reviewKey = 'wrong'
    expect(validEnvelope(retained, { relations: true })).toBe(false)
    expect(detachRemovedReviewSessions(retained, now).reviewDecisions[0]).toMatchObject({ status: 'rejected' })
  })
  it('requires structured access evidence and distinguishes unconfirmed HTTP and non-calendar content', () => {
    for (const code of [401, 403]) expect(teachingOutcome(new Error(`HTTP ${code}. Årsaken er ikke bekreftet`))).toBe('transport-error')
    expect(teachingOutcome(new Error('Lenken returnerte ikke en kalender. Den kan kreve innlogging.'))).toBe('invalid-response')
    expect(teachingOutcome({ status: 'access-required', message: 'Documented access requirement' })).toBe('access-required')
  })
  it('preserves synthetic TimeoutError and marks malformed JSON as invalid response through the import wrapper', async () => {
    try {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Synthetic timeout', 'TimeoutError')))
      await expect(api('/api/import/calendar')).rejects.toMatchObject({ name: 'TimeoutError' })
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Synthetic HTML') } })
      await expect(api('/api/import/calendar')).rejects.toMatchObject({ status: 'invalid-response' })
    } finally { vi.unstubAllGlobals() }
  })
  it('retains the actual timeout signal reason without waiting thirty seconds', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal('fetch', (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))))
      const request = api('/api/import/calendar')
      const check = expect(request).rejects.toMatchObject({ name: 'TimeoutError' })
      await vi.advanceTimersByTimeAsync(30000)
      await check
    } finally { vi.useRealTimers(); vi.unstubAllGlobals() }
  })
  it.each(['HTTP 401. Årsaken er ikke bekreftet', 'HTTP 403. Årsaken er ikke bekreftet', '<html>login</html>'])('classifies the actual calendar middleware response for %s', async (body) => {
    const result = await new Promise(resolve => {
      const req = Readable.from([JSON.stringify({ url: 'https://example.test/calendar.ics' })])
      Object.assign(req, { method: 'POST', url: '/api/import/calendar', headers: { host: 'localhost', 'content-type': 'application/json' } })
      const res = new EventEmitter()
      res.writeHead = vi.fn()
      res.end = raw => resolve(JSON.parse(raw))
      importMiddleware(req, res, () => {}, { fetchTextImpl: async () => { if (body.startsWith('HTTP')) throw new Error(body); return body } })
    })
    expect(teachingOutcome({ message: result.error, status: result.status })).toBe(body.startsWith('HTTP') ? 'transport-error' : 'invalid-response')
    if (!body.startsWith('HTTP')) expect(result.status).toBe('invalid-response')
  })
})
