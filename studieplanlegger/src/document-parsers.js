import Papa from 'papaparse'
import ICAL from 'ical.js'
import { Temporal } from '@js-temporal/polyfill'
import { parseCalendar } from './calendar-import.js'
import { OSLO, osloLocal, toInstant } from './planner.js'
import { validDeadline } from './tasks.js'
import { DOCUMENT_DESCRIPTION_LIMIT } from './import-source-contract.js'

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
      const instant = Temporal.Instant.from(raw), local = osloLocal(instant.toString())
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
    const identity = row.explicitId ? `${row.kind}:id:${row.explicitId}` : row.matchKey
    const index = counts.get(identity) || 0
    counts.set(identity, index + 1)
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
  kind: ['type', 'kind'], title: ['tittel', 'title', 'oppgave', 'navn', 'name', 'summary'], courseHint: ['emne', 'course', 'emnekode', 'coursecode'],
  deadline: ['frist', 'deadline', 'due', 'deadlineLocal'], start: ['start', 'starttid', 'startLocal'], end: ['slutt', 'end', 'endLocal'],
  explicitId: ['id', 'uid'], remainingMinutes: ['minutter', 'minutes', 'remainingminutes'], location: ['sted', 'location'], year: ['år', 'year'], semester: ['semester'], university: ['institusjon', 'university'], credits: ['studiepoeng', 'credits'],
}
export function parseDocumentCsv(text) {
  assertText(text)
  const result = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', dynamicTyping: false, delimitersToGuess: [',', ';', '\t'], transformHeader: normal })
  const errors = result.errors.filter(error => !(error.code === 'UndetectableDelimiter' && result.meta.fields?.length === 1 && result.data.every(row => Object.keys(row).length === 1)))
  if (errors.length) throw new Error(`CSV-filen kunne ikke leses fullstendig: ${errors[0].message}. Kontroller anførselstegn og antall kolonner.`)
  const columns = Object.fromEntries(Object.entries(columnNames).map(([key, names]) => [key, result.meta.fields.find(field => names.map(normal).includes(field))]))
  if (!columns.title) throw new Error('CSV-filen trenger en navngitt tittelkolonne, for eksempel «tittel» eller «oppgave».')
  if (result.meta.renamedHeaders && Object.keys(result.meta.renamedHeaders).length) throw new Error('CSV-filen har flere kolonner med samme navn. Gi dem entydige navn før import.')
  const warnings = [], unknown = result.meta.fields.filter(field => !Object.values(columns).includes(field))
  if (unknown.length) warnings.push(`Disse CSV-kolonnene er bare synlige i kildeutdraget og blir ikke egne felt: ${unknown.join(', ')}.`)
  const rows = result.data.map((data, index) => {
    const get = key => clean(data[columns[key]])
    const type = normal(get('kind')), kind = /^(emne|course)$/.test(type) ? 'course' : /^(event|undervisning|aktivitet|teaching)$/.test(type) ? 'event' : 'task'
    const date = parseDocumentDate(get('deadline')), start = parseDocumentDate(get('start')), end = parseDocumentDate(get('end'))
    const row = baseRow(kind, get('title'), Object.entries(data).map(([key, value]) => `${key}: ${value}`).join('; '), `CSV-rad ${index + 2}`, { courseHint: get('courseHint'), explicitId: get('explicitId'), deadlineLocal: date.value, deadlineRaw: date.raw, deadlineIssues: date.issues, startLocal: start.value, endLocal: end.value, startRaw: start.raw, endRaw: end.raw, location: get('location') })
    if (get('remainingMinutes')) {
      if (/^\d+$/.test(get('remainingMinutes')) && Number.isSafeInteger(Number(get('remainingMinutes')))) row.remainingMinutes = Number(get('remainingMinutes'))
      else { row.estimateIssue = 'Minutter er ikke et heltall på 0 eller mer. Avklar eller velg ukjent.'; row.remainingMinutes = null }
    }
    if (kind === 'course') Object.assign(row, { code: get('courseHint'), year: get('year'), semester: /^(vår|spring|v)$/i.test(get('semester')) ? 'spring' : /^(høst|autumn|h)$/i.test(get('semester')) ? 'autumn' : '', university: get('university'), credits: get('credits') === '' ? null : Number(get('credits').replace(',', '.')) })
    if (type && !/^(emne|course|event|undervisning|aktivitet|teaching|oppgave|task|frist|deadline)$/.test(type)) { row.unsupported = true; row.selected = false }
    return row
  })
  return finish(rows, warnings, 'csv')
}

export function parseDocumentIcs(text, { semester, year } = {}) {
  if (new TextEncoder().encode(text).length > DOCUMENT_LIMITS.textBytes) throw new Error('Kalenderfilen er større enn 2 MB.')
  if (!/^\s*BEGIN:VCALENDAR/im.test(text) || !/END:VCALENDAR\s*$/i.test(text)) throw new Error('Kalenderfilen er ufullstendig.')
  const root = new ICAL.Component(ICAL.parse(text)), rows = [], warnings = [], cancellations = []
  const calendarCancelled = clean(root.getFirstPropertyValue('method')).toUpperCase() === 'CANCEL'
  let complete = !calendarCancelled
  if (root.getAllSubcomponents('vevent').length) {
    if (!semester || !year) throw new Error('Velg kalendersemester og år for å avgrense undervisningen. Datoene hentes fra kalenderen.')
    const parsed = parseCalendar(text, { semester, year, courseId: '' })
    complete = complete && parsed.authoritative
    cancellations.push(...parsed.cancellations.filter(item => item.uid).map(item => ({ calendarUid: entryFingerprint(item.uid), ...(item.recurrence ? { calendarOccurrence: entryFingerprint(JSON.stringify([item.uid, item.recurrence])) } : {}) })))
    warnings.push(...parsed.warnings.filter(w => !w.includes('inneholder gjøremål')))
    if (!parsed.authoritative) warnings.push('Kalenderen er ufullstendig eller inneholder avlysninger. Eksisterende aktiviteter slettes ikke ved dokumentimport.')
    for (const event of parsed.events) rows.push(baseRow('event', event.title, `${event.title}\n${event.description}\n${event.start} – ${event.end}`, `VEVENT ${rows.length + 1}`, { explicitId: event.sourceKey, calendarUid: entryFingerprint(event.sourceUid), calendarOccurrence: entryFingerprint(event.sourceKey), startLocal: osloLocal(event.start), endLocal: osloLocal(event.end), originalStart: event.start, originalEnd: event.end, location: event.location, description: event.description, allDay: event.allDay, transparent: event.transparent, information: event.information, selected: !event.groupMissing, groupHint: event.group }))
  }
  if (calendarCancelled && root.getAllSubcomponents('vtodo').length) warnings.push('Kalenderen er merket METHOD:CANCEL. Avlyste gjøremål må avklares uttrykkelig eller utelates.')
  for (const [index, component] of root.getAllSubcomponents('vtodo').entries()) {
    const title = clean(component.getFirstPropertyValue('summary')), due = component.getFirstPropertyValue('due'), property = component.getFirstProperty('due')
    let date = { value: '', raw: '', issues: [] }
    if (due) {
      const raw = due.toString(), zone = property.getParameter('tzid')
      date = parseDocumentDate(raw)
      if (!due.isDate && zone) {
        try { date = { ...parseDocumentDate(Temporal.PlainDateTime.from(raw).toZonedDateTime(zone, { disambiguation: 'reject' }).toInstant().toString()), raw } }
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
  if (!rows.length && !cancellations.length) warnings.push('Ingen oppgaver eller undervisning ble funnet innen valgt kalendersemester.')
  return { ...finish(rows, warnings, 'ics'), cancellations, complete }
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

export async function parseDocumentBytes(buffer, { format = 'text', semester, year, onProgress = () => {} } = {}) {
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
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer) } catch { throw new Error('Tekstfilen er ikke UTF-8. Lagre den som UTF-8 eller lim inn teksten.') }
  return format === 'csv' ? parseDocumentCsv(text) : format === 'ics' ? parseDocumentIcs(text, { semester, year }) : parseDocumentText(text)
}
