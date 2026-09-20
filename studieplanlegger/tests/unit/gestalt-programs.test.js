import{readFileSync}from'node:fs'
import{describe,it,expect}from'vitest'
import{parseGestaltPlan,gestaltPdfUrl,gestaltProgramUrl}from'../../server/providers/gestalt-programs.js'
const fixture=name=>JSON.parse(readFileSync(new URL(`../fixtures/public-programs/gestalt-${name}.json`,import.meta.url),'utf8'))
const selected={code:'gestaltterapi-1',name:'Gestaltterapi',sourceUrl:'https://gestalt.no/plan.pdf',cohort:'2026'}
describe('Gestalt published PDF course metadata',()=>{
  it('keeps four full compulsory annual courses and explicit semester bounds',()=>{
    const plan=parseGestaltPlan(fixture('therapy'),selected)
    expect(plan.models[0].periods.map(p=>p.id)).toEqual(['1-2','3-4','5-6','7-8'])
    for(const period of plan.models[0].periods){expect(period.requiresStudentStudySemester).toBe(true);expect(period.studySemester).toBeNull();expect(period.courses[0]).toMatchObject({code:'',credits:30,choice:'O',requiresSemesterChoice:true,year:null,semester:null});expect(period.courses[0].description.length).toBeGreaterThan(1000)}
    expect(plan.program.cohortFromStudent).toBe(true)
  })
  it('supports the second accredited programme without importing unrelated continuing courses',()=>{
    const plan=parseGestaltPlan(fixture('coaching'),{...selected,code:'gestaltcoaching'})
    expect(plan.models[0].periods).toHaveLength(2)
    expect(plan.models[0].periods[1].allowedStudySemesters).toEqual([3,4])
  })
  it('does not turn theme lists into courses and keeps identity when source prose is revised',()=>{
    const pages=fixture('therapy'),before=parseGestaltPlan(pages,selected)
    pages[0].items.push({str:'Oppdatert administrativ informasjon'})
    const after=parseGestaltPlan(pages,selected)
    expect(before.program.sourceEdition).not.toBe(after.program.sourceEdition)
    expect(before.models[0].periods[0].courses[0].sourceRecordId).toBe(after.models[0].periods[0].courses[0].sourceRecordId)
    expect(()=>parseGestaltPlan([{page:1,items:[{str:'Gestaltterapi, teori og praktiske øvelser, 120 studiepoeng.'}]}],selected)).toThrow('emnebeskrivelser')
  })
  it('restricts published programme and PDF source locations',()=>{
    expect(()=>gestaltProgramUrl('https://gestalt.no/login')).toThrow()
    expect(()=>gestaltPdfUrl('https://example.com/plan.pdf')).toThrow()
    expect(()=>gestaltPdfUrl('https://img1.wsimg.com/private/plan.pdf')).toThrow()
  })
})
