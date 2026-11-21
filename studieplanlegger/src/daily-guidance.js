import { getActionMinutes, getRemainingRange, formatEstimateRange, selectTasksForMinutes, sortedTasks, isOverdue } from './tasks.js'
import { canStartTask, taskBlockers } from './task-dependencies.js'
import { primaryWorkStep } from './work-steps.js'
import { previewStudyPlan } from './replanning.js'

export function formatDuration(minutes) {
  if (!Number.isSafeInteger(minutes) || minutes < 0) return 'ukjent tid'
  const hours = Math.floor(minutes / 60), rest = minutes % 60
  if (!hours) return `${rest} minutter`
  if (!rest) return `${hours} ${hours === 1 ? 'time' : 'timer'}`
  return `${hours} ${hours === 1 ? 'time' : 'timer'} og ${rest} minutter`
}

export function knownMinimumShortage(range, availableBeforeMinutes) {
  if (range?.maxMinutes !== null || !Number.isFinite(availableBeforeMinutes)) return null
  return Math.max(0, range.minMinutes - availableBeforeMinutes)
}

export function rankedSuggestions(tasks, minutes, { completeOnly = false } = {}) {
  const candidates = selectTasksForMinutes(tasks, minutes, { includePartial: true, completeOnly })
  if (candidates.length <= 2) return candidates
  const recommended = candidates[0]
  const shortest = [...candidates.slice(1)].sort((a, b) => getActionMinutes(a) - getActionMinutes(b) || a.id.localeCompare(b.id))[0]
  const alternative = candidates.slice(1).find(task => task.id !== shortest.id)
  return [recommended, alternative, shortest].filter(Boolean)
}

export function suggestionExclusions(tasks, minutes) {
  const eligible = new Set(selectTasksForMinutes(tasks, minutes, { includePartial: true }).map(task => task.id))
  return tasks.filter(task => !task.completed && !task.submitted && !eligible.has(task.id)).map(task => {
    const step = primaryWorkStep(task)
    let reason
    if (!canStartTask(task, tasks, { nextStep: Boolean(step) })) {
      const blockers = taskBlockers(task, tasks).filter(blocker => !blocker.waiting || !step?.unblocksWaiting)
      reason = `${blockers.map(blocker => blocker.reason).join(' ')} Åpne oppgaven for å avklare venting eller forutsetninger.`
    } else if (getRemainingRange(task)?.maxMinutes === 0) {
      reason = 'Gjenstående arbeid er satt til 0, men oppgaven er ikke markert ferdig. Oppdater anslaget eller marker arbeidet ferdig.'
    } else if (!step && task.splittable === false && getRemainingRange(task)?.maxMinutes === null) {
      reason = 'Oppgi hvor lang tid oppgaven kan ta på det meste, så Ajour kan se om den får plass i én økt.'
    } else if (!Number.isSafeInteger(getActionMinutes(task)) || getActionMinutes(task) <= 0) {
      reason = 'Oppgi hvor mye tid som gjenstår for oppgaven eller neste arbeidssteg.'
    } else {
      reason = `Arbeidet kan ikke deles og trenger ${getActionMinutes(task)} minutter sammenhengende. Velg mer tid, eller aktiver «Kan deles i flere økter» hvis arbeidet kan deles.`
    }
    return { taskId: task.id, title: task.title, reason }
  })
}

export function dailyStatus(model, planPreview = previewStudyPlan) {
  const now = model.now || new Date()
  const pending = sortedTasks(model.tasks.filter(task => !task.completed || task.requiresSubmission && !task.submitted))
  const task = pending.find(item => item.deadlineLocal) || pending[0]
  if (!task) return { tone: 'neutral', title: 'Ingen åpne oppgaver', text: 'Ingen åpne oppgaver.' }
  if (task.completed && task.requiresSubmission && !task.submitted) return { tone: 'neutral', title: task.title, text: `Oppgaven «${task.title}» er klar til levering. Velg «Bekreft levering» når du har levert den.`, taskId: task.id, assessable: true }
  const range = getRemainingRange(task)
  if (isOverdue(task, now)) return { tone: 'danger', title: task.title, text: `Fristen for «${task.title}» har gått ut. ${range ? `Du har registrert ${formatEstimateRange(range)} arbeid igjen.` : 'Gjenstående arbeid er ukjent.'}`, taskId: task.id, assessable: Boolean(range), availableMinutes: 0, missingMinMinutes: range?.minMinutes ?? null, missingMaxMinutes: range?.maxMinutes ?? null }
  const blockers = taskBlockers(task, model.tasks)
  const openEstimate = range?.maxMinutes === null
  const estimateNote = openEstimate ? `${range.minMinutes === 241 ? 'Du har oppgitt mer enn fire timer.' : `Du har oppgitt minst ${range.minMinutes} minutter.`} Øvre anslag er ukjent.` : ''
  const cannotAssess = reason => ({
    tone: 'neutral', title: task.title, text: ['Kan ikke vurderes ennå.', reason, estimateNote].filter(Boolean).join(' '),
    taskId: task.id, assessable: false,
  })
  if (!range) return cannotAssess('Gjenstående arbeid er ukjent.')
  if (!task.deadlineLocal) return cannotAssess('Fristen er ikke registrert.')
  if (!model.workWindows?.length) {
    return cannotAssess(blockers.map(item => item.reason).join(' ') || 'Registrer når du kan studere under Planlegg uken.')
  }

  const preview = planPreview(model, { now })
  if (!preview.ok || !Object.hasOwn(preview.retainedMinutes, task.id)) {
    const reason = preview.error || preview.blockedTasks?.find(item => item.taskId === task.id)?.reason
      || (range.maxMinutes === 0 ? 'Gjenstående arbeid er satt til 0. Bekreft status for oppgaven.' : 'Fristen må avklares før tiden kan planlegges.')
    return cannotAssess(reason)
  }
  const deficit = preview.deficitRanges[task.id]
  const available = preview.allocatedMinutes[task.id] + preview.retainedMinutes[task.id]
  const missingMin = deficit?.minMinutes ?? 0
  const missingMax = openEstimate ? null : deficit?.maxMinutes ?? 0
  const timeBasis = `Ukeplanen får plass til ${formatDuration(available)} før fristen.${blockers.length ? ' Forslaget forutsetter at de andre oppgavene blir ferdige først.' : ''}`
  if (openEstimate) {
    const text = `${timeBasis} ${missingMin ? `Minst ${missingMin} minutter mangler. ` : ''}${estimateNote}`
    return { tone: missingMin ? 'danger' : 'neutral', title: task.title, text, taskId: task.id, assessable: missingMin > 0, availableMinutes: available, missingMinMinutes: missingMin, missingMaxMinutes: null }
  }
  const start = `${task.title} har anslagsvis ${formatEstimateRange(range)} arbeid igjen. ${timeBasis}`
  if (!missingMax) return { tone: 'good', title: task.title, text: `${start} Planen går opp ut fra det du har registrert.`, taskId: task.id, assessable: true, availableMinutes: available, missingMinMinutes: 0, missingMaxMinutes: 0 }
  const continuity = task.splittable === false ? ' Arbeidet må få plass i én sammenhengende økt.' : ''
  const shortage = missingMin === missingMax ? `${formatDuration(missingMax)} mangler.` : missingMin ? `${formatDuration(missingMin)}–${formatDuration(missingMax)} er ikke planlagt.` : `Det kan mangle opptil ${formatDuration(missingMax)}.`
  return { tone: 'danger', title: task.title, text: `${start}${continuity} ${shortage}`, taskId: task.id, assessable: true, availableMinutes: available, missingMinMinutes: missingMin, missingMaxMinutes: missingMax }
}
