import { closeWork, futureReservations } from './work-log.js'
import { getRemainingMinutes, estimateChoiceRange } from './tasks.js'
import { personalEstimate } from './personal-estimates.js'
import { proposeReview, decideReview, updateReviewTopic, removeAssessmentReview, recordAssessment, assessmentSessionContext } from './review-planning.js'

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
      form.querySelector('[role=alert]').insertAdjacentHTML('beforebegin', `<details data-assessment><summary>Valgfri egenvurdering</summary><p class="muted">Kan hoppes over. Ikke vurdert er forskjellig fra en lagret vurdering.</p><div data-assessment-list></div><label>Tema<input name="topicTitle" placeholder="For eksempel normalisering"></label><label>Eksamensdato (valgfritt)<input name="topicExamDate" type="date"></label><label>Vurdering<select name="rating"><option value="">Hopp over · ikke vurdert</option><option value="1">Trenger hjelp</option><option value="2">Forstår med støtte</option><option value="3">Forstår godt</option><option value="4">Kan forklare selv</option><option value="5">Kan lære bort</option></select></label><label class="check-label"><input name="disableReview" type="checkbox">Ikke foreslå repetisjon for dette temaet</label><section data-review hidden><p>Ved «Trenger hjelp» eller «Forstår med støtte» foreslås repetisjon. Dette er en regel basert på din egen vurdering, ikke utledet mestring. Eksamensdato er ukjent hvis den ikke er registrert; uten den kan kapasitet før eksamen ikke beregnes, og ingen kapasitet eller økt legges til automatisk.</p><label>Beslutning<select name="reviewStatus"><option value="">Velg</option><option value="approved">Godkjenn</option><option value="adjusted">Juster og godkjenn</option><option value="deferred">Utsett</option><option value="rejected">Avvis</option></select></label><div data-review-time hidden><label>Dato<input name="reviewDate" type="date"></label><label>Start<input name="reviewStart" type="time"></label><label>Sluttdato (ved nattøkt)<input name="reviewEndDate" type="date"></label><label>Slutt<input name="reviewEnd" type="time"></label></div><label data-defer hidden>Utsett til<input name="deferUntil" type="date"></label></section></details>`)
      const assessmentList = form.querySelector('[data-assessment-list]'), labels = { 1: 'Trenger hjelp', 2: 'Forstår med støtte', 3: 'Forstår godt', 4: 'Kan forklare selv', 5: 'Kan lære bort' }
      const assessmentHelp = el('p', 'Vurderingen gjelder temaet. En eventuell økt er valgfri kontekst og kan høre til en annen oppgave eller være uten oppgave.')
      assessmentList.before(assessmentHelp)
      const currentContext = el('p', assessmentSessionContext(state, draft)); currentContext.dataset.assessmentContext = 'current'
      assessmentList.after(currentContext)
      for (const topic of (state.topics || []).filter(item => item.taskId === task.id)) for (const assessment of (state.assessments || []).filter(item => item.topicId === topic.id)) {
        const item = el('article'), select = el('select'), disabled = el('input'), examDate = el('input'), saveAssessment = el('button', 'Lagre vurdering'), removeAssessment = el('button', 'Slett vurdering')
        item.append(el('p', `${new Date(assessment.assessedAt).toLocaleDateString('nb-NO')} · ${topic.title}`))
        const context = el('p', assessmentSessionContext(state, assessment)); context.dataset.assessmentContext = 'saved'; item.append(context)
        for (const [value, label] of Object.entries(labels)) select.append(new Option(label, value))
        select.value = String(assessment.rating); select.setAttribute('aria-label', `Vurdering av ${topic.title}`)
        disabled.type = 'checkbox'; disabled.checked = Boolean(topic.reviewSuggestionsDisabled)
        examDate.type = 'date'; examDate.value = topic.examDate || ''; examDate.setAttribute('aria-label', `Eksamensdato for ${topic.title}`)
        const disableLabel = el('label', 'Ikke foreslå repetisjon'); disableLabel.prepend(disabled)
        for (const control of [saveAssessment, removeAssessment]) control.type = 'button'
        const editReview = el('section'), editStatus = el('select'), editDate = el('input'), editStart = el('input'), editEndDate = el('input'), editEnd = el('input'), editDefer = el('input')
        editReview.hidden = true; editStatus.setAttribute('aria-label', `Beslutning for ${topic.title}`)
        for (const [value, label] of [['', 'Velg'], ['approved', 'Godkjenn'], ['adjusted', 'Juster og godkjenn'], ['deferred', 'Utsett'], ['rejected', 'Avvis']]) editStatus.append(new Option(label, value))
        editDate.type = 'date'; editDate.setAttribute('aria-label', `Repetisjonsdato for ${topic.title}`); editStart.type = editEnd.type = 'time'; editStart.setAttribute('aria-label', `Repetisjonsstart for ${topic.title}`); editEnd.setAttribute('aria-label', `Repetisjonsslutt for ${topic.title}`); editDefer.type = 'date'; editDefer.setAttribute('aria-label', `Utsett repetisjon for ${topic.title}`)
        editEndDate.type = 'date'; editEndDate.setAttribute('aria-label', `Repetisjonssluttdato for ${topic.title} (ved nattøkt)`)
        editReview.append(el('p', 'Endringen krever en ny beslutning om repetisjon.'), editStatus, editDate, editStart, editEndDate, editEnd, editDefer)
        const lifecycleChanged = () => Number(select.value) !== assessment.rating || disabled.checked !== Boolean(topic.reviewSuggestionsDisabled) || (examDate.value || '') !== (topic.examDate || '')
        const deferredDue = () => (state.reviewDecisions || []).some(decision => decision.assessmentId === assessment.id && decision.status === 'deferred' && decision.deferUntil && decision.deferUntil <= new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date()))
        const prepareAssessmentChange = () => {
          const updated = updateReviewTopic(actions.state(), topic.id, { reviewSuggestionsDisabled: disabled.checked, examDate: examDate.value })
          if (!updated.ok) return updated
          let candidate = updated.state
          if (Number(select.value) !== assessment.rating || deferredDue()) candidate = removeAssessmentReview(candidate, assessment.id)
          candidate.assessments = candidate.assessments.map(value => value.id === assessment.id ? { ...value, rating: Number(select.value) } : value)
          return { ok: true, state: candidate }
        }
        const refreshEditReview = () => {
          const updated = prepareAssessmentChange()
          const proposal = updated.ok && proposeReview(updated.state, updated.state.assessments.find(value => value.id === assessment.id))
          editReview.hidden = !((lifecycleChanged() || deferredDue()) && proposal?.suggested)
        }
        refreshEditReview()
        for (const control of [select, disabled, examDate]) control.addEventListener('change', refreshEditReview)
        saveAssessment.onclick = () => {
          const changed = lifecycleChanged() || deferredDue()
          const updated = prepareAssessmentChange()
          if (!updated.ok) { form.querySelector('[role=alert]').textContent = updated.error; return }
          let candidate = updated.state
          if (changed) {
            const currentAssessment = candidate.assessments.find(value => value.id === assessment.id), proposal = proposeReview(candidate, currentAssessment)
            if (!proposal.ok) { form.querySelector('[role=alert]').textContent = proposal.error; return }
            if (proposal.suggested) {
              if (!editStatus.value) { form.querySelector('[role=alert]').textContent = 'Velg om repetisjonen skal godkjennes, justeres, utsettes eller avvises.'; editStatus.focus(); return }
              const manual = editDate.value && editStart.value && editEnd.value ? { session: { dateLocal: editDate.value, startTime: editStart.value, ...(editEndDate.value && editEndDate.value !== editDate.value ? { endDateLocal: editEndDate.value } : {}), endTime: editEnd.value } } : {}
              const decided = decideReview(candidate, proposal, { status: editStatus.value, ...(editStatus.value === 'deferred' ? { deferUntil: editDefer.value } : {}), ...(['approved', 'adjusted'].includes(editStatus.value) ? manual : {}) })
              if (!decided.ok) { form.querySelector('[role=alert]').textContent = decided.error; return }
              candidate = decided.state
            }
          }
          const result = actions.commit(candidate, 'Egenvurdering oppdatert'); if (result.ok) close(); else form.querySelector('[role=alert]').textContent = result.error
        }
        removeAssessment.onclick = () => {
          let candidate = structuredClone(actions.state()); candidate.assessments = candidate.assessments.filter(value => value.id !== assessment.id)
          candidate = removeAssessmentReview(candidate, assessment.id)
          const result = actions.commit(candidate, 'Egenvurdering slettet'); if (result.ok) close(); else form.querySelector('[role=alert]').textContent = result.error
        }
        item.append(select, examDate, disableLabel, editReview, saveAssessment, removeAssessment); assessmentList.append(item)
      }
      form.elements.outcome.value = outcome
      form.elements.remainingMinutes.value = getRemainingMinutes(task) ?? ''
      form.elements.remainingChoice.onchange = () => { form.elements.remainingMinutes.hidden = form.elements.remainingChoice.value !== 'exact'; if (!form.elements.remainingMinutes.hidden) form.elements.remainingMinutes.focus() }
      form.querySelector('[data-cancel]').onclick = close
      const review = form.querySelector('[data-review]'), reviewTime = form.querySelector('[data-review-time]'), defer = form.querySelector('[data-defer]')
      const proposalPreview = el('p'); proposalPreview.className = 'muted'; review.prepend(proposalPreview)
      const reusedTopic = el('p'); reusedTopic.className = 'muted'; reusedTopic.dataset.reusedTopic = ''; form.elements.topicTitle.closest('label').after(reusedTopic)
      let selectedTopicId
      const findTopic = () => (state.topics || []).find(item => item.taskId === task.id && item.title.toLocaleLowerCase('nb') === form.elements.topicTitle.value.trim().toLocaleLowerCase('nb'))
      const prepareTopic = (candidate, newTopicId) => {
        const topic = findTopic() || { id: newTopicId, title: form.elements.topicTitle.value.trim() || 'Dette temaet', taskId: task.id }
        if (!(candidate.topics || []).some(item => item.id === topic.id)) candidate = { ...candidate, topics: [...(candidate.topics || []), topic] }
        return updateReviewTopic(candidate, topic.id, { reviewSuggestionsDisabled: form.elements.disableReview.checked, examDate: form.elements.topicExamDate.value })
      }
      const prefillTopic = () => {
        const topic = findTopic()
        if (topic?.id !== selectedTopicId) {
          form.elements.topicExamDate.value = topic?.examDate || ''
          form.elements.disableReview.checked = Boolean(topic?.reviewSuggestionsDisabled)
          selectedTopicId = topic?.id
        }
        reusedTopic.textContent = topic ? `Eksisterende tema: ${topic.title}. Dato og repetisjonsvalg gjelder alle vurderinger av temaet.` : ''
      }
      const previewTopicId = crypto.randomUUID(), previewAssessmentId = crypto.randomUUID()
      const timeFields = ['reviewDate', 'reviewStart', 'reviewEndDate', 'reviewEnd']
      let manualReviewTime = false, proposalBasis
      for (const name of timeFields) form.elements[name].addEventListener('input', () => { manualReviewTime = true })
      const updateReviewStatus = () => { reviewTime.hidden = !['approved', 'adjusted'].includes(form.elements.reviewStatus.value); defer.hidden = form.elements.reviewStatus.value !== 'deferred' }
      const updateProposal = () => {
        const basis = JSON.stringify([findTopic()?.id || form.elements.topicTitle.value.trim().toLocaleLowerCase('nb'), form.elements.topicExamDate.value, form.elements.disableReview.checked, form.elements.rating.value])
        if (proposalBasis !== undefined && proposalBasis !== basis) form.elements.reviewStatus.value = ''
        proposalBasis = basis
        review.hidden = !['1', '2'].includes(form.elements.rating.value)
        const prepared = prepareTopic(state, previewTopicId)
        const assessment = { id: previewAssessmentId, topicId: prepared.topic?.id, rating: Number(form.elements.rating.value), assessedAt: new Date().toISOString() }
        const proposal = review.hidden ? {} : prepared.ok ? proposeReview(prepared.state, assessment) : prepared
        const time = proposal.proposedSession ? ` Foreslått kollisjonsfri tid: ${proposal.proposedSession.dateLocal} kl. ${proposal.proposedSession.startTime}–${proposal.proposedSession.endDateLocal ? `${proposal.proposedSession.endDateLocal} ` : ''}${proposal.proposedSession.endTime}.` : ''
        proposalPreview.textContent = review.hidden ? '' : `${proposal.error || proposal.explanation || ''} ${(proposal.uncertainty || []).join(' ')}${time}`
        if (!manualReviewTime) {
          const values = proposal.proposedSession ? [proposal.proposedSession.dateLocal, proposal.proposedSession.startTime, proposal.proposedSession.endDateLocal || '', proposal.proposedSession.endTime] : ['', '', '', '']
          timeFields.forEach((name, index) => { form.elements[name].value = values[index] })
        }
        updateReviewStatus()
      }
      form.elements.rating.onchange = updateProposal; form.elements.topicExamDate.onchange = updateProposal; form.elements.disableReview.onchange = updateProposal
      form.elements.topicTitle.oninput = () => { prefillTopic(); updateProposal() }
      form.elements.reviewStatus.onchange = updateReviewStatus
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
        let candidate = result.state
        if (form.elements.rating.value) {
          const topicTitle = form.elements.topicTitle.value.trim()
          if (!topicTitle) { error.textContent = 'Skriv temaet du vurderer, eller velg Hopp over.'; return }
          const updatedTopic = prepareTopic(candidate, crypto.randomUUID())
          if (!updatedTopic.ok) { error.textContent = updatedTopic.error; return }
          candidate = updatedTopic.state
          const topic = updatedTopic.topic
          const assessment = { id: crypto.randomUUID(), topicId: topic.id, rating: Number(form.elements.rating.value), assessedAt: new Date().toISOString(), ...(result.log.sessionId ? { sessionId: result.log.sessionId } : {}) }
          const recorded = recordAssessment(candidate, assessment)
          if (!recorded.ok) { error.textContent = recorded.error; return }
          candidate = recorded.state
          const proposal = proposeReview(candidate, assessment)
          if (!proposal.ok) { error.textContent = proposal.error; return }
          if (proposal.suggested) {
            const status = form.elements.reviewStatus.value
            if (!status) { error.textContent = 'Velg om repetisjonen skal godkjennes, justeres, utsettes eller avvises.'; return }
            const hasManualTime = form.elements.reviewDate.value && form.elements.reviewStart.value && form.elements.reviewEnd.value
            const decision = { status, ...(status === 'deferred' ? { deferUntil: form.elements.deferUntil.value } : {}), ...(['approved', 'adjusted'].includes(status) && hasManualTime ? { session: { dateLocal: form.elements.reviewDate.value, startTime: form.elements.reviewStart.value, ...(form.elements.reviewEndDate.value && form.elements.reviewEndDate.value !== form.elements.reviewDate.value ? { endDateLocal: form.elements.reviewEndDate.value } : {}), endTime: form.elements.reviewEnd.value } } : {}) }
            const decided = decideReview(candidate, proposal, decision)
            if (!decided.ok) { error.textContent = decided.error; return }
            candidate = decided.state
          }
        }
        const saved = actions.commit(candidate, 'Arbeid registrert')
        if (!saved.ok) { error.textContent = saved.error; return }
        const needsTime = form.elements.outcome.value !== 'done'
        close()
        if (needsTime) actions.offerTime?.(taskId)
      }
      dialog.append(form); dialog.showModal(); form.elements.outcome[0].focus()
    },
  }
}
