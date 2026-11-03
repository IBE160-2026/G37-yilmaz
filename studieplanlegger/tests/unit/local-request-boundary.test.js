import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { stateMiddleware } from '../../server/state-api.js'
import { importMiddleware } from '../../server/import-api.js'
import { createHostedImportHandler } from '../../server/hosted-import.js'

// Fresh ephemeral loopback listeners, synthetic data and injected provider
// responses only. No existing server, database, profile or public source is used.
const servers = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise((resolve, reject) => {
    server.closeAllConnections()
    server.close(error => error ? reject(error) : resolve())
  })))
})

async function listen(handler) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  servers.push(server)
  return server
}

// A raw socket is necessary: URL-aware clients reject these targets before the
// request can reach the Node HTTP parser and the application's middleware.
function request(server, target, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port, chunks = []
    const socket = connect({ host: '127.0.0.1', port })
    socket.setTimeout(3000, () => socket.destroy(new Error('Isolated HTTP request timed out')))
    socket.once('error', reject)
    socket.on('data', chunk => chunks.push(chunk))
    socket.once('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      resolve({ status: Number(raw.match(/^HTTP\/1\.1 (\d+)/)?.[1]), raw })
    })
    socket.once('connect', () => {
      const fields = { Host: `127.0.0.1:${port}`, Connection: 'close', 'Content-Length': Buffer.byteLength(body), ...headers }
      socket.write(`${method} ${target} HTTP/1.1\r\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n${body}`)
    })
  })
}

function dependencies() {
  const envelope = { schemaVersion: 1, tasks: [] }
  const database = {
    revision: vi.fn(() => 7),
    read: vi.fn(() => ({ revision: 7, envelope })),
    save: vi.fn(() => { throw new Error('Unexpected database write') }),
  }
  const source = {
    providerRequestImpl: vi.fn(async () => ({ status: 'ok', results: [] })),
    fetchTextImpl: vi.fn(() => { throw new Error('Unexpected public source fetch') }),
    fetchBytesImpl: vi.fn(() => { throw new Error('Unexpected public source fetch') }),
  }
  return { database, source }
}
const missing = (_req, res) => { res.writeHead(404); res.end('not-found') }
const malformedTargets = ['http://[', 'http://127.0.0.1:invalid/api/state']
const providerPath = '/api/import/providers/himolde/search?code=SYN729'

describe('malformed HTTP request targets', () => {
  it('returns 400 without touching data, then serves health and state on the same local listener', async () => {
    const { database, source } = dependencies(), state = stateMiddleware(database)
    const server = await listen((req, res) => state(req, res, () => importMiddleware(req, res, () => missing(req, res), source)))
    for (const target of malformedTargets) {
      const response = await request(server, target, { method: 'PUT', body: '{"synthetic":"do not echo"}' })
      expect(response.status).toBe(400)
      expect(response.raw).toContain('Content-Type: application/json')
      expect(response.raw).toContain('Cache-Control: no-store')
      expect(response.raw).toContain('invalid-request-url')
      expect(response.raw).not.toContain(target)
      expect(response.raw).not.toContain('do not echo')
    }
    for (const operation of Object.values(database)) expect(operation).not.toHaveBeenCalled()
    for (const operation of Object.values(source)) expect(operation).not.toHaveBeenCalled()
    const health = await request(server, '/api/health')
    expect(health.status).toBe(200)
    expect(health.raw).toContain('"status":"ok","database":"sqlite","revision":7')
    const saved = await request(server, '/api/state')
    expect(saved.status).toBe(200)
    expect(saved.raw).toContain('"envelope":{"schemaVersion":1,"tasks":[]}')
    expect(database.save).not.toHaveBeenCalled()
  })

  it('also protects the standalone development import middleware and allows a subsequent valid import', async () => {
    const { source } = dependencies()
    const server = await listen((req, res) => importMiddleware(req, res, () => missing(req, res), source))
    for (const target of malformedTargets) {
      const response = await request(server, target)
      expect(response.status).toBe(400)
      expect(response.raw).toContain('Ugyldig forespørselsadresse.')
      expect(response.raw).toContain('Cache-Control: no-store')
      expect(response.raw).not.toContain(target)
    }
    for (const operation of Object.values(source)) expect(operation).not.toHaveBeenCalled()
    expect((await request(server, providerPath)).status).toBe(200)
    expect(source.providerRequestImpl).toHaveBeenCalledOnce()
    expect(source.fetchTextImpl).not.toHaveBeenCalled()
    expect(source.fetchBytesImpl).not.toHaveBeenCalled()
  })

  it('preserves local Host, Origin and cross-site checks after malformed requests', async () => {
    const { database, source } = dependencies(), state = stateMiddleware(database)
    const server = await listen((req, res) => state(req, res, () => importMiddleware(req, res, () => missing(req, res), source)))
    expect((await request(server, malformedTargets[0])).status).toBe(400)
    for (const path of ['/api/state', providerPath]) {
      for (const headers of [{ Host: 'other.example.test' }, { Origin: 'https://other.example.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
        expect((await request(server, path, { headers })).status).toBe(403)
      }
    }
    for (const operation of Object.values(database)) expect(operation).not.toHaveBeenCalled()
    for (const operation of Object.values(source)) expect(operation).not.toHaveBeenCalled()
  })

  it('keeps the hosted handler stateless and its source/origin guards intact', async () => {
    const { source } = dependencies()
    const server = await listen(createHostedImportHandler(source))
    const headers = { Host: 'synthetic-ajour.example.test', Origin: 'https://synthetic-ajour.example.test' }
    const malformed = await request(server, malformedTargets[0], { headers })
    expect(malformed.status).toBe(400)
    expect(malformed.raw).not.toContain(malformedTargets[0])
    expect((await request(server, '/api/state', { headers })).status).toBe(404)
    expect((await request(server, providerPath, { headers: { ...headers, Origin: 'https://other.example.test' } })).status).toBe(403)
    const refusedSource = await request(server, '/api/import/calendar', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://unlisted-source.example.test/calendar.ics' }),
    })
    expect(refusedSource.status).toBe(400)
    for (const operation of Object.values(source)) expect(operation).not.toHaveBeenCalled()
    expect((await request(server, providerPath, { headers })).status).toBe(200)
    expect(source.providerRequestImpl).toHaveBeenCalledOnce()
  })
})
