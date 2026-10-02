import { taskSteps, saveWorkSteps, completeWorkStep, reopenWorkStep, migrateLegacyStep, removeWorkStep } from './work-steps.js'
import { createWorkStepProposal, approveWorkStepProposal } from './work-step-proposals.js'
import { parseDocumentInput } from './document-import.js'

const el = (tag, text, className = '') => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node }
const button = (text, action, className = 'secondary') => { const node = el('button', text, className); node.type = 'button'; node.onclick = action; return node }

export function createWorkStepsView(actions) {
  const dialog = el('dialog', null, 'editor-dialog connected-dialog work-steps-dialog'); document.body.append(dialog)
  let opener, taskId, draft = [], baseline = '', importText = '', importOpen = false, importMessage = '', pendingProposal = null, generation = 0
  const close = () => { generation += 1; dialog.close(); actions.onClose?.(); opener?.focus({ preventScroll: true }) }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  function render(requestedFocus) {
    const previousScroll = dialog.scrollTop, activeStep = requestedFocus ? requestedFocus.stepId : document.activeElement?.closest?.('[data-step-id]')?.dataset.stepId, activeKey = requestedFocus?.key || document.activeElement?.dataset?.focusKey, activeLabel = document.activeElement?.getAttribute?.('aria-label'), activeText = document.activeElement?.textContent
    let explicitTarget = null
    const oldImport = dialog.querySelector('.planning-rules'); if (oldImport) { importOpen = oldImport.open; importText = oldImport.querySelector('textarea')?.value ?? importText }
    const task = migrateLegacyStep(actions.state().tasks.find(item => item.id === taskId))
    dialog.replaceChildren(el('h2', `Arbeidssteg · ${task.title}`), el('p', 'Stegestimater er kontekst. De legges ikke til oppgavens gjenstående arbeid.', 'muted'))
    dialog.firstChild.id = 'work-steps-heading'; dialog.setAttribute('aria-labelledby', 'work-steps-heading')
    const stepError = el('p'); stepError.setAttribute('role', 'alert'); stepError.className = 'work-step-error'
    const list = el('ol', null, 'work-step-list')
    draft.forEach((step, index) => {
      const row = el('li', null, 'replan-row'); row.dataset.stepId = step.id
      const currentStep = () => draft.find(item => item.id === step.id)
      const title = el('input'); title.dataset.focusKey = 'title'; title.value = step.title; title.setAttribute('aria-label', `Navn på steg ${index + 1}`); title.oninput = () => { currentStep().title = title.value }
      const estimate = el('input'); estimate.dataset.focusKey = 'estimate'; estimate.type = 'number'; estimate.min = '1'; estimate.value = step.estimatedMinutes || ''; estimate.placeholder = 'Ukjent'; estimate.setAttribute('aria-label', `Minutter for steg ${index + 1}`); estimate.oninput = () => { if (estimate.value) currentStep().estimatedMinutes = Number(estimate.value); else delete currentStep().estimatedMinutes }
      const dependencies = el('select'); dependencies.dataset.focusKey = 'dependencies'; dependencies.multiple = true; dependencies.setAttribute('aria-label', `Forutsetninger for steg ${index + 1}`)
      for (const candidate of draft.filter(item => item.id !== step.id)) { const option = el('option', candidate.title); option.value = candidate.id; option.selected = (step.dependencyIds || []).includes(candidate.id); dependencies.append(option) }
      for (const missing of (step.dependencyIds || []).filter(id => !draft.some(item => item.id === id))) { const option = el('option', `Mangler: ${missing}`); option.value = missing; option.selected = true; dependencies.append(option) }
      dependencies.onchange = () => { const current = currentStep(); current.dependencyIds = [...dependencies.selectedOptions].map(option => option.value); if (!current.dependencyIds.length) delete current.dependencyIds }
      const status = el('span', step.completed ? 'Fullført' : 'Åpent', 'status-badge')
      const controls = el('div', null, 'actions')
      const move = delta => {
        const current = draft.findIndex(item => item.id === step.id), target = current + delta
        if (target < 0 || target >= draft.length) return
        ;[draft[current], draft[target]] = [draft[target], draft[current]]
        if (delta < 0) list.insertBefore(row, row.previousElementSibling)
        else list.insertBefore(row.nextElementSibling, row)
        ;[...list.children].forEach((item, position) => {
          item.querySelector('[data-focus-key=title]')?.setAttribute('aria-label', `Navn på steg ${position + 1}`)
          item.querySelector('[data-focus-key=estimate]')?.setAttribute('aria-label', `Minutter for steg ${position + 1}`)
          item.querySelector('[data-focus-key=dependencies]')?.setAttribute('aria-label', `Forutsetninger for steg ${position + 1}`)
        })
      }
      let stepCompleted = step.completed
      const toggleCompleted = button(stepCompleted ? 'Åpne igjen' : 'Marker fullført', event => {
        const completed = !stepCompleted
        const result = completed ? completeWorkStep({ ...task, steps: draft }, step.id) : reopenWorkStep({ ...task, steps: draft }, step.id)
        if (!result.ok) { stepError.textContent = result.error; return }
        draft = result.task.steps; stepCompleted = completed; stepError.textContent = ''
        status.textContent = completed ? 'Fullført' : 'Åpent'; event.currentTarget.textContent = completed ? 'Åpne igjen' : 'Marker fullført'
      })
      controls.append(button('Flytt opp', () => move(-1)), button('Flytt ned', () => move(1)), toggleCompleted, button('Fjern', () => {
        const removedIndex = draft.findIndex(item => item.id === step.id)
        const result = removeWorkStep({ ...task, steps: draft }, step.id)
        if (!result.ok) { stepError.textContent = result.error; return }
        draft = result.task.steps
        const adjacent = draft[removedIndex] || draft[removedIndex - 1]
        render(adjacent ? { stepId: adjacent.id, key: 'remove' } : { key: 'add' })
      }, 'danger-button'))
      ;['move-up', 'move-down', 'toggle-completed', 'remove'].forEach((key, controlIndex) => { controls.children[controlIndex].dataset.focusKey = key })
      if (requestedFocus?.stepId === step.id) explicitTarget = [...controls.children].find(control => control.dataset.focusKey === requestedFocus.key) || null
      row.append(title, estimate, dependencies, status, controls)
      if (step.provenance?.sourceExcerpt) row.append(el('p', `Kilde: ${step.provenance.sourceExcerpt}`, 'muted'))
      list.append(row)
    })
    const add = button('Legg til manuelt steg', () => { draft.push({ id: crypto.randomUUID(), title: 'Nytt steg', completed: false, provenance: { kind: 'manual' } }); render(); list.lastElementChild?.querySelector('input')?.select() })
    add.dataset.focusKey = 'add'
    const importBox = el('details', null, 'planning-rules'), summary = el('summary', 'Foreslå steg fra tekst eller dokumentutdrag'), area = el('textarea')
    area.placeholder = 'Én linje per punkt. Bruk «Krav:», «Metode:» eller vanlig tekst for uavklart.'; area.rows = 5; area.value = importText; area.oninput = () => { importText = area.value }; area.setAttribute('aria-label', 'Lokalt dokumentutdrag'); importBox.open = importOpen
    const fileLabel = el('label', 'Eller velg lokal tekst-, PDF- eller DOCX-fil'), file = el('input')
    file.type = 'file'; file.accept = '.txt,.text,.pdf,.docx'; fileLabel.append(file)
    const preview = el('div'), importStatus = el('p', '', 'muted'); importStatus.setAttribute('role', 'status')
    const showProposal = (rows, sourceId) => {
      const proposal = pendingProposal?.sourceId === sourceId ? pendingProposal.proposal : createWorkStepProposal({ sourceId, taskId: task.id, rows })
      pendingProposal = { rows: structuredClone(rows), sourceId, proposal }
      preview.replaceChildren(el('p', 'Velg eksplisitt hvilke rader som skal bli arbeidssteg. Metode og uavklart er ikke valgt automatisk.'))
      for (const entry of proposal.entries) {
        const label = el('label', null, 'check-label'), check = el('input'); check.type = 'checkbox'; check.checked = entry.included; check.onchange = () => { entry.included = check.checked }
        label.append(check, document.createTextNode(`${entry.category === 'requirement' ? 'Krav' : entry.category === 'method' ? 'Metode' : 'Uavklart'}: ${entry.title}`)); preview.append(label)
      }
      preview.append(button('Legg valgte i utkastet', () => { const approved = approveWorkStepProposal({ ...task, steps: draft }, proposal); if (approved.ok) { draft = approved.task.steps; render() } else { importStatus.textContent = importMessage = approved.error || 'Forslaget kunne ikke legges til.' } }))
    }
    const textRows = text => text.split(/\r?\n/).filter(Boolean).map((line, index) => {
        const match = line.match(/^\s*(Krav|Metode)\s*:\s*(.+)$/i)
        return { key: String(index + 1), title: match?.[2] || line.trim(), text: line.trim(), kind: match?.[1]?.toLowerCase() === 'krav' ? 'requirement' : match ? 'method' : 'unresolved' }
      })
    const prepare = button('Forbered forslag', () => {
      importStatus.textContent = importMessage = ''
      if (!area.value.trim()) { importStatus.textContent = importMessage = 'Lim inn tekst eller velg en lokal fil. Du kan alltid legge til steg manuelt.'; return }
      showProposal(textRows(area.value), `local:${task.id}:${crypto.randomUUID()}`)
    })
    file.onchange = async () => {
      if (!file.files[0]) return
      const activeGeneration = generation, activeTaskId = taskId
      // Keep the disclosure open while the asynchronous reader reports progress/errors.
      // Some browsers toggle <details> when a file picker returns focus to its label.
      importBox.open = importOpen = true
      importStatus.textContent = importMessage = 'Leser dokumentet lokalt …'; preview.replaceChildren()
      try {
        const parsed = await parseDocumentInput(file.files[0], { onProgress: message => { if (activeGeneration === generation && activeTaskId === taskId && dialog.open) importStatus.textContent = message } })
        if (activeGeneration !== generation || activeTaskId !== taskId || !dialog.open) return
        const rows = parsed.rows.map((row, index) => {
          const source = row.snippet || row.title || ''
          const match = source.match(/^\s*(Krav|Metode)\s*:\s*(.+)$/i)
          return { key: row.key || String(index + 1), title: match?.[2] || row.title || source, text: source, kind: match?.[1]?.toLowerCase() === 'krav' ? 'requirement' : match ? 'method' : 'unresolved' }
        })
        importStatus.textContent = importMessage = `${parsed.fileName}: ${rows.length} forslag funnet. Kontroller dem mot kildeutdraget.`
        showProposal(rows, `document:${parsed.contentHash}`)
      } catch (error) {
        if (activeGeneration !== generation || activeTaskId !== taskId || !dialog.open) return
        importBox.open = importOpen = true
        importStatus.textContent = importMessage = `${error.message || 'Dokumentet kunne ikke leses.'} Lim inn teksten eller legg til steg manuelt; ingen data er lagret.`
      }
    }
    importBox.append(summary, area, fileLabel, prepare, importStatus, preview)
    importStatus.textContent = importMessage
    if (pendingProposal) showProposal(pendingProposal.rows, pendingProposal.sourceId)
    const error = el('p'); error.setAttribute('role', 'alert')
    const controls = el('div', null, 'actions')
    controls.append(button('Lagre alle steg', () => {
      if (JSON.stringify(actions.state()) !== baseline) { error.textContent = 'Dataene er endret. Åpne steglisten på nytt.'; return }
      const saved = saveWorkSteps(task, draft)
      if (!saved.ok) { error.textContent = saved.error; return }
      const candidate = structuredClone(actions.state()); candidate.tasks = candidate.tasks.map(item => item.id === task.id ? saved.task : item)
      const result = actions.commit(candidate, 'Arbeidssteg oppdatert'); if (!result.ok) { error.textContent = result.error; return }; close()
    }, ''), button('Avbryt', close))
    // The first button is created with the shared helper but keeps primary styling.
    controls.firstChild.className = ''
    dialog.append(list, stepError, add, importBox, error, controls)
    setTimeout(() => {
      dialog.scrollTop = previousScroll
      const scope = activeStep ? [...dialog.querySelectorAll('[data-step-id]')].find(node => node.dataset.stepId === activeStep) : dialog
      const target = explicitTarget || (activeKey ? [...(scope?.querySelectorAll('[data-focus-key]') || [])].find(node => node.dataset.focusKey === activeKey) : activeLabel ? [...(scope?.querySelectorAll('[aria-label]') || [])].find(node => node.getAttribute('aria-label') === activeLabel) : [...(scope?.querySelectorAll('button') || [])].find(node => node.textContent === activeText))
      target?.focus({ preventScroll: true })
    }, 0)
  }
  return { isOpen: () => dialog.open, open(id) { const task = actions.state().tasks.find(item => item.id === id); if (!task) return; generation += 1; opener = document.activeElement; taskId = id; draft = structuredClone(taskSteps(task)); baseline = JSON.stringify(actions.state()); importText = ''; importOpen = false; importMessage = ''; pendingProposal = null; dialog.replaceChildren(); render(); dialog.showModal(); dialog.querySelector('input')?.focus() } }
}
