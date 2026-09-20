import { load, clean, fail, restrictedUrl, cachedText, asCredits } from './program-source.js'
import { readPublicPdfItems } from './public-pdf-text.js'
import { krusPdfUrl, krusPdfVersions, parseKrusPdfPlan } from './krus-pdf.js'

const origin = 'https://www.krus.no', catalogue = `${origin}/for-aspiranter-og-studenter`
const programPath = /^\/for-aspiranter-og-studenter\/(aspirant-(?:heltidsutdanningen|deltidsutdanningen)|student-bachelorpabygg-og-enkeltemner)\/?$/
export const krusProgramUrl = input => restrictedUrl(input, { origin, paths: [programPath, /^\/for-aspiranter-og-studenter\/?$/] })
const courseUrl = input => restrictedUrl(input, { origin, paths: [/^\/artikler\/\d{4}-\d{4}\/\d{4}-\d{2}-\d{2}-krus\d+[a-z]?-[a-z\d-]+\/?$/, /^\/foreldrelose-sider\/emner-og-pensum\/krus\d+[a-z]?\/?$/] })
function reference(input) {
  const url = krusProgramUrl(input), code = url.pathname.match(programPath)?.[1]
  if (!code) fail('invalid-selection', 'Velg en publisert KRUS-studieoversikt.')
  return { url, code }
}
export function parseKrusCatalogue(html) {
  const $ = load(html), results = new Map()
  $('a[href]').each((_, link) => {
    const url = new URL($(link).attr('href'), catalogue)
    if (url.origin !== origin || !programPath.test(url.pathname)) return
    const source = reference(url), name = clean($(link).text())
    if (name) results.set(source.code, { code: source.code, name, sourceUrl: source.url.href, campuses: [] })
  })
  if (!results.size) fail('source-changed', 'KRUS-siden mangler de publiserte studieoversiktene.')
  return [...results.values()]
}
function semesters(title) {
  const words = ['første', 'andre', 'tredje', 'fjerde', 'femte', 'sjette']
  const text = clean(title).toLocaleLowerCase('nb')
  const word = words.findIndex(value => text === `${value} semester`)
  if (word >= 0) return [word + 1]
  const match = text.match(/^(\d+)\.?(?:\s+og\s+(\d+)\.?)?\s*semester$/)
  if (!match) return []
  const result = [Number(match[1]), ...(match[2] ? [Number(match[2])] : [])]
  if (result.some(value => value < 1 || value > 40)) fail('source-changed', 'Studiesemesteret er utenfor den støttede grensen.')
  return result
}
export function parseKrusPlan(html, query) {
  const source = reference(query.sourceUrl)
  if (source.code !== query.program) fail('invalid-selection', 'Programmet stemmer ikke med kildelenken.')
  if (query.cohortFromStudent !== 'true' || !/^\d{4}$/.test(String(query.cohort)) || +query.cohort < 1900 || +query.cohort > 2200) fail('invalid-selection', 'Oppgi ditt kull uttrykkelig. HTML-oversikten er ikke en verifisert kullplan.')
  const $ = load(html); $('script,style').remove()
  const heading = $('h2').filter((_, node) => clean($(node).text()) === 'Emneoversikt').first()
  const content = heading.parent().find('.sv-text-portlet-content').first(), name = clean($('h1').first().text())
  if (!content.length || !name) fail('source-changed', 'KRUS har ingen lesbar emneoversikt i det forventede formatet.')
  const periods = new Map(); let active = [], optional = false
  for (const node of content.children().toArray()) {
    const element = $(node), text = clean(element.text())
    if (/^h[1-6]$/.test(node.tagName)) {
      const selected = semesters(text)
      active = selected.map(number => {
        if (!periods.has(number)) periods.set(number, { id: String(number), studySemester: number, label: `${number}. studiesemester · avklar kalendersemester`, year: null, semester: null, courses: [], requirements: [] })
        const period = periods.get(number)
        if (selected.length > 1) period.requirements.push(`Kilden samler ${text}. Studiepoeng gjelder hele emnet; kontroller hvilke aktiviteter som gjelder semesteret ditt.`)
        return period
      }); optional = false; continue
    }
    if (!active.length || !text) continue
    const rows = element.is('ul,ol') ? element.children('li').toArray() : [node]
    for (const row of rows) {
      const value = $(row), line = clean(value.text())
      if (/velger\s+(?:et|ett)\s+av.*valgfrie/i.test(line)) optional = true
      const matches = [...line.matchAll(/\b(KRUS\d+[A-Z]?)\s+(.+?)(?=\bKRUS\d+[A-Z]?\b|$)/g)]
      if (!matches.length) { for (const p of active) p.requirements.push(line); continue }
      for (const match of matches) {
        const code = match[1], points = match[2].match(/\s+(\d+(?:[.,]\d+)?)\s*(?:stp|sp)\.?\s*$/i)
        const courseName = clean(match[2].replace(/\s+(?:og\/eller|eller)\s*$/, '').replace(/\s+\d+(?:[.,]\d+)?\s*(?:stp|sp)\.?\s*$/i, ''))
        const link = value.find('a[href]').filter((_, anchor) => clean($(anchor).text()).startsWith(`${code} `)).first()
        const url = link.length ? courseUrl(new URL(link.attr('href'), source.url)).href : source.url.href
        for (const p of active) if (!p.courses.some(c => c.code === code)) p.courses.push({ id: `krus:${source.code}:${p.studySemester}:${code}`, code, name: courseName, credits: points ? asCredits(points[1]) : null,
          choice: optional || /\beller\b/i.test(line) ? 'V' : '', year: null, semester: null, campus: '', university: 'KRUS', description: '',
          notes: `Kildeutdrag: ${line}${active.length > 1 ? ' Emnet står samlet i flere semestre; studiepoengene gjelder hele emnet.' : ''}`,
          sourceProvider: 'krus', sourceRecordId: code, sourceVersion: 'published-html', sourceUrl: url })
      }
    }
  }
  if (![...periods.values()].some(p => p.courses.length)) fail('source-changed', 'Emneoversikten mangler lesbare KRUS-emner og semestre.')
  const documents = $('a[href]').filter((_, node) => /^Studieplan/.test(clean($(node).text()))).map((_, node) => clean($(node).text())).get()
  return { status: 'ok', program: { code: source.code, name, cohort: String(query.cohort), cohortFromStudent: true, sourceUrl: source.url.href, campuses: [] },
    models: [{ id: 'published-html', name: 'Gjeldende offentlig emneoversikt', periods: [...periods.values()] }],
    warnings: ['Emnene er hentet fra dagens HTML-oversikt. Kull og kalendersemester avklares av studenten; innholdet er ikke verifisert mot en historisk kullplan.', `Publiserte planversjoner finnes på kildesiden: ${documents.join('; ') || 'Ingen datert planlenke identifisert'}. PDF-versjonene er separate fra denne HTML-importen.`, 'Den personlige Canvas-timeplanen krever innlogging ifølge kildesiden. Siden lenker også en offentlig TimeEdit-inngang for emnesøk; denne svarte HTTP 412 ved kontroll 12.09.2026, uten bekreftet årsak. Ingen personlig undervisning eller gruppetilhørighet er hentet.'],
    completeness: { complete: false, pages: 1, returned: [...periods.values()].reduce((n, p) => n + p.courses.length, 0), reason: 'HTML-emneoversikten har ikke kullvelger, kalenderperioder eller full metadata for alle emnene.' } }
}
export async function krusPrograms(institution, action, query, { fetchText, fetchBytes }) {
  if (institution !== 'krus') fail('invalid-selection', 'Ukjent lærested.')
  if (action === 'programs') {
    const all = parseKrusCatalogue(await cachedText(fetchText, catalogue, krusProgramUrl)), q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', results: all.filter(p => !q || `${p.code} ${p.name}`.toLocaleLowerCase('nb').includes(q)), completeness: { complete: true, pages: 1, returned: all.length }, warnings: ['Katalogen viser lærestedets offentlige emneoversikter, som ikke i seg selv bekrefter en kullspesifikk plan.'] }
  }
  if (action === 'program-plan' && new URL(query.sourceUrl).pathname.startsWith('/download/')) {
    const pdfUrl = krusPdfUrl(query.sourceUrl).href, base = reference(`${catalogue}/${query.program}`), html = await cachedText(fetchText, base.url.href, krusProgramUrl)
    const version = krusPdfVersions(html, base.url.href).find(version => version.sourceUrl === pdfUrl)
    if (!version) fail('invalid-selection', 'PDF-en er ikke en publisert planversjon for det valgte KRUS-programmet.')
    return parseKrusPdfPlan(await readPublicPdfItems(fetchBytes, pdfUrl, krusPdfUrl), query, version, clean(load(html)('h1').first().text()))
  }
  const source = reference(query.sourceUrl)
  if (source.code !== query.program) fail('invalid-selection', 'Programmet stemmer ikke med kildelenken.')
  if (action === 'program-cohorts') {
    const html = await cachedText(fetchText, source.url.href, krusProgramUrl), versions = krusPdfVersions(html, source.url.href)
    return { status: 'ok', results: [...versions, { cohort: 'student', label: 'Dagens HTML-oversikt · avklar ditt opptakskull', requiresStudentCohort: true, sourceUrl: source.url.href }], warnings: ['Velg publisert PDF-kull eller gyldighetsutgave når den passer. Dagens HTML-oversikt er et separat alternativ og er ikke bekreftet mot eldre kull.'] }
  }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke.')
  const guard = input => { const next = reference(input); if (next.code !== source.code) fail('source-changed', 'Kilden videresendte til en annen studieoversikt.'); return next.url }
  return parseKrusPlan(await cachedText(fetchText, source.url.href, guard), query)
}
