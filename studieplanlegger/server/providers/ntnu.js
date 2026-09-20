const endpoint = 'https://www.ntnu.no/web/studier/emnesok?p_p_id=courselistportlet_WAR_courselistportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=fetch-courselist-as-json&p_p_cacheability=cacheLevelPage'
import { cachedText, restrictedUrl } from './program-source.js'
export async function searchNtnu(query, fetchText) {
  const academicYear = query.semester === 'spring' ? Number(query.year) - 1 : Number(query.year)
  const params = new URLSearchParams({ searchQueryString: query.q, semester: String(academicYear), courseAutumn: String(query.semester === 'autumn'), courseSpring: String(query.semester === 'spring'), pageNo: '1', sortOrder: 'relevancy' })
  const campus = { Trondheim: 'trondheim', Gjøvik: 'gjovik', Ålesund: 'alesund' }[query.campus]
  if (campus) params.set(campus, 'true')
  const sourceUrl = `${endpoint}&${params}`, courses = new Map(), signatures = new Set(), warnings = []
  const validate = input => restrictedUrl(input,{origin:'https://www.ntnu.no',paths:[/^\/web\/studier\/emnesok$/],keys:['p_p_id','p_p_lifecycle','p_p_state','p_p_mode','p_p_resource_id','p_p_cacheability','searchQueryString','semester','courseAutumn','courseSpring','pageNo','sortOrder','trondheim','gjovik','alesund']})
  let more=true,pages=0
  while(more && pages<20 && courses.size<10000) {
    params.set('pageNo',String(pages+1))
    let data
    try {data=JSON.parse(await cachedText(fetchText,`${endpoint}&${params}`,validate));if(!Array.isArray(data.courses))throw new Error('NTNU returnerte et ukjent søkeformat.')}
    catch(error){if(!pages || error.name==='AbortError')throw error;warnings.push(`Neste side kunne ikke hentes: ${error.message}`);break}
    const signature=JSON.stringify(data.courses.map(c=>[c.courseCode,c.courseUrl,c.location]))
    if(signatures.has(signature)){warnings.push('Kilden gjentar samme resultatside; videre henting er stoppet.');break}
    signatures.add(signature);pages++;for(const course of data.courses)courses.set(`${course.courseCode}:${course.courseUrl}:${course.location}`,course)
    more=Boolean(data.hasMoreResults)
  }
  if(more)warnings.push('Kildeutvalget er ufullstendig. Hentingen følger publiserte sider innen grensen på 20 sider / 10 000 emner; avgrens søket.')
  const term = query.q.toLocaleLowerCase('nb-NO')
  const results = [...courses.values()].filter(c => `${c.courseCode} ${c.courseName}`.toLocaleLowerCase('nb-NO').includes(term) && (!query.campus || c.location?.includes(query.campus))).map(c => ({ code: c.courseCode, name: c.courseName, campus: c.location || '', university: 'NTNU', semester: query.semester, year: Number(query.year), sourceUrl: c.courseUrl }))
  return { status: results.length ? 'ok' : 'no-matching-results', results, sourceUrl, error: results.length ? undefined : 'Ingen treff i det valgte semester-/campusfilteret. Dette bekrefter ikke at emnet ikke finnes. Prøv et annet semester, fjern campusfilteret eller åpne NTNUs emnesøk.', truncated: more, completeness:{complete:!more,pages,returned:courses.size}, warnings }
}
