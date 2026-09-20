const STORAGE_KEY = 'studieplanlegger:v1'

function request(method, path, value) {
  try {
    const xhr = new XMLHttpRequest()
    xhr.open(method, path, false)
    xhr.setRequestHeader('Accept', 'application/json')
    if (value !== undefined) xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.send(value === undefined ? null : JSON.stringify(value))
    let data = {}
    try { data = JSON.parse(xhr.responseText || '{}') } catch { /* handled by status */ }
    return { ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data }
  } catch { return { ok: false, status: 0, data: { error: 'unreachable' } } }
}

export function createServerStorage(getLegacyStorage = () => window.localStorage) {
  let envelope = { schemaVersion: 1, tasks: [] }
  let revision = 0
  const accept = response => {
    if (!response.ok || !response.data?.envelope) return { ok: false, reason: response.status === 409 ? 'conflict' : response.data?.error || 'unreachable' }
    envelope = structuredClone(response.data.envelope)
    revision = response.data.revision
    return { ok: true }
  }
  const save = (path, value = envelope) => {
    const response = request('POST', path, { expectedRevision: revision, envelope: value })
    const result = accept(response)
    return result.ok ? result : { ...result, error: 'Kunne ikke lagre i databasen. Tidligere data og utkast er beholdt.' }
  }
  return {
    read() {
      let response = request('GET', '/api/state')
      if (!response.ok || !response.data?.envelope) return { ok: false, reason: 'unreadable' }
      envelope = response.data.envelope; revision = response.data.revision
      let raw = null
      try { raw = getLegacyStorage().getItem(STORAGE_KEY) } catch { /* API remains usable */ }
      const databaseEmpty = envelope.tasks.length === 0 && !(envelope.planner?.courses?.length) && !(envelope.sessions?.length) && !(envelope.workLogs?.length)
      if (raw && databaseEmpty) {
        const preview = request('POST', '/api/state/legacy/preview', { raw })
        if (!preview.ok) return { ok: false, reason: 'invalid', error: 'Nettleserdataene er ugyldige og ble ikke flyttet. Databasen og originaldataene er uendret.' }
        if (preview.data.repeated || preview.data.empty === false) {
          const { schemaVersion, ...state } = structuredClone(envelope)
          return { ok: true, ...state }
        }
        const counts = preview.data.counts
        const confirmed = window.confirm(`Flytt en kopi av eksisterende nettleserdata til databasen?\n\n${counts.tasks} oppgaver, ${counts.courses} emner, ${counts.sessions} studieøkter og ${counts.workLogs} arbeidslogger.\n\nOriginalen i nettleseren beholdes uendret.`)
        if (confirmed) {
          const imported = request('POST', '/api/state/legacy/import', { raw, fingerprint: preview.data.fingerprint, expectedRevision: revision })
          if (!imported.ok) return { ok: false, reason: imported.status === 409 ? 'conflict' : 'invalid', error: 'Flyttingen ble avvist. Ingen data er endret.' }
          envelope = imported.data.envelope; revision = imported.data.revision
        }
      }
      const { schemaVersion, ...state } = structuredClone(envelope)
      return { ok: true, ...state }
    },
    snapshot() { return structuredClone(envelope) },
    writeEnvelope(value) {
      const response = request('PUT', '/api/state', { expectedRevision: revision, envelope: value })
      return accept(response)
    },
    write(tasks, sessions, planner, extra = {}) {
      const value = { ...envelope, ...extra, schemaVersion: 1, tasks }
      if (sessions === undefined) delete value.sessions; else value.sessions = sessions
      if (planner === undefined) delete value.planner; else value.planner = planner
      const response = request('PUT', '/api/state', { expectedRevision: revision, envelope: value })
      return accept(response)
    },
    replace(value) { return save('/api/state/replace', value) },
    purgeWorkHistory() { return save('/api/state/purge-work-history') },
    recovery() {
      const response = request('GET', '/api/state/recovery')
      return response.ok ? response.data.recovery : null
    },
  }
}
