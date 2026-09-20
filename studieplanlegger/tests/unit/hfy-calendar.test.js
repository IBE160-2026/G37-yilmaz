import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parseHfyCalendarSources, hfyCalendarSources, parseHfyCalendar, fetchHfyCalendar } from '../../server/providers/hfy-calendar.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { subtractTeaching } from '../../src/planner.js'

const fixture = name => readFile(new URL(`../fixtures/public-programs/${name}`, import.meta.url), 'utf8')
const sources = async () => parseHfyCalendarSources(await fixture('hfy-calendar-sources.html'))
const select = async part => (await sources()).find(source => source.sourceUrl.includes(part))
const pages = async selected => JSON.parse(await fixture('hfy-calendar-' + new URL(selected.sourceUrl).pathname.split('/').at(-1).replace('.pdf', '.json')))
const read = (calendar, year = 2026, semester = 'autumn') => parseCalendar(calendar, { courseId: '', year, semester })

describe('HØFY explicitly chosen public class calendars', () => {
  it('lists all five source class choices and caches the public source page', async () => {
    const fetchText = vi.fn(async () => fixture('hfy-calendar-sources.html')), a = await hfyCalendarSources({ fetchText })
    expect(a.results).toHaveLength(5); expect(a.results.every(row => row.name && row.sourceUrl && row.id)).toBe(true)
    await hfyCalendarSources({ fetchText }); expect(fetchText).toHaveBeenCalledTimes(1)
  })
  it.each([['gjovik', 15, 4], ['klasse-a', 18, 4], ['klasse-b', 16, 7], ['porsgrunn', 15, 4], ['26itb', 20, 2]])('%s parses actual public rows and explicitly excludes conflicting or unpublished dates', async (part, count, unresolved) => {
    const selected = await select(part), data = await pages(selected), result = parseHfyCalendar(data, selected)
    expect(result.count).toBe(count); expect(result.unresolved).toHaveLength(unresolved); expect(result.authoritative).toBe(false)
    expect(result.unresolved.every(row => row.sourceExcerpt && row.reason)).toBe(true)
    expect(result.warnings.join()).toContain('Ikke datofestet')
    expect(read(result.calendar).events.every(event => event.courseId === '')).toBe(true)
  })
  it('preserves exact Oslo A times and all-day informational deadlines, while reserving only real classes', async () => {
    const selected = await select('klasse-a'), result = parseHfyCalendar(await pages(selected), selected), events = read(result.calendar).events
    const first = events.find(event => event.title.startsWith('Samling 1, dag 1'))
    expect(first).toMatchObject({ start: '2026-09-21T07:00:00.000Z', end: '2026-09-21T14:30:00.000Z', allDay: false, transparent: false, group: '26BPLNETT-INNFASING Oslo – Klasse A' })
    const deadline = events.find(event => event.title.startsWith('Innlevering arbeidskrav 1'))
    expect(deadline).toMatchObject({ start: '2026-10-04T22:00:00.000Z', end: '2026-10-05T22:00:00.000Z', allDay: true, transparent: true })
    const interval = [{ start: Date.parse(first.start), end: Date.parse(first.end) }]
    expect(subtractTeaching(interval, [first])).toEqual([])
    expect(subtractTeaching(interval, [deadline])).toEqual(interval)
    expect(result.unresolved.some(row => row.sourceExcerpt.includes('02.11.25 – 05.11.26'))).toBe(true)
    expect(result.unresolved.some(row => row.sourceExcerpt.includes('19.05.26 – 21.05.27'))).toBe(true)
    expect(events.some(event => /Samling [26],/.test(event.title))).toBe(false)
  })
  it('does not import Oslo A deadlines from the contradictory Oslo B PDF or invent week corrections', async () => {
    const selected = await select('klasse-b'), result = parseHfyCalendar(await pages(selected), selected)
    expect(read(result.calendar).events.every(event => !event.transparent)).toBe(true)
    expect(result.unresolved.filter(row => /Klassetilhørighet/.test(row.reason))).toHaveLength(3)
    expect(result.unresolved.some(row => /uke 50/.test(row.reason))).toBe(true)
  })
  it('uses the published digital location and compact clock format without turning exam codes into teaching codes', async () => {
    const selected = await select('26itb'), result = parseHfyCalendar(await pages(selected), selected), events = read(result.calendar).events
    expect(events.find(event => event.title.startsWith('Samling 1, dag 4'))).toMatchObject({ start: '2026-09-03T06:30:00.000Z', end: '2026-09-03T09:30:00.000Z' })
    expect(events.find(event => event.title.startsWith('Samling 2, dag 1')).location).toBe('Digital samling, Teams')
    const exam = read(result.calendar, 2027, 'spring').events.find(event => event.title.startsWith('Eksamensperiode ITB3000'))
    expect(exam).toMatchObject({ allDay: true, transparent: true, courseId: '' })
    expect(events.some(event => event.title.includes('ITB3000'))).toBe(false)
  })
  it('retains stable activity identity when the source moves a complete valid gathering', async () => {
    const selected = await select('klasse-a'), data = await pages(selected), original = read(parseHfyCalendar(data, selected).calendar).events.find(event => event.title.startsWith('Samling 1, dag 1'))
    const items = data[0].items, row = items.find(item => item.str === '21.09.26 – 24.09.26'); row.str = '28.09.26 – 01.10.26'
    items.find(item => item.str === '39' && Math.abs(item.transform[5] - row.transform[5]) < 1).str = '40'
    const moved = read(parseHfyCalendar(data, selected).calendar).events.find(event => event.title.startsWith('Samling 1, dag 1'))
    expect(moved.sourceUid).toBe(original.sourceUid); expect(moved.start).toBe('2026-09-28T07:00:00.000Z')
  })
  it('requires a source-listed PDF and refuses other public or private URLs before binary fetching', async () => {
    const fetchText = vi.fn(async () => fixture('hfy-calendar-sources.html')), fetchBytes = vi.fn(async () => Buffer.from('<html>not PDF</html>'))
    await expect(fetchHfyCalendar('https://s3-gustav.imgix.net/hfy/unlisted.pdf', { fetchText, fetchBytes })).rejects.toThrow(/publiserte liste/)
    await expect(fetchHfyCalendar('https://127.0.0.1/private.pdf', { fetchText, fetchBytes })).rejects.toThrow()
    expect(fetchBytes).not.toHaveBeenCalled()
    await expect(fetchHfyCalendar((await select('klasse-a')).sourceUrl, { fetchText, fetchBytes })).rejects.toThrow(/ikke en PDF/)
    expect(fetchBytes).toHaveBeenCalledTimes(1)
  })
})
