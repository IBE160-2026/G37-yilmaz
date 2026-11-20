import { expect, test } from 'vitest'
import { proposeReview, decideReview } from '../../src/review-planning.js'
import { extendedSessionInterval } from '../../src/work-capacity.js'
import { calendarEntries, calendarToday, entriesForDay, timeLabel } from '../../src/calendar-model.js'
import { eventsOnDay } from '../../src/teaching-calendar.js'
import { upcomingAgenda } from '../../src/agenda-view.js'

const assessment = { id: 'rating', topicId: 'topic', rating: 2, assessedAt: '2026-03-01T08:00:00Z' }
const window = (start, end, id = 'time') => ({ id, start, end })
const reviewState = (examDate, workWindows, busyWindows = []) => ({
  topics: [{ id: 'topic', title: 'Regresjonsprøve', examDate }], assessments: [assessment], workWindows, busyWindows,
})
const review = (state, at) => proposeReview(state, assessment, { now: new Date(at) })

test.each([
  ['2026-11-20T08:10:00Z', '2026-11-20T08:40:00Z', '09:10', '09:40'],
  ['2026-11-20T09:08:00Z', '2026-11-20T09:38:00Z', '10:08', '10:38'],
])('P10 accepts the first free 30 minutes at %s, joining adjacent windows', (start, end, localStart, localEnd) => {
  const middle = new Date(Date.parse(start) + 15 * 60_000).toISOString()
  const state = reviewState('2026-11-21', [window(middle, end), window(start, middle, 'first')])
  const decidedAt = '2026-11-20T08:00:00Z', proposal = review(state, decidedAt)
  expect(proposal.proposedSession).toEqual({ dateLocal: '2026-11-20', startTime: localStart, endTime: localEnd })
  const result = decideReview(state, proposal, { status: 'approved', decidedAt })
  expect(result.state.sessions[0]).toMatchObject(proposal.proposedSession)
  expect(result.state.reviewDecisions[0]).toMatchObject({ sessionId: result.state.sessions[0].id, assessmentId: assessment.id })
})

test('P11 skips ambiguous endpoints in autumn and can approve an explicit spring clock-change interval', () => {
  const autumnAt = '2026-10-24T23:55:00Z'
  const autumn = reviewState('2026-10-26', [window('2026-10-25T00:00:00Z', '2026-10-25T02:45:00Z')])
  const autumnProposal = review(autumn, autumnAt)
  expect(autumnProposal.proposedSession).toMatchObject({ startTime: '03:00', endTime: '03:30' })
  expect(decideReview(autumn, autumnProposal, { status: 'approved', decidedAt: autumnAt }).ok).toBe(true)
  const springAt = '2026-03-29T00:30:00Z'
  const spring = reviewState('2026-03-30', [window('2026-03-29T00:45:00Z', '2026-03-29T01:15:00Z')])
  const springProposal = review(spring, springAt)
  expect(springProposal.proposedSession).toEqual({ dateLocal: '2026-03-29', startTime: '01:45', endDateLocal: '2026-03-29', endTime: '03:15' })
  const result = decideReview(spring, springProposal, { status: 'approved', decidedAt: springAt })
  const interval = extendedSessionInterval(result.state.sessions[0])
  expect(interval.end - interval.start).toBe(1_800_000)
})

test('review approval rejects stale and incomplete slots, and deferral needs a future Oslo date', () => {
  const decidedAt = '2026-11-19T23:05:00Z'
  const state = reviewState('2026-11-21', [window('2026-11-20T08:00:00Z', '2026-11-20T09:00:00Z')])
  const proposal = review(state, decidedAt)
  const laterState = { ...state, busyWindows: [window('2026-11-20T08:00:00Z', '2026-11-20T08:30:00Z', 'busy')] }
  expect(review(laterState, decidedAt).proposedSession.startTime).toBe('09:30')
  expect(decideReview(laterState, proposal, { status: 'approved', decidedAt })).toMatchObject({ ok: false })
  expect(decideReview(state, proposal, { status: 'approved', session: { dateLocal: '2026-11-20', startTime: '09:00' }, decidedAt })).toMatchObject({ ok: false })
  for (const deferUntil of ['2026-11-19', '2026-11-20']) expect(decideReview(state, proposal, { status: 'deferred', deferUntil, decidedAt }).ok).toBe(false)
  expect(decideReview(state, proposal, { status: 'deferred', deferUntil: '2026-11-21', decidedAt }).ok).toBe(true)
})

test.each(['approved', 'adjusted'])('a time template keeps the new session identity when a review is %s', status => {
  const decidedAt = '2026-11-20T08:00:00Z'
  const state = reviewState('2026-11-21', [window('2026-11-20T08:00:00Z', '2026-11-20T11:00:00Z')])
  const previous = { id: 'old-session', dateLocal: '2026-11-19', startTime: '09:00', endTime: '09:30', taskId: 'other-task' }
  const history = [{ sessionId: previous.id, sessionSnapshot: previous, outcome: 'done' }]
  state.workLogs = history
  const proposal = review(state, decidedAt)
  const template = { ...previous, dateLocal: '2026-11-20', startTime: '10:00', endTime: '10:30' }
  const result = decideReview(state, proposal, { status, session: template, decidedAt }, { sessionId: 'new-review-session' })
  expect(result.ok).toBe(true)
  expect(result.state.workLogs).toEqual(history)
  expect(result.state.sessions).toEqual([{
    id: 'new-review-session', dateLocal: '2026-11-20', startTime: '10:00', endTime: '10:30', locked: false,
    reviewKey: proposal.reviewKey, reviewTopicId: assessment.topicId,
  }])
  expect(result.state.reviewDecisions[0]).toMatchObject({ status, sessionId: result.state.sessions[0].id })
})

test('K01 and K02 preserve name-only course work and distinguish source cancellations from local hiding', () => {
  const day = '2026-11-20', courseId = 'course', courseName = 'Syntetisk emne';
  const legacy = { id: 'legacy', title: 'Eldre oppgave', course: courseName, deadlineLocal: day + 'T12:00' }
  const other = { ...legacy, id: 'other', courseId: 'different' }
  const event = { courseId, start: day + 'T08:00:00Z', end: day + 'T09:00:00Z', cancelled: true }
  const entries = calendarEntries({
    tasks: [legacy, other], sessions: [{ id: 'legacy-slot', taskId: legacy.id, dateLocal: day, startTime: '09:00', endTime: '09:30' }],
    planner: { courses: [{ id: courseId, code: 'SYN1', name: courseName }], events: [
      { ...event, id: 'hidden', excluded: true, sourceBase: { cancelled: false } },
      { ...event, id: 'cancelled', sourceBase: { cancelled: true } },
    ] },
  })
  const filters = { courseId, courseCode: 'SYN1', courseName, cancelled: true }
  expect(entriesForDay(entries, day, filters).map(item => item.key)).toEqual(['session:legacy-slot', 'event:cancelled', 'task:legacy'])
  expect(entriesForDay(entries, day, { ...filters, cancelled: false }).map(item => item.key)).toEqual(['session:legacy-slot', 'task:legacy'])
})

test('Oslo day/year, midnight, multi-day activities and repeated deadlines stay in calendar order', () => {
  expect(calendarToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
  const events = [
    { id: 'midnight', title: 'Midnatt', activityKind: 'personal', dateLocal: '2026-11-21', start: '2026-11-20T23:00:00Z', point: true },
    { id: 'overnight', title: 'Nattøkt', activityKind: 'personal', dateLocal: '2026-11-19', start: '2026-11-19T22:30:00Z', end: '2026-11-21T00:00:00+01:00' },
  ]
  expect(eventsOnDay(events, '2026-11-20').map(item => item.id)).toEqual(['overnight'])
  expect(eventsOnDay(events, '2026-11-21').map(item => item.id)).toEqual(['midnight'])
  const tasks = [
    { id: 'first', title: 'Første frist', deadlineLocal: '2026-10-25T02:45', deadlineDisambiguation: 'earlier' },
    { id: 'later', title: 'Andre frist', deadlineLocal: '2026-10-25T02:05', deadlineDisambiguation: 'later' },
    { id: 'legacy', title: 'Uavklart historisk frist', deadlineLocal: '2026-10-25T02:30' },
  ]
  const entries = entriesForDay(calendarEntries({ tasks }), '2026-10-25')
  expect(entries.map(entry => entry.id)).toEqual(['legacy', 'first', 'later'])
  expect(timeLabel(entries[0])).toContain('må presiseres')
  expect(upcomingAgenda({ tasks: tasks.slice(0, 2).reverse(), now: new Date('2026-10-24T23:00:00Z') }).map(entry => entry.id)).toEqual(['first', 'later'])
})
