import { load } from 'cheerio'
export { load }
export const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
export const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
export const MAX_PAGES = 250
export const MAX_RESULTS = 5000
const caches = new WeakMap()
export async function cachedText(fetchText, input, validate) {
  const url = new URL(input); validate?.(url)
  fetchText.signal?.throwIfAborted()
  const cacheKey = fetchText.cacheKey || fetchText
  let cache = caches.get(cacheKey)
  if (!cache) { cache = new Map(); caches.set(cacheKey, cache) }
  const entry = cache.get(url.href)
  if (entry && Date.now() - entry.time < 600000) return entry.body
  const body = await fetchText(url.href, 0, validate)
  if (cache.size >= 128) cache.delete(cache.keys().next().value)
  cache.set(url.href, { body, time: Date.now() })
  return body
}
export function restrictedUrl(input, { origin, paths, keys = [] }) {
  let url
  try { url = new URL(input.href || input) } catch { fail('invalid-selection', 'Velg en publisert kilde fra programlisten.') }
  if (url.origin !== origin || url.username || url.password || url.hash || !paths.some(path => path.test(url.pathname)) || [...url.searchParams.keys()].some(key => !keys.includes(key) || url.searchParams.getAll(key).length !== 1)) fail('invalid-selection', 'Programlenken er utenfor den valgte offentlige kilden.')
  // An empty fragment is often emitted by a selected version link. It is not
  // a second source/cohort identity; nonempty fragments remain rejected above.
  url.hash = ''
  return url
}
export function nextPage($, current, validate) {
  const href = $('a[rel=next], .pager-next a, .pager__item--next a').first().attr('href')
  if (!href) return null
  const url = new URL(href, current); validate(url)
  return url.href
}
export async function collectPages(start, fetchText, validate, parsePage, { maxPages = MAX_PAGES, maxResults = MAX_RESULTS } = {}) {
  const seen = new Set(), results = new Map(), warnings = []; let next = start, complete = true, reason = ''
  while (next) {
    fetchText.signal?.throwIfAborted()
    if (seen.has(next) || seen.size >= maxPages || results.size >= maxResults) { complete = false; reason = seen.has(next) ? 'Kilden gjentar samme resultatside.' : 'Den synlige sikkerhetsgrensen for kildehenting er nådd.'; break }
    let page
    try { const $ = load(await cachedText(fetchText, next, validate)); page = parsePage($, next); page.next ??= nextPage($, next, validate) }
    catch (error) { if (!seen.size || error.name==='AbortError') throw error; complete = false; reason = `Neste resultatside kunne ikke hentes: ${error.message}`; break }
    seen.add(next)
    let limited = false
    for (const item of page.results) {
      const key = item.sourceUrl || item.id || item.code
      if (results.has(key)) {
        if (normalizedItem(results.get(key)) !== normalizedItem(item)) fail('source-changed', 'Katalogen returnerte motstridende opplysninger for samme programidentitet.')
        continue
      }
      if (!results.has(key) && results.size >= maxResults) {
        limited = true; complete = false; reason = 'Den synlige sikkerhetsgrensen for kildehenting er nådd.'
        continue
      }
      results.set(key, item)
    }
    warnings.push(...(page.warnings || [])); next = page.next
    if (limited) break
  }
  if (reason) warnings.push(reason)
  return { results: [...results.values()], completeness: { complete, pages: seen.size, returned: results.size, ...(reason ? { reason } : {}) }, warnings }
}
function normalizedItem(value) {
  if (Array.isArray(value)) return `[${value.map(normalizedItem).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${normalizedItem(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
export const asCredits = value => /^\d+(?:[.,]\d+)?$/.test(clean(value)) ? Number(clean(value).replace(',', '.')) : null
export function calendarTerm(value, cohort) {
  const match = clean(value).match(/^(\d{2}|\d{4})\s*(H|V|A|S|autumn|spring|høst|haust|vår|host|var)$/i)
  if (!match) return null
  // A short year names the first matching calendar year at or after the cohort.
  let year = match[1].length === 4 ? Number(match[1]) : Math.floor(Number(cohort) / 100) * 100 + Number(match[1])
  if (match[1].length === 2 && year < Number(cohort)) year += 100
  if (year < Number(cohort) || year > Number(cohort) + 20) return null
  return { year, semester: /^(v|s|spring|vår|var)$/i.test(match[2]) ? 'spring' : 'autumn' }
}
export const periodLabel = (number, term) => `${number}. studiesemester · ${term.semester === 'spring' ? 'Vår' : 'Høst'} ${term.year}`
