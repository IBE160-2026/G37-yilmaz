import { beforeEach, describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib'
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), get: vi.fn(), request: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }))
vi.mock('node:https', () => ({ default: { get: mocks.get, request: mocks.request } }))
import { fetchPublicText, fetchPublicBytes } from '../../server/import-api.js'
import { fetchCoursePage } from '../../server/providers/public-course.js'
import { usnPrograms } from '../../server/providers/usn-programs.js'
import { readAnsgarSharedPdf } from '../../server/providers/ansgar-public-share.js'

const first = 'https://uit.no/utdanning/emner/emne?p_document_id=923370'
const canonical = 'https://uit.no/utdanning/emner/emne/923370/fys-3000'
let responses
beforeEach(() => {
  responses = []
  mocks.lookup.mockReset().mockResolvedValue([{ address: '8.8.8.8', family: 4 }])
  const connect = (url, options, callback, waitForBody = false) => {
    const response = responses.shift()
    if (!response) throw new Error('Unexpected mocked HTTPS request; real network is never available')
    const request = new EventEmitter(); request.setTimeout = vi.fn(() => request); request.destroy = error => request.emit('error', error)
    options.lookup(url.hostname, { all: true }, (error, addresses) => { expect(error).toBeNull(); expect(addresses).toEqual([{ address: '8.8.8.8', family: 4 }]) })
    const reply = body => queueMicrotask(() => {
      const accepted = !response.accept || response.accept({ url, options, body })
      const stream = Readable.from(accepted ? response.chunks || [Buffer.from(response.body || '')] : [Buffer.from('Missing required request body or anonymous cookie')])
      stream.statusCode = accepted ? response.status : 403
      stream.headers = accepted ? { ...response.headers, ...(response.location ? { location: response.location } : {}) } : {}
      callback(stream)
    })
    request.end = vi.fn(reply)
    if (!waitForBody) reply()
    return request
  }
  mocks.get.mockReset().mockImplementation((...args) => connect(...args))
  mocks.request.mockReset().mockImplementation((...args) => connect(...args, true))
})

describe('R10 production POST and anonymous-cookie transport contracts', () => {
  it('loads USN programme records only after production transport sends the required encoded POST body and headers', async () => {
    const page = 'https://www.usn.no/studier/studie-og-emneplaner/'
    const config = { year: '2026', semester: 'HØST', minYear: '2014', maxYear: '2026' }
    const body = JSON.stringify({ faculty: '*', semester: 'HØST', year: '2026', study: '' })
    const catalogue = { stedkode: [{ studieplaninfo: [{ studieplanid: 'TEST_2026_HØST', studieplaninfodata: [{ language: 'B', metadatainfo: { aarstall: '2026', semester: 'HØST', harinfo: '1', studieprogramnavn: 'Published test programme' } }] }] }] }
    responses.push(
      { status: 200, body: `<usn-study searchoptions='${JSON.stringify(config)}'></usn-study>`, accept: ({ url, options }) => url.href === page && !options.method },
      { status: 200, body: JSON.stringify(catalogue), accept: ({ url, options, body: sent }) => url.href === 'https://s293.usn.no/v2/studieplan//' && options.method === 'POST' && sent === body && options.headers['Content-Type'] === 'application/json;charset=UTF-8' && options.headers['Content-Length'] === Buffer.byteLength(body) }
    )
    const transport = (...args) => fetchPublicText(...args)
    const result = await usnPrograms('usn', 'programs', {}, { fetchText: transport })
    expect(result.results).toMatchObject([{ code: 'TEST', name: 'Published test programme', cohort: '2026', intake: 'autumn' }])
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(mocks.request.mock.results[0].value.end).toHaveBeenCalledExactlyOnceWith(body)
    expect(responses).toEqual([])
  })

  it('reads anonymous response cookies, forwards them through the allowed redirect, and fetches only the published PDF', async () => {
    const origin = 'https://ansgarskolenno-my.sharepoint.com'
    const share = `${origin}/:b:/g/personal/kvalitet_ansgarskolen_no/ABCDEFGHIJKLMNOPQRSTUVWXYZ1234?e=public`
    const preview = `${origin}/personal/kvalitet_ansgarskolen_no/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fkvalitet_ansgarskolen_no%2FDocuments%2Fplan.pdf`
    const download = `${origin}/_layouts/15/download.aspx?UniqueId=fixture-pdf&tempauth=synthetic-public-token`
    const bytes = Buffer.from('%PDF-1.7\nSynthetic public transport fixture\n%%EOF')
    const jars = []
    responses.push(
      { status: 302, location: preview, headers: { 'set-cookie': ['AnonymousShare=fixture-session; Path=/; Secure; HttpOnly'] }, accept: ({ url, options }) => url.href === share && options.headers.Cookie === undefined },
      { status: 200, headers: { 'set-cookie': ['AnonymousRoute=fixture-route; Path=/; Secure'] }, body: JSON.stringify({ '.downloadUrl': download, FileLeafRef: 'Published plan.pdf' }), accept: ({ url, options }) => url.href === preview && options.headers.Cookie === 'AnonymousShare=fixture-session' },
      { status: 200, body: bytes, accept: ({ url, options }) => url.href === download && options.headers.Cookie === 'AnonymousShare=fixture-session; AnonymousRoute=fixture-route' }
    )
    const fetchText = (...args) => { jars.push(args[3].anonymousShare.cookies); return fetchPublicText(...args) }
    const fetchBytes = (...args) => { jars.push(args[3].anonymousShare.cookies); return fetchPublicBytes(...args) }
    const result = await readAnsgarSharedPdf(share, { fetchText, fetchBytes })
    expect(result).toEqual({ bytes, name: 'Published plan.pdf' })
    expect(mocks.get.mock.calls.map(call => call[0].href)).toEqual([share, preview, download])
    expect(mocks.request).not.toHaveBeenCalled()
    expect(jars).toHaveLength(2)
    expect(jars.every(jar => jar.size === 0)).toBe(true)
    expect(responses).toEqual([])
  })
})

describe('real fetchPublicText recursion with mocked node transport', () => {
  it('follows an allowed public redirect, retaining the original record guard', async () => {
    responses.push({ status: 302, location: canonical }, { status: 200, body: '<h1>Local fixture response</h1>' })
    expect(await fetchCoursePage(fetchPublicText, first, 'uit', '923370')).toBe('<h1>Local fixture response</h1>')
    expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.lookup).toHaveBeenCalledTimes(2)
    expect(mocks.get.mock.calls.map(call => call[0].href)).toEqual([first, canonical])
  })
  it.each([
    ['institution', 'https://www4.uib.no/studier/emner/inf100'],
    ['path', 'https://uit.no/login'],
    ['record', 'https://uit.no/utdanning/emner/emne?p_document_id=923371'],
    ['contradicting records', `${canonical}?p_document_id=923371`],
  ])('rejects a %s change on a second redirect before DNS/HTTPS for the rejected target', async (_name, target) => {
    responses.push({ status: 302, location: canonical }, { status: 302, location: target }, { status: 200, body: 'Must never be fetched' })
    await expect(fetchCoursePage(fetchPublicText, first, 'uit', '923370')).rejects.toMatchObject({ status: 'invalid-selection' })
    expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.lookup).toHaveBeenCalledTimes(2)
    expect(responses).toHaveLength(1)
  })
  it('still rejects private DNS results without starting HTTPS', async () => {
    mocks.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    await expect(fetchCoursePage(fetchPublicText, first, 'uit', '923370')).rejects.toThrow(/offentlig kalender/)
    expect(mocks.get).not.toHaveBeenCalled()
  })
  it.each([['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync]])('decodes %s from the actual HTTPS response headers and chunks', async (encoding, compress) => {
    const body = '<h1>Offentlig emneinformasjon med æ, ø og å</h1>'
    const bytes = compress(Buffer.from(body))
    responses.push({ status: 200, headers: { 'content-encoding': encoding }, chunks: [bytes.subarray(0, 5), bytes.subarray(5)] })
    expect(await fetchCoursePage(fetchPublicText, first, 'uit', '923370')).toBe(body)
    expect(mocks.get).toHaveBeenCalledTimes(1)
  })
  it.each([['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync]])('rejects %s expansion beyond the transport limit and allows a subsequent request', async (encoding, compress) => {
    const oversized = compress(Buffer.from('x'.repeat(20_001)))
    expect(oversized.length).toBeLessThan(20_000)
    responses.push({ status: 200, headers: { 'content-encoding': encoding }, body: oversized })
    await expect(fetchPublicBytes(first, 0, undefined, { maxBytes: 20_000 })).rejects.toThrow(/etter utpakking/)
    const valid = Buffer.from('A later valid public source response')
    responses.push({ status: 200, headers: { 'content-encoding': encoding }, body: compress(valid) })
    expect(await fetchPublicBytes(first, 0, undefined, { maxBytes: 20_000 })).toEqual(valid)
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })
})
