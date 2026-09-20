import{readFileSync}from'node:fs'
import{describe,it,expect}from'vitest'
import{parseOnhArchive,parseOnhPdf,onhPdfPlan,onhPdfUrl}from'../../server/providers/onh-pdf.js'
const fixture=key=>JSON.parse(readFileSync(new URL(`../fixtures/onh-pdf-${key}.json`,import.meta.url)))
const links=JSON.parse(readFileSync(new URL('../fixtures/onh-pdf-links.json',import.meta.url))),html=links.map(row=>`<a href="${row.sourceUrl}">${row.name}</a>`).join('')
function sample(key){const data=fixture(key),selected={code:`example-${key}`,name:data.selected.name.replace(/^Studieplan for /,'').replace(/ 2026\/2027$/,''),campuses:['Oslo']},edition=parseOnhArchive(html,selected).find(row=>row.sourceUrl===data.selected.sourceUrl);return{data,selected,edition,plan:parseOnhPdf(data.pages,selected,edition,'2026')}}
describe('actual source-linked ONH study-year PDF editions',()=>{
  it('offers actual published editions without presenting their year as a cohort',()=>{
    const {selected}=sample('sir'),rows=parseOnhArchive(html,selected)
    expect(rows.map(r=>r.academicYear)).toEqual(['2026/2027','2025/2026']);expect(rows.every(r=>r.requiresStudentCohort)).toBe(true)
    expect(parseOnhArchive(html,{name:'Bachelor in an unrelated subject'})).toEqual([])
    expect(()=>onhPdfUrl('https://s3.eu-west-1.amazonaws.com/private/file.pdf')).toThrow()
  })
  it('imports explicit course metadata, elective examples and six source semesters while leaving calendar unknown',()=>{
    const {plan}=sample('sir'),model=plan.models[0],first=model.periods.find(p=>p.studySemester===1)
    expect(plan.completeness.returned).toBe(33);expect(model.periods.map(p=>p.studySemester)).toEqual([1,2,3,4,5,6])
    expect(first.courses.map(c=>[c.code,c.credits,c.choice])).toEqual([['SIR1010',15,'O'],['SIR1020',7.5,'O'],['EXPHIL1010',7.5,'O']])
    expect(first.courses[0].notes).toContain('PDF-side 11');expect(first.courses[0].description).toContain('Læringsutbytte')
    expect(model.periods.find(p=>p.studySemester===4).courses.some(c=>c.code==='FK6020'&&c.choice==='V')).toBe(true)
    expect(model.periods.every(p=>p.year===null&&p.semester===null&&p.courses.every(c=>c.requiresSemesterChoice))).toBe(true)
    expect(plan.program.cohortFromStudent).toBe(true);expect(plan.completeness.complete).toBe(false)
  })
  it('keeps master thesis whole credits across semesters and requires explicit route choices',()=>{
    const {plan}=sample('master'),periods=plan.models[0].periods
    expect(plan.completeness.returned).toBe(10)
    for(const n of [3,4])expect(periods.find(p=>p.studySemester===n).courses.find(c=>c.code==='PSY5000')).toMatchObject({credits:60,requiresSemesterChoice:true})
  })
  it('reads the full 102-page psychology edition and exposes actual title conflicts',()=>{
    const {plan}=sample('psy');expect(plan.completeness.pages).toBe(102);expect(plan.completeness.returned).toBe(28)
    expect(plan.warnings.some(w=>w.includes('PSY6110')&&w.includes('avviker'))).toBe(true)
    expect(plan.models[0].periods.flatMap(p=>p.courses).find(c=>c.code==='PSY6010').name).toBe('Økonomisk psykologi')
  })
  it('retains metadata after source paragraphs, split codes and unknown elective placement',()=>{
    const economics=sample('economics').plan,nutrition=sample('nutrition').plan
    expect(economics.completeness.returned).toBe(20)
    expect(economics.models[0].periods.flatMap(p=>p.courses).find(c=>c.code==='ØKAD1130')).toMatchObject({name:'Organisasjon og ledelse',credits:7.5})
    expect(economics.models[0].periods.flatMap(p=>p.courses).some(c=>c.code==='ØKAD2240')).toBe(true)
    expect(nutrition.models[0].periods.find(p=>p.studySemester===5)).toBeTruthy()
    expect(nutrition.models[0].periods.flatMap(p=>p.courses).some(c=>c.code==='ERN6015'&&c.choice==='V')).toBe(true)
  })
  it('rejects a mismatching PDF year and an unlisted file before download',async()=>{
    const{data,selected,edition}=sample('sir')
    expect(()=>parseOnhPdf(data.pages,selected,{...edition,academicYear:'2030/2031'},'2026')).toThrow(/bekrefter ikke/)
    await expect(onhPdfPlan(selected,{sourceUrl:edition.sourceUrl.replace('.pdf','-other.pdf'),cohort:'2026',cohortFromStudent:'true'},{fetchText:async()=>html,fetchBytes:()=>{throw Error('must not fetch')}})).rejects.toThrow(/akkurat dette programmet/)
  })
  it('keeps semantic source identity when the PDF text is revised',()=>{
    const{data,selected,edition,plan}=sample('sir');data.pages[11].items.push({str:'Presisert kildetekst.',transform:[10,0,0,10,30,300]})
    const changed=parseOnhPdf(data.pages,selected,edition,'2026'),course=plan.models[0].periods[0].courses[0],updated=changed.models[0].periods[0].courses[0]
    expect(updated.id).toBe(course.id);expect(updated.sourceVersion).toBe('studyplan:2026/2027');expect(changed.program.sourceEdition).not.toBe(plan.program.sourceEdition)
  })
})
