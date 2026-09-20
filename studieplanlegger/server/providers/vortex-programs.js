import { load, clean, fail, cachedText, restrictedUrl, asCredits } from './program-source.js'
import { studentCohort, sourceEdition } from './current-program-source.js'
import { vortexProgramConfig } from './vortex-program-config.js'

const genericLabels = /^(?:les mer|se studiet|se studieprogram|studieprogram|mer informasjon)$/i
const yearFrom = value => clean(value).match(/\b(20\d{2})\b/)?.[1] || null
const normalizeHeader = value => clean(value).replace(/\u00ad/g, '').toLocaleLowerCase('nb').replace(/[.:]/g, '')
const validCohort = value => /^\d{4}$/.test(String(value)) && +value >= 1900 && +value <= 2200

function configFor(institution) {
  const config = vortexProgramConfig(institution)
  if (!config) fail('invalid-selection', 'Ukjent Vortex-lærested.')
  return config
}
function sourceGuard(config, input) {
  return restrictedUrl(input, {
    origin: config.origin,
    paths: [/^\/studier\/programmer\/?$/i, config.programmePath, config.planPath, ...(config.archivePath ? [config.archivePath] : [])]
  })
}
export function canonicalVortexProgramUrl(institution, input) {
  const config = configFor(institution), url = sourceGuard(config, input), match = url.pathname.match(config.programmePath)
  if (!match) fail('invalid-selection', 'Velg et publisert program fra institusjonens katalog.')
  url.pathname = `/studier/programmer/${match[1]}/`
  return url
}
function programmeRef(institution, input) {
  const url = canonicalVortexProgramUrl(institution, input), config = configFor(institution)
  return { url, code: decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1)), config }
}
function planRef(institution, input, programme) {
  const config = configFor(institution), url = sourceGuard(config, input), match = url.pathname.match(config.planPath)
  if (match) {
    if (decodeURIComponent(match[1]) !== programme.code) fail('invalid-selection', 'Planlenken tilhører et annet program.')
    return { url, kind: 'version', edition: decodeURIComponent(match[2]), historical: false }
  }
  if (config.archivePath?.test(url.pathname)) return { url, kind: 'archive', edition: decodeURIComponent(url.pathname.split('/').at(-1)), historical: true }
  const current = canonicalVortexProgramUrl(institution, url)
  if (current.href !== programme.url.href) fail('invalid-selection', 'Programkilden stemmer ikke med valgt program.')
  return { url: current, kind: 'current', edition: 'current-public', historical: false }
}
function bestName($, anchor) {
  const item = $(anchor), heading = clean(item.find('h1,h2,h3,h4').first().text()) || clean(item.closest('article,li,.vrtx-list-item,.study-program').find('h1,h2,h3,h4').first().text())
  const label = heading || clean(item.attr('aria-label')) || clean(item.attr('title')) || clean(item.text())
  return genericLabels.test(label) ? '' : label
}
export function parseVortexCatalogue(institution, html, current) {
  const config = configFor(institution), $ = load(html), records = new Map(), base = new URL(current || config.catalogueUrl)
  $('main a[href], #vrtx-main-content a[href]').each((_, anchor) => {
    let ref
    try { ref = programmeRef(institution, new URL($(anchor).attr('href'), base)) } catch { return }
    const name = bestName($, anchor)
    if (!name) return
    const previous = records.get(ref.url.href)
    if (!previous || name.length > previous.name.length) records.set(ref.url.href, { code: ref.code, name, sourceUrl: ref.url.href, campuses: [] })
  })
  if (!records.size) fail('source-changed', 'Den offentlige programkatalogen har ingen gjenkjennelige programlenker.')
  return { results: [...records.values()], completeness: { complete: true, pages: 1, returned: records.size, scope: 'Alle unike programlenker i den publiserte katalogsiden; historiske program som ikke er lenket inngår ikke.' } }
}
function cohortChoice(ref, label) {
  const pathYear = yearFrom(ref.edition), labelYear = yearFrom(label), conflict = pathYear && labelYear && pathYear !== labelYear
  const cohort = !conflict && (pathYear || labelYear)
  return { cohort: cohort || 'student', label: label || (ref.historical ? 'Historisk publisert plan' : 'Publisert studieplan'), sourceUrl: ref.url.href,
    ...(cohort ? {} : { requiresStudentCohort: true, sourceEdition: ref.edition }), ...(ref.historical ? { historical: true, requiresHistoricalConfirmation: true } : {}) }
}
export function parseVortexCohorts(institution, html, programUrl) {
  const programme = programmeRef(institution, programUrl), $ = load(html), choices = new Map(), warnings = []
  $('main a[href], #vrtx-main-content a[href]').each((_, anchor) => {
    let ref
    try { ref = planRef(institution, new URL($(anchor).attr('href'), programme.url), programme) } catch { return }
    if (ref.kind === 'current') return
    const label = clean($(anchor).text())
    if (ref.historical && !new RegExp(programme.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(`${ref.url.pathname} ${label}`)) return
    if (!choices.has(ref.url.href)) choices.set(ref.url.href, cohortChoice(ref, label))
  })
  if (!choices.size) {
    choices.set(programme.url.href, { cohort: 'student', label: 'Gjeldende programside · oppgi ditt opptakskull', sourceUrl: programme.url.href, requiresStudentCohort: true, sourceEdition: 'current-public' })
    warnings.push('Programsiden publiserer ingen lenket kullversjon. Studenten må oppgi opptakskull og kontrollere at den gjeldende planen gjelder.')
  }
  if ([...choices.values()].some(choice => choice.historical)) warnings.push('Historiske NIH-planer importeres bare etter at studenten uttrykkelig har valgt og bekreftet den historiske utgaven.')
  return { results: [...choices.values()].sort((a, b) => String(b.cohort).localeCompare(String(a.cohort))), warnings,
    completeness: { complete: !warnings.length, pages: 1, returned: choices.size, ...(warnings.length ? { reason: 'Kilden publiserer ikke et fullstendig bekreftet kullarkiv for valgt program.' } : { scope: 'Kull og historiske utgaver som er konkret lenket fra valgt programside.' }) } }
}
function explicitPeriod($, table, index) {
  const own = clean($(table).attr('data-study-semester')), heading = clean($(table).prevAll('h2,h3,h4,h5').first().text()), caption = clean($(table).find('caption').first().text())
  const label = own || caption || heading, number = Number(label.match(/\b(\d{1,2})\.?\s*semester\b/i)?.[1])
  const term = label.match(/\b(høst|vår)\s+(20\d{2})\b/i)
  return { number: Number.isInteger(number) && number > 0 ? number : null, label: label || `Tabell ${index + 1}`,
    year: term ? +term[2] : null, semester: term ? (/^v/i.test(term[1]) ? 'spring' : 'autumn') : null }
}
function courseUrl(config, input) {
  try { return restrictedUrl(input, { origin: config.origin, paths: config.coursePaths }) } catch { return null }
}
function sourceTerm(value) {
  const match = clean(value).match(/\b(høst|vår)\s+(20\d{2})\b/i)
  return match ? { year: +match[2], semester: /^v/i.test(match[1]) ? 'spring' : 'autumn' } : null
}
function sourceSemesterNumber(value) {
  const number = Number(clean(value).match(/\b(\d{1,2})\.?\s*semester\b/i)?.[1])
  return Number.isInteger(number) && number > 0 ? number : null
}
function periodRecordId(institution, sourceRecordId, edition, periodKey) {
  return `vortex:${institution}:${sourceRecordId}:${edition}:${periodKey}`
}
function samePublishedCourse(left, right) {
  return clean(left.name) === clean(right.name) && left.credits === right.credits && left.choice === right.choice
}
function periodMapping() {
  return { semesterByTerm: new Map(), termBySemester: new Map() }
}
function registerPeriodMapping(mapping, studySemester, term) {
  if (!studySemester || !term?.year || !term?.semester) return
  const termKey = `${term.year}:${term.semester}`, previousSemester = mapping.semesterByTerm.get(termKey), previousTerm = mapping.termBySemester.get(studySemester)
  if (previousSemester && previousSemester !== studySemester) fail('source-changed', `${term.semester === 'spring' ? 'Vår' : 'Høst'} ${term.year} er koblet til flere studiesemestre i samme publiserte modell.`)
  if (previousTerm && previousTerm !== termKey) fail('source-changed', `${studySemester}. studiesemester er koblet til flere kalenderterminer i samme publiserte modell.`)
  mapping.semesterByTerm.set(termKey, studySemester)
  mapping.termBySemester.set(studySemester, termKey)
}
function vortexCourseLists(institution, $, selected, programme) {
  const models = [], warnings = []; let omitted = 0
  const modelRoots = $('.vrtx-fs-study-model')
  modelRoots.each((modelIndex, modelRoot) => {
    const root = $(modelRoot), grouped = new Map(), unplacedCourses = [], seen = new Map(), mapping = periodMapping()
    root.find('ul.course-list').each((listIndex, list) => {
      const sectionHeading = clean($(list).prevAll('h2,h3,h4,h5').first().text())
      const headingCandidates = [sectionHeading, clean($(list).parent().prevAll('h2,h3,h4,h5').first().text()), clean(root.find('h2,h3,h4,h5').first().text())]
      const heading = headingCandidates.find(value => sourceTerm(value)) || sectionHeading, term = sourceTerm(heading)
      const explicitStudySemester = headingCandidates.map(sourceSemesterNumber).find(Boolean) || null
      registerPeriodMapping(mapping, explicitStudySemester, term)
      const periodKey = term ? `${term.year}:${term.semester}` : `unplaced:${listIndex + 1}`
      if (term && !grouped.has(periodKey)) grouped.set(periodKey, { term, explicitStudySemester, heading, courses: [] })
      else if (term) {
        const existingSemester = grouped.get(periodKey).explicitStudySemester
        if (existingSemester && explicitStudySemester && existingSemester !== explicitStudySemester) fail('source-changed', `${term.semester === 'spring' ? 'Vår' : 'Høst'} ${term.year} er koblet til flere studiesemestre i samme publiserte modell.`)
        if (!existingSemester && explicitStudySemester) grouped.get(periodKey).explicitStudySemester = explicitStudySemester
      }
      const periodGroup = term ? grouped.get(periodKey) : null
      $(list).children('li').each((_, item) => {
        const row = $(item), link = row.find('a.course-link[href]').first(), code = clean(row.find('.course-code').first().text()).toUpperCase(), name = clean(row.find('.course-name').first().text())
        const url = link.length ? courseUrl(programme.config, new URL(link.attr('href'), selected.url)) : null
        if (!url || !code || !name) { omitted++; return }
        const className = clean(row.attr('class')), choice = /\bmandatory\b/i.test(className) || /obligatorisk/i.test(sectionHeading) ? 'O' : /\b(?:optional|elective)\b/i.test(className) || /valgemne|valgfri/i.test(sectionHeading) ? 'V' : ''
        const credits = asCredits(clean(row.find('.course-study-points').first().text()).match(/\d+(?:[.,]\d+)?/)?.[0])
        const sourceRecordId = `${programme.code}:${code}`, record = { id: periodRecordId(institution, sourceRecordId, selected.edition, periodKey), code, name, credits, choice,
          sourceProvider: institution, sourceRecordId, sourceVersion: selected.edition, sourceUrl: url.href, university: programme.config.university, description: '',
          notes: `Kildeutdrag: ${heading || 'periode ikke oppgitt'}; ${code} ${name}; ${credits ?? 'ukjent'} studiepoeng; ${choice || 'emnetype ikke oppgitt'}.`,
          year: term?.year || null, semester: term?.semester || null, campus: '', ...(!term ? { requiresSemesterChoice: true } : {}) }
        const key = `${periodKey}:${code}`, previous = seen.get(key)
        if (previous) {
          if (!samePublishedCourse(previous, record)) fail('source-changed', `${code} har motstridende navn, studiepoeng eller emnetype i samme publiserte periode.`)
          return
        }
        seen.set(key, record)
        if (!choice) warnings.push(`${code}: planen markerer ikke emnet entydig som obligatorisk eller valgfritt; typen må kontrolleres.`)
        if (periodGroup) periodGroup.courses.push(record); else unplacedCourses.push(record)
      })
    })
    const periods = [...grouped.values()].map(group => {
      const studySemester = group.explicitStudySemester, termId = `${group.term.year}:${group.term.semester}`
      return { id: studySemester ? String(studySemester) : termId, studySemester, ...group.term,
        label: `${studySemester ? `${studySemester}. studiesemester · ` : 'Avklar studiesemester · '}${group.term.semester === 'spring' ? 'Vår' : 'Høst'} ${group.term.year}`,
        courses: group.courses, requirements: [], ...(!studySemester ? { requiresStudentStudySemester: true } : {}) }
    }).filter(period => period.courses.length)
    if (!periods.length && unplacedCourses.length) periods.push({ id: 'student-placement', studySemester: null, year: null, semester: null, label: 'Avklar studiesemester og kalendersemester', courses: unplacedCourses, requirements: [], requiresStudentStudySemester: true })
    const modelHeading = root.children('h2,h3,h4,h5').map((_, heading) => clean($(heading).text())).get()
      .find(value => value && !sourceTerm(value) && !/^(?:obligatoriske emner|valgemner|valgfrie emner)$/i.test(value))
    if (periods.length || unplacedCourses.length) models.push({ id: modelIndex ? `${selected.edition}:model-${modelIndex + 1}` : selected.edition,
      name: modelHeading || (modelRoots.length > 1 ? `Publisert studiemodell ${modelIndex + 1}` : 'Publisert studieplan'), periods,
      ...(periods[0]?.id !== 'student-placement' && unplacedCourses.length ? { unplacedCourses } : {}) })
  })
  if (models.some(model => model.unplacedCourses?.length || model.periods.some(period => period.id === 'student-placement'))) warnings.push('En emneliste mangler uttrykkelig kalenderperiode og må plasseres av studenten.')
  if (omitted) warnings.push(`${omitted} kildeoppføring${omitted === 1 ? '' : 'er'} manglet gyldig emnelenke, kode eller navn og er ikke gjort om til emner.`)
  return { models, warnings: [...new Set(warnings)], omitted }
}
export function parseVortexPlan(institution, html, query, program) {
  const programme = programmeRef(institution, program.sourceUrl), selected = planRef(institution, query.sourceUrl, programme), $ = load(html)
  const name = clean($('main h1, #vrtx-main-content h1').first().text()) || program.name
  const actual = vortexCourseLists(institution, $, selected, programme), periods = [], unplacedCourses = [], warnings = [...actual.warnings], seen = new Map(), mapping = periodMapping(), hasActualLists = $('.vrtx-fs-study-model ul.course-list').length > 0
  if (!hasActualLists) $('main table, #vrtx-main-content table').each((tableIndex, table) => {
    const headers = $(table).find('tr').first().find('th,td').map((_, cell) => normalizeHeader($(cell).text())).get()
    const find = pattern => headers.findIndex(header => pattern.test(header))
    const codeColumn = find(/^(?:emnekode|kode|course code)$/), nameColumn = find(/^(?:emne|emnenavn|navn|course)$/), creditsColumn = find(/(?:studiepoeng|stp|ects)/), choiceColumn = find(/^(?:o\/v|obligatorisk\/valgfritt|status)$/), semesterColumn = find(/^studiesemester$|^semester$/)
    if (codeColumn < 0 && nameColumn < 0) return
    const placement = explicitPeriod($, table, tableIndex), placementTerm = placement.year && placement.semester ? { year: placement.year, semester: placement.semester } : null,
      period = placement.number ? { id: String(placement.number), studySemester: placement.number, year: placement.year, semester: placement.semester,
      label: `${placement.number}. studiesemester · ${placement.year ? `${placement.semester === 'spring' ? 'Vår' : 'Høst'} ${placement.year}` : 'avklar kalendersemester'}`, courses: [], requirements: [] } : null
    registerPeriodMapping(mapping, placement.number, placementTerm)
    $(table).find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('th,td'), semesterText = semesterColumn >= 0 ? clean(cells.eq(semesterColumn).text()) : '', parsedRowSemester = Number(semesterText.match(/\b(\d{1,2})\b/)?.[1]), rowSemester = Number.isInteger(parsedRowSemester) && parsedRowSemester > 0 ? parsedRowSemester : null
      if (placement.number && rowSemester && placement.number !== rowSemester) fail('source-changed', `Tabellen kobler samme publiserte periode til både ${placement.number}. og ${rowSemester}. studiesemester.`)
      const studySemester = placement.number || rowSemester
      registerPeriodMapping(mapping, studySemester, placementTerm)
      const code = clean(cells.eq(codeColumn >= 0 ? codeColumn : nameColumn).text()).match(/\b([A-ZÆØÅ]{2,}[A-ZÆØÅ\d_-]*\d[A-ZÆØÅ\d_-]*)\b/i)?.[1]?.toUpperCase() || ''
      const link = cells.find('a[href]').first(), linked = link.length ? courseUrl(programme.config, new URL(link.attr('href'), selected.url)) : null
      const rawName = clean(cells.eq(nameColumn >= 0 ? nameColumn : codeColumn).text()), courseName = clean(rawName.replace(code, '')) || clean(link.text()).replace(code, '').trim()
      if (!code || !courseName) return
      const choiceText = choiceColumn >= 0 ? clean(cells.eq(choiceColumn).text()) : '', choice = /^(?:v|valgfri)/i.test(choiceText) ? 'V' : /^(?:o|obligatorisk)/i.test(choiceText) ? 'O' : ''
      const sourceRecordId = `${programme.code}:${code}`, record = { id: periodRecordId(institution, sourceRecordId, selected.edition, studySemester ? `study-semester:${studySemester}` : `table:${tableIndex + 1}:unplaced`), code, name: courseName,
        credits: creditsColumn >= 0 ? asCredits(clean(cells.eq(creditsColumn).text()).match(/\d+(?:[.,]\d+)?/)?.[0]) : null, choice,
        sourceProvider: institution, sourceRecordId, sourceVersion: selected.edition, sourceUrl: linked?.href || selected.url.href, university: programme.config.university,
        description: '', notes: `Kildeutdrag: ${clean($(row).text())}`, year: placement.year || null, semester: placement.semester || null, campus: '', ...(!studySemester ? { requiresSemesterChoice: true } : {}) }
      const key = `${studySemester || 'unplaced'}:${placement.year || 'unknown'}:${placement.semester || 'unknown'}:${code}`, previous = seen.get(key)
      if (previous) {
        if (!samePublishedCourse(previous, record)) fail('source-changed', `${code} har motstridende navn, studiepoeng eller emnetype i samme publiserte periode.`)
        return
      }
      seen.set(key, record)
      if (studySemester) {
        let target = periods.find(item => item.studySemester === studySemester)
        if (!target) {
          target = period?.studySemester === studySemester ? period : { id: String(studySemester), studySemester, year: placement.year || null, semester: placement.semester || null,
            label: `${studySemester}. studiesemester · ${placement.year ? `${placement.semester === 'spring' ? 'Vår' : 'Høst'} ${placement.year}` : 'avklar kalendersemester'}`, courses: [], requirements: [] }
          periods.push(target)
        }
        target.courses.push(record)
      } else unplacedCourses.push(record)
    })
    if (period && !periods.some(item => item.studySemester === period.studySemester) && period.courses.length) periods.push(period)
  })
  let models = hasActualLists ? actual.models : [{ id: selected.edition, name: selected.historical ? 'Historisk publisert studieplan' : 'Publisert studieplan', periods, ...(unplacedCourses.length ? { unplacedCourses } : {}) }]
  if (!hasActualLists && !periods.length && unplacedCourses.length) models = [{ id: selected.edition, name: selected.historical ? 'Historisk publisert studieplan' : 'Publisert studieplan',
    periods: [{ id: 'student-placement', studySemester: null, year: null, semester: null, label: 'Avklar studiesemester og kalendersemester', courses: unplacedCourses, requirements: [], requiresStudentStudySemester: true }] }]
  const returned = models.reduce((modelSum, model) => modelSum + model.periods.reduce((sum, period) => sum + period.courses.length, 0) + (model.unplacedCourses?.length || 0), 0)
  if (!returned) fail('not-supported', 'Den valgte planen har ingen gjenkjennelig emnetabell. Bruk dokumentimport eller registrer emnene manuelt.')
  if (models.some(model => model.periods.some(period => !period.year))) warnings.push('Studiesemester uten uttrykkelig kalendersemester er beholdt uten beregnet år eller Høst/Vår.')
  if (models.some(model => model.unplacedCourses?.length || model.periods.some(period => period.id === 'student-placement'))) warnings.push('Emner uten uttrykkelig studiesemester må plasseres av studenten før import.')
  if (selected.kind === 'current') warnings.push('Gjeldende programside er ikke en bekreftet kullversjon. Kontroller at oppbyggingen gjelder ditt opptakskull.')
  return { status: 'ok', program: { ...program, name, cohort: String(query.cohort), sourceUrl: selected.url.href,
      ...(selected.kind === 'current' || query.cohortFromStudent === 'true' ? { cohortFromStudent: true, sourceEdition: selected.kind === 'current' ? sourceEdition(html) : selected.edition } : {}) },
    models: models.map(model => ({ ...model, name: selected.historical && !/historisk/i.test(model.name) ? `Historisk · ${model.name}` : model.name })), warnings,
    completeness: { complete: !warnings.length, pages: 1, returned, ...(actual.omitted ? { omitted: actual.omitted } : {}), ...(warnings.length ? { reason: 'Kilden mangler bekreftet periode eller emnetype for ett eller flere emner, eller for valgt kull.' } : { scope: 'Navngitte emner i den valgte publiserte studieplanen.' }) } }
}
export async function vortexPrograms(institution, action, query, { fetchText }) {
  const config = configFor(institution), catalogueGuard = input => { const url = sourceGuard(config, input); if (url.href !== config.catalogueUrl) fail('source-changed', 'Katalogen videresendte til en annen kilde.'); return url }
  const catalogue = parseVortexCatalogue(institution, await cachedText(fetchText, config.catalogueUrl, catalogueGuard), config.catalogueUrl)
  if (action === 'programs') { const q = clean(query.q).toLocaleLowerCase('nb'); return { status: 'ok', ...catalogue, results: catalogue.results.filter(row => !q || `${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(q)) } }
  const program = catalogue.results.find(row => row.code === query.program)
  if (!program) fail('invalid-selection', 'Programmet finnes ikke i den publiserte katalogen.')
  const programme = programmeRef(institution, program.sourceUrl)
  if (action === 'program-cohorts' && canonicalVortexProgramUrl(institution, query.sourceUrl).href !== programme.url.href) fail('invalid-selection', 'Programkilden stemmer ikke med katalogvalget.')
  const exactProgram = input => { const url = canonicalVortexProgramUrl(institution, input); if (url.href !== program.sourceUrl) fail('source-changed', 'Programsiden videresendte til et annet program.'); return sourceGuard(config, input) }
  const programHtml = await cachedText(fetchText, program.sourceUrl, exactProgram), cohorts = parseVortexCohorts(institution, programHtml, program.sourceUrl)
  if (action === 'program-cohorts') return { status: 'ok', ...cohorts }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke.')
  const selected = planRef(institution, query.sourceUrl, programme), choice = cohorts.results.find(item => item.sourceUrl === selected.url.href)
  if (!choice) fail('invalid-selection', 'Velg en plan som er publisert fra det aktuelle programmet.')
  if (choice.requiresStudentCohort) studentCohort(query)
  else if (choice.cohort !== String(query.cohort)) fail('invalid-selection', 'Valgt kull stemmer ikke med den publiserte planlenken.')
  if (choice.requiresHistoricalConfirmation && query.historicalConfirmed !== 'true') fail('invalid-selection', 'Bekreft uttrykkelig at du vil bruke den historiske NIH-planen.')
  const exactPlan = input => { const url = sourceGuard(config, input); if (url.href !== selected.url.href) fail('source-changed', 'Planen videresendte til en annen kilde.'); return url }
  const html = selected.kind === 'current' ? programHtml : await cachedText(fetchText, selected.url.href, exactPlan)
  return parseVortexPlan(institution, html, query, program)
}
