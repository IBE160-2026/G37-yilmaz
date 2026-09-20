import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {parseHfyModels,hfyProgramUrl,hfyPdfUrl} from '../../server/providers/hfy-programs.js'
const fixture=name=>JSON.parse(readFileSync(new URL(`../fixtures/public-programs/hfy-${name}-table.json`,import.meta.url),'utf8'))
const selected={code:'bpl',name:'Bachelor',sourceUrl:'https://s3-gustav.imgix.net/hfy/plan.pdf',edition:'published-pdf'}
describe('HØFY PDF tables with merged semester cells',()=>{
  it('keeps full-time and part-time models and explicit semester bounds',()=>{
    const models=parseHfyModels(fixture('bpl'),selected)
    expect(models.map(m=>m.id)).toEqual(['heltid','deltid'])
    expect(models[0].periods.map(p=>p.courses.length)).toEqual([6,2,1,1,1])
    expect(models[0].periods[0]).toMatchObject({studySemester:null,requiresStudentStudySemester:true,allowedStudySemesters:[1,2],year:null,semester:null})
    expect(models[0].periods[2].courses[0]).toMatchObject({code:'BPL2009',credits:30,choice:''})
  })
  it('keeps whole-course credits when a part-time table distributes them across periods',()=>{
    const part=parseHfyModels(fixture('bpl'),selected)[1]
    const distributed=part.periods.flatMap(p=>p.courses).filter(c=>c.code==='BPL1005')
    expect(distributed).toHaveLength(2)
    for(const course of distributed){expect(course.credits).toBe(10);expect(course.notes).toContain('tabellen: 5');expect(course.notes).toContain('samlede 10')}
  })
  it('reads the second programme across a page boundary without treating page numbers as credits',()=>{
    const models=parseHfyModels(fixture('itb'),selected)
    expect(models[0].periods.map(p=>p.courses.length)).toEqual([6,3,1,1,1])
    expect(models[1].periods.map(p=>p.id)).toEqual(['1-2','3-4','5-6','7-8','9-10'])
    expect(models[1].periods.at(-1).courses[0].code).toBe('ITB3002')
  })
  it('rejects changed tables without semester metadata and unrelated sources',()=>{
    const pages=fixture('bpl');for(const page of pages)page.items=page.items.filter(item=>item.str!=='Sem.')
    expect(()=>parseHfyModels(pages,selected)).toThrow('modeller')
    expect(()=>hfyPdfUrl('https://s3-gustav.imgix.net/other/plan.pdf')).toThrow()
    expect(()=>hfyProgramUrl('https://hfy.no/for-studenter')).toThrow()
  })
})
