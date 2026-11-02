import { getActionMinutes, getSessionMinutes, getRemainingRange, formatEstimateRange } from './tasks.js'
import { primaryWorkStep } from './work-steps.js'
import { applyCourseColor, resolvedCourseId } from './course-colors.js'

const el = (tag, text, className = '') => { const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node }

export function createStudySessionView(actions) {
  const dialog = el('dialog', '', 'editor-dialog connected-dialog study-session-dialog')
  document.body.append(dialog)
  let opener, taskId, plannedMinutes, started = false
  const close = () => { dialog.close(); started = false; actions.onClose?.(); opener?.focus({ preventScroll: true }) }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  return {
    isOpen: () => dialog.open,
    open(task, availableMinutes) {
      applyCourseColor(dialog, resolvedCourseId(task))
      opener = document.activeElement; taskId = task.id; started = false
      plannedMinutes = getSessionMinutes(task, availableMinutes)
      const step = primaryWorkStep(task)
      const heading = el('h2', step ? step.title || step.description : task.title); heading.id = 'study-session-heading'
      dialog.setAttribute('aria-labelledby', heading.id)
      const partial = getActionMinutes(task) > plannedMinutes
      const context = el('p', `Planlagt varighet: ${plannedMinutes} minutter. ${step ? `Oppgave: ${task.title}. ${partial ? 'Dette er en deløkt på arbeidssteget. ' : ''}Stegets tid er allerede inkludert i oppgavens gjenstående arbeid.` : `${partial ? 'Dette er en deløkt. ' : ''}Totalt gjenstående arbeid: ${formatEstimateRange(getRemainingRange(task))}.`}`)
      const note = el('p', 'Start registrerer ikke fremdrift. Du bekrefter selv hva som skjedde når økten avsluttes.', 'muted')
      const actionsRow = el('div', '', 'actions'), start = el('button', 'Start økten'), cancel = el('button', 'Avbryt', 'secondary')
      start.type = cancel.type = 'button'; cancel.onclick = close
      start.onclick = () => {
        if (!started) {
          started = true; start.textContent = 'Avslutt økten'; context.textContent = `${step ? step.title || step.description : task.title} · ${plannedMinutes} minutter planlagt.`; note.textContent = 'Økten er startet lokalt. Ingenting regnes som utført før du velger et utfall.'; start.focus()
        } else {
          close(); actions.finish(taskId, plannedMinutes, Boolean(step), partial)
        }
      }
      actionsRow.append(start, cancel); dialog.replaceChildren(heading, context, note, actionsRow); dialog.showModal(); start.focus()
    },
  }
}
