import {load,clean,fail,cachedText,restrictedUrl} from './program-source.js'
import {studentCohort,sourceEdition} from './current-program-source.js'
import {readPublicPdfItems} from './public-pdf-text.js'
import {publicDriveViewer,publicDrivePdfMetadata} from './public-drive-pdf.js'
const origin='https://www.nski.no'
const programPath=/^\/(?:bachelor-i-[a-z-]+|scenekunstner-i-egenskapte-produksjoner)$/
export function nskiProgramUrl(input){const url=new URL(input.href||input);if(url.origin==='https://nski.no')url.hostname='www.nski.no';return restrictedUrl(url,{origin,paths:[/^\/studietilbud$/,programPath]})}
export function nskiHtml(raw){if(!raw.trimStart().startsWith('{'))return raw;let data;try{data=JSON.parse(raw)}catch{fail('source-changed','Studiesidens publiserte innhold kunne ikke leses.')}if(typeof data.content!=='string')fail('source-changed','Studiesiden mangler publisert innhold.');return data.content}
const normal=s=>clean(s).toLocaleLowerCase('nb').replace(/&/g,'og').replace(/[^a-zæøå\d]/g,'')
function lines(items){const result=[];for(const item of [...items].sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){let line=result.find(row=>Math.abs(row.y-item.transform[5])<2);if(!line){line={y:item.transform[5],items:[]};result.push(line)}line.items.push(item)}return result}
export function parseNskiPlan(pages,{code,name,sourceUrl,cohort}){
  // Coordinates restore reading order when a PDF places a continuation table
  // after the next course description in its internal text stream.
  const pageTexts=pages.map(p=>({page:p.page,text:lines(p.items).map(row=>clean(row.items.map(i=>i.str).join(' '))).join('\n')})),text=pageTexts.map(p=>p.text).join('\n')
  const headings=[...text.matchAll(/\b([2-6]\.\d+)\s+([^\d]{3,110}?)\s+(\d+)\s+studiepoeng\b/gi)].filter(m=>!/[.…]{3}/.test(m[2])),courses=[]
  for(const [i,match]of headings.entries()){
    if(match[1].endsWith('.0')&&headings.some(other=>other[1].startsWith(match[1].split('.')[0]+'.')&&!other[1].endsWith('.0')))continue
    if(courses.some(c=>c.section===match[1]))fail('source-changed','Flere motstridende fagbeskrivelser har samme kildeavsnitt.')
    const international=text.indexOf('7.0',match.index),end=headings[i+1]?.index??(international>match.index?international:text.length)
    courses.push({section:match[1],name:clean(match[2]),credits:+match[3],description:text.slice(match.index,end).slice(0,16000),annual:new Map()})
  }
  if(!courses.length||courses.reduce((n,c)=>n+c.credits,0)!==180)fail('source-changed','De navngitte bachelorfagenes studiepoeng kan ikke avstemmes mot den publiserte 180-poengsplanen.')
  let active=false,columns=null,done=false
  for(const page of pages){
    const rows=lines(page.items),full=rows.map(r=>r.items.map(i=>i.str).join(' ')).join(' ')
    if(!active&&/Studiepoeng\s+fordelt\s+på\s+fag\s+og\s+studieår/i.test(full))active=true
    if(!active||done)continue
    const header=rows.find(r=>r.items.filter(i=>/^STUDIEPOENG$/i.test(i.str)).length===4)
    if(header)columns=header.items.filter(i=>/^STUDIEPOENG$/i.test(i.str)).map(i=>i.transform[4]).sort((a,b)=>a-b)
    if(!columns)continue
    const numericRows=[]
    for(const row of rows){if(header&&row.y>=header.y-2)continue;const cells=columns.map((x,index)=>row.items.filter(i=>i.transform[4]>=x-7&&i.transform[4]<(columns[index+1]??600)-7&&/^\d+$/.test(i.str)).map(i=>i.str).join(''))
      if(cells.every(c=>/^\d+$/.test(c))){const values=cells.map(Number);if(values.slice(0,3).reduce((n,v)=>n+v,0)===values[3])numericRows.push({...row,values})}}
    for(const [index,row]of numericRows.entries()){
      const nextY=numericRows[index+1]?.y??row.y-45,hasName=row.items.some(i=>i.transform[4]<columns[0]-7&&/[a-zæøå]/i.test(i.str)),left=rows.filter(r=>r.y<=row.y+(hasName?2:24)&&r.y>Math.max(nextY,row.y-45)).map(r=>clean(r.items.filter(i=>i.transform[4]<columns[0]-7).map(i=>i.str).join(' '))).filter(Boolean)
      if(left.some(s=>/^Totalt$/i.test(s))&&row.values[3]===180){done=true;break}
      const labels=left.flatMap((_,start)=>[1,2,3].map(count=>normal(left.slice(start,start+count).join(' '))))
      const matches=courses.filter(course=>course.credits===row.values[3]&&labels.some(label=>{const target=normal(course.name);if(label===target)return true;let n=0;while(n<Math.min(label.length,target.length)&&label[n]===target[n])n++;return n>=Math.min(12,target.length,label.length)&&Math.min(target.length,label.length)>=8}))
      if(matches.length!==1)continue
      for(let year=1;year<=3;year++)if(row.values[year-1]>0){const old=matches[0].annual.get(year);if(old&&old!==row.values[year-1])fail('source-changed','Årsfordelingen har motstridende studiepoeng for samme fag.');matches[0].annual.set(year,row.values[year-1])}
    }
  }
  const periods=[],unplaced=[],warnings=[]
  for(const group of headings.filter(m=>m[1].endsWith('.0'))){const children=courses.filter(c=>c.section.startsWith(group[1].split('.')[0]+'.')&&!c.section.endsWith('.0'));if(children.length&&children.reduce((sum,c)=>sum+c.credits,0)!==+group[3])warnings.push(`${clean(group[2])}: kildebeskrivelsen oppgir ${group[3]} studiepoeng for faggruppen, mens de navngitte fagene summerer til ${children.reduce((sum,c)=>sum+c.credits,0)}. Fagenes egne verdier er beholdt; kontroller kildeavviket.`)}
  for(const course of courses){
    const annualTotal=[...course.annual.values()].reduce((n,v)=>n+v,0)
    if(annualTotal!==course.credits){course.annual.clear();warnings.push(`${course.name}: hele faget er lest, men årsfordelingen kunne ikke avstemmes. Studiesemester må avklares uten kildebekreftet årsplassering.`)}
    const row={id:`nski:${code}:${course.section}`,code:'',name:course.name,credits:course.credits,choice:'',sourceProvider:'nski',sourceRecordId:`${code}:section-${course.section}`,sourceVersion:'published-pdf',sourceUrl,university:'NSKI Høyskole',year:null,semester:null,campus:'',description:course.description,requiresSemesterChoice:true,notes:'Emnekode er ikke publisert. Studiepoeng gjelder hele faget over alle oppgitte studieår.'}
    if(!course.annual.size){unplaced.push(row);continue}
    for(const [year,credits]of course.annual){let period=periods.find(p=>p.id===`year-${year}`);if(!period){period={id:`year-${year}`,label:`${year}. studieår · avklar studiesemester`,studySemester:null,requiresStudentStudySemester:true,allowedStudySemesters:[year*2-1,year*2],year:null,semester:null,courses:[],requirements:[]};periods.push(period)}period.courses.push({...row,notes:`${row.notes} Kilden fordeler ${credits} studiepoeng til dette studieåret.`})}
  }
  periods.sort((a,b)=>a.id.localeCompare(b.id));if(unplaced.length)periods.push({id:'unplaced',label:'Fag uten avklart årsplassering',studySemester:null,requiresStudentStudySemester:true,year:null,semester:null,courses:unplaced,requirements:[]})
  return{status:'ok',program:{code,name,cohort,cohortFromStudent:true,sourceUrl,sourceEdition:sourceEdition(text)},models:[{id:'published-pdf',name:'Publiserte fag og årsfordeling',periods}],warnings:[...warnings,'PDF-revisjon er ikke opptakskull. Kull, studiesemester og kalender avklares av studenten. Fag over flere år beholder full studiepoengverdi. Obligatorisk/valgfri status og konkret undervisning er ikke utledet fra generelle undervisningsformer.'],completeness:{complete:true,pages:pages.length,returned:courses.length,scope:'Alle navngitte fagbeskrivelser, avstemt mot bachelorens 180 studiepoeng. Årsplassering uten avstemming er uttrykkelig uavklart.'}}
}
export async function nskiPrograms(institution,action,query,{fetchText,fetchBytes}){
  const $=load(nskiHtml(await cachedText(fetchText,origin+'/studietilbud',nskiProgramUrl))),map=new Map()
  $('h3').each((_,node)=>{const name=clean($(node).text());let container=$(node);for(let depth=0;depth<5;depth++,container=container.parent()){const links=container.find('a[href]').map((_,a)=>$(a).attr('href')).get();let selected;for(const href of links){try{const url=nskiProgramUrl(new URL(href,origin));if(programPath.test(url.pathname)){selected=url;break}}catch{}}if(selected){map.set(selected.pathname,{code:selected.pathname.slice(1),name,sourceUrl:selected.href});break}}})
  if(!map.size)fail('source-changed','Den offentlige listen over studietilbud kunne ikke leses.')
  if(action==='programs')return{status:'ok',results:[...map.values()].filter(p=>p.name.toLocaleLowerCase('nb').includes(clean(query.q).toLocaleLowerCase('nb'))),completeness:{complete:true,pages:1,returned:map.size,scope:'Alle programkort på den publiserte tilbudssiden.'}}
  const program=[...map.values()].find(p=>p.code===query.program);if(!program)fail('invalid-selection','Velg et publisert studietilbud.')
  const page=load(nskiHtml(await cachedText(fetchText,program.sourceUrl,nskiProgramUrl))),plans=[]
  page('a[href]').filter((_,a)=>/studieplan/i.test(page(a).text())).each((_,a)=>{try{const url=publicDriveViewer(page(a).attr('href'));plans.push({sourceUrl:url.href,label:clean(page(a).text()),cohort:'current',requiresStudentCohort:true})}catch{}})
  if(!plans.length)fail('not-supported','Dette tilbudet har ingen publisert studieplan-PDF i den undersøkte programinngangen. Bruk et relevant studieplanutdrag.')
  if(action==='program-cohorts')return{status:'ok',results:plans.map(p=>({...p,label:`${p.label} · oppgi eget opptakskull`})),warnings:['Gjeldende offentlig PDF-lenke er ikke en kullbekreftelse.']}
  if(action!=='program-plan')fail('not-supported','Handlingen støttes ikke.')
  const selected=plans.find(p=>p.sourceUrl===query.sourceUrl);if(!selected)fail('invalid-selection','Velg studieplanen som er publisert for dette programmet.')
  const cohort=studentCohort(query),meta=await publicDrivePdfMetadata(selected.sourceUrl,fetchText)
  return parseNskiPlan(await readPublicPdfItems(fetchBytes,meta.downloadUrl,meta.validateDownload),{...program,sourceUrl:selected.sourceUrl,cohort})
}
