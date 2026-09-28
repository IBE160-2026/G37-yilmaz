import { closeWork, futureReservations } from './work-log.js'
import { getRemainingMinutes, estimateChoiceRange } from './tasks.js'
import { personalEstimate } from './personal-estimates.js'

const el = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node }
export function createWorkLogView(actions) {
  const dialog = el('dialog'); dialog.className = 'editor-dialog connected-dialog'; document.body.append(dialog)
  let opener, draft, baseline
  const close = () => { dialog.close(); draft = null; actions.onClose?.(); opener?.focus({ preventScroll: true }) }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  return {
    isOpen: () => dialog.open,
    open(taskId, sessionId, outcome = 'more', options = {}) {
      const state = actions.state(), task = state.tasks.find(item => item.id === taskId)
      if (!task) return
      opener = document.activeElement; baseline = JSON.stringify(state)
      draft = { taskId, ...(sessionId ? { sessionId } : {}), operationId: sessionId ? `close-${sessionId}` : crypto.randomUUID(),
        ...(options.stepOnly ? { stepOnly: true } : {}), ...(Number.isSafeInteger(options.plannedMinutes) ? { plannedMinutes: options.plannedMinutes } : {}) }
      dialog.replaceChildren(el('h2', 'Hva skjedde?'), el('p', task.title))
      dialog.firstChild.id = 'work-log-heading'; dialog.setAttribute('aria-labelledby', 'work-log-heading')
      const form = el('form'); form.className = 'connected-form'
      form.innerHTML = `<fieldset><legend>Resultat</legend><label><input type="radio" name="outcome" value="done">Utført</label><label><input type="radio" name="outcome" value="more">Trenger mer tid</label><label><input type="radio" name="outcome" value="not-started">Ikke utført</label></fieldset><p class="work-outcome-help"></p><label data-performed>Faktisk arbeidstid (minutter, valgfritt)<input name="actualMinutes" inputmode="numeric" placeholder="Vet ikke"></label><label data-remaining>Gjenstående arbeid<select name="remainingChoice"><option value="">Vet ikke</option><option value="under30">Under 30 min</option><option value="from30to60">30–60 min</option><option value="from60to120">1–2 timer</option><option value="from120to240">2–4 timer</option><option value="over240">Mer enn 4 timer</option><option value="exact">Oppgi eksakte minutter</option></select><input name="remainingMinutes" inputmode="numeric" placeholder="Minutter" hidden></label><label data-whole class="check-label"><input name="completeTask" type="checkbox">Hele oppgaven er ferdig</label><label data-performed class="check-label"><input name="interrupted" type="checkbox">Arbeidet ble avbrutt</label><label data-history class="check-label"><input name="historyComplete" type="checkbox">Alle faktiske arbeidsminutter for denne oppgaven er registrert, også tidligere arbeid</label><p data-history class="muted">Velg bare hvis hele arbeidstiden er kjent.</p><section data-release><h3>Reservasjoner som frigjøres</h3><ul></ul><label class="check-label"><input name="confirmRelease" type="checkbox">Frigjør disse reservasjonene når jeg bekrefter ferdig</label></section><p role="alert"></p><div class="actions"><button type="submit">Lagre utfallet</button><button type="button" class="secondary" data-cancel>Avbryt</button></div>`
      form.elements.outcome.value = outcome
      form.elements.remainingMinutes.value = getRemainingMinutes(task) ?? ''
      form.elements.remainingChoice.onchange = () => { form.elements.remainingMinutes.hidden = form.elements.remainingChoice.value !== 'exact'; if (!form.elements.remainingMinutes.hidden) form.elements.remainingMinutes.focus() }
      form.querySelector('[data-cancel]').onclick = close
      const release = futureReservations(state, task.id)
      for (const item of release) form.querySelector('[data-release] ul').append(el('li', `${item.dateLocal} ${item.startTime}–${item.endTime}${item.locked ? ' · låst økt' : ''}`))
      const suggestion = personalEstimate(state, task, { kind: 'session' })
      if (suggestion.available) form.querySelector('[role=alert]').before(el('p', `Øktlengde fra tidligere arbeid: ${suggestion.explanation} Registrer det du faktisk brukte denne gangen.`))
      const update = () => {
        const value = form.elements.outcome.value
        for (const node of form.querySelectorAll('[data-performed]')) node.hidden = value === 'not-started'
        form.querySelector('[data-remaining]').hidden = value !== 'more'
        form.querySelector('[data-whole]').hidden = value !== 'done' || !options.stepOnly
        const whole = value === 'done' && (!options.stepOnly || form.elements.completeTask.checked)
        for (const node of form.querySelectorAll('[data-history]')) node.hidden = !whole
        form.querySelector('[data-release]').hidden = !whole || !release.length
        form.querySelector('.work-outcome-help').textContent = value === 'not-started' ? 'Ingen utført tid eller fremdrift registreres. Kapasiteten beregnes på nytt fordi tiden kan ha gått.' : value === 'done' && options.stepOnly ? 'Utført gjelder bare det registrerte arbeidssteget. Velg separat om hele oppgaven er ferdig.' : value === 'done' ? 'Arbeidet markeres ferdig. En eventuell innlevering bekreftes separat.' : 'Faktisk arbeidstid og gjenstående arbeid lagres hver for seg.'
      }
      for (const control of form.elements.outcome) control.onchange = update
      form.elements.completeTask.onchange = update
      update()
      form.onsubmit = event => {
        event.preventDefault()
        const error = form.querySelector('[role=alert]')
        if (JSON.stringify(actions.state()) !== baseline) { error.textContent = 'Dataene er endret. Avbryt og åpne arbeidsregistreringen på nytt; utkastet er beholdt.'; return }
        const choice = form.elements.remainingChoice.value
        const result = closeWork(actions.state(), { ...draft, outcome: form.elements.outcome.value, actualMinutes: form.elements.actualMinutes.value,
          remainingMinutes: choice === 'exact' ? form.elements.remainingMinutes.value : '', remainingEstimate: estimateChoiceRange(choice), completeTask: form.elements.completeTask.checked,
          interrupted: form.elements.interrupted.checked, historyComplete: form.elements.historyComplete.checked, confirmRelease: form.elements.confirmRelease.checked })
        if (!result.ok) { error.textContent = result.error; return }
        const saved = actions.commit(result.state, 'Arbeid registrert')
        if (!saved.ok) { error.textContent = saved.error; return }
        const needsTime = form.elements.outcome.value !== 'done'
        close()
        if (needsTime) actions.offerTime?.(taskId)
      }
      dialog.append(form); dialog.showModal(); form.elements.outcome[0].focus()
    },
  }
}
