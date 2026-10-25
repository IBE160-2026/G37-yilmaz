import { Temporal } from '@js-temporal/polyfill'

// Deliberately independent of parser libraries and storage: history/backup can
// validate provenance without loading a worker or creating circular imports.
export const DOCUMENT_FORMATS = ['text', 'pdf', 'docx', 'csv', 'ics']
// An ICS description may occupy the entire bounded text input. Keep its value
// intact in both the event and the three-way source baseline.
export const DOCUMENT_DESCRIPTION_LIMIT = 2_000_000
export const IMPORT_WARNING_LIMITS = Object.freeze({ count: 100, characters: 2000 })
export function boundedImportWarnings(warnings = []) {
  const unique = [...new Set(warnings.filter(value => typeof value === 'string' && value.trim()))]
  const suffix = ' … (forkortet kildevarsel)'
  const result = unique.slice(0, IMPORT_WARNING_LIMITS.count).map(value => value.length <= IMPORT_WARNING_LIMITS.characters ? value : value.slice(0, IMPORT_WARNING_LIMITS.characters - suffix.length) + suffix)
  if (unique.length > IMPORT_WARNING_LIMITS.count) result[IMPORT_WARNING_LIMITS.count - 1] = `${unique.length - IMPORT_WARNING_LIMITS.count + 1} ytterligere kildevarsler fikk ikke plass. Kontroller originaldokumentet for manglende opplysninger.`
  return result
}
export const IMPORT_FIELDS = {
  course: ['name', 'nameStatus', 'code', 'university', 'semester', 'year', 'credits', 'description', 'sourceObjectId', 'campus', 'campusCode'],
  task: ['title', 'course', 'courseId', 'deadlineLocal', 'remainingMinutes', 'remainingEstimate', 'deadlinePromptDismissed', 'requiresSubmission'],
  event: ['title', 'titleStatus', 'courseId', 'start', 'end', 'location', 'description', 'activityKind', 'activityType', 'publishedGroups', 'dateLocal', 'point', 'pointProvenance', 'allDay', 'cancelled', 'transparent', 'information'],
}
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const string = (value, max = 1000) => typeof value === 'string' && value.length <= max
const id = value => string(value, 2000) && !!value.trim() && value === value.trim()
const date = value => string(value) && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value))
export const validPointProvenance = value => value.pointProvenance === undefined || value.pointProvenance === 'user' && value.point === true && !value.allDay && date(value.start) && date(value.end) && Date.parse(value.start) === Date.parse(value.end)
const localDeadline = value => {
  if (!string(value, 16) || !/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d)?$/.test(value)) return false
  try {
    return value.length === 10 ? Temporal.PlainDate.from(value).toString() === value : Temporal.PlainDateTime.from(value).toString({ smallestUnit: 'minute' }) === value
  } catch { return false }
}
const sourceKeys = ['id', 'kind', 'format', 'name', 'contentHash', 'revision', 'createdAt', 'lastUpdated', 'entries', 'complete', 'warnings', 'accounting', 'period', 'excludedKeys', 'origin']
export function validDocumentOrigin(value) {
  if (!record(value) || !['file', 'link'].includes(value.kind) || Object.keys(value).some(key => !['kind', 'publicUrl'].includes(key))) return false
  if (value.publicUrl === undefined) return true
  try {
    const url = new URL(value.publicUrl)
    return value.kind === 'link' && string(value.publicUrl, 2048) && url.origin === 'https://tp.educloud.no' && /^\/(uit|uib|oslomet|nord|inn|uis|uio|uia|himolde|hiof)\/app\/schedule$/.test(url.pathname) && !url.username && !url.password && !url.hash && [...url.searchParams.keys()].every(key => ['semester', 'scheduleType', 'course'].includes(key) && url.searchParams.getAll(key).length === 1)
  } catch { return false }
}
const accountingKeys = ['total', 'retained', 'filtered', 'rejected', 'cancelled', 'occurrences', 'filteredOccurrences']
const validAccounting = value => record(value) && Object.keys(value).every(key => [...accountingKeys, 'partial', 'rejectedOccurrences'].includes(key)) && accountingKeys.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) && ['partial', 'rejectedOccurrences'].every(key => value[key] === undefined || Number.isSafeInteger(value[key]) && value[key] >= 0) && value.total === value.retained + (value.partial || 0) + value.filtered + value.rejected + value.cancelled
const validPeriod = value => record(value) && Object.keys(value).length === 3 && ['automatic', 'filter'].includes(value.mode) && date(value.start) && date(value.end) && Date.parse(value.end) > Date.parse(value.start)
const entryKeys = ['key', 'kind', 'targetId', 'sourceBase', 'sourceTiming', 'courseDecision', 'snippet', 'position', 'matchKey', 'calendarUid', 'calendarOccurrence', 'calendarOccurrenceInstant', 'reference', 'identityScope', 'titleOrigin']
const validCourseDecision = value => record(value) && Object.keys(value).length === 2 && ['automatic', 'user'].includes(value.origin) && (value.courseId === '' || id(value.courseId))
const validOccurrenceInstant = value => {
  if (typeof value !== 'string') return false
  if (value.length === 10) return localDeadline(value)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.000)?Z$/.test(value)) return false
  try { return Temporal.Instant.from(value).toString() === value.replace('.000Z', 'Z') } catch { return false }
}
const validSourceTiming = value => record(value) && Object.keys(value).length === 4 && ['start', 'end'].every(key => string(value[key], DOCUMENT_DESCRIPTION_LIMIT) && (value[key].startsWith('raw:') || date(value[key]))) && ['point', 'allDay'].every(key => typeof value[key] === 'boolean')
function validBaseField(key, value) {
  if (key === 'pointProvenance') return value === 'user'
  if (key === 'nameStatus' || key === 'titleStatus') return ['provisional', 'confirmed'].includes(value)
  if (key === 'sourceObjectId') return string(value, 200) && value === value.trim() && !/[\u0000-\u001f]/.test(value)
  if (key === 'campus') return string(value, 300) && value === value.trim() && !/[\u0000-\u001f]/.test(value)
  if (key === 'campusCode') return string(value, 200) && value === value.trim() && !/[\u0000-\u001f]/.test(value)
  if (key === 'publishedGroups') return Array.isArray(value) && value.length <= 100 && value.every(group => id(group) && group.length <= 300) && new Set(value).size === value.length
  if (key === 'activityType') return string(value, 300)
  if (key === 'activityKind') return value === '' || ['exam', 'assessment', 'personal'].includes(value)
  if (key === 'dateLocal') return value === '' || localDeadline(value) && value.length === 10
  if (['point', 'allDay', 'cancelled', 'transparent', 'information', 'requiresSubmission', 'deadlinePromptDismissed'].includes(key)) return typeof value === 'boolean'
  if (key === 'remainingEstimate') return record(value) && Number.isSafeInteger(value.minMinutes) && value.minMinutes >= 0 && (value.maxMinutes === null || Number.isSafeInteger(value.maxMinutes) && value.maxMinutes >= value.minMinutes)
  if (key === 'remainingMinutes') return value === null || Number.isSafeInteger(value) && value >= 0
  if (key === 'credits') return value === null || Number.isFinite(value) && value >= 0
  if (key === 'year') return value === null || Number.isInteger(value) && value >= 1900 && value <= 2200
  if (key === 'semester') return ['', 'spring', 'autumn'].includes(value)
  if (['start', 'end'].includes(key)) return value === '' || date(value)
  if (key === 'deadlineLocal') return value === '' || localDeadline(value)
  if (key === 'description') return string(value, DOCUMENT_DESCRIPTION_LIMIT)
  return string(value, 10000)
}
export function importTargets(envelope, kind) {
  return kind === 'task' ? envelope?.tasks || [] : envelope?.planner?.[kind === 'course' ? 'courses' : 'events'] || []
}
export function validImportSources(sources, envelope) {
  if (!Array.isArray(sources) || sources.length > 500 || new Set(sources.map(s => s?.id)).size !== sources.length) return false
  if (!sources.every(source => record(source) && Object.keys(source).every(key => sourceKeys.includes(key)) && id(source.id) && source.kind === 'document' && DOCUMENT_FORMATS.includes(source.format) &&
    string(source.name, 300) && /^[a-f0-9]{64}$/.test(source.contentHash) && Number.isSafeInteger(source.revision) && source.revision > 0 && date(source.createdAt) && date(source.lastUpdated) &&
    (source.complete === undefined || typeof source.complete === 'boolean') &&
    (source.origin === undefined || validDocumentOrigin(source.origin)) &&
    (source.excludedKeys === undefined || Array.isArray(source.excludedKeys) && source.excludedKeys.length <= 5000 && source.excludedKeys.every(key => id(key)) && new Set(source.excludedKeys).size === source.excludedKeys.length) &&
    (source.accounting === undefined || source.format === 'ics' && validAccounting(source.accounting)) &&
    (source.period === undefined || source.format === 'ics' && validPeriod(source.period)) &&
    (source.warnings === undefined || Array.isArray(source.warnings) && source.warnings.length <= IMPORT_WARNING_LIMITS.count && source.warnings.every(warning => string(warning, IMPORT_WARNING_LIMITS.characters))) &&
    Array.isArray(source.entries) && source.entries.length <= 5000 && new Set(source.entries.map(e => e?.key)).size === source.entries.length &&
    source.entries.every(entry => record(entry) && Object.keys(entry).every(key => entryKeys.includes(key)) && id(entry.key) && id(entry.targetId) && Object.hasOwn(IMPORT_FIELDS, entry.kind) && string(entry.snippet, 600) && string(entry.position, 100) && string(entry.matchKey, 2000) && ['calendarUid', 'calendarOccurrence'].every(key => entry[key] === undefined || /^[a-f0-9]{16}$/.test(entry[key])) &&
      (entry.calendarOccurrenceInstant === undefined || entry.kind === 'event' && entry.calendarUid && entry.calendarOccurrence && validOccurrenceInstant(entry.calendarOccurrenceInstant)) && (entry.sourceTiming === undefined || entry.kind === 'event' && validSourceTiming(entry.sourceTiming)) && (entry.courseDecision === undefined || entry.kind !== 'course' && validCourseDecision(entry.courseDecision)) && (entry.reference === undefined || entry.kind === 'course' && typeof entry.reference === 'boolean') && (entry.identityScope === undefined || string(entry.identityScope, 2000)) && (entry.titleOrigin === undefined || ['source', 'user', 'public', 'provisional'].includes(entry.titleOrigin) || entry.titleOrigin === 'saved' && entry.kind === 'course' && entry.reference === true) && record(entry.sourceBase) && validPointProvenance(entry.sourceBase) && Object.entries(entry.sourceBase).every(([key, value]) => IMPORT_FIELDS[entry.kind].includes(key) && validBaseField(key, value))))) return false
  // A retained baseline may refer to a missing item. Treat this conservatively
  // as a tombstone: absence alone cannot prove deletion intent or its cause,
  // and a repeat import must ask before recreating the item.
  if (envelope) for (const kind of Object.keys(IMPORT_FIELDS)) for (const target of importTargets(envelope, kind)) {
    if (target.importSourceId === undefined && target.importEntryKey === undefined) continue
    if (!id(target.importSourceId) || !id(target.importEntryKey) || !sources.some(source => source.id === target.importSourceId && source.entries.some(entry => entry.key === target.importEntryKey && entry.kind === kind && entry.targetId === target.id && entry.reference !== true))) return false
  }
  return true
}
