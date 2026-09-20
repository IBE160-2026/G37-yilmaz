import { execFileSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import {
  deleteTask, editTask, isOverdue, overdueCount, selectTasksForMinutes,
  setTaskCompleted, sortedTasks, tasksThisWeek, validateAvailableMinutes,
  validDeadline, validTasks, weekBounds,
} from '../../src/tasks.js'
import { createStorage, STORAGE_KEY } from '../../src/storage.js'

const makeTask = (id, patch = {}) => ({
  id, title: `Oppgave ${id}`, course: 'IBE160', deadlineLocal: '2026-09-03T12:00',
  estimatedMinutes: 30, completed: false, ...patch,
})
const frozenTasks = tasks => Object.freeze(tasks.map(task => Object.freeze(task)))
const ids = tasks => tasks.map(task => task.id)

describe('manuell fullføring og angre', () => {
  it.each([true, false])('endrer bare valgt boolsk status til %s uten å endre lagringsrekkefølgen', completed => {
    const tasks = frozenTasks([
      makeTask('først', { deadlineLocal: '2026-10-01T12:00' }),
      makeTask('valgt["id"]', { completed: !completed }),
      makeTask('sist', { deadlineLocal: '2026-08-01T12:00' }),
    ])
    const original = JSON.stringify(tasks)
    const result = setTaskCompleted(tasks, 'valgt["id"]', completed)

    expect(result).toEqual({ ok: true, tasks: [tasks[0], { ...tasks[1], completed }, tasks[2]] })
    expect(result.tasks).not.toBe(tasks)
    expect(ids(result.tasks)).toEqual(['først', 'valgt["id"]', 'sist'])
    expect(ids(sortedTasks(result.tasks))).toEqual(['sist', 'valgt["id"]', 'først'])
    expect(JSON.stringify(tasks)).toBe(original)
    expect(validTasks(result.tasks)).toBe(true)
  })

  it('lar fullføring angres, og redigering beholder fullført status', () => {
    const saved = frozenTasks([makeTask('a'), makeTask('b')])
    const completed = setTaskCompleted(saved, 'a', true)
    const edited = editTask(completed.tasks, 'a', {
      ...completed.tasks[0], title: 'Rettet tittel', estimatedMinutes: '20', completed: false,
    })
    expect(edited.tasks[0]).toEqual({ ...saved[0], title: 'Rettet tittel', estimatedMinutes: 20, completed: true })
    const undone = setTaskCompleted(edited.tasks, 'a', false)
    expect(undone.tasks[0]).toEqual({ ...saved[0], title: 'Rettet tittel', estimatedMinutes: 20 })
    expect(ids(undone.tasks)).toEqual(['a', 'b'])
    expect(saved[0].completed).toBe(false)
  })

  it.each([undefined, null, 0, 1, 'true', {}, []])('avviser ikke-boolsk fullføring %j', value => {
    const tasks = frozenTasks([makeTask('a')])
    expect(setTaskCompleted(tasks, 'a', value)).toEqual({ ok: false, reason: 'invalid' })
    expect(tasks[0].completed).toBe(false)
  })

  it('avviser ukjent ID og tom liste uten å endre en annen oppgave', () => {
    const tasks = frozenTasks([makeTask('a')])
    expect(setTaskCompleted(tasks, 'missing', true)).toEqual({ ok: false, reason: 'not-found' })
    expect(setTaskCompleted([], 'missing', false)).toEqual({ ok: false, reason: 'not-found' })
    expect(tasks).toEqual([makeTask('a')])
  })
})

describe('lagringskontrakten ved fullføring og angre', () => {
  it.each([true, false])('validerer hele listen før én skriving, bevarer ved feil og kan prøve %s igjen', completed => {
    const saved = frozenTasks([makeTask('a'), makeTask('valgt', { completed: !completed }), makeTask('c')])
    const prior = JSON.stringify({ schemaVersion: 1, tasks: saved })
    let raw = prior
    let failWrite = true
    const backing = {
      getItem: vi.fn(key => { expect(key).toBe(STORAGE_KEY); return raw }),
      setItem: vi.fn((key, value) => {
        expect(key).toBe(STORAGE_KEY)
        if (failWrite) throw Error('Lagring utilgjengelig')
        raw = value
      }),
    }
    const access = vi.fn(() => backing)
    const storage = createStorage(access)
    const candidate = setTaskCompleted(saved, 'valgt', completed).tasks

    // En feil i en annen oppgave må blokkere hele kandidaten før lagringsadgang.
    const invalidOtherTask = candidate.map(task => task.id === 'a' ? { ...task, course: 42 } : task)
    expect(storage.write(invalidOtherTask)).toEqual({ ok: false, reason: 'invalid' })
    expect(storage.write([...candidate, candidate[0]])).toEqual({ ok: false, reason: 'invalid' })
    expect(access).not.toHaveBeenCalled()
    expect(backing.setItem).not.toHaveBeenCalled()

    expect(storage.write(candidate)).toEqual({ ok: false, reason: 'unwritable' })
    expect(backing.setItem).toHaveBeenCalledTimes(1)
    expect(raw).toBe(prior)
    expect(storage.read()).toEqual({ ok: true, tasks: saved })
    expect(saved[1].completed).toBe(!completed)

    failWrite = false
    expect(storage.write(candidate)).toEqual({ ok: true })
    expect(backing.setItem).toHaveBeenCalledTimes(2)
    expect(JSON.parse(raw)).toEqual({ schemaVersion: 1, tasks: candidate })
    const reopened = createStorage(() => backing).read()
    expect(reopened).toEqual({ ok: true, tasks: candidate })
    expect(ids(reopened.tasks)).toEqual(['a', 'valgt', 'c'])
    expect(reopened.tasks[1]).toEqual({ ...saved[1], completed })
    expect(backing.setItem).toHaveBeenCalledTimes(2)
  })

  it('skriver ikke ved avledede visninger og legger ikke minuttvalget i oppgavedata', () => {
    const tasks = [makeTask('a'), makeTask('b', { completed: true })]
    const raw = JSON.stringify({ schemaVersion: 1, tasks })
    const backing = { getItem: () => raw, setItem: vi.fn() }
    const loaded = createStorage(() => backing).read().tasks
    const before = JSON.stringify(loaded)
    const now = new Date('2026-09-04T10:00:00')

    for (const minutes of [20, 30, 60]) selectTasksForMinutes(loaded, minutes)
    tasksThisWeek(loaded, now)
    sortedTasks(loaded)
    overdueCount(loaded, now)
    expect(JSON.stringify(loaded)).toBe(before)
    expect(backing.setItem).not.toHaveBeenCalled()
    expect(Object.keys(JSON.parse(raw))).toEqual(['schemaVersion', 'tasks'])
    expect(Object.keys(loaded[0])).toEqual(['id', 'title', 'course', 'deadlineLocal', 'estimatedMinutes', 'completed'])
  })
})

describe('lokal kalenderuke med injisert klokke', () => {
  it.each([
    ['2026-08-31T00:00:00', '2026-08-31T00:00', '2026-09-07T00:00'],
    ['2026-09-01T12:34:56', '2026-08-31T00:00', '2026-09-07T00:00'],
    ['2026-09-06T23:59:59.999', '2026-08-31T00:00', '2026-09-07T00:00'],
    ['2026-09-07T00:00:00', '2026-09-07T00:00', '2026-09-14T00:00'],
    ['2026-12-28T00:00:00', '2026-12-28T00:00', '2027-01-04T00:00'],
    ['2027-01-01T12:00:00', '2026-12-28T00:00', '2027-01-04T00:00'],
    ['2027-01-03T23:59:59.999', '2026-12-28T00:00', '2027-01-04T00:00'],
    ['2027-01-04T00:00:00', '2027-01-04T00:00', '2027-01-11T00:00'],
    ['2026-03-29T12:00:00', '2026-03-23T00:00', '2026-03-30T00:00'],
    ['2026-10-25T12:00:00', '2026-10-19T00:00', '2026-10-26T00:00'],
  ])('finner mandagsgrensene for %s', (value, start, end) => {
    const now = new Date(value)
    const originalInstant = now.getTime()
    expect(weekBounds(now)).toEqual({ start, end })
    expect(now.getTime()).toBe(originalInstant)
  })

  it.each([
    ['2026-03-29T12:00:00', 167],
    ['2026-10-25T12:00:00', 169],
  ])('holder lokale mandager selv om uken ved %s varer %i timer', (value, hours) => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Oslo')
    const bounds = weekBounds(new Date(value))
    expect((new Date(bounds.end) - new Date(bounds.start)) / 3_600_000).toBe(hours)
    expect(new Date(bounds.start).getDay()).toBe(1)
    expect(new Date(bounds.end).getDay()).toBe(1)
    expect(new Date(bounds.start).getHours()).toBe(0)
    expect(new Date(bounds.end).getHours()).toBe(0)
  })

  it.each([
    ['2026-09-01T10:00:00', '2026-08-30T23:59', '2026-08-31T00:00', '2026-09-06T23:59', '2026-09-07T00:00'],
    ['2027-01-01T10:00:00', '2026-12-27T23:59', '2026-12-28T00:00', '2027-01-03T23:59', '2027-01-04T00:00'],
    ['2026-03-29T12:00:00', '2026-03-22T23:59', '2026-03-23T00:00', '2026-03-29T23:59', '2026-03-30T00:00'],
    ['2026-10-25T12:00:00', '2026-10-18T23:59', '2026-10-19T00:00', '2026-10-25T23:59', '2026-10-26T00:00'],
  ])('inkluderer mandag, utelater neste mandag og bevarer status og stabile like frister ved %s', (value, before, start, end, after) => {
    const tasks = frozenTasks([
      makeTask('søndag', { deadlineLocal: end }),
      makeTask('forrige-uke', { deadlineLocal: before }),
      makeTask('mandag-først', { deadlineLocal: start, completed: true }),
      makeTask('neste-uke', { deadlineLocal: after }),
      makeTask('mandag-sist', { deadlineLocal: start }),
    ])
    const original = JSON.stringify(tasks)
    const selected = tasksThisWeek(tasks, new Date(value))
    expect(ids(selected)).toEqual(['mandag-først', 'mandag-sist', 'søndag'])
    expect(selected[0].completed).toBe(true)
    expect(selected).not.toBe(tasks)
    expect(JSON.stringify(tasks)).toBe(original)
    expect(ids(sortedTasks(tasks))).toEqual(['forrige-uke', 'mandag-først', 'mandag-sist', 'søndag', 'neste-uke'])
  })

  it('gir tom uke når alle frister er utenfor, mens allevisning fortsatt har oppgavene', () => {
    const tasks = frozenTasks([makeTask('gammel', { deadlineLocal: '2025-01-01T12:00' })])
    expect(tasksThisWeek(tasks, new Date('2026-09-01T12:00:00'))).toEqual([])
    expect(sortedTasks(tasks)).toEqual(tasks)
    expect(tasksThisWeek([], new Date('2026-09-01T12:00:00'))).toEqual([])
  })
})

describe('forfalt krever at nå er strengt etter lokal frist', () => {
  it.each([
    ['2026-09-03T11:59:59.999', false],
    ['2026-09-03T12:00:00.000', false],
    ['2026-09-03T12:00:00.001', true],
    ['2026-09-03T12:00:01.000', true],
  ])('sammenligner hele tidspunktet %s', (value, expected) => {
    const task = Object.freeze(makeTask('a'))
    const now = new Date(value)
    const originalInstant = now.getTime()
    expect(isOverdue(task, now)).toBe(expected)
    expect(isOverdue({ ...task, completed: true }, now)).toBe(false)
    expect(now.getTime()).toBe(originalInstant)
  })

  it('teller ufullførte fra alle uker og oppdaterer etter fullføring og angre', () => {
    const tasks = frozenTasks([
      makeTask('eldre', { deadlineLocal: '2025-01-01T12:00' }),
      makeTask('forrige-uke', { deadlineLocal: '2026-08-30T23:59' }),
      makeTask('denne-uke', { deadlineLocal: '2026-09-01T12:00' }),
      makeTask('nå'),
      makeTask('fremtid', { deadlineLocal: '2027-01-01T12:00' }),
      makeTask('ferdig', { deadlineLocal: '2025-01-01T12:00', completed: true }),
    ])
    const now = new Date('2026-09-03T12:00:00')
    expect(overdueCount(tasks, now)).toBe(3)
    expect(overdueCount(tasksThisWeek(tasks, now), now)).toBe(1)
    const completed = setTaskCompleted(tasks, 'forrige-uke', true).tasks
    expect(overdueCount(completed, now)).toBe(2)
    const undone = setTaskCompleted(completed, 'forrige-uke', false).tasks
    expect(overdueCount(undone, now)).toBe(3)
    expect(overdueCount(tasks, new Date(now.getTime() + 1))).toBe(4)
    expect(overdueCount([], now)).toBe(0)
    expect(tasks[1].completed).toBe(false)
  })

  it('avviser et manglende vårminutt og beholder et gjentatt høstminutt gjennom regler og lagring', () => {
    expect(validDeadline('2026-03-29T02:30')).toBe(false)
    const task = Object.freeze(makeTask('høst', { deadlineLocal: '2026-10-25T02:30' }))
    expect(validDeadline(task.deadlineLocal)).toBe(true)
    expect(isOverdue(task, new Date('2026-10-25T02:29:59.999+02:00'))).toBe(false)
    expect(isOverdue(task, new Date('2026-10-25T02:30:00.000+02:00'))).toBe(false)
    expect(isOverdue(task, new Date('2026-10-25T02:30:00.001+02:00'))).toBe(true)
    // Fristen er en veggklokkeverdi også etter at klokken er stilt tilbake.
    expect(isOverdue(task, new Date('2026-10-25T02:15:00.000+01:00'))).toBe(false)
    expect(isOverdue(task, new Date('2026-10-25T02:29:59.999+01:00'))).toBe(false)
    expect(isOverdue(task, new Date('2026-10-25T02:30:00.000+01:00'))).toBe(false)
    expect(isOverdue(task, new Date('2026-10-25T02:30:00.001+01:00'))).toBe(true)

    let raw = null
    const storage = createStorage(() => ({
      getItem: () => raw,
      setItem: (_key, value) => { raw = value },
    }))
    expect(storage.write([task])).toEqual({ ok: true })
    const reopened = storage.read().tasks
    expect(reopened[0].deadlineLocal).toBe('2026-10-25T02:30')
    expect(tasksThisWeek(reopened, new Date('2026-10-25T12:00:00'))[0].deadlineLocal).toBe('2026-10-25T02:30')
    expect(selectTasksForMinutes(reopened, 30)[0].deadlineLocal).toBe('2026-10-25T02:30')
  })

  it('beholder lagrede veggklokkeetiketter ved gjenåpning i forskjellige tidssoner', () => {
    const tasksUrl = new URL('../../src/tasks.js', import.meta.url).href
    const storageUrl = new URL('../../src/storage.js', import.meta.url).href
    const task = makeTask('lokal', { deadlineLocal: '2026-09-03T09:30' })
    const raw = JSON.stringify({ schemaVersion: 1, tasks: [task] })
    const script = `
      import { isOverdue, tasksThisWeek, selectTasksForMinutes, weekBounds } from ${JSON.stringify(tasksUrl)};
      import { createStorage } from ${JSON.stringify(storageUrl)};
      const storage = createStorage(() => ({ getItem: () => ${JSON.stringify(raw)} }));
      const loaded = storage.read();
      const now = new Date('2026-09-03T09:30:00');
      process.stdout.write(JSON.stringify({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        instant: now.getTime(),
        loaded,
        week: tasksThisWeek(loaded.tasks, now),
        selection: selectTasksForMinutes(loaded.tasks, 30),
        bounds: weekBounds(now),
        atDeadline: isOverdue(loaded.tasks[0], now),
        afterDeadline: isOverdue(loaded.tasks[0], new Date(now.getTime() + 1)),
      }));
    `
    const snapshots = ['Europe/Oslo', 'America/New_York'].map(timezone => JSON.parse(execFileSync(
      process.execPath, ['--input-type=module', '-e', script],
      { encoding: 'utf8', env: { ...process.env, TZ: timezone } },
    )))
    expect(snapshots.map(snapshot => snapshot.timezone)).toEqual(['Europe/Oslo', 'America/New_York'])
    expect(snapshots[0].instant).not.toBe(snapshots[1].instant)
    for (const snapshot of snapshots) {
      expect(snapshot.loaded).toEqual({ ok: true, tasks: [task] })
      expect(snapshot.week).toEqual([task])
      expect(snapshot.selection).toEqual([task])
      expect(snapshot.bounds).toEqual({ start: '2026-08-31T00:00', end: '2026-09-07T00:00' })
      expect(snapshot.atDeadline).toBe(false)
      expect(snapshot.afterDeadline).toBe(true)
    }
  })
})

describe('tilgjengelige minutter og fristsorterte treff', () => {
  it.each([
    ['1', 1], ['30', 30], ['00030', 30], ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('godtar positivt sikkert heltall %s', (value, minutes) => {
    expect(validateAvailableMinutes(value)).toEqual({ ok: true, minutes })
  })

  it.each([
    '', ' ', '0', '00', '-1', '+1', '1.5', '1.0', '30 ', ' 30', '30\n',
    '1e2', '0x10', 'Infinity', 'NaN', '9007199254740992', '9999999999999999999999999999999',
    undefined, null, 30, NaN, Infinity, {}, [],
  ])('avviser ugyldige minutter %j med feltfeil', value => {
    const result = validateAvailableMinutes(value)
    expect(result.ok).toBe(false)
    expect(result.error).toEqual(expect.any(String))
    expect(result.error).toMatch(/minutt|heltall|helt antall/i)
    expect(result).not.toHaveProperty('minutes')
  })

  it('velger 20 og 30, utelater 31 og fullførte, og tar med eldre og fremtidige uker', () => {
    const tasks = frozenTasks([
      makeTask('fremtid-20', { estimatedMinutes: 20, deadlineLocal: '2027-01-01T12:00' }),
      makeTask('for-stor-31', { estimatedMinutes: 31, deadlineLocal: '2026-01-01T12:00' }),
      makeTask('forfalt-30', { estimatedMinutes: 30, deadlineLocal: '2026-01-01T12:00' }),
      makeTask('ferdig-20', { estimatedMinutes: 20, deadlineLocal: '2025-01-01T12:00', completed: true }),
      makeTask('denne-uke-20', { estimatedMinutes: 20 }),
    ])
    const before = JSON.stringify(tasks)
    expect(ids(selectTasksForMinutes(tasks, 30))).toEqual(['forfalt-30', 'denne-uke-20', 'fremtid-20'])
    expect(JSON.stringify(tasks)).toBe(before)
  })

  it('prioriterer frist og klokkeslett før varighet og beholder lagringsrekkefølge ved like frister', () => {
    const tasks = frozenTasks([
      makeTask('kveld-kort', { deadlineLocal: '2026-09-03T23:59', estimatedMinutes: 1 }),
      makeTask('middag-først', { deadlineLocal: '2026-09-03T12:00', estimatedMinutes: 30 }),
      makeTask('eldst', { deadlineLocal: '2026-08-31T23:59', estimatedMinutes: 25 }),
      makeTask('middag-sist', { deadlineLocal: '2026-09-03T12:00', estimatedMinutes: 20 }),
    ])
    const selected = selectTasksForMinutes(tasks, 30)
    expect(ids(selected)).toEqual(['eldst', 'middag-først', 'middag-sist', 'kveld-kort'])
    expect(selected).not.toBe(tasks)
    expect(ids(tasks)).toEqual(['kveld-kort', 'middag-først', 'eldst', 'middag-sist'])
    expect(selected.reduce((sum, task) => sum + task.estimatedMinutes, 0)).toBeGreaterThan(30)
  })

  it('beholder like fristers rekkefølge etter redigering, fullføring, angre og gjenåpning', () => {
    const tasks = frozenTasks([makeTask('først'), makeTask('andre'), makeTask('tredje')])
    const completed = setTaskCompleted(tasks, 'først', true).tasks
    expect(ids(selectTasksForMinutes(completed, 30))).toEqual(['andre', 'tredje'])
    const edited = editTask(completed, 'først', { ...completed[0], title: 'Rettet', estimatedMinutes: '20' }).tasks
    expect(ids(selectTasksForMinutes(edited, 30))).toEqual(['andre', 'tredje'])
    const undone = setTaskCompleted(edited, 'først', false).tasks
    let raw = null
    const backing = { getItem: () => raw, setItem: (_key, value) => { raw = value } }
    expect(createStorage(() => backing).write(undone)).toEqual({ ok: true })
    const reopened = createStorage(() => backing).read().tasks
    expect(ids(selectTasksForMinutes(reopened, 30))).toEqual(['først', 'andre', 'tredje'])
    expect(ids(reopened)).toEqual(['først', 'andre', 'tredje'])
    expect(reopened[0]).toEqual({ ...tasks[0], title: 'Rettet', estimatedMinutes: 20 })
  })

  it('avleder nye treff etter endret estimat og sletting uten å endre den opprinnelige listen', () => {
    const tasks = frozenTasks([makeTask('a', { estimatedMinutes: 20 }), makeTask('b', { estimatedMinutes: 31 })])
    const enlarged = editTask(tasks, 'a', { ...tasks[0], estimatedMinutes: '31' }).tasks
    expect(selectTasksForMinutes(enlarged, 30)).toEqual([])
    const shortened = editTask(enlarged, 'b', { ...tasks[1], estimatedMinutes: '30' }).tasks
    expect(ids(selectTasksForMinutes(shortened, 30))).toEqual(['b'])
    const deleted = deleteTask(shortened, 'b').tasks
    expect(selectTasksForMinutes(deleted, 30)).toEqual([])
    expect(ids(selectTasksForMinutes(tasks, 30))).toEqual(['a'])
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, -Infinity, '30', null, undefined])(
    'gir ingen treff for ugyldig numerisk grense %j', minutes => {
      const tasks = frozenTasks([makeTask('a', { estimatedMinutes: 1 })])
      expect(selectTasksForMinutes(tasks, minutes)).toEqual([])
      expect(tasks[0].estimatedMinutes).toBe(1)
    },
  )

  it('håndterer tom liste, ingen passende oppgaver og størst tillatte estimat', () => {
    expect(selectTasksForMinutes([], 30)).toEqual([])
    expect(selectTasksForMinutes([makeTask('lang', { estimatedMinutes: 31 })], 30)).toEqual([])
    expect(selectTasksForMinutes([makeTask('ferdig', { completed: true })], 30)).toEqual([])
    const largest = makeTask('størst', { estimatedMinutes: Number.MAX_SAFE_INTEGER })
    expect(selectTasksForMinutes([largest], Number.MAX_SAFE_INTEGER)).toEqual([largest])
    expect(selectTasksForMinutes([largest], Number.MAX_SAFE_INTEGER - 1)).toEqual([])
  })
})
