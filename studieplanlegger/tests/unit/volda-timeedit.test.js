import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { publicTimeEdit, publicTimeEditUrl, parsePublicTimeEditEntry } from '../../server/providers/public-timeedit.js'
import { parseCalendar } from '../../src/calendar-import.js'
const fixture = name => readFileSync(new URL(`../fixtures/public-timeedit/volda-${name}`, import.meta.url), 'utf8')
const query = { q: 'ANI', year: '2026', semester: 'autumn', sourceObjectId: '233645.195' }
const transport = () => vi.fn(async (url, depth, guard) => { guard(url); return fixture(url.includes('ri1Q79.html') ? 'entry.html' : url.includes('objects.html') ? 'search.html' : url.includes('ri.ics') ? 'calendar.ics' : 'schedule.html') })
describe('Volda public course timetable', () => {
  it('uses the course-specific public entry and calendar limits', () => {
    const result = parsePublicTimeEditEntry(fixture('entry.html'), 'hivolda', query, 'https://cloud.timeedit.net/hivolda/web/timeplan/ri1Q79.html')
    expect(result).toMatchObject({ sid: '35', type: '195', selectedRange: { start: '20260701', end: '20261231' }, publicationBoundaries: { start: '20130101', end: '20271231' } })
    expect(() => parsePublicTimeEditEntry(fixture('entry.html'), 'hivolda', { ...query, year: '2028' }, 'https://cloud.timeedit.net/hivolda/web/timeplan/ri1Q79.html')).toThrow(/dekker ikke/)
  })
  it('retains 27 current and historical course choices and requires the selected version before importing 52 actual events', async () => {
    const fetchText = transport(), result = await publicTimeEdit('hivolda', 'teaching-search', query, { fetchText })
    expect(result.results).toHaveLength(27)
    expect(result.results[0].label).toContain('2024 HØST')
    expect(result.results.find(row => row.sourceObjectId === query.sourceObjectId).label).toContain('2026 HØST')
    const calendar = await publicTimeEdit('hivolda', 'teaching-calendar', query, { fetchText })
    const parsed = parseCalendar(calendar.calendar, { courseId: '', year: 2026, semester: 'autumn' })
    expect(parsed.events).toHaveLength(52)
    expect(parsed.events[0]).toMatchObject({ start: '2026-08-25T07:30:00.000Z', end: '2026-08-25T13:15:00.000Z' })
    expect(calendar.coverage).toBe('unknown'); expect(fetchText).toHaveBeenCalledTimes(4)
    await expect(publicTimeEdit('hivolda', 'teaching-calendar', { ...query, sourceObjectId: '223005.195' }, { fetchText })).rejects.toThrow(/annet emne/)
  })
  it('does not use personal or another institution endpoint', () => {
    for (const url of ['https://cloud.timeedit.net/hivolda/web/timeplan/?loginpost=true', 'https://cloud.timeedit.net/hivolda/web/timeplan/my.html', 'https://cloud.timeedit.net/ldh/web/timeplan/ri.ics']) expect(() => publicTimeEditUrl(url, 'hivolda')).toThrow()
  })
})
