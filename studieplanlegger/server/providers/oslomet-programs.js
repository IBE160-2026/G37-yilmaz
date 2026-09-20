import { load, clean, fail, cachedText, restrictedUrl, collectPages } from './program-source.js'

const origin = 'https://student.oslomet.no'
const catalogue = `${origin}/studier`
const planPattern = /^\/studier\/-\/studieinfo\/programplan\/([^/]+)\/(\d{4})\/(H%C3%98ST|V%C3%85R)(?:\/oppbygning)?$/i
const validate = input => restrictedUrl(input, { origin, paths: [/^\/studier\/?$/, /^\/studier\/-\/studieinfo\/programplaner\/\d{4}\/(?:H%C3%98ST|V%C3%85R)$/i, planPattern] })
function planRef(input) {
  const url = validate(input), match = url.pathname.match(planPattern)
  if (!match) fail('invalid-selection', 'Velg en publisert programplan hos OsloMet.')
  return { url, code: decodeURIComponent(match[1]), cohort: match[2], intake: /^V/i.test(match[3]) ? 'spring' : 'autumn' }
}
function publishedUrl(href, base) { const url = new URL(href, base); url.hash = ''; return validate(url).href }

// Decode a single quoted JS string literal as data. Never evaluate source scripts.
export function decodeOsloMetPlans(html) {
  const match = html.match(/\bvar\s+subjectPlans\s*=\s*JSON\.parse\(\s*'((?:\\[^]|[^'\\])*)'\s*\)/)
  if (!match || match[1].length > 1500000) fail('source-changed', 'OsloMet-siden inneholder ingen lesbar, strukturert emneplan. Åpne kilden eller importer dokumentet.')
  let decoded = ''
  const literal = match[1], escapes = { "'": "'", '"': '"', '\\': '\\', '/': '/', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }
  for (let i = 0; i < literal.length; i++) {
    if (literal[i] !== '\\') { decoded += literal[i]; continue }
    const kind = literal[++i]
    if (kind === 'x' || kind === 'u') {
      const count = kind === 'x' ? 2 : 4, digits = literal.slice(i + 1, i + count + 1)
      if (digits.length !== count || !/^[\da-f]+$/i.test(digits)) fail('source-changed', 'Emneplanen har et ukjent tekstformat.')
      decoded += String.fromCharCode(parseInt(digits, 16)); i += count
    } else if (Object.hasOwn(escapes, kind)) decoded += escapes[kind]
    else fail('source-changed', 'Emneplanen har et ukjent tekstformat.')
  }
  let result
  try { result = JSON.parse(decoded) } catch { fail('source-changed', 'Den strukturerte emneplanen kunne ikke leses.') }
  if (!result || !Array.isArray(result.studyPlan) || result.studyPlan.length > 30) fail('source-changed', 'OsloMet returnerte en ukjent studieplanstruktur.')
  return result.studyPlan
}

export function parseOsloMetCatalogue(html, sourceUrl = catalogue) {
  const $ = load(html), results = new Map()
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (!href.includes('/studieinfo/programplan/')) return
    let url, ref
    try { url = publishedUrl(href, sourceUrl); ref = planRef(url) } catch { return }
    if (new URL(url).pathname.endsWith('/oppbygning')) return
    const name = clean($(element).find('h2').text() || $(element).attr('title') || $(element).text())
    if (!name) return
    results.set(url, { code: ref.code, name, cohort: ref.cohort, intake: ref.intake, sourceUrl: url, campuses: [] })
  })
  if (!results.size) fail('source-changed', 'Fant ingen publiserte programplaner i OsloMet-katalogen. Eksisterende emner er bevart.')
  return [...results.values()]
}

export function parseOsloMetCohorts(html, sourceUrl) {
  const $ = load(html), selected = planRef(sourceUrl), results = new Map()
  const add = (href, label) => {
    try {
      const url = publishedUrl(href, sourceUrl), ref = planRef(url)
      if (ref.code !== selected.code) return
      results.set(`${ref.cohort}-${ref.intake}`, { cohort: ref.cohort, intake: ref.intake, label: clean(label) || `${ref.cohort} ${ref.intake === 'spring' ? 'vår' : 'høst'}`, sourceUrl: url })
    } catch { /* Ignore links outside this programme's published history. */ }
  }
  $('select[id$="yearSwitcher"] option[data-link]').each((_, element) => add($(element).attr('data-link'), $(element).text()))
  if (!results.size) add(sourceUrl)
  return [...results.values()].sort((a, b) => b.cohort.localeCompare(a.cohort) || a.intake.localeCompare(b.intake))
}

export function parseOsloMetPlan(html, sourceUrl) {
  const $ = load(html), ref = planRef(sourceUrl), plan = decodeOsloMetPlans(html), warnings = []
  const name = clean($('h1').first().text()).replace(/\s*Programplan\s*$/i, '') || ref.code
  const periods = [], seenPeriods = new Set(); let count = 0
  for (const year of plan) for (const period of year.semesters || []) {
    const number = Number(period.sortKey), calendarYear = Number(period.name?.year), termText = clean(period.name?.term)
    const semester = /^(høst|haust)$/i.test(termText) ? 'autumn' : /^vår$/i.test(termText) ? 'spring' : null
    if (!Number.isInteger(number) || number < 1 || number > 60 || seenPeriods.has(number)) fail('source-changed', 'Studieplanen har uklare eller gjentatte studiesemestre.')
    seenPeriods.add(number)
    const termYear = Number.isInteger(calendarYear) && calendarYear >= 2000 && calendarYear <= 2200 ? calendarYear : null
    if (!semester || !termYear) warnings.push(`${number}. studiesemester mangler entydig kalendersemester. Velg det selv før import.`)
    const courses = new Map(), requirements = new Set()
    function walk(node, branches = [], depth = 0) {
      if (depth > 15 || ++count > 12000 || !node || typeof node !== 'object') fail('source-changed', 'Studieplanstrukturen er større eller mer sammensatt enn importøren støtter.')
      if (node.description) requirements.add(clean(load(node.description).text()))
      for (const raw of node.courses || []) {
        if (Number(raw.termNr) !== number) { warnings.push(`Emnet ${clean(raw.code)} har et uklart semester og ble ikke lagt til.`); continue }
        const code = clean(raw.code), title = clean(raw.name)
        if (!code || !title) fail('source-changed', 'Et emne mangler kode eller navn i programplanen.')
        let link
        try { link = restrictedUrl(new URL(raw.link, origin), { origin, paths: [/^\/studier\/-\/studieinfo\/emne\/[^/]+\/\d{4}\/(?:H%C3%98ST|V%C3%85R)$/i] }).href }
        catch { fail('source-changed', 'Et emne har en uventet kildelenke.') }
        const conditional = branches.length > 0
        const note = [conditional ? `Gjelder veivalg: ${branches.join(' → ')}. ${clean(raw.selectionRule?.name)} innen dette valget.` : '', Number(raw.span?.count) > 1 ? `Emnet går over ${Number(raw.span.count)} semestre; denne oppføringen gjelder del ${Number(raw.span.index) || '?'}.` : ''].filter(Boolean).join(' ')
        const previous = courses.get(code)
        if (previous) {
          if (note && !previous.notes.includes(note)) previous.notes = [previous.notes, note].filter(Boolean).join('\n')
          // A common mandatory occurrence remains mandatory; branch-only occurrences never become preselected.
          if (!conditional && raw.selectionRule?.code === 'O') previous.choice = 'O'
          continue
        }
        courses.set(code, { id: `oslomet:${ref.code}:${ref.cohort}:${ref.intake}:${number}:${code}`, code, name: title, credits: raw.weight?.type === 'SP' && Number.isFinite(raw.weight.value) ? raw.weight.value : null, choice: conditional ? 'V' : clean(raw.selectionRule?.code), sourceRule: clean(raw.selectionRule?.name), sourceUrl: link, sourceRecordId: `${code}:${ref.cohort}:${ref.intake}`, sourceVersion: `${ref.cohort}-${ref.intake}`, sourceProvider: 'oslomet', university: 'OsloMet – storbyuniversitetet', description: '', notes: note, year: termYear, semester, campus: '' })
      }
      if (node.veivalg && node.nest?.length) requirements.add(`Velg selv blant ${clean(node.name) || 'studieretningene'}: ${node.nest.map(child => clean(child.name)).join('; ')}. Retningsavhengige emner er ikke forhåndsvalgt.`)
      for (const child of node.nest || []) walk(child, node.veivalg ? [...branches, clean(child.name) || clean(child.code)] : branches, depth + 1)
    }
    for (const node of period.studyStructure || []) walk(node)
    periods.push({ id: String(number), studySemester: number, label: `${number}. studiesemester · ${semester && termYear ? `${semester === 'spring' ? 'Vår' : 'Høst'} ${termYear}` : 'Kalendersemester må avklares'}`, year: termYear, semester, courses: [...courses.values()], requirements: [...requirements] })
  }
  if (!periods.length) fail('source-changed', 'Programplanen inneholder ingen publiserte studiesemestre.')
  warnings.push('Programplanen dokumenterer emner og studieløp. Undervisningstid, campus og personlig gruppetilhørighet er ikke hentet. Emnenes kildelenker beholder den publiserte planversjonen.')
  return { status: 'ok', program: { code: ref.code, name, cohort: ref.cohort, intake: ref.intake, sourceUrl, campuses: [] }, models: [{ id: 'published', name: 'Publisert studieplan – kontroller eventuelle veivalg', periods: periods.sort((a, b) => a.studySemester - b.studySemester) }], warnings: [...new Set(warnings)], completeness: { complete: !warnings.some(w => w.includes('ble ikke lagt til')), pages: 1, returned: periods.length } }
}

export async function oslometPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    let starts = [catalogue]
    const first = await cachedText(fetchText, catalogue, validate)
    if (query.year || query.cohort) {
      const wanted = String(query.cohort || query.year), $ = load(first)
      const links = $('select[id$="termSwitcher"] option[data-link]').toArray().map(element => $(element).attr('data-link'))
      const matches = links.filter(href => href.includes(`/${wanted}/`) && (!query.semester || href.includes(query.semester === 'spring' ? 'V%C3%85R' : 'H%C3%98ST')))
      if (!matches.length) fail('no-matching-results', 'OsloMet publiserer ingen programliste for det valgte semesteret i kildevelgeren.')
      starts = [...new Set(matches.map(href => publishedUrl(href, catalogue)))]
    }
    const lists = []
    for (const start of starts) lists.push(await collectPages(start, fetchText, validate, ($, url) => ({ results: parseOsloMetCatalogue($.html(), url) })))
    const result = { results: [...new Map(lists.flatMap(list => list.results).map(item => [item.sourceUrl, item])).values()], warnings: lists.flatMap(list => list.warnings), completeness: { complete: lists.every(list => list.completeness.complete), pages: lists.reduce((total, list) => total + list.completeness.pages, 0) } }
    result.completeness.returned = result.results.length
    if (query.q) result.results = result.results.filter(item => `${item.code} ${item.name}`.toLocaleLowerCase('nb-NO').includes(String(query.q).toLocaleLowerCase('nb-NO')))
    return { status: 'ok', ...result, sourceUrl: catalogue }
  }
  const ref = planRef(query.sourceUrl || '')
  if ((query.program && query.program !== ref.code) || (query.cohort && String(query.cohort) !== ref.cohort)) fail('invalid-selection', 'Program eller kull stemmer ikke med den valgte publiserte kilden.')
  const url = new URL(ref.url); if (!url.pathname.endsWith('/oppbygning')) url.pathname += '/oppbygning'
  const html = await cachedText(fetchText, url.href, validate)
  if (action === 'program-cohorts') { const results = parseOsloMetCohorts(html, url.href); return { status: 'ok', results, warnings: [], completeness: { complete: true, pages: 1, returned: results.length } } }
  if (action === 'program-plan') return parseOsloMetPlan(html, url.href)
  fail('not-supported', 'Denne handlingen støttes ikke av OsloMets programimport.')
}
