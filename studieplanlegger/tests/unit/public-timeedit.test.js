import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { publicTimeEdit, publicTimeEditUrl, parsePublicTimeEditEntry, parsePublicTimeEditObjects } from '../../server/providers/public-timeedit.js'

const fixture = name => readFileSync(new URL(`../fixtures/public-timeedit/${name}`, import.meta.url), 'utf8')
const query = { q: 'TEOL1010', year: '2026', semester: 'autumn', sourceObjectId: '4351.5' }
const row = (id, label = `Emne ${id}`) => `<div class="searchObject" data-id="${id}" data-name="${label}"></div>`
const searchUrl = 'https://cloud.timeedit.net/mf/web/timeplan/objects.html?max=100&fr=t&partajax=t&im=f&sid=3&l=nb_NO&search_text=TEOL&objects=&types=5'
const mfEntry = () => parsePublicTimeEditEntry(fixture('mf-entry.html'), 'mf', query, 'https://cloud.timeedit.net/mf/web/timeplan/ri1Q7.html')
function transport({ search = row('4351.5', 'TEOL1010, Bibelen'), schedule = fixture('mf-schedule.html'), calendar = fixture('mf-calendar.ics') } = {}) {
  return vi.fn(async (input, _depth, guard) => {
    const url = new URL(input); guard?.(url)
    if (url.pathname.endsWith('/ri1Q7.html')) return fixture('mf-entry.html')
    if (url.pathname.endsWith('/objects.html')) return search
    if (url.pathname.endsWith('/ri.html')) return schedule
    if (url.pathname.endsWith('/ri.ics')) return calendar
    throw new Error(`Unexpected URL: ${url.pathname}`)
  })
}

describe('Public TimeEdit contracts shared across institutions', () => {
  it('imports NIH through the institution-published anonymous 2026 timetable instead of the 412 root', async () => {
    const fetchText = vi.fn(async input => input.includes('/ri1Q4.html') ? fixture('nih-entry.html') : input.includes('/objects.html') ? fixture('nih-search.html') : input.includes('/ri.html') ? fixture('nih-schedule.html') : fixture('nih-calendar.ics'))
    const result = await publicTimeEdit('nih', 'teaching-calendar', { q: 'IDR107', year: '2026', semester: 'autumn', sourceObjectId: '25097.10' }, { fetchText })
    expect(result.calendar.match(/BEGIN:VEVENT/g)).toHaveLength(26)
    expect(result).toMatchObject({ coverage: 'unknown', publicationBoundaries: { start: '20260801', end: '20261231' }, selected: { sourceObjectId: '25097.10', label: expect.stringContaining('IDR107_1_2026 HØST') } })
    expect(result.calendarUrl).toContain('/nih/web/nih/ri.ics')
    expect(fetchText).toHaveBeenCalledTimes(4)
  })
  it('reads the NHH public semester boundary and treats NMH absent date limits as unknown', () => {
    const nhh = parsePublicTimeEditEntry(fixture('nhh-entry.html'), 'nhh', query, 'https://cloud.timeedit.net/nhh/web/student/ri1Q57.html')
    expect(nhh).toMatchObject({ sid: '13', type: '6', selectedRange: { start: '20260803', end: '20261231' } })
    const nmh = parsePublicTimeEditEntry(fixture('nmh-entry.html'), 'nmh', query, 'https://cloud.timeedit.net/nmh/web/public/ri1Q7.html')
    expect(nmh).toMatchObject({ sid: '3', type: '192', selectedRange: { start: '20260701', end: '20261231' }, publicationBoundaries: { start: null, end: null } })
    expect(nmh.warnings.join(' ')).toContain('ingen ytre datogrenser')
    expect(() => parsePublicTimeEditEntry(fixture('nmh-entry.html').replace('data-startlimit=""', 'data-startlimit="20260230"'), 'nmh', query, 'https://cloud.timeedit.net/nmh/web/public/ri1Q7.html')).toThrow(/tidsrom/)
    expect(() => publicTimeEditUrl('https://cloud.timeedit.net/nmh/web/student1/', 'nmh')).toThrow(/utenfor/)
    expect(() => publicTimeEditUrl('https://cloud.timeedit.net/nhh/web/admin/', 'nhh')).toThrow(/utenfor/)
  })
  it('reads current sid/type/date limits from all four captured entries and clamps only to source limits', () => {
    for (const [institution, sid, type] of [['mf', '3', '5'], ['nmbu', '3', '5'], ['hvl', '74', '36'], ['usn', '1049', '199']]) {
      const entry = parsePublicTimeEditEntry(fixture(`${institution}-entry.html`), institution, query, 'https://cloud.timeedit.net/')
      expect(entry).toMatchObject({ sid, type, selectedRange: { end: '20261231' } })
      expect(entry.selectedRange.start).toBe(institution === 'usn' ? '20260810' : '20260701')
    }
    expect(() => parsePublicTimeEditEntry(fixture('hvl-entry.html'), 'hvl', { ...query, year: '2025' }, 'https://cloud.timeedit.net/')).toThrow('dekker ikke')
  })
  it('follows the published USN semester link and rejects an unpublished semester before searching', async () => {
    const fetchText = vi.fn(async input => input.endsWith('/publikk/') ? '<a href="/usn/web/publikk/ri1Q5084.html">Timeplan høst 2026</a>' : input.endsWith('/ri1Q5084.html') ? fixture('usn-entry.html') : row('423453.199', 'VPEMN1 2026 HØST PORSGRUNN'))
    const result = await publicTimeEdit('usn', 'teaching-search', { ...query, q: 'VPEMN1' }, { fetchText })
    expect(result.results[0]).toMatchObject({ id: '423453.199', sourceObjectId: '423453.199' })
    expect(result.results[0].sourceUrl).toContain('objects=423453.199')
    await expect(publicTimeEdit('usn', 'teaching-search', { ...query, semester: 'spring' }, { fetchText })).rejects.toThrow('publiserer ikke')
    expect(fetchText).toHaveBeenCalledTimes(3)
  })
  it('follows source next placeholders, including subsequent fragments without repeated pager metadata', () => {
    const entry = mfEntry(), first = parsePublicTimeEditObjects(fixture('mf-search.html'), 'mf', entry, searchUrl)
    expect(first.rows).toHaveLength(100)
    expect(new URL(first.next).searchParams.get('start')).toBe('100')
    const second = parsePublicTimeEditObjects(fixture('mf-search-page2.html'), 'mf', entry, first.next, first.pager)
    expect(second.rows).toHaveLength(100)
    expect(new URL(second.next).searchParams.get('start')).toBe('200')
    const last = parsePublicTimeEditObjects(row('999999.5'), 'mf', entry, second.next, second.pager)
    expect(last.next).toBeNull()
    expect(last.rows[0].sourceUrl).toContain('p=20260701.x%2C20261231.x')
  })
  it('collects every offered result page and reuses cached reads', async () => {
    const fetchText = vi.fn(async input => input.includes('/ri1Q7.html') ? fixture('mf-entry.html') : input.includes('start=100') ? fixture('mf-search-page2.html') : input.includes('start=200') ? row('999999.5') : fixture('mf-search.html'))
    const result = await publicTimeEdit('mf', 'teaching-search', { ...query, q: 'TEOL' }, { fetchText })
    expect(result.completeness).toMatchObject({ complete: true, pages: 3, returned: 201 })
    await publicTimeEdit('mf', 'teaching-search', { ...query, q: 'TEOL' }, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(4)
  })
  it('reports a partial catalogue on HTTP failure or repeated source records, without discarding earlier results', async () => {
    for (const broken of ['http', 'duplicate']) {
      const fetchText = vi.fn(async input => {
        if (input.includes('/ri1Q7.html')) return fixture('mf-entry.html')
        if (input.includes('start=100')) { if (broken === 'http') throw new Error('HTTP 503'); return fixture('mf-search-page2.html').replace('data-id="', 'data-id="1086.5" ignored="') }
        return fixture('mf-search.html')
      })
      const result = await publicTimeEdit('mf', 'teaching-search', { ...query, q: 'TEOL' }, { fetchText })
      expect(result.completeness.complete).toBe(false)
      expect(result.results.length).toBeGreaterThanOrEqual(100)
      expect(result.warnings.join(' ')).toContain('ufullstendig')
    }
  })
  it('fetches a source-published fixed-period export only after checking selected object identity', async () => {
    const fetchText = transport(), result = await publicTimeEdit('mf', 'teaching-calendar', query, { fetchText })
    expect(result.calendar.match(/BEGIN:VEVENT/g)).toHaveLength(40)
    expect(result).toMatchObject({ coverage: 'unknown', selected: { sourceObjectId: '4351.5' } })
    expect(result.calendarUrl).toContain('objects=4351.5')
    expect(new URL(result.calendarUrl).searchParams.get('p')).toBe('20260701.x,20261231.x')
    expect(fetchText).toHaveBeenCalledTimes(4)
    await publicTimeEdit('mf', 'teaching-calendar', query, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(4)
  })
  it('does not fetch arbitrary IDs, cross-institution paths, credentials, extra parameters or redirected selections', async () => {
    const fetchText = transport()
    await expect(publicTimeEdit('mf', 'teaching-calendar', { ...query, sourceObjectId: '99999.5' }, { fetchText })).rejects.toThrow('finnes ikke')
    expect(fetchText).toHaveBeenCalledTimes(2)
    for (const url of ['https://cloud.timeedit.net/usn/web/publikk/ri.ics', 'https://cloud.timeedit.net/mf/web/private/ri.ics', 'https://user:pass@cloud.timeedit.net/mf/web/timeplan/ri.ics', 'https://127.0.0.1/mf/web/timeplan/ri.ics', 'https://cloud.timeedit.net/mf/web/timeplan/ri.ics?token=private']) expect(() => publicTimeEditUrl(url, 'mf')).toThrow()
    const redirect = vi.fn(async (input, _depth, guard) => { const changed = new URL(input); changed.searchParams.set('sid', '999'); guard(changed) })
    await expect(publicTimeEdit('mf', 'teaching-search', query, { fetchText: redirect })).rejects.toThrow('videresendte')
  })
  it('allows NMBU whole-week display rounding only while search and export retain the exact semester', async () => {
    const fetchText = vi.fn(async input => input.includes('/ri1Q7.html') ? fixture('nmbu-entry.html') : input.includes('/objects.html') ? row('101051.5', 'MATH100, 2026 HØST') : input.includes('/ri.html') ? fixture('nmbu-schedule.html') : fixture('mf-calendar.ics'))
    const result = await publicTimeEdit('nmbu', 'teaching-calendar', { ...query, q: 'MATH100', sourceObjectId: '101051.5' }, { fetchText })
    expect(result.requestedRange).toEqual({ start: '20260701', end: '20261231' })
    expect(new URL(result.calendarUrl).searchParams.get('p')).toBe('20260701.x,20261231.x')
    expect(result.warnings.some(message => message.includes('hele uker'))).toBe(true)
  })
  it('rejects a replaced course, changed date range, substituted export or HTML response before returning a calendar', async () => {
    for (const schedule of [fixture('mf-schedule.html').replace('data-searchids="4351.5"', 'data-searchids="1086.5"'), fixture('mf-schedule.html').replace('value="20260701"', 'value="20260912"'), fixture('mf-schedule.html').replace('objects=4351.5&amp;', 'objects=1086.5&amp;')]) {
      const fetchText = transport({ schedule })
      await expect(publicTimeEdit('mf', 'teaching-calendar', query, { fetchText })).rejects.toThrow(/annet emne|kalenderlenken/)
      expect(fetchText).toHaveBeenCalledTimes(3)
    }
    await expect(publicTimeEdit('mf', 'teaching-calendar', query, { fetchText: transport({ calendar: '<html>Sign in</html>' }) })).rejects.toThrow('kalenderfil')
  })
  it('keeps explicit seminar-group objects distinct and never executes source scripts', async () => {
    const fetchText = transport({ search: `${row('4351.5', 'TEOL1010, Bibelen')}${row('4511.5', 'TEOL1010-1, GT/NT Bibelfagsseminar')}<script>throw new Error('execute me')</script>` })
    const result = await publicTimeEdit('mf', 'teaching-search', query, { fetchText })
    expect(result.results.map(item => item.id)).toEqual(['4351.5', '4511.5'])
    expect(result.results.every(item => item.selected === undefined)).toBe(true)
  })
})
