import { chromium } from '@playwright/test'
import { performance } from 'node:perf_hooks'

// Optional bounded measurement, not a benchmark gate. Every context is new;
// only counts/timings and an explicitly supplied release label are printed.
// No trace, screenshot, response body, console text or request URL is retained.
let browser
const report = { format: 'ajour-remote-measurement-v1', measuredAt: new Date().toISOString(), samples: [], imports: [] }
const isTiming = value => Number.isFinite(value) && value >= 0
const rounded = value => isTiming(value) ? Math.round(value * 10) / 10 : null
const essentialTimings = ['readyWallMs', 'ttfbMs', 'domContentLoadedMs', 'loadMs', 'fcpMs', 'observedLcpMs', 'navigationToPaintMs', 'startupLongTaskDurationMs']
const category = error => error?.name === 'TimeoutError' ? 'timeout' : 'measurement-failed'
try {
  const supplied = process.env.AJOUR_REMOTE_URL
  if (!supplied) throw new Error('Missing origin')
  const remote = new URL(supplied)
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(remote.hostname)
  if (remote.username || remote.password || remote.search || remote.hash || remote.pathname !== '/' ||
      (remote.protocol !== 'https:' && !(loopback && remote.protocol === 'http:'))) throw new Error('Invalid origin')
  const deployment = process.env.AJOUR_REMOTE_DEPLOYMENT
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(deployment || '')) throw new Error('Missing safe deployment label')
  report.deployment = deployment
  report.target = loopback ? 'loopback-harness' : 'remote-deployment'
  report.method = {
    samplesPerViewport: 3, browserCache: 'disabled-in-fresh-context', serverCache: 'uncontrolled',
    state: 'empty-synthetic-profile',
    interaction: 'automation-inclusive-navigation-to-two-animation-frames',
    lcp: 'latest-observed-before-first-interaction', device: 'chromium-emulation-not-physical-phone',
    teachingSample: { scope: 'fixed-bounded-v1', provider: 'himolde', course: 'IBE160', year: 2026, semester: 'autumn' },
  }
  browser = await chromium.launch({ headless: true })
  report.chromiumVersion = browser.version()
  for (const profile of [
    { category: 'desktop', viewport: { width: 1440, height: 1000 }, cpuRate: 1 },
    { category: 'mobile-emulated', viewport: { width: 390, height: 844 }, cpuRate: 4, latencyMs: 150, downloadBytesPerSecond: 200_000, uploadBytesPerSecond: 93_750 },
  ]) {
    for (let sample = 1; sample <= 3; sample++) {
      const context = await browser.newContext({
        baseURL: remote.origin, viewport: profile.viewport, timezoneId: 'Europe/Oslo',
        reducedMotion: 'reduce', isMobile: profile.cpuRate > 1, hasTouch: profile.cpuRate > 1,
        deviceScaleFactor: profile.cpuRate > 1 ? 3 : 1,
      })
      const entry = { profile: profile.category, sample, viewport: profile.viewport, cpuRate: profile.cpuRate,
        latencyMs: profile.latencyMs || 0, downloadBytesPerSecond: profile.downloadBytesPerSecond || null,
        uploadBytesPerSecond: profile.uploadBytesPerSecond || null,
        errors: { page: 0, console: 0, network: 0, http: 0 }, status: 'pending' }
      report.samples.push(entry)
      try {
        const page = await context.newPage()
        page.setDefaultTimeout(30_000)
        page.on('pageerror', () => entry.errors.page++)
        page.on('console', message => { if (message.type() === 'error') entry.errors.console++ })
        page.on('requestfailed', () => entry.errors.network++)
        page.on('response', response => { if (response.status() >= 400) entry.errors.http++ })
        await page.addInitScript(() => {
          globalThis.__ajourMeasurement = { lcp: null, longTasks: 0, longTaskDuration: 0 }
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) globalThis.__ajourMeasurement.lcp = entry.startTime
          }).observe({ type: 'largest-contentful-paint', buffered: true })
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              globalThis.__ajourMeasurement.longTasks++
              globalThis.__ajourMeasurement.longTaskDuration += entry.duration
            }
          }).observe({ type: 'longtask', buffered: true })
        })
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate })
        if (profile.latencyMs) await cdp.send('Network.emulateNetworkConditions', {
          offline: false, latency: profile.latencyMs,
          downloadThroughput: profile.downloadBytesPerSecond, uploadThroughput: profile.uploadBytesPerSecond,
        })
        const started = performance.now()
        const response = await page.goto('/', { waitUntil: 'load', timeout: 60_000 })
        entry.httpStatus = response.status()
        if (!response.ok()) throw new Error('Entry failed')
        await page.locator('#theme-toggle').waitFor({ state: 'visible' })
        await page.locator('#storage-location').waitFor({ state: 'visible' })
        entry.readyWallMs = rounded(performance.now() - started)
        if (await page.evaluate(() => globalThis.__STUDIEPLAN_API__ === true)) throw new Error('Unexpected server storage')
        if (await page.locator('#read-error').isVisible()) throw new Error('Storage unavailable')
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        Object.assign(entry, await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0]
          const measurement = globalThis.__ajourMeasurement
          return {
            ttfbMs: navigation ? navigation.responseStart - navigation.requestStart : null,
            domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
            loadMs: navigation?.loadEventEnd ?? null,
            fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
            observedLcpMs: measurement.lcp,
            startupLongTasks: measurement.longTasks,
            startupLongTaskDurationMs: measurement.longTaskDuration,
            transferredResourceBytes: performance.getEntriesByType('resource').reduce((sum, resource) => sum + resource.transferSize, 0),
          }
        }))
        // The user's actual responsive navigation is exercised. On mobile the
        // overflow is opened only if the requested target is not visible.
        const target = page.locator('#view-all')
        if (!await target.isVisible()) await page.locator('#mobile-navigation-more').click()
        const interactionStart = await page.evaluate(() => performance.now())
        await target.click()
        await page.waitForFunction(() => document.querySelector('#view-all')?.getAttribute('aria-pressed') === 'true')
        entry.navigationToPaintMs = rounded(await page.evaluate(start => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)))), interactionStart))
        entry.pageFitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
        for (const key of Object.keys(entry).filter(key => key.endsWith('Ms'))) entry[key] = rounded(entry[key])
        entry.status = !essentialTimings.every(key => isTiming(entry[key]))
          ? 'measurement-incomplete'
          : Object.values(entry.errors).every(count => count === 0) && entry.pageFitsViewport ? 'ok' : 'unexpected-browser-failure'
      } catch (error) { entry.status = category(error) }
      finally { await context.close() }
    }
  }
  // Three sequential real calls to the same bounded, public V1 search. These
  // timings include upstream transport; they do not claim a forced cold start.
  const context = await browser.newContext({ baseURL: remote.origin })
  try {
    for (let sample = 1; sample <= 3; sample++) {
      const started = performance.now(), entry = { category: 'bounded-himolde-teaching-search', sample, status: 'pending' }
      report.imports.push(entry)
      try {
        const response = await context.request.get('/api/import/providers/himolde/teaching-search?q=IBE160&year=2026&semester=autumn', { timeout: 60_000 })
        entry.httpStatus = response.status()
        const body = await response.body()
        entry.durationMs = rounded(performance.now() - started)
        entry.responseBytes = body.length
        let data
        try { data = JSON.parse(body.toString()) } catch { entry.status = 'invalid-json'; continue }
        entry.resultCount = Array.isArray(data.results) ? data.results.length : 0
        entry.status = !isTiming(entry.durationMs) ? 'measurement-incomplete'
          : response.ok() && data.status === 'ok' && entry.resultCount > 0 ? 'ok' : 'import-unavailable'
      } catch (error) { entry.durationMs = rounded(performance.now() - started); entry.status = category(error) }
    }
  } finally { await context.close() }
  report.status = [...report.samples, ...report.imports].every(entry => entry.status === 'ok') ? 'ok' : 'incomplete'
} catch (error) { report.status = category(error) }
finally { if (browser) await browser.close().catch(() => { report.status = 'browser-close-failed' }) }
console.log(JSON.stringify(report, null, 2))
if (report.status !== 'ok') process.exitCode = 1
