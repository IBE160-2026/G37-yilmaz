import './calendar-viewport.css'

// Readable controls are independent of the duration geometry. Keep these nodes
// stable during scrolling, including while a details dialog owns focus.
export function createCalendarViewport(host, viewport, getEntries, entryButton, fitViewport) {
  const generalHelp = host.querySelector('.calendar-scroll-hint')
  if (generalHelp) {
    generalHelp.className = 'muted calendar-general-help'
    host.querySelector('.full-calendar-filters').append(generalHelp)
  }
  const narrowWeekHint = document.createElement('p')
  narrowWeekHint.className = 'calendar-narrow-week-hint'
  narrowWeekHint.textContent = 'Rull sidelengs for alle ukedagene.'
  viewport.before(narrowWeekHint)
  let controls = new Map(), frame = 0, summary
  const originalLabels = new WeakMap()
  const keyOf = node => node.dataset.calendarKey || node.dataset.calendarGeometry
  function update() {
    frame = 0
    if (host.hidden || !['day', 'week'].includes(viewport.dataset.mode)) return
    const bounds = viewport.getBoundingClientRect(), clipped = new Map()
    const nav = document.querySelector('.view-actions')
    const bottom = Math.min(bounds.top + viewport.clientTop + viewport.clientHeight, innerHeight,
      nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : innerHeight)
    for (const day of viewport.querySelectorAll('.calendar-time-day')) {
      const top = Math.max(0, bounds.top + viewport.clientTop,
        day.querySelector('h3').getBoundingClientRect().bottom,
        day.querySelector('.calendar-points').getBoundingClientRect().bottom)
      for (const block of day.querySelectorAll('.calendar-timeline .calendar-entry, .calendar-duration-marker')) {
        const rect = block.getBoundingClientRect(), key = keyOf(block)
        const visible = rect.bottom > top + .5 && rect.top < bottom - .5 &&
          rect.right > bounds.left + viewport.clientLeft && rect.left < bounds.right
        const before = visible && rect.top < top - .5, after = visible && rect.bottom > bottom + .5
        block.classList.toggle('viewport-continues-before', before)
        block.classList.toggle('viewport-continues-after', after)
        const message = [before ? 'Starter f\u00f8r synlig tidsrom' : '', after ? 'Fortsetter etter synlig tidsrom' : ''].filter(Boolean).join('. ')
        if (message) { clipped.set(key, [clipped.get(key), message].filter(Boolean).join('. ')); block.setAttribute('aria-description', `${message}. Full tid og tittel i lesbar aktivitetsliste.`) }
        else block.removeAttribute('aria-description')
      }
    }
    for (const [key, nodes] of controls) for (const control of nodes) {
      let indication = control.querySelector('.entry-viewport-continuation')
      const message = clipped.get(key) || ''
      if (message && !indication) {
        indication = document.createElement('span'); indication.className = 'entry-continuation entry-viewport-continuation'; control.append(indication)
      }
      if (indication) { if (indication.textContent !== message) indication.textContent = message; indication.hidden = !message }
      const label = `${originalLabels.get(control)}${message ? `. ${message}` : ''}`
      if (control.getAttribute('aria-label') !== label) control.setAttribute('aria-label', label)
    }
    if (summary) {
      const count = [...controls.values()].reduce((total, nodes) => total + nodes.length, 0)
      const overflow = host.querySelector('.calendar-readable-content')
      const text = 'Aktiviteter (' + count + ')' + (overflow.scrollWidth > overflow.clientWidth + 1 ? ' · rull sidelengs' : '')
      if (summary.textContent !== text) summary.textContent = text
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update) }
  function refresh() {
    controls = new Map()
    const list = host.querySelector('.calendar-readable-events'), content = list?.querySelector('.calendar-readable-content')
    summary = list?.querySelector('summary')
    if (!content || !['day', 'week'].includes(viewport.dataset.mode)) return
    const register = control => {
      const key = keyOf(control) || control.dataset.viewportEntry
      if (!controls.has(key)) controls.set(key, [])
      controls.get(key).push(control)
      originalLabels.set(control, control.getAttribute('aria-label') || control.textContent)
    }
    for (const control of content.querySelectorAll('button.calendar-entry')) register(control)
    const entries = new Map(getEntries().map(entry => [entry.key, entry]))
    for (const block of viewport.querySelectorAll('.calendar-timeline .calendar-entry')) {
      const key = keyOf(block), entry = entries.get(key)
      if (!entry || controls.has(key)) continue
      const control = entryButton(entry, block.closest('[data-date]').dataset.date)
      // Existing calendar-key selectors still identify the original time block.
      // The independent focus key restores this extra control across rerenders.
      delete control.dataset.calendarKey
      control.dataset.viewportEntry = key; control.dataset.calendarFocusKey = `viewport:${key}`
      content.append(control); register(control)
    }
    const order = control => {
      const entry = entries.get(keyOf(control) || control.dataset.viewportEntry)
      return entry?.start ?? Date.parse((entry?.local || '').slice(0, 10))
    }
    content.replaceChildren(...[...content.children].sort((a, b) => order(a) - order(b) || (keyOf(a) || a.dataset.viewportEntry).localeCompare(keyOf(b) || b.dataset.viewportEntry)))
    content.setAttribute('aria-label', 'Aktiviteter i kronologisk rekkefølge. Rull sidelengs for flere og åpne et kort for alle detaljer.')
    list.hidden = controls.size === 0
    for (const points of viewport.querySelectorAll('.calendar-points')) if (points.childElementCount) {
      points.tabIndex = 0; points.setAttribute('aria-label', 'Frister og heldagsinformasjon, rull for alle oppf\u00f8ringer')
    }
    fitViewport(); update()
  }
  viewport.addEventListener('scroll', schedule, { passive: true })
  host.addEventListener('toggle', schedule, true)
  window.addEventListener('resize', schedule)
  new ResizeObserver(schedule).observe(viewport)
  return { refresh }
}
