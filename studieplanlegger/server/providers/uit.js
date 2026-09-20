import { coursePage as load, clean, sourceError, periodCode, publicCourseUrl, fetchCoursePage, sectionText, metadataWarnings, officialTimetable, sameCampus } from './public-course.js'
import { cachedText, nextPage } from './program-source.js'
const catalogue = 'https://uit.no/utdanning/emner'
const term = text => {
  const match = text.match(/\b(Autumn|Spring|Høst|Haust|Vår)\s+(\d{4})\b/i)
  return match && { semester: /spring|vår/i.test(match[1]) ? 'spring' : 'autumn', year: Number(match[2]) }
}
const requested = (period, query) => period?.semester === query.semester && period?.year === Number(query.year)
function cardCampus(card) {
  const copy = card.clone()
  copy.find('a,button,script,style').remove()
  copy.find('br').replaceWith('\n')
  copy.find('p,div,li,dd,dt,section').before('\n').after('\n')
  const fields = copy.text().split('\n').map(clean).filter(Boolean)
  const duration = fields.findIndex(field => /^\d+\s+semest(?:er|re)$/i.test(field))
  const campus = duration < 0 ? '' : fields[duration + 1] || ''
  return /^[\p{L}][\p{L}\p{M} ,/()-]*$/u.test(campus) && !/read more|les mer|søk|studiepoeng|credits|semester|duration/i.test(campus) ? campus : ''
}
export async function searchUit(query, fetchText) {
  const sourceUrl = `${catalogue}?${new URLSearchParams({ p_searchstring: query.q, ar: String(query.year), semester: query.semester === 'spring' ? 'V' : 'H' })}`
  const results=[],warnings=[],seen=new Set();let next=sourceUrl,truncated=false,otherPeriod=0
  const validate=input=>{const url=publicCourseUrl(input.href||input,'uit');if(url.pathname!=='/utdanning/emner'||url.searchParams.get('p_searchstring')!==query.q||url.searchParams.get('ar')!==String(query.year)||url.searchParams.get('semester')!==(query.semester==='spring'?'V':'H'))sourceError('invalid-selection','Neste side endret det valgte UiT-søket.');return url}
  while(next&&seen.size<100&&results.length<5000){
  if(seen.has(next)){truncated=true;warnings.push('Kilden gjentar samme resultatside.');break}
  let html
  try{html=await cachedText(fetchText,next,validate)}catch(error){if(!seen.size||error.name==='AbortError')throw error;truncated=true;warnings.push(`Neste resultatside kunne ikke hentes: ${error.message}`);break}
  const $=load(html),titles=$('.studieProgramTittel');seen.add(next)
  if (!titles.length && !$('[name=p_searchstring]').length) sourceError('not-supported', 'UiT returnerte et ukjent søkeformat. Åpne det offisielle emnesøket.')
  titles.each((_i, title) => {
    const link = $(title).find('a').first(), match = clean(link.text()).match(/^([A-ZÆØÅ0-9-]+)\s*:\s*(.+)$/i)
    if (!match || !link.attr('href')) return
    const url = publicCourseUrl(new URL(link.attr('href'), catalogue).href, 'uit')
    const record = url.searchParams.get('p_document_id') || url.pathname.match(/\/emne\/(\d+)/)?.[1]
    if (!record) return
    let metadata = '', campus = ''
    for (const ancestor of $(title).parents().toArray()) {
      const card = $(ancestor)
      if (card.find('.studieProgramTittel').length !== 1) break
      const copy = card.clone(); copy.find('.studieProgramTittel').remove()
      if (term(clean(copy.text()))) { metadata = clean(copy.text()); campus = cardCampus(copy); break }
    }
    const period = term(metadata)
    if (!requested(period, query)) { otherPeriod++; return }
    if (query.campus && (!campus || !sameCampus(query.campus, campus))) return
    if (!results.some(item => item.sourceRecordId === record)) results.push({ code: match[1].toUpperCase(), name: match[2], university: 'UiT', ...period, campus, campusVerified: Boolean(campus), periodVerified: true, sourceUrl: url.href, sourceRecordId: record, sourceProvider: 'uit' })
  })
  next=nextPage($,next,validate)
  if(!next&&titles.length>=50){truncated=true;warnings.push('Kilden viser én resultatside uten lesbar neste-lenke. Flere treff kan finnes; avgrens søket.')}
  }
  if(next)truncated=true
  return { status: results.length ? 'ok' : otherPeriod ? 'semester-unavailable' : 'no-matching-results', results, sourceUrl, truncated, completeness:{complete:!truncated,pages:seen.size,returned:results.length}, warnings, ...(results.length ? {} : { error: otherPeriod ? 'Kilden returnerte ikke bekreftede treff for valgt semester og år.' : 'Ingen treff med valgte filtre. Dette bekrefter ikke at emnet ikke finnes.' }) }
}
export async function uitDetails(query, fetchText) {
  const code = clean(query.code).toUpperCase(), record = clean(query.sourceRecordId)
  if (!/^\d+$/.test(record)) sourceError('invalid-selection', 'Velg en publisert emnepost fra UiT-søket først.')
  const sourceUrl = publicCourseUrl(query.sourceUrl, 'uit', record).href
  const $ = load(await fetchCoursePage(fetchText, sourceUrl, 'uit', record))
  $('script,style,header,footer,nav').remove()
  const returnedCode = clean($('.studiekatalogSubH2').text()).match(/(?:Course code|Emnekode)\s*:\s*([A-ZÆØÅ0-9-]+)/i)?.[1]?.toUpperCase()
  const name = clean($('h1.hero-title').text()), body = clean($('body').text())
  if (returnedCode !== code || !name) sourceError('invalid-selection', 'UiT returnerte en annen eller ufullstendig emneidentitet.')
  const canonical = $('link[rel=canonical]').attr('href') || $('meta[property="og:url"]').attr('content')
  if (canonical) publicCourseUrl(canonical, 'uit', record)
  const periodText = body.match(/(?:Semester\s*\/\s*(?:Year|År)|Semester og år)\s+((?:Autumn|Spring|Høst|Haust|Vår)\s+\d{4})/i)?.[1]
  if (!requested(term(periodText || ''), query)) sourceError('semester-unavailable', 'UiT-emneposten gjelder ikke valgt semester og år. Velg den publiserte versjonen fra et nytt søk.')
  const campus = clean(body.match(/\b(?:Campus|Studiested)\s+(.+?)\s+(?:Semester\s*\/|Semester og år)/i)?.[1])
  if (query.campus && (!campus || !sameCampus(query.campus, campus))) sourceError('campus-unavailable', 'UiT returnerte en annen eller ukjent campus. Søk og velg riktig variant på nytt.')
  const creditsText = body.match(/\b(?:Credits|Studiepoeng)\s+(\d+(?:[.,]\d+)?)(?:\s|$)/i)?.[1]
  const course = { id: `uit:${record}:${query.year}:${query.semester}`, code, name, university: 'UiT', semester: query.semester, year: Number(query.year), credits: creditsText ? Number(creditsText.replace(',', '.')) : null, description: sectionText($, ['about the course', 'om emnet', 'innhold']), notes: '', campus, campusVerified: Boolean(campus), sourceProvider: 'uit', sourceRecordId: record, sourceVersion: periodCode(query), sourceUrl }
  return { status: 'ok', course, calendarUrl: null, entryUrl: officialTimetable($, 'uit'), warnings: metadataWarnings(course) }
}
