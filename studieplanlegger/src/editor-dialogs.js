// Keep the existing forms and save/cancel handlers; native dialogs provide focus
// containment, Escape and an inert background without a second editing state.
export function createEditorDialogs() {
  const mounted = new WeakSet()
  let lastExternalFocus = null
  document.addEventListener('focusin', event => {
    if (event.target !== document.body && !event.target.closest('dialog')) lastExternalFocus = event.target
  })
  return function mountDialogs() {
    for (const form of document.querySelectorAll('#task-form, #step-form, #session-form, #subject-editor')) {
      if (mounted.has(form)) continue
      mounted.add(form)
      const dialog = document.createElement('dialog')
      dialog.className = 'editor-dialog'
      form.before(dialog)
      dialog.append(form)
      let opener
      const sync = () => {
        if (!form.hidden && !dialog.open) {
          opener = lastExternalFocus || document.activeElement
          const title = form.querySelector('h2, h3')
          if (title) { title.id ||= `${form.id}-heading`; dialog.setAttribute('aria-labelledby', title.id) }
          dialog.showModal()
          form.querySelector('input:not([type="hidden"]), select, textarea')?.focus({ preventScroll: true })
        } else if (form.hidden && dialog.open) {
          dialog.close()
          if (opener?.isConnected && !opener.closest('[hidden]') && !opener.disabled) opener.focus({ preventScroll: true })
        }
      }
      dialog.addEventListener('cancel', event => {
        event.preventDefault()
        const cancel = [...form.querySelectorAll('button')].find(button => button.type === 'button' && button.textContent === 'Avbryt')
        cancel?.click()
      })
      form.addEventListener('input', () => { form.dataset.dirty = 'true' })
      form.addEventListener('reset', () => { delete form.dataset.dirty })
      dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return
        const controls = [...form.querySelectorAll('input:not([type="hidden"]), select, textarea, button, a[href], summary, [tabindex="0"]')]
          .filter(node => !node.disabled && node.getClientRects().length && !node.closest('[hidden]'))
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      })
      new MutationObserver(sync).observe(form, { attributes: true, attributeFilter: ['hidden'] })
      sync()
    }
  }
}
