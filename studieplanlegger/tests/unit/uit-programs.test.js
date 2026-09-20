import { readFile } from 'node:fs/promises'
import { describe, it, expect, vi } from 'vitest'
import { parseUitProgramCatalogue, parseUitProgramStructure, uitPrograms } from '../../server/providers/uit-programs.js'
const fixture=name=>readFile(new URL(`../fixtures/uit-programs/${name}`,import.meta.url),'utf8')
const info=code=>({record:'279505',studyCode:code,name:code,sourceUrl:'https://uit.no/utdanning/program/279505/informatikk_datamaskinsystemer_-_bachelor',campuses:['Tromsø']})
const query={program:'UIT-279505',cohort:'2026',cohortFromStudent:'true'}

describe('UiT current public programme catalogue and dynamic structure components',()=>{
  it('reads all source cards and their separate campus/course types without treating catalogue IDs as degree codes',async()=>{
    const data=parseUitProgramCatalogue(await fixture('catalogue.html'))
    expect(data.results).toHaveLength(276)
    expect(data.results.find(row=>row.code==='UIT-279505')).toMatchObject({name:'Informatikk, datamaskinsystemer · bachelor, 3 år',campuses:['Tromsø']})
    expect(data.results.filter(row=>row.name.startsWith('Sykepleie'))).toHaveLength(3)
    expect(()=>parseUitProgramCatalogue('<main>No records</main>')).toThrow(/programkort/)
  })
  it('preserves real compulsory and optional source rows, unknown elective credits and explicitly chosen cohort/calendar term',async()=>{
    const html=await fixture('b-inf-component.html'),plan=parseUitProgramStructure([html],{...info('B-INF'),structureNotes:['Ti studiepoeng av valgemnene skal bestå av fire mikroemner.']},query)
    expect(plan.program).toMatchObject({cohort:'2026',cohortFromStudent:true,sourceCode:'B-INF'})
    expect(plan.completeness.returned).toBe(33)
    expect(plan.models[0].periods).toHaveLength(6)
    const first=plan.models[0].periods[0],third=plan.models[0].periods[2]
    expect(first.courses.map(course=>course.code)).toEqual(['INF-0101','INF-0103','MAT-0001','MAT-1005'])
    expect(first).toMatchObject({studySemester:1,year:null,semester:null})
    expect(first.courses.every(course=>course.choice==='O'&&course.sourceVersion==='current-public')).toBe(true)
    expect(third.courses.filter(course=>course.choice==='V')).toHaveLength(4)
    expect(third.courses.filter(course=>course.choice==='V').every(course=>course.credits===null)).toBe(true)
    expect(first.courses[0].notes).toContain('fire mikroemner')
    expect(()=>parseUitProgramStructure([html],info('B-INF'),{...query,cohortFromStudent:'false'})).toThrow(/Oppgi ditt eget kull/)
    const revised=parseUitProgramStructure([html.replace('Innføring i programmering','Endret emnenavn')],info('B-INF'),query)
    expect(revised.models[0].periods[0].courses[0].id).toBe(first.courses[0].id)
    expect(revised.program.sourceEdition).not.toBe(plan.program.sourceEdition)
  })
  it('reads all three actual master directions with separate models',async()=>{
    const plan=parseUitProgramStructure([await fixture('imat-inf-component.html')],info('IMAT-INF'),query)
    expect(plan.models.map(model=>model.name)).toEqual(['Cybersikkerhet','Medisinsk informatikk','Datamaskinsystemer'])
    expect(plan.models.every(model=>model.periods.length===10)).toBe(true)
    expect(plan.completeness.returned).toBe(52)
    expect(plan.models[0].periods[0].courses[0].id).toBe(plan.models[2].periods[0].courses[0].id)
  })
  it('expands real rowspan durations without doubling credits or marking elapsed semesters complete',async()=>{
    const html=await fixture('nursing-component.html'),plan=parseUitProgramStructure([html],info('B-SYKEPL'),query),[first,second]=plan.models[0].periods
    expect(first.courses.find(course=>course.code==='SYP-1121')).toMatchObject({credits:15})
    expect(second.courses.find(course=>course.code==='SYP-1121').id).toBe(first.courses[0].id)
    expect(second.courses.find(course=>course.code==='SYP-1121').credits).toBe(15)
    expect(()=>parseUitProgramStructure([html.replace('grid-row:1 / 3','grid-row:1 / 4')],info('B-SYKEPL'),query)).toThrow(/motstridende/)
  })
  it('reads the other public component layout and combines explicit split course credits across rows',async()=>{
    const plan=parseUitProgramStructure([await fixture('engineering-component.html')],info('B-IE'),query),periods=plan.models[0].periods
    expect(plan.models[0].id).toBe('B-IE:published')
    expect(plan.completeness.returned).toBe(35)
    for(const number of [2,3])expect(periods[number].courses.find(course=>course.code==='STE-2603').credits).toBe(10)
    expect(periods[4].courses.filter(course=>course.choice==='V')).toHaveLength(12)
    expect(periods[4].requirements.join(' ')).toContain('eksempler')
  })
  it('follows only the published target JSON and advertised component IDs, caching programme reads',async()=>{
    const paths=new Map([
      ['/go/target/279505/ABC','target.json'],
      ['/utdanning/program/279505/informatikk_datamaskinsystemer_-_bachelor','b-inf.html'],
      ['/utdanning/program/oppbygging?studkode=B-INF&p_document_id=279505','b-inf-structure.html'],
      ['/utdanning/program/oppbygging?studkode=B-INF&p_document_id=279505&ikbRender=ikb4','b-inf-component.html'],
      ['/utdanning/program/oppbygging?studkode=B-INF&p_document_id=279505&ikbRender=ikb5','empty-component.html'],
    ]),fetchText=vi.fn(async(input,_depth,guard)=>{const url=new URL(input);guard(url);const file=paths.get(url.pathname+url.search);if(!file)throw Error('Unpublished request');return fixture(file)}),selection={...query,sourceUrl:'https://uit.no/go/target/279505/ABC'}
    const cohorts=await uitPrograms('uit','program-cohorts',selection,{fetchText})
    expect(cohorts.results[0]).toMatchObject({cohort:'current',requiresStudentCohort:true})
    const plan=await uitPrograms('uit','program-plan',{...selection,sourceUrl:cohorts.results[0].sourceUrl},{fetchText})
    expect(fetchText).toHaveBeenCalledTimes(5)
    expect(plan.program.campuses).toEqual(['Tromsø'])
    expect(plan.models[0].periods[5].requirements.join(' ')).toContain('fire stk mikroemner')
    await expect(uitPrograms('uit','program-plan',{...selection,program:'UIT-1'},{fetchText})).rejects.toThrow(/stemmer ikke/)
    await expect(uitPrograms('uit','program-plan',{...selection,sourceUrl:'https://localhost/go/target/279505'},{fetchText})).rejects.toThrow(/utenfor/)
  })
  it('does not follow an arbitrary source target or execute content as code',async()=>{
    const fetchText=vi.fn(async()=>JSON.stringify({data:{URL:'https://uit.no/utdanning/program/100/another'},error:null}))
    await expect(uitPrograms('uit','program-cohorts',{...query,sourceUrl:'https://uit.no/go/target/279505/ABC'},{fetchText})).rejects.toThrow(/annet studieprogram/)
    expect(fetchText).toHaveBeenCalledTimes(1)
  })
})
