import { previewBackup, previewLocalRecovery, downloadBackup, exportBackup } from './backup.js'
import { formatDay, formatDeadline } from './calendar.js'
import { osloLocal } from './planner.js'
const node = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el }
const button = (text, action) => { const el = node('button', text); el.type = 'button'; el.className = 'secondary'; el.onclick = action; return el }
export function displayTimestamp(value) {
  try {
    if (typeof value !== 'string' || !value.trim()) return 'Tidspunkt ikke oppgitt entydig i filen'
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${formatDay(value, { year: true })} (klokkeslett ikke oppgitt)`
    if (/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(value.trim()) && Number.isFinite(Date.parse(value))) return formatDeadline(osloLocal(new Date(Date.parse(value)).toISOString()), { year: true })
    return `${value} (tidssone eller klokkeslett ikke entydig oppgitt)`
  } catch { return 'Tidspunkt kunne ikke vises. Opplysningene i sikkerhetskopien er uendret' }
}
export function createDataTools(actions) {
  const host = node('section'); host.id = 'settings-panel'; host.className = 'data-tools settings-panel panel'; host.setAttribute('aria-label', 'Innstillinger')
  document.querySelector('#workspace').before(host)
  const notice = node('section'); notice.className = 'contextual-undo'; notice.hidden = true; host.before(notice)
  const noticeText = node('p'); noticeText.setAttribute('aria-live', 'polite'); noticeText.setAttribute('aria-atomic', 'true')
  let notifiedId = null, undoConfirmed = false
  const feedback = node('p'); feedback.setAttribute('role', 'status')
  const dialog = node('dialog'); dialog.className = 'editor-dialog data-dialog'; document.body.append(dialog)
  let opener, preview, signature = ''
  const close = () => { dialog.close(); preview = null; opener?.focus({ preventScroll: true }) }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  const open = title => { opener = document.activeElement; dialog.replaceChildren(node('h2', title)); dialog.firstChild.id = 'data-dialog-title'; dialog.setAttribute('aria-labelledby', 'data-dialog-title'); dialog.showModal() }
  const report = result => { feedback.textContent = result?.ok ? 'Opplysningene er gjenopprettet.' : result?.error || 'Kunne ikke lagre. Dataene er beholdt.'; return result?.ok }
  const undo = button('Angre siste endring', () => report(actions.undo()))
  const trash = button('Papirkurv', () => { open('Papirkurv'); renderTrash() })
  function renderTrash() {
    const heading = dialog.firstChild; dialog.replaceChildren(heading)
    const entries = actions.state().history?.trash || []
    dialog.append(node('p', 'Slettede opplysninger lagres bare på denne enheten. Gjenoppretting endrer ikke universitetets systemer.'))
    for (const entry of entries) {
      const row = node('article'); row.append(node('p', `${entry.label} · ${displayTimestamp(entry.at)}`))
      row.append(button('Gjenopprett', () => { const result = actions.restoreTrash(entry.id); if (result.ok) renderTrash(); else { const error = node('p', result.error); error.setAttribute('role', 'alert'); row.append(error) } })); dialog.append(row)
    }
    if (!entries.length) dialog.append(node('p', 'Papirkurven er tom.'))
    dialog.append(button('Lukk', close))
  }
  const save = button('Eksporter sikkerhetskopi', () => { try { downloadBackup(exportBackup(actions.state())); feedback.textContent = 'Lokal fil er laget. Abonnementslenker og innlogging er utelatt; kilder må kobles til igjen ved gjenoppretting.' } catch (error) { feedback.textContent = error.message } })
  const input = node('input'); input.type = 'file'; input.accept = '.json,application/json'; input.id = 'backup-file'; input.hidden = true
  const restore = button('Importer sikkerhetskopi', () => input.click())
  input.onchange = async () => {
    const file = input.files[0]; input.value = ''; if (!file) return
    if (file.size > 20_000_000) { feedback.textContent = 'Filen må være mindre enn 20 MB.'; return }
    try { preview = previewBackup(await file.text(), actions.state()) } catch { feedback.textContent = 'Filen kunne ikke leses. Velg sikkerhetskopien på nytt.'; return }
    if (!preview.ok) { feedback.textContent = preview.error; return }
    showReplacement(preview)
  }
  function showReplacement(value) {
    preview = value; const baseline = JSON.stringify(actions.state()); open('Forhåndsvis gjenoppretting')
    if (!value.localRecovery) dialog.append(node('p', `Sikkerhetskopi fra ${displayTimestamp(value.createdAt)}.`))
    const labels = { tasks: 'Oppgaver', courses: 'Emner', events: 'Undervisning', sessions: 'Studieøkter', sources: 'Kilder', trash: 'Papirkurv' }
    for (const key of Object.keys(labels)) dialog.append(node('p', `${labels[key]}: ${value.before[key]} nå, ${value.after[key]} i filen`))
    dialog.append(node('p', `Dette erstatter de lokale dataene. En gjenopprettingskopi av nåværende data lagres først. ${value.localRecovery ? 'Dette er den rå lokale kopien; tilkoblinger og opprinnelige ID-er beholdes.' : 'Abonnementslenker må kobles til igjen.'}`))
    if (value.rekeyedIds) dialog.append(node('p', `${value.rekeyedIds} eldre identiteter er erstattet med trygge ID-er bare i eksportfilen. Tilhørende relasjoner og historikk følger de samme ID-ene.`))
    const error = node('p'); error.setAttribute('role', 'alert'); dialog.append(error)
    dialog.append(button('Erstatt lokale data', () => {
      if (JSON.stringify(actions.state()) !== baseline) { error.textContent = 'Dataene er endret etter forhåndsvisningen. Åpne filen på nytt.'; return }
      const result = actions.replace(value.data)
      if (result.ok) { close(); feedback.textContent = 'Sikkerhetskopien er gjenopprettet. Forrige datasett kan hentes med Gjenopprett forrige kopi.' }
      else error.textContent = result.error || 'Erstatningen ble stoppet. Kontroller ledig nettleserlagring.'
    }), button('Avbryt', close))
  }
  const recovery = button('Gjenopprett forrige kopi', () => {
    const saved = actions.recovery(); if (!saved) return
    try {
      const result = previewLocalRecovery(saved, actions.state())
      if (result.ok) {
        showReplacement(result)
        if (saved.previous) dialog.append(button('Vis eldre gjenopprettingskopi', () => { const older = previewLocalRecovery(saved.previous, actions.state()); if (older.ok) showReplacement(older); else feedback.textContent = older.error }))
      } else feedback.textContent = result.error
    } catch (error) { feedback.textContent = error.message }
  })
  const menu = node('details'); menu.className = 'data-menu'; menu.append(node('summary', 'Data og sikkerhetskopi'))
  const panel = node('div'); panel.append(trash, save, restore, recovery, input); menu.append(panel)
  menu.open = true
  host.append(node('h2', 'Innstillinger'), node('p', 'Sikkerhetskopi, angre og papirkurv. Dataene lagres på denne enheten.'), undo, menu, feedback)
  const personalization = node('section'); personalization.className = 'personalization-settings'; personalization.append(node('h3', 'Lokal arbeidshistorikk'))
  const enabledLabel = node('label', 'Bruk lokal historikk til frivillige estimatforslag '), enabled = node('input'); enabled.type = 'checkbox'; enabled.checked = actions.state().personalization?.enabled !== false; enabledLabel.prepend(enabled)
  enabled.onchange = () => { const result = actions.personalize(enabled.checked); if (!result.ok) { enabled.checked = !enabled.checked; feedback.textContent = result.error } }
  personalization.append(enabledLabel, node('p', 'Forslag endrer ingen oppgaver eller reservasjoner automatisk. Hele fullførte oppgaver og øktlengder behandles hver for seg.'))
  personalization.append(button('Slett arbeidshistorikk', () => {
    if (!window.confirm('Slett all lokal arbeidshistorikk og tilhørende angre- og papirkurvoppføringer, også fra appens gjenopprettingskopi? Oppgaver, estimater og reservasjoner beholdes. Tidligere nedlastede sikkerhetskopier endres ikke. Slettingen kan ikke angres.')) return
    const result = actions.purgeWork(); feedback.textContent = result.ok ? 'Arbeidshistorikken og tilhørende angreoppføringer er slettet, også fra appens gjenopprettingskopi.' : result.error
  }), button('Fortsett oppstart', () => actions.resumeOnboarding()))
  host.append(personalization)
  const contextUndo = button('Angre siste endring', () => {
    if (!notifiedId || actions.state().history?.undo.at(-1)?.id !== notifiedId) { notifiedId = null; notice.hidden = true; return }
    const result = actions.undo(); report(result)
    if (result?.ok) { notifiedId = null; undoConfirmed = true; noticeText.textContent = 'Endringen er angret.'; contextUndo.hidden = true; notice.hidden = false }
    else noticeText.textContent = result?.error || 'Endringen kunne ikke angres.'
  })
  notice.append(noticeText, contextUndo, button('Lukk melding', () => { notifiedId = null; undoConfirmed = false; notice.hidden = true }))
  return { isOpen: () => dialog.open,
    changed(entry) {
      notifiedId = entry && entry.changes.some(c => c.before && (!c.after || !c.before.deleted && c.after.deleted || c.path === 'tasks' && (c.before.completed !== c.after.completed || c.before.submitted !== c.after.submitted))) ? entry.id : null
      if (notifiedId) { undoConfirmed = false; noticeText.textContent = `${entry.label}. Endringen er lagret og kan angres.`; contextUndo.hidden = false }
      signature = ''
    }, render(model) {
    host.hidden = model.view !== 'settings' && model.readable
    notice.hidden = (!undoConfirmed && (!notifiedId || model.history?.undo.at(-1)?.id !== notifiedId)) || model.view === 'settings' || !model.readable
    contextUndo.disabled = model.editing
    enabled.checked = model.personalization?.enabled !== false
    enabled.disabled = !model.readable || model.editing
    for (const control of personalization.querySelectorAll('button')) control.disabled = !model.readable || model.editing
    const hasRecovery = Boolean(actions.recovery())
    const next = JSON.stringify([model.view, model.readable, model.editing, model.history, hasRecovery]); if (next === signature) return; signature = next
    for (const control of [undo, trash, save]) control.disabled = !model.readable || model.editing
    restore.disabled = recovery.disabled = model.editing
    undo.disabled ||= !model.history?.undo.length
    recovery.disabled ||= !hasRecovery
    trash.textContent = `Papirkurv (${model.history?.trash.length || 0})`
  } }
}
