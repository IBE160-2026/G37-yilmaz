import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { ansgarPrograms, parseAnsgarCalendar, ansgarProgramUrl } from '../../server/providers/ansgar-programs.js'
const fixture = () => readFile(new URL('../fixtures/public-programs/ansgar-calendar.html', import.meta.url), 'utf8')
const sourceUrl = 'https://www.ansgarhoyskole.no/student/kalender'

describe('Ansgar published calendar programme rows', () => {
  it('keeps all twenty-three explicitly named programme/year rows and separates combined first-year labels', async () => {
    const entries = parseAnsgarCalendar(await fixture())
    expect(entries).toHaveLength(23)
    const bachelor = entries.find(entry => entry.name === 'Bachelor i teologi 1. år'), annual = entries.find(entry => entry.name === 'Årstudium i teologi')
    expect(bachelor.code).not.toBe(annual.code)
    expect(bachelor.periods[0].courses.map(course => course.code)).toEqual(['TEOL131', 'TEOL132', 'TEOL133'])
    expect(bachelor.periods[0]).toMatchObject({ studySemester: 1, year: 2026, semester: 'autumn' })
    expect(bachelor.periods[1]).toMatchObject({ studySemester: 2, year: 2027, semester: 'spring' })
    expect(bachelor.periods[1].courses.map(course => course.code)).toContain('PRA332')
  })
  it('preserves elective blocks without incorrectly marking the preceding required/unknown course', async () => {
    const entries = parseAnsgarCalendar(await fixture()), music = entries.find(entry => entry.name === 'Bachelor musikk og musikkproduksjon 3. år')
    const courses = music.periods[0].courses
    expect(courses.find(course => course.code === 'MUS345').choice).toBe('')
    expect(courses.filter(course => course.choice === 'V').map(course => course.code)).toEqual(['MUS222', 'MUS227', 'KOM101'])
    expect(courses.find(course => course.code === 'MUS222').name).toBe('MUS222')
    expect(courses.every(course => course.credits === null)).toBe(true)
    const psychology = entries.find(entry => entry.name === 'Bachelor i psykologi 2. år')
    expect(psychology.periods[1].courses.every(course => course.choice === 'V')).toBe(true)
  })
  it('requires student cohort while retaining the explicit calendar dates and caches the shared source', async () => {
    const fetchText = vi.fn(async () => fixture()), catalogue = await ansgarPrograms('ansgar', 'programs', {}, { fetchText }), selected = catalogue.results.find(entry => entry.name === 'Bachelor i teologi 1. år')
    expect(catalogue.completeness.complete).toBe(false)
    const cohorts = await ansgarPrograms('ansgar', 'program-cohorts', { program: selected.code, sourceUrl }, { fetchText })
    expect(cohorts.results[0].requiresStudentCohort).toBe(true)
    await expect(ansgarPrograms('ansgar', 'program-plan', { program: selected.code, sourceUrl, cohort: '2024' }, { fetchText })).rejects.toThrow(/opptakskull/)
    const plan = await ansgarPrograms('ansgar', 'program-plan', { program: selected.code, sourceUrl, cohort: '2024', cohortFromStudent: 'true' }, { fetchText })
    expect(plan.program).toMatchObject({ cohort: '2024', cohortFromStudent: true })
    expect(plan.models[0].periods[0].year).toBe(2026)
    expect(fetchText).toHaveBeenCalledTimes(1)
  })
  it('does not turn general calendar deadlines into teaching or infer a year from incomplete headers', async () => {
    const html = await fixture()
    expect(() => parseAnsgarCalendar(html.replaceAll('Høstsemester 2026', 'Høstsemester').replaceAll('Vårsemester 2027', 'Vårsemester'))).toThrow(/kalenderår/)
    expect(() => ansgarProgramUrl('https://www.ansgarhoyskole.no/admin')).toThrow()
    expect(() => ansgarProgramUrl('https://evil.example/student/kalender')).toThrow()
  })
})
