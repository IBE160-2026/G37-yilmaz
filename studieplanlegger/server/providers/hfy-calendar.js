import { createHash } from 'node:crypto'
import ICAL from 'ical.js'
import { Temporal } from '@js-temporal/polyfill'
import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'
import { hfyPdfUrl } from './hfy-programs.js'
import { readPublicPdfItems } from './public-pdf-text.js'

const catalogueUrl = 'https://hfy.no/for-studenter', sourceGuard = input => restrictedUrl(input, { origin: 'https://hfy.no', paths: [/^\/for-studenter\/?$/] })
const normal = text => clean(text).toLocaleLowerCase('nb').replace(/[–—]/g, '-')
const stamp = text => createHash('sha256').update(text).digest('hex')
export function parseHfyCalendarSources(html) {
  const $ = load(html), sources = new Map()
  $('a[href]').each((_, anchor) => {
    const name = clean($(anchor).text()); if (!/Samlinger\s+20\d{2}\s*[–—-]\s*20\d{2}/i.test(name)) return
    const sourceUrl = hfyPdfUrl(new URL($(anchor).attr('href'), catalogueUrl)).href
    sources.set(sourceUrl, { id: stamp(sourceUrl), name, sourceUrl })
  })
  if (!sources.size) fail('source-changed', 'HØFY-siden har ingen lesbare, offentlig lenkede samlingsplaner.')
  return [...sources.values()]
}
export async function hfyCalendarSources({ fetchText }) {
  return { results: parseHfyCalendarSources(await cachedText(fetchText, catalogueUrl, sourceGuard)), warnings: ['Velg din faktiske klasse og campus. Ingen klasse er utledet fra studieprogrammet. Kontroller datoer og kildeavvik i forhåndsvisningen.'] }
}
function date(text, edition) {
  const parts = clean(text).match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/)
  if (!parts) throw Error('Datoen mangler dag, måned eller år.')
  const year = parts[3].length === 4 ? +parts[3] : Math.floor(edition / 100) * 100 + +parts[3]
  return Temporal.PlainDate.from({ year, month: +parts[2], day: +parts[1] }, { overflow: 'reject' })
}
function time(text) {
  const match = text.match(/^(\d{1,2})[.:](\d{2})$|^(\d{2})(\d{2})$/)
  if (!match) throw Error(`Klokkeslettet «${text}» er uklart.`)
  const hour = +(match[1] || match[3]), minute = +(match[2] || match[4])
  return Temporal.PlainTime.from({ hour, minute }, { overflow: 'reject' })
}
function linesOnPage(page) {
  const rows = []
  for (const item of page.items.filter(item => clean(item.str))) {
    const y = item.transform[5], row = rows.find(row => Math.abs(row.y - y) < 1)
    if (row) row.items.push(item); else rows.push({ y, items: [item] })
  }
  return rows.sort((a, b) => b.y - a.y).map(row => ({ ...row, items: row.items.sort((a, b) => a.transform[4] - b.transform[4]), text: clean(row.items.map(item => item.str).join(' ')), page: page.page }))
}
function tableRows(pages) {
  const result = []; let context = null, current = null
  for (const page of pages) for (const line of linesOnPage(page)) {
    if (/^(?:Innlevering arbeidskrav|Arbeidskrav|Eksamensavvikling)$/.test(line.text)) { context = null; current = null; continue }
    const header = line.items.map(item => clean(item.str)), kind = header.includes('Samling') ? 'samling' : header.includes('Arbeidskrav') ? 'arbeidskrav' : header.includes('Eksamen') ? 'eksamen' : null
    if (kind && header.includes('Dato') && (header.includes('Klokkeslett') || header.includes('Klasser'))) {
      context = { kind, columns: line.items.map(item => ({ name: clean(item.str), x: item.transform[4] })) }; current = null; continue
    }
    if (!context) continue
    const values = Object.fromEntries(context.columns.map(column => [column.name, '']))
    for (const item of line.items) {
      const column = context.columns.filter(column => column.x <= item.transform[4] + 2).at(-1)
      if (column) values[column.name] = clean(`${values[column.name]} ${item.str}`)
    }
    const number = values[context.columns[0].name]
    if (number && /^(?:\d{1,2}|(?:BPL|ITB)\d{4})$/.test(number)) { current = { kind: context.kind, number, page: page.page, values, excerpt: line.text }; result.push(current) }
    else if (current && !number) {
      for (const [key, value] of Object.entries(values)) if (value) current.values[key] = clean(`${current.values[key]} ${value}`)
      current.excerpt += ` ${line.text}`
    } else { context = null; current = null }
  }
  return result
}
function eventComponent(event, sourceUrl) {
  const component = new ICAL.Component('vevent')
  component.addPropertyWithValue('uid', `${stamp(`${sourceUrl}\0${event.id}`)}@public.hfy.no`)
  component.addPropertyWithValue('dtstamp', ICAL.Time.fromDateTimeString('1970-01-01T00:00:00Z'))
  component.addPropertyWithValue('summary', event.title)
  component.addPropertyWithValue('description', event.description)
  component.addPropertyWithValue('url', sourceUrl)
  component.addPropertyWithValue('transp', event.information ? 'TRANSPARENT' : 'OPAQUE')
  component.addPropertyWithValue('x-group', event.className)
  if (event.location) component.addPropertyWithValue('location', event.location)
  for (const key of ['start', 'end']) component.addPropertyWithValue(key === 'start' ? 'dtstart' : 'dtend', event.allDay ? ICAL.Time.fromDateString(event[key]) : ICAL.Time.fromDateTimeString(event[key]))
  return component
}
export function parseHfyCalendar(pages, selected) {
  const first = linesOnPage(pages[0]), title = first.find(line => /^Samlinger\s+20\d{2}/.test(line.text)), years = title?.text.match(/^Samlinger\s+(20\d{2})\s*[–—-]\s*(20\d{2})/), classLine = first.find(line => /^\d{2}(?:BPL|ITB)NETT[-–]INNFASING\b/i.test(line.text))
  if (!years || +years[2] !== +years[1] + 1 || !classLine) fail('source-changed', 'Samlingsplanen mangler entydig periode eller offentlig klassebetegnelse.')
  const className = classLine.text, placeStart = first.findIndex(line => /^Samlingssted\b/.test(line.text)), classIndex = first.indexOf(classLine), location = placeStart >= 0 ? first.slice(placeStart, classIndex).map(line => line.text.replace(/^Samlingssted\s*/, '')).filter(Boolean).join(', ') : ''
  const classSuffix = className.match(/INNFASING\s+(.+)$/i)?.[1], publishedClass = selected.name.match(/\bår\s+(.+?)\s*[–—-]\s*Samlinger/i)?.[1], comparable = text => normal(text).replace(/\s*-\s*/g, ' ')
  if (!classSuffix || !className.includes(selected.name.match(/^(?:BPL|ITB)\b/)?.[0] || 'unpublished-program') || publishedClass && comparable(publishedClass) !== comparable(classSuffix)) fail('source-changed', 'Klassebetegnelsen i PDF-en stemmer ikke med den valgte publiserte lenken. Ingen klasse er valgt automatisk.')
  const rows = tableRows(pages), events = [], unresolved = [], repeated = new Set(rows.filter((row, index) => rows.some((other, j) => index !== j && row.kind === other.kind && row.number === other.number)).map(row => `${row.kind}:${row.number}`))
  const scopeStart = Temporal.PlainDate.from(`${years[1]}-01-01`), scopeEnd = Temporal.PlainDate.from(`${+years[2] + 1}-01-01`)
  for (const [index, row] of rows.entries()) {
    const id = `${row.kind}:${row.number}`, values = row.values, excerpt = `PDF-side ${row.page}: ${row.excerpt}`
    try {
      if (repeated.has(id)) throw Error('Samme samlings- eller kravnummer står flere ganger med forskjellige opplysninger. Identiteten må avklares.')
      const parts = values.Dato.split(/\s*[–—-]\s*/), start = date(parts[0], +years[1]), end = parts.length === 2 ? date(parts[1], +years[1]) : start
      if (parts.length > 2 || Temporal.PlainDate.compare(end, start) < 0) throw Error('Sluttdatoen er før startdatoen eller datointervallet er uklart.')
      if (Temporal.PlainDate.compare(start, scopeStart) < 0 || Temporal.PlainDate.compare(end, scopeEnd) >= 0) throw Error(`Datofeltet avviker fra den publiserte perioden ${years[1]}–${years[2]}. Årstallet er ikke rettet automatisk.`)
      if (values.Klasser && normal(values.Klasser) !== normal(className)) throw Error(`Raden gjelder «${values.Klasser}», mens valgt plan gjelder «${className}». Klassetilhørighet må avklares.`)
      if (row.kind === 'samling') {
        const days = start.until(end).days + 1, times = [...values.Klokkeslett.matchAll(/Dag\s+(\d{1,2}):\s*(\d{1,2}[.:]\d{2}|\d{4})\s*[–—-]\s*(\d{1,2}[.:]\d{2}|\d{4})/g)]
        if (days > 14 || days !== times.length || new Set(times.map(match => +match[1])).size !== days || times.some(match => +match[1] < 1 || +match[1] > days)) throw Error('Antall daterte dager stemmer ikke med dagene som har klokkeslett. Dato eller år må avklares.')
        if (!/^\d{1,2}$/.test(values.Uke) || +values.Uke !== start.weekOfYear) throw Error(`Ukenummer ${values.Uke} stemmer ikke med datofeltets uke ${start.weekOfYear}. Ingen av opplysningene er valgt automatisk.`)
        const pending = times.map(match => {
          const day = start.add({ days: +match[1] - 1 }), from = time(match[2]), until = time(match[3])
          if (Temporal.PlainTime.compare(until, from) <= 0) throw Error('Sluttklokkeslettet er ikke etter starten.')
          const instant = value => day.toPlainDateTime(value).toZonedDateTime('Europe/Oslo', { disambiguation: 'reject' }).toInstant().toString()
          return { id: `${id}:day-${match[1]}`, title: `Samling ${row.number}, dag ${match[1]} · ${className}`, start: instant(from), end: instant(until), className, location: /digital/i.test(values.Kommentar) ? values.Kommentar : location, description: `${excerpt}. ${values.Kommentar || ''} Valgt offentlig klasseplan; emnetilhørighet er ikke antatt.`, information: false, allDay: false }
        })
        events.push(...pending)
      } else {
        if (start.until(end).days > 60) throw Error('Datointervallet er lengre enn den støttede eksamensperioden og må avklares.')
        events.push({ id, title: row.kind === 'arbeidskrav' ? `Innlevering arbeidskrav ${row.number} · ${className}` : `Eksamensperiode ${row.number} · ${className}`, start: start.toString(), end: end.add({ days: 1 }).toString(), className, description: `${excerpt}. Dato uten oppgitt klokkeslett, vist som informasjon. Ingen presis innleveringstid eller automatisk emnekobling er opprettet.`, allDay: true, information: true })
      }
    } catch (error) { unresolved.push({ id: `${id}:row-${index}`, kind: row.kind, sourceExcerpt: excerpt, reason: error.message }) }
  }
  if (pages.some(page => page.items.some(item => /Informasjon kommer på første samling/i.test(item.str)))) unresolved.push({ id: 'arbeidskrav:unpublished', kind: 'arbeidskrav', sourceExcerpt: 'Arbeidskrav: Informasjon kommer på første samling.', reason: 'Kilden oppgir ikke arbeidskrav eller datoer ennå.' })
  if (!rows.length || !events.length) fail('source-changed', 'Samlingsplanen har ingen entydige aktiviteter som kan forhåndsvises. Bruk dokumentimport for å avklare datoene.')
  const calendar = new ICAL.Component('vcalendar'); calendar.addPropertyWithValue('version', '2.0'); calendar.addPropertyWithValue('prodid', '-//Studieplan//Offentlig HFY klasseplan//NO'); calendar.addPropertyWithValue('x-wr-calname', selected.name)
  for (const event of events) calendar.addSubcomponent(eventComponent(event, selected.sourceUrl))
  return { calendar: calendar.toString(), name: selected.name, sourceKind: 'hfy-public-class', className, count: events.length, authoritative: unresolved.length === 0, unresolved, warnings: ['Samlinger reserverer den publiserte tiden først etter at du har valgt og bekreftet dem. Arbeidskrav og eksamensperioder uten klokkeslett vises som informasjon og reserverer ikke tid.', 'Ingen emnetilhørighet er utledet fra klassekoden. Kontroller riktig klasse, sted og datoer.', ...unresolved.map(row => `${row.sourceExcerpt} — Ikke datofestet: ${row.reason}`)] }
}
export async function fetchHfyCalendar(input, { fetchText, fetchBytes }) {
  const url = hfyPdfUrl(input).href, list = await hfyCalendarSources({ fetchText }), selected = list.results.find(row => row.sourceUrl === url)
  if (!selected) fail('invalid-selection', 'Velg en offentlig samlingsplan fra HØFYs publiserte liste. Andre PDF-lenker hentes ikke.')
  return parseHfyCalendar(await readPublicPdfItems(fetchBytes, url, hfyPdfUrl), selected)
}
