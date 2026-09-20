import { describe, it, expect, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { nordPrograms, parseNordProgramPlan } from '../../server/providers/nord-programs.js'
import { uiaPrograms, parseUiaProgramPlan } from '../../server/providers/uia-programs.js'

const fixture = name => readFile(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8')

describe('Nord public program source', () => {
  it('follows the published pager, checks the declared total and groups plan editions', async () => {
    const pages = await Promise.all([fixture('nord-program-catalogue-1.html'), fixture('nord-program-catalogue-2.html')])
    const fetchText = vi.fn(async url => new URL(url).searchParams.get('page') === '1' ? pages[1] : pages[0])
    const result = await nordPrograms('programs', {}, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(2)
    expect(result.results.map(row => [row.code, row.cohort, row.intake])).toEqual([
      ['testprogram-test-bachelor', '2026', 'autumn'],
      ['annet-program-ap-arsstudium', '2026', 'spring'],
    ])
    expect(result.completeness).toMatchObject({ complete: true, pages: 2, returned: 2, catalogueVersions: 3, total: 3 })
  })
  it('keeps cohort, study-semester and calendar-semester distinct and preserves source choices', async () => {
    const html = await fixture('nord-program-plan.html'), sourceUrl = 'https://www.nord.no/studier/studieplaner/testprogram-test-bachelor-host-2026'
    const result = parseNordProgramPlan(html, { program: 'testprogram-test-bachelor', cohort: '2026', sourceUrl })
    expect(result.program).toMatchObject({ cohort: '2026', intake: 'autumn', campuses: ['Bodø'], sourceRecordId: 'TEST-H26' })
    expect(result.models[0].periods.map(period => [period.studySemester, period.year, period.semester])).toEqual([[1, 2026, 'autumn'], [2, 2027, 'spring']])
    expect(result.models[0].periods[0].courses[0]).toMatchObject({ code: 'TEST100', choice: 'O', credits: 10 })
    expect(result.models[0].periods[0].courses[1]).toMatchObject({ code: 'TEST110', choice: '', credits: 5 })
    expect(result.warnings.join(' ')).toContain('TEST110: planen markerer ikke emnet')
    expect(result.models[0].periods[1].courses[0]).toMatchObject({ code: 'VALG200', choice: 'V', credits: 7.5 })
    const cohorts = await nordPrograms('program-cohorts', { program: 'testprogram-test-bachelor', sourceUrl }, { fetchText: vi.fn(async () => html) })
    expect(cohorts.results.map(row => row.cohort)).toEqual(['2026', '2025'])
  })
  it('does not let a language link replace the published cohort label', async () => {
    const sourceUrl = 'https://www.nord.no/studier/studieplaner/testprogram-test-bachelor-host-2026'
    const html = `${await fixture('nord-program-plan.html')}<a href="${sourceUrl}">Norwegian Bokmål</a>`
    const cohorts = await nordPrograms('program-cohorts', { program: 'testprogram-test-bachelor', sourceUrl }, { fetchText: vi.fn(async () => html) })
    expect(cohorts.results.find(row => row.cohort === '2026').label).toBe('Høst 2026')
  })
  it('rejects a course whose linked calendar semester conflicts with the plan', async () => {
    const html = (await fixture('nord-program-plan.html')).replace('year=2027&amp;semester=V%C3%85R', 'year=2027&amp;semester=H%C3%98ST')
    expect(() => parseNordProgramPlan(html, { program: 'testprogram-test-bachelor', cohort: '2026', sourceUrl: 'https://www.nord.no/studier/studieplaner/testprogram-test-bachelor-host-2026' })).toThrow(/kalendersemester avviker/)
  })
  it('rejects foreign origins, credentials, fragments and unsupported query keys', () => {
    const rejected = [
      'https://evil.test/studier/studieplaner/test-bachelor-host-2026',
      'https://user:secret@www.nord.no/studier/studieplaner/test-bachelor-host-2026',
      'https://www.nord.no/studier/studieplaner/test-bachelor-host-2026#private',
      'https://www.nord.no/studier/studieplaner?token=secret',
    ]
    for (const url of rejected) expect(() => parseNordProgramPlan('<h1>Test</h1>', { program: 'test-bachelor', cohort: '2026', sourceUrl: url })).toThrow()
  })
})

describe('UiA public program source', () => {
  it('deduplicates the complete static programme list without treating nested links as programmes', async () => {
    const html = await fixture('uia-program-list.html'), result = await uiaPrograms('programs', {}, { fetchText: vi.fn(async () => html) })
    expect(result.results.map(row => row.code)).toEqual(['data-ingeniorutdanning-bachelor', 'biologi-arsstudium'])
    expect(result.completeness).toMatchObject({ complete: true, pages: 1, returned: 2 })
  })
  it('follows the explicit plan index and returns only dated source editions', async () => {
    const page = await fixture('uia-program-page.html'), cohorts = await fixture('uia-program-cohorts.html')
    const fetchText = vi.fn(async url => /studieplaner\/$/.test(new URL(url).pathname) ? cohorts : page)
    const result = await uiaPrograms('program-cohorts', { program: 'data-ingeniorutdanning-bachelor', sourceUrl: 'https://www.uia.no/studier/program/data-ingeniorutdanning-bachelor/' }, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(2)
    expect(result.results.map(row => row.cohort)).toEqual(['2026', '2025'])
    expect(result.completeness).toMatchObject({ complete: true, pages: 2, returned: 2 })
  })
  it('preserves admission and specialisation branches as explicit models', async () => {
    const html = await fixture('uia-program-plan.html'), query = { program: 'data-ingeniorutdanning-bachelor', cohort: '2026', sourceUrl: 'https://www.uia.no/studier/program/data-ingeniorutdanning-bachelor/studieplaner/2026h.html' }
    const result = parseUiaProgramPlan(html, query)
    expect(result.program).toMatchObject({ cohort: '2026', intake: 'autumn', campuses: ['Grimstad'] })
    expect(result.models.map(model => model.name)).toEqual(['Data - 1. år / Samordnet opptak / Cybersikkerhet', 'Data - 1. år / Samordnet opptak / Softwareutvikling', 'Data - 1. år / TRES'])
    expect(result.models[0].periods.map(period => [period.studySemester, period.year, period.semester])).toEqual([[1, 2026, 'autumn'], [2, 2027, 'spring']])
    expect(result.models[0].periods.flatMap(period => period.courses).map(course => [course.code, course.choice])).toEqual([['IKT100', 'O'], ['IKT123', 'O'], ['FYS002', 'O']])
    const fysikk = result.models[0].periods[1].courses.find(course => course.code === 'FYS002')
    expect(fysikk).toMatchObject({ year: 2027, semester: 'spring', sourceVersion: '2026H', versionUncertain: true })
    expect(result.warnings.join(' ')).toContain('Studieplanens plassering er beholdt')
    expect(result.completeness.complete).toBe(false)
    expect(result.models[1].periods.flatMap(period => period.courses).map(course => [course.code, course.choice])).toEqual([['IKT100', 'O'], ['IKT104', 'V']])
    expect(result.models[2].periods.flatMap(period => period.courses).map(course => course.code)).toEqual(['MA-006'])
  })
  it('rejects a plan that does not confirm the selected cohort', async () => {
    const html = await fixture('uia-program-plan.html')
    expect(() => parseUiaProgramPlan(html, { program: 'data-ingeniorutdanning-bachelor', cohort: '2025', sourceUrl: 'https://www.uia.no/studier/program/data-ingeniorutdanning-bachelor/studieplaner/2025h.html' })).toThrow(/daterte studiemodellen/)
  })
  it('combines independent published choice groups without choosing for the student', async () => {
    const html = (await fixture('uia-program-plan.html')).replace('class="combination direction-SO direction-parent-ROOT direction-ancestor-ROOT"><h4>Velg studieretning', 'class="combination"><h4>Velg studieretning')
    const result = parseUiaProgramPlan(html, { program: 'data-ingeniorutdanning-bachelor', cohort: '2026', sourceUrl: 'https://www.uia.no/studier/program/data-ingeniorutdanning-bachelor/studieplaner/2026h.html' })
    expect(result.models).toHaveLength(4)
    expect(new Set(result.models.map(model => model.id)).size).toBe(4)
    expect(result.models.every(model => model.selectionIds.length >= 2)).toBe(true)
  })
  it('rejects foreign origins, credentials, fragments and query strings', async () => {
    const html = await fixture('uia-program-plan.html'), query = { program: 'data-ingeniorutdanning-bachelor', cohort: '2026' }
    const rejected = [
      'https://evil.test/studier/program/data-ingeniorutdanning-bachelor/studieplaner/2026h.html',
      'https://user:secret@www.uia.no/studier/program/data-ingeniorutdanning-bachelor/studieplaner/2026h.html',
      'https://www.uia.no/studier/program/data-ingeniorutdanning-bachelor/studieplaner/2026h.html#private',
      'https://www.uia.no/studier/program/data-ingeniorutdanning-bachelor/studieplaner/2026h.html?token=secret',
    ]
    for (const sourceUrl of rejected) expect(() => parseUiaProgramPlan(html, { ...query, sourceUrl })).toThrow()
  })
})
