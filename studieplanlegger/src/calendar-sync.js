import { parseCalendar } from './calendar-import.js'
import { mergeImport, semesterWindow } from './planner.js'
import { sourceCoverage, disappearancePolicy, UNKNOWN_COVERAGE_WARNING } from './source-coverage.js'

export const REFRESH_INTERVAL = 30 * 60 * 1000
export const MAX_BACKOFF = 24 * 60 * 60 * 1000
export function nextRefresh(source) {
  const last = Date.parse(source.lastAttempt || source.lastSuccess || source.lastUpdated) || 0
  return last + Math.min(MAX_BACKOFF, REFRESH_INTERVAL * 2 ** Math.min(source.failures || 0, 6))
}
export function eligibleSource(source, course, now = Date.now()) {
  if (source.kind !== 'url' || !source.url || source.reconnectRequired || source.autoRefresh === false || !course) return false
  try { return now < Date.parse(semesterWindow(course.semester, course.year).end) && now >= nextRefresh(source) } catch { return false }
}
export async function fetchCalendar(url) {
  const response = await fetch('/api/import/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(30000) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Kilden kunne ikke hentes.')
  return data.calendar
}
export function createCalendarSync({ getState, commit, isEditing, visible = () => !document.hidden, fetchText = fetchCalendar, clock = () => Date.now() }) {
  let running = false
  const attempted = new Map()
  return { async tick() {
    if (running || !visible() || isEditing()) return
    running = true
    try {
      for (const savedSource of getState().planner?.sources || []) {
        const original = structuredClone(savedSource)
        const now = clock(), course = structuredClone(getState().planner?.courses.find(c => c.id === original.courseId))
        if (isEditing() || !visible()) break
        if (!eligibleSource(original, course, now) || now - (attempted.get(original.id) || 0) < REFRESH_INTERVAL) continue
        attempted.set(original.id, now)
        const stamp = new Date(now).toISOString()
        let parsed, error
        try { parsed = parseCalendar(await fetchText(original.url), { ...course, courseId: course.id }) } catch (failure) { error = failure.message }
        if (isEditing() || !visible()) continue
        const state = getState(), current = state.planner?.sources.find(s => s.id === original.id)
        if (!current || JSON.stringify(current) !== JSON.stringify(original) || JSON.stringify(state.planner.courses.find(c => c.id === course.id)) !== JSON.stringify(course)) continue
        if (error) {
          const planner = structuredClone(state.planner), source = planner.sources.find(s => s.id === original.id)
          Object.assign(source, { lastAttempt: stamp, lastError: error, failures: (source.failures || 0) + 1 })
          commit(planner); continue
        }
        const selected = parsed.events.filter(e => current.groups.includes(e.group) && !(current.excludedKeys || []).includes(e.sourceKey))
        const allGroups = [...new Set(parsed.events.map(e => e.group))]
        const knownGroups = current.allGroups || [...current.groups, ...state.planner.events.filter(e => e.sourceId === current.id).map(e => e.group)]
        const pendingGroups = [...new Set([...(current.pendingGroups || []), ...allGroups.filter(group => !knownGroups.includes(group))])]
        const newGroups = pendingGroups.length > 0
        const source = { ...current, lastAttempt: stamp, lastSuccess: stamp, lastUpdated: stamp, failures: 0, lastError: '', identityMode: parsed.identityMode, syncWarnings: parsed.warnings, allGroups: [...new Set([...knownGroups, ...allGroups])], pendingGroups }
        // Unknown/new groups remain a manual choice. Partial data never removes old events.
        if (newGroups) source.syncWarnings = [...parsed.warnings, 'Nye aktiviteter finnes. Kontroller gruppene med Oppdater nå.']
        source.coverage = sourceCoverage(source, course)
        if (source.coverage.kind === 'unknown') source.syncWarnings = [...source.syncWarnings, UNKNOWN_COVERAGE_WARNING]
        const policy = disappearancePolicy(source, course, parsed)
        const result = mergeImport(state.planner, selected, source, { ...policy, authoritative: policy.authoritative && !newGroups })
        commit(result.planner)
      }
    } finally { running = false }
  } }
}
