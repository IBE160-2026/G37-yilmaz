import { describe, expect, it, vi } from 'vitest'
import {
  courseColor, dateKey, formatDay, formatDeadline, monthGrid, monthLabel,
  tasksForDay, tasksForMonth, taskStatus, sessionsForDay, sessionsForMonth,
} from '../../src/calendar.js'
import { selectTasksForMinutes } from '../../src/tasks.js'
import { createStorage } from '../../src/storage.js'

const task = (id, patch = {}) => ({
  id, title: `Oppgave ${id}`, course: 'IBE160', deadlineLocal: '2026-09-16T20:48',
  estimatedMinutes: 240, completed: false, ...patch,
})
const ids = tasks => tasks.map(task => task.id)
const session = (id, patch = {}) => ({
  id, dateLocal: '2026-09-16', startTime: '10:00', endTime: '11:00', ...patch,
})

describe('studieøkter i kalenderen', () => {
  it('sorterer på dato og start, med stabil rekkefølge ved lik start, uten å endre lagrede økter', () => {
    const sessions = Object.freeze([
      Object.freeze(session('senere-dag', { dateLocal: '2026-09-17' })),
      Object.freeze(session('senere-tid', { startTime: '13:00', endTime: '14:00' })),
      Object.freeze(session('først-lik')),
      Object.freeze(session('tidlig', { startTime: '08:00', endTime: '09:00' })),
      Object.freeze(session('sist-lik', { endTime: '12:00' })),
    ])
    const before = JSON.stringify(sessions)
    expect(ids(sessionsForMonth(sessions, 2026, 8)))
      .toEqual(['tidlig', 'først-lik', 'sist-lik', 'senere-tid', 'senere-dag'])
    expect(ids(sessionsForDay(sessions, '2026-09-16')))
      .toEqual(['tidlig', 'først-lik', 'sist-lik', 'senere-tid'])
    expect(sessionsForDay(sessions, '2026-09-16')[0]).toBe(sessions[3])
    expect(JSON.stringify(sessions)).toBe(before)
  })

  it('tar med økter uten oppgaver og bevarer alle registrerte økter også ved overlapp', () => {
    const sessions = [session('en'), session('to', { startTime: '10:30', endTime: '11:30' })]
    expect(tasksForDay([], '2026-09-16')).toEqual([])
    expect(sessionsForDay(sessions, '2026-09-16')).toEqual(sessions)
    expect(sessionsForMonth(sessions, 2026, 8)).toEqual(sessions)
    expect(sessionsForDay(sessions, '2026-09-15')).toEqual([])
    expect(sessionsForMonth([], 2026, 8)).toEqual([])
  })

  it('holder lokale dager adskilt ved månedsskifte, årsskifte og eldre kalenderår', () => {
    const sessions = [
      session('siste', { dateLocal: '2026-12-31', startTime: '23:00', endTime: '23:59' }),
      session('første', { dateLocal: '2027-01-01', startTime: '00:00', endTime: '01:00' }),
      session('eldre-år', { dateLocal: '0001-01-01' }),
    ]
    expect(ids(sessionsForMonth(sessions, 2026, 11))).toEqual(['siste'])
    expect(ids(sessionsForMonth(sessions, 2027, 0))).toEqual(['første'])
    expect(ids(sessionsForMonth(sessions, 1, 0))).toEqual(['eldre-år'])
    expect(ids(sessionsForDay(sessions, '2026-12-31'))).toEqual(['siste'])
    expect(ids(sessionsForDay(sessions, '2027-01-01'))).toEqual(['første'])
    expect(sessionsForMonth(sessions, 2027, 1)).toEqual([])
  })
})

describe('norske datoer og lokal 24-timersklokke', () => {
  it.each([
    ['2026-09-16T20:48', '16. september kl. 20:48'],
    ['2026-01-01T00:00', '1. januar kl. 00:00'],
    ['2026-12-31T23:59', '31. desember kl. 23:59'],
    ['2024-02-29T12:00', '29. februar kl. 12:00'],
    ['2026-03-29T03:00', '29. mars kl. 03:00'],
    ['2026-10-25T02:30', '25. oktober kl. 02:30'],
  ])('viser lagret frist %s uten UTC-konvertering eller AM/PM', (value, expected) => {
    expect(formatDeadline(value)).toBe(expected)
  })

  it('kan inkludere år og ukedag uten å påvirke det lagrede klokkeslettet', () => {
    expect(formatDay('2026-09-16')).toBe('16. september')
    expect(formatDay('2026-09-16', { weekday: true, year: true })).toBe('onsdag 16. september 2026')
    expect(formatDeadline('2027-01-01T00:00', { year: true })).toBe('1. januar 2027 kl. 00:00')
    expect(monthLabel(2026, 0)).toBe('Januar 2026')
    expect(monthLabel(2026, 8)).toBe('September 2026')
    expect(monthLabel(2027, 11)).toBe('Desember 2027')
  })

  it.each([
    ['2026-09-06T23:59:59.999+02:00', '2026-09-06'],
    ['2026-09-07T00:00:00+02:00', '2026-09-07'],
    ['2027-01-01T00:00:00+01:00', '2027-01-01'],
    ['2026-03-29T01:59:59+01:00', '2026-03-29'],
    ['2026-03-29T03:00:00+02:00', '2026-03-29'],
    ['2026-10-25T02:30:00+02:00', '2026-10-25'],
    ['2026-10-25T02:30:00+01:00', '2026-10-25'],
  ])('bruker lokal dato rundt midnatt, årsskifte og sommertid: %s', (value, expected) => {
    const now = new Date(value)
    const instant = now.getTime()
    expect(dateKey(now)).toBe(expected)
    expect(now.getTime()).toBe(instant)
  })

  it('behandler år før 100 som de oppgitte kalenderårene', () => {
    const now = new Date(0)
    now.setFullYear(1, 0, 1)
    now.setHours(12, 0, 0, 0)
    expect(dateKey(now)).toBe('0001-01-01')
    expect(formatDay('0001-01-01', { weekday: true, year: true })).toBe('mandag 1. januar 1')
    expect(monthGrid(1, 0)[0]).toEqual({ date: '0001-01-01', day: 1, inMonth: true })
  })
})

describe('månedsrutenett med mandag først', () => {
  it.each([
    [2026, 8, '2026-08-31', '2026-10-11', 30],
    [2026, 1, '2026-01-26', '2026-03-08', 28],
    [2024, 1, '2024-01-29', '2024-03-10', 29],
    [2026, 2, '2026-02-23', '2026-04-05', 31],
    [2026, 9, '2026-09-28', '2026-11-08', 31],
    [2026, 11, '2026-11-30', '2027-01-10', 31],
    [2027, 0, '2026-12-28', '2027-02-07', 31],
  ])('viser riktig datoantall og nabodager for %i/%i', (year, month, first, last, count) => {
    const cells = monthGrid(year, month)
    expect(cells).toHaveLength(42)
    expect(new Set(cells.map(cell => cell.date)).size).toBe(42)
    expect(cells[0].date).toBe(first)
    expect(cells.at(-1).date).toBe(last)
    expect(new Date(`${first}T12:00`).getDay()).toBe(1)
    expect(new Date(`${last}T12:00`).getDay()).toBe(0)
    expect(cells.filter(cell => cell.inMonth).map(cell => cell.day)).toEqual(Array.from({ length: count }, (_, index) => index + 1))
    for (let index = 1; index < cells.length; index++) {
      const previousDay = new Date(`${cells[index - 1].date}T12:00`)
      previousDay.setDate(previousDay.getDate() + 1)
      expect(dateKey(previousDay)).toBe(cells[index].date)
    }
  })

  it.each([[2026, 2, 23], [2026, 9, 25]])('beholder dagene selv når vår/høst gir %i/%i et døgn på %i timer', (year, month, hours) => {
    const cells = monthGrid(year, month)
    const day = month === 2 ? '2026-03-28' : '2026-10-24'
    const index = cells.findIndex(cell => cell.date === day)
    expect((new Date(`${cells[index + 1].date}T12:00`) - new Date(`${day}T12:00`)) / 3_600_000).toBe(hours)
    expect(cells[index + 1].day).toBe(cells[index].day + 1)
  })
})

describe('kalenderen avleder oppgaver fra samme lagrede kilde', () => {
  it('sorterer måned og valgt dag stabilt uten å skjule store, ferdige eller leverte oppgaver', () => {
    const tasks = Object.freeze([
      Object.freeze(task('senere', { deadlineLocal: '2026-09-30T23:59' })),
      Object.freeze(task('først-lik', { completed: true, requiresSubmission: true })),
      Object.freeze(task('utenfor', { deadlineLocal: '2026-10-01T00:00' })),
      Object.freeze(task('tidlig', { deadlineLocal: '2026-09-16T00:00', completed: true, requiresSubmission: true, submitted: true })),
      Object.freeze(task('sist-lik', { nextStep: { description: 'Les', estimatedMinutes: 90 } })),
      Object.freeze(task('ferdig', { deadlineLocal: '2026-09-01T12:00', completed: true })),
    ])
    const original = JSON.stringify(tasks)
    expect(ids(tasksForMonth(tasks, 2026, 8))).toEqual(['ferdig', 'tidlig', 'først-lik', 'sist-lik', 'senere'])
    expect(ids(tasksForDay(tasks, '2026-09-16'))).toEqual(['tidlig', 'først-lik', 'sist-lik'])
    expect(tasksForDay(tasks, '2026-09-16')[0]).toBe(tasks[3])
    expect(selectTasksForMinutes(tasks, 20)).toEqual([])
    expect(tasksForMonth(tasks, 2026, 8)).toHaveLength(5)
    expect(JSON.stringify(tasks)).toBe(original)
  })

  it('viser tom dag/måned og avgrenser korrekt ved midnatt og årsskifte', () => {
    const tasks = [task('siste', { deadlineLocal: '2026-12-31T23:59' }), task('første', { deadlineLocal: '2027-01-01T00:00' })]
    expect(ids(tasksForMonth(tasks, 2026, 11))).toEqual(['siste'])
    expect(ids(tasksForMonth(tasks, 2027, 0))).toEqual(['første'])
    expect(ids(tasksForDay(tasks, '2026-12-31'))).toEqual(['siste'])
    expect(tasksForDay(tasks, '2026-12-30')).toEqual([])
    expect(tasksForMonth(tasks, 2027, 1)).toEqual([])
    expect(tasksForMonth([], 2026, 8)).toEqual([])
  })

  it('endrer ikke eldre lagrede oppgaver eller skriver når kalenderutvalgene beregnes', () => {
    const tasks = [task('eldre', { completed: true }), task('nyere', { requiresSubmission: true, submitted: false })]
    const backing = { getItem: () => JSON.stringify({ schemaVersion: 1, tasks }), setItem: vi.fn() }
    const loaded = createStorage(() => backing).read().tasks
    expect(tasksForMonth(loaded, 2026, 8)).toEqual(tasks)
    expect(tasksForDay(loaded, '2026-09-16')).toEqual(tasks)
    expect(loaded[0]).not.toHaveProperty('submitted')
    expect(backing.setItem).not.toHaveBeenCalled()
  })

  it.each([
    [{}, 'Ikke fullført'],
    [{ completed: true }, 'Fullført'],
    [{ completed: false, requiresSubmission: true }, 'Ikke fullført'],
    [{ completed: true, requiresSubmission: true }, 'Klar til levering'],
    [{ completed: true, requiresSubmission: true, submitted: false }, 'Klar til levering'],
    [{ completed: true, requiresSubmission: true, submitted: true }, 'Levert (bekreftet manuelt)'],
  ])('viser faktisk arbeids- og leveringsstatus %j', (patch, expected) => {
    expect(taskStatus(task('a', patch))).toBe(expected)
  })

  it('holder emnefarger stabile på tvers av rekkefølge, dato og mellomrom/store bokstaver', () => {
    const courses = ['IBE160', 'MAT100', 'Norsk', 'Fysikk', 'Økonomi', 'α']
    const first = courses.map(courseColor)
    for (const color of first) expect(color).toMatch(/^#[0-9a-f]{6}$/)
    expect(courses.toReversed().map(courseColor).toReversed()).toEqual(first)
    expect(courseColor(' ibe160 ')).toBe(courseColor('IBE160'))
    expect(courses.map(courseColor)).toEqual(first)
  })
})
