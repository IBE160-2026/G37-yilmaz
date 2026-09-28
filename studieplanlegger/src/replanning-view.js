import { createReplan, applyReplan, replanMoveAlternatives } from './replanning.js'
import { DEFAULT_PLANNING_RULES } from './planning-rules.js'
import { getRemainingRange } from './tasks.js'
import { STUDY_TIME_PRESETS, availabilityFor } from './study-time.js'
import { extendedSessionInterval } from './work-capacity.js'

const el = (tag, text, className = '') => { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node }
const duration = session => {
  try { const value = extendedSessionInterval(session); return Math.round((value.end - value.start) / 60000) } catch { return 0 }
}
const dayLabel = value => {
  try { return new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Oslo' }).format(new Date(`${value}T12:00:00Z`)) } catch { return value }
}
const sessionLabel = session => `${dayLabel(session.dateLocal)} kl. ${session.startTime}–${session.endTime} · ${duration(session)} min`
const sameTime = change => change.original && change.proposed && ['dateLocal', 'startTime', 'endDateLocal', 'endTime'].every(key => (change.original[key] || (key === 'endDateLocal' ? change.original.dateLocal : '')) === (change.proposed[key] || (key === 'endDateLocal' ? change.proposed.dateLocal : '')))

export function createReplanningView(actions) {
  const dialog = el('dialog'); dialog.className = 'editor-dialog connected-dialog simple-plan-dialog'; document.body.append(dialog)
  let opener, preview, taskId, choice, rules, applying = false
  const close = () => { if (dialog.open) dialog.close(); preview = null; applying = false; actions.onClose?.(); opener?.focus({ preventScroll: true }) }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })

  function build() {
    const state = actions.state(), confirmed = Boolean(state.workWindows?.length)
    choice = confirmed ? 'saved' : state.studyTimePreference?.kind || ''
    rules = { ...(state.planningPreferences || DEFAULT_PLANNING_RULES) }
    dialog.replaceChildren()
    const heading = el('h2', taskId ? 'Planforslag for oppgaven' : 'Realistisk planforslag'); heading.id = 'replanning-heading'; heading.tabIndex = -1
    dialog.setAttribute('aria-labelledby', heading.id)
    dialog.append(heading, el('p', 'Se hva som legges til eller flyttes før du bestemmer deg. Avtaler, frister, låste økter og øvrige reservasjoner beholdes.'))

    const timeSection = el('section', '', 'study-time-choice')
    timeSection.append(el('h3', 'Når passer det vanligvis å studere?'))
    if (confirmed) {
      timeSection.append(el('p', 'Forslaget bruker tiden du allerede har registrert som tilgjengelig.'))
      const advanced = el('button', 'Endre detaljert tilgjengelighet', 'secondary'); advanced.type = 'button'; advanced.onclick = () => { close(); actions.advanced?.() }
      timeSection.append(advanced)
    }
    else {
      const choices = el('fieldset'); choices.setAttribute('aria-label', 'Vanlig studietid')
      for (const preset of Object.values(STUDY_TIME_PRESETS)) {
        const label = el('label', '', 'study-time-option'), input = el('input'), copy = el('span')
        input.type = 'radio'; input.name = 'study-time'; input.value = preset.kind; input.checked = choice === preset.kind
        copy.append(el('strong', preset.label), el('span', preset.detail))
        input.onchange = () => { choice = preset.kind; compute() }
        label.append(input, copy); choices.append(label)
      }
      const variable = el('label', '', 'study-time-option'), variableInput = el('input'), variableCopy = el('span')
      variableInput.type = 'radio'; variableInput.name = 'study-time'; variableInput.value = 'varies'; variableInput.checked = choice === 'varies'
      variableCopy.append(el('strong', 'Det varierer'), el('span', 'Vurder konkrete tidspunkter uten et ukentlig mønster'))
      variableInput.onchange = () => { choice = 'varies'; compute() }; variable.append(variableInput, variableCopy); choices.append(variable)
      timeSection.append(choices)
      const advanced = el('button', 'Tilpass selv', 'secondary'); advanced.type = 'button'; advanced.onclick = () => { close(); actions.advanced?.() }
      timeSection.append(advanced, el('p', 'Ingen valg? Da vises bare ett begrenset, foreløpig tidspunkt. Det lagres ikke som ukentlig kapasitet.', 'muted'))
    }
    dialog.append(timeSection)

    const ruleDetails = el('details', '', 'planning-rules'), ruleSummary = el('summary', 'Øktlengde og pauser')
    const ruleGrid = el('div', '', 'form-grid')
    for (const [key, label] of [['sessionMinutes', 'Vanlig økt (min)'], ['minimumMinutes', 'Minste økt (min)'], ['maximumMinutes', 'Lengste økt (min)'], ['breakMinutes', 'Pause (min)']]) {
      const wrapper = el('label', label), input = el('input'); input.name = key; input.type = 'number'; input.min = key === 'breakMinutes' ? '0' : '1'; input.max = '1440'; input.value = rules[key]
      input.onchange = () => { rules[key] = Number(input.value); compute() }; wrapper.append(input); ruleGrid.append(wrapper)
    }
    const update = el('button', 'Oppdater forslag', 'secondary'); update.type = 'button'; update.onclick = compute
    ruleDetails.append(ruleSummary, ruleGrid, update); dialog.append(ruleDetails)
    const host = el('div', '', 'replanning-preview'), error = el('p', '', 'replanning-error'); error.setAttribute('role', 'alert')
    const actionsRow = el('div', '', 'actions'), accept = el('button', 'Bruk planen'), reject = el('button', 'Ikke nå', 'secondary')
    accept.type = reject.type = 'button'; accept.dataset.accept = ''; reject.dataset.reject = ''; reject.onclick = close
    accept.onclick = () => apply(error, accept)
    actionsRow.append(accept, reject); dialog.append(host, error, actionsRow)
    compute(); dialog.showModal(); heading.focus()
  }

  function compute() {
    const state = actions.state(), host = dialog.querySelector('.replanning-preview'), error = dialog.querySelector('[role=alert]')
    if (!host) return
    error.textContent = ''; host.replaceChildren()
    const availability = availabilityFor(state, { now: new Date(), choice: state.workWindows?.length ? 'saved' : choice || 'assumption' })
    const scoped = taskId ? [taskId] : undefined
    const exploratory = Object.fromEntries(state.tasks.filter(task => (!scoped || scoped.includes(task.id)) && !task.completed && !getRemainingRange(task)).map(task => [task.id, 30]))
    preview = createReplan(state, { rules, exploratory, availability, taskIds: scoped })
    dialog.querySelector('[data-accept]').disabled = !preview.ok || !preview.changes?.length
    if (!preview.ok) { error.textContent = preview.error; return }
    renderPreview(host, error)
  }

  function renderPreview(host, error) {
    host.replaceChildren(); error.textContent = ''
    const conditional = preview.availability?.conditional
    host.append(el('p', conditional ? `Forslag hvis disse tidene passer. ${preview.availability.label}: ${preview.availability.detail}.` : `Forslag innen ${preview.availability?.label || 'registrert tid'}.`, conditional ? 'assumption-note' : ''))
    const created = preview.changes.filter(change => !change.original && change.proposed).length
    const moved = preview.changes.filter(change => change.original && change.proposed && !sameTime(change)).length
    const removed = preview.changes.filter(change => change.original && !change.proposed).length
    host.append(el('p', `${created} økter legges til, ${moved} flyttes og ${removed} fjernes. Øvrige økter beholdes.`))
    if (Object.keys(preview.exploratory || {}).length) host.append(el('p', 'En kort startøkt er foreslått for ukjent arbeidsmengde. Den er ikke et estimat for hele oppgaven og viser ikke at arbeidet rekker fristen.', 'assumption-note'))
    for (const problem of preview.problems) host.append(el('p', problem, 'plan-problem'))
    if (!preview.changes.length) host.append(el('p', 'Ingen passende tidspunkt ble funnet før fristen med disse reglene. Endre studietid eller bruk detaljert tilgjengelighet.'))
    for (const change of preview.changes) {
      const row = el('article', '', 'replan-row'); row.dataset.sessionId = change.proposed?.id || change.original?.id || ''
      row.append(el('h3', change.title))
      if (!change.proposed) { row.append(el('p', `Fjerner ${sessionLabel(change.original)}. Manglende arbeid er forklart over.`)); host.append(row); continue }
      const session = preview.proposed.find(item => item.id === change.proposed.id)
      row.append(el('p', sessionLabel(session), 'proposed-session-time'))
      row.append(el('p', change.original ? sameTime(change) ? 'Tidspunktet beholdes.' : `Flyttes fra ${sessionLabel(change.original)}.` : `Arbeid videre på «${change.title}».`))
      if (change.deadlineLocal) row.append(el('p', `Frist: ${change.deadlineLocal.replace('T', ' ')}.`))
      if (change.exploratory) row.append(el('p', 'Kort avklaringsøkt; total arbeidsmengde er fortsatt ukjent.', 'assumption-note'))
      const move = el('button', 'Flytt', 'secondary'); move.type = 'button'; move.onclick = () => showMoves(row, session, error)
      row.append(move); host.append(row)
    }
  }

  function showMoves(row, session, error) {
    row.querySelector('.move-options')?.remove()
    const box = el('div', '', 'move-options'); let alternatives = []
    try { alternatives = replanMoveAlternatives(actions.state(), preview, session.id) }
    catch { box.append(el('p', 'Alternativene kunne ikke kontrolleres nå. Du kan velge tidspunkt selv.')) }
    box.append(el('h4', 'Velg et kontrollert alternativ'))
    if (!alternatives.length) box.append(el('p', 'Ingen andre passende alternativer ble funnet innen registrerte regler og kjente avtaler.'))
    for (const candidate of alternatives) {
      const button = el('button', sessionLabel(candidate), 'secondary'); button.type = 'button'
      button.onclick = () => { replaceSession(candidate); renderPreview(dialog.querySelector('.replanning-preview'), error) }
      box.append(button)
    }
    const manual = el('button', 'Velg tidspunkt selv', 'text-button'); manual.type = 'button'; manual.onclick = () => showManual(box, session, error)
    box.append(manual); row.append(box); alternatives[0] ? box.querySelector('button.secondary').focus() : manual.focus()
  }

  function showManual(box, session, error) {
    box.querySelector('.manual-move')?.remove()
    const form = el('form', '', 'manual-move'), values = {
      dateLocal: ['Dato', 'date', session.dateLocal], startTime: ['Start', 'time', session.startTime],
      endDateLocal: ['Sluttdato', 'date', session.endDateLocal || session.dateLocal], endTime: ['Slutt', 'time', session.endTime],
    }
    for (const [name, [label, type, value]] of Object.entries(values)) { const wrapper = el('label', label), input = el('input'); input.name = name; input.type = type; input.value = value; wrapper.append(input); form.append(wrapper) }
    const use = el('button', 'Bruk tidspunktet i utkastet'); use.type = 'submit'; form.append(use)
    form.onsubmit = event => {
      event.preventDefault(); const candidate = { ...session, ...Object.fromEntries(new FormData(form)) }
      if (candidate.endDateLocal === candidate.dateLocal) delete candidate.endDateLocal
      if (duration(candidate) !== duration(session)) { error.textContent = 'Flytting må beholde øktens varighet. Velg en sluttid som gir samme lengde.'; return }
      const draft = structuredClone(preview), index = draft.proposed.findIndex(item => item.id === session.id); draft.proposed[index] = candidate
      const checked = applyReplan(actions.state(), draft)
      if (!checked.ok) { error.textContent = checked.error; return }
      preview = draft
      const change = preview.changes.find(item => item.proposed?.id === candidate.id); if (change) change.proposed = candidate
      renderPreview(dialog.querySelector('.replanning-preview'), error)
    }
    box.append(form); form.elements.dateLocal.focus()
  }

  function replaceSession(candidate) {
    const index = preview.proposed.findIndex(item => item.id === candidate.id); preview.proposed[index] = candidate
    const change = preview.changes.find(item => item.proposed?.id === candidate.id); if (change) change.proposed = candidate
  }

  function apply(error, accept) {
    if (applying) return
    applying = true; accept.disabled = true
    const result = applyReplan(actions.state(), preview)
    if (!result.ok) { applying = false; accept.disabled = false; error.textContent = result.error; return }
    const saved = actions.commit(result.state, 'Ny samlet studieplan')
    if (!saved.ok) { applying = false; accept.disabled = false; error.textContent = saved.error; return }
    close()
  }

  return { isOpen: () => dialog.open, open(options = {}) { opener = document.activeElement; taskId = options.taskId || null; build() } }
}
