import { describe,it,expect,vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseNtnuProgramPlan,ntnuPrograms } from '../../server/providers/ntnu-programs.js'
import { parseCataloguePlan,cataloguePrograms } from '../../server/providers/catalogue-programs.js'
import { parseHvlPlan } from '../../server/providers/hvl-programs.js'
import { searchNtnu } from '../../server/providers/ntnu.js'
import { searchUib } from '../../server/providers/uib.js'
import { searchTimeEdit } from '../../server/providers/timeedit.js'
import { collectPages,restrictedUrl } from '../../server/providers/program-source.js'
import { institutions } from '../../src/institutions.js'
import { validProgramBinding } from '../../src/program-provenance.js'
import { mergeCourseOnly,validPlanner } from '../../src/planner.js'
const fixture = name=>readFileSync(new URL(`../fixtures/public-programs/${name}`,import.meta.url),'utf8')
const ntnuData=JSON.parse(fixture('ntnu-mtdt-2026.json'))
const ntnuQuery={program:'MTDT',cohort:'2026'}
const innUrl='https://studiekatalog.edutorium.no/inn/nb/program/BAPEDD/2026',dmmhUrl='https://studier.dmmh.no/nb/program/BEMNER/2026'
const query={q:'test',semester:'autumn',year:'2026',campus:''}
describe('public program contracts from captured source snapshots',()=>{
 it('keeps NTNU cohort separate from the published calendar and excludes plan requirements from courses',()=>{
  const data=parseNtnuProgramPlan(ntnuData,ntnuQuery,'https://www.ntnu.no/studier/studieplan')
  expect(data.program.cohort).toBe('2026');expect(data.models).toHaveLength(1)
  const periods=data.models[0].periods;expect(periods).toHaveLength(2);expect(periods.map(p=>[p.studySemester,p.year,p.semester])).toEqual([[1,2026,'autumn'],[2,2027,'spring']])
  expect(periods[0].courses).toHaveLength(5);expect(periods[0].courses.find(c=>c.code==='HMS0002').credits).toBe(0)
  expect(periods[0].courses.some(c=>c.code==='SIVINGPRA')).toBe(false);expect(periods[0].requirements.join(' ')).toContain('arbeidslivserfaring')
  expect(()=>parseNtnuProgramPlan(ntnuData,{...ntnuQuery,cohort:'2025'},'https://www.ntnu.no/studier/studieplan')).toThrow(/annen/)
 })
 it('keeps INN full-/part-time models, zero credits and unplaced course gaps',()=>{
  const data=parseCataloguePlan(fixture('inn-bapedd-2026.html'),{institution:'inn',query:{program:'BAPEDD',cohort:'2026'},sourceUrl:innUrl})
  expect(data.program.name).toContain('Bachelor i pedagogikk');expect(data.program.campuses).toEqual(['Lillehammer'])
  expect(data.models.map(m=>m.periods.length)).toEqual([6,11]);expect(data.models[0].periods[0].courses.find(c=>c.code==='KILDEKURS').credits).toBe(0)
  expect(data.models[0].periods[3].courses.every(c=>c.choice==='V')).toBe(true)
  expect(data.warnings.join(' ')).toContain('Ingen publisert semesterplassering');expect(data.warnings.join(' ')).toContain('2030')
 })
 it('preserves DMMH dash allocation and unspecified choice without inventing zero or obligation',()=>{
  const data=parseCataloguePlan(fixture('dmmh-bemner-2026.html'),{institution:'dmmh',query:{program:'BEMNER',cohort:'2026'},sourceUrl:dmmhUrl})
  const first=data.models[0].periods[0];expect(first.courses.find(c=>c.code==='BHFOR3510')).toMatchObject({credits:null,choice:'V',allocationText:'-'})
  expect(first.courses.find(c=>c.code==='VULEK6000').choice).toBe('');expect(data.program.name).toContain('emnestudier')
 })
 it('makes HVL branch-specific required courses explicit choices and preserves zero-credit courses',()=>{
  const url='https://www.hvl.no/studier/studieprogram/grunnskolelaerer-1-7-sogndal/2026h/utdanningsplan/',data=parseHvlPlan(fixture('hvl-glu-2026.html'),url)
  const first=data.models[0].periods.find(p=>p.studySemester===1)
  expect(first.courses.find(c=>c.code==='MGBPE101')).toMatchObject({choice:'O',credits:15,year:2026,semester:'autumn'})
  expect(first.courses.find(c=>c.code==='MGBKØ101')).toMatchObject({choice:'V'});expect(first.courses.some(c=>c.credits===0)).toBe(true)
  expect(first.requirements.join(' ')).toContain('Fag 1');expect(data.models[0].periods.some(p=>p.studySemester===10)).toBe(false)
 })
 it('rejects catalogue institution and cohort changes on redirects',async()=>{
  const fetchText=async(_url,_redirects,validate)=>{validate(new URL('https://studiekatalog.edutorium.no/inn/nb/program/BAPEDD/2025'));return fixture('inn-bapedd-2026.html')}
  await expect(cataloguePrograms('inn','program-plan',{program:'BAPEDD',cohort:'2026',sourceUrl:innUrl},{fetchText})).rejects.toMatchObject({status:'invalid-selection'})
  await expect(cataloguePrograms('inn','program-plan',{program:'BAPEDD',cohort:'2026',sourceUrl:dmmhUrl},{fetchText})).rejects.toMatchObject({status:'invalid-selection'})
 })
})
describe('bounded complete source lists',()=>{
 it('follows all NTNU published course pages with explicit completeness and no duplicate records',async()=>{
  const fetchText=vi.fn(async url=>{const page=+new URL(url).searchParams.get('pageNo');return JSON.stringify({courses:[{courseCode:`TEST${page}`,courseName:'test',courseUrl:`https://www.ntnu.no/test${page}`,location:'Trondheim'}],hasMoreResults:page<3})})
  const result=await searchNtnu(query,fetchText);expect(result.results).toHaveLength(3);expect(result.completeness).toMatchObject({complete:true,pages:3});expect(fetchText).toHaveBeenCalledTimes(3)
 })
 it('stops repeated NTNU pagination and labels a later failure without discarding earlier results',async()=>{
  const data={courses:[{courseCode:'TEST1',courseName:'test'}],hasMoreResults:true}
  const repeated=await searchNtnu(query,async()=>JSON.stringify(data));expect(repeated.truncated).toBe(true);expect(repeated.completeness.pages).toBe(1)
  let calls=0;const partial=await searchNtnu(query,async()=>{if(calls++)throw Error('HTTP 403');return JSON.stringify(data)});expect(partial.results).toHaveLength(1);expect(partial.completeness.complete).toBe(false)
 })
 it('follows a published UiB next-link and rejects changed search filters',async()=>{
  const page=code=>`<input name="keywords"><article class="card--study"><div class="card__title"><a href="/studier/emner/${code.toLowerCase()}">test</a></div><div class="card__meta"><div>${code}</div></div></article>`
  const result=await searchUib(query,async url=>new URL(url).searchParams.has('page')?page('INF102'):`${page('INF101')}<a rel="next" href="?keywords=test&page=1">Neste</a>`)
  expect(result.results.map(c=>c.code)).toEqual(['INF101','INF102']);expect(result.completeness).toMatchObject({pages:2,complete:true})
  await expect(searchUib(query,async()=>`${page('INF101')}<a rel="next" href="?keywords=other&page=1">Neste</a>`)).rejects.toMatchObject({status:'invalid-selection'})
 })
 it('does not call an ignored TimeEdit max parameter a complete list',async()=>{
  const html=Array.from({length:100},(_,i)=>`<div class="searchObject" data-id="${i}" data-name="TEST${i},2026 HØST"></div>`).join('')
  const fetchText=vi.fn(async()=>html),data=await searchTimeEdit('hvl',query,fetchText)
  expect(fetchText).toHaveBeenCalledTimes(2);expect(data.truncated).toBe(true)
 })
 it('bounds generic pagination, caches repeated public reads and rejects unrelated source hosts',async()=>{
  const validate=input=>restrictedUrl(input,{origin:'https://catalogue.test',paths:[/^\/program$/],keys:['page']}),fetchText=vi.fn(async url=>`<a rel="next" href="?page=${+(new URL(url).searchParams.get('page')||0)+1}">Next</a>`)
  const run=()=>collectPages('https://catalogue.test/program',fetchText,validate,(_$,url)=>({results:[{sourceUrl:url}]}),{maxPages:2})
  const result=await run();expect(result.completeness).toMatchObject({complete:false,pages:2,returned:2});await run();expect(fetchText).toHaveBeenCalledTimes(2)
  expect(()=>validate('https://evil.test/program')).toThrow()
 })
})
describe('national evidence and durable program provenance',()=>{
 it('has 49 individual datatype entries with dated scope and no blanket personal/Sikt access claim',()=>{
 expect(institutions).toHaveLength(49);for(const item of institutions){expect(Object.keys(item.datatypes)).toHaveLength(13);for(const value of Object.values(item.datatypes)){expect(value.status).toBeTruthy();expect(value.scope.length).toBeGreaterThan(20);expect(value.checkedAt).toBeTruthy();expect(value.url).toMatch(/^https:/)}}
  expect(institutions.find(i=>i.id==='dmmh').capabilities.personalTimetable).toBe('requires-institution-access');expect(institutions.find(i=>i.id==='uio').capabilities.nationalCatalogue).toBe('optional-sikt-route')
  for(const key of ['campus','groups','personalTimetable'])expect(institutions.filter(item=>item.datatypes[key].status==='Ikke undersøkt')).toEqual([])
  expect(institutions.find(i=>i.id==='nih').datatypes.publicTeaching.status).toBe('Ekte import verifisert')
  expect(institutions.find(i=>i.id==='himolde').datatypes.publicTeaching.status).toBe('Krever særskilt tilgang')
  expect(institutions.find(i=>i.id==='nmbu').capabilities.personalTimetable).toBe('no-suitable-anonymous-source')
 })
 it('preserves source binding, local notes and stable IDs through repeat import and validates bad provenance',()=>{
  const binding={institution:'ntnu',programCode:'MTDT',programName:'Datateknologi',cohort:'2026',modelId:'common',modelName:'Felles',studySemester:1,calendarYear:2026,calendarSemester:'autumn',campus:'Trondheim',choice:'O',sourceUrl:'https://www.ntnu.no/studier/studieplan',checkedAt:'2026-09-09T08:00:00Z'}
  const course={...parseNtnuProgramPlan(ntnuData,ntnuQuery,binding.sourceUrl).models[0].periods[0].courses[0],programBinding:binding}
  const first=mergeCourseOnly({courses:[],events:[],sources:[]},course);first.courses[0].notes='Lokale notater';const next=mergeCourseOnly(first,{...course,name:'Nytt navn'})
  expect(next.courses).toHaveLength(1);expect(next.courses[0]).toMatchObject({id:course.id,notes:'Lokale notater',programBinding:binding});expect(validPlanner(next)).toBe(true)
  expect(validProgramBinding({...binding,calendarSemester:'winter'})).toBe(false);next.courses[0].programBinding.cohort=null;expect(validPlanner(next)).toBe(false)
 })
})
