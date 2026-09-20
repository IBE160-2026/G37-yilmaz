import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { publicTimeEdit, publicTimeEditUrl, parsePublicTimeEditEntry } from '../../server/providers/public-timeedit.js'
import { parseCalendar } from '../../src/calendar-import.js'
const fixture = name => readFileSync(new URL(`../fixtures/public-timeedit/steiner-${name}`, import.meta.url), 'utf8')
const query = { q: '1', year: '2026', semester: 'autumn', sourceObjectId: '847.5' }
const transport = () => vi.fn(async (url, depth, guard) => { guard(url); return fixture(url.includes('ri1Q1.html') ? 'entry.html' : url.includes('objects.html') ? 'search.html' : url.includes('ri.ics') ? 'calendar.ics' : 'schedule.html') })
describe('Steiner public teaching contract', () => {
  it('uses current publication limits rather than a stale display query from 2023', () => {
    const result = parsePublicTimeEditEntry(fixture('entry.html'), 'steiner', query, 'https://cloud.timeedit.net/no_sh/web/publik/ri1Q1.html')
    expect(result).toMatchObject({ sid: '6', type: '5', selectedRange: { start: '20260810', end: '20261231' }, publicationBoundaries: { start: '20260810', end: '20270701' } })
    expect(result.warnings.join()).toContain('Hele kalendersemesteret er ikke dokumentert')
    expect(() => parsePublicTimeEditEntry(fixture('entry.html'), 'steiner', { ...query, year: '2025' }, 'https://cloud.timeedit.net/no_sh/web/publik/ri1Q1.html')).toThrow(/dekker ikke/)
  })
  it('keeps ten actually matched course choices distinct and fetches only the chosen public calendar', async () => {
    const fetchText = transport(), result = await publicTimeEdit('steiner', 'teaching-search', query, { fetchText })
    expect(result.results).toHaveLength(10)
    expect(result.results[0]).toMatchObject({ sourceObjectId: '847.5', label: 'D-MAT1.1 2026 HØST' })
    const calendar = await publicTimeEdit('steiner', 'teaching-calendar', query, { fetchText })
    expect(calendar.calendar.match(/BEGIN:VEVENT/g)).toHaveLength(34)
    expect(parseCalendar(calendar.calendar, { courseId: '', year: 2026, semester: 'autumn' }).events).toHaveLength(34)
    expect(calendar.coverage).toBe('unknown')
    expect(fetchText).toHaveBeenCalledTimes(4)
  })
  it('rejects login, personal schedules and another institution', () => {
    for (const url of ['https://cloud.timeedit.net/no_sh/web/publik/?loginpost=true', 'https://cloud.timeedit.net/no_sh/web/publik/my.html', 'https://cloud.timeedit.net/ldh/web/timeplan/ri.ics']) expect(() => publicTimeEditUrl(url, 'steiner')).toThrow()
  })
})
