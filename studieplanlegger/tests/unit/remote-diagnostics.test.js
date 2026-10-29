import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { observe } from '../remote/diagnostics.js'

// Invented marker deliberately appears in source payloads and every URL part.
const marker = 'SYNTHETIC_SOURCE_SECRET_729'
const source = `https://${marker}.example.test/${marker}?token=${marker}#${marker}`
const message = (text, url = source) => ({ type: () => 'error', text: () => text, location: () => ({ url, lineNumber: 7, columnNumber: 3 }) })
const request = (url, errorText) => ({ url: () => url, failure: () => ({ errorText }) })
const info = () => { const attachments = []; return { attachments, attach: async (_name, value) => attachments.push(value.body) } }
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('remote evidence minimization', () => {
  it('prints only fixed-category evidence to CI on unexpected failures', async () => {
    vi.stubEnv('CI', 'true')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const page = new EventEmitter(), observed = observe(page), report = info()
    page.emit('console', message(`${marker}: ${source}`))
    await expect(observed.finish(report)).rejects.toThrow()
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0][0]).not.toContain(marker)
    expect(JSON.parse(log.mock.calls[0][0])).toEqual(JSON.parse(report.attachments[0]))
  })
  it('keeps passing CI checks quiet and preserves evidence for an unrelated test failure', async () => {
    vi.stubEnv('CI', 'true')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await observe(new EventEmitter()).finish({ ...info(), status: 'passed', expectedStatus: 'passed' })
    expect(log).not.toHaveBeenCalled()
    await observe(new EventEmitter()).finish({ ...info(), status: 'failed', expectedStatus: 'passed' })
    expect(log).toHaveBeenCalledOnce()
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [], stateRequests: [] })
  })
  it('never attaches source payload, error messages, stacks or URL values and still fails unexpected errors', async () => {
    const page = new EventEmitter(), result = observe(page), report = info()
    page.emit('pageerror', Object.assign(new Error(marker), { name: marker, stack: `${marker} at ${source}` }))
    page.emit('console', message(`${marker}: ${source}`))
    page.emit('requestfailed', request(source, `${marker} ${source}`))
    page.emit('response', { url: () => source, status: () => 500 })
    await expect(result.finish(report)).rejects.toThrow()
    expect(report.attachments).toHaveLength(1)
    expect(report.attachments[0]).not.toContain(marker)
    expect(JSON.parse(report.attachments[0])).toMatchObject({
      pageErrors: [{ category: 'runtime-error' }],
      consoleErrors: [{ category: 'console-error', location: 'page-or-resource', line: 7, column: 3, expected: false }],
      failedRequests: [{ code: 'network-failure', expected: false }],
      httpErrors: [{ status: 500, expected: false }],
    })
  })

  it('accepts only the exact injected error category, endpoint and count', async () => {
    const page = new EventEmitter(), url = `https://synthetic.example.test/api/import/calendar?token=${marker}`, report = info()
    const observed = observe(page, {
      expectedFailedRequests: [{ path: '/api/import/calendar', code: 'net::ERR_FAILED', count: 1 }],
      expectedConsoleErrors: [{ path: '/api/import/calendar', category: 'resource-network', code: 'net::ERR_FAILED', count: 1 }],
    })
    page.emit('requestfailed', request(url, 'net::ERR_FAILED'))
    page.emit('console', message('Failed to load resource: net::ERR_FAILED', url))
    await observed.finish(report)
    expect(report.attachments[0]).not.toContain(marker)
    expect(observed.evidence.failedRequests).toEqual([{ location: 'import-api', code: 'net::ERR_FAILED', expected: true }])
  })

  it('does not hide an unrelated console error at an expected failed endpoint', async () => {
    const page = new EventEmitter(), report = info()
    const observed = observe(page, { expectedConsoleErrors: [{ path: '/api/import/calendar', category: 'resource-http', status: 503, count: 1 }] })
    page.emit('console', message(marker, 'https://synthetic.example.test/api/import/calendar'))
    await expect(observed.finish(report)).rejects.toThrow()
    expect(report.attachments[0]).not.toContain(marker)
  })

  it('fails when an expected injection never occurred', async () => {
    const page = new EventEmitter()
    await expect(observe(page, { expectedHttpErrors: [{ path: '/api/import/calendar', status: 503, count: 1 }] }).finish(info())).rejects.toThrow()
  })
})
