import { load, clean, fail, cachedText, restrictedUrl, asCredits, calendarTerm, periodLabel } from './program-source.js'

const origin = 'https://www.uia.no'
const catalogue = `${origin}/studier/program/`
export const uiaProgramUrl = input => restrictedUrl(input, {
  origin,
  paths: [/^\/studier\/program\/?$/, /^\/studier\/program\/[^/]+\/(?:index\.html)?$/, /^\/studier\/program\/[^/]+\/studieplaner\/?$/, /^\/studier\/program\/[^/]+\/studieplaner\/\d{4}[hv]\.html$/, /^\/studier\/emner\/\d{4}\/(?:host|var)\/[^/]+\.html$/],
  keys: [],
})

function programIdentity(input) {
  const url = uiaProgramUrl(input), match = decodeURIComponent(url.pathname).match(/^\/studier\/program\/([^/]+)\/(?:index\.html)?$/)
  return match && { url, code: match[1] }
}
function planIdentity(input) {
  const url = uiaProgramUrl(input), match = decodeURIComponent(url.pathname).match(/^\/studier\/program\/([^/]+)\/studieplaner\/(\d{4})([hv])\.html$/i)
  return match && { url, code: match[1], cohort: match[2], intake: /^v$/i.test(match[3]) ? 'spring' : 'autumn' }
}
const ordinal = (term, source) => (term.year - Number(source.cohort)) * 2 + (term.semester === 'autumn' ? 1 : 0) - (source.intake === 'autumn' ? 1 : 0) + 1
const classTokens = node => clean(node?.attribs?.class).split(/\s+/).filter(Boolean)

export function parseUiaProgramPlan(html, query) {
  const source = planIdentity(query.sourceUrl)
  if (!source || source.code !== query.program || source.cohort !== String(query.cohort)) fail('invalid-selection', 'Program, opptakskull og den publiserte UiA-planen må samsvare.')
  const $ = load(html), plan = $('.vrtx-fs-study-model').first(), title = clean($('main h1, h1').first().text()), years = title.match(/\((\d{4})\s*[–-]\s*(\d{4})\)/), campuses = []
  if (!plan.length || !title || !years || years[1] !== source.cohort) fail('source-changed', 'UiA returnerte ikke den valgte, daterte studiemodellen.')
  $('dt, .fact-label, .field__label').each((_, label) => { if (/^Studiested:?$/i.test(clean($(label).text()))) { const value = clean($(label).next('dd, .fact-value, .field__item').text()); if (value) campuses.push(value.replace(/^Campus\s+/i, '')) } })

  const labels = new Map(), edges = new Map(), addEdge = (from, to) => { if (!from || !to) return; if (!edges.has(from)) edges.set(from, new Set()); edges.get(from).add(to) }
  plan.find('form[name=select-education-plan-direction]').each((_, form) => {
    let root = ''
    $(form).find('input[value]').each((_, input) => {
      const path = clean($(input).attr('value')).split(/\s*->\s*/).filter(Boolean); if (!path.length) return
      root ||= path[0]
      for (let index = 1; index < path.length; index++) addEdge(path[index - 1], path[index])
      const id = $(input).attr('id'), label = clean($(form).find(`label[for="${id}"]`).text()); if (label) labels.set(path.at(-1), label)
    })
    const owner = $(form).closest('.combination'), direct = classTokens(owner[0]).find(value => /^direction-(?!parent-|ancestor-)/.test(value))?.slice(10)
    if (direct && root) addEdge(direct, root)
  })
  plan.find('.direction').each((_, node) => { const direct = classTokens(node).find(value => /^direction-(?!parent-|ancestor-)/.test(value))?.slice(10), label = clean($(node).children('h4').first().text()); if (direct && label && !labels.has(direct)) labels.set(direct, label) })
  const nodes = new Set([...edges.keys(), ...[...edges.values()].flatMap(set => [...set])]), children = new Set([...edges.values()].flatMap(set => [...set])), roots = [...nodes].filter(node => !children.has(node))
  const pathsFrom = root => { const found = []; const visit = (node, path = [], depth = 0) => { if (depth > 20) fail('source-changed', 'UiAs studieretninger er dypere enn importgrensen.'); const next = edges.get(node); if (!next?.size) { found.push([...path, node]); return }; for (const child of next) visit(child, [...path, node], depth + 1) }; visit(root); return found }
  let paths = [[]]
  for (const root of roots) {
    const alternatives = pathsFrom(root)
    paths = paths.flatMap(prefix => alternatives.map(alternative => [...prefix, ...alternative]))
    if (paths.length > 100) fail('not-supported', 'UiA-planens publiserte valg gir mer enn 100 kombinasjoner. Velg emner manuelt fra planen.')
  }

  const combinations = plan.find('.combination').toArray().map(node => {
    const tokens = classTokens(node), required = new Set(tokens.filter(value => /^direction-(?!parent-|ancestor-)/.test(value)).map(value => value.slice(10))), termNode = $(node).closest('.term'), heading = clean(termNode.children('h3').first().text()), match = heading.match(/^(Høst|Vår)\s+(\d{4})/i), term = match && calendarTerm(`${match[2]} ${/^V/i.test(match[1]) ? 'V' : 'H'}`, source.cohort)
    if (!term) fail('source-changed', `UiAs semesteroverskrift «${heading}» kan ikke knyttes til valgt kull.`)
    return { node, required, term, heading: clean($(node).children('h4').first().text()) }
  })
  const models = [], warnings = []
  for (const [index, path] of paths.entries()) {
    const signature = new Set(path), periods = new Map()
    for (const combination of combinations) {
      if ([...combination.required].some(token => !signature.has(token))) continue
      const studySemester = ordinal(combination.term, source)
      if (!Number.isInteger(studySemester) || studySemester < 1 || studySemester > 40) fail('source-changed', 'Et UiA-kalendersemester ligger utenfor valgt studieløp.')
      let period = periods.get(studySemester)
      if (!period) { period = { id: `${index + 1}:${studySemester}`, studySemester, ...combination.term, label: periodLabel(studySemester, combination.term), courses: [], requirements: [] }; periods.set(studySemester, period) }
      if (combination.heading) period.requirements.push(combination.heading)
      $(combination.node).find('li a.course-link[href]').each((_, link) => {
        const row = $(link).closest('li'), code = clean($(link).find('.course-code').text()), name = clean($(link).find('.course-name').text()), creditText = clean($(link).find('.course-study-points').text()), url = uiaProgramUrl(new URL($(link).attr('href'), source.url))
        const reference = decodeURIComponent(url.pathname).match(/^\/studier\/emner\/(\d{4})\/(host|var)\/([^/]+)\.html$/i)
        if (!reference) fail('source-changed', `${code || name}: UiAs emnelenke har endret format.`)
        if (!code || !name || reference[3].toLocaleLowerCase('nb') !== code.toLocaleLowerCase('nb')) fail('source-changed', 'En UiA-emnerad mangler samsvarende kode, navn eller kildeidentitet.')
        const linkedSemester = /^var$/i.test(reference[2]) ? 'spring' : 'autumn', versionUncertain = reference[1] !== String(combination.term.year) || linkedSemester !== combination.term.semester
        if (versionUncertain) warnings.push(`${code}: studiemodellen plasserer emnet i ${combination.term.semester === 'spring' ? 'vår' : 'høst'} ${combination.term.year}, mens emnelenken viser utgaven ${linkedSemester === 'spring' ? 'vår' : 'høst'} ${reference[1]}. Studieplanens plassering er beholdt; kontroller at emneutgaven gjelder ditt kull.`)
        const choice = row.hasClass('mandatory') ? 'O' : /elective|optional|choice/i.test(row.attr('class') || '') ? 'V' : ''
        const record = { id: `uia:${source.code}:${source.cohort}:${index + 1}:${studySemester}:${code}`, code, name, credits: asCredits(creditText.match(/\d+(?:[.,]\d+)?/)?.[0]), choice, university: 'Universitetet i Agder', description: '', notes: `${combination.heading || 'Publisert studiemodell'}. Kildens omfang: ${creditText || 'ikke oppgitt'}.${versionUncertain ? ' Emnesidens utgave avviker fra studieplanens kalendersemester.' : ''}`, sourceUrl: url.href, sourceProvider: 'uia-program', sourceRecordId: code, sourceVersion: `${reference[1]}${linkedSemester === 'spring' ? 'V' : 'H'}`, versionUncertain, ...combination.term, campus: campuses.length === 1 ? campuses[0] : '' }
        if (!period.courses.some(item => item.code === code)) period.courses.push(record)
      })
    }
    const usable = [...periods.values()].sort((a, b) => a.studySemester - b.studySemester)
    if (usable.some(period => period.courses.length)) models.push({ id: path.length ? path.join('--') : `published-${index + 1}`, name: path.map(token => labels.get(token)).filter(Boolean).join(' / ') || 'Publisert studiemodell', selectionIds: path, periods: usable })
  }
  if (!models.length) fail('not-supported', 'UiA-planen inneholder ingen lesbare emner i publiserte studieretninger.')
  return { status: 'ok', program: { code: source.code, name: title.replace(/\s*\(\d{4}\s*[–-]\s*\d{4}\)\s*$/, ''), cohort: source.cohort, intake: source.intake, sourceUrl: source.url.href, campuses: [...new Set(campuses)] }, models, warnings: [...new Set([...warnings, 'Velg den opptaksvarianten og studieretningen du faktisk følger. UiA-planens skjulte alternativer er bevart som separate studiemodeller.', 'Valgemner, undervisning og personlig gruppetilhørighet må bekreftes separat.'])], completeness: { complete: !warnings.length, pages: 1, returned: models.reduce((sum, model) => sum + model.periods.reduce((n, period) => n + period.courses.length, 0), 0), ...(warnings.length ? { reason: 'Minst én publisert emnesideutgave avviker fra kalendersemesteret i studieplanen og må kontrolleres.' } : {}), scope: 'Alle navngitte emner i de eksplisitte grenene i valgt, versjonert UiA-studieplan.' } }
}

export async function uiaPrograms(action, query, { fetchText }) {
  const validate = uiaProgramUrl
  if (action === 'programs') {
    const $ = load(await cachedText(fetchText, catalogue, validate)), results = new Map()
    $('a[href]').each((_, node) => { let row; try { row = programIdentity(new URL($(node).attr('href'), catalogue)) } catch { return }; if (!row) return; const name = clean($(node).text()); if (!name) return; const existing = results.get(row.code); if (!existing || name.length > existing.name.length) results.set(row.code, { code: row.code, name, sourceUrl: `${origin}/studier/program/${row.code}/`, campuses: [] }) })
    if (!results.size) fail('not-supported', 'UiAs offentlige programliste har endret format.')
    const q = clean(query.q).toLocaleLowerCase('nb'), output = [...results.values()].filter(row => !q || `${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(q))
    return { status: 'ok', results: output, warnings: ['UiAs komplette statiske programside har ingen observert paginering. Studieplanversjon velges i neste steg.'], completeness: { complete: true, pages: 1, returned: results.size, scope: 'Unike førsteledds programlenker på UiAs offentlige programside.' } }
  }
  const program = programIdentity(query.sourceUrl)
  if (action === 'program-cohorts') {
    if (!program || program.code !== query.program) fail('invalid-selection', 'Velg et UiA-program fra den offentlige programlisten.')
    const html = await cachedText(fetchText, program.url.href, validate), $ = load(html), links = new Set()
    $('a[href]').each((_, node) => { try { const url = uiaProgramUrl(new URL($(node).attr('href'), program.url)); if (/\/studieplaner\/$/.test(url.pathname)) links.add(url.href) } catch {} })
    let plansHtml = html, pages = 1
    if (links.size === 1) { plansHtml = await cachedText(fetchText, [...links][0], validate); pages++ }
    const plans = new Map()
    load(plansHtml)('a[href]').each((_, node) => { let row; try { row = planIdentity(new URL(load(plansHtml)(node).attr('href'), program.url)) } catch { return }; if (!row || row.code !== program.code) return; plans.set(`${row.cohort}:${row.intake}`, { cohort: row.cohort, intake: row.intake, label: clean(load(plansHtml)(node).text()) || `${row.intake === 'spring' ? 'Vår' : 'Høst'} ${row.cohort}`, sourceUrl: row.url.href }) })
    if (!plans.size) fail('not-supported', 'UiA-programmet har ingen uttrykkelig daterte studieplanlenker.')
    return { status: 'ok', results: [...plans.values()].sort((a, b) => `${b.cohort}${b.intake}`.localeCompare(`${a.cohort}${a.intake}`)), warnings: [], completeness: { complete: true, pages, returned: plans.size, scope: 'Alle daterte studieplanlenker på programmets publiserte studieplanindeks.' } }
  }
  if (action !== 'program-plan') fail('not-supported', 'UiA-programkilden støtter ikke handlingen.')
  const selected = planIdentity(query.sourceUrl)
  if (!selected || selected.code !== query.program || selected.cohort !== String(query.cohort)) fail('invalid-selection', 'Velg en publisert UiA-studieplan med riktig kull.')
  return parseUiaProgramPlan(await cachedText(fetchText, selected.url.href, validate), query)
}
