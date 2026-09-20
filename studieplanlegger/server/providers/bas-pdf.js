import { clean, fail } from './program-source.js'

const caches = new WeakMap()
// Typography is part of this published catalogue's contract. Keep embedded
// font weight and text geometry; do not infer course headings from prose names.
export function basPdfLines(items, fonts) {
  const rows = []
  for (const item of items.filter(item => typeof item.str === 'string' && item.str.length)) {
    const x = item.transform[4], y = item.transform[5], size = item.height || Math.abs(item.transform[3]), last = rows.at(-1)
    const onLine = last && x >= last.x - 1 && (Math.abs(y - last.y) <= 1.5 || size < last.size * .7 && y > last.y && y - last.y < last.size * .6)
    const row = onLine ? last : { text: '', x, y, size, segments: [] }
    if (!onLine) rows.push(row)
    const previous = row.segments.at(-1), gap = previous ? x - previous.end : 0
    const separator = previous && !/\s$/.test(row.text) && !/^\s/.test(item.str) && gap > Math.max(.5, size * .12) ? ' ' : ''
    const font = fonts[item.fontName], bold = font?.bold === true || /bold/i.test(font?.name || '')
    row.text += separator + item.str; row.size = Math.max(row.size, size)
    row.segments.push({ text: separator + item.str, bold, size, end: x + item.width })
  }
  return rows.map(row => ({ text: clean(row.text), x: row.x, size: row.size, bold: row.segments.filter(part => part.text.trim()).every(part => part.bold), boldText: clean(row.segments.filter(part => part.bold).map(part => part.text).join('')) })).filter(row => row.text)
}
export async function readBasPdf(fetchBytes, sourceUrl, validate) {
  if (typeof fetchBytes !== 'function') fail('not-supported', 'Lokal henting av offentlig PDF er ikke tilgjengelig.')
  validate(sourceUrl); fetchBytes.signal?.throwIfAborted()
  const key = fetchBytes.cacheKey || fetchBytes
  let cache = caches.get(key); if (!cache) { cache = new Map(); caches.set(key, cache) }
  const old = cache.get(sourceUrl); if (old && Date.now() - old.time < 600000) return old.pages
  const bytes = await fetchBytes(sourceUrl, 0, validate, { maxBytes: 10_000_000 })
  if (bytes.length > 10_000_000 || !Buffer.from(bytes).subarray(0, 5).equals(Buffer.from('%PDF-'))) fail('source-changed', 'BAS-kilden svarte ikke med en PDF innen grensen på 10 MB.')
  let loading
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true })
    const document = await loading.promise, pages = []; let characters = 0
    if (document.numPages > 200) fail('not-supported', 'PDF-katalogen har over 200 sider. Bruk et relevant utdrag i dokumentimport.')
    for (let number = 1; number <= document.numPages; number++) {
      fetchBytes.signal?.throwIfAborted()
      const page = await document.getPage(number), text = await page.getTextContent(); await page.getOperatorList()
      const fonts = Object.fromEntries([...new Set(text.items.map(item => item.fontName).filter(Boolean))].map(name => { try { const font = page.commonObjs.get(name); return [name, { name: font.name, bold: font.bold }] } catch { return [name, {}] } }))
      const lines = basPdfLines(text.items, fonts); characters += lines.map(line => line.text).join('').length
      if (characters > 1_000_000) fail('not-supported', 'PDF-teksten overstiger importgrensen. Bruk et mindre utdrag.')
      pages.push({ page: number, lines }); page.cleanup()
    }
    if (characters < 100) fail('not-supported', 'BAS-katalogen er skannet eller mangler lesbar tekst. Lim inn teksten eller registrer emnene manuelt.')
    if (cache.size >= 8) cache.delete(cache.keys().next().value)
    cache.set(sourceUrl, { pages, time: Date.now() }); return pages
  } catch (error) { if (error.status || error.name === 'AbortError') throw error; fail('source-changed', 'BAS-katalogen kunne ikke leses lokalt. Bruk dokumentimport eller lim inn teksten.') }
  finally { await loading?.destroy() }
}
