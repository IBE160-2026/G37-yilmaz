import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {nhfhPrograms,parseNhfhPlan,nhfhProgramUrl} from '../../server/providers/nhfh-programs.js'
const fixture=JSON.parse(readFileSync(new URL('../fixtures/nhfh-programs.json',import.meta.url),'utf8'))
const context={code:'bachelor-i-medisin',cohort:2026,sourceUrl:'https://nhfh.no/bachelor-i-medisin/'}
describe('NHFH published course descriptions',()=>{
  it('reads the actual six semesters without borrowing menu names, course codes or dates',()=>{
    const plan=parseNhfhPlan(fixture.medicine,context),periods=plan.models[0].periods
    expect(periods.map(p=>p.studySemester)).toEqual([1,2,3,4,5,6])
    expect(periods[0].courses[0]).toMatchObject({name:'Anatomi og fysiologi',credits:30,code:'',choice:'',sourceVersion:'published-current'})
    expect(periods.every(p=>p.year===null&&p.semester===null)).toBe(true)
    expect(plan.program).toMatchObject({cohortFromStudent:true,campuses:['Oslo','Spania','Nett']})
    expect(parseNhfhPlan(fixture.nutrition,context).models[0].periods[5].courses).toHaveLength(1)
  })
  it('does not invent the three unnamed psychology courses or distribute total credits',()=>{
    const plan=parseNhfhPlan(fixture.psychology,context)
    expect(plan.completeness).toMatchObject({complete:false,total:5,returned:2})
    expect(plan.models[0].periods.flatMap(p=>p.courses).every(c=>c.credits===null)).toBe(true)
    expect(plan.models[0].periods[1]).toMatchObject({studySemester:null,requiresStudentStudySemester:true})
  })
  it('keeps explicitly named GE1/GE2 and a real 12-credit course without invented placement',()=>{
    const period=parseNhfhPlan(fixture.yearNutrition,context).models[0].periods[0]
    expect(period).toMatchObject({requiresStudentStudySemester:true,studySemester:null})
    expect(period.courses.map(c=>c.code)).toEqual(['GE1','GE2'])
    expect(period.courses.every(c=>c.requiresSemesterChoice&&c.credits===null)).toBe(true)
    expect(parseNhfhPlan(fixture.healthPsychology,context).models[0].periods[0].courses[0].credits).toBe(12)
  })
  it('lists published offerings and requires explicit student cohort',async()=>{
    const fetchText=async url=>url.endsWith('/studier/')?fixture.catalogue:fixture.medicine
    expect((await nhfhPrograms('nhfh','programs',{q:''},{fetchText})).results).toHaveLength(8)
    const cohorts=await nhfhPrograms('nhfh','program-cohorts',{program:context.code},{fetchText})
    expect(cohorts.results[0].requiresStudentCohort).toBe(true)
    await expect(nhfhPrograms('nhfh','program-plan',{program:context.code,cohort:2026},{fetchText})).rejects.toThrow()
    expect(()=>nhfhProgramUrl('https://nhfh.no/wp-admin/')).toThrow()
  })
})
