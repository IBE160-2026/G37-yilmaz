import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { load } from 'cheerio'
import { providerRequest } from './providers/index.js'
import { gunzip, inflate, brotliDecompress } from 'node:zlib'
import { isPublicPlandiscUrl, fetchPlandiscCalendar } from './providers/plandisc-calendar.js'
import { hfyCalendarSources, fetchHfyCalendar } from './providers/hfy-calendar.js'
import { gestaltCalendarSources, fetchGestaltCalendar } from './providers/gestalt-calendar.js'
import { phsExamSources, fetchPhsExamCalendar } from './providers/phs-calendar.js'
import { ansgarCalendarSources, fetchAnsgarCalendar } from './providers/ansgar-calendar.js'
import { fihCalendarSources, fetchFihCalendar } from './providers/fih-calendar.js'
import { isPublicTpCalendarUrl, fetchPublicTpCalendar } from './providers/public-tp.js'

export async function decodePublicContent(bytes, encoding, maxBytes) {
  const type=String(encoding||'identity').trim().toLowerCase()
  if(type==='identity'||!type)return bytes
  const decode={gzip:gunzip,'x-gzip':gunzip,deflate:inflate,br:brotliDecompress}[type]
  if(!decode)throw new Error('Kilden bruker en komprimering som ikke støttes.')
  try{return await new Promise((resolve,reject)=>decode(bytes,{maxOutputLength:maxBytes},(error,output)=>error?reject(error):resolve(output)))}
  catch{throw new Error(`Kildens komprimerte innhold er ugyldig eller større enn ${maxBytes/1_000_000} MB etter utpakking.`)}
}

export function isPublicIPv4(address) {
  if (!address.split('.').every(part => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)) return false
  const [a, b, c] = address.split('.').map(Number)
  return /^\d+\.\d+\.\d+\.\d+$/.test(address) && a > 0 && a < 224 && ![10, 127].includes(a) && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) && !(a === 198 && [18, 19, 51].includes(b)) && !(a === 203 && b === 0 && c === 113)
}
export async function fetchPublicBytes(input, redirects = 0, validateUrl, { signal, usnCatalogue, anonymousShare, maxBytes = 2_000_000 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 10_000_000) throw new Error('Ugyldig grense for offentlig kildehenting.')
  signal?.throwIfAborted()
  const url = new URL(input.replace(/^webcal:/i, 'https:'))
  validateUrl?.(url)
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Bruk en offentlig HTTPS-kalenderlenke uten brukernavn eller passord.')
  if(anonymousShare&&(anonymousShare.origin!=='https://ansgarskolenno-my.sharepoint.com'||url.origin!==anonymousShare.origin||!(anonymousShare.cookies instanceof Map)))throw new Error('Den anonyme delingsforespørselen har forlatt sin publiserte vert.')
  // USN's published catalogue uses a read-only POST. The body is constructed here
  // from public period filters; arbitrary payloads and student identifiers cannot pass.
  let body
  if (usnCatalogue) {
    if (url.href !== 'https://s293.usn.no/v2/studieplan//' || redirects !== 0 || !/^(20\d{2}|2100)$/.test(String(usnCatalogue.year)) || !['HØST', 'VÅR'].includes(usnCatalogue.semester) || Object.keys(usnCatalogue).some(key => !['year', 'semester'].includes(key))) throw new Error('Ugyldig offentlig USN-katalogsøk.')
    body = JSON.stringify({ faculty: '*', semester: usnCatalogue.semester, year: String(usnCatalogue.year), study: '' })
  }
  const addresses = await lookup(url.hostname, { family: 4, all: true })
  signal?.throwIfAborted()
  if (!addresses.length || addresses.some(entry => !isPublicIPv4(entry.address))) throw new Error('Lenken må peke til en offentlig kalender, ikke en lokal nettverksadresse.')
  const response = await new Promise((resolve, reject) => {
    const options = { signal, headers: { Accept: 'text/calendar,text/html,application/json;q=0.9', 'User-Agent': 'Studieplanlegger/1.0' }, lookup: (_host, options, callback) => options.all ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, 4) }
    if(anonymousShare?.cookies.size)options.headers.Cookie=[...anonymousShare.cookies].map(([key,value])=>`${key}=${value}`).join('; ')
    if (body) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json;charset=UTF-8'; options.headers['Content-Length'] = Buffer.byteLength(body) }
    const request = body ? https.request(url, options, resolve) : https.get(url, options, resolve)
    request.setTimeout(12000, () => request.destroy(new Error('Hentingen tok for lang tid. Prøv igjen eller last opp en .ics-fil.')))
    request.on('error', reject)
    if (body) request.end(body)
  })
  // Ansgar publishes anonymous SharePoint links that issue temporary cookies.
  // These stay in a request-local jar and are never sent to another origin or
  // persisted as a student's credentials. Provider guards reject login paths.
  if(anonymousShare)for(const value of response.headers['set-cookie']||[]){const cookie=value.split(';',1)[0],match=cookie.match(/^([A-Za-z0-9_-]{1,100})=([^\r\n]*)$/);if(match){anonymousShare.cookies.set(match[1],match[2]);if([...anonymousShare.cookies].reduce((n,[k,v])=>n+k.length+v.length,0)>16000){response.destroy();throw new Error('Den offentlige delingskilden returnerte for store midlertidige opplysninger.')}}}
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    response.resume()
    if (body) throw new Error('USNs katalogsøk ble videresendt. Oppslaget ble stoppet; eksisterende data er beholdt.')
    if (redirects >= 3 || !response.headers.location) throw new Error('Kilden videresender for mange ganger. Bruk en direkte kalenderlenke.')
    return fetchPublicBytes(new URL(response.headers.location, url).href, redirects + 1, validateUrl, { signal, maxBytes, anonymousShare })
  }
  if (response.statusCode !== 200) { response.resume(); throw new Error(`Kilden svarte med HTTP ${response.statusCode}. Årsaken er ikke bekreftet. Tidligere data er beholdt; bruk offentlig kildeside, fil eller manuell registrering.`) }
  let size = 0
  const chunks = []
  for await (const chunk of response) { size += chunk.length; if (size > maxBytes) { response.destroy(); throw new Error(`Kilden er større enn ${maxBytes / 1_000_000} MB. Eksporter færre emner.`) } chunks.push(chunk) }
  return decodePublicContent(Buffer.concat(chunks),response.headers['content-encoding'],maxBytes)
}
export async function fetchPublicText(input, redirects = 0, validateUrl, options = {}) {
  return (await fetchPublicBytes(input, redirects, validateUrl, { ...options, maxBytes: 2_000_000 })).toString('utf8')
}
export function parseNtnuPage(html, { code, semester, year, sourceUrl }) {
  const $ = load(html), clean = selector => $(selector).first().text().replace(/\s+/g, ' ').trim()
  if ($('#course-details').attr('data-coursecode') !== code || !clean('.course-name')) throw new Error('Fant ikke emnet hos NTNU. Kontroller emnekoden eller registrer emnet manuelt.')
  const academicYear = semester === 'spring' ? Number(year) - 1 : Number(year)
  if (Number($('#selectedYear option[selected]').val()) !== academicYear) throw new Error('NTNU har ikke returnert emneinformasjon for valgt studieår. Velg et annet år eller registrer emnet manuelt.')
  let credits = null, teachingStart = ''
  $('.course-fact').each((_i, node) => {
    const label = $(node).find('.course-fact-label').text().trim(), value = $(node).find('.course-fact-value').text().replace(/\s+/g, ' ').trim()
    if (label === 'Studiepoeng' && /^\d+(,\d+)?$/.test(value)) credits = Number(value.replace(',', '.'))
    if (label === 'Undervisningsstart') teachingStart = value
  })
  let calendarUrl = null
  const href = $('a.ical').attr('href')
  if (href) {
    const url = new URL(href, sourceUrl)
    if (url.origin === 'https://tp.educloud.no' && url.pathname === '/ntnu/timeplan/ical.php') { url.searchParams.set('sem', `${String(year).slice(-2)}${semester === 'spring' ? 'v' : 'h'}`); calendarUrl = url.href }
  }
  const course = { id: `ntnu:${code}:${year}:${semester}`, code, name: clean('.course-name'), university: 'NTNU', semester, year: Number(year), credits, description: clean('.content-course-content'), notes: '', sourceUrl, teachingStart }
  const warnings = ['Emneinformasjon og undervisning hentes separat. Ingen innleveringsoppgaver opprettes fra emnebeskrivelsen.']
  if (credits === null) warnings.push('Studiepoeng mangler i kilden.')
  if (!course.description) warnings.push('Beskrivelse mangler i kilden.')
  if (teachingStart && !teachingStart.includes(`${semester === 'spring' ? 'Vår' : 'Høst'} ${year}`)) warnings.push(`Kilden oppgir undervisningsstart «${teachingStart}». Kontroller at valgt semester er riktig.`)
  return { course, calendarUrl, warnings }
}
export const universityProviders = {
  ntnu: async ({ code, semester, year }) => {
    code = String(code || '').trim().toUpperCase()
    if (!/^[A-ZÆØÅ]{2,10}\d{3,6}[A-Z]?$/.test(code)) throw new Error('Skriv en gyldig NTNU-emnekode, for eksempel TDT4110.')
    if (!['spring', 'autumn'].includes(semester) || !/^\d{4}$/.test(String(year)) || Number(year) < 1900 || Number(year) > 2200) throw new Error('Velg gyldig semester og år.')
    const sourceUrl = `https://www.ntnu.no/studier/emner/${encodeURIComponent(code)}/${semester === 'spring' ? Number(year) - 1 : year}`
    return parseNtnuPage(await fetchPublicText(sourceUrl), { code, semester, year, sourceUrl })
  },
}
export function importMiddleware(req, res, next, { fetchTextImpl = fetchPublicText, fetchBytesImpl = fetchPublicBytes, providerRequestImpl = providerRequest } = {}) {
  const url = new URL(req.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/import/')) return next()
  const controller = new AbortController()
  res.on('close', () => { if (!res.writableEnded) controller.abort() })
  const fetchText = (input,redirects,validate,options = {}) => fetchTextImpl(input,redirects,validate,{...options,signal:controller.signal})
  fetchText.cacheKey = fetchTextImpl; fetchText.signal = controller.signal
  const fetchBytes = (input,redirects,validate,options = {}) => fetchBytesImpl(input,redirects,validate,{...options,signal:controller.signal})
  fetchBytes.cacheKey = fetchBytesImpl; fetchBytes.signal = controller.signal
  const send = (status, data) => { if(res.destroyed || res.writableEnded)return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)) }
  if (!/^(?:127\.0\.0\.1|localhost|[a-z0-9.-]+\.localhost|\[::1\])(?::\d+)?$/i.test(req.headers.host || '')) return send(403, { error: 'Importtjenesten er bare tilgjengelig på denne datamaskinen.' })
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(403, { error: 'Henting må startes fra studieplanleggeren.' })
  if (/^cross-site$/i.test(req.headers['sec-fetch-site'] || '')) return send(403, { error: 'Importtjenesten kan ikke startes fra et annet nettsted.' })
  ;(async () => {
    const provider = url.pathname.match(/^\/api\/import\/providers\/([a-z0-9-]+)\/(search|details|programs|program-cohorts|program-plan|teaching-search|teaching-calendar)$/)
    if (provider && req.method === 'GET') return send(200, await providerRequestImpl(provider[1], provider[2], Object.fromEntries(url.searchParams), { fetchText, fetchBytes, ntnuDetails: universityProviders.ntnu }))
    if (url.pathname === '/api/import/ntnu' && req.method === 'GET') return send(200, await universityProviders.ntnu(Object.fromEntries(url.searchParams)))
    if (url.pathname === '/api/import/calendar-sources/hfy' && req.method === 'GET') return send(200, await hfyCalendarSources({ fetchText }))
    if (url.pathname === '/api/import/calendar-sources/gestalt' && req.method === 'GET') return send(200, await gestaltCalendarSources({ fetchText, fetchBytes }))
    if (url.pathname === '/api/import/calendar-sources/phs' && req.method === 'GET') return send(200, phsExamSources())
    if (url.pathname === '/api/import/calendar-sources/ansgar' && req.method === 'GET') return send(200, await ansgarCalendarSources({ fetchText }))
    if (url.pathname === '/api/import/calendar-sources/fih' && req.method === 'GET') return send(200, await fihCalendarSources({ fetchText, fetchBytes }))
    if (url.pathname === '/api/import/calendar' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Ugyldig forespørsel.' })
      let size = 0
      const chunks = []
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += bytes.length
        if (size > 8192) throw new Error('Kalenderlenken er for lang.')
        chunks.push(bytes)
      }
      const body = Buffer.concat(chunks).toString('utf8')
      const { url: calendarUrl, sourceObjectId } = JSON.parse(body)
      if (typeof calendarUrl !== 'string') throw new Error('Oppgi en kalenderlenke.')
      if (isPublicTpCalendarUrl(calendarUrl) && new URL(calendarUrl).searchParams.get('type') === 'course') return send(200, await fetchPublicTpCalendar(calendarUrl, { fetchText }))
      if (isPublicPlandiscUrl(calendarUrl)) return send(200, await fetchPlandiscCalendar(calendarUrl, { fetchText }))
      if (new URL(calendarUrl).origin === 'https://ansgarskolenno-my.sharepoint.com') return send(200, await fetchAnsgarCalendar(calendarUrl, { fetchText, fetchBytes }))
      if (new URL(calendarUrl).origin === 'https://fih.edupage.org') return send(200, await fetchFihCalendar(calendarUrl, { sourceObjectId, fetchText, fetchBytes }))
      if (/^https:\/\/s3-gustav\.imgix\.net\/hfy\/[^?#]+\.pdf$/.test(calendarUrl)) return send(200, await fetchHfyCalendar(calendarUrl, { fetchText, fetchBytes }))
      if (/^https:\/\/img1\.wsimg\.com\/blobby\/go\/[^?#]+\.pdf$/.test(calendarUrl)) return send(200, await fetchGestaltCalendar(calendarUrl, { sourceObjectId, fetchText, fetchBytes }))
      if (/^https:\/\/www\.politihogskolen\.no\/for-studenter\/eksamen\/eksamensoversikt-(ba|ma)\/?$/.test(calendarUrl)) return send(200, await fetchPhsExamCalendar(calendarUrl, { fetchText }))
      const calendar = await fetchText(calendarUrl)
      if (!/^\s*BEGIN:VCALENDAR/im.test(calendar)) throw new Error('Lenken returnerte ikke en kalender. Den kan kreve innlogging. Last ned en .ics-fil og last den opp her.')
      return send(200, { calendar })
    }
    send(404, { error: 'Denne importkilden støttes ikke.' })
  })().catch(error => send(400, { error: error.message || 'Kunne ikke hente informasjon. Prøv filimport eller manuell registrering.' }))
}
