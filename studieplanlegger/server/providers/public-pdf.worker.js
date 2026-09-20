import { parentPort, workerData } from 'node:worker_threads'
import { extractPublicPdfDocument } from './public-pdf-parser.js'

let loading
try {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  loading = getDocument({ data: workerData.bytes, isEvalSupported: false, useSystemFonts: true })
  const pages = await extractPublicPdfDocument(await loading.promise, { maxPages: workerData.maxPages })
  await loading.destroy(); loading = null
  parentPort.postMessage({ publicPdf: true, ok: true, pages })
} catch (error) {
  parentPort.postMessage({ publicPdf: true, ok: false, status: error.status || 'source-changed', error: error.status ? error.message : 'PDF-kilden kunne ikke leses lokalt. Bruk dokumentimport eller tekstutdrag.' })
} finally {
  await loading?.destroy()
}
