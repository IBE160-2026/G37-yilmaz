import { createHash } from 'node:crypto'
import { load, clean, fail, restrictedUrl, cachedText } from './program-source.js'
import { studentCohort, unknownPeriod, sourceEdition } from './current-program-source.js'
import { readLdhPdf } from './ldh-pdf.js'

const origin = 'https://barnebokinstituttet.no', catalogue = `${origin}/utdanninger-og-kurs/`
const pagePath = /^\/utdanninger-og-kurs(?:\/[^/]+)?\/?$/
export const nbiProgramUrl = input => restrictedUrl(input, { origin, paths: [pagePath] })
export const nbiPdfUrl = input => restrictedUrl(input, { origin, paths: [/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+\.pdf$/i] })
const codeOf = url => new URL(url).pathname.split('/').filter(Boolean).at(-1)
export function parseNbiCatalogue(html) {
  const $ = load(html), result = new Map()
  $('a[href]').each((_, node) => {
    let url; try { url = nbiProgramUrl(new URL($(node).attr('href'), catalogue)) } catch { return }
    const code = codeOf(url), name = clean($(node).text())
    if (code === 'utdanninger-og-kurs' || !name || !/(?:masterstud|forfatterutdann|nettstud)/i.test(code)) return
    if (!result.has(code)) result.set(code, { code, name, sourceUrl: url.href, campuses: [] })
  })
  if (!result.size) fail('source-changed', 'NBI-katalogen mangler de publiserte programlenkene.')
  return [...result.values()]
}
function studySemesters(text) {
  const words = ['første', 'andre', 'tredje', 'fjerde', 'femte', 'sjette']
  const value = text.match(/((?:\d{1,2}\.?\s*(?:og|,|–|-)\s*)?\d{1,2}\.?|(?:første|andre|tredje|fjerde|femte|sjette)(?:\s+og\s+(?:første|andre|tredje|fjerde|femte|sjette))?)\s+semester/i)?.[1]
  if (!value) return []
  const numbers = [...value.matchAll(/\d{1,2}|første|andre|tredje|fjerde|femte|sjette/gi)].map(m => /^\d/.test(m[0]) ? +m[0] : words.indexOf(m[0].toLocaleLowerCase('nb')) + 1)
  if (numbers.some(n => n < 1 || n > 40)) fail('source-changed', 'NBI-planen oppgir et semester utenfor importgrensen.')
  if (/[–-]/.test(value) && numbers.length === 2) {
    if (numbers[1] < numbers[0]) fail('source-changed', 'Semesterintervallet i PDF-planen går baklengs.')
    return Array.from({ length: numbers[1] - numbers[0] + 1 }, (_, i) => numbers[0] + i)
  }
  return [...new Set(numbers)]
}
export function parseNbiPdfPlan(pages, query, program) {
  const cohort = studentCohort(query), lines = pages.flatMap(p => p.lines.map(clean).filter(t => t && !/^\d+$/.test(t)).map(text => ({ text, page: p.page }))), periods = new Map(), unplacedCourses = [], records = new Set()
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i], metadata = line.text.match(/^Emnet\s+(?:er\s+obligatorisk[\s\S]*?|gir\s+)(\d+(?:[.,]\d+)?)\s+studiepoeng\b/i)
    if (!metadata) continue
    const name = lines[i - 1].text
    if (name.length > 200 || /[.!?]$/.test(name) || /\.{3}/.test(name)) fail('source-changed', 'PDF-emnet mangler en entydig navneoverskrift.')
    const excerpt = /semester/i.test(line.text) ? line.text : `${line.text} ${lines[i + 1]?.text || ''}`
    const numbers = studySemesters(excerpt), record = `${program.code}:${createHash('sha256').update(name.normalize('NFKC').toLocaleLowerCase('nb')).digest('hex').slice(0, 20)}`
    if (records.has(record)) continue
    records.add(record)
    const course = { id: `nbi:${cohort}:${record}`, code: '', name, credits: Number(metadata[1].replace(',', '.')), choice: /obligatorisk/i.test(line.text) ? 'O' : '', year: null, semester: null, campus: '', university: 'Norsk barnebokinstitutt', description: '',
      notes: `PDF-side ${line.page}: ${name}. ${excerpt} Emnekode er ikke publisert. ${numbers.length > 1 ? 'Emnet går over flere semestre; studiepoeng gjelder hele emnet. ' : ''}Kalenderår og sesong er ikke oppgitt i denne emnebeskrivelsen.`,
      sourceProvider: 'nbi', sourceRecordId: record, sourceVersion: 'published-pdf', sourceUrl: query.sourceUrl, ...(numbers.length !== 1 ? { requiresSemesterChoice: true } : {}) }
    if (!numbers.length) { unplacedCourses.push(course); continue }
    for (const number of numbers) { const period = periods.get(number) || unknownPeriod(number); period.courses.push({ ...course }); periods.set(number, period) }
  }
  if (!records.size) fail('not-supported', 'PDF-planen beskriver studiet og moduler, men publiserer ingen støttede navngitte emner med studiepoeng og semesterfelt. Moduler uten navn eller emnekode er ikke funnet på. Bruk dokumentimport eller registrer arbeidet selv.')
  if (!periods.size) periods.set(0, { id: 'unplaced', studySemester: null, year: null, semester: null, requiresStudentStudySemester: true, label: 'Oppgi studiesemester for emneutvalget', courses: unplacedCourses.splice(0), requirements: [] })
  return { status: 'ok', program: { ...program, cohort, cohortFromStudent: true, sourceUrl: query.sourceUrl, sourceEdition: sourceEdition(JSON.stringify(pages)) },
    models: [{ id: 'published-pdf', name: 'Gjeldende publiserte PDF-plan', periods: [...periods.values()].sort((a, b) => a.studySemester - b.studySemester), unplacedCourses }],
    warnings: ['PDF-ens revisjonsdato bekrefter ikke ditt opptakskull. Kontroller at den publiserte planen gjelder deg; oppgi kull og kalendersemester selv.', 'Emner over flere semestre beholder hele emnets studiepoeng og krever ditt valg. Ingen presise undervisningsdatoer, grupper eller frister er hentet.', ...(unplacedCourses.length ? ['Emner uten klar semesterplassering må plasseres av studenten.'] : [])],
    completeness: { complete: !unplacedCourses.length, pages: pages.length, returned: records.size, scope: 'Navngitte PDF-emnebeskrivelser med eksplisitte studiepoeng og semesterfelt; ingen automatisk kullkobling.' } }
}
export async function nbiPrograms(institution, action, query, { fetchText, fetchBytes }) {
  if (institution !== 'nbi') fail('invalid-selection', 'Ukjent lærested.')
  const all = parseNbiCatalogue(await cachedText(fetchText, catalogue, nbiProgramUrl))
  if (action === 'programs') { const q = clean(query.q).toLocaleLowerCase('nb'); return { status: 'ok', results: all.filter(p => !q || `${p.code} ${p.name}`.toLocaleLowerCase('nb').includes(q)), completeness: { complete: true, pages: 1, returned: all.length, scope: 'Publiserte programlenker i utdanningsoversikten og dens programmeny. Katalogen bekrefter ikke lesbar emneplan for alle programmer.' } } }
  const program = all.find(p => p.code === query.program)
  if (!program) fail('invalid-selection', 'Velg et program fra NBI-katalogen.')
  const guard = input => { const url = nbiProgramUrl(input); if (url.href !== program.sourceUrl) fail('invalid-selection', 'Kilden videresendte til et annet NBI-program.'); return url }
  const $ = load(await cachedText(fetchText, program.sourceUrl, guard)), sources = new Map()
  $('a[href]').each((_, node) => { const label = clean($(node).text()); if (!/^Studieplan/i.test(label)) return; let url; try { url = nbiPdfUrl(new URL($(node).attr('href'), program.sourceUrl)) } catch { return }; sources.set(url.href, { cohort: 'student', label: `${label} · avklar opptakskull`, requiresStudentCohort: true, sourceUrl: url.href }) })
  if (!sources.size) fail('not-supported', 'Programmet har ingen offentlig lenket PDF-plan som importøren kan lese. Bruk dokumentimport eller manuell registrering.')
  if (action === 'program-cohorts') { if (guard(query.sourceUrl).href !== program.sourceUrl) fail('invalid-selection', 'Feil programside.'); return { status: 'ok', results: [...sources.values()], warnings: ['Dagens publiserte PDF-planer er ikke et komplett kullarkiv. Kull og kalendersemester må oppgis av studenten.'] } }
  if (action !== 'program-plan' || !sources.has(nbiPdfUrl(query.sourceUrl).href)) fail('invalid-selection', 'PDF-planen er ikke publisert under dette programmet.')
  return parseNbiPdfPlan(await readLdhPdf(fetchBytes, query.sourceUrl, nbiPdfUrl), query, { ...program, name: clean($('h1').first().text()) || program.name })
}
