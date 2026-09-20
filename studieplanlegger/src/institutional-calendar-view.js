import { parseDocumentInput, createDocumentImportPreview, renderDocumentImportPreview } from './document-import.js'
import {filterInstitutionalSemester} from './institutional-calendar-period.js'
import { osloYear } from './planner.js'

const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node}
const calendarKinds={
  ansgar:{label:'Ansgar – publiserte timeplaner',prefix:'Ansgar',sourceKind:'ansgar-public-class',load:'Hent offentlige Ansgar-timeplaner',allowQuery:true,valid:u=>u.origin==='https://ansgarskolenno-my.sharepoint.com'&&u.pathname.startsWith('/:b:/g/personal/kvalitet_ansgarskolen_no/')},
  fih:{label:'Fjellhaug – publiserte klassekalendere',prefix:'FIH',sourceKind:'fih-public-class',load:'Hent offentlige Fjellhaug-klasser',allowQuery:true,valid:u=>u.origin==='https://fih.edupage.org'&&u.pathname==='/webcal'},
  plandisc:{label:'Plandisc – informasjonskalender',prefix:'Plandisc',valid:u=>u.origin==='https://create.plandisc.com'&&/^\/wheel\/showPublic\/[A-Za-z0-9_-]{5,100}\/?$/.test(u.pathname)},
  hfy:{label:'HØFY – publiserte klasseplaner',prefix:'HØFY',sourceKind:'hfy-public-class',load:'Hent offentlige HØFY-klasseplaner',valid:u=>u.origin==='https://s3-gustav.imgix.net'&&/^\/hfy\/[^/]+\.pdf$/.test(u.pathname)},
  gestalt:{label:'Gestalt – publiserte samlingsplaner',prefix:'Gestalt',sourceKind:'gestalt-public-class',load:'Hent offentlige Gestalt-klasser',valid:u=>u.origin==='https://img1.wsimg.com'&&/^\/blobby\/go\/[a-f\d-]{36}\/[^/]+\.pdf$/i.test(u.pathname)},
  phs:{label:'Politihøgskolen – publiserte eksamener',prefix:'PHS',sourceKind:'phs-public-exam',load:'Hent offentlige eksamensoversikter',valid:u=>u.origin==='https://www.politihogskolen.no'&&/^\/for-studenter\/eksamen\/eksamensoversikt-(ba|ma)\/?$/.test(u.pathname)},
}
export function mountInstitutionalCalendar(host,{getState,onCommit,api}) {
  const root=el('details'),form=el('form'),output=el('div'),message=el('p');root.name='calendar-import-method'
  root.className='institutional-calendar-import';form.className='subject-fields';message.setAttribute('role','status')
  root.append(el('summary','Offentlig institusjonskalender'),el('p','Velg en publisert kalenderplan og de oppføringene som gjelder deg. Plandisc gir informasjon; Ansgar, Fjellhaug, HØFY og Gestalt tilbyr publiserte klasseplaner; Politihøgskolen publiserer eksamener og innleveringsfrister. Velg selv hvilken plan og hvilke aktiviteter som gjelder deg. Kalenderen kan hentes på nytt.'),form,message,output);host.append(root)
  const kindLabel=el('label','Offentlig kalenderkilde'),kind=el('select');kindLabel.append(kind);form.append(kindLabel)
  for(const [value,config]of Object.entries(calendarKinds)){const option=el('option',config.label);option.value=value;kind.append(option)}kind.value='plandisc'
  const field=(name,label,type='text')=>{const wrap=el('label',label),input=el('input');input.type=type;input.name=name;input.required=true;wrap.append(input);form.append(wrap);return input}
  const url=field('institutionalUrl','Offentlig Plandisc-lenke'),year=field('institutionalYear','Kalenderår','number');year.min='1900';year.max='2200';year.value=String(osloYear())
  const classBox=el('div'),loadClasses=el('button','Hent offentlige HØFY-klasseplaner'),classLabel=el('label','Publisert klasseplan'),classes=el('select');loadClasses.type='button';classBox.hidden=true;classLabel.append(classes);classBox.append(loadClasses,classLabel);form.prepend(classBox)
  const sourceChoices=new Map()
  const label=el('label','Kalendersemester'),semester=el('select');semester.name='institutionalSemester';semester.required=true
  for(const [value,text]of [['','Velg semester'],['spring','Vår'],['autumn','Høst']]){const option=el('option',text);option.value=value;semester.append(option)}label.append(semester);form.append(label)
  const read=el('button','Forhåndsvis institusjonskalender'),cancel=el('button','Avbryt henting');read.type='submit';cancel.type='button';cancel.hidden=true;form.append(read,cancel)
  let pending=null,draft=false,version=0
  const selection=()=>JSON.stringify([url.value,year.value,semester.value,kind.value,classes.value])
  const setBusy=()=>{read.disabled=loadClasses.disabled=Boolean(pending);cancel.hidden=!pending;root.setAttribute('aria-busy',String(Boolean(pending)))}
  const stop=()=>{version++;pending?.controller.abort();pending=null;setBusy()}
  const invalidate=()=>{const changed=draft||pending;stop();draft=false;output.replaceChildren();if(changed)message.textContent='Kalendervalget er endret. Hent en ny forhåndsvisning. Lagrede data er beholdt.'}
  const begin=()=>{stop();const operation={version:++version,controller:new AbortController()};pending=operation;setBusy();return operation}
  const current=operation=>pending===operation&&operation.version===version&&!operation.controller.signal.aborted
  const finish=operation=>{if(pending===operation){pending=null;setBusy()}}
  cancel.onclick=()=>{stop();message.textContent='Hentingen er avbrutt. Valgene og lagrede data er beholdt. Du kan prøve igjen.';read.focus()}
  kind.onchange=()=>{invalidate();url.value='';url.parentElement.hidden=kind.value!=='plandisc';url.required=kind.value==='plandisc';classBox.hidden=kind.value==='plandisc';classes.replaceChildren();sourceChoices.clear();loadClasses.textContent=calendarKinds[kind.value].load||'';classLabel.firstChild.textContent=kind.value==='phs'?'Publisert eksamensoversikt':'Publisert klasseplan'}
  classes.onchange=()=>{invalidate();url.value=sourceChoices.get(classes.value)?.sourceUrl||''}
  url.oninput=year.oninput=semester.onchange=invalidate
  loadClasses.onclick=async()=>{
    if(pending)return
    invalidate();const operation=begin(),selectedKind=kind.value,snapshot=selection();message.textContent='Henter publiserte kalenderplaner …'
    try{
      const data=await api(`/api/import/calendar-sources/${selectedKind}`,{signal:operation.controller.signal})
      if(!current(operation)||snapshot!==selection())return
      classes.replaceChildren();sourceChoices.clear();const empty=el('option','Velg din publiserte kalenderplan');empty.value='';classes.append(empty)
      for(const item of data.results||[]){const option=el('option',item.name);option.value=item.sourceUrl+(item.sourceObjectId?`#${encodeURIComponent(item.sourceObjectId)}`:'');sourceChoices.set(option.value,item);classes.append(option)}
      classes.value='';url.value='';message.textContent=(data.warnings||[]).join(' ');classes.focus()
    }catch(error){if(current(operation))message.textContent=error.name==='AbortError'?'Hentingen er avbrutt. Valgene er beholdt.':error.message}finally{finish(operation)}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending)return;invalidate();const operation=begin(),snapshot=selection();message.textContent='Henter offentlig kalender …'
    try {
      if(kind.value!=='plandisc'&&!sourceChoices.has(classes.value))throw new Error('Velg en publisert kalenderplan først.')
      const source=new URL(url.value.trim()),period={year:Number(year.value),semester:semester.value},selectedKind=kind.value,config=calendarKinds[selectedKind],sourceObjectId=sourceChoices.get(classes.value)?.sourceObjectId
      if(source.search&&!config.allowQuery||source.hash||source.username||source.password||!config.valid(source))throw new Error('Velg en publisert kalenderlenke fra den valgte kilden.')
      source.pathname=source.pathname.replace(/\/$/,'')
      const data=await api('/api/import/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source.href,...(sourceObjectId?{sourceObjectId}:{})}),signal:operation.controller.signal})
      if(!current(operation))return
      if(snapshot!==selection())throw new Error('Kalendervalget er endret under henting. Hent en ny forhåndsvisning.')
      if(selectedKind==='plandisc'?!data.institutional:data.sourceKind!==config.sourceKind)throw new Error('Kilden bekrefter ikke den valgte offentlige kalenderen.')
      const parsed=filterInstitutionalSemester(await parseDocumentInput(data.calendar,{format:'ics',...period,fileName:data.name,signal:operation.controller.signal}),period)
      if(!current(operation))return
      if(snapshot!==selection())throw new Error('Kalendervalget er endret under henting. Hent en ny forhåndsvisning.')
      parsed.complete=false;parsed.warnings.push(...(data.warnings||[]))
      for(const item of data.unresolved||[])if(!parsed.warnings.some(w=>w.includes(item.sourceExcerpt)))parsed.warnings.push(`Uavklart kildeoppføring: ${item.sourceExcerpt}. ${item.reason}`)
      const publicSource=selectedKind==='fih'?sourceChoices.get(classes.value)?.catalogueUrl||'https://fih.fjellhaug.no/student':source.href
      for(const row of parsed.rows){row.selected=false;row.courseHint='';if(data.institutional){row.information=true;row.transparent=true}if(row.kind==='event'&&row.transparent)row.information=true;if(selectedKind==='phs'&&row.kind==='task'&&row.title.startsWith('Innlevering'))row.requiresSubmission=true;row.snippet=`${publicSource}\n${row.snippet}`}
      const name=`${config.prefix} ${source.pathname.split('/').at(-1)}${sourceObjectId?` ${sourceObjectId}`:''} · ${period.year} ${period.semester}`,existing=(getState().importSources||[]).filter(item=>item.name===name)
      if(existing.length>1)throw new Error('Flere tidligere kilder har samme navn. Velg den riktige kilden gjennom dokumentimport før oppdatering.')
      const preview=createDocumentImportPreview(getState(),parsed,{name,sourceId:existing[0]?.id})
      preview.displayName=`${data.name} · ${period.semester==='autumn'?'Høst':'Vår'} ${period.year}`
      draft=true
      renderDocumentImportPreview(output,preview,{getState,onBack:()=>{invalidate();message.textContent='Valgene er beholdt. Du kan hente kalenderen på nytt.';read.focus()},onConfirm:async(candidate,result)=>{
        if(!draft||snapshot!==selection())return{ok:false,error:'Kalendervalget er endret. Hent en ny forhåndsvisning før du bekrefter.'}
        const saved=await onCommit(candidate,result);if(saved?.ok){draft=false;url.value='';classes.value='';output.replaceChildren();message.textContent=`Institusjonskalender lagret: ${result.counts.added} nye og ${result.counts.updated} oppdaterte oppføringer. ${data.institutional?'Ingen arbeidstid er reservert.':'Bare valgte faste samlinger reserverer tid; informasjonsoppføringer gjør det ikke.'}`}return saved
      }})
      message.textContent=`${parsed.rows.length} ${data.institutional?'informasjonsoppføringer':'kalenderoppføringer'} i valgt semester. Ingen er valgt automatisk.`
    }catch(error){if(current(operation))message.textContent=error.name==='AbortError'?'Hentingen er avbrutt. Valgene er beholdt.':error.message}finally{finish(operation)}
  })
  return {hasDraft:()=>pending||draft||Boolean(url.value.trim())}
}
