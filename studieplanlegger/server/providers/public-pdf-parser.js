import { clean, fail } from './program-source.js'

export async function extractPublicPdfDocument(doc, { maxPages, maxCharacters = 1_000_000 }) {
  if (doc.numPages > maxPages) fail('not-supported', `PDF-kilden har over ${maxPages} sider. Bruk et relevant utdrag i dokumentimport.`)
  const pages = []
  let characters = 0, readableCharacters = 0
  for (let page = 1; page <= doc.numPages; page++) {
    const source = await doc.getPage(page)
    let reader
    try {
      reader = source.streamTextContent().getReader()
      const items = []
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        for (const item of chunk.value.items) {
          if (typeof item.str !== 'string') continue
          // Bound raw text before normalization and before retaining a page.
          characters += item.str.length
          if (characters > maxCharacters) fail('not-supported', 'PDF-teksten overstiger importgrensen.')
          const str = clean(item.str)
          if (str) { readableCharacters += str.length; items.push({ str, transform: item.transform, width: item.width, hasEOL: item.hasEOL }) }
        }
      }
      pages.push({ page, items })
    } finally {
      await reader?.cancel().catch(() => {})
      reader?.releaseLock()
      source.cleanup()
    }
  }
  if (readableCharacters < 100) fail('not-supported', 'PDF-kilden er skannet eller mangler lesbar tekst.')
  return pages
}
