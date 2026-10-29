import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

// Execute the reporting script and its page callbacks with synthetic browser
// timing entries. No browser, network, real profile or process exit is used.
const script = readFileSync(new URL('../../scripts/measure-remote.mjs', import.meta.url), 'utf8')
  .replace(/^import .+$/gm, '')

async function measure({ fcp = 20, lcp = 30, navigation = {}, wallStep = 10 } = {}) {
  const requests = [], output = []
  const process = { env: { AJOUR_REMOTE_URL: 'http://127.0.0.1', AJOUR_REMOTE_DEPLOYMENT: 'synthetic-test' } }
  let wallNow = 0
  const browser = {
    version: () => 'synthetic-chromium', close: async () => {},
    newContext: async () => ({
      close: async () => {},
      newCDPSession: async () => ({ send: async () => {} }),
      request: { get: async path => {
        requests.push(path)
        return { status: () => 200, ok: () => true, body: async () => Buffer.from('{"status":"ok","results":[{}]}') }
      } },
      newPage: async () => {
        const pageContext = vm.createContext({
          innerWidth: 390,
          document: { documentElement: { scrollWidth: 390 }, querySelector: () => ({ getAttribute: () => 'true' }) },
          requestAnimationFrame: callback => callback(),
          performance: {
            now: () => 50,
            getEntriesByName: () => fcp === null ? [] : [{ startTime: fcp }],
            getEntriesByType: type => type === 'navigation'
              ? navigation === null ? [] : [{ responseStart: 10, requestStart: 1, domContentLoadedEventEnd: 15, loadEventEnd: 18, ...navigation }]
              : [],
          },
          PerformanceObserver: class {
            constructor(callback) { this.callback = callback }
            observe({ type }) { this.callback({ getEntries: () => type === 'largest-contentful-paint' && lcp !== null ? [{ startTime: lcp }] : [] }) }
          },
        })
        const evaluate = async (callback, argument) => {
          pageContext.argument = argument
          return vm.runInContext(`(${callback.toString()})(argument)`, pageContext)
        }
        return {
          setDefaultTimeout() {}, on() {}, addInitScript: evaluate, evaluate,
          goto: async () => ({ status: () => 200, ok: () => true }),
          waitForFunction: evaluate,
          locator: selector => ({ waitFor: async () => {}, isVisible: async () => selector !== '#read-error', click: async () => {} }),
        }
      },
    }),
  }
  await vm.runInNewContext(`(async () => { ${script}\n })()`, {
    chromium: { launch: async () => browser }, performance: { now: () => wallNow += wallStep },
    process, URL, console: { log: value => output.push(value) },
  })
  return { report: JSON.parse(output[0]), exitCode: process.exitCode, requests }
}

describe('remote measurement completeness', () => {
  it('accepts complete timings including zero and labels the fixed bounded V1 request', async () => {
    const { report, exitCode, requests } = await measure({ fcp: 0, lcp: 0 })
    expect(report.status).toBe('ok')
    expect(exitCode).toBeUndefined()
    expect(report.samples).toHaveLength(6)
    expect(report.samples.every(sample => sample.status === 'ok' && sample.navigationToPaintMs === 0)).toBe(true)
    expect(report.method.teachingSample).toEqual({ scope: 'fixed-bounded-v1', provider: 'himolde', course: 'IBE160', year: 2026, semester: 'autumn' })
    expect(requests).toEqual(Array(3).fill('/api/import/providers/himolde/teaching-search?q=IBE160&year=2026&semester=autumn'))
  })

  it.each(['fcp', 'lcp'].flatMap(field => [null, NaN, Infinity, -Infinity, -0.01, '20'].map(value => ({ field, value }))))(
    'marks invalid $field timing $value incomplete and exits unsuccessfully', async ({ field, value }) => {
      const { report, exitCode } = await measure({ [field]: value })
      expect(report.status).toBe('incomplete')
      expect(exitCode).toBe(1)
      expect(report.samples.every(sample => sample.status === 'measurement-incomplete')).toBe(true)
    },
  )

  it.each([null, { responseStart: -1 }, { domContentLoadedEventEnd: null }, { loadEventEnd: NaN }])(
    'rejects missing or invalid navigation timings: %j', async navigation => {
      const { report, exitCode } = await measure({ navigation })
      expect(exitCode).toBe(1)
      expect(report.samples.every(sample => sample.status === 'measurement-incomplete')).toBe(true)
    },
  )

  it('rejects invalid wall-clock durations for both startup and import', async () => {
    const { report, exitCode } = await measure({ wallStep: -0.01 })
    expect(exitCode).toBe(1)
    expect([...report.samples, ...report.imports].every(sample => sample.status === 'measurement-incomplete')).toBe(true)
  })
})
