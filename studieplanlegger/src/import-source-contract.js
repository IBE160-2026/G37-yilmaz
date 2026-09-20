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
  course: ['name', 'code', 'university', 'semester', 'year', 'credits', 'description'],
  task: ['title', 'course', 'courseId', 'deadlineLocal', 'remainingMinutes', 'requiresSubmission'],
  event: ['title', 'courseId', 'start', 'end', 'location', 'description', 'allDay', 'cancelled', 'transparent', 'information'],
}
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const string = (value, max = 1000) => typeof value === 'string' && value.length <= max
const id = value => string(value, 2000) && !!value.trim() && value === value.trim()
const date = value => string(value) && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value))
const sourceKeys = ['id', 'kind', 'format', 'name', 'contentHash', 'revision', 'createdAt', 'lastUpdated', 'entries', 'complete', 'warnings']
const entryKeys = ['key', 'kind', 'targetId', 'sourceBase', 'snippet', 'position', 'matchKey', 'calendarUid', 'calendarOccurrence', 'reference']
function validBaseField(key, value) {
  if (['allDay', 'cancelled', 'transparent', 'information', 'requiresSubmission'].includes(key)) return typeof value === 'boolean'
  if (key === 'remainingMinutes') return value === null || Number.isSafeInteger(value) && value >= 0
  if (key === 'credits') return value === null || Number.isFinite(value) && value >= 0
  if (key === 'year') return value === null || Number.isInteger(value) && value >= 1900 && value <= 2200
  if (key === 'semester') return ['', 'spring', 'autumn'].includes(value)
  if (['start', 'end'].includes(key)) return value === '' || date(value)
  if (key === 'deadlineLocal') return value === '' || string(value, 16) && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value) && Number.isFinite(Date.parse(value))
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
    (source.warnings === undefined || Array.isArray(source.warnings) && source.warnings.length <= IMPORT_WARNING_LIMITS.count && source.warnings.every(warning => string(warning, IMPORT_WARNING_LIMITS.characters))) &&
    Array.isArray(source.entries) && source.entries.length <= 5000 && new Set(source.entries.map(e => e?.key)).size === source.entries.length &&
    source.entries.every(entry => record(entry) && Object.keys(entry).every(key => entryKeys.includes(key)) && id(entry.key) && id(entry.targetId) && Object.hasOwn(IMPORT_FIELDS, entry.kind) && string(entry.snippet, 600) && string(entry.position, 100) && string(entry.matchKey, 2000) && ['calendarUid', 'calendarOccurrence'].every(key => entry[key] === undefined || /^[a-f0-9]{16}$/.test(entry[key])) &&
      (entry.reference === undefined || entry.kind === 'course' && typeof entry.reference === 'boolean') && record(entry.sourceBase) && Object.entries(entry.sourceBase).every(([key, value]) => IMPORT_FIELDS[entry.kind].includes(key) && validBaseField(key, value))))) return false
  // A retained baseline may refer to a locally deleted item. Its tombstone is
  // intentional: a repeat import must ask before recreating that item.
  if (envelope) for (const kind of Object.keys(IMPORT_FIELDS)) for (const target of importTargets(envelope, kind)) {
    if (target.importSourceId === undefined && target.importEntryKey === undefined) continue
    if (!id(target.importSourceId) || !id(target.importEntryKey) || !sources.some(source => source.id === target.importSourceId && source.entries.some(entry => entry.key === target.importEntryKey && entry.kind === kind && entry.targetId === target.id && entry.reference !== true))) return false
  }
  return true
}
