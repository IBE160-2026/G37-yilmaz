import { describe, expect, it, vi } from 'vitest'
import { parseNlaCatalogue, parseNlaCohorts, parseNlaPlan, nlaPrograms } from '../../server/providers/nla-programs.js'

// Synthetic public React4XP contracts, distinct from real source acceptance.
const origin = 'https://www.nla.no'
const source = `${origin}/your-studies/studieplan/TEST`
const script = (jsxPath, props) => `<script type="application/json" data-react4xp-app-name="no.seeds.nla">${JSON.stringify({ jsxPath, props })}</script>`
const courseList = `<p><a href="/your-studies/emneplan/A100">A100</a> - Innføring - 10 Studiepoeng</p><p><a href="/your-studies/emneplan/B200">B200</a> - Videreføring - 7.5 Studiepoeng</p><p><a href="/your-studies/emneplan/EX300">EX300</a> - Fritt emne - 10 Studiepoeng</p>`
const props = { dropdown: { selected: '2026', options: [{ label: '2026', value: '2026' }, { label: '2025', value: '2025' }] }, items: { 2026: { title: 'Testprogram', table: { list: [{ title: 'Studieprogramkode:', content: 'TEST' }, { title: 'Kull:', content: '2026 Høst' }, { title: 'Studiesteder:', content: '<a href="/campus">Bergen</a>' }] }, accordions: [{ title: 'Studiets oppbygning', content: '<p>Velg retning selv.</p><table><tr><td>1.semester</td><td>A100 Innføring</td></tr><tr><td>2.semester Vår 2027</td><td>B200 eller EX300</td></tr></table>' }, { title: 'Emneoversikt', content: courseList }] } } }

describe('NLA public programme source contracts', () => {
  it('reads all source catalogue rows independently of the frontend page size', () => {
    const data = Array.from({ length: 118 }, (_, i) => ({ href: `${source}${i}`, title: `Program ${i}` }))
    data.push({ href: `${origin}/your-studies/emneplan/EMNE`, title: 'Emne' })
    expect(parseNlaCatalogue(script('site/layouts/courses-overview-fs/courses-overview-fs', { data, howManyPerPage: 50 }))).toHaveLength(118)
  })
  it('reads only published cohort options and constructs the route used by the source year selector', () => {
    const rows = parseNlaCohorts(script('StudieplanPage', props), `${source}/2026`)
    expect(rows.map(row => row.sourceUrl)).toEqual([`${source}/2026`, `${source}/2025`])
    expect(() => parseNlaPlan(script('StudieplanPage', props), source, '2025')).toThrow('valgte kullet')
  })
  it('preserves uncertain calendar period, explicit period and elective alternatives', () => {
    const plan = parseNlaPlan(script('StudieplanPage', props), source, '2026'), periods = plan.models[0].periods
    expect(plan.program.campuses).toEqual(['Bergen'])
    expect(periods[0]).toMatchObject({ year: null, semester: null, studySemester: 1 })
    expect(periods[0].courses[0].choice).toBe('')
    expect(periods[1]).toMatchObject({ year: 2027, semester: 'spring', studySemester: 2 })
    expect(periods[1].courses.map(course => course.choice)).toEqual(['V', 'V'])
    expect(periods[1].courses[0].credits).toBe(7.5)
    expect(periods[1].requirements).toContain('Velg retning selv.')
  })
  it('keeps unplaced courses as explicit unchecked candidates instead of inventing a semester', () => {
    const draft = structuredClone(props); draft.items[2026].accordions[0].content = '<table><tr><td>1.semester</td><td>A100</td></tr></table>'
    const plan = parseNlaPlan(script('StudieplanPage', draft), source, '2026')
    expect(plan.models[0].unplacedCourses.map(course => course.code)).toEqual(['B200', 'EX300'])
    expect(plan.models[0].unplacedCourses[0]).toMatchObject({ year: null, semester: null, choice: 'V' })
    expect(plan.completeness.complete).toBe(false)
  })
  it('rejects substituted programme/kull and source URLs outside published routes before fetching', async () => {
    const fetchText = vi.fn()
    await expect(nlaPrograms('nla', 'program-plan', { sourceUrl: source, program: 'WRONG' }, { fetchText })).rejects.toThrow('stemmer ikke')
    await expect(nlaPrograms('nla', 'program-plan', { sourceUrl: `${source}/2025`, cohort: '2026' }, { fetchText })).rejects.toThrow('stemmer ikke')
    await expect(nlaPrograms('nla', 'program-plan', { sourceUrl: 'https://localhost/' }, { fetchText })).rejects.toThrow()
    expect(fetchText).not.toHaveBeenCalled()
  })
})
