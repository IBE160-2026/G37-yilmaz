import { expect, it, vi } from 'vitest'
import { createFihEdgeFallback, createFihEdgeHandler } from '../../server/fih-edge-transport.js'

const host = 'synthetic-verified-deployment.vercel.app'
const edgeUrl = `https://${host}/api/import/fih-edge`
const catalogueUrl = 'https://fih.fjellhaug.no/ikt-verkt%C3%B8y/webcalfiler'
const selected = {
  sourceUrl: 'https://fih.edupage.org/webcal?pwd=C0DEC0DEC0DEC0DE&type=plan&studentid=-729',
  sourceObjectId: '-729', catalogueUrl,
}
const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Timetable: -729\r\nEND:VCALENDAR\r\n'
const request = (body = selected, url = edgeUrl, headers = {}) => new Request(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
})

it('uses only the trusted deployment and published calendar with abort and redirects disabled', async () => {
  const edgeFetch = vi.fn().mockResolvedValueOnce(Response.json({ results: [selected] })).mockResolvedValueOnce(new Response(calendar))
  const handler = createFihEdgeHandler(host, edgeFetch)
  const nodeFetch = vi.fn((url, options) => handler(new Request(url, options)))
  const fallback = createFihEdgeFallback('synthetic-branch-alias.vercel.app', host, nodeFetch)
  await expect(fallback(selected, new AbortController().signal)).resolves.toBe(calendar)
  expect(nodeFetch.mock.calls[0][0]).toBe(edgeUrl)
  expect(edgeFetch.mock.calls.map(([url]) => url)).toEqual(['https://ajour-sooty.vercel.app/api/import/calendar-sources/fih', selected.sourceUrl])
  for (const [, options] of [...nodeFetch.mock.calls, ...edgeFetch.mock.calls]) {
    expect(options).toMatchObject({ redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal) })
  }
})

it('rejects foreign hosts, origin, mismatched query and an oversized body before fetch', async () => {
  const fetcher = vi.fn()
  const handler = createFihEdgeHandler(host, fetcher)
  expect(createFihEdgeFallback('synthetic-foreign.vercel.app', undefined, fetcher)).toBeUndefined()
  expect((await handler(request(selected, 'https://synthetic-foreign.vercel.app/api/import/fih-edge'))).status).toBe(403)
  expect((await handler(request(selected, edgeUrl, { Origin: 'https://synthetic-foreign.vercel.app' }))).status).toBe(403)
  expect((await handler(request({ ...selected, sourceUrl: selected.sourceUrl.replace('fih.edupage.org', 'synthetic.invalid') }))).status).toBe(400)
  expect((await handler(request({ ...selected, catalogueUrl: 'x'.repeat(8192) }))).status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})

it('requires a matching published row before contacting EduPage', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ results: [{ ...selected, catalogueUrl: 'synthetic mismatch' }] }))
  const response = await createFihEdgeHandler(host, fetcher)(request())
  expect(response.status).toBe(400)
  expect(await response.text()).not.toContain(selected.sourceUrl)
  expect(fetcher).toHaveBeenCalledOnce()
})

it('sanitizes a failed calendar fetch and refuses an oversized upstream body', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ results: [selected] }))
    .mockRejectedValueOnce(new Error(selected.sourceUrl))
    .mockResolvedValueOnce(Response.json({ results: [selected] }))
    .mockResolvedValueOnce(new Response('x'.repeat(2_000_001)))
  const handler = createFihEdgeHandler(host, fetcher)
  for (const response of [await handler(request()), await handler(request())]) {
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain(selected.sourceUrl)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  }
})
