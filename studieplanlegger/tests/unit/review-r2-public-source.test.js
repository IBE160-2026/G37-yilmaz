import { describe, it, expect, vi } from 'vitest'
import { parseNtnuProgramPlan, ntnuPrograms } from '../../server/providers/ntnu-programs.js'
import { calendarTerm, collectPages } from '../../server/providers/program-source.js'

const source = 'https://www.ntnu.no/studier/studieplan'
const query = { program: 'TEST', cohort: '2026' }
const leaf = { courseGroups: [{ courses: [{ code: 'GOOD100', name: 'Published course' }] }] }
const plan = direction => ({ studyplan: { code: 'TEST', name: 'Programme', year: 2026, startTerm: 'H', studyPeriods: [{ periodNumber: 1, direction }] } })

describe('R10 public source boundaries', () => {
  it('omits absent/null/non-string course codes without fabricated identities or silent completeness', () => {
    const courses = [null, { name: 'Absent' }, { code: null, name: 'Null' }, { code: 123, name: 'Number' }, { code: {}, name: 'Object' }, ...leaf.courseGroups[0].courses]
    const result = parseNtnuProgramPlan(plan({ courseGroups: [{ courses }] }), query, source)
    expect(result.models[0].periods[0].courses.map(row => row.id)).toEqual(['ntnu:GOOD100:2026:autumn'])
    expect(result.completeness.complete).toBe(false)
    expect(result.warnings.join(' ')).toContain('mangler kode/navn')
  })
  it('keeps valid catalogue programmes and reports all missing or non-string programme identities', async () => {
    const docs = [null, { studyprogName: 'Absent' }, { studyprogCode: null, studyprogName: 'Null' }, { studyprogCode: 123, studyprogName: 'Number' }, { studyprogCode: 'TEST', studyprogName: 'Published programme' }]
    const fetchText = vi.fn(async url => new URL(url).searchParams.has('p_p_resource_id') ? JSON.stringify({ docs, numFound: docs.length }) : '<div data-allstudiesurl="https://www.ntnu.no/studier/alle?p_p_resource_id=allStudies&amp;p_p_lifecycle=2"></div>')
    const result = await ntnuPrograms('programs', {}, { fetchText })
    expect(result.results.map(row => row.code)).toEqual(['TEST'])
    expect(result.completeness).toMatchObject({ complete: false, returned: 1, omitted: 4 })
    expect(result.warnings.join(' ')).toContain('4 publiserte rader')
    await expect(ntnuPrograms('program-cohorts', { program: null }, { fetchText })).rejects.toMatchObject({ status: 'invalid-selection' })
    expect(fetchText).toHaveBeenCalledTimes(2)
  })
  it('bounds unnamed direction depth, retaining a valid sibling and explicit incompleteness', () => {
    let nested = structuredClone(leaf)
    for (let depth = 0; depth < 30; depth++) nested = { studyDirection: nested }
    const result = parseNtnuProgramPlan(plan({ studyDirection: [{ code: 'valid', ...leaf }, nested] }), query, source)
    expect(result.models.map(model => model.id)).toEqual(['valid'])
    expect(result.completeness.complete).toBe(false)
    expect(result.warnings.join(' ')).toContain('dypere enn sikkerhetsgrensen')
  })
  it('accepts the exact depth boundary and rejects an entirely over-deep plan safely', () => {
    let nested = structuredClone(leaf)
    for (let depth = 0; depth < 10; depth++) nested = { studyDirection: nested }
    expect(parseNtnuProgramPlan(plan(nested), query, source).completeness.complete).toBe(true)
    expect(() => parseNtnuProgramPlan(plan({ studyDirection: nested }), query, source)).toThrow(/dypere enn sikkerhetsgrensen/)
    expect(() => parseNtnuProgramPlan(plan({ studyDirection: nested }), query, source)).toThrow(expect.objectContaining({ status: 'not-supported' }))
  })
  it('fails when a repeated catalogue identity carries conflicting normalized metadata', async () => {
    const fetchText = vi.fn(async () => '<html></html>')
    await expect(collectPages('https://catalogue.test/', fetchText, () => {}, () => ({ results: [{ id: 'a', name: 'old' }, { id: 'b' }, { id: 'a', name: 'updated' }], next: null }), { maxResults: 2 })).rejects.toMatchObject({ status: 'source-changed' })
  })
  it('does not label an exact terminal result boundary or duplicate rows as truncation', async () => {
    const result = await collectPages('https://catalogue.test/', async () => '<html></html>', () => {}, () => ({ results: [{ id: 'a', metadata: { z: 1, a: 2 } }, { id: 'b' }, { metadata: { a: 2, z: 1 }, id: 'a' }] }), { maxResults: 2 })
    expect(result.completeness).toEqual({ complete: true, pages: 1, returned: 2 })
    expect(result.warnings).toEqual([])
  })
  it('resolves two-digit terms to the first matching year in the bounded cohort window', () => {
    expect(calendarTerm('00 V', 2099)).toEqual({ year: 2100, semester: 'spring' })
    expect(calendarTerm('46 H', 2040)).toEqual({ year: 2046, semester: 'autumn' })
    expect(calendarTerm('39 H', 2040)).toBeNull()
    expect(calendarTerm('61 V', 2040)).toBeNull()
    expect(calendarTerm('2039 H', 2040)).toBeNull()
  })
  it('stops before another page at the cap and reports incomplete coverage', async () => {
    const fetchText = vi.fn(async () => '<html></html>')
    const result = await collectPages('https://catalogue.test/', fetchText, () => {}, () => ({ results: [{ id: 'a' }, { id: 'b' }], next: 'https://catalogue.test/page2' }), { maxResults: 2 })
    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(result.completeness).toMatchObject({ complete: false, returned: 2 })
  })
})
