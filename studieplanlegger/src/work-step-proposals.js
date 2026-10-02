import { validWorkSteps, taskSteps, saveWorkSteps } from './work-steps.js'

const clean = value => typeof value === 'string' ? value.trim() : ''
const identifier = (sourceId, key) => `step:${sourceId}:${key}`

// Parsing remains local. This function classifies only explicit evidence and
// leaves uncertain rows unresolved instead of inventing a requirement.
export function createWorkStepProposal({ sourceId, rows = [], taskId }) {
  if (!clean(sourceId) || !clean(taskId) || !Array.isArray(rows)) return { ok: false, error: 'Kilde og oppgave må velges.' }
  const entries = rows.map((row, index) => {
    const title = clean(row.title || row.description || row.text)
    const explicitRequirement = row.kind === 'requirement' || row.required === true
    return {
      key: clean(row.key) || String(index + 1),
      category: explicitRequirement ? 'requirement' : row.kind === 'method' ? 'method' : 'unresolved',
      title,
      sourceExcerpt: clean(row.sourceExcerpt || row.text).slice(0, 2000),
      included: Boolean(title && explicitRequirement),
      ...(Number.isSafeInteger(row.estimatedMinutes) && row.estimatedMinutes > 0 ? { estimatedMinutes: row.estimatedMinutes } : {}),
    }
  })
  return { ok: true, sourceId, taskId, entries, original: structuredClone(entries) }
}

export function approveWorkStepProposal(task, proposal) {
  if (!proposal?.ok || proposal.taskId !== task.id) return { ok: false, error: 'Forslaget tilhører ikke oppgaven.' }
  const additions = proposal.entries.filter(entry => entry.included).map(entry => ({
    id: identifier(proposal.sourceId, entry.key), title: clean(entry.title), completed: false,
    ...(entry.estimatedMinutes ? { estimatedMinutes: entry.estimatedMinutes } : {}),
    provenance: { kind: 'document', sourceId: proposal.sourceId, sourceExcerpt: entry.sourceExcerpt },
  }))
  const current = taskSteps(task)
  const merged = [...current, ...additions.filter(item => !current.some(step => item.id === step.id))]
  if (!validWorkSteps(merged)) return { ok: false, error: 'Kontroller alle valgte steg. Ingen steg er lagret.' }
  return saveWorkSteps(task, merged)
}
