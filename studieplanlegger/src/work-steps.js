const nonemptyText = value => typeof value === 'string' && value === value.trim() && value.length > 0
const text = value => nonemptyText(value) && value.length <= 2000
const minutes = value => value === null || value === undefined || Number.isSafeInteger(value) && value > 0

export const legacyStepId = taskId => `${taskId}:legacy-next-step`

export function taskSteps(task) {
  const steps = Array.isArray(task.steps) ? task.steps : []
  if (!task.nextStep) return steps
  const legacy = {
    id: legacyStepId(task.id),
    title: task.nextStep.description,
    estimatedMinutes: task.nextStep.estimatedMinutes,
    completed: false,
    ...(task.nextStep.unblocksWaiting ? { unblocksWaiting: true } : {}),
    provenance: { kind: 'legacy-next-step' },
  }
  // A title is not an identity. Consume only explicit legacy origin plus the
  // exact legacy payload. Later completion, notes and dependencies are retained
  // on that existing row; the older field cannot reopen completed work.
  const sameLegacy = step => step.provenance?.kind === 'legacy-next-step' &&
    step.title === legacy.title && step.estimatedMinutes === legacy.estimatedMinutes &&
    Boolean(step.unblocksWaiting) === Boolean(legacy.unblocksWaiting)
  if (steps.some(sameLegacy)) return steps
  let suffix = 2
  while (steps.some(step => step.id === legacy.id)) legacy.id = `${legacyStepId(task.id)}:${suffix++}`
  return [...steps, legacy]
}

export function validWorkSteps(steps) {
  if (!Array.isArray(steps)) return false
  const ids = new Set()
  if (!steps.every(step => {
    // Legacy task IDs and descriptions had no length limit. Preserve that
    // payload and its derived identity without relaxing ordinary step fields.
    const legacy = step?.provenance?.kind === 'legacy-next-step'
    const preservedId = legacy && nonemptyText(step.id) && /^.+:legacy-next-step(?::[1-9]\d*)?$/s.test(step.id)
    if (!step || !(text(step.id) || preservedId) || ids.has(step.id)) return false
    ids.add(step.id)
    return (legacy ? nonemptyText(step.title) : text(step.title)) && typeof step.completed === 'boolean' && minutes(step.estimatedMinutes) &&
      (step.notes === undefined || typeof step.notes === 'string' && step.notes.length <= 2000) &&
      // The graph check below accepts references only to validated step IDs,
      // including preserved legacy IDs longer than the ordinary field limit.
      (step.dependencyIds === undefined || Array.isArray(step.dependencyIds) && new Set(step.dependencyIds).size === step.dependencyIds.length && step.dependencyIds.every(nonemptyText)) &&
      (step.provenance === undefined || validProvenance(step.provenance)) &&
      (step.unblocksWaiting === undefined || typeof step.unblocksWaiting === 'boolean')
  })) return false
  const visiting = new Set(), visited = new Set()
  const visit = id => {
    if (visiting.has(id)) return false
    if (!ids.has(id)) return false
    if (visited.has(id)) return true
    visiting.add(id)
    const step = steps.find(item => item.id === id)
    if (!(step.dependencyIds || []).every(visit)) return false
    visiting.delete(id); visited.add(id); return true
  }
  return [...ids].every(visit)
}

function validProvenance(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    ['manual', 'document', 'legacy-next-step'].includes(value.kind) &&
    (value.sourceId === undefined || text(value.sourceId)) &&
    (value.sourceExcerpt === undefined || typeof value.sourceExcerpt === 'string' && value.sourceExcerpt.length <= 2000)
}

export function primaryWorkStep(task) {
  const steps = taskSteps(task), done = new Set(steps.filter(step => step.completed).map(step => step.id))
  return steps.find(step => !step.completed && (step.dependencyIds || []).every(id => done.has(id))) || null
}

export function migrateLegacyStep(task) {
  if (!task.nextStep) return structuredClone(task)
  const copy = structuredClone(task)
  copy.steps = structuredClone(taskSteps(task))
  delete copy.nextStep
  return copy
}

export function saveWorkSteps(task, steps) {
  if (!Array.isArray(steps)) return { ok: false, error: 'Stegene har en ugyldig eller sirkulær kobling.' }
  // Callers using the stored steps array must not silently discard an additional
  // legacy row. An explicit removal first normalizes the task via removeWorkStep.
  const legacyAdditions = taskSteps(task).filter(step => !task.steps?.some(item => item.id === step.id) && !steps.some(item => item.id === step.id))
  steps = [...steps, ...legacyAdditions]
  if (!validWorkSteps(steps)) return { ok: false, error: 'Stegene har en ugyldig eller sirkulær kobling.' }
  const saved = { ...task, steps: structuredClone(steps) }
  delete saved.nextStep
  return { ok: true, task: saved }
}

export function workStepRemovalGuard(steps, stepId) {
  const dependents = steps.filter(step => step.dependencyIds?.includes(stepId))
  return dependents.length ? {
    ok: false, reason: 'dependent-steps', dependentIds: dependents.map(step => step.id),
    error: `Steget kan ikke fjernes. Disse stegene er avhengige av det: ${dependents.map(step => `«${step.title}»`).join(', ')}. Rediger forutsetningene deres før du fjerner steget.`,
  } : { ok: true }
}

export function removeWorkStep(task, stepId) {
  const normalized = migrateLegacyStep(task), steps = taskSteps(normalized)
  if (!steps.some(step => step.id === stepId)) return { ok: false, error: 'Arbeidssteget finnes ikke.' }
  const guard = workStepRemovalGuard(steps, stepId)
  if (!guard.ok) return guard
  return saveWorkSteps(normalized, steps.filter(step => step.id !== stepId))
}

export function completeWorkStep(task, stepId, completed = true) {
  const steps = taskSteps(task)
  const step = steps.find(item => item.id === stepId)
  if (!step || typeof completed !== 'boolean') return { ok: false, error: 'Arbeidssteget finnes ikke.' }
  if (completed && (step.dependencyIds || []).some(id => !steps.find(item => item.id === id)?.completed)) return { ok: false, error: 'Fullfør stegets forutsetninger først.' }
  return saveWorkSteps(task, steps.map(item => item.id === stepId ? { ...item, completed } : item))
}

export const reopenWorkStep = (task, stepId) => completeWorkStep(task, stepId, false)

export function reorderWorkSteps(task, orderedIds) {
  const steps = taskSteps(task)
  if (!Array.isArray(orderedIds) || orderedIds.length !== steps.length || new Set(orderedIds).size !== steps.length || orderedIds.some(id => !steps.some(step => step.id === id))) return { ok: false, error: 'Rekkefølgen inneholder ukjente eller manglende steg.' }
  return saveWorkSteps(task, orderedIds.map(id => steps.find(step => step.id === id)))
}
