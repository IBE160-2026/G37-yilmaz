import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { fihPrograms, parseFihPlan, fihProgramUrl } from '../../server/providers/fih-programs.js'
const fixture = name => readFile(new URL(`../fixtures/public-programs/fih-${name}.html`, import.meta.url), 'utf8')
const query = program => ({ program, cohort: '2026', cohortFromStudent: 'true', sourceUrl: `https://fih.fjellhaug.no/studier/${program}` })

describe('Fjellhaug published HTML programme contracts', () => {
  it('lists all twenty-one real catalogue entries with source campus labels', async () => {
    const fetchText = vi.fn(async () => fixture('studies')), result = await fihPrograms('fih', 'programs', {}, { fetchText })
    expect(result.results).toHaveLength(21)
    expect(result.results.find(item => item.code === 'btm-cph').campuses).toEqual(['København'])
    await fihPrograms('fih', 'programs', { q: 'teologi' }, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(1)
  })
  it('joins fragmented links, preserves empty elective semesters and does not invent a cohort or year', async () => {
    const result = parseFihPlan(await fixture('btfl'), query('teologi-formidling-og-ledelse-bachelor')), periods = result.models[0].periods
    expect(periods.map(period => period.courses.length)).toEqual([3, 3, 2, 3, 0, 0])
    expect(periods[0]).toMatchObject({ studySemester: 1, semester: 'autumn', year: null })
    expect(periods[0].courses[2]).toMatchObject({ code: 'BTM1501', name: 'Introduksjon til praktisk teologi og misjonsvitenskap', credits: 10, choice: '' })
    expect(periods[4].requirements).toEqual(periods[5].requirements)
    expect(periods[4].requirements.join()).toContain('Åpent for å velge')
    expect(result.program).toMatchObject({ cohortFromStudent: true, campuses: ['Oslo'] })
  })
  it('uses the explicitly annual programme context and preserves the published either-or choice', async () => {
    const result = parseFihPlan(await fixture('ateol'), query('ateol'))
    expect(result.models[0].periods.map(period => period.courses.length)).toEqual([3, 4])
    expect(result.models[0].periods[1].courses.filter(course => course.choice === 'V').map(course => course.code)).toEqual(['BTM1004', 'PT1501'])
  })
  it('retains master variants and nested five-credit course tables without inventing a code for unlinked courses', async () => {
    const result = parseFihPlan(await fixture('mtm'), query('mtm'))
    expect(result.models).toHaveLength(3)
    expect(result.models[0].periods[2].courses.map(course => [course.code, course.credits])).toEqual([['VIT501', 5], ['MET510', 5]])
    expect(result.models[2].periods.map(period => period.studySemester)).toEqual([3, 4])
    expect(result.models[2].periods[1].courses[0]).toMatchObject({ name: 'Masteravhandling', credits: 50, code: '' })
  })
  it('requires explicit student cohort and rejects unsupported layouts and source URLs', async () => {
    expect(() => parseFihPlan('<main><h2>Ny type programside</h2></main>', query('new'))).toThrow(/ingen støttet tabell/)
    expect(() => parseFihPlan('<main></main>', { ...query('ateol'), cohortFromStudent: undefined })).toThrow(/opptakskull/)
    expect(() => fihProgramUrl('https://fih.fjellhaug.no/admin')).toThrow()
    expect(() => fihProgramUrl('https://evil.example/studier/ateol')).toThrow()
  })
})
