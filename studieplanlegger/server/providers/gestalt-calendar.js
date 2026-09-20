import { createHash } from 'node:crypto'
import ICAL from 'ical.js'
import { Temporal } from '@js-temporal/polyfill'
import { load, clean, fail, cachedText } from './program-source.js'
import { gestaltProgramUrl, gestaltPdfUrl } from './gestalt-programs.js'
import { readPublicPdfItems } from './public-pdf-text.js'

const planPages = ['https://gestalt.no/timeplaner%2Fstudieplan-gt', 'https://gestalt.no/timeplaner%2Fstudieplan-co']
const months = ['JANUAR', 'FEBRUAR', 'MARS', 'APRIL', 'MAI', 'JUNI', 'JULI', 'AUGUST', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER']
const hash = text => createHash('sha256').update(text).digest('hex')
function joined(items) {
  let text = '', right = null
  for (const item of [...items].sort((a, b) => a.transform[4] - b.transform[4])) { const x = item.transform[4]; text += `${right !== null && x - right > 1 ? ' ' : ''}${item.str}`; right = x + item.width }
  return clean(text).replace(/\s*[-–]\s*/g, '-')
}
function lines(page) {
  const rows = []
  for (const item of page.items.filter(item => clean(item.str))) { const y = item.transform[5]; let row = rows.find(row => Math.abs(row.y - y) < 1); if (!row) rows.push(row = { y, items: [] }); row.items.push(item) }
  return rows.sort((a, b) => b.y - a.y).map(row => ({ ...row, text: joined(row.items), page: page.page }))
}
export function parseGestaltCalendarLinks(html, pageUrl) {
  const $ = load(html), result = new Map()
  $('a[href]').each((_, anchor) => { let url; try { url = gestaltPdfUrl(new URL($(anchor).attr('href'), pageUrl)) } catch { return } const name = decodeURIComponent(url.pathname.split('/').at(-1)); if (!/^(?:GT|CO)\s+Timeplan\s+\d{6}/i.test(name)) return; result.set(url.href, { sourceUrl: url.href, name: name.replace(/\.pdf$/i, '') }) })
  if (!result.size) fail('source-changed', 'Den publiserte plansiden har ingen støttet offentlig timeplan-PDF.')
  return [...result.values()]
}
function calendarTable(pages) {
  const result = []
  for (const page of pages) {
    const rows = lines(page), title = rows.find(row => /^20\d{2}\/20\d{2}\s+Timeplan for undervisning,/.test(row.text)), match = title?.text.match(/^(20\d{2})\/(20\d{2})\s+Timeplan for undervisning,\s*(Gestaltterapi|Gestaltcoaching)/)
    if (!match || +match[2] !== +match[1] + 1) fail('source-changed', 'Timeplanen mangler en entydig periode og utdanning.')
    const header = rows.find(row => row.items.some(item => clean(item.str) === 'KLASSE'))
    const columns = header?.items.filter(item => months.includes(clean(item.str))).map(item => ({ month: months.indexOf(clean(item.str)) + 1, centre: item.transform[4] + item.width / 2 })).sort((a, b) => a.centre - b.centre)
    if (!columns || columns.length < 2) fail('source-changed', 'Timeplanens månedstabell kunne ikke leses.')
    let wraps = 0
    for (let index = 0; index < columns.length; index++) { if (index && columns[index].month < columns[index - 1].month) wraps++; if (wraps > 1 || index && columns[index].month === columns[index - 1].month) fail('source-changed', 'Månedsrekkefølgen er uklar.'); columns[index].year = +(wraps ? match[2] : match[1]) }
    const boundary = (header.items.find(item => clean(item.str) === 'KLASSE').transform[4] + columns[0].centre) / 2
    for (const [index, row] of rows.entries()) {
      if (row.y >= header.y) continue
      const classItems = row.items.filter(item => item.transform[4] < boundary), classText = joined(classItems)
      if (!/^\d{1,2}\s*ÅR$/i.test(classText)) continue
      const next = rows[index + 1], type = next && next.items.every(item => item.transform[4] < boundary) && /^(Helg|Midtuke)$/i.test(next.text) ? next.text : ''
      if (match[3] === 'Gestaltterapi' && !type) fail('source-changed', 'Terapiklassen mangler offentlig Helg-/Midtuke-betegnelse.')
      const className = clean(`${match[3]} · ${classText} ${type}`), sourceObjectId = `${match[3].toLowerCase()}:${classText.match(/\d+/)[0]}:${type.toLowerCase() || 'published'}`, cells = columns.map(column => ({ ...column, items: [] }))
      for (const item of row.items.filter(item => item.transform[4] >= boundary)) { const centre = item.transform[4] + item.width / 2, selected = cells.reduce((a, b) => Math.abs(a.centre - centre) < Math.abs(b.centre - centre) ? a : b); selected.items.push(item) }
      result.push({ sourceObjectId, className, programme: match[3], type, year: +match[1], page: page.page, cells: cells.filter(cell => cell.items.length).map(cell => ({ ...cell, text: joined(cell.items) })), lines: rows })
    }
  }
  if (!result.length || new Set(result.map(row => row.sourceObjectId)).size !== result.length) fail('source-changed', 'Timeplanen har ingen entydige, velgbare klasser.')
  return result
}
export function parseGestaltCalendarClasses(pages, sourceUrl) { return calendarTable(pages).map(row => ({ id: hash(`${sourceUrl}\0${row.sourceObjectId}`), sourceUrl, sourceObjectId: row.sourceObjectId, name: `${row.className} · ${row.year}–${row.year + 1}` })) }
const weekdays = { MAN: 1, TIR: 2, TIRS: 2, ONS: 3, TOR: 4, FRE: 5, LØR: 6 }
function timeRanges(text) {
  const result = [...text.matchAll(/(\d{2}:\d{2})-(\d{2}:\d{2})/g)].map(match => ({ from: match[1], until: match[2] }))
  for (const range of result) if (Temporal.PlainTime.compare(Temporal.PlainTime.from(range.from), Temporal.PlainTime.from(range.until)) >= 0) throw Error('Publisert undervisningstid har ugyldig rekkefølge.')
  return result
}
function teachingFor(group, count) {
  if (group.programme === 'Gestaltcoaching') {
    const text = group.lines.map(line => line.text).join(' ')
    if (!/UNDERVISNINGSTIDER TORSDAG-FREDAG-LØRDAG/.test(text) || count !== 3) throw Error('Coachingdatoene stemmer ikke med publisert tredagers undervisning.')
    const rows = group.lines.filter(line => /^Undervisning\s/.test(line.text)), ranges = rows.flatMap(line => timeRanges(line.text)), saturday = text.match(/Lørdager\s+(\d{2}:\d{2})/i)?.[1]
    if (ranges.length !== 2 || !saturday) throw Error('Coachingplanen mangler den støttede undervisningstiden eller lørdagsunntaket.')
    return [4, 5, 6].map(day => ({ day, ranges: ranges.map((range, index) => ({ ...range, ...(day === 6 && index === 1 ? { until: saturday } : {}) })) }))
  }
  const days = group.lines.find(line => line.items.some(item => /^Fre\/Tirs$/.test(item.str))), numbers = group.lines.find(line => line.text.includes('for 2 dagers samling') && line.text.includes('for 3 dagers samling'))
  if (!days || !numbers || ![2, 3].includes(count)) throw Error('Terapiplanen mangler støttede tabeller for to eller tre samlingsdager.')
  const headers = days.items.filter(item => /^(?:Fre\/Tirs|Lør\/Ons|Tor\/Man|Fre\/Tir)$/.test(item.str)).sort((a, b) => a.transform[4] - b.transform[4])
  if (headers.length !== 5) throw Error('Undervisningstabellens dagkolonner har endret seg.')
  const columns = headers.map(item => ({ x: item.transform[4], days: item.str.toUpperCase().split('/').map(day => weekdays[day]), ranges: [] }))
  for (const row of group.lines.filter(line => line.y < numbers.y && line.items.some(item => item.str === 'Undervisning'))) for (const item of row.items) {
    const ranges = timeRanges(clean(item.str).replace(/\s/g, '')); if (!ranges.length) continue
    const column = columns.find(column => Math.abs(column.x - item.transform[4]) < 3); if (!column) throw Error('Et undervisningsklokkeslett mangler entydig dagkolonne.'); column.ranges.push(...ranges)
  }
  return (count === 2 ? columns.slice(0, 2) : columns.slice(2)).map(column => { if (!column.ranges.length) throw Error('En samlingsdag mangler undervisningstid.'); return { day: column.days[group.type.toLowerCase() === 'helg' ? 0 : 1], ranges: column.ranges } })
}
export function parseGestaltCalendar(pages, selected) {
  const group = calendarTable(pages).find(row => row.sourceObjectId === selected.sourceObjectId)
  if (!group) fail('invalid-selection', 'Velg en faktisk publisert klasse. Ingen klasse er utledet fra studieprogrammet.')
  const events = [], unresolved = []
  for (const cell of group.cells) {
    const excerpt = `PDF-side ${group.page}, ${group.className}, ${months[cell.month - 1]} ${cell.year}: ${cell.text}`
    try {
      if (!/^\d{1,2}(?:-\d{1,2}){1,2}$/.test(cell.text)) throw Error('Datofeltet er ikke en støttet, uttrykkelig liste med to eller tre dager.')
      const dates = cell.text.split('-').map(day => Temporal.PlainDate.from({ year: cell.year, month: cell.month, day: +day }, { overflow: 'reject' })), teaching = teachingFor(group, dates.length)
      if (dates.some((date, index) => index && dates[index - 1].until(date).days !== 1)) throw Error('Daglisten er ikke sammenhengende; ingen mellomliggende dager er lagt til automatisk.')
      if (dates.some((date, index) => date.dayOfWeek !== teaching[index].day)) throw Error('Datoene stemmer ikke med ukedagene i den publiserte undervisningstabellen. Datoene er ikke rettet automatisk.')
      const pending = []
      for (const [dayIndex, date] of dates.entries()) for (const [block, range] of teaching[dayIndex].ranges.entries()) {
        const instant = time => date.toPlainDateTime(Temporal.PlainTime.from(time)).toZonedDateTime('Europe/Oslo', { disambiguation: 'reject' }).toInstant().toString()
        pending.push({ id: `${cell.year}-${cell.month}:day-${dayIndex + 1}:block-${block + 1}`, start: instant(range.from), end: instant(range.until), title: `Undervisning · ${group.className}`, description: `${excerpt}. Publisert undervisning ${range.from}–${range.until}. Pauser reserverer ikke tid. Ingen emnetilhørighet er antatt.` })
      }
      events.push(...pending)
    } catch (error) { unresolved.push({ id: `${cell.year}-${cell.month}`, sourceExcerpt: excerpt, reason: error.message }) }
  }
  if (!events.length) fail('source-changed', 'Ingen av samlingene har entydige datoer og undervisningstider. Kontroller kilden i dokumentimport.')
  const calendar = new ICAL.Component('vcalendar'); calendar.addPropertyWithValue('version', '2.0'); calendar.addPropertyWithValue('prodid', '-//Studieplan//Offentlig Gestalt klasseplan//NO'); calendar.addPropertyWithValue('x-wr-calname', selected.name)
  for (const event of events) { const component = new ICAL.Component('vevent'); for (const [key, value] of Object.entries({ uid: `${hash(`${selected.sourceUrl}\0${selected.sourceObjectId}\0${event.id}`)}@public.gestalt.no`, summary: event.title, description: event.description, url: selected.sourceUrl, transp: 'OPAQUE', 'x-group': group.className })) component.addPropertyWithValue(key, value); component.addPropertyWithValue('dtstamp', ICAL.Time.fromDateTimeString('1970-01-01T00:00:00Z')); component.addPropertyWithValue('dtstart', ICAL.Time.fromDateTimeString(event.start)); component.addPropertyWithValue('dtend', ICAL.Time.fromDateTimeString(event.end)); calendar.addSubcomponent(component) }
  return { calendar: calendar.toString(), name: selected.name, sourceKind: 'gestalt-public-class', className: group.className, count: events.length, authoritative: !unresolved.length, unresolved, warnings: ['Velg og kontroller samlingene før lagring. Bare publiserte undervisningsblokker reserverer tid; oppgitte pauser er beholdt som ledig tid.', 'Denne kilden omfatter bare klassene som er publisert i timeplanen. Den dokumenterer ikke andre årstrinn, personlig gruppetilhørighet eller emnekoblinger.', ...unresolved.map(row => `${row.sourceExcerpt} — Ikke datofestet: ${row.reason}`)] }
}
async function documents({ fetchText }) {
  const results = [], warnings = []
  for (const page of planPages) try { results.push(...parseGestaltCalendarLinks(await cachedText(fetchText, page, gestaltProgramUrl), page)) } catch (error) { if (error.name === 'AbortError') throw error; warnings.push(`${page}: ${error.message}`) }
  if (!results.length) fail('source-changed', `Ingen publiserte timeplaner kunne hentes. ${warnings.join(' ')}`)
  return { results, warnings }
}
export async function gestaltCalendarSources(deps) {
  const list = await documents(deps), results = [], warnings = [...list.warnings]
  for (const source of list.results) try { results.push(...parseGestaltCalendarClasses(await readPublicPdfItems(deps.fetchBytes, source.sourceUrl, gestaltPdfUrl), source.sourceUrl)) } catch (error) { if (error.name === 'AbortError') throw error; warnings.push(`${source.name}: ${error.message}`) }
  if (!results.length) fail('source-changed', `Ingen publiserte klasser kunne leses. ${warnings.join(' ')}`)
  return { results, warnings: ['Velg ditt faktiske årstrinn og din klasse. Ingen klasse er forhåndsvalgt.', ...warnings] }
}
export async function fetchGestaltCalendar(input, deps) {
  const url = gestaltPdfUrl(input).href, list = await documents(deps)
  if (!list.results.some(row => row.sourceUrl === url)) fail('invalid-selection', 'Velg en timeplan som er publisert på Gestalts plansider.')
  if (!deps.sourceObjectId) fail('invalid-selection', 'Velg din klasse før timeplanen importeres.')
  const pages = await readPublicPdfItems(deps.fetchBytes, url, gestaltPdfUrl), selected = parseGestaltCalendarClasses(pages, url).find(row => row.sourceObjectId === deps.sourceObjectId)
  if (!selected) fail('invalid-selection', 'Klassen finnes ikke i den valgte offentlige timeplanen.')
  return parseGestaltCalendar(pages, selected)
}
