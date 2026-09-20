import { createReplan, applyReplan } from './replanning.js'
import { DEFAULT_PLANNING_RULES } from './planning-rules.js'
import { getRemainingMinutes } from './tasks.js'
import { personalEstimate } from './personal-estimates.js'
const el = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node }
export function createReplanningView(actions) {
  const dialog = el('dialog'); dialog.className = 'editor-dialog connected-dialog'; document.body.append(dialog)
  let opener, preview
  const close = () => { dialog.close(); preview = null; actions.onClose?.(); opener?.focus({ preventScroll: true }) }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  return { isOpen: () => dialog.open, open({ firstSession = false } = {}) {
    opener = document.activeElement
    dialog.innerHTML = `<h2 id="replanning-heading">Jeg ligger etter</h2><p>Se et nytt forslag innen arbeidstiden du har bekreftet. Kontroller frister, pauser og avhengigheter før du reserverer.</p><form class="connected-form"><div class="form-grid"><label>Vanlig økt (min)<input name="sessionMinutes" type="number" min="1" max="1440"></label><label>Minste økt (min)<input name="minimumMinutes" type="number" min="1" max="1440"></label><label>Lengste økt (min)<input name="maximumMinutes" type="number" min="1" max="1440"></label><label>Pause mellom økter (min)<input name="breakMinutes" type="number" min="0" max="1440"></label></div><button type="submit" class="secondary">Beregn nytt forslag</button></form><div class="replanning-preview"></div><p class="replanning-error" role="alert"></p><div class="actions"><button type="button" data-accept>Godta hele planen</button><button type="button" data-reject class="secondary">Forkast</button></div>`
    dialog.setAttribute('aria-labelledby', 'replanning-heading')
    if (firstSession) {
      dialog.querySelector('h2').textContent = 'Finn tid til første studieøkt'
      dialog.querySelector('p').textContent = 'Velg en økt i arbeidstiden du har bekreftet. Du kan endre forslaget før du reserverer.'
    }
    const form = dialog.querySelector('form'), host = dialog.querySelector('.replanning-preview'), error = dialog.querySelector('[role=alert]'), accept = dialog.querySelector('[data-accept]')
    const ruleDetails = el('details'), ruleSummary = el('summary'); ruleDetails.className = 'planning-rules'; form.querySelector('.form-grid').before(ruleDetails); ruleDetails.append(ruleSummary, form.querySelector('.form-grid'))
    const invalidate = () => {
      preview = null; accept.disabled = true
      error.textContent = 'Øktvalgene er endret. Beregn et nytt forslag før du godtar; tidligere viste tider er ikke oppdatert.'
    }
    form.addEventListener('input', invalidate)
    form.addEventListener('change', invalidate)
    const personal = personalEstimate(actions.state(), {}, { kind: 'session' }), personalSection = el('section')
    personalSection.className = 'personal-session-estimate'
    personalSection.append(el('h3', 'Personlig forslag til øktlengde'), el('p', personal.explanation || personal.reason))
    if (personal.available) {
      const adopt = el('button', 'Bruk som vanlig økt'); adopt.type = 'button'; adopt.className = 'secondary'
      adopt.onclick = () => { form.elements.sessionMinutes.value = personal.minutes; invalidate(); form.elements.sessionMinutes.focus() }
      personalSection.append(el('p', 'Bruk forslaget i utkastet, eller skriv en annen øktlengde. Kontroller grensene og beregn planen på nytt før du godtar.'), adopt)
    }
    ruleDetails.append(personalSection)
    const unknownChoices = new Map()
    for (const task of actions.state().tasks.filter(item => !item.completed && getRemainingMinutes(item) === null)) {
      const row = el('div'), label = el('label', `Velg en utforskende økt: ${task.title}`), selected = el('input'), minutes = el('input')
      selected.type = 'checkbox'; label.className = 'check-label'; label.prepend(selected)
      minutes.type = 'number'; minutes.min = '1'; minutes.max = '1440'; minutes.value = '30'; minutes.setAttribute('aria-label', `Utforskende minutter for ${task.title}`)
      row.append(label, minutes, el('p', 'Du velger lengden selv. Ukjent gjenstående arbeid gjør at fullføring ikke kan beregnes.'))
      form.querySelector('[type=submit]').before(row); unknownChoices.set(task.id, { selected, minutes })
    }
    for (const [key, value] of Object.entries(actions.state().planningPreferences || DEFAULT_PLANNING_RULES)) form.elements[key].value = value
    const compute = () => {
      error.textContent = ''; host.replaceChildren()
      const rules = Object.fromEntries(Object.entries(DEFAULT_PLANNING_RULES).map(([key]) => [key, Number(form.elements[key].value)]))
      ruleSummary.textContent = `Øktlengde og pauser: ${rules.sessionMinutes} min økt · ${rules.minimumMinutes}–${rules.maximumMinutes} min · ${rules.breakMinutes} min pause`
      const exploratory = Object.fromEntries([...unknownChoices].filter(([, value]) => value.selected.checked).map(([id, value]) => [id, Number(value.minutes.value)]))
      preview = createReplan(actions.state(), { rules, exploratory })
      accept.disabled = !preview.ok || !preview.known
      if (!preview.ok) { error.textContent = preview.error; return }
      for (const problem of preview.problems) host.append(el('p', problem))
      if (!preview.changes.length) host.append(el('p', 'Ingen økter kan flyttes eller legges til med disse valgene. Registrer arbeidstid eller avklar oppgavene.'))
      for (const change of preview.changes) {
        const row = el('article'); row.className = 'replan-row'; row.append(el('h3', change.title), el('p', change.original ? `Fra: ${change.original.dateLocal} ${change.original.startTime}–${change.original.endTime}` : 'Fra: ikke reservert'))
        if (change.proposed) {
          const item = preview.proposed.find(item => item.id === change.proposed.id)
          for (const [key, label, type] of [['dateLocal', 'Ny dato', 'date'], ['startTime', 'Ny start', 'time'], ['endDateLocal', 'Ny sluttdato', 'date'], ['endTime', 'Ny slutt', 'time']]) {
            const wrapper = el('label', label), input = el('input'); input.type = type; input.value = item[key]; input.oninput = () => { item[key] = input.value }; wrapper.append(input); row.append(wrapper)
          }
        } else row.append(el('p', 'Til: reservasjonen fjernes. Manglende arbeid er oppgitt i varslet over.'))
        row.append(el('p', change.deadlineLocal ? `Frist: ${change.deadlineLocal.replace('T', ' ')}. Forslaget må slutte før fristen.` : 'Ingen frist er registrert.'))
        if (change.dependencyNote) row.append(el('p', change.dependencyNote))
        host.append(row)
      }
    }
    form.onsubmit = event => { event.preventDefault(); compute() }
    dialog.querySelector('[data-reject]').onclick = close
    accept.onclick = () => {
      const result = applyReplan(actions.state(), preview)
      if (!result.ok) { error.textContent = result.error; return }
      const saved = actions.commit(result.state, 'Ny samlet studieplan')
      if (!saved.ok) { error.textContent = saved.error; return }
      close()
    }
    compute(); dialog.showModal(); form.querySelector('[type=checkbox], [type=submit]').focus()
  } }
}
