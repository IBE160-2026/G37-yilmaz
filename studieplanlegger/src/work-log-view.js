import { closeWork, futureReservations } from './work-log.js'
import { getRemainingMinutes } from './tasks.js'
import { personalEstimate } from './personal-estimates.js'

const el = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node }
export function createWorkLogView(actions) {
  const dialog = el('dialog'); dialog.className = 'editor-dialog connected-dialog'; document.body.append(dialog)
  let opener, draft, baseline
  const close = () => { dialog.close(); draft = null; actions.onClose?.(); opener?.focus({ preventScroll: true }) }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  return {
    isOpen: () => dialog.open,
    open(taskId, sessionId, outcome = 'more') {
      const state = actions.state(), task = state.tasks.find(item => item.id === taskId)
      if (!task) return
      opener = document.activeElement; baseline = JSON.stringify(state)
      draft = { taskId, ...(sessionId ? { sessionId } : {}), operationId: sessionId ? `close-${sessionId}` : crypto.randomUUID() }
      dialog.replaceChildren(el('h2', 'Hvordan gikk arbeidet?'), el('p', task.title))
      dialog.firstChild.id = 'work-log-heading'; dialog.setAttribute('aria-labelledby', 'work-log-heading')
      const form = el('form'); form.className = 'connected-form'
      form.innerHTML = `<label>Resultat<select name="outcome"><option value="done">Ferdig</option><option value="more">Trenger mer tid</option><option value="not-started">Kom ikke i gang</option></select></label><p class="work-outcome-help"></p><label data-performed>Faktisk arbeidstid (minutter, valgfritt)<input name="actualMinutes" inputmode="numeric" placeholder="Vet ikke"></label><label data-remaining>Gjenstående arbeid (minutter)<input name="remainingMinutes" inputmode="numeric" placeholder="Vet ikke"><button type="button" class="secondary" data-unknown>Vet ikke</button></label><label data-performed class="check-label"><input name="interrupted" type="checkbox">Arbeidet ble avbrutt</label><label data-history class="check-label"><input name="historyComplete" type="checkbox">Alle faktiske arbeidsminutter for denne oppgaven er registrert, også tidligere arbeid</label><p data-history class="muted">Velg bare hvis hele arbeidstiden er kjent. Dette kan gi et senere, frivillig estimatforslag.</p><section data-release><h3>Reservasjoner som frigjøres</h3><ul></ul><label class="check-label"><input name="confirmRelease" type="checkbox">Frigjør disse reservasjonene når jeg bekrefter ferdig</label></section><p role="alert"></p><div class="actions"><button type="submit">Bekreft arbeid</button><button type="button" class="secondary" data-cancel>Avbryt</button></div>`
      form.elements.outcome.value = outcome
      form.elements.remainingMinutes.setAttribute('aria-label', 'Gjenstående arbeid (minutter)')
      form.elements.remainingMinutes.value = getRemainingMinutes(task) ?? ''
      form.querySelector('[data-unknown]').onclick = () => { form.elements.remainingMinutes.value = ''; form.elements.remainingMinutes.focus() }
      form.querySelector('[data-cancel]').onclick = close
      const release = futureReservations(state, task.id)
      for (const item of release) form.querySelector('[data-release] ul').append(el('li', `${item.dateLocal} ${item.startTime}–${item.endTime}${item.locked ? ' · låst økt' : ''}`))
      const suggestion = personalEstimate(state, task, { kind: 'session' })
      if (suggestion.available) form.querySelector('[role=alert]').before(el('p', `Øktlengde fra tidligere arbeid: ${suggestion.explanation} Registrer det du faktisk brukte denne gangen.`))
      const update = () => {
        const value = form.elements.outcome.value
        for (const node of form.querySelectorAll('[data-performed]')) node.hidden = value === 'not-started'
        form.querySelector('[data-remaining]').hidden = value !== 'more'
        for (const node of form.querySelectorAll('[data-history]')) node.hidden = value !== 'done'
        form.querySelector('[data-release]').hidden = value !== 'done' || !release.length
        form.querySelector('.work-outcome-help').textContent = value === 'not-started' ? 'Ingen utført tid eller fremgang registreres. Den valgte reservasjonen fjernes; du kan finne en ny tid.' : value === 'done' ? 'Arbeidet markeres ferdig. En eventuell innlevering bekreftes separat.' : 'Faktisk arbeidstid og gjenstående arbeid lagres hver for seg. Tiden trekkes ikke automatisk fra estimatet.'
      }
      form.elements.outcome.onchange = update; update()
      form.onsubmit = event => {
        event.preventDefault()
        const error = form.querySelector('[role=alert]')
        if (JSON.stringify(actions.state()) !== baseline) { error.textContent = 'Dataene er endret. Avbryt og åpne arbeidsregistreringen på nytt; utkastet er beholdt.'; return }
        const result = closeWork(actions.state(), { ...draft, outcome: form.elements.outcome.value, actualMinutes: form.elements.actualMinutes.value, remainingMinutes: form.elements.remainingMinutes.value, interrupted: form.elements.interrupted.checked, historyComplete: form.elements.historyComplete.checked, confirmRelease: form.elements.confirmRelease.checked })
        if (!result.ok) { error.textContent = result.error; return }
        const saved = actions.commit(result.state, 'Arbeid registrert')
        if (!saved.ok) { error.textContent = saved.error; return }
        const needsTime = form.elements.outcome.value !== 'done'
        close()
        if (needsTime) actions.offerTime?.(taskId)
      }
      dialog.append(form); dialog.showModal(); form.elements.outcome.focus()
    },
  }
}
