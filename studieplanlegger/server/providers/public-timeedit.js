import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'
import { khioTeaching } from './khio-teaching.js'

// These public entries are linked by each institution's own timetable guidance.
// The page supplies the current sid, object type, date limits and export links.
const sources = {
  usn: { base: '/usn/web/publikk/', entry: null },
  mf: { base: '/mf/web/timeplan/', entry: 'ri1Q7.html' },
  nmbu: { base: '/nmbu/web/student/', entry: 'ri1Q7.html' },
  hvl: { base: '/hvl/web/pen/', entry: 'ri1Q28.html' },
  nhh: { base: '/nhh/web/student/', entry: 'ri1Q57.html' },
  nmh: { base: '/nmh/web/public/', entry: 'ri1Q7.html', unboundedEntry: true },
  samas: { base: '/sahg/web/student/', entry: 'ri1Q56.html' },
  ldh: { base: '/ldh/web/timeplan/', entry: 'ri1Q7.html' },
  steiner: { base: '/no_sh/web/publik/', entry: 'ri1Q1.html' },
  hivolda: { base: '/hivolda/web/timeplan/', entry: 'ri1Q79.html' },
  kristiania: { base: '/no_kristiania/web/public/', entry: 'ri1Q7.html' },
  nih: { base: '/nih/web/nih/', entry: 'ri1Q4.html' },
}
export const publicTimeEditInstitutions = [...Object.keys(sources), 'khio']
const origin = 'https://cloud.timeedit.net'
const queryKeys = ['h', 'sid', 'type', 'p', 'objects', 'ox', 'types', 'fe', 'max', 'fr', 'partajax', 'im', 'l', 'search_text', 'start', 'end', 'part', 'media', 'e', 'enol']
const objectId = value => /^\d{1,12}\.\d{1,8}$/.test(value || '')
const maxPages = 50, maxResults = 5000

export function publicTimeEditUrl(input, institution) {
  const config = sources[institution]
  if (!config) fail('not-supported', 'Denne offentlige timeplankilden er ikke implementert.')
  return restrictedUrl(input, { origin, paths: [new RegExp(`^${config.base}(?:ri[A-Za-z0-9]*\\.(?:html|ics)|objects(?:\\.html)?)?$`)], keys: queryKeys })
}
const sameQuery = (input, expected, institution) => {
  const next = publicTimeEditUrl(input, institution)
  if (next.pathname !== expected.pathname || [...new Set([...next.searchParams.keys(), ...expected.searchParams.keys()])].some(key => next.searchParams.get(key) !== expected.searchParams.get(key))) fail('source-changed', 'TimeEdit videresendte til et annet søk, emne eller tidsrom. Ingen kalender er importert.')
  return next
}
function semesterDates(query) {
  if (!/^\d{4}$/.test(String(query.year)) || +query.year < 1900 || +query.year > 2200 || !['spring', 'autumn'].includes(query.semester)) fail('invalid-selection', 'Velg kalenderår og semester for undervisningen.')
  return { start: `${query.year}${query.semester === 'spring' ? '0101' : '0701'}`, end: `${query.year}${query.semester === 'spring' ? '0630' : '1231'}` }
}
const dayValue = value => Date.parse(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T00:00:00Z`)
const validDate = value => /^\d{8}$/.test(value || '') && Number.isFinite(dayValue(value)) && new Date(dayValue(value)).toISOString().slice(0,10).replaceAll('-', '') === value

export function parsePublicTimeEditEntry(html, institution, query, entryUrl) {
  const $ = load(html), data = $('#linksdata'), sid = data.attr('data-sid'), start = data.attr('data-startlimit'), end = data.attr('data-endlimit')
  const rawBase = data.attr('data-linksbase'), typeOptions = $('#fancytypeselector option').toArray().filter(node => /^Emne$/i.test(clean($(node).text())))
  const unbounded = sources[institution]?.unboundedEntry && start === '' && end === ''
  if (!/^\d+$/.test(sid || '') || !rawBase || (!unbounded && (!validDate(start) || !validDate(end) || start > end)) || typeOptions.length !== 1) fail('source-changed', 'Den åpne TimeEdit-siden mangler gjenkjennelig emnesøk eller publisert tidsrom.')
  const type = $(typeOptions[0]).attr('value'), base = publicTimeEditUrl(new URL(rawBase, entryUrl), institution), requested = semesterDates(query)
  if (!/^\d+$/.test(type || '') || base.pathname !== `${sources[institution].base}ri.html` || base.searchParams.get('sid') !== sid || (base.searchParams.get('objects') || '')) fail('source-changed', 'TimeEdit-siden har endret søkeidentitet. Bruk den publiserte kildesiden eller kalenderlenke.')
  if (!unbounded && (end < requested.start || start > requested.end)) fail('semester-unavailable', 'Den publiserte TimeEdit-inngangen dekker ikke det valgte kalendersemesteret. Bruk en publisert kalenderlenke for perioden.')
  const selectedRange = unbounded ? requested : { start: start > requested.start ? start : requested.start, end: end < requested.end ? end : requested.end }
  return { sid, type, baseUrl: base.href, entryUrl, requested, selectedRange, publicationBoundaries: unbounded ? { start: null, end: null } : { start, end }, warnings: [
    'Velg emneversjon, campus og eventuell gruppe fra kildens faktiske treff. Personlig gruppetilhørighet er ikke hentet.',
    'TimeEdit-søket kan også inneholde eldre emneposter. Et treff alene bekrefter ikke undervisning i valgt kalendersemester.',
    ...(unbounded ? ['Kilden publiserer ingen ytre datogrenser. Det valgte kalendersemesteret brukes som søkeperiode; en tom kalender bekrefter ikke fullstendig dekning.'] : []),
    ...(selectedRange.start !== requested.start || selectedRange.end !== requested.end ? [`Kildens publiserte tidsrom avgrenser søket til ${selectedRange.start}–${selectedRange.end}. Hele kalendersemesteret er ikke dokumentert.`] : []),
  ] }
}

async function readEntry(institution, query, fetchText) {
  const config = sources[institution]
  if (!config) fail('not-supported', 'Denne offentlige timeplankilden er ikke implementert.')
  semesterDates(query)
  let url = `${origin}${config.base}${config.entry || ''}`
  if (!config.entry) {
    const $ = load(await cachedText(fetchText, url, input => sameQuery(input, new URL(url), institution)))
    const label = new RegExp(`(?:høst|haust|fall|autumn)\\s+(?:semester\\s+)?${query.year}`, 'i'), spring = new RegExp(`(?:vår|spring)\\s+(?:semester\\s+)?${query.year}`, 'i')
    const links = new Set()
    $('a[href]').each((_, node) => {
      if (!(query.semester === 'spring' ? spring : label).test(clean($(node).text()))) return
      const link = publicTimeEditUrl(new URL($(node).attr('href'), url), institution)
      if (!/\/ri[A-Za-z\d]+\.html$/.test(link.pathname) || link.search) fail('source-changed', 'Kildens publiserte semesterlenke har endret format.')
      links.add(link.href)
    })
    if (!links.size) fail('semester-unavailable', 'Den offentlige inngangen publiserer ikke en timeplanlenke for valgt kalendersemester.')
    if (links.size !== 1) fail('not-supported', 'Kilden har flere timeplaninnganger for kalendersemesteret. Velg riktig offentlig kalenderlenke selv.')
    url = [...links][0]
  }
  const html = await cachedText(fetchText, url, input => sameQuery(input, new URL(url), institution))
  return parsePublicTimeEditEntry(html, institution, query, url)
}

function scheduleFor(entry, institution, id) {
  const url = publicTimeEditUrl(entry.baseUrl, institution)
  // TimeEdit's published getSearchRange/changeSearchPeriod use YYYYMMDD.x.
  // This copies its date selector contract; no encoded subscription ID is guessed.
  url.searchParams.set('p', `${entry.selectedRange.start}.x,${entry.selectedRange.end}.x`)
  url.searchParams.set('objects', id)
  return url
}

export function parsePublicTimeEditObjects(html, institution, entry, sourceUrl, previousPager = null) {
  const $ = load(html), rows = [], seen = new Set()
  $('.searchObject[data-id]').each((_, node) => {
    const id = $(node).attr('data-id'), label = clean($(node).attr('data-name') || $(node).text())
    if (!objectId(id) || id.split('.')[1] !== entry.type || !label || label.length > 2000 || seen.has(id)) fail('source-changed', 'TimeEdit-søket inneholder ugyldige eller gjentatte emneposter.')
    seen.add(id); rows.push({ id, sourceObjectId: id, label, sourceUrl: scheduleFor(entry, institution, id).href, entryUrl: entry.entryUrl })
  })
  let pager = previousPager
  const raw = $('#pagesData_o').attr('data-pagesjson')
  if (raw) {
    let data
    try { data = JSON.parse(raw) } catch { fail('source-changed', 'TimeEdits sideinformasjon er ikke lesbar.') }
    const base = publicTimeEditUrl(new URL($('#linksdata_o').attr('data-linksbase') || '', sourceUrl), institution)
    if (!Number.isSafeInteger(data.max) || data.max < 1 || data.max > 1000 || !Number.isSafeInteger(data.start) || data.start < 0 || !base.pathname.endsWith('/objects') && !base.pathname.endsWith('/objects.html')) fail('source-changed', 'TimeEdits sidestørrelse eller neste side har endret format.')
    // Some actual sources publish total=10000 as a search ceiling. The presence
    // of a nextPage_o placeholder, not that number, controls their own Next UI.
    const expected = new URL(sourceUrl)
    for (const key of ['sid', 'search_text', 'types', 'objects']) if (base.searchParams.get(key) !== expected.searchParams.get(key)) fail('source-changed', 'Neste resultatside endrer emnesøket.')
    pager = { baseUrl: base.href, max: data.max }
  }
  const nextNodes = $('[id^=nextPage_o]').toArray().filter(node => /^nextPage_o\d+$/.test($(node).attr('id')))
  if (nextNodes.length > 1) fail('source-changed', 'TimeEdit publiserer flere motstridende neste sider.')
  let next = null
  if (nextNodes.length) {
    const offset = Number($(nextNodes[0]).attr('id').replace('nextPage_o', '')), current = Number(new URL(sourceUrl).searchParams.get('start') || 0)
    if (!pager || offset !== current + pager.max || rows.length !== pager.max) fail('source-changed', 'TimeEdits neste side stemmer ikke med det hentede utvalget.')
    next = publicTimeEditUrl(pager.baseUrl, institution); next.searchParams.set('start', String(offset)); next.searchParams.set('part', 't'); next.searchParams.set('media', 'html')
  }
  if (!rows.length && !/ingen|no (?:objects|results|matches)|searchTextLegend|objectsearchresult|infotable/i.test(html) && !previousPager) fail('source-changed', 'TimeEdit returnerte ikke et gjenkjennelig søkeresultat.')
  return { rows, next: next?.href || null, pager }
}

async function search(institution, query, fetchText) {
  if (!clean(query.q) || clean(query.q).length > 120) fail('invalid-selection', 'Skriv en emnekode eller et emnenavn (maks 120 tegn).')
  const entry = await readEntry(institution, query, fetchText), url = new URL(`${origin}${sources[institution].base}objects.html`)
  // Sámi's public search finds "MOA" but not the actual displayed code "MOA 110".
  // Read all offered prefix pages, then match the source's exact displayed code.
  const spacedCode = institution === 'samas' && clean(query.q).match(/^([A-ZÁÆØÅČĐŊŠŦŽ]{2,8})\s+(\d{3,4})$/i)
  url.search = new URLSearchParams({ max: '100', fr: 't', partajax: 't', im: 'f', sid: entry.sid, l: 'nb_NO', search_text: spacedCode ? spacedCode[1] : clean(query.q), objects: '', types: entry.type }).toString()
  let next = url.href, pager = null, pages = 0, complete = true
  const records = new Map(), visited = new Set(), warnings = [...entry.warnings]
  while (next) {
    fetchText.signal?.throwIfAborted()
    if (pages >= maxPages || records.size >= maxResults || visited.has(next)) { complete = false; warnings.push('Kildesøket nådde den synlige grensen på 50 sider / 5000 emneposter, eller gjentok en side. Avgrens søket.'); break }
    const current = next
    try {
      const html = await cachedText(fetchText, current, input => sameQuery(input, new URL(current), institution)), result = parsePublicTimeEditObjects(html, institution, entry, current, pager)
      visited.add(current); pages++; pager = result.pager
      for (const record of result.rows) { if (records.has(record.id)) fail('source-changed', 'TimeEdit gjentar emneposter på neste side. Utvalget er ufullstendig.'); records.set(record.id, record) }
      next = result.next
    } catch (error) {
      if (!pages || error.name === 'AbortError') throw error
      complete = false; warnings.push(`Kildesøket er ufullstendig: ${error.message}`); break
    }
  }
  const results = [...records.values()].filter(row => !spacedCode || row.label.split(',').at(-1).replace(/\s/g, '').toUpperCase() === `${spacedCode[1]}${spacedCode[2]}`.toUpperCase())
  return { status: 'ok', results, warnings, entry, publicationBoundaries: entry.publicationBoundaries, completeness: { complete, pages, returned: results.length, scope: 'Alle sider som den offentlige søkevisningen tilbyr for dette emnesøket; dette er ikke en program- eller personliste.' } }
}

export async function publicTimeEdit(institution, action, query, { fetchText }) {
  if (institution === 'khio') return khioTeaching(action, query, fetchText)
  if (!['teaching-search', 'teaching-calendar'].includes(action)) fail('not-supported', 'Handlingen støttes ikke av den offentlige timeplanimporten.')
  if (action === 'teaching-calendar' && !objectId(query.sourceObjectId)) fail('invalid-selection', 'Velg en publisert emnepost før undervisningen hentes.')
  const result = await search(institution, query, fetchText)
  if (action === 'teaching-search') { const { entry, ...response } = result; return response }
  const selected = result.results.find(row => row.sourceObjectId === query.sourceObjectId)
  if (!selected) fail('invalid-selection', 'Den valgte emneposten finnes ikke i dette kildesøket. Hent og velg emnet på nytt.')
  const schedule = new URL(selected.sourceUrl), html = await cachedText(fetchText, schedule.href, input => sameQuery(input, schedule, institution)), $ = load(html)
  const returnedBase = publicTimeEditUrl($('#linksdata').attr('data-linksbase') || schedule.href, institution), displayStart = $('#txtRangeAltStart').attr('value'), displayEnd = $('#txtRangeAltEnd').attr('value'), selectedRange = result.entry.selectedRange
  // NMBU's published "expand to whole weeks" view can start up to six days
  // earlier. The actual search and export must still carry our exact period.
  const extendedWeek = validDate(displayStart) && validDate(displayEnd) && dayValue(displayStart) <= dayValue(selectedRange.start) && dayValue(displayStart) >= dayValue(selectedRange.start) - 6 * 86400000 && dayValue(displayEnd) >= dayValue(selectedRange.end) && dayValue(displayEnd) <= dayValue(selectedRange.end) + 6 * 86400000
  if ($('#linksdata').attr('data-searchids') !== selected.sourceObjectId || $('#linksdata').attr('data-sid') !== result.entry.sid || returnedBase.pathname !== schedule.pathname || ['sid', 'objects', 'p'].some(key => returnedBase.searchParams.get(key) !== schedule.searchParams.get(key)) || !extendedWeek) fail('source-changed', 'TimeEdit returnerte et annet emne eller tidsrom enn du valgte.')
  const exports = new Set()
  $('a[href]').each((_, node) => {
    if (clean($(node).text()) !== 'iCal') return
    const candidate = publicTimeEditUrl(new URL($(node).attr('href'), schedule), institution)
    if (candidate.pathname !== `${sources[institution].base}ri.ics` || candidate.searchParams.get('objects') !== selected.sourceObjectId || candidate.searchParams.get('sid') !== result.entry.sid || candidate.searchParams.get('p') !== schedule.searchParams.get('p')) fail('source-changed', 'Den publiserte kalenderlenken gjelder et annet emne eller tidsrom.')
    exports.add(candidate.href)
  })
  if (exports.size !== 1) fail('source-changed', 'TimeEdit-siden har ingen entydig offentlig kalenderlenke for utvalget.')
  const calendarUrl = [...exports][0], calendar = await cachedText(fetchText, calendarUrl, input => sameQuery(input, new URL(calendarUrl), institution))
  if (!/^\s*BEGIN:VCALENDAR\s*$/im.test(calendar) || !/^END:VCALENDAR\s*$/im.test(calendar)) fail('source-changed', 'TimeEdit svarte uten en lesbar kalenderfil. Ingen undervisning er importert.')
  return { status: 'ok', calendarUrl, calendar, sourceUrl: schedule.href, selected, coverage: 'unknown', publicationBoundaries: result.publicationBoundaries, requestedRange: selectedRange, warnings: [...result.warnings,
    ...(displayStart !== selectedRange.start || displayEnd !== selectedRange.end ? ['Kildens visning utvider datoene til hele uker. Kalenderforespørselen beholder valgt tidsrom; appen avgrenser aktiviteter til valgt kalendersemester.'] : []),
    'Kalenderen er hentet fra valgt offentlig emnepost. Kontroller aktiviteter og grupper før lagring. En tom kalender bekrefter ikke at semesteret er undervisningsfritt.',
    'Kildens fullstendighet er ukjent. Eksisterende undervisning beholdes ved manglende oppføringer; bare uttrykkelige avlysninger kan fjerne reservasjoner.',
  ] }
}
