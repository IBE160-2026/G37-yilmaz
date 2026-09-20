import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { publicTimeEdit, publicTimeEditUrl, parsePublicTimeEditEntry } from '../../server/providers/public-timeedit.js'
import { parseCalendar } from '../../src/calendar-import.js'

// Reduced snapshots from the actual published guest view checked 12.09.2026.
// These local regression tests do not themselves verify a live external source.
const fixture = name => readFileSync(new URL(`../fixtures/public-timeedit/kristiania-${name}`, import.meta.url), 'utf8')
const query = { q: 'PGR102', year: '2026', semester: 'autumn', sourceObjectId: '161320.5' }
const entryUrl = 'https://cloud.timeedit.net/no_kristiania/web/public/ri1Q7.html'
const transport = () => vi.fn(async (url, depth, guard) => {
  guard(url)
  return fixture(url.includes('ri1Q7.html') ? 'entry.html' : url.includes('objects.html') ? 'search.html' : url.includes('ri.ics') ? 'calendar.ics' : 'schedule.html')
})

describe('Kristiania published guest course timetable', () => {
  it('uses the public course entry and rejects semesters outside its published boundaries', () => {
    expect(parsePublicTimeEditEntry(fixture('entry.html'), 'kristiania', query, entryUrl)).toMatchObject({
      sid: '3', type: '5', selectedRange: { start: '20260701', end: '20261231' }, publicationBoundaries: { start: '20250811', end: '20261231' },
    })
    expect(() => parsePublicTimeEditEntry(fixture('entry.html'), 'kristiania', { ...query, year: '2027', semester: 'spring' }, entryUrl)).toThrow(/dekker ikke/)
  })
  it('imports the explicitly selected 2026 course while retaining invalid-source and missing-group warnings', async () => {
    const fetchText = transport(), search = await publicTimeEdit('kristiania', 'teaching-search', query, { fetchText })
    expect(search.results).toHaveLength(1)
    expect(search.results[0]).toMatchObject({ sourceObjectId: query.sourceObjectId, label: 'PGR102, Introduksjon til programmering, 2026 HØST' })
    expect(search.completeness).toMatchObject({ complete: true, pages: 1, returned: 1 })
    const result = await publicTimeEdit('kristiania', 'teaching-calendar', query, { fetchText })
    expect(result.calendar.match(/BEGIN:VEVENT/g)).toHaveLength(58)
    const parsed = parseCalendar(result.calendar, { courseId: '', year: 2026, semester: 'autumn' })
    expect(parsed.events).toHaveLength(49)
    expect(parsed.events[0]).toMatchObject({ title: 'Emnenavn: Introduksjon til programmering', start: '2026-08-21T08:15:00.000Z', end: '2026-08-21T10:00:00.000Z', groupMissing: true })
    expect(parsed.warnings.join(' ')).toMatch(/ugyldig varighet/)
    expect(parsed.warnings.join(' ')).toMatch(/mangler gruppenummer/)
    expect(parsed.authoritative).toBe(false)
    expect(result.coverage).toBe('unknown')
    expect(fetchText).toHaveBeenCalledTimes(4)
    await expect(publicTimeEdit('kristiania', 'teaching-calendar', { ...query, sourceObjectId: '161321.5' }, { fetchText })).rejects.toThrow(/finnes ikke/)
    expect(fetchText).toHaveBeenCalledTimes(4)
  })
  it('refuses personal, staff and other institutional routes without weakening the common transport', () => {
    for (const url of [entryUrl.replace('/public/', '/student/'), entryUrl.replace('/public/', '/ansatt/'), entryUrl + '?loginpost=true', entryUrl.replace('/no_kristiania/', '/nla/'), entryUrl.replace('https://', 'https://user:password@')]) expect(() => publicTimeEditUrl(url, 'kristiania')).toThrow()
  })
})
