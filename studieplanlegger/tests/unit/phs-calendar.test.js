import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import ICAL from 'ical.js'
import { parsePhsExamCalendar, fetchPhsExamCalendar, phsExamSources } from '../../server/providers/phs-calendar.js'

const url = level => `https://www.politihogskolen.no/for-studenter/eksamen/eksamensoversikt-${level}`
const fixture = level => readFile(new URL(`../fixtures/phs-programs/exams-${level}.html`, import.meta.url), 'utf8')
const components = result => new ICAL.Component(ICAL.parse(result.calendar)).getAllSubcomponents()
const field = (item, key) => item.getFirstPropertyValue(key)

describe('published PHS exams, with explicit selection and no assumed personal appointment', () => {
  it('separates exact deadlines, timed school exams and unknown personal oral slots from actual bachelor source', async () => {
    const result = parsePhsExamCalendar(await fixture('ba'), url('ba')), items = components(result)
    const task = items.find(item => item.name === 'vtodo' && field(item, 'summary').includes('FOREBYGG01-2') && field(item, 'summary').includes('Ordinær'))
    expect(field(task, 'due').toString()).toBe('2026-12-14T11:00:00Z')
    const exam = items.find(item => field(item, 'summary').includes('STRAFF01') && field(item, 'summary').includes('Ny'))
    expect(field(exam, 'dtstart').toString()).toBe('2026-10-13T07:00:00Z'); expect(field(exam, 'dtend').toString()).toBe('2026-10-13T13:00:00Z'); expect(field(exam, 'transp')).toBe('OPAQUE')
    const oral = items.find(item => field(item, 'summary').includes('POLISAMF01') && field(item, 'summary').includes('Ordinær'))
    expect(field(oral, 'dtstart').toString()).toBe('2026-11-26'); expect(field(oral, 'dtend').toString()).toBe('2026-12-10'); expect(field(oral, 'transp')).toBe('TRANSPARENT')
    expect(result.unresolved.some(row => row.sourceExcerpt.includes('Mandag 18. mai') && row.reason.includes('Ukedag'))).toBe(true)
    expect(result.authoritative).toBe(false); expect(items.every(item => !field(item, 'description').includes('<'))).toBe(true)
  })
  it('reads all master rows, preserves retake/cohort labels and does not infer deadline clocks', async () => {
    const result = parsePhsExamCalendar(await fixture('ma'), url('ma')), items = components(result)
    expect(items).toHaveLength(10); expect(result.unresolved).toHaveLength(1)
    expect(result.unresolved[0].sourceExcerpt).toContain('MA-927')
    expect(items.every(item => item.name === 'vevent' && field(item, 'transp') === 'TRANSPARENT')).toBe(true)
    const range = items.find(item => field(item, 'summary').includes('MA-922'))
    expect(field(range, 'dtstart').toString()).toBe('2026-09-09'); expect(field(range, 'dtend').toString()).toBe('2026-09-12')
    expect(field(range, 'summary')).toContain('P25 · Ny')
  })
  it('retains identity when the source changes an exam date or its clock, and keeps separate exams separate', async () => {
    const html = await fixture('ba'), before = components(parsePhsExamCalendar(html, url('ba')))
    const changed = html.replace('Tirsdag 13. oktober', 'Tirsdag 20. oktober').replace('kl. 09:00 - 15:00', 'kl. 10:00 - 16:00')
    const after = components(parsePhsExamCalendar(changed, url('ba')))
    expect(after.map(item => field(item, 'uid'))).toEqual(before.map(item => field(item, 'uid')))
    expect(new Set(after.map(item => field(item, 'uid'))).size).toBe(after.length)
  })
  it('preserves an adjacent paragraph containing an explicit deadline rather than inventing a time', async () => {
    const items = components(parsePhsExamCalendar(await fixture('ba'), url('ba')))
    const task = items.find(item => item.name === 'vtodo' && field(item, 'summary').includes('ETTERFORSK01') && field(item, 'summary').includes('Ny'))
    expect(field(task, 'due').toString()).toBe('2026-10-16T13:00:00Z')
    expect(field(task, 'description')).toContain('Innlevering åpner kl. 09:00')
  })
  it('does not follow query tokens, unrelated paths or logins and reuses the public response', async () => {
    const fetchText = vi.fn(async () => fixture('ma'))
    expect(phsExamSources().results).toHaveLength(2)
    await fetchPhsExamCalendar(url('ma'), { fetchText }); await fetchPhsExamCalendar(url('ma'), { fetchText }); expect(fetchText).toHaveBeenCalledTimes(1)
    await expect(fetchPhsExamCalendar(url('ma') + '?token=private', { fetchText })).rejects.toThrow()
    await expect(fetchPhsExamCalendar('https://www.politihogskolen.no/login', { fetchText })).rejects.toThrow()
    expect(fetchText).toHaveBeenCalledTimes(1)
  })
})
