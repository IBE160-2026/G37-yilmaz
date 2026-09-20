import { RevisionConflict } from './database.js'

const MAX_BODY = 25_000_000
const allowedHost = value => /^(?:127\.0\.0\.1|localhost|[a-z0-9.-]+\.localhost|\[::1\])(?::\d+)?$/i.test(value || '')

async function body(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw Object.assign(new Error('request-too-large'), { statusCode: 413 })
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw Object.assign(new Error('invalid-json'), { statusCode: 400 }) }
}

function objectBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('invalid-request'), { statusCode: 400 })
  return value
}

function writeBody(value) {
  value = objectBody(value)
  if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || !value.envelope || typeof value.envelope !== 'object' || Array.isArray(value.envelope)) {
    throw Object.assign(new Error('invalid-request'), { statusCode: 400 })
  }
  return value
}

export function stateMiddleware(database) {
  return function handleState(req, res, next) {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/state') && url.pathname !== '/api/health') return next()
    const send = (status, value) => {
      if (res.destroyed || res.writableEnded) return
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(value))
    }
    if (!allowedHost(req.headers.host)) return send(403, { error: 'local-only' })
    if (req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin)) return send(403, { error: 'origin-refused' })
    if (/^cross-site$/i.test(req.headers['sec-fetch-site'] || '')) return send(403, { error: 'cross-site-refused' })
    ;(async () => {
      if (url.pathname === '/api/health' && req.method === 'GET') return send(200, { status: 'ok', database: 'sqlite', revision: database.revision() })
      if (url.pathname === '/api/state' && req.method === 'GET') return send(200, database.read())
      if (url.pathname === '/api/state' && req.method === 'PUT') {
        const value = writeBody(await body(req))
        return send(200, database.save(value.envelope, value.expectedRevision))
      }
      if (url.pathname === '/api/state/replace' && req.method === 'POST') {
        const value = writeBody(await body(req))
        return send(200, database.save(value.envelope, value.expectedRevision, { snapshot: true }))
      }
      if (url.pathname === '/api/state/recovery' && req.method === 'GET') return send(200, { recovery: database.recovery() })
      if (url.pathname === '/api/state/purge-work-history' && req.method === 'POST') {
        const value = objectBody(await body(req))
        if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0) throw Object.assign(new Error('invalid-request'), { statusCode: 400 })
        return send(200, database.purge(value.expectedRevision))
      }
      if (url.pathname === '/api/state/legacy/preview' && req.method === 'POST') {
        const value = objectBody(await body(req))
        if (typeof value.raw !== 'string') throw Object.assign(new Error('invalid-legacy'), { statusCode: 400 })
        return send(200, database.previewLegacy(value.raw))
      }
      if (url.pathname === '/api/state/legacy/import' && req.method === 'POST') {
        const value = objectBody(await body(req))
        if (typeof value.raw !== 'string' || typeof value.fingerprint !== 'string' || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0) throw Object.assign(new Error('invalid-legacy'), { statusCode: 400 })
        return send(200, database.importLegacy(value.raw, value.fingerprint, value.expectedRevision))
      }
      send(404, { error: 'not-found' })
    })().catch(error => {
      if (error instanceof RevisionConflict) return send(409, { error: 'stale-revision', revision: error.revision })
      const known = ['invalid-envelope','invalid-legacy-json','invalid-legacy-envelope','legacy-fingerprint-mismatch','database-not-empty','unreadable-recovery']
      send(error.statusCode || (known.includes(error.message) ? 400 : 500), { error: known.includes(error.message) ? error.message : 'state-operation-failed' })
    })
  }
}
