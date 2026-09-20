import { validateCourse, semesterLabel, osloYear } from './planner.js'
import { getRemainingMinutes } from './tasks.js'
import { personalEstimate } from './personal-estimates.js'
export function courseOptionLabels(courses) {
  const base = c => [c.code, c.name, c.university || 'Institusjon ikke oppgitt', c.campus, semesterLabel(c.semester, c.year)].filter(Boolean).join(' · ')
  return new Map(courses.map(course => {
    const name = base(course), peers = courses.filter(c => base(c) === name).sort((a, b) => a.id.localeCompare(b.id))
    return [course.id, peers.length > 1 ? `${name} · Valg ${peers.findIndex(c => c.id === course.id) + 1}` : name]
  }))
}
export function createTaskForm(form) {
  const input = form.elements.course, selector = form.elements.courseId
  const list = document.createElement('datalist'); list.id = 'task-course-options'; form.append(list); input.setAttribute('list', list.id)
  const inline = document.createElement('details'); inline.className = 'inline-course'
  inline.innerHTML = `<summary>Opprett emne her</summary><p>Emnet lagres sammen med oppgaven.</p><label>Emnenavn<input name="inlineName"></label><label>Emnekode<input name="inlineCode"></label><label>Universitet<input name="inlineUniversity"></label><label>Semester<select name="inlineSemester"><option value="autumn">Høst</option><option value="spring">Vår</option></select></label><label>År<input name="inlineYear" type="number" value="${osloYear()}"></label><button type="button">Bruk nytt emne</button><p role="alert"></p>`
  input.closest('.field').after(inline)
  input.required = false
  input.removeAttribute('aria-label')
  form.querySelector('label[for="course"]').textContent = 'Emne (valgfritt)'
  const grid = form.querySelector('.form-grid'), extra = document.createElement('details'); extra.className = 'task-optional-details'; extra.innerHTML = '<summary>Flere detaljer</summary><div class="form-grid"></div>'
  const detailGrid = extra.querySelector('div')
  for (const item of [...grid.children]) if (!item.contains(form.elements.title) && !item.contains(form.elements.remainingMinutes)) detailGrid.append(item)
  grid.after(extra)
  form.elements.estimatedMinutes.closest('.field').hidden = true
  const unknown = document.createElement('button'); unknown.type = 'button'; unknown.className = 'secondary'; unknown.textContent = 'Vet ikke'; form.elements.remainingMinutes.after(unknown)
  unknown.onclick = () => { remainingTouched = true; form.elements.remainingMinutes.value = ''; form.elements.remainingMinutes.focus() }
  form.elements.remainingMinutes.addEventListener('input', () => { remainingTouched = true })
  form.elements.remainingMinutes.placeholder = 'Vet ikke'
  form.querySelector('#remainingMinutes-help').textContent = 'Et anslag på arbeidet som gjenstår. Vet ikke bevarer usikkerheten. 0 markerer ikke oppgaven som ferdig.'
  const relations = document.createElement('div'); relations.className = 'field field-wide'; relations.innerHTML = '<label>Forutsetninger<select name="dependencyIds" multiple size="4" aria-describedby="dependencyIds-help"></select></label><p id="dependencyIds-help" class="muted">Velg oppgavene som må gjøres først. Ctrl/⌘ velger flere.</p><p id="dependencyIds-error" class="field-error"></p><label>Venter på (valgfritt)<input name="waitingReason" placeholder="For eksempel tilbakemelding fra veileder"></label><label>Oppgavetype (valgfritt)<input name="taskType" placeholder="For eksempel lesing eller oppgaveskriving"></label><label class="check-label"><input name="splittable" type="checkbox" checked>Kan deles i flere økter</label>'
  detailGrid.append(relations)
  form.elements.dependencyIds.setAttribute('aria-label', 'Forutsetninger')
  const estimate = document.createElement('details'); estimate.className = 'personal-estimate'; estimate.innerHTML = '<summary>Forslag fra lokal arbeidshistorikk</summary><p></p><button type="button" class="secondary" hidden>Bruk som gjenstående estimat</button>'; form.elements.remainingMinutes.closest('.field').append(estimate)
  let courses = [], pending, selectedLabel, signature = '', model, editingTask, remainingTouched = false
  const estimateContext = () => ({ ...editingTask, course: input.value, courseId: selector.value, taskType: form.elements.taskType.value })
  estimate.querySelector('button').onclick = () => { const result = personalEstimate(model, estimateContext()); if (result.available) { remainingTouched = true; form.elements.remainingMinutes.value = result.minutes } }
  const estimateText = () => { const result = personalEstimate(model || {}, estimateContext()); estimate.querySelector('p').textContent = result.explanation || result.reason; estimate.querySelector('button').hidden = !result.available }
  estimate.ontoggle = estimateText
  form.elements.taskType.addEventListener('input', estimateText)
  const label = c => courseOptionLabels([...courses, ...(pending ? [pending] : [])]).get(c.id)
  function options() {
    const selected = selector.value
    selector.replaceChildren(new Option('Emnetekst uten kobling', '')); list.replaceChildren()
    for (const course of [...courses, ...(pending ? [pending] : [])]) { selector.append(new Option(label(course), course.id)); list.append(new Option(label(course), label(course))) }
    selector.value = selected
  }
  input.addEventListener('input', () => {
    if (input.value === selectedLabel) return
    const matches = [...courses, ...(pending ? [pending] : [])].filter(c => [label(c), c.code, c.name].includes(input.value))
    selector.value = matches.length === 1 ? matches[0].id : ''; selectedLabel = input.value
    estimateText()
  })
  selector.addEventListener('change', () => { const course = [...courses, ...(pending ? [pending] : [])].find(c => c.id === selector.value); if (course) { input.value = course.code || course.name; selectedLabel = input.value }; estimateText() })
  inline.querySelector('button').onclick = () => {
    try {
      pending = validateCourse({ name: form.elements.inlineName.value, code: form.elements.inlineCode.value, university: form.elements.inlineUniversity.value, semester: form.elements.inlineSemester.value, year: form.elements.inlineYear.value, credits: '' })
      options(); selector.value = pending.id; input.value = pending.code || pending.name; selectedLabel = input.value; inline.open = false; input.focus(); inline.querySelector('[role=alert]').textContent = ''; estimateText()
    } catch (error) { inline.querySelector('[role=alert]').textContent = error.message }
  }
  return {
    render(nextModel) { model = nextModel; courses = model.planner?.courses || []; const next = JSON.stringify(courses); if (signature !== next) { signature = next; options() } },
    open(task) {
      editingTask = task; remainingTouched = false; pending = null; options(); selectedLabel = task?.course || ''; input.value = selectedLabel; selector.value = task?.courseId || ''; inline.open = false; extra.open = Boolean(task?.id); inline.querySelector('[role=alert]').textContent = ''
      form.elements.remainingMinutes.value = task?.remainingMinutes !== undefined ? task.remainingMinutes ?? '' : task?.estimatedMinutes ?? ''
      const deps = form.elements.dependencyIds; deps.replaceChildren()
      for (const candidate of model?.tasks || []) if (candidate.id !== task?.id) { const option = new Option(candidate.title, candidate.id); option.selected = Boolean(task?.dependencyIds?.includes(candidate.id)); deps.append(option) }
      for (const id of task?.missingDependencyIds || []) { const option = new Option(`Mangler: ${id}`, id); option.selected = true; deps.append(option) }
      form.elements.waitingReason.value = task?.waitingReason || ''; form.elements.taskType.value = task?.taskType || ''; form.elements.splittable.checked = task?.splittable !== false; estimateText()
    },
    draft() {
      const dependencies = [...form.elements.dependencyIds.selectedOptions].map(item => item.value)
      return { ...(pending && selector.value === pending.id ? { newCourse: pending } : {}),
        ...(editingTask?.id && editingTask.remainingMinutes === undefined && !remainingTouched ? { remainingMinutes: undefined } : {}),
        dependencyIds: dependencies.length || editingTask?.dependencyIds !== undefined ? dependencies : undefined,
        waitingReason: form.elements.waitingReason.value || editingTask?.waitingReason !== undefined ? form.elements.waitingReason.value : undefined,
        taskType: form.elements.taskType.value || editingTask?.taskType !== undefined ? form.elements.taskType.value : undefined,
        splittable: !form.elements.splittable.checked || editingTask?.splittable !== undefined ? form.elements.splittable.checked : undefined }
    },
    reset() { pending = null; selectedLabel = ''; inline.open = false; options() },
  }
}
