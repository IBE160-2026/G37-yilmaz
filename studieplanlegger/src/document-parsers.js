import Papa from 'papaparse'
import ICAL from 'ical.js'
import { Temporal } from '@js-temporal/polyfill'
import { parseCalendar, validateCalendarDates, calendarDateWarning, calendarDateSyntaxIssues } from './calendar-import.js'
import { OSLO, osloLocal as osloMinute, osloLocalExact as osloLocal, toInstant } from './planner.js'
import { validDeadline } from './tasks.js'
import { DOCUMENT_DESCRIPTION_LIMIT } from './import-source-contract.js'
import { documentInstitution, documentCourseIdentity } from './document-course-identity.js'

export const DOCUMENT_LIMITS = Object.freeze({ binaryBytes: 10_000_000, textBytes: DOCUMENT_DESCRIPTION_LIMIT, pages: 100, entries: 1000, textCharacters: 1_000_000, zipEntries: 2000, zipExpandedBytes: 30_000_000, zipEntryBytes: 8_000_000, milliseconds: 30_000 })
const clean = value => String(value ?? '').trim()
const normal = value => clean(value).normalize('NFKC').toLocaleLowerCase('nb-NO').replace(/\s+/g, ' ')
const safeSnippet = value => clean(value).replace(/(?:https?|webcal):\/\/[^\s<>"']+/gi, '[lenke utelatt]').slice(0, 600)
const identityTitle = value => normal(value).replace(/\b\d{4}-\d\d-\d\d\b|\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b|\b\d{1,2}:\d\d\b/g, '').replace(/\s+/g, ' ').trim()
const matchKey = row => [row.kind, identityTitle(safeSnippet(row.title)), normal(safeSnippet(row.courseHint || ''))].join('|').slice(0, 2000)
function entryFingerprint(value) {
  let hash = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(value)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n)
  return hash.toString(16).padStart(16, '0')
}
const pad = value => String(value).padStart(2, '0')
const monthNames = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const namedDate = /\b(\d{1,2})\.?\s*(januar|jan|februar|feb|mars|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|desember|des)\.?(?:\s+(\d{4})(?![\d/]))?(?:\s+(?:kl\.?\s*)?(\d{1,2})[:.](\d\d))?\b/i
const namedZoneSuffix = value => value.match(/^\s+(?:UTC|GMT|CET|CEST|[A-Za-z_]+\/[A-Za-z_/]+)\b/i)?.[0] || value.match(/^\s+(?:[A-Z]{1,3}[SD]T|[CEW]EST|[CEW]ET|MSK|HKT|SGT|MET)\b/)?.[0] || ''
function assertText(text) {
  if (text.length > DOCUMENT_LIMITS.textCharacters) throw new Error('Dokumentet inneholder for mye tekst (maks 1 million tegn). Del dokumentet før import; ingen del er lagret.')
  if (!text.trim()) throw new Error('Ingen lesbar tekst ble funnet. Skannede dokumenter trenger tekstgjenkjenning; lim inn teksten eller registrer planen manuelt.')
}

// A calendar date is never silently promoted to a deadline at midnight.
export function parseDocumentDate(value) {
  const raw = clean(value)
  if (!raw) return { value: '', raw: '', issues: [] }
  const unresolvedPrecision = () => ({ value: '', raw, issues: ['Tidssonen eller tidsnøyaktigheten kan ikke lagres entydig. Bekreft dato og klokkeslett i norsk tid.'] })
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:[.,]\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(raw)) {
    try {
      const instant = Temporal.Instant.from(raw), local = osloMinute(instant.toString())
      // Deadlines have minute precision and no offset field. Never lose seconds
      // or an offset needed to distinguish the two occurrences of an Oslo hour.
      if (instant.epochNanoseconds % 60_000_000_000n !== 0n || toInstant(local) !== instant.toString()) return unresolvedPrecision()
      return { value: local, raw, issues: [] }
    } catch { return unresolvedPrecision() }
  }
  let date, time, ambiguous = false
  const iso = raw.match(/^(\d{4})-(\d\d)-(\d\d)(?:[ T]+(?:kl\.?\s*)?(\d{1,2})[:.](\d\d))?$/i)
  const norwegian = !iso && raw.match(/^(\d{1,2})([./])(\d{1,2})(?:\2(\d{4}|\d{2}))?(?:\s+(?:kl\.?\s*)?(\d{1,2})[:.](\d\d))?$/i)
  const named = !iso && !norwegian && raw.match(namedDate)
  if (/^\d{4}-\d\d-\d\d/.test(raw) && !iso || named && named[0] !== raw) return unresolvedPrecision()
  if (iso) { date = `${iso[1]}-${iso[2]}-${iso[3]}`; if (iso[4]) time = `${pad(iso[4])}:${iso[5]}` }
  else if (norwegian) {
    ambiguous = norwegian[2] === '/' && Number(norwegian[1]) <= 12 && Number(norwegian[3]) <= 12 && norwegian[1] !== norwegian[3]
    if (norwegian[4]?.length === 4) date = `${norwegian[4]}-${pad(norwegian[3])}-${pad(norwegian[1])}`
    if (norwegian[5]) time = `${pad(norwegian[5])}:${norwegian[6]}`
  }
  else if (named) {
    if (named[3]) date = `${named[3]}-${pad(monthNames.indexOf(named[2].toLocaleLowerCase('nb').slice(0, 3)) + 1)}-${pad(named[1])}`
    if (named[4]) time = `${pad(named[4])}:${named[5]}`
  }
  const issues = []
  if (!date) issues.push('Datoen mangler et entydig år eller datoformat.')
  if (!time) issues.push('Klokkeslett mangler; velg det selv eller lagre uten frist.')
  if (ambiguous) issues.push('Dato med skråstrek kan bety dag/måned eller måned/dag. Avklar datoen.')
  const candidate = date && time ? `${date}T${time}` : ''
  if (candidate && !validDeadline(candidate)) issues.push('Dato eller klokkeslett er ugyldig.')
  if (candidate && !issues.length) try { toInstant(candidate) } catch { issues.push('Klokkeslettet er ugyldig eller tvetydig ved tidsomstilling. Avklar fristen.') }
  return { value: !issues.length ? candidate : '', raw, issues }
}

function explicitOffsetRangeEnd(startToken, endHour, endMinute) {
  const match = startToken.match(/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d)(?::00(?:[.,]0+)?)?(Z|[+-]\d\d:\d\d)$/)
  if (!match) return ''
  const startMinutes = Number(match[2]) * 60 + Number(match[3]), endMinutes = Number(endHour) * 60 + Number(endMinute)
  if (endMinutes > 1439 || endMinutes === startMinutes) return ''
  let sourceDate
  try { sourceDate = Temporal.PlainDate.from(match[1]); if (endMinutes < startMinutes) sourceDate = sourceDate.add({ days: 1 }) } catch { return '' }
  return parseDocumentDate(`${sourceDate}T${pad(endHour)}:${endMinute}${match[4]}`).value
}

function baseRow(kind, title, snippet, position, extra = {}) {
  const row = { kind, title: clean(title).slice(0, 1000), snippet: safeSnippet(snippet), position: clean(position).slice(0, 100), selected: true, courseHint: '', deadlineLocal: '', deadlineRaw: '', deadlineIssues: [], startLocal: '', endLocal: '', remainingMinutes: null, ...extra }
  row.matchKey = matchKey(row)
  return row
}
function finish(rows, warnings = [], format = 'text') {
  if (rows.length > DOCUMENT_LIMITS.entries) throw new Error('Dokumentet har over 1000 oppføringer. Del dokumentet før import; ingen del er lagret.')
  const counts = new Map(), fingerprints = new Map()
  for (const row of rows) {
    const identity = row.explicitId ? `${row.kind}:id:${row.explicitId}` : row.csvIdentity || row.matchKey
    const index = counts.get(identity) || 0
    counts.set(identity, index + 1)
    if (row.explicitId) row.alternateKindKeys = ['task', 'event'].filter(kind => kind !== row.kind).map(kind => `${kind}:${entryFingerprint(`${kind}:id:${row.explicitId}`)}#1`)
    row.identity = identity
    const fingerprint = entryFingerprint(identity)
    if (fingerprints.has(fingerprint) && fingerprints.get(fingerprint) !== identity) throw new Error('Dokumentets oppføringer har en identitetskollisjon. Bruk tydelige kilde-ID-er eller del dokumentet.')
    fingerprints.set(fingerprint, identity)
    row.key = `${row.kind}:${fingerprint}#${index + 1}`
  }
  for (const row of rows) if (counts.get(row.identity) > 1) row.identityAmbiguous = true
  return { format, rows, warnings: [...new Set(warnings)], complete: true }
}

export function parseDocumentText(text, { blocks, format = 'text' } = {}) {
  assertText(text)
  const rows = [], warnings = ['Teksttolking er et forslag. Kontroller oppgavetype, emne, dato og klokkeslett mot kildeutdraget.']
  let courseHint = ''
  const parts = blocks || text.split(/\r?\n/).map((text, index) => ({ text, position: `Linje ${index + 1}` }))
  for (const part of parts) for (const [lineIndex, line] of part.text.split(/\r?\n/).entries()) {
    const value = clean(line).replace(/^[-*•]\s+/, '')
    if (!value) continue
    const position = `${part.position}${part.text.includes('\n') ? `, linje ${lineIndex + 1}` : ''}`
    const course = value.match(/^(?:emne|course)\s*:\s*([\p{L}]{2,8}[- ]?\d{2,5}[\p{L}\d-]*)\s*[-–:]?\s*(.*)$/iu)
    if (course) {
      courseHint = course[1].replace(' ', '').toUpperCase()
      rows.push(baseRow('course', course[2] || courseHint, value, position, { code: courseHint, year: '', semester: '', university: '', credits: null }))
      continue
    }
    const eventMarker = value.match(/(?<![\p{L}\p{N}\p{M}])(forelesning|seminar|undervisning|øving|lab|lecture|workshop)(?![\p{L}\p{N}\p{M}])/iu)
    const taskMarker = value.match(/(?<![\p{L}\p{N}\p{M}])(oppgave|arbeidskrav|innlevering|frist|les|lever|øv|eksamen|assignment|deadline|due|submit|read)(?![\p{L}\p{N}\p{M}])/iu)
    const event = Boolean(eventMarker && (!taskMarker || eventMarker.index < taskMarker.index)), task = Boolean(taskMarker)
    // Keep the whole timestamp token, including unsupported suffixes. Matching
    // just its supported prefix would silently reinterpret the remaining zone.
    const isoMatch = value.match(/\b\d{4}-\d\d-\d\dT\d{1,2}[:.]\d\d(?:[\w:.+\/[\]-]|,(?=\d))*/i)
    const isoToken = isoMatch && (isoMatch[0] + namedZoneSuffix(value.slice(isoMatch.index + isoMatch[0].length))).replace(/\.$/, '')
    const localDate = !isoToken && (value.match(/\b\d{4}-\d\d-\d\d(?:\s+(?:kl\.?\s*)?\d{1,2}[:.]\d\d)?\b/i) || value.match(/\b\d{1,2}[./]\d{1,2}(?:[./](?:\d{4}|\d{2}))?(?:\s+(?:kl\.?\s*)?\d{1,2}[:.]\d\d)?\b/i) || value.match(namedDate))
    let localSuffix = ''
    if (localDate) {
      let tail = value.slice(localDate.index + localDate[0].length)
      // A hyphen in an explicitly local teaching range separates its end time.
      // T-form ISO offsets retain their different meaning above. A zone after
      // either local time still needs clarification, including after a range.
      if (event) tail = tail.replace(/^\s*[-–]\s*\d{1,2}[:.]\d\d/, '')
      localSuffix = tail.match(/^(?:[:.,]\d+)?(?:\s*(?:Z\b|[+-]\d{2}(?::?\d{2})?(?::\d+)?|\[[^\]]+\]))?/i)?.[0] || ''
      localSuffix += namedZoneSuffix(tail.slice(localSuffix.length))
    }
    const dateRaw = isoToken || (localDate && localDate[0] + localSuffix) || value.match(/(?<![\p{L}\p{N}\p{M}])(?:frist|deadline|due)(?![\p{L}\p{N}\p{M}])\s*:?\s*.*$|(?<![\p{L}\p{N}\p{M}])(?:leveres|innleveres|innlevering)\s+(?:innen|senest)\s+.+$/iu)?.[0] || ''
    const date = parseDocumentDate(dateRaw)
    const row = baseRow(event ? 'event' : 'task', value, value, position, { courseHint, selected: event || task, unsupported: !event && !task, deadlineLocal: date.value, deadlineRaw: dateRaw, deadlineIssues: date.issues, requiresSubmission: /(?<![\p{L}\p{N}\p{M}])(innlevering|lever|submit|assignment)(?![\p{L}\p{N}\p{M}])/iu.test(value) })
    if (event) {
      row.startLocal = date.value
      const endTime = isoToken
        ? value.slice(value.indexOf(isoToken) + isoToken.length).match(/^\s*[-–]\s*(\d{1,2})[:.](\d\d)/)?.slice(1)
        : value.match(/\d{1,2}[:.]\d\d\s*[-–]\s*(\d{1,2})[:.](\d\d)/)?.slice(1)
      if (row.startLocal && endTime) row.endLocal = isoToken
        ? explicitOffsetRangeEnd(isoToken, endTime[0], endTime[1])
        : `${row.startLocal.slice(0, 10)}T${pad(endTime[0])}:${endTime[1]}`
    }
    rows.push(row)
  }
  if (rows.some(r => r.unsupported)) warnings.push('Noen tekstlinjer kunne ikke klassifiseres og er ikke valgt. Du kan velge og redigere dem som oppgaver eller undervisning.')
  return finish(rows, warnings, format)
}

const columnNames = {
  kind: ['type', 'kind'], title: ['tittel', 'title', 'oppgave', 'summary', 'summary_nb', 'summarynb', 'teaching-title', 'teachingtitle', 'teaching-method-name', 'navn', 'name'], courseHint: ['emne', 'course', 'emnekode', 'coursecode', 'courseid'],
  deadline: ['frist', 'deadline', 'due', 'deadlineLocal'], start: ['start', 'starttid', 'startLocal', 'dtstart'], end: ['slutt', 'end', 'endLocal', 'dtend'],
  explicitId: ['eventid', 'uid', 'id'], remainingMinutes: ['minutter', 'minutes', 'remainingminutes'], location: ['sted', 'location'], year: ['år', 'year'], semester: ['semester'], university: ['institusjon', 'university'], credits: ['studiepoeng', 'credits'],
  courseName: ['emnenavn', 'coursename'], campus: ['campus', 'campusname'], campusCode: ['campusid', 'campuscode'], sourceObjectId: ['sourceobjectid'], activityType: ['activitytype', 'teachingmethodname', 'teaching-method-name'], publishedGroups: ['studentgroups', 'group', 'gruppe'], activityKind: ['activitykind'], transparent: ['transp', 'transparent'], point: ['point', 'punkt'],
}
// This field family is verified against the public TP export header. Its
// distinct text roles have an explicit row-level priority, unlike generic CSV
// aliases, whose conflicting meanings still need a column choice.
const tpCsvRequired = ['semesterid', 'courseid', 'dtstart', 'dtend', 'title-intro', 'teaching-title', 'summary', 'teaching-method-name']
const tpTeachingTitles = ['teaching-title_nb', 'teaching-title_nn', 'teaching-title_en', 'teaching-title']
const tpSummaries = ['summary_nb', 'summary_nn', 'summary_en', 'summary']
const tpTitleColumns = [...tpTeachingTitles, ...tpSummaries, 'title', 'teaching-method-name']
function tpCsvText(data, selectedTitle) {
  const first = fields => fields.map(field => clean(data[field])).find(Boolean) || ''
  const summary = first(tpSummaries), supplementary = clean(data.title)
  const title = selectedTitle ? clean(data[selectedTitle]) : first(tpTitleColumns)
  const distinct = new Set([normal(title)])
  const description = [summary, supplementary].filter(value => {
    const key = normal(value)
    if (!key || distinct.has(key)) return false
    distinct.add(key)
    return true
  }).join('\n\n')
  return { title, description }
}
function csvSample(text) {
  const parsed = Papa.parse(text, { header: true, preview: DOCUMENT_LIMITS.entries, skipEmptyLines: 'greedy', delimitersToGuess: [',', ';', '\t'] })
  const fields = parsed.meta.fields || [], priority = field => {
    const values = parsed.data.map(row => clean(row[field])).filter(Boolean)
    if (!values.length) return -1
    return (values.some(value => /[æøåÆØÅ]|[^\x00-\x7F]/.test(value)) ? 8 : 0) + (/title|summary|tittel|description|beskrivelse/i.test(field) ? 4 : /name|navn|sted|location/i.test(field) ? 2 : 0)
  }
  const shown = [...fields].sort((a, b) => priority(b) - priority(a)).slice(0, 6)
  const lines = shown.map(field => `${safeSnippet(field).slice(0, 55)}: ${[...new Set(parsed.data.map(row => clean(row[field])).filter(Boolean))].sort((a, b) => Number(/[^\x00-\x7F]/.test(b)) - Number(/[^\x00-\x7F]/.test(a))).slice(0, 2).map(value => safeSnippet(value).slice(0, 100)).join(' / ') || '(tomt)'}`)
  if (fields.length > shown.length) lines.push(`${fields.length - shown.length} flere kolonner er ikke vist i utdraget.`)
  return lines.join('\n') || safeSnippet(text)
}
function csvCalendarDate(raw) {
  if (!raw) return { value: '', raw, issues: [] }
  if (/:\d\d[.,]\d{4,}/.test(raw)) return { value: '', raw, issues: ['Kilden har finere tidsnøyaktighet enn millisekunder. Denne presisjonen støttes ikke av kalenderen. Avklar et uttrykkelig tidspunkt eller utelat aktiviteten; verdien rundes ikke automatisk.'] }
  const value = raw.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)$/, '$1-$2-$3T$4:$5:$6$7').replace(' ', 'T').replace(/([+-]\d\d)(\d\d)$/, '$1:$2').replace(/([+-]\d\d)$/, '$1:00')
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:[.,]\d{1,9})?)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)) {
    try {
      const offset = /(?:Z|[+-]\d\d:\d\d)$/.test(value)
      const original = offset ? Temporal.Instant.from(value).toString() : Temporal.PlainDateTime.from(value).toZonedDateTime(OSLO, { disambiguation: 'reject' }).toInstant().toString()
      return { value: osloLocal(original), raw, issues: [], original }
    } catch (error) { return { value: '', raw, issues: [/multiple instants|no such instant|ambiguous/i.test(error.message) ? 'Klokkeslettet finnes ikke eller er tvetydig ved tidsomstilling. Oppgi et entydig tidspunkt med UTC-avvik.' : 'Dato eller klokkeslett er ugyldig. Kontroller datoformatet.'] } }
  }
  const local = parseDocumentDate(raw)
  return { ...local, ...(local.value ? { original: toInstant(local.value) } : {}), issues: local.value ? [] : ['Datoformatet kunne ikke leses. Bruk dato og klokkeslett, for eksempel 2039-04-18 10:00:07+02:00.'] }
}
export function parseDocumentCsv(text, { columns: chosen = {} } = {}) {
  assertText(text)
  const result = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', dynamicTyping: false, delimitersToGuess: [',', ';', '\t'], transformHeader: normal })
  const errors = result.errors.filter(error => !(error.code === 'UndetectableDelimiter' && result.meta.fields?.length === 1 && result.data.every(row => Object.keys(row).length === 1)))
  if (errors.length) throw new Error(`CSV-filen kunne ikke leses fullstendig: ${errors[0].message}. Kontroller anførselstegn og antall kolonner.`)
  const recognizedTp = tpCsvRequired.every(field => result.meta.fields.includes(field))
  const columns = {}, ambiguous = []
  for (const [key, names] of Object.entries(columnNames)) {
    const aliases = recognizedTp && key === 'title' ? [...new Set([...tpTitleColumns, ...names])] : recognizedTp && key === 'location' ? [...names, 'room'] : names
    const matches = aliases.map(normal).filter(field => result.meta.fields.includes(field))
    if (chosen[key] && !matches.includes(chosen[key])) throw new Error('CSV-kolonnevalget stemmer ikke med denne filen. Velg kolonnene på nytt.')
    if (recognizedTp && key === 'title' && !chosen[key]) { columns[key] = tpTitleColumns.filter(field => result.meta.fields.includes(field)); continue }
    let populated = matches.filter(field => result.data.some(row => clean(row[field])))
    // This importer already assigns this explicit header to activityType.
    // Prefer actual title columns when present; this is not a claim that an
    // unknown public CSV export follows the TP JSON schema.
    if (key === 'title' && !chosen[key] && populated.some(field => field !== 'teaching-method-name')) populated = populated.filter(field => field !== 'teaching-method-name')
    const displayValue = value => clean(value).slice(0, 1000)
    const compareValue = value => normal(displayValue(value))
    const contextValue = (row, role) => columnNames[role].map(normal).map(field => clean(row[field])).find(Boolean) || ''
    const conflictingRows = populated.length > 1 ? result.data.filter(row => new Set(populated.map(field => compareValue(row[field])).filter(Boolean)).size > 1) : []
    const conflict = conflictingRows.length > 0
    if (key === 'explicitId') {
      // A unique, nonempty identifier is preferred. This is validation of this
      // file's values, not a claim about an undocumented public CSV schema.
      const validIdentifier = field => result.data.every(row => clean(row[field]) && clean(row[field]).length <= 500 && !/[\u0000-\u001f]/.test(row[field])) && new Set(result.data.map(row => clean(row[field]))).size === result.data.length
      if (chosen[key] && !validIdentifier(chosen[key])) throw new Error('Valgt identifikatorkolonne må ha én entydig, ikke-tom identitet per rad. Rett kolonnen eller velg en annen; ingen identifikator erstattes automatisk.')
      columns[key] = chosen[key] || populated.find(validIdentifier)
    } else {
      if (populated.length > 1 && conflict && !chosen[key]) {
        const options = populated.filter((field, index) => !populated.slice(0, index).some(other => result.data.every(row => compareValue(row[field]) === compareValue(row[other]))))
        // Refine the shared examples until every distinct column has a distinct
        // value sequence. A fixed first-three sample can conceal a later split.
        let unresolved = options.flatMap((first, index) => options.slice(index + 1).map(second => [first, second]))
        const examples = []
        while (unresolved.length) {
          const row = result.data.reduce((best, candidate) => {
            const score = unresolved.filter(([first, second]) => compareValue(candidate[first]) !== compareValue(candidate[second])).length
            return score > best.score ? { row: candidate, score } : best
          }, { row: null, score: 0 }).row
          if (!row) break
          examples.push(row)
          unresolved = unresolved.filter(([first, second]) => compareValue(row[first]) === compareValue(row[second]))
        }
        ambiguous.push({ key, options, examples: populated.map(field => ({ column: field, values: examples.map(row => displayValue(row[field]) || '(tomt)') })), comparison: examples.map(row => ({ date: safeSnippet(contextValue(row, 'start')), course: safeSnippet(contextValue(row, 'courseHint')) })) })
      }
      columns[key] = chosen[key] || populated[0] || matches[0]
      if (!chosen[key] && !conflict && populated.length > 1) columns[key] = populated
    }
  }
  if (ambiguous.length) throw Object.assign(new Error('Flere CSV-kolonner kan bety det samme. Velg kolonnene som skal brukes.'), { clarification: { kind: 'columns', fields: ambiguous, sample: csvSample(text) } })
  if (!columns.title && !columns.start) throw new Error('CSV-filen trenger en navngitt tittelkolonne, for eksempel «tittel» eller «oppgave».')
  if (result.meta.renamedHeaders && Object.keys(result.meta.renamedHeaders).length) throw new Error('CSV-filen har flere kolonner med samme navn. Gi dem entydige navn før import.')
  const warnings = [], unknown = result.meta.fields.filter(field => !Object.values(columns).flat().includes(field))
  if (unknown.length) warnings.push(`Disse CSV-kolonnene er bare synlige i kildeutdraget og blir ikke egne felt: ${unknown.slice(0, 6).map(name => name.slice(0, 60)).join(', ')}${unknown.length > 6 ? `; ${unknown.length - 6} flere kolonner` : ''}.`)
  const calendarDates = new Map()
  const calendarDate = raw => {
    if (!calendarDates.has(raw)) calendarDates.set(raw, csvCalendarDate(raw))
    const date = calendarDates.get(raw)
    return { ...date, issues: [...date.issues] }
  }
  const rows = result.data.map((data, index) => {
    const get = key => Array.isArray(columns[key]) ? columns[key].map(field => clean(data[field])).find(Boolean) || '' : clean(data[columns[key]])
    const type = normal(get('kind')), kind = /^(emne|course)$/.test(type) ? 'course' : (/^(event|undervisning|aktivitet|teaching)$/.test(type) || !type && columns.start && ([columns.start].flat().includes('dtstart') || !columns.deadline)) ? 'event' : 'task'
    const date = parseDocumentDate(get('deadline')), start = kind === 'event' ? calendarDate(get('start')) : parseDocumentDate(get('start')), end = kind === 'event' ? calendarDate(get('end')) : parseDocumentDate(get('end'))
    const tpText = recognizedTp && kind === 'event' ? tpCsvText(data, chosen.title) : null
    const row = baseRow(kind, tpText?.title ?? get('title'), Object.entries(data).map(([key, value]) => `${key}: ${value}`).join('; '), `CSV-rad ${index + 2}`, { courseHint: get('courseHint'), courseExplicit: Boolean(get('courseHint')), explicitId: get('explicitId'), deadlineLocal: date.value, deadlineRaw: date.raw, deadlineIssues: date.issues, startLocal: start.value, endLocal: end.value, startRaw: start.raw, endRaw: end.raw, startIssues: start.issues, endIssues: end.issues, location: get('location'), ...(tpText ? { description: tpText.description } : {}) })
    if (kind === 'event') {
      const local = start.value
      if (start.original) row.originalStart = start.original
      if (end.original) row.originalEnd = end.original
      Object.assign(row, { university: get('university'), year: get('year') || (local ? Number(local.slice(0, 4)) : ''), semester: /^(vår|spring|v)$/i.test(get('semester')) ? 'spring' : /^(høst|autumn|h)$/i.test(get('semester')) ? 'autumn' : !get('semester') && local ? Number(local.slice(5, 7)) <= 6 ? 'spring' : 'autumn' : '', point: Boolean(/^(true|1)$/i.test(get('point')) && start.original && (!end.raw || end.original && start.original === end.original)) })
      const legacyPeriod = { year: row.year, semester: row.semester }
      if (recognizedTp && clean(data.semesterid)) {
        const term = clean(data.semesterid)
        if (!/^\d{2}[vh]$/.test(term)) throw new Error(`CSV-rad ${index + 2}: Publisert semesterid er ugyldig. Bruk kildens entydige TP-semester; datoen erstatter ikke semesteret.`)
        const publishedSemester = term.endsWith('h') ? 'autumn' : 'spring'
        const sourceYear = local ? Number(local.slice(0, 4)) : null
        // The full source year anchors the two-digit publication ID. The only
        // cross-year fallback is the specified autumn/following-January case;
        // no arbitrary century or event-date semester is substituted.
        const years = get('year') ? [Number(get('year'))] : sourceYear ? [sourceYear, ...(publishedSemester === 'autumn' && local.slice(5, 7) === '01' ? [sourceYear - 1] : [])] : []
        const matched = years.filter(year => Number.isInteger(year) && year >= 1900 && year <= 2200 && String(year).slice(-2) === term.slice(0, 2))
        if (years.length && matched.length !== 1 || get('semester') && row.semester !== publishedSemester) throw new Error(`CSV-rad ${index + 2}: Publisert semesterid er i konflikt med oppgitt år, semester eller kildens dato. Avklar kildeverdiene; emnets periode velges ikke automatisk.`)
        row.year = matched[0] || ''; row.semester = publishedSemester; row.publishedTerm = matched.length === 1
      }
      Object.assign(row, { courseName: get('courseName'), campus: get('campus'), campusCode: get('campusCode'), sourceObjectId: get('sourceObjectId'), activityType: get('activityType'), activityKind: ['exam', 'assessment', 'personal'].includes(get('activityKind')) ? get('activityKind') : '', transparent: /^(true|1|transparent)$/i.test(get('transparent')) })
      if (!end.raw && !row.point) row.endIssues.push('Sluttid mangler. Kilden bekrefter ikke en punktmarkør; avklar sluttid eller utelat aktiviteten.')
      else if (start.original && end.original && Date.parse(end.original) <= Date.parse(start.original) && !row.point) row.endIssues.push('Slutt må være etter start. Kilden bekrefter ikke dette som en punktmarkør; kontroller verdiene eller utelat aktiviteten.')
      // A point is nonblocking through its point flag. Information is reserved
      // for source semantics, so a deliberate duration can reserve time.
      row.information = row.transparent
      if (!row.title) {
        row.titleSuggestion = `${[row.activityType || 'Aktivitet', row.courseHint, ...(!recognizedTp ? [row.startLocal?.replace('T', ' ')] : [])].filter(Boolean).join(' · ')} (foreløpig)`
        if (recognizedTp) { row.title = row.titleSuggestion; row.titleStatus = 'provisional'; row.matchKey = matchKey(row) }
        warnings.push(recognizedTp ? 'En aktivitet mangler tittel. Det tydelig merkede foreløpige navnet godkjennes sammen med importen.' : 'En aktivitet mangler tittel. Skriv et navn eller godkjenn det tydelig merkede foreløpige navnet.')
      }
      row.publishedGroups = []
      if (get('publishedGroups')) {
        const raw = get('publishedGroups')
        let groups
        try { groups = /^[\[{]/.test(raw) ? JSON.parse(raw) : [raw] } catch { throw new Error(`CSV-rad ${index + 2}: Publisert gruppeliste har ugyldig format. Kontroller listen; ingen gruppetilhørighet er funnet på.`) }
        if (!Array.isArray(groups) || groups.length > 100 || !groups.every(item => typeof item === 'string' && item.trim() && item.length <= 300 && !/[\u0000-\u001f]/.test(item))) throw new Error(`CSV-rad ${index + 2}: Publisert gruppe mangler en gyldig og fullstendig identitet. Kontroller kilden.`)
        row.publishedGroups = [...new Set(groups.map(clean))]
      }
      row.explicitGroup = row.publishedGroups.length === 1 ? row.publishedGroups[0] : ''
      row.requiresGroupChoice = Boolean(row.publishedGroups.length)
      if (row.requiresGroupChoice) row.selected = false
      // A unique qualified occurrence is independent of the selected display
      // column. Coincident occurrences remain ambiguous; no row ordinal is proof.
      if (!row.explicitId && row.courseHint && start.original) {
        row.csvIdentity = `csv-occurrence:${documentCourseIdentity({ ...row, code: row.courseHint })}:${start.original}:${end.original || start.original}`
        if (row.publishedTerm) row.legacyTermIdentity = `csv-occurrence:${documentCourseIdentity({ ...row, ...legacyPeriod, code: row.courseHint })}:${start.original}:${end.original || start.original}`
      }
      row.identityScope = JSON.stringify([documentInstitution(row.university), normal(row.courseHint), Number(row.year), row.semester, row.sourceObjectId, normal(row.campus), normal(row.campusCode)])
      row.identityValidated = Boolean(row.explicitId && row.university && row.courseHint && row.year && row.semester)
      if (!row.explicitId) warnings.push('Kilden mangler en entydig hendelsesidentitet. Ved endringer må du kontrollere tidligere oppføringer; like titler blir ikke automatisk slått sammen.')
      if (start.original && end.original && Date.parse(end.original) > Date.parse(start.original) && Date.parse(end.original) - Date.parse(start.original) < 60_000 && !row.transparent) warnings.push('En aktivitet har svært kort varighet. Tidspunktene beholdes nøyaktig. CSV-verdiene alene bekrefter ikke at dette er en TP-vurderingsmarkør.')
    }
    if (get('remainingMinutes')) {
      if (/^\d+$/.test(get('remainingMinutes')) && Number.isSafeInteger(Number(get('remainingMinutes')))) row.remainingMinutes = Number(get('remainingMinutes'))
      else { row.estimateIssue = 'Minutter er ikke et heltall på 0 eller mer. Avklar eller velg ukjent.'; row.remainingMinutes = null }
    }
    if (kind === 'course') Object.assign(row, { code: get('courseHint'), year: get('year'), semester: /^(vår|spring|v)$/i.test(get('semester')) ? 'spring' : /^(høst|autumn|h)$/i.test(get('semester')) ? 'autumn' : '', university: get('university'), campus: get('campus'), campusCode: get('campusCode'), sourceObjectId: get('sourceObjectId'), credits: get('credits') === '' ? null : Number(get('credits').replace(',', '.')) })
    if (type && !/^(emne|course|event|undervisning|aktivitet|teaching|oppgave|task|frist|deadline)$/.test(type)) { row.unsupported = true; row.selected = false }
    return row
  })
  // Reconstruct the old title-derived keys for identical-byte migrations.
  // These are evidence only, never identity across different files/revisions.
  for (const column of columnNames.title.map(normal).filter(field => result.meta.fields.includes(field))) {
    const counts = new Map()
    rows.forEach((row, index) => {
      if (row.kind !== 'event' || row.explicitId) return
      const identity = matchKey({ ...row, title: clean(result.data[index][column]) })
      const ordinal = (counts.get(identity) || 0) + 1; counts.set(identity, ordinal)
      row.legacyKeys ||= {}; row.legacyKeys[column] = `event:${entryFingerprint(identity)}#${ordinal}`
    })
  }
  const termCounts = new Map()
  for (const row of rows.filter(row => row.legacyTermIdentity)) {
    const ordinal = (termCounts.get(row.legacyTermIdentity) || 0) + 1
    termCounts.set(row.legacyTermIdentity, ordinal)
    row.legacyKeys ||= {}
    row.legacyKeys.publishedTerm = `event:${entryFingerprint(row.legacyTermIdentity)}#${ordinal}`
    delete row.legacyTermIdentity
  }
  const proposals = new Map()
  for (const row of rows.filter(row => row.kind === 'event' && row.courseHint && row.activityKind !== 'personal')) {
    const identity = JSON.stringify([row.courseHint, row.university, Number(row.year), row.semester, ...(row.campus || row.campusCode || row.sourceObjectId ? [row.sourceObjectId || '', row.campus || '', row.campusCode || ''] : [])])
    const qualified = documentCourseIdentity({ ...row, code: row.courseHint })
    const proposal = rows.find(course => course.kind === 'course' && documentCourseIdentity(course) === qualified) || proposals.get(qualified)
    if (!proposal) proposals.set(qualified, baseRow('course', row.courseName, `Emnekode: ${row.courseHint}\n${row.courseName}`, 'Emne fra CSV', { code: row.courseHint, university: row.university, year: row.year, semester: row.semester, publishedTerm: Boolean(row.publishedTerm), campus: row.campus, campusCode: row.campusCode, sourceObjectId: row.sourceObjectId, credits: null, explicitId: `csv-course:${identity}` }))
    else if (row.courseName && proposal.title && proposal.title !== row.courseName) {
      proposal.title = ''; proposal.courseNameConflict = true
      warnings.push(`CSV-filen oppgir forskjellige navn for ${row.courseHint}. Velg et eksisterende emne eller avklar navnet.`)
    } else if (!proposal.title && !proposal.courseNameConflict) proposal.title = row.courseName
  }
  if (recognizedTp) for (const proposal of proposals.values()) if (!proposal.title && !proposal.courseNameConflict) proposal.nameStatus = 'provisional'
  return { ...finish([...proposals.values(), ...rows], warnings, 'csv'), ...(recognizedTp ? { recognizedCsv: 'tp' } : {}) }
}

function calendarCourse(event) {
  if (event.activityKind === 'personal') return { courseHint: '', code: '' }
  const explicit = event.fileCourse || {}
  const labelled = event.description.match(/(?:^|\n)(?:emne|course)\s*:\s*([\p{L}]{2,8}[- ]?\d{2,5}[\p{L}\d-]*)\s*(?:[-–:]\s*(.+))?/iu)
  // Course recognition is independent of activity classification. Inspect all
  // bounded title words, including later positions; repeated mentions
  // are one candidate, while several codes remain a shared clarification.
  // Ordinary prose such as "oppgave 12" is not a code. Later unlabelled
  // candidates must be compact tokens or explicitly uppercase spaced codes.
  // Room/chapter/task labels still need an explicit course field to be codes.
  const candidates = [...(event.title.match(/(?<![\p{L}\p{N}])[A-ZÆØÅ]{2,8}-?\d{2,5}[A-Z\d-]*(?![\p{L}\p{N}])/giu) || []), ...(event.title.match(/(?<![\p{L}\p{N}])[A-ZÆØÅ]{2,8} \d{2,5}[A-Z\d-]*(?![\p{L}\p{N}])/gu) || []), ...(event.title.match(/^[A-ZÆØÅ]{2,8}[- ]?\d{2,5}[A-Z\d-]*\b/i) || [])]
  const codes = [...new Set(candidates.filter(code => !/^(?:rom|room|sal|kapittel|chapter|oppgave|task|uke|week|side|page|kl)[ -]?\d/i.test(code)).map(code => code.replace(/ /g, '').toUpperCase()))]
  const code = clean(explicit.code || labelled?.[1] || (codes.length === 1 ? codes[0] : '')).replace(/ /g, '').toUpperCase()
  const date = osloLocal(event.start)
  return { courseHint: code || (codes.length > 1 ? codes.join(' / ') : ''), code, courseCodes: code ? [code] : codes, courseExplicit: Boolean(explicit.code || labelled), publishedTerm: Boolean(explicit.year && explicit.semester), courseName: clean(explicit.name || labelled?.[2]), university: clean(explicit.university), ...(explicit.sourceObjectId ? { sourceObjectId: clean(explicit.sourceObjectId) } : {}), ...(explicit.campus ? { campus: clean(explicit.campus) } : {}), ...(explicit.campusCode ? { campusCode: clean(explicit.campusCode) } : {}), year: explicit.year || Number(date.slice(0, 4)), semester: explicit.semester || (Number(date.slice(5, 7)) <= 6 ? 'spring' : 'autumn') }
}

export function parseDocumentIcs(text, { semester, year } = {}) {
  if (new TextEncoder().encode(text).length > DOCUMENT_LIMITS.textBytes) throw new Error('Kalenderfilen er større enn 2 MB.')
  if (!/^\s*BEGIN:VCALENDAR/im.test(text) || !/END:VCALENDAR\s*$/i.test(text)) throw new Error('Kalenderfilen er ufullstendig.')
  const root = new ICAL.Component(ICAL.parse(text)), rows = [], warnings = [], cancellations = []
  const calendarCancelled = clean(root.getFirstPropertyValue('method')).toUpperCase() === 'CANCEL'
  let complete = !calendarCancelled, range, accounting, period
  if (root.getAllSubcomponents('vevent').length) {
    const parsed = parseCalendar(text, { semester, year, courseId: '', fileImport: true })
    accounting = parsed.accounting; period = parsed.period
    if (parsed.events.length) range = { start: parsed.events.reduce((date, event) => event.start < date ? event.start : date, parsed.events[0].start), end: parsed.events.reduce((date, event) => event.end > date ? event.end : date, parsed.events[0].end) }
    complete = complete && parsed.authoritative
    cancellations.push(...parsed.cancellations.filter(item => item.uid).map(item => ({ calendarUid: entryFingerprint(item.uid), ...(item.recurrence ? { calendarOccurrence: entryFingerprint(JSON.stringify([item.uid, item.recurrence])) } : {}), ...(item.occurrenceInstant ? { calendarOccurrenceInstant: item.occurrenceInstant, calendarOccurrenceAliases: (item.occurrenceAliases || []).map(entryFingerprint), calendarOccurrenceLocalAliases: (item.occurrenceLocalAliases || []).map(entryFingerprint) } : {}) })))
    warnings.push(...parsed.warnings.filter(w => !w.includes('inneholder gjøremål')))
    if (!parsed.authoritative) warnings.push('Kalenderkilden er ikke bekreftet fullstendig. Eksisterende aktiviteter slettes ikke ved dokumentimport.')
    const courses = new Map()
    for (const event of parsed.events) {
      const context = calendarCourse(event), requiresGroupChoice = Boolean(event.groupMissing || event.explicitGroup)
      if (context.code) {
        const key = JSON.stringify([context.code, context.university, context.year, context.semester, ...(context.sourceObjectId || context.campus || context.campusCode ? [context.sourceObjectId || '', context.campus || '', ...(context.campusCode ? [context.campusCode] : [])] : [])])
        if (!courses.has(key)) courses.set(key, baseRow('course', context.courseName, `Emnekode: ${context.code}\n${context.courseName}\n${context.university}`, 'Emne fra kalenderen', { ...context, explicitId: `calendar-course:${key}`, credits: null }))
        else if (context.courseName && courses.get(key).title && courses.get(key).title !== context.courseName) {
          courses.get(key).title = ''; courses.get(key).courseNameConflict = true
          warnings.push(`Kalenderen oppgir forskjellige navn for ${context.code}. Velg et eksisterende emne eller avklar navnet.`)
        } else if (!courses.get(key).title && !courses.get(key).courseNameConflict) courses.get(key).title = context.courseName
      }
      rows.push(baseRow('event', event.title, `${event.title}\n${event.description}\n${event.start} – ${event.end}`, `VEVENT ${rows.length + 1}`, { ...context, explicitId: event.sourceKey, identityScope: context.university && context.code ? JSON.stringify([documentInstitution(context.university), normal(context.code), context.year, context.semester, context.sourceObjectId || '', normal(context.campus), normal(context.campusCode)]) : '', identityValidated: Boolean(context.university && context.code), calendarUid: entryFingerprint(event.sourceUid), calendarOccurrence: entryFingerprint(event.sourceKey), ...(event.occurrenceInstant ? { calendarOccurrenceInstant: event.occurrenceInstant, calendarOccurrenceAliases: (event.occurrenceAliases || []).map(entryFingerprint), calendarOccurrenceLocalAliases: (event.occurrenceLocalAliases || []).map(entryFingerprint) } : {}), startLocal: osloLocal(event.start), endLocal: event.point ? '' : osloLocal(event.end), point: Boolean(event.point), originalStart: event.start, originalEnd: event.end, location: event.location, description: event.description, activityKind: event.activityKind || '', activityType: event.activityType || '', publishedGroups: event.publishedGroups || [], allDay: event.allDay, transparent: event.transparent, information: event.information, selected: !requiresGroupChoice, requiresGroupChoice, explicitGroup: event.explicitGroup || '', groupHint: event.explicitGroup || (event.groupMissing ? 'Gruppe ikke oppgitt' : '') }))
    }
    // A later title-only code can refer to explicit course metadata elsewhere
    // in this file. Several qualified courses require one choice; they do not
    // manufacture an additional course with an unknown institution.
    for (const [key, proposal] of courses) if (!proposal.courseExplicit && !proposal.university) {
      const explicit = [...courses.values()].filter(other => other.courseExplicit && other.code === proposal.code && Number(other.year) === Number(proposal.year) && other.semester === proposal.semester)
      if (!explicit.length) continue
      for (const row of rows.filter(row => !row.courseExplicit && row.code === proposal.code && !row.university && Number(row.year) === Number(proposal.year) && row.semester === proposal.semester)) {
        if (explicit.length === 1) {
          for (const field of ['university', 'sourceObjectId', 'campus', 'campusCode', 'courseName']) if (explicit[0][field]) row[field] = explicit[0][field]
          row.identityValidated = Boolean(row.university && row.code)
          if (row.identityValidated) row.identityScope = documentCourseIdentity(row)
        }
      }
      courses.delete(key)
    }
    rows.unshift(...courses.values())
  }
  if (calendarCancelled && root.getAllSubcomponents('vtodo').length) warnings.push('Kalenderen er merket METHOD:CANCEL. Avlyste gjøremål må avklares uttrykkelig eller utelates.')
  const todoSyntaxIssues = calendarDateSyntaxIssues(text).vtodo
  for (const [index, component] of root.getAllSubcomponents('vtodo').entries()) {
    accounting ||= { total: 0, retained: 0, partial: 0, filtered: 0, rejected: 0, cancelled: 0, occurrences: 0, filteredOccurrences: 0, rejectedOccurrences: 0 }
    accounting.total++
    const invalid = validateCalendarDates(component, todoSyntaxIssues[index])
    if (invalid.length) {
      complete = false; accounting.rejected++
      warnings.push(calendarDateWarning(component, index, invalid))
      continue
    }
    accounting.retained++
    const title = clean(component.getFirstPropertyValue('summary')), due = component.getFirstPropertyValue('due'), property = component.getFirstProperty('due')
    let date = { value: '', raw: '', issues: [] }
    if (due) {
      const raw = due.toString(), zone = property.getParameter('tzid')
      date = parseDocumentDate(raw)
      if (!due.isDate && zone) {
        // RFC 5545 resolves a gap with the earlier offset and an overlap to
        // its first instant. Task precision checks still run after conversion.
        try { date = { ...parseDocumentDate(Temporal.PlainDateTime.from(raw).toZonedDateTime(zone, { disambiguation: 'compatible' }).toInstant().toString()), raw } }
        catch { date = { value: '', raw, issues: ['Fristens tidssone eller klokkeslett er ukjent eller tvetydig.'] } }
      } else if (!due.isDate && due.zone?.tzid !== 'UTC') date = { value: '', raw, issues: ['Fristen mangler tidssone. Bekreft dato og klokkeslett i norsk tid.'] }
    }
    const recurrenceProperties = ['rrule', 'rdate', 'recurrence-id'].filter(name => component.hasProperty(name))
    const recurring = recurrenceProperties.length > 0
    if (recurring) { complete = false; warnings.push('Gjentakende gjøremål blir ikke automatisk utvidet. Avklar én konkret oppgave eller utelat raden.') }
    const status = clean(component.getFirstPropertyValue('status')).toUpperCase(), percent = component.getFirstPropertyValue('percent-complete'), completedAt = component.getFirstPropertyValue('completed')
    const percentNumber = percent == null ? null : Number(percent)
    const invalidPercent = percent != null && (!Number.isInteger(percentNumber) || percentNumber < 0 || percentNumber > 100)
    const statusNeedsChoice = calendarCancelled || invalidPercent || status === 'COMPLETED' || status === 'CANCELLED' || percentNumber === 100 || Boolean(completedAt) || Boolean(status && !['NEEDS-ACTION', 'IN-PROCESS'].includes(status))
    const sourceStatus = [calendarCancelled ? 'Kalendermetode: METHOD:CANCEL (avlyst)' : '', status ? `Status: ${status}` : '', percent != null ? `Fullført: ${percent} %` : '', completedAt ? `Fullført tidspunkt: ${completedAt}` : ''].filter(Boolean).join(' · ')
    // Put interpretation evidence first so a long title/description cannot
    // push cancellation or recurrence outside the bounded source excerpt.
    const snippet = [sourceStatus, recurring ? `Gjentakelse: ${recurrenceProperties.map(name => name.toUpperCase()).join(', ')}` : '', title, `Frist: ${date.raw || 'ikke oppgitt'}`, component.getFirstPropertyValue('description') || ''].filter(Boolean).join('\n')
    rows.push(baseRow('task', title, snippet, `VTODO ${index + 1}`, { explicitId: clean(component.getFirstPropertyValue('uid')), deadlineLocal: date.value, deadlineRaw: date.raw, deadlineIssues: date.issues, selected: !recurring && !statusNeedsChoice, sourceStatus, statusNeedsChoice, statusChoice: statusNeedsChoice ? '?' : 'open', unsupported: recurring, requiresSubmission: false }))
  }
  if (!rows.length && !cancellations.length) warnings.push(period?.mode === 'filter' ? 'Ingen oppgaver eller kalenderaktiviteter ble funnet innen valgt kalendersemester. Endre periode for å vise filens datoer.' : 'Ingen gyldige oppgaver eller kalenderaktiviteter ble funnet. Kontroller avviste oppføringer og kildevarsler.')
  return { ...finish(rows, warnings, 'ics'), cancellations, complete, range, accounting, period }
}

// Check directory claims *and* actual expansion before Mammoth/JSZip allocate
// XML trees. Streaming decompression bounds dishonest uncompressed sizes too.
export async function guardDocxArchive(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer)
  if (bytes.length > DOCUMENT_LIMITS.binaryBytes || bytes.length < 22) throw new Error('DOCX-filen er ugyldig eller større enn 10 MB.')
  let eocd = -1
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) if (view.getUint32(at, true) === 0x06054b50 && at + 22 + view.getUint16(at + 20, true) === bytes.length) { eocd = at; break }
  if (eocd < 0 || view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true)) throw new Error('DOCX-arkivet er ufullstendig eller bruker et format som ikke støttes.')
  const count = view.getUint16(eocd + 10, true), offset = view.getUint32(eocd + 16, true), size = view.getUint32(eocd + 12, true)
  if (count > DOCUMENT_LIMITS.zipEntries || offset + size !== eocd) throw new Error('DOCX-arkivet har for mange deler eller en ugyldig innholdsoversikt.')
  const names = new Set(); let at = offset, total = 0
  for (let index = 0; index < count; index++) {
    if (at + 46 > eocd || view.getUint32(at, true) !== 0x02014b50) throw new Error('DOCX-arkivets innholdsoversikt er ugyldig.')
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true), compressed = view.getUint32(at + 20, true), expanded = view.getUint32(at + 24, true), nameLength = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true), local = view.getUint32(at + 42, true)
    const next = at + 46 + nameLength + extra + comment
    if (next > eocd || local + 30 > offset) throw new Error('DOCX-arkivets deler er ufullstendige.')
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
    if (names.has(name) || /(?:^|\/)\.\.(?:\/|$)|\\|vbaProject|\.exe$|\.js$/i.test(name) || name.startsWith('/') || flags & 1 || ![0, 8].includes(method)) throw new Error('DOCX-arkivet inneholder kryptering, makroer eller deler som ikke støttes.')
    names.add(name)
    if (expanded > DOCUMENT_LIMITS.zipEntryBytes || total + expanded > DOCUMENT_LIMITS.zipExpandedBytes || compressed > bytes.length) throw new Error('DOCX-filen blir for stor ved utpakking (maks 30 MB totalt og 8 MB per del).')
    if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method) throw new Error('DOCX-arkivets deler stemmer ikke med innholdsoversikten.')
    const localNameLength = view.getUint16(local + 26, true), start = local + 30 + localNameLength + view.getUint16(local + 28, true)
    if (start + compressed > offset || new TextDecoder().decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) throw new Error('DOCX-arkivets deler er ugyldige.')
    let actual = 0
    if (method === 0) actual = compressed
    else {
      const stream = new Blob([bytes.subarray(start, start + compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      const reader = stream.getReader()
      try { while (true) { const chunk = await reader.read(); if (chunk.done) break; actual += chunk.value.length; if (actual > DOCUMENT_LIMITS.zipEntryBytes || total + actual > DOCUMENT_LIMITS.zipExpandedBytes) throw new Error('DOCX-filen overskrider utpakkingsgrensen. Ingen tekst er importert.') } }
      finally { await reader.cancel().catch(() => {}) }
    }
    if (actual !== expanded) throw new Error('DOCX-arkivet oppgir feil størrelse på innholdet.')
    total += actual; at = next
  }
  if (at !== eocd || !names.has('word/document.xml') || !names.has('[Content_Types].xml')) throw new Error('Filen er ikke et fullstendig DOCX-dokument.')
  return { entries: count, expandedBytes: total }
}

export async function parseDocumentBytes(buffer, { format = 'text', semester, year, encoding, columns, onProgress = () => {} } = {}) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > (['pdf', 'docx'].includes(format) ? DOCUMENT_LIMITS.binaryBytes : DOCUMENT_LIMITS.textBytes)) throw new Error('Filen er for stor (PDF/DOCX maks 10 MB, tekst/CSV/ICS maks 2 MB).')
  if (format === 'docx') {
    await guardDocxArchive(buffer)
    const mammoth = (await import('mammoth/mammoth.browser.js')).default
    // Raw text only; Mammoth's default externalFileAccess=false is retained.
    // No HTML conversion, linked-image reads or embedded style maps are used.
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    assertText(result.value)
    const parsed = parseDocumentText(result.value, { format, blocks: result.value.split(/\n\n/).map((text, index) => ({ text, position: `Avsnitt ${index + 1}` })) })
    if (result.messages.length) { parsed.complete = false; parsed.warnings.push('Word-leseren rapporterte innhold som ikke kunne tolkes. Kontroller tekstutdragene; tabeller, bilder og formatering kan miste sammenheng.') }
    return parsed
  }
  if (format === 'pdf') {
    // The dedicated document worker owns both PDF.js layers. Its termination
    // also stops pathological PDF work; no nested worker survives cancellation.
    // PDF.js auto-binds to a worker's global message port at module evaluation.
    // This worker already owns that port, so expose its handler for the local
    // loopback transport without allowing PDF.js to claim the outer protocol.
    const outerPostMessage = globalThis.postMessage
    try { globalThis.postMessage = undefined; globalThis.pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs') }
    finally { globalThis.postMessage = outerPostMessage }
    const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
    const loading = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, enableScripting: false, enableXfa: false, disableFontFace: true, useSystemFonts: false, useWorkerFetch: false, disableAutoFetch: true, disableStream: true, disableRange: true, maxImageSize: 0, stopAtErrors: true, verbosity: 0 })
    loading.onPassword = () => loading.destroy()
    let pdf
    try {
      pdf = await loading.promise
      if (pdf.numPages > DOCUMENT_LIMITS.pages) throw new Error('PDF-filen har over 100 sider. Del dokumentet før import.')
      const blocks = []; let length = 0, emptyPages = 0
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber), reader = page.streamTextContent().getReader(); let text = ''
        try { while (true) { const part = await reader.read(); if (part.done) break; for (const item of part.value.items) if (typeof item.str === 'string') { const value = item.str + (item.hasEOL ? '\n' : ' '); length += value.length; if (length > DOCUMENT_LIMITS.textCharacters) throw new Error('PDF-filen inneholder for mye tekst. Del dokumentet før import.'); text += value } } }
        finally { await reader.cancel().catch(() => {}); page.cleanup() }
        if (text.trim().length < 10) emptyPages++
        blocks.push({ text, position: `Side ${pageNumber}` }); onProgress(`Leste side ${pageNumber} av ${pdf.numPages}`)
      }
      const text = blocks.map(b => b.text).join('\n')
      if (text.trim().length < 10) throw new Error('PDF-filen har ingen lesbar tekst. Den kan være skannet. Lim inn teksten eller registrer planen manuelt.')
      const parsed = parseDocumentText(text, { blocks, format })
      if (emptyPages) { parsed.complete = false; parsed.warnings.push(`${emptyPages} sider mangler lesbar tekst. Bilder og skannede sider er ikke tolket. Lim inn manglende tekst eller registrer den manuelt.`) }
      return parsed
    } finally { await loading.destroy() }
  }
  let text
  const bytes = new Uint8Array(buffer)
  const bomEncoding = bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191 ? 'utf-8' : bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : null
  if (encoding && !['utf-8', 'utf-16le', 'utf-16be', 'windows-1252'].includes(encoding)) throw new Error('Denne tegnkodingen støttes ikke.')
  try { text = new TextDecoder(format === 'csv' ? bomEncoding || encoding || 'utf-8' : 'utf-8', { fatal: true }).decode(buffer) }
  catch {
    if (format === 'csv' && !encoding && !bomEncoding) throw Object.assign(new Error('Ser teksten riktig ut? Kontroller navn og norske bokstaver i utdraget før du går videre.'), { clarification: { kind: 'encoding', suggestedEncoding: 'windows-1252', sample: csvSample(new TextDecoder('windows-1252', { fatal: true }).decode(bytes)) } })
    throw new Error('Tekstfilen kunne ikke dekodes med valgt tegnkoding. Lagre som UTF-8 eller velg riktig tegnkoding.')
  }
  if (format === 'csv' && !encoding && !bomEncoding && text.includes('\u0000')) {
    const candidates = ['utf-16le', 'utf-16be'].map(candidate => { try { const value = new TextDecoder(candidate, { fatal: true }).decode(bytes); return !/[\u0000\uFFFD]/.test(value) && /title|summary|tittel|dtstart|navn|type|course/i.test(value.split(/\r?\n/)[0]) ? { encoding: candidate, value } : null } catch { return null } }).filter(Boolean)
    throw Object.assign(new Error('Ser teksten riktig ut? Kontroller utdraget før du går videre.'), { clarification: { kind: 'encoding', ...(candidates.length === 1 ? { suggestedEncoding: candidates[0].encoding, sample: csvSample(candidates[0].value) } : { sample: 'Teksten kunne ikke vises sikkert. Åpne tekstdetaljene og velg en annen teksttolking.' }) } })
  }
  if (text.includes('\uFFFD') || text.includes('\u0000')) throw new Error('Tekstfilen inneholder ugyldige eller erstattede tegn. Kontroller tegnkodingen eller lagre på nytt som UTF-8.')
  return format === 'csv' ? parseDocumentCsv(text, { columns }) : format === 'ics' ? parseDocumentIcs(text, { semester, year }) : parseDocumentText(text)
}
