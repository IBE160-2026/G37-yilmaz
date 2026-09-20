import { capacityNotice } from './capacity-notice.js'
import { createAgenda } from './agenda-view.js'
import { createEditorDialogs } from './editor-dialogs.js'

const $ = selector => document.querySelector(selector)
const text = (node, value) => { if (node && node.textContent !== value) node.textContent = value }
function element(tag, className, value) {
  const node = document.createElement(tag)
  node.className = className
  if (value) node.textContent = value
  return node
}
const icons = {
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/>',
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  list: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m7 8 1 1 2-2m-3 7 1 1 2-2m3-5h4m-4 6h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1"/>',
  book: '<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M9 2h6m-3 3V2m0 7v5l3 2m4-9 2-2"/>',
  chart: '<path d="M4 3v18h17M8 16v-5m5 5V6m5 10V9"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(key, value)
  svg.innerHTML = icons[name] || icons.list
  return svg
}
export function createStudyDesign(actions) {
  let mounted = false, model = {}, previousSuggestion = '', agenda, nav, more, overflow
  const mobile = window.matchMedia('(max-width: 760px)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const mountDialogs = createEditorDialogs()
  function marker(host, selector) {
    const active = host?.querySelector(selector)
    const indicator = host?.querySelector(':scope > .selection-marker')
    if (!indicator) return
    indicator.hidden = !active || !active.getClientRects().length
    if (indicator.hidden) return
    const a = active.getBoundingClientRect(), h = host.getBoundingClientRect()
    indicator.style.transform = 'translate(' + (a.left - h.left) + 'px, ' + (a.top - h.top) + 'px)'
    indicator.style.width = a.width + 'px'; indicator.style.height = a.height + 'px'
  }
  function updateMarkers() {
    marker(nav, mobile.matches && overflow?.querySelector('[aria-pressed="true"]') ? '#mobile-navigation-more' : 'button[aria-pressed="true"]')
    marker($('.quick-times'), 'button[aria-pressed="true"]')
  }
  function closeMore(restore = false) {
    if (!more) return
    more.setAttribute('aria-expanded', 'false'); nav.removeAttribute('data-more-open')
    if (restore) more.focus({ preventScroll: true })
  }
  function updateCalendar() {
    const isAgenda = $('.calendar-mode button:last-child')?.getAttribute('aria-pressed') === 'true'
    $('.calendar-panel').dataset.designMode = isAgenda ? 'agenda' : 'month'
    $('#compact-agenda').hidden = !isAgenda
    agenda.render(model)
  }
  function mount() {
    if (mounted) return
    mounted = true
    nav = $('.view-actions'); nav.setAttribute('aria-label', 'Hovednavigasjon')
    for (const button of nav.querySelectorAll('button')) {
      const label = button.id === 'view-time' ? 'Finn en oppgave' : button.id === 'view-capacity' ? 'Planlegg uken' : button.textContent
      button.replaceChildren(icon(button.dataset.icon), element('span', 'nav-text', label))
    }
    overflow = element('div', 'nav-secondary'); overflow.id = 'navigation-secondary'
    for (const id of ['view-week', 'view-time', 'view-capacity', 'view-settings']) overflow.append($('#' + id))
    more = element('button', 'mobile-navigation-more'); more.id = 'mobile-navigation-more'; more.type = 'button'
    more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', overflow.id)
    more.append(icon('more'), element('span', 'nav-text', 'Mer'))
    nav.append(overflow, more)
    const navMarker = element('span', 'selection-marker'); navMarker.setAttribute('aria-hidden', 'true'); nav.prepend(navMarker)
    more.addEventListener('click', () => {
      const open = more.getAttribute('aria-expanded') !== 'true'
      more.setAttribute('aria-expanded', String(open)); nav.toggleAttribute('data-more-open', open)
      if (open) overflow.querySelector('button')?.focus()
    })
    nav.addEventListener('click', event => {
      const button = event.target.closest('button[id^="view-"]')
      if (button) closeMore(mobile.matches && overflow.contains(button))
    })
    nav.addEventListener('keydown', event => {
      if (event.key === 'Escape' && more.getAttribute('aria-expanded') === 'true') { event.preventDefault(); closeMore(true) }
    })
    document.addEventListener('click', event => { if (!nav.contains(event.target)) closeMore() })
    nav.addEventListener('focusout', event => { if (event.relatedTarget && !nav.contains(event.relatedTarget)) closeMore() })
    const quickMarker = element('span', 'selection-marker'); quickMarker.setAttribute('aria-hidden', 'true'); $('.quick-times').prepend(quickMarker)
    text($('label[for="available-minutes"]'), 'Egen tid (min)')
    text($('.focus-intro .eyebrow'), 'FINN DIN NESTE OPPGAVE')
    text($('.focus-intro > div:first-child > p:last-child'), 'Velg tiden du har. Finn en oppgave som passer.')
    const illustration = new Image(260, 260)
    illustration.src = '/study-focus-v2.png'; illustration.alt = ''; illustration.decoding = 'async'
    $('.focus-visual').replaceChildren(illustration)
    $('#focus-panel').after($('.focus-results'))
    text($('#summary-week > span:last-child'), 'Denne uken')
    text($('#summary-overdue > span:last-child'), 'Forfalt')
    text($('#summary-ready > span:last-child'), 'Til levering')
    text($('.deadline-fields legend'), 'Frist (valgfritt)')
    const calendarPanel = $('.calendar-panel')
    const agendaHost = element('section', 'compact-agenda'); agendaHost.id = 'compact-agenda'
    agendaHost.setAttribute('aria-label', 'Kommende hendelser')
    calendarPanel.append(agendaHost); agenda = createAgenda(agendaHost, actions)
    const help = element('details', 'calendar-help'); help.append(element('summary', '', 'Om kalenderen'))
    for (const selector of ['.calendar-legend', '.calendar-keyboard-help', '.calendar-note']) {
      const item = $(selector); if (item) help.append(item)
    }
    calendarPanel.append(help)
    $('.calendar-toolbar').addEventListener('click', () => queueMicrotask(updateCalendar))
    $('.calendar-mode button:last-child').click()
    const calculations = element('details', 'capacity-calculations')
    calculations.append(element('summary', '', 'Se kapasitetsberegningen'))
    $('#capacity-summary').before(calculations); calculations.append($('#capacity-summary'))
    calculations.append(element('p', 'muted', 'Beregningen gjelder registrerte studieøkter. Tid utenfor øktene kan også være tilgjengelig. Undervisning trekkes fra overlappende økter.'))
    const status = element('p', 'planning-status'); status.id = 'planning-status'; calculations.before(status)
    text($('#capacity-panel > .muted'), 'Sammenlign gjenstående arbeid med tiden du har satt av.')
    text($('#sessions-empty'), 'Ingen studieøkt planlagt ennå.')
    window.addEventListener('resize', updateMarkers, { passive: true })
    mobile.addEventListener('change', () => { closeMore(); updateMarkers() })
    document.fonts.ready.then(updateMarkers)
  }
  function updateCapacity() {
    for (const card of document.querySelectorAll('.task-card')) {
      const warning = card.querySelector('.capacity-warning')
      if (!warning) continue
      let details = card.querySelector('.capacity-explanation')
      if (!details) {
        details = element('details', 'capacity-explanation')
        details.append(element('summary', ''), element('p', 'capacity-context'))
        warning.before(details); details.append(warning)
      }
      const task = model.tasks?.find(item => item.id === card.dataset.taskId)
      const notice = task ? capacityNotice(task, model.sessions || [], model.planner?.events || [], model.now) : null
      details.hidden = !notice || (warning.hidden && !['danger', 'warning'].includes(notice.tone))
      if (notice) {
        details.dataset.tone = notice.tone; text(details.querySelector('summary'), notice.text)
        text(details.querySelector('.capacity-context'), notice.detail || 'Legg til studieøkter under Kapasitet for å se hvor mye arbeid du har satt av tid til.')
      }
    }
    text($('#planning-status'), model.sessions?.length ? 'Planlagte økter og gjenstående arbeid' : 'Ingen studieøkt planlagt ennå.')
  }
  return {
    update(nextModel) {
      model = nextModel; mount(); mountDialogs()
      text($('#page-heading'), { overview: 'Oversikt', week: 'Denne uken', all: 'Alle oppgaver', time: 'Finn en oppgave', capacity: 'Planlegg uken', subjects: 'Mine emner', calendar: 'Kalender', settings: 'Innstillinger' }[model.view] || 'Oversikt')
      updateMarkers(); updateCapacity(); updateCalendar()
      const suggestion = document.querySelector('.focus-results .primary-suggestion:not([hidden])')
      const identity = suggestion ? suggestion.dataset.taskId + '|' + model.minutes + '|' + suggestion.querySelector('.task-remaining')?.textContent : ''
      if (identity && identity !== previousSuggestion && !reducedMotion.matches) suggestion.animate([{ opacity: .35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' })
      previousSuggestion = identity
    },
  }
}
