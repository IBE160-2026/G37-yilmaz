import { readFile } from 'node:fs/promises'
import { load } from 'cheerio'
import { describe, it, expect, vi } from 'vitest'
import { parseKhioTeachingList, parseKhioTeachingSchedule, khioTeaching } from '../../server/providers/khio-teaching.js'
const fixture = name => readFile(new URL(`../fixtures/public-timeedit/khio-${name}.html`, import.meta.url), 'utf8')
const origin = 'https://cloud.timeedit.net/khio/web/', query = { q: 'BAKK 1', year: '2026', semester: 'autumn' }, entry = `${origin}design/ri1Q74.html`

describe('KHiO explicitly published programme and cohort timetables', () => {
  it('reads all source calendar links without entering account or personal search links', async () => {
    const rows = parseKhioTeachingList(await fixture('design-list'), `${origin}design/`)
    expect(rows).toHaveLength(15)
    expect(rows.find(row => row.sourceObjectId === 'design:ri1Q74.html').label).toContain('BAKK 1')
    expect(rows.every(row => !row.sourceUrl.includes('login') && !row.sourceUrl.includes('/student/'))).toBe(true)
    expect(parseKhioTeachingList(await fixture('opera-list'), `${origin}opera/`)).toHaveLength(7)
  })
  it('keeps the published multi-object expression and supports source-specific open-ended boundaries', async () => {
    const data = parseKhioTeachingSchedule(await fixture('design-entry'), entry, query)
    expect(data.objects).toBe('18509.6,-1,18136.21,-1,18177.21,18175.21,18176.21')
    expect(data.boundaries).toEqual({ start: '20160101', end: null })
    expect(data.range).toEqual({ start: '20260701', end: '20261231' })
    const opera = parseKhioTeachingSchedule(await fixture('opera-entry'), `${origin}opera/ri1Q66.html`, query)
    expect(opera.range).toEqual({ start: '20260817', end: '20261220' })
    expect(opera.sourceNames).toContain('OP521')
  })
  it('rejects changed object identity, unpublished destinations and semesters outside published limits', async () => {
    const html = await fixture('design-entry'), opera = await fixture('opera-entry')
    expect(() => parseKhioTeachingSchedule(html.replace('data-searchids="18509.6', 'data-searchids="999.6'), entry, query)).toThrow(/kalenderidentitet/)
    expect(() => parseKhioTeachingSchedule(html, `${origin}student/ri1Q74.html`, query)).toThrow(/utenfor/)
    expect(() => parseKhioTeachingSchedule(opera, `${origin}opera/ri1Q66.html`, { ...query, year: '2025' })).toThrow(/ikke kalendersemesteret/)
  })
  it('keeps successful department results during a partial source failure and verifies exact export identity', async () => {
    const list = await fixture('design-list'), original = await fixture('design-entry'), fetchText = vi.fn(async (input, _depth, guard) => {
      const url = new URL(input); guard(url)
      if (url.pathname.endsWith('/design/')) return list
      if (url.pathname.endsWith('/ri1Q74.html')) return original
      if (url.pathname.endsWith('/ri.html')) {
        const $ = load(original), base = new URL($('#linksdata').attr('data-linksbase')); base.searchParams.set('p', url.searchParams.get('p')); $('#linksdata').attr('data-linksbase', base.href)
        $('a').each((_i, node) => { const link = new URL($(node).attr('href')); link.searchParams.set('p', url.searchParams.get('p')); $(node).attr('href', link.href) }); return $.html()
      }
      if (url.pathname.endsWith('/ri.ics')) return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'
      throw new Error('isolated department failure')
    })
    const search = await khioTeaching('teaching-search', query, fetchText)
    expect(search.results).toHaveLength(1)
    expect(search.completeness.complete).toBe(false)
    expect(search.warnings.join(' ')).toContain('kunne ikke leses')
    const result = await khioTeaching('teaching-calendar', { ...query, sourceObjectId: 'design:ri1Q74.html' }, fetchText)
    expect(result.coverage).toBe('unknown')
    expect(new URL(result.calendarUrl).searchParams.get('p')).toBe('20260701.x,20261231.x')
    expect(new URL(result.calendarUrl).searchParams.get('objects')).toContain(',-1,')
    expect(result.sourceUrl).toBe(entry)
    await expect(khioTeaching('teaching-calendar', { ...query, sourceObjectId: 'design:ri1Q75.html' }, fetchText)).rejects.toThrow(/faktisk publisert/)
  })
})
