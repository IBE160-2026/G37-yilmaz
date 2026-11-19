import { load, clean, fail, cachedText, restrictedUrl, collectPages, asCredits, calendarTerm, periodLabel } from './program-source.js'

const origin = 'https://www.nord.no'
const catalogue = `${origin}/studier/studieplaner`
const cataloguePageLimit = 12
export const nordProgramUrl = input => restrictedUrl(input, {
  origin,
  paths: [/^\/studier\/studieplaner(?:\/[^/]+)?\/?$/, /^\/studier\/emner\/[^/]+\/?$/],
  keys: ['page', 's', 'search_api_fulltext', 'f[0]', 'year', 'semester'],
})

function planIdentity(input) {
  const url = nordProgramUrl(input), slug = decodeURIComponent(url.pathname).match(/^\/studier\/studieplaner\/([^/]+)\/?$/)?.[1]
  const version = slug?.match(/^(.+)-(host|var|h|v)-(\d{4})$/i)
  if (!version) return null
  return { url, program: version[1], cohort: version[3], intake: /^(?:var|v)$/i.test(version[2]) ? 'spring' : 'autumn' }
}

const ordinal = (term, source) => (term.year - Number(source.cohort)) * 2 + (term.semester === 'autumn' ? 1 : 0) - (source.intake === 'autumn' ? 1 : 0) + 1
const intakeOrder = row => 2 * Number(row.cohort) + (row.intake === 'autumn' ? 1 : 0)

export function parseNordProgramPlan(html, query) {
  const source = planIdentity(query.sourceUrl)
  if (!source || source.program !== query.program || source.cohort !== String(query.cohort)) fail('invalid-selection', 'Program, opptakskull og den publiserte Nord-planen må samsvare.')
  const $ = load(html), rawTitle = clean($('main h1, h1').first().text()) || clean($('meta[property="og:title"]').attr('content')) || clean($('title').text()).replace(/^Studieplan\s*-\s*/i, ''), title = rawTitle, periods = [], warnings = [], campuses = []
  const semesterWrappers = $('.nord-fs-study-model-form .semester-wrapper, .model-wrapper .semester-wrapper, .semester-wrapper')
  if (!title || !semesterWrappers.length) fail('source-changed', `Nord returnerte ikke den valgte studiemodellen (${title ? 'semesterblokkene mangler' : 'programtittelen mangler'}).`)
  $('.sidebar-item').each((_, node) => { if (/^Studiested$/i.test(clean($(node).find('.field__label').text()))) { const value = clean($(node).find('.field__item').text()); if (value) campuses.push(...value.split(/\s*,\s*/)) } })
  semesterWrappers.each((_, wrapper) => {
    const heading = clean($(wrapper).children('h2').first().text()), match = heading.match(/^(Høst|Vår)\s+(\d{4})(?:\s*\((\d+)\.\s*semester\))?/i)
    const term = match && calendarTerm(`${match[2]} ${/^V/i.test(match[1]) ? 'V' : 'H'}`, source.cohort), studySemester = term && ordinal(term, source)
    if (!term || !Number.isInteger(studySemester) || studySemester < 1 || studySemester > 40 || (match[3] && Number(match[3]) !== studySemester)) fail('source-changed', `Semesteroverskriften «${heading}» kan ikke knyttes sikkert til valgt opptakskull.`)
    const period = { id: String(studySemester), studySemester, ...term, label: periodLabel(studySemester, term), courses: [], requirements: [] }
    $(wrapper).find('.subject-outer-wrapper').each((_, row) => {
      const code = clean($(row).find('.subject-code, [data-subject-code]:not(button)').first().text()), link = $(row).find('.subject-name a[href]').first(), name = clean(link.text()), value = clean($(row).find('.subject-points').text())
      if (!code || !link.length || !name) { const text = clean($(row).text()); if (text) period.requirements.push(text); return }
      const url = nordProgramUrl(new URL(link.attr('href'), source.url)), linkedYear = url.searchParams.get('year'), linkedSemester = url.searchParams.get('semester')
      if (linkedYear !== String(term.year) || !new RegExp(term.semester === 'spring' ? '^V(?:Å|A)R$' : '^H(?:Ø|O)ST$', 'i').test(linkedSemester || '')) fail('source-changed', `${code}: emnelenkens kalendersemester avviker fra studieplanen.`)
      const context = `${$(row).attr('data-combination-name') || ''} ${$(row).attr('class') || ''} ${$(row).parentsUntil(wrapper, '[class]').map((_i, item) => $(item).attr('class')).get().join(' ')}`
      const choice = /choice|elective|optional|valg/i.test(context) ? 'V' : /mandatory|compulsory|obligatorisk/i.test(context) ? 'O' : ''
      if (period.courses.some(item => item.code === code)) fail('source-changed', `${code} står flere ganger i samme semester.`)
      period.courses.push({ id: `nord:${source.program}:${source.cohort}:${studySemester}:${code}`, code, name, credits: asCredits(value.match(/\d+(?:[.,]\d+)?/)?.[0]), choice, university: 'Nord universitet', description: '', notes: `Kildens omfang: ${value || 'ikke oppgitt'}.`, sourceUrl: url.href, sourceProvider: 'nord-program', sourceRecordId: code, sourceVersion: `${term.year}${term.semester === 'spring' ? 'V' : 'H'}`, ...term, campus: campuses.length === 1 ? campuses[0] : '' })
      if (asCredits(value.match(/\d+(?:[.,]\d+)?/)?.[0]) === null) warnings.push(`${code}: kilden oppgir ikke et tallfestet studiepoengomfang.`)
      if (!choice) warnings.push(`${code}: planen markerer ikke emnet uttrykkelig som obligatorisk eller valgfritt; typen må bekreftes.`)
    })
    $(wrapper).find('[class*=choice], [class*=elective], [class*=valg]').filter((_i, node) => !$(node).find('.subject-outer-wrapper').length).each((_, node) => { const text = clean($(node).text()); if (text) period.requirements.push(text) })
    periods.push(period)
  })
  if (!periods.some(period => period.courses.length || period.requirements.length)) fail('not-supported', 'Nord-planen inneholder ingen lesbare emner eller valgkrav.')
  const edition = clean($('input[name=code]').attr('value')) || source.program
  return { status: 'ok', program: { code: source.program, name: title, cohort: source.cohort, intake: source.intake, sourceUrl: source.url.href, sourceRecordId: edition, campuses: [...new Set(campuses)] }, models: [{ id: edition, name: 'Publisert studiemodell', periods }], warnings: [...new Set([...warnings, 'Valgemner, studieretning, studiested og undervisningsgrupper må bekreftes av studenten der planen viser alternativer.', 'Undervisning importeres separat fra den offentlige kalenderkilden.'])], completeness: { complete: !warnings.length, pages: 1, returned: periods.reduce((sum, period) => sum + period.courses.length, 0), scope: 'Navngitte emner og valgkrav i valgt, versjonert Nord-studieplan.' } }
}

export async function nordPrograms(action, query, { fetchText }) {
  const validate = nordProgramUrl
  if (action === 'programs') {
    const search = clean(query.q).slice(0, 120)
    const start = new URL(catalogue)
    if (search) start.searchParams.set('s', search)
    const validateSearch = input => {
      const url = validate(input)
      if (url.pathname.replace(/\/$/, '') !== start.pathname || (url.searchParams.get('s') || '') !== search) fail('source-changed', 'Nords neste resultatside endret det valgte søket.')
      return url
    }
    let declaredTotal = null
    const data = await collectPages(start.href, fetchText, validateSearch, ($, current) => {
      const count = clean($('body').text()).match(/Viser\s+treff\s+\d+\s*-\s*\d+\s+av\s+(\d+)/i)
      if (count) { if (declaredTotal !== null && declaredTotal !== Number(count[1])) fail('source-changed', 'Nord endret katalogtotalen under hentingen.'); declaredTotal = Number(count[1]) }
      const results = []
      $('a[href]').each((_, node) => {
        const link = $(node)
        let id
        try { id = planIdentity(new URL(link.attr('href'), current)) } catch { return }
        const name = clean(link.find('h2,h3').first().text() || link.text())
        if (id && name) results.push({ id: id.url.href, code: id.program, name, cohort: id.cohort, intake: id.intake, sourceUrl: id.url.href, campuses: [] })
      })
      return { results }
    }, { maxPages: search ? cataloguePageLimit : 2 })
    const byProgram = new Map()
    for (const row of data.results) { const old = byProgram.get(row.code); if (!old || intakeOrder(row) > intakeOrder(old)) byProgram.set(row.code, row) }
    const missing = declaredTotal !== null && data.results.length !== declaredTotal
    const q = search.toLocaleLowerCase('nb')
    const results = [...byProgram.values()].filter(row => !q || `${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(q))
    return { status: 'ok', results, warnings: [...data.warnings, ...(missing ? [`Nord oppgir ${declaredTotal} planversjoner for dette søket. ${data.results.length} ble lest. Søk etter programnavn eller kode for å avgrense utvalget.`] : []), 'Programlisten samler publiserte planversjoner. Velg opptakskull i neste steg.'], completeness: { ...data.completeness, complete: data.completeness.complete && !missing, returned: results.length, catalogueVersions: data.results.length, ...(declaredTotal !== null ? { total: declaredTotal } : {}) } }
  }
  const selected = planIdentity(query.sourceUrl)
  if (!selected || selected.program !== query.program) fail('invalid-selection', 'Velg en publisert Nord-plan fra programlisten.')
  const html = await cachedText(fetchText, selected.url.href, validate)
  if (action === 'program-cohorts') {
    const $ = load(html), results = new Map([[`${selected.cohort}:${selected.intake}`, { cohort: selected.cohort, intake: selected.intake, label: `${selected.intake === 'spring' ? 'Vår' : 'Høst'} ${selected.cohort}`, sourceUrl: selected.url.href }]])
    $('select[name=semester_chooser] option[value], a[href]').each((_, node) => {
      const item = $(node)
      let row
      try { row = planIdentity(new URL(item.attr('value') || item.attr('href'), selected.url)) } catch { return }
      if (!row || row.program !== selected.program) return
      const id = `${row.cohort}:${row.intake}`
      if (!results.has(id)) results.set(id, { cohort: row.cohort, intake: row.intake, label: clean(item.text()) || `${row.intake === 'spring' ? 'Vår' : 'Høst'} ${row.cohort}`, sourceUrl: row.url.href })
    })
    return { status: 'ok', results: [...results.values()].sort((a, b) => intakeOrder(b) - intakeOrder(a)), warnings: ['Bare kullversjoner som kilden lenker fra valgt plan er vist; katalogen kan inneholde flere historiske navnevarianter.'], completeness: { complete: false, pages: 1, returned: results.size, reason: 'Kullisten er avgrenset til kildepubliserte lenker for samme stabile planslug.' } }
  }
  if (action !== 'program-plan') fail('not-supported', 'Nord-programkilden støtter ikke handlingen.')
  return parseNordProgramPlan(html, query)
}
