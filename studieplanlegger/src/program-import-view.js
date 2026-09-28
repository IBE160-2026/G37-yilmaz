import { institutions, institutionById } from './institutions.js'
import { emptyPlanner, mergeCourseOnly, mergeImport, resolveImportedCourse, validPlanner, semesterLabel, osloYear, sourceHref } from './planner.js'
import { parseCalendar } from './calendar-import.js'
import { disappearancePolicy, sourceCoverage, UNKNOWN_COVERAGE_WARNING } from './source-coverage.js'
import { exactTeachingObject, isProgrammeAdditionInScope, programmeAdditionScope, suggestedCommonSeries, teachingStatusLabel, validateProgrammeSelection } from './program-import-model.js'
import { checkedTeaching, teachingOutcome, teachingCheckText } from './teaching-check.js'

const PROGRAM_DRAFT_KEY='studieplanlegger:program-import-draft:v1'
const MAX_PROGRAM_DRAFT_BYTES=1_000_000
const PROGRAM_REQUEST_TIMEOUT_MS=10_000

const el = (tag,text) => { const node=document.createElement(tag); if(text!=null) node.textContent=text; return node }
const button = (text,action) => { const node=el('button',text); node.type='button'; node.onclick=action; return node }
const field = (label,input) => { const node=el('label',label);node.append(input);return node }
const select = (name,label) => { const node=el('select');node.name=name;node.setAttribute('aria-label',label);node.append(new Option(`Velg ${label.toLocaleLowerCase('nb')}`,''));return node }
const fill = (node, items, label) => { node.replaceChildren(new Option(`Velg ${label.toLocaleLowerCase('nb')}`,'')); for (const item of items) node.append(new Option(item.label,item.value)); node.value='' }
const link = (url,label) => { const href=sourceHref(url);if(!href)return el('span',`${label}: ${url}`);const node=el('a',label);node.href=href;node.target='_blank';node.rel='noreferrer';return node }
const localSnapshot = root => ({
  active: root.contains(document.activeElement) ? document.activeElement.dataset.importKey : null,
  open: [...root.querySelectorAll('details[data-import-key][open]')].map(node=>node.dataset.importKey),
  scroll: Object.fromEntries([...root.querySelectorAll('[data-import-scroll-key]')].map(node=>[node.dataset.importScrollKey,node.scrollTop])),
})
const restoreLocalSnapshot = (root,snapshot) => {
  if(!snapshot)return false
  for(const key of snapshot.open)root.querySelector(`details[data-import-key="${CSS.escape(key)}"]`)?.setAttribute('open','')
  for(const [key,top] of Object.entries(snapshot.scroll)){const node=root.querySelector(`[data-import-scroll-key="${CSS.escape(key)}"]`);if(node)node.scrollTop=top}
  const active=snapshot.active&&root.querySelector(`[data-import-key="${CSS.escape(snapshot.active)}"]`);active?.focus({preventScroll:true});return Boolean(active)
}
async function defaultApi(path,options) {
  const response=await fetch(path,options);let data
  try { data=await response.json() } catch { throw new Error('Importtjenesten er ikke tilgjengelig. Åpne appens lokale server; dokument og manuell registrering fungerer fortsatt.') }
  if(!response.ok) throw new Error(data.error || 'Kilden kunne ikke hentes.')
  return data
}
export function createProgramImportView({ host, getState, commitPlanner, feedback = ()=>{}, manual = ()=>{}, onSettled = ()=>{}, api=defaultApi }) {
  let controller=null, version=0, busy=false, activeLocalStatus=false, programs=[], cohorts=[], plan=null, preview=null, touched=false, addedCourses=[]
  const section=el('section');section.className='program-import';section.dataset.testid='program-import'
  const message=el('p');message.setAttribute('aria-live','polite')
  const institution=select('institution','Institusjon');for(const item of institutions) institution.append(new Option(item.name,item.id))
  const q=el('input');q.name='programQuery';q.maxLength=120;q.placeholder='Programnavn eller kode (valgfritt)'
  const year=el('input');year.name='catalogueYear';year.type='number';year.min='1900';year.max='2200';year.value=String(osloYear())
  const controls=el('div');controls.className='subject-fields'
  const sources=el('div'), results=el('div'), choices=el('div'), previewHost=el('section');previewHost.className='import-preview';previewHost.hidden=true
  const programSelect=select('program','Studieprogram'),cohortSelect=select('cohort','Opptakskull'),modelSelect=select('model','Studiemodell eller retning'),periodSelect=select('studySemester','Studiesemester'),calendarSelect=select('calendarSemester','Kalendersemester'),campusSelect=select('programCampus','Campus'),campusField=field('Campus',campusSelect)
  const studentCohort=el('input');studentCohort.name='studentCohort';studentCohort.type='number';studentCohort.min='1900';studentCohort.max='2200';const studentCohortField=field('Ditt opptakskull (oppgitt av deg, ikke verifisert i kilden)',studentCohort);studentCohortField.hidden=true
  const clarifiedYear=el('input');clarifiedYear.type='number';clarifiedYear.name='clarifiedYear';clarifiedYear.min='1900';clarifiedYear.max='2200'
  const clarifiedStudySemester=el('input');clarifiedStudySemester.type='number';clarifiedStudySemester.name='clarifiedStudySemester';clarifiedStudySemester.min='1';clarifiedStudySemester.max='40'
  const studySemesterClarification=field('Avklart studiesemester i ditt studieløp (oppgitt av deg)',clarifiedStudySemester);studySemesterClarification.hidden=true
  const clarifiedSemester=select('clarifiedSemester','Avklart kalendersemester');clarifiedSemester.append(new Option('Vår','spring'),new Option('Høst','autumn'))
  const clarification=el('div');clarification.hidden=true;clarification.append(el('p','Kilden oppgir ikke et entydig kalendersemester. Skriv året og velg semesteret fra din studieplan.'),field('Avklart kalenderår',clarifiedYear),field('Avklart kalendersemester',clarifiedSemester))
  const listButton=button('Hent studieprogram',()=>run(loadPrograms)), planButton=button('Hent studieplan',()=>run(loadPlan)), previewButton=button('Forhåndsvis valgte emner',()=>run(prepare,{localStatus:true,startText:'Forbereder valgte emner og kontrollerer undervisning …'}))
  const actionStatus=el('p');actionStatus.className='program-action-status';actionStatus.setAttribute('role','status');actionStatus.setAttribute('aria-live','polite');actionStatus.tabIndex=-1;actionStatus.hidden=true
  const cancel=button('Avbryt henting',()=>{version++;controller?.abort();controller=null;busy=false;setBusy();const text='Hentingen er avbrutt. Valgene og lagrede data er beholdt.';message.textContent=text;if(activeLocalStatus){actionStatus.hidden=false;actionStatus.classList.remove('is-error');actionStatus.textContent=text}activeLocalStatus=false})
  cancel.hidden=true
  controls.append(field('Institusjon',institution),field('Programnavn eller kode',q),field('Programlistens kull/år',year),listButton)
  results.append(field('Studieprogram',programSelect),field('Opptakskull',cohortSelect),studentCohortField,planButton);results.hidden=true
  choices.append(field('Studiemodell eller retning',modelSelect),field('Studiesemester i studieløpet',periodSelect),studySemesterClarification,field('Kalendersemester',calendarSelect),clarification,campusField);choices.hidden=true
  const courseChoices=el('fieldset');courseChoices.className='activity-choices'
  const missingCourse=el('details');missingCourse.className='program-missing-course';missingCourse.append(el('summary','Legg til et emne som mangler'))
  const missingHelp=el('p','Søk i samme lærested og periode. Hvis kilden ikke finner emnet, kan du legge inn en uverifisert post uten å miste programvalgene.')
  const missingQuery=el('input');missingQuery.maxLength=120;missingQuery.placeholder='Emnekode eller navn';missingQuery.setAttribute('aria-label','Søk etter manglende emne')
  const missingResults=el('div');missingResults.className='program-missing-results'
  const manualFields=el('div');manualFields.className='subject-fields'
  const manualCode=el('input');manualCode.maxLength=40;const manualName=el('input');manualName.maxLength=300;const manualCredits=el('input');manualCredits.type='number';manualCredits.min='0';manualCredits.step='any'
  manualFields.append(field('Emnekode',manualCode),field('Emnenavn',manualName),field('Studiepoeng (valgfritt)',manualCredits))
  missingCourse.append(missingHelp,missingQuery,button('Søk i valgt periode',()=>run(searchMissingCourse)),missingResults,el('p','Manuell reserve – merkes som uverifisert:'),manualFields,button('Legg til uverifisert emne',addManualCourse))
  choices.append(courseChoices,missingCourse,previewButton)
  const manualButton=button('Registrer manuelt',manual);manualButton.className='secondary'
  section.append(el('h3','Importer fra studieprogram'),el('p','Velg et publisert program, kull og semester. Se emnene og velg valgemner og undervisningsgrupper før du bekrefter.'),controls,sources,message,cancel,results,choices,actionStatus,previewHost,manualButton);host.append(section)
  const state = ()=> { const current=getState();return current.planner || (Array.isArray(current.courses)?current:emptyPlanner()) }
  const selectedProgram = ()=>programs[Number(programSelect.value)]
  const selectedCohort = ()=>cohorts[Number(cohortSelect.value)]
  const selectedModel = ()=>plan?.models.find(model=>model.id===modelSelect.value)
  const selectedPeriod = ()=>selectedModel()?.periods.find(period=>period.id===periodSelect.value)
  const activeAddedCourses = ()=>{const scope=programmeAdditionScope(modelSelect.value,periodSelect.value,selectedCalendarPeriod());return addedCourses.filter(course=>isProgrammeAdditionInScope(course,scope))}
  const candidateRows = ()=>[...(selectedPeriod()?.courses||[]),...(selectedModel()?.unplacedCourses||[]).map(course=>({...course,requiresSemesterChoice:true})),...activeAddedCourses()]
  const selectedCourseIds = ()=>new Set([
    ...[...courseChoices.querySelectorAll('input[type=checkbox][data-course-id]:checked')].map(input=>input.dataset.courseId),
    ...[...courseChoices.querySelectorAll('input[type=radio][data-course-ids]:checked')].flatMap(input=>JSON.parse(input.dataset.courseIds)),
  ])
  const selectionSnapshot = ()=>JSON.stringify([institution.value,q.value,year.value,programSelect.value,cohortSelect.value,studentCohort.value,modelSelect.value,periodSelect.value,calendarSelect.value,campusSelect.value,clarifiedYear.value,clarifiedStudySemester.value,clarifiedSemester.value,[...selectedCourseIds()].sort()])
  const teachingQuery = candidate=>candidate.teachingInput?.value ?? candidate.teachingQuery ?? (institution.value==='khio'?candidate.course.programBinding?.programCode:candidate.course.code) ?? ''
  const teachingSnapshot = candidate=>JSON.stringify([institution.value,candidate.course.year,candidate.course.semester,candidate.calendarUrl,teachingQuery(candidate),candidate.teachingChoice?.value ?? null,candidate.teachingChoice?.value === '' ? null : candidate.teachingResults?.[Number(candidate.teachingChoice?.value)]?.sourceObjectId ?? null,candidate.teachingObject?.sourceObjectId ?? null])
  const status = text=>{message.textContent=text;feedback(text)}
  function draftRecoveryUnavailable() {
    clearDraftStorage()
    const text='Utkastet kunne ikke lagres for gjenoppretting etter omlasting. Skjemaet du arbeider i er beholdt i denne visningen.'
    message.textContent=text;feedback(text,true)
  }
  function writeDraft() {
    let raw
    try {
      if(!institution.value)return
      raw=JSON.stringify({version:1,institution:institution.value,query:q.value,year:year.value,programs,cohorts,plan,addedCourses,values:{program:programSelect.value,cohort:cohortSelect.value,studentCohort:studentCohort.value,model:modelSelect.value,period:periodSelect.value,calendar:calendarSelect.value,campus:campusSelect.value,clarifiedYear:clarifiedYear.value,clarifiedStudySemester:clarifiedStudySemester.value,clarifiedSemester:clarifiedSemester.value},selectedCourseIds:[...selectedCourseIds()]})
    }catch{draftRecoveryUnavailable();return}
    if(new TextEncoder().encode(raw).byteLength>MAX_PROGRAM_DRAFT_BYTES){draftRecoveryUnavailable();return}
    try {sessionStorage.removeItem(PROGRAM_DRAFT_KEY);sessionStorage.setItem(PROGRAM_DRAFT_KEY,raw)}
    catch{draftRecoveryUnavailable()}
  }
  function clearDraftStorage(){try{sessionStorage.removeItem(PROGRAM_DRAFT_KEY)}catch{}}
  const setBusy = ()=>{ for(const input of section.querySelectorAll('input,select,button')) if(input!==cancel) input.disabled=busy; cancel.hidden=!busy; section.setAttribute('aria-busy',String(busy)) }
  const boundedSignal=()=>AbortSignal.any([controller?.signal||new AbortController().signal,AbortSignal.timeout(PROGRAM_REQUEST_TIMEOUT_MS)])
  async function boundedApi(path,options={}) {
    try{return await api(path,{...options,signal:boundedSignal()})}
    catch(error){if(error.name==='TimeoutError')throw new Error('Kilden svarte ikke innen 10 sekunder. Prøv operasjonen på nytt.');throw error}
  }
  async function request(action,query={}) {
    const data=await boundedApi(`/api/import/providers/${institution.value}/${action}?${new URLSearchParams(query)}`)
    if(data.status!=='ok') throw Object.assign(new Error(data.error || 'Kilden har ingen bekreftede treff for valget.'),{status:data.status})
    return data
  }
  async function run(work,{localStatus=false,startText=''}={}) {
    if(busy)return
    const focusKey=section.contains(document.activeElement)?document.activeElement.dataset.importKey:null
    busy=true;controller=new AbortController();const operation=++version;setBusy()
    activeLocalStatus=localStatus;if(localStatus){actionStatus.hidden=false;actionStatus.classList.remove('is-error');actionStatus.textContent=startText}
    try {await work(operation)} catch(error) {if(operation===version && error.name!=='AbortError') {const text=`${error.message} Lagrede data er beholdt.`;if(localStatus){actionStatus.textContent=text;actionStatus.classList.add('is-error')}else message.textContent=text;feedback(text,true)}}
    finally {if(operation===version){busy=false;activeLocalStatus=false;controller=null;setBusy();if(focusKey){const restored=previewHost.querySelector(`[data-import-key="${CSS.escape(focusKey)}"]`);const continuation=focusKey==='retry-failed'?previewHost.querySelector('[data-import-key="confirm-program"]'):null;(restored||continuation)?.focus({preventScroll:true})}onSettled()}}
  }
  function stopPending(){version++;controller?.abort();controller=null;busy=false;activeLocalStatus=false;setBusy()}
  function invalidatePlan(){stopPending();plan=null;preview=null;addedCourses=[];choices.hidden=true;previewHost.hidden=true;courseChoices.replaceChildren();missingResults.replaceChildren()}
  function clearPreview(){stopPending();preview=null;previewHost.hidden=true;actionStatus.hidden=true;touched=true;writeDraft()}
  function clearTeaching(candidate,stop=true){if(stop)stopPending();candidate.parsed=null;candidate.source=null;candidate.teachingSnapshot=null;candidate.teachingStatus='idle';candidate.teachingError='';candidate.teachingHost?.replaceChildren(el('p','Undervisningsvalget er endret. Hent ønsket timeplan og velg aktivitetene på nytt. Lagret undervisning er beholdt.'))}
  function showChoices(){controls.hidden=false;results.hidden=false;choices.hidden=false;sources.hidden=false}
  function coverage() {
    sources.replaceChildren();const item=institutionById(institution.value);if(!item)return
    const details=el('details');details.append(el('summary','Kilder og importdekning for institusjonen'))
    if(item.datatypes) for(const evidence of Object.values(item.datatypes)) {const line=el('p',`${evidence.label}: ${evidence.status}. ${evidence.scope} Kontrollert ${evidence.checkedAt || 'ikke datert'}.`);if(evidence.url)line.append(document.createTextNode(' '),link(evidence.url,'Kilde'));details.append(line)}
    else details.append(el('p','Se IMPORT-COVERAGE.md for daterte datatypebegrensninger. Institusjonslisten er ikke bevis på integrasjon.'))
    sources.append(details)
  }
  institution.onchange=()=>{touched=true;programs=[];cohorts=[];results.hidden=true;invalidatePlan();coverage();message.textContent='';writeDraft()}
  q.oninput=year.oninput=()=>{touched=true;programs=[];cohorts=[];results.hidden=true;invalidatePlan();writeDraft()}
  async function loadPrograms(operation) {
    if(!institution.value)throw new Error('Velg institusjon først.')
    if(!/^\d{4}$/.test(year.value)||+year.value<1900||+year.value>2200)throw new Error('Velg gyldig år for programlisten.')
    status('Henter publiserte program. Store lister kan ta litt tid; du kan avbryte.');plan=null;preview=null;choices.hidden=true;previewHost.hidden=true;courseChoices.replaceChildren()
    const snapshot=selectionSnapshot(),data=await request('programs',{q:q.value.trim(),year:year.value});if(operation!==version||snapshot!==selectionSnapshot())return
    programs=data.results || [];cohorts=[];fill(programSelect,programs.map((p,index)=>({value:String(index),label:`${p.code} · ${p.name}${p.level?` · ${p.level}`:''}${p.cohort?` · Kull ${p.cohort}`:''}${p.intake?` ${p.intake==='spring'?'vår':'høst'}`:''}`})),'Studieprogram');fill(cohortSelect,[],'Opptakskull');results.hidden=false
    writeDraft();status(`${programs.length} programtreff. ${data.completeness?.complete?'Hele kildeutvalget er hentet.':'Listen er ikke bekreftet fullstendig.'} ${(data.warnings || []).join(' ')}`);programSelect.focus()
  }
  programSelect.onchange=()=>{touched=true;cohorts=[];invalidatePlan();fill(cohortSelect,[],'Opptakskull');writeDraft();if(programSelect.value!=='')run(async(operation)=>{const selected=selectedProgram(),snapshot=selectionSnapshot(), data=await request('program-cohorts',{program:selected.code,sourceUrl:selected.sourceUrl});if(operation!==version||snapshot!==selectionSnapshot())return;cohorts=data.results || [];fill(cohortSelect,cohorts.map((c,index)=>({value:String(index),label:c.label || c.cohort})),'Opptakskull');writeDraft();status((data.warnings||[]).join(' ') || 'Velg ditt opptakskull.');cohortSelect.focus()})}
  cohortSelect.onchange=()=>{touched=true;invalidatePlan();studentCohortField.hidden=!selectedCohort()?.requiresStudentCohort;writeDraft()}
  studentCohort.oninput=()=>{touched=true;invalidatePlan();writeDraft()}
  async function loadPlan(operation) {
    if(programSelect.value===''||cohortSelect.value==='')throw new Error('Velg studieprogram og opptakskull.')
    const selected=selectedProgram(),cohort=selectedCohort();status('Henter den valgte studieplanen.')
    if(cohort.requiresStudentCohort&&(!/^\d{4}$/.test(studentCohort.value)||+studentCohort.value<1900||+studentCohort.value>2200))throw new Error('Oppgi ditt opptakskull. Kilden verifiserer bare planutgaven, ikke ditt kull.')
    const snapshot=selectionSnapshot(),data=await request('program-plan',{program:selected.code,cohort:cohort.requiresStudentCohort?studentCohort.value:cohort.cohort,sourceUrl:cohort.sourceUrl || selected.sourceUrl,...(cohort.requiresStudentCohort?{cohortFromStudent:'true'}:{}),...(cohort.historical?{historicalConfirmed:'true'}:{})});if(operation!==version||snapshot!==selectionSnapshot())return
    plan=data;plan.program.campuses=[...new Set([...(data.program.campuses||[]),...(selected.campuses||[])])];preview=null;previewHost.hidden=true
    fill(modelSelect,plan.models.map(model=>({value:model.id,label:model.name})),'Studiemodell eller retning');fill(periodSelect,[],'Studiesemester');fill(calendarSelect,[],'Kalendersemester')
    fill(campusSelect,plan.program.campuses.length?plan.program.campuses.map(campus=>({value:campus,label:campus})):[{value:'__unknown',label:'Campus er ikke oppgitt – behold ukjent'}],'Campus')
    campusField.hidden=!plan.program.campuses.length;if(campusField.hidden)campusSelect.value='__unknown'
    choices.hidden=false;courseChoices.replaceChildren();writeDraft();status((plan.warnings||[]).join(' '));modelSelect.focus()
  }
  modelSelect.onchange=()=>{clearPreview();missingResults.replaceChildren();courseChoices.replaceChildren();fill(periodSelect,(selectedModel()?.periods||[]).map(period=>({value:period.id,label:period.label})),'Studiesemester');fill(calendarSelect,[],'Kalendersemester')}
  periodSelect.onchange=()=>{clearPreview();renderCourseChoices();const period=selectedPeriod();const published=Boolean(period?.year&&period?.semester);fill(calendarSelect,published?[{value:`${period.year}:${period.semester}`,label:semesterLabel(period.semester,period.year)}]:[],'Kalendersemester');calendarSelect.parentElement.hidden=!published;clarification.hidden=published||!period;studySemesterClarification.hidden=!period?.requiresStudentStudySemester;clarifiedStudySemester.value='';clarifiedYear.value='';fill(clarifiedSemester,(period?.semester?[period.semester]:['spring','autumn']).map(value=>({value,label:value==='spring'?'Vår':'Høst'})),'Avklart kalendersemester')}
  calendarSelect.onchange=campusSelect.onchange=clarifiedYear.oninput=clarifiedSemester.onchange=clearPreview
  clarifiedStudySemester.oninput=()=>{const allowed=selectedPeriod()?.allowedCalendarPeriodsByStudySemester?.[clarifiedStudySemester.value];if(allowed){clarifiedYear.value=String(allowed.year);fill(clarifiedSemester,[{value:allowed.semester,label:allowed.semester==='spring'?'Vår':'Høst'}],'Avklart kalendersemester');clarifiedSemester.value=allowed.semester}clearPreview()}
  function selectedCalendarPeriod() {
    const period=selectedPeriod()
    if(period?.year&&period?.semester)return {year:period.year,semester:period.semester}
    return {year:Number(clarifiedYear.value),semester:clarifiedSemester.value}
  }
  function appendMissingCourse(row,evidence) {
    const calendar=selectedCalendarPeriod(),provider=institutionById(institution.value)
    if(!selectedPeriod()||!Number.isInteger(calendar.year)||!['spring','autumn'].includes(calendar.semester))throw new Error('Velg studieperiode og kalendersemester før du legger til et manglende emne.')
    const code=String(row.code||'').trim().toUpperCase(),name=String(row.name||row.label||'').trim()
    if(!name)throw new Error('Skriv et emnenavn.')
    if(code&&candidateRows().some(course=>String(course.code||'').trim().toUpperCase()===code))throw new Error(`Emnekoden ${code} finnes allerede i dette programutvalget.`)
    const credits=row.credits==null||row.credits===''?null:Number(row.credits)
    if(credits!==null&&(!Number.isFinite(credits)||credits<0))throw new Error('Studiepoeng må være et endelig tall som er null eller høyere, eller stå tomt.')
    const id=row.id||`student-added:${institution.value}:${calendar.year}:${calendar.semester}:${code||crypto.randomUUID()}`
    addedCourses.push({...row,id,code,name,university:row.university||provider?.name||institution.value,credits,...programmeAdditionScope(modelSelect.value,periodSelect.value,calendar),choice:'V',description:row.description||'',notes:row.notes||'',studentAdded:true,programmeEvidence:evidence,manualUnverified:evidence==='manual'})
    renderCourseChoices();const added=courseChoices.querySelector(`[data-course-id="${CSS.escape(id)}"]`);if(added){added.checked=true;added.focus()}clearPreview();writeDraft()
  }
  function addManualCourse() {
    try {appendMissingCourse({code:manualCode.value,name:manualName.value,credits:manualCredits.value},'manual');manualCode.value='';manualName.value='';manualCredits.value='';status('Det uverifiserte emnet er lagt til i utvalget. Kontroller navn og studiepoeng før bekreftelse.')}
    catch(error){status(error.message);feedback(error.message,true)}
  }
  async function searchMissingCourse(operation) {
    const query=missingQuery.value.trim(),calendar=selectedCalendarPeriod()
    if(!selectedPeriod()||!Number.isInteger(calendar.year)||!['spring','autumn'].includes(calendar.semester))throw new Error('Velg studieperiode og kalendersemester før du søker.')
    if(!query)throw new Error('Skriv en emnekode eller et navn.')
    const snapshot=selectionSnapshot(),data=await request('search',{q:query,year:String(calendar.year),semester:calendar.semester,...(campusSelect.value&&campusSelect.value!=='__unknown'?{campus:campusSelect.value}:{})})
    if(operation!==version||snapshot!==selectionSnapshot())return
    missingResults.replaceChildren()
    if(!(data.results||[]).length){missingResults.append(el('p','Ingen treff. Programvalgene er beholdt; bruk den manuelle reserven nedenfor.'));return}
    for(const result of data.results)missingResults.append(button(`${result.code||''} ${result.name||result.label||''}${result.campus?` · ${result.campus}`:''}`,()=>{try{appendMissingCourse(result,'course-search');status('Emnet er lagt til fra emnesøket.')}catch(error){status(error.message);feedback(error.message,true)}}))
  }
  function renderCourseChoices(restoredIds=null) {
    const selectedIds=restoredIds ? new Set(restoredIds) : selectedCourseIds()
    courseChoices.replaceChildren(el('legend','Emner i valgt studiesemester'));const period=selectedPeriod();if(!period)return
    for(const requirement of period.requirements||[])courseChoices.append(el('p',`Plankrav: ${typeof requirement==='string'?requirement:JSON.stringify(requirement)}`))
    if(!period.courses.length)courseChoices.append(el('p','Ingen emner er publisert for dette semesteret. Krav og tomme rader blir ikke gjort om til emner.'))
    const alternativeIds=new Set((period.alternativeGroups||[]).flatMap(group=>group.options.flatMap(option=>option.courseIds)))
    const rowsById=new Map(candidateRows().map(course=>[course.id,course]))
    for(const group of period.alternativeGroups||[]){const box=el('fieldset');box.className='programme-alternatives';box.append(el('legend',group.label),el('p',group.sourceRequirement||'Velg ett publisert alternativ. Ingen gren velges for deg.'));for(const option of group.options){const radio=el('input');radio.type='radio';radio.name=`alternative-${group.id}`;radio.value=option.id;radio.dataset.courseIds=JSON.stringify(option.courseIds);radio.checked=option.courseIds.every(id=>selectedIds.has(id));radio.onchange=()=>{clearPreview();updatePreviewLabel()};const row=field('',radio);row.className='programme-option';const copy=el('span');copy.className='programme-option-copy';copy.append(el('strong',`${option.label}${option.credits==null?'':` · ${option.credits} studiepoeng (informativt)`}`));for(const id of option.courseIds){const course=rowsById.get(id);if(course)copy.append(el('span',`${course.code} ${course.name}`))}row.append(copy);box.append(row)}courseChoices.append(box)}
    const requiredIds=new Set(period.requiredCourseIds||[])
    candidateRows().forEach((course,index)=>{if(alternativeIds.has(course.id))return;const check=el('input');check.type='checkbox';check.value=String(index);check.dataset.courseId=course.id;check.checked=selectedIds.has(course.id)||requiredIds.has(course.id)||(course.choice==='O'&&!course.requiresSemesterChoice);check.onchange=()=>{clearPreview();updatePreviewLabel()};const kind=course.studentAdded?(course.manualUnverified?'Uverifisert, manuelt lagt til':'Lagt til fra emnesøk – ikke programbevis'):requiredIds.has(course.id)?'Påkrevd i kilden':course.choice==='O'?'Obligatorisk':course.choice==='V'?'Valgemne':'Type ikke entydig – velg selv';courseChoices.append(field(`${course.code} ${course.name} · ${kind}${course.requiresSemesterChoice?' · Bekreft plassering i valgt semester':''} · ${course.credits??'Ukjente'} studiepoeng`,check));if(course.courseGroup)courseChoices.append(el('p',course.courseGroup));if(course.notes){const excerpt=el('details');excerpt.className='programme-source-excerpt';excerpt.append(el('summary','Vis kilde'),el('p',course.notes));courseChoices.append(excerpt)}})
    updatePreviewLabel()
  }
  function updatePreviewLabel(){const count=selectedCourseIds().size;previewButton.textContent=count?`Forbered og kontroller undervisning for ${count} emner`:'Velg emner';previewButton.setAttribute('aria-label','Forhåndsvis valgte emner')}
  async function prepare(operation) {
    const publishedPeriod=selectedPeriod(),model=selectedModel();if(!publishedPeriod||!campusSelect.value)throw new Error('Velg studiemodell, studiesemester, kalendersemester og campus eller ukjent campus.')
    const studySemesterFromStudent=Boolean(publishedPeriod.requiresStudentStudySemester)
    if(studySemesterFromStudent&&(!/^\d{1,2}$/.test(clarifiedStudySemester.value)||+clarifiedStudySemester.value<1||+clarifiedStudySemester.value>40))throw new Error('Oppgi hvilket studiesemester i ditt studieløp den valgte emnegruppen gjelder.')
    if(studySemesterFromStudent&&publishedPeriod.allowedStudySemesters&&!publishedPeriod.allowedStudySemesters.includes(+clarifiedStudySemester.value))throw new Error(`Velg et studiesemester innen kildens oppgitte studieår: ${publishedPeriod.allowedStudySemesters.join(' eller ')}.`)
    const published=Boolean(publishedPeriod.year&&publishedPeriod.semester)
    if(published&&calendarSelect.value!==`${publishedPeriod.year}:${publishedPeriod.semester}`)throw new Error('Velg kalendersemesteret som stemmer med valgt studieperiode.')
    if(!published&&(!/^\d{4}$/.test(clarifiedYear.value)||+clarifiedYear.value<1900||+clarifiedYear.value>2200||!clarifiedSemester.value))throw new Error('Avklar kalenderår og semester før forhåndsvisningen.')
    if(!published&&((publishedPeriod.year&&+clarifiedYear.value!==publishedPeriod.year)||(publishedPeriod.semester&&clarifiedSemester.value!==publishedPeriod.semester)))throw new Error('Avklaringen avviker fra kildens publiserte år eller semester.')
    const allowedCalendar=publishedPeriod.allowedCalendarPeriodsByStudySemester?.[clarifiedStudySemester.value]
    if(studySemesterFromStudent&&allowedCalendar&&(+clarifiedYear.value!==allowedCalendar.year||clarifiedSemester.value!==allowedCalendar.semester))throw new Error(`Kilden knytter ${clarifiedStudySemester.value}. studiesemester til ${allowedCalendar.semester==='spring'?'vår':'høst'} ${allowedCalendar.year}. Velg den publiserte perioden.`)
    const period={...publishedPeriod,...(!published?{year:+clarifiedYear.value,semester:clarifiedSemester.value}:{}),...(studySemesterFromStudent?{studySemester:+clarifiedStudySemester.value}:{})}
    const chosenIds=selectedCourseIds(),selectedRows=candidateRows().filter(row=>chosenIds.has(row.id));if(!selectedRows.length)throw new Error('Velg minst ett publisert emne.')
    if(selectedRows.length>40)throw new Error('Velg høyst 40 emner i én import.')
    validateProgrammeSelection(publishedPeriod,selectedRows)
    const selectedIds=new Set(selectedRows.map(course=>course.id));for(const requiredId of publishedPeriod.requiredCourseIds||[])if(!selectedIds.has(requiredId))throw new Error('Et emne som kilden oppgir som påkrevd, er valgt bort. Velg det igjen eller avbryt importen.')
    const selection=selectionSnapshot(),baseline=JSON.stringify(state()),candidates=[],warnings=[...(plan.warnings||[])];let next=structuredClone(state())
    for(let index=0;index<selectedRows.length;index++) {
      if(operation!==version)return
      const row=selectedRows[index],campus=campusSelect.value==='__unknown'?'':campusSelect.value
      if(row.allowedCalendarPeriods&&!row.allowedCalendarPeriods.some(value=>value.year===period.year&&value.semester===period.semester))throw new Error(`${row.code||row.name}: kilden publiserer ikke dette emnevalget for kalendersemesteret du har oppgitt. Velg en publisert periode eller utelat emnet.`)
      if(row.unavailableCalendarPeriods?.some(value=>value.year===period.year&&value.semester===period.semester))throw new Error(`${row.code||row.name}: kilden sier uttrykkelig at emnet ikke tilbys i dette kalendersemesteret. Velg et publisert tilbud eller utelat emnet.`)
      if(row.calendarPeriodBound){const bound=row.calendarPeriodBound,selected=period.year*2+(period.semester==='autumn'?1:0),limit=bound.year*2+(bound.semester==='autumn'?1:0);if(!['fra','til'].includes(bound.direction)||!Number.isInteger(bound.year)||!['spring','autumn'].includes(bound.semester)||(bound.direction==='fra'?selected<limit:selected>limit))throw new Error(`${row.code||row.name}: kalendersemesteret er utenfor denne kildeplanens publiserte gyldighetsperiode.`)}
      const rawSourceNotes=String(row.notes||''),sourceNotes=rawSourceNotes.slice(0,12000)
      if(rawSourceNotes.length>sourceNotes.length)warnings.push(`${row.code||row.name}: Kildens lange notat er forkortet før forhåndsvisning og lagring. Kontroller den publiserte kilden for resten.`)
      let course={...row,year:period.year,semester:period.semester,notes:sourceNotes,programBinding:{institution:institution.value,programCode:plan.program.code,programName:plan.program.name,cohort:String(plan.program.cohort),modelId:model.id,modelName:model.name,studySemester:period.studySemester,...(row.spansStudySemesters?{studySemesters:[...row.spansStudySemesters]}:{}),studySemesterClarifiedByStudent:studySemesterFromStudent||Boolean(row.requiresSemesterChoice),calendarYear:period.year,calendarSemester:period.semester,calendarClarifiedByStudent:!published,campus,choice:row.studentAdded?'student-added':row.choice||'',sourceNotes:row.studentAdded?`${row.manualUnverified?'Uverifisert manuelt emne':'Emne fra separat emnesøk'}; programkilden dokumenterer ikke at emnet inngår i planen. ${sourceNotes}`.trim():sourceNotes,sourceUrl:plan.program.sourceUrl,checkedAt:new Date().toISOString()}},calendarUrl=null
      if(!published||row.requiresSemesterChoice)course.id=`${row.id}:${period.year}:${period.semester}`
      if(plan.program.cohortFromStudent){course.programBinding.cohortFromStudent=true;course.programBinding.sourceEdition=plan.program.sourceEdition}
      actionStatus.textContent=`Forbereder ${index+1} av ${selectedRows.length}: ${course.code}.`
      if(['ntnu','kristiania','khio'].includes(institution.value)||['phs','samas'].includes(institution.value)&&row.sourceUrl&&!/\.pdf(?:[?#]|$)/i.test(row.sourceUrl)) {
        try {const detail=await request('details',{code:row.code,year:String(period.year),semester:period.semester,campus,...(['kristiania','khio','phs','samas'].includes(institution.value)?{sourceUrl:row.sourceUrl}:{})});if(operation!==version)return;course={...course,...detail.course,sourceProvider:course.sourceProvider,sourceRecordId:course.sourceRecordId,sourceVersion:course.sourceVersion,programBinding:course.programBinding};calendarUrl=detail.calendarUrl;warnings.push(...(detail.warnings||[]).map(text=>`${row.code}: ${text}`))}
        catch(error){if(operation!==version)return;warnings.push(`${row.code}: detaljkilden kunne ikke hentes (${error.message}). Publisert emnerad beholdes uten oppdiktet beskrivelse.`)}
      }
      course=resolveImportedCourse(next,course);next=mergeCourseOnly(next,course);candidates.push({course,calendarUrl,parsed:null,source:null,teachingStatus:'idle',teachingError:''})
    }
    if(operation!==version||selection!==selectionSnapshot())return
    preview={baseline,selection,candidates,warnings:[...new Set(warnings)]};writeDraft();renderPreview();actionStatus.textContent='Emnene er klare. Kontrollerer tilgjengelig undervisning …';await teaching(operation,false,true);if(operation===version&&preview)actionStatus.focus({preventScroll:true})
  }
  function applyTeachingCalendar(candidate,selected,data,parsed) {
    const saved=state().sources.find(source=>source.courseId===candidate.course.id&&source.kind==='url'&&source.url===data.calendarUrl)
    const existing=saved||(candidate.source?.kind==='url'&&candidate.source.url===data.calendarUrl?candidate.source:null)
    const allGroups=[...new Set(parsed.events.map(event=>event.group))],suggested=suggestedCommonSeries(parsed.events,data),known=existing?.allGroups||suggested,now=new Date().toISOString()
    candidate.course=checkedTeaching(candidate.course,parsed.events.length?'success':'empty',{eventCount:Number.isSafeInteger(data.eventCount)?data.eventCount:parsed.events.length,source:data.sourceKind||`${institution.value}-public-teaching`})
    candidate.parsed=parsed
    candidate.source={...existing,id:existing?.id||`program-timeedit:${candidate.course.id}:${selected.sourceObjectId}`,kind:'url',name:`${candidate.course.university} · ${selected.label}`,url:data.calendarUrl,courseId:candidate.course.id,groups:[...(existing?.groups||suggested)],excludedKeys:[...(existing?.excludedKeys||[])],allGroups:[...new Set([...(existing?.allGroups||[]),...allGroups])],commonGroups:[...(data.commonGroups||existing?.commonGroups||[])],pendingGroups:[...new Set([...(existing?.pendingGroups||[]),...allGroups.filter(group=>!known.includes(group))])],lastAttempt:now,lastUpdated:now,lastSuccess:now,identityMode:parsed.identityMode,autoRefresh:true}
    candidate.teachingStatus=parsed.events.length?'selection-required':'empty'
  }
  async function teaching(operation, failedOnly=false, automatic=false) {
    const current=preview;if(!current)return
    const pending=current.candidates.filter(item=>!item.parsed&&(!failedOnly||['failed','access-required'].includes(item.teachingStatus)))
    await Promise.all(pending.map(async candidate=>{
      if(failedOnly)current.warnings=current.warnings.filter(warning=>!warning.startsWith(`${candidate.course.code}: undervisning kunne ikke hentes (`))
      const snapshot=teachingSnapshot(candidate)
      candidate.teachingStatus='searching';candidate.teachingError=''
      try {
        if(candidate.calendarUrl){const data=await boundedApi('/api/import/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:candidate.calendarUrl})});if(operation!==version||preview!==current||snapshot!==teachingSnapshot(candidate)||current.selection!==selectionSnapshot())return
          const parsed=parseCalendar(data.calendar,{courseId:candidate.course.id,semester:candidate.course.semester,year:candidate.course.year}),existing=state().sources.find(s=>s.courseId===candidate.course.id&&s.kind==='url'&&s.url===candidate.calendarUrl),allGroups=[...new Set(parsed.events.map(event=>event.group))],suggested=suggestedCommonSeries(parsed.events,data),known=existing?.allGroups||suggested,now=new Date().toISOString()
          candidate.course=checkedTeaching(candidate.course,parsed.events.length?'success':'empty',{eventCount:Number.isSafeInteger(data.eventCount)?data.eventCount:parsed.events.length,source:data.sourceKind||'calendar'})
          candidate.parsed=parsed;candidate.teachingSnapshot=snapshot;candidate.source={...existing,id:existing?.id||`program-tp:${candidate.course.id}`,kind:'url',name:`${candidate.course.university} TP`,url:candidate.calendarUrl,courseId:candidate.course.id,groups:[...(existing?.groups||suggested)],excludedKeys:[...(existing?.excludedKeys||[])],allGroups:[...new Set([...(existing?.allGroups||[]),...allGroups])],commonGroups:[...(data.commonGroups||existing?.commonGroups||[])],pendingGroups:[...new Set([...(existing?.pendingGroups||[]),...allGroups.filter(group=>!known.includes(group))])],lastAttempt:now,lastUpdated:now,lastSuccess:now,identityMode:parsed.identityMode,autoRefresh:true};candidate.teachingStatus=parsed.events.length?'selection-required':'empty';current.warnings.push(...parsed.warnings)
          if(sourceCoverage(candidate.source,candidate.course).kind==='unknown')current.warnings.push(UNKNOWN_COVERAGE_WARNING)
        }else{
          const query=teachingQuery(candidate).trim();if(!query){candidate.teachingStatus='idle';candidate.teachingError='';return}
          const data=await request('teaching-search',{q:query,year:String(candidate.course.year),semester:candidate.course.semester});if(operation!==version||preview!==current||snapshot!==teachingSnapshot(candidate)||current.selection!==selectionSnapshot())return
          candidate.teachingQuery=query;candidate.teachingResults=data.results||[];candidate.teachingStatus=candidate.teachingResults.length?'available':'unavailable';current.warnings.push(...(data.warnings||[]))
          const selected=exactTeachingObject(candidate.teachingResults,candidate.course.code)
          if(selected){candidate.teachingObject=selected;const calendar=await request('teaching-calendar',{q:query,sourceObjectId:selected.sourceObjectId,year:String(candidate.course.year),semester:candidate.course.semester});if(operation!==version||preview!==current||current.selection!==selectionSnapshot())return;const parsed=parseCalendar(calendar.calendar,{courseId:candidate.course.id,semester:candidate.course.semester,year:candidate.course.year});applyTeachingCalendar(candidate,selected,calendar,parsed);candidate.teachingSnapshot=teachingSnapshot(candidate);current.warnings.push(...(calendar.warnings||[]),...parsed.warnings)}
        }
      } catch(error){if(operation!==version)return;const outcome=teachingOutcome(error);candidate.course=checkedTeaching(candidate.course,outcome,{source:candidate.calendarUrl?'calendar':`${institution.value}-public-teaching`});candidate.teachingStatus=outcome==='access-required'?'access-required':'failed';candidate.teachingError=error.message;current.warnings.push(`${candidate.course.code}: undervisning kunne ikke hentes (${error.message}). Emnet kan fortsatt lagres.`)}
    }))
    if(operation===version&&preview===current){renderPreview();const text='Undervisning er kontrollert per emne. Velg eventuelle timeplanobjekter og grupper; emnene kan lagres selv om undervisning er tom eller feilet.';message.textContent='';actionStatus.hidden=false;actionStatus.classList.remove('is-error');actionStatus.textContent=text}
  }
  async function searchTeaching(candidate, operation) {
    const current = preview
    if (!current) return
    const query = teachingQuery(candidate).trim(),snapshot=teachingSnapshot(candidate)
    if (!query || query.length > 120) throw new Error('Skriv en emnekode eller et navn på høyst 120 tegn for timeplansøket.')
    let data
    try{data = await request('teaching-search', { q: query, year: String(candidate.course.year), semester: candidate.course.semester })}
    catch(error){if(operation===version&&preview===current&&snapshot===teachingSnapshot(candidate)&&current.selection===selectionSnapshot()){const outcome=teachingOutcome(error);candidate.course=checkedTeaching(candidate.course,outcome,{source:`${institution.value}-public-teaching`});candidate.teachingStatus=outcome==='access-required'?'access-required':'failed';candidate.teachingError=error.message;renderPreview()}throw error}
    if (operation !== version || preview !== current || snapshot !== teachingSnapshot(candidate) || current.selection!==selectionSnapshot()) return
    candidate.parsed=null;candidate.source=null;candidate.teachingSnapshot=null
    candidate.teachingQuery = query
    candidate.teachingResults = data.results || []
    candidate.teachingStatus = candidate.teachingResults.length ? 'available' : 'unavailable'
    candidate.teachingObject = exactTeachingObject(candidate.teachingResults,candidate.course.code)
    current.warnings.push(...(data.warnings || []))
    renderPreview()
    status(candidate.teachingObject?`Ett eksakt kodetreff for ${candidate.course.code} er valgt. Kontroller varianten og eventuelle grupper.`:`${candidate.teachingResults.length} offentlige timeplanvalg for ${candidate.course.code}. Velg selv riktig emne, variant og eventuell gruppe; ingen tilhørighet er antatt.`)
  }
  async function loadTeachingSelection(candidate, operation) {
    const current = preview, query=teachingQuery(candidate).trim()
    if(query!==candidate.teachingQuery){clearTeaching(candidate,false);candidate.teachingQuery=teachingQuery(candidate);candidate.teachingResults=null;candidate.teachingObject=null;renderPreview();throw new Error('Timeplansøket er endret. Søk på nytt og velg riktig timeplanobjekt.')}
    if(candidate.teachingChoice)candidate.teachingObject=candidate.teachingChoice.value===''?null:candidate.teachingResults?.[Number(candidate.teachingChoice.value)]
    const selected = candidate.teachingObject,snapshot=teachingSnapshot(candidate)
    if (!current || !selected) throw new Error('Velg et publisert timeplanobjekt først.')
    let data
    try{data = await request('teaching-calendar', { q: query, sourceObjectId: selected.sourceObjectId, year: String(candidate.course.year), semester: candidate.course.semester })}
    catch(error){if(operation===version&&preview===current&&snapshot===teachingSnapshot(candidate)&&current.selection===selectionSnapshot()){const outcome=teachingOutcome(error);candidate.course=checkedTeaching(candidate.course,outcome,{source:`${institution.value}-public-teaching`});candidate.teachingStatus=outcome==='access-required'?'access-required':'failed';candidate.teachingError=error.message;renderPreview()}throw error}
    if (operation !== version || preview !== current || snapshot !== teachingSnapshot(candidate) || current.selection!==selectionSnapshot()) return
    const parsed = parseCalendar(data.calendar, { courseId: candidate.course.id, semester: candidate.course.semester, year: candidate.course.year })
    applyTeachingCalendar(candidate,selected,data,parsed)
    candidate.teachingSnapshot = teachingSnapshot(candidate)
    current.warnings.push(...(data.warnings || []), ...parsed.warnings, UNKNOWN_COVERAGE_WARNING)
    renderPreview()
    status('Timeplanen er hentet. Velg aktivitetene og eventuelle oppgitte grupper før samlet bekreftelse.')
  }
  const selectedTeachingEvents=(parsed,source)=>parsed?.events.filter(event=>source?.groups.includes(event.group)&&!source.excludedKeys.includes(event.sourceKey))||[]
  function teachingChoices(card, course, parsed, source, candidate) {
    if(!parsed.events.length){const notice=el('div');notice.setAttribute('role','status');notice.className='import-warning';notice.append(el('p','Ingen gyldige undervisningsøkter i valgt semester. Emnet kan lagres. Kontroller kilden eller registrer undervisning manuelt.'));for(const warning of parsed.warnings)notice.append(el('p',warning));card.append(notice);return}
    const missingGroups=parsed.events.some(event=>event.groupMissing),groups=[...new Set([...source.groups,...parsed.events.map(event=>event.group)])]
    const label=missingGroups?`Aktivitetsutvalg for ${course.code}`:`Undervisningsgrupper for ${course.code}`
    const details=el('details'),summary=el('summary'),groupChecks=new Map(),eventChecks=new Map();details.dataset.importKey=`groups:${course.id}`
    const selected=event=>source.groups.includes(event.group)&&!source.excludedKeys.includes(event.sourceKey)
    const refresh=()=>{const count=parsed.events.filter(selected).length;summary.textContent=`${label} · ${count} av ${parsed.events.length} økter valgt`;candidate.teachingStatus=count?'ready':'selection-required';if(candidate.teachingStateNode){candidate.teachingStateNode.textContent=`Undervisning: ${teachingStatusLabel(candidate.teachingStatus)}`;candidate.teachingStateNode.className=`teaching-status teaching-status-${candidate.teachingStatus}`}for(const [group,check] of groupChecks){const events=parsed.events.filter(event=>event.group===group),selectedCount=events.filter(selected).length;check.checked=events.length?selectedCount===events.length:source.groups.includes(group);check.indeterminate=selectedCount>0&&selectedCount<events.length}for(const [event,check]of eventChecks)check.checked=selected(event)}
    details.append(summary)
    if(missingGroups)details.append(el('p','Kilden mangler gruppeidentitet for noen eller alle øktene. Kildeetikettene nedenfor beskriver aktiviteter; de bekrefter ikke hvilken gruppe du tilhører.'))
    details.append(el('p','Kontroller tidspunkt og sted. Utvalget bekrefter ikke personlig tilhørighet.'),button('Velg alle aktiviteter i dette timeplanvalget',()=>{source.groups=[...groups];source.excludedKeys=[];refresh()}),button('Velg ingen aktiviteter',()=>{source.groups=[];refresh()}))
    details.append(el('p','Utvalgslistene kan rulles. Bruk Tab til listen og piltastene for å lese flere oppføringer.'))
    const fieldset=el('fieldset');fieldset.className='teaching-choice-list';fieldset.tabIndex=0;fieldset.dataset.importScrollKey=`groups:${course.id}`;fieldset.append(el('legend',label))
    for(const group of groups){const check=el('input');check.type='checkbox';check.dataset.importKey=`group:${course.id}:${group}`;groupChecks.set(group,check);check.onchange=()=>{if(check.checked){source.groups=[...new Set([...source.groups,group])];source.pendingGroups=(source.pendingGroups||[]).filter(item=>item!==group);const keys=new Set(parsed.events.filter(event=>event.group===group).map(event=>event.sourceKey));source.excludedKeys=source.excludedKeys.filter(key=>!keys.has(key))}else source.groups=source.groups.filter(item=>item!==group);refresh()};fieldset.append(field(`${group||'Uten oppgitt gruppe'} (${parsed.events.filter(event=>event.group===group).length} økter)`,check))}
    details.append(fieldset);card.append(details)
    const events=el('details');events.dataset.importKey=`events:${course.id}`;events.append(el('summary',`Velg enkelte av ${parsed.events.length} publiserte undervisningsøkter`))
    const eventList=el('div');eventList.className='teaching-choice-list';eventList.tabIndex=0;eventList.dataset.importScrollKey=`events:${course.id}`;eventList.setAttribute('role','group');eventList.setAttribute('aria-label',`Enkeltøkter for ${course.code}`);events.append(eventList)
    for(const event of parsed.events){const check=el('input');check.type='checkbox';check.dataset.importKey=`event:${course.id}:${event.sourceKey}`;eventChecks.set(event,check);check.onchange=()=>{if(check.checked){if(!source.groups.includes(event.group)){source.groups.push(event.group);source.pendingGroups=(source.pendingGroups||[]).filter(item=>item!==event.group);source.excludedKeys=[...new Set([...source.excludedKeys,...parsed.events.filter(other=>other.group===event.group&&other.sourceKey!==event.sourceKey).map(other=>other.sourceKey)])]}source.excludedKeys=source.excludedKeys.filter(key=>key!==event.sourceKey)}else source.excludedKeys=[...new Set([...source.excludedKeys,event.sourceKey])];refresh()};eventList.append(field(`${new Date(event.start).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'})} · ${event.title} · ${event.location||'Sted mangler'}${event.groupMissing?'':` · ${event.group}`}`,check))}
    card.append(events);refresh()
  }
  function renderPreview() {
    const local=previewHost.hidden?null:localSnapshot(previewHost)
    const heading=el('h4','Kontroller programimport');heading.tabIndex=-1;previewHost.replaceChildren(heading);previewHost.hidden=false;if(!preview)return
    controls.hidden=true;results.hidden=true;choices.hidden=true;sources.hidden=true
    for(const candidate of preview.candidates) {
      const {course,parsed,source}=candidate,card=el('article');card.className='course-card';card.dataset.courseCode=course.code;card.append(el('h4',`${course.code} ${course.name}`),el('p',`${semesterLabel(course.semester,course.year)} · ${course.credits??'Ukjente'} studiepoeng`),el('p',`${course.programBinding.programName} · Kull ${course.programBinding.cohort} · ${course.programBinding.modelName} · ${course.programBinding.studySemester}. studiesemester · Campus: ${course.programBinding.campus||'Ikke oppgitt'}`),course.studentAdded?el('p',course.manualUnverified?'Uverifisert manuelt emne. Ikke dokumentert av programkilden.':'Lagt til fra separat emnesøk. Ikke dokumentert av programkilden.'):link(course.sourceUrl,'Publisert kilde'))
      if(course.studentAdded&&!course.manualUnverified&&course.sourceUrl)card.append(link(course.sourceUrl,'Kilde for emnet'))
      if(course.description){const more=el('details');more.append(el('summary','Emnebeskrivelse'),el('p',course.description));card.append(more)}
      if(course.programBinding.sourceNotes){const excerpt=el('details');excerpt.className='programme-source-excerpt';excerpt.append(el('summary','Vis kilde'),el('p',course.programBinding.sourceNotes));card.append(excerpt)}
      const teachingHost=el('div');candidate.teachingHost=teachingHost;const teachingState=el('p',`Undervisning: ${teachingStatusLabel(candidate.teachingStatus)}${candidate.teachingError?` (${candidate.teachingError})`:''}`);candidate.teachingStateNode=teachingState;teachingState.className=`teaching-status teaching-status-${candidate.teachingStatus||'idle'}`;card.append(teachingState,teachingHost)
      if(course.teachingCheck)card.append(el('p',teachingCheckText(course.teachingCheck),['success','empty'].includes(course.teachingCheck.status)?'muted':'import-warning'))
      if(parsed) {
        teachingChoices(teachingHost,course,parsed,source,candidate)
      } else teachingHost.append(el('p',candidate.calendarUrl?'Undervisning er tilgjengelig for separat henting før bekreftelse.':'Undervisning er ikke hentet fra denne programkilden. Kalenderfil eller lenke kan importeres senere.'))
      if (['nmbu','hvl','usn','mf','nhh','nmh','khio','samas','ldh','steiner','hivolda','uit','uib','oslomet','nord','inn','uis','uio','uia','himolde','hiof','kristiania','nih'].includes(institution.value)) {
        const timetable = el('details');timetable.dataset.importKey=`timetable:${course.id}`; timetable.append(el('summary', `Offentlig timeplan for ${course.code}`))
        const query = el('input'); query.value = candidate.teachingQuery ?? (institution.value==='khio'?course.programBinding?.programCode:course.code) ?? ''; query.maxLength = 120;candidate.teachingInput=query;candidate.teachingChoice=null
        query.setAttribute('aria-label', `Timeplansøk for ${course.code}`);query.dataset.importKey=`query:${course.id}`
        query.oninput = () => { clearTeaching(candidate);candidate.teachingQuery = query.value; candidate.teachingResults = null; candidate.teachingObject = null;candidate.teachingChoice=null; options.replaceChildren() }
        const options = el('div'),searchControl=button(`Søk offentlig undervisning for ${course.code}`, () => run(operation => searchTeaching(candidate, operation),{localStatus:true,startText:`Søker etter undervisning for ${course.code} …`}));searchControl.dataset.importKey=`search:${course.id}`
        timetable.append(field(institution.value==='khio'?'Programkode eller kullnavn i timeplankilden':'Emnekode eller navn i timeplankilden', query),searchControl, options)
        if (candidate.teachingResults) {
          const choice = select('teachingObject', `Timeplanobjekt for ${course.code}`)
          candidate.teachingChoice=choice;choice.dataset.importKey=`choice:${course.id}`
          fill(choice, candidate.teachingResults.map((result, index) => ({ value: String(index), label: result.label || result.code || result.sourceObjectId })), 'Timeplanobjekt')
          const selectedIndex = candidate.teachingResults.findIndex(result=>result.sourceObjectId===candidate.teachingObject?.sourceObjectId)
          if (selectedIndex >= 0) choice.value = String(selectedIndex)
          choice.onchange = () => { clearTeaching(candidate);candidate.teachingObject = choice.value === '' ? null : candidate.teachingResults[Number(choice.value)] }
          const loadControl=button(`Hent valgt timeplan for ${course.code}`, () => run(operation => loadTeachingSelection(candidate, operation),{localStatus:true,startText:`Henter valgt timeplan for ${course.code} …`}));loadControl.dataset.importKey=`load:${course.id}`
          options.append(field('Velg riktig offentlig emne-, klasse- eller gruppevariant', choice), el('p', 'Du må kontrollere at kildevalget gjelder emnet og semesteret ditt. Et søketreff bekrefter ikke personlig gruppetilhørighet.'),loadControl)
          for (const result of candidate.teachingResults) if (result.sourceUrl) options.append(link(result.sourceUrl, result.label || 'Publisert timeplankilde'))
          timetable.open = true
        }
        card.append(timetable)
      }
      if(candidate.parsed)candidate.teachingSnapshot=teachingSnapshot(candidate)
      previewHost.append(card)
    }
    const warnings=el('details');warnings.append(el('summary','Kildeopplysninger og mangler'));for(const warning of [...new Set(preview.warnings)])warnings.append(el('p',warning));previewHost.append(warnings)
    if(preview.candidates.some(item=>!item.parsed&&!['empty','failed','access-required'].includes(item.teachingStatus))){const teachingButton=button('Kontroller tilgjengelig undervisning på nytt',()=>run(operation=>teaching(operation,false),{localStatus:true,startText:'Kontrollerer undervisning …'}));teachingButton.className='secondary';previewHost.append(teachingButton)}
    if(preview.candidates.some(item=>['failed','access-required'].includes(item.teachingStatus))){const retryButton=button('Prøv mislykkede undervisningskilder på nytt',()=>run(operation=>teaching(operation,true),{localStatus:true,startText:'Prøver mislykkede undervisningskilder på nytt …'}));retryButton.className='secondary';retryButton.dataset.importKey='retry-failed';previewHost.append(retryButton)}
    const confirmButton=button(`Legg til ${preview.candidates.length} emner`,()=>run(commit,{localStatus:true,startText:'Lagrer valgte emner og undervisning …'}));confirmButton.setAttribute('aria-label','Bekreft programimport')
    const backButton=button('Tilbake til emnevalg',()=>{preview=null;previewHost.hidden=true;showChoices();periodSelect.focus()});backButton.className='secondary'
    confirmButton.dataset.importKey='confirm-program';previewHost.append(confirmButton,backButton)
    if(!restoreLocalSnapshot(previewHost,local)&&!local)heading.focus({preventScroll:true})
  }
  async function commit() {
    if(!preview)return
    if(preview.selection!==selectionSnapshot())throw new Error('Programvalget er endret. Lag en ny forhåndsvisning før du lagrer.')
    for(const candidate of preview.candidates)if(candidate.parsed&&candidate.teachingSnapshot!==teachingSnapshot(candidate)){clearTeaching(candidate,false);throw new Error('Timeplanvalget er endret. Hent ønsket timeplan og velg aktivitetene på nytt før du bekrefter.')}
    if(preview.baseline!==JSON.stringify(state()))throw new Error('Dataene er endret etter forhåndsvisningen. Lag en ny forhåndsvisning før du lagrer.')
    let next=structuredClone(state());for(const candidate of preview.candidates){next=mergeCourseOnly(next,candidate.course);if(candidate.parsed)next=mergeImport(next,candidate.parsed.events,candidate.source,{course:candidate.course,...disappearancePolicy(candidate.source,candidate.course,candidate.parsed),selection:{groups:candidate.source.groups,excludedKeys:candidate.source.excludedKeys}}).planner}
    if(!validPlanner(next))throw new Error('Importplanen inneholder ugyldige opplysninger. Ingen data er lagret.')
    const count=preview.candidates.length,teachingReady=preview.candidates.filter(item=>selectedTeachingEvents(item.parsed,item.source).length).length,teachingEvents=preview.candidates.reduce((total,item)=>total+selectedTeachingEvents(item.parsed,item.source).length,0),teachingUnavailable=count-teachingReady, saved=await commitPlanner(next)
    if(saved===false || saved?.ok===false)throw new Error(saved?.error || 'Lagringen ble avvist. Forhåndsvisningen er beholdt.')
    const courseWord=count===1?'emne':'emner', eventWord=teachingEvents===1?'undervisningshendelse':'undervisningshendelser', sourceCourseWord=teachingReady===1?'emne':'emner', unavailableCourseWord=teachingUnavailable===1?'emne':'emner'
    const receipt=`${count} ${courseWord} er lagret samlet. ${teachingEvents} ${eventWord} ble importert fra ${teachingReady} ${sourceCourseWord}; ${teachingUnavailable} ${unavailableCourseWord} har ingen importert undervisning. Tidligere emne-ID-er, notater og oppgavelenker er beholdt.`
    preview=null;touched=false;clearDraftStorage();previewHost.hidden=true;showChoices();feedback(receipt);actionStatus.hidden=false;actionStatus.classList.remove('is-error');actionStatus.textContent=receipt;actionStatus.tabIndex=-1;actionStatus.focus()
  }
  function restoreDraft() {
    let draft
    try{const raw=sessionStorage.getItem(PROGRAM_DRAFT_KEY);if(!raw)return;if(new TextEncoder().encode(raw).byteLength>MAX_PROGRAM_DRAFT_BYTES){draftRecoveryUnavailable();return}draft=JSON.parse(raw)}catch{draftRecoveryUnavailable();return}
    if(draft?.version!==1||!institutions.some(item=>item.id===draft.institution)||!Array.isArray(draft.programs)||!Array.isArray(draft.cohorts)||!Array.isArray(draft.addedCourses)||draft.plan&&(!draft.plan.program||!Array.isArray(draft.plan.models))){clearDraftStorage();return}
    try {
      institution.value=draft.institution;q.value=String(draft.query||'');year.value=String(draft.year||osloYear());programs=draft.programs;cohorts=draft.cohorts;plan=draft.plan||null;addedCourses=draft.addedCourses.slice(0,40);coverage()
      fill(programSelect,programs.map((p,index)=>({value:String(index),label:`${p.code} · ${p.name}`})),'Studieprogram');programSelect.value=draft.values?.program||''
      fill(cohortSelect,cohorts.map((c,index)=>({value:String(index),label:c.label||c.cohort})),'Opptakskull');cohortSelect.value=draft.values?.cohort||'';studentCohort.value=draft.values?.studentCohort||'';studentCohortField.hidden=!selectedCohort()?.requiresStudentCohort;results.hidden=!programs.length
      if(plan){fill(modelSelect,plan.models.map(model=>({value:model.id,label:model.name})),'Studiemodell eller retning');modelSelect.value=draft.values?.model||'';fill(periodSelect,(selectedModel()?.periods||[]).map(period=>({value:period.id,label:period.label})),'Studiesemester');periodSelect.value=draft.values?.period||'';clarifiedYear.value=draft.values?.clarifiedYear||'';clarifiedStudySemester.value=draft.values?.clarifiedStudySemester||'';clarifiedSemester.value=draft.values?.clarifiedSemester||'';const period=selectedPeriod(),published=Boolean(period?.year&&period?.semester);fill(calendarSelect,published?[{value:`${period.year}:${period.semester}`,label:semesterLabel(period.semester,period.year)}]:[],'Kalendersemester');calendarSelect.value=draft.values?.calendar||'';calendarSelect.parentElement.hidden=!published;clarification.hidden=published||!period;studySemesterClarification.hidden=!period?.requiresStudentStudySemester;fill(campusSelect,plan.program.campuses?.length?plan.program.campuses.map(campus=>({value:campus,label:campus})):[{value:'__unknown',label:'Campus er ikke oppgitt – behold ukjent'}],'Campus');campusField.hidden=!plan.program.campuses?.length;campusSelect.value=campusField.hidden?'__unknown':draft.values?.campus||'';choices.hidden=false;renderCourseChoices(Array.isArray(draft.selectedCourseIds)?draft.selectedCourseIds:[])}
      touched=true;message.textContent='Det påbegynte programvalget er gjenopprettet. Ingen emner er lagret ennå.'
    } catch { clearDraftStorage();programs=[];cohorts=[];plan=null;addedCourses=[];results.hidden=true;choices.hidden=true }
  }
  restoreDraft()
  return {hasDraft:()=>busy||Boolean(preview)||touched,open(){section.hidden=false;institution.focus()},close(){version++;controller?.abort();busy=false;setBusy();section.hidden=true},element:section}
}
