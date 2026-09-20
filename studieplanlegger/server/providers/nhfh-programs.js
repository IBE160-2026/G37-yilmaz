import {load,clean,fail,cachedText,restrictedUrl} from './program-source.js'
import {studentCohort,sourceEdition} from './current-program-source.js'
import {createHash} from 'node:crypto'
const origin='https://nhfh.no'
const programPath=/^\/(?:forside\/)?(?:arsstudium-i-[a-z-]+|halvarsstudium-i-[a-z-]+|bachelor-i-[a-z-]+|helsepsykologi-og-psykiske-lidelser)\/$/
export function nhfhProgramUrl(input){const url=new URL(input.href||input);if(url.origin==='https://www.nhfh.no')url.hostname='nhfh.no';return restrictedUrl(url,{origin,paths:[/^\/studier\/$/,programPath]})}
function availability(paragraphs){
  const periods=new Map(),notes=[]
  for(const paragraph of paragraphs){
    for(const marker of paragraph.matchAll(/Studiet tilbys ikke (?:i )?studieåret\s+/gi)){
      const range=paragraph.slice(marker.index+marker[0].length).match(/^(\d{4})\s*[/–-]\s*(\d{4}|\d{2})(?![\p{L}\p{N}/–-])/u)
      const start=Number(range?.[1]),end=range?.[2].length===2?start+1:Number(range?.[2])
      if(!range||start<1900||end>2200||end!==start+1||range[2].length===2&&Number(range[2])!==end%100)fail('source-changed','Kildens beskjed om at studiet ikke tilbys har et uklart studieår. Kontroller kildeutdraget i dokumentimport.')
      periods.set(`${start}:autumn`,{year:start,semester:'autumn'});periods.set(`${end}:spring`,{year:end,semester:'spring'})
      notes.push(`${marker[0]}${range[0]}`)
    }
  }
  return periods.size?{unavailableCalendarPeriods:[...periods.values()],sourceAvailabilityNote:[...new Set(notes)].join('. ')}:{}
}
export function parseNhfhPlan(html,{code,name,sourceUrl,cohort}){
  const $=load(html),title=clean($('h1').first().text()),tags=clean($('.tags').first().text()),paragraphs=$('main p').map((_,p)=>clean($(p).text())).get(),rows=[],warnings=[]
  if(!title||!tags.match(/\d+ studiepoeng/i))fail('source-changed','Studiesiden mangler publisert tittel eller studiepoenggivende omfang.')
  const available=availability(paragraphs)
  if(available.sourceAvailabilityNote)warnings.push(`Kildeopplysning: ${available.sourceAvailabilityNote}. Disse kalendersemestrene kan ikke importeres.`)
  const campuses=[...new Set((tags.match(/Oslo|Spania|Nett/g)||[]))],base={sourceProvider:'nhfh',sourceVersion:'published-current',sourceUrl,university:'Norges Høyskole for Helsefag',year:null,semester:null,campus:campuses.length===1?campuses[0]:'',...available,...(available.sourceAvailabilityNote?{notes:available.sourceAvailabilityNote}:{})}
  const add=(name,credits,studySemester,description,courseCode='')=>{
    // A semester can contain several named courses. Names identify these rows;
    // source order, credits and surrounding prose must not change their IDs.
    const nameKey=clean(name).normalize('NFC').toLocaleLowerCase('nb')
    const record=studySemester?`semester-${studySemester}:named-${createHash('sha256').update(nameKey).digest('hex').slice(0,32)}`:courseCode||`named-${nameKey}`
    const previous=rows.find(r=>r.course.sourceRecordId===`${code}:${record}`)
    if(previous){
      if(previous.course.name===name&&previous.course.credits===credits&&previous.course.description===description&&previous.course.code===courseCode)return
      fail('source-changed',`Kilden har flere ulike rader for «${name}» i samme semester uten entydig emneidentitet. Avklar radene i dokumentimport.`)
    }
    rows.push({studySemester,course:{...base,id:`nhfh:${code}:${record}`,sourceRecordId:`${code}:${record}`,code:courseCode,name,credits,choice:'',description,requiresSemesterChoice:!studySemester}})
  }
  $('main strong').each((_,node)=>{const heading=clean($(node).text()),m=heading.match(/^(\d{1,2})\.\s*semester:\s*(.+?)\s*\((\d+(?:[.,]\d+)?) studiepoeng\)$/i);if(m)add(clean(m[2]),+m[3].replace(',','.'),+m[1],clean($(node).parent().text()))})
  if(!rows.length){
    // These phrases identify actual courses; neighbouring subject areas are
    // deliberately not turned into invented courses or assigned equal credits.
    for(const paragraph of paragraphs){
      const paired=paragraph.match(/Studiet er delt i to hovedemner:\s*(.+?)\s*\(([^)]+)\)\s+og\s+(.+?)\s*\(([^)]+)\)\./i)
      if(paired){add(clean(paired[1]),null,null,paragraph,clean(paired[2]));add(clean(paired[3]),null,null,paragraph,clean(paired[4]))}
      const first=paragraph.match(/^I første semester starter du med emnet\s+(.+?)\./i);if(first)add(clean(first[1]),null,1,paragraph)
      const last=paragraph.match(/^Mot slutten av studiet følger emnet\s+([^,]+),/i);if(last)add(clean(last[1]),null,null,paragraph)
    }
    if(!rows.length&&(/Halvårsstudium/.test(tags)||paragraphs.some(p=>p.startsWith(`Emnet «${title}»`)))){
      const credits=Number(tags.match(/(\d+) studiepoeng/i)[1]),description=paragraphs.filter(p=>!/^\d+[ .]?\d* kr|Studieavgift/.test(p)).slice(0,12).join('\n\n')
      add(title.replace(/^Halvårsstudium i /i,''),credits,null,description)
    }
  }
  if(!rows.length)fail('not-supported','Programsiden gir ingen entydig navngitte emner. Bruk et konkret studieplanutdrag i dokumentimport.')
  const declared=paragraphs.join(' ').match(/består av (fem|\d+) emner/i),expected=declared?(declared[1]==='fem'?5:Number(declared[1])):rows.length,complete=expected===rows.length
  if(!complete)warnings.push(`Kilden oppgir ${expected} emner, men bare ${rows.length} er uttrykkelig navngitt som emner i den lesbare teksten. Øvrige fagtemaer er ikke gjort om til emner.`)
  if(rows.some(r=>r.course.credits===null))warnings.push('Studiepoeng for enkelte emner er ikke publisert. Programmets samlede studiepoeng er ikke fordelt ved antakelse.')
  const periods=[]
  for(const row of rows){const id=row.studySemester?String(row.studySemester):'unplaced';let period=periods.find(p=>p.id===id);if(!period){period={id,studySemester:row.studySemester,year:null,semester:null,label:row.studySemester?`Studiesemester ${row.studySemester} · avklar kalender`:'Navngitte emner · velg studiesemester',...(row.studySemester?{}:{requiresStudentStudySemester:true}),courses:[],requirements:[]};periods.push(period)}period.courses.push(row.course)}
  return{status:'ok',program:{code,name:title,cohort,cohortFromStudent:true,sourceUrl,sourceEdition:sourceEdition(html),campuses},models:[{id:'published-current',name:'Publisert emneoversikt',periods}],warnings:[...warnings,'Den gjeldende studiesiden er ikke kullversjonert. Opptakskull og kalendersemester avklares av studenten. Obligatorisk/valgfri status og konkrete undervisningstider er ikke antatt.'],completeness:{complete,pages:1,returned:rows.length,total:expected,scope:'Uttrykkelig navngitte emner i den valgte offentlige studiesidens semesterbeskrivelser.'}}
}
export async function nhfhPrograms(institution,action,query,{fetchText}){
  const $=load(await cachedText(fetchText,origin+'/studier/',nhfhProgramUrl)),map=new Map()
  $('a[href]').each((_,a)=>{let url;try{url=nhfhProgramUrl(new URL($(a).attr('href'),origin))}catch{return}if(!programPath.test(url.pathname))return;const name=clean($(a).text());if(!name)return;map.set(url.pathname,{code:url.pathname.slice(1,-1),name,sourceUrl:url.href})})
  if(!map.size)fail('source-changed','Den publiserte studiemenyen kunne ikke leses.')
  if(action==='programs')return{status:'ok',results:[...map.values()].filter(p=>p.name.toLocaleLowerCase('nb').includes(clean(query.q).toLocaleLowerCase('nb'))),warnings:['Listen omfatter tilbudene i den publiserte studiemenyen, inkludert årsstudier og enkeltemnet på 12 studiepoeng.'],completeness:{complete:true,pages:1,returned:map.size,scope:'Alle studieoppføringer med offentlige lenker i studiemenyen.'}}
  const program=[...map.values()].find(p=>p.code===query.program);if(!program)fail('invalid-selection','Velg et tilbud fra den publiserte studiemenyen.')
  if(action==='program-cohorts')return{status:'ok',results:[{cohort:'current',label:'Gjeldende studieside · oppgi eget opptakskull',sourceUrl:program.sourceUrl,requiresStudentCohort:true}],warnings:['Studiesiden er ikke publisert per opptakskull.']}
  if(action!=='program-plan')fail('not-supported','Handlingen støttes ikke.')
  if(query.sourceUrl&&nhfhProgramUrl(query.sourceUrl).href!==program.sourceUrl)fail('invalid-selection','Kildelenken tilhører ikke det valgte tilbudet.')
  return parseNhfhPlan(await cachedText(fetchText,program.sourceUrl,nhfhProgramUrl),{...program,cohort:studentCohort(query)})
}
