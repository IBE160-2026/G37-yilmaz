import {load,clean,fail,cachedText,restrictedUrl} from './program-source.js'
import {studentCohort,sourceEdition} from './current-program-source.js'
import {readPublicPdfItems} from './public-pdf-text.js'
const origin='https://gestalt.no'
export function gestaltProgramUrl(input){const url=new URL(input.href||input);if(url.origin==='https://www.gestalt.no')url.hostname='gestalt.no';return restrictedUrl(url,{origin,paths:[/^\/$/,/^\/gestalt(?:terapi-1|coaching)\/?$/,/^\/timeplaner%2[Ff]studieplan-(?:gt|co)\/?$/]})}
export const gestaltPdfUrl=input=>restrictedUrl(input,{origin:'https://img1.wsimg.com',paths:[/^\/blobby\/go\/[a-f\d-]{36}\/[^/]+\.pdf$/i]})
export function parseGestaltPlan(pages,{code,name,sourceUrl,cohort,campus}){
  const all=pages.map(p=>({page:p.page,text:clean(p.items.map(i=>i.str).join(' '))})),joined=all.map(p=>p.text).join(' '),courses=[]
  const compulsory=/Alle emnene er obligatoriske|(?:fire|to) obligatoriske emner/i.test(joined)
  for(let i=0;i<all.length;i++){
    const page=all[i],match=page.text.match(/Emnenavn:\s*(.+?)\s+Engelsk navn:\s*(.+?)\s+Studiepoeng:\s*(\d+(?:[.,]\d+)?)\s+Semester:\s*(\d{1,2}(?:\s+og\s+\d{1,2})?)\s+Undervisningsspr/i)
    if(!match)continue
    const semesters=match[4].match(/\d+/g).map(Number)
    if(semesters.some(n=>n<1||n>40)||semesters.length===2&&semesters[1]!==semesters[0]+1)fail('source-changed','Studieplanen har et ukjent semesterintervall.')
    const name=clean(match[1]),recordId=`semester-${semesters.join('-')}`,description=[]
    for(const later of all.slice(i)){if(later.page!==page.page&&/Emnenavn:/.test(later.text))break;description.push(later.text.replace(/^\d+\s+/,''))}
    courses.push({semesters,course:{id:`gestalt:${code}:${recordId}`,code:'',name,credits:+match[3].replace(',','.'),choice:compulsory?'O':'',sourceProvider:'gestalt',sourceRecordId:`${code}:${recordId}`,sourceVersion:'published-pdf',sourceUrl,university:'Norsk Gestaltinstitutt Høyskole',description:description.join('\n\n').slice(0,16000),notes:`PDF-side ${page.page}. Emnet går over studiesemester ${semesters.join(' og ')}. Studiepoeng gjelder hele emnet. Emnekode er ikke publisert.`,year:null,semester:null,campus:campus||'',requiresSemesterChoice:semesters.length!==1}})
  }
  if(!courses.length)fail('source-changed','Ingen emnebeskrivelser med publiserte navn, studiepoeng og semester kunne leses.')
  const seen=new Set(),periods=courses.map(({semesters,course})=>{if(seen.has(course.sourceRecordId))fail('source-changed','Studieplanen har flere uforenlige utgaver av samme emne.');seen.add(course.sourceRecordId);const id=semesters.join('-');return{id,studySemester:semesters.length===1?semesters[0]:null,...(semesters.length>1?{requiresStudentStudySemester:true,allowedStudySemesters:semesters}:{}),year:null,semester:null,label:`Studiesemester ${semesters.join(' og ')} · avklar kalender`,courses:[course],requirements:['Bestått foregående emne kan være et opptakskrav. Kildebeskrivelsen beholdes; ingen personlige oppgaveavhengigheter eller frister opprettes automatisk.']}})
  return{status:'ok',program:{code,name,cohort,cohortFromStudent:true,sourceUrl,sourceEdition:sourceEdition(joined),campuses:campus?[campus]:[]},models:[{id:'published-pdf',name:'Publisert studieplan med hele emner',periods}],warnings:['Planutgaven bekrefter ikke ditt opptakskull. Kull og kalendersemester oppgis av studenten; flersemesters emner beholder full studiepoengverdi.', 'Emnekoder er ikke publisert. Konkrete undervisningssamlinger er en egen timeplankilde og importeres ikke fra generelle opplysninger om samlingshyppighet.'],completeness:{complete:true,pages:pages.length,returned:courses.length,scope:'Alle lesbare emnebeskrivelser med eksplisitte studiepoeng og semester i valgt offentlig PDF.'}}
}
export async function gestaltPrograms(institution,action,query,{fetchText,fetchBytes}){
  const home=load(await cachedText(fetchText,origin+'/',gestaltProgramUrl)),programs=new Map()
  home('a[href]').each((_,a)=>{let url;try{url=gestaltProgramUrl(new URL(home(a).attr('href'),origin))}catch{return}if(!/^\/gestalt(?:terapi-1|coaching)\/?$/.test(url.pathname))return;const name=clean(home(a).text());if(!/^Gestalt/i.test(name))return;programs.set(url.pathname,{code:url.pathname.slice(1).replace(/\/$/,''),name,sourceUrl:url.href})})
  if(!programs.size)fail('source-changed','De publiserte studiepoenggivende utdanningene kunne ikke leses fra menyen.')
  if(action==='programs')return{status:'ok',results:[...programs.values()].filter(p=>p.name.toLocaleLowerCase('nb').includes(clean(query.q).toLocaleLowerCase('nb'))),warnings:['Listen omfatter de to publiserte studiepoenggivende gestaltutdanningene. Etterutdanninger uten publiserte studiepoeng er utelatt.'],completeness:{complete:true,pages:1,returned:programs.size,scope:'Publiserte terapi- og coachingutdanninger, ikke alle kurs/etterutdanninger.'}}
  const program=[...programs.values()].find(p=>p.code===query.program);if(!program)fail('invalid-selection','Velg en utdanning fra den publiserte menyen.')
  const page=load(await cachedText(fetchText,program.sourceUrl,gestaltProgramUrl)),text=clean(page('body').text())
  if(!/Studiepoeng\s+(?:60|120)/i.test(text))fail('not-supported','Programsiden bekrefter ikke et støttet studiepoenggivende tilbud.')
  const link=page('a[href]').filter((_,a)=>/Les studieplanen her/i.test(clean(page(a).text()))).first().attr('href');if(!link)fail('not-supported','Programmet mangler en publisert studieplanlenke.')
  const planPage=gestaltProgramUrl(new URL(link,program.sourceUrl)).href,plans=load(await cachedText(fetchText,planPage,gestaltProgramUrl)),urls=[]
  plans('a[href]').each((_,a)=>{let url;try{url=gestaltPdfUrl(new URL(plans(a).attr('href'),planPage))}catch{return}if(/studieplan/i.test(decodeURIComponent(url.pathname))&&!urls.includes(url.href))urls.push(url.href)})
  if(!urls.length)fail('not-supported','Plansiden publiserer ingen lesbar studieplan-PDF.')
  if(action==='program-cohorts')return{status:'ok',results:urls.map(sourceUrl=>({cohort:'current',label:`${decodeURIComponent(new URL(sourceUrl).pathname.split('/').at(-1)).replace(/\.pdf$/i,'')} · oppgi eget opptakskull`,sourceUrl,requiresStudentCohort:true})),warnings:['PDF-utgaven er ikke en kildebekreftelse på ditt opptakskull.']}
  if(action!=='program-plan')fail('not-supported','Handlingen støttes ikke.')
  const sourceUrl=gestaltPdfUrl(query.sourceUrl).href;if(!urls.includes(sourceUrl))fail('invalid-selection','Velg en PDF som er publisert for denne utdanningen.')
  return parseGestaltPlan(await readPublicPdfItems(fetchBytes,sourceUrl,gestaltPdfUrl),{...program,sourceUrl,cohort:studentCohort(query),campus:/Sandvika/.test(text)?'Sandvika':''})
}
