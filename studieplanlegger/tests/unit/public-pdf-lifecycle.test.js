import { readFile } from 'node:fs/promises'
import { Worker } from 'node:worker_threads'
import { describe, expect, it, vi } from 'vitest'
import { readPublicPdfItems } from '../../server/providers/public-pdf-text.js'
import { extractPublicPdfDocument } from '../../server/providers/public-pdf-parser.js'

const url = 'https://uit.no/Content/868803/cache=20260919/studieplan.pdf'
const validate = vi.fn()
const fixture = () => readFile(new URL('../fixtures/uit-programs/pdf/868803.pdf', import.meta.url))

describe('terminable public PDF reader', () => {
  it('reads a real public fixture with coordinates, caches only success, and checks page limits on cache hits', async () => {
    const fetchBytes = vi.fn(async () => fixture())
    const pages = await readPublicPdfItems(fetchBytes, url, validate)
    expect(pages.length).toBeGreaterThan(1)
    const items = pages.flatMap(page => page.items)
    expect(items.map(item => item.str).join(' ')).toMatch(/informatikk/i)
    expect(items.some(item => item.transform.length === 6 && item.width > 0)).toBe(true)
    expect(await readPublicPdfItems(fetchBytes, url, validate)).toBe(pages)
    await expect(readPublicPdfItems(fetchBytes, url, validate, { maxPages: 1 })).rejects.toMatchObject({ status: 'not-supported' })
    expect(fetchBytes).toHaveBeenCalledTimes(1)
  }, 20000)

  it.each(['abort', 'timeout'])('terminates an actually running hung worker on %s, cleans up, and permits successful retry', async mode => {
    const bytes = await fixture(), controller = new AbortController(), heartbeat = new SharedArrayBuffer(4), count = new Int32Array(heartbeat)
    const fetchBytes = vi.fn(async () => bytes); fetchBytes.signal = controller.signal
    let worker
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const workerFactory = () => {
      worker = new Worker(new URL('../fixtures/public-pdf-hung.worker.js', import.meta.url), { workerData: { heartbeat } })
      return worker
    }
    const pending = readPublicPdfItems(fetchBytes, url, validate, { workerFactory, milliseconds: mode === 'timeout' ? 1000 : 10000 })
    const rejected = expect(pending).rejects.toMatchObject(mode === 'abort' ? { name: 'AbortError' } : { status: 'not-supported', message: expect.stringMatching(/stoppet/) })
    await vi.waitFor(() => expect(Atomics.load(count, 0)).toBeGreaterThan(0))
    if (mode === 'abort') controller.abort()
    await rejected
    expect(worker.threadId).toBe(-1)
    expect(worker.eventNames()).toEqual([])
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    const stoppedAt = Atomics.load(count, 0)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(Atomics.load(count, 0)).toBe(stoppedAt)
    fetchBytes.signal = new AbortController().signal
    const pages = await readPublicPdfItems(fetchBytes, url, validate)
    expect(pages.length).toBeGreaterThan(1)
    expect(fetchBytes).toHaveBeenCalledTimes(2)
    expect(await readPublicPdfItems(fetchBytes, url, validate)).toBe(pages)
    expect(fetchBytes).toHaveBeenCalledTimes(2)
  }, 20000)

  it('does not cache parser failure or launch a worker for rejected URLs/bytes', async () => {
    const fetchBytes = vi.fn().mockResolvedValueOnce(Buffer.from('%PDF-invalid')).mockImplementation(() => fixture())
    await expect(readPublicPdfItems(fetchBytes, url, validate)).rejects.toMatchObject({ status: 'source-changed' })
    expect((await readPublicPdfItems(fetchBytes, url, validate)).length).toBeGreaterThan(1)
    expect(fetchBytes).toHaveBeenCalledTimes(2)
    const workerFactory = vi.fn()
    await expect(readPublicPdfItems(fetchBytes, url, () => { throw new Error('rejected URL') }, { workerFactory })).rejects.toThrow('rejected URL')
    await expect(readPublicPdfItems(async () => Buffer.from('<html>'), url, validate, { workerFactory })).rejects.toMatchObject({ status: 'source-changed' })
    expect(workerFactory).not.toHaveBeenCalled()
  }, 20000)
})

describe('bounded public PDF text streaming', () => {
  it('does not count raw whitespace as readable document text', async () => {
    const reader = { read: vi.fn().mockResolvedValueOnce({ done: false, value: { items: [{ str: ' '.repeat(200) }] } }).mockResolvedValue({ done: true }), cancel: vi.fn(async () => {}), releaseLock: vi.fn() }
    const page = { streamTextContent: () => ({ getReader: () => reader }), cleanup: vi.fn() }
    await expect(extractPublicPdfDocument({ numPages: 1, getPage: async () => page }, { maxPages: 100 })).rejects.toMatchObject({ status: 'not-supported', message: expect.stringMatching(/mangler lesbar tekst/) })
    expect(reader.cancel).toHaveBeenCalledOnce(); expect(page.cleanup).toHaveBeenCalledOnce()
  })
  it('rejects excess raw text before consuming/assembling the remaining page and closes its reader', async () => {
    const reader = { read: vi.fn().mockResolvedValueOnce({ done: false, value: { items: [{ str: 'first chunk' }] } }).mockResolvedValueOnce({ done: false, value: { items: [{ str: ' '.repeat(200) }] } }), cancel: vi.fn(async () => {}), releaseLock: vi.fn() }
    const page = { streamTextContent: () => ({ getReader: () => reader }), cleanup: vi.fn(), getTextContent: vi.fn() }
    const doc = { numPages: 2, getPage: vi.fn(async () => page) }
    await expect(extractPublicPdfDocument(doc, { maxPages: 100, maxCharacters: 100 })).rejects.toMatchObject({ status: 'not-supported' })
    expect(reader.read).toHaveBeenCalledTimes(2)
    expect(doc.getPage).toHaveBeenCalledTimes(1)
    expect(page.getTextContent).not.toHaveBeenCalled()
    expect(reader.cancel).toHaveBeenCalledOnce(); expect(reader.releaseLock).toHaveBeenCalledOnce(); expect(page.cleanup).toHaveBeenCalledOnce()
  })
})
