import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { load } from 'cheerio'
import { khioPrograms, khioDetails, parseKhioCatalogue, parseKhioPlan, parseKhioCourse } from '../../server/providers/khio-programs.js'
const fixture = name => readFile(new URL(`../fixtures/arts-programs/${name}`, import.meta.url), 'utf8')
const current = { program: 'BAKK', cohort: '2026', cohortFromStudent: 'true' }, bakkUrl = 'https://khio.no/studieprogrammer/bakk'

describe('KHiO source programme editions, year groups and course details', () => {
  it('reads all 21 source programme cards without turning application deadlines into plan dates', async () => {
    const { results } = parseKhioCatalogue(load(await fixture('khio-catalogue.html')), 'https://khio.no/studieprogrammer')
    expect(results).toHaveLength(21)
    expect(results.find(program => program.code === 'BAKK')).toMatchObject({ name: 'Bachelorstudium i klesdesign og kostymedesign', sourceUrl: bakkUrl })
    expect(results.every(program => program.cohort === undefined && !program.name.includes('Søknadsfrist'))).toBe(true)
  })
  it('keeps the 2023 plan edition separate from student cohort and asks for actual study semester', async () => {
    const html = await fixture('khio-bakk.html')
    expect(() => parseKhioPlan(html, { ...current, cohortFromStudent: 'false' }, bakkUrl)).toThrow(/eget kull/)
    const plan = parseKhioPlan(html, current, bakkUrl)
    expect(plan.program).toMatchObject({ cohort: '2026', cohortFromStudent: true, sourceEdition: '2023H' })
    expect(plan.models[0].periods.map(period => [period.sourceStudyYear, period.studySemester, period.requiresStudentStudySemester, period.year, period.semester, period.courses.length])).toEqual([[1, null, true, null, null, 9], [2, null, true, null, null, 7], [3, null, true, null, null, 7]])
    expect(plan.models[0].periods[0].courses[0]).toMatchObject({ code: 'KK101', credits: 15, requiresSemesterChoice: true })
    expect(plan.models[0].periods[1].courses.find(course => course.code === 'KK203').choice).toBe('V')
    expect(plan.completeness.complete).toBe(false)
  })
  it('uses the same contract for an opera master with a different edition and two study years', async () => {
    const plan = parseKhioPlan(await fixture('khio-maop.html'), { ...current, program: 'MAOP' }, 'https://khio.no/studieprogrammer/maop')
    expect(plan.program.sourceEdition).toBe('2022H')
    expect(plan.models[0].periods.map(period => period.courses.length)).toEqual([6, 5])
    expect(plan.models[0].periods[1].courses.find(course => course.code === 'OP550').credits).toBe(35)
  })
  it('rejects unknown programme identity, missing year tabs, source substitution and changed columns', async () => {
    const html = await fixture('khio-bakk.html')
    expect(() => parseKhioPlan(html, { ...current, program: 'MAOP' }, bakkUrl)).toThrow(/stemmer ikke/)
    expect(() => parseKhioPlan(html.replace('År 1', 'Semester 1'), current, bakkUrl)).toThrow(/studieårsinndeling/)
    expect(() => parseKhioPlan(html.replace('/emner/kk101-2', 'https://other.example/kk101'), current, bakkUrl)).toThrow(/utenfor/)
    expect(() => parseKhioPlan(html.replace('Emnenavn</th>', 'Eksamensdato</th>'), current, bakkUrl)).toThrow(/kolonner/)
  })
  it('imports named course content and preserves its programme edition without inventing teaching dates', async () => {
    const data = parseKhioCourse(await fixture('khio-kk101.html'), { code: 'KK101', year: '2026', semester: 'autumn' }, 'https://khio.no/emner/kk101-2')
    expect(data.course).toMatchObject({ code: 'KK101', credits: 15, year: 2026, semester: 'autumn' })
    expect(data.course.description).toContain('Læringsutbytte')
    expect(data.course.sourceVersion).toContain('2023')
    expect(data.calendarUrl).toBeNull()
    expect(() => parseKhioCourse('<main><h1>Redirect</h1></main>', { code: 'KK101', year: '2026', semester: 'autumn' }, 'https://khio.no/emner/kk101-2')).toThrow(/stemmer ikke/)
  })
  it('reuses programme reads, follows only same-source redirects and loads details separately', async () => {
    const fetchText = vi.fn(async (url, _depth, guard) => { guard?.(new URL(url)); return fixture(url.includes('/emner/') ? 'khio-kk101.html' : 'khio-bakk.html') })
    const cohorts = await khioPrograms('khio', 'program-cohorts', { ...current, sourceUrl: bakkUrl }, { fetchText })
    expect(cohorts.results[0].requiresStudentCohort).toBe(true)
    await khioPrograms('khio', 'program-plan', { ...current, sourceUrl: bakkUrl }, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(1)
    const course = await khioDetails({ code: 'KK101', year: '2026', semester: 'autumn', sourceUrl: 'https://khio.no/emner/kk101-2' }, fetchText)
    expect(course.course.name).toBe('Fagverktøy')
    expect(fetchText).toHaveBeenCalledTimes(2)
    await expect(khioDetails({ code: 'KK101', sourceUrl: 'https://khio.no/intranett/' }, fetchText)).rejects.toThrow(/utenfor/)
    const redirect = async (_url, _depth, guard) => { guard(new URL('https://khio.no/studieprogrammer/maop')); return '' }
    await expect(khioPrograms('khio', 'program-plan', { ...current, sourceUrl: bakkUrl }, { fetchText: redirect })).rejects.toThrow(/annen/)
  })
})
