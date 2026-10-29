import { nextTeachingCheck } from './planner.js'

export function teachingOutcome(error) {
  const status=error?.status
  if(status==='not-supported')return'unsupported'
  if(status==='source-changed')return'invalid-response'
  if(['timeout','transport-error','invalid-response','access-required','unsupported'].includes(status))return status
  if(error?.name==='TimeoutError'||/for lang tid|timeout/i.test(error?.message||''))return'timeout'
  if(/HTTP\s*(?:401|403)\b/i.test(error?.message||''))return'transport-error'
  if(/JSON|format|lesbar|ugyldig|mangler|ikke en kalender/i.test(error?.message||''))return'invalid-response'
  return'transport-error'
}

export function checkedTeaching(course,status,{eventCount,source='public-teaching',detail='',now}={}){
  return{...course,teachingCheck:nextTeachingCheck(status,course.teachingCheck,{eventCount,source,detail,now})}
}

// A valid empty public calendar is different from an unreadable set of events.
// In either case the source cannot establish that the course has no teaching.
export function teachingCalendarResult(parsed) {
  const rejected = (parsed.accounting?.rejected || 0) + (parsed.accounting?.partial || 0), occurrences = parsed.accounting?.rejectedOccurrences || 0
  if (!parsed.events.length && (rejected || occurrences)) {
    throw Object.assign(new Error('Kalenderen inneholder oppføringer som ikke kunne valideres. Dette er en importfeil, ikke et tomt undervisningstilbud. Kontroller kilden eller bruk filimport.'), { status: 'invalid-response' })
  }
  return { status: parsed.events.length ? 'success' : 'empty', detail: parsed.events.length ? rejected || occurrences
    ? `Delvis kildeuttrekk: ${parsed.events.length} gyldige økter er lest. ${rejected} kalenderoppføringer har valideringsfeil${occurrences ? `; ${occurrences} enkeltforekomster er avvist` : ''}. Manglende oppføringer fjerner ikke tidligere undervisning.` : '' : parsed.accounting?.total
    ? 'Kildens oppføringer gir ingen økter i valgt semester. Kontroller semesteret og den offentlige timeplanen; dette bekrefter ikke at emnet mangler undervisning.'
    : 'Det valgte offentlige kalenderuttrekket er tomt. Dette bekrefter ikke at emnet mangler undervisning. Kontroller timeplanen hos lærestedet, eller bruk filimport/manuell registrering.' }
}

export function failedCalendarRefresh(planner, sourceId, error, { now = new Date() } = {}) {
  const next = structuredClone(planner), source = next.sources.find(item => item.id === sourceId)
  const course = source && next.courses.find(item => item.id === source.courseId)
  if (!source || !course) return null
  Object.assign(source, { lastAttempt: now.toISOString(), lastError: String(error?.message || 'Kilden kunne ikke hentes.').slice(0, 500), failures: (source.failures || 0) + 1 })
  Object.assign(course, checkedTeaching(course, teachingOutcome(error), { now, source: 'calendar-refresh', detail: error.message }))
  return next
}

export function teachingCheckText(check){
  if(!check)return'Undervisning er ikke kontrollert.'
  const at=new Date(check.lastAttempt).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}),success=check.lastSuccess?new Date(check.lastSuccess).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}):''
  const label={success:Number.isSafeInteger(check.eventCount)?`${check.eventCount} publiserte undervisningsøkter ble hentet`:'Undervisning ble hentet',empty:'Ingen økter i valgt offentlig kalender',timeout:'Kontrollen brukte for lang tid', 'transport-error':'Kilden kunne ikke kontaktes', 'invalid-response':'Kildesvaret kunne ikke valideres', 'access-required':'Kilden krevde tilgang',unsupported:'Offentlig undervisningshenting støttes ikke'}[check.status]
  return`${label}. Siste forsøk: ${at}.${success&&check.status!=='success'&&check.status!=='empty'?` Siste vellykkede kontroll: ${success}. Tidligere kontrollresultat og lagrede undervisningsdata er beholdt.`:''}${check.detail?` ${check.detail}`:''}`
}
