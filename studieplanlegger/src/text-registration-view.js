import { parseTextRegistration } from './text-registration.js'

const node = (tag, text, className = '') => { const value = document.createElement(tag); value.className = className; if (text) value.textContent = text; return value }
const fullDate = value => { try { return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Oslo' }).format(new Date(`${value}T12:00:00+02:00`)) } catch { return value } }
const dateWithYear = (value, year) => {
  const match = String(value || '').match(/(?:^|\s)(\d{1,2})[.]\s*(\d{1,2})(?:[.]|\s|$)/)
  if (!match || !year) return ''
  const iso = `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  try { return fullDate(iso) } catch { return '' }
}
const field = (label, name, value, type = 'text') => {
  const wrapper = node('label', '', 'text-registration-field'); wrapper.append(node('span', label))
  const input = document.createElement('input'); input.name = name; input.type = type; input.value = value ?? ''; wrapper.append(input); return wrapper
}

export function createTextRegistrationView(host, actions) {
  const form = node('form', '', 'text-registration-form'), label = node('label'), input = document.createElement('textarea')
  input.name = 'command'; input.rows = 2; input.placeholder = 'Legg til rapport i IBE160 med frist fredag kl. 14.'
  label.append(node('span', 'Skriv hva du vil legge til eller endre'), input)
  const propose = node('button', 'Lag forslag'); propose.type = 'submit'
  const help = node('p', 'Eksempler: «Øve på koding» · «Lever fysikkoppgave innen 4.10» · «Egen aktivitet: Tannlege 4.10 kl. 12–13»', 'muted')
  const feedback = node('div', '', 'text-registration-feedback'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite')
  const proposal = node('form', '', 'text-registration-proposal'); proposal.hidden = true
  form.append(label, help, propose); host.append(form, feedback, proposal)
  let current = null, busy = false, lastModel = null

  function show(parsed) {
    feedback.replaceChildren()
    if (!parsed.ok) for (const error of parsed.errors) feedback.append(node('p', error, 'field-error'))
    if (!parsed.proposal) { proposal.hidden = true; current = null; return }
    current = structuredClone(parsed.proposal); proposal.replaceChildren(node('h3', parsed.ok ? 'Kontroller før lagring' : 'Korriger forslaget'))
    let actionSelect, yearSelect, ambiguousDateSummary
    if (current.action === 'ambiguous-date') {
      const summary = node('div', '', 'text-registration-summary'); ambiguousDateSummary = node('p', `Dato: ${current.dateLocal ? fullDate(current.dateLocal) : 'velg år'} · Uten emne`); summary.append(node('p', `Tittel: ${current.title}`), ambiguousDateSummary, node('p', 'Velg type før lagring')); proposal.append(summary)
      const wrapper = node('label', '', 'text-registration-field'); actionSelect = document.createElement('select'); actionSelect.name = 'actionChoice'; actionSelect.append(new Option('Velg type', ''), new Option('Oppgave med frist', 'create'), new Option('Egen aktivitet', 'activity')); wrapper.append(node('span', 'Er dette en oppgave eller egen aktivitet?'), actionSelect); proposal.append(wrapper)
      const details = node('details', '', 'text-registration-details'); details.append(node('summary', 'Endre detaljer'), field('Tittel', 'title', current.title), field('Dato', 'dateInput', current.dateLocal || current.dateInput || '')); proposal.append(details)
    } else if (current.action === 'create') {
      const summary = node('div', '', 'text-registration-summary')
      summary.append(node('p', `Tittel: ${current.title}`), node('p', `Frist: ${current.deadlineLocal ? fullDate(current.deadlineLocal.slice(0, 10)) : 'ikke oppgitt'} · ${current.course || 'Uten emne'}`), node('p', `Arbeidsmengde: ${current.remainingMinutes == null ? 'ikke oppgitt' : `${current.remainingMinutes} min`}`))
      proposal.append(summary)
      const courseField = field('Emne (valgfritt, nøyaktig kode eller navn)', 'course', current.course || ''), courseInput = courseField.querySelector('input'), suggestions = node('datalist'); suggestions.id = `text-registration-courses-${crypto.randomUUID()}`
      suggestions.append(new Option('Uten emne', 'uten emne'))
      for (const course of lastModel.planner?.courses || []) suggestions.append(new Option([course.code, course.name].filter(Boolean).join(' · '), course.code || course.name))
      courseInput.setAttribute('list', suggestions.id)
      const details = node('details', '', 'text-registration-details'); details.open = !parsed.ok; details.append(node('summary', 'Endre detaljer'), field('Tittel', 'title', current.title), courseField, suggestions, field('Frist (valgfritt)', 'deadlineInput', current.deadlineLocal || current.deadlineInput || ''), field('Gjenstående arbeid (valgfritt)', 'remainingInput', current.remainingMinutes != null ? `${current.remainingMinutes} min` : current.remainingInput || ''))
      proposal.append(details)
    } else if (current.action === 'activity') {
      const summary = node('div', '', 'text-registration-summary')
      summary.append(node('p', `Tittel: ${current.title}`), node('p', `Dato: ${fullDate(current.dateLocal)} · Uten emne`), node('p', `Tid: ${current.startLocal ? `${current.startLocal}${current.endLocal ? `–${current.endLocal}` : ' · Varighet ikke oppgitt'}` : 'ikke oppgitt'}`), node('p', 'Type: Egen aktivitet'))
      const details = node('details', '', 'text-registration-details'); details.open = !parsed.ok; details.append(node('summary', 'Endre detaljer'), field('Tittel', 'title', current.title), field('Dato', 'dateInput', current.dateLocal || current.dateInput || ''), field('Start (valgfri)', 'startLocal', current.startLocal || '', 'time'), field('Slutt (valgfri)', 'endLocal', current.endLocal || '', 'time'))
      proposal.append(summary, details)
    } else if (current.action === 'deadline') {
      proposal.append(field('Oppgavenavn (må matche nøyaktig)', 'taskTitle', current.taskTitle))
      const oldLine = node('p', `Fra: ${current.oldValue || 'ingen frist'}`, 'text-registration-old-value')
      if (current.taskChoices?.length) {
        const wrapper = node('label', '', 'text-registration-field'), select = document.createElement('select'); select.name = 'taskId'; select.append(new Option('Velg oppgave', ''))
        for (const choice of current.taskChoices) select.append(new Option(`${choice.course || 'Uten emne'} · ${choice.deadlineLocal || 'ingen frist'}`, choice.id))
        select.addEventListener('change', () => { const choice = current.taskChoices.find(item => item.id === select.value); oldLine.textContent = `Fra: ${choice?.oldValue || 'ingen frist'}` })
        wrapper.append(node('span', 'Hvilken oppgave?'), select); proposal.append(wrapper)
      }
      proposal.append(oldLine, field('Ny frist', 'deadlineInput', current.deadlineLocal || current.deadlineInput || ''))
    } else {
      proposal.append(field('Oppgavenavn (må matche nøyaktig)', 'taskTitle', current.taskTitle))
      const oldLine = node('p', `Fra: ${current.oldValue ?? 'ukjent'} minutter`, 'text-registration-old-value')
      if (current.taskChoices?.length) {
        const wrapper = node('label', '', 'text-registration-field'), select = document.createElement('select'); select.name = 'taskId'; select.append(new Option('Velg oppgave', ''))
        for (const choice of current.taskChoices) select.append(new Option(`${choice.course || 'Uten emne'} · ${choice.deadlineLocal || 'ingen frist'}`, choice.id))
        select.addEventListener('change', () => { const choice = current.taskChoices.find(item => item.id === select.value); oldLine.textContent = `Fra: ${choice?.oldValue ?? 'ukjent'} minutter` })
        wrapper.append(node('span', 'Hvilken oppgave?'), select); proposal.append(wrapper)
      }
      proposal.append(oldLine, field('Nytt gjenstående arbeid', 'remainingInput', current.remainingMinutes != null ? `${current.remainingMinutes} min` : current.remainingInput || ''))
    }
    if (current.needsYearChoice && current.yearChoices?.length) {
      const wrapper = node('label', '', 'text-registration-field'); yearSelect = document.createElement('select'); yearSelect.name = 'yearChoice'; yearSelect.append(new Option('Velg år', ''))
      for (const year of current.yearChoices) yearSelect.append(new Option(String(year), String(year)))
      wrapper.append(node('span', 'Hvilket år?'), yearSelect); proposal.append(wrapper)
    }
    const controls = node('div', '', 'actions'), actionLabel = current.action === 'ambiguous-date' ? 'Velg handling' : current.action === 'activity' ? 'Legg til aktivitet' : current.action === 'create' ? 'Legg til oppgave' : 'Lagre endring', confirm = node('button', actionLabel), cancel = node('button', 'Avbryt', 'secondary')
    const refreshConfirm = () => { confirm.disabled = Boolean(actionSelect && !actionSelect.value || yearSelect && !yearSelect.value); if (actionSelect) confirm.textContent = actionSelect.value === 'activity' ? 'Legg til aktivitet' : actionSelect.value === 'create' ? 'Legg til oppgave' : 'Velg handling' }
    actionSelect?.addEventListener('change', refreshConfirm); yearSelect?.addEventListener('change', () => { refreshConfirm(); if (ambiguousDateSummary) ambiguousDateSummary.textContent = `Dato: ${dateWithYear(current.dateInput || current.deadlineInput, yearSelect.value) || 'velg år'} · Uten emne` }); refreshConfirm()
    confirm.type = 'submit'; cancel.type = 'button'; cancel.addEventListener('click', () => { current = null; proposal.hidden = true; feedback.replaceChildren(); input.focus() })
    controls.append(confirm, cancel); proposal.append(controls); proposal.hidden = false; (actionSelect || confirm).focus({ preventScroll: true })
  }
  form.addEventListener('submit', event => { event.preventDefault(); show(parseTextRegistration(input.value, { tasks: lastModel.tasks, courses: lastModel.planner?.courses, now: lastModel.now })) })
  host.addEventListener('focusin', event => queueMicrotask(() => {
    const nav = document.querySelector('.view-actions'), navTop = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : innerHeight
    const rect = event.target.getBoundingClientRect()
    if (rect.bottom > navTop - 12) window.scrollBy({ top: rect.bottom - navTop + 12, behavior: 'instant' })
  }))
  proposal.addEventListener('submit', event => {
    event.preventDefault(); if (!current || busy) return
    const pageScroll = { x: scrollX, y: scrollY }, confirmButton = proposal.querySelector('button[type=submit]')
    busy = true; confirmButton.disabled = true
    const values = Object.fromEntries(new FormData(proposal))
    const choice = current.taskChoices?.find(item => item.id === values.taskId)
    const edited = { ...current, ...values, ...(choice ? { taskId: choice.id, taskTitle: choice.title, oldValue: choice.oldValue } : {}) }
    if (current.action === 'ambiguous-date') { edited.action = values.actionChoice; edited.deadlineInput = values.dateInput || current.dateInput; edited.dateInput = values.dateInput || current.dateInput }
    if (values.yearChoice) {
      const key = current.action === 'activity' ? 'dateInput' : 'deadlineInput', source = values[key] || current[key] || ''
      const [date, clock = ''] = source.split(/(?=\s+kl\.?\s*)/iu)
      edited[key] = `${date.replace(/\s+\d{4}$/u, '').replace(/[.]$/u, '')} ${values.yearChoice}${clock}`
      if (current.action === 'ambiguous-date') edited.dateInput = edited.deadlineInput
    }
    const result = actions.confirm(edited)
    busy = false
    if (!result.ok) { confirmButton.disabled = false; feedback.replaceChildren(node('p', result.error, 'field-error')); window.scrollTo({ left: pageScroll.x, top: pageScroll.y, behavior: 'instant' }); confirmButton.focus({ preventScroll: true }); return }
    current = null; proposal.hidden = true; input.value = ''
    const receipt = node('p', result.message); feedback.replaceChildren(receipt)
    if (result.undoable !== false) {
      const undo = node('button', 'Angre', 'text-button'), undoStatus = node('span', '', 'field-error'); undo.type = 'button'
      undo.addEventListener('click', () => {
        const outcome = actions.undo(result.undoId)
        if (outcome.ok) { feedback.textContent = 'Endringen er angret.'; input.focus() }
        else undoStatus.textContent = outcome.error
      })
      feedback.append(undo, undoStatus); undo.focus({ preventScroll: true })
    } else input.focus({ preventScroll: true })
  })
  return {
    render(model) { lastModel = model; host.hidden = !['overview', 'all', 'week'].includes(model.view); form.querySelector('button').disabled = !model.readable || model.editing; input.disabled = !model.readable || model.editing },
    hasDraft: () => Boolean(input.value || current),
  }
}
