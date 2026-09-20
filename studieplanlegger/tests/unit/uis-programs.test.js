import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { load } from 'cheerio'
import { parseUisCatalogue, parseUisPlan, uisPrograms } from '../../server/providers/uis-programs.js'
const fixture = name => readFileSync(new URL(`../fixtures/public-programs/${name}`, import.meta.url), 'utf8')
const source = 'https://www.uis.no/nb/studieprogram-og-emner/datateknologi-bachelor'
const programHtml = fixture('uis-data-program.html'), planHtml = fixture('uis-data-plan-2026.html')
const query = { program: 'B-DATA', cohort: '2025', sourceUrl: `${source}?semester=2026H`, cohortFromStudent: 'true' }
describe('UiS published catalogue and semester-block contract', () => {
  it('reads program identities separately from course search results', () => {
    const result = parseUisCatalogue(load(fixture('uis-catalogue-first.html')), 'https://www.uis.no/nb/student/studieprogram-og-emner')
    expect(result.results.find(item => item.code === 'B-DATA')).toMatchObject({ name: 'Datateknologi - bachelor', sourceUrl: source })
    expect(result.results.every(item => item.code && item.name)).toBe(true)
  })
  it('preserves source semesters, optional choices and zero versus unknown credits without inventing cohort/calendar years', () => {
    const plan = parseUisPlan(planHtml, { program: 'B-DATA', name: 'Datateknologi', cohort: '2025', edition: '2026H', sourceUrl: query.sourceUrl })
    expect(plan.program).toMatchObject({ cohort: '2025', sourceEdition: '2026H', cohortFromStudent: true })
    const periods = plan.models[0].periods
    expect(periods.map(period => period.studySemester)).toEqual([1,2,3,4,5,6])
    expect(periods.every(period => period.year === null && period.semester === null)).toBe(true)
    expect(periods[0].courses.find(course => course.code === 'DAT120')).toMatchObject({ credits: 10, choice: 'O' })
    expect(periods[0].courses.find(course => course.code === 'TN110').credits).toBeNull()
    expect(periods[1].courses.find(course => course.code === 'TN110').credits).toBe(0)
    expect(periods[4].courses.some(course => course.choice === 'V')).toBe(true)
    expect(plan.warnings.join(' ')).toContain('ikke ditt opptakskull')
  })
  it('follows only source-published edition and lazy endpoint, with cache and explicit student cohort', async () => {
    const fetchText = vi.fn(async (url, _depth, guard) => { guard(new URL(url)); return url.includes('/fs/lazy/') ? planHtml : programHtml })
    const versions = await uisPrograms('uis', 'program-cohorts', { program: 'B-DATA', sourceUrl: source }, { fetchText })
    expect(versions.results.map(item => item.cohort)).toEqual(['2026H','2025H','2024H'])
    expect(versions.results.every(item => item.requiresStudentCohort)).toBe(true)
    const plan = await uisPrograms('uis', 'program-plan', query, { fetchText })
    expect(plan.models[0].periods[0].courses).toHaveLength(5)
    expect(fetchText.mock.calls.at(-1)[0]).toBe('https://www.uis.no/nb/fs/lazy/study-plan/2533827?semester=2026H')
    await expect(uisPrograms('uis', 'program-plan', { ...query, cohortFromStudent: 'false' }, { fetchText })).rejects.toThrow('uttrykkelig')
    await expect(uisPrograms('uis', 'program-plan', { ...query, sourceUrl: `${source}?semester=2023H` }, { fetchText })).rejects.toThrow('planutgave')
  })
  it('rejects mismatched program responses, source redirects and duplicate semester columns', async () => {
    expect(() => parseUisPlan(planHtml, { program: 'OTHER', cohort: '2026', edition: '2026H', sourceUrl: source })).toThrow('valgte')
    expect(() => parseUisPlan(planHtml.replace('data-sem="2"', 'data-sem="1"'), { program: 'B-DATA', cohort: '2026', edition: '2026H', sourceUrl: source })).toThrow('gjentatte')
    const fetchText = async (url, _depth, guard) => { guard(new URL(url.includes('/fs/lazy/') ? url.replace('2026H','2025H') : url)); return url.includes('/fs/lazy/') ? planHtml : programHtml }
    await expect(uisPrograms('uis', 'program-plan', query, { fetchText })).rejects.toThrow('annet program eller studieår')
  })
})
