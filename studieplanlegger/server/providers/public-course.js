import { load } from 'cheerio'
export function coursePage(html) {
  const $ = load(html)
  // Block boundaries remain word boundaries even when the source minifies HTML.
  $('p,div,h1,h2,h3,h4,dt,dd,br,li,section,article').after(' ')
  return $
}
export const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
export function sourceError(status, message) { throw Object.assign(new Error(message), { status }) }
export const periodCode = query => `${query.year}${query.semester === 'spring' ? 'V' : 'H'}`
export const sameCampus = (a, b) => clean(a).toLocaleLowerCase('nb-NO') === clean(b).toLocaleLowerCase('nb-NO')
export function publicCourseUrl(input, institution, record) {
  let url
  try { url = new URL(input) } catch { sourceError('invalid-selection', 'Velg et treff fra det offentlige emnesøket først.') }
  const allowed = institution === 'uib' ? url.origin === 'https://www4.uib.no' && /^\/studier\/emner(?:\/[a-z0-9-]+)?\/?$/i.test(url.pathname) : url.origin === 'https://uit.no' && /^\/utdanning\/emner(?:\/emne(?:\/\d+(?:\/[a-z0-9-]+)?)?)?\/?$/i.test(url.pathname)
  const keys = institution === 'uib' ? ['keywords', 'start_semester','page'] : ['p_searchstring', 'ar', 'semester', 'p_document_id','p_page']
  if (!allowed || url.username || url.password || url.hash || [...url.searchParams.keys()].some(key => !keys.includes(key) || url.searchParams.getAll(key).length !== 1)) sourceError('invalid-selection', 'Kildelenken tilhører ikke den valgte offentlige emnekatalogen.')
  const pathRecord = url.pathname.match(/\/emne\/(\d+)/)?.[1], queryRecord = url.searchParams.get('p_document_id')
  if (institution === 'uit' && pathRecord && queryRecord && pathRecord !== queryRecord) sourceError('invalid-selection', 'Kildelenken oppgir motstridende emneidentiteter. Søk og velg emnet på nytt.')
  const identity = institution === 'uib' ? url.pathname.replace(/\/$/, '').split('/')[3]?.toLowerCase() : pathRecord || queryRecord
  if (record && identity !== String(record).toLowerCase()) sourceError('invalid-selection', 'Kilden returnerte en annen emneidentitet. Søk og velg emnet på nytt.')
  return url
}
export const fetchCoursePage = (fetchText, url, institution, record) => {
  const validate = value => publicCourseUrl(value.href || value, institution, record)
  validate(url)
  return fetchText(String(url), 0, validate)
}
export function sectionText($, names) {
  const heading = $('h2,h3,summary').filter((_i, node) => names.includes(clean($(node).text()).toLocaleLowerCase('nb-NO'))).first()
  if (!heading.length) return ''
  const boundary = heading.closest('section,article,details,body')[0], parts = []
  const collect = node => {
    if (/^(h[1-6]|summary)$/i.test(node.name || '')) return false
    if (/^(script|style|nav)$/i.test(node.name || '')) return true
    if (node.type === 'text') parts.push(node.data)
    for (const child of node.children || []) if (!collect(child)) return false
    if (node.type !== 'text') parts.push(' ')
    return true
  }
  let cursor = heading[0]
  while (cursor && cursor !== boundary) {
    if (cursor.nextSibling) { cursor = cursor.nextSibling; if (!collect(cursor)) break }
    else cursor = cursor.parent
  }
  return clean(parts.join('')).slice(0, 12000)
}
export function metadataWarnings(course) {
  return ['Bare emneinformasjon er hentet. Oppgaver og undervisningstidspunkter opprettes ikke fra beskrivelsen.',
    ...(course.credits == null ? ['Studiepoeng mangler i kilden.'] : []),
    ...(!course.description ? ['Beskrivelse mangler i kilden.'] : []),
    ...(!course.campus ? ['Campus er ikke oppgitt i kilden.'] : [])]
}
export function officialTimetable($, institution) {
  for (const node of $('a[href]').toArray()) {
    try {
      const url = new URL($(node).attr('href'))
      if (url.origin === 'https://tp.educloud.no' && url.pathname === `/${institution}/app/schedule` && !url.username && !url.password) return url.href
    } catch { /* Only published absolute TP entry links are retained. */ }
  }
  return null
}
