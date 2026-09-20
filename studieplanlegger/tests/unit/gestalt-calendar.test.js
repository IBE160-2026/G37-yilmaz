import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parseGestaltCalendarLinks, parseGestaltCalendarClasses, parseGestaltCalendar, gestaltCalendarSources, fetchGestaltCalendar } from '../../server/providers/gestalt-calendar.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { subtractTeaching } from '../../src/planner.js'

const fixture = name => readFile(new URL(`../fixtures/public-programs/gestalt-${name}`, import.meta.url), 'utf8')
const pages = async type => JSON.parse(await fixture(`${type}-calendar.json`))
const source = async type => parseGestaltCalendarLinks(await fixture(`${type}-calendar-links.html`), `https://gestalt.no/timeplaner%2Fstudieplan-${type}`)[0]
const read = (calendar, year = 2026, semester = 'autumn') => parseCalendar(calendar, { courseId: '', year, semester }).events
async function parsed(type, selection = 0) { const data = await pages(type), selected = parseGestaltCalendarClasses(data, (await source(type)).sourceUrl)[selection]; return { data, selected, result: parseGestaltCalendar(data, selected) } }

describe('Gestalt explicitly selected public classes', () => {
  it('deduplicates published download links and exposes only the three classes that actually occur in the PDFs', async () => {
    const gt = await pages('gt'), co = await pages('co')
    expect(parseGestaltCalendarLinks(await fixture('gt-calendar-links.html'), 'https://gestalt.no/timeplaner%2Fstudieplan-gt')).toHaveLength(1)
    expect(parseGestaltCalendarClasses(gt, (await source('gt')).sourceUrl).map(row => row.sourceObjectId)).toEqual(['gestaltterapi:1:helg', 'gestaltterapi:1:midtuke'])
    expect(parseGestaltCalendarClasses(co, (await source('co')).sourceUrl).map(row => row.sourceObjectId)).toEqual(['gestaltcoaching:1:published'])
  })
  it.each([['gt', 0, 38], ['gt', 1, 38], ['co', 0, 42]])('%s class %i preserves every published teaching block and no inferred course assignment', async (type, index, count) => {
    const { result } = await parsed(type, index)
    expect(result.count).toBe(count); expect(result.authoritative).toBe(true); expect(result.unresolved).toEqual([])
    const events = [...read(result.calendar), ...read(result.calendar, 2027, 'spring')]
    expect(events).toHaveLength(count)
    expect(events.every(event => event.courseId === '' && !event.allDay && !event.transparent && event.group)).toBe(true)
    expect(new Set(events.map(event => event.sourceUid)).size).toBe(count)
  })
  it('uses actual weekend/midweek dates, distinct three-day first hours, timezone transitions and free lunch breaks', async () => {
    const { result } = await parsed('gt'), events = read(result.calendar)
    expect(events[0]).toMatchObject({ start: '2026-09-17T08:30:00.000Z', end: '2026-09-17T15:00:00.000Z', group: 'Gestaltterapi · 1 År Helg' })
    expect(events[1]).toMatchObject({ start: '2026-09-18T07:00:00.000Z', end: '2026-09-18T10:30:00.000Z' })
    const lunch = [{ start: Date.parse('2026-09-18T10:30:00Z'), end: Date.parse('2026-09-18T11:30:00Z') }]
    expect(subtractTeaching(lunch, events)).toEqual(lunch)
    expect(events.find(event => event.start.startsWith('2026-11-20'))).toMatchObject({ start: '2026-11-20T08:00:00.000Z' })
    expect(read((await parsed('gt', 1)).result.calendar)[0].start).toBe('2026-09-21T08:30:00.000Z')
  })
  it('keeps the coaching Saturday exception and reconstructs a split two-digit date from geometry', async () => {
    const { result } = await parsed('co'), events = read(result.calendar)
    expect(events.find(event => event.start === '2026-09-26T11:30:00.000Z').end).toBe('2026-09-26T14:30:00.000Z')
    const spring = read(result.calendar, 2027, 'spring')
    expect(spring.some(event => event.start === '2027-06-10T07:00:00.000Z')).toBe(true)
    expect(spring.some(event => event.start.startsWith('2027-06-01'))).toBe(false)
  })
  it('excludes a contradictory date without correcting it and keeps the remainder non-authoritative', async () => {
    const { data, selected } = await parsed('gt')
    const first = data[0].items.find(item => item.str === '17' && item.transform[4] < 200)
    first.str = '16'
    const result = parseGestaltCalendar(data, selected)
    expect(result.count).toBe(33); expect(result.authoritative).toBe(false)
    expect(result.unresolved).toHaveLength(1); expect(result.unresolved[0].sourceExcerpt).toContain('16-18-19')
    expect(result.unresolved[0].reason).toContain('ikke sammenhengende')
    expect(read(result.calendar).some(event => event.start.startsWith('2026-09'))).toBe(false)
  })
  it('retains stable identifiers after a valid source schedule change and across repeated parsing', async () => {
    const { data, selected, result } = await parsed('gt'), original = read(result.calendar)
    const row = data[0].items.find(item => item.str === '18-19')
    row.str = '11-12'
    const moved = read(parseGestaltCalendar(data, selected).calendar)
    expect(moved.map(event => event.sourceUid)).toEqual(original.map(event => event.sourceUid))
    expect(moved.find(event => event.start.startsWith('2026-12')).start).toBe('2026-12-11T08:00:00.000Z')
    expect(parseGestaltCalendar(data, selected).calendar).toBe(parseGestaltCalendar(data, selected).calendar)
  })
  it('rejects invented classes and unsafe or unlisted PDFs before binary fetching', async () => {
    const fetchText = vi.fn(async url => fixture(`${url.endsWith('-gt') ? 'gt' : 'co'}-calendar-links.html`)), fetchBytes = vi.fn()
    const selected = await source('gt')
    await expect(fetchGestaltCalendar('https://127.0.0.1/private.pdf', { fetchText, fetchBytes })).rejects.toThrow()
    expect(fetchText).not.toHaveBeenCalled()
    await expect(fetchGestaltCalendar(selected.sourceUrl.replace('GT%20Timeplan', 'Other%20Timeplan'), { fetchText, fetchBytes })).rejects.toThrow(/publisert/)
    await expect(fetchGestaltCalendar(selected.sourceUrl, { fetchText, fetchBytes })).rejects.toThrow(/klasse/)
    expect(fetchBytes).not.toHaveBeenCalled()
    expect(() => parseGestaltCalendar([], { ...selected, sourceObjectId: 'invented' })).toThrow()
    const data = await pages('gt'); expect(() => parseGestaltCalendar(data, { ...selected, sourceObjectId: 'gestaltterapi:4:helg' })).toThrow(/faktisk publisert klasse/)
  })
  it('fails visibly if neither source provides a valid PDF rather than presenting empty full support', async () => {
    const fetchText = vi.fn(async () => '<html>No timetable</html>'), fetchBytes = vi.fn()
    await expect(gestaltCalendarSources({ fetchText, fetchBytes })).rejects.toThrow(/Ingen publiserte timeplaner/)
    expect(fetchBytes).not.toHaveBeenCalled()
  })
})
