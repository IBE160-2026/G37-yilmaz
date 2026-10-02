import { describe, expect, it } from 'vitest'
import ICAL from 'ical.js'
import { taskSteps, migrateLegacyStep, completeWorkStep, reorderWorkSteps, saveWorkSteps } from '../../src/work-steps.js'
import { proposeReview, decideReview } from '../../src/review-planning.js'
import { calendarExportItems, calendarExportOmissions, calendarUid, generateCalendarIcs, validateGeneratedIcs } from '../../src/calendar-export.js'
import { comparePlans, applyComparedPlan } from '../../src/plan-comparison.js'
import { validEnvelope } from '../../src/storage.js'
import { validDeadline, deadlineInstant } from '../../src/tasks.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { StateDatabase } from '../../server/database.js'
import { closeWork } from '../../src/work-log.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const task = { id: 'oppgave', title: 'Lang øving', course: 'IBE160', deadlineLocal: '2026-10-01T12:00', estimatedMinutes: 90, remainingMinutes: 90, completed: false }

describe('integrert arbeid, vurdering, eksport og sammenligning', () => {
  it('migrerer legacy-steget deterministisk og bevarer foreldrens arbeidsmengde', () => {
    const legacy = { ...task, nextStep: { description: 'Les kapittel', estimatedMinutes: 20 } }
    expect(taskSteps(legacy)[0].id).toBe('oppgave:legacy-next-step')
    const migrated = migrateLegacyStep(legacy)
    expect(migrated.remainingMinutes).toBe(90)
    const completed = completeWorkStep(migrated, migrated.steps[0].id)
    expect(completed.task.remainingMinutes).toBe(90)
    expect(reorderWorkSteps(completed.task, [migrated.steps[0].id]).ok).toBe(true)
  })

  it('foreslår ikke eller skriver repetisjon før eksplisitt godkjenning', () => {
    const state = { schemaVersion: 1, tasks: [task], topics: [{ id: 't', title: 'Normalisering', taskId: task.id }], assessments: [{ id: 'a', topicId: 't', rating: 2, assessedAt: '2026-09-28T10:00:00Z' }], sessions: [] }
    const raw = JSON.stringify(state), proposal = proposeReview(state, state.assessments[0], { now: new Date('2026-09-28T10:00:00Z') })
    expect(proposal.suggested).toBe(true); expect(JSON.stringify(state)).toBe(raw)
    const result = decideReview(state, proposal, { status: 'approved', session: { dateLocal: '2026-09-29', startTime: '10:00', endTime: '10:30' }, decidedAt: '2026-09-28T10:01:00Z' }, { id: 'd', sessionId: 's' })
    expect(result.ok).toBe(true); expect(result.state.sessions[0].reviewKey).toBe(proposal.reviewKey)
    expect(validEnvelope(result.state, { relations: true })).toBe(true)
  })

  it('lager parsebar ICS med transparent VEVENT-frist, UTC-tider og foldede Unicode-linjer', () => {
    const state = { tasks: [{ ...task, title: 'Øving '.repeat(20) }], sessions: [{ id: 's', taskId: task.id, dateLocal: '2026-09-30', startTime: '10:00', endTime: '11:00' }] }
    const source = generateCalendarIcs(state, { from: '2026-09-01', to: '2026-10-31' })
    expect(validateGeneratedIcs(source)).toBe(true)
    const parsed = new ICAL.Component(ICAL.parse(source))
    expect(parsed.getAllSubcomponents('vtodo')).toHaveLength(0)
    expect(parsed.getAllSubcomponents('vevent')).toHaveLength(2)
    expect(parsed.getAllSubcomponents('vevent').find(item => item.getFirstPropertyValue('summary').includes('Frist:')).getFirstPropertyValue('transp')).toBe('TRANSPARENT')
    expect(source.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true)
  })

  it('bruker eksakte Oslo-offseter og stabile, adskilte kalender-UID-er', () => {
    const state = { tasks: [task], sessions: [
      { id: 'summer', taskId: task.id, dateLocal: '2026-06-01', startTime: '10:00', endTime: '10:30' },
      { id: 'winter', taskId: task.id, dateLocal: '2026-12-01', startTime: '10:00', endTime: '10:30' },
    ] }
    const source = generateCalendarIcs(state, { from: '2026-01-01', to: '2026-12-31' })
    expect(source).toContain('DTSTART:20260601T080000Z'); expect(source).toContain('DTSTART:20261201T090000Z')
    expect(calendarUid('session', 'same')).toBe(calendarUid('session', 'same'))
    expect(new Set([calendarUid('session', 'same'), calendarUid('deadline', 'same'), calendarUid('session', 'other')]).size).toBe(3)
    expect(calendarUid('session', 'same')).toMatch(/^session-[0-9a-f]{32}@studieplanlegger\.local$/)
  })

  it('round-tripper ICS-tekst med backslash, skilletegn og alle linjeskift', () => {
    const title = 'Tittel \\ komma, semikolon; CR\rLF\nCRLF\r\nslutt'
    const location = 'Rom \\ A,B;C\rD\nE\r\nF'
    const state = { tasks: [], planner: { courses: [{ id: 'c', code: 'IBE160' }], events: [{ id: 'escaped', courseId: 'c', title, location, start: '2026-09-30T08:00:00Z', end: '2026-09-30T09:00:00Z' }] } }
    const parsed = new ICAL.Component(ICAL.parse(generateCalendarIcs(state, { includeSessions: false, includeDeadlines: false, includeTeaching: true })))
    const event = parsed.getFirstSubcomponent('vevent')
    expect(event.getFirstPropertyValue('summary')).toBe(`[IBE160] ${title.replace(/\r\n|\r|\n/g, '\n')}`)
    expect(event.getFirstPropertyValue('location')).toBe(location.replace(/\r\n|\r|\n/g, '\n'))
  })

  it('tar med kalenderintervaller som starter før, men overlapper valgt Oslo-periode', () => {
    const state = { tasks: [], sessions: [{ id: 'overnight', dateLocal: '2026-09-30', startTime: '23:30', endDateLocal: '2026-10-01', endTime: '00:30' }], planner: { courses: [], sources: [], events: [{ id: 'teaching', title: 'Nattøkt', start: '2026-09-30T21:30:00Z', end: '2026-09-30T22:30:00Z' }] } }
    const items = calendarExportItems(state, { from: '2026-10-01', to: '2026-10-01', includeTeaching: true })
    expect(items.map(item => item.id)).toEqual(['overnight', 'teaching'])
  })

  it('bevarer datofrist uten klokkeslett og eksporterer den som heldagsfrist', () => {
    const dated = { ...task, deadlineLocal: '2026-10-01' }
    expect(validDeadline(dated.deadlineLocal)).toBe(true)
    expect(deadlineInstant(dated.deadlineLocal)).toBeGreaterThan(Date.parse('2026-10-01T00:00:00Z'))
    const source = generateCalendarIcs({ tasks: [dated] }, { from: '2026-10-01', to: '2026-10-01' })
    expect(source).toContain('DTSTART;VALUE=DATE:20261001')
    expect(source).toContain('TRANSP:TRANSPARENT')
    expect(source).not.toContain('DTEND')
  })

  it('leser én økt, klokkeslettfrist og datofrist tilbake som tre unike VEVENT-er', () => {
    const state = {
      tasks: [task, { ...task, id: 'date-deadline', title: 'Datofrist', deadlineLocal: '2026-10-02' }, { ...task, id: 'invalid-deadline', deadlineLocal: '2026-02-30' }],
      sessions: [{ id: 'session', taskId: task.id, dateLocal: '2026-09-30', startTime: '10:00', endTime: '11:00' }],
    }
    const component = new ICAL.Component(ICAL.parse(generateCalendarIcs(state, { from: '2026-01-01', to: '2026-12-31' })))
    const events = component.getAllSubcomponents('vevent')
    expect(events).toHaveLength(3)
    expect(component.getAllSubcomponents('vtodo')).toHaveLength(0)
    expect(new Set(events.map(event => event.getFirstPropertyValue('uid'))).size).toBe(3)
    const deadlines = events.filter(event => event.getFirstPropertyValue('summary').includes('Frist:'))
    expect(deadlines).toHaveLength(2)
    expect(deadlines.every(event => event.getFirstPropertyValue('transp') === 'TRANSPARENT')).toBe(true)
    expect(events.every(event => event.getFirstProperty('dtstart'))).toBe(true)
  })

  it('eksporterer alle eksplisitte kombinasjoner av økter, frister og undervisning', () => {
    const state = {
      tasks: [{ ...task, courseId: 'course' }],
      sessions: [{ id: 's', taskId: task.id, dateLocal: '2026-09-30', startTime: '10:00', endTime: '11:00' }],
      planner: { courses: [{ id: 'course', code: 'IBE160' }], sources: [], events: [{ id: 'e', courseId: 'course', title: 'Forelesning', start: '2026-09-30T08:00:00Z', end: '2026-09-30T09:00:00Z' }] },
    }
    for (let mask = 0; mask < 8; mask += 1) {
      const options = { from: '2026-09-01', to: '2026-10-31', includeSessions: Boolean(mask & 1), includeDeadlines: Boolean(mask & 2), includeTeaching: Boolean(mask & 4) }
      const items = calendarExportItems(state, options)
      expect(items.filter(item => item.kind === 'session')).toHaveLength(options.includeSessions ? 1 : 0)
      expect(items.filter(item => item.kind === 'deadline')).toHaveLength(options.includeDeadlines ? 1 : 0)
      expect(items.filter(item => item.kind === 'teaching')).toHaveLength(options.includeTeaching ? 1 : 0)
    }
  })

  it('eksporterer bare blokkerende undervisning og sorterer heldagsfrister kronologisk', () => {
    const event = (id, patch = {}) => ({ id, title: id, start: '2026-10-01T08:00:00Z', end: '2026-10-01T09:00:00Z', ...patch })
    const state = {
      tasks: [{ ...task, id: 'later', deadlineLocal: '2026-10-03' }, { ...task, id: 'earlier', deadlineLocal: '2026-10-01' }],
      planner: { courses: [], events: [event('blocking'), event('cancelled', { cancelled: true }), event('transparent', { transparent: true }), event('information', { information: true }), event('rfc-transparent', { transparency: 'TRANSPARENT' })] },
    }
    const items = calendarExportItems(state, { from: '2026-10-01', to: '2026-10-03', includeSessions: false, includeTeaching: true })
    expect(items.map(item => item.id)).toEqual(['earlier', 'blocking', 'later'])
  })

  it('rapporterer frister som må presiseres innen valgt eksportperiode', () => {
    const state = { tasks: [{ ...task, id: 'ambiguous', deadlineLocal: '2026-10-25T02:30' }, { ...task, id: 'invalid', deadlineLocal: 'ukjent-klokkeslett' }] }
    expect(calendarExportOmissions(state, { from: '2026-10-25', to: '2026-10-25' }).map(item => item.id)).toEqual(['ambiguous', 'invalid'])
    expect(calendarExportOmissions(state, { from: '2026-10-26', to: '2026-10-26' }).map(item => item.id)).toEqual(['invalid'])
  })

  it('bruker bare kollisjonsfri registrert kapasitet for repetisjon', () => {
    const assessment = { id: 'a', topicId: 't', rating: 1, assessedAt: '2026-09-28T08:00:00Z' }
    const state = { schemaVersion: 1, tasks: [task], topics: [{ id: 't', title: 'Tema', taskId: task.id, examDate: '2026-10-02' }], assessments: [assessment], sessions: [{ id: 'busy-session', taskId: task.id, dateLocal: '2026-10-01', startTime: '10:00', endTime: '10:30' }], workWindows: [{ id: 'w', start: '2026-10-01T08:00:00Z', end: '2026-10-01T09:00:00Z' }] }
    const proposal = proposeReview(state, assessment, { now: new Date('2026-09-28T08:00:00Z') })
    expect(proposal.proposedSession).toMatchObject({ dateLocal: '2026-10-01', startTime: '10:30', endTime: '11:00' })
    expect(state.sessions).toHaveLength(1)
  })

  it('validerer vurderingsdatoer, nattforslag, utløpt utsettelse og stale forslag', () => {
    const assessment = { id: 'a', topicId: 't', rating: 1, assessedAt: '2026-09-28T08:00:00Z' }
    const base = { schemaVersion: 1, tasks: [task], topics: [{ id: 't', title: 'Tema', taskId: task.id, examDate: '2026-10-02' }], assessments: [assessment], sessions: [], workWindows: [{ id: 'night', start: '2026-09-30T21:30:00Z', end: '2026-09-30T22:00:00Z' }] }
    const proposal = proposeReview(base, assessment, { now: new Date('2026-09-28T08:00:00Z') })
    expect(proposal.proposedSession).toMatchObject({ dateLocal: '2026-09-30', startTime: '23:30', endDateLocal: '2026-10-01', endTime: '00:00' })
    expect(proposeReview({ ...base, topics: [{ ...base.topics[0], examDate: '2026-02-30' }] }, assessment)).toMatchObject({ ok: false, error: expect.stringContaining('gyldig kalenderdato') })
    expect(proposeReview(base, null)).toMatchObject({ ok: false })
    expect(decideReview({ ...base, assessments: [{ ...assessment, rating: 2 }] }, proposal, { status: 'rejected' })).toMatchObject({ ok: false, stale: true })
    const deferred = decideReview(base, proposal, { status: 'deferred', deferUntil: '2026-09-29', decidedAt: '2026-09-28T08:01:00Z' }, { id: 'deferred' }).state
    expect(proposeReview(deferred, assessment, { now: new Date('2026-09-28T12:00:00Z') }).duplicate).toBe(true)
    const renewed = proposeReview(deferred, assessment, { now: new Date('2026-09-29T00:00:00+02:00') })
    expect(renewed).toMatchObject({ suggested: true, replaceDecisionId: 'deferred' })
    expect(decideReview(deferred, renewed, { status: 'rejected', decidedAt: '2026-09-29T00:01:00+02:00' }).state.reviewDecisions).toHaveLength(1)
  })

  it('krever en justert/godkjent repetisjonsbeslutning med samsvarende økt', () => {
    const state = { schemaVersion: 1, tasks: [task], topics: [{ id: 't', title: 'Tema', taskId: task.id }], assessments: [{ id: 'a', topicId: 't', rating: 2, assessedAt: '2026-09-28T08:00:00Z' }], reviewDecisions: [{ id: 'd', assessmentId: 'a', reviewKey: 'review:t:a', status: 'approved', decidedAt: '2026-09-28T08:01:00Z' }] }
    expect(validEnvelope(state, { relations: true })).toBe(false)
  })

  it('rekeyer og gjenoppretter vurderingsrelasjoner og migrerer legacy-steg uten dobbeltkilde', () => {
    const legacy = { ...task, nextStep: { description: 'Les', estimatedMinutes: 10 } }
    const savedStep = saveWorkSteps(legacy, taskSteps(legacy)).task
    expect(savedStep.nextStep).toBeUndefined()
    const state = { schemaVersion: 1, tasks: [task], topics: [{ id: 'topic', title: 'Tema', taskId: task.id }], assessments: [{ id: 'assessment', topicId: 'topic', rating: 2, assessedAt: '2026-09-28T08:00:00Z' }], reviewDecisions: [] }
    const preview = previewBackup(JSON.stringify(exportBackup(state, new Date('2026-09-28T08:00:00Z'))), { schemaVersion: 1, tasks: [] })
    expect(preview.ok).toBe(true); expect(preview.data.assessments[0].topicId).toBe(preview.data.topics[0].id)
  })

  it('bygger avledet reviewKey på nytt etter portabel ID-utskifting', () => {
    const topicId = 'https://example.test/topic?token=secret-review', assessmentId = 'https://example.test/assessment?token=secret-review'
    const state = { schemaVersion: 1, tasks: [task], topics: [{ id: topicId, title: 'Tema', taskId: task.id }], assessments: [{ id: assessmentId, topicId, rating: 2, assessedAt: '2026-09-28T08:00:00Z' }], sessions: [{ id: 'review-session', dateLocal: '2026-09-30', startTime: '10:00', endTime: '10:30', reviewKey: `review:${topicId}:${assessmentId}`, reviewTopicId: topicId }], reviewDecisions: [{ id: 'decision', assessmentId, reviewKey: `review:${topicId}:${assessmentId}`, status: 'approved', sessionId: 'review-session', decidedAt: '2026-09-28T08:01:00Z' }] }
    const data = exportBackup(state).data, expected = `review:${data.assessments[0].topicId}:${data.assessments[0].id}`
    expect(data.reviewDecisions[0].reviewKey).toBe(expected); expect(data.sessions[0]).toMatchObject({ reviewKey: expected, reviewTopicId: data.topics[0].id })
    expect(validEnvelope(data, { relations: true })).toBe(true)
  })

  it('bygger reviewKey på nytt i en fullført økts historiske snapshot', () => {
    const topicId = 'https://example.test/topic?token=completed-review', assessmentId = 'https://example.test/assessment?token=completed-review'
    const key = `review:${topicId}:${assessmentId}`
    const session = { id: 'completed-review', taskId: task.id, dateLocal: '2026-09-28', startTime: '10:00', endTime: '10:30', reviewKey: key, reviewTopicId: topicId }
    const state = { schemaVersion: 1, tasks: [task], sessions: [session], topics: [{ id: topicId, title: 'Tema', taskId: task.id }], assessments: [{ id: assessmentId, topicId, rating: 2, assessedAt: '2026-09-28T08:00:00Z' }], reviewDecisions: [{ id: 'decision', assessmentId, reviewKey: key, status: 'approved', sessionId: session.id, decidedAt: '2026-09-28T08:01:00Z' }] }
    const closed = closeWork(state, { taskId: task.id, sessionId: session.id, operationId: 'complete-review', outcome: 'done', actualMinutes: 30, remainingMinutes: 0 }, { now: new Date('2026-09-28T08:30:00Z') })
    expect(closed.ok).toBe(true)
    closed.state.sessions = []
    const data = exportBackup(closed.state).data
    const expected = `review:${data.assessments[0].topicId}:${data.assessments[0].id}`
    expect(data.workLogs[0].sessionSnapshot).toMatchObject({ reviewKey: expected, reviewTopicId: data.topics[0].id })
    expect(validEnvelope(data, { relations: true })).toBe(true)
  })

  it('avviser en aktiv repetisjonsøkt som peker på feil tema', () => {
    const state = { schemaVersion: 1, tasks: [task], topics: [{ id: 'topic', title: 'Tema', taskId: task.id }, { id: 'wrong', title: 'Feil tema' }], assessments: [{ id: 'assessment', topicId: 'topic', rating: 2, assessedAt: '2026-09-28T08:00:00Z' }], sessions: [{ id: 'review', dateLocal: '2026-09-30', startTime: '10:00', endTime: '10:30', reviewKey: 'review:topic:assessment', reviewTopicId: 'wrong' }], reviewDecisions: [{ id: 'decision', assessmentId: 'assessment', reviewKey: 'review:topic:assessment', status: 'approved', sessionId: 'review', decidedAt: '2026-09-28T08:01:00Z' }] }
    expect(validEnvelope(state, { relations: true })).toBe(false)
  })

  it('avviser stale scenario apply og runder nye samlinger gjennom SQLite migration 4', () => {
    const state = { schemaVersion: 1, tasks: [task], sessions: [], workWindows: [{ id: 'w', start: '2026-09-29T08:00:00Z', end: '2026-09-29T12:00:00Z' }], topics: [{ id: 't', title: 'Tema', taskId: task.id }], assessments: [{ id: 'a', topicId: 't', rating: 4, assessedAt: '2026-09-28T10:00:00Z' }], reviewDecisions: [] }
    const comparison = comparePlans(state, { now: new Date('2026-09-28T08:00:00Z') })
    expect(comparison.ok).toBe(true); expect(Object.isFrozen(comparison.scenarios[0])).toBe(true)
    expect(comparison.scenarios.find(item => item.id === 'current').preview.changes).toEqual([])
    expect(applyComparedPlan({ ...state, tasks: [{ ...task, title: 'Endret' }] }, comparison, 'current', { now: new Date('2026-09-28T08:00:00Z') })).toMatchObject({ ok: false, stale: true })
    const closed = closeWork({ ...state, sessions: [{ id: 'closed-session', taskId: task.id, dateLocal: '2026-09-28', startTime: '10:00', endTime: '10:30' }] }, { taskId: task.id, sessionId: 'closed-session', operationId: 'close-session', outcome: 'more', actualMinutes: '30', remainingMinutes: '60' }, { now: new Date('2026-09-28T08:30:00Z') })
    expect(closed.ok).toBe(true)
    const linkedState = { ...closed.state, topics: state.topics, assessments: [{ ...state.assessments[0], sessionId: 'closed-session' }], reviewDecisions: [] }
    expect(validEnvelope(linkedState, { relations: true })).toBe(true)
    const directory = mkdtempSync(join(tmpdir(), 'integrated-plan-')), filename = join(directory, 'state.sqlite')
    const db = new StateDatabase(filename)
    try {
      db.save(linkedState, 0); expect(db.read().envelope).toEqual(linkedState); expect(db.db.prepare('SELECT session_id FROM assessments WHERE id=?').get('a').session_id).toBe('closed-session'); expect(db.db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get().version).toBe(5)
      expect(db.db.prepare("PRAGMA foreign_key_list('topics')").all().map(row => row.from)).toEqual(expect.arrayContaining(['task_id', 'course_id']))
      expect(db.db.prepare("PRAGMA foreign_key_list('review_decisions')").all().map(row => row.from)).toContain('session_id')
    } finally { db.close(); rmSync(directory, { recursive: true, force: true }) }
  })

  it('prioriterer valgte oppgaver først uten å filtrere bort resten', () => {
    const second = { ...task, id: 'second', title: 'Andre', deadlineLocal: '2026-10-02T12:00', remainingMinutes: 30 }
    const first = { ...task, id: 'first', title: 'Første', deadlineLocal: '2026-10-02T12:00', remainingMinutes: 30 }
    const state = { schemaVersion: 1, tasks: [first, second], sessions: [], workWindows: [{ id: 'w', start: '2026-09-29T08:00:00Z', end: '2026-09-29T10:00:00Z' }] }
    const comparison = comparePlans(state, { now: new Date('2026-09-28T08:00:00Z'), priorityTaskIds: ['second'] })
    const proposed = comparison.scenarios.find(item => item.id === 'priority').preview.proposed
    expect(proposed[0].taskId).toBe('second'); expect(new Set(proposed.map(item => item.taskId))).toEqual(new Set(['first', 'second']))
  })

  it('viser dynamisk redusert prosent og teller bare unionert økttid innen kapasiteten', () => {
    const state = { schemaVersion: 1, tasks: [{ ...task, remainingMinutes: 120 }], sessions: [
      { id: 'a', taskId: task.id, dateLocal: '2026-09-29', startTime: '09:30', endTime: '10:30' },
      { id: 'b', taskId: task.id, dateLocal: '2026-09-29', startTime: '10:00', endTime: '11:00' },
    ], workWindows: [{ id: 'w', start: '2026-09-29T08:00:00Z', end: '2026-09-29T10:00:00Z' }] }
    const comparison = comparePlans(state, { now: new Date('2026-09-28T08:00:00Z'), reducedFraction: 0.6 })
    expect(comparison.scenarios.find(item => item.id === 'reduced').label).toContain('60 %')
    expect(comparison.scenarios.find(item => item.id === 'current')).toMatchObject({ allocatedMinutes: 60, remainingCapacityMinutes: 60 })
  })

  it('regner fast egen aktivitet som opptatt i dagens plan og restkapasitet', () => {
    const state = { schemaVersion: 1, tasks: [{ ...task, remainingMinutes: 60 }], sessions: [
      { id: 'study', taskId: task.id, dateLocal: '2026-09-29', startTime: '12:00', endTime: '13:00' },
    ], planner: { courses: [], sources: [], events: [
      { id: 'personal', activityKind: 'personal', title: 'Tannlege', dateLocal: '2026-09-29', startLocal: '12:00', endLocal: '13:00', start: '2026-09-29T10:00:00Z', end: '2026-09-29T11:00:00Z' },
    ] }, workWindows: [{ id: 'w', start: '2026-09-29T10:00:00Z', end: '2026-09-29T12:00:00Z' }] }
    const current = comparePlans(state, { now: new Date('2026-09-29T08:00:00Z') }).scenarios.find(item => item.id === 'current')
    expect(current).toMatchObject({ feasible: false, allocatedMinutes: 0, remainingCapacityMinutes: 60, missingMinMinutes: 60 })
  })

  it('fjerner vurderinger fra live data, recovery og lesbare legacy-arkiver i én databaseoperasjon', () => {
    const privateState = { schemaVersion: 1, tasks: [task], topics: [{ id: 't', title: 'Privat tema', taskId: task.id }], assessments: [{ id: 'a', topicId: 't', rating: 2, assessedAt: '2026-09-28T08:00:00Z' }], reviewDecisions: [{ id: 'd', reviewKey: 'review:t:a', assessmentId: 'a', status: 'rejected', decidedAt: '2026-09-28T08:01:00Z' }] }
    const directory = mkdtempSync(join(tmpdir(), 'integrated-purge-')), filename = join(directory, 'state.sqlite'), db = new StateDatabase(filename)
    try {
      db.save(privateState, 0); db.save(privateState, 1, { snapshot: true })
      db.db.prepare("INSERT INTO legacy_archives(fingerprint,imported_at,raw,revision) VALUES('private',datetime('now'),?,2)").run(JSON.stringify(privateState))
      const result = db.purge(2)
      expect(result.envelope.assessments).toBeUndefined(); expect(db.recovery().data.assessments).toBeUndefined()
      expect(JSON.parse(db.db.prepare("SELECT raw FROM legacy_archives WHERE fingerprint='private'").get().raw).assessments).toBeUndefined()
    } finally { db.close(); rmSync(directory, { recursive: true, force: true }) }
  })
})
