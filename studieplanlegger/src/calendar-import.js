import ICAL from 'ical.js'
import { Temporal } from '@js-temporal/polyfill'
import { OSLO, semesterWindow } from './planner.js'

function registerZone(tzid) {
  if (ICAL.TimezoneService.has(tzid)) return
  try { Temporal.Now.zonedDateTimeISO(tzid) } catch { throw new Error(`Ukjent tidssone «${tzid}». Eksporter kalenderen med VTIMEZONE eller en IANA-tidssone.`) }
  const zone = new ICAL.Timezone({ tzid })
  zone.utcOffset = time => Temporal.ZonedDateTime.from({ timeZone: tzid, year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second }, { disambiguation: 'compatible' }).offsetNanoseconds / 1e9
  ICAL.TimezoneService.register(tzid, zone)
}
export function parseCalendar(input, { courseId, semester, year }) {
  if (typeof input !== 'string' || input.length > 2_000_000 || !/^\s*BEGIN:VCALENDAR/im.test(input) || !/END:VCALENDAR\s*$/i.test(input)) throw new Error('Filen er ikke en fullstendig .ics-kalender (maks 2 MB). Last ned kalenderfilen på nytt.')
  const range = semesterWindow(semester, year), from = Date.parse(range.start), until = Date.parse(range.end)
    const warnings = [], events = [], seenKeys = new Map()
  ICAL.TimezoneService.reset()
  try {
    const root = new ICAL.Component(ICAL.parse(input))
    if (root.name !== 'vcalendar') throw new Error('Kalenderformatet er ugyldig.')
    for (const component of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(component.getFirstPropertyValue('tzid'), new ICAL.Timezone(component))
    const fallback = root.getFirstPropertyValue('x-wr-timezone') || OSLO
    registerZone(fallback)
    let floating = false, skipped = false, iterations = 0
    const components = root.getAllSubcomponents('vevent')
    for (const component of components) {
      for (const property of component.getAllProperties()) {
        if (!['dtstart', 'dtend', 'recurrence-id', 'exdate', 'rdate'].includes(property.name)) continue
        const tzid = property.getParameter('tzid')
        if (tzid) registerZone(tzid)
        else if (property.type === 'date-time' && !String(property.toJSON()[3]).endsWith('Z')) { property.setParameter('tzid', fallback); floating = true }
      }
      if (component.getFirstPropertyValue('status') === 'CANCELLED' && !component.hasProperty('dtstart') && component.hasProperty('recurrence-id')) component.addPropertyWithValue('dtstart', component.getFirstPropertyValue('recurrence-id'))
    }
    const normalizedTp = root.getFirstPropertyValue('x-studieplan-tp-normalized') === '1'
    const identityMode = !normalizedTp && String(root.getFirstPropertyValue('prodid') || '').includes('//UiO//TP') ? 'content' : 'uid'
    const sourceAuthoritative = String(root.getFirstPropertyValue('x-studieplan-authoritative') || '').toLowerCase() !== 'false'
    warnings.push(...root.getAllProperties('x-studieplan-warning').map(property=>String(property.getFirstValue())))
    const timeEdit = /timeedit/i.test(String(root.getFirstPropertyValue('prodid') || ''))
    const delta = root.getFirstPropertyValue('method') === 'CANCEL'
    if (delta) for (const component of components) component.updatePropertyWithValue('status', 'CANCELLED')
    const cancellations = components.filter(c => c.getFirstPropertyValue('status') === 'CANCELLED').map(c => ({ uid: c.getFirstPropertyValue('uid'), recurrence: c.getFirstPropertyValue('recurrence-id')?.toString() || null }))
    if (identityMode === 'content') warnings.push('TP lager nye ID-er ved hver henting. Økter gjenkjennes på navn og tidspunkt. Flytting til en annen dato kan vises som avlysning og ny økt; egne notater beholdes.')
    const exceptions = components.filter(c => c.hasProperty('recurrence-id'))
    const consumed = new Set()
    function append(item, start, end, recurrence) {
      if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return
      if (!start || !end) { skipped = true; warnings.push('En økt mangler start eller slutt og er utelatt.'); return }
      const startTime = start.isDate ? Temporal.PlainDate.from(start.toString()).toZonedDateTime(fallback).epochMilliseconds : start.toUnixTime() * 1000
      const endTime = end.isDate ? Temporal.PlainDate.from(end.toString()).toZonedDateTime(fallback).epochMilliseconds : end.toUnixTime() * 1000
      if (endTime <= startTime) { skipped = true; warnings.push('En økt har manglende eller ugyldig varighet og er utelatt.'); return }
      if (endTime <= from || startTime >= until) return
      const sourceTitle = item.summary?.trim(), assessment = item.component.getFirstPropertyValue('x-studieplan-activity-kind') === 'assessment'
      const title = sourceTitle && assessment ? `Vurdering fra kilden: ${sourceTitle}` : sourceTitle
      if (!title || !item.uid) { skipped = true; warnings.push('En økt mangler navn eller kilde-ID og er utelatt.'); return }
      const startISO = new Date(startTime).toISOString(), endISO = new Date(endTime).toISOString()
      const explicitGroup = item.component.getFirstPropertyValue('x-group')
      const sourceKey = identityMode === 'content' ? JSON.stringify([title, recurrence?.toString() || startISO, explicitGroup || title, item.location || '']) : JSON.stringify([item.uid, recurrence?.toString() || 'single'])
      const identity = JSON.stringify([item.uid, title, startISO, endISO, explicitGroup, item.location, item.description])
      if (seenKeys.has(sourceKey)) {
        if (seenKeys.get(sourceKey) !== identity) throw new Error('Aktiviteter med samme identitet kan ikke skilles sikkert. Velg en tydeligere gruppe- eller kalenderavgrensning.')
        return
      }
      seenKeys.set(sourceKey, identity)
      const transparent = item.component.getFirstPropertyValue('transp') === 'TRANSPARENT'
      const information = /^(?:Kommentar kort:|Undervisningsfri)/i.test(title) || assessment && transparent
      if (information && !transparent) warnings.push('Kilden har kommentar-/informasjonsoppføringer uten TRANSP. De vises som informasjon og reserverer ikke arbeidstid.')
      const groupMissing = (timeEdit || normalizedTp) && !explicitGroup
      if (groupMissing) warnings.push('Kalenderkilden mangler gruppenummer. Aktivitetstypen er ikke en gruppeidentitet. Kontroller tidspunkt og sted; øvinger velges ikke automatisk.')
      events.push({ sourceKey, sourceUid: item.uid, title, courseId, start: startISO, end: endISO, location: item.location || '', description: item.description || '', group: explicitGroup || title, ...(groupMissing ? { groupMissing: true } : {}), transparent, information, allDay: start.isDate, cancelled: false })
      if (events.length > 5000) throw new Error('Kalenderen har over 5000 økter i semesteret. Eksporter færre emner eller grupper.')
    }
    for (const component of components.filter(c => !c.hasProperty('recurrence-id'))) {
      if (component.getFirstPropertyValue('status') === 'CANCELLED') continue
      if (!component.hasProperty('dtstart')) { skipped = true; warnings.push('En økt mangler starttid og er utelatt.'); continue }
      const related = exceptions.filter(c => c.getFirstPropertyValue('uid') === component.getFirstPropertyValue('uid'))
      const event = new ICAL.Event(component, { exceptions: related })
      if (!event.isRecurring()) { append(event, event.startDate, event.endDate); continue }
      // Reject a provably excessive, unrestricted second-by-second series before
      // doing thousands of expensive timezone conversions on the UI thread.
      // Bounded series, interval limits and recurrence exceptions still use ICAL.
      if (!component.hasProperty('exdate') && !related.length && component.getAllProperties('rrule').some(property => {
        const rule = property.getFirstValue()
        return rule.freq === 'SECONDLY' && !rule.count && !rule.until && !Object.keys(rule.parts || {}).length &&
          (until - Math.max(from, event.startDate.toUnixTime() * 1000)) / ((rule.interval || 1) * 1000) > 20000
      })) throw new Error('Gjentakelsene er for omfattende. Eksporter en kalender avgrenset til semesteret.')
      if (!component.hasProperty('rrule') && !component.getAllProperties('exdate').flatMap(p => p.getValues()).some(date => date.compare(event.startDate) === 0)) {
        const detail = event.getOccurrenceDetails(event.startDate)
        append(detail.item, detail.startDate, detail.endDate, event.startDate)
      }
      const iterator = event.iterator()
      let occurrence
      while ((occurrence = iterator.next())) {
        if (++iterations > 20000) throw new Error('Gjentakelsene er for omfattende. Eksporter en kalender avgrenset til semesteret.')
        if (occurrence.toUnixTime() * 1000 >= until) break
        const detail = event.getOccurrenceDetails(occurrence)
        if (detail.item.isRecurrenceException()) consumed.add(detail.item.component)
        append(detail.item, detail.startDate, detail.endDate, occurrence)
      }
    }
    // Detached or moved exceptions can fall inside the semester even when the original occurrence does not.
    for (const component of exceptions.filter(c => !consumed.has(c))) {
      const event = new ICAL.Event(component)
      append(event, event.startDate, event.endDate, event.recurrenceId)
    }
    if (floating) warnings.push(`Klokkeslett uten tidssone tolkes som ${fallback}.`)
    if (root.getAllSubcomponents('vtodo').length) warnings.push('Kalenderen inneholder gjøremål. Disse importeres ikke som undervisning; registrer eventuelle innleveringsoppgaver manuelt.')
    return { events: events.sort((a, b) => a.start.localeCompare(b.start) || a.sourceKey.localeCompare(b.sourceKey)), warnings: [...new Set(warnings)], authoritative: sourceAuthoritative && !skipped && !delta, cancellations, identityMode, name: root.getFirstPropertyValue('x-wr-calname') || '', range }
  } catch (error) {
    throw new Error(`Kalenderen kunne ikke leses. ${error.message}`)
  } finally { ICAL.TimezoneService.reset() }
}
