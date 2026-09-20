import { load, clean, fail, cachedText, restrictedUrl, asCredits, MAX_PAGES, MAX_RESULTS } from './program-source.js'

const origin = 'https://www.forsvaret.no', catalogue = `${origin}/utdanning/utdanninger`
const programPath = /^\/utdanning\/utdanninger\/([^/]+)(?:\/([^/]+))?\/?$/
export const fhsProgramUrl = input => restrictedUrl(input, { origin, paths: [/^\/utdanning\/utdanninger\/?$/, programPath] })
const serviceUrl = input => restrictedUrl(input, { origin, paths: [/^\/utdanning\/utdanninger\/_\/service\/no\.bouvet\.forsvaret\/list-education-service$/], keys: ['initialTypes', 'locations', 'start', 'count'] })
const courseUrl = input => restrictedUrl(input, { origin, paths: [/^\/utdanning\/emner\/[^/]+\/[^/]+\/?$/] })
function ref(input) {
  const url = fhsProgramUrl(input), match = decodeURI(url.pathname).match(programPath)
  if (!match) fail('invalid-selection', 'Velg et publisert studieprogram ved Forsvarets høgskole.')
  return { url, code: match[1], version: match[2] || '' }
}
export function parseFhsCohorts(html, input) {
  const source = ref(input), $ = load(html), results = new Map()
  $('.list-child__container a[href], a[href]').each((_, node) => {
    let next; try { next = ref(new URL($(node).attr('href'), source.url)) } catch { return }
    if (next.code !== source.code || !next.version) return
    const label = clean($(node).text()), pathYear = next.version.match(/(?:^|-)(20\d{2})(?:-|$)/)?.[1]
    const labelYear = label.match(/\b(20\d{2})\b/)?.[1]
    const short = label.match(/(?:høst|vår|kull)\s+(\d{2})\b/i)?.[1]
    const conflict = pathYear && ((labelYear && pathYear !== labelYear) || (short && !pathYear.endsWith(short)))
    const cohort = pathYear || labelYear
    if (!label || results.has(next.url.href)) return
    results.set(next.url.href, { cohort: !cohort || conflict ? 'student' : cohort, label,
      sourceUrl: next.url.href, ...(!cohort || conflict ? { requiresStudentCohort: true, sourceEdition: next.version } : {}) })
  })
  if (!results.size) fail('not-supported', 'Programmet har ingen lenket og lesbar kullplan i den offentlige katalogen. Bruk dokumentimport eller registrer emnene selv.')
  return [...results.values()].sort((a, b) => b.cohort.localeCompare(a.cohort))
}
async function catalogueData(fetchText) {
  const $ = load(await cachedText(fetchText, catalogue, fhsProgramUrl))
  let config
  try { config = JSON.parse($('script[data-part-id][type="application/json"]').first().text()) } catch { fail('source-changed', 'Den offentlige programkatalogens oppsett har endret format.') }
  if (!config.serviceUrl || !Number.isInteger(config.perPage) || config.perPage < 1 || config.perPage > 100) fail('source-changed', 'Programkatalogen mangler en gjenkjennelig sidegrense.')
  const endpoint = serviceUrl(new URL(config.serviceUrl, catalogue)), seen = new Set(), results = [], warnings = []
  let total = null, pages = 0, start = 0, complete = true
  while (pages < MAX_PAGES && seen.size < MAX_RESULTS) {
    const url = new URL(endpoint); url.searchParams.set('start', String(start)); url.searchParams.set('count', String(config.perPage))
    let data
    try { data = JSON.parse(await cachedText(fetchText, url.href, serviceUrl)) } catch (error) { if (!pages || error.name === 'AbortError') throw error; complete = false; warnings.push(`Neste katalogside kunne ikke hentes: ${error.message}`); break }
    if (!Array.isArray(data.hits) || !Number.isInteger(data.total) || data.total < 0) fail('source-changed', 'Katalogsvaret mangler resultater eller totalt antall.')
    pages++; total = data.total
    const before = seen.size
    for (const row of data.hits) {
      if (!row._id || seen.has(row._id)) continue
      seen.add(row._id)
      if (!/(?:Bachelor|Master|Videreutdanning)/i.test(row.data?.type || '')) continue
      const selected = ref(new URL(row.url, catalogue)), name = clean(row.title)
      if (!name || selected.version) continue
      results.push({ code: selected.code, name, level: clean(row.data.type), sourceUrl: selected.url.href,
        campuses: clean(row.data.location) ? [clean(row.data.location)] : [] })
    }
    start += data.hits.length
    if (seen.size >= total) break
    if (!data.hits.length || seen.size === before) { complete = false; warnings.push('Kilden avsluttet eller gjentok katalogen før oppgitt totalantall.'); break }
  }
  if (seen.size < total) complete = false
  if (!complete && !warnings.length) warnings.push('Den synlige sikkerhetsgrensen for kataloghenting er nådd.')
  return { results, warnings, completeness: { complete, pages, returned: results.length, sourceReturned: seen.size, sourceTotal: total,
    scope: 'Alle sider av den publiserte utdanningslisten, avgrenset til kildens bachelor-, master- og videreutdanningskategorier. Enkelte kategorirader kan mangle publisert studieplan.' } }
}
export function parseFhsPlan(html, query, program) {
  const source = ref(query.sourceUrl), $ = load(html), name = clean($('h1').first().text()).replace(/^Studieplan for\s+/i, ''), periods = [], warnings = []
  if (source.code !== query.program || !source.version || !name) fail('invalid-selection', 'Velg en navngitt planversjon for det aktuelle programmet.')
  $('.semester-section-header').each((_, header) => {
    const label = clean($(header).find('.semester-lead').text())
    const terms = [...label.matchAll(/(Høst|Vår)\s+(\d{4})/gi)].map(m => ({ year: +m[2], semester: /^v/i.test(m[1]) ? 'spring' : 'autumn' }))
    const sections = $(header).nextUntil('.semester-section-header').filter('.semester-section')
    const legend = clean($(header).find('.icon-description').text()), knownOptional = /Valgfritt emne/i.test(legend)
    sections.each((index, node) => {
      const section = $(node), title = clean(section.children('h4').text()), number = Number(title.match(/^(\d+)\.\s*semester$/i)?.[1])
      if (!Number.isInteger(number) || number < 1 || number > 40) fail('source-changed', `Studiesemesteret «${title}» må avklares i kilden.`)
      const term = terms.length === sections.length ? terms[index] : { year: null, semester: null }
      const period = { id: String(number), studySemester: number, ...term, label: `${number}. studiesemester · ${term.year ? `${term.semester === 'spring' ? 'Vår' : 'Høst'} ${term.year}` : 'avklar kalendersemester'}`, courses: [], requirements: [] }
      if (!term.year) warnings.push(`${title}: årstabellen «${label}» gir ingen entydig kalenderplassering.`)
      section.find('a.semester-subject[href]').each((__, anchor) => {
        const item = $(anchor), url = courseUrl(new URL(item.attr('href'), source.url)), cells = item.find('.inner-lower .flexit > span')
        const code = clean(cells.eq(0).text()), courseName = clean(item.find('.inner-top .flexit > span').first().text()), credits = asCredits(cells.eq(1).text())
        if (!code || !courseName || decodeURI(url.pathname).split('/')[3] !== code) fail('source-changed', 'Emnekode og emnelenke stemmer ikke overens i studieplanen.')
        if (period.courses.some(course => course.code === code)) return
        const optional = item.find('img[src*="puzzle-tile"]').length > 0, shared = item.find('img[src*="hourglass"]').length > 0
        const sourceVersion = decodeURI(url.pathname).split('/')[4], versionYear = Number(sourceVersion.match(/^(\d{4})/)?.[1]), versionUncertain = term.year && versionYear !== term.year
        const notes = [`Kildeutdrag: ${label}; ${title}; ${courseName} ${code} ${clean(cells.eq(1).text())}.`, ...(shared ? ['Emnet går over flere semestre; studiepoeng gjelder hele emnet.'] : []), ...(versionUncertain ? [`Emnebeskrivelsens kildeversjon ${sourceVersion} avviker fra planens kalenderår ${term.year}. Kontroller beskrivelsen; kalenderen er beholdt fra planoverskriften.`] : [])].join(' ')
        period.courses.push({ id: `fhs:${source.code}:${source.version}:${number}:${code}`, code, name: courseName, credits, choice: optional ? 'V' : knownOptional ? 'O' : '', ...term,
          campus: '', university: 'Forsvarets høgskole', description: '', notes, sourceProvider: 'fhs', sourceRecordId: code, sourceVersion, sourceUrl: url.href, ...(versionUncertain ? { versionUncertain: true } : {}) })
      })
      if (!period.courses.length) period.requirements.push(`Kilden publiserer ingen navngitte emner i ${title}.`)
      periods.push(period)
    })
  })
  if (!periods.some(p => p.courses.length)) fail('not-supported', 'Planversjonen mangler lesbare semestertabeller. Bruk dokumentimport eller registrer emnene selv.')
  return { status: 'ok', program: { ...program, name, cohort: String(query.cohort), sourceUrl: source.url.href,
    ...(query.cohortFromStudent === 'true' ? { cohortFromStudent: true, sourceEdition: source.version } : {}) }, models: [{ id: source.version, name: 'Publisert studieplan', periods }],
    warnings: [...warnings, 'Planens kalenderår og emnebeskrivelsens versjon er ulike opplysninger. Eldre emnelenker er beholdt med varsel; velg valgemner og campus selv.', 'Undervisning og personlige grupper inngår ikke i denne offentlige studieplanen.'],
    completeness: { complete: !warnings.length, pages: 1, returned: periods.reduce((n, p) => n + p.courses.length, 0), scope: 'Navngitte emner og valgemner i den valgte publiserte kullplanens semestertabeller.' } }
}
export async function fhsPrograms(institution, action, query, { fetchText }) {
  if (institution !== 'fhs') fail('invalid-selection', 'Ukjent lærested.')
  const data = await catalogueData(fetchText)
  if (action === 'programs') { const q = clean(query.q).toLocaleLowerCase('nb'); return { status: 'ok', ...data, results: data.results.filter(p => !q || `${p.code} ${p.name}`.toLocaleLowerCase('nb').includes(q)) } }
  const selected = ref(query.sourceUrl), program = data.results.find(p => p.code === query.program)
  if (!program || selected.code !== query.program) fail('invalid-selection', 'Programmet finnes ikke i den publiserte katalogen.')
  const programGuard = input => { const url = fhsProgramUrl(input); if (url.href !== program.sourceUrl) fail('invalid-selection', 'Kilden videresendte til et annet program.'); return url }
  const cohorts = parseFhsCohorts(await cachedText(fetchText, program.sourceUrl, programGuard), program.sourceUrl)
  if (action === 'program-cohorts') return { status: 'ok', results: cohorts, warnings: ['Planversjoner og år er hentet fra publiserte lenker. Motstridende eller manglende kullår må avklares av studenten.'], completeness: { complete: true, pages: 1, returned: cohorts.length, scope: 'Planlenker publisert på valgt programside.' } }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke.')
  const cohort = cohorts.find(c => c.sourceUrl === selected.url.href)
  if (!cohort || (cohort.requiresStudentCohort ? query.cohortFromStudent !== 'true' || !/^\d{4}$/.test(String(query.cohort)) || +query.cohort < 1900 || +query.cohort > 2200 : cohort.cohort !== query.cohort)) fail('invalid-selection', 'Velg en publisert plan og avklar riktig opptakskull.')
  const guard = input => { const url = fhsProgramUrl(input); if (url.href !== selected.url.href) fail('invalid-selection', 'Kilden videresendte til en annen planversjon.'); return url }
  return parseFhsPlan(await cachedText(fetchText, selected.url.href, guard), query, program)
}
