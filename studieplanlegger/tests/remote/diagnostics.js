import { expect } from '@playwright/test'

// Even an error message, URL path or stack can contain source content. Keep
// only fixed categories and numeric locations; raw strings never enter evidence.
const pathname = value => { try { return new URL(value).pathname } catch { return '' } }
const location = value => {
  const path = pathname(value)
  return path.startsWith('/api/import/') ? 'import-api' : /^\/api\/(?:state|backup)(?:\/|$)/.test(path) ? 'state-api' : path.startsWith('/assets/') ? 'built-asset' : path === '/theme-init.js' ? 'theme-bootstrap' : 'page-or-resource'
}
const number = value => Number.isSafeInteger(value) && value >= 0 ? value : null
const networkCode = value => ['net::ERR_FAILED', 'net::ERR_ABORTED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_REFUSED'].includes(value) ? value : 'network-failure'
const consoleCategory = message => {
  const text = message.text()
  const status = /^Failed to load resource: the server responded with a status of (\d{3})(?:\s|$)/.exec(text)
  if (status) return { category: 'resource-http', status: Number(status[1]) }
  const failed = /^Failed to load resource: (net::ERR_[A-Z_]+)$/.exec(text)
  return failed ? { category: 'resource-network', code: networkCode(failed[1]) } : { category: 'console-error' }
}

export function observe(page, { expectedHttpErrors = [], expectedFailedRequests = [], expectedConsoleErrors = [] } = {}) {
  const evidence = { pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [], stateRequests: [] }
  const counts = { http: expectedHttpErrors.map(() => 0), network: expectedFailedRequests.map(() => 0), console: expectedConsoleErrors.map(() => 0) }
  const expected = (kind, entries, path, details) => {
    const index = entries.findIndex(entry => entry.path === path && Object.entries(details).every(([key, value]) => entry[key] === value))
    if (index < 0) return false
    counts[kind][index]++
    return true
  }
  const listeners = {
    pageerror: error => evidence.pageErrors.push({ category: ['SyntaxError', 'TypeError', 'ReferenceError', 'RangeError', 'SecurityError'].includes(error.name) ? error.name : 'runtime-error' }),
    console: message => {
      if (message.type() !== 'error') return
      const at = message.location(), details = consoleCategory(message)
      evidence.consoleErrors.push({ ...details, location: location(at.url), line: number(at.lineNumber), column: number(at.columnNumber), expected: expected('console', expectedConsoleErrors, pathname(at.url), details) })
    },
    request: request => {
      if (/^\/api\/(?:state|backup)(?:\/|$)/.test(pathname(request.url()))) evidence.stateRequests.push({ location: 'state-api' })
    },
    requestfailed: request => {
      const code = networkCode(request.failure()?.errorText)
      evidence.failedRequests.push({ location: location(request.url()), code, expected: expected('network', expectedFailedRequests, pathname(request.url()), { code }) })
    },
    response: response => {
      const status = response.status()
      if (status >= 400) evidence.httpErrors.push({ location: location(response.url()), status, expected: expected('http', expectedHttpErrors, pathname(response.url()), { status }) })
    },
  }
  for (const [event, listener] of Object.entries(listeners)) page.on(event, listener)
  return {
    evidence,
    async finish(info) {
      for (const [event, listener] of Object.entries(listeners)) page.off(event, listener)
      await info.attach('browser-and-network-observations', { contentType: 'application/json', body: JSON.stringify(evidence, null, 2) })
      expect(evidence.pageErrors, 'Uncaught browser errors').toEqual([])
      expect(evidence.failedRequests.filter(entry => !entry.expected), 'Unexpected failed browser requests').toEqual([])
      expect(evidence.httpErrors.filter(entry => !entry.expected), 'Unexpected HTTP errors').toEqual([])
      expect(evidence.stateRequests, 'Hosted browser must never use a shared state/backup API').toEqual([])
      expect(evidence.consoleErrors.filter(entry => !entry.expected), 'Unexpected browser console errors').toEqual([])
      expect(counts.http, 'Expected injected HTTP error counts').toEqual(expectedHttpErrors.map(entry => entry.count))
      expect(counts.network, 'Expected injected network error counts').toEqual(expectedFailedRequests.map(entry => entry.count))
      expect(counts.console, 'Expected injected console error counts').toEqual(expectedConsoleErrors.map(entry => entry.count))
    },
  }
}

export async function browserMode(page) {
  expect(await page.evaluate(() => globalThis.__STUDIEPLAN_API__ === true)).toBe(false)
  await expect(page.locator('#read-error')).toBeHidden()
  await expect(page.locator('#theme-toggle')).toBeVisible()
}
