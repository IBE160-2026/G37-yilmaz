import { readFile } from 'node:fs/promises'
import { describe, it, expect, vi } from 'vitest'
import { samasPrograms, parseSamasHtmlPlan, samasDetails } from '../../server/providers/samas-programs.js'
import { parseSamasPdf } from '../../server/providers/samas-pdf.js'
import { publicTimeEdit } from '../../server/providers/public-timeedit.js'
const fixture = name => readFile(new URL(`../fixtures/samas-programs/${name}`, import.meta.url), 'utf8')
const tolking = 'https://samas.no/nb/studie/dul-1000-innforing-i-tolking-sorsamisk-norsk'
const language = 'https://samas.no/se/studie/samegiela-ja-sami-girjjalasvuoda-masterprogramma'
const program = url => url.split('/').at(-1).toUpperCase()
const info = name => ({ program: name, name, cohort: '2025', sourceUrl: `https://samas.no/se/studier/${name}`, pdfUrl: `https://samas.no/sites/default/files/2025-08/${name}.pdf` })
const pages = name => fixture(`${name}-2025.json`).then(JSON.parse)
const catalogueFetch = vi.fn(async (input, _depth, guard) => { const url = new URL(input); guard(url); return fixture(url.pathname === '/nb/studier' ? 'catalogue-nb.html' : `catalogue-se-${url.searchParams.get('page') || '0'}.html`) })

describe('Sámi public bilingual catalogue and actual cohort plans', () => {
  it('reads all three Sámi catalogue pages plus the Norwegian catalogue without claiming historical completeness', async () => {
    const result = await samasPrograms('samas', 'programs', { q: '' }, { fetchText: catalogueFetch })
    expect(result.results).toHaveLength(33)
    expect(result.completeness).toMatchObject({ complete: true, pages: 4, returned: 33 })
    expect(result.completeness.scope).toContain('Historiske og ikke-listede')
    expect(catalogueFetch).toHaveBeenCalledTimes(4)
    const urls = catalogueFetch.mock.calls.map(([url]) => String(url))
    expect(urls).toContain('https://samas.no/se/oahput?page=2')
  })
  it('preserves the other language when one public catalogue fails', async () => {
    const fetchText = async (input, _depth, guard) => { const url = new URL(input); guard(url); if(url.pathname.startsWith('/se/')) throw new Error('Temporary error'); return fixture('catalogue-nb.html') }
    const result = await samasPrograms('samas', 'programs', { q: '' }, { fetchText })
    expect(result.results).toHaveLength(7)
    expect(result.completeness.complete).toBe(false)
    expect(result.warnings.join(' ')).toContain('Temporary error')
  })
  it('keeps the actual parallel two-semester courses and source startup separate from calendar dates', async () => {
    const html = await fixture('tolking.html'), plan = parseSamasHtmlPlan(html, { program: program(tolking), cohort: '2026H' }, tolking)
    expect(plan.models[0].periods).toHaveLength(2)
    const [first, second] = plan.models[0].periods
    expect(first.courses.map(course => course.code)).toEqual(['DUL-1001', 'DUL-1004'])
    expect(first.courses.map(course => course.credits)).toEqual([15, 15])
    expect(first.courses[0].id).toBe(second.courses[0].id)
    expect(first).toMatchObject({ year: null, semester: null, studySemester: 1 })
    expect(first.courses.every(course => course.sourceVersion === '2026H')).toBe(true)
    expect(() => parseSamasHtmlPlan(html, { program: program(tolking), cohort: '2025H' }, tolking)).toThrow(/publiserte oppstart/)
  })
  it('preserves actual mandatory/elective headings and requires study-semester placement for the language master', async () => {
    const plan = parseSamasHtmlPlan(await fixture('master-language.html'), { program: program(language), cohort: '2026H' }, language), period = plan.models[0].periods[0]
    expect(period).toMatchObject({ studySemester: null, requiresStudentStudySemester: true, year: null, semester: null })
    expect(period.courses).toHaveLength(14)
    expect(period.courses.filter(course => course.choice === 'O')).toHaveLength(4)
    expect(period.courses.filter(course => course.choice === 'V')).toHaveLength(10)
    expect(period.courses.every(course => course.requiresSemesterChoice)).toBe(true)
    expect(period.courses.find(course => course.code === 'SÁM 321').credits).toBe(60)
  })
  it('uses source-linked PDF cohort instead of the newer page startup and reports conflicting link labels', async () => {
    const sourceUrl = 'https://samas.no/se/studier/sami-vuoddoskuvlaoahpaheaddjeoahppu-1-7-ceahki-master'
    const result = await samasPrograms('samas', 'program-cohorts', { sourceUrl, program: program(sourceUrl) }, { fetchText: async (url, _depth, guard) => { guard(new URL(url)); return fixture('vuoma.html') } })
    expect(result.results).toHaveLength(1)
    expect(result.results[0].cohort).toBe('2025')
    expect(result.warnings.join(' ')).toContain('lenketekst sier 2024')
    expect(() => parseSamasPdf([], info('gmoa'))).toThrow(/PDF-forsiden/)
  })
  it('reads all seven GMOA semesters using whole course credits and stable identities across allocations', async () => {
    const source = await pages('gmoa'), plan = parseSamasPdf(source, info('gmoa')), periods = plan.models[0].periods
    expect(plan.completeness.returned).toBe(9)
    expect(periods.map(period => [period.year, period.semester])).toEqual([[2025,'autumn'],[2026,'spring'],[2026,'autumn'],[2027,'spring'],[2027,'autumn'],[2028,'spring'],[2028,'autumn']])
    expect(periods[0].courses[0]).toMatchObject({ code: 'MOA 110', credits: 20, sourceVersion: '2025' })
    expect(periods[0].courses[0].id).toBe(periods[1].courses[0].id)
    expect(periods[0].requirements[0]).toContain('15 beaivvi')
    expect(() => parseSamasPdf(source, { ...info('gmoa'), cohort: '2026' })).toThrow(/PDF-forsiden/)
  })
  it('keeps merged year cells unplaced, elective language choices and unknown practice credits in both teacher plans', async () => {
    for(const name of ['vuoma', 'vuoma510']) {
      const plan = parseSamasPdf(await pages(name), info(name)), model = plan.models[0]
      expect(model.periods).toHaveLength(10)
      expect(model.periods[9]).toMatchObject({ year: 2030, semester: 'spring', studySemester: 10 })
      expect(model.unplacedCourses).toHaveLength(2)
      expect(model.unplacedCourses.map(course => course.credits)).toEqual([15, 50])
      expect(model.unplacedCourses.every(course => course.requiresSemesterChoice)).toBe(true)
      expect(model.periods[0].courses[2].credits).toBeNull()
      expect(model.periods[1].courses.some(course => course.choice === 'V')).toBe(true)
      expect(model.periods[4].courses[0].credits).toBe(5)
    }
    const plan = parseSamasPdf(await pages('vuoma510'), info('vuoma510')), model = plan.models[0]
    expect(plan.completeness.returned).toBe(29)
    expect(model.periods[1].requirements.join(' ')).toContain('Ufullstendig kildeoppføring: • V5PÁČ')
    expect(model.periods[1].courses.filter(course => course.choice === 'V').map(course => course.credits)).toEqual([30,30,30])
    expect(model.periods[8].courses[0].notes).toContain('PDF-side 2')
    expect(model.unplacedCourses[1].notes).toContain('PDF-side 2')
  })
  it('provides only the actual named child course excerpt and refuses unconfirmed codes or external sources', async () => {
    const query = { sourceUrl: tolking, code: 'DUL-1001', year: '2026', semester: 'autumn' }, fetchText = async (url, _depth, guard) => { guard(new URL(url)); return fixture('tolking.html') }
    const detail = await samasDetails(query, fetchText)
    expect(detail.course).toMatchObject({ name: 'Yrkesetikk og profesjonskunnskap i tolking', credits: 15, sourceVersion: '2026H' })
    expect(detail.course.description).toContain('DUL-1001')
    await expect(samasDetails({ ...query, code: 'MOA 110' }, fetchText)).rejects.toThrow(/bekrefter ikke/)
    await expect(samasDetails({ ...query, sourceUrl: 'https://localhost/nb/studie/x' }, fetchText)).rejects.toThrow(/utenfor/)
  })
  it('queries the public prefix then filters actual spaced TimeEdit codes without guessing object identity', async () => {
    const fetchText = vi.fn(async (input, _depth, guard) => { const url = new URL(input); guard(url); if(url.pathname.endsWith('ri1Q56.html')) return readFile(new URL('../fixtures/public-timeedit/samas-entry.html',import.meta.url),'utf8'); expect(url.searchParams.get('search_text')).toBe('MOA'); return '<div class="searchObject" data-id="1624.5" data-name="Mánáid stoahkan, oahppan ja ovdáneapmi, MOA 110"></div><div class="searchObject" data-id="1625.5" data-name="Servodat, MOA 120"></div>' })
    const result = await publicTimeEdit('samas','teaching-search',{ q:'MOA 110',year:'2026',semester:'autumn' },{ fetchText })
    expect(result.results).toHaveLength(1)
    expect(result.results[0].sourceObjectId).toBe('1624.5')
    expect(result.completeness.returned).toBe(1)
  })
})
