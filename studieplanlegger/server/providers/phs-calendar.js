import ICAL from 'ical.js'
import { Temporal } from '@js-temporal/polyfill'
import { createHash } from 'node:crypto'
import { load, clean, fail, restrictedUrl, cachedText } from './program-source.js'

const origin = 'https://www.politihogskolen.no', prefix = '/for-studenter/eksamen/'
export const phsExamUrl = input => restrictedUrl(input, { origin, paths: [/^\/for-studenter\/eksamen\/eksamensoversikt-(?:ba|ma)\/?$/] })
export const phsExamSources = () => ({ status: 'ok', results: ['ba', 'ma'].map(level => ({ id: level, name: `Politihøgskolen · publiserte eksamener ${level === 'ba' ? 'bachelor' : 'master'}`, sourceUrl: `${origin}${prefix}eksamensoversikt-${level}` })), warnings: ['Velg egen utdanning, kull og ordinær eller ny eksamen. Listen bekrefter ikke personlig eksamensoppmelding.'] })
const stamp = text => createHash('sha256').update(text).digest('hex').slice(0, 32)
const months = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember']
const days = ['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag']
function dateRange(value, year) {
  const dates = value.split(/\s*[–—-]\s*/)
  if (dates.length > 2) throw Error('Datointervallet har flere enn to grenser.')
  const finalMonth = months.findIndex(month => dates.at(-1).toLowerCase().includes(month)) + 1
  const numeric = dates.at(-1).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  const parsed = dates.map(part => {
    const word = part.match(/^(?:(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\s+)?(\d{1,2})\.\s*(\p{L}+)?$/iu)
    const number = part.match(/^(\d{1,2})\.(?:(\d{1,2})\.(\d{4}))?$/)
    const month = word ? (word[3] ? months.indexOf(word[3].toLowerCase()) + 1 : finalMonth || +numeric?.[2]) : +(number?.[2] || numeric?.[2])
    const day = +(word?.[2] || number?.[1]), explicitYear = +(number?.[3] || numeric?.[3] || year)
    if (!month || !day || explicitYear !== year) throw Error('Datoen kan ikke kobles entydig til overskriftens kalenderår.')
    const date = Temporal.PlainDate.from({ year, month, day }, { overflow: 'reject' })
    if (word?.[1] && days[date.dayOfWeek - 1] !== word[1].toLowerCase()) throw Error('Ukedag og datofelt stemmer ikke overens. Ingen av dem er rettet automatisk.')
    return date
  })
  const start = parsed[0], end = parsed.at(-1)
  if (Temporal.PlainDate.compare(end, start) < 0 || start.until(end).days > 90) throw Error('Eksamensperiodens grenser må avklares.')
  return { start, end }
}
function rowsFromHtml($, level) {
  const rows = []; let year, section = '', studyYear = '', last
  $('.vrtx-article-body').children().each((_, node) => {
    const tag = node.tagName, text = clean($(node).text())
    if (tag === 'h2') { year = +(text.match(/^(?:høst|vår)\s+(20\d{2})$/i)?.[1] || 0); section = text; last = null; return }
    if (!year) return
    if (tag === 'h3') { section = text; studyYear = text.match(/\bB[123]\b/)?.[0] || ''; last = null; return }
    if (level === 'ma' && tag === 'table') {
      const headings = $(node).find('thead th').map((_, th) => clean($(th).text())).get()
      if (headings.join('|') !== 'Kull|Emne|Dato|Type|Vurderingsform') fail('source-changed', 'Eksamensoversiktens kolonner er endret.')
      $(node).find('tbody tr').each((_, tr) => {
        const cells = $(tr).children('td').map((_, td) => clean($(td).text())).get()
        if (cells.length === 1) { studyYear = cells[0]; return }
        if (cells.length !== 5) fail('source-changed', 'Eksamensoversikten har en uventet tabellrad.')
        const [cohort, code, date, kind, description] = cells
        rows.push({ year, section: `${studyYear} · ${cohort} · ${kind} · ${section}`, code, date, description, excerpt: cells.join(' · ') })
      })
    }
    if (level !== 'ba' || tag !== 'p') return
    const copy = $(node).clone(); copy.find('br').replaceWith('\n')
    for (const part of copy.text().split('\n').map(clean).filter(Boolean)) {
      if (/^B[123]$/.test(part)) { studyYear = part; last = null; continue }
      const match = part.match(/^((?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\b.+?):\s*([A-Z][A-Z0-9/-]*\d)\s*(.*)$/i)
      if (match) { last = { year, section: `${section} · ${studyYear}`, date: match[1], code: match[2], description: match[3].replace(/^[\s,–—-]+/, ''), excerpt: part }; rows.push(last) }
      else if (last && /^(?:Innlevering|Du får tildelt)/i.test(part)) { last.description += ` ${part}`; last.excerpt += ` ${part}` }
    }
  })
  return rows
}
export function parsePhsExamCalendar(html, sourceUrl) {
  const url = phsExamUrl(sourceUrl), level = /-ba\/?$/.test(url.pathname) ? 'ba' : 'ma', $ = load(html)
  const rows = rowsFromHtml($, level), unresolved = [], calendar = new ICAL.Component('vcalendar'), seen = new Set()
  calendar.addPropertyWithValue('version', '2.0'); calendar.addPropertyWithValue('prodid', '-//Studieplan//PHS public exams//NO')
  let count = 0
  for (const row of rows) try {
    const dates = dateRange(row.date, row.year), identity = `${row.section}:${row.code}:${row.description.replace(/(?:kl\.?\s*)?\d{1,2}:\d{2}/g, '').replace(/\([^)]*\)/g, '').trim()}`
    if (seen.has(identity)) throw Error('Flere eksamener har samme kildeidentitet. Avklar hvilken som gjelder før import.')
    seen.add(identity)
    const due = row.description.match(/innleveringsfrist\s+kl\.?\s*(\d{1,2}:\d{2})/i), clocks = row.description.match(/kl\.?\s*(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/i)
    const local = clock => dates.start.toPlainDateTime(Temporal.PlainTime.from(clock.length === 4 ? `0${clock}` : clock)).toZonedDateTime('Europe/Oslo', { disambiguation: 'reject' }).toInstant().toString()
    const component = new ICAL.Component(due ? 'vtodo' : 'vevent')
    component.addPropertyWithValue('uid', `${stamp(`${url.href}:${identity}`)}@public.phs.no`)
    component.addPropertyWithValue('summary', `${due ? 'Innlevering' : 'Eksamen'} ${row.code} · ${row.section}`)
    component.addPropertyWithValue('description', `${row.excerpt}\nPublisert eksamensoversikt. Velg bare egen eksamen; oppmelding, personlig tidspunkt og emnetilknytning er ikke antatt.`)
    component.addPropertyWithValue('url', url.href)
    if (due) {
      if (!dates.start.equals(dates.end)) throw Error('Innleveringens klokkeslett er knyttet til en datoperiode og må avklares.')
      component.addPropertyWithValue('due', ICAL.Time.fromDateTimeString(local(due[1])))
    } else if (clocks && dates.start.equals(dates.end)) {
      const start = local(clocks[1]), end = local(clocks[2]); if (Date.parse(end) <= Date.parse(start)) throw Error('Sluttklokkeslett er ikke etter starten.')
      component.addPropertyWithValue('dtstart', ICAL.Time.fromDateTimeString(start)); component.addPropertyWithValue('dtend', ICAL.Time.fromDateTimeString(end)); component.addPropertyWithValue('transp', 'OPAQUE')
    } else {
      component.addPropertyWithValue('dtstart', ICAL.Time.fromDateString(dates.start.toString())); component.addPropertyWithValue('dtend', ICAL.Time.fromDateString(dates.end.add({ days: 1 }).toString())); component.addPropertyWithValue('transp', 'TRANSPARENT')
      component.updatePropertyWithValue('description', `${row.excerpt}\nDato/periode uten bekreftet personlig klokkeslett. Vises som informasjon og reserverer ikke arbeidstid. Kontroller egen oppmelding og tidspunkt.`)
    }
    calendar.addSubcomponent(component); count++
  } catch (error) { unresolved.push({ sourceExcerpt: `${row.section}: ${row.excerpt}`, reason: error.message }) }
  if (!rows.length || !count) fail('source-changed', 'Den publiserte eksamensoversikten har ingen entydige datoer som kan forhåndsvises.')
  return { calendar: calendar.toString(), name: `Politihøgskolen · eksamensoversikt ${level === 'ba' ? 'bachelor' : 'master'}`, sourceKind: 'phs-public-exam', count, authoritative: false, unresolved, warnings: ['Dette er publiserte eksamener, ikke en undervisningstimeplan eller personlig eksamensoppmelding. Velg selv riktig kull, emne og ordinær eller ny eksamen.', 'Eksakte innleveringsfrister foreslås som oppgaver. Eksamen med start og slutt reserverer tid. Datoer og muntlige eksamensperioder uten personlig klokkeslett vises som informasjon.', ...unresolved.map(row => `Uavklart: ${row.sourceExcerpt}. ${row.reason}`)] }
}
export async function fetchPhsExamCalendar(input, { fetchText }) {
  const url = phsExamUrl(input).href
  return parsePhsExamCalendar(await cachedText(fetchText, url, phsExamUrl), url)
}
