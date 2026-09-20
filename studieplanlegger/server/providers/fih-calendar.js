import { createHash } from 'node:crypto'
import ICAL from 'ical.js'
import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'
import { readLdhPdf } from './ldh-pdf.js'
const studentUrl = 'https://fih.fjellhaug.no/student'
const sourceGuard = input => restrictedUrl(input, { origin: 'https://fih.fjellhaug.no', paths: [/^\/student\/?$/, /^\/ikt-verkt(?:%C3%B8|ø)y\/webcalfiler\/?$/, /^\/files\/uploads\/Instruksjoner\/[^/]+\.pdf$/] })
const hash = text => createHash('sha256').update(text).digest('hex')
export function fihCalendarUrl(input) {
  const url = restrictedUrl(input, { origin: 'https://fih.edupage.org', paths: [/^\/webcal$/], keys: ['pwd', 'type', 'studentid'] })
  if (!/^[A-F\d]{16}$/i.test(url.searchParams.get('pwd') || '') || url.searchParams.get('type') !== 'plan' || !/^-\d{1,6}$/.test(url.searchParams.get('studentid') || '') || [...url.searchParams].length !== 3) fail('invalid-selection', 'Velg en offentlig publisert klassekalender fra FIH-listen.')
  return url
}
function row(name, url, catalogueUrl, sourceLabel) {
  const parsed = fihCalendarUrl(url), id = parsed.searchParams.get('studentid')
  return { id: hash(`${parsed.origin}${parsed.pathname}:${id}`), name: `${clean(name)} · ${sourceLabel}`, className: clean(name), sourceUrl: parsed.href, sourceObjectId: id, catalogueUrl, sourceLabel }
}
export function parseFihCalendarHtml(html, catalogueUrl) {
  const $ = load(html), result = new Map()
  $('main a[href]').each((_, anchor) => { const raw = new URL($(anchor).attr('href'), catalogueUrl); if (raw.origin !== 'https://fih.edupage.org' || raw.pathname !== '/webcal') return; const name = clean($(anchor).text()); if (!name) fail('source-changed', 'En offentlig kalenderlenke mangler klassebetegnelse.'); const value = row(name, raw, catalogueUrl, 'Nettsideoversikt'); result.set(value.sourceObjectId, value) })
  if (!result.size) fail('source-changed', 'Nettsiden mangler publiserte klassekalendere.')
  return [...result.values()]
}
export function parseFihCalendarPdf(pages, catalogueUrl) {
  const result = [], lines = pages.flatMap(page => page.lines.map(text => ({ page: page.page, text: clean(text) })).filter(line => line.text))
  for (const [index, line] of lines.entries()) {
    if (!line.text.startsWith('https://fih.edupage.org/webcal?')) continue
    const previous = lines[index - 1]?.text, match = previous?.match(/^([A-ZÆØÅ]{2,12})(?:\s+(\d{1,2})\s*\.\s*(Å\s*r|Y\s*ear))?\s*:\s*$/i)
    if (!match) fail('source-changed', 'PDF-kalenderlenken mangler en entydig klasseetikett rett foran lenken.')
    const name = `${match[1]}${match[2] ? ` ${match[2]}. ${/y/i.test(match[3]) ? 'year' : 'år'}` : ''}`, value = row(name, line.text.replace(/\s/g, ''), catalogueUrl, 'PDF-oversikt')
    if (result.some(other => other.sourceObjectId === value.sourceObjectId)) fail('source-changed', 'PDF-en gjentar samme kalender-ID under flere klasseetiketter.')
    result.push(value)
  }
  if (!result.length) fail('source-changed', 'PDF-en har ingen lesbare, publiserte klassekalenderlenker.')
  return result
}
export async function fihCalendarSources({ fetchText, fetchBytes }) {
  const $ = load(await cachedText(fetchText, studentUrl, sourceGuard)), sources = new Set(), results = [], warnings = []
  $('a[href]').each((_, anchor) => { if (!/webcalfiler/i.test(clean($(anchor).text()))) return; const url = sourceGuard(new URL($(anchor).attr('href'), studentUrl)); sources.add(url.href) })
  if (!sources.size) fail('source-changed', 'FIHs studentside publiserer ingen klassekalenderoversikt.')
  for (const url of sources) try {
    const found = url.endsWith('.pdf') ? parseFihCalendarPdf(await readLdhPdf(fetchBytes, url, sourceGuard), url) : parseFihCalendarHtml(await cachedText(fetchText, url, sourceGuard), url)
    for (const value of found) { const existing = results.find(row => row.sourceObjectId === value.sourceObjectId); if (existing && (existing.className !== value.className || existing.sourceUrl !== value.sourceUrl)) fail('source-changed', 'De publiserte oversiktene oppgir ulike opplysninger om samme kalender-ID.'); if (!existing) results.push(value) }
  } catch (error) { if (error.name === 'AbortError') throw error; warnings.push(`En kalenderoversikt kunne ikke leses: ${error.message}`) }
  if (!results.length) fail('source-changed', `Ingen publiserte klassevalg kunne leses. ${warnings.join(' ')}`)
  return { results, warnings: ['Velg klassen fra den oversikten du faktisk følger. PDF- og nettsideoversikten har ulike kalender-ID-er, også for noen like klassenavn. Kull eller ekvivalens mellom disse er ikke antatt.', 'Kalenderens egne datoer vises i forhåndsvisningen. En publisert lenke bekrefter ikke undervisning i alle semestre eller for alle emner.', ...warnings] }
}
export function parseFihCalendar(input, selected) {
  if (typeof input !== 'string' || input.length > 2_000_000 || !/^\s*BEGIN:VCALENDAR/im.test(input) || !/END:VCALENDAR\s*$/.test(input)) fail('source-changed', 'Klassekilden svarte ikke med en fullstendig kalender innen 2 MB.')
  let calendar
  try { calendar = new ICAL.Component(ICAL.parse(input)) } catch { fail('source-changed', 'Klassekilden svarte med en uleselig kalender.') }
  if (calendar.name !== 'vcalendar' || calendar.getFirstPropertyValue('x-wr-calname') !== `Timetable: ${selected.sourceObjectId}`) fail('source-changed', 'Kalenderens publiserte klasse-ID stemmer ikke med valget. Ingen annen klasse er importert.')
  const events = calendar.getAllSubcomponents('vevent')
  if (events.length > 5000) fail('not-supported', 'Klassekalenderen har over 5000 oppføringer; avgrens kilden før import.')
  for (const event of events) {
    if (!event.hasProperty('x-group')) event.addPropertyWithValue('x-group', selected.className)
  }
  return { calendar: calendar.toString(), name: selected.name, sourceKind: 'fih-public-class', className: selected.className, count: events.length, authoritative: false, warnings: ['Den valgte offentlige klassekalenderen bestemmer utvalget. Ingen individuell gruppetilhørighet eller automatisk emnekobling er hentet.', 'Kalenderens publiserte tidsrom og fullstendighet er ukjent. Manglende oppføringer fjerner derfor ikke eksisterende undervisning. Kontroller datoer, undervisning og eventuelle fellesaktiviteter før lagring.'] }
}
export async function fetchFihCalendar(input, deps) {
  const url = fihCalendarUrl(input), list = await fihCalendarSources(deps), selected = list.results.find(row => row.sourceUrl === url.href)
  if (!selected || deps.sourceObjectId && selected.sourceObjectId !== deps.sourceObjectId) fail('invalid-selection', 'Velg en klassekalender fra FIHs publiserte oversikter.')
  const guard = input => { const next = fihCalendarUrl(input); if (next.href !== url.href) fail('source-changed', 'Klassekalenderen videresendte til en annen kilde.'); return next }
  return parseFihCalendar(await cachedText(deps.fetchText, url.href, guard), selected)
}
