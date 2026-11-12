import { describe, expect, it } from 'vitest'
import { inspectDeadline, deadlineInstant } from '../../src/deadline.js'
import { validateDraft, validTasks, editTask, isOverdue, sortedTasks, selectTasksForMinutes, deadlineInstant as deadlineEpoch } from '../../src/tasks.js'
import { calendarEntries, entriesForDay, timeLabel } from '../../src/calendar-model.js'
import { createStorage } from '../../src/storage.js'
import { deriveCapacity } from '../../src/capacity.js'
import { deriveWorkCapacity } from '../../src/work-capacity.js'
import { createReplan, applyReplan } from '../../src/replanning.js'
import { upcomingAgenda } from '../../src/agenda-view.js'
import { actionUrgency } from '../../src/task-dependencies.js'
import { capacityNotice } from '../../src/capacity-notice.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { StateDatabase } from '../../server/database.js'
import { calendarExportItems, calendarExportOmissions, generateCalendarIcs, validateGeneratedIcs } from '../../src/calendar-export.js'
import { comparePlans } from '../../src/plan-comparison.js'

const autumn = '2027-10-31T02:30'
const draft = (patch = {}) => ({ id: 'deadline', title: 'Innlevering', course: '', estimatedMinutes: '30', deadlineLocal: autumn, ...patch })
const task = (id, deadlineDisambiguation, patch = {}) => ({ id, title: id, course: '', estimatedMinutes: 30, completed: false, deadlineLocal: autumn,
  ...(deadlineDisambiguation === undefined ? {} : { deadlineDisambiguation }), ...patch })

describe('deadline clock input and DST clarification', () => {
  it.each([
    ['2027-10-31T25:90', 'invalid-time', /00:00 til 23:59/],
    ['2027-10-31T02:60', 'invalid-time', /klokkeslett/],
    ['2027-10-31T02:30\n', 'invalid-time', /klokkeslett/],
    ['2027-10-31T24:00', 'invalid-time', /klokkeslett/],
    ['2027-10-31T', 'invalid-time', /klokkeslett/],
    ['T02:30', 'invalid-date', /dato/],
    ['2027-02-30T02:30', 'invalid-date', /dato/],
    ['2027-03-28T02:30', 'nonexistent', /finnes ikke.*sommertid/],
  ])('explains %s without assigning an instant', (value, status, message) => {
    expect(inspectDeadline(value)).toMatchObject({ status, message: expect.stringMatching(message) })
    expect(validateDraft(draft({ deadlineLocal: value })).errors.deadlineLocal).toMatch(message)
    expect(() => deadlineInstant(value)).toThrow()
  })

  it('offers the two real occurrences and requires a deliberate choice before saving', () => {
    const info = inspectDeadline(autumn)
    expect(info.status).toBe('ambiguous')
    expect(info.options.map(({ value, offset, instant }) => ({ value, offset, instant }))).toEqual([
      { value: 'earlier', offset: '+02:00', instant: '2027-10-31T00:30:00Z' },
      { value: 'later', offset: '+01:00', instant: '2027-10-31T01:30:00Z' },
    ])
    for (const choice of [undefined, '', 'compatible', true, '+01:00']) {
      expect(validateDraft(draft({ deadlineDisambiguation: choice }))).toMatchObject({ ok: false, errors: { deadlineDisambiguation: expect.stringContaining('to ganger') } })
      expect(() => deadlineInstant(autumn, choice)).toThrow()
    }
    for (const { value, instant } of info.options) {
      expect(validateDraft(draft({ deadlineDisambiguation: value }))).toMatchObject({ ok: true, task: { deadlineLocal: autumn, deadlineDisambiguation: value } })
      expect(deadlineInstant(autumn, value)).toBe(instant)
    }
  })

  it('distinguishes regular midnight, leap dates and both sides of the spring gap', () => {
    for (const value of ['', undefined]) expect(inspectDeadline(value).status).toBe('empty')
    for (const value of ['2027-03-28T01:59', '2027-03-28T03:00', '2028-02-29T00:00', '0001-01-01T12:00']) {
      expect(inspectDeadline(value).status).toBe('valid')
      expect(Number.isFinite(Date.parse(deadlineInstant(value)))).toBe(true)
    }
  })

  it('reads legacy ambiguity without changing raw storage, and persists either repaired choice', () => {
    const legacy = task('legacy')
    let raw = JSON.stringify({ schemaVersion: 1, tasks: [legacy] })
    const original = raw
    const backing = { getItem: () => raw, setItem: (_key, value) => { raw = value } }
    const storage = createStorage(() => backing)
    expect(storage.read()).toMatchObject({ ok: true, tasks: [legacy] })
    expect(raw).toBe(original)
    expect(calendarEntries({ tasks: [legacy] })[0].warning).toContain('to ganger')
    for (const choice of ['earlier', 'later']) {
      const edited = editTask(storage.read().tasks, legacy.id, draft({ deadlineDisambiguation: choice }))
      expect(edited.ok).toBe(true)
      expect(storage.write(edited.tasks)).toEqual({ ok: true })
      const reopened = createStorage(() => backing).read()
      expect(reopened.tasks[0]).toMatchObject({ id: legacy.id, deadlineLocal: autumn, deadlineDisambiguation: choice })
      expect(calendarEntries({ tasks: reopened.tasks })[0].warning).toBe('')
    }
  })

  it('rejects malformed stored choices and removes old choices when an edited date no longer needs them', () => {
    expect(validTasks([task('legacy')])).toBe(true)
    for (const choice of ['compatible', '', null, true]) expect(validTasks([task('bad', choice)])).toBe(false)
    expect(validTasks([task('stale', 'later', { deadlineLocal: '2027-11-01T02:30' })])).toBe(false)
    const saved = task('saved', 'later')
    for (const deadlineLocal of ['2027-11-01T02:30', '2027-10-31', '']) {
      const result = editTask([saved], saved.id, draft({ deadlineLocal, deadlineDisambiguation: 'later' }))
      expect(result.ok).toBe(true)
      expect(result.tasks[0]).not.toHaveProperty('deadlineDisambiguation')
      expect(validTasks(result.tasks)).toBe(true)
    }
  })
})

describe('date-only deadlines retain their unknown clock time', () => {
  it.each([
    ['2027-03-28', '2027-03-28T22:00:00Z'],
    ['2027-10-31', '2027-10-31T23:00:00Z'],
  ])('uses only a calculation boundary for %s across a clock change', (date, boundary) => {
    expect(inspectDeadline(date)).toMatchObject({ status: 'valid', dateOnly: true, options: [], instant: boundary })
    const saved = validateDraft(draft({ deadlineLocal: date })).task
    expect(saved.deadlineLocal).toBe(date)
    expect(saved).not.toHaveProperty('deadlineDisambiguation')
    expect(deadlineEpoch(date)).toBe(Date.parse(boundary))
    expect(isOverdue(saved, new Date(Date.parse(boundary) - 1))).toBe(false)
    expect(isOverdue(saved, new Date(boundary))).toBe(true)
    const [entry] = calendarEntries({ tasks: [saved] })
    expect(entry).toMatchObject({ allDay: true, local: date, warning: '' })
    expect(timeLabel(entry)).toBe('Frist – klokkeslett ikke oppgitt')
    expect(entriesForDay([entry], date)).toHaveLength(1)
    expect(upcomingAgenda({ tasks: [saved], now: new Date(Date.parse(boundary) - 1) })[0]).toMatchObject({ allDay: true, time: '' })
    expect(upcomingAgenda({ tasks: [saved], now: new Date(boundary) })).toEqual([])
    const state = { schemaVersion: 1, tasks: [saved] }
    expect(previewBackup(JSON.stringify(exportBackup(state)), { schemaVersion: 1, tasks: [] })).toMatchObject({ ok: true, data: state })
  })

  it('preserves newer work-step identities and history while changing a repeated deadline to date-only', () => {
    const steps = [
      { id: 'research', title: 'Finn kilder', estimatedMinutes: 20, completed: true, provenance: { kind: 'manual' } },
      { id: 'outline', title: 'Lag disposisjon', estimatedMinutes: 15, completed: false, provenance: { kind: 'manual' } },
    ]
    const saved = task('report', 'later', { steps })
    const updated = editTask([saved], saved.id, draft({ deadlineLocal: '2027-10-31', deadlineDisambiguation: 'later' }))
    expect(updated.ok).toBe(true)
    expect(updated.tasks[0].steps).toEqual(steps)
    expect(updated.tasks[0].deadlineLocal).toBe('2027-10-31')
    expect(updated.tasks[0]).not.toHaveProperty('deadlineDisambiguation')
    expect(validTasks(updated.tasks)).toBe(true)
  })

  it('allocates available time through the date while retaining date-only storage', () => {
    const value = task('date-only', undefined, { deadlineLocal: '2027-10-31', estimatedMinutes: 120 })
    const workWindows = [{ id: 'evening', start: '2027-10-31T22:00:00Z', end: '2027-11-01T00:00:00Z' }]
    expect(deriveWorkCapacity([value], [], new Date('2027-10-31T21:00:00Z'), [], workWindows).tasks[0].allocatedMinutes).toBe(60)
    expect(value.deadlineLocal).toBe('2027-10-31')
  })
})

describe('one chosen deadline across all time-sensitive views', () => {
  it('exports selected occurrences as distinct UTC instants and date-only values as calendar dates', () => {
    const state = { schemaVersion: 1, tasks: [task('first', 'earlier'), task('second', 'later'), task('legacy'), task('date-only', undefined, { deadlineLocal: '2027-10-31' })] }
    const before = structuredClone(state)
    const items = calendarExportItems(state)
    expect(items.find(item => item.id === 'first').dueInstant).toBe('2027-10-31T00:30:00Z')
    expect(items.find(item => item.id === 'second').dueInstant).toBe('2027-10-31T01:30:00Z')
    expect(items.find(item => item.id === 'date-only')).toMatchObject({ allDay: true, due: '2027-10-31' })
    expect(calendarExportOmissions(state).map(item => item.id)).toEqual(['legacy'])
    const ics = generateCalendarIcs(state, { now: () => Date.parse('2027-10-30T12:00:00Z') })
    expect(validateGeneratedIcs(ics)).toBe(true)
    expect(ics).toContain('DTSTART:20271031T003000Z')
    expect(ics).toContain('DTSTART:20271031T013000Z')
    expect(ics).toContain('DTSTART;VALUE=DATE:20271031')
    expect(state).toEqual(before)
  })

  it.each([['earlier', 90], ['later', 150]])('credits current-plan work only before the %s deadline occurrence', (choice, allocated) => {
    const state = { schemaVersion: 1, tasks: [task('work', choice, { estimatedMinutes: 180 })],
      sessions: [{ id: 'study', taskId: 'work', dateLocal: '2027-10-31', startTime: '01:00', endDateLocal: '2027-10-31', endTime: '03:00' }],
      workWindows: [{ id: 'window', start: '2027-10-30T23:00:00Z', end: '2027-10-31T02:00:00Z' }] }
    const result = comparePlans(state, { now: new Date('2027-10-30T23:00:00Z') })
    expect(result.ok).toBe(true)
    const current = result.scenarios.find(scenario => scenario.id === 'current')
    expect(current.allocatedMinutes).toBe(allocated)
    expect(current.missingMaxMinutes).toBe(180 - allocated)
    expect(state.tasks[0].deadlineDisambiguation).toBe(choice)
  })

  it('round-trips both occurrences through portable backup and SQLite storage', () => {
    const state = { schemaVersion: 1, tasks: [task('first', 'earlier'), task('second', 'later')] }
    const backup = exportBackup(state)
    const restored = previewBackup(JSON.stringify(backup), { schemaVersion: 1, tasks: [] })
    expect(restored).toMatchObject({ ok: true, data: state })
    const db = new StateDatabase(':memory:')
    try {
      db.save(restored.data, 0)
      expect(db.read().envelope).toEqual(state)
    } finally { db.close() }
  })

  it('bases shortage notices on the selected occurrence', () => {
    const now = new Date('2027-10-31T00:00:00Z')
    expect(capacityNotice(task('first', 'earlier', { estimatedMinutes: 60 }), [], [], now).tone).toBe('danger')
    expect(capacityNotice(task('second', 'later', { estimatedMinutes: 60 }), [], [], now).tone).toBe('quiet')
    expect(capacityNotice(task('legacy', undefined, { estimatedMinutes: 60 }), [], [], now).tone).toBe('quiet')
  })
  it('orders repeated-hour deadlines by instant and applies the chosen overdue boundary without resetting', () => {
    const first = task('first', 'earlier', { deadlineLocal: '2027-10-31T02:45' })
    const second = task('second', 'later', { deadlineLocal: '2027-10-31T02:15' })
    const tasks = [second, first]
    expect(sortedTasks(tasks).map(t => t.id)).toEqual(['first', 'second'])
    expect(selectTasksForMinutes(tasks, 30).map(t => t.id)).toEqual(['first', 'second'])
    expect(isOverdue(first, new Date('2027-10-31T02:45:00+02:00'))).toBe(false)
    expect(isOverdue(first, new Date('2027-10-31T02:45:00.001+02:00'))).toBe(true)
    expect(isOverdue(first, new Date('2027-10-31T02:10:00+01:00'))).toBe(true)
    expect(isOverdue(second, new Date('2027-10-31T02:10:00+01:00'))).toBe(false)
    expect(isOverdue(second, new Date('2027-10-31T02:15:00.001+01:00'))).toBe(true)
  })

  it('keeps both calendar instants, readable occurrence labels and only future agenda entries', () => {
    const tasks = [task('later', 'later'), task('earlier', 'earlier')]
    const entries = entriesForDay(calendarEntries({ tasks }), '2027-10-31')
    expect(entries.map(e => e.id)).toEqual(['earlier', 'later'])
    expect(entries[1].start - entries[0].start).toBe(3_600_000)
    expect(timeLabel(entries[0])).toMatch(/første forekomst.*UTC\+02:00/)
    expect(timeLabel(entries[1])).toMatch(/andre forekomst.*UTC\+01:00/)
    expect(upcomingAgenda({ tasks, now: new Date('2027-10-31T01:00:00Z') }).map(e => e.id)).toEqual(['later'])
  })

  it('carries the exact downstream occurrence into prerequisite urgency', () => {
    const prerequisite = task('prerequisite', undefined, { deadlineLocal: '' })
    const downstream = task('later', 'later', { dependencyIds: ['prerequisite'] })
    expect(actionUrgency(prerequisite, [prerequisite, downstream])).toMatchObject({ deadlineLocal: autumn, deadlineDisambiguation: 'later' })
  })

  it('allocates different capacity before the two occurrences without guessing for legacy records', () => {
    const now = new Date('2027-10-31T00:00:00Z')
    const workWindows = [{ id: 'work', start: '2027-10-31T00:00:00Z', end: '2027-10-31T02:00:00Z' }]
    for (const [choice, expected] of [['earlier', 30], ['later', 90]]) {
      const value = task('work', choice, { estimatedMinutes: 120 })
      expect(deriveWorkCapacity([value], [], now, [], workWindows).tasks[0].allocatedMinutes).toBe(expected)
    }
    const legacy = deriveCapacity([task('legacy')], [{ id: 'session', dateLocal: '2027-10-31', startTime: '01:00', endTime: '01:30' }], new Date('2027-10-30T23:00:00Z'))
    expect(legacy.tasks[0]).toMatchObject({ allocatedMinutes: 0, availableBeforeMinutes: null })
    expect(legacy.tasks[0].reasons.join(' ')).toMatch(/tvetydig.*presiser/)
  })

  it('accepts a selected autumn deadline in replanning and preserves it through commit validation', () => {
    const state = { schemaVersion: 1, tasks: [task('work', 'later')], sessions: [], workWindows: [{ id: 'before', start: '2027-10-30T22:00:00Z', end: '2027-10-30T23:00:00Z' }] }
    const now = new Date('2027-10-30T21:00:00Z')
    const preview = createReplan(state, { now })
    expect(preview.problems.join(' ')).not.toContain('tvetydig')
    expect(preview.proposed).toHaveLength(1)
    const result = applyReplan(state, preview, { now })
    expect(result.ok).toBe(true)
    expect(result.state.tasks[0].deadlineDisambiguation).toBe('later')
  })
})
