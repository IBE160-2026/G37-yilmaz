import { load, clean, fail, cachedText, restrictedUrl, asCredits, periodLabel } from './program-source.js'
const origin='https://www.hvl.no',catalogue=`${origin}/studier/studieprogram/studietilbod/`,listEndpoint=`${origin}/service/search/study/nn-NO/`
const planPath=/^\/studier\/studieprogram\/([^/]+)(?:\/(\d{4})(h|v)\/(studieplan|utdanningsplan))?\/$/i
const validate=input=>restrictedUrl(input,{origin,paths:[planPath,/^\/service\/search\/study\/nn-NO\/$/]})
const ref = input=>{const url=validate(input),match=url.pathname.match(planPath);if(!match)fail('invalid-selection','Velg en publisert HVL-studieplan.');return {url,program:match[1],cohort:match[2],intake:match[3]?.toLowerCase()==='v'?'spring':'autumn',kind:match[4]}}
function sameProgram(input,selected){const next=ref(input);if(next.program!==selected.program||(selected.cohort&&next.cohort!==selected.cohort))fail('invalid-selection','HVL returnerte et annet program eller kull.');return next.url}
export function parseHvlPlan(html,sourceUrl){
  const $=load(html),selected=ref(sourceUrl),periods=new Map(),warnings=[],requirements=[]
  if(!selected.cohort||selected.kind!=='utdanningsplan'||!$('.emner').length)fail('not-supported','Ingen strukturert emneoppbygging er publisert for denne HVL-planen.')
  const expected=new RegExp(`\\b${selected.cohort}\\s*(?:${selected.intake==='spring'?'vår|vaar':'høst|haust'})`,'i')
  if(!expected.test(clean($('#overview').text())))fail('invalid-selection','HVL-sidens publiserte kull samsvarer ikke med valget.')
  let group='',branch=''
  $('.l-2-col__main-content').children().each((_i,node)=>{
    const current=$(node)
    if(node.tagName==='h3'&&current.attr('id')){group=clean(current.text());branch=''}
    if(node.tagName==='h4'&&current.attr('id'))branch=clean(current.text())
    if(current.hasClass('krav'))requirements.push(`${group}${branch?` / ${branch}`:''}: ${clean(current.text())}`)
    if(!current.hasClass('emner'))return
    current.children('li').each((_j,item)=>{
      const row=$(item),code=clean(row.find('.emner__emnekode').text()),title=row.find('.emner__tittellinje').clone();title.find('.emner__emnekode').remove()
      const name=clean(title.text()),semesterText=clean(row.find('.emner__semester').text()),match=semesterText.match(/^Semester:\s*(\d+)$/)
      if(!code||!name||!match){warnings.push(`${code||'Emnerad'} har uavklart studiesemester «${semesterText}» og er ikke plassert automatisk.`);return}
      const ordinal=Number(match[1]);if(ordinal<1||ordinal>40)fail('not-supported','HVL oppgir et studiesemester utenfor importgrensen.')
      const offset=(selected.intake==='autumn'?1:0)+ordinal-1,term={year:Number(selected.cohort)+Math.floor(offset/2),semester:offset%2?'autumn':'spring'}
      if(!periods.has(ordinal))periods.set(ordinal,{id:`${selected.program}:${selected.cohort}:${ordinal}`,studySemester:ordinal,...term,label:periodLabel(ordinal,term),courses:[],requirements:[]})
      const link=row.find('a[href]').attr('href'),courseUrl=link?restrictedUrl(new URL(link,origin),{origin,paths:[/^\/studier\/studieprogram\/emne\/[^/]+\/?$/]}).href:sourceUrl
      const choice=branch?'V':current.hasClass('emner--compulsory')?'O':current.hasClass('emner--elective')?'V':''
      const note=`Emnekombinasjon: ${group}${branch?` / ${branch}. Obligatorisk innen valgt kombinasjon; velg bare dersom dette er din kombinasjon.`:'.'}`
      const course={id:`hvl-program:${selected.program}:${selected.cohort}:${ordinal}:${code}`,code,name,credits:asCredits(clean(row.find('.emner__studiepoeng').text()).replace(/\s*sp$/,'')),choice,sourceProvider:'hvl-program',sourceRecordId:code,sourceVersion:`${selected.cohort}${selected.intake==='spring'?'V':'H'}`,sourceUrl:courseUrl,university:'HVL',description:'',notes:note,...term,campus:''}
      const period=periods.get(ordinal);if(!period.courses.some(c=>c.code===code))period.courses.push(course);else warnings.push(`${code} står i flere kombinasjoner; kontroller valg i kildeplanen.`)
    })
  })
  for(const period of periods.values())period.requirements=[...new Set(requirements)]
  return {status:'ok',program:{code:selected.program,name:clean($('h1').first().text()),cohort:selected.cohort,sourceUrl,campuses:[]},models:[{id:`${selected.program}:${selected.cohort}:${selected.intake}`,name:'Publiserte emnekombinasjoner – velg relevante emner',periods:[...periods.values()].sort((a,b)=>a.studySemester-b.studySemester)}],warnings:[...warnings,'HVL-plankrav og emnekombinasjoner er beholdt. Betingede emner er ikke forhåndsvalgt.','Ingen detaljbeskrivelser eller undervisning er hentet fra de uversjonerte emnelenkene. Bruk emnesøk/TimeEdit eller kalenderimport separat.'],completeness:{complete:!warnings.length,pages:1,returned:[...periods.values()].reduce((n,p)=>n+p.courses.length,0),scope:'De publiserte emneradene på valgt kullside; senere eller manglende perioder er ikke gjettet.'}}
}
export async function hvlPrograms(institution,action,query,{fetchText}){
  if(action==='programs'){
    const data=JSON.parse(await cachedText(fetchText,listEndpoint,validate));if(!Array.isArray(data.items))fail('not-supported','HVL-programlisten har endret format.')
    const results=[],q=clean(query.q).toLocaleLowerCase('nb')
    for(const item of data.items){if(!item.title||!item.url||item.filters?.some(filter=>['KursUtanStudiepoeng','ForkursRealfagskursFagskoleutdanning','Fagskule'].includes(filter)))continue;let selected;try{selected=ref(new URL(item.url,origin))}catch{continue};if(q&&!`${item.studyProgramCode} ${item.title}`.toLocaleLowerCase('nb').includes(q))continue;results.push({code:selected.program,name:clean(item.title),publishedCode:clean(item.studyProgramCode),sourceUrl:selected.url.href,campuses:clean(item.studyLocation)?clean(item.studyLocation).split(',').map(clean):[]})}
    return {status:'ok',results,warnings:['Gjeldende publiserte programliste. Kull velges fra programmenes egne historikksider; fagskole, forkurs og kurs uten studiepoeng er utelatt.'],sourceUrl:catalogue,completeness:{complete:data.items.length===data.totalHits&&!data.hasNext,pages:1,returned:results.length,total:data.totalHits,scope:'HVLs publiserte søkeutvalg; innhold uten lesbar tittel eller høyere-utdanningskategori er utelatt.'}}
  }
  const selected=ref(query.sourceUrl);if(selected.program!==query.program||(query.cohort&&selected.cohort&&selected.cohort!==String(query.cohort)))fail('invalid-selection','Program og kull stemmer ikke med den valgte lenken.')
  const html=await cachedText(fetchText,selected.url.href,input=>sameProgram(input,selected)),$=load(html)
  const published=[];$('a[href]').each((_i,node)=>{const href=$(node).attr('href');if(!/\/(studieplan|utdanningsplan)\//.test(href))return;let child;try{child=ref(new URL(href,selected.url))}catch{return};if(child.program===selected.program&&child.cohort)published.push({cohort:child.cohort,intake:child.intake,label:`${child.cohort} ${child.intake==='spring'?'vår':'høst'}`,sourceUrl:child.url.href})})
  if(action==='program-cohorts'){const unique=[...new Map(published.map(item=>[`${item.cohort}:${item.intake}`,item])).values()];if(!unique.length)fail('not-supported','Dette HVL-programmet lenker ikke til en publisert kullplan. Åpne kilden eller bruk dokumentimport.');return {status:'ok',results:unique,warnings:['Bare kull som er lenket fra valgt programside vises.'],completeness:{complete:false,pages:1,returned:unique.length,scope:'Publiserte kull-lenker på valgt programside.'}}}
  if(selected.kind==='utdanningsplan')return parseHvlPlan(html,selected.url.href)
  const target=published.find(item=>item.cohort===String(query.cohort)&&ref(item.sourceUrl).kind==='utdanningsplan')
  if(!target)fail('not-supported','Ingen publisert lenke til emneoversikt for dette kullet. Studieplanens tekst kan importeres som dokument.')
  const targetRef=ref(target.sourceUrl);return parseHvlPlan(await cachedText(fetchText,target.sourceUrl,input=>sameProgram(input,targetRef)),target.sourceUrl)
}
