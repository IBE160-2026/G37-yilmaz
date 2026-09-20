import { load, clean, fail, cachedText, restrictedUrl, collectPages } from './program-source.js'
import { studentCohort, sourceEdition, unknownPeriod, coursesFromLinks, textWithSpaces } from './current-program-source.js'
import { matrix } from './nla-programs.js'

const origin = 'https://fih.fjellhaug.no', catalogue = `${origin}/studier`
export const fihProgramUrl = input => restrictedUrl(input, { origin, paths: [/^\/studier(?:\/[^/]+)?\/?$/, /^\/emne\/[^/]+\/?$/], keys: ['page'] })
function programRef(input) {
  const url = fihProgramUrl(input), match = url.pathname.match(/^\/studier\/([^/]+)\/?$/)
  if (!match || url.search) fail('invalid-selection', 'Velg en publisert Fjellhaug-programside fra katalogen.')
  return { url, code: decodeURIComponent(match[1]) }
}
const courseUrl = input => { const url = fihProgramUrl(input); if (!/^\/emne\/[^/]+\/?$/.test(url.pathname) || url.search) fail('source-changed', 'Emnelenken er ikke en offentlig Fjellhaug-emneside.'); return url }
function semesterHeader(text, annual) {
  const match = clean(text).match(/^(?:(\d{1,2})\.\s*studieår\s+)?(høst(?:en)?|vår(?:en)?)$/i)
  if (!match || !match[1] && !annual) return null
  const studyYear = +(match[1] || 1), semester = /^vår/i.test(match[2]) ? 'spring' : 'autumn'
  if (!studyYear || studyYear > 20) fail('source-changed', 'Studieåret overskrider importgrensen.')
  return { number: studyYear * 2 - (semester === 'autumn' ? 1 : 0), semester }
}
function joinedCell($, cell) {
  const copy = $(cell).clone(), groups = new Map()
  copy.find('br').replaceWith(' ')
  copy.find('a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href'), text = clean($(anchor).text())
    if (!text) { $(anchor).remove(); return }
    const existing = groups.get(href)
    if (existing) { $(existing).text(`${clean($(existing).text())} ${text}`); $(anchor).remove() }
    else groups.set(href, anchor)
  })
  return copy
}
export function parseFihPlan(html, query) {
  const source = programRef(query.sourceUrl), cohort = studentCohort(query), $ = load(html), name = clean($('main h1, main h2').first().text()), edition = sourceEdition(html), models = [], warnings = []
  if (query.program !== source.code || !name) fail('invalid-selection', 'Programvalget stemmer ikke med Fjellhaug-siden.')
  const annual = /Årsstudium|One-Year/i.test(name), campuses = []
  $('main b').filter((_, item) => clean($(item).text()) === 'Campus').each((_, item) => { const value = clean($(item).parent().clone().find('b').remove().end().text()); if (value) campuses.push(value) })
  $('main table').each((_, table) => {
    const rows = matrix($, table)
    if (!rows.some(row => row[0] && semesterHeader(textWithSpaces($, row[0]), annual))) return
    const modelId = `table-${models.length + 1}`, modelName = clean($(table).closest('figure').prev('p').text()) || clean($(table).prev('p').text()) || `Publisert studieløp ${models.length + 1}`, periods = []
    for (const row of rows) {
      const header = row[0] && semesterHeader(textWithSpaces($, row[0]), annual)
      if (!header) continue
      const period = { ...unknownPeriod(header.number), semester: header.semester, label: `${header.number}. studiesemester · ${header.semester === 'spring' ? 'Vår' : 'Høst'} · avklar kalenderår` }
      for (const cell of [...new Set(row.slice(1))].filter(Boolean)) {
        const copy = joinedCell($, cell), labels = new Map(copy.find('a[href]').map((_, anchor) => { try { return [[courseUrl(new URL($(anchor).attr('href'), source.url)).href, clean($(anchor).text())]] } catch { return null } }).get().filter(Boolean))
        const parsed = coursesFromLinks($, copy, { sourceUrl: source.url.href, courseUrl, institution: 'fih', university: 'Fjellhaug Internasjonale Høgskole', scope: `${source.code}:${cohort}:${modelId}`, number: header.number })
        const unlinked = !copy.find('a[href]').length && parsed.text.match(/^(.+?)\s*\((\d+(?:[.,]\d+)?)\s*stp\.?\)$/i)
        if (!parsed.courses.length && unlinked && !/valgfri|valgemne|åpent|utveksling|eller/i.test(unlinked[1])) {
          const courseName = clean(unlinked[1]), recordId = `${source.code}:tekst:${sourceEdition(courseName)}`
          parsed.courses.push({ id: `fih:${source.code}:${cohort}:${modelId}:${header.number}:${recordId}`, code: '', name: courseName, credits: Number(unlinked[2].replace(',', '.')), choice: '', sourceProvider: 'fih', sourceRecordId: recordId, sourceVersion: 'current', sourceUrl: source.url.href, university: 'Fjellhaug Internasjonale Høgskole', description: '', notes: `Kildeutdrag: ${parsed.text}. Emnet står uten emnekode eller separat emnelenke i denne tabellen.`, year: null, semester: null, campus: '' })
          warnings.push(`${courseName}: navn og studiepoeng er publisert uten emnekode eller separat emnelenke. Kontroller koblingen før import.`)
        }
        warnings.push(...parsed.warnings)
        for (const course of parsed.courses) {
          const label = labels.get(course.sourceUrl) || course.name
          course.name = clean((course.code ? label.replace(new RegExp(`^${course.code}\\s*`), '') : label).replace(/\(?\d+(?:[.,]\d+)?\s*stp\.?\)?\*?/gi, '')) || course.name
          course.sourceVersion = 'current'
          if (!period.courses.some(item => item.sourceRecordId === course.sourceRecordId)) period.courses.push(course)
        }
        if (parsed.text && (!parsed.courses.length || /valgfri|valgemne|åpent|utveksling|eller|praksis/i.test(parsed.text))) period.requirements.push(parsed.text)
      }
      periods.push(period)
    }
    if (periods.some(period => period.courses.length)) models.push({ id: modelId, name: modelName, periods })
  })
  if (!models.length) fail('not-supported', 'Fjellhaug-siden har ingen støttet tabell med studiesemester og emnelenker. Bruk dokumentimport eller registrer emnene fra den publiserte planen. Ingen semesterplassering er gjettet.')
  warnings.push('Gjeldende HTML-programside bekrefter ikke studentens opptakskull eller kalenderår. Oppgi eget kull og kontroller at anbefalt studieløp gjelder deg.', 'Åpne valg og utveksling beholdes som kravtekst. Bare faktiske emnelenker blir emner. Anbefalte emner er ikke automatisk klassifisert som obligatoriske.', 'Flere publiserte studieløp vises separat; delvise tabeller er ikke slått sammen med en antatt felles plan. Undervisningsdatoer, grupper og personlig timeplan hentes separat.')
  return { status: 'ok', program: { code: source.code, name, cohort, cohortFromStudent: true, sourceEdition: edition, sourceUrl: source.url.href, campuses }, models, warnings: [...new Set(warnings)], completeness: { complete: true, pages: 1, returned: models.reduce((count, model) => count + model.periods.reduce((n, period) => n + period.courses.length, 0), 0), scope: 'Lenkede emner og åpne valg i gjenkjennelige studieløpstabeller på gjeldende programside.' } }
}
export async function fihPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const data = await collectPages(catalogue, fetchText, fihProgramUrl, ($, current) => {
      const results = $('a.list-group-item-studies[href]').map((_, item) => {
        const source = programRef(new URL($(item).attr('href'), current)), name = clean($(item).find('h4').text()), campus = clean($(item).find('.row').first().children().eq(2).text())
        return name ? { code: source.code, name, sourceUrl: source.url.href, campuses: campus ? [campus] : [] } : null
      }).get().filter(Boolean)
      if (!results.length) fail('source-changed', 'Fjellhaugs programkatalog har endret format.')
      return { results }
    })
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', results: data.results.filter(item => !q || `${item.name} ${item.code} ${item.campuses.join(' ')}`.toLocaleLowerCase('nb').includes(q)), warnings: [...data.warnings, 'Katalogen inkluderer lærestedets publiserte studier og avdelinger. En kataloglenke bekrefter ikke en importbar semesterplan eller undervisningskalender.'], completeness: { ...data.completeness, scope: 'Alle programkort på den offentlige studietilbudssiden og eventuell publisert paginering.' } }
  }
  const source = programRef(query.sourceUrl), html = await cachedText(fetchText, source.url.href, fihProgramUrl)
  if (source.code !== query.program) fail('invalid-selection', 'Programlenken stemmer ikke med valgt program.')
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'current', label: 'Gjeldende programside · oppgi eget opptakskull', sourceUrl: source.url.href, requiresStudentCohort: true }], warnings: ['Kull er ikke dokumentert i denne HTML-programsiden. Eldre publiserte semesterutgaver finnes i Fjellhaugs studieplanarkiv og kan kontrolleres med dokumentimport.'], completeness: { complete: false, pages: 1, returned: 1, scope: 'Gjeldende programside; ikke et dokumentert kullarkiv.' } }
  if (action === 'program-plan') return parseFihPlan(html, query)
  fail('not-supported', 'Handlingen støttes ikke av Fjellhaug-programkilden.')
}
