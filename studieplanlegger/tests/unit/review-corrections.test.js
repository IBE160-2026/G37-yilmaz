import { describe, it, expect, vi } from 'vitest'
import { createStorage, STORAGE_KEY, RECOVERY_KEY, validEnvelope } from '../../src/storage.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { recordChange, undoLast } from '../../src/history.js'
import { emptyPlanner, mergeImport, validateEvent, osloLocal, toInstant } from '../../src/planner.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { createCalendarSync, REFRESH_INTERVAL } from '../../src/calendar-sync.js'
import { sourceCoverage } from '../../src/source-coverage.js'
import { calendarEntries, entriesForDay, calendarRange } from '../../src/calendar-model.js'
import { upcomingAgenda } from '../../src/agenda-view.js'
import { deriveCapacity, validateSession, validSessions } from '../../src/capacity.js'
import { capacityNotice } from '../../src/capacity-notice.js'
import { deriveWorkCapacity } from '../../src/work-capacity.js'
import { searchNtnu } from '../../server/providers/ntnu.js'

const now = new Date('2026-09-08T06:00:00Z')
const course = { id: 'c', code: 'MAT100', name: 'Matematikk', university: 'NTNU', semester: 'autumn', year: 2026 }
const task = (id = 't', extra = {}) => ({ id, title: `Task ${id}`, course: 'MAT100', courseId: 'c', deadlineLocal: '2026-09-08T16:00', estimatedMinutes: 120, remainingMinutes: 90, completed: false, ...extra })
const base = () => ({ schemaVersion: 1, tasks: [task()], planner: { courses: [course], events: [], sources: [] } })
const source = (extra = {}) => ({ id: 's', courseId: 'c', kind: 'url', url: 'https://tp.educloud.no/ntnu/timeplan/ical.php?sem=26h&id%5B%5D=MAT100&type=course', name: 'Test source', groups: ['A'], allGroups: ['A'], pendingGroups: [], lastUpdated: '2026-09-01T00:00:00Z', ...extra })
const ics = (items, tp = false) => ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${tp ? '-//UiO//TP//EN' : '-//Review//EN'}`, ...items.flatMap(([uid, group = 'A', hour = '08']) => ['BEGIN:VEVENT', `UID:${uid}`, 'SUMMARY:Teaching', `X-GROUP:${group}`, `DTSTART:20260908T${hour}0000Z`, `DTEND:20260908T${String(Number(hour) + 1).padStart(2, '0')}0000Z`, 'LOCATION:Room A', 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n')
const parse = value => parseCalendar(value, { ...course, courseId: course.id })
function backing(raw = JSON.stringify(base())) {
  const values = new Map([[STORAGE_KEY, raw]])
  return { values, getItem: key => values.get(key) ?? null, setItem: vi.fn((key, value) => values.set(key, value)), removeItem: key => values.delete(key) }
}

describe('review: replacement failure and raw repair', () => {
  it('A -> B then failed C preserves recovery A and the exact current raw B', () => {
    const a = base(), b = { ...base(), tasks: [task('b')] }, c = { ...base(), tasks: [task('c')] }
    const backend = backing(JSON.stringify(a, null, 2)), storage = createStorage(() => backend)
    storage.read(); expect(storage.replace(b).ok).toBe(true)
    const recoveryA = backend.getItem(RECOVERY_KEY), rawB = backend.getItem(STORAGE_KEY)
    backend.setItem.mockImplementation((key, value) => { if (key === STORAGE_KEY) throw Error('full'); backend.values.set(key, value) })
    expect(storage.replace(c).ok).toBe(false)
    expect(backend.getItem(RECOVERY_KEY)).toBe(recoveryA)
    expect(backend.getItem(STORAGE_KEY)).toBe(rawB)
    expect(storage.snapshot()).toEqual(b); expect(storage.recovery().data).toEqual(a)
  })
  it('repairs malformed JSON only by validated replacement, retaining its actual raw bytes', () => {
    const raw = '{\n  broken: true', backend = backing(raw), storage = createStorage(() => backend)
    expect(storage.read().ok).toBe(false)
    expect(storage.writeEnvelope(base()).ok).toBe(false); expect(backend.getItem(STORAGE_KEY)).toBe(raw)
    expect(storage.replace(base()).ok).toBe(true)
    expect(JSON.parse(backend.getItem(RECOVERY_KEY)).raw).toBe(raw)
    expect(storage.read().ok).toBe(true)
  })
  it('keeps corrupt raw and older recovery if repairing the primary key fails', () => {
    const backend = backing('{bad'), storage = createStorage(() => backend)
    backend.values.set(RECOVERY_KEY, JSON.stringify({ data: base() })); storage.read()
    const old = backend.getItem(RECOVERY_KEY)
    backend.setItem.mockImplementation((key, value) => { if (key === STORAGE_KEY) throw Error('full'); backend.values.set(key, value) })
    expect(storage.replace(base()).ok).toBe(false)
    expect(backend.getItem(STORAGE_KEY)).toBe('{bad'); expect(backend.getItem(RECOVERY_KEY)).toBe(old)
  })
  it('rejects a concurrent change after an invalid read without touching either key', () => {
    const backend = backing('{bad'), storage = createStorage(() => backend); storage.read()
    backend.values.set(STORAGE_KEY, JSON.stringify(base()))
    expect(storage.replace(base()).reason).toBe('conflict'); expect(backend.setItem).not.toHaveBeenCalled()
  })
  it('retains accessible recovery A in the journal if both C and recovery rollback fail', () => {
    const a = base(), b = { ...base(), tasks: [task('b')] }, backend = backing(), storage = createStorage(() => backend)
    storage.read(); expect(storage.replace(b).ok).toBe(true)
    let staged = false
    backend.setItem.mockImplementation((key, value) => { if (key === STORAGE_KEY || staged) throw Error('blocked'); staged = true; backend.values.set(key, value) })
    expect(storage.replace({ ...base(), tasks: [task('c')] })).toMatchObject({ ok: false, recoveryJournalRetained: true })
    expect(storage.recovery().data).toEqual(a); expect(storage.snapshot()).toEqual(b)
    expect(JSON.parse(backend.getItem(RECOVERY_KEY)).raw).toBe(JSON.stringify(b))
    const reloaded = createStorage(() => backend); reloaded.read(); expect(reloaded.recovery().data).toEqual(a)
  })
  it('rolls back only its own staged recovery when current data changes during staging', () => {
    const backend = backing(), storage = createStorage(() => backend); storage.read()
    const other = JSON.stringify({ ...base(), tasks: [task('concurrent')] })
    backend.values.set(RECOVERY_KEY, 'prior recovery')
    backend.setItem.mockImplementation((key, value) => { backend.values.set(key, value); if (key === RECOVERY_KEY) backend.values.set(STORAGE_KEY, other) })
    expect(storage.replace(base()).reason).toBe('conflict')
    expect(backend.getItem(STORAGE_KEY)).toBe(other); expect(backend.getItem(RECOVERY_KEY)).toBe('prior recovery')
  })
  it('refuses the main commit and preserves a recovery journal changed by another writer', () => {
    const backend = backing(), storage = createStorage(() => backend); storage.read()
    const otherRecovery = JSON.stringify({ savedAt: '2026-09-08T07:00:00Z', data: base(), raw: backend.getItem(STORAGE_KEY) })
    backend.setItem.mockImplementation((key, value) => {
      backend.values.set(key, value)
      if (key === RECOVERY_KEY && value !== otherRecovery) backend.values.set(RECOVERY_KEY, otherRecovery)
    })
    expect(storage.replace({ ...base(), tasks: [task('replacement')] })).toMatchObject({ ok: false, reason: 'conflict' })
    expect(backend.getItem(STORAGE_KEY)).toBe(JSON.stringify(base()))
    expect(backend.getItem(RECOVERY_KEY)).toBe(otherRecovery)
  })
})

describe('review: semester interval overlap', () => {
  it('retains timed and all-day intervals crossing either semester boundary unchanged', () => {
    const raw = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Review//EN',
      'BEGIN:VEVENT', 'UID:timed-start', 'SUMMARY:Timed start', 'DTSTART:20260630T210000Z', 'DTEND:20260701T003000Z', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:day-start', 'SUMMARY:Day start', 'DTSTART;VALUE=DATE:20260630', 'DTEND;VALUE=DATE:20260702', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:timed-end', 'SUMMARY:Timed end', 'DTSTART:20261231T223000Z', 'DTEND:20261231T233000Z', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:day-end', 'SUMMARY:Day end', 'DTSTART;VALUE=DATE:20261231', 'DTEND;VALUE=DATE:20270102', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:outside', 'SUMMARY:Outside', 'DTSTART:20260630T200000Z', 'DTEND:20260630T220000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const parsed = parseCalendar(raw, { courseId: course.id, semester: 'autumn', year: 2026 })
    expect(parsed.events.map(event => event.sourceUid).sort()).toEqual(['timed-start', 'day-start', 'timed-end', 'day-end'].sort())
    expect(parsed.events.find(event => event.sourceUid === 'timed-start')).toMatchObject({ start: '2026-06-30T21:00:00.000Z', end: '2026-07-01T00:30:00.000Z' })
    expect(parsed.events.find(event => event.sourceUid === 'day-start')).toMatchObject({ allDay: true, start: '2026-06-29T22:00:00.000Z', end: '2026-07-01T22:00:00.000Z' })
  })
})

describe('review: undo and source refresh', () => {
  it('undoes import after identical refresh bookkeeping while retaining an unrelated later task', async () => {
    const before = base(), s = source({ identityMode: 'uid', syncWarnings: [] }); s.coverage = sourceCoverage(s, course)
    const after = { ...before, planner: mergeImport(before.planner, parse(ics([['one']])).events, s).planner }
    const history = recordChange(before, after)
    let state = { ...after, tasks: [...after.tasks, task('later')] }
    const sync = createCalendarSync({ getState: () => state, commit: planner => { state = { ...state, planner }; return true }, isEditing: () => false, visible: () => true, clock: () => +now, fetchText: async () => ics([['one']]) })
    await sync.tick()
    expect(state.planner.events).toEqual(after.planner.events)
    const undone = undoLast(state, history)
    expect(undone.ok).toBe(true); expect(undone.state.planner).toEqual(before.planner)
    expect(undone.state.tasks).toEqual(state.tasks)
  })
  it('still rejects real changed-source content without mutating current data', () => {
    const before = base(), after = { ...base(), planner: mergeImport(base().planner, parse(ics([['one']])).events, source()).planner }
    const history = recordChange(before, after), current = structuredClone(after)
    current.planner.sources[0].url = 'https://other.example/new.ics'
    const copy = structuredClone(current)
    expect(undoLast(current, history).ok).toBe(false); expect(current).toEqual(copy)
  })
  it('keeps new groups pending across two refreshes and respects explicit cancellation', async () => {
    let time = +now, raw = ics([['one'], ['new', 'B']])
    let state = { ...base(), planner: mergeImport(base().planner, parse(ics([['one'], ['missing']])).events, source()).planner }
    const sync = createCalendarSync({ getState: () => state, commit: planner => { state = { ...state, planner }; return true }, isEditing: () => false, visible: () => true, clock: () => time, fetchText: async () => raw })
    await sync.tick(); time += REFRESH_INTERVAL; await sync.tick()
    expect(state.planner.events.find(e => e.sourceUid === 'missing').cancelled).toBe(false)
    expect(state.planner.sources[0].pendingGroups).toEqual(['B'])
    expect(state.planner.sources[0].syncWarnings.join(' ')).toContain('Nye aktiviteter')
    raw = ics([['one'], ['new', 'B']]).replace('END:VCALENDAR', 'BEGIN:VEVENT\r\nUID:missing\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR')
    time += REFRESH_INTERVAL; await sync.tick()
    expect(state.planner.events.find(e => e.sourceUid === 'missing').cancelled).toBe(true)
  })
  it('discards a deferred old-URL response after an in-place connection replacement with editing=false', async () => {
    let resolve
    const state = { ...base(), planner: mergeImport(base().planner, parse(ics([['one']])).events, source()).planner }, commit = vi.fn()
    const sync = createCalendarSync({ getState: () => state, commit, isEditing: () => false, visible: () => true, clock: () => +now, fetchText: () => new Promise(r => { resolve = r }) })
    const pending = sync.tick(); state.planner.sources[0].url = 'https://other.example/replacement.ics'
    resolve(ics([['obsolete']])); await pending
    expect(commit).not.toHaveBeenCalled(); expect(state.planner.events.map(e => e.sourceUid)).toEqual(['one'])
  })
})

describe('review: portable credentials without substring corruption', () => {
  it('rekeys a short credential identity without rewriting ordinary note words or structural relationships', () => {
    const data = base(); data.planner.courses[0] = { ...course, id: 'abc' }; data.tasks[0].courseId = 'abc'
    data.tasks[0].notes = 'abc; keep abcdef, xabcx, abc-related and 2026-09-08.'
    data.planner.sources = [source({ courseId: 'abc', url: 'https://private.example/feed?token=abc' })]
    const before = structuredClone(data), portable = exportBackup(data).data
    expect(portable.tasks[0].notes).toContain('keep abcdef, xabcx, abc-related and 2026-09-08.')
    expect(portable.tasks[0].courseId).toBe(portable.planner.courses[0].id)
    expect(portable.planner.sources[0].courseId).toBe(portable.planner.courses[0].id)
    expect(validEnvelope(portable, { relations: true })).toBe(true); expect(data).toEqual(before)
  })
  it.each(['abc', '2026'])('removes known short credential %s from notes, retaining ordinary words, dates and relations', token => {
    const data = base(); data.tasks[0].notes = `Token: ${token}; ordinary abcdef and xabcx remain.`
    data.planner.sources = [source({ url: `https://private.example/feed.ics?token=${token}` })]
    data.sessions = [{ id: 'abc-session', taskId: 't', dateLocal: '2026-09-08', startTime: '10:00', endTime: '11:00' }]
    const before = structuredClone(data), backup = exportBackup(data)
    expect(backup.data.tasks[0].notes).not.toContain(`Token: ${token};`)
    expect(backup.data.tasks[0].notes).toContain('ordinary abcdef and xabcx remain')
    expect(backup.data.sessions).toEqual(data.sessions)
    expect(backup.data.tasks[0].deadlineLocal).toBe(data.tasks[0].deadlineLocal)
    expect(validEnvelope(backup.data, { relations: true })).toBe(true)
    expect(previewBackup(JSON.stringify(backup), base()).ok).toBe(true); expect(data).toEqual(before)
  })
})

describe('review: event identity and local flags', () => {
  it.each([{ allDay: true, cancelled: true }, { deleted: true, cancelled: true }])('note edits preserve %j', flags => {
    const previous = { id: 'e', title: 'Teaching', courseId: 'c', start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z', ...flags }
    const result = validateEvent({ title: previous.title, courseId: 'c', startLocal: osloLocal(previous.start), endLocal: osloLocal(previous.end), notes: 'Changed only note' }, previous)
    expect(result).toMatchObject({ ...flags, id: 'e', notes: 'Changed only note' })
  })
  it('imports parallel TP groups and refreshes unstable UIDs without duplicates or lost local values', () => {
    const first = parse(ics([['old-a', 'A'], ['old-b', 'B']], true))
    expect(first.events).toHaveLength(2)
    const s = source({ identityMode: 'content', groups: ['A', 'B'] }), planner = mergeImport(base().planner, first.events, s).planner
    planner.events[0].notes = 'Local'; planner.events[0].location = 'Local room'
    const ids = planner.events.map(e => e.id), next = parse(ics([['new-a', 'A'], ['new-b', 'B']], true))
    const refreshed = mergeImport(planner, next.events, s).planner
    expect(refreshed.events).toHaveLength(2); expect(refreshed.events.map(e => e.id)).toEqual(ids)
    expect(refreshed.events[0]).toMatchObject({ notes: 'Local', location: 'Local room', sourceUid: 'new-a' })
    expect(mergeImport(refreshed, [], s, { authoritative: false, cancellations: [{ uid: 'new-a' }] }).planner.events[0].cancelled).toBe(true)
  })
  it('matches an unambiguous legacy TP identity without changing its local ID', () => {
    const s = source({ identityMode: 'content' }), parsed = parse(ics([['old']], true)), planner = mergeImport(base().planner, parsed.events, s).planner
    planner.events[0].sourceKey = JSON.stringify(['Teaching', parsed.events[0].start]); planner.events[0].notes = 'Keep'
    const id = planner.events[0].id, refreshed = mergeImport(planner, parse(ics([['new']], true)).events, s).planner
    expect(refreshed.events).toHaveLength(1); expect(refreshed.events[0]).toMatchObject({ id, notes: 'Keep', sourceUid: 'new' })
  })
  it('fails safely for indistinguishable parallel TP entries rather than silently dropping one', () => {
    expect(() => parse(ics([['a'], ['b']], true))).toThrow(/tvetydig|skilles|identitet/i)
  })
  it('local exclusion and reselect preserve user tombstones and real source cancellations', () => {
    const s = source(), remote = parse(ics([['one']])).events
    const planner = mergeImport(base().planner, remote, s).planner
    Object.assign(planner.events[0], { deleted: true, notes: 'Local tombstone' })
    const excluded = mergeImport(planner, remote, s, { authoritative: false, selection: { groups: [], excludedKeys: [] } }).planner
    const cancelled = mergeImport(excluded, [], s, { authoritative: false, cancellations: [{ uid: 'one' }] }).planner
    const selected = mergeImport(cancelled, [], s, { authoritative: false, selection: { groups: ['A'], excludedKeys: [] } }).planner
    expect(selected.events[0]).toMatchObject({ id: planner.events[0].id, deleted: true, notes: 'Local tombstone', cancelled: true })
    expect(selected.events[0].excluded).not.toBe(true)
  })
})

describe('review: explicit course links and Oslo intervals', () => {
  const other = { ...course, id: 'hvl', university: 'HVL' }
  const model = () => ({ tasks: [task('ntnu'), task('hvl', { courseId: 'hvl' }), task('legacy', { courseId: undefined })], sessions: [{ id: 'linked', taskId: 'hvl', dateLocal: '2026-09-08', startTime: '10:00', endTime: '11:00' }], planner: { courses: [course, other], events: [] } })
  it.each(['day', 'week', 'month', 'agenda'])('respects explicit institution links in %s mode', view => {
    const entries = calendarEntries(model()), keys = new Set(calendarRange('2026-09-08', view).flatMap(date => entriesForDay(entries, date, { courseId: 'hvl', courseCode: 'MAT100' }).map(e => e.key)))
    expect(keys.has('task:ntnu')).toBe(false)
    for (const key of ['task:hvl', 'task:legacy', 'session:linked']) expect(keys.has(key)).toBe(true)
  })
  it('includes linked sessions and legacy unlinked tasks, but not other explicit links in compact agenda', () => {
    const keys = upcomingAgenda({ ...model(), courseFilter: 'hvl', now }).map(e => e.key)
    expect(keys).toEqual(expect.arrayContaining(['task:hvl', 'task:legacy', 'session:linked'])); expect(keys).not.toContain('task:ntnu')
  })
  it('keeps a future overnight session with its actual end date and course', () => {
    const data = model(); data.sessions[0] = { ...data.sessions[0], startTime: '23:00', endTime: '01:00', endDateLocal: '2026-09-09' }
    expect(upcomingAgenda({ ...data, courseFilter: 'hvl', now: new Date('2026-09-08T20:00:00Z') })[0]).toMatchObject({ key: 'session:linked', endDate: '2026-09-09', endTime: '01:00', course: 'MAT100', ongoing: false })
  })
  it('uses Oslo for both session shapes in a UTC host, while validating legacy fields and DST', () => {
    const previous = process.env.TZ; process.env.TZ = 'UTC'
    try {
      const legacy = { id: 'legacy', dateLocal: '2026-09-08', startTime: '10:00', endTime: '11:00' }, extended = { ...legacy, id: 'extended', endDateLocal: legacy.dateLocal }
      expect(validateSession(extended, [legacy]).valid).toBe(false)
      expect(deriveCapacity([task()], [legacy], now).tasks[0].allocations[0].startLocal).toBe('2026-09-08T10:00')
      expect(validSessions([{ ...extended, startTime: '10:00:30' }])).toBe(false)
      expect(validSessions([{ ...extended, dateLocal: '0000-01-01' }])).toBe(false)
      expect(validateSession({ ...legacy, dateLocal: '2026-03-29', startTime: '01:00', endTime: '04:00' }).valid).toBe(false)
      expect(validateSession({ ...extended, dateLocal: '2026-03-29', endDateLocal: '2026-03-29', startTime: '01:00', endTime: '04:00' }).valid).toBe(true)
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
  })
  it.each([{ transparent: true }, { transparency: 'TRANSPARENT' }, { information: true }])('does not warn that %j blocks the deadline window', flags => {
    const event = { start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z', ...flags }
    const t = task('t', { deadlineLocal: '2026-09-08T11:00', remainingMinutes: 45 })
    expect(capacityNotice(t, [], [event], new Date('2026-09-08T08:00:00Z')).tone).toBe('quiet')
    expect(capacityNotice(t, [], [{ ...event, ...{ transparent: false, transparency: 'OPAQUE', information: false } }], new Date('2026-09-08T08:00:00Z')).tone).toBe('danger')
  })
  it('recognizes a future overnight reservation in card warnings in UTC', () => {
    const previous = process.env.TZ; process.env.TZ = 'UTC'
    try { expect(capacityNotice(task('t', { deadlineLocal: '2026-09-09T12:00' }), [{ id: 'night', taskId: 't', dateLocal: '2026-09-08', endDateLocal: '2026-09-09', startTime: '23:00', endTime: '01:00' }], [], new Date('2026-09-08T20:00:00Z')).tone).toBe('planning') }
    finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
  })
})

describe('review: whole-minute allocations and verified upstream shape', () => {
  const window = { id: 'w', start: '2026-09-08T06:00:00Z', end: '2026-09-08T10:00:00Z' }
  it('allocates only representable whole-minute intervals after a second-offset busy end', () => {
    const result = deriveWorkCapacity([task()], [], now, [{ start: window.start, end: '2026-09-08T08:00:30Z' }], [window])
    expect(result.totalCapacityMinutes).toBe(119)
    const allocation = result.tasks[0].allocations[0]
    expect(allocation.startLocal).toBe('2026-09-08T10:01')
    expect(Date.parse(toInstant(allocation.startLocal))).toBeGreaterThanOrEqual(Date.parse('2026-09-08T08:00:30Z'))
    expect((Date.parse(toInstant(allocation.endLocal)) - Date.parse(toInstant(allocation.startLocal))) / 60000).toBe(allocation.minutes)
  })
  it('reserves 60 and 30 separately and never overlaps the task allocations', () => {
    const sessions = [{ id: 'a', taskId: 'a', dateLocal: '2026-09-08', startTime: '09:00', endTime: '10:00' }, { id: 'b', taskId: 'b', dateLocal: '2026-09-08', startTime: '09:30', endTime: '10:30' }]
    const result = deriveWorkCapacity([task('a'), task('b')], sessions, now, [], [window])
    expect(result.tasks.map(t => t.reservedMinutes)).toEqual([60, 30])
    const intervals = result.tasks.flatMap(t => t.allocations).sort((a, b) => a.startLocal.localeCompare(b.startLocal))
    for (let i = 1; i < intervals.length; i++) expect(intervals[i].startLocal >= intervals[i - 1].endLocal).toBe(true)
    expect(sessions.map(s => s.taskId)).toEqual(['a', 'b'])
  })
  it.each(['TDT4110', 'Informasjonsteknologi'])('maps nonempty real-shaped NTNU upstream for %s and excludes wrong name/campus', async q => {
    const rows = [{ courseCode: 'TDT4110', courseName: 'Informasjonsteknologi, grunnkurs', location: 'Trondheim', courseUrl: 'https://www.ntnu.no/studier/emner/TDT4110' }, { courseCode: 'TDT4110', courseName: 'Informasjonsteknologi, grunnkurs', location: 'Gjovik', courseUrl: 'https://www.ntnu.no/studier/emner/TDT4110' }, { courseCode: 'MA0001', courseName: 'Matematikk', location: 'Trondheim', courseUrl: 'https://www.ntnu.no/studier/emner/MA0001' }]
    const fetchText = vi.fn(async () => JSON.stringify({ courses: rows, hasMoreResults: false }))
    const result = await searchNtnu({ q, semester: 'autumn', year: 2026, campus: 'Trondheim' }, fetchText)
    expect(result.status).toBe('ok'); expect(result.results).toEqual([{ code: rows[0].courseCode, name: rows[0].courseName, campus: 'Trondheim', university: 'NTNU', semester: 'autumn', year: 2026, sourceUrl: rows[0].courseUrl }])
    const url = new URL(fetchText.mock.calls[0][0]); expect(url.searchParams.get('trondheim')).toBe('true'); expect(url.searchParams.get('courseAutumn')).toBe('true'); expect(url.searchParams.get('semester')).toBe('2026')
  })
})
