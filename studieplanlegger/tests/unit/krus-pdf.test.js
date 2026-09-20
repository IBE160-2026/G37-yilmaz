import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { krusPdfVersions, krusPdfUrl, parseKrusPdfPlan } from '../../server/providers/krus-pdf.js'
import { krusPrograms } from '../../server/providers/krus-programs.js'
import { readPublicPdfItems } from '../../server/providers/public-pdf-text.js'
vi.mock('../../server/providers/public-pdf-text.js', () => ({ readPublicPdfItems: vi.fn() }))

const fixture = name => readFile(new URL(`../fixtures/public-programs/krus-${name}`, import.meta.url), 'utf8')
const programs = { full: 'aspirant-heltidsutdanningen', part: 'aspirant-deltidsutdanningen', bachelor: 'student-bachelorpabygg-og-enkeltemner' }
const source = type => `https://www.krus.no/for-aspiranter-og-studenter/${programs[type]}`
const versions = async type => krusPdfVersions(await fixture(`${type}-versions.html`), source(type))
const pages = async (type, number = 1) => JSON.parse(await fixture(`${type}-${number}-pdf.json`))
const parse = async (type, number = 1) => { const version = (await versions(type))[number - 1]; return parseKrusPdfPlan(await pages(type, number), { program: programs[type], cohort: version.requiresStudentCohort ? '2026' : version.cohort, cohortFromStudent: 'true' }, version, programs[type]) }

describe('KRUS published cohort and validity-period PDFs', () => {
  it('lists every source-linked version and distinguishes exact cohorts from validity periods', async () => {
    expect((await versions('full')).map(row => [row.cohort, row.intake])).toEqual([['2026', 'autumn'], ['2025', 'autumn'], ['2024', 'autumn']])
    expect((await versions('part'))[0]).toMatchObject({ cohort: '2026', intake: 'spring', end: { year: 2028, semester: 'autumn' } })
    expect((await versions('bachelor')).map(row => row.bound)).toEqual([{ direction: 'fra', year: 2027, semester: 'spring' }, { direction: 'til', year: 2026, semester: 'autumn' }])
    expect((await versions('bachelor')).every(row => row.requiresStudentCohort)).toBe(true)
  })
  it.each([1, 2, 3])('full-time source version %s preserves all course metadata and the published four-semester span', async number => {
    const result = await parse('full', number), periods = result.models[0].periods, year = 2027 - number
    expect(periods.map(period => [period.year, period.semester])).toEqual([[year, 'autumn'], [year + 1, 'spring'], [year + 1, 'autumn'], [year + 2, 'spring']])
    expect(periods.map(period => period.courses.length)).toEqual([3, 3, 3, 3])
    expect(new Set(periods.flatMap(period => period.courses).map(course => course.code)).size).toBe(9)
    expect(periods[1].courses.find(course => course.code === 'KRUS2000')).toMatchObject({ credits: 30, requiresSemesterChoice: true })
    expect(result.program.cohortFromStudent).toBeUndefined()
    expect(periods.flatMap(period => period.courses).some(course => course.code === 'KRUS3000')).toBe(false)
  })
  it('reads the real six-semester spring intake and preserves split PDF codes and either/or placements', async () => {
    const result = await parse('part'), periods = result.models[0].periods
    expect(periods.map(period => period.courses.length)).toEqual([2, 4, 4, 2, 4, 2])
    expect(periods[0]).toMatchObject({ year: 2026, semester: 'spring' }); expect(periods[5]).toMatchObject({ year: 2028, semester: 'autumn' })
    expect(periods[5].courses[0]).toMatchObject({ code: 'KRUS2300D', credits: 15 })
    expect(periods[1].courses.filter(course => course.choice === 'V').map(course => course.code)).toEqual(['KRUS2100D', 'KRUS2000D'])
  })
  it.each([1, 2])('bachelor validity version %s keeps its three named courses and an unfilled elective requirement', async number => {
    const result = await parse('bachelor', number), periods = result.models[0].periods
    expect(periods.map(period => period.studySemester)).toEqual([5, 6, 7, 8])
    expect(periods.flatMap(period => period.courses).map(course => course.code)).toEqual(['KRUS3000', 'KRUS3100', 'KRUS3900'])
    expect(periods[2].courses).toHaveLength(0); expect(periods[2].requirements.join()).toContain('navngir ikke valgemnetilbudet')
    expect(periods.flatMap(period => period.courses).every(course => course.choice === 'O' && course.credits === 15 && course.calendarPeriodBound)).toBe(true)
    expect(periods.every(period => period.year === null && period.semester === null)).toBe(true)
    expect(result.program).toMatchObject({ cohort: '2026', cohortFromStudent: true }); expect(result.completeness.complete).toBe(false)
  })
  it('rejects mismatched covers, malformed layout and unsafe PDF locations without guessing', async () => {
    const version = (await versions('full'))[0], data = await pages('full'), query = { program: programs.full, cohort: '2026' }
    expect(() => parseKrusPdfPlan(data, { ...query, cohort: '2025' }, version, 'Full')).toThrow(/opptakskull/)
    data[0].items.forEach(item => { item.str = item.str.replace('H26-V28', 'H25-V27') })
    expect(() => parseKrusPdfPlan(data, query, version, 'Full')).toThrow(/PDF-forsiden/)
    expect(() => krusPdfUrl('https://www.krus.no/admin/private.pdf')).toThrow()
    expect(() => krusPdfUrl('https://user:secret@www.krus.no/download/public/1/test.pdf')).toThrow()
  })
  it('connects the selected exact PDF to program API and retains the existing HTML alternative', async () => {
    const html = await fixture('full-versions.html'), version = (await versions('full'))[0], fetchText = vi.fn(async () => html), fetchBytes = vi.fn()
    const cohorts = await krusPrograms('krus', 'program-cohorts', { program: programs.full, sourceUrl: source('full') }, { fetchText, fetchBytes })
    expect(cohorts.results).toHaveLength(4); expect(cohorts.results.at(-1)).toMatchObject({ requiresStudentCohort: true, sourceUrl: source('full') })
    vi.mocked(readPublicPdfItems).mockResolvedValueOnce(await pages('full'))
    const result = await krusPrograms('krus', 'program-plan', { program: programs.full, sourceUrl: version.sourceUrl, cohort: '2026' }, { fetchText, fetchBytes })
    expect(result.models[0].periods[0].courses).toHaveLength(3)
    expect(readPublicPdfItems).toHaveBeenCalledWith(fetchBytes, version.sourceUrl, krusPdfUrl)
    const previous = vi.mocked(readPublicPdfItems).mock.calls.length
    await expect(krusPrograms('krus', 'program-plan', { program: programs.full, sourceUrl: 'https://www.krus.no/download/public/1/unlisted.pdf', cohort: '2026' }, { fetchText, fetchBytes })).rejects.toThrow(/ikke en publisert planversjon/)
    expect(readPublicPdfItems).toHaveBeenCalledTimes(previous)
  })
})
