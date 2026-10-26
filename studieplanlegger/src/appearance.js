// The small synchronous bootstrap owns state so an app render never changes theme.
export function initializeAppearance() {
  const controller = window.ajourAppearance
  const toggle = document.querySelector('#theme-toggle')
  if (!controller || !toggle) return
  toggle.addEventListener('click', () => controller.toggle())
  controller.subscribe(({ theme }) => {
    const label = theme === 'dark' ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'
    toggle.setAttribute('aria-label', label)
    toggle.title = label
    toggle.querySelector('[data-theme-icon="sun"]').hidden = theme !== 'dark'
    toggle.querySelector('[data-theme-icon="moon"]').hidden = theme === 'dark'
  })
}

export function createAppearanceSettings() {
  const group = document.createElement('fieldset')
  group.className = 'appearance-settings'
  const legend = document.createElement('legend'); legend.textContent = 'Utseende'
  group.append(legend)
  const choices = document.createElement('div'); choices.className = 'appearance-choices'
  const controller = window.ajourAppearance
  for (const [value, text] of [['system', 'System'], ['light', 'Lyst'], ['dark', 'Mørkt']]) {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'radio'; input.name = 'appearance-theme'; input.value = value
    input.addEventListener('change', () => { if (input.checked) controller?.setPreference(value) })
    label.append(input, document.createTextNode(text)); choices.append(label)
  }
  const note = document.createElement('p')
  note.textContent = 'System følger enhetens tema. Tema og emnefarger gjelder denne nettleseren og følger ikke sikkerhetskopier.'
  group.append(choices, note)
  controller?.subscribe(({ preference }) => {
    for (const input of choices.querySelectorAll('input')) input.checked = input.value === preference
  })
  return group
}
