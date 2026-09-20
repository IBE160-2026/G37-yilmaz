import { readFileSync } from 'node:fs'
import { describe,it,expect,vi } from 'vitest'
import { parseOnhCatalogue,parseOnhPlan,onhPrograms,onhProgramUrl } from '../../server/providers/onh-programs.js'
const fixture = name => readFileSync(new URL(`../fixtures/public-programs/onh-${name}`,import.meta.url),'utf8')
const catalogue=fixture('catalogue.json'), bachelor=fixture('bachelor.html'), master=fixture('master.html')
const selected=code=>parseOnhCatalogue(catalogue).results.find(row=>row.officialCode===code&&row.campuses[0]==='Oslo')
describe('ONH published catalogue and explicit semester placement',()=>{
  it('reads all returned rows and distinguishes vocational and campus variants',()=>{
    const result=parseOnhCatalogue(catalogue)
    expect(result.total).toBe(187);expect(result.results).toHaveLength(157)
    const variants=result.results.filter(row=>row.officialCode==='91')
    expect(variants).toHaveLength(2);expect(new Set(variants.map(row=>row.code)).size).toBe(2)
    expect(()=>onhProgramUrl('https://oslonyehoyskole.no/min-side')).toThrow()
    expect(()=>onhProgramUrl('https://example.com/studier/master')).toThrow()
  })
  it('preserves published semesters and decimal credits without inventing mandatory status or dates',()=>{
    const plan=parseOnhPlan(bachelor,selected('91'),'2026'),model=plan.models[0]
    expect(model.periods.map(p=>p.courses.length)).toEqual([3,2,3,0,0,3])
    expect(model.periods[0]).toMatchObject({studySemester:1,year:null,semester:null})
    expect(model.periods[0].courses[1]).toMatchObject({code:'SIR1020',credits:7.5,choice:''})
    expect(model.periods[3].requirements).toHaveLength(1)
    expect(model.unplacedCourses).toHaveLength(21)
    expect(model.unplacedCourses.every(c=>c.requiresSemesterChoice&&c.choice==='')).toBe(true)
  })
  it('requires explicit semester choices within actual study-year bounds',()=>{
    const model=parseOnhPlan(master,selected('234'),'2026').models[0]
    expect(model.periods.map(p=>p.courses.length)).toEqual([6,1])
    expect(model.periods[0]).toMatchObject({studySemester:null,requiresStudentStudySemester:true,allowedStudySemesters:[1,2]})
    expect(model.periods[0].courses.every(c=>c.requiresSemesterChoice)).toBe(true)
    expect(model.unplacedCourses).toHaveLength(0)
  })
  it('keeps course identity stable across page revisions while changing source edition',()=>{
    const first=parseOnhPlan(bachelor,selected('91'),'2026'),next=parseOnhPlan(bachelor+'<!-- corrected page -->',selected('91'),'2026')
    expect(first.program.sourceEdition).not.toBe(next.program.sourceEdition)
    expect(first.models[0].periods[0].courses[0].sourceVersion).toBe(next.models[0].periods[0].courses[0].sourceVersion)
    expect(first.models[0].periods[0].courses[0].sourceVersion).toBe('published-current')
  })
  it('binds the plan to the published catalogue selection and explicit student cohort',async()=>{
    const row=selected('91'),fetchText=vi.fn(async(url,_depth,guard)=>{guard(url);return url.includes('/api/')?catalogue:bachelor}),query={program:row.code,sourceUrl:row.sourceUrl,cohort:'2026'}
    await expect(onhPrograms('onh','program-plan',query,{fetchText})).rejects.toThrow('opptakskull')
    const result=await onhPrograms('onh','program-plan',{...query,cohortFromStudent:'true'},{fetchText})
    expect(result.program).toMatchObject({cohort:'2026',cohortFromStudent:true})
    await expect(onhPrograms('onh','program-plan',{...query,sourceUrl:row.sourceUrl+'-unknown'},{fetchText})).rejects.toThrow('katalog')
  })
})
