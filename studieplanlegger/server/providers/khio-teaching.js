import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'
const origin = 'https://cloud.timeedit.net', departments = ['ballett', 'opera', 'teater', 'design', 'kunsthandv', 'ka']
const validator = input => restrictedUrl(input, { origin, paths: [new RegExp(`^/khio/web/(?:${departments.join('|')})/(?:ri[A-Za-z0-9]*\\.(?:html|ics))?$`)], keys: ['h', 'sid', 'objects', 'ox', 'p', 'e', 'enol', 'start', 'end'] })
const dateValue = value => Date.parse(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T00:00:00Z`)
const validDate = value => /^\d{8}$/.test(value || '') && Number.isFinite(dateValue(value)) && new Date(dateValue(value)).toISOString().slice(0,10).replaceAll('-', '') === value
const same = (input, expected) => { const next = validator(input); if (next.href !== expected.href) fail('source-changed', 'KHiO-kalenderen videresendte til et annet utvalg.'); return next }
const page = (fetchText, url) => cachedText(fetchText, url.href, input => same(input, url))
function requestedDates(query) {
  if (!/^\d{4}$/.test(String(query.year)) || +query.year < 1900 || +query.year > 2200 || !['spring','autumn'].includes(query.semester)) fail('invalid-selection', 'Velg kalenderår og semester for undervisningen.')
  return { start: `${query.year}${query.semester === 'spring' ? '0101' : '0701'}`, end: `${query.year}${query.semester === 'spring' ? '0630' : '1231'}` }
}
export function parseKhioTeachingList(html, source) {
  const $ = load(html), base = validator(source), results = [], seen = new Set()
  $('a[href]').each((_i, node) => {
    const raw = new URL($(node).attr('href'), base)
    if (!/^ri[A-Za-z0-9]+\.html$/.test(raw.pathname.split('/').at(-1)) || !raw.pathname.startsWith(base.pathname)) return
    const url = validator(raw), label = clean($(node).text()), department = base.pathname.split('/')[3]
    if (url.search || !label || seen.has(url.href)) return
    seen.add(url.href); const id = `${department}:${url.pathname.split('/').at(-1)}`
    results.push({ id, sourceObjectId: id, label, sourceUrl: url.href, entryUrl: url.href })
  })
  if (!results.length) fail('source-changed', 'KHiO-avdelingen har ingen gjenkjennelige offentlige program- eller kullkalendere.')
  return results
}
export function parseKhioTeachingSchedule(html, source, query) {
  const $ = load(html), entry = validator(source), data = $('#linksdata'), sid = data.attr('data-sid'), objects = data.attr('data-searchids'), raw = data.attr('data-linksbase'), requested = requestedDates(query)
  if (!/^\d+$/.test(sid || '') || !/^(?:\d+\.\d+|-1)(?:,(?:\d+\.\d+|-1))*$/.test(objects || '') || !raw) fail('source-changed', 'KHiOs publiserte kalender mangler et entydig kildeutvalg.')
  const base = validator(new URL(raw, entry)), root = entry.pathname.replace(/ri[A-Za-z0-9]+\.html$/, ''), start = data.attr('data-startlimit') || null, end = data.attr('data-endlimit') || null
  if (base.pathname !== `${root}ri.html` || base.searchParams.get('sid') !== sid || base.searchParams.get('objects') !== objects || (start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)) fail('source-changed', 'KHiOs kalenderidentitet eller datogrenser har endret seg.')
  if ((end && end < requested.start) || (start && start > requested.end)) fail('semester-unavailable', 'Den valgte offentlige KHiO-kalenderen dekker ikke kalendersemesteret.')
  const range = { start: start && start > requested.start ? start : requested.start, end: end && end < requested.end ? end : requested.end }
  return { sid, objects, base, root, requested, range, boundaries: { start, end }, sourceNames: clean(data.attr('data-searchnames')) }
}
export async function khioTeaching(action, query, fetchText) {
  const q = clean(query.q).toLocaleLowerCase('nb'), requested = requestedDates(query)
  if (!q || q.length > 120) fail('invalid-selection', 'Søk med programkode eller kullnavn fra KHiOs offentlige timeplan (maks 120 tegn), for eksempel navnet som står i din studieplan.')
  const results = [], warnings = []; let pages = 0
  for (const department of departments) {
    fetchText.signal?.throwIfAborted()
    const url = validator(`${origin}/khio/web/${department}/`)
    try { results.push(...parseKhioTeachingList(await page(fetchText, url), url).filter(row => row.label.toLocaleLowerCase('nb').includes(q))); pages++ }
    catch (error) { if (error.name === 'AbortError') throw error; warnings.push(`Den offentlige avdelingskalenderen ${department} kunne ikke leses: ${error.message}`) }
  }
  if (!pages) fail('source-changed', 'Ingen av KHiOs offentlige avdelingskalendere kunne leses. Eksisterende undervisning er beholdt.')
  const common = ['KHiO publiserer kalendere per avdeling, program og kull. Søk med programkode eller kullnavn og velg riktig oppføring. Emnekode alene finnes ikke nødvendigvis i kalendernavnet.', 'En programkalender kan inneholde flere emner og grupper. Velg bare aktivitetene som gjelder dette emnet og din gruppe i forhåndsvisningen. Ingen personlig gruppetilhørighet er antatt.']
  if (action === 'teaching-search') return { status: 'ok', results, warnings: [...warnings, ...common], completeness: { complete: pages === departments.length, pages, returned: results.length, scope: 'Navngitte offentlige program-/kullkalendere i seks fagavdelinger; dette er ikke en personlig timeplan eller et fullstendig emnesøk.' } }
  if (action !== 'teaching-calendar') fail('not-supported', 'KHiO-timeplanhandlingen er ikke støttet.')
  const selected = results.find(row => row.sourceObjectId === query.sourceObjectId)
  if (!selected) fail('invalid-selection', 'Velg en faktisk publisert kalender fra dette søket.')
  const entry = validator(selected.sourceUrl), source = parseKhioTeachingSchedule(await page(fetchText, entry), entry, query), schedule = new URL(source.base)
  schedule.searchParams.set('p', `${source.range.start}.x,${source.range.end}.x`)
  const html = await page(fetchText, schedule), returned = parseKhioTeachingSchedule(html, entry, query), $ = load(html)
  if (returned.sid !== source.sid || returned.objects !== source.objects || returned.base.searchParams.get('p') !== schedule.searchParams.get('p')) fail('source-changed', 'KHiO returnerte et annet kalenderutvalg eller tidsrom enn du valgte.')
  const exports = new Set()
  $('a[href]').each((_i, node) => {
    if (clean($(node).text()) !== 'iCal') return
    const url = validator(new URL($(node).attr('href'), schedule))
    if (url.pathname !== `${source.root}ri.ics` || ['sid','objects','p'].some(key => url.searchParams.get(key) !== schedule.searchParams.get(key))) fail('source-changed', 'KHiOs kalenderlenke gjelder et annet kildeutvalg.')
    exports.add(url.href)
  })
  if (exports.size !== 1) fail('source-changed', 'KHiO publiserer ingen entydig iCal-lenke for utvalget.')
  const calendarUrl = [...exports][0], calendar = await page(fetchText, validator(calendarUrl))
  if (!/^\s*BEGIN:VCALENDAR\s*$/im.test(calendar) || !/^END:VCALENDAR\s*$/im.test(calendar)) fail('source-changed', 'KHiO svarte uten en lesbar kalenderfil.')
  return { status: 'ok', calendarUrl, calendar, sourceUrl: selected.sourceUrl, selected, coverage: 'unknown', publicationBoundaries: source.boundaries, requestedRange: source.range, warnings: [...warnings, ...common, `Valgt kalender er avgrenset til ${source.range.start}–${source.range.end}. Kildens fullstendighet er ukjent; manglende aktiviteter sletter ikke eksisterende undervisning.`, source.sourceNames ? `Kildens utvalg: ${source.sourceNames}` : '', ...(source.range.start !== requested.start || source.range.end !== requested.end ? ['Den publiserte kalenderen dekker bare deler av det valgte kalendersemesteret.'] : [])].filter(Boolean) }
}
