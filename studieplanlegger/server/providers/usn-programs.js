import { load, clean, fail, cachedText, restrictedUrl, asCredits } from './program-source.js'

const publicPage = 'https://www.usn.no/studier/studie-og-emneplaner/'
const api = 'https://s293.usn.no/v2/studieplan//'
const planIdPattern = /^([A-ZÆØÅa-z\d.-]+)_(20\d{2}|2100)_(HØST|VÅR)(?:_([BE]))?$/
const apiValidate = input => restrictedUrl(input, { origin: 'https://s293.usn.no', paths: [/^\/v2\/studieplan\/\/(?:[A-Za-z\d.%_-]+(?:\/(?:kull|studiemodellemner))?)?$/] })
const pageValidate = input => restrictedUrl(input, { origin: 'https://www.usn.no', paths: [/^\/studier\/studie-og-emneplaner\/$/] })
const postCaches = new WeakMap()
function term(value) { return /^HØST$/i.test(value) ? 'autumn' : /^VÅR$/i.test(value) ? 'spring' : null }
function refId(input) {
  const match = String(input).match(planIdPattern)
  if (!match) fail('source-changed', 'USN returnerte en ukjent programidentifikator.')
  return { code: match[1], cohort: match[2], intake: term(match[3]), id: `${match[1]}_${match[2]}_${match[3]}`, language: match[4] || 'B' }
}
const sourceFor = (id, language = 'B') => `${publicPage}#/plan/${encodeURIComponent(`${id}_${language}`)}`
function selectedRef(query) {
  let url
  try { url = new URL(query.sourceUrl) } catch { fail('invalid-selection', 'Velg en publisert USN-plan fra programlisten.') }
  if (url.origin !== 'https://www.usn.no' || url.pathname !== '/studier/studie-og-emneplaner/' || url.search || url.username || url.password || !url.hash.startsWith('#/plan/')) fail('invalid-selection', 'Programlenken er utenfor USNs offentlige katalog.')
  let ref
  try { ref = refId(decodeURIComponent(url.hash.slice(7))) } catch { fail('invalid-selection', 'Programlenken har en ukjent identifikator.') }
  if (query.program && query.program !== ref.code || query.cohort && String(query.cohort) !== ref.cohort) fail('invalid-selection', 'Valgt program eller kull stemmer ikke med kildelenken.')
  return ref
}
function parseJson(text) { try { return JSON.parse(text) } catch { fail('source-changed', 'USN returnerte et svar som ikke kunne leses. Eksisterende data er beholdt.') } }
function preferred(items) { return items?.find(item => item.language === 'B') || items?.find(item => item.language === 'E') || items?.[0] }
function catalogueRow(row) {
  const variant = preferred(row.studieplaninfodata), metadata = variant?.metadatainfo
  if (!metadata || !Number(metadata.harinfo)) return null
  const ref = refId(row.studieplanid)
  if (String(metadata.aarstall) !== ref.cohort || term(metadata.semester) !== ref.intake || !clean(metadata.studieprogramnavn)) fail('source-changed', 'Programlisten har motstridende kullopplysninger.')
  return { code: ref.code, name: clean(metadata.studieprogramnavn), cohort: ref.cohort, intake: ref.intake, sourceUrl: sourceFor(ref.id, variant.language), campuses: [], label: clean(metadata.appliesto) || `${ref.cohort} ${ref.intake === 'spring' ? 'vår' : 'høst'}` }
}
export function parseUsnCatalogue(payload) {
  if (!Array.isArray(payload?.stedkode)) fail('source-changed', 'USNs programliste har endret struktur.')
  const rows = payload.stedkode.flatMap(group => group.studieplaninfo || [])
  if (rows.length > 5000) fail('source-changed', 'USNs katalog er større enn grensen på 5000 programversjoner.')
  return [...new Map(rows.map(catalogueRow).filter(Boolean).map(row => [row.sourceUrl, row])).values()]
}
export function parseUsnCohorts(payload, program) {
  if (!Array.isArray(payload)) fail('source-changed', 'USNs kullhistorikk har endret struktur.')
  return payload.map(catalogueRow).filter(row => row && row.code === program).sort((a, b) => b.cohort.localeCompare(a.cohort) || a.intake.localeCompare(b.intake))
}

export function parseUsnPlan(payload, subjects, ref) {
  const variant = preferred(payload?.studieplandata), metadata = variant?.metadata
  if (!metadata || payload.studieplanid !== ref.id || String(metadata.aarstall) !== ref.cohort || term(metadata.semester) !== ref.intake || metadata.studieprogramkode !== ref.code) fail('source-changed', 'USN returnerte en annen programplan enn det valgte kullet. Ingen data er lagret.')
  const rows = preferred(subjects)?.studiemodellemne
  if (!Array.isArray(rows) || rows.length > 5000) fail('source-changed', 'USNs emnestruktur mangler eller har endret format.')
  const sourceUrl = sourceFor(ref.id, variant.language), $ = load(metadata.studiemodell || '')
  const groups = new Map()
  $('a.studiemodell[href]').each((_, element) => {
    const id = $(element).attr('href'), labels = $(element).parents('table').map((_, table) => clean($(table).children('thead').find('.header').first().text())).get().filter(Boolean)
    groups.set(id, [...new Set([...(groups.get(id) || []), ...labels])])
  })
  const distinctGroups = new Set([...groups.values()].flat()), complex = distinctGroups.size > 1
  const periods = new Map(), warnings = []
  for (const row of rows) {
    const number = Number(row.terminnummer), calendar = String(row.undtermin || '').match(/^(\d{4})_(HØST|VÅR)$/)
    const id = String(row.emnneplanid || ''), match = id.match(/^(.+)_([^_]+)_(\d{4})_(HØST|VÅR)$/)
    if (!Number.isInteger(number) || number < 1 || number > 60 || !match || !/^[A-ZÆØÅa-z\d._-]+$/.test(match[1]) || !clean(row.emnenavn)) { warnings.push('Et emne har en uklar kode eller plassering i studieløpet og ble utelatt. Kontroller den offentlige kilden.'); continue }
    const year = calendar ? Number(calendar[1]) : null, semester = calendar ? term(calendar[2]) : null
    let period = periods.get(number)
    if (!period) { period = { id: String(number), studySemester: number, label: `${number}. studiesemester · ${calendar ? `${semester === 'spring' ? 'Vår' : 'Høst'} ${year}` : 'Kalendersemester må avklares'}`, year, semester, courses: [], requirements: [] }; periods.set(number, period) }
    if (period.year !== year || period.semester !== semester) fail('source-changed', 'USN oppgir ulike kalenderperioder for samme studiesemester. Kontroller planen i kilden.')
    const branch = groups.get(id) || [], rule = clean(row.valgstatus)
    const notes = [complex ? `Kildegruppe: ${branch.join(' → ') || 'ikke oppgitt'}. Valgregel i kilden: ${rule || 'ikke oppgitt'}. Kontroller kombinasjonen før du velger emnet.` : '', !row.publisertEmneplan ? 'Emnet står i programplanen, men emnebeskrivelsen er ikke publisert for denne perioden.' : '', Number(row.varighet) > 1 ? `Emnet går over ${Number(row.varighet)} semestre.` : ''].filter(Boolean).join(' ')
    const existing = period.courses.find(course => course.sourceRecordId === id)
    if (existing) { if (existing.sourceRule !== rule) { existing.choice = 'V'; existing.notes += ' Kilden oppgir flere valgregler; velg emnet selv etter kontroll.' }; continue }
    period.courses.push({ id: `usn:${ref.id}:${number}:${id}`, code: match[1], name: clean(row.emnenavn), credits: asCredits(row.studiepoeng), choice: complex ? 'V' : /^obligatorisk$/i.test(rule) ? 'O' : /^valg/i.test(rule) ? 'V' : '', sourceRule: rule, sourceRecordId: id, sourceVersion: clean(metadata.updateTime) || ref.id, sourceProvider: 'usn', sourceUrl: row.publisertEmneplan ? `${publicPage}#/subject/${encodeURIComponent(`${id}_${variant.language}`)}` : sourceUrl, university: 'Universitetet i Sørøst-Norge', description: '', notes, year, semester, campus: '' })
  }
  if (!periods.size) fail('source-changed', 'Ingen lesbare emner med studiesemester ble funnet i den valgte planen.')
  if (complex) for (const period of periods.values()) period.requirements.push(`Planen har flere emnegrupper: ${[...distinctGroups].join('; ')}. Kontroller studieretning og valgregler i kilden. Ingen grupper eller emner er valgt automatisk.`)
  if ([...periods.values()].some(period => !period.year || !period.semester)) warnings.push('Kalendersemester mangler for deler av planen og må avklares før import.')
  warnings.push('Undervisningstid, campus, grupper og personlig timeplan er ikke hentet fra denne programkilden.')
  return { status: 'ok', program: { code: ref.code, name: clean(metadata.studieprogramnavn), cohort: ref.cohort, intake: ref.intake, sourceUrl, campuses: [] }, models: [{ id: 'published', name: 'Publisert studieplan', periods: [...periods.values()].sort((a, b) => a.studySemester - b.studySemester) }], warnings: [...new Set(warnings)], completeness: { complete: !warnings.some(w => w.includes('utelatt')), pages: 2, returned: rows.length } }
}

export async function usnPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const $ = load(await cachedText(fetchText, publicPage, pageValidate)), config = parseJson($('usn-study').attr('searchoptions') || '{}')
    const year = String(query.year || query.cohort || config.year || ''), semester = query.semester === 'spring' ? 'VÅR' : query.semester === 'autumn' ? 'HØST' : config.semester
    if (!/^20\d{2}$/.test(year) || !['HØST', 'VÅR'].includes(semester) || Number(year) < Number(config.minYear) || Number(year) > Number(config.maxYear)) fail('invalid-selection', 'Velg et år og semester som finnes i USNs offentlige katalog.')
    const key = `${year}:${semester}`, owner = fetchText.cacheKey || fetchText
    let cache = postCaches.get(owner); if (!cache) { cache = new Map(); postCaches.set(owner, cache) }
    let entry = cache.get(key)
    if (!entry || Date.now() - entry.time >= 600000) {
      const payload = parseJson(await fetchText(api, 0, apiValidate, { usnCatalogue: { year, semester } }))
      entry = { time: Date.now(), results: parseUsnCatalogue(payload) }
      if (cache.size >= 24) cache.delete(cache.keys().next().value)
      cache.set(key, entry)
    }
    // The published search returns the complete selected-period list, with no pagination fields.
    const results = entry.results.filter(row => !query.q || `${row.code} ${row.name}`.toLocaleLowerCase('nb-NO').includes(String(query.q).toLocaleLowerCase('nb-NO')))
    return { status: results.length ? 'ok' : 'no-matching-results', results, warnings: [], sourceUrl: publicPage, completeness: { complete: true, pages: 1, returned: entry.results.length } }
  }
  const ref = selectedRef(query)
  if (action === 'program-cohorts') {
    const results = parseUsnCohorts(parseJson(await cachedText(fetchText, `${api}${encodeURIComponent(ref.code)}/kull`, apiValidate)), ref.code)
    return { status: 'ok', results, warnings: [], completeness: { complete: true, pages: 1, returned: results.length } }
  }
  if (action === 'program-plan') {
    const url = `${api}${encodeURIComponent(ref.id)}`
    const payload = parseJson(await cachedText(fetchText, url, apiValidate))
    const subjects = parseJson(await cachedText(fetchText, `${url}/studiemodellemner`, apiValidate))
    return parseUsnPlan(payload, subjects, ref)
  }
  fail('not-supported', 'Denne handlingen støttes ikke av USNs programimport.')
}
