import { clean, fail } from './program-source.js'
import { unknownPeriod, sourceEdition } from './current-program-source.js'

const caches = new WeakMap(), codePattern = /\b([A-ZÆØÅ]{2,10}-\d{3,4}[A-Z]?)\b/
export function ldhPdfPage(items, page) {
  const useful = items.filter(item => typeof item.str === 'string' && (page === 1 || item.transform[5] >= 60))
  const lines = []; let line = '', y = null
  for (const item of useful) {
    if (y !== null && Math.abs(item.transform[5] - y) > 2) { lines.push(line); line = '' }
    line += `${line ? ' ' : ''}${item.str}`; y = item.transform[5]
    if (item.hasEOL) { lines.push(line); line = ''; y = null }
  }
  if (line) lines.push(line)
  // Only compare an explicitly labelled table. Column positions distinguish a
  // semester number from credits or weeks of practice in the neighbouring cells.
  const tableRows = [], header = useful.findIndex(item => clean(item.str) === 'Semester')
  if (header >= 0) {
    const semesterX = useful[header].transform[4], courseHeader = useful.slice(header + 1, header + 6).find(item => /Emnets kode/.test(item.str))
    if (courseHeader) {
      let semester = null
      for (const item of useful.slice(header + 1)) {
        const text = clean(item.str), x = item.transform[4]
        if (Math.abs(x - semesterX) < 3 && /^\d{1,2}$/.test(text)) { semester = +text; continue }
        if (semester && Math.abs(x - semesterX) < 3 && text && !/^\d{1,2}$/.test(text)) break
        const code = text.match(codePattern)?.[1]
        if (semester && semester <= 40 && code && Math.abs(x - courseHeader.transform[4]) < 3) tableRows.push({ code, semester, excerpt: text })
      }
    }
  }
  return { page, lines, tableRows }
}
export async function readLdhPdf(fetchBytes, sourceUrl, validateUrl) {
  if (typeof fetchBytes !== 'function') fail('not-supported', 'Offentlig PDF-henting er ikke tilgjengelig i denne lokale kjøringen.')
  validateUrl(sourceUrl); fetchBytes.signal?.throwIfAborted()
  const key = fetchBytes.cacheKey || fetchBytes
  let cache = caches.get(key); if (!cache) { cache = new Map(); caches.set(key, cache) }
  const entry = cache.get(sourceUrl)
  if (entry && Date.now() - entry.time < 600000) return entry.pages
  const bytes = await fetchBytes(sourceUrl, 0, validateUrl, { maxBytes: 10_000_000 })
  if (bytes.length > 10_000_000 || !Buffer.from(bytes).subarray(0, 5).equals(Buffer.from('%PDF-'))) fail('source-changed', 'Kilden svarte ikke med en støttet PDF innen grensen på 10 MB.')
  let loading
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true })
    const document = await loading.promise, pages = []
    if (document.numPages > 200) fail('not-supported', 'PDF-planen har over 200 sider. Bruk et relevant utdrag i dokumentimport.')
    let characters = 0
    for (let page = 1; page <= document.numPages; page++) {
      fetchBytes.signal?.throwIfAborted()
      const source = await document.getPage(page), text = await source.getTextContent(), parsed = ldhPdfPage(text.items, page)
      characters += parsed.lines.join('').length
      if (characters > 1_000_000) fail('not-supported', 'PDF-teksten overstiger importgrensen. Bruk et relevant utdrag i dokumentimport.')
      pages.push(parsed); source.cleanup()
    }
    if (characters < 100) fail('not-supported', 'PDF-planen er skannet eller mangler lesbar tekst. Lim inn teksten eller bruk manuell registrering.')
    if (cache.size >= 12) cache.delete(cache.keys().next().value)
    cache.set(sourceUrl, { time: Date.now(), pages }); return pages
  } catch (error) {
    if (error.status || error.name === 'AbortError') throw error
    fail('source-changed', 'PDF-planen kunne ikke leses lokalt. Bruk dokumentimport eller lim inn teksten fra planen.')
  } finally { await loading?.destroy() }
}
export function parseLdhPdfPlan(pages, { program, programName, sourceUrl, cohort }) {
  const cover = pages[0]?.lines.map(clean).find(line => /^Kull\s+[HV]?(20\d{2})$/i.test(line))
  if (cover?.match(/20\d{2}/)?.[0] !== String(cohort)) fail('invalid-selection', 'PDF-forsiden bekrefter ikke valgt opptakskull. Ingen kull er gjettet.')
  const lines = pages.flatMap(page => page.lines.map(clean).filter(Boolean).map(text => ({ text, page: page.page }))), periods = new Map(), unplacedCourses = [], courses = new Map(), warnings = []
  const optionalStart = lines.findIndex(line => /^Vedlegg til studieplan\s*[–—-]\s*selvvalgte emner$/i.test(line.text))
  const edition = sourceEdition(JSON.stringify(pages))
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].text.match(/^(?:Modul\s+)?([A-ZÆØÅ]{2,10}-\d{3,4}[A-Z]?):\s*(.+)$/)
    if (!heading || /\.{3}/.test(lines[index].text)) continue
    const block = []
    for (const line of lines.slice(index + 1, index + 22)) {
      if (/^(?:Modul\s+)?[A-ZÆØÅ]{2,10}-\d{3,4}[A-Z]?:/.test(line.text) || /^Hensikten med emnet/.test(line.text)) break
      block.push(line.text)
    }
    const english = block.findIndex(line => /^Engelsk emnenavn:/.test(line)), credits = block.find(line => /^Studiepoeng:/.test(line))?.match(/^Studiepoeng:\s*(\d+(?:[.,]\d+)?)(?:\s|$)/), semesterText = block.find(line => /^Semester:/.test(line))?.replace(/^Semester:\s*/, '')
    if (english < 0 || !credits || !semesterText) continue
    const numbers = /^\d{1,2}(?:\s*(?:og|,|\/)\s*\d{1,2})*$/.test(semesterText) ? [...new Set(semesterText.match(/\d+/g).map(Number))] : []
    if (numbers.some(number => number < 1 || number > 40)) fail('source-changed', 'PDF-planen oppgir et studiesemester utenfor importgrensen.')
    const code = heading[1], name = clean([heading[2], ...block.slice(0, english)].join(' ')), excerpt = `${code}: ${name}. ${block.slice(english).join(' ')}`
    const table = pages.flatMap(page => (page.tableRows || []).filter(row => row.code === code).map(row => ({ ...row, page: page.page }))), conflict = numbers.length && table.some(row => !numbers.includes(row.semester))
    const course = { id: `ldh:${program}:${cohort}:${code}`, code, name, university: 'Lovisenberg diakonale høgskole', credits: Number(credits[1].replace(',', '.')), description: '', notes: `PDF-side ${lines[index].page}: ${excerpt}${conflict ? ` Motstrid i kilden: studiemodellen oppgir ${table.map(row => `${row.semester}. semester på side ${row.page}`).join(', ')}. Avklar faktisk semester før valg.` : ''}`, sourceProvider: 'ldh', sourceRecordId: `${program}:${code}`, sourceVersion: `cohort:${cohort}`, sourceUrl, year: null, semester: null, campus: '', choice: optionalStart >= 0 && index > optionalStart ? 'V' : '', ...(numbers.length !== 1 || conflict ? { requiresSemesterChoice: true } : {}) }
    if (courses.has(code)) { if (JSON.stringify(courses.get(code).numbers) !== JSON.stringify(numbers)) fail('source-changed', `PDF-planen har flere uforenlige emnebeskrivelser for ${code}.`); continue }
    courses.set(code, { course, numbers })
    if (conflict || !numbers.length) { unplacedCourses.push(course); warnings.push(`${code}: ${conflict ? 'studiemodell og emnebeskrivelse oppgir ulike semestre' : 'semesterfeltet er ikke entydig'}. Emnet tilbys bare som et uavklart valg.`); continue }
    for (const number of numbers) { const period = periods.get(number) || unknownPeriod(number); periods.set(number, period); period.courses.push(course); if (numbers.length > 1) period.requirements.push(`${code} går over ${semesterText}. semester; studiepoengene gjelder hele emnet.`) }
  }
  if (!periods.size) fail('not-supported', 'PDF-planen mangler støttede emnebeskrivelser med emnekode, studiepoeng og studiesemester. Bruk dokumentimport for å kontrollere innholdet.')
  const declaredCodes = new Set(pages.filter(page => page.page <= 4).flatMap(page => page.lines.map(line => clean(line).match(/^(?:Modul\s+)?([A-ZÆØÅ]{2,10}-\d{3,4}[A-Z]?):/)?.[1]).filter(Boolean)))
  const missing = [...declaredCodes].filter(code => !courses.has(code))
  if (missing.length) warnings.push(`Disse emnekodene i innholdsoversikten mangler en støttet emnebeskrivelse: ${missing.join(', ')}. Kontroller dem i dokumentimport.`)
  warnings.push('Emnekoder, navn, studiepoeng og semesterfelt er lest lokalt fra PDF-ens emnebeskrivelser. Kalenderår og vår/høst må avklares av studenten. Valgfrie vedlegg er beholdt som valgemner; øvrig obligatorisk status er ikke antatt.', 'Undervisningsdatoer, campus og grupper inngår ikke i denne PDF-kontrakten. Emner over flere semestre beholder hele emnets studiepoeng.')
  return { status: 'ok', program: { code: program, name: programName, cohort: String(cohort), sourceUrl, campuses: [], sourceEdition: edition }, models: [{ id: 'published-pdf', name: 'Publisert PDF-plan for kullet', periods: [...periods.values()].sort((a, b) => a.studySemester - b.studySemester), unplacedCourses }], warnings, completeness: { complete: !missing.length && !unplacedCourses.length, pages: pages.length, returned: courses.size, scope: 'Emnebeskrivelser med eksplisitte metadata i valgt PDF; motstridende plassering krever studentens avklaring.' } }
}
