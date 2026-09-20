import { load, clean, fail, cachedText, restrictedUrl, collectPages } from './program-source.js'
import { unknownPeriod, coursesFromLinks } from './current-program-source.js'
import { readLdhPdf, parseLdhPdfPlan } from './ldh-pdf.js'

const origin = 'https://ldh.no', catalogue = `${origin}/studietilbud`
export const ldhProgramUrl = input => restrictedUrl(input, { origin, paths: [/^\/studietilbud(?:\/[\p{L}\d_.%:-]+)*\/?$/u], keys: ['page'] })
function programRef(input) {
  const url = ldhProgramUrl(input), code = decodeURIComponent(url.pathname).replace(/^\/studietilbud\//, '').replace(/\/$/, '')
  if (url.search || !/^[\p{L}\d_-]+(?:\/[\p{L}\d_-]+){0,2}$/u.test(code)) fail('invalid-selection', 'Velg en offentlig LDH-programside fra katalogen.')
  return { url, code }
}
const cards = ($, current) => $('main a.Card[href]').map((_, link) => {
  const source = programRef(new URL($(link).attr('href'), current)), name = clean($(link).find('h2').first().text())
  return name ? { code: source.code, name, sourceUrl: source.url.href, campuses: [] } : null
}).get().filter(Boolean)
function pdfChoices($, sourceUrl) {
  const values = new Map()
  $('main a[href]').each((_, link) => {
    const label = clean($(link).text()), match = label.match(/(?:studieplan|fagplan).*?\b(20\d{2})\b/i)
    if (!match) return
    const url = ldhProgramUrl(new URL($(link).attr('href'), sourceUrl))
    if (!/\.pdf$/i.test(url.pathname)) return
    values.set(url.href, { cohort: match[1], label, sourceUrl: url.href, documentKind: 'pdf' })
  })
  return [...values.values()]
}
export function parseLdhHtmlPlan(html, { program, programName, sourceUrl, cohort }) {
  const $ = load(html), stated = clean($('main').text()).match(/(?:gjelder[^.]*?\bkull|emneoversikt for kull)\s+(20\d{2})/i)?.[1]
  if (stated !== String(cohort)) fail('invalid-selection', 'LDH-emneoversikten bekrefter ikke det valgte opptakskullet.')
  const source = ldhProgramUrl(sourceUrl), periods = new Map(), warnings = [], section = $('main .Table')
  if (!section.length) fail('source-changed', 'LDH-emneoversiktens tabellformat har endret seg.')
  let selected = [], context = ''
  section.children('p,table').each((_, element) => {
    if (element.tagName === 'p') {
      const text = clean($(element).text())
      if (!text) return
      const matches = [...text.matchAll(/\b(\d{1,2})\.\s*semester\b/gi)]
      if (matches.length && matches.map(match => match[0]).join('/').replace(/\s+/g, '') === text.replace(/\s+/g, '')) { selected = [...new Set(matches.map(match => +match[1]))]; context = text }
      else { selected = []; context = text }
      return
    }
    const parsed = coursesFromLinks($, element, { sourceUrl, courseUrl: input => { const url = ldhProgramUrl(input); if (!url.pathname.startsWith(`${source.pathname}/`) || url.search) fail('source-changed', 'LDH-emnelenken tilhører ikke valgt kulloversikt.'); return url }, institution: 'ldh', university: 'Lovisenberg diakonale høgskole', scope: `${program}:${cohort}`, number: selected.length === 1 ? selected[0] : 'clarify' })
    if (!selected.length && parsed.courses.length) fail('source-changed', 'Et emne i LDH-tabellen mangler en lesbar semesteroverskrift. Ingen semesterplassering er gjettet.')
    for (const number of selected) {
      if (number < 1 || number > 40) fail('source-changed', 'LDH-semesteret er utenfor importgrensen.')
      const period = periods.get(number) || unknownPeriod(number); periods.set(number, period)
      for (const course of parsed.courses) if (!period.courses.some(item => item.sourceRecordId === course.sourceRecordId)) period.courses.push({ ...course, ...(selected.length > 1 ? { requiresSemesterChoice: true } : {}), notes: `${course.notes} Kildens semesteroverskrift: ${context}.${selected.length > 1 ? ' Kilden fordeler ikke disse emnene entydig mellom semestrene. Velg bare emnene du faktisk følger i valgt semester.' : ''}` })
      if (selected.length > 1 && !period.requirements.includes(context)) period.requirements.push(context)
    }
    if (selected.length > 1) warnings.push(`${context}: emnene må fordeles av studenten; ingen automatisk semesterfordeling er gjort.`)
  })
  if (![...periods.values()].some(period => period.courses.length)) fail('not-supported', 'Ingen lesbare emner med studiesemester ble funnet i LDH-kulloversikten.')
  warnings.push('Kull og studiesemestre er hentet fra LDHs HTML-emneoversikt. Kalenderår og vår/høst er ikke oppgitt i denne tabellen og må avklares av studenten.', 'Studiepoeng og obligatorisk/valgfri status er ikke oppgitt i emneoversikten; ukjente verdier er beholdt. Undervisning og grupper hentes fra egne kilder.')
  return { status: 'ok', program: { code: program, name: programName, cohort: String(cohort), sourceUrl, campuses: [] }, models: [{ id: 'published', name: 'Publisert emneoversikt for kullet', periods: [...periods.values()].sort((a, b) => a.studySemester - b.studySemester) }], warnings: [...new Set(warnings)], completeness: { complete: true, pages: 1, returned: new Set([...periods.values()].flatMap(period => period.courses.map(course => course.sourceRecordId))).size, scope: 'Alle lenkede emner i den valgte HTML-kulloversikten; semesteralternativer bevares som valg.' } }
}
export async function ldhPrograms(institution, action, query, dependencies) {
  const { fetchText } = dependencies
  if (action === 'programs') {
    const $ = load(await cachedText(fetchText, catalogue, ldhProgramUrl)), all = new Map(), categories = [], warnings = []
    $('main a[href]').each((_, link) => {
      let source; try { source = programRef(new URL($(link).attr('href'), catalogue)) } catch { return }
      const name = clean($(link).text())
      if (source.code === 'masterstudier' || source.code === 'videreutdanninger') categories.push(source.url.href)
      else if (name && source.code !== 'kurs' && source.url.pathname !== '/studietilbud') all.set(source.url.href, { code: source.code, name, sourceUrl: source.url.href, campuses: [] })
    })
    let complete = true, pages = 1
    for (const url of [...new Set(categories)]) {
      try {
        const data = await collectPages(url, fetchText, ldhProgramUrl, ($, current) => ({ results: cards($, current) }))
        for (const result of data.results) all.set(result.sourceUrl, result)
        pages += data.completeness.pages; complete &&= data.completeness.complete; warnings.push(...data.warnings)
      } catch (error) { if (error.name === 'AbortError') throw error; complete = false; warnings.push(`Katalogdelen ${url} kunne ikke hentes: ${error.message}`) }
    }
    if (!all.size) fail('source-changed', 'LDH-katalogens programkort har endret format.')
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', results: [...all.values()].filter(item => !q || `${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q)), warnings: [...warnings, 'Gjeldende studietilbud. Velg publisert kull for det enkelte programmet; en programlenke bekrefter ikke støtte for PDF-planens emnetabell.'], completeness: { complete, pages, returned: all.size, scope: 'Bachelor-, master- og videreutdanningstilbud i LDHs offentlige katalog.' } }
  }
  const original = programRef(`${catalogue}/${query.program}`), source = ldhProgramUrl(query.sourceUrl || original.url.href), $ = load(await cachedText(fetchText, original.url.href, ldhProgramUrl)), name = clean($('h1').first().text())
  if (!name || query.program !== original.code) fail('invalid-selection', 'Velg et gyldig LDH-program.')
  const indices = $('main a[href]').map((_, link) => ({ label: clean($(link).text()), href: $(link).attr('href') })).get().filter(item => /emner|emneoversikt/i.test(item.label) && !item.href.startsWith('#'))
  const cohorts = [], pdfs = pdfChoices($, original.url.href)
  for (const item of [...new Map(indices.map(item => [item.href, item])).values()]) {
    const url = ldhProgramUrl(new URL(item.href, original.url))
    if (!url.pathname.startsWith(`${original.url.pathname}/`) || url.search) continue
    const index = load(await cachedText(fetchText, url.href, ldhProgramUrl))
    index('main a.Card[href]').each((_, link) => {
      const year = clean(index(link).text()).match(/\bkull\s+(20\d{2})\b/i)?.[1], linked = ldhProgramUrl(new URL(index(link).attr('href'), url))
      if (year && linked.pathname.startsWith(`${url.pathname}/`)) cohorts.push({ cohort: year, label: `${clean(index(link).find('h2').text())} · kull ${year}`, sourceUrl: linked.href })
    })
  }
  const unique = [...new Map(cohorts.map(item => [item.sourceUrl, item])).values()]
  if (action === 'program-cohorts') {
    const results = [...unique, ...pdfs.filter(item => !unique.some(other => other.cohort === item.cohort))]
    return { status: 'ok', results, warnings: results.length ? ['Bare kullutgaver som programmet selv lenker til vises. HTML-emneoversikt og PDF-plan er forskjellige kildekontrakter.'] : ['Ingen offentlig kulloversikt er funnet på denne programsiden. Bruk dokumentimport eller registrer emnene fra kilden.'], completeness: { complete: true, pages: 1 + indices.length, returned: results.length, scope: 'Kulloversikter og PDF-utgaver lenket fra valgt programside.' } }
  }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke av LDH-programkilden.')
  const selected = unique.find(item => item.sourceUrl === source.href && item.cohort === String(query.cohort))
  if (selected) return parseLdhHtmlPlan(await cachedText(fetchText, source.href, ldhProgramUrl), { program: original.code, programName: name, sourceUrl: source.href, cohort: selected.cohort })
  if (pdfs.some(item => item.sourceUrl === source.href && item.cohort === String(query.cohort))) return parseLdhPdfPlan(await readLdhPdf(dependencies.fetchBytes, source.href, ldhProgramUrl), { program: original.code, programName: name, sourceUrl: source.href, cohort: String(query.cohort) })
  fail('invalid-selection', 'Kildelenken og opptakskullet er ikke lenket fra det valgte LDH-programmet.')
}
