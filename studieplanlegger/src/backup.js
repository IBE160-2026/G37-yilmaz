import { validEnvelope } from './storage.js'
import { boundedImportWarnings } from './import-source-contract.js'

export const BACKUP_VERSION = 1
const secretKey = /^(?:authorization|accesstoken|refreshtoken|token|password|pwd|secret|clientsecret|credentials|apikey|headers|cookie|cookies)$/i
const normalKey = key => key.replace(/[^a-z0-9]/gi, '')
const credentialParameter = key => { const name = normalKey(key); return secretKey.test(name) || /(?:token|secret|password|authorization|credential|apikey)/i.test(name) || /^(key|auth|sig|signature)$/i.test(key) }
const sourceObject = value => ['url', 'file'].includes(value.kind) && value.courseId && Array.isArray(value.groups) && value.id
function portableData(value) {
  const secrets = new Set(), credentials = new Set(), identities = new Set()
  const remember = (text, credential = false) => { if (typeof text === 'string' && text.length) for (const variant of [text, encodeURI(text), encodeURIComponent(text), text.replaceAll('/', '\\/')]) (credential ? credentials : secrets).add(variant) }
  function connection(url) {
    remember(url)
    try {
      const parsed = new URL(url)
      remember(parsed.username, true); remember(parsed.password, true)
      for (const params of [parsed.searchParams, new URLSearchParams(parsed.hash.slice(1))]) for (const [key, item] of params) if (credentialParameter(key)) remember(item, true)
    } catch { /* Full URL is still removed. */ }
  }
  function scan(item, key = '', credential = false) {
    if (typeof item === 'string') {
      if (credential) remember(item, true)
      for (const match of item.matchAll(/(?:\bBearer\s+|\b(?:access[_-]?token|refresh[_-]?token|token|password|pwd|secret|api[_-]?key)\s*[:=]\s*["']?)([^\s"'<>;,]{3,})/gi)) remember(match[1], true)
      for (const match of item.matchAll(/(?:https?|webcal):\/\/[^\s<>"']+/gi)) {
        try { const url = new URL(match[0]); if (url.username || url.password || [...url.searchParams.keys()].some(credentialParameter) || [...new URLSearchParams(url.hash.slice(1)).keys()].some(credentialParameter)) connection(match[0]) } catch { /* Unparseable text is not executed. */ }
      }
      if (/^(id|sourceId|courseId|taskId|sourceKey|sourceUid|operationId|sessionId|importSourceId|importEntryKey|targetId|dependencyIds|missingDependencyIds|key)$/.test(key)) {
        identities.add(item)
        const url = item.match(/(?:https?|webcal):\/\/\S+/i)?.[0]; if (url) connection(url)
      }
    } else if (Array.isArray(item)) item.forEach(entry => scan(entry, key, credential))
    else if (item && typeof item === 'object') {
      if (sourceObject(item) && item.url) connection(item.url)
      for (const [name, entry] of Object.entries(item)) scan(entry, name, credential || secretKey.test(normalKey(name)))
    }
  }
  scan(value)
  const tokens = [...secrets].sort((a, b) => b.length - a.length || a.localeCompare(b))
  const affected = [...identities].filter(id => /(?:https?|webcal)(?::\/\/|%3a%2f%2f)/i.test(id) || tokens.some(token => id.includes(token)) || credentials.has(id)).sort()
  const replacements = new Map(), used = new Set(identities); let serial = 0
  // Sorted ordinal aliases are deterministic for an export, contain no hash or
  // reversible encoding of a secret, and cannot collide with existing IDs.
  for (const id of affected) { let alias; do { alias = `export-id-${++serial}` } while (used.has(alias)); used.add(alias); replacements.set(id, alias) }
  const ids = [...replacements.keys()].sort((a, b) => b.length - a.length)
  const credentialPatterns = [...credentials].sort((a, b) => b.length - a.length).map(token => new RegExp(`(?<![\\p{L}\\p{N}_-])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_-])`, 'gu'))
  const structural = /^(?:id|sourceId|courseId|taskId|sourceKey|sourceUid|operationId|sessionId|importSourceId|importEntryKey|targetId|dependencyIds|missingDependencyIds|key|start|end|startLocal|endLocal|dateLocal|endDateLocal|deadlineLocal|startTime|endTime|at|lastUpdated|lastAttempt|lastSuccess|createdAt|savedAt)$/
  function safeText(text, key = '') {
    if (replacements.has(text)) return replacements.get(text)
    if (!structural.test(key)) for (const id of ids) text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}_-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_-])`, 'gu'), () => replacements.get(id))
    for (const token of tokens) text = text.split(token).join('[tilkobling utelatt]')
    // Document matching normalizes titles to lowercase. Remove the same known
    // credential from that derived text without changing IDs or ordinary text.
    if (!structural.test(key)) for (const pattern of credentialPatterns) text = text.replace(key === 'matchKey' ? new RegExp(pattern.source, 'giu') : pattern, '[tilkobling utelatt]')
    return text
  }
  function copy(item, key = '') {
    if (typeof item === 'string') return safeText(item, key)
    if (Array.isArray(item)) return item.map(entry => copy(entry, key))
    if (!item || typeof item !== 'object') return item
    const result = Object.fromEntries(Object.entries(item).filter(([key]) => !secretKey.test(normalKey(key))).map(([key, entry]) => [safeText(key, 'id'), copy(entry, key)]))
    // Redaction can make a short credential longer. Rebound retained warnings,
    // including historical source snapshots, after all secrets are removed.
    if (item.kind === 'document' && Array.isArray(result.warnings)) result.warnings = boundedImportWarnings(result.warnings)
    if (sourceObject(item)) {
      delete result.url; delete result.lastError
      if (item.kind === 'url') { result.reconnectRequired = true; result.autoRefresh = false }
    }
    return result
  }
  return { data: copy(value), rekeyedIds: replacements.size }
}
export const withoutConnections = value => portableData(value).data
export function exportBackup(state, now = new Date()) {
  const { data, rekeyedIds } = portableData({ ...state, schemaVersion: 1 })
  if (!validEnvelope(data, { relations: true })) throw new Error('Dataene har ugyldige relasjoner. Ingen sikkerhetskopi ble laget.')
  return { format: 'studieplan-local-backup', backupVersion: BACKUP_VERSION, createdAt: now.toISOString(), rekeyedIds, data }
}
const count = state => ({ tasks: state.tasks.length, courses: state.planner?.courses.length || 0, events: state.planner?.events.length || 0, sessions: state.sessions?.length || 0, sources: state.planner?.sources.length || 0, trash: state.history?.trash.length || 0 })
export function previewLocalRecovery(saved, current) {
  if (!validEnvelope(saved?.data, { relations: true })) return { ok: false, error: 'Ugyldig lokal gjenopprettingskopi. Dataene er beholdt.' }
  const data = structuredClone(saved.data)
  return { ok: true, data, before: count(current), after: count(data), localRecovery: true }
}
export function previewBackup(input, current) {
  try {
    if (typeof input !== 'string' || input.length > 20_000_000) throw new Error('Filen må være mindre enn 20 MB.')
    const backup = JSON.parse(input)
    if (backup.format !== 'studieplan-local-backup' || backup.backupVersion !== BACKUP_VERSION || !Number.isFinite(Date.parse(backup.createdAt)) || !validEnvelope(backup.data, { relations: true })) throw new Error('Ugyldig sikkerhetskopi, versjon eller relasjon. Lagrede data er beholdt.')
    const data = withoutConnections(backup.data)
    if (!validEnvelope(data, { relations: true })) throw new Error('Eksportidentiteter eller relasjoner er ugyldige. Dataene er beholdt.')
    return { ok: true, data, before: count(current), after: count(data), createdAt: backup.createdAt, rekeyedIds: backup.rekeyedIds || 0, reconnect: data.planner?.sources.filter(source => source.reconnectRequired).length || 0 }
  } catch (error) { return { ok: false, error: error.message } }
}
export function downloadBackup(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `studieplan-${backup.createdAt.slice(0, 10)}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
