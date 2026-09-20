import { coursePage as load, clean, sourceError, periodCode, publicCourseUrl, fetchCoursePage, sectionText, metadataWarnings, officialTimetable, sameCampus } from './public-course.js'
import { cachedText, nextPage } from './program-source.js'
const catalogue = 'https://www4.uib.no/studier/emner'
export async function searchUib(query, fetchText) {
  const sourceUrl = `${catalogue}?${new URLSearchParams({ keywords: query.q })}`
  const results = [], seen = new Set(), warnings = ['Semesteret bekreftes fra emnets publiserte versjoner ved forhåndsvisning. Campusfilter er ikke tilgjengelig i denne kilden.'];let next=sourceUrl,truncated=false
  const validate = input=> {const url=publicCourseUrl(input.href||input,'uib');if(url.pathname!=='/studier/emner'||url.searchParams.get('keywords')!==query.q)sourceError('invalid-selection','Neste side endret det valgte UiB-søket.');return url}
  while(next && seen.size<250 && results.length<5000) {
  if(seen.has(next)){truncated=true;warnings.push('Kilden gjentar samme resultatside.');break}
  let html
  try{html=await cachedText(fetchText,next,validate)}catch(error){if(!seen.size||error.name==='AbortError')throw error;truncated=true;warnings.push(`Neste resultatside kunne ikke hentes: ${error.message}`);break}
  const $ = load(html), cards = $('article.card--study');seen.add(next)
  if (!cards.length && !$('[name=keywords]').length) sourceError('not-supported', 'UiB returnerte et ukjent søkeformat. Åpne det offisielle emnesøket.')
  cards.each((_i, card) => {
    const link = $(card).find('.card__title a').first(), name = clean(link.text()), code = clean($(card).find('.card__meta > div').first().text()).toUpperCase()
    if (!name || !/^[A-ZÆØÅ0-9-]+$/.test(code) || !link.attr('href')) return
    const url = publicCourseUrl(new URL(link.attr('href'), catalogue).href, 'uib', code.toLowerCase())
    if (results.some(item => item.sourceUrl === url.href)) return
    results.push({ code, name, university: 'UiB', semester: query.semester, year: Number(query.year), campus: '', campusVerified: false, periodVerified: false, sourceUrl: url.href, sourceRecordId: code.toLowerCase(), sourceProvider: 'uib' })
  })
  next=nextPage($,next,validate)
  if(!next && cards.length>=10){truncated=true;warnings.push('Kilden viser én resultatside uten lesbar neste-lenke. Flere treff kan finnes; avgrens søket.')}
  }
  if(next)truncated=true
  if(truncated)warnings.push('Kildeutvalget er ufullstendig. Maksimalt 250 publiserte sider / 5000 treff hentes.')
  return { status: results.length ? 'ok' : 'no-matching-results', results, sourceUrl, truncated, completeness:{complete:!truncated,pages:seen.size,returned:results.length}, warnings, ...(results.length ? {} : { error: 'Ingen treff i kildeutvalget. Dette bekrefter ikke at emnet ikke finnes.' }) }
}
export async function uibDetails(query, fetchText) {
  const code = clean(query.code).toUpperCase(), record = clean(query.sourceRecordId).toLowerCase()
  if (!record || record !== code.toLowerCase()) sourceError('invalid-selection', 'Emneidentiteten mangler eller avviker fra det valgte UiB-treffet.')
  let sourceUrl = publicCourseUrl(query.sourceUrl, 'uib', record).href
  let $ = load(await fetchCoursePage(fetchText, sourceUrl, 'uib', record))
  const target = periodCode(query)
  const options = () => $('[id="semester-selector"] option').toArray().map(node => ({ url: publicCourseUrl(clean($(node).attr('value')), 'uib', record), selected: $(node).is('[selected]') }))
  const published = options(), version = published.find(item => item.url.searchParams.get('start_semester') === target)
  if (!version) sourceError('semester-unavailable', 'UiB publiserer ikke en emneversjon for valgt semester og år.')
  if (!published.some(item => item.selected && item.url.searchParams.get('start_semester') === target)) {
    sourceUrl = version.url.href; $ = load(await fetchCoursePage(fetchText, sourceUrl, 'uib', record))
  } else sourceUrl = version.url.href
  if (!options().some(item => item.selected && item.url.searchParams.get('start_semester') === target)) sourceError('semester-unavailable', 'UiB returnerte ikke den valgte semesterversjonen. Ingen emneinformasjon er lagret.')
  const fact = label => clean($('.course-summary dt').filter((_i, node) => clean($(node).text()) === label).first().next('dd').text())
  const name = clean($('h1.course-title').text())
  if (fact('Emnekode').toUpperCase() !== code || !name) sourceError('invalid-selection', 'UiB returnerte en annen eller ufullstendig emneidentitet.')
  const campus = fact('Campus') || fact('Studiested'), creditsText = fact('Studiepoeng')
  if (query.campus && (!campus || !sameCampus(query.campus, campus))) sourceError('campus-unavailable', 'Valgt campus kunne ikke bekreftes i UiB-kilden.')
  const course = { id: `uib:${code}:${query.year}:${query.semester}`, code, name, university: 'UiB', semester: query.semester, year: Number(query.year), credits: /^\d+(?:[.,]\d+)?$/.test(creditsText) ? Number(creditsText.replace(',', '.')) : null, description: sectionText($, ['mål og innhold', 'mål og innhald']), notes: '', campus, campusVerified: Boolean(campus), sourceProvider: 'uib', sourceRecordId: record, sourceVersion: target, sourceUrl }
  return { status: 'ok', course, calendarUrl: null, entryUrl: officialTimetable($, 'uib'), warnings: metadataWarnings(course) }
}
