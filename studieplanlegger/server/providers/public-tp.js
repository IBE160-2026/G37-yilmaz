import { createHash } from 'node:crypto'
import ICAL from 'ical.js'
import { load, clean, fail, cachedText } from './program-source.js'

// Institution guidance links to these public TP installations. Their published
// SPA specifies the semester/course GETs and iCalendar export below. The event
// JSON API returned 401; this adapter never requests it or starts a login.
export const publicTpInstitutions=['uit','uib','oslomet','nord','inn','uis','uio','uia','himolde','hiof']
const origin='https://tp.educloud.no',codePattern=/^[\p{L}\p{N}_./-]{1,120}$/u
const hash=text=>createHash('sha256').update(text).digest('hex')
const plain=text=>clean(load(String(text||''))('body').text())
const publicationWarnings=semester=>semester.not_ready?[`Kilden varsler at timeplanen kan være uferdig: ${plain(semester.not_ready_text?.nb||semester.not_ready_text?.no||semester.not_ready_text?.en)||'Kontroller kildens publiseringsstatus før du planlegger.'}`]:[]
const validDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day}
function checkedUrl(input,institution){let url;try{url=new URL(input.href||input)}catch{fail('invalid-selection','Velg en publisert TP-emnekalender.')}
  if(!publicTpInstitutions.includes(institution)||url.origin!==origin||url.username||url.password||url.hash||!new RegExp(`^/${institution}/(?:ws/services/semesters\\.php|ws/timeplan/info\\.php|timeplan/ical\\.php|app/schedule)$`).test(url.pathname)||[...url.searchParams.keys()].some(key=>!['type','sem','rkey','id[]','semester','scheduleType','course'].includes(key)||key!=='id[]'&&url.searchParams.getAll(key).length!==1))fail('invalid-selection','Kalenderlenken er utenfor denne offentlige TP-kilden.')
  return url
}
function same(input,expected,institution){const next=checkedUrl(input,institution);if(next.href!==expected.href)fail('source-changed','TP videresendte til et annet emne, tidsrom eller tilgangsområde.');return next}
async function json(fetchText,url,institution){const body=await cachedText(fetchText,url,input=>same(input,new URL(url),institution));let data;try{data=JSON.parse(body)}catch{fail('source-changed','TP returnerte ikke et lesbart offentlig kildeutvalg.')}if(!Array.isArray(data)||data.length>10000)fail('source-changed','TP-kildens komplette liste har endret format eller overskrider 10 000 oppføringer. Ingen skjult avkorting er brukt.');return data}
export function parseTpSemester(rows,query){
  if(!/^\d{4}$/.test(String(query.year))||+query.year<1900||+query.year>2200||!['spring','autumn'].includes(query.semester))fail('invalid-selection','Velg kalenderår og vår/høst før timeplansøket.')
  const selected=rows.filter(row=>row.year===+query.year&&row.season===(query.semester==='spring'?'SPRING':'AUTUMN'))
  if(!selected.length)fail('semester-unavailable','Den offentlige TP-kilden tilbyr ikke det valgte kalendersemesteret.')
  if(selected.length!==1||selected[0].id!==`${String(query.year).slice(-2)}${query.semester==='spring'?'v':'h'}`)fail('source-changed','TP-kildens kalenderår og semesteridentitet stemmer ikke overens.')
  const semester=selected[0]
  if(semester.publish_timetable!==true)fail('not-supported','TP oppgir at timeplanen for dette semesteret ikke er offentlig publisert. Ingen interne undervisningsdata hentes.')
  if(!validDate(semester.fromdate)||!validDate(semester.todate)||semester.fromdate>semester.todate||!Number.isSafeInteger(semester.random_int)||semester.random_int<0)fail('source-changed','TP mangler gyldige publiserte semestergrenser eller offentlig eksportverdi.')
  return semester
}
export function parseTpCourses(rows,semester,institution){
  const results=[],seen=new Set()
  for(const course of rows){if(!codePattern.test(course.id||'')||course.semesterid!==semester.id||!Array.isArray(course.term)||!course.term.length)fail('source-changed','Et emne i TP-listen mangler entydig emne-, termin- eller semesteridentitet.');const name=clean(course.nameNb||course.name||course.nameEn);if(!name||name.length>2000)fail('source-changed','TP-emnet mangler lesbart navn.')
    for(const term of course.term){if(!Number.isSafeInteger(term.term)||term.term<0||term.term>40)fail('source-changed','TP-emnets undervisningstermin har endret format.');const id=`${course.id}¤${term.term}`;if(seen.has(id))fail('source-changed','TP-katalogen gjentar samme emne og undervisningstermin.');seen.add(id);const sourceUrl=new URL(`${origin}/${institution}/app/schedule`);sourceUrl.search=new URLSearchParams({semester:semester.id,scheduleType:'course',course:id}).toString();results.push({id,sourceObjectId:id,code:course.id,name,label:`${course.id} · ${name} · kildens undervisningstermin ${term.term}${course.campusid?` · campuskode ${course.campusid}`:''}`,sourceUrl:sourceUrl.href,campus:course.campusid||'',term:term.term})}
  }
  return results
}
async function source(institution,query,fetchText){const semesters=await json(fetchText,`${origin}/${institution}/ws/services/semesters.php`,institution),semester=parseTpSemester(semesters,query),courses=await json(fetchText,`${origin}/${institution}/ws/timeplan/info.php?type=course&sem=${semester.id}`,institution),results=parseTpCourses(courses,semester,institution)
  return{semester,results,warnings:[...publicationWarnings(semester),'Velg faktisk emne og undervisningstermin. Kildens termin er ikke studiesemesteret i programmet; campuskoden og timeplanvalget bekrefter ikke personlig gruppetilhørighet.','Kilden kan vise emner uten publiserte aktiviteter. En tom kalender betyr ikke at semesteret er undervisningsfritt.'],completeness:{complete:true,pages:1,returned:courses.length,scope:'Hele emnelisten fra kildens offentlige semesterutvalg. Dette bekrefter ikke full undervisningsdekning eller personlig timeplan.'}}
}
function generatedUid(uid,event){
  // TP's observed PHP uniqid export uses an ordinal followed by 13 hexadecimal
  // digits. Confirm its encoded second against the source DTSTAMP, not shape
  // alone, before replacing it. Genuine stable source UIDs are retained.
  const match=String(uid||'').match(/^(\d+)([a-f\d]{13})$/i),stamp=event.getFirstPropertyValue('dtstamp')
  return!!(match&&stamp&&!stamp.isDate&&Math.abs(parseInt(match[2].slice(0,8),16)-stamp.toUnixTime())<=5)
}
export function normalizeTpCalendar(text,{institution,semester,selectedIds}){
  let calendar;try{calendar=new ICAL.Component(ICAL.parse(text))}catch{fail('source-changed','TP svarte uten en lesbar iCalendar-fil. Ingen kalender er importert.')}
  if(calendar.name!=='vcalendar')fail('source-changed','TP svarte uten en kalender.')
  const warnings=[],events=calendar.getAllSubcomponents('vevent'),seen=new Map(),scope=`${institution}:${semester.id}:${[...selectedIds].sort().join('|')}`;let fingerprints=0,omittedExams=0,hiddenRooms=0,pointAssessments=0
  if(events.length>10000)fail('source-changed','TP-kalenderen inneholder over 10 000 hendelser. Avgrens emneutvalget.')
  for(const event of events){const uid=event.getFirstPropertyValue('uid'),summary=clean(event.getFirstPropertyValue('summary')),start=event.getFirstPropertyValue('dtstart'),exam=/eksamen|examination|\bexam\b|mappevurdering|sluttvurdering|\bwiseflow\b|\binspera\b/i.test(summary)
    if(exam&&(semester.pubexdate!==true||semester.pubextime!==true)){calendar.removeSubcomponent(event);omittedExams++;continue}
    if(exam&&semester.pubexroom!==true){event.removeAllProperties('location');event.removeAllProperties('description');hiddenRooms++}
    if(exam)event.updatePropertyWithValue('x-studieplan-activity-kind','assessment')
    const end=event.getFirstPropertyValue('dtend')
    if(exam&&start&&end&&!start.isDate&&!end.isDate&&end.toUnixTime()-start.toUnixTime()===1){event.updatePropertyWithValue('transp','TRANSPARENT');pointAssessments++}
    if(!uid||!summary||!start)fail('source-changed','En TP-hendelse mangler identitet, navn eller tidspunkt. Kilden må avklares.')
    if(!generatedUid(uid,event))continue
    if(event.hasProperty('rrule')||event.hasProperty('recurrence-id'))fail('source-changed','TP kombinerer ustabil eksport-ID med gjentakende hendelser. Bruk et avklart kildeutvalg før import.')
    const key=hash(`${scope}\0${start.toString()}\0${start.zone?.tzid||''}\0${summary}`)
    if(seen.has(key))fail('ambiguous-source',`TP har flere hendelser med samme start og aktivitetsnavn («${summary}», ${start.toString()}) og ingen stabile kilde-ID-er. De er ikke slått sammen. Avklar et mer presist offentlig aktivitetsutvalg før import; tidligere kalender er beholdt.`)
    seen.set(key,true);event.updatePropertyWithValue('uid',`tp-occurrence-${key}@studieplan.local`);event.addPropertyWithValue('x-studieplan-original-uid',String(uid));fingerprints++
  }
  if(fingerprints)warnings.push('TP gir nye eksport-ID-er ved hver henting. Appen gjenkjenner gjentatt import med emnevalg, starttid og publisert aktivitetsnavn. Rom, beskrivelse og sluttid kan oppdateres. Ved endret starttid eller navn kan gammel og ny økt ikke kobles sikkert: begge beholdes for kontroll, og den gamle må fjernes uttrykkelig etter at flyttingen er avklart. Ingen personlig gruppe er utledet fra navnet.')
  if(omittedExams)warnings.push(`${omittedExams} eksamensoppføringer er utelatt fordi kilden ikke har publisert både dato og klokkeslett.`)
  if(hiddenRooms)warnings.push(`${hiddenRooms} eksamensoppføringer vises uten rom og beskrivelse fordi eksamensrom ikke er offentlig publisert.`)
  if(pointAssessments)warnings.push(`${pointAssessments} vurderingsoppføringer har bare ett sekunds varighet i kilden. De vises som informasjon uten å reservere studietid. Tidspunktet er ikke tolket som en bekreftet innleveringsfrist eller en undervisningsøkt.`)
  warnings.push(...publicationWarnings(semester),'TP-kildens fullstendighet er ukjent. Manglende aktiviteter fjerner ikke eksisterende undervisning. Kontroller tidsrom, campus og aktiviteter før bekreftelse.')
  calendar.updatePropertyWithValue('x-studieplan-tp-normalized','1')
  calendar.updatePropertyWithValue('x-studieplan-authoritative','false')
  calendar.removeAllProperties('x-studieplan-warning')
  for(const warning of warnings)calendar.addPropertyWithValue('x-studieplan-warning',warning)
  return{calendar:calendar.toString(),warnings,coverage:'unknown',authoritative:false,identityMode:fingerprints?'source-occurrence-fingerprint':'source-uid',unresolved:[]}
}
export function isPublicTpCalendarUrl(input){try{const url=new URL(input);return url.origin===origin&&url.searchParams.get('type')==='course'&&url.searchParams.has('id[]')&&[...url.searchParams.keys()].every(key=>['type','sem','rkey','id[]'].includes(key))&&publicTpInstitutions.some(id=>url.pathname===`/${id}/timeplan/ical.php`)}catch{return false}}
export async function fetchPublicTpCalendar(input,{fetchText}){
  const institution=new URL(input).pathname.split('/')[1],url=checkedUrl(input,institution),rawIds=url.searchParams.getAll('id[]'),sem=url.searchParams.get('sem')
  if(!isPublicTpCalendarUrl(url.href)||url.searchParams.get('type')!=='course'||!/^\d{2}[hv]$/.test(sem||'')||rawIds.length<1||rawIds.length>40||new Set(rawIds).size!==rawIds.length||rawIds.some(value=>{const parts=value.split(',');return parts.length!==2||!codePattern.test(parts[0])||!/^\d{1,2}$/.test(parts[1])}))fail('invalid-selection','Velg én offentlig emnekalender eller høyst 40 faktiske emne-/terminvalg fra TP. Personlige abonnementer hentes ikke gjennom denne integrasjonen.')
  const semesters=await json(fetchText,`${origin}/${institution}/ws/services/semesters.php`,institution),matches=semesters.filter(row=>row.id===sem);if(matches.length!==1)fail('semester-unavailable','Kalendersemesteret finnes ikke i TP-kilden.');const semester=parseTpSemester(semesters,{year:matches[0].year,semester:matches[0].season==='SPRING'?'spring':'autumn'}),courses=await json(fetchText,`${origin}/${institution}/ws/timeplan/info.php?type=course&sem=${sem}`,institution),records=parseTpCourses(courses,semester,institution),selectedIds=rawIds.map(id=>id.replace(',','¤'))
  if(selectedIds.some(id=>!records.some(row=>row.id===id)))fail('invalid-selection','Kalenderen oppgir et emne eller en undervisningstermin som ikke er publisert for dette semesteret.')
  const requestUrl=new URL(`${origin}/${institution}/timeplan/ical.php`);requestUrl.search=new URLSearchParams({type:'course',sem,rkey:String(semester.random_int)}).toString();for(const id of rawIds)requestUrl.searchParams.append('id[]',id)
  const calendar=await cachedText(fetchText,requestUrl,input=>same(input,requestUrl,institution)),normalized=normalizeTpCalendar(calendar,{institution,semester,selectedIds})
  return{status:'ok',...normalized,calendarUrl:requestUrl.href,sourceUrl:url.href,publicationBoundaries:{start:semester.fromdate,end:semester.todate}}
}
export async function publicTp(institution,action,query,{fetchText}){
  if(!publicTpInstitutions.includes(institution)||!['teaching-search','teaching-calendar'].includes(action))fail('not-supported','Denne offentlige TP-handlingen er ikke implementert.')
  const q=clean(query.q);if(!q||q.length>120)fail('invalid-selection','Skriv en emnekode eller et emnenavn, høyst 120 tegn.')
  const data=await source(institution,query,fetchText),needle=q.toLocaleLowerCase('nb'),results=data.results.filter(row=>`${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(needle))
  if(action==='teaching-search')return{status:'ok',results,warnings:data.warnings,completeness:{...data.completeness,matched:results.length},publicationBoundaries:{start:data.semester.fromdate,end:data.semester.todate}}
  const selected=results.find(row=>row.id===query.sourceObjectId);if(!selected)fail('invalid-selection','Velg en faktisk emne-/terminoppføring fra det offentlige TP-søket.')
  const url=new URL(`${origin}/${institution}/timeplan/ical.php`);url.search=new URLSearchParams({type:'course',sem:data.semester.id,rkey:String(data.semester.random_int),'id[]':selected.id.replace('¤',',')}).toString()
  const result=await fetchPublicTpCalendar(url.href,{fetchText});return{...result,selected,sourceUrl:selected.sourceUrl,warnings:[...new Set([...data.warnings,...result.warnings])]}
}
