import { load, clean, fail, cachedText, restrictedUrl, asCredits, periodLabel } from './program-source.js'

const origin = 'https://www.nmbu.no'
const catalogue = `${origin}/api/search/all/study_program?q=&locale=nb`
const validate = input => restrictedUrl(input, { origin, paths: [/^\/api\/search\/all\/study_program$/, /^\/(?:studier|fakulteter|en\/studies)\/[\p{L}\d%/_-]+$/u, /^\/node\/\d+$/, /^\/(?:emne|en\/course)\/[A-Za-z\d_-]+$/], keys: ['q', 'locale'] })
const pageUrl = input => { const url = validate(input); if (url.search || url.pathname.startsWith('/api/')) fail('invalid-selection', 'Velg en publisert NMBU-programside.'); return url }
const htmlText = input => clean(load(input || '').text())
const resource = html => { const $ = load(html); let value; try { value = JSON.parse($('#__NEXT_DATA__').text()).props.pageProps.resource } catch { fail('source-changed', 'NMBU-siden mangler det publiserte sideformatet.') } return value }

export function parseNmbuCatalogue(text) {
  let data; try { data = JSON.parse(text) } catch { fail('source-changed', 'NMBUs programliste er ikke lesbar.') }
  if (!Array.isArray(data.data) || !Number.isSafeInteger(data.count) || data.count < 0 || data.data.length > 5000) fail('source-changed', 'NMBUs offentlige programliste har endret format.')
  const results = new Map()
  for (const item of data.data) {
    const attributes = item.attributes, code = String(attributes?.drupal_internal__nid || '')
    if (item.type !== 'node--study_program' || !/^\d+$/.test(code) || !clean(attributes.title) || !attributes.path?.alias) fail('source-changed', 'NMBUs programliste inneholder en ufullstendig oppføring.')
    const source = pageUrl(new URL(attributes.path.alias, origin))
    results.set(code, { code, name: clean(attributes.title), sourceUrl: source.href, campuses: [] })
  }
  return { results: [...results.values()], completeness: { complete: results.size === data.count, pages: 1, returned: results.size, total: data.count, ...(results.size !== data.count ? { reason: 'Den offentlige all-listen returnerte færre unike program enn oppgitt antall. Ingen skjult paginering er gjettet.' } : {}) } }
}

function statedIntake(html) {
  const $ = load(html), texts = $('main h1, main .wp-block-nmbu-page-lead-text, main p').map((_, node) => clean($(node).text())).get()
  for (const text of texts) {
    const match = text.match(/(?:gjelder\s+for\s+(?:studenter\s+med\s+)?|studieløp\s+for\s+)?oppstart\s+(høsten?|våren?)\s+(\d{4})/i)
    if (match) return { cohort: match[2], semester: /^vår/i.test(match[1]) ? 'spring' : 'autumn' }
  }
  return null
}

async function programContext(query, fetchText) {
  if (!/^\d+$/.test(query.program || '')) fail('invalid-selection', 'Velg program fra NMBUs offentlige liste.')
  const list = parseNmbuCatalogue(await cachedText(fetchText, catalogue, validate)), program = list.results.find(row => row.code === query.program)
  if (!program) fail('invalid-selection', 'Programmet finnes ikke i NMBUs publiserte programliste.')
  const html = await cachedText(fetchText, program.sourceUrl, validate), data = resource(html)
  if (String(data.drupal_internal__nid) !== query.program || data.type !== 'node--study_program') fail('source-changed', 'NMBU returnerte en annen programside enn den valgte.')
  const campus = htmlText(data.field_flexible?.processed || data.field_flexible?.value)
  if (campus && /studiested/i.test(data.field_flexible?.summary || '')) program.campuses = [campus]
  const $ = load(html), links = new Set()
  // Follow the explicit programme-structure field, never marketing/recommendation links.
  const structure = load(data.field_program_structure?.value || data.field_program_structure?.processed || '')
  structure('a[href]').each((_, a) => { try { links.add(pageUrl(new URL(structure(a).attr('href'), program.sourceUrl)).href) } catch {} })
  if (!links.size) $('#program-structure a[href]').each((_, a) => { if (/studieplan|oppbygg|oppbygning/i.test(clean($(a).text()))) { try { links.add(pageUrl(new URL($(a).attr('href'), program.sourceUrl)).href) } catch {} } })
  if (!links.size && $('main h2,main h3').toArray().some(node => /^År\s+\d+$/.test(clean($(node).text())))) links.add(program.sourceUrl)
  if (links.size > 15) fail('not-supported', 'NMBU-programmet publiserer flere planlenker enn importgrensen. Velg dokumentimport fra den aktuelle studieplanen.')
  const cohorts = [], warnings = [], add = (url, intake) => { if (!cohorts.some(row => row.sourceUrl === url)) cohorts.push({ cohort: intake.cohort, label: `${intake.semester === 'spring' ? 'Vår' : 'Høst'} ${intake.cohort}`, sourceUrl: url }) }
  for (const url of links) {
    let planHtml
    try { planHtml = await cachedText(fetchText, url, validate) } catch (error) { if (error.name === 'AbortError') throw error; warnings.push(`Planlenken kunne ikke hentes: ${error.message}`); continue }
    const intake = statedIntake(planHtml), plan = load(planHtml)
    if (intake) add(url, intake)
    const direct = [], archives = new Set()
    plan('main a[href]').each((_, a) => {
      const text = clean(plan(a).text()), year = text.match(/^(?:Oppstart|Kull|Studieplan(?:\s+for)?)\s+(?:(høst|vår)\s+)?(\d{4})$/i)
      if (!year && !/^(?:Se\s+)?(?:studieplan(?:er)?\s+for\s+)?tidligere\s+kull(?:\s+her\.?)?\.?$/i.test(text)) return
      try { const target = pageUrl(new URL(plan(a).attr('href'), url)); if (year) direct.push({ url: target.href, cohort: year[2], semester: year[1] ? /^vår$/i.test(year[1]) ? 'spring' : 'autumn' : null }); else archives.add(target.href) } catch {}
    })
    for (const row of direct) if (!cohorts.some(c => c.sourceUrl === row.url)) cohorts.push({ cohort: row.cohort, label: `Kull ${row.cohort}${row.semester ? ` · ${row.semester === 'spring' ? 'vår' : 'høst'}` : ''}`, sourceUrl: row.url })
    if (archives.size > 4) { warnings.push('Mer enn fire lenkede kullarkiver; flere kull kan finnes i kilden.'); continue }
    for (const archiveUrl of archives) {
      try {
        const archive = load(await cachedText(fetchText, archiveUrl, validate))
        archive('main a[href]').each((_, a) => {
          const year = clean(archive(a).text()).match(/^(?:Oppstart|Kull|Studieplan(?:\s+for)?)\s+(?:(høst|vår)\s+)?(\d{4})$/i)
          if (!year) return
          try { const target = pageUrl(new URL(archive(a).attr('href'), archiveUrl)); if (!cohorts.some(row => row.sourceUrl === target.href)) cohorts.push({ cohort: year[2], label: `Kull ${year[2]}`, sourceUrl: target.href }) } catch {}
        })
      } catch (error) { if (error.name === 'AbortError') throw error; warnings.push(`Kullarkivet kunne ikke hentes: ${error.message}`) }
    }
  }
  return { program, cohorts, warnings }
}

export function parseNmbuPlan(html, { program, cohort, sourceUrl }) {
  const $ = load(html), intake = statedIntake(html)
  if (!intake || intake.cohort !== String(cohort)) fail('not-supported', 'Den valgte NMBU-planen bekrefter ikke oppstartstermin og kull. Ingen årstall er gjettet. Bruk dokumentimport eller registrer emnene fra planen.')
  const content = $('#article-content').length ? $('#article-content') : $('main'), periods = new Map(), warnings = [], requirements = []
  let studyYear = null, semester = null, choice = '', block = '', scoped = false, conditional = false
  // Current rendered content is authoritative: the legacy JSON body can hold an obsolete table.
  for (const node of content.find('h2,h3,h4,h5,p,li').toArray()) {
    const row = $(node), text = clean(row.text()), heading = /^h[2-5]$/.test(node.tagName)
    if (heading) {
      const year = text.match(/^(?:År\s+(\d{1,2})|(\d{1,2})\.?\s*(?:studie)?år)$/i)
      if (year) { studyYear = Number(year[1] || year[2]); semester = null; conditional = false; if (studyYear > 20) fail('source-changed', 'NMBU-planen har studieår utenfor importgrensen.'); continue }
      if (/^Obligatoriske emner$/i.test(text)) { choice = 'O'; scoped = true; continue }
      if (/^(Valgfrie emner|Valgemner)$/i.test(text)) { choice = 'V'; scoped = false; semester = null; continue }
      if (/^(Augustblokk|Høstparallell|Høstsemester|Høst)$/i.test(text)) { semester = 'autumn'; block = text; conditional = false; continue }
      if (/^(Januarblokk|Vårparallell|Vårsemester|Vår|Juniblokk)$/i.test(text)) { semester = 'spring'; block = text; conditional = false; continue }
      if (/^Utveksling|^Innpassing|^Spesialisering/i.test(text)) { scoped = false; semester = null }
      continue
    }
    if (!text || row.parents('p,li').length) continue
    if (!scoped || !studyYear || !semester) { if (/valgfrie|valgemner|studiepoeng|utveksling/i.test(text)) requirements.push(text); continue }
    const offset = intake.semester === 'autumn' ? semester === 'spring' ? 1 : 0 : semester === 'autumn' ? 1 : 0
    const number = (studyYear - 1) * 2 + offset + 1
    const year = Number(cohort) + studyYear - 1 + (intake.semester === 'autumn' && semester === 'spring' ? 1 : 0)
    let period = periods.get(number)
    if (!period) { period = { id: String(number), studySemester: number, year, semester, label: periodLabel(number, { year, semester }), courses: [], requirements: [] }; periods.set(number, period) }
    if (/mobilitetssemester|utveksling|kan erstattes|\beller\b/i.test(text)) conditional = true
    let recognized = false
    row.find('a[href]').each((_, a) => {
      const title = clean($(a).text()).replace(/^\+\s*/, ''), match = title.match(/^([A-ZÆØÅ][A-ZÆØÅ\d_-]*\d[A-ZÆØÅ\d_-]*)\s+(.+)$/u)
      if (!match) return
      let url; try { url = pageUrl(new URL($(a).attr('href'), sourceUrl)) } catch { return }
      if (!/^\/(?:emne|en\/course|node)\//.test(url.pathname)) return
      const code = match[1], creditText = title.match(/\((\d+(?:[.,]\d+)?)\)\s*$/)?.[1] || ($(a).parent().find('a').length === 1 ? text.match(/\((\d+(?:[.,]\d+)?)\)\s*$/)?.[1] : null)
      const name = clean(match[2].replace(/\s*\(\d+(?:[.,]\d+)?\)\s*$/, ''))
      if (!period.courses.some(course => course.code === code)) period.courses.push({ id: `nmbu-program:${program.code}:${cohort}:${number}:${code}`, code, name, credits: asCredits(creditText), choice: conditional ? '' : choice, sourceProvider: 'nmbu-program', sourceRecordId: code, sourceVersion: String(cohort), sourceUrl: url.href, university: 'NMBU', description: '', notes: `${block}. Utdrag fra publisert studieplan: ${text}`, year, semester, campus: '' })
      recognized = true
    })
    if (!recognized || conditional) period.requirements.push(text)
  }
  const usable = [...periods.values()].sort((a, b) => a.studySemester - b.studySemester)
  if (!usable.some(period => period.courses.length)) fail('not-supported', 'Denne NMBU-planen har ikke støttet oppbygging med studieår, semesterblokker og emnelenker. Program og kull er funnet; bruk dokumentimport fra studieplanen.')
  for (const period of usable) period.requirements = [...new Set([...period.requirements, ...requirements])]
  warnings.push('Kull og kalendersemestre følger planens uttrykkelige oppstartstermin og nummererte studieår. Kontroller eventuelle mobilitets- og valgregler i kildeutdragene.', 'Planen publiserer ikke alle mulige valgemner, undervisningstider eller personlig gruppetilhørighet. Bruk separat emnesøk og kalenderimport ved behov.')
  return { status: 'ok', program: { ...program, cohort: String(cohort), sourceUrl }, models: [{ id: 'published', name: 'Publisert studieløp', periods: usable }], warnings, completeness: { complete: false, pages: 1, returned: usable.reduce((n, period) => n + period.courses.length, 0), reason: 'Navngitte emner i den publiserte strukturen er lest. Åpne valgemnekrav er ikke en komplett valgemneliste.' } }
}

export async function nmbuPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const data = parseNmbuCatalogue(await cachedText(fetchText, catalogue, validate)), q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', ...data, results: data.results.filter(row => !q || `${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(q)), warnings: ['NMBUs nåværende offentlige programliste. Tallet foran navnet er kildens programidentifikator; listen angir ikke opptakskull. Velg et publisert kull i neste steg.'] }
  }
  const source = pageUrl(query.sourceUrl), context = await programContext(query, fetchText)
  if (action === 'program-cohorts') {
    if (source.href !== context.program.sourceUrl) fail('invalid-selection', 'Programmet og NMBU-kildelenken stemmer ikke overens.')
    if (!context.cohorts.length) fail('not-supported', 'NMBU-programmet har ingen lesbare, uttrykkelig daterte kullplaner i denne kontrakten. Bruk den publiserte programstrukturen eller dokumentimport.')
    return { status: 'ok', results: context.cohorts, warnings: context.warnings, completeness: { complete: false, pages: 1, returned: context.cohorts.length, reason: 'Kun daterte kull i programmets lenkede plan og arkiv; dette er ikke et fullstendig institusjonelt kullarkiv.' } }
  }
  if (action !== 'program-plan') fail('not-supported', 'NMBU-programkilden støtter ikke handlingen.')
  if (!context.cohorts.some(row => row.sourceUrl === source.href && row.cohort === String(query.cohort))) fail('invalid-selection', 'Det valgte kullet er ikke publisert som en planlenke for NMBU-programmet.')
  const data = parseNmbuPlan(await cachedText(fetchText, source.href, validate), { program: context.program, cohort: query.cohort, sourceUrl: source.href })
  data.warnings.unshift(...context.warnings)
  return data
}
