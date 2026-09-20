import { emptyPlanner, validateCourse, validateEvent, mergeImport, mergeCourseOnly, resolveImportedCourse, osloLocal, osloYear, semesterLabel, teachingOverlap, matchesCourse, sourceHref } from './planner.js'
import { formatDeadline } from './calendar.js'
import { parseCalendar } from './calendar-import.js'
import { createImportWizard } from './import-wizard.js'
import { nextRefresh } from './calendar-sync.js'
import { sourceCoverage, disappearancePolicy, UNKNOWN_COVERAGE_WARNING } from './source-coverage.js'
import { createProgramImportView } from './program-import-view.js'
import { mountDocumentImport } from './document-import.js'
import { mountInstitutionalCalendar } from './institutional-calendar-view.js'
import { mountPublicTeaching } from './public-teaching-view.js'

const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node }
const sourceLink = (url, label) => { const href = sourceHref(url); if (!href) return el('span', `${label}: ${url}`); const node = el('a', label); node.href = href; node.target = '_blank'; node.rel = 'noreferrer'; return node }
const button = (text, action) => { const node = el('button', text); node.type = 'button'; node.addEventListener('click', action); return node }
const option = (value, label) => { const node = el('option', label); node.value = value; return node }
const stamp = value => formatDeadline(osloLocal(value), { year: true })
async function api(path, options) {
  const programmeRequest = /^\/api\/import\/providers\/[^/]+\/(?:programs|program-cohorts|program-plan)(?:\?|$)/.test(path)
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(new DOMException('Forespørselen tok for lang tid.', 'TimeoutError')), programmeRequest ? 180000 : 30000)
  const signal = options?.signal ? AbortSignal.any([options.signal, timeoutController.signal]) : timeoutController.signal
  try {
    let response
    try { response = await fetch(path, { ...options, signal }) } catch (error) {
      if (signal.aborted && signal.reason?.name === 'AbortError') throw signal.reason
      if (error.name === 'AbortError') throw error
      throw new Error('Kunne ikke kontakte importtjenesten. Prøv igjen, last opp en .ics-fil eller registrer emnet manuelt.')
    }
    let data
    try { data = await response.json(); signal.throwIfAborted() } catch (error) {
      if (signal.aborted && signal.reason?.name === 'AbortError') throw signal.reason
      if (error.name === 'AbortError') throw error
      throw new Error('Importtjenesten er ikke tilgjengelig. Start appen med npm run dev eller npm run preview. Filimport og manuell registrering fungerer fortsatt.')
    }
    if (!response.ok) throw new Error(data.error || 'Kilden kunne ikke hentes. Prøv filimport eller manuell registrering.')
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}
const calendarFetch = url => api('/api/import/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }).then(data => data.calendar)

export function createSubjectsView(actions) {
  let model, signature = '', agendaSignature = '', busy = false, editing = null, preview = null, returnEventView = null
  const existingNav = document.querySelector('#view-subjects')
  const nav = existingNav || button('Mine emner', () => actions.view('subjects'))
  if (!existingNav) {
    nav.id = 'view-subjects'
    nav.className = document.querySelector('#view-all').className
    nav.dataset.icon = 'book'
  } else {
    nav.onclick = () => actions.view('subjects')
  }
  if (!existingNav) document.querySelector('#view-capacity')?.after(nav)
  const host = el('section', null, 'panel subjects-panel'); host.id = 'subjects-panel'; host.hidden = true
  document.querySelector('#tasks-panel').after(host)
  host.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Emner og undervisning</p><h2>Mine emner</h2></div></div>
    <p class="muted">Opprett emner selv, eller hent emneinformasjon og kalender. Undervisningen vises i norsk tid.</p>
    <div class="subject-actions"><button type="button" id="course-new">Nytt emne</button><button type="button" id="event-new">Ny undervisning</button></div>
    <p id="subject-message" class="import-message" hidden></p>
    <form id="subject-editor" class="subject-editor" hidden></form>
    <section class="import-box" aria-labelledby="import-heading"><h3 id="import-heading">Importer emne og undervisning</h3>
      <form id="course-import-form" class="subject-fields">
        <label>Universitet<select name="university"><option value="ntnu">NTNU</option><option value="other">Annet universitet (fil, lenke eller manuelt)</option></select></label>
        <label>Emnekode<input name="code" placeholder="TDT4110" autocomplete="off"></label>
        <label>Semester<select name="semester"><option value="autumn">Høst</option><option value="spring">Vår</option></select></label>
        <label>År<input name="year" type="number" min="1900" max="2200" value="${osloYear()}" required></label>
        <button type="submit" id="ntnu-fetch">Hent emneinformasjon</button>
      </form>
      <p class="muted">NTNU: offentlig emneside og tilgjengelig TP-kalender. Personlige timeplaner kan kreve Feide. Velg riktige aktiviteter i TP før eksport. <a href="https://i.ntnu.no/timeplan" target="_blank" rel="noreferrer">NTNUs veiledning</a></p>
      <form id="calendar-import-form" class="subject-fields">
        <label>Emne for kalenderen<select name="courseId" required></select></label>
        <label>Kalenderfil (.ics, engangsimport)<input name="file" type="file" accept=".ics,text/calendar"></label>
        <button type="button" id="ics-preview">Forhåndsvis fil</button>
        <label class="wide-field">Kalenderlenke (HTTPS eller webcal)<input name="url" type="text" placeholder="https://…" autocomplete="off"></label>
        <button type="submit">Hent kalenderlenke</button>
      </form>
      <p class="muted">Lenker oppdateres ved oppstart og mens appen er åpen, tidligst hvert 30. minutt. Ved feil øker ventetiden til maksimalt 24 timer. Oppdatering pauses mens du redigerer. Filer er øyeblikksbilder; en lukket app oppdaterer ikke. Private lenker lagres bare lokalt.</p>
    </section><section id="import-preview" class="import-preview" hidden></section>
    <div id="course-list" class="course-list"></div><h3>Kalenderkilder</h3><div id="source-list"></div>
    <h3>Registrert undervisning</h3><div id="event-list" class="event-list"></div>`
  const query = selector => host.querySelector(selector), editor = query('#subject-editor'), importForm = query('#course-import-form'), calendarForm = query('#calendar-import-form'), previewHost = query('#import-preview')
  const subjectMessage = query('#subject-message')
  const feedback = (message, error = false) => {
    if (!editor.hidden) editor.append(subjectMessage)
    else query('.subject-actions').after(subjectMessage)
    subjectMessage.textContent = message; subjectMessage.hidden = !message
    subjectMessage.classList.toggle('is-error', error); subjectMessage.setAttribute('role', error ? 'alert' : 'status')
  }
  const state = () => actions.getState().planner || emptyPlanner()
  function persist(next, tasks) {
    if (!actions.save(next, tasks)) { feedback('Kunne ikke lagre. Nettleserlagringen kan være full eller blokkert. Opplysningene er ikke endret.', true); return false }
    signature = ''; return true
  }
  async function run(work) {
    if (busy) return
    busy = true; host.setAttribute('aria-busy', 'true'); feedback('Henter informasjon …')
    try { await work() } catch (error) { feedback(error.message, true) }
    finally { busy = false; host.removeAttribute('aria-busy') }
  }
  function field(name, label, value = '', type = 'text', choices) {
    const wrapper = el('label', label), input = el(choices ? 'select' : type === 'textarea' ? 'textarea' : 'input')
    if (input.tagName === 'INPUT') input.type = type
    input.name = name
    if (choices) for (const [key, text] of choices) input.append(option(key, text))
    input.value = value ?? ''; wrapper.append(input); editor.append(wrapper); return input
  }
  function openEditor(kind, previous) {
    if (busy || !model?.readable) return
    if (kind === 'event' && !state().courses.length) { feedback('Opprett et emne før du legger til undervisning.', true); return }
    editing = { kind, previous }; editor.replaceChildren(el('h3', `${previous ? 'Rediger' : 'Nytt'} ${kind === 'course' ? 'emne' : 'undervisning'}`)); editor.hidden = false
    if (kind === 'course') {
      field('name', 'Emnenavn', previous?.name).required = true
      field('code', 'Emnekode', previous?.code)
      field('university', 'Universitet', previous?.university)
      field('semester', 'Semester', previous?.semester || 'autumn', '', [['autumn', 'Høst'], ['spring', 'Vår']])
      field('year', 'År', previous?.year || osloYear(), 'number').required = true
      field('credits', 'Studiepoeng (valgfritt)', previous?.credits, 'number').step = 'any'
      field('description', 'Beskrivelse (valgfritt)', previous?.description, 'textarea')
    } else {
      field('title', 'Navn på undervisning', previous?.title).required = true
      field('courseId', 'Emne', previous?.courseId || state().courses[0]?.id, '', state().courses.map(c => [c.id, `${c.code} ${c.name}`])).required = true
      field('startLocal', 'Start (norsk tid)', previous ? osloLocal(previous.start) : '', 'datetime-local').required = true
      field('endLocal', 'Slutt (norsk tid)', previous ? osloLocal(previous.end) : '', 'datetime-local').required = true
      field('location', 'Sted (valgfritt)', previous?.location)
    }
    field('notes', 'Egne notater', previous?.notes, 'textarea')
    if (previous?.sourceUrl || previous?.sourceId) editor.append(el('p', 'Hentet fra ekstern kilde. Egne notater beholdes ved oppdatering.'))
    if (kind === 'course' && previous?.sourceUrl) editor.append(el('p', 'Endring av emnekode, universitet eller periode gjør kildebindingen utdatert. Hent og bekreft emneinformasjonen på nytt; eksisterende oppgaver og undervisningsdatoer flyttes ikke.'))
    const submit = el('button', kind === 'course' ? 'Lagre emne' : 'Lagre undervisning'); submit.type = 'submit'
    const editorActions = el('div', null, 'actions')
    editorActions.append(submit, button('Avbryt', () => { editor.hidden = true; editing = null; if (returnEventView) { const target = returnEventView; returnEventView = null; actions.view(target) } }))
    editor.append(editorActions)
    editor.querySelector('input')?.focus(); editor.scrollIntoView({ block: 'nearest' })
  }
  query('#course-new').onclick = () => openEditor('course')
  query('#event-new').onclick = () => openEditor('event')
  editor.addEventListener('submit', event => {
    event.preventDefault()
    if (!editing || busy) return
    try {
      const next = structuredClone(state()), draft = Object.fromEntries(new FormData(editor)), { kind, previous } = editing
      const item = kind === 'course' ? validateCourse(draft, previous) : validateEvent(draft, previous)
      const items = kind === 'course' ? next.courses : next.events, index = items.findIndex(c => c.id === item.id)
      if (index < 0) items.push(item); else items[index] = item
      if (persist(next)) { editing = null; editor.hidden = true; feedback(kind === 'course' ? 'Emnet er lagret.' : 'Undervisningen er lagret.'); if (returnEventView) { const target = returnEventView; returnEventView = null; actions.view(target) } else actions.refresh() }
    } catch (error) { feedback(error.message, true) }
  })
  const wizard = createImportWizard({
    form: importForm, previewHost, api, feedback, manual: () => openEditor('course'),
    onCourse(data) {
      data.course = resolveImportedCourse(state(), { ...data.course, ...(data.entryUrl ? { entryUrl: data.entryUrl } : {}) })
      preview = { course: data.course, warnings: data.warnings || [], parsed: null, source: null, calendarUrl: data.calendarUrl, entryUrl: data.entryUrl }
      showPreview(); feedback('Kontroller emne, semester og manglende opplysninger før import.')
    },
  })
  const importBox = query('.import-box'), methodShell = el('section', null, 'connected-import'), methods = el('div', null, 'import-methods')
  const launch = button('Importer emner og plan', () => { methods.hidden = !methods.hidden; launch.setAttribute('aria-expanded', String(!methods.hidden)); if (!methods.hidden) methods.querySelector('button')?.focus() }); launch.id = 'connected-import-open'; launch.setAttribute('aria-expanded', 'false'); methods.hidden = true
  query('.subject-actions').append(launch); importBox.before(methodShell)
  const institutionPanel = el('div', null, 'import-method-panel'), documentPanel = el('div', null, 'import-method-panel'), calendarPanel = el('div', null, 'import-method-panel')
  const calendarHelp = calendarForm.nextElementSibling
  const calendarFilePanel = el('details'); calendarFilePanel.name = 'calendar-import-method'; calendarFilePanel.open = true
  calendarFilePanel.append(el('summary', 'Kalenderfil eller kalenderlenke'), calendarForm); calendarPanel.append(calendarFilePanel)
  if (calendarHelp?.classList.contains('muted')) calendarFilePanel.append(calendarHelp)
  const institutionalCalendar=mountInstitutionalCalendar(calendarPanel,{getState:actions.getState,onCommit:candidate=>actions.commit(candidate,'Institusjonskalender importert'),api})
  const publicTeaching=mountPublicTeaching(calendarPanel,{getPlanner:state,api,onPreview:async(data,course,selected)=>{await prepareCalendar(data.calendar,course,{kind:'url',name:`${course.university} · ${selected.label}`,url:data.calendarUrl,groups:[]});preview.explicitSelection=true;preview.warnings.push(...(data.warnings||[]));showPreview()}})
  institutionPanel.append(importBox)
  methodShell.append(methods, institutionPanel, documentPanel, calendarPanel)
  for (const panel of [institutionPanel, documentPanel, calendarPanel]) panel.hidden = true
  let disposeDocument
  const choose = kind => {
    methods.hidden = false; launch.setAttribute('aria-expanded', 'true')
    institutionPanel.hidden = kind !== 'institution'; documentPanel.hidden = kind !== 'document'; calendarPanel.hidden = kind !== 'calendar'
    if (kind === 'document' && !disposeDocument) disposeDocument = mountDocumentImport(documentPanel, { getState: actions.getState, onCommit: candidate => actions.commit(candidate, 'Dokumentplan importert'), onCancel: () => { documentPanel.hidden = true; methods.querySelector('[data-method=document]')?.focus() } })
    else if (kind === 'document') disposeDocument.open?.()
  }
  for (const [kind, name] of [['institution', 'Fra lærested'], ['document', 'Fra dokument eller tekst'], ['calendar', 'Fra kalenderfil eller lenke']]) { const control = button(name, () => choose(kind)); control.dataset.method = kind; methods.append(control) }
  const programHost = el('div'); importBox.before(programHost)
  const programView = createProgramImportView({ host: programHost, getState: actions.getState, commitPlanner: next => actions.commit({ ...actions.getState(), planner: next }, 'Studieprogram importert'), feedback, manual: () => openEditor('course'), api })
  const courseDetails = el('details'); courseDetails.append(el('summary', 'Søk etter ett enkelt emne')); importBox.before(courseDetails); courseDetails.append(importBox)
  async function prepareCalendar(input, course, source) {
    const parsed = parseCalendar(input, { ...course, courseId: course.id })
    const sameCalendar = state().sources.find(s => s.courseId === course.id && parsed.events.length && state().events.filter(e => e.sourceId === s.id).length === parsed.events.length && parsed.events.every(event => state().events.some(e => e.sourceId === s.id && e.sourceKey === event.sourceKey)))
    const matched = state().sources.find(s => s.courseId === course.id && s.kind === source.kind && (source.kind === 'url' ? s.url === source.url : s.name === source.name))
    const id = source.id || matched?.id || sameCalendar?.id || crypto.randomUUID()
    const previous = state().sources.find(s => s.id === id)
    preview = { course, parsed, warnings: [...parsed.warnings], source: { ...previous, ...source, id, courseId: course.id, semester: course.semester, year: course.year, identityMode: parsed.identityMode, lastUpdated: new Date().toISOString(), lastSuccess: new Date().toISOString(), allGroups: [...new Set(parsed.events.map(e => e.group))], excludedKeys: previous?.excludedKeys || [], groups: previous?.groups || source.groups || [...new Set(parsed.events.filter(e => !/parallell|gruppe|labaktivitet/i.test(e.group) && !(e.groupMissing && /øving|oving|exercise|seminar|lab/i.test(e.group))).map(e => e.group))] } }
    Object.assign(preview.source, { pendingGroups: [], syncWarnings: [...parsed.warnings], allGroups: [...new Set([...(previous?.allGroups || []), ...preview.source.allGroups])] })
    preview.source.coverage = sourceCoverage(preview.source, course)
    if (preview.source.coverage.kind === 'unknown') preview.source.syncWarnings.push(UNKNOWN_COVERAGE_WARNING)
    showPreview(); feedback('Kalenderen er hentet. Velg aktiviteter og kontroller forhåndsvisningen.')
  }
  function selectedCourse() {
    const course = state().courses.find(c => c.id === calendarForm.elements.courseId.value)
    if (!course) throw new Error('Opprett eller importer et emne først, og velg det for kalenderen.')
    return course
  }
  query('#ics-preview').onclick = () => run(async () => {
    const file = calendarForm.elements.file.files[0], course = selectedCourse()
    if (!file || !/\.ics$/i.test(file.name)) throw new Error('Velg en .ics-kalenderfil.')
    if (file.size > 2_000_000) throw new Error('Kalenderfilen må være mindre enn 2 MB.')
    await prepareCalendar(await file.text(), course, { kind: 'file', name: file.name })
  })
  calendarForm.addEventListener('submit', event => { event.preventDefault(); run(async () => { const course = selectedCourse(), url = calendarForm.elements.url.value.trim().replace(/^webcal:/i, 'https:'); await prepareCalendar(await calendarFetch(url), course, { kind: 'url', name: 'Kalenderlenke', url }) }) })
  function showPreview() {
    previewHost.hidden = false; previewHost.replaceChildren(el('h3', 'Forhåndsvis import'))
    const { course, parsed, source } = preview
    const priorBinding = state().courses.find(item => item.id === course.id)?.sourceBindingStale
    if (priorBinding && !course.sourceBindingStale) previewHost.append(el('p', `Bekreft ny kildebinding for ${semesterLabel(course.semester, course.year)}. Tidligere kilde fra ${semesterLabel(priorBinding.semester, priorBinding.year)} beholdes i historikken. Oppgaver, undervisningsdatoer og kalenderkilder flyttes ikke.`, 'import-warning'))
    previewHost.append(el('h4', `${course.code} ${course.name}`), el('p', `${course.university} · ${semesterLabel(course.semester, course.year)} · ${course.credits == null ? 'Studiepoeng mangler' : `${course.credits} studiepoeng`}`))
    previewHost.append(el('p', `Campus: ${course.campus || 'Ikke oppgitt'}${course.sourceRecordId ? ` · Emnepost: ${course.sourceRecordId}` : ''}${course.sourceVersion ? ` · Bekreftet versjon: ${course.sourceVersion}` : ''}`))
    if (course.sourceUrl) previewHost.append(sourceLink(course.sourceUrl, 'Offisiell emnekilde'))
    if (preview.entryUrl) previewHost.append(sourceLink(preview.entryUrl, 'Åpne offisiell timeplan'), el('p', 'Dette er en timeplanside. Last ned en publisert kalenderfil eller finn en kalenderlenke der for separat import.'))
    if (source) previewHost.append(el('p', `Kalenderkilde: ${source.kind === 'file' ? `${source.name} (engangsimport)` : new URL(source.url).hostname} · ${source.kind === 'url' ? 'Oppdateres når appen er åpen; grupper velges her' : 'Last opp filen igjen for å oppdatere'}`))
    previewHost.append(el('p', course.description || 'Beskrivelse er ikke hentet. Du kan legge den til etter import.'))
    const sourceWarnings = [...new Set([...preview.warnings, ...(source && sourceCoverage(source, course).kind === 'unknown' ? [UNKNOWN_COVERAGE_WARNING] : [])])]
    if (parsed && sourceWarnings.length) {
      const details = el('details', null, 'source-details')
      details.append(el('summary', `Kildeopplysninger og mangler (${sourceWarnings.length})`))
      for (const warning of sourceWarnings) details.append(el('p', warning, 'import-warning'))
      previewHost.append(details)
    } else for (const warning of sourceWarnings) previewHost.append(el('p', warning, 'import-warning'))
    if (!parsed) {
      preview.baseline = JSON.stringify(state()); preview.merged = { planner: mergeCourseOnly(state(), course) }
      previewHost.append(el('p', 'Undervisningstidspunkter er ikke hentet. Emnet kan lagres uten timeplan.'))
      if (preview.calendarUrl) previewHost.append(button('Hent undervisning fra TP', () => run(async () => {
        const current = preview
        try { await prepareCalendar(await calendarFetch(current.calendarUrl), current.course, { kind: 'url', name: `${current.course.university} TP`, url: current.calendarUrl }) }
        catch (error) { feedback(`${error.message} Emneinformasjonen kan fortsatt lagres.`, true) }
      })))
      previewHost.append(button('Importer bare emnet', () => commitPreview()))
    } else {
      const groups = [...new Set([...source.groups, ...parsed.events.map(e => e.group)])].sort((a, b) => a.localeCompare(b, 'nb'))
      const choices = el('fieldset', null, 'activity-choices'); choices.append(el('legend', 'Velg aktiviteter, gruppe eller parallell'))
      const groupLabel = group => {
        const parts = group.split(',').map(value => value.trim()).filter(Boolean)
        const coursePart = parts.find(value => course.code && value.toLocaleUpperCase('nb').includes(course.code.toLocaleUpperCase('nb')))
        const namePart = parts.find(value => value !== coursePart && !/^\w+[_-]\d{4}/i.test(value))
        const concise = [coursePart || parts[0], namePart].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join(' · ')
        const value = concise || group
        return value.length > 72 ? `${value.slice(0,71).trimEnd()}…` : value
      }
      for (const group of groups) {
        const label = el('label'), check = el('input'); check.type = 'checkbox'; check.checked = source.groups.includes(group); check.value = group
        check.addEventListener('change', () => { source.groups = [...choices.querySelectorAll('input:checked')].map(e => e.value); renderEvents() })
        const text = el('span', `${groupLabel(group)} (${parsed.events.filter(e => e.group === group).length})`); text.title = group
        label.append(check, text); choices.append(label)
      }
      if(preview.explicitSelection){const details=el('details'),summary=el('summary'),counter=()=>{summary.textContent=`Aktivitetsutvalg · ${source.groups.length} av ${groups.length} valgt`};counter();details.append(summary,choices);choices.classList.add('teaching-choice-list');choices.tabIndex=0;choices.addEventListener('change',counter);const all=button('Velg alle aktiviteter i dette timeplanvalget',()=>chooseAll(true)),none=button('Velg ingen aktiviteter',()=>chooseAll(false));function chooseAll(selected){for(const check of choices.querySelectorAll('input'))check.checked=selected;source.groups=selected?[...groups]:[];if(selected)source.excludedKeys=[];counter();renderEvents()}previewHost.append(all,none,details)}else previewHost.append(choices)
      const detail = el('div'); previewHost.append(detail)
      const renderEvents = () => {
        const selected = parsed.events.filter(e => source.groups.includes(e.group) && !(source.excludedKeys || []).includes(e.sourceKey))
        const policy = disappearancePolicy(source, course, parsed)
        preview.baseline = JSON.stringify(state())
        const merged = mergeImport(state(), parsed.events, source, { course, ...policy, selection: { groups: source.groups, excludedKeys: source.excludedKeys || [] } })
        preview.merged = merged
        const c = merged.counts
        detail.replaceChildren(el('p', `${selected.length} valgte økter: ${c.added} nye, ${c.updated} endret, ${c.cancelled} fjernet/avlyst, ${c.excluded} skjult lokalt, ${c.reselected} valgt igjen, ${c.conflicts} konflikter.`))
        if (!selected.length) detail.append(el('p', parsed.events.length ? 'Ingen aktiviteter valgt. Tidligere importerte aktiviteter som er valgt bort skjules lokalt. Notater og slettemarkeringer beholdes.' : 'Ingen undervisning funnet i valgt semester. Emnet kan fortsatt lagres.'))
        const list = el('ul', null, 'preview-events')
        for (const event of parsed.events.filter(e => source.groups.includes(e.group))) {
          const row = el('li'), label = el('label'), check = el('input'); check.type = 'checkbox'; check.checked = !source.excludedKeys.includes(event.sourceKey)
          check.setAttribute('aria-label', `Ta med ${event.title} ${stamp(event.start)} ${event.location || ''}`)
          check.onchange = () => { source.excludedKeys = check.checked ? source.excludedKeys.filter(key => key !== event.sourceKey) : [...source.excludedKeys, event.sourceKey]; renderEvents() }
          label.append(check, document.createTextNode(`${stamp(event.start)}–${stamp(event.end)} · ${event.title} · ${event.location || 'Sted mangler'}${event.information || event.transparent ? ' · Informasjon, reserverer ikke tid' : ''}`)); row.append(label); list.append(row)
        }
        detail.append(list)
      }
      renderEvents()
      previewHost.append(button('Bekreft import', () => commitPreview()))
    }
    const cancel = button('Avbryt import', () => { preview = null; wizard.committed(); publicTeaching.committed(); previewHost.hidden = true; feedback('') }); cancel.className = 'secondary'; previewHost.append(cancel)
    previewHost.scrollIntoView({ block: 'nearest' })
  }
  function commitPreview() {
    if (!preview || busy) return
    if (preview.baseline !== JSON.stringify(state())) { feedback('Dataene er endret etter forhåndsvisningen. Hent en ny forhåndsvisning før du lagrer.', true); return }
    const { planner: next, counts } = preview.merged
    if (persist(next)) { preview = null; wizard.committed(); publicTeaching.committed(); previewHost.hidden = true; feedback(counts ? `Importert: ${counts.added} nye, ${counts.updated} endrede, ${counts.cancelled} avlyste, ${counts.excluded} skjult lokalt, ${counts.reselected} valgt igjen. ${counts.conflicts} konflikter. Egne notater er beholdt.` : 'Emnet er lagret. Du kan legge til undervisning senere.'); actions.refresh() }
  }
  const filterLabel = el('label', 'Filtrer kalender på emne', 'calendar-course-filter'), courseFilter = el('select'); courseFilter.id = 'calendar-course-filter'; filterLabel.append(courseFilter)
  document.querySelector('#calendar-host').before(filterLabel)
  courseFilter.addEventListener('change', () => { agendaSignature = ''; actions.courseFilter(courseFilter.value); actions.refresh() })
  const agenda = el('section', null, 'teaching-agenda'); agenda.id = 'teaching-agenda'; document.querySelector('#calendar-host').after(agenda)
  const reminders = el('div', null, 'delivery-reminders'); reminders.id = 'delivery-reminders'; document.querySelector('.focus-results').prepend(reminders)
  const overlap = el('div', null, 'teaching-overlap'); overlap.id = 'teaching-overlap'; document.querySelector('#time-form').after(overlap)
  document.querySelector('#time-form').addEventListener('submit', () => {
    if (model?.minuteError) return
    const list = model?.view === 'time' ? document.querySelector('#task-list') : document.querySelector('#dashboard-suggestions')
    const target = list?.querySelector('li:not([hidden])') || document.querySelector(model?.view === 'time' ? '#empty-tasks' : '#suggestion-empty')
    if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest', behavior: 'instant' }) }
  })
  function render(modelValue) {
    model = modelValue
    const planner = model.planner || emptyPlanner(), subjects = model.view === 'subjects'
    host.hidden = !subjects || !model.readable; nav.setAttribute('aria-pressed', String(subjects))
    if (subjects) { document.querySelector('#tasks-panel').hidden = true; document.querySelector('#focus-panel').hidden = true }
    const documentSources = actions.getState().importSources || []
    const nextSignature = JSON.stringify([planner, documentSources, model.readable])
    if (nextSignature !== signature) {
      signature = nextSignature
      const selected = calendarForm.elements.courseId.value, filter = courseFilter.value
      publicTeaching.render()
      calendarForm.elements.courseId.replaceChildren(option('', 'Velg emne'))
      courseFilter.replaceChildren(option('', 'Alle emner'))
      for (const course of planner.courses) {
        calendarForm.elements.courseId.append(option(course.id, `${course.code} ${course.name} · ${semesterLabel(course.semester, course.year)}`))
        courseFilter.append(option(course.id, `${course.code} ${course.name}`))
      }
      calendarForm.elements.courseId.value = planner.courses.some(c => c.id === selected) ? selected : planner.courses[0]?.id || ''
      courseFilter.value = filter
      if (filter && !planner.courses.some(c => c.id === filter)) actions.courseFilter('')
      const courses = query('#course-list'); courses.replaceChildren()
      if (!planner.courses.length) courses.append(el('p', 'Ingen emner ennå. Velg «Nytt emne» eller hent emneinformasjon.'))
      for (const course of planner.courses) {
        const card = el('article', null, 'course-card'); card.dataset.courseId = course.id
        card.append(el('h3', `${course.code} ${course.name}`), el('p', `${course.university || 'Universitet ikke oppgitt'} · ${semesterLabel(course.semester, course.year)} · ${course.credits == null ? 'Studiepoeng ukjent' : `${course.credits} studiepoeng`}`), el('p', course.sourceUrl ? 'Importert emne' : 'Manuelt emne', 'source-badge'))
        if (course.sourceRecordId || course.campus) card.append(el('p', `Campus: ${course.campus || 'Ikke oppgitt'}${course.sourceRecordId ? ` · Emnepost: ${course.sourceRecordId}` : ''}${course.sourceVersion ? ` · ${course.sourceVersion}` : ''}`))
        if (course.programBinding) {
          const binding = course.programBinding
          card.append(el('p', `${binding.programName || binding.programCode} · Kull ${binding.cohort} · Studiesemester ${binding.studySemester} · ${semesterLabel(binding.calendarSemester, binding.calendarYear)}${binding.modelName ? ` · ${binding.modelName}` : ''}${binding.campus ? ` · ${binding.campus}` : ''} · ${binding.choice === 'O' ? 'Obligatorisk' : binding.choice === 'V' ? 'Valgfritt' : 'Valg må avklares'}`, 'program-provenance'))
          if (binding.sourceNotes) card.append(el('p', binding.sourceNotes, 'import-warning'))
          if (binding.sourceUrl) card.append(sourceLink(binding.sourceUrl, 'Studieplanens kilde'))
        }
        if (course.sourceBindingStale) card.append(el('p', `Kildebindingen er utdatert. Kildeopplysningene gjelder ${semesterLabel(course.sourceBindingStale.semester, course.sourceBindingStale.year)}, ikke den manuelt valgte perioden. Hent emnet på nytt og bekreft forhåndsvisningen. Tidligere kildeopplysninger beholdes.`, 'import-warning source-binding-warning'))
        for (const [url, label] of [[course.sourceUrl, 'Offisiell emnekilde'], [course.entryUrl, 'Offisiell timeplan']]) if (url) card.append(sourceLink(url, label))
        if (course.description) { const details = el('details'); details.append(el('summary', 'Emnebeskrivelse'), el('p', course.description)); card.append(details) }
        if (course.notes) card.append(el('p', course.notes))
        if (course.conflict) card.append(el('p', course.conflict, 'import-warning'))
        card.append(button(`Ny oppgave i ${course.code || course.name}`, () => actions.openTask(course.id)))
        card.append(button(`Rediger emne ${course.code || course.name}`, () => openEditor('course', course)), button(`Slett emne ${course.code || course.name}`, () => {
          if (!confirm('Slette emnet? Tilknyttet undervisning og kalenderkilder slettes. Oppgavene og deres emnetekst beholdes.')) return
          const next = structuredClone(state()); next.courses = next.courses.filter(c => c.id !== course.id); next.events = next.events.filter(e => e.courseId !== course.id); next.sources = next.sources.filter(s => s.courseId !== course.id)
          const tasks = actions.getState().tasks.map(task => { if (task.courseId !== course.id) return task; const copy = { ...task }; delete copy.courseId; return copy })
          if (persist(next, tasks)) { feedback('Emnet er slettet. Oppgavene er beholdt.'); actions.refresh() }
        })); courses.append(card)
      }
      const sources = query('#source-list'); sources.replaceChildren()
      if (!planner.sources.length && !documentSources.length) sources.append(el('p', 'Ingen kalenderkilder er lagret.'))
      for (const source of documentSources) {
        const card = el('article', null, 'source-card document-source-card'); card.dataset.sourceId = source.id
        card.append(el('h4', source.name), el('p', `Dokumentkilde · revisjon ${source.revision} · Sist oppdatert: ${stamp(source.lastUpdated)}`))
        if (source.complete === false) card.append(el('p', 'Kilden er ikke bekreftet fullstendig. Bare oppføringene du bekreftet, er lagret.', 'import-warning'))
        for (const warning of source.warnings || []) card.append(el('p', warning, 'import-warning'))
        card.append(button('Oppdater dokumentkilde', () => { choose('document'); disposeDocument?.selectSource?.(source.id) }))
        sources.append(card)
      }
      for (const source of planner.sources) {
        const card = el('article', null, 'source-card'), course = planner.courses.find(c => c.id === source.courseId)
        card.append(el('h4', `${course?.code || course?.name || ''} · ${source.name}`), el('p', `${source.kind === 'file' ? 'Engangsimport fra fil' : 'Lagret kalenderlenke'} · Sist oppdatert: ${stamp(source.lastUpdated)}`))
        if (source.kind === 'url') {
          card.append(el('p', source.reconnectRequired ? 'Kilden må kobles til igjen med kalenderlenken.' : `Siste vellykkede henting: ${stamp(source.lastSuccess || source.lastUpdated)}. Tidligst neste forsøk: ${stamp(new Date(nextRefresh(source)).toISOString())}.`))
          if (source.lastError) card.append(el('p', `Siste feil: ${source.lastError}. Tidligere undervisning er beholdt.`, 'import-warning'))
          for (const warning of source.syncWarnings || []) card.append(el('p', warning, 'import-warning'))
          if (source.url && !source.reconnectRequired) card.append(button('Oppdater nå', () => run(async () => { await prepareCalendar(await calendarFetch(source.url), course, source) })))
          const label = el('label', 'Automatisk oppdatering mens appen er åpen'), toggle = el('input'); toggle.type = 'checkbox'; toggle.checked = source.autoRefresh !== false && !source.reconnectRequired; toggle.disabled = Boolean(source.reconnectRequired)
          toggle.onchange = () => { const next = structuredClone(state()); next.sources.find(s => s.id === source.id).autoRefresh = toggle.checked; if (persist(next)) actions.refresh() }; label.prepend(toggle); card.append(label)
          const reconnect = el('details'); reconnect.append(el('summary', 'Koble til igjen / endre kalenderlenke'))
          const urlLabel = el('label', 'Ny HTTPS-kalenderlenke'), input = el('input'); input.type = 'url'; urlLabel.append(input); reconnect.append(urlLabel)
          reconnect.append(button('Lagre tilkobling', () => {
            try { const url = new URL(input.value.trim().replace(/^webcal:/i, 'https:')); if (url.protocol !== 'https:' || url.username || url.password) throw Error('Bruk HTTPS uten brukernavn og passord.')
              const next = structuredClone(state()), item = next.sources.find(s => s.id === source.id); Object.assign(item, { url: url.href, reconnectRequired: false, autoRefresh: true, lastError: '', failures: 0 })
              if (persist(next)) actions.refresh()
            } catch (error) { feedback(error.message, true) }
          })); card.append(reconnect)
        }
        sources.append(card)
      }
      const eventList = query('#event-list'); eventList.replaceChildren()
      for (const event of [...planner.events].filter(e => !e.deleted).sort((a, b) => a.start.localeCompare(b.start))) {
        const card = el('article', null, 'event-card'); card.dataset.eventId = event.id
        card.append(el('h4', event.title), el('p', `${stamp(event.start)}–${stamp(event.end)} · ${event.location || 'Sted ikke oppgitt'}`), el('p', `${event.sourceId ? 'Importert' : 'Manuell'}${event.excluded ? ' · Skjult etter aktivitetsvalg' : event.cancelled ? ' · Avlyst/fjernet i kilden' : ''}`, 'source-badge'))
        if (event.notes) card.append(el('p', event.notes))
        if (event.conflict) {
          card.append(el('p', event.conflict.message, 'import-warning'))
          card.append(button('Bruk kildeverdiene', () => { const next = structuredClone(state()), item = next.events.find(e => e.id === event.id); Object.assign(item, item.conflict.incoming); delete item.conflict; if (persist(next)) actions.refresh() }), button('Behold mine verdier', () => { const next = structuredClone(state()), item = next.events.find(e => e.id === event.id); delete item.conflict; if (persist(next)) actions.refresh() }))
        }
        card.append(button(`Rediger undervisning ${event.title}`, () => openEditor('event', event)), button(`Slett undervisning ${event.title}`, () => {
          if (!confirm('Slette denne undervisningen?')) return
          const next = structuredClone(state()); if (event.sourceId) next.events.find(e => e.id === event.id).deleted = true; else next.events = next.events.filter(e => e.id !== event.id)
          if (persist(next)) actions.refresh()
        })); eventList.append(card)
      }
      if (!eventList.childElementCount) eventList.append(el('p', 'Ingen undervisning registrert. Legg til manuelt eller importer en kalender.'))
    }
    const now = model.now || new Date(), nextAgenda = JSON.stringify([planner, model.tasks, courseFilter.value, osloLocal(now.toISOString()).slice(0, 10)])
    if (nextAgenda !== agendaSignature) {
      agendaSignature = nextAgenda; agenda.replaceChildren(el('h3', 'Undervisning og frister'), el('p', 'U: undervisning · F: oppgavefrist. Undervisning vises i norsk tid.', 'muted'))
      const course = planner.courses.find(c => c.id === courseFilter.value)
      const entries = planner.events.filter(e => !e.cancelled && !e.deleted && Date.parse(e.end) >= +now && (!course || e.courseId === course.id)).map(e => ({ time: e.start, title: `U · ${e.title}`, detail: `${stamp(e.start)}–${stamp(e.end)} · ${e.location || 'Sted mangler'}`, open: () => { actions.view('subjects'); openEditor('event', e) }, kind: 'teaching' }))
      for (const task of model.tasks.filter(t => t.deadlineLocal && (!t.completed || (t.requiresSubmission && !t.submitted)) && matchesCourse(t, course?.id, course))) {
        const time = new Date(task.deadlineLocal).toISOString()
        if (Date.parse(time) >= +now) entries.push({ time, title: `F · ${task.title}`, detail: `${formatDeadline(task.deadlineLocal, { year: true })} · ${task.course}`, open: () => actions.editTask(task.id), kind: 'deadline' })
      }
      entries.sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title, 'nb'))
      if (!entries.length) agenda.append(el('p', 'Ingen kommende undervisning eller frister for dette emnevalget.'))
      const list = el('ul'); for (const entry of entries.slice(0, 100)) { const li = el('li', null, `agenda-${entry.kind}`); li.append(button(entry.title, entry.open), el('p', entry.detail)); list.append(li) } agenda.append(list)
      if (entries.length > 100) agenda.append(el('p', 'Viser de neste 100 oppføringene. All undervisning finnes under Mine emner.'))
    }
    const ready = model.tasks.filter(t => t.requiresSubmission && t.completed && !t.submitted)
    const reminderSignature = JSON.stringify(ready.map(t => [t.id, t.title, t.course]))
    if (reminders.dataset.signature !== reminderSignature) { reminders.dataset.signature = reminderSignature; reminders.replaceChildren(); if (ready.length) { reminders.append(el('h3', 'Husk å levere')); for (const task of ready) reminders.append(button(`${task.title} · ${task.course} · Klar til levering`, () => actions.editTask(task.id))) } }
    reminders.hidden = !ready.length
    const conflict = teachingOverlap(planner.events, now, model.minutes)
    const overlapSignature = JSON.stringify([conflict.events.map(e => e.id), conflict.availableMinutes, model.minuteError])
    if (overlap.dataset.signature !== overlapSignature) {
      overlap.dataset.signature = overlapSignature; overlap.replaceChildren(); overlap.hidden = !conflict.events.length || !!model.minuteError
      if (!overlap.hidden) { overlap.append(el('p', `Tiden overlapper registrert undervisning: ${conflict.events[0].title} (${stamp(conflict.events[0].start)}–${stamp(conflict.events[0].end)}).`)); if (conflict.availableMinutes > 0) overlap.append(button(`Tilpass til ${conflict.availableMinutes} minutter`, () => actions.minutes(conflict.availableMinutes))); else overlap.append(el('p', 'Undervisning pågår nå. Velg et annet tidspunkt for arbeidet.')) }
    }
  }
  return { render, isEditing: () => Boolean(editing), hasDraft: () => busy || Boolean(editing) || Boolean(preview) || wizard.hasDraft() || institutionalCalendar.hasDraft() || publicTeaching.hasDraft() || programView.hasDraft() || Boolean(disposeDocument?.hasDraft?.()), openEvent(id) { const event = state().events.find(e => e.id === id); if (event) { returnEventView = model?.view === 'calendar' ? 'calendar' : null; actions.view('subjects'); openEditor('event', event) } } }
}
