const ids = value => Array.isArray(value) && value.every(id => typeof id === 'string' && id.trim() === id && id.length > 0) && new Set(value).size === value.length

export function validateDependencyGraph(tasks, { relations = false } = {}) {
  if (!Array.isArray(tasks) || tasks.some(task => !task || typeof task.id !== 'string') || new Set(tasks.map(task => task.id)).size !== tasks.length) return { ok: false, error: 'Oppgavelisten er ugyldig.' }
  const map = new Map(tasks.map(task => [task.id, task])), visiting = new Set(), visited = new Set()
  for (const task of tasks) {
    if (task.dependencyIds !== undefined && !ids(task.dependencyIds) || task.missingDependencyIds !== undefined && !ids(task.missingDependencyIds)) return { ok: false, error: 'Velg gyldige, ulike forutsetninger.' }
    if ((task.dependencyIds || []).includes(task.id)) return { ok: false, error: 'En oppgave kan ikke avhenge av seg selv.' }
    if ((task.missingDependencyIds || []).some(id => !(task.dependencyIds || []).includes(id))) return { ok: false, error: 'En manglende forutsetning må være registrert som avhengighet.' }
    if (relations && (task.dependencyIds || []).some(id => !map.has(id) && !(task.missingDependencyIds || []).includes(id))) return { ok: false, error: 'En forutsetning mangler. Behold den som en uttrykkelig blokkering.' }
  }
  for (const id of map.keys()) {
    if (visited.has(id)) continue
    const stack = [{ id, after: false }]
    while (stack.length) {
      const item = stack.pop()
      if (item.after) { visiting.delete(item.id); visited.add(item.id); continue }
      if (visiting.has(item.id)) return { ok: false, error: 'Avhengighetene danner en sirkel. Velg en forutsetning som kan gjøres først.' }
      if (visited.has(item.id) || !map.has(item.id)) continue
      visiting.add(item.id); stack.push({ id: item.id, after: true })
      for (const id of map.get(item.id).dependencyIds || []) stack.push({ id, after: false })
    }
  }
  return { ok: true }
}

export function taskBlockers(task, tasks) {
  const blockers = (task.dependencyIds || []).flatMap(id => {
    const prerequisite = tasks.find(item => item.id === id)
    return prerequisite?.completed || prerequisite?.submitted ? [] : [{ id, missing: !prerequisite, reason: prerequisite ? `Venter på «${prerequisite.title}».` : `Forutsetningen ${id} er slettet eller mangler. Gjenopprett eller fjern koblingen selv.` }]
  })
  if (task.waitingReason?.trim()) blockers.push({ waiting: true, reason: task.waitingReason })
  return blockers
}

export function canStartTask(task, tasks, { nextStep = false } = {}) {
  if (task.completed || task.submitted) return false
  return taskBlockers(task, tasks).every(blocker => blocker.waiting && nextStep && task.nextStep?.unblocksWaiting === true)
}

export function preserveMissingDependencies(tasks) {
  const existing = new Set(tasks.map(task => task.id))
  return tasks.map(task => {
    if (!task.dependencyIds?.length && !task.missingDependencyIds?.length) return task
    const missing = (task.dependencyIds || []).filter(id => !existing.has(id))
    const next = { ...task }
    if (missing.length) next.missingDependencyIds = missing; else delete next.missingDependencyIds
    return next
  })
}

export function unblocksCount(task, tasks) {
  return tasks.filter(other => !other.completed && !other.submitted && (other.dependencyIds || []).includes(task.id)).length
}

// A completed intermediate task no longer needs its prerequisites. Do not carry
// urgency backwards through it, or through a task that has been deleted.
export function reachableUnfinishedDependents(task, tasks) {
  if (task.completed || task.submitted || !tasks.some(item => item.id === task.id)) return []
  const children = new Map()
  for (const other of tasks) if (!other.completed && !other.submitted) for (const id of other.dependencyIds || []) {
    if (!children.has(id)) children.set(id, [])
    children.get(id).push(other)
  }
  const seen = new Set([task.id]), pending = [...(children.get(task.id) || [])], result = []
  for (let index = 0; index < pending.length; index++) {
    const other = pending[index]
    if (seen.has(other.id)) continue
    seen.add(other.id); result.push(other); pending.push(...(children.get(other.id) || []))
  }
  return result
}

export function actionUrgency(task, tasks) {
  const dependents = reachableUnfinishedDependents(task, tasks)
  const downstream = dependents.filter(other => other.deadlineLocal)
    .sort((a, b) => a.deadlineLocal.localeCompare(b.deadlineLocal))[0] || null
  const deadlineLocal = [task.deadlineLocal, downstream?.deadlineLocal].filter(Boolean).sort()[0] || ''
  return { deadlineLocal, downstream, count: dependents.length }
}
