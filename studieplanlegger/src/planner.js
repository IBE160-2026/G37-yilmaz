import { Temporal } from '@js-temporal/polyfill'
import { validProgramBinding } from './program-provenance.js'

export const emptyPlanner = () => ({ courses: [], events: [], sources: [] })
export const OSLO = 'Europe/Oslo'
export const osloYear = (instant = Temporal.Now.instant()) => instant.toZonedDateTimeISO(OSLO).year
export const osloLocal = instant => Temporal.Instant.from(instant).toZonedDateTimeISO(OSLO).toPlainDateTime().toString({ smallestUnit: 'minute' })
export const toInstant = local => Temporal.PlainDateTime.from(local).toZonedDateTime(OSLO, { disambiguation: 'reject' }).toInstant().toString()
export const semesterLabel = (semester, year) => `${semester === 'spring' ? 'Vår' : 'Høst'} ${year}`
export function semesterWindow(semester, year) {
  if (!['spring', 'autumn'].includes(semester) || !Number.isInteger(Number(year)) || Number(year) < 1900 || Number(year) > 2200) throw new Error('Velg et gyldig semester og år (1900–2200).')
  return { start: toInstant(`${year}-${semester === 'spring' ? '01' : '07'}-01T00:00`), end: toInstant(`${semester === 'spring' ? year : Number(year) + 1}-${semester === 'spring' ? '07' : '01'}-01T00:00`) }
}
const text = value => typeof value === 'string'
const instant = value => text(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const unique = items => Array.isArray(items) && items.every(item => item && text(item.id) && item.id.trim()) && new Set(items.map(item => item.id)).size === items.length
export function sourceHref(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '' } catch { return '' }
}
export function validPlanner(value) {
  if (!value || !unique(value.courses) || !unique(value.events) || !unique(value.sources)) return false
  return value.courses.every(c => text(c.name) && c.name.trim() && text(c.code) && text(c.university) && text(c.notes ?? '') && ['sourceUrl', 'entryUrl'].every(key => c[key] === undefined || text(c[key]) && c[key].length <= 2048) && ['spring', 'autumn'].includes(c.semester) && Number.isInteger(c.year) && c.year >= 1900 && c.year <= 2200 && (c.credits == null || (Number.isFinite(c.credits) && c.credits >= 0)) && (c.programBinding === undefined || validProgramBinding(c.programBinding))) &&
    value.events.every(e => text(e.title) && e.title.trim() && text(e.courseId) && (value.courses.some(c => c.id === e.courseId) || e.courseId === '' && text(e.importSourceId) && !!e.importSourceId.trim()) && (e.importSourceId === undefined || text(e.importSourceId) && !!e.importSourceId.trim() && text(e.importEntryKey) && !!e.importEntryKey.trim()) && instant(e.start) && instant(e.end) && Date.parse(e.end) > Date.parse(e.start) && text(e.notes ?? '') && (e.cancelled === undefined || typeof e.cancelled === 'boolean') && (e.deleted === undefined || typeof e.deleted === 'boolean')) &&
    value.sources.every(s => text(s.courseId) && value.courses.some(c => c.id === s.courseId) && ['file', 'url'].includes(s.kind) && (s.kind !== 'url' || (s.reconnectRequired === true && s.url === undefined) || (text(s.url) && s.url.startsWith('https://'))) && text(s.name) && instant(s.lastUpdated) && Array.isArray(s.groups) && s.groups.every(text))
}
export function validateCourse(draft, previous = {}) {
  if (!draft.name?.trim()) throw new Error('Skriv et emnenavn.')
  if (draft.credits !== '' && draft.credits != null && (!Number.isFinite(Number(draft.credits)) || Number(draft.credits) < 0)) throw new Error('Studiepoeng må være et positivt tall eller stå tomt.')
  semesterWindow(draft.semester, draft.year)
  if (draft.programBinding !== undefined && !validProgramBinding(draft.programBinding)) throw new Error('Programtilknytningen er ufullstendig eller ugyldig.')
  const course = { ...previous, ...draft, id: previous.id || draft.id || crypto.randomUUID(), name: draft.name.trim(), code: (draft.code || '').trim().toUpperCase(), university: (draft.university || '').trim(), credits: draft.credits === '' || draft.credits == null ? null : Number(draft.credits), description: draft.description || '', notes: draft.notes || '', year: Number(draft.year) }
  if ((previous.sourceUrl || previous.sourceRecordId) && ['code', 'university', 'semester', 'year'].some(key => course[key] !== previous[key]) && !course.sourceBindingStale) {
    course.sourceBindingStale = Object.fromEntries(['code', 'university', 'semester', 'year', 'sourceProvider', 'sourceRecordId', 'sourceVersion', 'sourceUrl', 'entryUrl', 'campus', 'campusVerified', 'sourceBase'].filter(key => previous[key] !== undefined).map(key => [key, structuredClone(previous[key])]))
  }
  return course
}
export function validateEvent(draft, previous = {}) {
  if (!draft.title?.trim()) throw new Error('Skriv et navn på undervisningen.')
  if (!draft.courseId) throw new Error('Velg et emne først.')
  let start, end
  try { start = toInstant(draft.startLocal); end = toInstant(draft.endLocal) } catch { throw new Error('Oppgi gyldig start og slutt i norsk tid. Klokkeslettet kan være ugyldig eller tvetydig ved overgang til sommer- eller vintertid.') }
  if (Date.parse(end) <= Date.parse(start)) throw new Error('Slutt må være etter start.')
  return { ...previous, id: previous.id || crypto.randomUUID(), title: draft.title.trim(), courseId: draft.courseId, start, end, location: draft.location?.trim() || '', notes: draft.notes || '', allDay: draft.allDay ?? previous.allDay ?? false, cancelled: draft.cancelled ?? previous.cancelled ?? false }
}
export const externalFields = ['title', 'courseId', 'start', 'end', 'location', 'description', 'group', 'allDay', 'cancelled', 'transparent', 'information', 'groupMissing']
export const sourceSnapshot = event => Object.fromEntries(externalFields.map(key => [key, event[key] ?? (['allDay', 'cancelled', 'transparent', 'information', 'groupMissing'].includes(key) ? false : '')]))
export const eventBlocksTime = event => !event.cancelled && !event.deleted && !event.transparent && event.transparency !== 'TRANSPARENT' && !event.information
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const verifiedSource = course => !course.sourceBindingStale && ['sourceProvider', 'sourceRecordId', 'sourceVersion'].every(key => typeof course[key] === 'string' && course[key].trim())

// Three-way merge: the last source version is the base; notes are always local.
export function mergeImport(planner, incoming, source, { course, authoritative = true, cancellations = [], absenceWindow, selection } = {}) {
  if (new Set(incoming.map(e => e.sourceKey)).size !== incoming.length) throw new Error('Kalenderen har tvetydige aktivitetsidentiteter. Ingen undervisning er endret.')
  const result = structuredClone(planner)
  const counts = { added: 0, updated: 0, cancelled: 0, conflicts: 0, unchanged: 0 }
  const selected = event => !selection || selection.groups.includes(event.sourceBase?.group ?? event.group) && !selection.excludedKeys.includes(event.sourceKey)
  const excludedBefore = new Set(planner.events.filter(e => e.sourceId === source.id && e.excluded).map(e => e.id))
  if (course) {
    const previous = result.courses.find(c => c.id === course.id)
    if (!previous) result.courses.push({ ...course, sourceBase: { name: course.name, credits: course.credits, description: course.description } })
    else {
      if (previous.sourceBindingStale && verifiedSource(course)) {
        previous.sourceBindingHistory = [...(previous.sourceBindingHistory || []), previous.sourceBindingStale]
        delete previous.sourceBindingStale
      }
      const base = previous.sourceBase || {}
      const conflicts = []
      for (const key of ['name', 'credits', 'description']) {
        if (same(previous[key], base[key]) || previous[key] == null || previous[key] === '') previous[key] = course[key]
        else if (!same(course[key], base[key]) && !same(previous[key], course[key])) conflicts.push(key)
      }
      const span = course.programBinding?.studySemesters
      const selectedPeriodBelongsToSpan = Array.isArray(span) && span.includes(course.programBinding.studySemester) && verifiedSource(previous) && verifiedSource(course) && ['sourceProvider', 'sourceRecordId', 'sourceVersion'].every(key => previous[key] === course[key])
      if (selectedPeriodBelongsToSpan) { previous.year = course.year; previous.semester = course.semester }
      previous.sourceBase = { name: course.name, credits: course.credits, description: course.description }
      previous.sourceUrl = course.sourceUrl
      for (const key of ['sourceProvider', 'sourceRecordId', 'sourceVersion', 'campus', 'campusVerified', 'entryUrl', 'programBinding']) if (course[key] !== undefined && course[key] !== '') previous[key] = course[key]
      if (conflicts.length) { previous.conflict = `Emneinformasjon er endret i kilden (${conflicts.join(', ')}). Dine verdier er beholdt.`; counts.conflicts++ }
    }
  }
  const seen = new Set()
  for (const remote of incoming) {
    let current = result.events.find(e => e.sourceId === source.id && e.sourceKey === remote.sourceKey && !seen.has(e.id))
    // TP UIDs change at every request. Only match moved times when the match is unique.
    if (!current && source.identityMode === 'content') {
      let peers = result.events.filter(e => e.sourceId === source.id && !seen.has(e.id) && (e.sourceBase || e).title === remote.title && osloLocal((e.sourceBase || e).start).slice(0, 10) === osloLocal(remote.start).slice(0, 10))
      let incomingPeers = incoming.filter(e => e.title === remote.title && osloLocal(e.start).slice(0, 10) === osloLocal(remote.start).slice(0, 10))
      if (peers.length > 1 || incomingPeers.length > 1) { peers = peers.filter(e => (e.sourceBase || e).group === remote.group); incomingPeers = incomingPeers.filter(e => e.group === remote.group) }
      if (peers.length > 1 || incomingPeers.length > 1) { peers = peers.filter(e => (e.sourceBase || e).start === remote.start && (e.sourceBase || e).location === remote.location); incomingPeers = incomingPeers.filter(e => e.start === remote.start && e.location === remote.location) }
      if (peers.length === 1 && incomingPeers.length === 1) current = peers[0]
    }
    if (!current && !selected(remote)) continue
    if (selection && current?.excluded) { current.cancelled = current.exclusionCancelled ?? current.sourceBase?.cancelled ?? false; delete current.excluded; delete current.exclusionCancelled }
    const next = sourceSnapshot(remote)
    if (!current) {
      current = { ...remote, ...next, id: `event:${source.id}:${remote.sourceKey}`, sourceId: source.id, notes: '', sourceBase: next }
      result.events.push(current); counts.added++
    } else {
      const base = current.sourceBase || sourceSnapshot(current)
      const conflicts = []
      let changed = false
      for (const key of externalFields) {
        if (!(key in current) && !(key in base) || same(current[key] ?? next[key], base[key]) || same(current[key], next[key])) {
          if (!same(current[key], next[key])) changed = true
          current[key] = next[key]
        } else if (!same(base[key], next[key])) conflicts.push(key)
      }
      if (conflicts.length) { current.conflict = { message: 'Både du og kilden har endret denne økten. Dine endringer er beholdt.', fields: conflicts, incoming: next }; counts.conflicts++ }
      else if (changed) counts.updated++
      else counts.unchanged++
      current.sourceBase = next; current.sourceKey = remote.sourceKey
      if (remote.sourceUid !== undefined) current.sourceUid = remote.sourceUid
      if (!next.cancelled && current.conflict?.fields.length === 1 && current.conflict.fields[0] === 'cancelled') delete current.conflict
    }
    seen.add(current.id)
  }
  for (const current of result.events.filter(e => e.sourceId === source.id && !seen.has(e.id) && ((authoritative && selected(e) && !e.excluded && (!absenceWindow || Date.parse(e.start) >= Date.parse(absenceWindow.start) && Date.parse(e.end) <= Date.parse(absenceWindow.end))) || cancellations.some(c => c.uid === e.sourceUid && (!c.recurrence || e.sourceKey === JSON.stringify([c.uid, c.recurrence])))))) {
    if (current.excluded) { current.exclusionCancelled = true; current.sourceBase = { ...current.sourceBase, cancelled: true } }
    if (current.cancelled) continue
    current.cancelled = true; counts.cancelled++
    if (current.notes || !same(sourceSnapshot({ ...current, cancelled: false }), current.sourceBase)) {
      current.conflict = { message: 'Økten er fjernet eller avlyst i kilden. Lokale opplysninger er beholdt; økten tar ikke kapasitet.', fields: ['cancelled'], incoming: { ...current.sourceBase, cancelled: true } }
      counts.conflicts++
    }
    current.sourceBase = { ...current.sourceBase, cancelled: true }
  }
  if (selection) {
    counts.excluded = 0; counts.reselected = 0
    for (const event of result.events.filter(e => e.sourceId === source.id)) {
      if (!selected(event)) {
        if (!event.excluded) { event.exclusionCancelled = Boolean(event.cancelled); event.excluded = true }
        event.cancelled = true
        if (!excludedBefore.has(event.id)) counts.excluded++
      } else if (excludedBefore.has(event.id)) {
        if (event.excluded) { event.cancelled = event.exclusionCancelled ?? event.sourceBase?.cancelled ?? false; delete event.excluded; delete event.exclusionCancelled }
        counts.reselected++
      }
    }
  }
  const index = result.sources.findIndex(s => s.id === source.id)
  if (index < 0) result.sources.push(source)
  else result.sources[index] = source
  return { planner: result, counts }
}
export function resolveImportedCourse(planner, course) {
  const normal = value => String(value || '').trim().toLocaleLowerCase('nb-NO')
  const studySpan = value => value.programBinding?.studySemesters
  const sameStudySpan = candidate => {
    const incoming = studySpan(course), existing = studySpan(candidate), binding = course.programBinding, previous = candidate.programBinding
    return Array.isArray(incoming) && incoming.length > 1 && Array.isArray(existing) && incoming.length === existing.length && incoming.every((semester, index) => semester === existing[index]) && incoming.includes(binding?.studySemester) && existing.includes(previous?.studySemester) &&
      verifiedSource(candidate) && verifiedSource(course) && ['sourceProvider', 'sourceRecordId', 'sourceVersion'].every(key => normal(candidate[key]) === normal(course[key])) &&
      Boolean(binding && previous) && ['institution', 'programCode', 'cohort', 'modelId'].every(key => normal(binding[key]) === normal(previous[key]))
  }
  const legacySkrivekunstSpan = candidate => {
    const incoming = studySpan(course), previous = candidate.programBinding, binding = course.programBinding
    if (!Array.isArray(incoming) || incoming.length !== 2 || incoming[0] !== 1 || incoming[1] !== 2 || previous?.studySemesters !== undefined) return false
    if (!verifiedSource(candidate) || !verifiedSource(course) || candidate.sourceProvider !== 'skrivekunst-program' || course.sourceProvider !== candidate.sourceProvider || candidate.sourceRecordId !== 'arsstudium-skapande-skriving' || course.sourceRecordId !== candidate.sourceRecordId || candidate.sourceVersion !== course.sourceVersion || candidate.sourceUrl !== course.sourceUrl) return false
    if (!binding || !previous || binding.institution !== 'skrivekunst' || previous.institution !== binding.institution || binding.programCode !== 'arsstudium-skapande-skriving' || previous.programCode !== binding.programCode || previous.cohort !== binding.cohort || previous.modelId !== binding.modelId) return false
    try { const url = new URL(course.sourceUrl); return url.protocol === 'https:' && ['skrivekunst.no', 'www.skrivekunst.no'].includes(url.hostname) && url.pathname === '/arsstudium/' && !url.search && !url.hash && !url.username && !url.password } catch { return false }
  }
  // Early current-page adapters stored a content hash as the course edition.
  // A source presentation revision is not a different academic course. Upgrade
  // only those known legacy hashes, with the exact same public source identity.
  const legacyPageRevision = candidate => {
    if (!/^side-[a-f0-9]{16}$/.test(candidate.sourceVersion || '') || !candidate.sourceUrl || candidate.sourceUrl !== course.sourceUrl || candidate.sourceProvider !== course.sourceProvider || candidate.sourceRecordId !== course.sourceRecordId) return false
    const provider = course.sourceProvider, version = course.sourceVersion
    return ['mf', 'hlt', 'fih', 'barrattdue'].includes(provider) && version === 'current' || provider === 'ldh' && /^cohort:\d{4}$/.test(version || '') || provider === 'ansgar' && version === `${course.year}:${course.semester}`
  }
  // NHFH originally persisted one semester-only identity. Rebind only the
  // named row proven by that saved source baseline and the exact programme.
  // This runs on explicit import, never on storage load.
  const legacyNhfhCourse = candidate => {
    if (!verifiedSource(candidate) || !verifiedSource(course) || course.sourceProvider !== 'nhfh' || candidate.sourceProvider !== 'nhfh' || course.sourceVersion !== 'published-current' || candidate.sourceVersion !== course.sourceVersion || candidate.sourceUrl !== course.sourceUrl) return false
    const binding = course.programBinding, previous = candidate.programBinding
    if (!binding || !previous || binding.institution !== 'nhfh' || previous.institution !== 'nhfh' || binding.modelId !== 'published-current' || previous.modelId !== binding.modelId || previous.programCode !== binding.programCode || previous.studySemester !== binding.studySemester || binding.sourceUrl !== course.sourceUrl || previous.sourceUrl !== candidate.sourceUrl) return false
    try { const url = new URL(course.sourceUrl); if (url.protocol !== 'https:' || !['nhfh.no', 'www.nhfh.no'].includes(url.hostname) || url.pathname !== `/${binding.programCode}/` || url.search || url.hash || url.username || url.password) return false } catch { return false }
    const legacyRecord = `${binding.programCode}:semester-${binding.studySemester}`
    return candidate.sourceRecordId === legacyRecord && course.sourceRecordId.startsWith(`${legacyRecord}:named-`) && /^[a-f0-9]{32}$/.test(course.sourceRecordId.slice(`${legacyRecord}:named-`.length)) && normal(candidate.sourceBase?.name ?? candidate.name) === normal(course.name)
  }
  const sameUncodedCourse = candidate => verifiedSource(candidate) && verifiedSource(course) && candidate.sourceProvider === course.sourceProvider && candidate.sourceRecordId === course.sourceRecordId || legacyNhfhCourse(candidate) || normal(candidate.name) === normal(course.name)
  const candidates = planner.courses.filter(c => normal(c.code) === normal(course.code) && (normal(course.code) || sameUncodedCourse(c)) && normal(c.university) === normal(course.university) && (c.semester === course.semester && c.year === course.year || sameStudySpan(c) || legacySkrivekunstSpan(c)))
  const campuses = value => [value.campus, value.programBinding?.campus].map(normal).filter(Boolean)
  const campusMatches = c => new Set([...campuses(c), ...campuses(course)]).size <= 1
  if (new Set(campuses(course)).size > 1) throw new Error('Valgt campus avviker fra emnets kildeopplysninger. Ingen emner er slått sammen. Kontroller campusvalget først.')
  const exact = candidates.filter(c => verifiedSource(c) && verifiedSource(course) && (['sourceProvider', 'sourceRecordId', 'sourceVersion'].every(key => normal(c[key]) === normal(course[key])) || legacyPageRevision(c) || legacyNhfhCourse(c)))
  const compatible = exact.length ? exact.filter(campusMatches) : candidates.filter(c => campusMatches(c) && (c.sourceBindingStale ? verifiedSource(course) : ['sourceProvider', 'sourceRecordId', 'sourceVersion'].every(key => !c[key] || !course[key] || normal(c[key]) === normal(course[key]))))
  if (candidates.length && compatible.length !== 1) throw new Error('Emnet har en annen eller tvetydig campus/emneversjon i lokale data. Ingen emner er slått sammen. Kontroller de eksisterende emnene først.')
  const existing = compatible[0]
  if (planner.courses.some(c => c.id === course.id && c !== existing)) throw new Error('Emne-ID-en tilhører et annet lokalt emne. Ingen data er endret.')
  if (!existing) return course
  return { ...course, id: existing.id }
}
export function mergeCourseOnly(planner, course) {
  course = resolveImportedCourse(planner, course)
  const source = { id: `metadata:${course.id}`, courseId: course.id, kind: 'file', name: 'Emneinformasjon', groups: [], lastUpdated: new Date().toISOString() }
  const result = mergeImport(planner, [], source, { course, authoritative: false }).planner
  result.sources = result.sources.filter(item => item.id !== source.id)
  return result
}
export const matchesCourse = (item, courseId, course) => !courseId || (item?.courseId ? item.courseId === courseId : Boolean(course && [course.code, course.name].filter(Boolean).includes(item?.course)))
export function teachingOverlap(events, now, minutes) {
  const start = +now, end = start + minutes * 60000
  const overlaps = events.filter(e => eventBlocksTime(e) && Date.parse(e.start) < end && Date.parse(e.end) > start).sort((a, b) => a.start.localeCompare(b.start))
  return { events: overlaps, availableMinutes: overlaps.length ? Math.max(0, Math.floor((Date.parse(overlaps[0].start) - start) / 60000)) : minutes }
}
export function subtractTeaching(intervals, events) {
  let free = intervals.map(i => ({ ...i }))
  for (const event of events.filter(eventBlocksTime)) {
    const start = Date.parse(event.start), end = Date.parse(event.end)
    free = free.flatMap(i => end <= i.start || start >= i.end ? [i] : [start > i.start ? { ...i, end: start } : null, end < i.end ? { ...i, start: end } : null].filter(Boolean))
  }
  return free
}
