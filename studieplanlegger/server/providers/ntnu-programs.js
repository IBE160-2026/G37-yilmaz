import { load, clean, fail, cachedText, restrictedUrl, asCredits, periodLabel } from './program-source.js'
const catalogue = 'https://www.ntnu.no/studier/alle', planning = 'https://www.ntnu.no/studier/studieplan'
const validate = input => restrictedUrl(input, { origin: 'https://www.ntnu.no', paths: [/^\/(?:web\/)?studier\/(?:alle|studieplan)$/], keys: ['p_p_id','p_p_lifecycle','p_p_state','p_p_mode','p_p_resource_id','p_p_cacheability','code','year','p_auth'] })
const validCode = code => typeof code === 'string' && /^[\p{L}\d][\p{L}\d._-]{0,79}$/u.test(code)
async function endpoint(kind, fetchText) {
  const html = await cachedText(fetchText, kind==='allStudies'?catalogue:planning, validate)
  const href = kind==='allStudies' ? load(html)('[data-allstudiesurl]').attr('data-allstudiesurl') : html.match(new RegExp(`${kind}Url:['"]([^'"]+)['"]`))?.[1]
  if (!href) fail('not-supported', 'NTNUs publiserte programkontrakt har endret format.')
  const url = validate(href)
  if (url.searchParams.get('p_p_resource_id') !== kind || url.searchParams.get('p_p_lifecycle') !== '2') fail('not-supported', 'Programkilden oppgir ikke et tillatt offentlig leseendepunkt.')
  return url
}
export function parseNtnuProgramPlan(data, query, sourceUrl) {
  const plan = data.studyplan
  if (!plan || plan.code !== query.program || String(plan.year) !== String(query.cohort) || !Array.isArray(plan.studyPeriods)) fail('invalid-selection','NTNU returnerte en annen eller upublisert program-/kullversjon.')
  const models = new Map(), warnings = [], start = /^(HØST|H|AUTUMN)$/i.test(plan.startTerm) ? 1 : /^(VÅR|V|SPRING)$/i.test(plan.startTerm) ? 0 : null
  if (start === null) fail('not-supported', 'NTNU oppgir ikke et entydig startsemester. Kalendersemester kan ikke bekreftes fra denne planen.')
  function direction(node, period, path = [], inherited = [], depth = 0) {
    if (!node || depth > 10) { if (node) warnings.push('Studieretningene er dypere enn sikkerhetsgrensen. Den delen er ikke importert.'); return }
    const currentPath = node.code ? [...path,{code:clean(node.code),name:clean(node.name)||clean(node.code)}] : path
    const groups = [...inherited,...(node.courseGroups || [])]
    const children = Array.isArray(node.studyDirection) ? node.studyDirection : node.studyDirection ? [node.studyDirection] : []
    if (children.length) { for (const child of children) direction(child,period,currentPath,groups,depth+1); return }
    const key = currentPath.map(p=>p.code).join('/') || 'common', name = currentPath.map(p=>p.name).join(' / ') || 'Felles studiemodell'
    if (!models.has(key)) models.set(key,{id:key,name,periods:[]})
    const model = models.get(key), ordinal = Number(period.periodNumber)
    if (!Number.isInteger(ordinal)||ordinal<1||ordinal>40) { warnings.push('En periode har ukjent studiesemesternummer og er utelatt.'); return }
    const offset = start + ordinal - 1, term = { year: Number(plan.year)+Math.floor(offset/2), semester: offset%2===0?'spring':'autumn' }
    const output = {id:`${key}:${ordinal}`,studySemester:ordinal,...term,label:periodLabel(ordinal,term),courses:[],requirements:[]}
    for (const group of groups) {
      if (group.description) output.requirements.push(`${clean(group.name)}: ${clean(group.description)}`)
      for (const course of group.courses || []) {
        if (course?.planelement) { output.requirements.push(clean(course.name)); continue }
        if (!validCode(course?.code) || !clean(course?.name)) { warnings.push('En emnerad mangler kode/navn og er utelatt.'); continue }
        const value = {id:`ntnu:${course.code}:${term.year}:${term.semester}`,code:course.code,name:clean(course.name),credits:asCredits(course.credit),choice:clean(course.studyChoice?.code),choiceLabel:clean(course.studyChoice?.name),university:'NTNU',description:'',notes:'',sourceUrl,sourceRecordId:course.code,sourceProvider:'ntnu',sourceVersion:`${term.year}${term.semester==='spring'?'V':'H'}`,courseVersion:clean(course.version),...term,campus:'',courseGroup:clean(group.name)}
        if (!output.courses.some(c=>c.code===value.code && c.choice===value.choice)) output.courses.push(value)
      }
    }
    model.periods.push(output)
  }
  for (const period of plan.studyPeriods) direction(period.direction,period)
  // Preserve each source path before inheritance. A later specialization gets
  // its actual ancestors' semesters, with its own/nearest period taking priority.
  const published = new Map([...models].map(([key, model]) => [key, [...model.periods]]))
  for (const [key, model] of models) {
    const ancestors = [...published.keys()].filter(parent => parent !== key && (parent === 'common' || key.startsWith(`${parent}/`))).sort((a, b) => b.split('/').length - a.split('/').length || Number(a === 'common') - Number(b === 'common'))
    for (const parent of ancestors) for (const period of published.get(parent)) if (!model.periods.some(own => own.studySemester === period.studySemester)) model.periods.push(period)
    model.periods.sort((a, b) => a.studySemester - b.studySemester)
  }
  if (!models.size && warnings.length) fail('not-supported', [...new Set(warnings)].join(' '))
  if (!models.size) fail('semester-unavailable','Det valgte kullet har ingen publiserte studieperioder.')
  return {status:'ok',program:{code:plan.code,name:clean(plan.name),cohort:String(plan.year),sourceUrl,campuses:[],sourceUpdated:clean(plan.updated)},models:[...models.values()],warnings:[...warnings,'Bare publiserte studieperioder er hentet. Senere studiesemestre kan være upubliserte.','Studieretning, valgemner, campus og undervisningsgrupper velges av deg.'],completeness:{complete:!warnings.length,pages:1,returned:plan.studyPeriods.length,scope:'Alle perioder i kildens valgte kullversjon; ikke garanti for hele studieløpet.'}}
}
export async function ntnuPrograms(action, query, { fetchText }) {
  if (action==='programs') {
    const url = await endpoint('allStudies',fetchText), data=JSON.parse(await cachedText(fetchText,url.href,validate))
    if (!Array.isArray(data.docs) || !Number.isInteger(data.numFound)) fail('not-supported','NTNUs programliste har endret format.')
    const results = data.docs.filter(item=>validCode(item?.studyprogCode)&&clean(item?.studyprogName)).map(item=>({code:item.studyprogCode,name:clean(item.studyprogName),level:clean(item.studyprogStudyLevel),sourceUrl:planning,campuses:Array.isArray(item.studyprogCities)?item.studyprogCities:[],campusNames:Array.isArray(item.studyprogCampuses)?item.studyprogCampuses:[]}))
    const complete = data.docs.length===data.numFound, q=clean(query.q).toLocaleLowerCase('nb'),omitted=data.docs.length-results.length
    return {status:'ok',results:results.filter(item=>!q||`${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q)),sourceUrl:catalogue,completeness:{complete:complete&&!omitted,pages:1,returned:results.length,total:data.numFound,omitted,...(!complete?{reason:'Den publiserte allStudies-listen er ufullstendig; ingen pagineringskontrakt er oppgitt.'}:{})},warnings:[...(!complete?['NTNU returnerte færre program enn oppgitt total. Listen er ufullstendig.']:[]),...(omitted?[`${omitted} publiserte rader mangler en lesbar programkode eller et programnavn og er utelatt. Ingen identitet er gjettet.`]:[])]}
  }
  if (!validCode(query.program)) fail('invalid-selection','Velg en gyldig programkode fra NTNU-listen.')
  if (action==='program-cohorts') {
    const url=await endpoint('yearlist',fetchText);url.searchParams.set('code',query.program)
    const data=JSON.parse(await cachedText(fetchText,url.href,validate))
    if (!Array.isArray(data.yearList)) fail('not-supported','NTNU har ingen publisert kulliste for dette programmet.')
    return {status:'ok',results:data.yearList.filter(year=>/^\d{4}$/.test(String(year))).map(year=>({cohort:String(year),label:String(year),sourceUrl:planning})),warnings:[],completeness:{complete:true,pages:1,returned:data.yearList.length}}
  }
  if (!/^\d{4}$/.test(String(query.cohort))) fail('invalid-selection','Velg et publisert opptakskull.')
  const url=await endpoint('studyplan',fetchText);url.searchParams.set('code',query.program);url.searchParams.set('year',String(query.cohort))
  return parseNtnuProgramPlan(JSON.parse(await cachedText(fetchText,url.href,validate)),query,url.href)
}
