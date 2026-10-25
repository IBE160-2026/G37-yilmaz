import { documentInstitution, documentCourseIdentity, invalidateDocumentCourseName } from './document-course-identity.js'
import { emptyPlanner, osloLocalExact as osloLocal, toInstant, validateCourse, validPlanner } from './planner.js'
import { validDeadline, validTasks } from './tasks.js'
import { IMPORT_FIELDS, importTargets, validImportSources, DOCUMENT_DESCRIPTION_LIMIT, boundedImportWarnings } from './import-source-contract.js'
import { validEnvelope } from './storage.js'
import { Temporal } from '@js-temporal/polyfill'

const clone = value => structuredClone(value)
const normal = value => String(value || '').trim().toLocaleLowerCase('nb-NO')
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const nameStatusFields = new Set(['nameStatus', 'titleStatus'])
const snapshot = (row, value) => Object.fromEntries(IMPORT_FIELDS[row.kind].filter(key => value[key] !== undefined).map(key => [key, clone(value[key])]))
const token = state => JSON.stringify(state)
const targetId = (sourceId, key) => `document:${sourceId}:${key}`
const eventTimeIssue = (row, key) => {
  const value = row[`${key}Local`]
  if (!value) return row[`${key}Issues`]?.join(' ') || `${key === 'start' ? 'Start' : 'Slutt'} mangler. Kontroller kilden eller utelat aktiviteten.`
  try { Temporal.PlainDateTime.from(value) } catch { return 'Dato eller klokkeslett er ugyldig. Kontroller verdien.' }
  return 'Klokkeslettet finnes ikke eller er tvetydig ved tidsomstilling. Velg et entydig tidspunkt; kildens UTC-avvik vises under tidspunktsdetaljer.'
}
const ownsTarget = (sourceId, entry, current) => current?.importSourceId === sourceId && current?.importEntryKey === entry?.key
const isReference = (sourceId, entry, current) => entry?.kind === 'course' && (entry.reference === true || (current ? !ownsTarget(sourceId, entry, current) : entry.targetId !== targetId(sourceId, entry.key)))
const validBaselineNumber = (key, value) => key === 'year' ? Number.isInteger(value) && value >= 1900 && value <= 2200 : key === 'credits' ? value === null || Number.isFinite(value) && value >= 0 : key === 'remainingMinutes' ? value === null || Number.isSafeInteger(value) && value >= 0 : true
const compatibleCourse = (row, course) => (!row.sourceObjectId || !course.sourceObjectId || row.sourceObjectId === course.sourceObjectId) && ['campus', 'campusCode'].every(key => !row[key] || !course[key] || normal(row[key]) === normal(course[key])) && (!row.year || !course.year || Number(row.year) === Number(course.year)) && (!row.semester || !course.semester || row.semester === course.semester) && (!row.university || !course.university || documentInstitution(row.university) === documentInstitution(course.university))
const qualifiedCourse = (row, course, { allowUnknownInstitution = false } = {}) => compatibleCourse(row, course) && (!row.sourceObjectId || row.sourceObjectId === course.sourceObjectId) && ['campus', 'campusCode'].every(key => !row[key] || normal(row[key]) === normal(course[key])) && row.year && row.semester && Number(row.year) === Number(course.year) && row.semester === course.semester && (row.university || allowUnknownInstitution) && documentInstitution(row.university) === documentInstitution(course.university)
const publishedTermCourse = (row, course) => Boolean(row.publishedTerm && normal(row.code || row.courseHint) === normal(course.code) && qualifiedCourse({ ...row, year: course.year, semester: course.semester }, course))
function publishedTermSource(state, source, row, entry) {
  if (!row.publishedTerm || entry.kind !== 'event' || entry.calendarUid !== row.calendarUid || entry.key !== row.key) return false
  const owned = source.entries.filter(item => item.kind === 'course' && item.targetId === entry.sourceBase.courseId && item.reference !== true)
  if (owned.length !== 1 || !publishedTermCourse(row, owned[0].sourceBase)) return false
  const course = state.planner?.courses.find(item => item.id === owned[0].targetId)
  return course ? ownsTarget(source.id, owned[0], course) : owned[0].targetId === targetId(source.id, owned[0].key)
}
// Old scope tuples omitted trailing optional fields. Only normalize that
// documented representation, never conflicting institutions or course context.
function compatibleScope(saved, incoming) {
  if (!saved) return true
  try {
    const normalize = value => {
      const parts = JSON.parse(value)
      if (!Array.isArray(parts) || parts.length < 4 || parts.length > 7) return null
      return JSON.stringify([documentInstitution(parts[0]), normal(parts[1]), Number(parts[2]), parts[3], parts[4] || '', normal(parts[5]), normal(parts[6])])
    }
    const first = normalize(saved)
    return first !== null && first === normalize(incoming)
  } catch { return false }
}
function deletedCourseDetails(state, sourceId, entry, row) {
  if (entry?.kind !== 'course') return null
  const records = [...(state.history?.undo || []), ...(state.history?.trash || [])].flatMap(change => change.changes || []).filter(change => change.path === 'planner.courses' && change.id === entry.targetId && change.after === null && change.before && ownsTarget(sourceId, entry, change.before) && normal(change.before.code) === normal(row.code) && compatibleCourse(row, change.before)).map(change => snapshot({ kind: 'course' }, change.before))
  const unique = [...new Map(records.map(record => [JSON.stringify(record), record])).values()]
  return unique.length === 1 ? unique[0] : null
}
function acceptedBaseline(kind, baseline, values) {
  const result = clone(baseline)
  for (const key of IMPORT_FIELDS[kind]) if (['year', 'credits', 'remainingMinutes'].includes(key) && !validBaselineNumber(key, result[key])) result[key] = clone(values[key])
  return result
}
function retainedFields(kind, current) {
  if (kind === 'course') return { ...snapshot({ kind }, current), title: current.name }
  if (kind === 'event') return { ...snapshot({ kind }, current), startLocal: current.start ? osloLocal(current.start) : '', endLocal: !current.point && current.end ? osloLocal(current.end) : '', originalStart: current.start, originalEnd: current.end }
  return snapshot({ kind }, current)
}
function eventTimes(value) {
  let start = '', end = ''
  try {
    start = value.originalStart && value.startLocal === osloLocal(value.originalStart) ? value.originalStart : toInstant(value.startLocal)
    end = value.point && !value.endLocal ? start : value.originalEnd && value.endLocal === osloLocal(value.originalEnd) ? value.originalEnd : toInstant(value.endLocal)
  } catch { /* missing/ambiguous values are validated before commit */ }
  return { start, end }
}
function sourceTiming(row) {
  const times = eventTimes(row)
  const time = key => Number.isFinite(Date.parse(times[key])) ? new Date(times[key]).toISOString() : `raw:${row[`${key}Raw`] || row[`${key}Local`] || ''}`
  return { start: time('start'), end: time('end'), point: Boolean(row.point), allDay: Boolean(row.allDay) }
}
function unchangedSourceTiming(row, entry, identical) {
  if (entry.sourceTiming) return same(sourceTiming(row), entry.sourceTiming)
  // Older sources have only their normalized baseline. Identical bytes or
  // valid equal instants prove unchanged timing; missing/invalid legacy ends
  // cannot prove that a changed file still has the same uncertainty.
  if (identical) return true
  const incoming = eventTimes(row), baseline = entry.sourceBase
  const instant = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : null
  return instant(incoming.start) !== null && instant(incoming.end) !== null && instant(incoming.start) === instant(baseline.start) && instant(incoming.end) === instant(baseline.end) && Boolean(row.point) === Boolean(baseline.point) && Boolean(row.allDay) === Boolean(baseline.allDay)
}
const conditionalPointFields = new Set(['end', 'point', 'pointProvenance', 'allDay'])
function expiredUserPoint(row, entry, current) {
  return row.kind === 'event' && current?.pointProvenance === 'user' && !unchangedSourceTiming(row.sourceRow, entry, false)
}
function matchingCalendarOccurrence(entry, row) {
  if (entry.kind !== 'event' || !row.calendarUid || entry.calendarUid !== row.calendarUid) return false
  if (!row.calendarOccurrenceInstant) return entry.calendarOccurrence === row.calendarOccurrence
  if (entry.calendarOccurrenceInstant) return entry.calendarOccurrenceInstant === row.calendarOccurrenceInstant
  if (row.calendarOccurrenceAliases?.includes(entry.calendarOccurrence)) return true
  // Old wall-clock hashes did not record TZID. Only an unchanged original
  // source start can qualify them; moved/edited times are never guessed.
  if (!(row.calendarOccurrenceLocalAliases || []).includes(entry.calendarOccurrence) && entry.calendarOccurrence !== row.calendarOccurrence) return false
  return row.calendarOccurrenceInstant.length === 10 ? osloLocal(entry.sourceBase.start).slice(0, 10) === row.calendarOccurrenceInstant : Date.parse(entry.sourceBase.start) === Date.parse(row.calendarOccurrenceInstant)
}

// An omitted institution is recoverable only through an actual saved entry,
// never through a course code or a lookup result alone. The other dimensions
// must still agree with the saved course, including any supplied campus/id.
function savedAffiliation(state, source, row) {
  if (!source || row.kind !== 'event' || row.university || row.identityAmbiguous || !row.courseHint || !(row.calendarUid || row.explicitId)) return null
  const matches = source.entries.filter(entry => entry.kind === 'event' && entry.key === row.key)
  if (matches.length !== 1) return null
  const entry = matches[0]
  const courses = source.entries.filter(item => item.kind === 'course' && item.targetId === entry.sourceBase.courseId)
  if (courses.length !== 1) return null
  const courseEntry = courses[0]
  const course = state.planner?.courses.find(item => item.id === courseEntry.targetId) || courseEntry.sourceBase
  // The saved relationship also preserves a deliberately unknown institution.
  // This exception does not make unknown institutions eligible for code matching.
  if (normal(row.courseHint) !== normal(course.code) || !qualifiedCourse({ ...row, university: course.university }, course, { allowUnknownInstitution: true })) return null
  return { university: course.university, entryKey: entry.key, courseEntryKey: courseEntry.key, courseId: courseEntry.targetId }
}
function restoreAffiliations(state, source, rows) {
  if (!source) return rows
  const context = row => documentCourseIdentity({ ...row, code: row.kind === 'course' ? row.code : row.courseHint })
  const restored = rows.map(row => {
    const affiliation = savedAffiliation(state, source, row)
    return affiliation ? { ...row, university: affiliation.university, restoredAffiliation: affiliation } : row
  })
  return restored.flatMap((row, index) => {
    if (row.kind !== 'course' || row.university) return [row]
    const members = rows.map((member, i) => ({ original: member, restored: restored[i] })).filter(({ original }) => original.kind === 'event' && context(original) === context(rows[index]))
    const proven = [...new Map(members.filter(member => member.restored.restoredAffiliation).map(member => [member.restored.restoredAffiliation.courseId, member.restored.restoredAffiliation])).values()]
    if (!proven.length) return [row]
    // A parser may collapse two code-only proposals after the source drops its
    // institutions. Recreate each proven relationship; unmatched rows retain
    // the unknown proposal so they cannot inherit someone else's affiliation.
    // A proven unknown course can already have that exact proposal key.
    const keepUnknown = members.some(member => !member.restored.restoredAffiliation) && !proven.some(affiliation => affiliation.courseEntryKey === row.key)
    return [...(keepUnknown ? [row] : []), ...proven.map(affiliation => {
      // Removing affiliation can collapse distinct same-code course proposals.
      // Their source names belong to the UID-proven members, not the combined
      // unknown group. Genuine disagreement within that course stays unresolved.
      const names = [...new Set(members.filter(member => member.restored.restoredAffiliation?.courseId === affiliation.courseId).map(member => member.original.courseName?.trim()).filter(Boolean))]
      return { ...row, ...(row.courseNameConflict ? { title: names.length === 1 ? names[0] : '', courseNameConflict: names.length > 1 } : {}), key: affiliation.courseEntryKey, university: affiliation.university, restoredAffiliation: { ...affiliation, entryKey: affiliation.courseEntryKey } }
    })]
  })
}

export function createDocumentImportPreview(state, parsed, { sourceId, name, contentHash = parsed.contentHash } = {}) {
  if (!/^[a-f0-9]{64}$/.test(contentHash || '')) throw new Error('Dokumentets lokale innholdsidentitet mangler.')
  if (!Array.isArray(parsed.rows) || parsed.rows.length > 1000) throw new Error('Dokumentet har for mange eller ugyldige oppføringer.')
  parsed = { ...parsed, rows: parsed.rows.map(row => row.identityValidated ? { ...row, identityScope: documentCourseIdentity({ ...row, code: row.code || row.courseHint }) } : row) }
  const sources = state.importSources || []
  const exactSources = sources.filter(source => source.contentHash === contentHash || source.id === `document:${contentHash}`)
  if (!sourceId && exactSources.length > 1) throw new Error('Dokumentet viser til flere tidligere kilder. Velg hvilken kilde som skal oppdateres før du leser på nytt.')
  let previous = sourceId ? sources.find(s => s.id === sourceId) : exactSources[0]
  // Reuse across file/link entry points only with unique, validated identities
  // in the same institution/course/period. Similar names never establish this.
  if (!previous && !sourceId) {
    const identified = parsed.rows.filter(row => row.kind === 'event' && row.calendarUid && !row.identityAmbiguous && (row.identityValidated || !row.university && row.courseHint))
    const compatible = (source, row, entry) => Boolean(row.identityValidated && entry.identityScope && compatibleScope(entry.identityScope, row.identityScope) || savedAffiliation(state, source, row) || publishedTermSource(state, source, row, entry))
    const matchesRow = (entry, row) => entry.key === row.key || row.calendarOccurrenceInstant && matchingCalendarOccurrence(entry, row)
    const matches = sources.filter(source => identified.some(row => source.entries.some(entry => matchesRow(entry, row) && compatible(source, row, entry))) && identified.every(row => !source.entries.some(entry => matchesRow(entry, row) && !compatible(source, row, entry))))
    if (matches.length === 1) previous = matches[0]
    else if (matches.length > 1) throw new Error('Kalenderens identiteter finnes i flere kilder. Velg hvilken kilde som skal oppdateres før du leser på nytt.')
  }
  if (sourceId && !previous) throw new Error('Kilden er endret eller fjernet. Lag forhåndsvisningen på nytt.')
  const id = previous?.id || `document:${contentHash}`
  const originalParsed = clone(parsed)
  parsed = { ...parsed, rows: restoreAffiliations(state, previous, parsed.rows), warnings: [...(parsed.warnings || [])] }
  const cancelledKeys = new Set()
  for (const cancellation of parsed.cancellations || []) {
    const possible = previous?.entries.filter(entry => entry.kind === 'event' && entry.calendarUid === cancellation.calendarUid && (!cancellation.calendarOccurrence || matchingCalendarOccurrence(entry, cancellation))) || []
    const matches = cancellation.calendarOccurrence && possible.length !== 1 ? [] : possible
    if (!matches.length) parsed.warnings.push('En avlysning kunne ikke knyttes til en tidligere importert aktivitet. Velg riktig dokumentkilde for oppdatering; eksisterende aktiviteter er beholdt.')
    for (const entry of matches) {
      if (cancelledKeys.has(entry.key)) continue
      cancelledKeys.add(entry.key)
      const old = entry.sourceBase
      parsed.rows.push({ ...clone(old), kind: 'event', title: old.title, key: entry.key, matchKey: entry.matchKey, explicitId: `cancellation:${entry.key}`, ...(entry.identityScope ? { identityScope: entry.identityScope, identityValidated: true } : {}), calendarUid: entry.calendarUid, calendarOccurrence: entry.calendarOccurrence, ...(cancellation.calendarOccurrenceInstant ? { calendarOccurrenceInstant: cancellation.calendarOccurrenceInstant } : {}), selected: true, cancelled: true, courseHint: '', deadlineLocal: '', deadlineRaw: '', deadlineIssues: [], remainingMinutes: null, startLocal: osloLocal(old.start), endLocal: old.point ? '' : osloLocal(old.end), originalStart: old.start, originalEnd: old.end, snippet: `Kilden avlyser «${old.title}». Tidligere tidspunkt er beholdt som referanse; bekreftet avlysning frigjør kapasitet.`.slice(0, 600), position: 'Avlysning fra kalenderen' })
    }
  }
  if (parsed.rows.length > 1000) throw new Error('Oppdateringen har over 1000 oppføringer. Avgrens kalenderen før import.')
  const excludedKeys = new Set(previous?.excludedKeys || [])
  const legacyColumns = previous?.contentHash === contentHash ? [...new Set(parsed.rows.flatMap(row => Object.keys(row.legacyKeys || {})))].filter(column => previous.entries.filter(entry => entry.kind === 'event').every(entry => parsed.rows.some(row => row.legacyKeys?.[column] === entry.key && Date.parse(row.originalStart) === Date.parse(entry.sourceBase.start) && Date.parse(row.originalEnd || row.originalStart) === Date.parse(entry.sourceBase.end)))) : []
  const compatibleEntryCourse = (row, entry) => {
    if (row.kind !== 'event' || !row.courseHint) return true
    const course = previous?.entries.find(other => other.kind === 'course' && other.targetId === entry.sourceBase.courseId)?.sourceBase
    return Boolean(course && normal(course.code) === normal(row.courseHint) && compatibleCourse(row, course) && (!row.sourceObjectId || row.sourceObjectId === course.sourceObjectId) && ['campus', 'campusCode'].every(key => !row[key] || normal(row[key]) === normal(course[key])))
  }
  const parsedCourses = parsed.rows.filter(row => row.kind === 'course')
  const termCompatible = (row, course) => row.publishedTerm && normal(row.code || row.courseHint) === normal(course.code) && qualifiedCourse({ ...row, year: course.year, semester: course.semester }, course, { allowUnknownInstitution: true })
  const legacyTermMatch = (row, entry) => previous?.contentHash === contentHash && !row.identityAmbiguous && row.legacyKeys?.publishedTerm === entry.key && Date.parse(row.originalStart) === Date.parse(entry.sourceBase.start) && Date.parse(row.originalEnd || row.originalStart) === Date.parse(entry.sourceBase.end)
  const termCourseEntries = row => {
    if (!previous || row.kind !== 'course' || !row.publishedTerm) return []
    const members = parsed.rows.filter(member => member.kind === 'event' && member.publishedTerm && documentCourseIdentity({ ...member, code: member.courseHint }) === documentCourseIdentity(row))
    const ids = new Set(members.flatMap(member => previous.entries.filter(entry => entry.kind === 'event' && (entry.key === member.key && entry.calendarUid === member.calendarUid || legacyTermMatch(member, entry))).map(entry => entry.sourceBase.courseId)))
    return previous.entries.filter(entry => entry.kind === 'course' && ids.has(entry.targetId) && termCompatible(row, entry.sourceBase))
  }
  const restoredCourseKeys = new Set(parsedCourses.flatMap(row => row.restoredAffiliation ? [row.restoredAffiliation.entryKey] : []))
  const rows = clone(parsed.rows).map((row, index) => {
    const sourceRow = clone(row)
    if (row.restoredAffiliation) sourceRow.university = ''
    const exact = previous?.entries.filter(entry => entry.key === row.key) || []
    const termCourses = termCourseEntries(row)
    if (termCourses.length > 1) row.termCourseRepair = true
    const occurrenceMatches = previous?.entries.filter(entry => row.kind === 'event' && row.calendarOccurrenceInstant && matchingCalendarOccurrence(entry, row)) || []
    const termEventMatch = exact.length === 1 && row.kind === 'event' && row.publishedTerm && previous.entries.some(entry => entry.kind === 'course' && entry.targetId === exact[0].sourceBase.courseId && termCompatible(row, entry.sourceBase))
    const peers = previous?.entries.filter(entry => entry.matchKey === row.matchKey && entry.kind === row.kind && compatibleEntryCourse(row, entry)) || []
    const legacyCourses = row.kind === 'course' && row.university ? previous?.entries.filter(entry => entry.kind === 'course' && normal(entry.sourceBase.code) === normal(row.code) && qualifiedCourse({ ...row, ...(row.campusCode && !entry.sourceBase.campusCode && normal(entry.sourceBase.campus) === normal(row.campusCode) ? { campus: entry.sourceBase.campus, campusCode: '' } : {}) }, entry.sourceBase)) || [] : []
    const identicalPeers = previous?.contentHash === contentHash ? peers.filter(entry => row.kind === 'event' ? Date.parse(entry.sourceBase.start) === Date.parse(row.originalStart) && Date.parse(entry.sourceBase.end) === Date.parse(row.originalEnd || row.originalStart) : row.kind === 'course' ? normal(entry.sourceBase.code) === normal(row.code) && entry.sourceBase.name === row.title : entry.sourceBase.title === row.title) : []
    const occurrencePeers = previous?.contentHash === contentHash && row.kind === 'event' && !row.identityAmbiguous ? previous.entries.filter(entry => {
      if (entry.kind !== 'event' || Date.parse(entry.sourceBase.start) !== Date.parse(row.originalStart) || Date.parse(entry.sourceBase.end) !== Date.parse(row.originalEnd || row.originalStart)) return false
      const course = previous.entries.find(other => other.kind === 'course' && other.targetId === entry.sourceBase.courseId)?.sourceBase
      return course && compatibleEntryCourse(row, entry)
    }) : []
    const mappedLegacyPeers = previous?.contentHash === contentHash && row.kind === 'event' && !row.identityAmbiguous ? previous.entries.filter(entry => {
      if (entry.kind !== 'event' || !Object.values(row.legacyKeys || {}).includes(entry.key) || Date.parse(entry.sourceBase.start) !== Date.parse(row.originalStart) || Date.parse(entry.sourceBase.end) !== Date.parse(row.originalEnd || row.originalStart)) return false
      const courseEntry = previous.entries.find(course => course.kind === 'course' && course.targetId === entry.sourceBase.courseId)
      // Exact raw-file alias + original time is source provenance. A deliberate
      // external course mapping is a local choice, not the source course code.
      return compatibleEntryCourse(row, entry) || legacyTermMatch(row, entry) && courseEntry && termCompatible(row, courseEntry.sourceBase) || !courseEntry || courseEntry.reference === true
    }) : []
    const proposedMatch = termCourses.length > 1 ? null : termCourses.length === 1 ? termCourses[0] : (!row.identityAmbiguous || previous?.contentHash === contentHash) && (row.explicitId || row.csvIdentity || previous?.contentHash === contentHash) && exact.length === 1 && (termEventMatch || row.restoredAffiliation?.entryKey === exact[0].key || compatibleScope(exact[0].identityScope, row.identityScope) || previous?.contentHash === contentHash && !row.identityValidated) ? exact[0] : occurrenceMatches.length === 1 ? occurrenceMatches[0] : mappedLegacyPeers.length === 1 ? mappedLegacyPeers[0] : legacyCourses.length === 1 ? legacyCourses[0] : identicalPeers.length === 1 ? identicalPeers[0] : occurrencePeers.length === 1 ? occurrencePeers[0] : null
    // A raw code-only proposal cannot also claim the entry already represented
    // by a restored relationship, including on later hash-identical imports.
    const match = row.kind === 'course' && !row.restoredAffiliation && restoredCourseKeys.has(proposedMatch?.key) ? null : proposedMatch
    const current = match && importTargets(state, match.kind).find(item => item.id === match.targetId)
    const aliasKeys = legacyColumns.map(column => row.legacyKeys?.[column]).filter(Boolean)
    const canonicalDecision = exact.some(entry => entry.kind === row.kind) || excludedKeys.has(row.key)
    const aliasDecisions = canonicalDecision ? [] : aliasKeys.map(key => excludedKeys.has(key))
    const selectionUncertain = aliasDecisions.some(Boolean) && !aliasDecisions.every(Boolean)
    const provenAliasKeys = aliasKeys.length && new Set(aliasKeys).size === 1 ? [aliasKeys[0]] : []
    const retainedExclusion = row.kind !== 'course' && (excludedKeys.has(row.key) || aliasDecisions.length > 0 && aliasDecisions.every(Boolean)) && (!row.identityAmbiguous || previous?.contentHash === contentHash)
    const unimportedAlias = aliasKeys.length > 0 && aliasKeys.every(key => !previous.entries.some(entry => entry.key === key))
    const candidates = termCourses.length > 1 ? termCourses : !match && !retainedExclusion && !unimportedAlias && previous && !row.calendarUid ? peers.length ? peers : previous.entries.filter(entry => (!row.explicitId && entry.kind === row.kind || row.alternateKindKeys?.includes(entry.key)) && compatibleEntryCourse(row, entry)) : []
    const identical = previous?.contentHash === contentHash
    if (identical && match) {
      row.kind = match.kind
      Object.assign(row, retainedFields(row.kind, current || deletedCourseDetails(state, id, match, row) || match.sourceBase))
      // Historical CSV imports inferred points from absent/invalid end values.
      // Keep the saved record intact, but do not reaffirm that unsupported
      // interpretation. A later deliberate positive interval remains an edit.
      if (parsed.format === 'csv' && row.kind === 'event' && row.point && row.pointProvenance !== 'user' && !sourceRow.point && (!sourceRow.endLocal || !sourceRow.startLocal || sourceRow.endIssues?.length)) {
        for (const field of ['startLocal', 'endLocal', 'startRaw', 'endRaw', 'originalStart', 'originalEnd', 'startIssues', 'endIssues', 'point']) row[field] = clone(sourceRow[field])
      }
      if (parsed.format === 'csv' && row.kind === 'event' && match.sourceBase.point && !sourceRow.point && current && !current.point && Date.parse(current.end) > Date.parse(current.start) && (!sourceRow.endLocal || sourceRow.endIssues?.length)) row.retainedTimeBase = { start: match.sourceBase.start, end: match.sourceBase.end, point: match.sourceBase.point }
      if (parsed.format === 'csv' && row.kind === 'event' && sourceRow.title && sourceRow.title !== match.sourceBase.title) { row.title = sourceRow.title; row.titleStatus = sourceRow.titleStatus ?? (current?.titleStatus !== undefined ? 'confirmed' : undefined); row.titleOrigin = 'source' }
    }
    if (row.kind === 'course' && termCourses.length === 1 && match && !isReference(id, match, current)) { row.year = sourceRow.year; row.semester = sourceRow.semester }
    if (row.kind === 'event' && current && match) {
      const incomingTime = eventTimes(sourceRow)
      const unresolvedEnd = !sourceRow.point && !(Date.parse(incomingTime.end) > Date.parse(incomingTime.start))
      const unchangedTiming = unchangedSourceTiming(sourceRow, match, identical)
      if (unresolvedEnd && unchangedTiming && current.point && current.pointProvenance === 'user') {
        row.point = true; row.pointProvenance = 'user'; row.endLocal = ''; row.timeChoice = 'point'; row.allDay = false
        if (current.start !== match.sourceBase.start) { row.startLocal = osloLocal(current.start); row.originalStart = current.start }
      } else if (unresolvedEnd && unchangedTiming && !current.point && Date.parse(current.end) > Date.parse(current.start) && !(Date.parse(match.sourceBase.end) > Date.parse(match.sourceBase.start))) {
        // A previously corrected interval remains a local edit even while the
        // unchanged source still omits or contradicts its end.
        row.endLocal = osloLocal(current.end); row.originalEnd = current.end; row.point = false
        if (current.start !== match.sourceBase.start) { row.startLocal = osloLocal(current.start); row.originalStart = current.start }
        delete row.pointProvenance
      }
    }
    // A neutral fallback is presentation, not a newly published name. Existing
    // accepted names remain authoritative when the source still has no title.
    if (row.kind === 'event' && sourceRow.titleStatus === 'provisional' && current?.title && current.titleStatus !== 'provisional') {
      row.title = current.title; row.titleStatus = current.titleStatus; row.titleOrigin = match.titleOrigin || 'user'
      row.retainedTitleBase = { title: match.sourceBase.title, titleStatus: match.sourceBase.titleStatus }
    }
    if (row.kind === 'course' && match?.kind === 'course' && !row.university) row.university = current?.university ?? deletedCourseDetails(state, id, match, row)?.university ?? match.sourceBase.university ?? ''
    if (row.kind === 'course' && match?.kind === 'course' && !current && !row.title?.trim() && !row.courseNameConflict) {
      const deleted = deletedCourseDetails(state, id, match, row)
      if (deleted?.name || deleted?.nameStatus === 'provisional') { row.title = deleted.name; row.nameStatus = deleted.nameStatus; row.titleOrigin = match.titleOrigin || 'user' }
    }
    if (selectionUncertain) { row.selected = false; row.requiresGroupChoice = true; row.groupChoiceResolved = false; row.selectionUncertain = true }
    else if (retainedExclusion) { row.selected = false; row.groupChoiceResolved = true }
    else if (match && row.kind === 'event') { row.selected = true; row.groupChoiceResolved = true }
    if (identical && match?.titleOrigin && row.title !== sourceRow.title) row.titleOrigin = match.titleOrigin
    const hint = row.kind === 'course' ? row.code : row.courseHint
    const hints = row.kind !== 'course' && row.courseCodes?.length ? row.courseCodes : [hint]
    const courses = (state.planner?.courses || []).filter(course => hint && [course.code, course.name].some(value => hints.some(hint => normal(value) === normal(hint))) && compatibleCourse(row, course))
    const qualified = courses.filter(course => qualifiedCourse(row, course))
    const compatibleCourseRows = row.kind !== 'course' && row.courseHint ? parsedCourses.filter(other => hints.some(hint => normal(other.code) === normal(hint)) && compatibleCourse(row, other)) : []
    const exactCourseRows = row.university ? compatibleCourseRows.filter(other => qualifiedCourse(row, other)) : []
    const courseRows = exactCourseRows.length ? exactCourseRows : compatibleCourseRows
    // Old empty links cannot distinguish parser omission from deliberate choice.
    // A changed local link is evidence of a user edit; otherwise ask once per
    // qualified source course and persist the answer with the source entry.
    const localCourseEdit = current && Object.hasOwn(current, 'courseId') && current.courseId !== match?.sourceBase.courseId
    const legacyCourseChoice = row.kind !== 'course' && row.activityKind !== 'personal' && Boolean(current && current.courseId === '' && !localCourseEdit && !match.courseDecision && row.courseHint)
    const retainedCourseChoice = current && Object.hasOwn(current, 'courseId') && (current.courseId || localCourseEdit || match?.courseDecision?.origin === 'user' || match?.courseDecision?.courseId || !row.courseHint)
    const courseChoice = row.activityKind === 'personal' ? '' : legacyCourseChoice ? '?' : retainedCourseChoice ? current.courseId : match?.sourceBase.courseId && state.planner?.courses.some(course => course.id === match.sourceBase.courseId) ? match.sourceBase.courseId : hints.length > 1 ? '?' : courseRows.length === 1 ? `row:${parsed.rows.indexOf(courseRows[0])}` : qualified.length === 1 && courses.length === 1 && courseRows.length === 0 ? qualified[0].id : row.courseHint ? '?' : ''
    row.legacyCourseChoice = legacyCourseChoice
    row.courseDecisionOrigin = localCourseEdit ? 'user' : match?.courseDecision?.origin || 'automatic'
    const knownCorrection = identical && match
    return { ...row, index, sourceRow, provenAliasKeys, ...(identical && match && sourceRow.kind !== match.kind ? { retainedSourceBase: clone(match.sourceBase) } : {}), courseChoice, courseCandidates: courses.map(c => c.id), matchEntryKey: match?.key || '', matchCandidates: candidates.map(entry => ({ key: entry.key, kind: entry.kind, targetId: entry.targetId, title: entry.sourceBase.title || entry.sourceBase.name || 'Uten navn', start: entry.sourceBase.start || entry.sourceBase.deadlineLocal || '', end: entry.sourceBase.end || '', location: entry.sourceBase.location || '', ...Object.fromEntries(['campus', 'campusCode', 'sourceObjectId'].map(key => [key, previous.entries.find(course => course.kind === 'course' && course.targetId === entry.sourceBase.courseId)?.sourceBase[key] || ''])), course: previous.entries.find(course => course.kind === 'course' && course.targetId === entry.sourceBase.courseId)?.sourceBase.code || '', reason: entry.kind !== row.kind ? 'Samme uttrykkelige kilde-ID, men annen type; krever separat bekreftelse av erstatning' : 'Samme oppføringstype i den valgte kilden; bekreft emne og tidspunkt' })), matchChoice: candidates.length ? '?' : match?.key || 'new', targetId: match?.targetId || targetId(id, row.key), deletedLocally: Boolean(match && !current), recreate: false, deadlineMode: row.deadlineLocal ? 'value' : knownCorrection ? 'none' : row.deadlineRaw ? '?' : 'none', deadlinePromptDismissed: Boolean(current?.deadlinePromptDismissed || row.deadlinePromptDismissed), retainedCorrection: Boolean(knownCorrection && (sourceRow.kind !== row.kind || sourceRow.deadlineRaw && !sourceRow.deadlineLocal)), estimateResolved: Boolean(knownCorrection || !row.estimateIssue), conflictChoices: {}, conflicts: [], previousValues: current ? snapshot({ kind: match.kind }, current) : null, sourceBase: match?.sourceBase || null, courseTarget: row.kind === 'course' ? match?.kind === 'course' ? current?.id || '' : qualified.length === 1 && courses.length === 1 ? qualified[0].id : courses.length ? '?' : '' : '', typeChangeChoice: '?' }
  })
  const preview = { version: 1, baseToken: token(state), sourceId: id, previousRevision: previous?.revision || 0, contentHash, format: parsed.format, recognizedCsv: parsed.recognizedCsv, name: String(name || parsed.fileName || previous?.name || 'Innlimt studieplan').trim().slice(0, 300), origin: parsed.origin || { kind: 'file' }, rows, warnings: boundedImportWarnings(parsed.warnings), complete: parsed.complete !== false, range: parsed.range, accounting: parsed.accounting, period: parsed.period, originalParsed }
  if (!previous && parsed.format === 'csv' && rows.some(row => row.kind === 'event' && row.identityValidated && sources.some(source => source.entries.some(entry => entry.kind === 'event' && entry.key === row.key && entry.identityScope && compatibleScope(entry.identityScope, row.identityScope))))) preview.warnings = boundedImportWarnings([...preview.warnings, 'Mulig overlapp med en tidligere import: denne CSV-filen bruker samme oppføringsnummer som en tidligere fil. Nummeret alene bekrefter ikke at de er samme kilde. Velg den tidligere kilden som oppdatering hvis det er riktig; ellers beholdes filen som en ny kilde uten å overskrive aktiviteter.'])
  const possibleDuplicates = rows.filter(row => row.kind === 'event' && !row.matchEntryKey && (state.planner?.events || []).some(event => {
    const course = state.planner.courses.find(course => course.id === event.courseId)
    return event.importSourceId !== id && course && qualifiedCourse({ ...row, code: row.courseHint }, course) && normal(row.courseHint) === normal(course.code) && normal(row.title) === normal(event.title) && Date.parse(row.originalStart) === Date.parse(event.start) && Date.parse(row.originalEnd || row.originalStart) === Date.parse(event.end)
  })).length
  if (possibleDuplicates) preview.warnings = boundedImportWarnings([...preview.warnings, `Mulig overlapp med en tidligere import: ${possibleDuplicates} aktiviteter har samme emne, tittel og tidspunkt, men kildenes identiteter bekrefter ikke at de er samme aktivitet. De er ikke koblet automatisk. Kontroller utvalget og utelat mulige duplikater før lagring.`])
  for (const row of rows.filter(row => row.kind === 'course' && row.courseTarget && row.courseTarget !== '?')) {
    const saved = state.planner?.courses.find(course => course.id === row.courseTarget)
    const entry = previous?.entries.find(entry => entry.key === row.matchEntryKey)
    if (saved && !row.university) row.university = saved.university || ''
    // A code-only update supplies no replacement name. Retain the accepted
    // local name while keeping the empty incoming source baseline unchanged.
    // Nonempty incoming names still participate in three-way conflict review.
    if (saved && (!entry || isReference(id, entry, saved) || !row.title?.trim() && !row.courseNameConflict)) {
      row.title = saved.name
      if (saved.nameStatus !== undefined) row.nameStatus = saved.nameStatus
      else delete row.nameStatus
      if (entry && !isReference(id, entry, saved) && entry.titleOrigin) row.titleOrigin = entry.titleOrigin
    }
  }
  // A source proposal that was never committed must not be resurrected when
  // every activity in that qualified group already has a saved, deliberate
  // mapping away from the proposal (including the explicit empty mapping).
  // Missing names alone never justify omission. New/unmatched/deleted members
  // keep the proposal pending so their course choice is reviewed explicitly.
  if (previous) for (const proposal of rows.filter(row => row.kind === 'course' && !row.matchEntryKey && !row.termCourseRepair)) {
    const members = rows.filter(row => row.kind !== 'course' && row.sourceRow.courseHint && normal(row.sourceRow.courseHint) === normal(proposal.code) && compatibleCourse(row.sourceRow, proposal.sourceRow))
    if (members.some(row => row.matchEntryKey && row.courseChoice !== undefined && row.courseChoice !== '?' && row.courseChoice !== `row:${proposal.index}`) && members.every(row => !row.selected && row.groupChoiceResolved && !row.selectionUncertain || row.matchEntryKey && (row.previousValues && Object.hasOwn(row.previousValues, 'courseId') || row.sourceBase?.courseId && state.planner?.courses.some(course => course.id === row.sourceBase.courseId)) && row.courseChoice !== '?' && row.courseChoice !== `row:${proposal.index}`)) {
      proposal.selected = false
      proposal.resolutionNote = 'Tidligere lagrede emnevalg for alle oppføringene er beholdt. Dette kildeforslaget ble ikke opprettet som et emne.'
    }
  }
  refreshDocumentConflicts(state, preview)
  preview.initialRows = clone(rows)
  return preview
}

const editableFields = ['kind', 'selected', 'groupChoiceResolved', 'title', 'titleOrigin', 'nameStatus', 'titleStatus', 'code', 'university', 'year', 'semester', 'credits', 'courseChoice', 'courseDecisionOrigin', 'legacyCourseChoice', 'courseTarget', 'matchChoice', 'recreate', 'deadlineMode', 'deadlineLocal', 'deadlinePromptDismissed', 'remainingMinutes', 'remainingEstimate', 'remainingChoice', 'estimateResolved', 'requiresSubmission', 'statusChoice', 'startLocal', 'endLocal', 'point', 'pointProvenance', 'timeChoice', 'timeChoiceBeforeOmit', 'allDay', 'location', 'description', 'typeChangeChoice', 'activityKind', 'institutionCorrection']
export function chooseDocumentSelection(row, selected) {
  if (typeof selected !== 'boolean') return
  row.selected = selected
  row.groupChoiceResolved = true
  if (row.kind !== 'event') return
  if (!selected) {
    // Remember only the draft choice; selection never rewrites source times.
    if (row.timeChoice !== 'omit') {
      if (row.timeChoice) row.timeChoiceBeforeOmit = row.timeChoice
      else delete row.timeChoiceBeforeOmit
    }
    row.timeChoice = 'omit'
  } else {
    if (row.timeChoice === 'omit') {
      if (['?', 'interval', 'point'].includes(row.timeChoiceBeforeOmit)) row.timeChoice = row.timeChoiceBeforeOmit
      else if (row.point && row.pointProvenance === 'user') row.timeChoice = 'point'
      else delete row.timeChoice
    }
    delete row.timeChoiceBeforeOmit
  }
}
export function chooseDocumentTime(row, choice) {
  if (row.kind !== 'event' || !['?', 'interval', 'point', 'omit'].includes(choice)) return
  if (choice === 'omit') { chooseDocumentSelection(row, false); return }
  delete row.timeChoiceBeforeOmit
  row.timeChoice = choice
  row.selected = true
  row.groupChoiceResolved = true
  if (choice === 'point') {
    row.point = true; row.pointProvenance = 'user'; row.endLocal = ''; row.allDay = false
  } else {
    if (row.point && !row.endLocal) row.endLocal = row.sourceRow?.endLocal || ''
    row.point = false
    delete row.pointProvenance
  }
}
export function chooseDocumentCourse(preview, members, value) {
  const former = new Set(members.map(row => row.courseChoice))
  for (const row of members) { row.courseChoice = row.activityKind === 'personal' ? '' : value; row.courseDecisionOrigin = 'user'; row.legacyCourseChoice = false }
  for (const course of preview.rows.filter(row => row.kind === 'course' && former.has(`row:${row.index}`))) {
    if (!preview.rows.some(row => row.kind !== 'course' && row.courseChoice === `row:${course.index}`) && (course.courseTarget === '?' || !course.courseTarget && (!course.title || !course.year || !course.semester))) {
      course.selected = false
      if (course.draftCourse) course.resolutionNote = 'Emneforslaget du åpnet er ikke brukt av aktivitetene og blir ikke lagret. Du kan fylle det ut og velge det igjen.'
    }
  }
  for (const proposal of preview.rows.filter(row => row.kind === 'course' && !row.matchEntryKey && members.some(member => normal(member.courseHint) === normal(row.code) && compatibleCourse(member, row)))) {
    if (value !== `row:${proposal.index}` && !preview.rows.some(row => row.kind !== 'course' && row.selected && row.courseChoice === `row:${proposal.index}`)) proposal.selected = false
  }
  if (value.startsWith('row:')) {
    const proposal = preview.rows[Number(value.slice(4))]
    if (proposal?.kind === 'course') { proposal.selected = true; if (proposal.draftCourse) delete proposal.resolutionNote }
  }
}
export function addDocumentCourseDraft(state, preview, members) {
  const key = `user-course:${members[0].key}`
  let row = preview.rows.find(item => item.key === key)
  if (!row) {
    if (preview.rows.length >= 1000) throw new Error('Forhåndsvisningen har nådd grensen på 1000 oppføringer. Les en mindre kildefil eller bruk en kortere kalenderperiode før du oppretter et nytt emne.')
    const sourceRow = { kind: 'course', key, matchKey: key, explicitId: key, draftCourse: true, selected: true, title: '', code: '', university: '', year: '', semester: '', credits: null, snippet: 'Emne opprettet ved din avklaring av importen. Opplysningene er ikke hentet fra kilden.', position: 'Din emneavklaring', deadlineIssues: [] }
    const draft = createDocumentImportPreview(state, { ...preview.originalParsed, rows: [sourceRow] }, { sourceId: preview.previousRevision ? preview.sourceId : undefined, contentHash: preview.contentHash })
    row = draft.rows[0]; row.index = preview.rows.length
    preview.rows.push(row); preview.initialRows.push(clone(row)); preview.originalParsed.rows.push(sourceRow)
  }
  const former = new Set(members.map(member => member.courseChoice))
  row.selected = true
  if (row.draftCourse) delete row.resolutionNote
  for (const member of members) { member.courseChoice = member.activityKind === 'personal' ? '' : `row:${row.index}`; member.courseDecisionOrigin = 'user'; member.legacyCourseChoice = false }
  for (const proposal of preview.rows.filter(item => item.kind === 'course' && item !== row && former.has(`row:${item.index}`))) {
    if (!preview.rows.some(item => item.kind !== 'course' && item.selected && item.courseChoice === `row:${proposal.index}`)) proposal.selected = false
  }
  return row
}
export function refreshDocumentImportPreview(state, previous, parsed = previous.originalParsed) {
  const drafts = previous.originalParsed.rows.filter(row => row.draftCourse && !parsed.rows.some(item => item.key === row.key))
  if (drafts.length) parsed = { ...parsed, rows: [...parsed.rows, ...drafts] }
  const next = createDocumentImportPreview(state, parsed, { sourceId: previous.previousRevision ? previous.sourceId : undefined, name: previous.name, contentHash: parsed.contentHash || previous.contentHash })
  next.courseLookupCache = clone(previous.courseLookupCache || {})
  const reviewed = new Map((previous.reviewRows || []).map(entry => [entry.row.key, entry]))
  for (const row of previous.rows) reviewed.set(row.key, { row, initial: previous.initialRows?.find(item => item.key === row.key), courseKey: row.courseChoice?.startsWith('row:') ? previous.rows[Number(row.courseChoice.slice(4))]?.key : undefined })
  next.reviewRows = clone([...reviewed.values()])
  for (const row of next.rows) {
    const { row: old, initial, courseKey } = reviewed.get(row.key) || {}
    if (!old || !initial) continue
    const timingChanged = row.kind === 'event' && !same(sourceTiming(row.sourceRow), sourceTiming(old.sourceRow))
    const timingFields = ['startLocal', 'endLocal', 'point', 'pointProvenance', 'timeChoice', 'timeChoiceBeforeOmit', 'allDay']
    for (const field of editableFields) if (!(timingChanged && timingFields.includes(field)) && !same(old[field], initial[field])) row[field] = clone(old[field])
    if (timingChanged && !row.selected) row.timeChoice = 'omit'
    if (row.recreate) {
      const entry = state.importSources?.find(source => source.id === next.sourceId)?.entries.find(item => item.key === row.matchChoice)
      if (!entry || old.matchEntryKey !== entry.key || old.targetId !== entry.targetId) row.recreate = false
      else { row.matchEntryKey = entry.key; row.targetId = entry.targetId }
    }
    if (old.courseChoice?.startsWith('row:')) {
      const nextCourse = next.rows.find(item => item.kind === 'course' && item.key === courseKey)
      row.courseChoice = nextCourse ? `row:${nextCourse.index}` : '?'
    }
    if (row.courseChoice && !['?', ''].includes(row.courseChoice) && !(row.courseChoice.startsWith('row:') ? next.rows[Number(row.courseChoice.slice(4))]?.kind === 'course' : state.planner?.courses.some(course => course.id === row.courseChoice))) row.courseChoice = '?'
    if (row.courseTarget && row.courseTarget !== '?' && !state.planner?.courses.some(course => course.id === row.courseTarget) && row.courseTarget !== row.targetId) row.courseTarget = '?'
    if (row.matchChoice !== 'new' && row.matchChoice !== '?' && !state.importSources?.find(source => source.id === next.sourceId)?.entries.some(entry => entry.key === row.matchChoice)) row.matchChoice = '?'
    row.resolutionNote = old.resolutionNote
    row.verifiedCourseName = clone(old.verifiedCourseName)
    invalidateDocumentCourseName(row)
    row.conflictChoices = clone(old.conflictChoices); row.conflicts = clone(old.conflicts)
  }
  refreshDocumentConflicts(state, next)
  return next
}

export function documentSourceChanged(row, preview, state) {
  if (!row.sourceBase) return false
  const incoming = rowValues(row, preview, state, { baseline: true })
  return IMPORT_FIELDS[row.kind].filter(field => !['courseId', 'course'].includes(field)).some(field => {
    const fallback = ['point', 'allDay', 'cancelled', 'transparent', 'information', 'requiresSubmission', 'deadlinePromptDismissed'].includes(field) ? false : ['credits', 'year', 'remainingMinutes', 'remainingEstimate'].includes(field) ? null : ''
    return !same(incoming[field] ?? fallback, row.sourceBase[field] ?? fallback)
  })
}
function rowValues(row, preview, state, { baseline = false } = {}) {
  if (baseline && row.retainedSourceBase && row.kind !== row.sourceRow.kind) return clone(row.retainedSourceBase)
  const value = baseline ? row.sourceRow : row
  if (row.kind === 'course') return { name: value.title?.trim(), ...(value.nameStatus !== undefined ? { nameStatus: value.title?.trim() ? 'confirmed' : value.nameStatus } : {}), code: (value.code || '').trim().toUpperCase(), university: baseline && row.restoredAffiliation && row.sourceBase ? row.sourceBase.university || '' : value.university || '', semester: value.semester || '', year: Number(value.year) || null, credits: value.credits === '' || value.credits == null ? null : Number(value.credits), description: '', ...(value.sourceObjectId ? { sourceObjectId: value.sourceObjectId } : {}), ...(value.campus ? { campus: value.campus } : {}), ...(value.campusCode ? { campusCode: value.campusCode } : {}) }
  const courseRow = row.courseChoice?.startsWith('row:') ? preview.rows[Number(row.courseChoice.slice(4))] : null
  const courseId = courseRow ? courseRow.courseTarget || courseRow.targetId : row.courseChoice && row.courseChoice !== '?' ? row.courseChoice : ''
  const course = state.planner?.courses.find(c => c.id === courseId) || (courseRow ? { code: courseRow.code, name: courseRow.title } : null)
  const titleStatus = baseline && row.retainedTitleBase ? row.retainedTitleBase.titleStatus : value.titleStatus
  const base = { title: baseline && row.retainedTitleBase ? row.retainedTitleBase.title : (value.title || '').trim(), ...(row.kind === 'event' && titleStatus !== undefined ? { titleStatus } : {}), courseId }
  if (row.kind === 'task') return { ...base, course: course?.code || course?.name || '', deadlineLocal: !baseline && row.deadlineMode === 'none' ? '' : value.deadlineLocal || '', remainingMinutes: value.remainingMinutes ?? null,
    ...(value.remainingEstimate ? { remainingEstimate: clone(value.remainingEstimate) } : {}), ...(value.deadlinePromptDismissed ? { deadlinePromptDismissed: true } : {}), requiresSubmission: Boolean(value.requiresSubmission) }
  // Keep explicit source instants when the wall-clock values are unedited;
  // this preserves seconds and the offset in the repeated autumn hour.
  const { start, end } = eventTimes(value)
  const point = Boolean(value.point && start && Date.parse(start) === Date.parse(end))
  return { ...base, ...(value.activityKind === 'personal' ? { courseId: '', dateLocal: start ? osloLocal(start).slice(0, 10) : '' } : {}), start, end, point, ...(point && value.pointProvenance !== undefined ? { pointProvenance: value.pointProvenance } : {}), location: value.location || '', description: value.description || '', activityKind: value.activityKind || '', ...(value.publishedGroups?.length ? { publishedGroups: clone(value.publishedGroups) } : {}), ...(value.activityType ? { activityType: value.activityType } : {}), allDay: Boolean(value.allDay), cancelled: Boolean(value.cancelled), transparent: Boolean(value.transparent), information: Boolean(value.information), ...(baseline && row.retainedTimeBase ? row.retainedTimeBase : {}) }
}

export function refreshDocumentConflicts(state, preview) {
  const previous = state.importSources?.find(source => source.id === preview.sourceId)
  for (const row of preview.rows) {
    const entry = previous?.entries.find(item => item.key === row.matchChoice)
    // Consent belongs to the particular missing target reviewed by the user.
    // Choosing another candidate must never transfer recreation permission.
    if ((entry?.key || '') !== row.matchEntryKey || entry && entry.targetId !== row.targetId) row.recreate = false
    if (entry) {
      if (row.kind === 'course' && row.termCourseRepair && row.matchEntryKey !== entry.key) row.courseTarget = entry.targetId
      row.matchEntryKey = entry.key; row.targetId = entry.targetId; row.sourceBase = clone(entry.sourceBase)
    }
    else {
      const staleTarget = row.matchEntryKey ? row.targetId : ''
      row.matchEntryKey = ''; row.targetId = row.matchChoice === '?' && row.matchCandidates.length === 1 ? row.matchCandidates[0].targetId : targetId(preview.sourceId, row.key); row.sourceBase = null
      if (row.courseTarget === staleTarget || row.matchChoice === 'new' && row.matchCandidates.length && row.courseTarget === '?') row.courseTarget = ''
    }
    const current = entry && importTargets(state, entry.kind).find(item => item.id === entry.targetId)
    row.deletedLocally = Boolean(entry && !current)
    if (current) row.targetId = current.id
    row.previousKind = entry?.kind || ''
    row.typeChanged = Boolean(entry && entry.kind !== row.kind)
    row.reference = isReference(preview.sourceId, entry, current)
    const priorConflicts = row.conflicts || []
    row.conflicts = []
    if (!current || !entry || row.typeChanged || row.reference) continue
    const incoming = rowValues(row, preview, state, { baseline: true })
    const pointExpired = expiredUserPoint(row, entry, current)
    for (const field of IMPORT_FIELDS[row.kind]) if (!(pointExpired && conditionalPointFields.has(field)) && !nameStatusFields.has(field) && !same(current[field], entry.sourceBase[field]) && !same(incoming[field], entry.sourceBase[field]) && !same(current[field], incoming[field])) row.conflicts.push({ field, base: clone(entry.sourceBase[field] ?? null), local: clone(current[field] ?? null), incoming: clone(incoming[field] ?? null) })
    for (const field of Object.keys(row.conflictChoices)) if (!same(priorConflicts.find(item => item.field === field), row.conflicts.find(item => item.field === field))) delete row.conflictChoices[field]
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
  const entries = clone(oldSource?.entries || [])
  const used = new Set(), resolvedCourses = new Map()
  const selected = preview.rows.filter(row => row.selected)
  if (!selected.length && !oldSource) return { ok: false, counts, error: 'Velg minst én oppføring. Ingenting er lagret.' }
  refreshDocumentConflicts(state, preview)
  for (const row of preview.rows.filter(row => row.selectionUncertain && !row.groupChoiceResolved)) errors.push({ index: row.index, field: 'selected', message: 'Tidligere tittelvalg gir forskjellige utelatelser. Velg uttrykkelig hvilke aktiviteter du vil ta med eller utelate.' })
  for (const row of [...selected.filter(r => r.kind === 'course'), ...selected.filter(r => r.kind !== 'course')]) {
    const rowErrorCount = errors.length
    const fail = (message, field = 'selected') => errors.push({ index: row.index, field, message: `${row.kind === 'course' && row.code ? row.code : row.position}: ${message}` })
    if (!Object.hasOwn(IMPORT_FIELDS, row.kind)) { fail('Velg en gyldig oppføringstype.', 'kind'); continue }
    if (row.kind === 'course' && row.courseTarget === '?') { fail('Velg et eksisterende emne eller bekreft at emnet er nytt.', 'courseTarget'); continue }
    if (row.matchChoice === '?') { fail('Velg hvilken tidligere oppføring denne raden tilhører, eller velg ny.', 'matchChoice'); continue }
    if (row.typeChanged && row.typeChangeChoice !== 'replace') { fail('Typen er endret. Bekreft at den tidligere oppføringen erstattes, eller behold tidligere type.', 'typeChangeChoice'); continue }
    if (row.statusNeedsChoice && row.statusChoice !== 'open') { fail('Kilden markerer oppgaven som ferdig, avlyst eller med uklar status. Velg uttrykkelig å bruke den som åpent arbeid, eller utelat raden.', 'statusChoice'); continue }
    if (row.deletedLocally && !row.recreate) { fail('Oppføringen er slettet lokalt. Velg uttrykkelig å opprette den igjen, eller utelat raden.', 'recreate'); continue }
    if (row.kind !== 'course' && row.courseChoice === '?') {
      const group = documentCourseIdentity({ ...row, code: row.courseHint })
      if (!errors.some(error => error.field === 'courseChoice' && documentCourseIdentity({ ...preview.rows[error.index], code: preview.rows[error.index].courseHint }) === group)) fail(row.legacyCourseChoice ? 'Tidligere lagring viser ikke om manglende emnekobling var et eget valg. Avklar emnet én gang for denne gruppen, eller velg «Uten emne».' : 'Avklar emnet for gruppen eller velg «Uten emne».', 'courseChoice')
      continue
    }
    if (row.kind === 'task' && row.deadlineMode === '?') { fail('Avklar dato og klokkeslett, eller velg «Uten frist».', 'deadlineMode'); continue }
    if (row.kind === 'task' && row.estimateIssue && !row.estimateResolved) { fail('Avklar minuttene eller velg ukjent.', 'remainingMinutes'); continue }
    if (row.kind === 'task' && row.deadlineMode === 'value' && !validDeadline(row.deadlineLocal)) { fail('Oppgi en fullstendig dato og et gyldig klokkeslett.', 'deadlineLocal'); continue }
    if (row.kind === 'task' && row.deadlineMode === 'value') try { toInstant(row.deadlineLocal) } catch { fail('Fristens klokkeslett er ugyldig eller tvetydig ved tidsomstilling. Velg et entydig tidspunkt eller lagre uten frist.', 'deadlineLocal'); continue }
    const proposedCourse = row.courseChoice?.startsWith('row:') ? preview.rows[Number(row.courseChoice.slice(4))] : null
    if (proposedCourse && !proposedCourse.selected) {
      if (!errors.some(error => error.index === proposedCourse.index)) errors.push({ index: proposedCourse.index, field: 'selected', message: 'Dette emneforslaget er utelatt, men valgte aktiviteter er koblet til det. Ta med emnet eller endre aktivitetenes emnekobling.' })
      continue
    }
    // The course has already been validated above. Report its actual failure
    // once instead of adding a misleading missing-course error to every event.
    if (proposedCourse && errors.some(error => error.index === proposedCourse.index)) continue
    const previousEntry = row.matchChoice === 'new' ? null : entries.find(entry => entry.key === row.matchChoice)
    const key = previousEntry?.key || row.key
    const collection = importTargets(candidate, row.kind)
    let id = previousEntry?.targetId || targetId(preview.sourceId, key)
    if (row.kind === 'course' && row.courseTarget) id = row.courseTarget
    const priorTarget = previousEntry && importTargets(candidate, previousEntry.kind).find(item => item.id === previousEntry.targetId)
    const reference = row.kind === 'course' && (previousEntry?.kind === 'course' && isReference(preview.sourceId, previousEntry, priorTarget) || row.courseTarget && row.courseTarget !== previousEntry?.targetId)
    if (row.kind === 'course' && !reference && priorTarget?.university && documentInstitution(priorTarget.university) !== documentInstitution(row.university) && row.institutionCorrection !== JSON.stringify([priorTarget.id, priorTarget.university, row.university])) { fail('Institusjonen er forskjellig fra det tidligere koblede emnet. Bekreft rettingen i institusjonsfeltet eller behold den tidligere institusjonen.', 'university'); continue }
    const values = rowValues(row, preview, candidate)
    if (proposedCourse && values.courseId && row.activityKind !== 'personal' && resolvedCourses.has(proposedCourse.index)) values.courseId = resolvedCourses.get(proposedCourse.index)
    const referenceTarget = reference ? candidate.planner.courses.find(course => course.id === id) : null
    const baseline = referenceTarget ? snapshot({ kind: 'course' }, referenceTarget) : acceptedBaseline(row.kind, rowValues(row, preview, candidate, { baseline: true }), values)
    if (row.kind === 'course' && row.courseNameConflict && !row.title?.trim() && !reference) { fail('Kilden oppgir forskjellige emnenavn. Velg et eksisterende emne eller skriv navnet som skal brukes.', 'title'); continue }
    if (!reference && !values.title && !values.name && !(row.kind === 'course' && values.nameStatus === 'provisional' && values.code) || row.kind !== 'course' && !values.title) { fail('Skriv et navn.', 'title'); continue }
    if (row.kind !== 'course' && values.courseId && !candidate.planner.courses.some(course => course.id === values.courseId)) { fail('Det valgte emnet finnes ikke.', 'courseChoice'); continue }
    if (row.kind === 'event' && (!values.start || !values.end)) { const key = !values.start ? 'start' : 'end'; fail(eventTimeIssue(row, key), `${key}Local`); continue }
    if (row.kind === 'event' && (Date.parse(values.end) < Date.parse(values.start) || Date.parse(values.end) === Date.parse(values.start) && !values.point)) { fail('Slutt må være etter start. Kilden bekrefter ikke dette som en punktmarkør; kontroller verdiene eller utelat aktiviteten.', 'endLocal'); continue }
    if (row.kind === 'event' && values.point && !row.sourceRow.point && values.pointProvenance !== 'user') { fail('Bekreft uttrykkelig at aktiviteten skal være et punkt uten varighet, eller rett start og slutt.', 'endLocal'); continue }
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
    const titleField = row.kind === 'course' ? 'name' : 'title'
    const statusField = row.kind === 'course' ? 'nameStatus' : row.kind === 'event' ? 'titleStatus' : null
    let result, titleFromLocal = false
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
      titleFromLocal = true
      const pointExpired = expiredUserPoint(row, previousEntry, existing)
      for (const field of IMPORT_FIELDS[row.kind].filter(field => !nameStatusFields.has(field))) {
        const baseValue = previousEntry.sourceBase[field], localValue = existing[field], incomingValue = baseline[field]
        const conflict = row.conflicts.find(c => c.field === field)
        if (conflict && !['local', 'incoming'].includes(row.conflictChoices[field])) { fail(`Både du og kilden har endret «${field}». Velg hvilken verdi du vil beholde.`, `conflict:${field}`); continue }
        const editedInPreview = !same(values[field], incomingValue) || row.kind === 'course' && field === 'university' && row.institutionCorrection === JSON.stringify([existing.id, existing.university, row.university])
        if (conflict && row.conflictChoices[field] === 'local') continue
        if (pointExpired && conditionalPointFields.has(field) || editedInPreview || conflict && row.conflictChoices[field] === 'incoming' || same(localValue, baseValue) || same(localValue, incomingValue)) {
          result[field] = values[field]
          if (field === titleField) titleFromLocal = false
        }
      }
    }
    if (errors.length > rowErrorCount) continue
    if (row.kind === 'event' && Date.parse(result.end) > Date.parse(result.start)) result.point = false
    if (row.kind === 'event' && (!result.point || result.pointProvenance === undefined)) delete result.pointProvenance
    // The name choice also chooses its provenance. Status never introduces a
    // second conflict or transfers a provisional marker onto a retained name.
    if (!reference && statusField && !titleFromLocal) {
      const status = values[statusField] ?? (existing?.[statusField] !== undefined ? 'confirmed' : undefined)
      if (status === undefined) delete result[statusField]
      else result[statusField] = status
    }
    // Mapping a course to an existing record is a reference, never ownership
    // takeover from another document or public provider.
    if (!reference) { result.importSourceId = preview.sourceId; result.importEntryKey = key }
    if (existing) { if (same(existing, result)) counts.unchanged++; else { collection.splice(collection.indexOf(existing), 1, result); counts.updated++ } }
    else { collection.push(result); counts.added++ }
    if (row.kind === 'course') resolvedCourses.set(row.index, id)
    if (row.kind !== 'course' && row.courseChoice !== preview.initialRows?.find(initial => initial.key === row.key)?.courseChoice) row.courseDecisionOrigin = 'user'
    const localTitleOrigin = titleFromLocal ? ['public', 'user'].includes(previousEntry?.titleOrigin) ? previousEntry.titleOrigin : same(existing[titleField], previousEntry?.sourceBase[titleField]) ? previousEntry?.titleOrigin || 'source' : 'user' : null
    const titleOrigin = reference ? 'saved' : result.nameStatus === 'provisional' || result.titleStatus === 'provisional' ? 'provisional' : localTitleOrigin || row.titleOrigin || (row.resolutionNote === 'Emnekoden er godkjent som foreløpig navn.' ? 'provisional' : result[titleField] !== values[titleField] ? previousEntry?.titleOrigin || 'user' : row.title !== row.sourceRow.title ? row.verifiedCourseName ? 'public' : 'user' : 'source')
    const entry = { key, kind: row.kind, targetId: id, sourceBase: baseline, ...(row.kind !== 'course' ? { courseDecision: { origin: row.courseDecisionOrigin || 'automatic', courseId: result.courseId || '' } } : {}), ...(row.kind === 'event' ? { sourceTiming: sourceTiming(row.sourceRow) } : {}), snippet: row.snippet.slice(0, 600), position: row.position.slice(0, 100), matchKey: row.matchKey, titleOrigin, ...(row.identityValidated && !row.identityAmbiguous ? { identityScope: row.identityScope } : previousEntry?.identityScope ? { identityScope: previousEntry.identityScope } : {}), ...(reference ? { reference: true } : {}), ...(row.calendarUid ? { calendarUid: row.calendarUid, calendarOccurrence: previousEntry?.calendarOccurrence || row.calendarOccurrence, ...(row.calendarOccurrenceInstant ? { calendarOccurrenceInstant: row.calendarOccurrenceInstant } : {}) } : {}) }
    const entryIndex = entries.findIndex(item => item.key === key)
    if (entryIndex < 0) entries.push(entry); else entries[entryIndex] = entry
  }
  if (errors.length) return { ok: false, counts, error: 'Avklar de markerte oppføringene. Ingen del av planen er lagret.', errors }
  counts.omitted = preview.rows.length - selected.length
  // Omitted rows and absence from a revision do not delete targets or baselines.
  const excludedKeys = [...new Set([...(oldSource?.excludedKeys || []), ...preview.rows.filter(row => row.kind !== 'course' && !row.selected).map(row => row.key)])].filter(key => !selected.some(row => row.key === key || row.provenAliasKeys?.includes(key)))
  if (excludedKeys.length > 5000) return { ok: false, error: 'Denne oppdateringen overskrider grensen på 5000 lagrede utelatelser for én kilde. Avgrens filen eller kalenderperioden, eller importer et eget utvalg som en ny kilde. Tidligere valg og planen er beholdt; ingenting er lagret.' }
  const evidence = { origin: clone(preview.origin), excludedKeys, complete: preview.complete !== false, warnings: boundedImportWarnings(preview.warnings), ...(preview.format === 'ics' && preview.accounting ? { accounting: clone(preview.accounting) } : {}), ...(preview.format === 'ics' && preview.period ? { period: clone(preview.period) } : {}) }
  const unchangedSource = oldSource && oldSource.format === preview.format && oldSource.contentHash === preview.contentHash && same(oldSource.entries, entries) && Object.keys(evidence).every(key => same(oldSource[key], evidence[key]))
  const source = { id: preview.sourceId, kind: 'document', format: preview.format, name: preview.name, contentHash: preview.contentHash, revision: oldSource ? unchangedSource ? oldSource.revision : oldSource.revision + 1 : 1, createdAt: oldSource?.createdAt || now.toISOString(), lastUpdated: now.toISOString(), entries, ...evidence }
  if (oldSource) candidate.importSources.splice(candidate.importSources.indexOf(oldSource), 1, source); else candidate.importSources.push(source)
  if (!validTasks(candidate.tasks) || !validPlanner(candidate.planner) || !validImportSources(candidate.importSources, candidate) || !validEnvelope(candidate, { relations: true })) return { ok: false, error: 'Planen inneholder en ugyldig verdi eller kobling. Ingen del av planen er lagret.' }
  return { ok: true, state: candidate, candidate, counts, source }
}
