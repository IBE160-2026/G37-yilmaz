import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { load } from 'cheerio'
import { providerRequest } from './providers/index.js'
import { safeSourceError } from './providers/source-error.js'
import { gunzip, inflate, brotliDecompress } from 'node:zlib'
import { isPublicPlandiscUrl, fetchPlandiscCalendar } from './providers/plandisc-calendar.js'
import { hfyCalendarSources, fetchHfyCalendar } from './providers/hfy-calendar.js'
import { gestaltCalendarSources, fetchGestaltCalendar } from './providers/gestalt-calendar.js'
import { phsExamSources, fetchPhsExamCalendar } from './providers/phs-calendar.js'
import { ansgarCalendarSources, fetchAnsgarCalendar } from './providers/ansgar-calendar.js'
import { fihCalendarSources, fetchFihCalendar } from './providers/fih-calendar.js'
import { publicTpViewSelection, fetchPublicTpView, isPublicTpCalendarUrl, fetchPublicTpCalendar } from './providers/public-tp.js'

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
export async function fetchPublicBytes(input, redirects = 0, validateUrl, { signal, usnCatalogue, anonymousShare, anonymousSession, maxBytes = 2_000_000 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 10_000_000) throw new Error('Ugyldig grense for offentlig kildehenting.')
  signal?.throwIfAborted()
  const url = new URL(input.replace(/^webcal:/i, 'https:'))
  validateUrl?.(url)
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Bruk en offentlig HTTPS-kalenderlenke uten brukernavn eller passord.')
  if(anonymousShare&&(anonymousShare.origin!=='https://ansgarskolenno-my.sharepoint.com'||url.origin!==anonymousShare.origin||!(anonymousShare.cookies instanceof Map)))throw new Error('Den anonyme delingsforespørselen har forlatt sin publiserte vert.')
  if(anonymousSession&&(
    anonymousSession.origin!=='https://tp.educloud.no'||url.origin!==anonymousSession.origin||
    anonymousSession.pathPrefix!=='/himolde/'||!url.pathname.startsWith(anonymousSession.pathPrefix)||
    !(anonymousSession.cookies instanceof Map)||anonymousSession.referer&&typeof anonymousSession.referer!=='string'
  ))throw new Error('Den anonyme TP-forespørselen har forlatt sin publiserte institusjonssti.')
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
    const cookieJar=anonymousShare?.cookies||anonymousSession?.cookies
    if(cookieJar?.size)options.headers.Cookie=[...cookieJar].map(([key,value])=>`${key}=${value}`).join('; ')
    if(anonymousSession?.referer){options.headers.Referer=anonymousSession.referer;options.headers['X-Requested-With']='XMLHttpRequest'}
    if (body) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json;charset=UTF-8'; options.headers['Content-Length'] = Buffer.byteLength(body) }
    const request = body ? https.request(url, options, resolve) : https.get(url, options, resolve)
    request.setTimeout(12000, () => request.destroy(new Error('Hentingen tok for lang tid. Prøv igjen eller last opp en .ics-fil.')))
    request.on('error', reject)
    if (body) request.end(body)
  })
  // Ansgar publishes anonymous SharePoint links that issue temporary cookies.
  // These stay in a request-local jar and are never sent to another origin or
  // persisted as a student's credentials. Provider guards reject login paths.
  const cookieJar=anonymousShare?.cookies||anonymousSession?.cookies
  if(cookieJar)for(const value of response.headers['set-cookie']||[]){const cookie=value.split(';',1)[0],match=cookie.match(/^([A-Za-z0-9_-]{1,100})=([^\r\n]*)$/);if(match){cookieJar.set(match[1],match[2]);if([...cookieJar].reduce((n,[k,v])=>n+k.length+v.length,0)>16000){response.destroy();throw new Error('Den offentlige kilden returnerte for store midlertidige sesjonsopplysninger.')}}}
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    response.resume()
    if (body) throw new Error('USNs katalogsøk ble videresendt. Oppslaget ble stoppet; eksisterende data er beholdt.')
    if (redirects >= 3 || !response.headers.location) throw new Error('Kilden videresender for mange ganger. Bruk en direkte kalenderlenke.')
    return fetchPublicBytes(new URL(response.headers.location, url).href, redirects + 1, validateUrl, { signal, maxBytes, anonymousShare, anonymousSession })
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
export function parseNtnuPage(html, { code, semester, year, sourceUrl, campus: selectedCampus = '' }) {
  const $ = load(html), clean = selector => $(selector).first().text().replace(/\s+/g, ' ').trim()
  if ($('#course-details').attr('data-coursecode') !== code || !clean('.course-name')) throw new Error('Fant ikke emnet hos NTNU. Kontroller emnekoden eller registrer emnet manuelt.')
  const academicYear = semester === 'spring' ? Number(year) - 1 : Number(year)
  if (Number($('#selectedYear option[selected]').val()) !== academicYear) throw new Error('NTNU har ikke returnert emneinformasjon for valgt studieår. Velg et annet år eller registrer emnet manuelt.')
  let credits = null, teachingStart = '', campus = '', campusNote = ''
  const campusFacts = []
  $('.course-fact').each((_i, node) => {
    const label = $(node).find('.course-fact-label').text().trim()
    // Some facts place their label inside the value (not beside it).
    const valueNode = $(node).find('.course-fact-value').clone()
    valueNode.find('.course-fact-label').remove()
    const value = valueNode.text().replace(/\s+/g, ' ').trim()
    if (label === 'Studiepoeng' && /^\d+(,\d+)?$/.test(value)) credits = Number(value.replace(',', '.'))
    if (label === 'Undervisningsstart') teachingStart = value
    if (label === 'Sted') campusFacts.push(value)
  })
  if (campusFacts.length) {
    // NTNU can publish several places in the same fact. They are evidence of
    // available campuses, not a single course identity or student affiliation.
    const value = campusFacts.join(', '), known = value.match(/Trondheim|Gjøvik|Ålesund/gi)
    const places = [...new Set(known && /^[\s,;/|·&]*$/.test(value.replace(/Trondheim|Gjøvik|Ålesund/gi, '').replace(/\bog\b/gi, '')) ? known : campusFacts)]
    if (places.length > 1) {
      campusNote = `Emnekilden oppgir flere studiesteder: ${places.join(', ')}.`
      if (selectedCampus) {
        campus = places.find(place => place.toLocaleLowerCase('nb') === String(selectedCampus).trim().toLocaleLowerCase('nb')) || ''
        if (!campus) throw new Error('Valgt campus finnes ikke blant studiestedene i NTNUs emnekilde. Kontroller campusvalget først.')
        campusNote += ` Valgt publisert campus: ${campus}.`
      }
    } else campus = places[0]
  }
  let calendarUrl = null
  const href = $('a.ical').attr('href')
  if (href) {
    const url = new URL(href, sourceUrl)
    if (url.origin === 'https://tp.educloud.no' && url.pathname === '/ntnu/timeplan/ical.php') { url.searchParams.set('sem', `${String(year).slice(-2)}${semester === 'spring' ? 'v' : 'h'}`); calendarUrl = url.href }
  }
  const course = { id: `ntnu:${code}:${year}:${semester}`, code, name: clean('.course-name'), university: 'NTNU', semester, year: Number(year), credits, campus, description: clean('.content-course-content'), notes: campusNote, sourceUrl, teachingStart }
  const warnings = ['Emneinformasjon og undervisning hentes separat. Ingen innleveringsoppgaver opprettes fra emnebeskrivelsen.']
  if (campusNote) warnings.push(campusNote)
  if (credits === null) warnings.push('Studiepoeng mangler i kilden.')
  if (!course.description) warnings.push('Beskrivelse mangler i kilden.')
  if (teachingStart && !teachingStart.includes(`${semester === 'spring' ? 'Vår' : 'Høst'} ${year}`)) warnings.push(`Kilden oppgir undervisningsstart «${teachingStart}». Kontroller at valgt semester er riktig.`)
  return { course, calendarUrl, warnings }
}
export const universityProviders = {
  ntnu: async ({ code, semester, year, campus }, { fetchText = fetchPublicText } = {}) => {
    code = String(code || '').trim().toUpperCase()
    if (!/^[A-ZÆØÅ]{2,10}\d{3,6}[A-Z]?$/.test(code)) throw new Error('Skriv en gyldig NTNU-emnekode, for eksempel TDT4110.')
    if (!['spring', 'autumn'].includes(semester) || !/^\d{4}$/.test(String(year)) || Number(year) < 1900 || Number(year) > 2200) throw new Error('Velg gyldig semester og år.')
    const sourceUrl = `https://www.ntnu.no/studier/emner/${encodeURIComponent(code)}/${semester === 'spring' ? Number(year) - 1 : year}`
    const validate = input => {
      if (new URL(input).href !== sourceUrl) throw new Error('NTNU videresendte til et annet emne eller studieår. Bruk emnets offentlige side eller manuell registrering.')
    }
    return parseNtnuPage(await fetchText(sourceUrl, 0, validate), { code, semester, year, sourceUrl, campus })
  },
}
export async function readImportBody(req, { maxBytes = 8192, signal } = {}) {
  const tooLarge = () => Object.assign(new Error('Kalenderlenken er for lang.'), { httpStatus: 413 })
  const length = req.headers['content-length']
  if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > maxBytes)) throw tooLarge()
  let raw
  try { raw = req.body } catch { throw new Error('Ugyldig JSON i forespørselen.') }
  if (raw === undefined) {
    let size = 0
    const chunks = []
    for await (const chunk of req) {
      signal?.throwIfAborted()
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > maxBytes) throw tooLarge()
      chunks.push(bytes)
    }
    raw = Buffer.concat(chunks)
  }
  if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) {
    try { raw = JSON.stringify(raw) } catch { throw new Error('Ugyldig JSON i forespørselen.') }
  }
  if (raw === undefined) throw new Error('Ugyldig JSON i forespørselen.')
  if (Buffer.byteLength(raw) > maxBytes) throw tooLarge()
  let body
  try { body = JSON.parse(raw.toString('utf8')) } catch { throw new Error('Ugyldig JSON i forespørselen.') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Oppgi en kalenderlenke.')
  return body
}
export function importMiddleware(req, res, next, { fetchTextImpl = fetchPublicText, fetchBytesImpl = fetchPublicBytes, providerRequestImpl = providerRequest, hostedPolicy } = {}) {
  const url = new URL(req.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/import/')) return next()
  const controller = new AbortController()
  let timer, fetches = 0, totalBytes = 0, finishDeadline, limitError
  const deadline = new Promise(resolve => { finishDeadline = resolve })
  res.on('close', () => { clearTimeout(timer); if (!res.writableEnded) { controller.abort(); finishDeadline() } })
  const exhaustImport = message => {
    limitError ||= Object.assign(new Error(message), { status: 'import-limit', httpStatus: 400 })
    controller.abort(limitError)
    // Adapters may catch individual source failures and return partial success.
    // A request-wide limit is terminal even when an adapter catches the error.
    send(limitError.httpStatus, { status: limitError.status, error: limitError.message })
    finishDeadline()
    throw limitError
  }
  const wrapFetch = impl => async (input, redirects, validate, options = {}) => {
    if (limitError) throw limitError
    controller.signal.throwIfAborted()
    const guard = hostedPolicy ? hostedPolicy.sourceGuard(input, validate) : validate
    guard?.(new URL(String(input).replace(/^webcal:/i, 'https:')))
    if (hostedPolicy && ++fetches > 250) exhaustImport('Importen krever for mange kildeoppslag. Bruk et mindre kildeutvalg eller filimport.')
    const data = await impl(input, redirects, guard, { ...options, signal: controller.signal })
    controller.signal.throwIfAborted()
    if (hostedPolicy && (totalBytes += Buffer.byteLength(data)) > 30_000_000) exhaustImport('Importen er for stor. Bruk et mindre kildeutvalg eller filimport.')
    return data
  }
  const fetchText = wrapFetch(fetchTextImpl), fetchBytes = wrapFetch(fetchBytesImpl)
  fetchText.cacheKey = hostedPolicy ? fetchText : fetchTextImpl; fetchText.signal = controller.signal
  fetchBytes.cacheKey = hostedPolicy ? fetchBytes : fetchBytesImpl; fetchBytes.signal = controller.signal
  const ntnuDetails = query => universityProviders.ntnu(query, { fetchText })
  const send = (status, data, headers = {}) => {
    clearTimeout(timer)
    if (res.destroyed || res.writableEnded) return
    let body = JSON.stringify(data)
    if (hostedPolicy && Buffer.byteLength(body) > 3_000_000) { status = 502; body = JSON.stringify({ error: 'Kildeutvalget er for stort. Velg færre emner eller bruk filimport.' }) }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }); res.end(body)
  }
  if (hostedPolicy) {
    try { hostedPolicy.authorize(req) } catch (error) { return send(403, { error: error.message }) }
    if (Buffer.byteLength(req.url) > 8192) return send(414, { error: 'Kildevalget er for langt.' })
    timer = setTimeout(() => { controller.abort(); send(504, { status: 'timeout', error: 'Importen tok for lang tid. Prøv et mindre kildeutvalg, filimport eller manuell registrering.' }); finishDeadline() }, hostedPolicy.deadlineMs)
  } else {
    if (!/^(?:127\.0\.0\.1|localhost|[a-z0-9.-]+\.localhost|\[::1\])(?::\d+)?$/i.test(req.headers.host || '')) return send(403, { error: 'Importtjenesten er bare tilgjengelig på denne datamaskinen.' })
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(403, { error: 'Henting må startes fra Ajour.' })
    if (/^cross-site$/i.test(req.headers['sec-fetch-site'] || '')) return send(403, { error: 'Importtjenesten kan ikke startes fra et annet nettsted.' })
  }
  const operation = (async () => {
    const provider = url.pathname.match(/^\/api\/import\/providers\/([a-z0-9-]+)\/(search|details|programs|program-cohorts|program-plan|teaching-search|teaching-calendar)$/)
    const method = url.pathname === '/api/import/calendar' ? 'POST' : provider || /^\/api\/import\/(?:ntnu|calendar-sources\/(?:hfy|gestalt|phs|ansgar|fih))$/.test(url.pathname) ? 'GET' : null
    if (hostedPolicy && method && req.method !== method) return send(405, { error: 'HTTP-metoden støttes ikke for denne importen.' }, { Allow: method })
    if (provider && req.method === 'GET') return send(200, await providerRequestImpl(provider[1], provider[2], Object.fromEntries(url.searchParams), { fetchText, fetchBytes, ntnuDetails }))
    if (url.pathname === '/api/import/ntnu' && req.method === 'GET') return send(200, await ntnuDetails(Object.fromEntries(url.searchParams)))
    if (url.pathname === '/api/import/calendar-sources/hfy' && req.method === 'GET') return send(200, await hfyCalendarSources({ fetchText }))
    if (url.pathname === '/api/import/calendar-sources/gestalt' && req.method === 'GET') return send(200, await gestaltCalendarSources({ fetchText, fetchBytes }))
    if (url.pathname === '/api/import/calendar-sources/phs' && req.method === 'GET') return send(200, phsExamSources())
    if (url.pathname === '/api/import/calendar-sources/ansgar' && req.method === 'GET') return send(200, await ansgarCalendarSources({ fetchText }))
    if (url.pathname === '/api/import/calendar-sources/fih' && req.method === 'GET') return send(200, await fihCalendarSources({ fetchText, fetchBytes }))
    if (url.pathname === '/api/import/calendar' && req.method === 'POST') {
      if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) return send(415, { error: 'Ugyldig forespørsel. Bruk JSON.' })
      const { url: calendarUrl, sourceObjectId } = await readImportBody(req, { signal: controller.signal })
      if (typeof calendarUrl !== 'string') throw new Error('Oppgi en kalenderlenke.')
      hostedPolicy?.calendarSource(calendarUrl)
      if (publicTpViewSelection(calendarUrl)) return send(200, await fetchPublicTpView(calendarUrl, { fetchText }))
      if (new URL(calendarUrl).origin === 'https://tp.educloud.no' && /\/app\/schedule\/?$/.test(new URL(calendarUrl).pathname)) throw new Error('TP-visningen må velge ett offentlig emne med semester og undervisningstermin. Bruk TP-eksport til ICS for andre visninger.')
      if (isPublicTpCalendarUrl(calendarUrl) && new URL(calendarUrl).searchParams.get('type') === 'course') return send(200, await fetchPublicTpCalendar(calendarUrl, { fetchText }))
      if (isPublicPlandiscUrl(calendarUrl)) return send(200, await fetchPlandiscCalendar(calendarUrl, { fetchText }))
      if (new URL(calendarUrl).origin === 'https://ansgarskolenno-my.sharepoint.com') return send(200, await fetchAnsgarCalendar(calendarUrl, { fetchText, fetchBytes }))
      if (new URL(calendarUrl).origin === 'https://fih.edupage.org') return send(200, await fetchFihCalendar(calendarUrl, { sourceObjectId, fetchText, fetchBytes }))
      if (/^https:\/\/s3-gustav\.imgix\.net\/hfy\/[^?#]+\.pdf$/.test(calendarUrl)) return send(200, await fetchHfyCalendar(calendarUrl, { fetchText, fetchBytes }))
      if (/^https:\/\/img1\.wsimg\.com\/blobby\/go\/[^?#]+\.pdf$/.test(calendarUrl)) return send(200, await fetchGestaltCalendar(calendarUrl, { sourceObjectId, fetchText, fetchBytes }))
      if (/^https:\/\/www\.politihogskolen\.no\/for-studenter\/eksamen\/eksamensoversikt-(ba|ma)\/?$/.test(calendarUrl)) return send(200, await fetchPhsExamCalendar(calendarUrl, { fetchText }))
      const calendar = await fetchText(calendarUrl)
      if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(calendar)) throw Object.assign(new Error('Lenken åpner en nettside, ikke en ICS-kalender. Bruk sidens eksportvalg for iCalendar/ICS, kopier den direkte kalenderlenken eller last opp .ics-filen.'), { status: 'invalid-response' })
      if (!/^\s*BEGIN:VCALENDAR/im.test(calendar)) throw Object.assign(new Error('Lenken returnerte ikke en kalender. Last ned en .ics-fil og last den opp her.'), { status: 'invalid-response' })
      return send(200, { calendar })
    }
    send(404, { error: 'Denne importkilden støttes ikke.' })
  })().catch(error => {
    if (hostedPolicy) error = safeSourceError(error)
    return send(hostedPolicy ? error.httpStatus || 400 : 400, { error: error.message || 'Kunne ikke hente informasjon. Prøv filimport eller manuell registrering.', ...(typeof error.status === 'string' ? { status: error.status } : {}) })
  })
  return hostedPolicy ? Promise.race([operation, deadline]) : operation
}
