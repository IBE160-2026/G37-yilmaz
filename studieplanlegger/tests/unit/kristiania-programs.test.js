import { readFileSync } from 'node:fs'
import { describe,it,expect,vi } from 'vitest'
import { kristianiaProps,kristianiaPrograms,parseKristianiaPlan,kristianiaDetails,kristianiaProgramUrl } from '../../server/providers/kristiania-programs.js'
const fixture=name=>readFileSync(new URL(`../fixtures/public-programs/${name}`,import.meta.url),'utf8')
const catalogue=fixture('kristiania-catalogue.html'),page=fixture('kristiania-programming.html'),plan=JSON.parse(fixture('kristiania-programming-2025.json'))
const sourceUrl='https://www.kristiania.no/studieportal/fakultet-for-helse-og-teknologi/bachelorniva/2100/bachelor-i-informasjonsteknologi---programmering'
const query={program:'2100',cohort:'2025',sourceUrl:`${sourceUrl}?year=2025&period=fall`}
describe('Kristiania published programme JSON and exact source editions',()=>{
  it('reads inert props without executing scripts and rejects missing or ambiguous source contracts',()=>{
    expect(kristianiaProps(page,'getProgramUrl').code).toBe('2100')
    expect(()=>kristianiaProps('<script>globalThis.pwned=true</script>','getProgramUrl')).toThrow('mangler')
    expect(()=>kristianiaProps(page+page,'getProgramUrl')).toThrow('tvetydig')
    expect(()=>kristianiaProgramUrl('https://www.kristiania.no/min-side/')).toThrow()
    expect(()=>kristianiaProgramUrl(`${sourceUrl}?year=2025&year=2024`)).toThrow()
  })
  it('follows all source-result pages with the published Program filter and excludes vocational colleges',async()=>{
    const search=JSON.parse(fixture('kristiania-search.json'))
    const vocational={...search.items[0],name:'Fagskole',level:'Fagskolenivå',school:'Fagskolen Kristiania',url:'/studieportal/fagskolen-kristiania/fagskoleniva/test/fagskole'}
    const fetchText=vi.fn(async(url,_depth,guard)=>{guard(new URL(url));if(url.endsWith('/studieportal/'))return catalogue;const source=new URL(url);expect(source.searchParams.get('types')).toBe('Program');expect(source.searchParams.get('phrase')).toBe('informasjonsteknologi');return JSON.stringify({items:source.searchParams.get('skip')==='0'?search.items:[vocational],totalCount:11})})
    const result=await kristianiaPrograms('kristiania','programs',{q:'informasjonsteknologi'},{fetchText})
    expect(result.completeness).toMatchObject({complete:true,pages:2,returned:10,total:11})
    expect(result.results[0]).toMatchObject({code:'2100',campuses:['Oslo']})
    expect(fetchText).toHaveBeenCalledTimes(3)
  })
  it('preserves exact cohort identity, source semester numbering, unknown credits and unexpanded choices',async()=>{
    const fetchText=vi.fn(async(url,_depth,guard)=>{guard(new URL(url));return url.includes('/api/')?JSON.stringify(plan):page})
    const cohorts=await kristianiaPrograms('kristiania','program-cohorts',{program:'2100',sourceUrl},{fetchText})
    expect(cohorts.results.at(-1)).toMatchObject({cohort:'2025',intake:'autumn'})
    const result=await kristianiaPrograms('kristiania','program-plan',query,{fetchText})
    expect(result.models[0].periods.map(p=>p.studySemester)).toEqual([1,2,3,4,5,6])
    expect(result.models[0].periods[0]).toMatchObject({year:2025,semester:'autumn'})
    expect(result.models[0].periods[0].courses[0]).toMatchObject({code:'PGR102',credits:null,choice:''})
    expect(result.models[0].periods[3].courses).toHaveLength(0)
    expect(result.models[0].periods[3].requirements).toHaveLength(2)
    expect(result.models[0].periods[4]).toMatchObject({year:null,semester:'autumn'})
    expect(fetchText.mock.calls.at(-1)[0]).toBe('https://www.kristiania.no/api/syllabus-descriptions/programs/14472?year=2025&period=fall')
    await expect(kristianiaPrograms('kristiania','program-plan',{...query,cohort:'2024'},{fetchText})).rejects.toThrow('kullutgave')
  })
  it('rejects mismatched returned editions and does not treat inconsistent course periods as verified calendar data',()=>{
    const props=kristianiaProps(page,'getProgramUrl'),selected={year:2025,period:'fall',name:props.name,label:'2025'}
    expect(()=>parseKristianiaPlan({...plan,programSemesterStart:{year:2024,period:'fall'}},props,selected,query.sourceUrl)).toThrow('annen kullutgave')
    const bad=structuredClone(plan);bad.programDescription.subjectCombination[0].programSubjects[0].subjects[0].url=bad.programDescription.subjectCombination[0].programSubjects[0].subjects[0].url.replace('year=2025','year=2024')
    expect(parseKristianiaPlan(bad,props,selected,query.sourceUrl).models[0].periods[0].year).toBeNull()
  })
  it('reads the exact offered course description and refuses another code or unavailable period',async()=>{
    const fetchText=async(url,_depth,guard)=>{guard(new URL(url));return fixture('kristiania-pgr102-2025.html')}
    const courseQuery={code:'PGR102',year:'2025',semester:'autumn',sourceUrl:'https://www.kristiania.no/studieportal/fakultet-for-helse-og-teknologi/bachelorniva/pgr102/introduksjon-til-programmering?year=2025&period=Fall'}
    const result=await kristianiaDetails(courseQuery,fetchText)
    expect(result.course).toMatchObject({code:'PGR102',credits:7.5,year:2025,semester:'autumn'})
    expect(result.course.description).toContain('Læringsutbytte')
    expect(result.course.description).toContain('Obligatorisk aktivitet')
    await expect(kristianiaDetails({...courseQuery,code:'OTHER'},fetchText)).rejects.toThrow('annen emnekode')
    await expect(kristianiaDetails({...courseQuery,semester:'spring'},fetchText)).rejects.toThrow('periodevelger')
  })
})
