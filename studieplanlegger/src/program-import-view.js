import { institutions, institutionById } from './institutions.js'
import { emptyPlanner, mergeCourseOnly, mergeImport, resolveImportedCourse, validPlanner, semesterLabel, osloYear, sourceHref } from './planner.js'
import { parseCalendar } from './calendar-import.js'
import { disappearancePolicy, sourceCoverage, UNKNOWN_COVERAGE_WARNING } from './source-coverage.js'

const el = (tag,text) => { const node=document.createElement(tag); if(text!=null) node.textContent=text; return node }
const button = (text,action) => { const node=el('button',text); node.type='button'; node.onclick=action; return node }
const field = (label,input) => { const node=el('label',label);node.append(input);return node }
const select = (name,label) => { const node=el('select');node.name=name;node.setAttribute('aria-label',label);node.append(new Option(`Velg ${label.toLocaleLowerCase('nb')}`,''));return node }
const fill = (node, items, label) => { node.replaceChildren(new Option(`Velg ${label.toLocaleLowerCase('nb')}`,'')); for (const item of items) node.append(new Option(item.label,item.value)); node.value='' }
const link = (url,label) => { const href=sourceHref(url);if(!href)return el('span',`${label}: ${url}`);const node=el('a',label);node.href=href;node.target='_blank';node.rel='noreferrer';return node }
async function defaultApi(path,options) {
  const response=await fetch(path,options);let data
  try { data=await response.json() } catch { throw new Error('Importtjenesten er ikke tilgjengelig. Åpne appens lokale server; dokument og manuell registrering fungerer fortsatt.') }
  if(!response.ok) throw new Error(data.error || 'Kilden kunne ikke hentes.')
  return data
}
export function createProgramImportView({ host, getState, commitPlanner, feedback = ()=>{}, manual = ()=>{}, api=defaultApi }) {
  let controller=null, version=0, busy=false, programs=[], cohorts=[], plan=null, preview=null, touched=false
  const section=el('section');section.className='program-import';section.dataset.testid='program-import'
  const message=el('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite')
  const institution=select('institution','Institusjon');for(const item of institutions) institution.append(new Option(item.name,item.id))
  const q=el('input');q.name='programQuery';q.maxLength=120;q.placeholder='Programnavn eller kode (valgfritt)'
  const year=el('input');year.name='catalogueYear';year.type='number';year.min='1900';year.max='2200';year.value=String(osloYear())
  const controls=el('div');controls.className='subject-fields'
  const sources=el('div'), results=el('div'), choices=el('div'), previewHost=el('section');previewHost.className='import-preview';previewHost.hidden=true
  const programSelect=select('program','Studieprogram'),cohortSelect=select('cohort','Opptakskull'),modelSelect=select('model','Studiemodell eller retning'),periodSelect=select('studySemester','Studiesemester'),calendarSelect=select('calendarSemester','Kalendersemester'),campusSelect=select('programCampus','Campus')
  const studentCohort=el('input');studentCohort.name='studentCohort';studentCohort.type='number';studentCohort.min='1900';studentCohort.max='2200';const studentCohortField=field('Ditt opptakskull (oppgitt av deg, ikke verifisert i kilden)',studentCohort);studentCohortField.hidden=true
  const clarifiedYear=el('input');clarifiedYear.type='number';clarifiedYear.name='clarifiedYear';clarifiedYear.min='1900';clarifiedYear.max='2200'
  const clarifiedStudySemester=el('input');clarifiedStudySemester.type='number';clarifiedStudySemester.name='clarifiedStudySemester';clarifiedStudySemester.min='1';clarifiedStudySemester.max='40'
  const studySemesterClarification=field('Avklart studiesemester i ditt studieløp (oppgitt av deg)',clarifiedStudySemester);studySemesterClarification.hidden=true
  const clarifiedSemester=select('clarifiedSemester','Avklart kalendersemester');clarifiedSemester.append(new Option('Vår','spring'),new Option('Høst','autumn'))
  const clarification=el('div');clarification.hidden=true;clarification.append(el('p','Kilden oppgir ikke et entydig kalendersemester. Skriv året og velg semesteret fra din studieplan.'),field('Avklart kalenderår',clarifiedYear),field('Avklart kalendersemester',clarifiedSemester))
  const listButton=button('Hent studieprogram',()=>run(loadPrograms)), planButton=button('Hent studieplan',()=>run(loadPlan)), previewButton=button('Forhåndsvis valgte emner',()=>run(prepare))
  const cancel=button('Avbryt henting',()=>{version++;controller?.abort();controller=null;busy=false;setBusy();message.textContent='Hentingen er avbrutt. Valgene og lagrede data er beholdt.'})
  cancel.hidden=true
  controls.append(field('Institusjon',institution),field('Programnavn eller kode',q),field('Programlistens kull/år',year),listButton)
  results.append(field('Studieprogram',programSelect),field('Opptakskull',cohortSelect),studentCohortField,planButton);results.hidden=true
  choices.append(field('Studiemodell eller retning',modelSelect),field('Studiesemester i studieløpet',periodSelect),studySemesterClarification,field('Kalendersemester',calendarSelect),clarification,field('Campus',campusSelect));choices.hidden=true
  const courseChoices=el('fieldset');courseChoices.className='activity-choices';choices.append(courseChoices,previewButton)
  section.append(el('h3','Importer fra studieprogram'),el('p','Velg et publisert program, kull og semester. Se emnene og velg valgemner og undervisningsgrupper før du bekrefter.'),controls,sources,message,cancel,results,choices,previewHost,button('Registrer manuelt',manual));host.append(section)
  const state = ()=> { const current=getState();return current.planner || (Array.isArray(current.courses)?current:emptyPlanner()) }
  const selectedProgram = ()=>programs[Number(programSelect.value)]
  const selectedCohort = ()=>cohorts[Number(cohortSelect.value)]
  const selectedModel = ()=>plan?.models.find(model=>model.id===modelSelect.value)
  const selectedPeriod = ()=>selectedModel()?.periods.find(period=>period.id===periodSelect.value)
  const candidateRows = ()=>[...(selectedPeriod()?.courses||[]),...(selectedModel()?.unplacedCourses||[]).map(course=>({...course,requiresSemesterChoice:true}))]
  const selectionSnapshot = ()=>JSON.stringify([institution.value,q.value,year.value,programSelect.value,cohortSelect.value,studentCohort.value,modelSelect.value,periodSelect.value,calendarSelect.value,campusSelect.value,clarifiedYear.value,clarifiedStudySemester.value,clarifiedSemester.value,[...courseChoices.querySelectorAll('input:checked')].map(input=>input.value)])
  const teachingQuery = candidate=>candidate.teachingInput?.value ?? candidate.teachingQuery ?? (institution.value==='khio'?candidate.course.programBinding?.programCode:candidate.course.code) ?? ''
  const teachingSnapshot = candidate=>JSON.stringify([institution.value,candidate.course.year,candidate.course.semester,candidate.calendarUrl,teachingQuery(candidate),candidate.teachingChoice?.value?candidate.teachingResults?.[Number(candidate.teachingChoice.value)]?.sourceObjectId:null,candidate.teachingChoice?.value ?? null,candidate.teachingObject?.sourceObjectId ?? null])
  const status = text=>{message.textContent=text;feedback(text)}
  const setBusy = ()=>{ for(const input of section.querySelectorAll('input,select,button')) if(input!==cancel) input.disabled=busy; cancel.hidden=!busy; section.setAttribute('aria-busy',String(busy)) }
  async function request(action,query={}) {
    const data=await api(`/api/import/providers/${institution.value}/${action}?${new URLSearchParams(query)}`,{signal:controller?.signal})
    if(data.status!=='ok') throw new Error(data.error || 'Kilden har ingen bekreftede treff for valget.')
    return data
  }
  async function run(work) {
    if(busy)return
    busy=true;controller=new AbortController();const operation=++version;setBusy()
    try {await work(operation)} catch(error) {if(operation===version && error.name!=='AbortError') {status(`${error.message} Lagrede data er beholdt.`);feedback(message.textContent,true)}}
    finally {if(operation===version){busy=false;controller=null;setBusy()}}
  }
  function stopPending(){version++;controller?.abort();controller=null;busy=false;setBusy()}
  function invalidatePlan(){stopPending();plan=null;preview=null;choices.hidden=true;previewHost.hidden=true;courseChoices.replaceChildren()}
  function clearPreview(){stopPending();preview=null;previewHost.hidden=true;touched=true}
  function clearTeaching(candidate,stop=true){if(stop)stopPending();candidate.parsed=null;candidate.source=null;candidate.teachingSnapshot=null;candidate.teachingHost?.replaceChildren(el('p','Undervisningsvalget er endret. Hent ønsket timeplan og velg aktivitetene på nytt. Lagret undervisning er beholdt.'))}
  function showChoices(){controls.hidden=false;results.hidden=false;choices.hidden=false;sources.hidden=false}
  function coverage() {
    sources.replaceChildren();const item=institutionById(institution.value);if(!item)return
    const details=el('details');details.append(el('summary','Kilder og importdekning for institusjonen'))
    if(item.datatypes) for(const evidence of Object.values(item.datatypes)) {const line=el('p',`${evidence.label}: ${evidence.status}. ${evidence.scope} Kontrollert ${evidence.checkedAt || 'ikke datert'}.`);if(evidence.url)line.append(document.createTextNode(' '),link(evidence.url,'Kilde'));details.append(line)}
    else details.append(el('p','Se IMPORT-COVERAGE.md for daterte datatypebegrensninger. Institusjonslisten er ikke bevis på integrasjon.'))
    sources.append(details)
  }
  institution.onchange=()=>{touched=true;programs=[];cohorts=[];results.hidden=true;invalidatePlan();coverage();message.textContent=''}
  q.oninput=year.oninput=()=>{touched=true;programs=[];cohorts=[];results.hidden=true;invalidatePlan()}
  async function loadPrograms(operation) {
    if(!institution.value)throw new Error('Velg institusjon først.')
    if(!/^\d{4}$/.test(year.value)||+year.value<1900||+year.value>2200)throw new Error('Velg gyldig år for programlisten.')
    status('Henter publiserte program. Store lister kan ta litt tid; du kan avbryte.');plan=null;preview=null;choices.hidden=true;previewHost.hidden=true;courseChoices.replaceChildren()
    const snapshot=selectionSnapshot(),data=await request('programs',{q:q.value.trim(),year:year.value});if(operation!==version||snapshot!==selectionSnapshot())return
    programs=data.results || [];cohorts=[];fill(programSelect,programs.map((p,index)=>({value:String(index),label:`${p.code} · ${p.name}${p.level?` · ${p.level}`:''}${p.cohort?` · Kull ${p.cohort}`:''}${p.intake?` ${p.intake==='spring'?'vår':'høst'}`:''}`})),'Studieprogram');fill(cohortSelect,[],'Opptakskull');results.hidden=false
    status(`${programs.length} programtreff. ${data.completeness?.complete?'Hele kildeutvalget er hentet.':'Listen er ikke bekreftet fullstendig.'} ${(data.warnings || []).join(' ')}`);programSelect.focus()
  }
  programSelect.onchange=()=>{touched=true;cohorts=[];invalidatePlan();fill(cohortSelect,[],'Opptakskull');if(programSelect.value!=='')run(async(operation)=>{const selected=selectedProgram(),snapshot=selectionSnapshot(), data=await request('program-cohorts',{program:selected.code,sourceUrl:selected.sourceUrl});if(operation!==version||snapshot!==selectionSnapshot())return;cohorts=data.results || [];fill(cohortSelect,cohorts.map((c,index)=>({value:String(index),label:c.label || c.cohort})),'Opptakskull');status((data.warnings||[]).join(' ') || 'Velg ditt opptakskull.');cohortSelect.focus()})}
  cohortSelect.onchange=()=>{touched=true;invalidatePlan();studentCohortField.hidden=!selectedCohort()?.requiresStudentCohort}
  studentCohort.oninput=()=>{touched=true;invalidatePlan()}
  async function loadPlan(operation) {
    if(programSelect.value===''||cohortSelect.value==='')throw new Error('Velg studieprogram og opptakskull.')
    const selected=selectedProgram(),cohort=selectedCohort();status('Henter den valgte studieplanen.')
    if(cohort.requiresStudentCohort&&(!/^\d{4}$/.test(studentCohort.value)||+studentCohort.value<1900||+studentCohort.value>2200))throw new Error('Oppgi ditt opptakskull. Kilden verifiserer bare planutgaven, ikke ditt kull.')
    const snapshot=selectionSnapshot(),data=await request('program-plan',{program:selected.code,cohort:cohort.requiresStudentCohort?studentCohort.value:cohort.cohort,sourceUrl:cohort.sourceUrl || selected.sourceUrl,...(cohort.requiresStudentCohort?{cohortFromStudent:'true'}:{}),...(cohort.historical?{historicalConfirmed:'true'}:{})});if(operation!==version||snapshot!==selectionSnapshot())return
    plan=data;plan.program.campuses=[...new Set([...(data.program.campuses||[]),...(selected.campuses||[])])];preview=null;previewHost.hidden=true
    fill(modelSelect,plan.models.map(model=>({value:model.id,label:model.name})),'Studiemodell eller retning');fill(periodSelect,[],'Studiesemester');fill(calendarSelect,[],'Kalendersemester')
    fill(campusSelect,plan.program.campuses.length?plan.program.campuses.map(campus=>({value:campus,label:campus})):[{value:'__unknown',label:'Campus er ikke oppgitt – behold ukjent'}],'Campus')
    choices.hidden=false;courseChoices.replaceChildren();status((plan.warnings||[]).join(' '));modelSelect.focus()
  }
  modelSelect.onchange=()=>{clearPreview();courseChoices.replaceChildren();fill(periodSelect,(selectedModel()?.periods||[]).map(period=>({value:period.id,label:period.label})),'Studiesemester');fill(calendarSelect,[],'Kalendersemester')}
  periodSelect.onchange=()=>{clearPreview();renderCourseChoices();const period=selectedPeriod();const published=Boolean(period?.year&&period?.semester);fill(calendarSelect,published?[{value:`${period.year}:${period.semester}`,label:semesterLabel(period.semester,period.year)}]:[],'Kalendersemester');calendarSelect.parentElement.hidden=!published;clarification.hidden=published||!period;studySemesterClarification.hidden=!period?.requiresStudentStudySemester;clarifiedStudySemester.value='';clarifiedYear.value='';fill(clarifiedSemester,(period?.semester?[period.semester]:['spring','autumn']).map(value=>({value,label:value==='spring'?'Vår':'Høst'})),'Avklart kalendersemester')}
  calendarSelect.onchange=campusSelect.onchange=clarifiedYear.oninput=clarifiedSemester.onchange=clearPreview
  clarifiedStudySemester.oninput=()=>{const allowed=selectedPeriod()?.allowedCalendarPeriodsByStudySemester?.[clarifiedStudySemester.value];if(allowed){clarifiedYear.value=String(allowed.year);fill(clarifiedSemester,[{value:allowed.semester,label:allowed.semester==='spring'?'Vår':'Høst'}],'Avklart kalendersemester');clarifiedSemester.value=allowed.semester}clearPreview()}
  function renderCourseChoices() {
    courseChoices.replaceChildren(el('legend','Emner i valgt studiesemester'));const period=selectedPeriod();if(!period)return
    for(const requirement of period.requirements||[])courseChoices.append(el('p',`Plankrav: ${typeof requirement==='string'?requirement:JSON.stringify(requirement)}`))
    if(!period.courses.length)courseChoices.append(el('p','Ingen emner er publisert for dette semesteret. Krav og tomme rader blir ikke gjort om til emner.'))
    candidateRows().forEach((course,index)=>{if(index===period.courses.length)courseChoices.append(el('p','Emner uten oppgitt studiesemester – velg bare dersom de gjelder semesteret du har valgt.'));const check=el('input');check.type='checkbox';check.value=String(index);check.checked=course.choice==='O'&&!course.requiresSemesterChoice;check.onchange=clearPreview;const label=field(`${course.code} ${course.name} · ${course.choice==='O'?'Obligatorisk':course.choice==='V'?'Valgemne':'Type ikke entydig – velg selv'}${course.requiresSemesterChoice?' · Bekreft plassering i valgt semester':''} · ${course.credits??'Ukjente'} studiepoeng`,check);courseChoices.append(label);if(course.courseGroup)courseChoices.append(el('p',course.courseGroup));if(course.notes)courseChoices.append(el('p',course.notes))})
  }
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
    const checked=[...courseChoices.querySelectorAll('input:checked')].map(input=>Number(input.value));if(!checked.length)throw new Error('Velg minst ett publisert emne.')
    if(checked.length>40)throw new Error('Velg høyst 40 emner i én import.')
    const selection=selectionSnapshot(),baseline=JSON.stringify(state()),candidates=[],warnings=[...(plan.warnings||[])];let next=structuredClone(state())
    for(let index=0;index<checked.length;index++) {
      if(operation!==version)return
      const row=candidateRows()[checked[index]],campus=campusSelect.value==='__unknown'?'':campusSelect.value
      if(row.allowedCalendarPeriods&&!row.allowedCalendarPeriods.some(value=>value.year===period.year&&value.semester===period.semester))throw new Error(`${row.code||row.name}: kilden publiserer ikke dette emnevalget for kalendersemesteret du har oppgitt. Velg en publisert periode eller utelat emnet.`)
      if(row.unavailableCalendarPeriods?.some(value=>value.year===period.year&&value.semester===period.semester))throw new Error(`${row.code||row.name}: kilden sier uttrykkelig at emnet ikke tilbys i dette kalendersemesteret. Velg et publisert tilbud eller utelat emnet.`)
      if(row.calendarPeriodBound){const bound=row.calendarPeriodBound,selected=period.year*2+(period.semester==='autumn'?1:0),limit=bound.year*2+(bound.semester==='autumn'?1:0);if(!['fra','til'].includes(bound.direction)||!Number.isInteger(bound.year)||!['spring','autumn'].includes(bound.semester)||(bound.direction==='fra'?selected<limit:selected>limit))throw new Error(`${row.code||row.name}: kalendersemesteret er utenfor denne kildeplanens publiserte gyldighetsperiode.`)}
      const rawSourceNotes=String(row.notes||''),sourceNotes=rawSourceNotes.slice(0,12000)
      if(rawSourceNotes.length>sourceNotes.length)warnings.push(`${row.code||row.name}: Kildens lange notat er forkortet før forhåndsvisning og lagring. Kontroller den publiserte kilden for resten.`)
      let course={...row,year:period.year,semester:period.semester,notes:sourceNotes,programBinding:{institution:institution.value,programCode:plan.program.code,programName:plan.program.name,cohort:String(plan.program.cohort),modelId:model.id,modelName:model.name,studySemester:period.studySemester,...(row.spansStudySemesters?{studySemesters:[...row.spansStudySemesters]}:{}),studySemesterClarifiedByStudent:studySemesterFromStudent||Boolean(row.requiresSemesterChoice),calendarYear:period.year,calendarSemester:period.semester,calendarClarifiedByStudent:!published,campus,choice:row.choice||'',sourceNotes,sourceUrl:plan.program.sourceUrl,checkedAt:new Date().toISOString()}},calendarUrl=null
      if(!published||row.requiresSemesterChoice)course.id=`${row.id}:${period.year}:${period.semester}`
      if(plan.program.cohortFromStudent){course.programBinding.cohortFromStudent=true;course.programBinding.sourceEdition=plan.program.sourceEdition}
      status(`Forbereder ${index+1} av ${checked.length}: ${course.code}.`)
      if(['ntnu','kristiania','khio'].includes(institution.value)||['phs','samas'].includes(institution.value)&&row.sourceUrl&&!/\.pdf(?:[?#]|$)/i.test(row.sourceUrl)) {
        try {const detail=await request('details',{code:row.code,year:String(period.year),semester:period.semester,campus,...(['kristiania','khio','phs','samas'].includes(institution.value)?{sourceUrl:row.sourceUrl}:{})});if(operation!==version)return;course={...course,...detail.course,sourceProvider:course.sourceProvider,sourceRecordId:course.sourceRecordId,sourceVersion:course.sourceVersion,programBinding:course.programBinding};calendarUrl=detail.calendarUrl;warnings.push(...(detail.warnings||[]).map(text=>`${row.code}: ${text}`))}
        catch(error){if(operation!==version)return;warnings.push(`${row.code}: detaljkilden kunne ikke hentes (${error.message}). Publisert emnerad beholdes uten oppdiktet beskrivelse.`)}
      }
      course=resolveImportedCourse(next,course);next=mergeCourseOnly(next,course);candidates.push({course,calendarUrl,parsed:null,source:null})
    }
    if(operation!==version||selection!==selectionSnapshot())return
    preview={baseline,selection,candidates,warnings:[...new Set(warnings)]};renderPreview();status('Kontroller emner, kilde og eventuelle undervisningsgrupper. Ingen data er lagret ennå.')
  }
  async function teaching(operation) {
    const current=preview;if(!current)return
    for(const candidate of current.candidates.filter(item=>item.calendarUrl&&!item.parsed)) {
      const snapshot=teachingSnapshot(candidate)
      status(`Henter undervisning for ${candidate.course.code}.`)
      try {const data=await api('/api/import/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:candidate.calendarUrl}),signal:controller?.signal});if(operation!==version||preview!==current||snapshot!==teachingSnapshot(candidate)||current.selection!==selectionSnapshot())return
        const parsed=parseCalendar(data.calendar,{courseId:candidate.course.id,semester:candidate.course.semester,year:candidate.course.year}),existing=state().sources.find(s=>s.courseId===candidate.course.id&&s.kind==='url'&&s.url===candidate.calendarUrl)
        candidate.parsed=parsed;candidate.teachingSnapshot=snapshot;candidate.source={...existing,id:existing?.id||`program-tp:${candidate.course.id}`,kind:'url',name:`${candidate.course.university} TP`,url:candidate.calendarUrl,courseId:candidate.course.id,groups:[...(existing?.groups||[])],excludedKeys:[...(existing?.excludedKeys||[])],lastUpdated:new Date().toISOString(),lastSuccess:new Date().toISOString(),identityMode:parsed.identityMode,autoRefresh:true};current.warnings.push(...parsed.warnings)
        if(sourceCoverage(candidate.source,candidate.course).kind==='unknown')current.warnings.push(UNKNOWN_COVERAGE_WARNING)
      } catch(error){if(operation!==version)return;current.warnings.push(`${candidate.course.code}: undervisning kunne ikke hentes (${error.message}). Emnet kan fortsatt lagres.`)}
    }
    if(operation===version&&preview===current){renderPreview();status('Velg undervisningsgrupper uttrykkelig før du bekrefter importen.')}
  }
  async function searchTeaching(candidate, operation) {
    const current = preview
    if (!current) return
    const query = teachingQuery(candidate).trim(),snapshot=teachingSnapshot(candidate)
    if (!query || query.length > 120) throw new Error('Skriv en emnekode eller et navn på høyst 120 tegn for timeplansøket.')
    const data = await request('teaching-search', { q: query, year: String(candidate.course.year), semester: candidate.course.semester })
    if (operation !== version || preview !== current || snapshot !== teachingSnapshot(candidate) || current.selection!==selectionSnapshot()) return
    candidate.parsed=null;candidate.source=null;candidate.teachingSnapshot=null
    candidate.teachingQuery = query
    candidate.teachingResults = data.results || []
    candidate.teachingObject = null
    current.warnings.push(...(data.warnings || []))
    renderPreview()
    status(`${candidate.teachingResults.length} offentlige timeplanvalg for ${candidate.course.code}. Velg selv riktig emne, variant og eventuell gruppe; ingen tilhørighet er antatt.`)
  }
  async function loadTeachingSelection(candidate, operation) {
    const current = preview, query=teachingQuery(candidate).trim()
    if(query!==candidate.teachingQuery){clearTeaching(candidate,false);candidate.teachingQuery=teachingQuery(candidate);candidate.teachingResults=null;candidate.teachingObject=null;renderPreview();throw new Error('Timeplansøket er endret. Søk på nytt og velg riktig timeplanobjekt.')}
    if(candidate.teachingChoice)candidate.teachingObject=candidate.teachingChoice.value===''?null:candidate.teachingResults?.[Number(candidate.teachingChoice.value)]
    const selected = candidate.teachingObject,snapshot=teachingSnapshot(candidate)
    if (!current || !selected) throw new Error('Velg et publisert timeplanobjekt først.')
    const data = await request('teaching-calendar', { q: query, sourceObjectId: selected.sourceObjectId, year: String(candidate.course.year), semester: candidate.course.semester })
    if (operation !== version || preview !== current || snapshot !== teachingSnapshot(candidate) || current.selection!==selectionSnapshot()) return
    const parsed = parseCalendar(data.calendar, { courseId: candidate.course.id, semester: candidate.course.semester, year: candidate.course.year })
    const existing = state().sources.find(source => source.courseId === candidate.course.id && source.kind === 'url' && source.url === data.calendarUrl)
    candidate.parsed = parsed
    candidate.teachingSnapshot = snapshot
    candidate.source = { ...existing, id: existing?.id || `program-timeedit:${candidate.course.id}:${selected.sourceObjectId}`, kind: 'url', name: `${candidate.course.university} · ${selected.label}`, url: data.calendarUrl, courseId: candidate.course.id, groups: [...(existing?.groups || [])], excludedKeys: [...(existing?.excludedKeys || [])], lastUpdated: new Date().toISOString(), lastSuccess: new Date().toISOString(), identityMode: parsed.identityMode, autoRefresh: true }
    current.warnings.push(...(data.warnings || []), ...parsed.warnings, UNKNOWN_COVERAGE_WARNING)
    renderPreview()
    status('Timeplanen er hentet. Velg aktivitetene og eventuelle oppgitte grupper før samlet bekreftelse.')
  }
  function teachingChoices(card, course, parsed, source) {
    if(!parsed.events.length){const notice=el('div');notice.setAttribute('role','status');notice.className='import-warning';notice.append(el('p','Ingen gyldige undervisningsøkter i valgt semester. Emnet kan lagres. Kontroller kilden eller registrer undervisning manuelt.'));for(const warning of parsed.warnings)notice.append(el('p',warning));card.append(notice);return}
    const missingGroups=parsed.events.some(event=>event.groupMissing),groups=[...new Set([...source.groups,...parsed.events.map(event=>event.group)])]
    const label=missingGroups?`Aktivitetsutvalg for ${course.code}`:`Undervisningsgrupper for ${course.code}`
    const details=el('details'),summary=el('summary'),groupChecks=new Map(),eventChecks=new Map()
    const selected=event=>source.groups.includes(event.group)&&!source.excludedKeys.includes(event.sourceKey)
    const refresh=()=>{summary.textContent=`${label} · ${parsed.events.filter(selected).length} av ${parsed.events.length} økter valgt`;for(const [group,check] of groupChecks){const events=parsed.events.filter(event=>event.group===group),count=events.filter(selected).length;check.checked=events.length?count===events.length:source.groups.includes(group);check.indeterminate=count>0&&count<events.length}for(const [event,check]of eventChecks)check.checked=selected(event)}
    details.append(summary)
    if(missingGroups)details.append(el('p','Kilden mangler gruppeidentitet for noen eller alle øktene. Kildeetikettene nedenfor beskriver aktiviteter; de bekrefter ikke hvilken gruppe du tilhører.'))
    details.append(el('p','Kontroller tidspunkt og sted. Utvalget bekrefter ikke personlig tilhørighet.'),button('Velg alle aktiviteter i dette timeplanvalget',()=>{source.groups=[...groups];source.excludedKeys=[];refresh()}),button('Velg ingen aktiviteter',()=>{source.groups=[];refresh()}))
    details.append(el('p','Utvalgslistene kan rulles. Bruk Tab til listen og piltastene for å lese flere oppføringer.'))
    const fieldset=el('fieldset');fieldset.className='teaching-choice-list';fieldset.tabIndex=0;fieldset.append(el('legend',label))
    for(const group of groups){const check=el('input');check.type='checkbox';groupChecks.set(group,check);check.onchange=()=>{if(check.checked){source.groups=[...new Set([...source.groups,group])];const keys=new Set(parsed.events.filter(event=>event.group===group).map(event=>event.sourceKey));source.excludedKeys=source.excludedKeys.filter(key=>!keys.has(key))}else source.groups=source.groups.filter(item=>item!==group);refresh()};fieldset.append(field(`${group||'Uten oppgitt gruppe'} (${parsed.events.filter(event=>event.group===group).length} økter)`,check))}
    details.append(fieldset);card.append(details)
    const events=el('details');events.append(el('summary',`Velg enkelte av ${parsed.events.length} publiserte undervisningsøkter`))
    const eventList=el('div');eventList.className='teaching-choice-list';eventList.tabIndex=0;eventList.setAttribute('role','group');eventList.setAttribute('aria-label',`Enkeltøkter for ${course.code}`);events.append(eventList)
    for(const event of parsed.events){const check=el('input');check.type='checkbox';eventChecks.set(event,check);check.onchange=()=>{if(check.checked){if(!source.groups.includes(event.group)){source.groups.push(event.group);source.excludedKeys=[...new Set([...source.excludedKeys,...parsed.events.filter(other=>other.group===event.group&&other.sourceKey!==event.sourceKey).map(other=>other.sourceKey)])]}source.excludedKeys=source.excludedKeys.filter(key=>key!==event.sourceKey)}else source.excludedKeys=[...new Set([...source.excludedKeys,event.sourceKey])];refresh()};eventList.append(field(`${new Date(event.start).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'})} · ${event.title} · ${event.location||'Sted mangler'}${event.groupMissing?'':` · ${event.group}`}`,check))}
    card.append(events);refresh()
  }
  function renderPreview() {
    const heading=el('h4','Kontroller programimport');heading.tabIndex=-1;previewHost.replaceChildren(heading);previewHost.hidden=false;if(!preview)return
    controls.hidden=true;results.hidden=true;choices.hidden=true;sources.hidden=true
    for(const candidate of preview.candidates) {
      const {course,parsed,source}=candidate,card=el('article');card.className='course-card';card.append(el('h4',`${course.code} ${course.name}`),el('p',`${semesterLabel(course.semester,course.year)} · ${course.credits??'Ukjente'} studiepoeng`),el('p',`${course.programBinding.programName} · Kull ${course.programBinding.cohort} · ${course.programBinding.modelName} · ${course.programBinding.studySemester}. studiesemester · Campus: ${course.programBinding.campus||'Ikke oppgitt'}`),link(course.sourceUrl,'Publisert kilde'))
      if(course.description){const more=el('details');more.append(el('summary','Emnebeskrivelse'),el('p',course.description));card.append(more)}
      if(course.programBinding.sourceNotes)card.append(el('p',course.programBinding.sourceNotes))
      const teachingHost=el('div');candidate.teachingHost=teachingHost;card.append(teachingHost)
      if(parsed) {
        teachingChoices(teachingHost,course,parsed,source)
      } else teachingHost.append(el('p',candidate.calendarUrl?'Undervisning er tilgjengelig for separat henting før bekreftelse.':'Undervisning er ikke hentet fra denne programkilden. Kalenderfil eller lenke kan importeres senere.'))
      if (['nmbu','hvl','usn','mf','nhh','nmh','khio','samas','ldh','steiner','hivolda','uit','uib','oslomet','nord','inn','uis','uio','uia','himolde','hiof','kristiania','nih'].includes(institution.value)) {
        const timetable = el('details'); timetable.append(el('summary', `Offentlig timeplan for ${course.code}`))
        const query = el('input'); query.value = candidate.teachingQuery ?? (institution.value==='khio'?course.programBinding?.programCode:course.code) ?? ''; query.maxLength = 120;candidate.teachingInput=query;candidate.teachingChoice=null
        query.setAttribute('aria-label', `Timeplansøk for ${course.code}`)
        query.oninput = () => { clearTeaching(candidate);candidate.teachingQuery = query.value; candidate.teachingResults = null; candidate.teachingObject = null;candidate.teachingChoice=null; options.replaceChildren() }
        const options = el('div')
        timetable.append(field(institution.value==='khio'?'Programkode eller kullnavn i timeplankilden':'Emnekode eller navn i timeplankilden', query), button(`Søk offentlig undervisning for ${course.code}`, () => run(operation => searchTeaching(candidate, operation))), options)
        if (candidate.teachingResults) {
          const choice = select('teachingObject', `Timeplanobjekt for ${course.code}`)
          candidate.teachingChoice=choice
          fill(choice, candidate.teachingResults.map((result, index) => ({ value: String(index), label: result.label || result.code || result.sourceObjectId })), 'Timeplanobjekt')
          const selectedIndex = candidate.teachingResults.indexOf(candidate.teachingObject)
          if (selectedIndex >= 0) choice.value = String(selectedIndex)
          choice.onchange = () => { clearTeaching(candidate);candidate.teachingObject = choice.value === '' ? null : candidate.teachingResults[Number(choice.value)] }
          options.append(field('Velg riktig offentlig emne-, klasse- eller gruppevariant', choice), el('p', 'Du må kontrollere at kildevalget gjelder emnet og semesteret ditt. Et søketreff bekrefter ikke personlig gruppetilhørighet.'), button(`Hent valgt timeplan for ${course.code}`, () => run(operation => loadTeachingSelection(candidate, operation))))
          for (const result of candidate.teachingResults) if (result.sourceUrl) options.append(link(result.sourceUrl, result.label || 'Publisert timeplankilde'))
          timetable.open = true
        }
        card.append(timetable)
      }
      previewHost.append(card)
    }
    const warnings=el('details');warnings.append(el('summary','Kildeopplysninger og mangler'));for(const warning of [...new Set(preview.warnings)])warnings.append(el('p',warning));previewHost.append(warnings)
    if(preview.candidates.some(item=>item.calendarUrl&&!item.parsed))previewHost.append(button('Hent tilgjengelig undervisning',()=>run(teaching)))
    previewHost.append(button('Bekreft programimport',()=>run(commit)),button('Tilbake til emnevalg',()=>{preview=null;previewHost.hidden=true;showChoices();periodSelect.focus()}));previewHost.scrollIntoView({block:'start'});heading.focus()
  }
  async function commit() {
    if(!preview)return
    if(preview.selection!==selectionSnapshot())throw new Error('Programvalget er endret. Lag en ny forhåndsvisning før du lagrer.')
    for(const candidate of preview.candidates)if(candidate.parsed&&candidate.teachingSnapshot!==teachingSnapshot(candidate)){clearTeaching(candidate,false);throw new Error('Timeplanvalget er endret. Hent ønsket timeplan og velg aktivitetene på nytt før du bekrefter.')}
    if(preview.baseline!==JSON.stringify(state()))throw new Error('Dataene er endret etter forhåndsvisningen. Lag en ny forhåndsvisning før du lagrer.')
    let next=structuredClone(state());for(const candidate of preview.candidates){next=mergeCourseOnly(next,candidate.course);if(candidate.parsed)next=mergeImport(next,candidate.parsed.events,candidate.source,{course:candidate.course,...disappearancePolicy(candidate.source,candidate.course,candidate.parsed),selection:{groups:candidate.source.groups,excludedKeys:candidate.source.excludedKeys}}).planner}
    if(!validPlanner(next))throw new Error('Importplanen inneholder ugyldige opplysninger. Ingen data er lagret.')
    const count=preview.candidates.length, saved=await commitPlanner(next)
    if(saved===false || saved?.ok===false)throw new Error(saved?.error || 'Lagringen ble avvist. Forhåndsvisningen er beholdt.')
    preview=null;touched=false;previewHost.hidden=true;showChoices();status(`${count} emner og valgte undervisningsøkter er lagret samlet. Tidligere emne-ID-er, notater og oppgavelenker er beholdt.`);message.tabIndex=-1;message.focus()
  }
  return {hasDraft:()=>busy||Boolean(preview)||touched,open(){section.hidden=false;institution.focus()},close(){version++;controller?.abort();busy=false;setBusy();section.hidden=true},element:section}
}
