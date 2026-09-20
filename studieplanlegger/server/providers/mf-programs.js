import { load, clean, fail, cachedText, restrictedUrl, collectPages } from './program-source.js'
import { sourceEdition, studentCohort, unknownPeriod, coursesFromLinks } from './current-program-source.js'

const origin = 'https://mf.no', catalogue = `${origin}/studier/programmer`
const programPath = /^\/studier\/(?:programmer\/)?[^/]+\/?$/
export function mfProgramUrl(input) {
  const url = new URL(input.href || input)
  if (url.origin === 'https://www.mf.no') url.hostname = 'mf.no'
  return restrictedUrl(url, { origin, paths: [/^\/studier\/programmer\/?$/, programPath, /^\/studier\/emner\/[^/]+\/?$/], keys: ['open', 'page'] })
}
function programRef(input) {
  const url = mfProgramUrl(input)
  if (!programPath.test(url.pathname) || /^\/studier\/(programmer|emner)\/?$/.test(url.pathname) || url.search) fail('invalid-selection', 'Velg en publisert MF-programside fra katalogen.')
  return { url, code: decodeURIComponent(url.pathname.replace(/\/$/, '').split('/').at(-1)) }
}
function selectedProgramUrl(selected) {
  const expected = programRef(selected)
  return input => {
    const actual = programRef(input)
    if (actual.code !== expected.code || actual.url.pathname.replace(/\/$/, '') !== expected.url.pathname.replace(/\/$/, '')) fail('source-changed', 'MF videresendte til et annet program enn det studenten valgte.')
    return actual.url
  }
}
const courseUrl = input => { const url = mfProgramUrl(input); if (!/^\/studier\/emner\/[^/]+\/?$/.test(url.pathname) || url.search) fail('source-changed', 'Emnelenken er ikke en offentlig MF-emneside.'); return url }

export function parseMfPlan(html, query) {
  const source = programRef(query.sourceUrl), cohort = studentCohort(query), $ = load(html), name = clean($('h1').first().text())
  if (source.code !== query.program || !name) fail('invalid-selection', 'Programvalget stemmer ikke med MF-siden.')
  const models = [], warnings = [], unplaced = new Map(), edition = sourceEdition(html)
  $('main table').each((index, table) => {
    const rows = $(table).find('tr').filter((_, row) => $(row).closest('table')[0] === table), periods = new Map()
    if (!rows.toArray().some(row => /^\d{1,2}\.?\s*(?:sem\.?|semester)$/i.test(clean($(row).children('th,td').first().text())))) return
    const modelName = clean($(table).closest('details').children('summary').text()) || `Publisert studiemodell ${models.length + 1}`
    const modelId = `model-${models.length + 1}`
    rows.each((_, row) => {
      const cells = $(row).children('th,td'), header = clean(cells.first().text()), match = header.match(/^(\d{1,2})\.?\s*(?:sem\.?|semester)$/i)
      const number = match ? Number(match[1]) : null
      if (number && number > 40) fail('source-changed', 'Studietabellen har flere semestre enn importgrensen.')
      const period = number ? periods.get(number) || unknownPeriod(number) : null
      if (period) periods.set(number, period)
      for (const cell of cells.toArray().slice(1)) {
        const parsed = coursesFromLinks($, cell, { sourceUrl: source.url.href, courseUrl, institution: 'mf', university: 'MF vitenskapelige høyskole', scope: `${source.code}:${cohort}:${modelId}`, number: number || 'unplaced' })
        warnings.push(...parsed.warnings)
        for (const course of parsed.courses) {
          course.sourceVersion = 'current'
          if (period) { if (!period.courses.some(item => item.sourceRecordId === course.sourceRecordId)) period.courses.push(course) }
          else unplaced.set(`${modelId}:${course.sourceRecordId}`, { ...course, choice: '', notes: `${course.notes} Studiesemester er ikke entydig angitt i denne raden. Velg plasseringen selv.` })
        }
        if (parsed.text && (!parsed.courses.length || /valgfri|valgemne|utveksling|forbehold|praksis|eller/i.test(parsed.text))) {
          if (period) period.requirements.push(parsed.text)
          else if (parsed.courses.length) warnings.push(parsed.text)
        }
      }
    })
    const usable = [...periods.values()].sort((a, b) => a.studySemester - b.studySemester)
    if (usable.some(period => period.courses.length)) models.push({ id: modelId, name: modelName, periods: usable, unplacedCourses: [...unplaced.entries()].filter(([key]) => key.startsWith(`${modelId}:`)).map(([, course]) => course) })
  })
  if (!models.length) fail('not-supported', 'MF-programsiden er offentlig, men har ingen gjenkjennelig semester- og emnetabell. Bruk dokumentimport eller registrer emnene fra programbeskrivelsen. Kull og kalendersemester er ikke bekreftet av denne siden.')
  if (unplaced.size) warnings.push(`${unplaced.size} emner uten entydig studiesemester står som egne valg og legges ikke til automatisk.`)
  warnings.push('Dette er MFs gjeldende programside, ikke et verifisert kullarkiv. Ditt opptakskull og kalendersemester må oppgis av deg og kontrolleres mot egen studieplan.', 'Kontroller obligatoriske emner og valgemner i kildeutdragene. Ingen emner forhåndsvelges uten entydig emnetype. Undervisning, seminargrupper og personlige timeplaner hentes separat.')
  return { status: 'ok', program: { code: source.code, name, cohort, cohortFromStudent: true, sourceEdition: edition, sourceUrl: source.url.href, campuses: [] }, models, warnings: [...new Set(warnings)], completeness: { complete: !unplaced.size, pages: 1, returned: models.reduce((n, model) => n + model.periods.flatMap(period => period.courses).length, 0), unplaced: unplaced.size, scope: 'Emnelenker i gjeldende programsides publiserte semestertabeller; ingen bekreftet kull- eller kalenderårversjon.' } }
}

export async function mfPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const initial = load(await cachedText(fetchText, catalogue, mfProgramUrl)), filters = [...new Set(initial('input[type=radio][name=open]').map((_, item) => initial(item).attr('value')).get())]
    if (!filters.length || filters.some(value => !/^\d$/.test(value))) fail('source-changed', 'MF-katalogens publiserte programstatusfilter har endret seg.')
    const all = new Map(), warnings = []; let pages = 1, complete = true
    for (const filter of filters) {
      const url = new URL(catalogue); url.searchParams.set('open', filter)
      const data = await collectPages(url.href, fetchText, mfProgramUrl, ($) => {
        const results = []
        $('.wp-block-mf-preview--study a[href]').each((_, link) => { const source = programRef(new URL($(link).attr('href'), origin)), name = clean($(link).text()); if (name) results.push({ code: source.code, name, sourceUrl: source.url.href, campuses: [] }) })
        if (!results.length && !/ingen.*(?:treff|program)/i.test(clean($('main').text()))) fail('source-changed', 'MF-katalogen har ingen gjenkjennelige programkort.')
        return { results }
      })
      for (const item of data.results) all.set(item.sourceUrl, item)
      pages += data.completeness.pages; complete &&= data.completeness.complete; warnings.push(...data.warnings)
    }
    const q = clean(query.q).toLocaleLowerCase('nb'), results = [...all.values()].filter(item => !q || `${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q))
    return { status: 'ok', results, warnings: [...warnings, 'Katalogen omfatter både tilbud for nye studenter og utgående programmer. Årfilteret er ikke et kullarkiv; publiserte programsider må kontrolleres mot studentens kull.'], completeness: { complete, pages, returned: all.size, scope: 'Alle programkort fra de publiserte statusfiltrene, med eventuell paginering.' } }
  }
  const source = programRef(query.sourceUrl)
  if (query.program !== source.code) fail('invalid-selection', 'Velg programmet fra MF-katalogen.')
  const html = await cachedText(fetchText, source.url.href, selectedProgramUrl(source.url))
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'current', label: 'Gjeldende programside – oppgi ditt eget kull', sourceUrl: source.url.href, requiresStudentCohort: true }], warnings: ['MF-siden har ingen bekreftet kullvelger. Oppgi og kontroller ditt eget kull; planutgaven og kalendersemesteret behandles separat.'], completeness: { complete: false, pages: 1, returned: 1, scope: 'Gjeldende offentlig programside, ikke kullarkiv.' } }
  if (action === 'program-plan') return parseMfPlan(html, query)
  fail('not-supported', 'Handlingen støttes ikke av MF-programkilden.')
}
