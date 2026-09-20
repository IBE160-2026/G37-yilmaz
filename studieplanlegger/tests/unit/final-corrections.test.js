import { describe, it, expect, vi } from 'vitest'
import { exportBackup, previewBackup, previewLocalRecovery } from '../../src/backup.js'
import { validEnvelope, createStorage, STORAGE_KEY } from '../../src/storage.js'
import { validCalendarPreferences } from '../../src/calendar-preferences.js'
import { courseOptionLabels } from '../../src/task-form.js'
import { recordChange, restoreTrash } from '../../src/history.js'
import { mergeImport } from '../../src/planner.js'
import { sourceCoverage, disappearancePolicy } from '../../src/source-coverage.js'
import { createCalendarSync } from '../../src/calendar-sync.js'
import { calendarRange, timeLabel } from '../../src/calendar-model.js'
import { calendarAxis, axisSegments } from '../../src/calendar-axis.js'

const now = new Date('2026-09-08T06:00:00Z')
const course = { id: 'c', code: 'TEST101', name: 'Isolated', university: 'NTNU', semester: 'autumn', year: 2026, credits: 10, notes: '' }
const task = { id: 'task', title: 'Retain work', course: 'TEST101', courseId: 'c', deadlineLocal: '', estimatedMinutes: 90, remainingMinutes: 45, completed: false }
const privateUrl = 'https://calendar.example.invalid/private.ics?access_token=PRIVATE_SECRET_9182'
const source = { id: `legacy:${privateUrl}`, courseId: 'c', kind: 'url', url: privateUrl, name: 'My calendar', groups: ['lecture'], allGroups: ['lecture', 'lab'], lastUpdated: '2026-09-01T00:00:00Z', autoRefresh: false }
const event = (id, patch = {}) => ({ id, title: 'Keep lesson', courseId: 'c', sourceId: source.id, sourceKey: id, sourceUid: id, start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z', notes: 'Keep my note', group: 'lecture', ...patch })
const data = () => ({ schemaVersion: 1, tasks: [structuredClone(task)], sessions: [{ id: 'session', taskId: 'task', dateLocal: '2026-09-08', startTime: '12:00', endTime: '13:00' }], planner: { courses: [structuredClone(course)], sources: [structuredClone(source)], events: [event(`event:${source.id}:one`, { sourceKey: 'one', sourceUid: 'one' }), event('export-id-1')] } })
const fixedUrl = 'https://tp.educloud.no/ntnu/timeplan/ical.php?sem=26h&id%5B%5D=TEST101&type=course'
const preferences = () => ({ version: 1, view: 'month', date: '2026-10-20', courseId: 'c', kinds: ['teaching', 'deadline'], completed: false, cancelled: true, scroll: { 'month:2026-10-20': { top: 120, left: 0 } } })

describe('unambiguous course labels and atomic calendar preferences', () => {
  it('includes institution/campus and deterministically disambiguates otherwise identical courses', () => {
    const courses = [{ ...course, id: 'b', campus: 'Trondheim' }, { ...course, id: 'a', campus: 'Trondheim' }, { ...course, id: 'hvl', university: 'HVL', campus: 'Bergen' }]
    const labels = courseOptionLabels(courses)
    expect(new Set(labels.values()).size).toBe(3)
    expect(labels.get('hvl')).toContain('HVL · Bergen')
    expect(labels.get('a')).toContain('Valg 1')
    expect(Object.fromEntries(courseOptionLabels([...courses].reverse()))).toEqual(Object.fromEntries(labels))
  })
  it.each([{ view: 'invalid' }, { date: '2026-02-31' }, { courseId: 1 }, { kinds: ['script'] }, { scroll: { 'month:2026-10-20': { top: -1, left: 0 } } }])('rejects malformed persisted preferences %o', patch => {
    expect(validCalendarPreferences({ ...preferences(), ...patch })).toBe(false)
    expect(validEnvelope({ ...data(), calendarPreferences: { ...preferences(), ...patch } })).toBe(false)
  })
  it('roundtrips validated preferences through portable backup and raw recovery', () => {
    const original = { ...data(), calendarPreferences: preferences() }, backup = exportBackup(original, now)
    expect(previewBackup(JSON.stringify(backup), data()).data.calendarPreferences).toEqual(original.calendarPreferences)
    expect(previewLocalRecovery({ data: original }, data()).data.calendarPreferences).toEqual(original.calendarPreferences)
    expect(validEnvelope({ ...original, calendarPreferences: { ...preferences(), courseId: 'missing' } }, { relations: true })).toBe(false)
  })
  it('keeps data and preferences together when replacement storage fails', () => {
    const before = { ...data(), calendarPreferences: preferences() }, values = new Map([[STORAGE_KEY, JSON.stringify(before)]])
    const backend = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (key === STORAGE_KEY) throw Error('full'); values.set(key, value) } }, storage = createStorage(() => backend)
    storage.read()
    const after = { ...before, tasks: [], calendarPreferences: { ...preferences(), view: 'day', date: '2026-12-01', courseId: '' } }
    expect(storage.replace(after).ok).toBe(false)
    expect(storage.snapshot()).toEqual(before); expect(JSON.parse(values.get(STORAGE_KEY))).toEqual(before)
  })
})

describe('portable legacy identities and raw local recovery', () => {
  it('rekeys deterministically only in the export, avoiding collisions and connection leakage', () => {
    const original = data(), copy = structuredClone(original)
    original.custom = { sourceReference: source.id, eventReference: original.planner.events[0].id, message: `Connection ${privateUrl}` }
    const backup = exportBackup(original, now), raw = JSON.stringify(backup)
    expect(exportBackup(original, now)).toEqual(backup)
    expect(raw).not.toMatch(/PRIVATE_SECRET_9182|calendar\.example\.invalid|https%3A/)
    expect(backup.rekeyedIds).toBeGreaterThanOrEqual(2)
    expect(backup.data.planner.events[1].id).toBe('export-id-1')
    expect(new Set(backup.data.planner.events.map(e => e.id)).size).toBe(2)
    expect(backup.data.planner.events.every(e => e.sourceId === backup.data.planner.sources[0].id)).toBe(true)
    expect(backup.data.custom.sourceReference).toBe(backup.data.planner.sources[0].id)
    expect(backup.data.custom.eventReference).toBe(backup.data.planner.events[0].id)
    expect(original.planner).toEqual(copy.planner)
    expect(previewBackup(raw, data()).ok).toBe(true)
  })
  it('preserves restorable source/event/task/session history, including deleted-only legacy identities', () => {
    const before = data(), after = { ...structuredClone(before), planner: { courses: [], sources: [], events: [] }, tasks: [{ ...task }] }
    delete after.tasks[0].courseId
    after.history = recordChange(before, after, undefined, `Removed ${source.id}`, now)
    const copy = structuredClone(after), exported = exportBackup(after, now), portable = exported.data
    expect(validEnvelope(portable, { relations: true })).toBe(true)
    expect(JSON.stringify(exported)).not.toContain('PRIVATE_SECRET_9182')
    const restored = restoreTrash(portable, portable.history, portable.history.trash[0].id)
    expect(restored.ok).toBe(true)
    expect(restored.state.tasks[0]).toEqual(task)
    expect(restored.state.sessions).toEqual(before.sessions)
    expect(restored.state.planner.events.every(e => e.sourceId === restored.state.planner.sources[0].id)).toBe(true)
    expect(restored.state.planner.sources[0]).toMatchObject({ kind: 'url', reconnectRequired: true })
    expect(restored.state.planner.events[0].notes).toBe('Keep my note')
    expect(validEnvelope({ ...restored.state, history: restored.history }, { relations: true })).toBe(true)
    expect(after).toEqual(copy)
  })
  it('redacts encoded connections and credential values carried in history metadata', () => {
    const original = data(); original.extra = { api_key: 'ADDITIONAL_SECRET_9182', note: `token ADDITIONAL_SECRET_9182 ${encodeURIComponent(privateUrl)}` }
    expect(JSON.stringify(exportBackup(original, now))).not.toMatch(/ADDITIONAL_SECRET_9182|PRIVATE_SECRET_9182|calendar\.example/)
  })
  it('raw local recovery retains exact IDs, connections and configuration without export sanitation', () => {
    const original = data(), current = { schemaVersion: 1, tasks: [] }, result = previewLocalRecovery({ data: original }, current)
    expect(result.ok).toBe(true); expect(result.localRecovery).toBe(true)
    expect(result.data).toEqual(original); expect(result.data).not.toBe(original)
    expect(result.data.planner.sources[0].url).toBe(privateUrl)
    expect(previewLocalRecovery({ data: { schemaVersion: 1, tasks: [{ id: 'invalid' }] } }, current).ok).toBe(false)
  })
})

describe('bounded source disappearance', () => {
  it.each([privateUrl, 'https://cloud.timeedit.net/nmbu/web/student/rolling.ics', `${fixedUrl}&weeks=4`, fixedUrl.replace('26h', '26v'), fixedUrl.replace('TEST101', 'OTHER101')])('treats unproven coverage as non-authoritative: %s', url => {
    const s = { ...source, url, coverage: { kind: 'fixed', start: '2026-07-01', end: '2027-01-01' } }
    expect(sourceCoverage(s, course).kind).toBe('unknown')
    const policy = disappearancePolicy(s, course, { authoritative: true, cancellations: [{ uid: 'explicit' }] })
    const result = mergeImport({ courses: [course], sources: [s], events: [event('missing'), event('explicit')] }, [], s, policy)
    expect(result.planner.events[0].cancelled).not.toBe(true)
    expect(result.planner.events[1].cancelled).toBe(true)
  })
  it('allows complete fixed-semester disappearance only inside the proven window', () => {
    const s = { ...source, url: fixedUrl }, policy = disappearancePolicy(s, course, { authoritative: true })
    expect(policy.authoritative).toBe(true)
    const result = mergeImport({ courses: [course], sources: [s], events: [event('inside'), event('outside', { start: '2027-01-04T08:00:00Z', end: '2027-01-04T09:00:00Z' })] }, [], s, policy)
    expect(result.planner.events[0].cancelled).toBe(true); expect(result.planner.events[1].cancelled).not.toBe(true)
    expect(disappearancePolicy(s, course, { authoritative: false }).authoritative).toBe(false)
  })
  it('persists unknown-coverage warning while refreshing without removing missing events', async () => {
    let state = data(); state.planner.sources[0].autoRefresh = true
    const commit = vi.fn(planner => { state = { ...state, planner }; return true })
    const sync = createCalendarSync({ getState: () => state, commit, isEditing: () => false, visible: () => true, clock: () => +now, fetchText: async () => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n' })
    await sync.tick()
    expect(commit).toHaveBeenCalled(); expect(state.planner.events.every(e => !e.cancelled)).toBe(true)
    expect(state.planner.sources[0].coverage.kind).toBe('unknown')
    expect(state.planner.sources[0].syncWarnings.join(' ')).toContain('Manglende økter beholdes')
  })
})

describe('DST shared clock axis without falsified duration', () => {
  const interval = (start, end) => ({ clippedStart: Date.parse(start), clippedEnd: Date.parse(end) })
  it.each([['2026-03-29', 1380, 1440], ['2026-10-25', 1500, 1500]])('aligns 08:00 across the %s week while recording actual day length', (date, actualMinutes, axisMinutes) => {
    const axis = calendarAxis(calendarRange(date, 'week')), sunday = axis.days.get(date), monday = [...axis.days.values()][0]
    expect(sunday.actualMinutes).toBe(actualMinutes); expect(axis.minutes).toBe(axisMinutes)
    expect(sunday.hours.find(h => h.hour === 8).top).toBe(monday.hours.find(h => h.hour === 8).top)
  })
  it('splits spring transition spans around the missing civil hour, totaling actual minutes', () => {
    const axis = calendarAxis(calendarRange('2026-03-29', 'week')), day = axis.days.get('2026-03-29')
    const parts = axisSegments(interval('2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z'), day)
    expect(parts.map(p => [p.top, p.minutes])).toEqual([[90, 30], [180, 30]])
    expect(day.gaps.map(g => g.hour)).toEqual([2])
  })
  it('distinguishes repeated autumn hours and splits ordinary days around their non-existent second occurrence', () => {
    const axis = calendarAxis(calendarRange('2026-10-25', 'week')), sunday = axis.days.get('2026-10-25'), monday = axis.days.get('2026-10-19')
    expect(sunday.hours.filter(h => h.hour === 2).map(h => [h.top, h.offset])).toEqual([[120, '+02:00'], [180, '+01:00']])
    const parts = axisSegments(interval('2026-10-18T23:30:00Z', '2026-10-19T01:30:00Z'), monday)
    expect(parts.map(p => p.minutes)).toEqual([90, 30])
    expect(parts.reduce((sum, p) => sum + p.minutes, 0)).toBe(120)
    expect(timeLabel({ start: Date.parse('2026-10-25T00:15:00Z'), end: Date.parse('2026-10-25T01:15:00Z') })).toContain('+02:00')
    expect(timeLabel({ start: Date.parse('2026-10-25T00:15:00Z'), end: Date.parse('2026-10-25T01:15:00Z') })).toContain('+01:00')
  })
})
