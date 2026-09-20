import { clean, fail } from './program-source.js'
const letters = 'A-ZÁÆØÅČĐŊŠŦŽ', codeStart = new RegExp(`^([${letters}\\d ]+?)\\s*-\\s*((?:\\d\\s*){4})(?:-\\s*(\\d+))?\\s*-?\\s+(.+)$`)
function rows(items) {
  const result = []
  for (const item of [...items].sort((a,b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    let row = result.find(row => Math.abs(row.y - item.transform[5]) < 2)
    if (!row) { row = { y: item.transform[5], items: [] }; result.push(row) }
    row.items.push(item)
  }
  return result.map(row => ({ ...row, sourcePage: row.items[0]?.sourcePage, text: clean(row.items.sort((a,b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' ')) }))
}
const numericText = value => clean(value).replace(/(\d)\s+(?=\d)/g, '$1')
const makeCourse = (row, info) => ({ id: `samas-program:${info.program}:${info.cohort}:${row.code}`, code: row.code, name: row.name, credits: row.credits, choice: row.choice || '', year: null, semester: null, campus: '', university: 'Sámi allaskuvla / Samisk høgskole', description: '', notes: row.notes, sourceProvider: 'samas-program', sourceRecordId: row.code, sourceVersion: String(info.cohort), sourceUrl: info.pdfUrl, ...(row.requiresSemesterChoice ? { requiresSemesterChoice: true } : {}) })
const makePeriod = (number, year, semester) => ({ id: `${year}-${semester}`, studySemester: number, year, semester, label: `${number}. studiesemester · ${semester === 'spring' ? 'Vår' : 'Høst'} ${year}`, courses: [], requirements: [] })
function semesterRows(page, info) {
  const header = page.items.find(item => clean(item.str) === 'Lohkanbadji'), courseHeader = page.items.find(item => clean(item.str) === 'Oahppoovttadagat'), creditsHeader = page.items.find(item => clean(item.str) === 'Oahppo')
  if (!header || !courseHeader || !creditsHeader) return null
  const labels = rows(page.items.filter(item => item.transform[4] < courseHeader.transform[4] - 3 && item.transform[5] < header.transform[5])), anchors = labels.filter(row => /^\d+\.\s*lohkanbadji$/.test(row.text)), periods = []
  if (!anchors.length) fail('source-changed', 'Fordelingsplanens studiesemestre kunne ikke leses.')
  for (let index=0; index<anchors.length; index++) {
    const anchor = anchors[index], bottom = anchors[index+1]?.y ?? -Infinity, number = +anchor.text.match(/^\d+/)[0], label = labels.filter(row => row.y <= anchor.y + 2 && row.y > bottom + 2).map(row => row.text).join(' '), calendar = label.match(/(\d{4})\s+(čakča|giđđa)/i)
    if (!calendar || number !== index+1 || number > 40) fail('source-changed', 'Fordelingsplanen mangler entydig sammenheng mellom studiesemester og kalendersemester.')
    const year=+calendar[1], semester=calendar[2].toLowerCase()==='giđđa'?'spring':'autumn', period=makePeriod(number,year,semester), items=page.items.filter(item=>item.transform[5]<=anchor.y+2&&item.transform[5]>bottom+2), content=rows(items.filter(item=>item.transform[4]>=courseHeader.transform[4]-3&&item.transform[4]<creditsHeader.transform[4]-3))
    if (year*2+(semester==='autumn'?1:0)-(+info.cohort*2+1)+1!==number) fail('source-changed','PDF-planens semesterplassering stemmer ikke med oppgitt høstkull.')
    let current=null
    const finish=()=>{if(!current)return;const text=clean(current.parts.join(' ')), match=text.match(/^(.*?)\s*,?\s*oktiibuot\s+(\d+)\s+oč(?:\s|$|[.,])/i);if(!match)fail('source-changed','Et emne i fordelingsplanen mangler hele emnets studiepoeng.');const allocation=items.find(item=>Math.abs(item.transform[5]-current.y)<2&&Math.abs(item.transform[4]-creditsHeader.transform[4])<3), credits=+match[2];period.courses.push({...makeCourse({code:current.code,name:clean(match[1]).replace(/\s*,\s*$/,''),credits,notes:`PDF-side ${page.page}: ${current.code} ${text}. Semesterkolonnen oppgir ${allocation?.str||'ukjent fordeling'}; hele emnet er ${credits} studiepoeng.`,choice:''},info),year,semester});current=null}
    for(const row of content){const match=row.text.match(/^([A-ZÁÆØÅČĐŊŠŦŽ]{2,8}\s+\d{3,4})\s+(.+)$/);if(match){finish();current={code:clean(match[1]),parts:[match[2]],y:row.y}}else if(current)current.parts.push(row.text)}finish()
    const practice=items.filter(item=>item.transform[4]>creditsHeader.transform[4]+40).map(item=>item.str).join(' ');if(/beaivvi/.test(practice))period.requirements.push(`Kildens praksiskrav i dette semesteret: ${clean(practice)}. Dette er ikke konkrete undervisningsdatoer.`)
    if(!period.courses.length)fail('source-changed','Et publisert studiesemester mangler lesbare emner.');periods.push(period)
  }
  return {periods,unplacedCourses:[]}
}
function splitCourses(content, info, page, note='') {
  const result=[];let current=null, groupNumber=0
  const finish=()=>{if(!current)return;const text=numericText(current.parts.join(' ')),credit=text.match(/\(?\s*(\d+(?:[.,]\d+)?)\s*oč(?:\.?\)|\s|$)/),name=clean(text.replace(/\(?\s*\d+(?:[.,]\d+)?\s*oč(?:\.?\)|\s|$)/,'')).replace(/[\s,/]+$/,''),course=makeCourse({code:current.code,name,credits:credit?Number(credit[1].replace(',','.')):null,notes:`PDF-side ${current.page || page}: ${current.code} ${text}. ${note}`,choice:current.alternative?'V':''},info);if(current.creditGroup)course.creditGroup=current.creditGroup;result.push(course);current=null}
  for(const row of content){const bullet=/^•\s*/.test(row.text),line=row.text.replace(/^•\s*/,''),match=line.match(codeStart);if(match){const alternative=!!current?.parts.join(' ').trim().endsWith('/');let creditGroup=null;if(alternative){creditGroup=current.creditGroup||`shared-${++groupNumber}`;current.creditGroup=creditGroup;current.alternative=true}finish();current={code:`${match[1].replace(/\s/g,'')}-${match[2].replace(/\s/g,'')}${match[3]?`-${match[3]}`:''}`,parts:[match[4]],alternative:alternative||bullet,creditGroup,page:row.sourcePage}}else if(bullet){finish()}else if(current)current.parts.push(row.text)}finish()
  // Alternative languages share the source's credit label at the last option.
  for(let index=0;index<result.length;index++)if(result[index].creditGroup&&result[index].credits===null){const next=result.slice(index+1).find(row=>row.creditGroup===result[index].creditGroup&&row.credits!==null);if(next){result[index].credits=next.credits;result[index].notes+=' Studiepoeng er oppgitt samlet etter språkvalgene; velg bare språket du følger.'}}
  for(const course of result)delete course.creditGroup
  return result
}
function semesterColumns(page,info){
  const autumn=page.items.find(item=>clean(item.str)==='Čakčalohkanbadji'),spring=page.items.find(item=>clean(item.str)==='Giđđalohkanbadji');if(!autumn||!spring)return null
  const labels=rows(page.items.filter(item=>item.transform[4]<autumn.transform[4]-3&&item.transform[5]<autumn.transform[5])),anchors=labels.filter(row=>/^\d{4}\s*-\s*\d{2}$/.test(numericText(row.text))),periods=[],unplacedCourses=[]
  if(!anchors.length)fail('source-changed','PDF-planen mangler gjenkjennelige studieår.')
  for(let index=0;index<anchors.length;index++){
    const anchor=anchors[index],bottom=anchors[index+1]?.y??-Infinity,year=+numericText(anchor.text).match(/^\d{4}/)[0],items=page.items.filter(item=>item.transform[5]<=anchor.y+2&&item.transform[5]>bottom+2&&item.transform[4]>=autumn.transform[4]-3)
    if(year!==+info.cohort+index)fail('source-changed','Studieårene i PDF-en følger ikke det oppgitte kullet.')
    const combined=rows(items),merged=combined.filter(row=>row.items.some(item=>item.transform[4]<spring.transform[4]-3&&item.transform[4]+(item.width||0)>spring.transform[4]+5))
    const mergedY=new Set(merged.map(row=>row.y)),shared=splitCourses(merged,info,page.page,'Kilden bruker en celle på tvers av begge semestre. Avklar studiesemester før valg.')
    shared.forEach(course=>{course.requiresSemesterChoice=true;course.courseGroup=`${index+1}. studieår · sammenslått celle`;unplacedCourses.push(course)})
    for(const [offset,semester,left,right]of[[0,'autumn',autumn.transform[4]-3,spring.transform[4]-3],[1,'spring',spring.transform[4]-3,Infinity]]){
      const number=index*2+offset+1,period=makePeriod(number,semester==='autumn'?year:year+1,semester),content=rows(items.filter(item=>item.transform[4]>=left&&item.transform[4]<right&&!mergedY.has(combined.find(row=>Math.abs(row.y-item.transform[5])<2)?.y)))
      const firstCode=content.findIndex(row=>codeStart.test(row.text.replace(/^•\s*/,''))),requirements=content.slice(0,firstCode<0?content.length:firstCode).map(row=>row.text).join(' ')
      if(requirements)period.requirements.push(`Kildekrav: ${requirements}. Ingen emnekode er oppgitt for denne samleposten.`)
      for(const row of content.filter(row=>/^•/.test(row.text)&&!codeStart.test(row.text.replace(/^•\s*/,''))))period.requirements.push(`Ufullstendig kildeoppføring: ${row.text}. Navn og studiepoeng må avklares; ingen emneoppføring er funnet på.`)
      period.courses=splitCourses(content,info,page.page,`Kilden plasserer emnet i ${number}. studiesemester.`).map(course=>({...course,year:period.year,semester}))
      if(shared.length)period.requirements.push('Studieåret har emner i sammenslåtte celler. Disse finnes som separate, uavklarte valg og er ikke plassert automatisk i dette semesteret.')
      periods.push(period)
    }
  }
  return {periods,unplacedCourses}
}
export function parseSamasPdf(pages,info){
  const cover=rows(pages[0]?.items||[]).map(row=>numericText(row.text)).join(' '),cohort=cover.match(/(\d{4})\s+studeantajovku\s*i?/i)?.[1]
  if(cohort!==String(info.cohort))fail('invalid-selection','PDF-forsiden bekrefter ikke det valgte opptakskullet. Lenketekst eller filnavn blir ikke brukt alene.')
  const models=[]
  // A semester table may continue onto the next page without repeated headers.
  // Preserve its columns and source-page provenance while stacking coordinates.
  const joined={page:1,items:pages.flatMap((page,index)=>page.items.map(item=>({...item,sourcePage:page.page,transform:item.transform.map((value,axis)=>axis===5?value-index*2000:value)})))}
  const parsed=semesterRows(joined,info)||semesterColumns(joined,info)
  if(parsed)models.push({id:'pdf-1',name:'Publisert fordeling for kullet',...parsed})
  if(!models.length)fail('not-supported','Sámi-PDF-en mangler en støttet semesterfordeling. Bruk dokumentimport for å kontrollere innholdet.')
  return {status:'ok',program:{code:info.program,name:info.name,cohort:cohort,sourceUrl:info.sourceUrl,sourceEdition:cohort,campuses:[]},models,warnings:['Kull er bekreftet i PDF-ens innhold. Kildens kalendersemestre er beholdt; sammenslåtte årsceller krever egen semesteravklaring.','Språkvalg og andre valgkrav må avklares av studenten. Studiepoengene gjelder hele emnet, også når kilden fordeler arbeidet over flere semestre.','Praksisomfang er ikke konkrete avtaler. Hent tilgjengelig undervisning separat fra den offentlige timeplanen.',...(info.sourceWarning?[info.sourceWarning]:[])],completeness:{complete:false,pages:pages.length,returned:new Set(models.flatMap(model=>[...model.periods.flatMap(period=>period.courses),...model.unplacedCourses].map(course=>course.code))).size,reason:'Publisert semesterfordeling er lest; sammenslåtte celler, språkvalg og eventuelle motstridende kildeetiketter krever avklaring.'}}
}
