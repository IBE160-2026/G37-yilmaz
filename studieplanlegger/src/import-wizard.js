import { institutions, institutionById, INVENTORY_SOURCE } from './institutions.js'
const el = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node }
const button = (text, action) => { const node = el('button', text); node.type = 'button'; node.className = 'secondary'; node.onclick = action; return node }
export function createImportWizard({ form, previewHost, api, onCourse, feedback, manual }) {
  let busy = false, results = [], selected = null, step = 1, selectionVersion = 0
  const host = el('section'); host.className = 'import-wizard'; form.before(host)
  const progress = el('p'), resultsHost = el('div'); resultsHost.className = 'wizard-results'
  const info = el('p'), controls = el('div'); controls.className = 'actions'
  host.append(progress, info); form.after(resultsHost, controls)
  const university = form.elements.university; university.replaceChildren()
  for (const item of institutions) university.append(new Option(item.name, item.id))
  university.value = 'ntnu'
  const campus = el('label', 'Campus (valgfritt)'), campusInput = el('input'); campusInput.name = 'campus'; campusInput.placeholder = 'For eksempel Trondheim eller Bergen'; campus.append(campusInput); form.querySelector('button').before(campus)
  form.elements.code.setAttribute('placeholder', 'Emnekode eller navn')
  form.querySelector('button').textContent = 'Søk emner'
  const more = el('a', 'Institusjonsoversikt fra NOKUT'); more.href = INVENTORY_SOURCE; more.target = '_blank'; more.rel = 'noreferrer'; host.append(more)
  const context = el('p'); context.className = 'wizard-context'; host.append(context)
  const catalogHelp = controls.nextElementSibling
  if (catalogHelp?.classList.contains('muted')) catalogHelp.hidden = true
  function render() {
    progress.textContent = `Steg ${step} av 4: ${['Institusjon', 'Søk, semester og campus', 'Velg emne eller gruppe', 'Forhåndsvis og importer'][step - 1]}`
    const provider = institutionById(university.value), capability = provider.capabilities
    info.textContent = capability.publicTimetable === 'official-entry-only' ? 'Offentlig søk etter emneinformasjon. Semester og campus kontrolleres ved forhåndsvisning. Timeplanlenken er en offisiell inngang, ikke en kalenderfil. Undervisning kan importeres separat fra fil eller kalenderlenke.' : capability.courseSearch !== 'not-verified' ? 'Offentlig emnesøk er implementert. Se kilde og eventuelle mangler før bekreftelse. Personlig tilhørighet og grupper må velges av deg.' : `Direkte emnesøk er ikke implementert. ${provider.datatypes.courseInformation.scope} ${capability.programImport==='implemented-public'?'Programimport er tilgjengelig over. ':''}Dokument, kalender og manuell registrering er tilgjengelig.`
    for (const field of ['university', 'code', 'semester', 'year', 'campus']) form.elements[field].closest('label').hidden = field === 'university' ? step !== 1 : step !== 2
    campusInput.disabled = university.value === 'uib'; campus.hidden ||= campusInput.disabled
    form.querySelector('button[type=submit]').hidden = step !== 2
    form.hidden = step > 2
    resultsHost.hidden = step !== 3
    context.hidden = step === 1
    context.textContent = `${university.selectedOptions[0].textContent} · ${form.elements.semester.selectedOptions[0].textContent} ${form.elements.year.value}${form.elements.campus.value ? ` · Campus: ${form.elements.campus.value}` : ''}${selected ? ` · ${selected.code}` : ''}`
    controls.replaceChildren()
    if (step > 1) controls.append(button('Tilbake', () => { step--; previewHost.hidden = true; resultsHost.hidden = step < 3; render() }))
    if (step === 1) controls.append(button('Neste: søk og semester', () => { step = 2; render(); form.elements.code.focus() }))
    if (step === 3 && selected) controls.append(button('Vis valgt forhåndsvisning', () => choose(selected)))
    controls.append(button('Registrer manuelt', manual))
  }
  form.addEventListener('input', () => { selectionVersion++; results = []; selected = null; resultsHost.replaceChildren(); previewHost.hidden = true; render() })
  university.addEventListener('change', render)
  async function choose(item) {
    if (busy) return; busy = true; const version = selectionVersion
    try {
      let data
      if (university.value === 'hvl') data = { course: { ...item, id: `hvl:${item.sourceObjectId}:${item.year}:${item.semester}`, name: item.label, credits: null, notes: '', description: '' }, warnings: ['Navnet er en TimeEdit-etikett. Studiepoeng og emnebeskrivelse mangler. Ingen økter er hentet ennå.'], entryUrl: item.entryUrl }
      else {
        try { data = await api(`/api/import/providers/${university.value}/details?${new URLSearchParams({ code: item.code, semester: item.semester, year: item.year, ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}), ...(item.sourceRecordId ? { sourceRecordId: item.sourceRecordId } : {}), ...(item.campus ? { campus: item.campus } : {}) })}`) }
        catch (error) { if (university.value !== 'nmbu') throw error; data = { status: 'transport-error', error: error.message } }
        if (university.value === 'nmbu' && data.status !== 'ok') data = { status: 'ok', course: { ...item, id: `nmbu:${item.sourceObjectId}:${item.year}:${item.semester}`, name: item.label, credits: null, notes: '', description: '' }, calendarUrl: null, entryUrl: item.entryUrl, warnings: [`TimeEdit-valget er beholdt. Emnedetaljer for valgt semester kunne ikke bekreftes (${data.status}). Studiepoeng, campus og beskrivelse må kontrolleres manuelt.`, data.error || ''] }
      }
      if (version !== selectionVersion) return
      if (data.status && data.status !== 'ok') throw new Error(`${data.status}: ${data.error}`)
      if (['uib', 'uit'].includes(university.value) && (data.course.code !== item.code || data.course.year !== Number(item.year) || data.course.semester !== item.semester || data.course.sourceRecordId !== item.sourceRecordId || data.course.sourceProvider !== university.value)) throw new Error('Emneposten eller semesteret avviker fra det valgte treffet. Søk på nytt.')
      if (item.campus && (item.campusVerified || item.university === 'NTNU')) {
        if (data.course.campus && data.course.campus.trim().toLocaleLowerCase('nb-NO') !== item.campus.trim().toLocaleLowerCase('nb-NO')) throw new Error('Emnedetaljene oppgir en annen campus enn det valgte treffet. Kontroller campus før import.')
        data.course = { ...data.course, campus: item.campus, campusVerified: true }
      }
      onCourse(data); selected = item; step = 4; resultsHost.hidden = true; render()
    } catch (error) { feedback(error.message, true) } finally { busy = false }
  }
  form.onsubmit = async event => {
    event.preventDefault(); if (busy || step !== 2) return; busy = true; const version = selectionVersion; feedback('Søker i offentlig kilde ...')
    try {
      const query = Object.fromEntries(new FormData(form)); query.q = query.code
      const data = await api(`/api/import/providers/${university.value}/search?${new URLSearchParams(query)}`)
      if (version !== selectionVersion) return
      if (data.status !== 'ok') throw new Error(`${{ 'not-found': 'Ingen emner funnet', 'no-matching-results': 'Ingen treff med valgte filtre', 'semester-unavailable': 'Semesteret er ikke tilgjengelig', 'access-required': 'Krever tilgang', 'schema-verification-required': 'Krever autentisert skjemakontroll', 'transport-error': 'Kilden kunne ikke nås' }[data.status] || data.status}. ${data.error || 'Prøv et annet søk.'}`)
      results = data.results; step = 3; resultsHost.replaceChildren(); resultsHost.hidden = false
      for (const item of results) resultsHost.append(button(`${item.code} · ${item.name} · ${item.campus || 'Campus mangler'}`, () => choose(item)))
      for (const warning of data.warnings || []) resultsHost.append(el('p', warning))
      feedback(`${results.length} treff. Velg riktig semester-/campusvariant.`); render()
    } catch (error) { feedback(error.message, true) } finally { busy = false }
  }
  render()
  return { isBusy: () => busy, hasDraft: () => busy || step > 1 || Boolean(selected), committed() { selected = null; results = []; resultsHost.replaceChildren(); step = 1; render() } }
}
