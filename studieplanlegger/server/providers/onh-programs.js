import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'
import { sourceEdition, studentCohort, unknownPeriod } from './current-program-source.js'
import {onhPdfEditions,onhPdfPlan,onhPdfUrl} from './onh-pdf.js'

const origin = 'https://oslonyehoyskole.no', catalogueUrl = `${origin}/api/studium/json`
export function onhProgramUrl(input) {
  const url = new URL(input.href || input)
  if (url.origin === 'https://www.oslonyehoyskole.no') url.hostname = 'oslonyehoyskole.no'
  return restrictedUrl(url, { origin, paths: [/^\/api\/studium\/json$/, /^\/studier\/[\w%/-]+\/?$/i, /^\/Emner\/[\w%/-]+\/?$/i] })
}
export function parseOnhCatalogue(text) {
  let rows; try { rows = JSON.parse(text) } catch { fail('source-changed', 'Den publiserte ONH-katalogen svarte ikke med JSON.') }
  if (!Array.isArray(rows) || rows.length > 5000) fail('source-changed', 'Den publiserte ONH-katalogen har endret format.')
  const results = new Map()
  for (const row of rows) {
    // These fields are the same published distinction used by the catalogue UI.
    // Preparatory, foreign and vocational studies are outside this import scope.
    if (row.field_onf_page !== 'Av' || !/^(Bachelor|Master|Årsstudium|Halvårsstudium|Videreutdanning|Emnepakke)$/.test(row.field_level)) continue
    let url; try { url = onhProgramUrl(new URL(row.view_node, origin)); if (!url.pathname.startsWith('/studier/')) continue } catch { continue }
    const name = clean(row.title); if (!name) continue
    const suffix = sourceEdition(url.pathname).slice(5), officialCode = clean(row.field_qybele_id)
    results.set(url.href, { code: `${officialCode || 'side'}-${suffix}`, officialCode, name, sourceUrl: url.href, campuses: clean(row.field_studiested) ? [clean(row.field_studiested)] : [] })
  }
  if (!results.size) fail('source-changed', 'Ingen høyere studietilbud kunne leses fra ONHs publiserte katalog.')
  return { results: [...results.values()], total: rows.length }
}
export function parseOnhPlan(html, selected, cohort) {
  const $ = load(html), title = clean($('h1').first().text()), edition = sourceEdition(html), periods = [], unplacedCourses = [], warnings = []
  if (title.toLocaleLowerCase('nb') !== selected.name.toLocaleLowerCase('nb')) fail('source-changed', 'Programsiden bekrefter ikke navnet på det valgte tilbudet. Velg fra den oppdaterte katalogen.')
  const readCourse = (link, number, choice = '') => {
    const label = clean($(link).text()), match = label.match(/^(.+?)\s*[-–]\s*([A-ZÆØÅ]{2,}\d+[A-Z]?)\s*\((\d+(?:[.,]\d+)?)\s*sp\)$/i)
    if (!match) { warnings.push(`Kildens emnerad må avklares: ${label}`); return null }
    let url; try { url = onhProgramUrl(new URL($(link).attr('href'), selected.sourceUrl)); if (!/^\/Emner\//i.test(url.pathname)) return null } catch { return null }
    const code = match[2].toUpperCase()
    return { id: `onh:${selected.code}:${number || 'unplaced'}:${code}`, code, name: clean(match[1]), credits: Number(match[3].replace(',', '.')), choice, sourceProvider: 'onh', sourceRecordId: url.pathname, sourceVersion: 'published-current', sourceUrl: url.href, university: 'Oslo Nye Høyskole', year: null, semester: null, campus: selected.campuses[0] || '', description: '', notes: `Publisert programrad: ${label}. Gjeldende nettside bekrefter ikke opptakskull eller kalendersemester.` }
  }
  $('.paragraph--type--emne-list').each((_, block) => {
    const header = clean($(block).find('.emnertitle').first().text()), match = header.match(/^(\d{1,2})\.\s*semester\b/i)
    if (!match || +match[1] < 1 || +match[1] > 40) return
    if (periods.some(period => period.studySemester === +match[1])) fail('source-changed', 'Programmet viser flere modeller med samme semesternummer. Ingen modell er valgt automatisk.')
    const period = unknownPeriod(+match[1]), choice = /valgfr|valgemne/i.test(header) ? 'V' : ''
    $(block).find('.emner-list a.emner').each((_, link) => { const course = readCourse(link, period.studySemester, choice); if (course) period.courses.push(course) })
    if (/valg|internship|utveksling/i.test(header)) period.requirements.push(header)
    periods.push(period)
  })
  const yearLinks = new Set()
  $('.accordion').each((_, block) => {
    const header = clean($(block).find('h2,h3,h4').first().text()), match = header.match(/^Emner\s+(\d{1,2})\.\s*året$/i)
    if (!match || $(block).find('.paragraph--type--emne-list').length || +match[1] > 20) return
    const year = +match[1], period = { id: `year-${year}`, studySemester: null, requiresStudentStudySemester: true, allowedStudySemesters: [year * 2 - 1, year * 2], year: null, semester: null, label: `${year}. studieår · velg faktisk studiesemester`, courses: [], requirements: ['Kilden plasserer emnene i et studieår. Velg uttrykkelig hvilke emner som gjelder ditt aktuelle studiesemester.'] }
    $(block).find('a.emner').each((_, link) => { const course = readCourse(link, period.id); if (course) { yearLinks.add(link); period.courses.push({ ...course, requiresSemesterChoice: true }) } })
    if (period.courses.length) periods.push(period)
  })
  $('a.emner').filter((_, link) => !$(link).closest('.paragraph--type--emne-list').length && !yearLinks.has(link)).each((_, link) => {
    const course = readCourse(link, null)
    if (course) unplacedCourses.push({ ...course, requiresSemesterChoice: true, notes: `${course.notes} Emnet står utenfor semesterblokkene. Kontroller valgområde og velg semester uttrykkelig.` })
  })
  if (!periods.some(period => period.courses.length)) fail('not-supported', 'Dette ONH-tilbudet har ingen lesbar emneoversikt med studiesemestre i den publiserte HTML-kontrakten. Den lenkede studieplanen kan brukes i dokumentimport.')
  return { status: 'ok', program: { ...selected, cohort, cohortFromStudent: true, sourceEdition: edition }, models: [{ id: 'published-semesters', name: 'Publisert semesteroversikt', periods, unplacedCourses }], warnings: [...warnings, 'Katalogen skiller undervisningssted med egne publiserte programsider. Velg siden som gjelder ditt studieløp.', 'Den gjeldende nettsiden er ikke en historisk kullplan. Du oppgir eget kull og kalendersemester og kontrollerer at planen gjelder deg. Obligatorisk status er ukjent der den ikke er uttrykkelig merket.', 'Emner uten semesterplassering vises for uttrykkelig valg. Åpne valgområder og utveksling er krav, ikke oppdiktede emner. Ingen undervisningshendelser er importert.'], completeness: { complete: !warnings.length, pages: 1, returned: periods.reduce((n, p) => n + p.courses.length, 0) + unplacedCourses.length, scope: 'Den valgte publiserte HTML-oversikten; daterte PDF-planer og historiske kullutgaver inngår ikke.' } }
}
export async function onhPrograms(institution, action, query, { fetchText, fetchBytes }) {
  const catalogue = parseOnhCatalogue(await cachedText(fetchText, catalogueUrl, onhProgramUrl))
  if (action === 'programs') {
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', results: catalogue.results.filter(row => `${row.name} ${row.officialCode} ${row.campuses.join(' ')}`.toLocaleLowerCase('nb').includes(q)), warnings: ['Katalogen er hentet fra ONHs publiserte studiesøk. Fagskole, forberedende og utenlandske tilbud er utelatt. Egne kildesider for ulike undervisningssteder beholdes.'], completeness: { complete: true, pages: 1, total: catalogue.total, returned: catalogue.results.length, scope: 'Alle eksplisitt merkede høyere tilbud fra den publiserte katalogresponsen.' } }
  }
  const pdf=String(query.sourceUrl||'').startsWith('https://s3.eu-west-1.amazonaws.com/bhi.no/')
  if(pdf)onhPdfUrl(query.sourceUrl)
  const selected = catalogue.results.find(row => row.code === query.program && (pdf||row.sourceUrl === onhProgramUrl(query.sourceUrl).href))
  if (!selected) fail('invalid-selection', 'Velg et tilbud og undervisningssted fra ONHs publiserte katalog.')
  if (action === 'program-cohorts') {let editions=[],warnings=[];try{editions=await onhPdfEditions(fetchText,selected)}catch(error){if(error.name==='AbortError')throw error;warnings.push(`Det separate PDF-arkivet kunne ikke leses: ${error.message}`)}return { status: 'ok', results: [{ cohort: 'current', label: 'Gjeldende nettside · oppgi eget opptakskull', requiresStudentCohort: true, sourceUrl: selected.sourceUrl },...editions], warnings: ['HTML-oversikten har ingen publisert kullvelger. PDF-arkivet tilbyr daterte studieårsutgaver, ikke automatisk studentkull. Velg utgaven og oppgi eget kull.',...warnings] }}
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke av ONHs programkilde.')
  if(pdf)return onhPdfPlan(selected,query,{fetchText,fetchBytes})
  return parseOnhPlan(await cachedText(fetchText, selected.sourceUrl, onhProgramUrl), selected, studentCohort(query))
}
