import { createHash } from 'node:crypto'
import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'

const origin = 'https://create.plandisc.com'
function publicReference(input) {
  const url = restrictedUrl(input, { origin, paths: [/^\/wheel\/showPublic\/[A-Za-z0-9_-]{5,100}\/?$/] })
  return { url, publicId: url.pathname.replace(/\/$/, '').split('/').at(-1) }
}
export function isPublicPlandiscUrl(input) { try { publicReference(input); return true } catch { return false } }
const sourceText = input => { const $ = load(String(input ?? '')); $('script,style').remove(); return clean($.text()) }
const escapeText = input => String(input ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
function fold(line) {
  const output = []; let current = '', size = 0
  for (const character of line) {
    const bytes = Buffer.byteLength(character)
    if (size + bytes > 75) { output.push(current); current = ' '; size = 1 }
    current += character; size += bytes
  }
  output.push(current); return output.join('\r\n')
}
function instant(input) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input) || !Number.isFinite(Date.parse(input))) fail('source-changed', 'En aktivitet i den offentlige Plandisc-kilden har en ugyldig eller tvetydig dato.')
  const [year, month, day, hour, minute, second] = input.slice(0, 19).split(/[-T:]/).map(Number), civil = new Date(Date.UTC(year, month - 1, day))
  if (year < 1900 || civil.getUTCFullYear() !== year || civil.getUTCMonth() !== month - 1 || civil.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) fail('source-changed', 'Plandisc oppgir en ugyldig kalenderdato eller et ugyldig klokkeslett.')
  return new Date(input)
}
function dateOnly(input, timezone) {
  const date = instant(input)
  if (!timezone) fail('source-changed', 'En heldagsaktivitet i Plandisc mangler tidssone. Datoen må avklares før import.')
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('')
  } catch { fail('source-changed', 'En heldagsaktivitet i Plandisc har en ukjent tidssone. Datoen må avklares før import.') }
}
const utc = value => instant(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

export function parsePublicPlandisc(data, input) {
  const ref = publicReference(input), wheel = data?.wheel
  if (data?.tokenStatus !== 0 || !wheel || !Array.isArray(wheel.rings) || typeof wheel.id !== 'string') fail('not-supported', 'Plandisc returnerte ikke en lesbar offentlig kalender for denne delingslenken. Bruk en offentlig eksportfil; innlogging startes ikke.')
  // The original shared link scopes this public response. Do not follow the
  // wheel's separate internal publicId or request its editing/account endpoints.
  const visible = wheel.publicSharingVisibleRings
  if (visible != null && (!Array.isArray(visible) || visible.some(id => typeof id !== 'string'))) fail('source-changed', 'Plandisc har endret formatet for synlige kalenderringer.')
  const name = sourceText(wheel.name) || 'Offentlig institusjonskalender', lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studieplan//Offentlig Plandisc-informasjon//NO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`], seen = new Map()
  let count = 0
  for (const ring of wheel.rings) {
    if (ring.active === false || visible?.length && !visible.includes(ring.id)) continue
    const meetings = ring.calendarRingDetails?.meetings
    if (meetings == null) continue
    if (!Array.isArray(meetings)) fail('source-changed', 'Plandisc har endret aktivitetsformatet.')
    for (const meeting of meetings) {
      if (++count > 5000) fail('not-supported', 'Den offentlige kalenderen har over 5000 aktiviteter. Velg et mindre offentlig utdrag.')
      if (typeof meeting.id !== 'string' || !meeting.id || meeting.id.length > 200) fail('source-changed', 'En kalenderaktivitet mangler en stabil kildeidentifikator.')
      if (meeting.recurringRule) fail('not-supported', 'Den offentlige Plandisc-kilden inneholder gjentakelsesregler som denne adapteren ikke kan bekrefte. Bruk en offentlig ICS-eksport for disse aktivitetene.')
      const uid = `${createHash('sha256').update(`${wheel.id}\0${meeting.id}`).digest('hex')}@public.plandisc`, title = sourceText(meeting.title)
      if (!title) fail('source-changed', 'En offentlig kalenderaktivitet mangler tittel.')
      const record = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${meeting.updated ? utc(meeting.updated) : '19700101T000000Z'}`]
      if (meeting.isDeleted) record.push('STATUS:CANCELLED')
      else {
        const start = instant(meeting.start), end = instant(meeting.end)
        if (end <= start) fail('source-changed', 'En Plandisc-aktivitet mangler en gyldig slutt. Ingen varighet er gjettet.')
        if (meeting.allDay === true) {
          const timezone = meeting.timezone || wheel.timezone, from = dateOnly(meeting.start, timezone), until = dateOnly(meeting.end, timezone)
          if (until <= from) fail('source-changed', 'En heldagsaktivitet mangler en gyldig sluttdato.')
          record.push(`DTSTART;VALUE=DATE:${from}`, `DTEND;VALUE=DATE:${until}`)
        } else if (meeting.allDay === false) record.push(`DTSTART:${utc(meeting.start)}`, `DTEND:${utc(meeting.end)}`)
        else fail('source-changed', 'Plandisc oppgir ikke om en aktivitet er en heldagshendelse.')
      }
      record.push(`SUMMARY:${escapeText(title)}`, 'TRANSP:TRANSPARENT', `URL:${ref.url.href}`)
      const description = sourceText(meeting.detailedDescription || meeting.description)
      record.push(`DESCRIPTION:${escapeText([description, 'Offentlig institusjonskalender. Aktiviteten reserverer ikke studietid og er ikke koblet automatisk til et emne eller en undervisningsgruppe.'].filter(Boolean).join('\n'))}`)
      const location = sourceText(meeting.location)
      if (location) record.push(`LOCATION:${escapeText(location)}`)
      if (Number.isSafeInteger(meeting.sequence) && meeting.sequence >= 0) record.push(`SEQUENCE:${meeting.sequence}`)
      record.push('END:VEVENT')
      const content = record.join('\r\n')
      if (seen.has(uid)) { if (seen.get(uid) !== content) fail('source-changed', 'Plandisc har flere ulike aktiviteter med samme kildeidentifikator. Ingen versjon er valgt automatisk.'); continue }
      seen.set(uid, content); lines.push(...record)
    }
  }
  if (!seen.size) fail('source-changed', 'Den offentlige Plandisc-kilden har ingen lesbare aktiviteter i de synlige ringene. Tidligere data er beholdt.')
  lines.push('END:VCALENDAR')
  return { calendar: lines.map(fold).join('\r\n') + '\r\n', name, institutional: true, sourceKind: 'public-plandisc', warnings: ['Dette er en offentlig institusjonskalender. Velg og kontroller aktivitetene før lagring. Ingen emne- eller gruppetilhørighet er antatt.', 'Aktivitetene lagres som informasjon og reserverer ikke studietid. Kildens datoer, klokkeslett og heldagsmarkering beholdes. Visningsvinduet brukes ikke til å anta kalenderdekning.'], count: seen.size }
}
export async function fetchPlandiscCalendar(input, { fetchText }) {
  const ref = publicReference(input), api = `${origin}/api/wheels/public/${ref.publicId}`, validate = value => restrictedUrl(value, { origin, paths: [new RegExp(`^/api/wheels/public/${ref.publicId}$`)] })
  let data
  try { data = JSON.parse(await cachedText(fetchText, api, validate)) } catch (error) { if (error.name === 'SyntaxError') fail('source-changed', 'Den offentlige Plandisc-kilden returnerte ikke gyldige kalenderdata.'); throw error }
  return parsePublicPlandisc(data, ref.url.href)
}
