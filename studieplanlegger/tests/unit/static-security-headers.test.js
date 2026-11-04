import { afterAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const local = vi.hoisted(() => ({ handler: null }))
vi.mock('node:http', () => ({
  createServer: vi.fn(handler => {
    local.handler = handler
    return { listen: vi.fn(), close: vi.fn() }
  }),
}))
vi.mock('node:fs/promises', () => ({
  stat: vi.fn(async () => ({ isDirectory: () => false })),
  readFile: vi.fn(async () => Buffer.from('<html><head></head><body>synthetic shell</body></html>')),
}))
vi.mock('../../server/database.js', () => ({ StateDatabase: class {} }))
vi.mock('../../server/state-api.js', () => ({ stateMiddleware: () => (_req, _res, next) => next() }))
vi.mock('../../server/import-api.js', () => ({ importMiddleware: (_req, _res, next) => next() }))

// Exercise the production static response without opening a port, touching a
// database or depending on a pre-existing dist build. The shell is synthetic.
vi.spyOn(process, 'on').mockImplementation(() => process)
await import('../../server/app.js')
afterAll(() => vi.restoreAllMocks())

function responseFor(url, method = 'GET') {
  return new Promise(resolve => {
    const result = {}
    const response = {
      writeHead(status, headers) { Object.assign(result, { status, headers }); this.headersSent = true },
      end(body) { resolve({ ...result, body: body?.toString() }) },
    }
    local.handler({ url, method }, response)
  })
}

const expectedPolicy = "frame-ancestors 'none'; object-src 'none'; base-uri 'none'"

describe('production static content security policy', () => {
  it.each(['/', '/index.html', '/assets/synthetic.js'])('blocks frames, embedded objects and base URL overrides on %s', async path => {
    const result = await responseFor(path)
    expect(result.status).toBe(200)
    expect(result.headers).toMatchObject({
      'Content-Security-Policy': expectedPolicy,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  it('preserves local storage startup and also sends the policy on HEAD', async () => {
    const result = await responseFor('/')
    expect(result.body).toContain('<script>globalThis.__STUDIEPLAN_API__=true</script>')
    const head = await responseFor('/', 'HEAD')
    expect(head.headers['Content-Security-Policy']).toBe(expectedPolicy)
    expect(head.body).toBeUndefined()
  })

  it('applies the same policy before Vercel filesystem, API and fallback routes', () => {
    const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
    expect(config.routes[0]).toMatchObject({
      src: '/.*', continue: true,
      headers: { 'Content-Security-Policy': expectedPolicy },
    })
  })
})
