import { load,clean,fail,cachedText,restrictedUrl,collectPages,asCredits } from './program-source.js'
const origin='https://www4.uib.no',catalogue=`${origin}/studier/program`
const validate=input=>restrictedUrl(input,{origin,paths:[/^\/studier\/program(?:\/[a-z0-9-]+(?:\/plan)?)?\/?$/],keys:['keywords','page']})
const ref=input=>{const url=validate(input),code=url.pathname.replace(/\/$/,'').split('/')[3];if(!code)fail('invalid-selection','Velg et publisert UiB-program.');return {url,code}}
export function parseUibProgram(html,formalHtml,query,sourceUrl){
 const $=load(html),formal=load(formalHtml),heading=clean(formal('main h1').text()),edition=heading.match(/(?:høst|haust|vår)\s+(\d{4})/i),editionSemester=/vår/i.test(edition?.[0]||'')?'spring':'autumn'
 if(!edition)fail('not-supported','UiB-planens publiserte utgave mangler år/semester. Ingen kullversjon er gjettet.')
 if(query.cohortFromStudent!=='true'||!/^\d{4}$/.test(String(query.cohort)))fail('invalid-selection','Kilden publiserer planutgave, men ikke opptakskull. Oppgi ditt kull uttrykkelig.')
 const sourceEdition=`${edition[1]}${editionSemester==='spring'?'V':'H'}`,periods=[],warnings=[]
 const content=$('h2').filter((_i,node)=>/^(Studiets oppbygging|Oppbygging|Oppbyggjing)$/i.test(clean($(node).text()))).first().closest('details').find('.accordion__main').first()
 if(!content.length)fail('not-supported','UiB-programmet har ingen støttet semesteroppbygging. Åpne planutgaven eller bruk dokumentimport.')
 let period=null
 for(const node of content.children().toArray()){
  const row=$(node),text=clean(row.text()),match=text.match(/^(\d+)\.\s*semester(?:,?\s*(haust|høst|vår))?:?$/i)
  if(match){const number=Number(match[1]);if(number<1||number>40)fail('not-supported','UiB har et studiesemester utenfor importgrensen.');period={id:String(number),studySemester:number,label:`${number}. studiesemester${match[2]?` · ${match[2]}`:''} · velg kalenderår`,year:null,semester:match[2]?/^vår$/i.test(match[2])?'spring':'autumn':null,courses:[],requirements:[]};periods.push(period);continue}
  if(!period)continue
  let recognized=false
  for(const node of row.find('a[href]').toArray()){
   const a=$(node),title=clean(a.text()),match=title.match(/^([A-ZÆØÅ\d_-]+)\s*[-–]\s*(.+)$/)
   if(!match)continue
   const url=new URL(a.attr('href'),sourceUrl);restrictedUrl(url,{origin,paths:[/^\/(?:studier\/)?emner\/[a-z\d-]+$/]})
   const structuralRow=a.closest('li,tr,p'),scope=structuralRow.length?structuralRow:row
   const courseLinks=scope.find('a[href]').toArray().filter(link=>/^[A-ZÆØÅ\d_-]+\s*[-–]\s*.+$/.test(clean($(link).text()))).length+(scope[0]===a[0]?1:0)
   const credits=courseLinks===1?clean(scope.text()).match(/\((\d+(?:[.,]\d+)?)\s+studiepoeng\)/i):null,code=match[1]
   // Programme prose and recommendations do not prove universal mandatory status.
   period.courses.push({id:`uib-program:${query.program}:${sourceEdition}:${period.studySemester}:${code}`,code,name:clean(match[2]).replace(/\*$/,''),credits:credits?asCredits(credits[1]):null,choice:'',sourceProvider:'uib-program',sourceRecordId:code,sourceVersion:sourceEdition,sourceUrl:url.href,university:'UiB',description:'',notes:`Publisert programutgave ${sourceEdition}. Emneraden beskriver oppbygging, ikke bekreftet kulltilhørighet. ${text}`,year:null,semester:period.semester,campus:''});recognized=true
  }
  if(text&&!recognized)period.requirements.push(text)
 }
 if(!periods.some(p=>p.courses.length))fail('not-supported','Ingen entydige emner i UiB-programmets semesteroppbygging. Bruk emnesøk eller dokumentimport.')
 const rules=clean(formal('main').text());const excerpt=rules.match(/(?:Obligatoriske emne|Obligatoriske emner)(.+?)(?:Tilrådde val|Anbefalte valg|Rekkefølgje)/i)?.[1]
 if(excerpt)for(const item of periods)item.requirements.push(`Formell planutgave ${sourceEdition}, krav og alternativer: ${clean(excerpt)}`)
 warnings.push(`UiB publiserer planutgave ${sourceEdition}; ditt oppgitte kull ${query.cohort} er ikke verifisert av kilden. Kontroller at denne utgaven gjelder deg.`,`Kalenderår og uklare valg må avklares av deg. Anbefalte innføringsemner og alternative plankrav blir ikke automatisk obligatoriske.`,'Undervisning og emnebeskrivelser er separate fra programoppbyggingen.')
 return {status:'ok',program:{code:query.program,name:clean($('main h1').first().text()),cohort:String(query.cohort),cohortFromStudent:true,sourceEdition,sourceUrl,campuses:[]},models:[{id:sourceEdition,name:`Publisert oppbygging · planutgave ${sourceEdition}`,periods}],warnings,completeness:{complete:false,pages:2,returned:periods.reduce((n,p)=>n+p.courses.length,0),reason:'Programutgaven publiserer ikke et verifisert kull eller alle valgemner.'}}
}
export async function uibPrograms(institution,action,query,{fetchText}){
 if(action==='programs'){
  const data=await collectPages(catalogue,fetchText,validate,($,url)=>{
   if(!$('[name=keywords]').length)fail('not-supported','UiB-programlisten har endret format.')
   const results=[];$('article.card--study .card__title a[href]').each((_i,node)=>{const source=ref(new URL($(node).attr('href'),url));results.push({code:source.code,name:clean($(node).text()),sourceUrl:source.url.href,campuses:[]})});return {results}
  });const q=clean(query.q).toLocaleLowerCase('nb');return {status:'ok',...data,results:data.results.filter(p=>!q||`${p.code} ${p.name}`.toLocaleLowerCase('nb').includes(q))}
 }
 const source=ref(query.sourceUrl);if(source.code!==query.program)fail('invalid-selection','Det valgte UiB-programmet stemmer ikke med lenken.')
 if(action==='program-cohorts')return {status:'ok',results:[{cohort:'student',requiresStudentCohort:true,label:'Kull er ikke publisert – oppgi ditt opptakskull',sourceUrl:source.url.href}],warnings:['Publisert planutgave er ikke et bekreftet opptakskull. Du må oppgi ditt kull og kontrollere at planutgaven gjelder deg.'],completeness:{complete:false,pages:0,returned:0,reason:'Ingen verifisert offentlig kulliste i denne kontrakten.'}}
 const guard=input=>{const next=ref(input);if(next.code!==source.code)fail('invalid-selection','UiB videresendte til et annet program.');return next.url},html=await cachedText(fetchText,source.url.href,guard),$=load(html)
 const href=$('a[href]').toArray().map(node=>$(node).attr('href')).find(href=>href.endsWith(`/program/${source.code}/plan`))
 if(!href)fail('not-supported','Programmet lenker ikke til en lesbar formell planutgave.')
 const formalUrl=guard(new URL(href,source.url));return parseUibProgram(html,await cachedText(fetchText,formalUrl.href,guard),query,source.url.href)
}
