import { osloLocalExact as osloLocal, toInstant } from './planner.js'
import { resolveDocumentCourses, retryDocumentCourseNames } from './document-course-resolution.js'
import { invalidateDocumentCourseName } from './document-course-identity.js'
import { DOCUMENT_LIMITS } from './document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, refreshDocumentConflicts, changeDocumentRowKind, refreshDocumentImportPreview, documentSourceChanged, addDocumentCourseDraft, chooseDocumentCourse, chooseDocumentTime, chooseDocumentSelection } from './import-preview.js'
import { estimateChoiceRange } from './tasks.js'
import { isExamEvent } from './event-kind.js'
import { institutions } from './institutions.js'
import { documentInstitution } from './document-course-identity.js'
import { validDocumentOrigin } from './import-source-contract.js'
import { nameFirstLabel, visibleName } from './name-sort.js'
import { calendarInstantLabel } from './calendar-model.js'
import './document-import.css'

export { createDocumentImportPreview, buildDocumentImportCommit } from './import-preview.js'
const formats = { txt: 'text', text: 'text', pdf: 'pdf', docx: 'docx', csv: 'csv', ics: 'ics' }
export async function parseDocumentInput(input, { fileName = input?.name || 'Innlimt studieplan', format, semester, year, encoding, columns, signal, onProgress = () => {}, workerFactory = () => new Worker(new URL('./document-parser.worker.js', import.meta.url), { type: 'module' }) } = {}) {
  if (signal?.aborted) throw new DOMException('Importen ble avbrutt.', 'AbortError')
  format ||= typeof input === 'string' ? /^\s*BEGIN:VCALENDAR/im.test(input) ? 'ics' : 'text' : formats[fileName.split('.').at(-1).toLowerCase()]
  if (!formats[format] && !['text', 'pdf', 'docx', 'csv', 'ics'].includes(format)) throw new Error('Velg en tekst-, PDF-, DOCX-, CSV- eller ICS-fil.')
  const limit = ['pdf', 'docx'].includes(format) ? DOCUMENT_LIMITS.binaryBytes : DOCUMENT_LIMITS.textBytes
  if ((input?.size ?? input?.byteLength ?? 0) > limit) throw new Error('Filen er for stor (PDF/DOCX maks 10 MB, tekst/CSV/ICS maks 2 MB).')
  const buffer = typeof input === 'string' ? new TextEncoder().encode(input).buffer : input instanceof ArrayBuffer ? input.slice(0) : await input.arrayBuffer()
  if (buffer.byteLength > limit) throw new Error('Filen er for stor (PDF/DOCX maks 10 MB, tekst/CSV/ICS maks 2 MB).')
  const contentHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(value => value.toString(16).padStart(2, '0')).join('')
  if (signal?.aborted) throw new DOMException('Importen ble avbrutt.', 'AbortError')
  return new Promise((resolve, reject) => {
    let worker, settled = false
    try { worker = workerFactory() } catch { reject(new Error('Nettleseren kunne ikke starte lokal dokumentlesing. Prøv å laste siden på nytt eller registrer planen manuelt.')); return }
    const finish = (error, parsed) => { if (settled) return; settled = true; clearTimeout(timeout); signal?.removeEventListener('abort', abort); worker.onmessage = null; worker.onerror = null; worker.terminate(); error ? reject(error) : resolve({ ...parsed, contentHash, fileName }) }
    const abort = () => finish(new DOMException('Importen ble avbrutt. Ingen data er lagret.', 'AbortError'))
    const timeout = setTimeout(() => finish(new Error('Dokumentlesingen tok over 30 sekunder og er stoppet. Del dokumentet, lim inn teksten eller registrer planen manuelt.')), DOCUMENT_LIMITS.milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }) => { if (data?.documentImport !== true) return; data.progress ? onProgress(data.progress) : finish(data.ok ? null : Object.assign(new Error(data.error || 'Dokumentet kunne ikke leses.'), { clarification: data.clarification }), data.parsed) }
    worker.onerror = () => finish(new Error('Dokumentet kunne ikke leses lokalt. Prøv tekst eller et enklere dokument; ingen data er lagret.'))
    worker.postMessage({ buffer, options: { format, semester, year, encoding, columns } }, [buffer])
  })
}

const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node }
function select(options, value, onChange) {
  const input = el('select')
  for (const [key, label] of options) { const option = el('option', label); option.value = key; input.append(option) }
  input.value = value ?? ''; input.addEventListener('change', () => onChange(input.value)); return input
}
function field(parent, label, value, onChange, type = 'text', nativeEditor) {
  const wrapper = el('label', label), input = nativeEditor || el(type === 'textarea' ? 'textarea' : 'input')
  if (!nativeEditor) { if (type !== 'textarea') input.type = type; else input.rows = 4; input.value = value ?? '' }
  // An unfinished native number is not represented by .value. Move its actual
  // editor, but replace the handler so refresh edits the current draft row.
  input.oninput = () => onChange(input.value)
  wrapper.append(input); parent.append(wrapper); return input
}
function choice(parent, label, options, value, onChange) {
  const wrapper = el('div'), caption = el('label', label), input = select(options, value, onChange)
  input.id = `document-choice-${crypto.randomUUID()}`; caption.htmlFor = input.id
  wrapper.append(caption, input); parent.append(wrapper); return input
}
const typeNames = { course: 'Emne', task: 'Oppgave / frist', event: 'Fast undervisning / aktivitet' }
const courseGroupKey = row => JSON.stringify([row.courseHint || '', Number(row.year) || '', row.semester || '', documentInstitution(row.university), row.sourceObjectId || '', row.campus || '', row.campusCode || ''])
const courseGroupLabel = row => [row.courseHint || 'Uten emne', row.university, row.semester === 'spring' ? 'Vår' : row.semester === 'autumn' ? 'Høst' : '', row.year, row.campus ? `Campus: ${row.campus}` : ''].filter(Boolean).join(' · ')
const courseSourceContext = row => [row.sourceObjectId ? `Kildevalg: ${row.sourceObjectId}` : '', row.campusCode ? `Campuskode: ${row.campusCode}` : ''].filter(Boolean).join(' · ')
const rowIdentity = row => row.key || String(row.index)
const editorKey = (row, field) => JSON.stringify([row, field])
const unfinishedEditors = root => new Map([...root.querySelectorAll('.document-preview-row input[data-field]')].filter(input => input.validity.badInput).map(input => [editorKey(input.closest('[data-row-key]').dataset.rowKey, input.dataset.field), input]))
const identifyButtons = root => {
  for (const node of root.querySelectorAll('button')) {
    if (!node.classList.contains('primary')) node.classList.add('secondary')
    const row = node.closest('[data-row-key]'), group = node.closest('[data-group-control]')
    node.dataset.control ||= `button:${row ? `row:${row.dataset.rowKey}:` : group ? `group:${group.dataset.groupControl}:` : ''}${node.textContent}`
  }
}
const csvQuestions = {
  title: ['Hvilken tekst skal vises i kalenderen?', 'Velg tekst'],
  start: ['Når starter aktiviteten?', 'Velg starttidspunkt'], end: ['Når slutter aktiviteten?', 'Velg sluttidspunkt'], deadline: ['Hvilken frist skal brukes?', 'Velg frist'],
  kind: ['Hva slags oppføring er dette?', 'Velg oppføringstype'], courseHint: ['Hvilket emne skal aktivitetene kobles til?', 'Velg emne'], courseName: ['Hvilket emnenavn skal brukes?', 'Velg emnenavn'], university: ['Hvilket lærested gjelder oppføringene?', 'Velg lærested'],
  year: ['Hvilket år gjelder oppføringene?', 'Velg år'], semester: ['Hvilket semester gjelder oppføringene?', 'Velg semester'], campus: ['Hvilket campusnavn skal brukes?', 'Velg campusnavn'], campusCode: ['Hvilken campuskode er oppgitt i kilden?', 'Velg campuskode'], sourceObjectId: ['Hvilket publisert emnevalg skal brukes?', 'Velg publisert emnevalg'],
  activityType: ['Hvilken aktivitetstype skal brukes?', 'Velg aktivitetstype'], activityKind: ['Hvordan skal aktiviteten vises i planen?', 'Velg aktivitetskategori'], publishedGroups: ['Hvilke publiserte grupper skal brukes?', 'Velg grupper'],
  remainingMinutes: ['Hvor mange minutter gjenstår?', 'Velg minutter'], credits: ['Hvor mange studiepoeng har emnet?', 'Velg studiepoeng'], location: ['Hvor foregår aktiviteten?', 'Velg sted'],
  transparent: ['Hvilken opplysning om ledig eller opptatt tid skal brukes?', 'Velg tidsmarkering'], point: ['Hvilken opplysning markerer et punkt uten varighet?', 'Velg punktmarkering'], explicitId: ['Hvilken kildeoppføring gjelder dette?', 'Velg kildeoppføring'],
}
const rowTypeName = row => row.kind === 'event' && row.activityKind === 'personal' ? 'Egen aktivitet' : row.kind === 'event' && isExamEvent(row) ? 'Eksamen' : row.kind === 'event' && (row.information || row.transparent) ? 'Informasjon' : typeNames[row.kind]
const provisionalCourse = row => row.kind === 'course' && row.nameStatus === 'provisional' && !row.title?.trim() && row.code && !row.courseNameConflict
const rowDisplayName = row => row.kind === 'course' ? visibleName({ ...row, name: row.title }) : row.title
const rowCourseLabel = row => nameFirstLabel({ ...row, name: row.title })
const unresolvedTime = row => row.kind === 'event' && (!row.startLocal || !row.point && (!row.endLocal || row.endLocal <= row.startLocal) && !(row.originalStart && row.originalEnd && Date.parse(row.originalEnd) > Date.parse(row.originalStart) && row.startLocal === osloLocal(row.originalStart) && row.endLocal === osloLocal(row.originalEnd)))
const fieldNames = { title: 'navn', name: 'emnenavn', deadlineLocal: 'frist', remainingMinutes: 'gjenstående minutter', courseId: 'emne', course: 'emne', start: 'start', end: 'slutt', location: 'sted', description: 'beskrivelse', semester: 'semester', year: 'år' }
const courseOptionLabel = course => {
  const identity = nameFirstLabel(course) || 'Emne uten navn'
  const period = course.semester && course.year ? `${course.semester === 'spring' ? 'Vår' : 'Høst'} ${course.year}` : ''
  return [identity, course.university, period, course.campus ? `Campus: ${course.campus}` : ''].filter(Boolean).join(' · ')
}
const institutionOptions = value => {
  const options = [['', 'Ukjent / velg senere'], ...institutions.map(item => [item.id === 'himolde' ? 'HiMolde' : item.id === 'ntnu' ? 'NTNU' : item.id, item.name])]
  if (value && !options.some(([id]) => id === value)) options.push([value, value])
  return options
}
const pendingPreviewSummaries = new WeakMap()
const previewNativeDrafts = new WeakMap()
const cancelPreviewSummary = container => {
  clearTimeout(pendingPreviewSummaries.get(container))
  pendingPreviewSummaries.delete(container)
}

export function renderDocumentImportPreview(container, preview, { getState, onConfirm, onBack, onRefresh, onRetry } = {}) {
  cancelPreviewSummary(container)
  const previousDraft = previewNativeDrafts.get(container)
  const continuesDraft = previousDraft && (previousDraft.preview === preview || preview.reviewRows?.length && previousDraft.preview.sourceId === preview.sourceId && previousDraft.preview.contentHash === preview.contentHash)
  const referenceDraftEditors = continuesDraft ? previousDraft.editors : new Map()
  previewNativeDrafts.set(container, { preview, editors: referenceDraftEditors })
  const priorNativeEditors = continuesDraft ? unfinishedEditors(container) : new Map()
  const priorRows = new Map([...container.querySelectorAll('.document-preview-row')].map(node => [node.dataset.rowIndex, { open: node.open, pending: node.dataset.pending === 'true' }]))
  const priorGroups = new Map([...container.querySelectorAll('.document-preview-group')].map(node => [node.dataset.group, node.open]))
  const priorMetadata = new Map([...container.querySelectorAll('.document-course-metadata')].map(node => [node.closest('[data-row-index]').dataset.rowIndex, node.open]))
  const priorDetails = new Map([...container.querySelectorAll('details[data-detail]')].map(node => [node.dataset.detail, node.open]))
  const priorScroll = window.scrollY
  const priorFocus = container.contains(document.activeElement) ? { index: document.activeElement.closest('[data-row-index]')?.dataset.rowIndex, rowKey: document.activeElement.closest('[data-row-key]')?.dataset.rowKey, field: document.activeElement.dataset.field, control: document.activeElement.dataset.control } : null
  const state = getState(), form = el('form', undefined, 'document-preview'), heading = el('h3', 'Dette fant jeg')
  form.noValidate = true
  const foundSummary = el('p')
  container.replaceChildren(form); form.append(heading, foundSummary)
  const summaryCounts = el('p'); summaryCounts.setAttribute('role', 'status'); form.append(summaryCounts)
  const confirmationSummary = el('p', undefined, 'document-confirmation-summary'); confirmationSummary.id = `document-confirmation-${crypto.randomUUID()}`; confirmationSummary.setAttribute('aria-live', 'polite')
  const selectionSummary = el('p', undefined, 'document-selection-summary'); form.append(selectionSummary)
  form.append(el('p', 'Importen er et øyeblikksbilde. Den oppdateres ikke automatisk.', 'form-hint'))
  const referenced = row => row.kind === 'course' && preview.rows.some(item => item.kind !== 'course' && item.selected && item.courseChoice === `row:${row.index}`)
  const needsChoice = row => !row.selected && referenced(row) || row.kind !== 'course' && !row.title || row.courseTarget === '?' || row.kind !== 'course' && row.courseChoice === '?' || row.matchChoice === '?' || row.deadlineMode === '?' || row.statusNeedsChoice && row.statusChoice !== 'open' || row.deletedLocally && !row.recreate || row.typeChanged && row.typeChangeChoice !== 'replace' || row.estimateIssue && !row.estimateResolved || row.conflicts.some(conflict => !row.conflictChoices[conflict.field]) || row.kind === 'course' && !row.courseTarget && (!row.title && !provisionalCourse(row) || !row.year || !row.semester) || unresolvedTime(row)
  const updateSummary = () => {
    cancelPreviewSummary(container)
    foundSummary.textContent = `${preview.rows.filter(row => row.kind === 'course').length} emner · ${preview.rows.filter(row => row.kind === 'event' && !row.point).length} aktiviteter · ${preview.rows.filter(row => row.kind === 'event' && row.point).length} punkter · ${preview.rows.filter(row => row.kind === 'task').length} oppgaver fra ${preview.displayName || preview.name}. Velg det du vil lagre, og avklar manglende opplysninger. Ingenting lagres før du bekrefter.`
    const selected = preview.rows.filter(row => row.selected), existing = selected.filter(row => row.matchEntryKey || row.courseTarget && row.courseTarget !== '?')
    const changed = existing.filter(row => documentSourceChanged(row, preview, getState()))
    const newRows = selected.filter(row => !existing.includes(row))
    // Compute outcomes through the same atomic proposal builder as confirmation.
    // The clone keeps transient conflict/consent bookkeeping out of the draft.
    const proposed = buildDocumentImportCommit(getState(), structuredClone(preview))
    const counts = proposed.counts || { added: 0, updated: 0, unchanged: 0 }
    const unresolved = new Set([...preview.rows.filter(row => (row.selected || referenced(row)) && needsChoice(row) || row.selectionUncertain && !row.groupChoiceResolved).map(row => row.index), ...(proposed.errors || []).map(error => error.index)])
    const pendingQuestions = new Set()
    for (const index of unresolved) {
      const row = preview.rows[index], sharedCourse = row.kind !== 'course' && row.courseChoice === '?'
      if (sharedCourse) pendingQuestions.add(`course:${courseGroupKey(row)}`)
      if (!sharedCourse || needsChoice({ ...row, courseChoice: '' }) || proposed.errors?.some(error => error.index === index && error.field !== 'courseChoice')) pendingQuestions.add(`row:${index}`)
    }
    const questions = pendingQuestions.size
    const clarification = questions === unresolved.size ? `${questions} må avklares.` : `${questions} spørsmål må avklares · ${unresolved.size} oppføringer berørt.`
    summaryCounts.textContent = proposed.stale ? `${proposed.error} ${selected.length} oppføringer er fortsatt valgt; antall endringer kan beregnes etter oppdatering av forhåndsvisningen.` : `${counts.added} legges til · ${counts.updated} oppdateres · ${counts.unchanged} beholdes · ${clarification}`
    const pendingGroups = preview.rows.filter(row => row.requiresGroupChoice && !row.selected && !row.groupChoiceResolved).length
    if (pendingGroups) summaryCounts.textContent += ` ${pendingGroups} aktiviteter er foreløpig utelatt. Velg alle, en publisert gruppe eller et eget utvalg.`
    const selectedEvents = selected.filter(row => row.kind === 'event')
    const readyRows = selectedEvents.length ? selectedEvents : selected
    const pendingCourses = new Set(preview.rows.filter(row => row.kind === 'course' && unresolved.has(row.index)).flatMap(row => [`row:${row.index}`, row.courseTarget, row.targetId].filter(value => value && value !== '?')))
    const ready = readyRows.filter(row => !unresolved.has(row.index) && !pendingCourses.has(row.courseChoice)).length
    confirmationSummary.textContent = proposed.stale ? 'Forhåndsvisningen må oppdateres før import.' : `${ready} av ${readyRows.length} ${selectedEvents.length ? 'aktiviteter' : 'oppføringer'} klare · ${clarification}${pendingGroups ? ` ${pendingGroups} venter på utvalg.` : ''}`
    const dates = selected.filter(row => row.kind === 'event' && row.startLocal).flatMap(row => [row.startLocal, ...(!row.point && row.endLocal ? [row.endLocal] : [])]).map(value => value.slice(0, 10)).sort()
    selectionSummary.textContent = `${selected.filter(row => row.kind === 'course').length} emner · ${selected.filter(row => row.kind === 'event').length} aktiviteter valgt · ${preview.rows.filter(row => row.kind === 'event' && !row.selected).length} aktiviteter utelatt.${dates.length ? ` Datoer: ${dates[0]}–${dates.at(-1)}.` : ''}`
    changes.replaceChildren(el('summary', 'Antall, utvalg og endringer'))
    changes.append(el('p', `${selected.filter(row => row.kind === 'course').length} valgte emner · ${selected.filter(row => row.kind === 'event').length} valgte kalenderhendelser (${selected.filter(row => row.kind === 'event' && row.point).length} punktmarkører) · ${selected.filter(row => row.kind === 'task').length} valgte oppgaver · ${preview.rows.length - selected.length} utelatte oppføringer.`))
    for (const [kind, label] of [['course', 'Emner'], ['event', 'Kalenderhendelser'], ['task', 'Oppgaver']]) changes.append(el('p', `${label}: ${newRows.filter(row => row.kind === kind).length} nye · ${existing.filter(row => row.kind === kind && !changed.includes(row)).length} uten kildeendringer · ${changed.filter(row => row.kind === kind).length} med kildeendringer.`))
  }
  const scheduleSummary = () => {
    cancelPreviewSummary(container)
    pendingPreviewSummaries.set(container, setTimeout(() => {
      pendingPreviewSummaries.delete(container)
      if (form.isConnected && !container.hidden && container.contains(form)) updateSummary()
    }, 180))
  }
  const leavePreview = reason => { cancelPreviewSummary(container); onBack?.(reason) }
  const sourceDetails = el('details', undefined, 'document-source-details'); sourceDetails.dataset.detail = 'source'; sourceDetails.append(el('summary', 'Kildedetaljer og emnenavnsøk'))
  let retryControl
  if (onRetry) { retryControl = el('button', 'Prøv emnenavn på nytt'); retryControl.type = 'button'; retryControl.onclick = onRetry; (preview.rows.some(row => row.kind === 'course' && row.selected && !row.title && (!row.courseTarget || row.courseTarget === '?')) ? form : sourceDetails).append(retryControl) }
  const changes = el('details'); changes.dataset.detail = 'counts'; sourceDetails.append(changes)
  const updateResolutionControls = () => {
    const pending = preview.rows.filter(row => row.kind === 'course' && row.selected && !row.title && !provisionalCourse(row) && (!row.courseTarget || row.courseTarget === '?'))
    const context = form.querySelector('.document-course-context'); if (context) context.hidden = !preview.rows.some(row => row.kind === 'course' && row.selected && !row.university)
    const bulk = form.querySelector('.document-provisional-all'); if (bulk) bulk.hidden = !pending.some(row => row.code)
    if (retryControl) {
      if (pending.length && retryControl.parentNode !== form) form.insertBefore(retryControl, sourceDetails)
      else if (!pending.length && retryControl.parentNode !== sourceDetails) sourceDetails.append(retryControl)
    }
  }
  form.addEventListener('input', updateResolutionControls); form.addEventListener('change', updateResolutionControls)
  form.addEventListener('input', scheduleSummary); form.addEventListener('change', updateSummary); updateSummary()
  if (preview.period) {
    const window = `${new Date(preview.period.start).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' })}–${new Date(preview.period.end).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' })} (sluttdato ikke inkludert).`
    sourceDetails.append(el('p', preview.period.mode === 'automatic' ? `Aktiv periode: Automatisk fra filen. Utvidelsesvindu: ${window}` : `Aktivt periodefilter: ${window}`))
    const changePeriod = el('button', 'Endre periode'); changePeriod.type = 'button'; changePeriod.addEventListener('click', () => leavePreview('period')); sourceDetails.append(changePeriod)
  }
  if (preview.accounting) {
    const a = preview.accounting
    sourceDetails.append(el('p', `Kalenderkilden: ${a.total} kildeoppføringer · ${a.retained} beholdt · ${a.partial || 0} delvis beholdt · ${a.filtered} utenfor periode eller uten forekomster · ${a.rejected} avvist · ${a.cancelled} avlyst.`))
    if (a.rejected || a.partial) form.append(el('p', `${a.rejected} kildeoppføringer er avvist og ${a.partial || 0} delvis beholdt. Kontroller manglende aktiviteter under kildedetaljer.`, 'form-hint'))
    const details = el('details')
    details.append(el('summary', 'Detaljer om opptellingen'), el('p', `${a.occurrences} utvidede forekomster vises; ${a.filteredOccurrences} undersøkte forekomster filtrert; ${a.rejectedOccurrences || 0} undersøkte forekomster avvist. Delvis beholdt betyr at gyldige forekomster vises selv om andre ble avvist. Gjentakelser undersøkes bare fram til periodens slutt. Emneforslag telles separat.`))
    sourceDetails.append(details)
  }
  if (preview.range) sourceDetails.append(el('p', `Kalenderdatoer: ${new Date(preview.range.start).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' })}–${new Date(preview.range.end).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' })}. Filimport er en kopi, ikke synkronisering.`, 'form-hint'))
  if (preview.rows.some(row => row.kind === 'task')) form.append(el('p', 'Planforslag: Bekreftede oppgaver opprettes med opplysningene nedenfor. Eksisterende studieøkter flyttes ikke.', 'form-hint'))
  if (preview.complete === false) form.append(el('p', 'Kilden er ikke bekreftet fullstendig. Kontroller varslene før lagring.', 'form-hint'))
  for (const warning of preview.warnings) {
    const provisionalNotice = preview.recognizedCsv === 'tp' && /mangler tittel.*foreløpige/.test(warning)
    const necessary = !provisionalNotice && /gjentakelse.*avgrenset|seks måneder|Mulig overlapp|svært kort|tidsomstilling|avvist|kunne ikke|mangler tittel|forskjellige navn|ugyldig|erstattede tegn/i.test(warning)
    ;(necessary ? form : sourceDetails).append(el('p', necessary && /svært kort/.test(warning) ? 'Kort varighet i kilden. Tidspunktene beholdes nøyaktig; aktiviteten blir ikke automatisk et punkt.' : warning, 'form-hint'))
  }
  if (preview.previousRevision) sourceDetails.append(el('p', `Oppdaterer dokumentkilde, revisjon ${preview.previousRevision}. Lokale endringer og oppføringer som ikke velges, blir beholdt.`))
  const error = el('div'); error.setAttribute('role', 'alert'); form.append(error)
  const groups = el('section', undefined, 'document-course-groups'); form.append(groups)
  groups.before(sourceDetails)
  const rows = el('div', undefined, 'document-preview-rows'); form.append(rows)
  const pendingNames = () => preview.rows.filter(row => row.kind === 'course' && row.selected && !row.title && !provisionalCourse(row) && (!row.courseTarget || row.courseTarget === '?'))
  if (preview.rows.some(row => provisionalCourse(row) || row.titleStatus === 'provisional')) form.insertBefore(el('p', 'Navn som mangler i kilden vises tydelig som foreløpige. Bekreftelsen godtar disse sammen med de valgte aktivitetene; du kan rette navn senere. Ukjent lærested forblir ukjent.', 'form-hint'), groups)
  const affiliationRows = () => preview.rows.filter(row => row.kind === 'course')
  const linkedCourse = row => (row.reference || row.courseTarget && row.courseTarget !== '?' && (!row.matchEntryKey || row.courseTarget !== row.targetId)) && getState().planner?.courses.find(course => course.id === row.courseTarget)
  const bindInstitutionConsent = (checkbox, row, consent) => {
    checkbox.type = 'checkbox'; checkbox.dataset.institutionConsent = rowIdentity(row); checkbox.dataset.consent = consent; checkbox.checked = row.institutionCorrection === consent
    checkbox.onchange = () => {
      row.institutionCorrection = checkbox.checked ? consent : ''
      for (const other of form.querySelectorAll('input[data-institution-consent]')) if (other.dataset.institutionConsent === rowIdentity(row)) other.checked = row.institutionCorrection === other.dataset.consent
      updateSummary()
    }
  }
  const groupLabel = row => {
    const label = courseGroupLabel(row)
    const peers = preview.rows.filter(other => other.kind !== 'course' && courseGroupLabel(other) === label)
    if (new Set(peers.map(courseGroupKey)).size < 2) return label
    return [label, ...[['sourceObjectId', 'Kildevalg'], ['campusCode', 'Campuskode']].filter(([key]) => row[key] && new Set(peers.map(other => other[key] || '')).size > 1).map(([key, caption]) => `${caption}: ${row[key]}`)].join(' · ')
  }
  const mixedInstitutions = new Set(affiliationRows().map(row => documentInstitution(row.university))).size > 1
  const affiliations = el('details', undefined, 'document-institutions'); affiliations.dataset.detail = 'institutions'
  affiliations.append(el('summary', mixedInstitutions ? 'Filen inneholder flere læresteder' : 'Læresteder for emnene'))
  const affiliationChoices = el('div', undefined, 'document-affiliation-choices'); affiliations.append(affiliationChoices)
  affiliations.hidden = !affiliationRows().length; form.insertBefore(affiliations, groups)
  const updateAffiliationName = (name, row) => {
    const courseName = linkedCourse(row)?.name || rowDisplayName(row) || 'Foreløpig emnenavn'
    const label = nameFirstLabel({ ...row, name: courseName })
    name.textContent = label === courseName ? label : [row.code, courseName].filter(Boolean).join(' · ')
    if (row.code && affiliationRows().filter(other => other.code === row.code).length > 1) {
      const context = [row.semester === 'spring' ? 'Vår' : row.semester === 'autumn' ? 'Høst' : '', row.year, row.campus ? `Campus: ${row.campus}` : '', courseSourceContext(row)].filter(Boolean).join(' · ')
      if (context) name.append(el('small', context, 'document-affiliation-context'))
    }
  }
  const renderInstitutions = () => {
    const focused = affiliationChoices.contains(document.activeElement) ? document.activeElement.dataset.control : null
    affiliationChoices.replaceChildren()
    affiliations.hidden = !affiliationRows().length
    for (const row of affiliationRows()) {
      const saved = getState().planner?.courses.find(course => course.id === row.targetId)
      const referenced = row.reference || row.courseTarget && row.courseTarget !== '?' && (!row.matchEntryKey || row.courseTarget !== row.targetId)
      const linked = linkedCourse(row)
      const value = linked ? linked.university || '' : row.university || ''
      const wrapper = el('div', undefined, 'document-affiliation')
      wrapper.dataset.affiliationRow = row.index
      const name = el('p', undefined, 'document-affiliation-name'); updateAffiliationName(name, row); wrapper.append(name)
      const repeatedCode = row.code && affiliationRows().filter(other => other.code === row.code).length > 1
      const context = repeatedCode ? ` · ${courseOptionLabel({ ...row, name: row.title })}${courseSourceContext(row) ? ` · ${courseSourceContext(row)}` : ''} · emne ${row.index + 1}` : ''
      const input = choice(wrapper, `Lærested for ${row.code || rowDisplayName(row) || `emne ${row.index + 1}`}${context}`, institutionOptions(value), value, value => {
        const scroll = window.scrollY
        row.university = value; delete row.institutionCorrection; invalidateDocumentCourseName(row)
        for (const member of preview.rows.filter(member => member.courseChoice === `row:${row.index}`)) member.university = value
        renderRows(); renderGroups(); renderInstitutions(); updateSummary(); window.scrollTo({ top: scroll })
      })
      input.parentElement.querySelector('label').classList.add('visually-hidden')
      input.dataset.control = `institution:${row.index}`; input.disabled = Boolean(linked)
      if (linked) wrapper.append(el('p', 'Koblet til lagret emne; lærestedet beholdes.', 'form-hint'))
      if (!referenced && row.matchEntryKey && saved?.university && documentInstitution(saved.university) !== documentInstitution(row.university)) {
        const consent = JSON.stringify([saved.id, saved.university, row.university])
        const label = el('label', row.university ? `Jeg retter institusjonen fra ${saved.university} til ${row.university} for dette emnet. Eksisterende aktiviteter beholder koblingen.` : `Jeg fjerner institusjonen ${saved.university} fra dette emnet. Eksisterende aktiviteter beholder koblingen.`)
        const checkbox = el('input'); bindInstitutionConsent(checkbox, row, consent); checkbox.dataset.control = `institution-consent:${row.index}`
        label.prepend(checkbox); wrapper.append(label)
      }
      affiliationChoices.append(wrapper)
    }
    if (focused) [...affiliationChoices.querySelectorAll('[data-control]')].find(node => node.dataset.control === focused)?.focus({ preventScroll: true })
  }
  {
    const context = el('fieldset'); context.className = 'document-course-context'; context.append(el('legend', 'Finn navn på emnene'))
    let institution = ''
    choice(context, 'Lærested for emner uten institusjon', institutionOptions(''), '', value => { institution = value }).dataset.control = 'unknown-institution'
    const apply = el('button', 'Bruk lærested og finn emnenavn'); apply.type = 'button'
    apply.onclick = () => { if (!institution) return; for (const row of preview.rows.filter(row => row.kind === 'course' && row.selected && !row.university)) { row.university = institution; delete row.institutionCorrection; for (const member of preview.rows.filter(member => member.courseChoice === `row:${row.index}` && !member.university)) member.university = institution }; renderInstitutions(); if (onRetry) onRetry(); else { renderRows(); renderGroups(); updateSummary() } }
    context.append(el('p', 'Gjelder emnene som mangler lærested. Du kan endre institusjon for ett emne under emnedetaljer. Registeret er en valgliste; automatisk navnesøk er bare tilgjengelig for HiMolde og NTNU.', 'form-hint'))
    context.append(apply); (mixedInstitutions ? affiliations : sourceDetails).append(context)
  }
  {
    const bulk = el('button', 'Bruk emnekoder som foreløpige navn'); bulk.type = 'button'; bulk.className = 'document-provisional-all'
    bulk.onclick = () => { for (const row of pendingNames().filter(row => row.code)) { row.title = row.code; row.resolutionNote = 'Emnekoden er godkjent som foreløpig navn.'; clearTitleError(row) }; renderRows(); renderGroups(); updateSummary(); heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
    form.insertBefore(bulk, groups)
  }
  const courseOptions = () => [['?', 'Avklar emne'], ['', 'Uten emne'], ...(getState().planner?.courses || []).map(course => [course.id, courseOptionLabel(course)]), ...preview.rows.filter(row => row.kind === 'course').map(row => [`row:${row.index}`, `${rowCourseLabel(row)} (${row.courseTarget && row.courseTarget !== '?' ? 'koblet til eksisterende emne' : 'nytt fra filen'})`])]
  if (preview.rows.some(row => row.kind === 'event')) {
    const selection = el('details', undefined, 'document-activity-selection'); selection.dataset.detail = 'selection'; selection.open = preview.rows.some(row => row.requiresGroupChoice && !row.groupChoiceResolved); selection.append(el('summary', 'Endre utvalg: alle, grupper eller enkeltvis'), el('p', 'Velg alle, eller lag et eget utvalg med emne, publisert type og gruppe. En tittel eller et overlapp betyr ikke at aktivitetene tilhører samme gruppe.'))
    for (const [label, value] of [['Velg alle aktiviteter', true], ['Velg ingen aktiviteter', false], ['Velg eget utvalg', null]]) {
      const button = el('button', label); button.type = 'button'
      button.onclick = () => { for (const row of preview.rows.filter(row => row.kind === 'event')) { if (value !== null) chooseDocumentSelection(row, value); else row.groupChoiceResolved = true }; renderRows(); renderGroups(); updateSummary() }
      selection.append(button)
    }
    form.insertBefore(selection, groups)
  }
  const renderGroups = () => {
    const scroll = window.scrollY, focus = groups.contains(document.activeElement) ? document.activeElement.dataset.control : null
    const open = new Set([...groups.querySelectorAll('details[open][data-group-control]')].map(node => node.dataset.groupControl))
    groups.replaceChildren(el('h4', 'Emner i filen'))
    const grouped = new Map()
    for (const row of preview.rows.filter(row => row.kind !== 'course')) {
      const key = courseGroupKey(row)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(row)
    }
    for (const members of grouped.values()) {
      const first = members[0], choices = new Set(members.map(row => row.courseChoice))
      const label = `${groupLabel(first)} · ${members.length} oppføringer`
      const selectionContext = groupLabel(first) !== courseGroupLabel(first) ? ` – ${groupLabel(first)}` : ''
      const groupControls = el('details'); groupControls.dataset.groupControl = courseGroupKey(first); groupControls.dataset.detail = `group:${courseGroupKey(first)}`; groupControls.append(el('summary', label)); groupControls.open = open.has(courseGroupKey(first)) || !first.courseHint || choices.has('?'); groups.append(groupControls)
      if (courseSourceContext(first)) groupControls.append(el('p', courseSourceContext(first), 'form-hint'))
      if (members.some(row => row.legacyCourseChoice)) groupControls.append(el('p', `Tidligere lagring viser ikke om manglende emnekobling var et eget valg. Velg ett emne eller «Uten emne» for disse ${members.length} oppføringene. Valget beholdes ved uendret import.`, 'form-hint'))
      choice(groupControls, `Emne for ${label}${courseSourceContext(first) ? ` · ${courseSourceContext(first)}` : ''}`, courseOptions(), choices.size === 1 ? first.courseChoice : '?', value => { chooseDocumentCourse(preview, members, value); renderRows(); renderGroups(); renderInstitutions(); updateSummary() }).dataset.control = `course-choice:${courseGroupKey(first)}`
      const newCourse = el('button', `Opprett nytt emne for ${first.courseHint || 'gruppen uten emne'}`); newCourse.type = 'button'
      newCourse.addEventListener('click', () => {
        try {
          const row = addDocumentCourseDraft(getState(), preview, members); renderRows(); renderGroups(); renderInstitutions(); updateSummary()
          const section = rows.querySelector(`[data-row-index="${row.index}"]`); section.open = true; section.querySelector('[data-field=title]').focus()
        } catch (failure) { error.replaceChildren(el('p', failure.message)) }
      }); groupControls.append(newCourse)
      const events = members.filter(row => row.kind === 'event')
      const collective = (parent, label, members, key) => {
        const wrapper = el('label', label), input = el('input'); input.type = 'checkbox'; input.dataset.control = key; input.checked = members.every(row => row.selected); input.indeterminate = !input.checked && members.some(row => row.selected)
        input.onchange = () => { for (const row of members) chooseDocumentSelection(row, input.checked); renderRows(); renderGroups(); updateSummary() }; wrapper.prepend(input); parent.append(wrapper)
      }
      if (events.length) {
        collective(groupControls, `Ta med alle aktiviteter for ${first.courseHint || 'uten emne'} (${events.length})${selectionContext}`, events, `course:${courseGroupKey(first)}`)
        const types = [...new Set(events.map(row => row.activityType).filter(Boolean))]
        for (const type of types) collective(groupControls, `Ta med typen ${type}${selectionContext}`, events.filter(row => row.activityType === type), `type:${courseGroupKey(first)}:${type}`)
        const published = [...new Set(events.flatMap(row => row.publishedGroups?.length ? row.publishedGroups : row.explicitGroup ? [row.explicitGroup] : []))]
        for (const group of published) {
          const subset = events.filter(row => row.publishedGroups?.includes(group) || !row.publishedGroups?.length && row.explicitGroup === group)
          collective(groupControls, `Ta med gruppen ${group} (${subset.length} økter) – ${groupLabel(first)}`, subset, `group:${courseGroupKey(first)}:${group}`)
        }
      }
    }
    groups.hidden = !grouped.size
    identifyButtons(groups)
    if (focus) [...groups.querySelectorAll('[data-control]')].find(node => node.dataset.control === focus)?.focus({ preventScroll: true })
    window.scrollTo({ top: scroll })
  }
  const missingRows = () => preview.rows.filter(row => row.deletedLocally)
  let updateRecovery
  {
    const recovery = el('section', undefined, 'document-recovery'); recovery.append(el('h4', 'Tidligere oppføringer mangler i planen'))
    const counts = el('p'); recovery.append(counts)
    updateRecovery = () => {
      const missing = missingRows(); recovery.hidden = !missing.length
      counts.textContent = `${missing.filter(row => row.kind === 'course').length} emner og ${missing.filter(row => row.kind !== 'course').length} aktiviteter/oppgaver mangler. Det kan skyldes en tidligere sletting; historikken forklarer ikke årsaken. Ingen gjenopprettes automatisk. Du kan endre utvalget per oppføring nedenfor.`
    }
    for (const [label, recreate] of [['Behold manglende oppføringer utelatt', false], ['Gjenopprett alle manglende oppføringer', true]]) {
      const button = el('button', label); button.type = 'button'
      button.onclick = () => {
        const missing = missingRows()
        for (const row of missing) { chooseDocumentSelection(row, recreate); row.recreate = recreate }
        for (const course of missing.filter(row => row.kind === 'course')) {
          for (const member of preview.rows.filter(row => row.kind !== 'course' && (row.courseChoice === course.targetId || row.courseChoice === `row:${course.index}`))) {
            if (recreate) { member.courseChoice = `row:${course.index}` }
            else chooseDocumentSelection(member, false)
          }
        }
        renderRows(); renderGroups(); updateSummary()
      }
      recovery.append(button)
    }
    recovery.append(el('p', 'Når et manglende emne utelates, utelates også valgte oppføringer som trenger dette emnet. Du kan i stedet velge et annet emne eller «Uten emne».'))
    form.insertBefore(recovery, groups)
  }
  let validationErrors = []
  const updateCourseLabels = row => {
    for (const option of form.querySelectorAll(`option[value="row:${row.index}"]`)) option.textContent = `${rowCourseLabel(row)} (fra dokumentet)`
    const name = affiliationChoices.querySelector(`[data-affiliation-row="${row.index}"] .document-affiliation-name`)
    if (name) updateAffiliationName(name, row)
  }
  const clearTitleError = row => {
    if (row.selected && !row.title.trim() && (!row.courseTarget || row.courseTarget === '?')) return
    validationErrors = validationErrors.filter(item => item.index !== row.index || item.field !== 'title')
    error.replaceChildren(...validationErrors.map(item => el('p', item.message)))
    showValidationErrors()
  }
  const showValidationErrors = ({ focusError = false } = {}) => {
    for (const input of rows.querySelectorAll('[aria-invalid]')) { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby') }
    for (const message of rows.querySelectorAll('.document-field-error')) message.remove()
    for (const [index, item] of validationErrors.entries()) {
      const section = [...rows.querySelectorAll('.document-preview-row')].find(section => Number(section.dataset.rowIndex) === item.index)
      if (!section) continue
      section.open = true
      if (section.parentElement.classList.contains('document-preview-group')) section.parentElement.open = true
      const inputs = [...section.querySelectorAll('[data-field]')], input = inputs.find(input => input.dataset.field === item.field) || inputs.find(input => input.dataset.field === 'selected')
      for (let ancestor = input.parentElement; ancestor && ancestor !== rows; ancestor = ancestor.parentElement) if (ancestor.tagName === 'DETAILS') ancestor.open = true
      const message = el('p', item.message, 'document-field-error'); message.id = `document-error-${item.index}-${index}`
      input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' ')); section.append(message)
    }
    if (focusError) { const input = rows.querySelector('[aria-invalid=true]'); input?.focus(); input?.scrollIntoView({ block: 'nearest' }) }
  }
  const renderRows = ({ focusError = false } = {}) => {
    const rowScroll = window.scrollY
    const pendingRows = new Set([...rows.querySelectorAll('.document-preview-row[data-pending=true]')].map(section => Number(section.dataset.rowIndex)))
    const openRows = new Set([...rows.querySelectorAll('.document-preview-row')].filter(section => section.open).map(section => Number(section.dataset.rowIndex))), firstRender = !rows.children.length
    const openGroups = new Set([...rows.querySelectorAll('.document-preview-group[open]')].map(group => group.dataset.group))
    const openMetadata = new Set([...rows.querySelectorAll('.document-course-metadata[open]')].map(item => Number(item.closest('[data-row-index]').dataset.rowIndex)))
    const openDetails = new Set([...rows.querySelectorAll('details[data-detail][open]')].map(item => item.dataset.detail))
    const active = rows.contains(document.activeElement) ? { index: Number(document.activeElement.closest('.document-preview-row')?.dataset.rowIndex), rowKey: document.activeElement.closest('.document-preview-row')?.dataset.rowKey, field: document.activeElement.dataset.field, control: document.activeElement.dataset.control } : null
    const retainedNativeInputs = firstRender ? priorNativeEditors : unfinishedEditors(rows)
    refreshDocumentConflicts(getState(), preview); rows.replaceChildren()
    const rowGroups = new Map()
    for (const row of [...preview.rows].sort((a, b) => Number(b.kind === 'course' && needsChoice(b)) - Number(a.kind === 'course' && needsChoice(a)))) {
      const rowErrors = validationErrors.filter(error => error.index === row.index)
      const pending = (row.selected || referenced(row)) && needsChoice(row)
      const hasNativeInput = [...retainedNativeInputs.keys()].some(key => JSON.parse(key)[0] === rowIdentity(row))
      const newlyResolved = row.kind === 'course' && pendingRows.has(row.index) && !pending && active?.rowKey !== rowIdentity(row) && !hasNativeInput
      const section = el('details', undefined, 'document-preview-row'); section.dataset.rowIndex = row.index; section.dataset.rowKey = rowIdentity(row); section.dataset.pending = String(Boolean(pending)); section.open = rowErrors.length > 0 || !newlyResolved && (openRows.has(row.index) || firstRender && (preview.rows.length === 1 || pending || row.requiresGroupChoice && !row.groupChoiceResolved))
      const savedCourse = row.kind === 'course' && linkedCourse(row)
      const mark = (key, input) => { input.dataset.field = key; return input }
      const rowField = (key, parent, label, value, onChange, type = 'text') => {
        const identity = editorKey(rowIdentity(row), key), editor = retainedNativeInputs.get(identity) || referenceDraftEditors.get(identity)
        if (savedCourse && editor) referenceDraftEditors.set(identity, editor)
        else referenceDraftEditors.delete(identity)
        return mark(key, field(parent, label, value, onChange, type, savedCourse ? undefined : editor))
      }, rowChoice = (key, ...args) => mark(key, choice(...args))
      const summary = el('summary'); section.append(summary)
      const updateRowSummary = () => { const linked = row.kind === 'course' && linkedCourse(row); section.dataset.pending = String(Boolean((row.selected || referenced(row)) && needsChoice(row))); summary.textContent = `${row.index + 1}. ${rowTypeName(row)} · ${(row.kind === 'course' ? rowCourseLabel(row) : rowDisplayName(row)) || (row.draftCourse && !row.selected ? 'Ubrukt emneforslag' : 'Mangler navn')}${row.kind === 'course' ? ` · Lærested: ${(linked ? linked.university : row.university) || 'Ukjent / velg senere'}` : ''}${row.kind === 'event' && row.startLocal ? ` · ${row.originalStart && row.startLocal === osloLocal(row.originalStart) ? calendarInstantLabel(row.originalStart, { includeDate: true }) : row.startLocal.replace('T', ' ')}` : ''}${row.kind === 'event' && row.point ? ` · Punkt uten varighet – ${row.pointProvenance === 'user' ? 'ditt valg' : 'fra kilden'}` : ''}${row.resolutionNote === 'Emnekoden er godkjent som foreløpig navn.' && row.title === row.code ? ' · foreløpig navn' : ''}${row.kind === 'course' && row.sourceObjectId ? ` · Kildevalg: ${row.sourceObjectId}` : ''}${row.kind === 'course' && row.campus ? ` · Campus: ${row.campus}` : ''}${row.selected ? ' · valgt' : ' · utelatt'}` }
      updateRowSummary()
      const selectedLabel = el('label', 'Ta med i planen'), selected = mark('selected', el('input')); selected.type = 'checkbox'; selected.checked = row.selected; selected.addEventListener('change', () => { chooseDocumentSelection(row, selected.checked); renderRows(); renderGroups(); updateSummary() }); selectedLabel.prepend(selected); section.append(selectedLabel)
      const resolutionNote = el('p', row.resolutionNote || ''); resolutionNote.hidden = !row.resolutionNote; section.append(resolutionNote)
      if (row.kind === 'course') {
        const members = preview.rows.filter(item => item.kind !== 'course' && item.courseChoice === `row:${row.index}`)
        if (!row.selected && members.some(item => item.selected)) section.append(el('p', 'Emnet er utelatt, men aktivitetene er fortsatt valgt. Ta med emnet eller velg uten emne.'))
        if (members.length) {
          const without = el('button', `Behold ${members.length} oppføringer uten emne`); without.type = 'button'
          without.onclick = () => {
            for (const item of members) item.courseChoice = ''
            row.selected = false; validationErrors = validationErrors.filter(item => item.index !== row.index); error.replaceChildren(...validationErrors.map(item => el('p', item.message)))
            renderRows(); renderGroups(); updateSummary()
            if (!row.selected && !referenced(row)) {
              const resolved = [...rows.querySelectorAll('.document-preview-row')].find(node => node.dataset.rowKey === rowIdentity(row))
              if (resolved) { resolved.open = false; resolved.querySelector(':scope > summary').focus({ preventScroll: true }) }
            }
          }
          section.append(without)
        }
      }
      const snippet = el('blockquote'); snippet.append(el('strong', row.position), el('p', row.snippet)); const evidence = el('details'); evidence.open = preview.rows.length === 1; evidence.append(el('summary', 'Vis kildeutdrag'), snippet); section.append(evidence)
      if (row.unsupported) section.append(el('p', 'Denne oppføringen kunne ikke tolkes sikkert. Velg riktig type og korriger feltene hvis du vil ta den med.', 'form-hint'))
      if (row.sourceStatus) section.append(el('p', `Oppgavestatus i kilden: ${row.sourceStatus}.`))
      if (row.statusNeedsChoice) {
        section.append(el('p', 'Ferdige og avlyste gjøremål velges ikke automatisk. Nye oppgaver blir åpne; eksisterende oppgaver beholder lokal ferdigstatus. Import bekrefter aldri levering.', 'form-hint'))
        rowChoice('statusChoice', section, 'Avklar oppgavestatus', [['?', 'Avklar eller utelat oppføringen'], ['open', 'Ta med uten å overta kildestatus']], row.statusChoice, value => { row.statusChoice = value })
      }
      if (row.groupHint && !(row.information || row.transparent)) section.append(el('p', `Gruppe/aktivitet i kilden: ${row.groupHint}. Kontroller at denne tilhører deg.`))
      if (row.selectionUncertain && !row.groupChoiceResolved) section.append(el('p', 'Tidligere tittelvalg gir forskjellige utelatelser. Ingen av alternativene er sikkert. Velg alle, et eget utvalg eller marker denne aktiviteten uttrykkelig før lagring.'))
      if (row.kind === 'event' && (row.information || row.transparent)) section.append(el('p', 'Informasjonsoppføring: reserverer ikke arbeidstid.'))
      if (row.kind === 'event' && row.cancelled) section.append(el('p', 'Kilden avlyser denne aktiviteten. Den tas ut av opptatt kapasitet når du bekrefter, mens tidligere opplysninger bevares.'))
      if (row.matchCandidates.length) {
        const candidateLabel = item => {
          const start = item.start ? (item.kind === 'event' ? osloLocal(item.start) : item.start).replace('T', ' ') : ''
          const end = item.kind === 'event' && item.end ? osloLocal(item.end).replace('T', ' ') : ''
          const period = start ? `${start}${end ? `–${end.slice(0, 10) === start.slice(0, 10) ? end.slice(11) : end}` : ''}` : 'tidspunkt ikke oppgitt'
          return [period, item.location, item.campus ? `Campus: ${item.campus}` : '', item.campusCode ? `Campuskode: ${item.campusCode}` : '', item.sourceObjectId ? `Kildevalg: ${item.sourceObjectId}` : '', item.title, typeNames[item.kind], item.course, item.reason].filter(Boolean).join(' · ')
        }
        const anchor = Date.parse(row.kind === 'task' ? row.deadlineLocal : row.originalStart || row.startLocal)
        const dated = Number.isFinite(anchor) && row.matchCandidates.some(item => Number.isFinite(Date.parse(item.start)))
        const distance = item => Number.isFinite(Date.parse(item.start)) ? Math.abs(Date.parse(item.start) - anchor) : Infinity
        const ranked = dated ? [...row.matchCandidates].sort((a, b) => distance(a) - distance(b) || 0) : [...row.matchCandidates]
        const filtered = ranked.filter(item => !row.matchFilter || candidateLabel(item).toLocaleLowerCase('nb-NO').includes(row.matchFilter.toLocaleLowerCase('nb-NO')))
        const shown = filtered.slice(0, 20)
        const chosen = ranked.find(item => item.key === row.matchChoice)
        if (chosen && !shown.includes(chosen)) shown.push(chosen)
        if (ranked.length > 20) {
          const search = rowField('matchFilter', section, 'Finn tidligere oppføring med navn eller dato', row.matchFilter || '', () => {})
          search.addEventListener('change', () => { row.matchFilter = search.value; renderRows() })
          section.append(el('p', `Viser ${shown.filter(item => filtered.includes(item)).length} av ${filtered.length} alternativer${dated ? ', nærmeste dato først' : ''}.${chosen && !filtered.includes(chosen) ? ' Det tidligere valget vises også, selv om det ikke passer søket.' : ''} Søk med dato (ÅÅÅÅ-MM-DD), emne eller navn for å avgrense. Ingen er valgt automatisk.`))
        }
        if (ranked.some(item => item.kind !== row.kind)) section.append(el('p', 'Kilden bruker samme uttrykkelige identitet med en annen oppføringstype. En eventuell erstatning må bekreftes separat; oppføringer med andre typer er ikke likeverdige aktiviteter.'))
        const label = item => `${ranked.indexOf(item) + 1}. ${candidateLabel(item)}`
        rowChoice('matchChoice', section, 'Koble til tidligere oppføring', [['?', 'Avklar oppføring'], ['new', 'Opprett som ny'], ...shown.map(item => [item.key, label(item)])], row.matchChoice, value => { row.matchChoice = value; renderRows() })
        if (shown.some((item, index) => shown.slice(index + 1).some(other => item.start === other.start))) {
          const descriptions = el('div', undefined, 'document-match-alternatives')
          for (const item of shown) descriptions.append(el('p', label(item)))
          section.append(descriptions)
        }
      }
      if (row.deletedLocally) {
        section.append(el('p', 'Den tidligere koblede oppføringen finnes ikke i planen. Importhistorikken alene viser ikke hvorfor. Behold den utelatt eller velg uttrykkelig å gjenopprette.'))
        const wrapper = el('label', 'Opprett den manglende oppføringen igjen.'), input = mark('recreate', el('input')); input.type = 'checkbox'; input.checked = row.recreate; input.addEventListener('change', () => { row.recreate = input.checked; updateSummary() }); wrapper.prepend(input); section.append(wrapper)
      }
      if (row.typeChanged) {
        section.append(el('p', `Tidligere type: ${typeNames[row.previousKind]}. Ved erstatning fjernes den tidligere oppføringen og opprettes som ${typeNames[row.kind].toLocaleLowerCase('nb-NO')} med samme ID. Koblinger til annet arbeid må beholdes.`, 'form-hint'))
        rowChoice('typeChangeChoice', section, 'Avklar endret type', [['?', 'Velg hva som skal skje'], ['retain', 'Behold tidligere type og opplysninger'], ['replace', 'Erstatt tidligere oppføring med valgt type']], row.typeChangeChoice, value => { if (value === 'retain') changeDocumentRowKind(getState(), preview, row, row.previousKind); else row.typeChangeChoice = value; renderRows() })
      }
      const fields = el('div', undefined, 'document-preview-fields'); section.append(fields)
      const kindInput = rowChoice('kind', fields, 'Type oppføring', Object.entries({...typeNames,...(row.information || row.transparent ? {event:'Informasjon'} : {})}), row.kind, value => { changeDocumentRowKind(getState(), preview, row, value); renderRows() })
      const savedCourseName = Boolean(savedCourse)
      const title = rowField('title', fields, row.kind === 'course' ? 'Emnenavn' : 'Navn', savedCourse ? savedCourse.name : row.title, value => { row.title = value; row.titleOrigin = 'user'; if (row.kind === 'course' && row.nameStatus !== undefined) row.nameStatus = value.trim() ? 'confirmed' : 'provisional'; if (row.kind === 'event' && row.titleStatus !== undefined) row.titleStatus = 'confirmed'; if (row.verifiedCourseName && value !== row.verifiedCourseName.name) { if (!row.verifiedCourseName.courseTarget) delete row.verifiedCourseName; delete row.resolutionNote; resolutionNote.textContent = ''; resolutionNote.hidden = true }; updateRowSummary(); if (row.kind === 'course') updateCourseLabels(row); clearTitleError(row) })
      title.readOnly = savedCourseName
      if (!savedCourseName && row.titleSuggestion && !row.title) {
        const provisional = el('button', 'Bruk foreløpig aktivitetstittel'); provisional.type = 'button'
        fields.append(el('p', `Kilden mangler aktivitetstittel. Forslag: «${row.titleSuggestion}». Dette navnet er ikke hentet fra kilden.`), provisional)
        provisional.onclick = () => { row.title = row.titleSuggestion; row.titleOrigin = 'provisional'; renderRows(); updateSummary() }
      }
      if (savedCourseName) fields.append(el('p', 'Emnenavnet er hentet fra det lagrede emnet.', 'form-hint'))
      else if (row.titleOrigin === 'user') fields.append(el('p', 'Navnet er oppgitt av deg.', 'form-hint'))
      else if (row.titleOrigin === 'provisional') fields.append(el('p', 'Foreløpig navn godkjent av deg; mangler i kilden.', 'form-hint'))
      if (row.kind === 'course') {
        const linked = preview.rows.filter(item => item.kind !== 'course' && item.selected && item.courseChoice === `row:${row.index}`).length
        fields.append(el('p', `${linked} valgte oppføringer. Avklar emnet én gang for hele gruppen.`, 'form-hint'))
        if (!savedCourseName && !row.title && row.code && !provisionalCourse(row)) {
          const provisional = el('button', 'Bruk emnekoden som foreløpig navn'); provisional.type = 'button'
          provisional.addEventListener('click', () => { row.title = row.code; row.resolutionNote = 'Emnekoden er godkjent som foreløpig navn.'; resolutionNote.textContent = row.resolutionNote; resolutionNote.hidden = false; fields.querySelector('[data-field=title]').value = row.title; provisional.remove(); updateRowSummary(); updateSummary(); updateCourseLabels(row); clearTitleError(row); if (!needsChoice(row) && !validationErrors.some(item => item.index === row.index)) { section.open = false; summary.focus() } else fields.querySelector('[data-field=title]').focus() })
          fields.append(provisional)
        }
        rowChoice('courseTarget', fields, 'Eksisterende eller nytt emne', [['?', 'Avklar eksisterende eller nytt emne'], ['', 'Opprett nytt emne'], ...(state.planner?.courses || []).map(course => [course.id, courseOptionLabel(course)])], row.courseTarget, value => { row.courseTarget = value; delete row.institutionCorrection; if (row.verifiedCourseName) delete row.verifiedCourseName.courseTarget; clearTitleError(row); renderRows(); renderInstitutions(); updateSummary() })
        if (savedCourseName) fields.append(el('p', 'Dette er en kobling til et eksisterende emne. Emnets opplysninger og kildeeierskap beholdes.', 'form-hint'))
        const metadata = el('details', undefined, 'document-course-metadata'); metadata.append(el('summary', 'Emnedetaljer (kode, institusjon og periode)')); metadata.open = openMetadata.has(row.index) || !row.year || !row.semester; section.append(metadata)
        metadata.append(kindInput.parentElement, evidence)
        const changeIdentity = (key, value) => { row[key] = value; if (key === 'university') delete row.institutionCorrection; invalidateDocumentCourseName(row); title.value = savedCourse ? savedCourse.name : row.title; resolutionNote.textContent = row.resolutionNote || ''; resolutionNote.hidden = !row.resolutionNote; updateCourseLabels(row); updateRowSummary(); scheduleSummary() }
        const code = rowField('code', metadata, 'Emnekode (valgfritt)', savedCourse ? savedCourse.code : row.code, value => changeIdentity('code', value)); code.readOnly = savedCourseName
        const institution = rowField('university', metadata, 'Institusjon (valgfritt)', row.university, value => { changeIdentity('university', value); for (const member of preview.rows.filter(member => member.courseChoice === `row:${row.index}`)) member.university = value; updateInstitutionCorrection(); renderInstitutions() })
        institution.disabled = Boolean(savedCourseName)
        if (savedCourseName) institution.value = state.planner?.courses.find(course => course.id === row.courseTarget)?.university || ''
        const correction = el('div'); metadata.append(correction)
        const updateInstitutionCorrection = () => {
          correction.replaceChildren()
          const savedCourse = state.planner?.courses.find(course => course.id === row.targetId)
          if (savedCourseName || !row.matchEntryKey || !savedCourse?.university || documentInstitution(savedCourse.university) === documentInstitution(row.university)) return
          const consent = JSON.stringify([savedCourse.id, savedCourse.university, row.university])
          const label = el('label', row.university ? `Jeg retter institusjonen fra ${savedCourse.university} til ${row.university} for dette emnet. Eksisterende aktiviteter beholder koblingen.` : `Jeg fjerner institusjonen ${savedCourse.university} fra dette emnet. Eksisterende aktiviteter beholder koblingen.`)
          const checkbox = el('input'); bindInstitutionConsent(checkbox, row, consent)
          label.prepend(checkbox); correction.append(label)
        }
        updateInstitutionCorrection()
        const registry = el('datalist'); registry.id = `document-institutions-${row.index}`; for (const item of institutions) { const option = el('option', item.name); option.value = item.id; registry.append(option) }; institution.setAttribute('list', registry.id); metadata.append(registry)
        if (row.campusCode) metadata.append(el('p', `Campuskode i kilden: ${row.campusCode}. Fysisk campus er ikke bekreftet.`))
        const semester = rowChoice('semester', metadata, 'Kalendersemester', [['', 'Velg semester'], ['spring', 'Vår'], ['autumn', 'Høst']], savedCourse ? savedCourse.semester : row.semester, value => changeIdentity('semester', value)); semester.disabled = savedCourseName
        const year = rowField('year', metadata, 'År', savedCourse ? savedCourse.year : row.year, value => changeIdentity('year', value), 'number'); year.min = '1900'; year.max = '2200'; year.readOnly = savedCourseName
        const credits = rowField('credits', metadata, 'Studiepoeng (valgfritt)', savedCourse ? savedCourse.credits : row.credits, value => { row.credits = value }, 'number'); credits.min = '0'; credits.step = '0.5'; credits.readOnly = savedCourseName
      } else {
        const courseOptions = [['?', 'Avklar emne'], ['', 'Uten emne'], ...(state.planner?.courses || []).map(course => [course.id, courseOptionLabel(course)]), ...preview.rows.filter(item => item.kind === 'course').map(item => [`row:${item.index}`, `${rowCourseLabel(item)} (fra dokumentet)`])]
        rowChoice('courseChoice', fields, row.courseHint ? `Emne (i kilden: ${row.courseHint})` : 'Emne (valgfritt)', courseOptions, row.courseChoice, value => { chooseDocumentCourse(preview, [row], value); renderRows(); renderGroups() })
        if (row.kind === 'task') {
          if (row.deadlineRaw || row.deadlineIssues.length) fields.append(el('p', `Frist i kilden: ${row.deadlineRaw || 'ikke entydig'}. ${row.deadlineIssues.join(' ')}`, 'form-hint'))
          else if (!row.deadlineLocal) fields.append(el('p', 'Frist: Ikke funnet i dokumentet.', 'form-hint'))
          if (row.retainedCorrection) fields.append(el('p', 'Din tidligere avklaring av fristen er beholdt.'))
          const deadlineMode = rowChoice('deadlineMode', fields, 'Frist', [['?', 'Avklar fristen'], ['none', 'Uten frist'], ['value', 'Oppgi dato og klokkeslett']], row.deadlineMode, value => { row.deadlineMode = value })
          rowField('deadlineLocal', fields, 'Dato og klokkeslett i norsk tid', row.deadlineLocal, value => { row.deadlineLocal = value; row.deadlineMode = value ? 'value' : '?' }, 'datetime-local')
          const remaining = rowField('remainingMinutes', fields, 'Gjenstående minutter (tomt = vet ikke)', row.remainingMinutes, value => { row.remainingMinutes = value === '' ? null : Number(value); row.remainingEstimate = null; row.remainingChoice = ''; remainingChoice.value = ''; row.estimateResolved = true }, 'number'); remaining.min = '0'; remaining.step = '1'
          const remainingChoice = rowChoice('remainingChoice', fields, 'Hvor mye arbeid tror du gjenstår?', [['', 'Vet ikke'], ['under30', 'Under 30 min'], ['from30to60', '30–60 min'], ['from60to120', '1–2 timer'], ['from120to240', '2–4 timer'], ['over240', 'Mer enn 4 timer']], row.remainingChoice || '', value => { row.remainingChoice = value; row.remainingEstimate = estimateChoiceRange(value); row.remainingMinutes = null; remaining.value = ''; row.estimateResolved = true })
          if (!row.deadlineLocal && !row.deadlinePromptDismissed) {
            const addDeadline = el('button', 'Legg til frist'); addDeadline.type = 'button'; addDeadline.onclick = () => { row.deadlineMode = 'value'; section.open = true; fields.querySelector('[data-field=deadlineLocal]')?.focus() }
            const dismissDeadline = el('button', 'Ikke spør igjen for denne oppgaven'); dismissDeadline.type = 'button'; dismissDeadline.className = 'secondary'; dismissDeadline.onclick = () => { row.deadlineMode = 'none'; row.deadlinePromptDismissed = true; deadlineMode.value = 'none'; dismissDeadline.textContent = 'Fristpåminnelse slått av' }
            fields.append(addDeadline, dismissDeadline)
          } else if (!row.deadlineLocal) fields.append(el('p', 'Fristpåminnelse er slått av for denne oppgaven. Fristen er fortsatt ukjent.', 'form-hint'))
          if (row.estimateIssue) { fields.append(el('p', row.estimateIssue)); const unknown = el('button', 'Vet ikke'); unknown.type = 'button'; unknown.addEventListener('click', () => { row.remainingMinutes = null; row.remainingEstimate = null; row.remainingChoice = ''; row.estimateResolved = true; remaining.value = ''; remainingChoice.value = '' }); fields.append(unknown) }
          const submitLabel = el('label', 'Skal leveres'), input = el('input'); input.type = 'checkbox'; input.checked = row.requiresSubmission; input.addEventListener('change', () => { row.requiresSubmission = input.checked }); submitLabel.prepend(input); fields.append(submitLabel)
        } else {
          rowChoice('activityKind', fields, 'Aktivitetstype', [['', 'Undervisning / aktivitet fra kilden'], ['exam', 'Eksamen'], ['assessment', 'Annen vurdering'], ['personal', 'Egen aktivitet']], row.activityKind || '', value => { row.activityKind = value; if (value === 'personal') row.courseChoice = ''; renderRows(); renderGroups() })
          const clarifyTime = unresolvedTime(row) || Boolean(row.timeChoice) || row.pointProvenance === 'user'
          if (clarifyTime) {
            if (unresolvedTime(row)) {
              const reason = !row.startLocal ? 'Starttidspunktet mangler eller er ugyldig.' : row.startLocal === row.endLocal ? 'Kilden oppgir samme tidspunkt for start og slutt.' : !row.endLocal || row.endIssues?.length ? row.endRaw || row.originalEnd ? 'Sluttidspunktet er ugyldig.' : 'Sluttidspunktet mangler.' : 'Slutt er før start.'
              fields.append(el('p', `Tidspunkt må avklares: ${reason}`, 'form-hint'))
            }
            rowChoice('timeChoice', fields, 'Hvordan skal tidspunktet brukes?', [['?', 'Avklar tidspunkt'], ['interval', 'Rett tiden'], ['point', 'Vis som tidspunkt uten varighet'], ['omit', 'Ikke importer denne']], row.timeChoice || (row.pointProvenance === 'user' ? 'point' : '?'), value => { chooseDocumentTime(row, value); renderRows(); renderGroups(); updateSummary() })
          }
          const updatePointFromTimes = () => {
            if (!row.point || !row.endLocal) return
            try {
              const start = row.originalStart && row.startLocal === osloLocal(row.originalStart) ? row.originalStart : toInstant(row.startLocal)
              const end = row.originalEnd && row.endLocal === osloLocal(row.originalEnd) ? row.originalEnd : toInstant(row.endLocal)
              if (!(Date.parse(end) > Date.parse(start))) return
              row.point = false; delete row.pointProvenance; row.timeChoice = 'interval'
              const timeChoice = section.querySelector('[data-field=timeChoice]'); if (timeChoice) timeChoice.value = 'interval'
              endInput.parentElement.firstChild.textContent = 'Slutt i norsk tid'
              section.querySelector('[data-point-hint]')?.remove()
              updateRowSummary(); scheduleSummary()
            } catch { /* Incomplete or ambiguous edits keep their validation. */ }
          }
          const startInput = rowField('startLocal', fields, 'Start i norsk tid', row.startLocal, value => { row.startLocal = value; row.startIssues = []; updatePointFromTimes() }, 'datetime-local'); startInput.step = 'any'
          const endInput = rowField('endLocal', fields, row.point ? 'Slutt i norsk tid (valgfri)' : 'Slutt i norsk tid', row.endLocal, value => { row.endLocal = value; row.endIssues = []; updatePointFromTimes() }, 'datetime-local'); endInput.step = 'any'
          if (!clarifyTime) for (const issue of [...(row.startIssues || []), ...(row.endIssues || [])]) fields.append(el('p', issue, 'form-hint'))
          if (row.point) { const hint = el('p', row.pointProvenance === 'user' ? 'Punkt uten varighet, bekreftet av deg. Det reserverer ikke arbeidstid og oppretter ingen frist.' : 'Punkt uten varighet, oppgitt i kilden. Du trenger ikke finne på en sluttid.', 'form-hint'); hint.dataset.pointHint = ''; fields.append(hint) }
          if (row.originalStart || row.originalEnd || row.startRaw || row.endRaw) { const exact = el('details'); exact.dataset.detail = `time-source:${row.index}`; exact.append(el('summary', 'Nøyaktige tidspunkter fra kilden'), ...(row.originalStart ? [el('p', `Norsk tid: ${calendarInstantLabel(row.originalStart, { includeDate: true, forceOffset: true })}${row.originalEnd && !row.sourceRow.point ? ` – ${calendarInstantLabel(row.originalEnd, { includeDate: true, forceOffset: true })}` : ''}`)] : []), el('p', `Kildeverdier: ${row.startRaw || row.originalStart || 'Ukjent start'} – ${row.endRaw || (row.sourceRow.point ? 'punkt uten slutt' : row.originalEnd || 'Ukjent slutt')}. Sekunder og UTC-avvik beholdes så lenge tidspunktene ikke endres.`)); for (const issue of [...(row.sourceRow.startIssues || []), ...(row.sourceRow.endIssues || [])]) exact.append(el('p', issue, 'form-hint')); fields.append(exact) }
          rowField('location', fields, 'Sted (valgfritt)', row.location, value => { row.location = value })
          rowField('description', fields, 'Beskrivelse (valgfritt)', row.description, value => { row.description = value }, 'textarea')
          if (clarifyTime) {
            const more = el('details', undefined, 'document-event-details'); more.dataset.detail = `event:${row.index}`; more.append(el('summary', 'Andre opplysninger og kildeutdrag'))
            const extraFields = el('div', undefined, 'document-preview-fields'); more.append(extraFields)
            for (const input of fields.querySelectorAll('[data-field]')) {
              if (['kind', 'activityKind', 'location', 'description'].includes(input.dataset.field) || input.dataset.field === 'title' && row.title || input.dataset.field === 'courseChoice' && row.courseChoice !== '?') extraFields.append(input.closest('label') || input.parentElement)
            }
            // A valid source start needs no extra typing when the user chooses a
            // point. Both exact fields remain available for deliberate editing.
            if (row.timeChoice !== 'interval') {
              if (row.startLocal && !row.startIssues?.length) extraFields.append(startInput.parentElement)
              extraFields.append(endInput.parentElement)
            }
            more.append(evidence); section.append(more)
          }
        }
      }
      for (const conflict of row.conflicts) {
        const group = el('div', undefined, 'document-conflict'); group.append(el('p', `Både du og kilden har endret ${fieldNames[conflict.field] || conflict.field}.`), el('p', `Tidligere kilde: ${conflict.base ?? 'ukjent'} · Din verdi: ${conflict.local ?? 'ukjent'} · Ny kilde: ${conflict.incoming ?? 'ukjent'}`))
        rowChoice(`conflict:${conflict.field}`, group, `Behold verdi for ${fieldNames[conflict.field] || conflict.field}`, [['', 'Velg verdi'], ['local', 'Behold min verdi'], ['incoming', 'Bruk ny kilde / avklaring']], row.conflictChoices[conflict.field] || '', value => { row.conflictChoices[conflict.field] = value }); section.append(group)
      }
      if (row.kind === 'course' || preview.rows.length < 12) rows.append(section)
      else {
        const key = courseGroupKey(row)
        if (!rowGroups.has(key)) {
          const group = el('details', undefined, 'document-preview-group'); group.dataset.group = key
          group.append(el('summary', `${groupLabel(row)} · ${preview.rows.filter(item => item.kind !== 'course' && courseGroupKey(item) === key).length} oppføringer – vis og velg enkeltvis`))
          group.open = openGroups.has(key); rowGroups.set(key, group)
        }
        const group = rowGroups.get(key); if (row.selected && needsChoice(row) || row.requiresGroupChoice && !row.groupChoiceResolved || rowErrors.length) group.open = true
        group.append(section)
      }
    }
    rows.append(...rowGroups.values())
    for (const node of rows.querySelectorAll('details[data-detail]')) if (openDetails.has(node.dataset.detail)) node.open = true
    identifyButtons(rows)
    showValidationErrors({ focusError })
    updateResolutionControls()
    updateRecovery()
    if (!focusError && active) {
      const section = [...rows.querySelectorAll('.document-preview-row')].find(item => item.dataset.rowKey === active.rowKey)
      ;[...(section?.querySelectorAll('[data-field], [data-control]') || [])].find(input => active.field ? input.dataset.field === active.field : active.control && input.dataset.control === active.control)?.focus({ preventScroll: true })
    }
    if (!focusError && active) window.scrollTo({ top: rowScroll })
  }
  renderRows()
  if (priorRows.size) {
    for (const node of rows.querySelectorAll('.document-preview-row')) if (priorRows.has(node.dataset.rowIndex)) {
      const prior = priorRows.get(node.dataset.rowIndex), row = preview.rows[Number(node.dataset.rowIndex)]
      const newlyResolved = row.kind === 'course' && prior.pending && node.dataset.pending !== 'true' && priorFocus?.rowKey !== node.dataset.rowKey && ![...node.querySelectorAll('input')].some(input => input.validity.badInput)
      node.open = newlyResolved ? false : prior.open
    }
    for (const node of rows.querySelectorAll('.document-preview-group')) if (priorGroups.has(node.dataset.group)) node.open ||= priorGroups.get(node.dataset.group)
    for (const node of rows.querySelectorAll('.document-course-metadata')) if (priorMetadata.has(node.closest('[data-row-index]').dataset.rowIndex)) node.open = priorMetadata.get(node.closest('[data-row-index]').dataset.rowIndex)
    const focus = priorFocus?.field && [...rows.querySelectorAll('[data-field]')].find(node => node.dataset.field === priorFocus.field && node.closest('[data-row-key]')?.dataset.rowKey === priorFocus.rowKey)
    if (priorFocus) { heading.tabIndex = -1; (focus || heading).focus({ preventScroll: true }) }
  }
  renderGroups()
  renderInstitutions()
  const confirmation = el('div', undefined, 'document-confirmation'), actions = el('div', undefined, 'form-actions'), confirm = el('button', 'Importer valgte'); confirm.type = 'submit'; confirm.className = 'primary'; confirm.setAttribute('aria-describedby', confirmationSummary.id)
  const back = el('button', 'Rett'); back.type = 'button'; back.className = 'secondary'; back.addEventListener('click', () => leavePreview()); const refresh = el('button', 'Oppdater forhåndsvisningen'); refresh.type = 'button'; refresh.className = 'secondary'; refresh.hidden = !onRefresh
  refresh.addEventListener('click', () => { try { onRefresh?.() } catch (failure) { error.replaceChildren(el('p', failure.message)) } })
  actions.append(confirm, back); confirmation.append(confirmationSummary, actions); selectionSummary.after(confirmation); sourceDetails.append(refresh)
  if (preview.rows.length > 10) {
    const finishReview = el('button', 'Gå til bekreftelse'); finishReview.type = 'button'; finishReview.className = 'secondary'
    finishReview.onclick = () => { confirm.focus(); confirm.scrollIntoView({ block: 'center' }) }; form.append(finishReview)
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); cancelPreviewSummary(container); error.replaceChildren(); confirm.disabled = true
    try {
      // A native number input can display an unfinished exponent/sign while
      // exposing value="". It must not become an intentional unknown estimate.
      const badInputs = [...rows.querySelectorAll('input[data-field]')].filter(input => input.validity.badInput && preview.rows[Number(input.closest('.document-preview-row').dataset.rowIndex)]?.selected).map(input => ({ index: Number(input.closest('.document-preview-row').dataset.rowIndex), field: input.dataset.field, message: `Rad ${Number(input.closest('.document-preview-row').dataset.rowIndex) + 1}: Feltet har en ufullstendig eller ugyldig verdi. Rett verdien, eller tøm feltet hvis det er valgfritt.` }))
      const result = badInputs.length ? { ok: false, error: 'Avklar de markerte oppføringene. Ingen del av planen er lagret.', errors: badInputs } : buildDocumentImportCommit(getState(), preview)
      if (!result.ok) { error.append(el('p', result.error)); for (const item of result.errors || []) error.append(el('p', item.message)); validationErrors = result.errors || []; showValidationErrors({ focusError: true }); if (!validationErrors.length) { error.tabIndex = -1; error.focus() } return }
      const saved = await onConfirm(result.candidate, result)
      if (!saved?.ok) error.append(el('p', saved?.error || 'Planen kunne ikke lagres. Forhåndsvisningen er beholdt; prøv igjen.'))
    } catch { error.append(el('p', 'Planen kunne ikke lagres. Forhåndsvisningen er beholdt.')) }
    finally { confirm.disabled = false }
  })
  for (const node of form.querySelectorAll('details[data-detail]')) if (priorDetails.has(node.dataset.detail)) node.open = priorDetails.get(node.dataset.detail)
  identifyButtons(form)
  for (const node of form.querySelectorAll('details[data-detail] > summary')) node.dataset.control ||= `summary:${node.parentElement.dataset.detail}`
  if (priorFocus?.control) [...form.querySelectorAll('[data-control]')].find(node => node.dataset.control === priorFocus.control)?.focus({ preventScroll: true })
  if (priorRows.size) window.scrollTo({ top: priorScroll })
  return form
}

export function mountDocumentImport(container, { getState, onCommit, onCancel = () => {}, onCalendar, onUndo } = {}) {
  let explicitSourceForInput = false
  let previewSourceSelection = ''
  let pending, disposed = false, parsed, preview, completed = false, lastSavedSourceId = '', calendarMode = false, snapshotWarnings = [], snapshotName, snapshotOrigin
  const root = el('section', undefined, 'document-import'), inputPanel = el('div'), previewPanel = el('div')
  container.replaceChildren(root); root.append(inputPanel, previewPanel)
  const form = el('form'); inputPanel.append(el('h3', 'Importer fil eller tekst'), el('p', 'Velg kalenderfil (.ics), PDF, DOCX, CSV eller tekst. Kontroller emner og aktiviteter samlet før du bekrefter. Filen leses lokalt. Kalenderfiler er øyeblikksbilder, ikke synkronisering.'), form)
  const fileLabel = el('label', 'Velg fil'), file = el('input'); file.type = 'file'; file.accept = '.txt,.text,.pdf,.docx,.csv,.ics,text/plain,text/csv,text/calendar,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'; fileLabel.append(file); form.append(fileLabel)
  const pasteDetails = el('details'); pasteDetails.append(el('summary', 'Lim inn tekst i stedet')); form.append(pasteDetails)
  const pasteLabel = el('label', 'Eller lim inn tekst'), paste = el('textarea'); paste.rows = 7; paste.placeholder = 'Emne: IBE160 – Programmering\nInnlevering 1, frist 2026-09-16 kl. 14:00'; pasteLabel.append(paste); pasteDetails.append(pasteLabel)
  const resetFile = el('button', 'Lim inn relevant tekst'); resetFile.type = 'button'; resetFile.addEventListener('click', () => { cancelRead('Lesingen er avbrutt. Lim inn teksten og prøv igjen.'); file.value = ''; file.dispatchEvent(new Event('change')); paste.focus() }); pasteDetails.append(resetFile)
  const inputDetails = el('details'); inputDetails.append(el('summary', 'Kilde og kalenderperiode')); form.append(inputDetails)
  const source = choice(inputDetails, 'Ny kilde eller oppdatering', [['', 'Ny kilde (identiske dokumenter gjenkjennes)'], ...(getState().importSources || []).map(item => [item.id, `${item.name} · revisjon ${item.revision}`])], '', () => { explicitSourceForInput = true; showSource() })
  const sourceEvidence = el('div', undefined, 'document-source-evidence'); inputDetails.append(sourceEvidence)
  const refreshSourceOptions = selected => {
    const sources = getState().importSources || []
    source.replaceChildren()
    for (const [value, label] of [['', 'Ny kilde (identiske dokumenter gjenkjennes)'], ...sources.map(item => [item.id, `${item.name} · revisjon ${item.revision}`])]) { const option = el('option', label); option.value = value; source.append(option) }
    source.value = sources.some(item => item.id === selected) ? selected : ''
    return source.value
  }
  const showSource = () => {
    sourceEvidence.replaceChildren()
    const previous = getState().importSources?.find(item => item.id === source.value)
    if (!previous) return
    sourceEvidence.append(el('p', `Valgt kilde: ${previous.name} (${previous.format.toUpperCase()}). Sist lagret: ${new Date(previous.lastUpdated).toLocaleString('nb-NO')} · revisjon ${previous.revision}.`))
    if (previous.complete === false) sourceEvidence.append(el('p', 'Kilden var ufullstendig ved denne importen.'))
    for (const warning of previous.warnings || []) sourceEvidence.append(el('p', warning, 'form-hint'))
  }
  const period = el('details'); period.append(el('summary', 'Avgrens kalenderperioden (valgfritt)')); inputDetails.append(period)
  period.append(el('p', 'Datoene hentes fra filen. Velg en periode hvis du vil begrense gjentakende undervisning.'))
  const periodMode = choice(period, 'Kalenderperiode', [['automatic', 'Automatisk fra filen'], ['manual', 'Velg semester og år']], 'automatic', () => updatePeriod())
  const semester = choice(period, 'Kalendersemester for ICS-undervisning', [['', 'Velg ved kalenderimport'], ['spring', 'Vår'], ['autumn', 'Høst']], '', () => {})
  const year = field(period, 'År for ICS-undervisning', '', () => {}, 'number'); year.min = '1900'; year.max = '2200'
  const updatePeriod = () => { const manual = periodMode.value === 'manual'; for (const input of [semester, year]) { input.disabled = !manual; input.required = manual }; semester.parentElement.hidden = year.parentElement.hidden = !manual }
  const resetPeriod = () => { periodMode.value = 'automatic'; semester.value = ''; year.value = ''; updatePeriod() }
  updatePeriod()
  inputDetails.append(el('p', 'PDF/DOCX: maks 10 MB og PDF maks 100 sider. Tekst/CSV/ICS: maks 2 MB. TXT/CSV, innlimt tekst og uthentet tekst fra PDF/DOCX: maks 1 million tegn i tillegg. Skannede sider må limes inn som tekst eller registreres manuelt.', 'form-hint'))
  let csvOptions = {}
  const clarification = el('section'); form.append(clarification)
  const status = el('p'); status.setAttribute('role', 'status'); form.append(status)
  const errors = el('p'); errors.setAttribute('role', 'alert'); form.append(errors)
  const cancelRead = message => { if (!pending) return; pending.abort(); pending = null; read.disabled = false; stop.hidden = true; status.textContent = ''; errors.textContent = message }
  const actions = el('div', undefined, 'form-actions'), read = el('button', 'Vis forhåndsvisning'), stop = el('button', 'Avbryt lesing'), manual = el('button', 'Registrer uten planforslag'), cancel = el('button', 'Lukk'); read.type = 'submit'; stop.type = manual.type = cancel.type = 'button'; stop.hidden = true; stop.addEventListener('click', () => { cancelRead('Importen ble avbrutt. Ingen data er lagret. Utkastet er beholdt; prøv igjen når du er klar.'); read.focus() }); manual.addEventListener('click', () => { onCancel(); document.querySelector('#new-task')?.click() }); cancel.addEventListener('click', () => { pending?.abort(); pending = null; parsed = null; preview = null; paste.value = ''; file.value = ''; resetPeriod(); snapshotWarnings = []; onCancel() }); actions.append(read, stop, manual, cancel); form.append(actions)
  read.className = 'primary'; manual.className = cancel.className = stop.className = 'secondary'
  for (const input of [file, paste, source, periodMode, semester, year]) input.addEventListener('input', () => cancelRead('Valgene er endret, og den tidligere lesingen er avbrutt. Lag en ny forhåndsvisning.'))
  file.addEventListener('change', () => {
    cancelRead('Valgene er endret. Lag en ny forhåndsvisning.')
    if (!explicitSourceForInput) { source.value = ''; showSource() }
    csvOptions = {}; clarification.replaceChildren(); errors.textContent = ''; status.textContent = ''
    snapshotWarnings = []
    snapshotName = undefined
    snapshotOrigin = undefined
    if (parsed || preview) { resetPeriod(); parsed = null; preview = null }
  })
  paste.addEventListener('input', () => {
    if (file.files[0]) return
    if (!explicitSourceForInput) { source.value = ''; showSource() }
    csvOptions = {}; clarification.replaceChildren(); snapshotWarnings = []; snapshotName = undefined; snapshotOrigin = undefined
    if (parsed || preview) { resetPeriod(); parsed = null; preview = null }
  })
  const readInput = async ({ recognizedCsvOnly = false } = {}) => {
    pending?.abort(); pending = new AbortController(); const request = pending; clarification.replaceChildren(); errors.textContent = ''; status.textContent = 'Leser dokumentet lokalt …'; read.disabled = true; stop.hidden = false
    try {
      const input = file.files[0] || paste.value
      if (!input || typeof input === 'string' && !input.trim()) throw new Error('Velg en fil eller lim inn teksten først.')
      if (periodMode.value === 'manual' && (!semester.value || !year.value)) throw new Error('Velg både semester og år for det manuelle periodefilteret, eller bruk automatisk periode.')
      const result = await parseDocumentInput(input, { ...csvOptions, ...(snapshotName ? { fileName: snapshotName } : {}), ...(periodMode.value === 'manual' ? { semester: semester.value, year: Number(year.value) } : {}), signal: request.signal, onProgress: message => { if (!disposed && pending === request) status.textContent = message } })
      if (disposed || pending !== request || request.signal.aborted) return
      // Only the verified TP family advances automatically from the generic
      // file form. Other CSVs retain their deliberate read and source choice.
      if (recognizedCsvOnly && result.recognizedCsv !== 'tp') return
      recognizedCsvOnly = false
      parsed = result
      if (snapshotOrigin) parsed.origin = snapshotOrigin
      parsed.warnings = [...new Set([...(parsed.warnings || []), ...snapshotWarnings])]
      preview = preview && preview.contentHash === parsed.contentHash && source.value === previewSourceSelection
        ? refreshDocumentImportPreview(getState(), preview, parsed)
        : createDocumentImportPreview(getState(), parsed, { sourceId: source.value || undefined })
      previewSourceSelection = source.value
      await resolveDocumentCourses(preview, { courses: getState().planner?.courses || [], signal: request.signal, onProgress: message => { if (!disposed && pending === request) status.textContent = message } })
      if (disposed || pending !== request || request.signal.aborted) return
      explicitSourceForInput = false
      inputPanel.hidden = true; previewPanel.hidden = false
      const showPreview = () => renderDocumentImportPreview(previewPanel, preview, { getState, onRetry: async () => {
        pending?.abort(); const lookup = new AbortController(); pending = lookup
        retryDocumentCourseNames(preview)
        const progress = el('p'); progress.setAttribute('role', 'status'); previewPanel.prepend(progress)
        try {
          await resolveDocumentCourses(preview, { courses: getState().planner?.courses || [], signal: lookup.signal, onProgress: message => { if (pending === lookup) progress.textContent = message } })
          if (!disposed && pending === lookup && !lookup.signal.aborted) showPreview()
        } catch (failure) { if (!disposed && pending === lookup && !lookup.signal.aborted) progress.textContent = failure.message }
        finally { if (pending === lookup) pending = null }
      }, onRefresh: () => { pending?.abort(); pending = null; preview = refreshDocumentImportPreview(getState(), preview); showPreview() }, onBack: reason => { pending?.abort(); pending = null; previewPanel.hidden = true; inputPanel.hidden = false; if (reason === 'period') { inputDetails.open = true; period.open = true; periodMode.focus() } else file.focus() }, onConfirm: async (candidate, result) => {
        const saved = await onCommit(candidate, result)
        if (saved?.ok) {
          previewNativeDrafts.delete(previewPanel)
          const selected = preview.rows.filter(row => row.selected), omitted = preview.rows.filter(row => row.kind !== 'course' && !row.selected).length, accounting = preview.accounting
          parsed = null; preview = null; completed = true; lastSavedSourceId = result.source.id; resetPeriod(); snapshotWarnings = []; snapshotOrigin = undefined; paste.value = ''; file.value = ''; refreshSourceOptions(lastSavedSourceId); showSource()
          const receipt = el('section', undefined, 'document-import-receipt'); receipt.setAttribute('role', 'status')
          receipt.append(el('h3', 'Importen er lagret'), el('p', `Planen er lagret: ${selected.filter(row => row.kind === 'course').length} emner, ${selected.filter(row => row.kind === 'event').length} kalenderaktiviteter og ${selected.filter(row => row.kind === 'task').length} oppgaver. ${result.counts.added} nye, ${result.counts.updated} oppdaterte og ${result.counts.unchanged} uendrede oppføringer.`), el('p', `${omitted} aktiviteter eller oppgaver utelatt av utvalget.${accounting ? ` Kilden hadde ${accounting.filtered} oppføringer utenfor perioden, ${accounting.rejected} avviste og ${accounting.partial || 0} delvis beholdte.` : ''}`), el('p', `Kilde: ${result.source.origin?.kind === 'link' ? 'øyeblikksbilde fra kalenderlenke' : result.source.name}. Importen er en kopi og oppdateres ikke automatisk.`))
          const receiptActions = el('div', undefined, 'form-actions'), receiptError = el('p'); receiptError.setAttribute('role', 'alert')
          if (onCalendar) { const calendar = el('button', 'Åpne kalenderen'); calendar.type = 'button'; calendar.className = 'primary'; calendar.onclick = onCalendar; receiptActions.append(calendar) }
          if (onUndo && saved.historyEntryId) {
            const undo = el('button', 'Angre importen'); undo.type = 'button'; undo.className = 'secondary'
            undo.onclick = async () => { undo.disabled = true; const restored = await onUndo(saved.historyEntryId); if (restored?.ok) { const heading = el('h3', 'Importen er angret'); heading.tabIndex = -1; receipt.replaceChildren(heading, el('p', 'De tidligere opplysningene er gjenopprettet.')); receipt.append(receiptActions); undo.remove(); heading.focus({ preventScroll: true }) } else { receiptError.textContent = restored?.error || 'Importen kunne ikke angres. Opplysningene er beholdt.'; undo.disabled = false } }
            receiptActions.append(undo)
          }
          const done = el('button', 'Tilbake til Mine emner'); done.type = 'button'; done.className = 'secondary'; done.addEventListener('click', () => { previewPanel.replaceChildren(); previewPanel.hidden = true; inputPanel.hidden = false; completed = false; onCancel() }); receiptActions.append(done)
          receipt.append(receiptActions, receiptError); previewPanel.replaceChildren(receipt); receipt.querySelector('h3').tabIndex = -1; receipt.querySelector('h3').focus()
        }
        return saved
      } })
      showPreview()
      const heading = previewPanel.querySelector('h3'); heading.tabIndex = -1; heading.focus(); heading.scrollIntoView({ block: 'nearest' }); status.textContent = ''
    } catch (error) { if (!disposed && pending === request && (!recognizedCsvOnly || error.clarification)) { errors.textContent = error.message; status.textContent = ''
      if (error.clarification) {
        const sample = error.clarification.sample || ''
        const readableSample = sample.split('\n').map(line => line.includes(': ') ? `Eksempel: ${line.slice(line.indexOf(': ') + 2)}` : line).join('\n')
        clarification.replaceChildren(el('h4', error.clarification.kind === 'encoding' ? 'Ser teksten riktig ut?' : 'Velg opplysningene du vil bruke'), el('p', readableSample, 'document-csv-sample'))
        if (error.clarification.kind === 'encoding') {
          const yes = el('button', 'Ja, teksten ser riktig ut'); yes.type = 'button'; yes.disabled = !error.clarification.suggestedEncoding
          yes.onclick = () => { csvOptions.encoding = error.clarification.suggestedEncoding; form.requestSubmit() }; clarification.append(yes)
          const details = el('details'); details.append(el('summary', 'Tekstdetaljer og annen tegnkoding')); clarification.append(details)
          details.append(el('p', sample, 'document-csv-technical'))
          choice(details, 'Tegnkoding for CSV', [['', 'Velg tegnkoding'], ['windows-1252', 'Windows-1252 (vestlig tekst)'], ['utf-8', 'UTF-8'], ['utf-16le', 'UTF-16 LE'], ['utf-16be', 'UTF-16 BE']], csvOptions.encoding || '', value => { csvOptions.encoding = value })
        } else for (const item of error.clarification.fields) {
          const [caption, placeholder] = csvQuestions[item.key] || ['Hvilke opplysninger vil du bruke?', 'Velg opplysning']
          clarification.append(el('p', caption)); if (item.comparison?.length) clarification.append(el('p', `Samme oppføringer i alternativene: ${item.comparison.map(row => [row.course, row.date].filter(Boolean).join(' · ') || 'Dato mangler i kilden').join(' / ')}`))
          const exampleTexts = item.options.map(value => (item.examples?.find(example => example.column === value)?.values || []).join(' / ') || '(tomt)')
          const longExamples = exampleTexts.some(text => text.length > 180)
          // Native selects clip long common prefixes. Numbered, wrapped text
          // gives each option a readable full bounded preview on narrow screens.
          const optionLabels = exampleTexts.map((text, index) => longExamples ? `Alternativ ${index + 1}: ${text.length > 100 ? `… ${text.slice(-100)}` : text}` : text)
          if (longExamples) exampleTexts.forEach((text, index) => clarification.append(el('p', `Alternativ ${index + 1}: ${text}`, 'document-csv-alternative')))
          choice(clarification, caption, [['', placeholder], ...item.options.map((value, index) => [value, optionLabels[index]])], csvOptions.columns?.[item.key] || '', value => { csvOptions.columns ||= {}; csvOptions.columns[item.key] = value })
          const details = el('details'); details.append(el('summary', 'Kolonnedetaljer'), el('p', sample, 'document-csv-technical'))
          for (const value of item.options) details.append(el('p', `${value}: ${(item.examples?.find(example => example.column === value)?.values || []).join(' / ') || '(tomt)'}`))
          clarification.append(details)
        }
        clarification.tabIndex = -1; clarification.focus(); clarification.scrollIntoView({ block: 'nearest' })
      }
    } }
    finally { if (pending === request) { pending = null; read.disabled = false; stop.hidden = true; if (recognizedCsvOnly) status.textContent = '' } }
  }
  form.addEventListener('submit', event => { event.preventDefault(); readInput() })
  const cleanup = () => { disposed = true; cancelPreviewSummary(previewPanel); previewNativeDrafts.delete(previewPanel); pending?.abort(); pending = null; parsed = null; preview = null }
  cleanup.cancelPending = () => cancelRead('Lesingen er avbrutt. Utkastet er beholdt.')
  cleanup.hasDraft = () => !disposed && Boolean(pending || parsed || preview || paste.value.trim() || file.files.length)
  cleanup.open = ({ calendar = false, newSource = false } = {}) => {
    if (disposed) return
    if (completed) { previewPanel.replaceChildren(); previewPanel.hidden = true; inputPanel.hidden = false; completed = false; refreshSourceOptions(''); showSource() }
    if (!cleanup.hasDraft()) {
      snapshotName = undefined
      snapshotOrigin = undefined
      resetPeriod(); period.open = false; inputDetails.open = false
      calendarMode = calendar
      inputPanel.querySelector('h3').textContent = calendar ? 'Importer kalenderfil' : 'Importer fil eller tekst'
      read.textContent = 'Vis forhåndsvisning'
      pasteLabel.hidden = resetFile.hidden = manual.hidden = calendar
      if (newSource) { explicitSourceForInput = false; refreshSourceOptions(''); showSource() }
    }
    file.focus(); file.scrollIntoView({ block: 'nearest' })
  }
  cleanup.loadSnapshot = (calendar, warnings = [], metadata = {}) => {
    if (disposed) return
    if (cleanup.hasDraft()) throw new Error('Du har et importutkast. Fullfør eller lukk utkastet før du henter et nytt øyeblikksbilde. Utkastet er beholdt.')
    inputPanel.hidden = false; previewPanel.hidden = true
    snapshotName = 'Kalenderlenke – øyeblikksbilde'
    const origin = { kind: 'link', ...(metadata.sourceUrl ? { publicUrl: metadata.sourceUrl } : {}) }
    snapshotOrigin = validDocumentOrigin(origin) ? origin : { kind: 'link' }
    cancelRead(''); explicitSourceForInput = false; parsed = null; preview = null; completed = false; resetPeriod(); refreshSourceOptions(''); showSource(); file.value = ''; paste.value = calendar; snapshotWarnings = ['Kalenderlenken importeres som et øyeblikksbilde. Den oppdateres ikke automatisk.', ...warnings]; form.requestSubmit()
  }
  cleanup.selectSource = id => { if (!disposed) { cancelRead('Kildevalget er endret. Lag en ny forhåndsvisning.'); if (!refreshSourceOptions(id)) { errors.textContent = 'Dokumentkilden finnes ikke lenger. Velg en annen kilde eller start en ny import.'; return false } explicitSourceForInput = true; showSource(); inputDetails.open = true; previewPanel.hidden = true; inputPanel.hidden = false; completed = false; file.focus(); return true } }
  return cleanup
}
