const productionHost = 'ajour-sooty.vercel.app'
export const fihEdgePath = '/api/import/fih-edge'
const maximumCalendarBytes = 2_000_000

export function deploymentOrigin(host, deploymentHost) {
  if (host === productionHost || host === deploymentHost && /^[a-z0-9-]+\.vercel\.app$/.test(host)) return `https://${host}`
  return null
}

async function boundedFihText(message, limit, signal) {
  if (!message.body || Number(message.headers.get('content-length')) > limit) throw new Error('Kildesvaret er for stort eller tomt.')
  const reader = message.body.getReader()
  const decoder = new TextDecoder()
  const chunks = []
  let bytes = 0
  const cancel = () => { reader.cancel().catch(() => {}) }
  try {
    signal?.throwIfAborted()
    signal?.addEventListener('abort', cancel, { once: true })
    for (;;) {
      const { value, done } = await reader.read()
      signal?.throwIfAborted()
      if (done) return chunks.join('') + decoder.decode()
      if ((bytes += value.byteLength) > limit) {
        cancel()
        throw new Error('Kildesvaret er for stort.')
      }
      chunks.push(decoder.decode(value, { stream: true }))
    }
  } finally {
    signal?.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}

export function createFihEdgeFallback(host, deploymentHost, fetchImpl = fetch) {
  const origin = deploymentOrigin(host, deploymentHost) ?? deploymentOrigin(deploymentHost, deploymentHost)
  if (!origin) return undefined
  return async ({ sourceUrl, sourceObjectId, catalogueUrl }, signal) => {
    const timeout = AbortSignal.timeout(13_000)
    const bounded = signal ? AbortSignal.any([signal, timeout]) : timeout
    const response = await fetchImpl(new URL(fihEdgePath, origin), {
      method: 'POST', redirect: 'error', cache: 'no-store',
      signal: bounded,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceUrl, sourceObjectId, catalogueUrl }),
    })
    if (!response.ok || !/^text\/calendar(?:;|$)/i.test(response.headers.get('Content-Type') || '')) throw new Error('Reservehentingen av Fjellhaug-kalenderen feilet.')
    return boundedFihText(response, maximumCalendarBytes, bounded)
  }
}

function selectedCalendar({ sourceUrl, sourceObjectId, catalogueUrl } = {}) {
  if (typeof sourceUrl !== 'string' || typeof catalogueUrl !== 'string' || typeof sourceObjectId !== 'string') return null
  const fixed = new URL('https://fih.edupage.org/webcal')
  const url = new URL(sourceUrl)
  fixed.search = url.search
  if (fixed.href !== sourceUrl || [...fixed.searchParams].length !== 3 ||
    !/^[A-F0-9]{16}$/i.test(fixed.searchParams.get('pwd') || '') || fixed.searchParams.get('type') !== 'plan' ||
    !/^-\d{1,6}$/.test(sourceObjectId) || fixed.searchParams.get('studentid') !== sourceObjectId) return null
  return fixed
}

const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function createFihEdgeHandler(deploymentHost, fetchImpl = fetch) {
  return async request => {
    const reply = (status, error) => Response.json({ error }, { status, headers: responseHeaders })
    const route = new URL(request.url)
    const origin = deploymentOrigin(route.hostname, deploymentHost)
    if (!origin || route.origin !== origin ||
      request.headers.has('Origin') && request.headers.get('Origin') !== origin ||
      !['', 'none', 'same-origin'].includes(String(request.headers.get('Sec-Fetch-Site') || '').toLowerCase())) return reply(403, 'Reservehentingen må startes fra Ajour.')
    if (request.method !== 'POST') return reply(405, 'Reservehentingen krever POST.')
    if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('Content-Type') || '')) return reply(415, 'Reservehentingen krever JSON.')
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(11_000)])
    let selected, calendar
    try {
      selected = JSON.parse(await boundedFihText(request, 8192, signal))
      calendar = selectedCalendar(selected)
    } catch { return reply(400, 'Ugyldig Fjellhaug-valg.') }
    if (!calendar) return reply(400, 'Ugyldig Fjellhaug-valg.')
    const options = { signal, redirect: 'error', cache: 'no-store' }
    try {
      const listing = await fetchImpl(new URL('/api/import/calendar-sources/fih', origin), options)
      if (!listing.ok) return reply(502, 'Kunne ikke bekrefte publisert Fjellhaug-valg.')
      const { results } = JSON.parse(await boundedFihText(listing, 300_000, signal))
      if (!Array.isArray(results) || !results.some(row => row?.sourceUrl === selected.sourceUrl &&
        row.catalogueUrl === selected.catalogueUrl && row.sourceObjectId === selected.sourceObjectId)) return reply(400, 'Valget finnes ikke i de publiserte Fjellhaug-oversiktene.')
      const upstream = await fetchImpl(calendar, options)
      if (!upstream.ok) return reply(502, 'Kunne ikke hente den publiserte Fjellhaug-kalenderen.')
      const data = await boundedFihText(upstream, maximumCalendarBytes, signal)
      return new Response(data, { headers: { ...responseHeaders, 'Content-Type': 'text/calendar; charset=utf-8' } })
    } catch { return reply(502, 'Kunne ikke hente den publiserte Fjellhaug-kalenderen.') }
  }
}
