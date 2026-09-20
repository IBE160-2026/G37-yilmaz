import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { barrattduePrograms, barrattdueProgramUrl, parseBarrattduePlan, parseBarrattdueElectives } from '../../server/providers/barrattdue-programs.js'

const fixture = name => readFile(new URL(`../fixtures/public-programs/barrattdue-${name}.html`, import.meta.url), 'utf8')
const origin = 'https://barrattdue.no', paths = {
  studies: '/studier/hoyere-utdanning/', 'bachelor-root': '/studier/hoyere-utdanning/bachelor-i-utovende-musikk/', 'master-root': '/studier/hoyere-utdanning/master-i-utovende-musikk/', 'further-root': '/studier/videreutdanning/', 'ppu-root': '/studier/hoyere-utdanning/ppu-instrumental-og-vokallaererutdanningen/', 'didactics-root': '/studier/musikkdidaktikk-0-8-ar/',
  vocal: '/studier/hoyere-utdanning/bachelor-i-utovende-musikk/studieplan-bachelor-utovende-musikk-vokal/', instrumental: '/studier/hoyere-utdanning/bachelor-i-utovende-musikk/studieplan/', master: '/studier/studieplan-master-i-utovende-musikk/', ppu: '/studier/hoyere-utdanning/videreutdanning/ppu-instrumental-og-vokallaererutdanningen/studieplan-ppu/', didactics: '/studier/musikkdidaktikk-0-8-ar/studieplan-musikkdidaktikk-0-8-ar/', electives: '/studier/hoyere-utdanning/bachelor-i-utovende-musikk/valgemner/'
}
const query = name => ({ program: paths[name].replace('/studier/', '').replace(/\/$/, ''), sourceUrl: origin + paths[name], cohort: '2026', cohortFromStudent: 'true' })
const fetchFixture = () => vi.fn(async url => { const name = Object.keys(paths).find(name => origin + paths[name] === url); if (!name) throw Error(`Unexpected public URL ${url}`); return fixture(name) })

describe('Barratt Due public annual programme contracts', () => {
  it('follows every published category and programme link, caching the six catalogue pages', async () => {
    const fetchText = fetchFixture(), result = await barrattduePrograms('barrattdue', 'programs', {}, { fetchText })
    expect(result.results).toHaveLength(5)
    expect(result.completeness).toMatchObject({ complete: true, pages: 6 })
    expect(result.results.some(row => row.sourceUrl === query('ppu').sourceUrl)).toBe(true)
    expect(result.results.find(row => row.sourceUrl === query('instrumental').sourceUrl).name).toMatch(/bachelor/i)
    await barrattduePrograms('barrattdue', 'programs', { q: 'master' }, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(6)
  })
  it.each([['vocal', [7, 8, 3, 3]], ['instrumental', [6, 7, 3, 3]], ['master', [5, 3]], ['ppu', [3, 3]]])('%s retains actual annual courses and requires explicit study/calendar semesters', async (name, counts) => {
    const result = parseBarrattduePlan(await fixture(name), query(name)), periods = result.models[0].periods
    expect(periods.map(period => period.courses.length)).toEqual(counts)
    expect(periods.every(period => period.requiresStudentStudySemester && period.studySemester === null && period.year === null && period.semester === null)).toBe(true)
    expect(periods[0].allowedStudySemesters).toEqual([1, 2])
    expect(periods.flatMap(period => period.courses).every(course => course.requiresSemesterChoice && course.year === null)).toBe(true)
    expect(periods.flatMap(period => period.courses).some(course => /^valg(?:fag|emne)/i.test(course.name))).toBe(false)
    if (name === 'vocal') expect(periods[0].courses.some(course => course.code === 'MIP1100')).toBe(true)
    if (name === 'ppu') expect(periods.flatMap(period => period.courses).filter(course => /^PRA/.test(course.code)).every(course => course.credits === null)).toBe(true)
  })
  it('reads separate published elective years and groups without inventing the usually-ten-credit value', async () => {
    const courses = parseBarrattdueElectives(await fixture('electives'), origin + paths.electives), current = courses.filter(course => course.sourceVersion === '2026-2027')
    expect(courses).toHaveLength(17); expect(current).toHaveLength(10)
    expect(current.every(course => course.choice === 'V' && course.courseGroup.includes('2026-2027'))).toBe(true)
    expect(current.some(course => course.credits === null)).toBe(true)
    expect(current.every(course => JSON.stringify(course.allowedCalendarPeriods) === JSON.stringify([{ year: 2026, semester: 'autumn' }, { year: 2027, semester: 'spring' }]))).toBe(true)
    expect(new Set(courses.map(course => `${course.sourceVersion}:${course.sourceRecordId}`)).size).toBe(17)
  })
  it('connects linked elective choices to annual slots and retains base courses on a partial source failure', async () => {
    const result = await barrattduePrograms('barrattdue', 'program-plan', query('vocal'), { fetchText: fetchFixture() })
    expect(result.models[0].periods.some(period => period.courses.some(course => course.sourceVersion === '2026-2027'))).toBe(true)
    expect(result.models[0].periods.every(period => !period.electiveUrls)).toBe(true)
    const fetchText = vi.fn(async url => { if (url === query('vocal').sourceUrl) return fixture('vocal'); throw Error('HTTP 503') })
    const partial = await barrattduePrograms('barrattdue', 'program-plan', query('vocal'), { fetchText })
    expect(partial.completeness.complete).toBe(false)
    expect(partial.models[0].periods.map(period => period.courses.length)).toEqual([7, 8, 3, 3])
    expect(partial.warnings.join()).toContain('HTTP 503')
  })
  it('explains a published plan under revision and refuses unsupported cohort or unsafe source selection', async () => {
    const revised = await fixture('didactics'), vocal = await fixture('vocal')
    expect(() => parseBarrattduePlan(revised, query('didactics'))).toThrow(/under revisjon/)
    expect(() => parseBarrattduePlan(vocal, { ...query('vocal'), cohort: '2020' })).toThrow(/tidligere studieplaner/)
    expect(() => parseBarrattduePlan(vocal, { ...query('vocal'), cohortFromStudent: undefined })).toThrow(/opptakskull/)
    expect(() => barrattdueProgramUrl('https://user:secret@barrattdue.no/studier/hoyere-utdanning/')).toThrow()
    expect(() => barrattdueProgramUrl('https://barrattdue.no/wp-admin/')).toThrow()
  })
})
