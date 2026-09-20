import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parseFihCalendarPdf, parseFihCalendarHtml, parseFihCalendar, fihCalendarSources, fetchFihCalendar, fihCalendarUrl } from '../../server/providers/fih-calendar.js'
import { parseCalendar } from '../../src/calendar-import.js'
// Public sharing keys in source fixtures are replaced with a synthetic test key.
const fixture = name => readFile(new URL(`../fixtures/public-programs/fih-calendar-${name}`, import.meta.url), 'utf8')
const pdfUrl = 'https://fih.fjellhaug.no/files/uploads/Instruksjoner/Lenker-for-timeplan.pdf', htmlUrl = 'https://fih.fjellhaug.no/ikt-verkt%C3%B8y/webcalfiler'
const pdf = async () => parseFihCalendarPdf(JSON.parse(await fixture('links.json')), pdfUrl)
describe('FIH published Edupage class calendars', () => {
  it('parses all 15 PDF classes across page boundaries and reconstructs split class names and URLs', async () => {
    const rows = await pdf()
    expect(rows).toHaveLength(15)
    expect(rows[1]).toMatchObject({ className: 'BTFL 1. år', sourceObjectId: '-23', sourceLabel: 'PDF-oversikt' })
    expect(rows[8]).toMatchObject({ className: 'BBMM 2. year', sourceObjectId: '-20' })
    expect(rows.at(-1)).toMatchObject({ className: 'MTM 2. år', sourceObjectId: '-31' })
  })
  it('preserves the separate 14-choice web list rather than guessing equivalence for matching class names', async () => {
    const a = await pdf(), b = parseFihCalendarHtml(await fixture('html.html'), htmlUrl)
    expect(b).toHaveLength(14)
    expect(new Set([...a, ...b].map(row => row.id)).size).toBe(29)
    expect(a.find(row => row.className === 'BTM 1. år').sourceObjectId).not.toBe(b.find(row => row.className === 'BTM 1. år').sourceObjectId)
    expect(b.every(row => row.name.includes('Nettsideoversikt'))).toBe(true)
  })
  it('preserves all 164 actual dated events, the chosen public class, identifiers and source uncertainty', async () => {
    const selected = (await pdf())[1], text = await fixture('btfl1.ics'), result = parseFihCalendar(text, selected)
    expect(result.count).toBe(164); expect(result.authoritative).toBe(false)
    const parsed = parseCalendar(result.calendar, { courseId: '', year: 2026, semester: 'autumn' })
    expect(parsed.events).toHaveLength(164)
    expect(parsed.events.every(event => event.courseId === '' && event.group === 'BTFL 1. år')).toBe(true)
    expect(parsed.events.find(event => event.sourceUid === '2026-08-13:e88cad1e_6@fih.edupage.org')).toMatchObject({ start: '2026-08-13T10:30:00.000Z', end: '2026-08-13T11:15:00.000Z' })
    expect(parseFihCalendar(text, selected).calendar).toBe(result.calendar)
  })
  it('rejects a different class response and rejects invalid source URLs before fetching', async () => {
    expect(() => parseFihCalendar('BEGIN:VCALENDAR\nX-WR-CALNAME:Timetable: -24\nEND:VCALENDAR', { sourceObjectId: '-23' })).toThrow(/klasse-ID/)
    for (const url of ['https://fih.edupage.org/webcal?pwd=0000000000000000&type=plan&studentid=23', 'https://fih.edupage.org/webcal?pwd=0000000000000000&type=personal&studentid=-23', 'https://127.0.0.1/webcal?pwd=0000000000000000&type=plan&studentid=-23']) expect(() => fihCalendarUrl(url)).toThrow()
    const fetchText = vi.fn()
    await expect(fetchFihCalendar('https://127.0.0.1/webcal', { fetchText })).rejects.toThrow()
    expect(fetchText).not.toHaveBeenCalled()
  })
  it('keeps the independent web list if the published PDF is unreadable, with a visible source failure', async () => {
    const fetchText = vi.fn(async url => fixture(url.includes('/student') ? 'student.html' : 'html.html')), fetchBytes = vi.fn(async () => Buffer.from('unreadable isolated PDF source'))
    const result = await fihCalendarSources({ fetchText, fetchBytes })
    expect(result.results).toHaveLength(14)
    expect(result.warnings.join()).toContain('kunne ikke leses')
    await expect(fetchFihCalendar('https://fih.edupage.org/webcal?pwd=0000000000000000&type=plan&studentid=-999', { fetchText, fetchBytes })).rejects.toThrow(/publiserte oversikter/)
    expect(fetchText.mock.calls.some(([url]) => url.includes('edupage'))).toBe(false)
  })
  it('does not silently accept duplicate or unlabeled PDF calendar identities', async () => {
    const pages = JSON.parse(await fixture('links.json'))
    const firstLink = pages[0].lines.findIndex(line => line.startsWith('https:'))
    const duplicate = structuredClone(pages); duplicate[0].lines.push(...duplicate[0].lines.slice(firstLink - 1, firstLink + 1))
    expect(() => parseFihCalendarPdf(duplicate, pdfUrl)).toThrow(/gjentar/)
    pages[0].lines[firstLink - 1] = 'Unclear prose'
    expect(() => parseFihCalendarPdf(pages, pdfUrl)).toThrow(/klasseetikett/)
  })
})
