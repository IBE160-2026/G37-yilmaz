import { load, clean, fail, cachedText, restrictedUrl, collectPages, asCredits, calendarTerm, periodLabel } from './program-source.js'

const settings = {
  hivolda: { origin: 'https://www.hivolda.no', catalogue: '/studieplaner', name: 'Høgskulen i Volda' },
  noroff: { origin: 'https://studiekatalog.edutorium.no', catalogue: '/nuc/en/programme', name: 'Noroff Høyskole' },
}
export function semesterTableUrl(input, institution) {
  const config = settings[institution]
  if (!config) fail('invalid-selection', 'Ukjent institusjon.')
  return restrictedUrl(input, { origin: config.origin, paths: institution === 'hivolda'
    ? [/^\/studieplaner(?:\/\d{4}(?:\/[^/]+(?:\/(?:Haust|V%C3%A5r))?)?)?\/?$/, /^\/students%C3%B8rvis\/studieinnhald\/studieplanar\/?$/, /^\/emne\/[^/]+\/\d+\/?$/]
    : [/^\/nuc\/en\/programme(?:\/[^/]+\/\d{4}-(?:autumn|spring))?\/?$/, /^\/nuc\/en\/course\/[^/]+\/\d{4}-(?:autumn|spring)\/?$/], keys: institution === 'noroff' ? ['sem', 'title_search', 'page'] : [] })
}
function reference(input, institution) {
  const url = semesterTableUrl(input, institution), path = decodeURIComponent(url.pathname)
  const match = institution === 'hivolda' ? path.match(/^\/studieplaner\/(\d{4})\/([^/]+)\/(Haust|Vår)\/?$/) : path.match(/^\/nuc\/en\/programme\/([^/]+)\/(\d{4})-(autumn|spring)\/?$/)
  if (!match) fail('invalid-selection', 'Velg et program med publisert kull og startsemester.')
  return { url, code: match[institution === 'hivolda' ? 2 : 1], cohort: match[institution === 'hivolda' ? 1 : 2], intake: /^(Vår|spring)$/.test(match[3]) ? 'spring' : 'autumn' }
}
function term(text, cohort) {
  return calendarTerm(text, cohort)
}
const ordinal = (value, source) => (value.year - +source.cohort) * 2 + (value.semester === 'autumn' ? 1 : 0) - (source.intake === 'autumn' ? 1 : 0) + 1
function courseReference(input, institution) {
  const url = semesterTableUrl(input, institution), path = decodeURIComponent(url.pathname), match = institution === 'hivolda' ? path.match(/^\/emne\/([^/]+)\/(\d+)\/?$/) : path.match(/^\/nuc\/en\/course\/([^/]+)\/(\d{4}-(?:spring|autumn))\/?$/)
  if (!match) fail('source-changed', 'Emnelenken i studiemodellen har endret format.')
  return { url, code: match[1], version: match[2] }
}
export function parseSemesterTablePlan(html, institution, query) {
  const source = reference(query.sourceUrl, institution), config = settings[institution], $ = load(html)
  if (source.code !== query.program || source.cohort !== String(query.cohort)) fail('invalid-selection', 'Program, kull og kildelenke må samsvare.')
  const name = clean(institution === 'hivolda' ? $('.node-pd > h2').first().text() : $('#page-title').first().text())
  const statedCohort = clean($('.field-years-ref > .item').first().text())
  if (!name || (statedCohort && statedCohort !== source.cohort) || !$('table.course-model').length) fail('source-changed', 'Kilden returnerte ikke den valgte studiemodellen og kullidentiteten.')
  const models = [], warnings = [], campuses = []
  $('.field-campus-ref > .item, .field-study-location > .item').each((_, item) => { const campus = clean($(item).text()); if (campus) campuses.push(campus) })
  $('table.course-model').each((index, table) => {
    const header = $(table).find('thead th').toArray(), hasType = /^(type|emnetype)$/i.test(clean($(header[1]).text())), offset = hasType ? 2 : 1
    const model = { id: $(table).attr('id') || `table-${index + 1}`, name: clean($(table).closest('fieldset').children('legend').text()) || 'Publisert studiemodell', periods: [] }
    for (const cell of header.slice(offset)) {
      const calendar = term($(cell).text(), source.cohort), studySemester = calendar ? ordinal(calendar, source) : 0
      if (!calendar || studySemester < 1 || studySemester > 40) fail('source-changed', 'En semesterkolonne kan ikke knyttes til det publiserte startsemesteret. Ingen perioder er gjettet.')
      if (model.periods.some(p => p.studySemester === studySemester)) fail('source-changed', 'Studiemodellen har gjentatte semesterkolonner.')
      model.periods.push({ id: `${model.id}:${studySemester}`, studySemester, ...calendar, label: periodLabel(studySemester, calendar), courses: [], requirements: [] })
    }
    const groups = [], directives = []
    $(table).find('tbody tr').each((_, row) => {
      if ($(row).closest('table')[0] !== table || $(row).hasClass('footer')) return
      const cells = $(row).children('td'), first = cells.first(), label = clean(first.text()), depth = first.children('.indentation').length
      if (!cells.length || !label) return
      if (cells.length !== header.length) fail('source-changed', 'En emnerad har et annet antall kolonner enn semesteroverskriften.')
      groups.length = Math.min(groups.length, depth)
      directives.length = Math.min(directives.length, depth + 1)
      if (depth === 0) directives.length = 0
      const link = first.find('a[href]').first(), allocation = model.periods.map((_, i) => clean(cells.eq(i + offset).text()))
      if (!link.length) {
        groups[depth] = label
        if (depth > 0 && /velge|velje|fagval|valg|valemne|elective|optional/i.test(label)) directives[depth] = label
        // Unallocated grouping prose governs its indented children; retain it even
        // when it has no credit value, rather than manufacturing a course.
        for (const [i, period] of model.periods.entries()) if (allocation[i] || allocation.every(value => !value)) period.requirements.push(`${label}${allocation[i] ? `: ${allocation[i]}` : ''}`)
        return
      }
      const record = courseReference(new URL(link.attr('href'), source.url), institution), courseName = clean(label.startsWith(record.code) ? label.slice(record.code.length) : label)
      const groupText = [...new Set([...groups, ...directives].filter(Boolean))].join(' → '), type = hasType ? clean(cells.eq(1).text()) : ''
      // A nested choice remains a choice even under a mandatory parent group.
      const optional = /valg|valemne|fagval|velge|velje|eller|elective|optional/i.test(`${groupText} ${type}`)
      const mandatory = !optional && /obligatorisk|mandatory|compulsory|required/i.test(`${groupText} ${type}`)
      if (!allocation.some(Boolean)) warnings.push(`${record.code} har ingen publisert semesterplassering og er ikke flyttet til et antatt semester.`)
      for (const [i, value] of allocation.entries()) {
        if (!value) continue
        const period = model.periods[i], course = { id: `${institution}:${record.code}:${period.year}:${period.semester}`, code: record.code, name: courseName || record.code, credits: asCredits(value), choice: optional ? 'V' : mandatory ? 'O' : '', year: period.year, semester: period.semester, campus: '', university: config.name, description: '', notes: [groupText, type ? `Kildens emnetype: ${type}.` : '', `Studiepoeng i denne semesterkolonnen: ${value}.`].filter(Boolean).join(' '), sourceUrl: record.url.href, sourceProvider: institution, sourceRecordId: record.code, sourceVersion: record.version, allocationText: value }
        const linkedTerm = institution === 'noroff' ? term(record.version.replace('-', ' '), source.cohort) : null
        if (linkedTerm && (linkedTerm.year !== period.year || linkedTerm.semester !== period.semester)) { course.versionUncertain = true; warnings.push(`${record.code}: emnebeskrivelsens utgave ${record.version} avviker fra semesterkolonnen; plasseringen er beholdt uten antatt periodebeskrivelse.`) }
        if (course.credits === null) warnings.push(`${record.code}: «${value}» er ikke et tallfestet studiepoengomfang. Ukjent verdi er beholdt.`)
        if (period.courses.some(item => item.code === course.code)) fail('source-changed', 'Samme emne står flere ganger i samme semester. Kontroller alternative valgregler i kilden.')
        period.courses.push(course)
      }
    })
    models.push(model)
  })
  // NUC publishes early common years and later specialisation as consecutive
  // blocks. Join only strictly disjoint calendar periods; overlapping models
  // remain separate source choices, never concatenated into an invented path.
  if (institution === 'noroff' && models.length > 1) {
    const all = models.flatMap(model => model.periods), numbers = new Set(all.map(p => p.studySemester))
    if (numbers.size === all.length) {
      const periods = models.flatMap(model => model.periods.map(period => ({ ...period, requirements: [`Publisert delmodell: ${model.name}`, ...period.requirements] }))).sort((a, b) => a.studySemester - b.studySemester)
      models.splice(0, models.length, { id: 'published-sequential', name: 'Publiserte sammenhengende delmodeller', periods })
    }
  }
  if (!models.some(model => model.periods.some(period => period.courses.length))) fail('not-supported', 'Studieplanen har ingen lesbare emner med publisert semesterplassering.')
  warnings.push('Kontroller valgreglene. Emner uten entydig obligatorisk status må velges av deg.', 'Emnebeskrivelser, undervisning og personlige grupper er ikke hentet fra denne studiemodellen.')
  return { status: 'ok', program: { code: source.code, name, cohort: source.cohort, intake: source.intake, sourceUrl: source.url.href, campuses: [...new Set(campuses)] }, models, warnings: [...new Set(warnings)], completeness: { complete: !warnings.some(w => /ingen publisert semesterplassering/.test(w)), pages: 1, returned: models.reduce((n, model) => n + model.periods.reduce((sum, period) => sum + period.courses.length, 0), 0), scope: 'Emner og kalenderkolonner i den valgte publiserte studiemodellen; undervisning og periodebestemte emnebeskrivelser er separate kilder.' } }
}

export async function semesterTablePrograms(institution, action, query, { fetchText }) {
  const config = settings[institution], validate = input => semesterTableUrl(input, institution)
  if (!config) fail('invalid-selection', 'Ukjent institusjon.')
  if (action === 'programs') {
    const catalogue = `${config.origin}${config.catalogue}`, $ = load(await cachedText(fetchText, catalogue, validate)), year = String(query.year || new Date().getFullYear()), lists = []
    if (!/^\d{4}$/.test(year)) fail('invalid-selection', 'Velg et gyldig katalogår.')
    if (institution === 'hivolda') {
      const href = $('a[href]').toArray().map(a => $(a).attr('href')).find(href => href === `/studieplaner/${year}`)
      if (href) lists.push(new URL(href, catalogue).href)
    } else {
      $('select[name=sem] option').each((_, item) => { const value = $(item).attr('value'); if (new RegExp(`^${year}-(autumn|spring)$`).test(value)) { const url = new URL(catalogue); url.searchParams.set('sem', value); lists.push(url.href) } })
    }
    if (!lists.length) return { status: 'ok', results: [], warnings: [`Katalogen publiserer ikke et valg for ${year}. Velg et av de tilgjengelige kildeårene.`], completeness: { complete: true, pages: 1, returned: 0, scope: 'Ingen publisert årvelger for det valgte året.' } }
    const results = new Map(), warnings = []; let complete = true, pages = 1
    for (const url of lists) {
      const data = await collectPages(url, fetchText, validate, ($, current) => {
        const entries = []; $('main a[href], #content a[href]').each((_, a) => { const href = $(a).attr('href'); let record; try { record = reference(new URL(href, current), institution) } catch { return }; if (record.cohort !== year) return; const name = clean($(a).text()); if (name) entries.push({ code: record.code, name, cohort: record.cohort, intake: record.intake, sourceUrl: record.url.href, campuses: [] }) })
        if (!entries.length) fail('source-changed', 'Katalogen har ingen gjenkjennelige programlenker for det valgte året.')
        return { results: entries }
      })
      for (const item of data.results) results.set(item.sourceUrl, item)
      complete &&= data.completeness.complete; pages += data.completeness.pages; warnings.push(...data.warnings)
    }
    const q = clean(query.q).toLocaleLowerCase('nb'), all = [...results.values()]
    return { status: 'ok', results: all.filter(item => !q || `${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q)), warnings: [...warnings, institution === 'noroff' ? 'Bare Noroff University College sin publiserte høyskolekatalog. Fagskolekatalogen og studier uten publisert plan inngår ikke.' : 'Publiserte studieplaner for valgt startår; vår- og høstoppstart beholdes som egne valg.'], completeness: { complete, pages, returned: all.length, scope: 'Alle programlenker i kildekatalogens valgte publiserte år/semesterutvalg.' } }
  }
  const source = reference(query.sourceUrl, institution)
  if (source.code !== query.program || (query.cohort && String(query.cohort) !== source.cohort)) fail('invalid-selection', 'Program og kull må samsvare med valgt kildelenke.')
  const guard = input => { const next = reference(input, institution); if (next.code !== source.code || next.cohort !== source.cohort || next.intake !== source.intake) fail('source-changed', 'Kilden videresendte til et annet program, kull eller startsemester.'); return next.url }
  const html = await cachedText(fetchText, source.url.href, guard)
  if (action === 'program-cohorts') {
    const $ = load(html), results = new Map()
    $('a[href]').each((_, a) => { let next; try { next = reference(new URL($(a).attr('href'), source.url), institution) } catch { return }; if (next.code !== source.code) return; results.set(next.url.href, { cohort: next.cohort, intake: next.intake, label: `${next.cohort} · ${next.intake === 'spring' ? 'vår' : 'høst'}`, sourceUrl: next.url.href }) })
    if (!results.size) fail('source-changed', 'Programmet har ingen publisert kullvelger.')
    return { status: 'ok', results: [...results.values()], warnings: ['Kullene følger programmets publiserte versjonslenker. Ingen manglende kull er antatt.'], completeness: { complete: false, pages: 1, returned: results.size, reason: 'Publiserte versjonslenker på valgt programside; andre startsemestre kan finnes i årskatalogen.' } }
  }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke av programimporten.')
  return parseSemesterTablePlan(html, institution, query)
}
