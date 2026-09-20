import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createStorage, STORAGE_KEY, RECOVERY_KEY, validEnvelope } from '../../src/storage.js'
import { exportBackup, previewBackup, withoutConnections } from '../../src/backup.js'
import { recordChange, emptyHistory, undoLast, restoreTrash, validHistory } from '../../src/history.js'
import { deriveWorkCapacity, validateWorkWindow, unionIntervals, intervalMinutes } from '../../src/work-capacity.js'
import { validateSession, deriveCapacity } from '../../src/capacity.js'
import { emptyPlanner, mergeImport, sourceSnapshot, teachingOverlap, subtractTeaching } from '../../src/planner.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { calendarEntries, calendarRange, entriesForDay, collisionLanes, dayBounds } from '../../src/calendar-model.js'
import { dailyOverview } from '../../src/daily-overview.js'
import { createCalendarSync, REFRESH_INTERVAL, nextRefresh } from '../../src/calendar-sync.js'
import { institutions } from '../../src/institutions.js'
import { providerRequest } from '../../server/providers/index.js'

const task = (id = 'task', patch = {}) => ({ id, title: `Task ${id}`, course: 'TEST101', deadlineLocal: '2026-09-08T14:00', estimatedMinutes: 90, remainingMinutes: 45, completed: false, ...patch })
const course = { id: 'course', name: 'Isolated course', code: 'TEST101', university: 'Test', semester: 'autumn', year: 2026, credits: null, notes: '' }
const source = { id: 'source', courseId: course.id, kind: 'url', url: 'https://example.invalid/calendar?token=TEST_SECRET', name: 'Test calendar', groups: ['lecture'], allGroups: ['lecture','lab'], lastUpdated: '2026-09-01T00:00:00Z' }
const event = (id = 'lesson', patch = {}) => ({ id, title: 'Lecture', courseId: course.id, start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z', notes: '', ...patch })
const envelope = patch => ({ schemaVersion: 1, tasks: [task()], ...patch })
const now = new Date('2026-09-08T06:00:00Z')
const window = (id, start, end) => validateWorkWindow({ id, startLocal: start, endLocal: end })
const ics = items => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Isolated//EN\r\n${items.map(([id,group]) => `BEGIN:VEVENT\r\nUID:${id}\r\nDTSTART:20260908T080000Z\r\nDTEND:20260908T090000Z\r\nSUMMARY:Lesson ${id}\r\nX-GROUP:${group}\r\nEND:VEVENT`).join('\r\n')}\r\nEND:VCALENDAR\r\n`
const parse = input => parseCalendar(input, { ...course, courseId: course.id })
function backing(initial) {
  const values = new Map([[STORAGE_KEY, initial === undefined ? null : JSON.stringify(initial)]])
  return { values, getItem: key => values.get(key) ?? null, setItem: vi.fn((key, value) => values.set(key, value)) }
}

describe('versioned local backup and exact history', () => {
  it('preserves optional and unknown v1 fields without startup writes', () => {
    const data = envelope({ notes: 'outer note', custom: { keep: true }, sessions: [], planner: emptyPlanner() }), backend = backing(data), storage = createStorage(() => backend)
    expect(storage.read().ok).toBe(true); expect(backend.setItem).not.toHaveBeenCalled()
    expect(storage.write([task('next')], [], data.planner).ok).toBe(true)
    expect(JSON.parse(backend.values.get(STORAGE_KEY))).toMatchObject({ notes: data.notes, custom: data.custom })
  })
  it('roundtrips relations, stable source identities and notes without credentials', () => {
    const data = envelope({ tasks: [task('task', { courseId: course.id, notes: 'local note' })], planner: { courses: [course], sources: [source], events: [event('lesson', { sourceId: source.id, sourceKey: 'stable', sourceBase: sourceSnapshot(event()) })] } })
    const exported = exportBackup(data, now), raw = JSON.stringify(exported)
    expect(raw).not.toContain('TEST_SECRET'); expect(raw).not.toContain('example.invalid')
    const preview = previewBackup(raw, envelope())
    expect(preview.ok).toBe(true); expect(preview.data.tasks).toEqual(data.tasks)
    expect(preview.data.planner.events).toEqual(data.planner.events)
    expect(preview.data.planner.sources[0]).toMatchObject({ id: source.id, reconnectRequired: true, kind: 'url' })
    expect(preview.reconnect).toBe(1)
  })
  it.each(['access_token','refresh_token','api_key','client_secret','Authorization','accessToken','refresh-token','password','credentials','headers'])('excludes %s recursively', key => {
    expect(withoutConnections({ nested: [{ [key]: 'TEST_SECRET', notes: 'keep' }] })).toEqual({ nested: [{ notes: 'keep' }] })
  })
  it('rekeys a legacy URL-embedded ID only in the portable export', () => {
    const original = envelope({ planner: { courses: [course], events: [], sources: [{ ...source, id: `legacy:${source.url}` }] } })
    const backup = exportBackup(original)
    expect(backup.data.planner.sources[0].id).toMatch(/^export-id-/)
    expect(JSON.stringify(backup)).not.toContain('TEST_SECRET')
    expect(original.planner.sources[0].id).toBe(`legacy:${source.url}`)
  })
  it('rejects invalid replacement before any write', () => {
    const backend = backing(envelope()), storage = createStorage(() => backend); storage.read()
    expect(storage.replace(envelope({ tasks: [{ id: 'broken' }] })).ok).toBe(false)
    expect(backend.setItem).not.toHaveBeenCalled()
  })
  it('writes the recoverable prior copy before replacing', () => {
    const before = envelope(), after = envelope({ tasks: [task('new')] }), backend = backing(before), storage = createStorage(() => backend); storage.read()
    expect(storage.replace(after).ok).toBe(true)
    expect(backend.setItem.mock.calls.map(call => call[0])).toEqual([RECOVERY_KEY, STORAGE_KEY])
    expect(storage.recovery().data).toEqual(before)
  })
  it('aborts when the recovery copy cannot be saved', () => {
    const backend = backing(envelope()), storage = createStorage(() => backend); storage.read()
    backend.setItem.mockImplementation(() => { throw Error('full') })
    expect(storage.replace(envelope({ tasks: [] })).reason).toBe('recovery-failed')
    expect(storage.snapshot().tasks).toHaveLength(1)
  })
  it('rejects another-tab conflicts without overwriting later data', () => {
    const backend = backing(envelope()), storage = createStorage(() => backend); storage.read()
    backend.values.set(STORAGE_KEY, JSON.stringify(envelope({ tasks: [task('other-tab')] })))
    expect(storage.write([]).reason).toBe('conflict')
    expect(backend.setItem).not.toHaveBeenCalled()
  })
  it('undo restores exact prior status/remaining values and preserves unrelated later tasks', () => {
    const before = envelope(), after = envelope({ tasks: [task('task', { completed: true })] }), history = recordChange(before, after)
    const result = undoLast({ ...after, tasks: [...after.tasks, task('later')] }, history)
    expect(result.ok).toBe(true); expect(result.state.tasks).toEqual([task(), task('later')]); expect(result.history.undo).toEqual([])
  })
  it('restores a course and its events, sources and exact task links after reload', () => {
    const before = envelope({ tasks: [task('task', { courseId: course.id })], planner: { courses: [course], events: [event('lesson', { sourceId: source.id })], sources: [source] } })
    const after = envelope({ planner: emptyPlanner() }), history = JSON.parse(JSON.stringify(recordChange(before, after)))
    expect(validHistory(history, after)).toBe(true)
    const result = restoreTrash(after, history, history.trash[0].id)
    expect(result.state).toEqual(before); expect(result.history.trash).toHaveLength(0)
    expect(restoreTrash(result.state, result.history, history.trash[0].id).ok).toBe(false)
  })
  it('rejects conflicting restoration without duplicates or mutation', () => {
    const before = envelope(), after = envelope({ tasks: [] }), history = recordChange(before, after), current = envelope({ tasks: [task('task', { title: 'Reused id' })] })
    expect(restoreTrash(current, history, history.trash[0].id).ok).toBe(false)
    expect(current.tasks).toHaveLength(1); expect(current.tasks[0].title).toBe('Reused id')
  })
  it('rejects malformed trash payloads and missing course/source relationships', () => {
    const history = recordChange(envelope(), envelope({ tasks: [] }))
    history.trash[0].changes[0].before = { id: 'task' }
    const backup = { format: 'studieplan-local-backup', backupVersion: 1, createdAt: now.toISOString(), data: envelope({ tasks: [], history }) }
    expect(previewBackup(JSON.stringify(backup), envelope()).ok).toBe(false)
    const dangling = envelope({ tasks: [task('task', { courseId: 'missing' })] })
    expect(validEnvelope(dangling, { relations: true })).toBe(false)
  })
  it('undo removes optional collections that did not exist before', () => {
    const before = envelope(), after = envelope({ workWindows: [window('w','2026-09-08T08:00','2026-09-08T09:00')] })
    const result = undoLast(after, recordChange(before, after)); expect(result.state).toEqual(before)
  })
})

describe('actual interval union and work reservations', () => {
  it('counts work and busy unions once without changing remaining work', () => {
    const tasks = [task()], copy = structuredClone(tasks)
    const windows = [window('a','2026-09-08T08:00','2026-09-08T12:00'), window('b','2026-09-08T10:00','2026-09-08T13:00')]
    const busy = [window('c','2026-09-08T09:00','2026-09-08T10:00'), window('d','2026-09-08T09:30','2026-09-08T10:30')]
    const result = deriveWorkCapacity(tasks, [], now, [], windows, busy)
    expect(result.totalCapacityMinutes).toBe(210); expect(result.tasks[0].state).toBe('unplanned'); expect(tasks).toEqual(copy)
  })
  it.each([{ transparent: true }, { transparency: 'TRANSPARENT' }, { information: true }, { cancelled: true }, { deleted: true }])('ignores nonbusy event %o consistently', flags => {
    const events = [event('e', flags)], windows = [window('w','2026-09-08T10:00','2026-09-08T11:00')]
    expect(deriveWorkCapacity([], [], now, events, windows).totalCapacityMinutes).toBe(60)
    expect(teachingOverlap(events, new Date('2026-09-08T08:00:00Z'), 60).availableMinutes).toBe(60)
    expect(intervalMinutes(subtractTeaching([{ start: Date.parse(events[0].start), end: Date.parse(events[0].end) }], events))).toBe(60)
  })
  it.each([['2026-03-29',120],['2026-10-25',240]])('counts actual Oslo DST minutes on %s', (date, minutes) => {
    const value = window('w',`${date}T01:00`,`${date}T04:00`)
    expect((Date.parse(value.end)-Date.parse(value.start))/60000).toBe(minutes)
    expect(validateSession({ id:'s',dateLocal:date,endDateLocal:date,startTime:'01:00',endTime:'04:00' }).valid).toBe(true)
  })
  it('supports explicit overnight sessions and rejects ambiguous input', () => {
    expect(validateSession({ id:'s',dateLocal:'2026-09-08',endDateLocal:'2026-09-09',startTime:'23:00',endTime:'01:00' }).valid).toBe(true)
    expect(() => window('w','2026-10-25T02:30','2026-10-25T04:00')).toThrow('tvetydig')
  })
  it('distinguishes unknown, unplanned, planned and insufficient', () => {
    const windows = [window('w','2026-09-08T08:00','2026-09-08T10:00')], session = {id:'s',taskId:'task',dateLocal:'2026-09-08',startTime:'08:00',endTime:'09:00'}
    expect(deriveWorkCapacity([task()], [], now).tasks[0].state).toBe('unknown')
    expect(deriveWorkCapacity([task()], [], now, [], windows).tasks[0].state).toBe('unplanned')
    expect(deriveWorkCapacity([task()], [session], now, [], windows).tasks[0]).toMatchObject({ state:'planned', requiredMinutes:45, reservedMinutes:60 })
    expect(deriveWorkCapacity([task('task',{remainingMinutes:180})], [], now, [], windows).tasks[0].state).toBe('insufficient')
    expect(deriveWorkCapacity([task('task',{estimatedMinutes:null,remainingMinutes:undefined})], [], now, [], windows).tasks[0].state).toBe('unknown')
  })
  it('does not double count overlapping reservations or allocate after a deadline', () => {
    const windows = [window('w','2026-09-08T08:00','2026-09-08T12:00')], sessions = [{id:'s1',taskId:'a',dateLocal:'2026-09-08',startTime:'09:00',endTime:'10:00'},{id:'s2',taskId:'b',dateLocal:'2026-09-08',startTime:'09:30',endTime:'10:30'}]
    const result = deriveWorkCapacity([task('a'),task('b')], sessions, now, [], windows)
    expect(result.totalReservedMinutes).toBe(90); expect(result.warnings.join(' ')).toContain('Overlappende')
    const late = deriveWorkCapacity([task('a',{deadlineLocal:'2026-09-08T08:00'})],sessions,now,[],windows)
    expect(late.tasks[0].allocatedMinutes).toBe(0)
  })
  it('keeps legacy invalid-session handling', () => { expect(() => deriveCapacity([task()], [null], now)).not.toThrow() })
})

describe('full calendar, actual daily context and real source files', () => {
  it('keeps deadlines as points, splits midnight and provides all views', () => {
    const entries = calendarEntries({ tasks:[task()], planner:{events:[event('night',{start:'2026-09-08T21:00:00Z',end:'2026-09-09T01:00:00Z'})]} })
    expect(entries.find(e=>e.kind==='deadline').start).toBe(entries.find(e=>e.kind==='deadline').end)
    expect(entriesForDay(entries,'2026-09-09').map(e=>e.id)).toContain('night')
    expect(calendarRange('2026-09-08','week')).toHaveLength(7)
    expect(calendarRange('2026-09-08','month')).toHaveLength(42)
    expect(calendarRange('2026-09-08','day')).toEqual(['2026-09-08'])
    expect(calendarRange('2026-09-08','agenda')).toHaveLength(31)
    expect((dayBounds('2026-10-25').end-dayBounds('2026-10-25').start)/3600000).toBe(25)
  })
  it('allocates overlap clusters, resets adjacent lanes, and filters types/course/status', () => {
    const lanes = collisionLanes([{key:'a',clippedStart:0,clippedEnd:60},{key:'b',clippedStart:30,clippedEnd:90},{key:'c',clippedStart:90,clippedEnd:120}])
    expect(lanes.map(e=>[e.lane,e.lanes])).toEqual([[0,2],[1,2],[0,1]])
    const entries=calendarEntries({tasks:[task('a',{completed:true})],planner:{events:[event('e',{cancelled:true})]}})
    expect(entriesForDay(entries,'2026-09-08')).toHaveLength(0)
    expect(entriesForDay(entries,'2026-09-08',{completed:true,cancelled:true,kinds:['deadline']})).toHaveLength(1)
  })
  it('uses actual activity, deadline and task reservation for today', () => {
    const tasks=[task('future',{deadlineLocal:'2026-10-01T12:00'}),task('today')], sessions=[{id:'s',taskId:'future',dateLocal:'2026-09-08',startTime:'09:00',endTime:'10:00'}]
    const result=dailyOverview({tasks,sessions,planner:emptyPlanner(),now})
    expect(result.activity.id).toBe('s'); expect(result.today.map(t=>t.id)).toEqual(['future','today']); expect(result.deadline.id).toBe('today')
  })
  it.each([['nmbu','math100',63],['hvl','dat100',49]])('parses actual %s sample conservatively', (institution,code,count) => {
    const raw=readFileSync(new URL(`../fixtures/public-programs/timeedit-${institution}-${code}-2026.ics`,import.meta.url),'utf8'), parsed=parse(raw)
    expect(parsed.events).toHaveLength(count); expect(parsed.authoritative).toBe(false)
    expect(parsed.warnings.join(' ')).toContain('gruppenummer')
    expect(parsed.events.every(e=>e.start.endsWith('Z'))).toBe(true)
    if(institution==='hvl') expect(parsed.events.filter(e=>e.title.startsWith('Kommentar kort:')).every(e=>e.information)).toBe(true)
  })
  it('preserves explicit TRANSP through parsing and three-way merge', () => {
    const parsed=parse(ics([['a','lecture']]).replace('SUMMARY:','TRANSP:TRANSPARENT\r\nSUMMARY:'))
    const result=mergeImport(emptyPlanner(),parsed.events,source,{course})
    expect(result.planner.events[0].transparent).toBe(true); expect(result.planner.events[0].sourceBase.transparent).toBe(true)
  })
})

describe('foreground refresh safety and provider contracts', () => {
  function syncFixture(fetchText) {
    let clock=+now, editing=false, visible=true
    const parsed=parse(ics([['a','lecture'],['b','lecture']]))
    let state=envelope({planner:mergeImport(emptyPlanner(),parsed.events,source,{course}).planner})
    const commit=vi.fn(planner=>{state={...state,planner};return true})
    const sync=createCalendarSync({getState:()=>state,commit,isEditing:()=>editing,visible:()=>visible,clock:()=>clock,fetchText})
    return {sync,commit,state:()=>state,time:value=>clock=value,edit:value=>editing=value,visible:value=>visible=value}
  }
  it('cancels missing selected activities in a complete feed with known unselected groups', async () => {
    const f=syncFixture(vi.fn(async()=>ics([['a','lecture'],['lab','lab']])));
    f.state().planner.sources[0].url = 'https://tp.educloud.no/ntnu/timeplan/ical.php?sem=26h&id%5B%5D=TEST101&type=course'
    await f.sync.tick()
    expect(f.state().planner.events.find(e=>e.sourceUid==='b').cancelled).toBe(true)
    expect(f.state().planner.events.some(e=>e.sourceUid==='lab')).toBe(false)
  })
  it('retains local notes and hidden tombstones across successful refresh', async () => {
    const f=syncFixture(async()=>ics([['a','lecture']])), item=f.state().planner.events[0]; item.notes='Local'; item.deleted=true
    await f.sync.tick(); expect(f.state().planner.events[0]).toMatchObject({notes:'Local',deleted:true,id:item.id})
  })
  it('backs off failures, preserves prior events, then resets after success', async () => {
    const fetchText=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(ics([['a','lecture']])), f=syncFixture(fetchText), before=structuredClone(f.state().planner.events)
    await f.sync.tick(); expect(f.state().planner.events).toEqual(before); expect(f.state().planner.sources[0].failures).toBe(1)
    f.time(+now+REFRESH_INTERVAL); await f.sync.tick(); expect(fetchText).toHaveBeenCalledTimes(1)
    f.time(+now+REFRESH_INTERVAL*2); await f.sync.tick(); expect(f.state().planner.sources[0]).toMatchObject({failures:0,lastError:''})
  })
  it('pauses editing/background and discards a result arriving during an edit', async () => {
    let resolve; const fetchText=vi.fn(()=>new Promise(r=>resolve=r)), f=syncFixture(fetchText)
    f.edit(true); await f.sync.tick(); expect(fetchText).not.toHaveBeenCalled(); f.edit(false); f.visible(false); await f.sync.tick(); expect(fetchText).not.toHaveBeenCalled()
    f.visible(true); const pending=f.sync.tick(); f.edit(true); resolve(ics([['a','lecture']])); await pending; expect(f.commit).not.toHaveBeenCalled()
  })
  it('never refreshes files and preserves partial timetables', async () => {
    const fetchText=vi.fn(async()=>ics([['a','lecture']]).replace('DTEND:20260908T090000Z','DTEND:20260908T080000Z')), f=syncFixture(fetchText)
    await f.sync.tick(); expect(f.state().planner.events.every(e=>!e.cancelled)).toBe(true)
    f.state().planner.sources[0].kind='file'; f.time(+now+REFRESH_INTERVAL*3); await f.sync.tick(); expect(fetchText).toHaveBeenCalledTimes(1)
  })
  it('persists new-group warnings and caps backoff at one day', async () => {
    const f=syncFixture(async()=>ics([['a','lecture'],['new','new-group']])); await f.sync.tick()
    expect(f.state().planner.sources[0].syncWarnings.join(' ')).toContain('Nye aktiviteter')
    expect(nextRefresh({...source,lastAttempt:now.toISOString(),failures:100})-+now).toBe(24*60*60*1000)
  })
  it('contains all 49 authoritative inventory entries with honest capability distinctions', () => {
    expect(institutions).toHaveLength(49); expect(new Set(institutions.map(i=>i.id)).size).toBe(49)
    expect(['university','specialized','accredited','programmes'].map(category=>institutions.filter(i=>i.category===category).length)).toEqual([11,9,15,14])
    expect(institutions.find(i=>i.id==='ekko').website).toBeNull()
  })
  it('distinguishes unimplemented public adapter, invalid semester and transport failure', async () => {
    const deps={fetchText:async()=>{throw Error('network unavailable')},ntnuDetails:async()=>{throw Error('network unavailable')}}, q={q:'TEST101',semester:'autumn',year:'2026'}
    expect((await providerRequest('uio','search',q,deps)).status).toBe('not-supported')
    expect((await providerRequest('ntnu','search',{...q,year:'bad'},deps)).status).toBe('semester-unavailable')
    expect((await providerRequest('ntnu','search',q,deps)).status).toBe('transport-error')
  })
})
