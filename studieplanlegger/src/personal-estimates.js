const median = values => { const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 }
const round = value => Math.max(5, Math.round(value / 5) * 5)
export function completedWorkSamples(state) {
  const groups = new Map()
  for (const log of state.workLogs || []) {
    if (!groups.has(log.taskId)) groups.set(log.taskId, [])
    groups.get(log.taskId).push(log)
  }
  return [...groups.values()].flatMap(logs => {
    const task = state.tasks?.find(task => task.id === logs[0].taskId)
    if (!task || !task.completed && !task.submitted) return []
    // A reopening invalidates the old completion. Learn the whole task only
    // after the latest performed work completes it again; absence is no sample.
    const performed = logs.filter(log => log.outcome !== 'not-started').sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const completion = performed.at(-1)
    if (completion?.outcome !== 'done') return []
    if (!completion?.historyComplete || completion.interrupted) return []
    if (!performed.length || performed.some(log => log.actualMinutes === null || log.interrupted)) return []
    const total = performed.reduce((sum, log) => sum + log.actualMinutes, 0)
    return total > 0 && Number.isSafeInteger(total) ? [{ taskId: completion.taskId, minutes: total, task: completion.taskSnapshot }] : []
  })
}
export function personalEstimate(state, task, { kind = 'task' } = {}) {
  if (state.personalization?.enabled === false) return { available: false, reason: 'Personlige forslag er slått av.' }
  const samples = kind === 'session' ? (state.workLogs || []).filter(log => log.outcome !== 'not-started' && !log.interrupted && log.actualMinutes > 0).map(log => ({ minutes: log.actualMinutes, task: log.taskSnapshot })) : completedWorkSamples(state)
  const type = item => Boolean(task.taskType) && item.task.taskType === task.taskType
  const sameCourse = item => task.courseId ? item.task.courseId === task.courseId : Boolean(task.course) && item.task.course === task.course
  const sets = [ { scope: 'samme oppgavetype og emne', values: samples.filter(item => type(item) && sameCourse(item)) }, { scope: 'samme oppgavetype', values: samples.filter(type) }, { scope: 'hele den lokale historikken din', values: samples } ]
  const selected = sets.find(set => set.values.length >= 5)
  if (!selected) return { available: false, count: samples.length, reason: `Minst 5 ${kind === 'task' ? 'fullførte oppgaver med bekreftet, fullstendig faktisk arbeidstid' : 'utførte økter uten avbrudd'} trengs. Du har ${samples.length}.` }
  const values = selected.values.map(item => item.minutes), value = round(median(values))
  return { available: true, kind, count: values.length, scope: selected.scope, minutes: value, range: [Math.min(...values), Math.max(...values)],
    explanation: `Forslag: ${value} min. Median av ${values.length} ${kind === 'task' ? 'hele fullførte oppgaver' : 'utførte økter'} fra ${selected.scope}; registrert spenn ${Math.min(...values)}–${Math.max(...values)} min. Velg selv om dette passer.` }
}
