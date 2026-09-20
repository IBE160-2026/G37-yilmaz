import { emptyPlanner, osloLocal, toInstant, validateCourse, validPlanner } from './planner.js'
import { validDeadline, validTasks } from './tasks.js'
import { IMPORT_FIELDS, importTargets, validImportSources, DOCUMENT_DESCRIPTION_LIMIT, boundedImportWarnings } from './import-source-contract.js'
import { validEnvelope } from './storage.js'

const clone = value => structuredClone(value)
const normal = value => String(value || '').trim().toLocaleLowerCase('nb-NO')
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const snapshot = (row, value) => Object.fromEntries(IMPORT_FIELDS[row.kind].filter(key => value[key] !== undefined).map(key => [key, clone(value[key])]))
const token = state => JSON.stringify({ tasks: state.tasks, courses: state.planner?.courses, events: state.planner?.events, importSources: state.importSources })
const targetId = (sourceId, key) => `document:${sourceId}:${key}`
const ownsTarget = (sourceId, entry, current) => current?.importSourceId === sourceId && current?.importEntryKey === entry?.key
const isReference = (sourceId, entry, current) => entry?.kind === 'course' && (entry.reference === true || (current ? !ownsTarget(sourceId, entry, current) : entry.targetId !== targetId(sourceId, entry.key)))
const validBaselineNumber = (key, value) => key === 'year' ? Number.isInteger(value) && value >= 1900 && value <= 2200 : key === 'credits' ? value === null || Number.isFinite(value) && value >= 0 : key === 'remainingMinutes' ? value === null || Number.isSafeInteger(value) && value >= 0 : true
function acceptedBaseline(kind, baseline, values) {
  const result = clone(baseline)
  for (const key of IMPORT_FIELDS[kind]) if (['year', 'credits', 'remainingMinutes'].includes(key) && !validBaselineNumber(key, result[key])) result[key] = clone(values[key])
  return result
}
function retainedFields(kind, current) {
  if (kind === 'course') return { ...snapshot({ kind }, current), title: current.name }
  if (kind === 'event') return { ...snapshot({ kind }, current), startLocal: current.start ? osloLocal(current.start) : '', endLocal: current.end ? osloLocal(current.end) : '', originalStart: current.start, originalEnd: current.end }
  return snapshot({ kind }, current)
}

export function createDocumentImportPreview(state, parsed, { sourceId, name, contentHash = parsed.contentHash } = {}) {
  if (!/^[a-f0-9]{64}$/.test(contentHash || '')) throw new Error('Dokumentets lokale innholdsidentitet mangler.')
  if (!Array.isArray(parsed.rows) || parsed.rows.length > 1000) throw new Error('Dokumentet har for mange eller ugyldige oppføringer.')
  const sources = state.importSources || []
  const previous = sourceId ? sources.find(s => s.id === sourceId) : sources.find(s => s.contentHash === contentHash)
  if (sourceId && !previous) throw new Error('Kilden er endret eller fjernet. Lag forhåndsvisningen på nytt.')
  const id = previous?.id || `document:${contentHash}`
  parsed = { ...parsed, rows: [...parsed.rows], warnings: [...(parsed.warnings || [])] }
  const cancelledKeys = new Set()
  for (const cancellation of parsed.cancellations || []) {
    const matches = previous?.entries.filter(entry => entry.kind === 'event' && entry.calendarUid === cancellation.calendarUid && (!cancellation.calendarOccurrence || entry.calendarOccurrence === cancellation.calendarOccurrence)) || []
    if (!matches.length) parsed.warnings.push('En avlysning kunne ikke knyttes til en tidligere importert aktivitet. Velg riktig dokumentkilde for oppdatering; eksisterende aktiviteter er beholdt.')
    for (const entry of matches) {
      if (cancelledKeys.has(entry.key)) continue
      cancelledKeys.add(entry.key)
      const old = entry.sourceBase
      parsed.rows.push({ ...clone(old), kind: 'event', title: old.title, key: entry.key, matchKey: entry.matchKey, explicitId: `cancellation:${entry.key}`, calendarUid: entry.calendarUid, calendarOccurrence: entry.calendarOccurrence, selected: true, cancelled: true, courseHint: '', deadlineLocal: '', deadlineRaw: '', deadlineIssues: [], remainingMinutes: null, startLocal: osloLocal(old.start), endLocal: osloLocal(old.end), originalStart: old.start, originalEnd: old.end, snippet: `Kilden avlyser «${old.title}». Tidligere tidspunkt er beholdt som referanse; bekreftet avlysning frigjør kapasitet.`.slice(0, 600), position: 'Avlysning fra kalenderen' })
    }
  }
  if (parsed.rows.length > 1000) throw new Error('Oppdateringen har over 1000 oppføringer. Avgrens kalenderen før import.')
  const rows = clone(parsed.rows).map((row, index) => {
    const sourceRow = clone(row)
    const exact = previous?.entries.filter(entry => entry.key === row.key) || []
    const peers = previous?.entries.filter(entry => entry.matchKey === row.matchKey && entry.kind === row.kind) || []
    const incomingPeers = parsed.rows.filter(other => other.matchKey === row.matchKey)
    const match = (!row.identityAmbiguous || previous?.contentHash === contentHash) && exact.length === 1 ? exact[0] : peers.length === 1 && incomingPeers.length === 1 ? peers[0] : null
    const current = match && importTargets(state, match.kind).find(item => item.id === match.targetId)
    const candidates = !match && previous ? peers.length ? peers : previous.entries.filter(entry => !row.explicitId || entry.kind !== row.kind) : []
    const identical = previous?.contentHash === contentHash
    if (identical && match) {
      row.kind = match.kind
      Object.assign(row, retainedFields(row.kind, current || match.sourceBase))
    }
    const courses = (state.planner?.courses || []).filter(course => row.courseHint && [course.code, course.name].some(value => normal(value) === normal(row.courseHint)))
    const courseRows = parsed.rows.filter(other => other.kind === 'course' && row.kind !== 'course' && row.courseHint && normal(other.code) === normal(row.courseHint))
    const courseChoice = current && Object.hasOwn(current, 'courseId') ? current.courseId : courses.length === 1 && courseRows.length === 0 ? courses[0].id : courseRows.length === 1 && courses.length === 0 ? `row:${parsed.rows.indexOf(courseRows[0])}` : row.courseHint ? '?' : ''
    const knownCorrection = identical && match
    return { ...row, index, sourceRow, ...(identical && match && sourceRow.kind !== match.kind ? { retainedSourceBase: clone(match.sourceBase) } : {}), courseChoice, courseCandidates: courses.map(c => c.id), matchEntryKey: match?.key || '', matchCandidates: candidates.map(entry => ({ key: entry.key, kind: entry.kind, targetId: entry.targetId, title: entry.sourceBase.title || entry.sourceBase.name || entry.key })), matchChoice: candidates.length ? '?' : match?.key || 'new', targetId: match?.targetId || targetId(id, row.key), deletedLocally: Boolean(match && !current), recreate: false, deadlineMode: row.deadlineLocal ? 'value' : knownCorrection ? 'none' : row.deadlineRaw ? '?' : 'none', retainedCorrection: Boolean(knownCorrection && (sourceRow.kind !== row.kind || sourceRow.deadlineRaw && !sourceRow.deadlineLocal)), estimateResolved: Boolean(knownCorrection || !row.estimateIssue), conflictChoices: {}, conflicts: [], previousValues: current ? snapshot({ kind: match.kind }, current) : null, sourceBase: match?.sourceBase || null, courseTarget: row.kind === 'course' && match?.kind === 'course' ? match.targetId : '', typeChangeChoice: '?' }
  })
  const preview = { version: 1, baseToken: token(state), sourceId: id, previousRevision: previous?.revision || 0, contentHash, format: parsed.format, name: String(name || previous?.name || parsed.fileName || 'Innlimt studieplan').trim().slice(0, 300), rows, warnings: boundedImportWarnings(parsed.warnings), complete: parsed.complete !== false }
  refreshDocumentConflicts(state, preview)
  return preview
}

function rowValues(row, preview, state, { baseline = false } = {}) {
  if (baseline && row.retainedSourceBase && row.kind !== row.sourceRow.kind) return clone(row.retainedSourceBase)
  const value = baseline ? row.sourceRow : row
  if (row.kind === 'course') return { name: value.title?.trim(), code: (value.code || '').trim().toUpperCase(), university: value.university || '', semester: value.semester || '', year: Number(value.year) || null, credits: value.credits === '' || value.credits == null ? null : Number(value.credits), description: '' }
  const courseRow = row.courseChoice?.startsWith('row:') ? preview.rows[Number(row.courseChoice.slice(4))] : null
  const courseId = courseRow ? courseRow.courseTarget || courseRow.targetId : row.courseChoice && row.courseChoice !== '?' ? row.courseChoice : ''
  const course = state.planner?.courses.find(c => c.id === courseId) || (courseRow ? { code: courseRow.code, name: courseRow.title } : null)
  const base = { title: (value.title || '').trim(), courseId }
  if (row.kind === 'task') return { ...base, course: course?.code || course?.name || '', deadlineLocal: !baseline && row.deadlineMode === 'none' ? '' : value.deadlineLocal || '', remainingMinutes: value.remainingMinutes ?? null, requiresSubmission: Boolean(value.requiresSubmission) }
  let start = '', end = ''
  try {
    // Keep explicit ICS instants when the wall-clock values have not been edited;
    // this preserves a supplied offset in the repeated autumn hour.
    start = value.originalStart && value.startLocal === row.sourceRow.startLocal ? value.originalStart : toInstant(value.startLocal)
    end = value.originalEnd && value.endLocal === row.sourceRow.endLocal ? value.originalEnd : toInstant(value.endLocal)
  } catch { /* missing/ambiguous values are validated before commit */ }
  return { ...base, start, end, location: value.location || '', description: value.description || '', allDay: Boolean(value.allDay), cancelled: Boolean(value.cancelled), transparent: Boolean(value.transparent), information: Boolean(value.information) }
}

export function refreshDocumentConflicts(state, preview) {
  const previous = state.importSources?.find(source => source.id === preview.sourceId)
  for (const row of preview.rows) {
    const entry = previous?.entries.find(item => item.key === row.matchChoice)
    if (entry) { row.matchEntryKey = entry.key; row.targetId = entry.targetId; row.sourceBase = clone(entry.sourceBase) }
    else {
      const staleTarget = row.matchEntryKey ? row.targetId : ''
      row.matchEntryKey = ''; row.targetId = targetId(preview.sourceId, row.key); row.sourceBase = null
      if (row.courseTarget === staleTarget) row.courseTarget = ''
    }
    const current = entry && importTargets(state, entry.kind).find(item => item.id === entry.targetId)
    row.deletedLocally = Boolean(entry && !current)
    row.previousKind = entry?.kind || ''
    row.typeChanged = Boolean(entry && entry.kind !== row.kind)
    row.reference = isReference(preview.sourceId, entry, current)
    row.conflicts = []
    if (!current || !entry || row.typeChanged || row.reference) continue
    const incoming = rowValues(row, preview, state, { baseline: true })
    for (const field of IMPORT_FIELDS[row.kind]) if (!same(current[field], entry.sourceBase[field]) && !same(incoming[field], entry.sourceBase[field]) && !same(current[field], incoming[field])) row.conflicts.push({ field, base: clone(entry.sourceBase[field] ?? null), local: clone(current[field] ?? null), incoming: clone(incoming[field] ?? null) })
  }
  return preview
}

export function changeDocumentRowKind(state, preview, row, kind) {
  row.kind = kind; row.courseTarget = ''; row.typeChangeChoice = '?'; delete row.retainedSourceBase
  const entry = state.importSources?.find(source => source.id === preview.sourceId)?.entries.find(item => item.key === row.matchChoice)
  if (entry?.kind === kind) {
    const current = importTargets(state, kind).find(item => item.id === entry.targetId)
    Object.assign(row, retainedFields(kind, current || entry.sourceBase))
    if (kind !== row.sourceRow.kind) row.retainedSourceBase = clone(entry.sourceBase)
    if (kind === 'course') row.courseTarget = entry.targetId
    if (kind === 'task') row.deadlineMode = row.deadlineLocal ? 'value' : 'none'
  }
  refreshDocumentConflicts(state, preview)
}

function hasTargetRelations(state, sourceId, entry) {
  const id = entry.targetId
  if (state.importSources?.some(source => source.entries.some(other => (source.id !== sourceId || other.key !== entry.key) && other.kind === entry.kind && other.targetId === id))) return true
  if (entry.kind === 'course') return state.tasks.some(task => task.courseId === id) || state.planner.events.some(event => event.courseId === id) || state.planner.sources.some(source => source.courseId === id)
  if (entry.kind === 'task') return state.tasks.some(task => task.dependencyIds?.includes(id) || task.missingDependencyIds?.includes(id)) || state.sessions?.some(session => session.taskId === id) || state.workLogs?.some(log => log.taskId === id)
  return false
}

export function buildDocumentImportCommit(state, preview, { now = new Date() } = {}) {
  if (preview?.version !== 1 || preview.baseToken !== token(state)) return { ok: false, error: 'Planen er endret etter forhåndsvisningen. Les dokumentet på nytt før du bekrefter.', stale: true }
  const candidate = clone(state), errors = [], counts = { added: 0, updated: 0, unchanged: 0, omitted: 0 }
  candidate.planner ||= emptyPlanner(); candidate.importSources ||= []
  const oldSource = candidate.importSources.find(source => source.id === preview.sourceId)
  if ((oldSource?.revision || 0) !== preview.previousRevision) return { ok: false, error: 'Dokumentkilden er endret. Lag forhåndsvisningen på nytt.', stale: true }
  const entries = clone(oldSource?.entries || []), used = new Set()
  const selected = preview.rows.filter(row => row.selected)
  if (!selected.length) return { ok: false, error: 'Velg minst én oppføring. Ingenting er lagret.' }
  refreshDocumentConflicts(state, preview)
  for (const row of [...selected.filter(r => r.kind === 'course'), ...selected.filter(r => r.kind !== 'course')]) {
    const fail = (message, field = 'selected') => errors.push({ index: row.index, field, message: `${row.position}: ${message}` })
    if (!Object.hasOwn(IMPORT_FIELDS, row.kind)) { fail('Velg en gyldig oppføringstype.', 'kind'); continue }
    if (row.matchChoice === '?') { fail('Velg hvilken tidligere oppføring denne raden tilhører, eller velg ny.', 'matchChoice'); continue }
    if (row.typeChanged && row.typeChangeChoice !== 'replace') { fail('Typen er endret. Bekreft at den tidligere oppføringen erstattes, eller behold tidligere type.', 'typeChangeChoice'); continue }
    if (row.statusNeedsChoice && row.statusChoice !== 'open') { fail('Kilden markerer oppgaven som ferdig, avlyst eller med uklar status. Velg uttrykkelig å bruke den som åpent arbeid, eller utelat raden.', 'statusChoice'); continue }
    if (row.deletedLocally && !row.recreate) { fail('Oppføringen er slettet lokalt. Velg uttrykkelig å opprette den igjen, eller utelat raden.', 'recreate'); continue }
    if (row.kind !== 'course' && row.courseChoice === '?') { fail('Avklar emnet eller velg «Uten emne».', 'courseChoice'); continue }
    if (row.kind === 'task' && row.deadlineMode === '?') { fail('Avklar dato og klokkeslett, eller velg «Uten frist».', 'deadlineMode'); continue }
    if (row.kind === 'task' && row.estimateIssue && !row.estimateResolved) { fail('Avklar minuttene eller velg ukjent.', 'remainingMinutes'); continue }
    if (row.kind === 'task' && row.deadlineMode === 'value' && !validDeadline(row.deadlineLocal)) { fail('Oppgi en fullstendig dato og et gyldig klokkeslett.', 'deadlineLocal'); continue }
    if (row.kind === 'task' && row.deadlineMode === 'value') try { toInstant(row.deadlineLocal) } catch { fail('Fristens klokkeslett er ugyldig eller tvetydig ved tidsomstilling. Velg et entydig tidspunkt eller lagre uten frist.', 'deadlineLocal'); continue }
    if (row.courseChoice?.startsWith('row:') && !preview.rows[Number(row.courseChoice.slice(4))]?.selected) { fail('Det valgte nye emnet er ikke valgt for import.', 'courseChoice'); continue }
    const previousEntry = row.matchChoice === 'new' ? null : entries.find(entry => entry.key === row.matchChoice)
    const key = previousEntry?.key || row.key
    const collection = importTargets(candidate, row.kind)
    let id = previousEntry?.targetId || targetId(preview.sourceId, key)
    if (row.kind === 'course' && row.courseTarget) id = row.courseTarget
    const priorTarget = previousEntry && importTargets(candidate, previousEntry.kind).find(item => item.id === previousEntry.targetId)
    const reference = row.kind === 'course' && (previousEntry?.kind === 'course' && isReference(preview.sourceId, previousEntry, priorTarget) || row.courseTarget && row.courseTarget !== previousEntry?.targetId)
    const values = rowValues(row, preview, candidate)
    const referenceTarget = reference ? candidate.planner.courses.find(course => course.id === id) : null
    const baseline = referenceTarget ? snapshot({ kind: 'course' }, referenceTarget) : acceptedBaseline(row.kind, rowValues(row, preview, candidate, { baseline: true }), values)
    if (!reference && !values.title && !values.name || row.kind !== 'course' && !values.title) { fail('Skriv et navn.', 'title'); continue }
    if (row.kind !== 'course' && values.courseId && !candidate.planner.courses.some(course => course.id === values.courseId)) { fail('Det valgte emnet finnes ikke.', 'courseChoice'); continue }
    if (row.kind === 'event' && (!values.start || !values.end || Date.parse(values.end) <= Date.parse(values.start))) { fail('Oppgi gyldig start og slutt i norsk tid. Tvetydige klokkeslett ved tidsomstilling må avklares.', !values.start ? 'startLocal' : 'endLocal'); continue }
    if (row.kind === 'event' && (typeof values.description !== 'string' || values.description.length > DOCUMENT_DESCRIPTION_LIMIT)) { fail(`Beskrivelsen kan ha høyst ${DOCUMENT_DESCRIPTION_LIMIT} tegn. Kort ned beskrivelsen eller utelat raden.`, 'description'); continue }
    if (row.kind === 'task' && values.remainingMinutes !== null && (!Number.isSafeInteger(values.remainingMinutes) || values.remainingMinutes < 0)) { fail('Minutter må være et heltall på 0 eller mer, eller ukjent.', 'remainingMinutes'); continue }
    if (row.kind === 'course' && !reference) {
      if (!['spring', 'autumn'].includes(values.semester)) { fail('Velg et kalendersemester.', 'semester'); continue }
      if (!Number.isInteger(values.year) || values.year < 1900 || values.year > 2200) { fail('Oppgi et år mellom 1900 og 2200.', 'year'); continue }
      if (values.credits !== null && (!Number.isFinite(values.credits) || values.credits < 0)) { fail('Studiepoeng må være et positivt tall eller stå tomt.', 'credits'); continue }
    }
    if (!previousEntry && entries.some(entry => entry.key === key)) { fail('Denne kildeoppføringen finnes allerede. Velg den tidligere oppføringen og avklar typen før oppdatering.'); continue }
    if (used.has(key)) { fail('To valgte rader peker på samme kildeoppføring. Avklar hvilke som skal importeres.'); continue }
    used.add(key)
    if (previousEntry && row.kind === 'course' && id !== previousEntry.targetId && ownsTarget(preview.sourceId, previousEntry, priorTarget)) { fail('Et emne som er opprettet av denne kilden kan ikke erstattes med en annen emnekobling. Behold emnet eller utelat raden.'); continue }
    if (previousEntry && previousEntry.kind !== row.kind && priorTarget) {
      if (!ownsTarget(preview.sourceId, previousEntry, priorTarget) || hasTargetRelations(candidate, preview.sourceId, previousEntry)) { fail('Den tidligere oppføringen har andre koblinger eller eies ikke av denne kilden. Behold tidligere type eller utelat raden; koblede data er beholdt.'); continue }
      const previousCollection = importTargets(candidate, previousEntry.kind)
      previousCollection.splice(previousCollection.indexOf(priorTarget), 1)
    }
    const existing = collection.find(item => item.id === id)
    if (existing && !reference && (!previousEntry || previousEntry.kind !== row.kind || !ownsTarget(preview.sourceId, previousEntry, existing))) { fail('Måloppføringen tilhører ikke denne kildeoppføringen. Avklar koblingen uten å overskrive eksisterende data.'); continue }
    let result
    try {
      if (reference) {
        result = candidate.planner.courses.find(course => course.id === id)
        if (!result) throw new Error('Det valgte eksisterende emnet finnes ikke.')
      } else if (row.kind === 'course') result = validateCourse({ ...values, id })
      else if (row.kind === 'task') result = { id, ...values, estimatedMinutes: null, completed: false, submitted: false }
      else result = { id, ...values, notes: '' }
    } catch (error) { fail(error.message); continue }
    if (existing && previousEntry && previousEntry.kind === row.kind && !reference) {
      result = clone(existing)
      for (const field of IMPORT_FIELDS[row.kind]) {
        const baseValue = previousEntry.sourceBase[field], localValue = existing[field], incomingValue = baseline[field]
        const conflict = row.conflicts.find(c => c.field === field)
        if (conflict && !['local', 'incoming'].includes(row.conflictChoices[field])) { fail(`Både du og kilden har endret «${field}». Velg hvilken verdi du vil beholde.`, `conflict:${field}`); continue }
        const editedInPreview = !same(values[field], incomingValue)
        if (conflict && row.conflictChoices[field] === 'local') continue
        if (editedInPreview || conflict && row.conflictChoices[field] === 'incoming' || same(localValue, baseValue) || same(localValue, incomingValue)) result[field] = values[field]
      }
    }
    // Mapping a course to an existing record is a reference, never ownership
    // takeover from another document or public provider.
    if (!reference) { result.importSourceId = preview.sourceId; result.importEntryKey = key }
    if (existing) { if (same(existing, result)) counts.unchanged++; else { collection.splice(collection.indexOf(existing), 1, result); counts.updated++ } }
    else { collection.push(result); counts.added++ }
    const entry = { key, kind: row.kind, targetId: id, sourceBase: baseline, snippet: row.snippet.slice(0, 600), position: row.position.slice(0, 100), matchKey: row.matchKey, ...(reference ? { reference: true } : {}), ...(row.calendarUid ? { calendarUid: row.calendarUid, calendarOccurrence: row.calendarOccurrence } : {}) }
    const entryIndex = entries.findIndex(item => item.key === key)
    if (entryIndex < 0) entries.push(entry); else entries[entryIndex] = entry
  }
  if (errors.length) return { ok: false, error: 'Avklar de markerte oppføringene. Ingen del av planen er lagret.', errors }
  counts.omitted = preview.rows.length - selected.length
  // Omitted rows and absence from a revision do not delete targets or baselines.
  const evidence = { complete: preview.complete !== false, warnings: boundedImportWarnings(preview.warnings) }
  const unchangedSource = oldSource && oldSource.contentHash === preview.contentHash && same(oldSource.entries, entries) && oldSource.complete === evidence.complete && same(oldSource.warnings, evidence.warnings)
  const source = { id: preview.sourceId, kind: 'document', format: preview.format, name: preview.name, contentHash: preview.contentHash, revision: oldSource ? unchangedSource ? oldSource.revision : oldSource.revision + 1 : 1, createdAt: oldSource?.createdAt || now.toISOString(), lastUpdated: now.toISOString(), entries, ...evidence }
  if (oldSource) candidate.importSources.splice(candidate.importSources.indexOf(oldSource), 1, source); else candidate.importSources.push(source)
  if (!validTasks(candidate.tasks) || !validPlanner(candidate.planner) || !validImportSources(candidate.importSources, candidate) || !validEnvelope(candidate, { relations: true })) return { ok: false, error: 'Planen inneholder en ugyldig verdi eller kobling. Ingen del av planen er lagret.' }
  return { ok: true, state: candidate, candidate, counts, source }
}
