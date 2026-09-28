export function onboardingProgress(state) {
  const course = state.planner?.courses?.at(-1), task = state.tasks?.find(item => course && item.courseId === course.id) || state.tasks?.[0]
  const session = (state.sessions || []).find(item => task && item.taskId === task.id)
  return { course, task, session, step: !course && !task ? 1 : !task ? 2 : !session ? 3 : 4 }
}

export function createOnboarding(actions) {
  const host = document.createElement('section'); host.id = 'connected-onboarding'; host.className = 'panel connected-onboarding'; document.querySelector('.work-area').prepend(host)
  let signature = '', active = false, shownStep = null
  const el = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node }
  const button = (text, fn, className = 'secondary') => { const node = el('button', text); node.type = 'button'; node.className = className; node.onclick = fn; return node }
  return { render(model) {
    if (!model.onboarding && !model.tasks.length && !model.planner?.courses?.length && !model.sessions?.length && !model.planner?.events?.length) active = true
    const show = !model.onboarding?.dismissed && !model.onboarding?.completed && (active || model.onboarding) && model.view === 'overview' && model.readable
    host.hidden = !show
    if (!show) return
    document.querySelector('#empty-dashboard').hidden = true
    const progress = onboardingProgress(model)
    if (shownStep === null || progress.step > shownStep) shownStep = Math.min(progress.step, 3)
    const next = JSON.stringify([progress, model.workWindows, shownStep, model.editing]); if (signature === next) return; signature = next
    const focused = host.contains(document.activeElement) ? document.activeElement.textContent : null
    host.replaceChildren(el('p', `KOM I GANG · STEG ${shownStep} AV 3`))
    if (shownStep === 1) {
      host.append(el('h2', 'Legg til et emne'), el('p', progress.course ? `${progress.course.code} ${progress.course.name}` : 'Importer et emne, legg det til manuelt, eller hopp over og opprett en oppgave uten ferdig emneinformasjon.'))
      host.append(button('Importer emne', () => { actions.begin(); actions.view('subjects'); document.querySelector('#connected-import-open')?.click() }, 'primary'), button('Legg til manuelt', () => { actions.begin(); actions.view('subjects'); document.querySelector('#course-new')?.click() }), button('Hopp over import', () => { shownStep = 2; signature = ''; actions.open() }))
    } else if (shownStep === 2) {
      host.append(el('h2', 'Legg til første oppgave'), el('p', progress.task ? progress.task.title : 'En tittel er nok. Frist, emne og arbeidsmengde kan avklares senere.'))
      host.append(button(progress.task ? 'Rediger oppgaven' : 'Ny oppgave', () => progress.task ? actions.edit(progress.task.id) : actions.open({ courseId: progress.course?.id }), 'primary'), button('Tilbake', () => { shownStep = 1; signature = ''; actions.view('overview') }))
      if (progress.task) host.append(button('Neste', () => { shownStep = 3; signature = ''; actions.view('overview') }))
    } else {
      host.append(el('h2', 'Finn tid til oppgaven'), el('p', progress.session ? `${progress.session.dateLocal} ${progress.session.startTime}–${progress.session.endTime}` : 'Velg vanlig studietid og se et konkret forslag. Du kan også fortsette å legge inn oppgaver først.'))
      host.append(button('Se planforslag', () => actions.replan(progress.task?.id), 'primary'), button('Detaljert tilgjengelighet', () => { actions.view('capacity'); document.querySelector('.work-window-form input[name=startLocal]')?.focus() }), button('Tilbake', () => { shownStep = 2; signature = ''; actions.view('overview') }), button(progress.session ? 'Fullfør oppstart' : 'Fortsett senere', () => actions.dismiss(Boolean(progress.session))))
    }
    for (const control of host.querySelectorAll('button')) control.disabled = Boolean(model.editing)
    if (focused) [...host.querySelectorAll('button')].find(item => item.textContent === focused && !item.disabled)?.focus({ preventScroll: true })
  } }
}
