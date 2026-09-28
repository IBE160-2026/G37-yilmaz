import { nextTeachingCheck } from './planner.js'

export function teachingOutcome(error) {
  const status=error?.status
  if(status==='not-supported')return'unsupported'
  if(status==='source-changed')return'invalid-response'
  if(['timeout','transport-error','invalid-response','access-required','unsupported'].includes(status))return status
  if(error?.name==='TimeoutError'||/for lang tid|timeout/i.test(error?.message||''))return'timeout'
  if(/401|403|tilgang|innlogging/i.test(error?.message||''))return'access-required'
  if(/JSON|format|lesbar|ugyldig|mangler/i.test(error?.message||''))return'invalid-response'
  return'transport-error'
}

export function checkedTeaching(course,status,{eventCount,source='public-teaching',detail='',now}={}){
  return{...course,teachingCheck:nextTeachingCheck(status,course.teachingCheck,{eventCount,source,detail,now})}
}

export function teachingCheckText(check){
  if(!check)return'Undervisning er ikke kontrollert.'
  const at=new Date(check.lastAttempt).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}),success=check.lastSuccess?new Date(check.lastSuccess).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}):''
  const label={success:Number.isSafeInteger(check.eventCount)?`${check.eventCount} publiserte undervisningsøkter ble hentet`:'Undervisning ble hentet',empty:'Kilden svarte uten publiserte undervisningsøkter',timeout:'Kontrollen brukte for lang tid', 'transport-error':'Kilden kunne ikke kontaktes', 'invalid-response':'Kildesvaret kunne ikke valideres', 'access-required':'Kilden krevde tilgang',unsupported:'Offentlig undervisningshenting støttes ikke'}[check.status]
  return`${label}. Siste forsøk: ${at}.${success&&check.status!=='success'&&check.status!=='empty'?` Siste vellykkede kontroll: ${success}. Tidligere kontrollresultat og lagrede undervisningsdata er beholdt.`:''}${check.detail?` ${check.detail}`:''}`
}
