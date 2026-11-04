import { parseOsloDeadline, parseTextRegistration, validateTextRegistrationProposal } from './text-registration.js'
import { formatDeadline } from './calendar.js'
import { osloLocal } from './planner.js'

const node = (tag, text, className = '') => { const value = document.createElement(tag); value.className = className; if (text) value.textContent = text; return value }
const fullDate = value => { try { return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Oslo' }).format(new Date(`${value}T12:00:00+02:00`)) } catch { return value } }
const field = (label, name, value, type = 'text') => {
  const wrapper = node('label', '', 'text-registration-field'); wrapper.append(node('span', label))
  const input = document.createElement('input'); input.name = name; input.type = type; input.value = value ?? ''
  // Native time fields clear invalid values. Retain the rejected parser input
  // until an explicit edit so it cannot silently become an unknown clock.
  if (type === 'time' && value && !input.value) {
    input.dataset.invalidClock = value; input.setCustomValidity('Oppgi et gyldig klokkeslett.')
    for (const eventName of ['input', 'change']) input.addEventListener(eventName, () => { delete input.dataset.invalidClock; input.setCustomValidity('') })
    input.addEventListener('keydown', event => {
      if (['Backspace', 'Delete'].includes(event.key) && !input.value && input.dataset.invalidClock !== undefined) {
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
  }
  wrapper.append(input); return wrapper
}
const proposalValues = form => {
  const values = Object.fromEntries(new FormData(form))
  for (const input of form.querySelectorAll('input[type="time"]')) {
    const clock = input.dataset.invalidClock ?? input.value, match = clock.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::00)?$/u)
    // Engines differ in native range/step validation. Only whole minutes may
    // reach the shared validator, matching the precision shown in the summary.
    values[input.name] = !input.validity.valid || clock && !match ? 'ugyldig klokkeslett' : match ? `${match[1].padStart(2, '0')}:${match[2]}` : ''
  }
  return values
}

// The visible deadline and confirmation use the same edited values, including
// an explicitly selected year. Relative dates retain the proposal's reference.
export function editTextRegistrationProposal(current, values) {
  const choice = current.taskChoices?.find(item => item.id === values.taskId)
  const edited = { ...current, ...values, ...(choice ? { taskId: choice.id, taskTitle: choice.title, oldValue: choice.oldValue } : {}) }
  if (current.action === 'ambiguous-date') { edited.action = values.actionChoice; edited.deadlineInput = values.dateInput ?? current.dateInput; edited.dateInput = values.dateInput ?? current.dateInput }
  if (values.yearChoice) {
    const key = current.action === 'activity' ? 'dateInput' : 'deadlineInput', source = edited[key] ?? ''
    const [date, clock = ''] = source.split(/(?=\s+kl\.?\s*)/iu)
    const missingYear = /^(?:\d{1,2}[.]\s*\d{1,2}[.]?|\d{1,2}[.]?\s+(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)[.]?)$/iu.test(date.trim())
    if (missingYear) edited[key] = `${date.trim().replace(/[.]$/u, '')} ${values.yearChoice}${clock}`
    if (current.action === 'ambiguous-date') edited.dateInput = edited.deadlineInput
  }
  return edited
}

export function textRegistrationDeadlineSummary(proposal) {
  if (!proposal.deadlineInput) return 'ikke oppgitt'
  const capturedNow = new Date(proposal.referenceTime)
  const parsed = parseOsloDeadline(proposal.deadlineInput, Number.isFinite(+capturedNow) ? capturedNow : new Date())
  return parsed.ok ? formatDeadline(parsed.deadlineLocal, { year: true }) : `må avklares – ${parsed.error}`
}

export function textRegistrationSummary(proposal, courses = []) {
  const action = proposal.action === 'create' ? 'create' : 'activity'
  const checked = validateTextRegistrationProposal({ ...proposal, action }, { courses })
  const unresolved = error => `må avklares – ${error}`
  const title = checked.errors.title ? unresolved(checked.errors.title) : String(proposal.title || '').trim() || unresolved('Skriv et navn.')
  if (action === 'create') {
    return { title, course: checked.errors.course ? unresolved(checked.errors.course) : checked.draft.course || 'Uten emne',
      deadline: checked.errors.deadline ? unresolved(checked.errors.deadline) : checked.draft.deadlineLocal ? formatDeadline(checked.draft.deadlineLocal, { year: true }) : 'ikke oppgitt',
      remaining: checked.errors.remaining ? unresolved(checked.errors.remaining) : checked.draft.remainingMinutes == null ? 'ikke oppgitt' : `${checked.draft.remainingMinutes} min`,
      type: 'Type: Oppgave med frist' }
  }
  const start = checked.timing?.start ? osloLocal(checked.timing.start).slice(11) : '', end = checked.timing?.end ? osloLocal(checked.timing.end).slice(11) : ''
  return { title, course: 'Uten emne', date: checked.errors.date ? unresolved(checked.errors.date) : fullDate(checked.dateLocal),
    time: checked.errors.date || checked.errors.time ? unresolved(checked.errors.date || checked.errors.time) : start ? `${start}${end ? `–${end}` : ' · Varighet ikke oppgitt'}` : 'ikke oppgitt',
    type: proposal.action === 'activity' ? 'Type: Egen aktivitet' : 'Velg type før lagring' }
}

export function createTextRegistrationView(host, actions) {
  const form = node('form', '', 'text-registration-form'), label = node('label'), input = document.createElement('textarea')
  input.name = 'command'; input.rows = 2; input.placeholder = 'Legg til rapport i IBE160 med frist fredag kl. 14.'
  label.append(node('span', 'Skriv hva du vil legge til eller endre'), input)
  const propose = node('button', 'Lag forslag'); propose.type = 'submit'
  const help = node('p', 'Eksempler: «Øve på koding» · «Lever fysikkoppgave innen 4.10» · «Egen aktivitet: Tannlege 4.10 kl. 12–13»', 'muted')
  const feedback = node('div', '', 'text-registration-feedback'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite')
  const proposal = node('form', '', 'text-registration-proposal'); proposal.hidden = true
  const disclosure = node('details', '', 'text-registration-disclosure')
  disclosure.append(node('summary', 'Skriv en oppgave eller endring'), form, feedback, proposal)
  form.append(label, help, propose); host.append(disclosure)
  let current = null, busy = false, lastModel = null, updateSummary = () => {}

  function show(parsed) {
    updateSummary = () => {}
    feedback.replaceChildren()
    if (!parsed.ok) for (const error of parsed.errors) feedback.append(node('p', error, 'field-error'))
    if (!parsed.proposal) { proposal.hidden = true; current = null; return }
    current = structuredClone(parsed.proposal); proposal.replaceChildren(node('h3', parsed.ok ? 'Kontroller før lagring' : 'Korriger forslaget'))
    let actionSelect, yearSelect
    const summaryFor = kind => {
      const summary = node('div', '', 'text-registration-summary'), title = node('p'), date = node('p'), amount = node('p'), type = node('p')
      date.setAttribute('aria-live', 'polite')
      summary.append(title, date)
      if (kind !== 'ambiguous-date') summary.append(amount)
      if (kind !== 'create') summary.append(type)
      updateSummary = () => {
        const edited = editTextRegistrationProposal(current, proposalValues(proposal)), values = textRegistrationSummary(edited, lastModel.planner?.courses || [])
        title.textContent = `Tittel: ${values.title}`
        date.textContent = `${kind === 'create' ? 'Frist' : 'Dato'}: ${values.deadline ?? values.date} · ${values.course}`
        amount.textContent = kind === 'create' ? `Arbeidsmengde: ${values.remaining}` : `Tid: ${values.time}`
        type.textContent = values.type
      }
      return summary
    }
    if (current.action === 'ambiguous-date') {
      proposal.append(summaryFor('ambiguous-date'))
      const wrapper = node('label', '', 'text-registration-field'); actionSelect = document.createElement('select'); actionSelect.name = 'actionChoice'; actionSelect.append(new Option('Velg type', ''), new Option('Oppgave med frist', 'create'), new Option('Egen aktivitet', 'activity')); wrapper.append(node('span', 'Er dette en oppgave eller egen aktivitet?'), actionSelect); proposal.append(wrapper)
      const details = node('details', '', 'text-registration-details'); details.append(node('summary', 'Endre detaljer'), field('Tittel', 'title', current.title), field('Dato', 'dateInput', current.dateLocal || current.dateInput || '')); proposal.append(details)
    } else if (current.action === 'create') {
      proposal.append(summaryFor('create'))
      const courseField = field('Emne (valgfritt, nøyaktig kode eller navn)', 'course', current.course || ''), courseInput = courseField.querySelector('input'), suggestions = node('datalist'); suggestions.id = `text-registration-courses-${crypto.randomUUID()}`
      suggestions.append(new Option('Uten emne', 'uten emne'))
      for (const course of lastModel.planner?.courses || []) suggestions.append(new Option([course.code, course.name].filter(Boolean).join(' · '), course.code || course.name))
      courseInput.setAttribute('list', suggestions.id)
      const details = node('details', '', 'text-registration-details'); details.open = !parsed.ok; details.append(node('summary', 'Endre detaljer'), field('Tittel', 'title', current.title), courseField, suggestions, field('Frist (valgfritt)', 'deadlineInput', current.deadlineLocal || current.deadlineInput || ''), field('Gjenstående arbeid (valgfritt)', 'remainingInput', current.remainingMinutes != null ? `${current.remainingMinutes} min` : current.remainingInput || ''))
      proposal.append(details)
    } else if (current.action === 'activity') {
      const summary = summaryFor('activity')
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
    actionSelect?.addEventListener('change', refreshConfirm); yearSelect?.addEventListener('change', refreshConfirm); refreshConfirm()
    confirm.type = 'submit'; cancel.type = 'button'; cancel.addEventListener('click', () => { current = null; proposal.hidden = true; feedback.replaceChildren(); input.focus() })
    controls.append(confirm, cancel); proposal.append(controls); updateSummary(); proposal.hidden = false; (actionSelect || confirm).focus({ preventScroll: true })
  }
  for (const eventName of ['input', 'change']) proposal.addEventListener(eventName, () => { if (current) updateSummary() })
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
    const values = proposalValues(proposal)
    const edited = editTextRegistrationProposal(current, values)
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
    render(model) { lastModel = model; if (current) updateSummary(); host.hidden = !['overview', 'all', 'week'].includes(model.view); form.querySelector('button').disabled = !model.readable || model.editing; input.disabled = !model.readable || model.editing },
    hasDraft: () => Boolean(input.value || current),
  }
}
