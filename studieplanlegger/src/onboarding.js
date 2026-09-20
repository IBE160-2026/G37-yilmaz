export function onboardingProgress(state) {
  const course = state.planner?.courses?.at(-1), task = state.tasks?.find(item => course && item.courseId === course.id) || state.tasks?.[0]
  const session = (state.sessions || []).find(item => task && item.taskId === task.id)
  return { course, task, session, step: !course ? 1 : !task ? 2 : !session ? 3 : 4 }
}
export function createOnboarding(actions) {
  const host = document.createElement('section'); host.id = 'connected-onboarding'; host.className = 'panel connected-onboarding'; document.querySelector('.work-area').prepend(host)
  let signature = '', active = false
  const el = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node }
  const button = (text, fn) => { const node = el('button', text); node.type = 'button'; node.className = 'secondary'; node.onclick = fn; return node }
  return { render(model) {
    if (!model.onboarding && !model.tasks.length && !model.planner?.courses?.length && !model.sessions?.length && !model.planner?.events?.length) active = true
    const show = !model.onboarding?.dismissed && !model.onboarding?.completed && (active || model.onboarding) && model.view === 'overview' && model.readable
    host.hidden = !show
    if (!show) return
    document.querySelector('#empty-dashboard').hidden = true
    const progress = onboardingProgress(model), next = JSON.stringify([progress, model.workWindows])
    const existingPropose = host.querySelector('[data-onboarding-action=propose]')
    if (existingPropose) existingPropose.disabled = !progress.task || model.editing
    if (signature === next) return; signature = next
    const focused = host.contains(document.activeElement) ? document.activeElement.textContent : null
    host.replaceChildren(el('p', 'KOM I GANG'), el('h2', 'Din første studieøkt'))
    const steps = el('ol'); steps.className = 'connected-steps'
    const course = el('li'); course.append(el('h3', '1. Samle et emne'), el('p', progress.course ? `${progress.course.code} ${progress.course.name}` : 'Importer fra lærested eller dokument, eller legg til selv.'))
    course.append(button(progress.course ? 'Se og importer emner' : 'Importer emne', () => { actions.begin(); actions.view('subjects'); document.querySelector('#connected-import-open')?.click() }), button('Legg til manuelt', () => { actions.begin(); actions.view('subjects'); document.querySelector('#course-new')?.click() }))
    const task = el('li'); task.append(el('h3', '2. Velg første oppgave'), el('p', progress.task ? progress.task.title : 'En tittel er nok. Emnet kan endres, og frist og tid er valgfrie.'))
    task.append(button(progress.task ? 'Rediger første oppgave' : 'Legg til første oppgave', () => { actions.begin(); progress.task ? actions.edit(progress.task.id) : actions.open({ courseId: progress.course?.id }) }))
    const session = el('li'); session.append(el('h3', '3. Velg en studieøkt'), el('p', progress.session ? `${progress.session.dateLocal} ${progress.session.startTime}–${progress.session.endTime}` : 'Bekreft tiden du har tilgjengelig, og kontroller et redigerbart øktforslag.'))
    session.append(button('Registrer tilgjengelig tid', () => { actions.view('capacity'); document.querySelector('.work-window-form input[name=startLocal]')?.focus() }))
    const propose = button('Velg foreslått økt', () => actions.replan()); propose.dataset.onboardingAction = 'propose'; propose.disabled = !progress.task || model.editing; session.append(propose)
    steps.append(course, task, session); host.append(steps)
    const skip = button(progress.session ? 'Fullfør oppstart' : 'Fortsett senere', () => actions.dismiss(Boolean(progress.session))); host.append(skip)
    if (focused) [...host.querySelectorAll('button')].find(item => item.textContent === focused)?.focus({ preventScroll: true })
  } }
}
