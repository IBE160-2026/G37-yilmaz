import { clean, fail } from './program-source.js'

const caches = new WeakMap()
const text = value => clean(value).replace(/\u00ad/g, '')
export function nmhPdfPage(items, page) {
  const rows = []
  for (const item of items.filter(item => text(item.str)).sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    let row = rows.find(row => Math.abs(row.y - item.transform[5]) < 2)
    if (!row) { row = { y: item.transform[5], cells: [] }; rows.push(row) }
    row.cells.push({ x: item.transform[4], text: text(item.str) })
  }
  return { page, rows: rows.map(row => ({ ...row, cells: row.cells.sort((a, b) => a.x - b.x) })) }
}
export async function readNmhPdf(fetchBytes, sourceUrl, validateUrl) {
  if (typeof fetchBytes !== 'function') fail('not-supported', 'Offentlig PDF-henting er ikke tilgjengelig i denne lokale kjøringen.')
  validateUrl(sourceUrl); fetchBytes.signal?.throwIfAborted()
  const key = fetchBytes.cacheKey || fetchBytes
  let cache = caches.get(key); if (!cache) { cache = new Map(); caches.set(key, cache) }
  const entry = cache.get(sourceUrl)
  if (entry && Date.now() - entry.time < 600000) return entry.pages
  const bytes = await fetchBytes(sourceUrl, 0, validateUrl, { maxBytes: 10_000_000 })
  if (bytes.length > 10_000_000 || !Buffer.from(bytes).subarray(0, 5).equals(Buffer.from('%PDF-'))) fail('source-changed', 'NMH svarte ikke med en støttet PDF innen grensen på 10 MB.')
  let loading
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true })
    const document = await loading.promise, pages = []; let characters = 0
    if (document.numPages > 200) fail('not-supported', 'PDF-planen har over 200 sider. Bruk et relevant utdrag i dokumentimport.')
    for (let page = 1; page <= document.numPages; page++) {
      fetchBytes.signal?.throwIfAborted()
      const source = await document.getPage(page), content = await source.getTextContent(), parsed = nmhPdfPage(content.items, page)
      characters += parsed.rows.reduce((sum, row) => sum + row.cells.reduce((n, cell) => n + cell.text.length, 0), 0)
      if (characters > 1_000_000) fail('not-supported', 'PDF-teksten overstiger importgrensen. Bruk et relevant utdrag i dokumentimport.')
      pages.push(parsed); source.cleanup()
    }
    if (characters < 100) fail('not-supported', 'PDF-planen er skannet eller mangler lesbar tekst. Lim inn teksten eller registrer emnene manuelt.')
    if (cache.size >= 12) cache.delete(cache.keys().next().value)
    cache.set(sourceUrl, { time: Date.now(), pages }); return pages
  } catch (error) {
    if (error.status || error.name === 'AbortError') throw error
    fail('source-changed', 'NMHs PDF-plan kunne ikke leses lokalt. Bruk dokumentimport eller lim inn teksten fra planen.')
  } finally { await loading?.destroy() }
}
const lineText = row => row.cells.map(cell => cell.text).join(' ')
export function parseNmhPdf(pages, { code, name, cohort, sourceUrl, pdfUrl, fulltimeOnly = false }) {
  const cover = pages[0]?.rows.map(lineText).join(' ').replace(/(20\d)\s+(\d)\b/g, '$1$2') || ''
  if (cover.match(/startkull\s+(?:høst|vår)\s+(\d{4})/i)?.[1] !== String(cohort) || cover.match(/Studieprogramkode\s+([A-Z\d]+)/)?.[1] !== code) fail('invalid-selection', 'PDF-forsiden bekrefter ikke valgt programkode og opptakskull. Ingen annen planutgave blir brukt automatisk.')
  const models = [], warnings = []; let precedingLabel = ''
  for (const page of pages) {
    for (let index = 0; index < page.rows.length; index++) {
      const row = page.rows[index], label = lineText(row)
      if (/^Emnestruktur(?:\s|$)/.test(label)) precedingLabel = label
      if (!/^Emnekode\s+Emnets navn\s+Studiepoeng\s+Stp\s*pr\.\s*år$/.test(label)) continue
      const heading = precedingLabel || 'Publisert årsfordeling'
      if (fulltimeOnly && /deltid/i.test(heading)) { warnings.push('Kildesiden avgrenser denne PDF-lenken til heltidsstudiet. Deltidstabellen er derfor ikke brukt som bekreftet deltidsplan.'); continue }
      const yearsRow = page.rows[index + 1], years = yearsRow?.cells.map(cell => ({ ...cell, year: cell.text.match(/^(\d+)\.\s*År$/i)?.[1] })).filter(cell => cell.year)
      if (!years?.length || years.some((year, position) => +year.year !== position + 1) || years.length > 20) { warnings.push(`PDF-side ${page.page}: årsoverskriftene kunne ikke leses entydig.`); continue }
      const creditsX = row.cells.find(cell => cell.text === 'Studiepoeng').x, nameX = row.cells.find(cell => /^Emnets/.test(cell.text)).x
      const periods = years.map(year => ({ id: `year-${year.year}`, sourceStudyYear: +year.year, studySemester: null, requiresStudentStudySemester: true, label: `${year.year}. studieår · oppgi studiesemester`, year: null, semester: null, courses: [], requirements: ['Kilden oppgir studieår. Velg bare emner som gjelder ditt studiesemester; kalendersemester og campus må også avklares. Studiepoengene gjelder hele emnet.'] }))
      const courses = new Set(); let group = '', invalid = false
      for (const current of page.rows.slice(index + 2)) {
        const line = lineText(current)
        if (/^(?:Sum:|Sist oppdatert:|Emnestruktur)/.test(line)) break
        const codeCells = current.cells.filter(cell => cell.x < nameX - 2), courseCode = codeCells.map(cell => cell.text).join('')
        if (!/^[A-ZÆØÅ]{2,14}\d{1,3}$/.test(courseCode)) { if (codeCells.length) group = line; continue }
        const courseName = current.cells.filter(cell => cell.x >= nameX - 2 && cell.x < creditsX - 3).map(cell => cell.text).join(' '), creditCell = current.cells.find(cell => Math.abs(cell.x - creditsX) < 3), credits = creditCell && /^\d+(?:[.,]\d+)?$/.test(creditCell.text) ? Number(creditCell.text.replace(',', '.')) : null
        const allocations = years.map(year => current.cells.find(cell => Math.abs(cell.x - year.x) < 3)?.text || '')
        if (!courseName || !allocations.some(Boolean) || allocations.some(value => value && !/^(?:\d+(?:[.,]\d+)?|\*)$/.test(value)) || courses.has(courseCode)) { invalid = true; break }
        courses.add(courseCode)
        if (/^Valgemner$/i.test(courseName)) { periods.forEach((period, offset) => { if (allocations[offset]) period.requirements.push(`Valgemner: ${allocations[offset]} studiepoeng i ${period.sourceStudyYear}. studieår. Velg faktiske emner fra valgemnekatalogen; denne samleposten opprettes ikke som et emne.`) }); continue }
        const allocated = allocations.filter(value => value && value !== '*').reduce((sum, value) => sum + Number(value.replace(',', '.')), 0)
        if (credits !== null && allocated !== credits) { invalid = true; break }
        for (let offset = 0; offset < periods.length; offset++) if (allocations[offset]) periods[offset].courses.push({ id: `nmh-program:${code}:${cohort}:${courseCode}`, code: courseCode, name: courseName, credits, choice: /valgemner/i.test(group) ? 'V' : '', courseGroup: group, requiresSemesterChoice: true, year: null, semester: null, campus: '', university: 'Norges musikkhøgskole', description: '', notes: `PDF-side ${page.page}: ${line}. ${heading}. Årsfordelingen er veiledende; studiesemester må avklares. ${credits === null ? 'Kilden viser ikke egne studiepoeng for dette emnet.' : 'Studiepoengene gjelder hele emnet.'}`, sourceProvider: 'nmh-program', sourceRecordId: courseCode, sourceVersion: String(cohort), sourceUrl: pdfUrl })
      }
      if (invalid || !periods.some(period => period.courses.length)) { warnings.push(`PDF-side ${page.page}: emnetabellen har uklare eller motstridende rader og må kontrolleres i dokumentimport.`); continue }
      models.push({ id: `pdf-${page.page}-${index}`, name: heading, periods })
    }
  }
  if (!models.length) fail('not-supported', 'Den publiserte NMH-planen mangler en entydig støttet emnetabell. Bruk dokumentimport for å kontrollere planen.')
  return { status: 'ok', program: { code, name, cohort: String(cohort), sourceUrl, sourceEdition: String(cohort), campuses: [] }, models, warnings: [...warnings, 'Programkull er bekreftet mot PDF-forsiden. Studieår er ikke studiesemester; årstabellens emner må velges og plasseres uttrykkelig.', 'Valgkrav og veiledende fordeling beholdes. Undervisning velges separat fra den offentlige TimeEdit-inngangen.'], completeness: { complete: false, pages: pages.length, returned: new Set(models.flatMap(model => model.periods.flatMap(period => period.courses.map(course => course.code)))).size, reason: 'Publiserte, entydige årstabeller er lest. Semesterplassering og valgkrav krever studentens avklaring.' } }
}
