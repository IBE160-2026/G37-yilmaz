import {load,clean,fail,cachedText,restrictedUrl} from './program-source.js'
import {studentCohort,sourceEdition,unknownPeriod} from './current-program-source.js'
import {readPublicPdfItems} from './public-pdf-text.js'
const origin='https://hfy.no',catalogue=origin+'/'
export function hfyProgramUrl(input){const url=new URL(input.href||input);if(url.origin==='https://www.hfy.no')url.hostname='hfy.no';return restrictedUrl(url,{origin,paths:[/^\/$/,/^\/bachelor-i-[a-z-]+\/?$/]})}
export const hfyPdfUrl=input=>restrictedUrl(input,{origin:'https://s3-gustav.imgix.net',paths:[/^\/hfy\/[a-z\d-]+\.pdf$/]})
export function parseHfyModels(pages,{code,name,sourceUrl,edition}){
  const items=pages.flatMap(page=>page.items.filter(item=>clean(item.str)&&!(item.transform[5]>760&&/^\d+$/.test(clean(item.str)))).map(item=>({...item,page:page.page}))),starts=[]
  for(let i=0;i<items.length;i++)if(/Skjematisk gjennomføringsmodell/i.test(items[i].str)){const title=items.slice(i,i+8).map(x=>x.str).join(' '),mode=title.match(/\b(heltid|deltid)\b/i)?.[1]?.toLowerCase();if(mode&&!/\.{3}/.test(title)&&items.slice(i,i+8).some(x=>x.str==='Sem.'))starts.push({i,mode})}
  const models=[]
  for(const [index,start]of starts.entries()){
    let body=items.slice(start.i,starts[index+1]?.i||items.length),end=body.findIndex((item,i)=>i>3&&/Oversikt over emnene i studiet/i.test(item.str));if(end>=0)body=body.slice(0,end)
    const header=body.findIndex(item=>item.str==='Emnekode'),semHeader=body.find(item=>item.str==='Sem.'),creditsHeader=body.find(item=>item.str==='Ant. stp')
    if(header<0||!semHeader||!creditsHeader)continue
    const periods=new Map(),semX=semHeader.transform[4],creditX=creditsHeader.transform[4];let semester=null,row=null
    const finish=()=>{if(!row)return;if(!row.name.length||row.credits===null)fail('source-changed','HØFY-tabellen har en emnerad uten entydig navn eller studiepoeng.');const number=semester?.length===1?semester[0]:null,id=semester?.join('-');if(!id)fail('source-changed','HØFY-tabellen mangler eksplisitt semesterplassering.');let p=periods.get(id);if(!p){p=number?unknownPeriod(number):{id,studySemester:null,requiresStudentStudySemester:true,allowedStudySemesters:semester,year:null,semester:null,label:`${id}. studiesemester · velg faktisk semester`,courses:[],requirements:[]};periods.set(id,p)}p.courses.push({id:`hfy:${code}:${start.mode}:${id}:${row.code}`,code:row.code,name:clean(row.name.join(' ')),credits:row.credits,choice:'',sourceProvider:'hfy-program',sourceRecordId:row.code,sourceVersion:edition,sourceUrl,university:'Høyskolen for yrkesfag',year:null,semester:null,campus:'',description:'',notes:`Publisert ${start.mode}modell, PDF-side ${row.page}, semester ${id}. Studiepoeng i tabellen: ${row.credits}. Kull og kalendersemester må avklares.`,...(!number?{requiresSemesterChoice:true}:{})});row=null}
    for(const item of body.slice(header+1)){
      const text=clean(item.str),x=item.transform[4],term=text.match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/)
      if(Math.abs(x-semX)<25&&term){finish();const a=+term[1],b=+(term[2]||term[1]);if(a<1||b>40||b<a||b-a>3)fail('source-changed','Ugyldig semesterintervall i HØFY-planen.');semester=Array.from({length:b-a+1},(_,i)=>a+i);continue}
      const course=text.match(/^(BPL|ITB)\s*(\d{4})$/)
      if(course){finish();row={code:course[1]+course[2],name:[],credits:null,x,page:item.page};continue}
      if(!row)continue
      if(x>=creditX-10&&/^\d+(?:[.,]\d+)?$/.test(text)){if(row.credits!==null)fail('source-changed','Flere studiepoengverdier i samme HØFY-rad.');row.credits=+text.replace(',','.');continue}
      if(x>row.x+30&&x<creditX-10)row.name.push(text)
    }
    finish();if(periods.size)models.push({id:start.mode,name:start.mode==='heltid'?'Publisert heltidsmodell':'Publisert deltidsmodell',periods:[...periods.values()]})
  }
  if(!models.length||new Set(models.map(m=>m.id)).size!==models.length)fail('source-changed','PDF-planens modeller kunne ikke leses entydig.')
  const fullCredits=new Map(models.find(m=>m.id==='heltid')?.periods.flatMap(p=>p.courses).map(c=>[c.code,c.credits])||[])
  for(const course of models.flatMap(m=>m.periods.flatMap(p=>p.courses)))if(fullCredits.has(course.code)&&course.credits!==fullCredits.get(course.code)){course.notes+=` Dette er en del av emnets samlede ${fullCredits.get(course.code)} studiepoeng; full emneverdi beholdes.`;course.credits=fullCredits.get(course.code)}
  return models
}
export async function hfyPrograms(institution,action,query,{fetchText,fetchBytes}){
  const $=load(await cachedText(fetchText,catalogue,hfyProgramUrl)),rows=new Map()
  $('a[href]').each((_,a)=>{let url;try{url=hfyProgramUrl(new URL($(a).attr('href'),catalogue))}catch{return}const name=clean($(a).text());if(url.pathname.startsWith('/bachelor-i-')&&/^Bachelor/i.test(name))rows.set(url.href,{code:url.pathname.slice(1).replace(/\/$/,''),name,sourceUrl:url.href,campuses:[]})})
  if(!rows.size)fail('source-changed','HØFYs publiserte programoversikt kunne ikke leses.')
  if(action==='programs')return{status:'ok',results:[...rows.values()].filter(row=>row.name.toLocaleLowerCase('nb').includes(clean(query.q).toLocaleLowerCase('nb'))),warnings:[],completeness:{complete:true,pages:1,returned:rows.size,scope:'Alle bachelorlenker på den publiserte forsiden.'}}
  const selected=[...rows.values()].find(row=>row.code===query.program);if(!selected)fail('invalid-selection','Velg et publisert HØFY-program.')
  const html=await cachedText(fetchText,selected.sourceUrl,hfyProgramUrl),page=load(html),plans=[]
  page('a[href]').each((_,a)=>{let url;try{url=hfyPdfUrl(new URL(page(a).attr('href'),selected.sourceUrl))}catch{return}const label=clean(page(a).text());if(/generell.del|studieplan.bachelor/i.test(url.pathname)&&!plans.some(p=>p.sourceUrl===url.href))plans.push({cohort:'current',label:`${label||'Publisert PDF-plan'} · oppgi eget opptakskull`,sourceUrl:url.href,requiresStudentCohort:true})})
  if(!plans.length)fail('not-supported','Programmet har ingen støttet offentlig PDF-planlenke.')
  if(action==='program-cohorts')return{status:'ok',results:plans,warnings:['Planens publiseringsår er en kildeutgave, ikke bekreftelse på ditt opptakskull.']}
  if(action!=='program-plan')fail('not-supported','Handlingen støttes ikke.')
  const plan=plans.find(row=>row.sourceUrl===hfyPdfUrl(query.sourceUrl).href);if(!plan)fail('invalid-selection','Velg en PDF-plan lenket fra det valgte programmet.')
  const cohort=studentCohort(query),pages=await readPublicPdfItems(fetchBytes,plan.sourceUrl,hfyPdfUrl),edition='published-pdf',models=parseHfyModels(pages,{...selected,sourceUrl:plan.sourceUrl,edition})
  return{status:'ok',program:{...selected,sourceUrl:plan.sourceUrl,cohort,cohortFromStudent:true,sourceEdition:sourceEdition(JSON.stringify(pages))},models,warnings:['Heltid og deltid er separate publiserte modeller. Semesterintervaller krever eksplisitt plassering; de deles ikke opp i oppdiktede emner.', 'Opptakskull, kalendersemester, campus og obligatorisk status er ikke bekreftet av disse tabellene. Eventuell godskriving av tidligere fagskole må avklares av studenten.', 'Dette importerer studieplanens emnetabell. Klasseplanenes samlinger og arbeidskrav er egne kilder og blir ikke utledet fra programmodellen.'],completeness:{complete:true,pages:pages.length,returned:models.reduce((n,m)=>n+m.periods.reduce((n,p)=>n+p.courses.length,0),0),scope:'Publiserte heltid/deltid-emnetabeller i valgt PDF, ikke personlig tilpasset innfasingsløp.'}}
}
