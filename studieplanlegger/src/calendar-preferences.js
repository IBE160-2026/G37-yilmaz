import { Temporal } from '@js-temporal/polyfill'
const views = ['day', 'week', 'month', 'agenda']
const kinds = ['teaching', 'personal', 'deadline', 'session', 'work', 'busy', 'information']
function validDate(value) {
  try { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Temporal.PlainDate.from(value).toString() === value } catch { return false }
}
export function validCalendarPreferences(value) {
  return Boolean(value && [1, 2].includes(value.version) && views.includes(value.view) && validDate(value.date) && typeof value.courseId === 'string' &&
    (value.weekMode === undefined || ['full', 'workweek'].includes(value.weekMode)) &&
    Array.isArray(value.kinds) && value.kinds.every(kind => kinds.includes(kind)) && new Set(value.kinds).size === value.kinds.length &&
    typeof value.completed === 'boolean' && typeof value.cancelled === 'boolean' && value.scroll && typeof value.scroll === 'object' && !Array.isArray(value.scroll) &&
    Object.entries(value.scroll).every(([key, point]) => views.some(view => key.startsWith(`${view}:`) && validDate(view === 'week' ? key.slice(view.length + 1).replace(/:workweek$/, '') : key.slice(view.length + 1))) && point && ['top', 'left'].every(axis => Number.isFinite(point[axis]) && point[axis] >= 0 && point[axis] <= 10_000_000)))
}

// `personal` was added without changing the persisted schema version. Older
// version-1 preferences therefore need an additive default so existing users
// do not silently hide a new calendar kind.
export function normalizeCalendarPreferences(value) {
  if (!value) return value
  const normalized = structuredClone(value)
  if (normalized.version === 1) {
    normalized.version = 2
    if (Array.isArray(normalized.kinds) && !normalized.kinds.includes('personal')) normalized.kinds.push('personal')
  }
  return normalized
}
