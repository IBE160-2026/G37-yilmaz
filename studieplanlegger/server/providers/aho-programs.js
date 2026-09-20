import { load, clean, fail, cachedText, restrictedUrl, asCredits } from './program-source.js'

const origin = 'https://www.aho.no'
const catalogueUrl = `${origin}/studier/program/`
const university = 'Arkitektur- og designhøgskolen i Oslo'
const programmePaths = [
  /^\/studier\/program\/[a-z0-9-]+\/?$/i,
  /^\/english\/studies\/programmes\/[a-z0-9-]+\/?$/i
]
const archivePaths = [
  /^\/studier\/program\/[a-z0-9-]+\/studieplaner\/?$/i,
  /^\/english\/studies\/programmes\/[a-z0-9-]+\/(?:study-plans|studyplans)\/?$/i
]
const planPaths = [
  /^\/studier\/program\/[a-z0-9-]+\/studieplaner\/\d{4}\.html$/i,
  /^\/english\/studies\/programmes\/[a-z0-9-]+\/(?:study-plans|studyplans)\/\d{4}\.html$/i
]
const coursePaths = [
  /^\/studier\/emner\/\d{4}\/(?:host|var)\/[a-z0-9-]+\.html$/i,
  /^\/english\/studies\/courses\/\d{4}\/(?:autumn|spring)\/[a-z0-9-]+\.html$/i
]

export function ahoProgramUrl(input) {
  const url = new URL(input.href || input)
  if (url.origin === 'https://aho.no') url.hostname = 'www.aho.no'
  return restrictedUrl(url, { origin, paths: [/^\/studier\/program\/?$/i, ...programmePaths, ...archivePaths, ...planPaths, ...coursePaths] })
}

function programmeIdentity(input) {
  const url = ahoProgramUrl(input)
  let match = url.pathname.match(/^\/studier\/program\/([a-z0-9-]+)\/?$/i)
  if (match) return `no:${match[1].toLowerCase()}`
  match = url.pathname.match(/^\/english\/studies\/programmes\/([a-z0-9-]+)\/?$/i)
  if (match) return `en:${match[1].toLowerCase()}`
  fail('invalid-selection', 'AHO-lenken peker ikke på et publisert studieprogram.')
}

function programmeUrlFromPlan(input) {
  const url = ahoProgramUrl(input)
  const path = url.pathname
    .replace(/\/(?:studieplaner|study-plans|studyplans)\/\d{4}\.html$/i, '/')
    .replace(/\/(?:studieplaner|study-plans|studyplans)\/?$/i, '/')
  const programme = new URL(path, origin)
  programmeIdentity(programme)
  return programme.href
}

export function parseAhoCatalogue(html) {
  const $ = load(html), results = new Map()
  $('#vrtx-main-content h3 a, main h3 a').each((_, link) => {
    let url
    try { url = ahoProgramUrl(new URL($(link).attr('href'), catalogueUrl)) } catch { return }
    if (!programmePaths.some(pattern => pattern.test(url.pathname))) return
    const name = clean($(link).text())
    if (!name) return
    results.set(url.href, { code: programmeIdentity(url), name, level: /master/i.test(name) ? 'Master' : '', sourceUrl: url.href, campuses: [] })
  })
  if (!results.size) fail('source-changed', 'Ingen studieprogram kunne leses fra AHOs publiserte programoversikt.')
  return [...results.values()]
}

function planRecord(link, base, currentUrl = '') {
  let sourceUrl
  try { sourceUrl = ahoProgramUrl(new URL(link.attr('href'), base)).href } catch { return null }
  if (!planPaths.some(pattern => pattern.test(new URL(sourceUrl).pathname))) return null
  const cohort = new URL(sourceUrl).pathname.match(/\/(\d{4})\.html$/)?.[1]
  const label = clean(link.text()), edition = label.match(/\((\d{4})\s*[–-]\s*(\d{4})\)/)
  if (!cohort || (edition && edition[1] !== cohort)) fail('source-changed', 'AHOs planarkiv har motstridende årstall for samme planutgave.')
  const historical = Boolean(currentUrl && sourceUrl !== currentUrl)
  return { cohort, label: edition ? `Planutgave ${edition[1]}–${edition[2]}${historical ? ' · historisk' : ''}` : `Planutgave ${cohort}${historical ? ' · historisk' : ''}`, sourceUrl, ...(historical ? { historical: true } : {}) }
}

export function parseAhoProgrammePage(html, sourceUrl) {
  const $ = load(html), currentLink = $('.current-plan').first(), archiveLink = $('.all-plans').first()
  const current = currentLink.length ? planRecord(currentLink, sourceUrl) : null
  let archiveUrl = ''
  if (archiveLink.length) {
    try { archiveUrl = ahoProgramUrl(new URL(archiveLink.attr('href'), sourceUrl)).href } catch { fail('source-changed', 'AHOs lenke til eldre studieplaner er utenfor den publiserte programkilden.') }
  }
  if (!current) fail('not-supported', 'AHO-programmet har ingen lesbar gjeldende studieplan i den publiserte programsiden.')
  return { current, archiveUrl }
}

export function parseAhoPlanArchive(html, archiveUrl, currentUrl) {
  const $ = load(html), records = new Map()
  $('a.vrtx-title-link, a.fs-studieprogram-plan').each((_, node) => {
    const record = planRecord($(node), archiveUrl, currentUrl)
    if (record) records.set(record.sourceUrl, record)
  })
  return [...records.values()].sort((a, b) => Number(b.cohort) - Number(a.cohort))
}

function campusFromFacts($) {
  let campus = ''
  $('.facts-wrapper .dg').each((_, row) => {
    if (/^(Studiested|Place of study):?$/i.test(clean($(row).find('dt').text()))) campus = clean($(row).find('dd').text())
  })
  return campus
}

function termFromHeading(value) {
  const match = clean(value).match(/^(Høst|Haust|Vår|Autumn|Spring)\s+(\d{4})$/i)
  if (!match) return null
  return { year: Number(match[2]), semester: /^(vår|spring)$/i.test(match[1]) ? 'spring' : 'autumn' }
}

export function parseAhoPlan(html, sourceUrl, selectedCode, selectedCohort) {
  const url = ahoProgramUrl(sourceUrl), code = programmeIdentity(programmeUrlFromPlan(url))
  if (code !== selectedCode) fail('invalid-selection', 'Studieplanen tilhører ikke det valgte AHO-programmet.')
  const $ = load(html), heading = clean($('h1').first().text())
  const title = heading.match(/^(?:Studieplan for|Study plan for)\s+(.+?)\s*\((\d{4})\s*[–-]\s*(\d{4})\)$/i)
  if (!title || title[2] !== String(selectedCohort)) fail('source-changed', 'AHO-siden bekrefter ikke valgt program og planutgave.')
  const campus = campusFromFacts($), periods = [], seenPeriods = new Set()
  $('.vrtx-fs-study-model .term').each((index, term) => {
    const calendar = termFromHeading($(term).children('h3').first().text())
    if (!calendar) fail('source-changed', 'En publisert AHO-periode mangler entydig kalendersemester.')
    const periodKey = `${calendar.year}:${calendar.semester}`
    if (seenPeriods.has(periodKey)) fail('source-changed', 'AHO-planen inneholder flere blokker for samme kalendersemester.')
    seenPeriods.add(periodKey)
    const courses = [], identities = new Map(), requirements = []
    $(term).children('.combination').each((_, block) => {
      const group = clean($(block).find('h4').first().text()), explanation = clean($(block).children('p').first().text())
      if (group && (/valg|fordyp|fagretning|studio/i.test(`${group} ${explanation}`))) requirements.push(`${group}${explanation ? `: ${explanation}` : ''}`)
      $(block).find('li').each((_, row) => {
        const link = $(row).find('a.course-link').first()
        if (!link.length) return
        let courseUrl
        try { courseUrl = ahoProgramUrl(new URL(link.attr('href'), url)).href } catch { fail('source-changed', 'En emnelenke i AHO-planen peker utenfor den publiserte kilden.') }
        if (!coursePaths.some(pattern => pattern.test(new URL(courseUrl).pathname))) fail('source-changed', 'En AHO-emnelenke har ukjent format.')
        const courseCode = clean(link.find('.course-code').text()), name = clean(link.find('.course-name').text()), credits = asCredits(link.find('.course-study-points span').first().text())
        if (!courseCode || !name || credits == null) fail('source-changed', 'En AHO-emnerad mangler kode, navn eller studiepoeng.')
        const optional = !$(row).hasClass('mandatory') || /valg|valgb|fordyp|fagretning|studio/i.test(`${courseCode} ${name} ${group} ${explanation}`)
        const course = { id: `aho:${selectedCode}:${periodKey}:${new URL(courseUrl).pathname}`, code: courseCode, name, credits, choice: optional ? 'V' : 'O', sourceProvider: 'aho-program', sourceRecordId: new URL(courseUrl).pathname, sourceVersion: `${title[2]}-${title[3]}`, sourceUrl: courseUrl, university, year: calendar.year, semester: calendar.semester, campus, description: '', notes: `${group || 'Publisert emnegruppe'} i AHOs planutgave ${title[2]}–${title[3]}.` }
        const previous = identities.get(courseUrl)
        if (previous && JSON.stringify(previous) !== JSON.stringify(course)) fail('source-changed', 'AHO-planen publiserer motstridende opplysninger for samme emne i ett semester.')
        if (!previous) { identities.set(courseUrl, course); courses.push(course) }
      })
    })
    periods.push({ id: `semester-${index + 1}`, studySemester: index + 1, year: calendar.year, semester: calendar.semester, label: `${index + 1}. studiesemester · ${calendar.semester === 'spring' ? 'Vår' : 'Høst'} ${calendar.year}`, courses, requirements })
  })
  if (!periods.length || !periods.some(period => period.courses.length)) fail('not-supported', 'AHO-planen har ingen lesbare, periodeplasserte emner.')
  const returned = periods.reduce((sum, period) => sum + period.courses.length, 0)
  return { status: 'ok', program: { code, name: title[1], cohort: String(selectedCohort), sourceEdition: `${title[2]}–${title[3]}`, sourceUrl: url.href, campuses: campus ? [campus] : [] }, models: [{ id: 'published-study-model', name: 'Publisert studiemodell', periods, unplacedCourses: [] }], warnings: ['Planutgaven er knyttet til opptaksåret som AHO publiserer. Studiesemester og kalendersemester beholdes separat.', 'Emner i valgbare studio-, fordypnings- og valgemnegrupper er ikke forhåndsvalgt. Studenten må velge de faktisk relevante emnene.', 'Planen inneholder ikke personlig gruppe eller undervisningskalender.'], completeness: { complete: true, pages: 1, returned, scope: 'Alle lesbare emner og perioder i den valgte publiserte AHO-planutgaven.' } }
}

export async function ahoPrograms(institution, action, query, { fetchText }) {
  if (institution !== 'aho') fail('invalid-selection', 'Velg Arkitektur- og designhøgskolen i Oslo.')
  if (action === 'programs') {
    const results = parseAhoCatalogue(await cachedText(fetchText, catalogueUrl, ahoProgramUrl))
    const q = clean(query.q).toLocaleLowerCase('nb'), visible = results.filter(row => `${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(q))
    return { status: 'ok', results: visible, warnings: ['Programlisten er lest fra AHOs offentlige programoversikt. En oppføring får bare planimport når programsiden lenker en lesbar studieplan.'], completeness: { complete: true, pages: 1, returned: results.length, scope: 'Alle unike gradsprogramlenker i AHOs publiserte programoversikt.' } }
  }
  if (action === 'program-cohorts') {
    const programmeUrl = ahoProgramUrl(query.sourceUrl), code = programmeIdentity(programmeUrl)
    if (code !== query.program) fail('invalid-selection', 'Velg AHO-programmet fra den oppdaterte programlisten.')
    const page = parseAhoProgrammePage(await cachedText(fetchText, programmeUrl.href, ahoProgramUrl), programmeUrl.href)
    let results = [page.current], warnings = []
    if (page.archiveUrl) {
      try {
        const archived = parseAhoPlanArchive(await cachedText(fetchText, page.archiveUrl, ahoProgramUrl), page.archiveUrl, page.current.sourceUrl)
        results = [...new Map([page.current, ...archived].map(row => [row.sourceUrl, row])).values()]
      } catch (error) {
        if (error.name === 'AbortError') throw error
        warnings.push(`Arkivet med eldre planutgaver kunne ikke leses: ${error.message}`)
      }
    }
    return { status: 'ok', results, warnings: ['Planutgave er opptaksår, mens semesteret studenten arbeider i velges etter at planen er hentet.', ...warnings] }
  }
  if (action !== 'program-plan') fail('not-supported', 'Denne AHO-handlingen støttes ikke.')
  const planUrl = ahoProgramUrl(query.sourceUrl), programmeUrl = programmeUrlFromPlan(planUrl)
  if (programmeIdentity(programmeUrl) !== query.program || !/^\d{4}$/.test(String(query.cohort)) || !planUrl.pathname.endsWith(`/${query.cohort}.html`)) fail('invalid-selection', 'Velg en publisert AHO-planutgave fra listen.')
  const page = parseAhoProgrammePage(await cachedText(fetchText, programmeUrl, ahoProgramUrl), programmeUrl)
  const historical = page.current.sourceUrl !== planUrl.href
  if (historical && query.historicalConfirmed !== 'true') fail('invalid-selection', 'Denne AHO-planen er historisk. Bekreft den historiske planutgaven uttrykkelig.')
  return parseAhoPlan(await cachedText(fetchText, planUrl.href, ahoProgramUrl), planUrl.href, query.program, query.cohort)
}
