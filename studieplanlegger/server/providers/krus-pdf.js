import { clean, fail, load, restrictedUrl } from './program-source.js'
import { studentCohort, sourceEdition } from './current-program-source.js'

export const krusPdfUrl = input => restrictedUrl(input, { origin: 'https://www.krus.no', paths: [/^\/download\/[\w.-]+\/\d+\/[^/]+\.pdf$/i] })
export function krusPdfVersions(html, programUrl) {
  const $ = load(html), versions = new Map()
  $('a[href]').each((_, anchor) => {
    const label = clean($(anchor).text()); if (!/^Studieplan\b/.test(label)) return
    let url; try { url = krusPdfUrl(new URL($(anchor).attr('href'), programUrl)).href } catch { return }
    const range = label.match(/\b([HV])(20\d{2})\s*[–—-]\s*([HV])(20\d{2})\b/), bound = label.match(/gjelder\s+(fra|til)\s+og med\s+(våren|høsten)\s+(20\d{2})/i)
    if (range) versions.set(url, { cohort: range[2], label, sourceUrl: url, intake: range[1] === 'H' ? 'autumn' : 'spring', end: { year: +range[4], semester: range[3] === 'H' ? 'autumn' : 'spring' } })
    else if (bound) versions.set(url, { cohort: 'student', label: `${label} · oppgi eget opptakskull`, sourceUrl: url, requiresStudentCohort: true, bound: { direction: bound[1].toLowerCase(), year: +bound[3], semester: /^vår/i.test(bound[2]) ? 'spring' : 'autumn' } })
  })
  return [...versions.values()]
}
export function krusPdfLines(pages) {
  return pages.flatMap(page => {
    const rows = []
    for (const item of page.items) { const y = item.transform[5], row = rows.find(row => Math.abs(row.y - y) < 1); if (row) row.items.push(item); else rows.push({ y, items: [item] }) }
    return rows.sort((a, b) => b.y - a.y).map(row => ({ page: page.page, text: clean(row.items.sort((a, b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' ')).replace(/\bKRUS(\d{2})\s+(\d{2}[A-Z]?)\b/g, 'KRUS$1$2') }))
  })
}
function semesterNumbers(line) {
  const words = ['første', 'andre', 'tredje', 'fjerde', 'femte', 'sjette'], text = line.replace(/^\d+\.\s*/, '').toLocaleLowerCase('nb')
  const match = text.match(/^(\S+)(?:\s+og\s+(\S+))?\s+semester$/)
  return match ? match.slice(1).filter(Boolean).map(word => words.indexOf(word) + 1).filter(Boolean) : []
}
const creditsLine = text => text.replace(/^[•–-]\s*/, '').match(/^(KRUS\d{4}[A-Z]?)\s+(.+?)\s*\((\d+(?:[.,]\d+)?)\s*stp\.?\)$/)
export function parseKrusPdfPlan(pages, query, version, programName) {
  const lines = krusPdfLines(pages), cohort = version.requiresStudentCohort ? studentCohort(query) : String(query.cohort), sourceUrl = version.sourceUrl, bachelor = Boolean(version.bound), meta = new Map(), periods = new Map(), warnings = []
  if (!bachelor && cohort !== version.cohort) fail('invalid-selection', 'PDF-utgaven stemmer ikke med valgt opptakskull.')
  const stamp = bachelor ? `${version.bound.direction}:${version.bound.year}:${version.bound.semester}` : `cohort:${cohort}:${version.intake}`
  const period = number => {
    if (!periods.has(number)) {
      const start = +cohort * 2 + (version.intake === 'autumn' ? 1 : 0), offset = start + number - 1, calendar = bachelor ? { year: null, semester: null } : { year: Math.floor(offset / 2), semester: offset % 2 ? 'autumn' : 'spring' }
      periods.set(number, { id: String(number), studySemester: number, ...calendar, label: `${number}. studiesemester · ${bachelor ? 'avklar kalendersemester' : `${calendar.semester === 'autumn' ? 'Høst' : 'Vår'} ${calendar.year}`}`, courses: [], requirements: [] })
    }
    return periods.get(number)
  }
  const course = (code, name, credits, number, choice = '') => ({ id: `krus:${query.program}:${stamp}:${number}:${code}`, code, name, credits, choice, sourceProvider: 'krus-pdf', sourceRecordId: `${query.program}:${code}`, sourceVersion: stamp, sourceUrl, university: 'KRUS', description: '', notes: `Publisert PDF-utgave: ${version.label}. ${number}. studiesemester. Studiepoengene gjelder hele emnet.`, year: period(number).year, semester: period(number).semester, campus: '', ...(version.bound ? { calendarPeriodBound: version.bound } : {}) })
  if (bachelor) {
    const start = lines.findIndex(line => /^OPPBYGNING OG GJENNOMFØRING$/i.test(line.text)), end = lines.findIndex((line, i) => i > start && /^HØGSKOLEKANDIDAT I STRAFFEGJENNOMFØRING$/i.test(line.text))
    if (start < 0 || end < 0) fail('source-changed', 'Bachelor-PDF-en mangler den publiserte oppbygningstabellen.')
    const table = lines.slice(start, end)
    for (let i = 0; i < table.length; i++) {
      const row = table[i].text.match(/^(\d+)\s+(KRUS\d{4})\s+(.+)$/)
      if (row && +row[1] >= 5) {
        const detail = creditsLine(`${row[2]} ${row[3]}${/stp/.test(row[3]) ? '' : ` ${table[i + 1]?.text || ''}`}`)
        if (!detail) fail('source-changed', 'Påbyggingstabellen har en uleselig emnerad.')
        period(+row[1]).courses.push(course(detail[1], clean(detail[2]), +detail[3].replace(',', '.'), +row[1], 'O'))
      }
      const elective = table[i].text.match(/^(\d+)\s+Valgfritt programemne\s*\((\d+)\s*stp\)/)
      if (elective) period(+elective[1]).requirements.push(`PDF-side ${table[i].page}: ${table[i].text}. Planen navngir ikke valgemnetilbudet. Velg et faktisk godkjent emne separat; ingen plassholder importeres som emne.`)
    }
    const all = lines.map(line => line.text).join(' ')
    if (!/tre obligatoriske fellesemner/.test(all) || ![5, 6, 7, 8].every(number => periods.has(number))) fail('source-changed', 'Påbyggingsplanens obligatoriske emner eller studieløp kunne ikke bekreftes.')
    warnings.push(`Denne PDF-utgaven gjelder ${version.bound.direction === 'fra' ? 'fra og med' : 'til og med'} ${version.bound.semester === 'spring' ? 'vår' : 'høst'} ${version.bound.year}, ikke et bestemt opptakskull. Oppgi ditt kull og kalendersemester. Tabellens 5.–8. studiesemester beholdes som del av hele bachelorløpet; de er påbyggingens fire semestre.`, 'Valgemnetilbud er ikke navngitt i denne PDF-utgaven. Dagens HTML-liste kan ha en annen versjon og er ikke automatisk blandet inn.')
  } else {
    const first = lines.filter(line => line.page === 1).map(line => line.text).join(' '), cover = first.match(/\b([HV])(\d{2})\s*[–—-]\s*([HV])(\d{2})\b/)
    if (cover && (+cover[2] !== +cohort % 100 || (cover[1] === 'H' ? 'autumn' : 'spring') !== version.intake || +cover[4] !== version.end.year % 100) || !cover && !first.includes(cohort)) fail('source-changed', 'PDF-forsiden bekrefter ikke kildevalgets år eller periode.')
    for (const line of lines) { const match = creditsLine(line.text); if (match) meta.set(match[1], { code: match[1], name: clean(match[2]), credits: +match[3].replace(',', '.') }) }
    const start = lines.findIndex(line => /^(?:STUDIETS|DELTIDSTUDIETS) OPPBYGGING$/i.test(line.text))
    if (start < 0) fail('source-changed', 'PDF-en mangler en lesbar semesteroversikt.')
    let active = []
    for (const line of lines.slice(start + 1)) {
      if (/^Påbyggingsstudiet|^GENERELL STUDIEINFORMASJON/.test(line.text)) break
      const numbers = semesterNumbers(line.text); if (numbers.length) { active = numbers; continue }
      const codes = [...line.text.matchAll(/\bKRUS\d{4}[A-Z]?\b/g)].map(match => match[0])
      if (!active.length || !codes.length) continue
      for (const code of codes) {
        const info = meta.get(code); if (!info) fail('source-changed', `PDF-emnet ${code} mangler entydig navn og studiepoeng.`)
        for (const number of active) if (!period(number).courses.some(row => row.code === code)) {
          const row = course(code, info.name, info.credits, number, /og\/eller|\beller\b/.test(line.text) ? 'V' : '')
          row.notes += ` PDF-side ${line.page}: ${line.text}.`; if (active.length > 1) { row.requiresSemesterChoice = true; period(number).requirements.push(`${code} er oppført samlet i ${active.join(' og ')}. semester; full emneverdi beholdes.`) }
          period(number).courses.push(row)
        }
      }
    }
    const endOffset = version.end.year * 2 + (version.end.semester === 'autumn' ? 1 : 0), startOffset = +cohort * 2 + (version.intake === 'autumn' ? 1 : 0), expected = endOffset - startOffset + 1
    if (expected < 1 || expected > 20 || periods.size !== expected || !Array.from({ length: expected }, (_, i) => i + 1).every(number => periods.get(number)?.courses.length)) fail('source-changed', 'Semesteroversikten stemmer ikke med den publiserte kullperioden.')
    warnings.push('Opptakskull og start-/sluttsemester er hentet fra den daterte planlenken og kontrollert mot PDF-forsiden. Kalendersemestrene følger den publiserte sammenhengende semesteroversikten.', 'Emner som står samlet eller som «og/eller», må avklares mot din gjennomføring. Studiepoeng er hele emnets verdi og deles ikke automatisk.')
  }
  if (!periods.size) fail('source-changed', 'PDF-en har ingen støttede emner.')
  warnings.push('Dette importerer programplanen. Studentens timeplan, Canvas-grupper og praksisturnus er ikke utledet fra PDF-en.')
  return { status: 'ok', program: { code: query.program, name: programName, cohort, sourceUrl, campuses: [], ...(bachelor ? { cohortFromStudent: true, sourceEdition: sourceEdition(JSON.stringify(pages)) } : {}) }, models: [{ id: 'published-pdf', name: version.label, periods: [...periods.values()].sort((a, b) => a.studySemester - b.studySemester) }], warnings, completeness: { complete: !bachelor, pages: pages.length, returned: [...periods.values()].reduce((n, period) => n + period.courses.length, 0), scope: bachelor ? 'Påbyggingens tre navngitte obligatoriske emner og valgemnekrav i valgt gyldighetsutgave; faktisk valgemnetilbud mangler.' : 'Alle semester-/emnerader i valgt publisert kullplan, ikke undervisningskalender eller praksisturnus.' } }
}
