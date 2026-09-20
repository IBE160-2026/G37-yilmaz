import { DOCUMENT_LIMITS } from './document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, refreshDocumentConflicts, changeDocumentRowKind } from './import-preview.js'
import './document-import.css'

export { createDocumentImportPreview, buildDocumentImportCommit } from './import-preview.js'
const formats = { txt: 'text', text: 'text', pdf: 'pdf', docx: 'docx', csv: 'csv', ics: 'ics' }
export async function parseDocumentInput(input, { fileName = input?.name || 'Innlimt studieplan', format, semester, year, signal, onProgress = () => {}, workerFactory = () => new Worker(new URL('./document-parser.worker.js', import.meta.url), { type: 'module' }) } = {}) {
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
    worker.onmessage = ({ data }) => { if (data?.documentImport !== true) return; data.progress ? onProgress(data.progress) : finish(data.ok ? null : new Error(data.error || 'Dokumentet kunne ikke leses.'), data.parsed) }
    worker.onerror = () => finish(new Error('Dokumentet kunne ikke leses lokalt. Prøv tekst eller et enklere dokument; ingen data er lagret.'))
    worker.postMessage({ buffer, options: { format, semester, year } }, [buffer])
  })
}

const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node }
function select(options, value, onChange) {
  const input = el('select')
  for (const [key, label] of options) { const option = el('option', label); option.value = key; input.append(option) }
  input.value = value ?? ''; input.addEventListener('change', () => onChange(input.value)); return input
}
function field(parent, label, value, onChange, type = 'text') {
  const wrapper = el('label', label), input = el(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') input.type = type; else input.rows = 4; input.value = value ?? ''; input.addEventListener('input', () => onChange(input.value)); wrapper.append(input); parent.append(wrapper); return input
}
function choice(parent, label, options, value, onChange) {
  const wrapper = el('div'), caption = el('label', label), input = select(options, value, onChange)
  input.id = `document-choice-${crypto.randomUUID()}`; caption.htmlFor = input.id
  wrapper.append(caption, input); parent.append(wrapper); return input
}
const typeNames = { course: 'Emne', task: 'Oppgave / frist', event: 'Fast undervisning / aktivitet' }
const rowTypeName = row => row.kind === 'event' && (row.information || row.transparent) ? 'Informasjon' : typeNames[row.kind]
const fieldNames = { title: 'navn', name: 'emnenavn', deadlineLocal: 'frist', remainingMinutes: 'gjenstående minutter', courseId: 'emne', course: 'emne', start: 'start', end: 'slutt', location: 'sted', description: 'beskrivelse', semester: 'semester', year: 'år' }
const courseOptionLabel = course => {
  const identity = [course.code, course.name].filter(Boolean).join(' · ') || 'Emne uten navn'
  const period = course.semester && course.year ? `${course.semester === 'spring' ? 'Vår' : 'Høst'} ${course.year}` : ''
  return [identity, course.university, period, course.campus ? `Campus: ${course.campus}` : ''].filter(Boolean).join(' · ')
}

export function renderDocumentImportPreview(container, preview, { getState, onConfirm, onBack } = {}) {
  const state = getState(), form = el('form', undefined, 'document-preview'), heading = el('h3', 'Kontroller planen før import')
  form.noValidate = true
  container.replaceChildren(form); form.append(heading, el('p', `${preview.rows.length} oppføringer fra ${preview.displayName || preview.name}. Velg det du vil lagre, og avklar manglende opplysninger. Ingenting lagres før du bekrefter.`))
  if (preview.complete === false) form.append(el('p', 'Kilden er ufullstendig. Kontroller varslene og legg til manglende opplysninger senere.', 'form-hint'))
  for (const warning of preview.warnings) form.append(el('p', warning, 'form-hint'))
  if (preview.previousRevision) form.append(el('p', `Oppdaterer dokumentkilde, revisjon ${preview.previousRevision}. Lokale endringer og oppføringer som ikke velges, blir beholdt.`))
  const error = el('div'); error.setAttribute('role', 'alert'); form.append(error)
  const rows = el('div', undefined, 'document-preview-rows'); form.append(rows)
  let validationErrors = []
  const showValidationErrors = ({ focusError = false } = {}) => {
    for (const input of rows.querySelectorAll('[aria-invalid]')) { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby') }
    for (const message of rows.querySelectorAll('.document-field-error')) message.remove()
    for (const [index, item] of validationErrors.entries()) {
      const section = [...rows.children].find(section => Number(section.dataset.rowIndex) === item.index)
      if (!section) continue
      section.open = true
      const inputs = [...section.querySelectorAll('[data-field]')], input = inputs.find(input => input.dataset.field === item.field) || inputs.find(input => input.dataset.field === 'selected')
      const message = el('p', item.message, 'document-field-error'); message.id = `document-error-${item.index}-${index}`
      input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' ')); section.append(message)
    }
    if (focusError) { const input = rows.querySelector('[aria-invalid=true]'); input?.focus(); input?.scrollIntoView({ block: 'nearest' }) }
  }
  const renderRows = ({ focusError = false } = {}) => {
    const openRows = new Set([...rows.children].filter(section => section.open).map(section => Number(section.dataset.rowIndex))), firstRender = !rows.children.length
    const active = document.activeElement?.closest?.('.document-preview-row') && document.activeElement?.dataset.field ? { index: Number(document.activeElement.closest('.document-preview-row').dataset.rowIndex), field: document.activeElement.dataset.field } : null
    const retainedNativeInputs = [...rows.querySelectorAll('input[data-field]')].filter(input => input.validity.badInput).map(input => ({ index: Number(input.closest('.document-preview-row').dataset.rowIndex), field: input.dataset.field, input }))
    refreshDocumentConflicts(getState(), preview); rows.replaceChildren()
    for (const row of preview.rows) {
      const rowErrors = validationErrors.filter(error => error.index === row.index)
      const section = el('details', undefined, 'document-preview-row'); section.dataset.rowIndex = row.index; section.open = rowErrors.length > 0 || openRows.has(row.index) || firstRender && (preview.rows.length < 8 || row.index === 0)
      const mark = (key, input) => { input.dataset.field = key; return input }
      const rowField = (key, ...args) => mark(key, field(...args)), rowChoice = (key, ...args) => mark(key, choice(...args))
      const summary = el('summary', `${row.index + 1}. ${rowTypeName(row)} · ${row.title || 'Mangler navn'}${row.selected ? ' · valgt' : ' · utelatt'}`); section.append(summary)
      const selectedLabel = el('label', 'Ta med i planen'), selected = mark('selected', el('input')); selected.type = 'checkbox'; selected.checked = row.selected; selected.addEventListener('change', () => { row.selected = selected.checked; summary.textContent = `${row.index + 1}. ${rowTypeName(row)} · ${row.title || 'Mangler navn'}${row.selected ? ' · valgt' : ' · utelatt'}` }); selectedLabel.prepend(selected); section.append(selectedLabel)
      const snippet = el('blockquote'); snippet.append(el('strong', row.position), el('p', row.snippet)); section.append(snippet)
      if (row.unsupported) section.append(el('p', 'Denne oppføringen kunne ikke tolkes sikkert. Velg riktig type og korriger feltene hvis du vil ta den med.', 'form-hint'))
      if (row.sourceStatus) section.append(el('p', `Oppgavestatus i kilden: ${row.sourceStatus}.`))
      if (row.statusNeedsChoice) {
        section.append(el('p', 'Ferdige og avlyste gjøremål velges ikke automatisk. Nye oppgaver blir åpne; eksisterende oppgaver beholder lokal ferdigstatus. Import bekrefter aldri levering.', 'form-hint'))
        rowChoice('statusChoice', section, 'Avklar oppgavestatus', [['?', 'Avklar eller utelat oppføringen'], ['open', 'Ta med uten å overta kildestatus']], row.statusChoice, value => { row.statusChoice = value })
      }
      if (row.groupHint && !(row.information || row.transparent)) section.append(el('p', `Gruppe/aktivitet i kilden: ${row.groupHint}. Kontroller at denne tilhører deg.`))
      if (row.kind === 'event' && (row.information || row.transparent)) section.append(el('p', 'Informasjonsoppføring: reserverer ikke arbeidstid.'))
      if (row.kind === 'event' && row.cancelled) section.append(el('p', 'Kilden avlyser denne aktiviteten. Den tas ut av opptatt kapasitet når du bekrefter, mens tidligere opplysninger bevares.'))
      if (row.matchCandidates.length) rowChoice('matchChoice', section, 'Koble til tidligere oppføring', [['?', 'Avklar oppføring'], ['new', 'Opprett som ny'], ...row.matchCandidates.map(item => [item.key, `${item.title} (${item.targetId})`])], row.matchChoice, value => { row.matchChoice = value; renderRows() })
      if (row.deletedLocally) {
        const wrapper = el('label', 'Oppføringen er slettet lokalt. Opprett den igjen.'), input = mark('recreate', el('input')); input.type = 'checkbox'; input.checked = row.recreate; input.addEventListener('change', () => { row.recreate = input.checked }); wrapper.prepend(input); section.append(wrapper)
      }
      if (row.typeChanged) {
        section.append(el('p', `Tidligere type: ${typeNames[row.previousKind]}. Ved erstatning fjernes den tidligere oppføringen og opprettes som ${typeNames[row.kind].toLocaleLowerCase('nb-NO')} med samme ID. Koblinger til annet arbeid må beholdes.`, 'form-hint'))
        rowChoice('typeChangeChoice', section, 'Avklar endret type', [['?', 'Velg hva som skal skje'], ['retain', 'Behold tidligere type og opplysninger'], ['replace', 'Erstatt tidligere oppføring med valgt type']], row.typeChangeChoice, value => { if (value === 'retain') changeDocumentRowKind(getState(), preview, row, row.previousKind); else row.typeChangeChoice = value; renderRows() })
      }
      const fields = el('div', undefined, 'document-preview-fields'); section.append(fields)
      rowChoice('kind', fields, 'Type oppføring', Object.entries({...typeNames,...(row.information || row.transparent ? {event:'Informasjon'} : {})}), row.kind, value => { changeDocumentRowKind(getState(), preview, row, value); renderRows() })
      rowField('title', fields, row.kind === 'course' ? 'Emnenavn' : 'Navn', row.title, value => { row.title = value })
      if (row.kind === 'course') {
        rowChoice('courseTarget', fields, 'Eksisterende eller nytt emne', [['', 'Opprett nytt emne'], ...(state.planner?.courses || []).map(course => [course.id, courseOptionLabel(course)])], row.courseTarget, value => { row.courseTarget = value })
        if (row.reference || row.courseTarget && !row.matchEntryKey) fields.append(el('p', 'Dette er en kobling til et eksisterende emne. Emnets opplysninger og kildeeierskap beholdes.', 'form-hint'))
        rowField('code', fields, 'Emnekode (valgfritt)', row.code, value => { row.code = value })
        rowField('university', fields, 'Institusjon (valgfritt)', row.university, value => { row.university = value })
        rowChoice('semester', fields, 'Kalendersemester', [['', 'Velg semester'], ['spring', 'Vår'], ['autumn', 'Høst']], row.semester, value => { row.semester = value })
        const year = rowField('year', fields, 'År', row.year, value => { row.year = value }, 'number'); year.min = '1900'; year.max = '2200'
        const credits = rowField('credits', fields, 'Studiepoeng (valgfritt)', row.credits, value => { row.credits = value }, 'number'); credits.min = '0'; credits.step = '0.5'
      } else {
        const courseOptions = [['?', 'Avklar emne'], ['', 'Uten emne'], ...(state.planner?.courses || []).map(course => [course.id, courseOptionLabel(course)]), ...preview.rows.filter(item => item.kind === 'course').map(item => [`row:${item.index}`, `${item.code || ''} ${item.title} (fra dokumentet)`])]
        rowChoice('courseChoice', fields, row.courseHint ? `Emne (i kilden: ${row.courseHint})` : 'Emne (valgfritt)', courseOptions, row.courseChoice, value => { row.courseChoice = value })
        if (row.kind === 'task') {
          if (row.deadlineRaw || row.deadlineIssues.length) fields.append(el('p', `Frist i kilden: ${row.deadlineRaw || 'ikke entydig'}. ${row.deadlineIssues.join(' ')}`, 'form-hint'))
          if (row.retainedCorrection) fields.append(el('p', 'Din tidligere avklaring av fristen er beholdt.'))
          rowChoice('deadlineMode', fields, 'Frist', [['?', 'Avklar fristen'], ['none', 'Uten frist'], ['value', 'Oppgi dato og klokkeslett']], row.deadlineMode, value => { row.deadlineMode = value })
          rowField('deadlineLocal', fields, 'Dato og klokkeslett i norsk tid', row.deadlineLocal, value => { row.deadlineLocal = value; row.deadlineMode = value ? 'value' : '?' }, 'datetime-local')
          const remaining = rowField('remainingMinutes', fields, 'Gjenstående minutter (tomt = vet ikke)', row.remainingMinutes, value => { row.remainingMinutes = value === '' ? null : Number(value); row.estimateResolved = true }, 'number'); remaining.min = '0'; remaining.step = '1'
          if (row.estimateIssue) { fields.append(el('p', row.estimateIssue)); const unknown = el('button', 'Vet ikke'); unknown.type = 'button'; unknown.addEventListener('click', () => { row.remainingMinutes = null; row.estimateResolved = true; remaining.value = '' }); fields.append(unknown) }
          const submitLabel = el('label', 'Skal leveres'), input = el('input'); input.type = 'checkbox'; input.checked = row.requiresSubmission; input.addEventListener('change', () => { row.requiresSubmission = input.checked }); submitLabel.prepend(input); fields.append(submitLabel)
        } else {
          if (!row.startLocal || !row.endLocal) fields.append(el('p', `Start/slutt må avklares. ${row.startRaw || row.deadlineRaw || ''} ${row.endRaw || ''}. Ingen arbeidstid er utledet fra undervisningen.`, 'form-hint'))
          rowField('startLocal', fields, 'Start i norsk tid', row.startLocal, value => { row.startLocal = value }, 'datetime-local')
          rowField('endLocal', fields, 'Slutt i norsk tid', row.endLocal, value => { row.endLocal = value }, 'datetime-local')
          rowField('location', fields, 'Sted (valgfritt)', row.location, value => { row.location = value })
          rowField('description', fields, 'Beskrivelse (valgfritt)', row.description, value => { row.description = value }, 'textarea')
        }
      }
      for (const conflict of row.conflicts) {
        const group = el('div', undefined, 'document-conflict'); group.append(el('p', `Både du og kilden har endret ${fieldNames[conflict.field] || conflict.field}.`), el('p', `Tidligere kilde: ${conflict.base ?? 'ukjent'} · Din verdi: ${conflict.local ?? 'ukjent'} · Ny kilde: ${conflict.incoming ?? 'ukjent'}`))
        rowChoice(`conflict:${conflict.field}`, group, `Behold verdi for ${fieldNames[conflict.field] || conflict.field}`, [['', 'Velg verdi'], ['local', 'Behold min verdi'], ['incoming', 'Bruk ny kilde / avklaring']], row.conflictChoices[conflict.field] || '', value => { row.conflictChoices[conflict.field] = value }); section.append(group)
      }
      rows.append(section)
    }
    for (const retained of retainedNativeInputs) {
      const section = [...rows.children].find(item => Number(item.dataset.rowIndex) === retained.index)
      const replacement = [...(section?.querySelectorAll('[data-field]') || [])].find(input => input.dataset.field === retained.field)
      if (replacement) replacement.replaceWith(retained.input)
    }
    showValidationErrors({ focusError })
    if (!focusError && active) {
      const section = [...rows.children].find(item => Number(item.dataset.rowIndex) === active.index)
      ;[...(section?.querySelectorAll('[data-field]') || [])].find(input => input.dataset.field === active.field)?.focus()
    }
  }
  renderRows()
  const actions = el('div', undefined, 'form-actions'), confirm = el('button', 'Bekreft valgt plan'); confirm.type = 'submit'; confirm.className = 'primary'
  const back = el('button', 'Tilbake til dokumentet'); back.type = 'button'; back.addEventListener('click', onBack); actions.append(confirm, back); form.append(actions)
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.replaceChildren(); confirm.disabled = true
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
  return form
}

export function mountDocumentImport(container, { getState, onCommit, onCancel = () => {} } = {}) {
  let pending, disposed = false, parsed, preview, completed = false, lastSavedSourceId = ''
  const root = el('section', undefined, 'document-import'), inputPanel = el('div'), previewPanel = el('div')
  container.replaceChildren(root); root.append(inputPanel, previewPanel)
  const form = el('form'); inputPanel.append(el('h3', 'Importer dokument eller tekst'), el('p', 'Les en studieplan, oppgavetekst eller kalender på denne enheten. Bare valgte opplysninger og korte kildeutdrag lagres; originalfilen beholdes ikke.'), form)
  const fileLabel = el('label', 'Velg fil'), file = el('input'); file.type = 'file'; file.accept = '.txt,.text,.pdf,.docx,.csv,.ics,text/plain,text/csv,text/calendar,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'; fileLabel.append(file); form.append(fileLabel)
  const pasteLabel = el('label', 'Eller lim inn tekst'), paste = el('textarea'); paste.rows = 7; paste.placeholder = 'Emne: IBE160 – Programmering\nInnlevering 1, frist 2026-09-16 kl. 14:00'; pasteLabel.append(paste); form.append(pasteLabel)
  const resetFile = el('button', 'Bruk innlimt tekst'); resetFile.type = 'button'; resetFile.addEventListener('click', () => { cancelRead('Lesingen er avbrutt. Lim inn teksten og prøv igjen.'); file.value = ''; paste.focus() }); form.append(resetFile)
  const source = choice(form, 'Ny kilde eller oppdatering', [['', 'Ny kilde (identiske dokumenter gjenkjennes)'], ...(getState().importSources || []).map(item => [item.id, `${item.name} · revisjon ${item.revision}`])], '', () => showSource())
  const sourceEvidence = el('div', undefined, 'document-source-evidence'); form.append(sourceEvidence)
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
    sourceEvidence.append(el('p', `Sist lagret: ${new Date(previous.lastUpdated).toLocaleString('nb-NO')} · revisjon ${previous.revision}.`))
    if (previous.complete === false) sourceEvidence.append(el('p', 'Kilden var ufullstendig ved denne importen.'))
    for (const warning of previous.warnings || []) sourceEvidence.append(el('p', warning, 'form-hint'))
  }
  const semester = choice(form, 'Kalendersemester for ICS-undervisning', [['', 'Velg ved kalenderimport'], ['spring', 'Vår'], ['autumn', 'Høst']], '', () => {})
  const year = field(form, 'År for ICS-undervisning', '', () => {}, 'number'); year.min = '1900'; year.max = '2200'
  form.append(el('p', 'PDF/DOCX: maks 10 MB og PDF maks 100 sider. Tekst/CSV/ICS: maks 2 MB. Skannede sider må limes inn som tekst eller registreres manuelt.', 'form-hint'))
  const status = el('p'); status.setAttribute('role', 'status'); form.append(status)
  const errors = el('p'); errors.setAttribute('role', 'alert'); form.append(errors)
  const cancelRead = message => { if (!pending) return; pending.abort(); pending = null; read.disabled = false; stop.hidden = true; status.textContent = ''; errors.textContent = message }
  const actions = el('div', undefined, 'form-actions'), read = el('button', 'Lag forhåndsvisning'), stop = el('button', 'Avbryt lesing'), cancel = el('button', 'Lukk dokumentimport'); read.type = 'submit'; stop.type = cancel.type = 'button'; stop.hidden = true; stop.addEventListener('click', () => { cancelRead('Importen ble avbrutt. Ingen data er lagret. Utkastet er beholdt; prøv igjen når du er klar.'); read.focus() }); cancel.addEventListener('click', () => { pending?.abort(); pending = null; parsed = null; preview = null; paste.value = ''; file.value = ''; onCancel() }); actions.append(read, stop, cancel); form.append(actions)
  for (const input of [file, paste, source, semester, year]) input.addEventListener('input', () => cancelRead('Valgene er endret, og den tidligere lesingen er avbrutt. Lag en ny forhåndsvisning.'))
  form.addEventListener('submit', async event => {
    event.preventDefault(); pending?.abort(); pending = new AbortController(); const request = pending; errors.textContent = ''; status.textContent = 'Leser dokumentet lokalt …'; read.disabled = true; stop.hidden = false
    try {
      const input = file.files[0] || paste.value
      if (!input || typeof input === 'string' && !input.trim()) throw new Error('Velg en fil eller lim inn teksten først.')
      const result = await parseDocumentInput(input, { semester: semester.value, year: year.value ? Number(year.value) : undefined, signal: request.signal, onProgress: message => { if (!disposed && pending === request) status.textContent = message } })
      if (disposed || pending !== request || request.signal.aborted) return
      parsed = result
      preview = createDocumentImportPreview(getState(), parsed, { sourceId: source.value || undefined })
      inputPanel.hidden = true; previewPanel.hidden = false
      renderDocumentImportPreview(previewPanel, preview, { getState, onBack: () => { previewPanel.hidden = true; inputPanel.hidden = false; read.focus() }, onConfirm: async (candidate, result) => {
        const saved = await onCommit(candidate, result)
        if (saved?.ok) { parsed = null; preview = null; completed = true; lastSavedSourceId = result.source.id; paste.value = ''; file.value = ''; refreshSourceOptions(lastSavedSourceId); showSource(); previewPanel.replaceChildren(el('p', `Planen er lagret: ${result.counts.added} nye, ${result.counts.updated} oppdaterte og ${result.counts.unchanged} uendrede oppføringer.`)); const done = el('button', 'Tilbake til Mine emner'); done.type = 'button'; done.addEventListener('click', () => { previewPanel.replaceChildren(); previewPanel.hidden = true; inputPanel.hidden = false; completed = false; onCancel() }); previewPanel.append(done) }
        return saved
      } })
      previewPanel.querySelector('h3')?.scrollIntoView({ block: 'nearest' }); status.textContent = ''
    } catch (error) { if (!disposed && pending === request) { errors.textContent = error.message; status.textContent = '' } }
    finally { if (pending === request) { pending = null; read.disabled = false; stop.hidden = true } }
  })
  const cleanup = () => { disposed = true; pending?.abort(); pending = null; parsed = null; preview = null }
  cleanup.hasDraft = () => !disposed && Boolean(pending || parsed || preview || paste.value.trim() || file.files.length)
  cleanup.open = () => { if (!disposed && completed) { previewPanel.replaceChildren(); previewPanel.hidden = true; inputPanel.hidden = false; completed = false; refreshSourceOptions(lastSavedSourceId); showSource() } }
  cleanup.selectSource = id => { if (!disposed) { cancelRead('Kildevalget er endret. Lag en ny forhåndsvisning.'); if (!refreshSourceOptions(id)) { errors.textContent = 'Dokumentkilden finnes ikke lenger. Velg en annen kilde eller start en ny import.'; return false } showSource(); previewPanel.hidden = true; inputPanel.hidden = false; completed = false; file.focus(); return true } }
  return cleanup
}
