import { describe, it, expect, vi } from 'vitest'
import { decodeOsloMetPlans, parseOsloMetCatalogue, parseOsloMetCohorts, parseOsloMetPlan, oslometPrograms } from '../../server/providers/oslomet-programs.js'

// Synthetic contract fixtures; external source acceptance is recorded separately.
const source = 'https://student.oslomet.no/studier/-/studieinfo/programplan/TEST/2026/H%C3%98ST'
const course = (code, termNr = 1) => ({ code, name: `Emne ${code}`, termNr, link: `https://student.oslomet.no/studier/-/studieinfo/emne/${code}/2026/H%C3%98ST`, weight: { type: 'SP', value: 10 }, selectionRule: { code: 'O', name: 'Obligatorisk' }, span: { count: 1 } })
const structure = [{ year: 1, semesters: [{ sortKey: 1, name: { year: 2026, term: 'Høst' }, studyStructure: [{ courses: [course('A')] }, { name: 'Retning', veivalg: true, nest: [{ name: 'Retning B', courses: [course('B')] }, { name: 'Retning C', courses: [course('C')] }] }] }, { sortKey: 2, name: { year: 2027, term: 'Vår' }, studyStructure: [{ courses: [course('D', 2)] }] }] }]
function html(plan = structure) { const literal = JSON.stringify({ studyPlan: plan }).replace(/./g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`); return `<h1>Testprogram Programplan</h1><script>var subjectPlans = JSON.parse('${literal}');</script>` }
const catalogue = `<a href="${source}"><h2>Testprogram</h2></a><a href="${source}/oppbygning#emneliste">Emneliste</a>`

describe('OsloMet public programme source contract', () => {
  it('uses published links and deduplicates the course-list link', () => {
    expect(parseOsloMetCatalogue(catalogue)).toEqual([expect.objectContaining({ code: 'TEST', name: 'Testprogram', cohort: '2026', intake: 'autumn', sourceUrl: source })])
    expect(() => parseOsloMetCatalogue('<a href="https://other.test/programplan/TEST">Test</a>')).toThrow('ingen publiserte')
  })
  it('keeps actual calendar periods distinct from the source course edition', () => {
    const result = parseOsloMetPlan(html(), source), periods = result.models[0].periods
    expect(periods.map(p => [p.studySemester, p.year, p.semester])).toEqual([[1, 2026, 'autumn'], [2, 2027, 'spring']])
    expect(periods[1].courses[0]).toMatchObject({ year: 2027, semester: 'spring', sourceVersion: '2026-autumn', sourceUrl: course('D', 2).link })
  })
  it('never treats a mandatory course inside an unchosen branch as universally mandatory', () => {
    const period = parseOsloMetPlan(html(), source).models[0].periods[0]
    expect(period.courses.map(c => [c.code, c.choice])).toEqual([['A', 'O'], ['B', 'V'], ['C', 'V']])
    expect(period.courses[1].notes).toContain('Retning B')
    expect(period.requirements.join(' ')).toContain('Retning C')
  })
  it('does not invent missing calendar information and rejects duplicate periods', () => {
    const uncertain = structuredClone(structure); uncertain[0].semesters[0].name = {}
    expect(parseOsloMetPlan(html(uncertain), source).models[0].periods[0]).toMatchObject({ year: null, semester: null })
    const duplicate = structuredClone(structure); duplicate[0].semesters[1].sortKey = 1
    expect(() => parseOsloMetPlan(html(duplicate), source)).toThrow('gjentatte')
  })
  it('reads both same-year intakes and excludes a different programme from the cohort selector', () => {
    const spring = source.replace('H%C3%98ST', 'V%C3%85R')
    const rows = parseOsloMetCohorts(`<select id="x_yearSwitcher"><option data-link="${source}">Høst 2026</option><option data-link="${spring}">Vår 2026</option><option data-link="${source.replace('TEST', 'OTHER')}">Andre</option></select>`, source)
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map(row => row.intake))).toEqual(new Set(['spring', 'autumn']))
  })
  it('decodes JSON only and never executes source contents', () => {
    globalThis.oslometProbe = 0
    expect(() => decodeOsloMetPlans("var subjectPlans = JSON.parse('null'); globalThis.oslometProbe = 9;")).toThrow()
    expect(() => decodeOsloMetPlans("var subjectPlans = JSON.parse('{\\q}');")).toThrow()
    expect(decodeOsloMetPlans(html())).toEqual(structure)
    expect(globalThis.oslometProbe).toBe(0)
    delete globalThis.oslometProbe
  })
  it('validates host, credentials, redirects, programme and cohort before fetching', async () => {
    const fetchText = vi.fn().mockResolvedValue(html())
    await expect(oslometPrograms('oslomet', 'program-plan', { sourceUrl: 'https://127.0.0.1/studier' }, { fetchText })).rejects.toThrow()
    await expect(oslometPrograms('oslomet', 'program-plan', { sourceUrl: source, cohort: '2025' }, { fetchText })).rejects.toThrow('stemmer ikke')
    expect(fetchText).not.toHaveBeenCalled()
    await oslometPrograms('oslomet', 'program-plan', { sourceUrl: source, cohort: '2026' }, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(() => fetchText.mock.calls[0][2](new URL('https://unrelated.test/'))).toThrow()
  })
  it('caches repeated public source reads and preserves errors', async () => {
    const fetchText = vi.fn().mockResolvedValue(catalogue)
    await oslometPrograms('oslomet', 'programs', {}, { fetchText })
    await oslometPrograms('oslomet', 'programs', {}, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(1)
    const failed = vi.fn().mockRejectedValue(Object.assign(new Error('HTTP 403'), { status: 'upstream-error' }))
    await expect(oslometPrograms('oslomet', 'programs', {}, { fetchText: failed })).rejects.toThrow('HTTP 403')
    expect(failed).toHaveBeenCalledTimes(1)
  })
})
