import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import https from 'node:https'
import { lookup, resolve4 } from 'node:dns/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHostedImportHandler } from '../../server/hosted-import.js'
import { fetchPublicBytes, fetchPublicText, importMiddleware, readImportBody } from '../../server/import-api.js'
import { hostedCalendarSource, hostedSourceGuard } from '../../server/hosted-import-policy.js'
import { FIH_CALENDAR_RETRY_TIMEOUT_MS, FIH_READ_TIMEOUT_MS } from '../../server/providers/fih-calendar.js'
import { programProviders } from '../../server/providers/programs.js'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn(), resolve4: vi.fn() }))
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

// All identifiers and course content below are invented security/test data.
const host = 'synthetic-ajour.example.test'
const calendarUrl = 'https://tp.educloud.no/ntnu/timeplan/ical.php?sem=26h&type=course&id%5B0%5D=SYN729'
const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'
const ntnuHtml = '<div id="course-details" data-coursecode="SYN729"><h1 class="course-name">Synthetic course</h1><select id="selectedYear"><option selected value="2026">2026/2027</option></select></div>'
const fihCatalogueUrl = 'https://fih.fjellhaug.no/ikt-verkt%C3%B8y/webcalfiler'
const fihCalendarUrl = 'https://fih.edupage.org/webcal?pwd=C0DEC0DEC0DEC0DE&type=plan&studentid=-729'
const fihCalendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Timetable: -729\r\nEND:VCALENDAR\r\n'
const fihBody = { url: fihCalendarUrl, catalogueUrl: fihCatalogueUrl, sourceObjectId: '-729' }
const fihListings = {
  'https://fih.fjellhaug.no/student': `<main><a href="${fihCatalogueUrl}">Webcalfiler</a></main>`,
  [fihCatalogueUrl]: `<main><a href="${fihCalendarUrl.replaceAll('&', '&amp;')}">Syntetisk klasse</a></main>`,
}

// Published catalogue shapes with invented records; only the second page fails.
function partialProgramTransport(institution, secondPage) {
  return vi.fn(async input => {
    const url = new URL(input)
    if (institution === 'fhs') {
      if (url.pathname === '/utdanning/utdanninger') return `<script data-part-id="synthetic" type="application/json">${JSON.stringify({ serviceUrl: '/utdanning/utdanninger/_/service/no.bouvet.forsvaret/list-education-service', perPage: 1 })}</script>`
      if (url.searchParams.get('start') === '0') return JSON.stringify({ hits: [{ _id: 'synthetic-729', url: '/utdanning/utdanninger/synthetic', title: 'Synthetic programme', data: { type: 'Bachelor' } }], total: 2 })
    } else {
      if (url.pathname === '/studieportal/') return `<script>(window.__reactProps = window.__reactProps || {})['synthetic-json'] = ${JSON.stringify({ searchUrl: '/api/search/syllabus', facets: [{ id: 'types', options: [{ id: 'Program' }] }] })};</script>`
      if (url.searchParams.get('skip') === '0') return JSON.stringify({ items: [{ name: 'Synthetic programme', url: '/studieportal/synthetic/bachelorniva/SYN729/synthetic/', locations: [] }], totalCount: 2 })
    }
    return secondPage()
  })
}

async function request({ path = '/api/import/calendar', method = 'POST', body = { url: calendarUrl }, chunks, headers = {}, dependencies = {}, local = false } = {}) {
  const req = chunks ? Readable.from(chunks) : new EventEmitter()
  Object.assign(req, { method, url: path, headers: { host, origin: `https://${host}`, 'content-type': 'application/json', ...headers } })
  if (!chunks) req.body = body
  let result
  const res = Object.assign(new EventEmitter(), {
    destroyed: false, writableEnded: false,
    writeHead(status, responseHeaders) { this.status = status; this.headers = responseHeaders },
    end(value) { this.writableEnded = true; result = { status: this.status, headers: this.headers, body: JSON.parse(value) } },
  })
  if (local) await importMiddleware(req, res, () => { throw new Error('Unexpected fallback') }, dependencies)
  else await createHostedImportHandler(dependencies)(req, res)
  return result
}

describe('stateless hosted request boundary', () => {
  it.each([
    { body: { url: calendarUrl } },
    { body: JSON.stringify({ url: calendarUrl }) },
    { body: Buffer.from(JSON.stringify({ url: calendarUrl })) },
    { chunks: [Buffer.from('{"url":"'), Buffer.from(calendarUrl), Buffer.from('"}')] },
  ])('accepts parsed and streamed Vercel/Node bodies %#', async options => {
    const fetchTextImpl = vi.fn(async () => calendar)
    const result = await request({ ...options, dependencies: { fetchTextImpl } })
    expect(result).toMatchObject({ status: 200, body: { calendar } })
    expect(result.headers['Cache-Control']).toBe('no-store')
    expect(fetchTextImpl).toHaveBeenCalledOnce()
  })

  it.each(['{bad-json', 'null', '[]', '{"url":42}'])('returns JSON for malformed or invalid body %s', async body => {
    const fetchTextImpl = vi.fn()
    const result = await request({ body, dependencies: { fetchTextImpl } })
    expect(result.status).toBe(400)
    expect(result.headers['Content-Type']).toContain('application/json')
    expect(fetchTextImpl).not.toHaveBeenCalled()
  })

  it('sanitizes a malformed JSON error thrown by Vercel’s lazy body helper', async () => {
    const req = { headers: {}, get body() { throw new Error('Synthetic body content must not be echoed') } }
    await expect(readImportBody(req)).rejects.toThrow('Ugyldig JSON i forespørselen.')
  })

  it.each([
    { body: { url: `https://synthetic.invalid/${'ø'.repeat(5000)}` } },
    { chunks: [Buffer.from(' '.repeat(8193))] },
    { headers: { 'content-length': '9000' } },
  ])('bounds body bytes before source access %#', async options => {
    const fetchTextImpl = vi.fn()
    expect((await request({ ...options, dependencies: { fetchTextImpl } })).status).toBe(413)
    expect(fetchTextImpl).not.toHaveBeenCalled()
  })

  it.each([
    { origin: 'https://other.example.test' },
    { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'same-site' },
    { host: '127.0.0.1' },
    { host: 'synthetic.test:443' },
    { 'x-forwarded-host': 'other.example.test', origin: 'https://other.example.test' },
  ])('rejects cross-origin requests without trusting forwarded hosts %#', async headers => {
    const fetchTextImpl = vi.fn()
    expect((await request({ headers, dependencies: { fetchTextImpl } })).status).toBe(403)
    expect(fetchTextImpl).not.toHaveBeenCalled()
  })

  it('rejects unsupported methods and content types and never serves API as HTML', async () => {
    const wrongMethod = await request({ method: 'GET' })
    expect(wrongMethod).toMatchObject({ status: 405, headers: { Allow: 'POST' } })
    expect((await request({ method: 'OPTIONS' })).status).toBe(405)
    expect((await request({ headers: { 'content-type': 'application/json-malformed' } })).status).toBe(415)
    for (const path of ['/api', '/api/unknown', '/api/state', '/api/backup', '/api/import/unknown']) {
      expect(await request({ path, method: 'GET' })).toMatchObject({ status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
    }
  })

  it('bounds total elapsed time even while a transport does not settle', async () => {
    let signal
    const result = await request({ dependencies: {
      hostedPolicy: { deadlineMs: 15 },
      fetchTextImpl: (_url, _depth, _guard, options) => { signal = options.signal; return new Promise(() => {}) },
    } })
    expect(result).toMatchObject({ status: 504, body: { status: 'timeout' } })
    expect(signal.aborted).toBe(true)
  })

  it('bounds public result size and does not persist provider caches between users', async () => {
    expect((await request({ path: '/api/import/providers/ntnu/search', method: 'GET', dependencies: { providerRequestImpl: async () => ({ data: 'x'.repeat(3_000_001) }) } })).status).toBe(502)
    const keys = []
    const providerRequestImpl = async (_institution, _action, _query, dependencies) => { keys.push(dependencies.fetchText.cacheKey); return { status: 'ok' } }
    for (let count = 0; count < 2; count++) await request({ path: '/api/import/providers/ntnu/search', method: 'GET', dependencies: { providerRequestImpl } })
    expect(keys[0]).not.toBe(keys[1])
  })

  it('latches the aggregate byte limit across both transports despite adapter catch-and-continue', async () => {
    const chunk = Buffer.alloc(10_000_000), outcomes = []
    let finishProvider, signal
    const providerFinished = new Promise(resolve => { finishProvider = resolve })
    const fetchBytesImpl = vi.fn(async (_url, _depth, _guard, options) => { signal = options.signal; return chunk })
    const fetchTextImpl = vi.fn(async () => calendar)
    const providerRequestImpl = async (_institution, _action, _query, { fetchBytes, fetchText }) => {
      for (const fetchSource of [fetchBytes, fetchBytes, fetchBytes, fetchBytes, fetchText, fetchBytes]) {
        try { await fetchSource(calendarUrl); outcomes.push('accepted') } catch { outcomes.push('caught') }
      }
      finishProvider()
      return { status: 'ok', partial: true }
    }
    const result = await request({ path: '/api/import/providers/ntnu/programs', method: 'GET', dependencies: { providerRequestImpl, fetchBytesImpl, fetchTextImpl } })
    await providerFinished
    expect(outcomes).toEqual(['accepted', 'accepted', 'accepted', 'caught', 'caught', 'caught'])
    expect(fetchBytesImpl).toHaveBeenCalledTimes(4)
    expect(fetchTextImpl).not.toHaveBeenCalled()
    expect(signal.aborted).toBe(true)
    expect(result).toMatchObject({ status: 400, body: { status: 'import-limit', error: expect.stringContaining('filimport') } })
    expect(result.body.partial).toBeUndefined()
  })

  it('accepts 250 fetches, blocks the 251st before transport, and cannot become partial success', async () => {
    let finishProvider, accepted = 0, rejected = 0, signal
    const providerFinished = new Promise(resolve => { finishProvider = resolve })
    const fetchTextImpl = vi.fn(async (_url, _depth, _guard, options) => { signal = options.signal; return calendar })
    const providerRequestImpl = async (_institution, _action, _query, { fetchText }) => {
      for (let attempt = 0; attempt < 253; attempt++) {
        try { await fetchText(calendarUrl); accepted++ } catch { rejected++ }
      }
      finishProvider()
      return { status: 'ok', partial: true }
    }
    const result = await request({ path: '/api/import/providers/ntnu/programs', method: 'GET', dependencies: { providerRequestImpl, fetchTextImpl } })
    await providerFinished
    expect(accepted).toBe(250)
    expect(rejected).toBe(3)
    expect(fetchTextImpl).toHaveBeenCalledTimes(250)
    expect(signal.aborted).toBe(true)
    expect(result).toMatchObject({ status: 400, body: { status: 'import-limit' } })
    expect(result.body.partial).toBeUndefined()
  })

  it('preserves the local loopback guard and arbitrary public calendar flow', async () => {
    expect((await request({ local: true })).status).toBe(403)
    expect(await request({ local: true, headers: { host: '127.0.0.1:5192', origin: 'http://127.0.0.1:5192' }, body: { url: 'https://synthetic.invalid/calendar.ics' }, dependencies: { fetchTextImpl: async () => calendar } })).toMatchObject({ status: 200, body: { calendar } })
  })
})

describe('recognized sources and all outgoing fetches', () => {
  it.each([
    'https://synthetic.invalid/calendar.ics', 'https://127.0.0.1/calendar.ics',
    'https://[::1]/calendar.ics', 'https://169.254.169.254/latest/meta-data',
    'https://www.ntnu.no/private/calendar.ics', 'https://www.ntnu.no.evil.invalid/calendar.ics',
    calendarUrl.replace('https:', 'http:'), calendarUrl.replace('https://', 'https://synthetic:invented@'),
    `${calendarUrl}&token=invented`, `${calendarUrl}#invented`,
  ])('blocks unrecognized or credential-bearing calendar before transport %s', async url => {
    const fetchTextImpl = vi.fn()
    const result = await request({ body: { url }, dependencies: { fetchTextImpl } })
    expect(result.status).toBe(400)
    expect(result.body.error).toContain('filimport')
    expect(fetchTextImpl).not.toHaveBeenCalled()
  })

  it('retains recognized TP, TimeEdit, Plandisc and public PDF calendar selections', () => {
    for (const url of [
      calendarUrl,
      'https://tp.educloud.no/himolde/app/schedule?semester=26h&scheduleType=course&course=SYN729',
      'https://cloud.timeedit.net/nmbu/web/student/ri.ics?objects=729.5&p=20260701.x,20261231.x',
      'https://cloud.timeedit.net/khio/web/design/ri.ics?objects=729.5',
      'https://create.plandisc.com/wheel/showPublic/synthetic729',
      'https://s3-gustav.imgix.net/hfy/synthetic-calendar.pdf',
      'https://www.politihogskolen.no/for-studenter/eksamen/eksamensoversikt-ba',
    ]) expect(() => hostedCalendarSource(url)).not.toThrow()
  })

  it.each([false, true])('retries a guarded Fjellhaug source reset and sanitizes a persistent error (%s)', async persistent => {
    const privateDetail = 'SYNTHETIC_RESET_DETAILS_729'
    let reads = 0
    const fetchTextImpl = vi.fn(async (source, _depth, guard, options) => {
      guard(new URL(source))
      if (fihListings[source]) return fihListings[source]
      expect(source).toBe(fihCalendarUrl)
      expect(options.freshConnection).toBe(true)
      reads++
      if (reads === 1 || persistent) throw Object.assign(new Error(privateDetail), { code: 'ECONNRESET' })
      return fihCalendar
    })
    const result = await request({ body: fihBody, dependencies: { fetchTextImpl } })
    expect(reads).toBe(persistent ? 3 : 2)
    if (persistent) {
      expect(result).toMatchObject({ status: 400, body: { status: 'transport-error', error: 'Fikk ikke kontakt med lærestedet. Prøv igjen senere. Lagrede data er beholdt.' } })
      expect(JSON.stringify(result.body)).not.toContain(privateDetail)
    } else {
      expect(result).toMatchObject({ status: 200, body: { sourceKind: 'fih-public-class', className: 'Syntetisk klasse', count: 0 } })
    }
  })

  it('queries DNS directly after two stalled lookups and pins a verified public address', async () => {
    vi.useFakeTimers()
    try {
      lookup.mockImplementation(() => new Promise(() => {}))
      resolve4.mockResolvedValueOnce(['8.8.8.8', '93.184.216.34'])
      const get = vi.spyOn(https, 'get').mockImplementation((url, options, callback) => {
        options.lookup(url.hostname, { all: true }, (_error, addresses) =>
          expect(addresses).toEqual([{ address: '93.184.216.34', family: 4 }]))
        callback(Object.assign(Readable.from([Buffer.from(fihCalendar)]), { statusCode: 200, headers: {} }))
        return Object.assign(new EventEmitter(), { setTimeout() {} })
      })
      const fetchTextImpl = (url, depth, guard, options) => fihListings[url] || fetchPublicText(url, depth, guard, options)
      const result = request({ body: fihBody, dependencies: { fetchTextImpl } })
      await vi.advanceTimersByTimeAsync(FIH_READ_TIMEOUT_MS + FIH_CALENDAR_RETRY_TIMEOUT_MS)
      await expect(result).resolves.toMatchObject({ status: 200, body: { sourceKind: 'fih-public-class' } })
      expect(lookup).toHaveBeenCalledTimes(2)
      expect(resolve4).toHaveBeenCalledExactlyOnceWith('fih.edupage.org')
      expect(get).toHaveBeenCalledOnce()
    } finally { lookup.mockReset(); vi.useRealTimers() }
  })

  it('retries a stalled Fjellhaug DNS lookup without opening a socket for the cancelled attempt', async () => {
    vi.useFakeTimers()
    try {
      const addresses = [{ address: '93.184.216.34', family: 4 }]
      let resolveFirst
      lookup.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve })).mockResolvedValueOnce(addresses)
      const get = vi.spyOn(https, 'get').mockImplementation((_url, _options, callback) => {
        callback(Object.assign(Readable.from([Buffer.from(fihCalendar)]), { statusCode: 200, headers: {} }))
        return Object.assign(new EventEmitter(), { setTimeout() {} })
      })
      const fetchTextImpl = (url, depth, guard, options) => fihListings[url] || fetchPublicText(url, depth, guard, options)
      const result = request({ body: fihBody, dependencies: { fetchTextImpl } })
      await vi.advanceTimersByTimeAsync(FIH_READ_TIMEOUT_MS)
      await expect(result).resolves.toMatchObject({ status: 200, body: { sourceKind: 'fih-public-class', count: 0 } })
      expect(lookup).toHaveBeenCalledTimes(2)
      resolveFirst(addresses)
      await vi.advanceTimersByTimeAsync(0)
      expect(get).toHaveBeenCalledOnce()
      expect(get.mock.calls[0][1].agent).toBe(false)
    } finally { vi.useRealTimers() }
  })

  it.each([
    ['https://fih.fjellhaug.no/student', 'Fjellhaugs studentside'],
    [fihCatalogueUrl, 'den valgte kalenderoversikten fra Fjellhaug'],
    [fihCalendarUrl, 'den valgte klassekalenderen fra EduPage'],
  ])('reports a bounded Fjellhaug timeout at %s without source identifiers', async (stalledSource, stage) => {
    vi.useFakeTimers()
    try {
      const stalledSignals = []
      const fetchTextImpl = (url, _depth, _guard, { signal }) => {
        if (url !== stalledSource) return fihListings[url] || fihCalendar
        stalledSignals.push(signal)
        return new Promise(() => {})
      }
      const result = request({ body: fihBody, dependencies: { fetchTextImpl } })
      const calendar = stalledSource === fihCalendarUrl
      await vi.advanceTimersByTimeAsync(calendar ? FIH_READ_TIMEOUT_MS + 2 * FIH_CALENDAR_RETRY_TIMEOUT_MS : 2 * FIH_READ_TIMEOUT_MS)
      const { status, body } = await result
      expect(status).toBe(504)
      expect(body).toEqual({ status: 'timeout', error: `Det tok for lang tid å hente ${stage}. Prøv igjen eller importer kalenderen som .ics-fil. Lagrede data er beholdt.` })
      expect(stalledSignals).toHaveLength(calendar ? 3 : 2)
      expect(stalledSignals.every(signal => signal.aborted)).toBe(true)
    } finally { vi.useRealTimers() }
  })

  it.each(['/api/import/ntnu', '/api/import/providers/ntnu/details'])('injects guarded fetch for NTNU details at %s', async path => {
    const fetchTextImpl = vi.fn(async (_url, _depth, guard) => {
      expect(() => guard(new URL('https://www.ntnu.no/studier/emner/OTHER729/2026'))).toThrow()
      expect(() => guard(new URL('https://synthetic.invalid/source'))).toThrow()
      return ntnuHtml
    })
    const result = await request({ path: `${path}?code=SYN729&semester=autumn&year=2026`, method: 'GET', dependencies: { fetchTextImpl } })
    expect(result).toMatchObject({ status: 200, body: { course: { code: 'SYN729', name: 'Synthetic course' } } })
    expect(fetchTextImpl).toHaveBeenCalledOnce()
  })

  it('does not expose malformed upstream JSON through the real NTNU provider catch boundary', async () => {
    const syntheticSecret = 'SYNTHETIC_UPSTREAM_SECRET_729'
    const result = await request({
      path: '/api/import/providers/ntnu/search?q=SYN729&semester=autumn&year=2026', method: 'GET',
      dependencies: { fetchTextImpl: async () => syntheticSecret },
    })
    expect(result).toMatchObject({ status: 200, body: { status: 'source-changed', error: expect.stringContaining('filimport') } })
    expect(JSON.stringify(result)).not.toContain(syntheticSecret)
  })

  it('keeps a real NTNU partial-page warning safe after the first page succeeds', async () => {
    const syntheticSecret = 'SYNTHETIC_SECOND_PAGE_SECRET_729'
    const fetchTextImpl = vi.fn(async input => new URL(input).searchParams.get('pageNo') === '1'
      ? JSON.stringify({ courses: [{ courseCode: 'SYN729', courseName: 'Synthetic course', courseUrl: 'https://www.ntnu.no/studier/emner/SYN729/2026', location: 'Synthetic campus' }], hasMoreResults: true })
      : syntheticSecret)
    const result = await request({
      path: '/api/import/providers/ntnu/search?q=SYN729&semester=autumn&year=2026', method: 'GET', dependencies: { fetchTextImpl },
    })
    expect(result).toMatchObject({ status: 200, body: { status: 'ok', truncated: true, results: [{ code: 'SYN729' }], completeness: { complete: false, pages: 1 } } })
    expect(fetchTextImpl).toHaveBeenCalledTimes(2)
    expect(result.body.warnings.join(' ')).toContain('Prøv filimport eller manuell registrering.')
    expect(JSON.stringify(result)).not.toContain(syntheticSecret)
  })

  it.each(['fhs', 'kristiania'])('keeps malformed second-page content out of %s partial-result diagnostics', async institution => {
    const syntheticSecret = 'SYNTHETIC_SECRET'
    const fetchTextImpl = partialProgramTransport(institution, () => syntheticSecret)
    const result = await request({ path: `/api/import/providers/${institution}/programs`, method: 'GET', dependencies: { fetchTextImpl } })
    expect(result).toMatchObject({ status: 200, body: { status: 'ok', results: [{ name: 'Synthetic programme' }], completeness: { complete: false, pages: 1 } } })
    expect(fetchTextImpl).toHaveBeenCalledTimes(3)
    expect(result.body.warnings.join(' ')).toContain('Prøv filimport eller manuell registrering.')
    expect(JSON.stringify(result)).not.toContain(syntheticSecret)
    expect(JSON.stringify(result)).not.toContain('Unexpected token')
  })

  it.each(['fhs', 'kristiania'])('preserves expected second-page guidance for %s', async institution => {
    const guidance = 'Kilden svarte med HTTP 503. Prøv filimport eller manuell registrering.'
    const fetchTextImpl = partialProgramTransport(institution, () => { throw new Error(guidance) })
    const result = await request({ path: `/api/import/providers/${institution}/programs`, method: 'GET', dependencies: { fetchTextImpl } })
    expect(result).toMatchObject({ status: 200, body: { status: 'ok', results: [{ name: 'Synthetic programme' }], completeness: { complete: false, pages: 1 } } })
    expect(result.body.warnings.join(' ')).toContain(guidance)
    expect(fetchTextImpl).toHaveBeenCalledTimes(3)
  })

  it.each(['fhs', 'kristiania'])('does not turn a cancelled %s second page into partial success', async institution => {
    const fetchTextImpl = partialProgramTransport(institution, () => { throw new DOMException('Synthetic cancellation', 'AbortError') })
    const result = await request({ path: `/api/import/providers/${institution}/programs`, method: 'GET', dependencies: { fetchTextImpl } })
    expect(result).toMatchObject({ status: 200, body: { status: 'transport-error', error: 'Synthetic cancellation' } })
    expect(result.body.results).toBeUndefined()
    expect(result.body.warnings).toBeUndefined()
    expect(fetchTextImpl).toHaveBeenCalledTimes(3)
  })

  it('sanitizes unexpected provider runtime errors while retaining expected domain guidance', async () => {
    const path = '/api/import/providers/ntnu/details?code=SYN729&semester=autumn&year=2026'
    const unexpected = await request({ path, method: 'GET', dependencies: { fetchTextImpl: async () => { throw new TypeError('SYNTHETIC_INTERNAL_VALUE_729') } } })
    expect(unexpected.body.status).toBe('source-changed')
    expect(JSON.stringify(unexpected)).not.toContain('SYNTHETIC_INTERNAL_VALUE_729')
    const expected = await request({ path, method: 'GET', dependencies: { fetchTextImpl: async () => '' } })
    expect(expected.body).toMatchObject({ status: 'not-found', error: expect.stringContaining('Fant ikke emnet hos NTNU') })
  })

  it('keeps malformed JSON from a direct TP calendar out of the response and preserves domain guidance', async () => {
    const syntheticSecret = 'SYNTHETIC_DIRECT_TP_PAYLOAD_729'
    const result = await request({
      body: { url: 'https://tp.educloud.no/uio/app/schedule?semester=26h&scheduleType=course&course=SYN729%C2%A41' },
      dependencies: { fetchTextImpl: async () => syntheticSecret },
    })
    // The TP metadata reader already replaces native JSON.parse errors itself.
    expect(result).toMatchObject({ status: 400, body: { status: 'source-changed', error: 'TP returnerte ikke et lesbart offentlig kildeutvalg.' } })
    expect(JSON.stringify(result)).not.toContain(syntheticSecret)
  })

  it('sanitizes native errors at the direct-calendar hosted boundary while preserving local behavior', async () => {
    const syntheticSecret = 'SYNTHETIC_DIRECT_RUNTIME_VALUE_729'
    const dependencies = { fetchTextImpl: async () => { throw new SyntaxError(syntheticSecret) } }
    const hosted = await request({ dependencies })
    expect(hosted).toMatchObject({ status: 400, body: { status: 'source-changed', error: expect.stringContaining('filimport') } })
    expect(JSON.stringify(hosted)).not.toContain(syntheticSecret)
    const local = await request({ local: true, headers: { host: '127.0.0.1:5192', origin: 'http://127.0.0.1:5192' }, dependencies })
    expect(local).toMatchObject({ status: 400, body: { error: syntheticSecret } })
  })

  it('composes provider validators with host guards for both text and PDF fetches', async () => {
    const fetchTextImpl = vi.fn(), fetchBytesImpl = vi.fn()
    const providerRequestImpl = async (_provider, _action, _query, { fetchText, fetchBytes }) => {
      for (const fetchSource of [fetchText, fetchBytes]) {
        await expect(fetchSource('https://synthetic.invalid/file', 0, () => {})).rejects.toThrow()
        await expect(fetchSource('https://www.ntnu.no/private/file')).rejects.toThrow()
        await expect(fetchSource('https://www.ntnu.no/studier/alle', 0, () => { throw new Error('provider-path-guard') })).rejects.toThrow('provider-path-guard')
      }
      return { status: 'ok' }
    }
    expect((await request({ path: '/api/import/providers/ntnu/programs', method: 'GET', dependencies: { providerRequestImpl, fetchTextImpl, fetchBytesImpl } })).status).toBe(200)
    expect(fetchTextImpl).not.toHaveBeenCalled(); expect(fetchBytesImpl).not.toHaveBeenCalled()
  })

  it.each(programProviders)('preserves the %s catalogue route through its actual provider guard', async institution => {
    const fetchTextImpl = vi.fn(async () => { throw new Error('synthetic-transport-probe') })
    const result = await request({ path: `/api/import/providers/${institution}/programs?year=2026&semester=autumn`, method: 'GET', dependencies: { fetchTextImpl } })
    expect(result.status).toBe(200)
    expect(fetchTextImpl).toHaveBeenCalled()
    if (!['barrattdue', 'samas'].includes(institution)) expect(result.body).toMatchObject({ status: 'transport-error', error: 'synthetic-transport-probe' })
    else expect(result.body.status).toBe('source-changed') // These adapters collect per-page failures.
  })

  it.each(['https://synthetic.invalid/file', 'https://www.ntnu.no/other', 'https://127.0.0.1/internal'])('checks real HTTP redirects before a second network request %s', async location => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const get = vi.spyOn(https, 'get').mockImplementation((_url, _options, callback) => {
      const transport = new EventEmitter(); transport.setTimeout = () => {}
      queueMicrotask(() => callback(Object.assign(Readable.from([]), { statusCode: 302, headers: { location } })))
      return transport
    })
    const url = 'https://www.ntnu.no/studier/alle'
    const guard = hostedSourceGuard(url, input => { if (input.href !== url) throw new Error('provider-redirect-guard') })
    await expect(fetchPublicBytes(url, 0, guard)).rejects.toThrow()
    expect(get).toHaveBeenCalledOnce()
    expect(lookup).toHaveBeenCalledOnce()
  })

  it('rejects provider DNS resolving to a private network before HTTPS', async () => {
    lookup.mockResolvedValue([{ address: '10.1.2.3', family: 4 }])
    const get = vi.spyOn(https, 'get')
    await expect(fetchPublicBytes(calendarUrl, 0, hostedSourceGuard(calendarUrl))).rejects.toThrow('offentlig kalender')
    expect(get).not.toHaveBeenCalled()
  })
})
