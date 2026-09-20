import { load, clean, fail, cachedText, restrictedUrl, MAX_PAGES, MAX_RESULTS } from './program-source.js'

const origin='https://www.kristiania.no',catalogue=`${origin}/studieportal/`
const pagePath=/^\/studieportal\/[^/]+\/(?:bachelorniva|masterniva|doktorgradsniva)\/[^/]+\/[^/]+\/?$/
export const kristianiaProgramUrl=input=>restrictedUrl(input,{origin,paths:[/^\/studieportal\/$/,pagePath,/^\/api\/search\/syllabus$/,/^\/api\/syllabus-descriptions\/(?:programs|subjects)\/\d+$/],keys:['types','phrase','skip','take','year','period']})
const pageUrl=input=>{const url=kristianiaProgramUrl(input);if(!pagePath.test(url.pathname)||[...url.searchParams.keys()].some(key=>!['year','period'].includes(key)))fail('invalid-selection','Velg en publisert høyskoleplan fra Kristianias studieportal.');return url}
const pageCode=url=>decodeURIComponent(url.pathname.replace(/\/$/,'').split('/').at(-2)).toUpperCase()
export function kristianiaProps(html, key) {
  const $=load(html),results=[]
  for(const node of $('script:not([src])').toArray()){
    // Read the source's inert JSON assignment; never execute imported scripts.
    const match=$(node).text().match(/^\s*\(window\.__reactProps = window\.__reactProps \|\| \{\}\)\['[^']+-json'\] = (\{[\s\S]*\});\s*$/)
    if(!match)continue
    let value;try{value=JSON.parse(match[1])}catch{continue}
    if(Object.hasOwn(value,key))results.push(value)
  }
  if(results.length!==1)fail('source-changed',`Kristianias publiserte ${key}-kontrakt mangler eller er tvetydig.`)
  return results[0]
}
function exactText(fetchText,input){const expected=kristianiaProgramUrl(input),identity=url=>{const result=new URL(url);if(pagePath.test(result.pathname))result.pathname=result.pathname.replace(/\/$/,'');return result.href};return cachedText(fetchText,expected.href,input=>{const url=kristianiaProgramUrl(input);if(identity(url)!==identity(expected))fail('invalid-selection','Kristiania videresendte til et annet kildeutvalg.');return url})}
function edition(props,query,source){
  if(clean(props.code).toUpperCase()!==query.program.toUpperCase()||pageCode(source)!==query.program.toUpperCase())fail('invalid-selection','Programkoden og Kristianias programside samsvarer ikke.')
  if(!Array.isArray(props.semesterDropdownItems)||!props.semesterDropdownItems.length)fail('not-supported','Programmet har ingen publisert kullvelger.')
  const endpoint=kristianiaProgramUrl(new URL(props.getProgramUrl,origin))
  if(!/^\/api\/syllabus-descriptions\/programs\/\d+$/.test(endpoint.pathname)||endpoint.search)fail('source-changed','Kristianias programkilde har endret format.')
  return props.semesterDropdownItems.map(item=>{
    const {year,period}=item.semester||{}
    if(!Number.isInteger(year)||year<1900||year>2200||!['spring','fall'].includes(period))fail('source-changed','Kristianias kullvelger har en ukjent termin.')
    const url=new URL(source);url.search='';url.searchParams.set('year',year);url.searchParams.set('period',period)
    return {cohort:String(year),intake:period==='fall'?'autumn':'spring',label:clean(item.displayName),sourceUrl:url.href,endpoint:endpoint.href,period,year,name:clean(item.semesterSpecificItemName)||clean(props.name)}
  })
}
export function parseKristianiaPlan(data,props,selected,sourceUrl){
  if(data.programSemesterStart?.year!==selected.year||data.programSemesterStart?.period!==selected.period)fail('invalid-selection','Kristiania returnerte en annen kullutgave.')
  if(data.hideOriginalDescription)fail('not-supported','Kilden har skjult denne opprinnelige programbeskrivelsen. Bruk det publiserte dokumentet med eksplisitt avklaring.')
  const sections=data.programDescription?.textSections,combination=data.programDescription?.subjectCombination
  if(!Array.isArray(combination))fail('source-changed','Kristianias emneoppbygging mangler i den valgte kullutgaven.')
  const rows=combination.flatMap(year=>{if(!Array.isArray(year.programSubjects))fail('source-changed','Kristianias semesterstruktur er endret.');return year.programSubjects})
  if(!rows.length||rows.length>40)fail('not-supported','Kullutgaven har ingen støttet offentlig semesteroppbygging.')
  const warnings=[],requirements=(sections||[]).filter(section=>section.body).map(section=>`${clean(section.heading)}: ${clean(load(section.body).text())}`)
  const version=`${selected.year}${selected.period==='fall'?'H':'V'}`
  const periods=rows.map((row,index)=>{
    if(!Array.isArray(row.subjects)||!['fall','spring'].includes(row.period))fail('source-changed','Kristiania oppgir en ukjent emneliste eller semesterperiode.')
    const ordinal=index+1,semester=row.period==='fall'?'autumn':'spring',offset=(selected.period==='fall'?1:0)+index,expectedYear=selected.year+Math.floor(offset/2),expectedSemester=offset%2?'autumn':'spring'
    const links=row.subjects.map(subject=>pageUrl(new URL(subject.url,origin)))
    const confirmed=semester===expectedSemester&&links.length>0&&links.every(url=>+url.searchParams.get('year')===expectedYear&&url.searchParams.get('period')?.toLowerCase()===row.period)
    const year=confirmed?expectedYear:null,period={id:`${version}:${ordinal}`,studySemester:ordinal,year,semester,label:`${ordinal}. studiesemester · ${semester==='autumn'?'Høst':'Vår'}${year?` ${year}`:' – avklar kalenderår'}`,courses:[],requirements:[...requirements]}
    if(!confirmed)warnings.push(`${ordinal}. studiesemester: ikke alle emnelenkene bekrefter samme kalenderår og termin som kulløpet. Kalenderåret må avklares.`)
    row.subjects.forEach((subject,courseIndex)=>{
      const code=clean(subject.code),name=clean(subject.name),specialization=clean(subject.specialization),url=links[courseIndex]
      if(!name)fail('source-changed','En Kristiania-emnerad mangler navn.')
      if(/^(?:Utveksling|Valgemner)$/i.test(name)||(/999/.test(code)&&name.includes(':'))){period.requirements.push(`${name}${code?` (${code})`:''}${specialization?` · ${specialization}`:''}: valg-/utvekslingsområde; innhold må avklares fra kilden.`);return}
      if(period.courses.some(course=>course.code===code&&course.courseGroup===specialization))fail('source-changed','Kristiania gjentar samme emne og spesialisering i en semesterkolonne.')
      period.courses.push({id:`kristiania:${props.code}:${version}:${ordinal}:${code||courseIndex}:${specialization}`,code,name,credits:null,choice:specialization?'V':'',courseGroup:specialization,university:'Kristiania',year,semester,campus:'',description:'',notes:specialization?`Publisert spesialisering: ${specialization}. Velg bare din retning.`:'Emnetype er ikke uttrykkelig oppgitt i emneraden; velg selv.',sourceUrl:url.href,sourceProvider:'kristiania-program',sourceRecordId:code||url.pathname,sourceVersion:version})
    })
    return period
  })
  return {status:'ok',program:{code:clean(props.code),name:selected.name,cohort:String(selected.year),sourceUrl,campuses:clean(props.locations)?clean(props.locations).split(',').map(clean):[]},models:[{id:version,name:`Publisert kullutgave ${selected.label}`,periods}],warnings:[...warnings,'Semestrene følger samme publiserte rekkefølge som Kristianias programvisning. Studiepoeng og full emnebeskrivelse hentes separat når den eksakte emneutgaven er tilgjengelig. Emnetype uten uttrykkelig kildeverdi forhåndsvelges ikke.'],completeness:{complete:true,pages:1,returned:periods.reduce((count,period)=>count+period.courses.length,0),scope:'Alle returnerte semesterblokker i valgt kildeutgave. Valgområder er plankrav, ikke navngitte emner.'}}
}
export async function kristianiaPrograms(institution,action,query,{fetchText}){
  if(action==='programs'){
    const props=kristianiaProps(await exactText(fetchText,catalogue),'searchUrl'),endpoint=kristianiaProgramUrl(new URL(props.searchUrl,origin))
    if(endpoint.pathname!=='/api/search/syllabus'||endpoint.search||!props.facets?.some(facet=>facet.id==='types'&&facet.options?.some(item=>item.id==='Program')))fail('source-changed','Kristianias publiserte programsøk har endret format.')
    const results=new Map(),warnings=[];let skip=0,pages=0,total=null,complete=true
    while(pages<MAX_PAGES&&skip<MAX_RESULTS){
      const url=new URL(endpoint);url.searchParams.set('types','Program');if(clean(query.q))url.searchParams.set('phrase',clean(query.q));url.searchParams.set('skip',skip);url.searchParams.set('take','10')
      let data;try{data=JSON.parse(await exactText(fetchText,url))}catch(error){if(!pages||error.name==='AbortError')throw error;complete=false;warnings.push(`Neste resultatside kunne ikke leses: ${error.message}`);break}
      if(!Array.isArray(data.items)||!Number.isInteger(data.totalCount)||data.totalCount<0)fail('source-changed','Kristianias resultatliste eller antall har endret format.')
      if(total!==null&&total!==data.totalCount){complete=false;warnings.push('Kildens totaltall endret seg under henting. Søk igjen for et oppdatert utvalg.')}
      total=data.totalCount;pages++
      for(const row of data.items){if(/fagskole/i.test(`${row.level} ${row.school}`))continue;const source=pageUrl(new URL(row.url,origin));if(!clean(row.name))fail('source-changed','Programraden mangler navn.');results.set(source.href,{code:pageCode(source),name:clean(row.name),level:clean(row.level),sourceUrl:source.href,campuses:Array.isArray(row.locations)?row.locations.map(clean):[]})}
      skip+=data.items.length;if(skip>=total)break
      if(!data.items.length){complete=false;warnings.push('Kilden sluttet å returnere treff før det oppgitte totaltallet.');break}
    }
    if(skip<(total??0))complete=false
    return {status:'ok',results:[...results.values()],warnings:[...warnings,'Bare høyere utdanning fra det kildepubliserte programfilteret. Fagskole er utelatt. Aktiv, fremtidig og utgått kildeutgave kan forekomme; velg publisert kull selv.'],sourceUrl:catalogue,completeness:{complete,pages,returned:results.size,total,scope:'Kildens programfilter og søketekst, etter avgrensing bort fra fagskole.'}}
  }
  const source=pageUrl(query.sourceUrl),props=kristianiaProps(await exactText(fetchText,source),'getProgramUrl'),editions=edition(props,query,source)
  if(action==='program-cohorts')return {status:'ok',results:editions.map(({endpoint,period,year,name,...row})=>row),warnings:['Bare startår og termin som faktisk finnes i den publiserte kullvelgeren.']}
  if(action!=='program-plan')fail('not-supported','Kristiania-programkilden støtter ikke handlingen.')
  const selected=editions.find(item=>item.cohort===String(query.cohort)&&item.year===+source.searchParams.get('year')&&item.period===source.searchParams.get('period'))
  if(!selected)fail('invalid-selection','Velg kullutgave fra Kristianias programvelger.')
  const endpoint=new URL(selected.endpoint);endpoint.searchParams.set('year',selected.year);endpoint.searchParams.set('period',selected.period)
  return parseKristianiaPlan(JSON.parse(await exactText(fetchText,endpoint)),props,selected,source.href)
}
export async function kristianiaDetails(query,fetchText){
  const source=pageUrl(query.sourceUrl),year=Number(query.year),period=query.semester==='autumn'?'fall':'spring'
  source.search='';source.searchParams.set('year',year);source.searchParams.set('period',period)
  const props=kristianiaProps(await exactText(fetchText,source),'getDescriptionUrl')
  if(clean(props.code).toUpperCase()!==clean(query.code).toUpperCase())fail('invalid-selection','Kristianias emnebeskrivelse gjelder en annen emnekode.')
  if(!props.semesterDropdownItems?.some(item=>item.semester?.year===year&&item.semester.period===period))fail('semester-unavailable','Denne emneutgaven finnes ikke i Kristianias publiserte periodevelger.')
  let data=props.description
  if(data?.year!==year||data?.period!==period){const endpoint=kristianiaProgramUrl(new URL(props.getDescriptionUrl,origin));if(!/^\/api\/syllabus-descriptions\/subjects\/\d+$/.test(endpoint.pathname)||endpoint.search)fail('source-changed','Kristianias emnekontrakt har endret format.');endpoint.searchParams.set('year',year);endpoint.searchParams.set('period',period);data=JSON.parse(await exactText(fetchText,endpoint))}
  if(data?.year!==year||data?.period!==period||!Array.isArray(data.description))fail('semester-unavailable','Kristiania bekreftet ikke den valgte emneperioden.')
  const text=value=>{const $=load(value?.value||value||'');$('script,style').remove();$('p,li,h1,h2,h3,br').each((_,node)=>$(node).append('\n'));return clean($.text())}
  const description=data.description.map(section=>`${clean(section.heading)}: ${text(section.body)}`).join('\n\n')
  return {status:'ok',course:{id:`kristiania:${props.code}:${year}:${query.semester}`,code:clean(props.code),name:clean(data.name||props.name),university:'Kristiania',year,semester:query.semester,credits:typeof props.points==='number'&&Number.isFinite(props.points)&&props.points>=0?props.points:null,description,notes:'',sourceUrl:source.href,sourceProvider:'kristiania',sourceRecordId:clean(props.code),sourceVersion:`${year}${period==='fall'?'H':'V'}:${clean(props.version)}`},warnings:[]}
}
