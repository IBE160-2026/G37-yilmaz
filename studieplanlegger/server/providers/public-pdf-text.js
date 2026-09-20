import { Worker } from 'node:worker_threads'
import { fail } from './program-source.js'

const cache = new WeakMap()
const workerUrl = new URL('./public-pdf.worker.js', import.meta.url)
const defaultWorker = (url, options) => new Worker(url, options)

// Termination stops both PDF.js and text extraction, including a page read that
// never resolves. Only a complete, successfully stopped reader can be cached.
async function parseInWorker(bytes, { maxPages, signal, milliseconds, workerFactory }) {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const data = new Uint8Array(bytes)
    let worker, timer, settled = false
    const finish = async (error, pages) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      try { await worker?.terminate() } catch { error ||= new Error('PDF-leseren kunne ikke stoppes.') }
      worker?.removeAllListeners()
      error ? reject(error) : resolve(pages)
    }
    const abort = () => finish(new DOMException('PDF-lesingen er avbrutt. Ingen plan er lagret.', 'AbortError'))
    try { worker = workerFactory(workerUrl, { workerData: { bytes: data, maxPages }, transferList: [data.buffer] }) }
    catch (error) { finish(error); return }
    timer = setTimeout(() => finish(Object.assign(new Error('PDF-lesingen tok for lang tid og er stoppet. Bruk et mindre utdrag i dokumentimport eller registrer planen manuelt.'), { status: 'not-supported' })), milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
    worker.on('message', message => {
      if (message?.publicPdf !== true) return
      if (message.ok && Array.isArray(message.pages)) finish(null, message.pages)
      else finish(Object.assign(new Error(message.error || 'PDF-kilden kunne ikke leses lokalt.'), { status: message.status || 'source-changed' }))
    })
    worker.on('error', error => finish(error))
    worker.on('exit', () => { if (!settled) finish(new Error('PDF-leseren stoppet før dokumentet var ferdig lest.')) })
    if (signal?.aborted) abort()
  })
}

// Keep source coordinates: merged table cells cannot safely become plain text.
export async function readPublicPdfItems(fetchBytes, url, validateUrl, { maxPages = 100, milliseconds = 30000, workerFactory = defaultWorker } = {}) {
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 200) fail('invalid-selection', 'Ugyldig sidegrense for offentlig PDF-lesing.')
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 1 || milliseconds > 60000) fail('invalid-selection', 'Ugyldig tidsgrense for offentlig PDF-lesing.')
  validateUrl(url); fetchBytes?.signal?.throwIfAborted()
  if (typeof fetchBytes !== 'function') fail('not-supported', 'Lokal PDF-lesing er ikke tilgjengelig.')
  const key = fetchBytes.cacheKey || fetchBytes
  let entries = cache.get(key)
  if (!entries) { entries = new Map(); cache.set(key, entries) }
  const existing = entries.get(url)
  if (existing && Date.now() - existing.time < 600000) {
    if (existing.pages.length > maxPages) fail('not-supported', `PDF-kilden har over ${maxPages} sider. Bruk et relevant utdrag i dokumentimport.`)
    return existing.pages
  }
  const bytes = await fetchBytes(url, 0, validateUrl, { maxBytes: 10_000_000 })
  fetchBytes.signal?.throwIfAborted()
  if (bytes.length > 10_000_000 || Buffer.from(bytes).subarray(0, 5).toString() !== '%PDF-') fail('source-changed', 'Kilden er ikke en PDF innen grensen på 10 MB.')
  try {
    const pages = await parseInWorker(bytes, { maxPages, signal: fetchBytes.signal, milliseconds, workerFactory })
    fetchBytes.signal?.throwIfAborted()
    if (entries.size >= 12) entries.delete(entries.keys().next().value)
    entries.set(url, { time: Date.now(), pages })
    return pages
  } catch (error) {
    if (error.status || error.name === 'AbortError') throw error
    fail('source-changed', 'PDF-kilden kunne ikke leses lokalt. Bruk dokumentimport eller tekstutdrag.')
  }
}
