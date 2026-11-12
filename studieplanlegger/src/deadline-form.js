import { inspectDeadline } from './deadline.js'

// Draft-only controls: an occurrence is persisted only by a successful task save.
export function createDeadlineForm(form) {
  const date = form.querySelector('#deadlineDate')
  const time = form.querySelector('#deadlineTime')
  const local = form.elements.deadlineLocal
  const occurrence = form.elements.deadlineDisambiguation
  const group = form.querySelector('#deadlineOccurrence')
  const choiceInfo = form.querySelector('#deadline-choice-info')
  let inspectedValue = null

  function describeChoice() {
    const option = inspectDeadline(local.value).options.find(option => option.value === occurrence.value)
    choiceInfo.hidden = !option
    choiceInfo.textContent = option ? option.label : ''
  }

  function sync(choice) {
    // A known date without a clock stays date-only; do not invent midnight.
    local.value = date.value ? `${date.value}${time.value ? `T${time.value}` : ''}` : time.value ? `T${time.value}` : ''
    const inspection = inspectDeadline(local.value)
    const changed = inspectedValue !== local.value
    group.hidden = inspection.status !== 'ambiguous'
    occurrence.disabled = group.hidden
    occurrence.required = !group.hidden
    if (changed || choice !== undefined) {
      occurrence.replaceChildren(new Option('Velg første eller andre gang', ''))
      for (const option of inspection.options) occurrence.add(new Option(option.label.replace(`, UTC${option.offset}`, ''), option.value))
      occurrence.value = group.hidden ? '' : choice || ''
      inspectedValue = local.value
    }
    describeChoice()
    return inspection
  }

  function errors(values = {}) {
    const inspection = inspectDeadline(local.value)
    const badDate = Boolean(values.deadlineLocal) && inspection.status === 'invalid-date'
    date.setAttribute('aria-invalid', String(badDate))
    time.setAttribute('aria-invalid', String(Boolean(values.deadlineLocal) && !badDate))
    occurrence.setAttribute('aria-invalid', String(Boolean(values.deadlineDisambiguation)))
  }

  for (const control of [date, time]) control.addEventListener('input', () => {
    sync()
    for (const name of ['deadlineLocal', 'deadlineDisambiguation']) form.querySelector(`#${name}-error`).textContent = ''
    errors()
  })
  occurrence.addEventListener('change', () => {
    describeChoice()
    form.querySelector('#deadlineDisambiguation-error').textContent = ''
    occurrence.setAttribute('aria-invalid', 'false')
  })

  return {
    sync,
    errors,
    open(task) {
      date.value = task?.deadlineLocal?.slice(0, 10) || ''
      time.value = task?.deadlineLocal?.slice(11, 16) || ''
      sync(task?.deadlineDisambiguation || '')
    },
    focusError(values) {
      const inspection = inspectDeadline(local.value)
      const control = values.deadlineDisambiguation ? occurrence
        : inspection.status === 'invalid-date' ? date : time
      const details = control.closest('details')
      if (details) details.open = true
      control.focus()
    },
  }
}
