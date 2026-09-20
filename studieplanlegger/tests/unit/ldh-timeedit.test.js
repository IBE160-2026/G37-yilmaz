import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { publicTimeEdit, publicTimeEditUrl, parsePublicTimeEditEntry } from '../../server/providers/public-timeedit.js'
import { parseCalendar } from '../../src/calendar-import.js'
const fixture = name => readFileSync(new URL(`../fixtures/public-timeedit/ldh-${name}`, import.meta.url), 'utf8')
const query = { q: 'BSY', year: '2026', semester: 'autumn', sourceObjectId: '33985.5' }
function transport() { return vi.fn(async (url, depth, guard) => { guard(url); return fixture(url.includes('ri1Q7.html') ? 'entry.html' : url.includes('objects.html') ? 'search.html' : url.includes('ri.ics') ? 'calendar.ics' : 'schedule.html') }) }
describe('LDH actual public TimeEdit source', () => {
  it('uses source type and publication boundary and rejects spring 2027 before object search', async () => {
    const entry = parsePublicTimeEditEntry(fixture('entry.html'), 'ldh', query, 'https://cloud.timeedit.net/ldh/web/timeplan/ri1Q7.html')
    expect(entry).toMatchObject({ sid: '3', type: '5', publicationBoundaries: { start: '20240815', end: '20261231' } })
    const fetchText = transport()
    await expect(publicTimeEdit('ldh', 'teaching-search', { ...query, year: '2027', semester: 'spring' }, { fetchText })).rejects.toThrow(/dekker ikke/)
    expect(fetchText).toHaveBeenCalledTimes(1)
  })
  it('preserves all 33 published prefix choices without guessing current course or personal A/B affiliation', async () => {
    const fetchText = transport(), result = await publicTimeEdit('ldh', 'teaching-search', query, { fetchText })
    expect(result.results).toHaveLength(33)
    expect(result.results[0]).toMatchObject({ label: 'BSY-121A 2026 Høst', sourceObjectId: '33985.5' })
    expect(result.results[1].label).toBe('BSY-121B 2026 Høst')
    expect(result.completeness).toMatchObject({ complete: true, pages: 1, returned: 33 })
  })
  it('reads the selected actual export and makes source defects visible without asserting full coverage', async () => {
    const fetchText = transport(), result = await publicTimeEdit('ldh', 'teaching-calendar', query, { fetchText })
    expect(result.calendar.match(/BEGIN:VEVENT/g)).toHaveLength(176)
    expect(result.coverage).toBe('unknown')
    const parsed = parseCalendar(result.calendar, { courseId: '', year: 2026, semester: 'autumn' })
    expect(parsed.events).toHaveLength(140); expect(parsed.authoritative).toBe(false)
    expect(parsed.warnings.join()).toContain('mangler navn')
    expect(parsed.events[0]).toMatchObject({ start: '2026-08-11T10:00:00.000Z', end: '2026-08-11T10:30:00.000Z' })
    await publicTimeEdit('ldh', 'teaching-calendar', query, { fetchText }); expect(fetchText).toHaveBeenCalledTimes(4)
  })
  it('rejects room booking, login and other institution routes', () => {
    for (const url of ['https://cloud.timeedit.net/ldh/web/timeplan/my.html', 'https://cloud.timeedit.net/ldh/web/timeplan/?loginpost=true', 'https://cloud.timeedit.net/mf/web/timeplan/ri.ics']) expect(() => publicTimeEditUrl(url, 'ldh')).toThrow()
  })
})
