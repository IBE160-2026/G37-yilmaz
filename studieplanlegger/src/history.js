import { validTasks } from './tasks.js'
import { validPlanner } from './planner.js'
import { validSessions } from './capacity.js'
import { validWindows } from './work-capacity.js'
import { validWorkLogs } from './work-log.js'
import { validImportSources } from './import-source-contract.js'
import { validConnectedPreferences } from './planning-rules.js'
import { validateDependencyGraph } from './task-dependencies.js'
const clone = value => value === undefined ? undefined : structuredClone(value)
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sourceBookkeeping = new Set(['lastAttempt', 'lastSuccess', 'lastUpdated', 'lastError', 'failures'])
const semantic = (value, path) => path === 'planner.sources' && value ? Object.fromEntries(Object.entries(value).filter(([key]) => !sourceBookkeeping.has(key))) : value
const scalarPaths = ['planningPreferences', 'personalization', 'onboarding']
const paths = ['tasks', 'sessions', 'workWindows', 'busyWindows', 'planner.courses', 'planner.events', 'planner.sources', 'workLogs', 'importSources', ...scalarPaths]
const get = (value, path) => path.split('.').reduce((node, key) => node?.[key], value)
const collection = (value, path) => scalarPaths.includes(path) ? get(value, path) === undefined ? [] : [{ id: path, value: get(value, path) }] : get(value, path) || []
function set(value, path, next) {
  const keys = path.split('.'); let node = value
  for (const key of keys.slice(0, -1)) node = node[key] ||= {}
  if (next === undefined) delete node[keys.at(-1)]
  else node[keys.at(-1)] = scalarPaths.includes(path) ? next[0]?.value : next
}
export const emptyHistory = () => ({ version: 1, undo: [], trash: [] })
export function validHistory(value, envelope) {
  const validEntry = entry => entry && typeof entry.id === 'string' && typeof entry.label === 'string' && Number.isFinite(Date.parse(entry.at)) && Array.isArray(entry.changes) && entry.changes.every(c => paths.includes(c.path) && typeof c.id === 'string' && Number.isInteger(c.index) && c.index >= 0 && (c.before == null || c.before.id === c.id) && (c.after == null || c.after.id === c.id))
  if (!(value?.version === 1 && ['undo', 'trash'].every(key => Array.isArray(value[key]) && value[key].every(validEntry) && new Set(value[key].map(e => e.id)).size === value[key].length))) return false
  const changes = [...value.undo, ...value.trash].flatMap(entry => entry.changes)
  const items = path => [...collection(envelope, path), ...changes.filter(c => c.path === path).flatMap(c => [c.before, c.after].filter(Boolean))]
  const courses = [...new Map(items('planner.courses').map(c => [c.id, c])).values()]
  const sources = items('planner.sources'), tasks = items('tasks')
  for (const entry of [...value.undo, ...value.trash]) {
    if (new Set(entry.changes.map(c => `${c.path}:${c.id}`)).size !== entry.changes.length) return false
    for (const change of entry.changes) for (const item of [change.before, change.after].filter(Boolean)) {
      if (change.path === 'tasks' && (!validTasks([item]) || (envelope && item.courseId && !courses.some(c => c.id === item.courseId)))) return false
      if (change.path === 'sessions' && (!validSessions([item]) || (envelope && item.taskId && !tasks.some(t => t.id === item.taskId)))) return false
      if (['workWindows', 'busyWindows'].includes(change.path) && !validWindows([item])) return false
      if (change.path === 'planner.courses' && !validPlanner({ courses: [item], events: [], sources: [] })) return false
      if (change.path === 'planner.events' && (!validPlanner({ courses, events: [item], sources: [] }) || (envelope && item.sourceId && !sources.some(s => s.id === item.sourceId && s.courseId === item.courseId)))) return false
      if (change.path === 'planner.sources' && !validPlanner({ courses, events: [], sources: [item] })) return false
      if (change.path === 'workLogs' && !validWorkLogs([item])) return false
      if (change.path === 'importSources' && !validImportSources([item])) return false
      if (scalarPaths.includes(change.path) && (item.id !== change.path || !validConnectedPreferences({ [change.path]: item.value }))) return false
    }
  }
  return true
}
export function recordChange(before, after, history = emptyHistory(), label = 'Endring', now = new Date()) {
  const changes = []
  for (const path of paths) {
    const a = collection(before, path), b = collection(after, path)
    for (const id of new Set([...a, ...b].map(item => item.id))) {
      const old = a.find(item => item.id === id), next = b.find(item => item.id === id)
      if (!equal(old, next)) changes.push({ path, id, index: old ? a.indexOf(old) : b.indexOf(next), before: clone(old) ?? null, after: clone(next) ?? null, existed: get(before, path) !== undefined })
    }
  }
  if (!changes.length) return clone(history)
  const entry = { id: crypto.randomUUID(), label, at: now.toISOString(), changes, plannerExisted: before.planner !== undefined }
  const deleted = changes.some(c => c.before && (!c.after || (!c.before.deleted && c.after.deleted)))
  return { version: 1, undo: [...history.undo, entry].slice(-30), trash: deleted ? [...history.trash, clone(entry)] : clone(history.trash) }
}
export function restoreChange(state, entry) {
  if (!entry) return { ok: false, error: 'Ingen endring å angre.' }
  const result = clone(state)
  for (const change of entry.changes) {
    const current = collection(result, change.path).find(item => item.id === change.id)
    if (!equal(semantic(current ?? null, change.path), semantic(change.after, change.path))) return { ok: false, error: 'Kan ikke gjenopprette: en av opplysningene er endret siden. Ingen data er overskrevet.' }
  }
  for (const path of paths) {
    const changes = entry.changes.filter(c => c.path === path)
    if (!changes.length) continue
    const currentItems = collection(result, path)
    const items = currentItems.filter(item => !changes.some(c => c.id === item.id))
    for (const c of changes.filter(c => c.before).sort((a, b) => a.index - b.index)) {
      const before = clone(c.before)
      if (path === 'planner.sources') {
        const current = currentItems.find(item => item.id === c.id)
        for (const key of sourceBookkeeping) if (current && key in current) before[key] = clone(current[key])
      }
      items.splice(Math.min(c.index, items.length), 0, before)
    }
    set(result, path, !items.length && changes.every(c => !c.existed) ? undefined : items)
  }
  if (!entry.plannerExisted && result.planner && !Object.values(result.planner).some(value => Array.isArray(value) ? value.length : Boolean(value))) delete result.planner
  const graph = validateDependencyGraph(result.tasks, { relations: true })
  if (!graph.ok) return graph
  return { ok: true, state: result }
}
export function undoLast(state, history = emptyHistory()) {
  const entry = history.undo.at(-1), restored = restoreChange(state, entry)
  return restored.ok ? { ...restored, history: { ...history, undo: history.undo.slice(0, -1), trash: history.trash.filter(item => item.id !== entry.id) } } : restored
}
export function restoreTrash(state, history, id) {
  const restored = restoreChange(state, history.trash.find(item => item.id === id))
  return restored.ok ? { ...restored, history: { ...history, undo: history.undo.filter(item => item.id !== id), trash: history.trash.filter(item => item.id !== id) } } : restored
}
