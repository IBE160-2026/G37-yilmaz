import { load, clean, fail, cachedText, restrictedUrl, asCredits } from './program-source.js'

const origin = 'https://www.nhh.no', catalogue = `${origin}/studier/`
const validate = input => restrictedUrl(input, { origin, paths: [/^\/(?:studier|en\/study-programmes|for-studenter\/internasjonale-muligheter)\/(?:[a-z0-9-]+\/){0,5}$/], keys: ['term'] })
const codeOf = input => new URL(input).pathname.replace(/^\/|\/$/g, '').replaceAll('/', ':')
const courseUrl = input => restrictedUrl(input, { origin, paths: [/^\/(?:emner|en\/courses)\/[a-z0-9-]+\/$/] })
const withoutTerm = input => { const url = validate(input); url.search = ''; return url.href }
const cohortValue = value => /^(?:19|20|21|22)\d{2}_(?:HØST|VÅR)$/.test(String(value))
const textOf = ($, node) => clean($(node).clone().find('script,style').remove().end().text())
const pageText = (fetchText, input) => {
  const expected = validate(input).href
  return cachedText(fetchText, expected, input => { const actual = validate(input); if (actual.href !== expected) fail('invalid-selection', 'NHH videresendte til en annen program- eller emnekilde.'); return actual })
}

export function parseNhhCatalogue(html) {
  const $ = load(html), results = new Map()
  $('main a[href] > article > h2').each((_i, node) => {
    const url = validate(new URL($(node).parent().parent().attr('href'), catalogue)), name = clean($(node).text())
    if (name) results.set(url.href, { code: codeOf(url), name, sourceUrl: url.href, campuses: [] })
  })
  if (!results.size) fail('source-changed', 'NHHs publiserte programoversikt har endret format.')
  return [...results.values()]
}

function variants(html, parent) {
  const $ = load(html), results = new Map(), lists = []
  $('main .linkList').each((_i, node) => { if (/^Vi tilbyr$/i.test(clean($(node).children('h2').text()))) lists.push(node) })
  $('main h2').each((_i, node) => { if (/^Spesialiseringer|^Speciali[sz]ations|^Majors/i.test(clean($(node).text()))) lists.push(...$(node).nextUntil('h2').toArray()) })
  for (const list of lists) $(list).find('a[href]').each((_i, node) => {
    const url = validate(new URL($(node).attr('href'), parent.sourceUrl)), name = clean($(node).text())
    if (url.href.startsWith(parent.sourceUrl) && url.href !== parent.sourceUrl && name) results.set(url.href, { code: codeOf(url), name: `${parent.name} · ${name}`, sourceUrl: url.href, campuses: [], parentName: parent.name })
  })
  return [...results.values()]
}

async function cataloguePrograms(fetchText) {
  const programs = parseNhhCatalogue(await pageText(fetchText, catalogue)), warnings = []
  // These are the source's programme-family entrances, not demonstration data.
  // Variants are always read from the published links, with no invented majors.
  const families = new Set(['/studier/master-i-okonomi-og-administrasjon/', '/studier/master-i-regnskap-og-revisjon/'])
  let pages = 1, complete = true
  for (const parent of [...programs].filter(program => families.has(new URL(program.sourceUrl).pathname))) {
    try { programs.push(...variants(await pageText(fetchText, parent.sourceUrl), parent)); pages++ }
    catch (error) { if (error.name === 'AbortError') throw error; complete = false; warnings.push(`${parent.name}: retningene kunne ikke hentes (${error.message}). De øvrige programoppføringene er beholdt.`) }
  }
  return { status: 'ok', results: programs, warnings, completeness: { complete, pages, returned: programs.length, scope: 'Publiserte programkort og lenkede masterprofiler/MRR-varianter. Listen bekrefter ikke at alle variantene har en støttet studieplan.' } }
}

function linkedCatalogues(html, pageUrl) {
  const $ = load(html), sources = new Map()
  $('main a[href]').each((_i, node) => {
    const label = clean($(node).text()), href = $(node).attr('href')
    if (!/^(?:Courses(?: in)?|Emner(?: i)?|Alle emner)\b/i.test(label) && !/\/(?:emneoversikt[^/]*|courses-in-[^/]+)\/$/.test(href)) return
    const url = validate(new URL(href, pageUrl))
    // Source tables may be shared by variants; only a link actually published
    // on the selected programme page grants that relationship.
    sources.set(url.href, { sourceUrl: url.href, name: label || 'Publisert emneoversikt' })
  })
  return [...sources.values()]
}

async function programmeSources(program, fetchText) {
  let pageUrl = program.sourceUrl, html = await pageText(fetchText, pageUrl), sources = linkedCatalogues(html, pageUrl)
  if (!sources.length) {
    const $ = load(html), english = $('main a[href]').toArray().find(node => /engelske sider|engelske sidene|english/i.test(clean($(node).text())) && /^\/en\/study-programmes\//.test($(node).attr('href') || ''))
    if (english) { pageUrl = validate(new URL($(english).attr('href'), pageUrl)).href; html = await pageText(fetchText, pageUrl); sources = linkedCatalogues(html, pageUrl) }
  }
  if (!sources.length) fail('not-supported', 'Denne NHH-oppføringen har ingen støttet, lenket emneoversikt. Velg en konkret profil eller studievariant fra programlisten, eller bruk dokumentimport av den publiserte planen.')
  return { sources, html, pageUrl }
}

export function parseNhhCohorts(html, source) {
  const $ = load(html), selector = $('select[name=term]'), context = clean(selector.closest('form').text())
  if (!selector.length || !/(?:startår|starting year)/i.test(context)) fail('source-changed', 'NHHs emneoversikt har ingen gjenkjennelig velger for opptakskull. Et undervisningssemester blir ikke brukt som kull.')
  const results = []
  selector.find('option').each((_i, node) => {
    const cohort = $(node).attr('value')
    if (!cohortValue(cohort)) fail('source-changed', 'NHH har en kullverdi som ikke kan tolkes sikkert.')
    const url = validate(source.sourceUrl); url.searchParams.set('term', cohort)
    results.push({ cohort, label: `${source.name} · ${clean($(node).text())}`, sourceUrl: url.href })
  })
  if (!results.length) fail('not-supported', 'NHHs publiserte kullvelger er tom.')
  return results
}

function diagramModel(html, sourceUrl, courses, program, cohort) {
  const $ = load(html), periods = [], rows = new Map(courses.map(course => [course.code, course]))
  $('.dynamicRowBlock').each((_i, node) => {
    const block = $(node), label = clean(block.children('h2.blockHeading').text()), match = label.match(/^(?:(\d+)\.\s*semester|Semester\s+(\d+))\s*\((høst|vår|autumn|spring)\)/i)
    if (!match) return
    const number = +(match[1] || match[2]), semester = /vår|spring/i.test(match[3]) ? 'spring' : 'autumn'
    if (number < 1 || number > 40) fail('source-changed', 'NHHs gjeldende oppbygging har et ugyldig studiesemesternummer.')
    const period = { id: String(number), studySemester: number, year: null, semester, label: `${number}. studiesemester · ${match[3]} · gjeldende oppbygging, kontroller kull`, courses: [], requirements: ['Denne plasseringen er fra den gjeldende programsiden. Den er ikke verifisert som semesterplassering for valgt historisk kull. Velg bare emner du har kontrollert mot egen plan.'] }
    block.find('.coursePageTeaser').each((_i, item) => {
      const card = $(item), code = clean(card.find('.courseCode').text()).match(/^([A-ZÆØÅ0-9]+)\s*\(\s*(\d+(?:[.,]\d+)?)/)?.[1], title = clean(card.find('.listHeading').text()), row = rows.get(code)
      if (row && title) period.courses.push({ ...row, id: `nhh-program:${program.code}:${cohort}:${number}:${code}`, choice: '', semester, requiresSemesterChoice: true, notes: `${row.notes} Gjeldende programdiagram plasserer emnet i ${number}. studiesemester; denne plasseringen må bekreftes for ditt kull. Kilde: ${sourceUrl}` })
      else if (textOf($, item)) period.requirements.push(textOf($, item))
    })
    if (period.courses.length || period.requirements.length) periods.push(period)
  })
  if (!periods.some(period => period.courses.length)) return null
  const placed = new Set(periods.flatMap(period => period.courses.map(course => course.code)))
  return { id: 'current-diagram', name: 'Gjeldende semesteroppbygging · bekreft at den gjelder ditt kull', periods, unplacedCourses: courses.filter(course => !placed.has(course.code)) }
}

export function parseNhhPlan(html, query, program, source, programmeHtml = '', programmeUrl = program.sourceUrl) {
  const $ = load(html), options = parseNhhCohorts(html, source), selected = options.find(option => option.cohort === query.cohort)
  if (!selected || $('select[name=term] option[selected]').attr('value') !== query.cohort) fail('source-changed', 'NHH bekrefter ikke det valgte opptakskullet i den returnerte siden. Ingen annen kullversjon er brukt.')
  const periods = [], all = [], unplaced = [], warnings = [], intro = $('main .abstract,main .editor').toArray().map(node => textOf($, node)).filter(Boolean).join(' ').slice(0,12000)
  let omitted = 0
  $('main table.courseTable').each((_i, node) => {
    const table = $(node), group = clean(table.prevAll('h2,h3,h4').first().text()), headers = table.find('th').map((_i, node) => clean($(node).text())).get()
    if (!/^(?:Kode|Code)$/i.test(headers[0] || '') || !/^(?:Navn|Name)$/i.test(headers[1] || '') || !headers.includes('Semester')) fail('source-changed', 'NHHs emnetabell har endret kolonner.')
    if (/utgåtte|hvilende|discontinued|dormant/i.test(group)) { omitted += table.find('tbody tr').length; return }
    const number = group.match(/Semester\s+(\d+)/i)?.[1], studySemester = number ? +number : null
    if (studySemester && (studySemester < 1 || studySemester > 40)) fail('source-changed', 'NHHs tabell har et ugyldig studiesemester.')
    let period = studySemester ? periods.find(period => period.studySemester === studySemester) : null
    if (studySemester && !period) { period = { id: String(studySemester), studySemester, year: null, semester: null, label: `${studySemester}. studiesemester · avklar kalendersemester`, courses: [], requirements: [] }; periods.push(period) }
    if (period) period.requirements.push(group)
    const choice = /obligatorisk|mandatory|compulsory/i.test(group) ? 'O' : /valgemn|valgf|elective|one of|minst|minimum/i.test(group) ? 'V' : ''
    table.find('tbody tr').each((_i, node) => {
      const row = $(node), codeLink = row.find('a.code'), nameLink = row.find('a.triangleLink'), code = clean(codeLink.text()), name = clean(nameLink.clone().find('.forMobile').remove().end().text())
      if (/tilbys ikke|utgått|expired|not offered|dormant/i.test(clean(row.text()))) { omitted++; return }
      if (!/^[A-ZÆØÅ0-9_-]{2,20}$/.test(code) || !name || !codeLink.attr('href')) fail('source-changed', 'En NHH-emnerad mangler entydig kode, navn eller kilde.')
      const sourceUrl = courseUrl(new URL(codeLink.attr('href'), source.sourceUrl)).href, term = clean(row.find('.term').text()), seasons = [...new Set([...(/høst|autumn|fall/i.test(term) ? ['autumn'] : []), ...(/vår|spring/i.test(term) ? ['spring'] : [])])]
      const semester = seasons.length === 1 ? seasons[0] : null
      const course = { id: `nhh-program:${program.code}:${query.cohort}:${studySemester || 'unplaced'}:${code}`, code, name, credits: asCredits(row.find('.studypoints').text()), choice, courseGroup: group, sourceProvider: 'nhh-program', sourceRecordId: code, sourceVersion: query.cohort, sourceUrl, university: 'NHH', description: '', notes: `Kildegruppe: ${group}. ${term ? `Publisert undervisningssesong: ${term}.` : 'Undervisningssesong mangler i kildefeltet; den blir ikke gjettet.'} ${studySemester ? '' : 'Kilden oppgir ikke studiesemester; du må bekrefte plasseringen.'}`, year: null, semester, campus: '', ...(!studySemester ? { requiresSemesterChoice: true } : {}) }
      if (all.some(existing => existing.id === course.id)) { const existing = all.find(existing => existing.id === course.id); existing.courseGroup = `${existing.courseGroup}; ${group}`; existing.choice = existing.choice === choice ? choice : ''; return }
      all.push(course); (period ? period.courses : unplaced).push(course)
    })
  })
  if (!all.length) fail('not-supported', 'NHHs valgte emneoversikt har ingen støttede aktive emner.')
  for (const period of periods) {
    const semesters = new Set(period.courses.map(course => course.semester))
    if (semesters.size === 1 && !semesters.has(null)) period.semester = [...semesters][0]
    period.requirements.unshift(intro)
  }
  const models = []
  if (!periods.length) {
    const diagram = diagramModel(programmeHtml, programmeUrl, all, program, query.cohort)
    if (diagram) models.push(diagram)
    models.push({ id: 'published-groups', name: `${source.name} · oppgi studiesemester selv`, periods: [{ id: 'unplaced', studySemester: null, requiresStudentStudySemester: true, year: null, semester: null, label: 'Publiserte emnegrupper · studiesemester må avklares', courses: all, requirements: [intro, 'Tabellens «Semester» er undervisningssesong. Velg studiesemester, kalenderår og sesong fra din egen studieplan. Ingen emner er forhåndsvalgt.'] }] })
  } else models.push({ id: 'published-semesters', name: source.name, periods, unplacedCourses: unplaced })
  warnings.push('Opptakskullet kommer fra NHHs uttrykkelige startår-/semestervelger. Kalenderår velges separat; undervisningssesong er ikke det samme som studiesemester.', 'Velg alternativer, valgemner og campus selv. Uklare semesterfelt beholdes som ukjente. Emnekoder i overgangsregler er ikke automatisk nye emner.', 'Undervisning, campus og personlige grupper er ikke verifisert av denne emneoversikten.')
  if (omitted) warnings.push(`${omitted} rader under utgåtte eller hvilende emner er utelatt fra nye importforslag. Tidligere importerte emner slettes ikke.`)
  return { status: 'ok', program: { ...program, cohort: query.cohort, sourceUrl: selected.sourceUrl, sourceEdition: query.cohort }, models, warnings, completeness: { complete: false, pages: 1, returned: all.length, omitted, reason: 'Aktive emner i valgt kildeutvalg er lest; kalenderår, manglende semesterplassering og fullstendige valgfagskombinasjoner krever studentens avklaring.' } }
}

export async function nhhPrograms(institution, action, query, { fetchText }) {
  const catalogueData = await cataloguePrograms(fetchText)
  if (action === 'programs') {
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { ...catalogueData, results: catalogueData.results.filter(program => !q || `${program.code} ${program.name}`.toLocaleLowerCase('nb').includes(q)) }
  }
  const program = catalogueData.results.find(program => program.code === query.program)
  if (!program) fail('invalid-selection', 'Velg et NHH-program fra den publiserte programlisten.')
  const info = await programmeSources(program, fetchText)
  if (action === 'program-cohorts') {
    if (validate(query.sourceUrl).href !== program.sourceUrl) fail('invalid-selection', 'NHH-programmet stemmer ikke med valgt programlenke.')
    const results = []
    for (const source of info.sources) results.push(...parseNhhCohorts(await pageText(fetchText, source.sourceUrl), source))
    return { status: 'ok', results, warnings: ['Velg kildens startår/-semester og riktig emneutvalg eller profil uttrykkelig. Dette er ikke ditt aktuelle kalendersemester.'], completeness: { complete: true, pages: info.sources.length, returned: results.length } }
  }
  if (action !== 'program-plan' || !cohortValue(query.cohort)) fail('invalid-selection', 'Velg et publisert NHH-opptakskull.')
  const requested = validate(query.sourceUrl), source = info.sources.find(source => source.sourceUrl === withoutTerm(requested))
  if (!source || requested.searchParams.get('term') !== query.cohort) fail('invalid-selection', 'Emneoversikten eller kullparameteren er ikke publisert for det valgte NHH-programmet.')
  const available = parseNhhCohorts(await pageText(fetchText, source.sourceUrl), source)
  if (!available.some(option => option.cohort === query.cohort)) fail('invalid-selection', 'NHH publiserer ikke valgt opptakskull for dette emneutvalget.')
  const guard = input => { const url = validate(input); if (url.href !== requested.href) fail('invalid-selection', 'NHH videresendte til en annen kullversjon.'); return url }
  return parseNhhPlan(await cachedText(fetchText, requested.href, guard), query, program, source, info.html, info.pageUrl)
}
