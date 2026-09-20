import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parseSemesterTablePlan, semesterTablePrograms, semesterTableUrl } from '../../server/providers/semester-table-programs.js'
const fixture = name => readFileSync(new URL(`../fixtures/public-programs/${name}.html`, import.meta.url), 'utf8')
const query = (institution, program, year = '2026') => ({ program, cohort: year, sourceUrl: institution === 'hivolda' ? `https://www.hivolda.no/studieplaner/${year}/${program}/Haust` : `https://studiekatalog.edutorium.no/nuc/en/programme/${program}/${year}-autumn` })
describe('Published Volda and Noroff University College semester tables', () => {
  it('keeps actual Volda calendar terms and optional nested choices separate from requirement rows', () => {
    const plan = parseSemesterTablePlan(fixture('volda-animation-2026'), 'hivolda', query('hivolda', 'ANIBV'))
    const periods = plan.models[0].periods
    expect(plan.program).toMatchObject({ name: 'Animasjon - bachelor', cohort: '2026', intake: 'autumn' })
    expect(periods.map(p => [p.studySemester, p.year, p.semester])).toEqual([[1,2026,'autumn'],[2,2027,'spring'],[3,2027,'autumn'],[4,2028,'spring'],[5,2028,'autumn'],[6,2029,'spring']])
    expect(periods[0].courses.map(c => c.code)).toEqual(['ANI161','ANT161','ANFIG161'])
    expect(periods[0].courses.every(c => c.choice === '')).toBe(true)
    expect(periods[3].courses.find(c => c.code === 'FLM102').choice).toBe('V')
    expect(periods[3].requirements).toContain('Valemne (med atterhald om endringar): 10')
    expect(periods[4].courses[0].choice).toBe('')
    expect(periods[5].courses[0]).toMatchObject({ code:'ANI265', credits:30, year:2029, sourceVersion:'12617' })
  })
  it('retains teacher practice with unknown credits, mandatory parent and alternative specialization', () => {
    const plan = parseSemesterTablePlan(fixture('volda-teacher-2026'), 'hivolda', query('hivolda','MAGLU1-7'))
    const periods = plan.models[0].periods
    expect(periods).toHaveLength(10)
    expect(periods[0].courses.find(c => c.code === 'MGL1-7PR1')).toMatchObject({ choice:'O', credits:null })
    expect(periods[0].courses.find(c => c.code === 'MGL1-7KH1A').choice).toBe('V')
    expect(periods[4].courses.find(c => c.code === 'MGL1-7NO2A').choice).toBe('V')
    expect(periods[4].courses.find(c => c.code === 'MGL1-7MA2A').choice).toBe('V')
    expect(plan.warnings.some(w => w.includes('«*»'))).toBe(true)
  })
  it('imports NUC 2026 without falsely treating Shared/Core as an explicit mandatory flag', () => {
    const plan = parseSemesterTablePlan(fixture('noroff-cyber-2026'), 'noroff', query('noroff','BCYSE'))
    const periods = plan.models[0].periods
    expect(periods).toHaveLength(6)
    expect(periods[0].courses.map(c => c.code)).toEqual(['UC1AS105','UC1ICT05','UC1IPR10','UC1MA110'])
    expect(periods[0].courses[0]).toMatchObject({ credits:5, choice:'', sourceProvider:'noroff', sourceVersion:'2026-autumn' })
    expect(periods[5].courses.every(c => c.code !== 'EC05')).toBe(true)
    expect(periods.flatMap(p=>p.requirements).some(r => /Elective/i.test(r))).toBe(true)
  })
  it('resolves a Noroff semester table across the 2099 to 2100 century boundary', () => {
    const html = '<h1 id="page-title">Century programme</h1><table class="course-model"><thead><tr><th>Course</th><th>99 A</th><th>00 S</th></tr></thead><tbody><tr><td><a href="/nuc/en/course/TEST101/2100-spring">TEST101 Test course</a></td><td></td><td>10</td></tr></tbody></table>'
    const plan = parseSemesterTablePlan(html, 'noroff', query('noroff', 'CENTURY', '2099'))
    expect(plan.models[0].periods.map(period => [period.year, period.semester])).toEqual([[2099, 'autumn'], [2100, 'spring']])
    expect(plan.models[0].periods[1].courses[0].code).toBe('TEST101')
  })
  it('joins disjoint 2024 common/specialism blocks by calendar and retains a zero-credit allocation', () => {
    const plan = parseSemesterTablePlan(fixture('noroff-cyber-2024'), 'noroff', query('noroff','BCYSE','2024'))
    expect(plan.models).toHaveLength(1)
    const periods = plan.models[0].periods
    expect(periods.map(p=>p.studySemester)).toEqual([1,2,3,4,5,6])
    expect(periods[0].courses.find(c=>c.code==='UC1ST110')).toMatchObject({ credits:0, semester:'autumn' })
    expect(periods[1].courses.find(c=>c.code==='UC1ST110')).toMatchObject({ credits:10, semester:'spring', versionUncertain:true })
  })
  it('rejects changed columns, mismatched cohorts and cross-institution/fagskole URLs', () => {
    expect(()=>parseSemesterTablePlan(fixture('volda-animation-2026').replace('26 H','Uavklart'), 'hivolda', query('hivolda','ANIBV'))).toThrow(/semesterkolonne/)
    expect(()=>parseSemesterTablePlan(fixture('volda-animation-2026'), 'hivolda', {...query('hivolda','ANIBV'),cohort:'2025'})).toThrow(/samsvare/)
    for (const url of ['https://studiekatalog.edutorium.no/voc/en/programme/X/2026-autumn','https://evil.test/nuc/en/programme/X/2026-autumn','https://studiekatalog.edutorium.no/nuc/en/programme/X/2026-autumn?token=secret']) expect(()=>semesterTableUrl(url,'noroff')).toThrow()
  })
  it('reads only the publicly offered year and follows actual next links', async () => {
    const calls=[], fetchText=async url => { calls.push(url); if(url==='https://www.hivolda.no/studieplaner') return '<a href="/studieplaner/2026">2026</a>'; return '<main><a href="/studieplaner/2026/A/Haust">Autumn</a><a href="/studieplaner/2026/A/V%C3%A5r">Spring</a></main>' }
    const data=await semesterTablePrograms('hivolda','programs',{year:'2026'},{fetchText})
    expect(data.results).toHaveLength(2); expect(data.results.map(r=>r.intake)).toEqual(['autumn','spring'])
    const unavailable=await semesterTablePrograms('hivolda','programs',{year:'2027'},{fetchText})
    expect(unavailable.results).toEqual([]); expect(calls).toHaveLength(2)
  })
  it('keeps both NUC start terms, reports catalogue scope, and rejects redirect identity changes', async () => {
    const calls=[], fetchText=async (url,_depth,guard) => { calls.push(url); if(url.endsWith('/programme')) return '<select name="sem"><option value="2026-autumn">Autumn</option><option value="2026-spring">Spring</option></select>'; const intake=new URL(url).searchParams.get('sem'); return `<div id="content"><a href="/nuc/en/programme/A/${intake}">${intake}</a></div>` }
    const data=await semesterTablePrograms('noroff','programs',{year:'2026'},{fetchText})
    expect(data.results.map(r=>r.intake)).toEqual(['autumn','spring']); expect(data.completeness.returned).toBe(2)
    const redirected=async (_url,_depth,guard)=>{guard(new URL(query('noroff','OTHER').sourceUrl));return fixture('noroff-cyber-2026')}
    await expect(semesterTablePrograms('noroff','program-plan',query('noroff','BCYSE'),{fetchText:redirected})).rejects.toThrow(/annet program/)
  })
})
