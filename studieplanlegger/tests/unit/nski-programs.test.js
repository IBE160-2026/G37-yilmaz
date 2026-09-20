import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {parseNskiPlan,nskiHtml,nskiProgramUrl} from '../../server/providers/nski-programs.js'
import {readPublicDriveMetadata,publicDriveDownloadGuard,publicDriveViewer} from '../../server/providers/public-drive-pdf.js'
const fixture=name=>JSON.parse(readFileSync(new URL(`../fixtures/nski-${name}.json`,import.meta.url),'utf8'))
const context={code:'bachelor-i-skuespillerfag',name:'Bachelor i skuespillerfag',cohort:2026,sourceUrl:'https://drive.google.com/file/d/1XkaDJCTM2dWZoSX2uW7wYJqzi5OW5SPb/view?usp=sharing'}
describe('NSKI public PDF study plans',()=>{
  for(const [name,count,annual]of [['acting',8,[6,5,7]],['directing',10,[9,7,5]],['writing',14,[9,11,9]],['musical',14,[12,12,11]]])it(`reads all actual ${name} courses and annual cells`,()=>{
    const plan=parseNskiPlan(fixture(name),context),periods=plan.models[0].periods,courses=[...new Map(periods.flatMap(p=>p.courses).map(c=>[c.id,c])).values()]
    expect(courses).toHaveLength(count);expect(courses.reduce((n,c)=>n+c.credits,0)).toBe(180)
    expect(periods.map(p=>p.courses.length)).toEqual(annual)
    expect(periods.map(p=>p.allowedStudySemesters)).toEqual([[1,2],[3,4],[5,6]])
    expect(periods.every(p=>p.requiresStudentStudySemester&&p.year===null&&p.semester===null)).toBe(true)
    expect(courses.every(c=>c.code===''&&c.requiresSemesterChoice&&c.sourceVersion==='published-pdf')).toBe(true)
  })
  it('fails on missing course metadata instead of claiming a complete plan',()=>{
    expect(()=>parseNskiPlan(fixture('acting').filter(p=>p.page!==16),context)).toThrow(/180/)
    const plan=parseNskiPlan(fixture('acting'),context),course=plan.models[0].periods[0].courses.find(c=>c.name==='Skuespillerteknikk')
    expect(course.credits).toBe(42);expect(course.notes).toContain('14 studiepoeng')
  })
  it('reads inert public page payloads and rejects arbitrary provider URLs',()=>{
    expect(nskiHtml(JSON.stringify({content:'<h1>Published</h1>'}))).toBe('<h1>Published</h1>')
    expect(()=>nskiHtml('{"other":1}')).toThrow();expect(()=>nskiProgramUrl('https://www.nski.no/private')).toThrow()
  })
  it('uses only the viewer-published download URL for the same public file',()=>{
    const id='1XkaDJCTM2dWZoSX2uW7wYJqzi5OW5SPb',download=`https://drive.usercontent.google.com/uc?id=${id}&export=download`
    const metadata=readPublicDriveMetadata('itemJson: '+JSON.stringify([null,'Study plan.pdf',download]),context.sourceUrl)
    expect(metadata.downloadUrl).toBe(download)
    expect(metadata.validateDownload(download.replace('/uc?','/download?')).href).toContain('/download?')
    expect(()=>publicDriveDownloadGuard(id)(download+'&authuser=0')).toThrow()
    expect(()=>publicDriveDownloadGuard(id)(download.replace(id,'someone-elses-file'))).toThrow()
    expect(()=>publicDriveViewer(context.sourceUrl.replace('/view','/edit'))).toThrow()
    expect(()=>readPublicDriveMetadata('Login required',context.sourceUrl)).toThrow()
  })
})
