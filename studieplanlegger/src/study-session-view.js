import { getActionMinutes } from './tasks.js'

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
      opener = document.activeElement; taskId = task.id; started = false
      plannedMinutes = Math.min(getActionMinutes(task), availableMinutes)
      const heading = el('h2', task.nextStep ? task.nextStep.description : task.title); heading.id = 'study-session-heading'
      dialog.setAttribute('aria-labelledby', heading.id)
      const context = el('p', `Planlagt varighet: ${plannedMinutes} minutter. ${task.nextStep ? `Oppgave: ${task.title}.` : 'Dette gjelder hele den registrerte oppgaven.'}`)
      const note = el('p', 'Start registrerer ikke fremdrift. Du bekrefter selv hva som skjedde når økten avsluttes.', 'muted')
      const actionsRow = el('div', '', 'actions'), start = el('button', 'Start økten'), cancel = el('button', 'Avbryt', 'secondary')
      start.type = cancel.type = 'button'; cancel.onclick = close
      start.onclick = () => {
        if (!started) {
          started = true; start.textContent = 'Avslutt økten'; context.textContent = `${task.nextStep ? task.nextStep.description : task.title} · ${plannedMinutes} minutter planlagt.`; note.textContent = 'Økten er startet lokalt. Ingenting regnes som utført før du velger et utfall.'; start.focus()
        } else {
          close(); actions.finish(taskId, plannedMinutes, Boolean(task.nextStep))
        }
      }
      actionsRow.append(start, cancel); dialog.replaceChildren(heading, context, note, actionsRow); dialog.showModal(); start.focus()
    },
  }
}
