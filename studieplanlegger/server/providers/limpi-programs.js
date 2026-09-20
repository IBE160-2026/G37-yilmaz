import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'
import { readLdhPdf } from './ldh-pdf.js'

const origin = 'https://limpimusic.com', home = `${origin}/`, code = 'program'
const pageUrl = input => restrictedUrl(input, { origin, paths: [/^\/$/, /^\/program\/?$/] })
export const limpiPdfUrl = input => restrictedUrl(input, { origin, paths: [/^\/uploads\/[^/]+\.pdf$/i] })
export function parseLimpiPlan(pages, sourceUrl) {
  const lines = pages.flatMap(page => page.lines.map(clean).filter(Boolean).map(text => ({ text, page: page.page })))
  const edition = lines.find(line => /^20\d{2}\/20\d{2}$/.test(line.text))?.text, year = Number(edition?.split('/')[0])
  const nameAt = lines.findIndex(line => line.text === 'Name of study program'), name = lines[nameAt + 1]?.text
  if (!edition || Number(edition.split('/')[1]) !== year + 1 || nameAt < 0 || !name || !lines.some(line => /The program runs across two semesters/i.test(line.text))) fail('source-changed', 'LIMPI-planen mangler tydelig programnavn, studieår eller semesterbeskrivelse.')
  const periods = [], warnings = []; let active = null, optional = false
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index], heading = line.text.match(/^Semester (One|Two)\s*[–-]\s*(Fall|Spring)$/i)
    if (heading) {
      const number = heading[1] === 'One' ? 1 : 2, semester = heading[2] === 'Fall' ? 'autumn' : 'spring'
      if ((number === 1) !== (semester === 'autumn') || periods.some(p => p.studySemester === number)) fail('source-changed', 'LIMPI-planens semesteroverskrifter er ikke entydige.')
      active = { id: String(number), studySemester: number, year: semester === 'autumn' ? year : year + 1, semester, label: `${number}. studiesemester · ${semester === 'autumn' ? 'Høst' : 'Vår'} ${semester === 'autumn' ? year : year + 1}`, courses: [], requirements: [] }
      periods.push(active); optional = false; continue
    }
    if (!active) continue
    if (/^Plus one specialization course from the following:$/i.test(line.text)) { optional = true; active.requirements.push('Velg én av de publiserte spesialiseringene.'); continue }
    const row = line.text.match(/^[•●]\s*(.+?)\s*\(([A-Z0-9]{2,10})\),\s*(\d+(?:[.,]\d+)?)\s+credits$/)
    if (!row) { active = null; continue }
    const [, courseName, courseCode, points] = row, detail = lines.find(item => item.text.startsWith(`${courseCode}:`)), detailedName = detail?.text.slice(courseCode.length + 1).trim()
    const mismatch = detailedName && detailedName !== courseName && !/ Specialization$/.test(detailedName)
    const notes = `PDF-side ${line.page}: ${line.text}${mismatch ? ` Beskrivelsen på side ${detail.page} bruker navnet «${detailedName}». Avklar navneforskjellen; emnekoden og plasseringen beholdes fra semesterlisten.` : ''}`
    if (mismatch) warnings.push(`${courseCode}: semesterlisten og emnebeskrivelsen bruker ulike navn. Kontroller kildeutdraget.`)
    active.courses.push({ id: `limpi:${edition}:${courseCode}`, code: courseCode, name: courseName, credits: Number(points.replace(',', '.')), choice: optional ? 'V' : 'O', year: active.year, semester: active.semester,
      university: 'LIMPI', campus: '', description: '', notes, sourceProvider: 'limpi', sourceRecordId: courseCode, sourceVersion: edition, sourceUrl })
  }
  if (periods.length !== 2 || periods.some(p => !p.courses.length)) fail('source-changed', 'PDF-planen mangler en lesbar liste for begge semestre.')
  const describedCodes = [...new Set(lines.flatMap((line, index) => /^Course Responsible\s+Duration$/.test(lines[index + 1]?.text || '') ? line.text.match(/^([A-Z0-9]{2,10}):\s+.+$/)?.[1] || [] : []))]
  const all = periods.flatMap(p => p.courses), missing = describedCodes.filter(code => !all.some(c => c.code === code))
  if (missing.length) warnings.push(`Emnebeskrivelser uten semesterplassering: ${missing.join(', ')}. Kontroller disse i dokumentimport.`)
  return { status: 'ok', program: { code, name, cohort: String(year), sourceUrl, campuses: [] }, models: [{ id: edition, name: `Publisert studieplan ${edition}`, periods }],
    warnings: [...warnings, 'År og sesong er hentet fra den publiserte ettårsplanen. Spesialisering velges av studenten; ingen studiogruppe eller undervisningsdato er antatt.'],
    completeness: { complete: !missing.length, pages: pages.length, returned: all.length, scope: 'Den publiserte ettårsplanens semesterliste og navngitte spesialiseringer.' } }
}
async function plans(fetchText, fetchBytes, readPdf = readLdhPdf) {
  const $ = load(await cachedText(fetchText, home, pageUrl)), urls = new Set()
  $('a[href]').each((_, node) => { if (!/^Study Plan$/i.test(clean($(node).text()))) return; urls.add(limpiPdfUrl(new URL($(node).attr('href'), home)).href) })
  if (!urls.size || urls.size > 20) fail('source-changed', 'LIMPI-siden mangler et avgrenset sett med publiserte studieplanlenker.')
  const result = []
  for (const url of urls) result.push(parseLimpiPlan(await readPdf(fetchBytes, url, limpiPdfUrl), url))
  return result
}
export async function limpiPrograms(institution, action, query, { fetchText, fetchBytes, readPdf }) {
  if (institution !== 'limpi') fail('invalid-selection', 'Ukjent lærested.')
  const available = await plans(fetchText, fetchBytes, readPdf), first = available[0]
  if (action === 'programs') {
    const q = clean(query.q).toLocaleLowerCase('nb'), item = { code, name: first.program.name, sourceUrl: `${origin}/program`, campuses: [] }
    return { status: 'ok', results: !q || `${code} ${item.name}`.toLocaleLowerCase('nb').includes(q) ? [item] : [], completeness: { complete: true, pages: 1, returned: 1, scope: 'Studiet med offentlig lenket studieplan på LIMPI-nettstedet.' } }
  }
  if (query.program !== code) fail('invalid-selection', 'Velg programmet fra den offentlige listen.')
  if (action === 'program-cohorts') {
    if (pageUrl(query.sourceUrl).pathname.replace(/\/$/, '') !== '/program') fail('invalid-selection', 'Velg riktig programside.')
    return { status: 'ok', results: available.map(plan => ({ cohort: plan.program.cohort, label: plan.models[0].id, sourceUrl: plan.program.sourceUrl })), completeness: { complete: false, pages: 1, returned: available.length, reason: 'Kun PDF-versjoner lenket fra dagens offentlige nettsted; ikke et historisk kullarkiv.' } }
  }
  const selected = available.find(plan => plan.program.sourceUrl === limpiPdfUrl(query.sourceUrl).href && plan.program.cohort === String(query.cohort))
  if (action !== 'program-plan' || !selected) fail('invalid-selection', 'Kull og planlenke stemmer ikke med en publisert studieplan.')
  return selected
}
