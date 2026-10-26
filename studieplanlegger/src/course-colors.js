// Appearance preferences stay local to this browser and are not planner data or
// part of a backup. Retain deleted IDs so undo/reimport can restore their colour.
export const COURSE_COLOR_STORAGE_KEY = 'ajour.course-colors.v1'
export const COURSE_COLOR_COUNT = 12

const validId = id => typeof id === 'string' && id.trim().length > 0
const validSlot = slot => Number.isInteger(slot) && slot >= 1 && slot <= COURSE_COLOR_COUNT
const variable = (slot, variant) => `var(--course-${slot ?? 'neutral'}-${variant})`

export function createCourseColorRegistry(getStorage = () => globalThis.localStorage) {
  const assignments = new Map()
  let previousActive = new Set()
  let persistedAssignments = new Map()
  let persistedActive = new Set()
  let pendingPersistence = false
  let loaded = false

  const sameIds = (left, right) => left.size === right.size && [...left].every(id => right.has(id))
  const sameAssignments = (left, right) => left.size === right.size && [...left].every(([id, slot]) => right.get(id) === slot)

  function read() {
    try {
      const storage = getStorage()
      if (!storage) return null
      let saved
      try { saved = JSON.parse(storage.getItem(COURSE_COLOR_STORAGE_KEY) || 'null') }
      catch (error) {
        if (!(error instanceof SyntaxError)) throw error
      }
      const stored = new Map()
      if (saved?.version === 1 && saved.assignments && typeof saved.assignments === 'object' && !Array.isArray(saved.assignments)) {
        for (const [id, slot] of Object.entries(saved.assignments)) {
          if (validId(id) && validSlot(slot)) stored.set(id, slot)
        }
      }
      const active = new Set(Array.isArray(saved?.activeIds) ? saved.activeIds.filter(id => stored.has(id)) : stored.keys())
      for (const [id, slot] of stored) {
        // Newer persisted changes win, while an unchanged persisted baseline
        // must not discard a local assignment whose write previously failed.
        if (!assignments.has(id) || persistedAssignments.get(id) !== slot) assignments.set(id, slot)
      }
      if (!loaded || !sameIds(active, persistedActive)) previousActive = active
      persistedAssignments = stored
      persistedActive = active
      loaded = true
      return storage
    } catch { return null /* Denied preferences leave the in-memory registry usable. */ }
  }

  function persist(storage) {
    pendingPersistence = !sameAssignments(assignments, persistedAssignments) || !sameIds(previousActive, persistedActive)
    if (!storage || !pendingPersistence) return
    try {
      storage.setItem(COURSE_COLOR_STORAGE_KEY, JSON.stringify({ version: 1, assignments: Object.fromEntries(assignments), activeIds: [...previousActive] }))
      persistedAssignments = new Map(assignments)
      persistedActive = new Set(previousActive)
      pendingPersistence = false
    } catch { /* Keep persistence pending so an unchanged registration retries. */ }
  }

  function sync() {
    const before = new Map(assignments)
    const storage = read()
    persist(storage)
    return !sameAssignments(before, assignments)
  }

  function register(courses = []) {
    const before = new Map(assignments)
    // Read immediately before allocating/writing: another tab may have added
    // history or repaired an existing ID's collision since our last render.
    const storage = read()
    // Register the complete collection before any filtered view renders. Sorting
    // new IDs makes initial allocation deterministic without depending on a view.
    const ids = [...new Set(courses.map(course => course?.id).filter(validId))].sort()
    const activeCounts = Array(COURSE_COLOR_COUNT).fill(0)
    const historicalCounts = Array(COURSE_COLOR_COUNT).fill(0)
    for (const slot of assignments.values()) historicalCounts[slot - 1] += 1
    for (const id of ids) {
      const slot = assignments.get(id)
      if (slot) activeCounts[slot - 1] += 1
    }
    if (ids.length <= COURSE_COLOR_COUNT) {
      const claimed = new Set()
      const priority = [...ids].sort((a, b) => Number(previousActive.has(b)) - Number(previousActive.has(a)) || (a < b ? -1 : a > b ? 1 : 0))
      for (const id of priority) {
        const slot = assignments.get(id)
        if (!slot) continue
        if (!claimed.has(slot)) { claimed.add(slot); continue }
        // At most twelve active courses must stay distinguishable. A restored
        // ID keeps its historic slot unless another active ID has taken it. In
        // that case only the colliding ID moves to a free slot. The same rule
        // repairs corrupt duplicate maps and collisions when >12 shrinks to 12.
        const free = activeCounts.findIndex(count => count === 0)
        if (free < 0) continue
        assignments.set(id, free + 1)
        activeCounts[slot - 1] -= 1
        historicalCounts[slot - 1] -= 1
        activeCounts[free] += 1
        historicalCounts[free] += 1
        claimed.add(free + 1)
      }
    }
    for (const id of ids) {
      if (assignments.has(id)) continue
      // Prefer an unused active slot, then the least reused history, then the
      // lowest slot. Beyond twelve, balance reuse without recolouring any ID.
      let best = 0
      for (let index = 1; index < COURSE_COLOR_COUNT; index += 1) {
        if (activeCounts[index] < activeCounts[best] ||
          activeCounts[index] === activeCounts[best] && historicalCounts[index] < historicalCounts[best]) best = index
      }
      assignments.set(id, best + 1)
      activeCounts[best] += 1
      historicalCounts[best] += 1
    }
    previousActive = new Set(ids)
    loaded = true
    persist(storage)
    return !sameAssignments(before, assignments)
  }

  function slotFor(courseId) {
    if (!loaded) read()
    return validId(courseId) ? assignments.get(courseId) ?? null : null
  }

  return { register, slotFor, sync }
}

const registry = createCourseColorRegistry()
let registeredCourses = []
const refreshCourseNodes = () => {
  for (const node of globalThis.document?.querySelectorAll?.('[data-course-color-id]') ?? []) applyCourseColor(node, node.dataset.courseColorId)
}
export const registerCourseColors = courses => {
  registeredCourses = courses
  if (registry.register(courses)) refreshCourseNodes()
}
export const synchronizeCourseColors = () => { if (registry.sync()) refreshCourseNodes() }
export const courseColorSlot = courseId => registry.slotFor(courseId)
export const courseColor = courseId => variable(courseColorSlot(courseId), 'marker')

globalThis.addEventListener?.('storage', event => {
  if (event.key !== COURSE_COLOR_STORAGE_KEY && event.key !== null) return
  try { if (event.storageArea && event.storageArea !== globalThis.localStorage) return } catch { return }
  synchronizeCourseColors()
})
globalThis.addEventListener?.('focus', synchronizeCourseColors)

// Legacy task text can identify a known course only when it has exactly one
// match in the complete collection. This display fallback never changes domain
// data and never invents an identity from a code, name or current view position.
export function resolvedCourseId(item, courses = registeredCourses) {
  if (validId(item?.courseId)) return item.courseId
  const normalize = value => typeof value === 'string' ? value.trim().toLocaleLowerCase('nb-NO') : ''
  const text = normalize(item?.course)
  if (!text) return null
  const matches = new Set(courses.filter(course => validId(course?.id) && [course.code, course.name].some(label => normalize(label) === text)).map(course => course.id))
  return matches.size === 1 ? [...matches][0] : null
}

// The CSS variables change with the theme; existing nodes and drafts stay intact.
export function applyCourseColor(node, courseId) {
  const slot = courseColorSlot(courseId)
  node.style.setProperty('--course-color', variable(slot, 'marker'))
  node.style.setProperty('--course-bg', variable(slot, 'bg'))
  node.style.setProperty('--course-text', variable(slot, 'text'))
  node.dataset.courseSlot = slot === null ? 'neutral' : String(slot)
  if (validId(courseId)) node.dataset.courseColorId = courseId
  else delete node.dataset.courseColorId
  return node
}
