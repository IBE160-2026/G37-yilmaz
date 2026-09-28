import { getActionMinutes, getRemainingRange, formatEstimateRange, selectTasksForMinutes, sortedTasks, isOverdue } from './tasks.js'
import { taskBlockers } from './task-dependencies.js'

export function formatDuration(minutes) {
  if (!Number.isSafeInteger(minutes) || minutes < 0) return 'ukjent tid'
  const hours = Math.floor(minutes / 60), rest = minutes % 60
  if (!hours) return `${rest} minutter`
  if (!rest) return `${hours} ${hours === 1 ? 'time' : 'timer'}`
  return `${hours} ${hours === 1 ? 'time' : 'timer'} og ${rest} minutter`
}

export function rankedSuggestions(tasks, minutes) {
  const candidates = selectTasksForMinutes(tasks, minutes)
  if (candidates.length <= 2) return candidates
  const recommended = candidates[0]
  const shortest = [...candidates.slice(1)].sort((a, b) => getActionMinutes(a) - getActionMinutes(b) || a.id.localeCompare(b.id))[0]
  const alternative = candidates.slice(1).find(task => task.id !== shortest.id)
  return [recommended, alternative, shortest].filter(Boolean)
}

export function dailyStatus(model) {
  const now = model.now || new Date()
  const pending = sortedTasks(model.tasks.filter(task => !task.completed || task.requiresSubmission && !task.submitted))
  const task = pending.find(item => item.deadlineLocal) || pending[0]
  if (!task) return { tone: 'neutral', title: 'Ingen åpne oppgaver', text: 'Du har ingen registrerte oppgaver som må vurderes nå.' }
  if (task.completed && task.requiresSubmission && !task.submitted) return { tone: 'neutral', title: task.title, text: `${task.title} er registrert som ferdig, men levering er ikke bekreftet. Bekreft levering separat${task.deadlineLocal ? ' før den registrerte fristen' : ''}.`, taskId: task.id, assessable: true }
  const range = getRemainingRange(task)
  if (isOverdue(task, now)) return { tone: 'danger', title: task.title, text: `${task.title} har en frist som er passert. ${range ? `${formatEstimateRange(range)} arbeid er fortsatt registrert, og ingen tilgjengelig tid før fristen gjenstår.` : 'Gjenstående arbeid er ukjent.'}`, taskId: task.id, assessable: Boolean(range), availableMinutes: 0, missingMinMinutes: range?.minMinutes ?? null, missingMaxMinutes: range?.maxMinutes ?? null }
  const entry = model.capacity?.tasks?.find(item => item.taskId === task.id)
  const blockers = taskBlockers(task, model.tasks)
  if (!range || range.maxMinutes === null || !task.deadlineLocal || !entry || entry.availableBeforeMinutes == null || blockers.length) {
    const reason = !range ? 'Gjenstående arbeid er ukjent.' : range.maxMinutes === null ? 'Arbeidsmengden har ingen øvre grense ennå.' : !task.deadlineLocal ? 'Fristen er ikke registrert.' : blockers.length ? blockers.map(item => item.reason).join(' ') : 'Registrer arbeidstid før fristen.'
    return { tone: 'neutral', title: task.title, text: `Kan ikke vurderes ennå. ${reason}`, taskId: task.id, assessable: false }
  }
  const available = entry.availableBeforeMinutes
  const missingMin = Math.max(0, range.minMinutes - available)
  const missingMax = Math.max(0, range.maxMinutes - available)
  const start = `${task.title} har anslagsvis ${formatEstimateRange(range)} arbeid igjen. Du har ${formatDuration(available)} tilgjengelig før fristen.`
  if (!missingMax) return { tone: 'good', title: task.title, text: `${start} Planen går opp ut fra det du har registrert.`, taskId: task.id, assessable: true, availableMinutes: available, missingMinMinutes: 0, missingMaxMinutes: 0 }
  const shortage = missingMin === missingMax ? `${formatDuration(missingMax)} mangler.` : missingMin ? `${formatDuration(missingMin)}–${formatDuration(missingMax)} mangler.` : `Det kan mangle opptil ${formatDuration(missingMax)}.`
  return { tone: 'danger', title: task.title, text: `${start} ${shortage}`, taskId: task.id, assessable: true, availableMinutes: available, missingMinMinutes: missingMin, missingMaxMinutes: missingMax }
}
