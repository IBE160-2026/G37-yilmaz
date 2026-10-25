import ICAL from 'ical.js'
import { Temporal } from '@js-temporal/polyfill'
import { OSLO, semesterWindow } from './planner.js'
import { normalizeActivityKind } from './event-kind.js'

// Read jCal strings before ICAL.Time hydrates them: ICAL normalizes overflowing
// calendar fields, which would otherwise change dates and cancellation identities.
const calendarDateProperties = ['dtstart', 'dtend', 'due', 'recurrence-id', 'exdate', 'rdate']
const calendarSingletonProperties = ['dtstart', 'dtend', 'due', 'recurrence-id', 'duration']
const calendarDuration = /^[+-]?P(?:\d+W|(?=\d+D|T\d)(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?)?)$/
export function calendarDateSyntaxIssues(input) {
  const result = { vevent: [], vtodo: [] }, stack = []
  const date = /^\d{8}(?:T\d{6}Z?)?$/
  const dateOnly = /^\d{8}$/, dateTime = /^\d{8}T\d{6}Z?$/
  // ICAL's text-to-jCal conversion also slices off extra characters. Check
  // complete tokens first, including folded lines and quoted parameters.
  for (const line of input.trim().replace(/\r\n?|\n/g, '\n').replace(/\n[ \t]/g, '').split('\n')) {
    let quoted = false, delimiter = -1
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted
      else if (line[i] === ':' && !quoted) { delimiter = i; break }
    }
    if (delimiter < 0) continue // Structural errors remain ICAL's responsibility.
    const header = line.slice(0, delimiter).match(/(?:[^;"]|"[^"]*")+/g) || []
    const name = header[0]?.toLowerCase(), value = line.slice(delimiter + 1)
    if (name === 'begin') {
      const component = { name: value.toLowerCase() }
      if (stack.length === 1 && Object.hasOwn(result, component.name)) { component.issues = []; result[component.name].push(component.issues) }
      stack.push(component); continue
    }
    if (name === 'end') { stack.pop(); continue }
    const issues = stack.at(-1)?.issues
    if (!issues) continue
    if (calendarDateProperties.includes(name)) {
      const types = header.slice(1).filter(parameter => /^value=/i.test(parameter)).map(parameter => parameter.slice(6).replace(/^"(.*)"$/, '$1').toLowerCase())
      const type = types[0] || 'date-time'
      const valid = (['rdate', 'exdate'].includes(name) ? value.split(',') : [value]).every(member => {
        if (type === 'date') return dateOnly.test(member)
        if (type === 'date-time') return dateTime.test(member)
        if (type !== 'period' || name !== 'rdate') return false
        const parts = member.split('/')
        return parts.length === 2 && dateTime.test(parts[0]) && (dateTime.test(parts[1]) || calendarDuration.test(parts[1]))
      })
      if (!valid || types.length > 1) issues.push(name)
    } else if (name === 'duration') {
      if (!calendarDuration.test(value)) issues.push(name)
    } else if (name === 'rrule' || name === 'exrule') {
      for (const part of value.split(';')) if (/^UNTIL=/i.test(part) && !date.test(part.slice(6))) issues.push(`${name} UNTIL`)
    }
  }
  return result
}

function checkedCalendarDate(value, type) {
  const match = typeof value === 'string' && value.match(type === 'date' ? /^(\d{4})-(\d{2})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z)?$/)
  if (!match) throw new Error('ugyldig datoformat')
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match
  Temporal.PlainDate.from({ year: Number(year), month: Number(month), day: Number(day) }, { overflow: 'reject' })
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 60) throw new Error('ugyldig klokkeslett')
  // RFC 5545 §3.3.5: implementations without leap seconds interpret 60 as 59.
  return Number(second) === 60 ? value.replace(/:60(Z)?$/, ':59$1') : value
}

export function validateCalendarDates(component, syntaxIssues = []) {
  const invalid = [...syntaxIssues]
  for (const name of calendarSingletonProperties) if (component.jCal[1].filter(property => property[0] === name).length > 1) invalid.push(name)
  if (component.name === 'vevent') {
    const start = component.jCal[1].find(([name]) => name === 'dtstart')
    const end = component.jCal[1].find(([name]) => name === 'dtend')
    // An explicit end must use the same DATE or DATE-TIME value type as its start.
    if (start && end && start[2] !== end[2]) invalid.push('dtstart', 'dtend')
  }
  for (const property of component.jCal[1]) {
    const [name, , type] = property
    if (calendarDateProperties.includes(name)) {
      try {
        if (!['date', 'date-time', ...(name === 'rdate' ? ['period'] : [])].includes(type) || property.length < 4) throw new Error('ugyldig datatype')
        const values = property.slice(3).map(value => {
          if (type !== 'period') return checkedCalendarDate(value, type)
          if (!Array.isArray(value) || value.length !== 2) throw new Error('ugyldig periode')
          const start = checkedCalendarDate(value[0], 'date-time')
          const duration = /^[+-]?P/.test(value[1])
          if (duration && !calendarDuration.test(value[1])) throw new Error('ugyldig periodevarighet')
          const end = duration ? value[1] : checkedCalendarDate(value[1], 'date-time')
          return [start, end]
        })
        property.splice(3, property.length - 3, ...values)
      } catch { invalid.push(name) }
    } else if (name === 'duration') {
      if (type !== 'duration' || property.length !== 4 || !calendarDuration.test(property[3])) invalid.push(name)
    } else if (name === 'rrule' || name === 'exrule') {
      for (const rule of property.slice(3)) if (rule?.until != null) {
        try { rule.until = checkedCalendarDate(rule.until, String(rule.until).includes('T') ? 'date-time' : 'date') }
        catch { invalid.push(`${name} UNTIL`) }
      }
    }
  }
  return [...new Set(invalid)]
}

export function calendarDateWarning(component, index, fields) {
  const title = String(component.getFirstPropertyValue('summary') || '').trim().slice(0, 120)
  return `${component.name.toUpperCase()} ${index + 1}${title ? ` (${title})` : ''} har ugyldig dato eller klokkeslett i ${fields.map(field => field.toUpperCase()).join(', ')} og er utelatt.`
}

function registerZone(tzid) {
  if (ICAL.TimezoneService.has(tzid)) return
  try { Temporal.Now.zonedDateTimeISO(tzid) } catch { throw new Error(`Ukjent tidssone «${tzid}». Eksporter kalenderen med VTIMEZONE eller en IANA-tidssone.`) }
  const zone = new ICAL.Timezone({ tzid })
  // ICAL subtracts this offset from the original wall clock. RFC 5545 uses
  // the offset before a gap and the first occurrence of a repeated clock.
  zone.utcOffset = time => Temporal.ZonedDateTime.from({ timeZone: tzid, year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second }, { disambiguation: 'earlier' }).offsetNanoseconds / 1e9
  ICAL.TimezoneService.register(tzid, zone)
}
// Keep the historical source key, but compare DATE-TIME occurrences by instant.
// Local legacy keys did not retain TZID; these are only candidates and need the
// old unmodified source start as corroboration before a persisted match.
function occurrenceMetadata(uid, recurrence, fallback) {
  if (!recurrence) return {}
  const occurrenceInstant = recurrence.isDate ? recurrence.toString() : new Date(recurrence.toUnixTime() * 1000).toISOString()
  const canonical = recurrence.isDate ? occurrenceInstant : occurrenceInstant.replace('.000Z', 'Z')
  const occurrenceAliases = [JSON.stringify([uid, canonical])]
  const local = recurrence.isDate ? [] : [recurrence.toString(), recurrence.convertToZone(ICAL.TimezoneService.get(fallback)).toString()].filter(value => !value.endsWith('Z'))
  return { occurrenceInstant, occurrenceAliases, occurrenceLocalAliases: [...new Set(local)].map(value => JSON.stringify([uid, value])) }
}
// File imports use their own finite dates. An endless recurrence is expanded
// for six months from its start, with an explicit warning; ICAL still owns all
// recurrence and timezone interpretation, and the same work limit applies.
function fileWindow(components, fallback, warnings) {
  const instant = value => value.isDate ? Temporal.PlainDate.from(value.toString()).toZonedDateTime(fallback).epochMilliseconds : value.toUnixTime() * 1000
  const dates = []; let iterations = 0
  for (const component of components) {
    for (const name of ['dtstart', 'dtend', 'recurrence-id', 'rdate']) for (const property of component.getAllProperties(name)) for (const date of property.getValues()) {
      if (date instanceof ICAL.Period) dates.push(instant(date.start), instant(date.getEnd()))
      else dates.push(instant(date))
    }
    if (!component.hasProperty('dtstart')) continue
    const event = new ICAL.Event(component)
    dates.push(instant(event.endDate))
    for (const property of component.getAllProperties('rdate')) for (const date of property.getValues()) if (!(date instanceof ICAL.Period)) dates.push(instant(event.getOccurrenceDetails(date).endDate))
    if (component.hasProperty('recurrence-id')) continue
    if (!event.isRecurring()) continue
    const unbounded = component.getAllProperties('rrule').some(property => { const rule = property.getFirstValue(); return !rule.count && !rule.until })
    if (unbounded) {
      const end = Temporal.Instant.fromEpochMilliseconds(instant(event.startDate)).toZonedDateTimeISO(fallback).add({ months: 6 }).epochMilliseconds
      dates.push(end)
      warnings.push(`En gjentakelse uten sluttdato er avgrenset til seks måneder fra første dato (${osloDate(instant(event.startDate))}–${osloDate(end)}). Uttrykkelige ekstra datoer (RDATE) beholdes. Velg et kalendersemester under periodevalg for en annen avgrensning.`)
      continue
    }
    const iterator = event.iterator(); let occurrence
    while ((occurrence = iterator.next())) {
      if (++iterations > 20000) throw new Error('Gjentakelsene er for omfattende. Eksporter en avgrenset kalender.')
      dates.push(occurrence instanceof ICAL.Period ? instant(occurrence.getEnd()) : instant(occurrence) + Math.max(0, instant(event.endDate) - instant(event.startDate)))
    }
  }
  const finite = dates.filter(Number.isFinite)
  if (!finite.length) return { start: '1970-01-01T00:00:00Z', end: '1970-01-02T00:00:00Z' }
  return { start: new Date(Math.min(...finite) - 86400000).toISOString(), end: new Date(Math.max(...finite) + 86400000).toISOString() }
}
const osloDate = value => Temporal.Instant.fromEpochMilliseconds(value).toZonedDateTimeISO(OSLO).toPlainDate().toString()

export function parseCalendar(input, { courseId, semester, year, fileImport = false }) {
  if (typeof input !== 'string' || input.length > 2_000_000 || !/^\s*BEGIN:VCALENDAR/im.test(input) || !/END:VCALENDAR\s*$/i.test(input)) throw new Error('Filen er ikke en fullstendig .ics-kalender (maks 2 MB). Last ned kalenderfilen på nytt.')
  let range = !fileImport || semester || year ? semesterWindow(semester, year) : null
  const warnings = [], events = [], seenKeys = new Map()
  ICAL.TimezoneService.reset()
  try {
    const root = new ICAL.Component(ICAL.parse(input))
    if (root.name !== 'vcalendar') throw new Error('Kalenderformatet er ugyldig.')
    for (const component of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(component.getFirstPropertyValue('tzid'), new ICAL.Timezone(component))
    const fallback = root.getFirstPropertyValue('x-wr-timezone') || OSLO
    registerZone(fallback)
    let floating = false, skipped = false, boundedSeries = false, iterations = 0
    const components = root.getAllSubcomponents('vevent'), rejectedComponents = new Set(), invalidDates = new Map(), syntaxIssues = calendarDateSyntaxIssues(input).vevent
    const delta = root.getFirstPropertyValue('method') === 'CANCEL'
    if (delta) for (const component of components) component.updatePropertyWithValue('status', 'CANCELLED')
    for (const [index, component] of components.entries()) {
      const invalid = validateCalendarDates(component, syntaxIssues[index]), zoneFailures = []
      for (const property of component.getAllProperties()) {
        if (!['dtstart', 'dtend', 'recurrence-id', 'exdate', 'rdate'].includes(property.name)) continue
        if (invalid.length && (property.name !== 'recurrence-id' || invalid.includes('recurrence-id'))) continue
        const tzid = property.getParameter('tzid')
        if (tzid) {
          try { registerZone(tzid) }
          catch (error) { invalid.push(property.name); zoneFailures.push(error.message) }
        }
        else if (['date-time', 'period'].includes(property.type) && property.toJSON().slice(3).some(value => !String(property.type === 'period' ? value[0] : value).endsWith('Z'))) { property.setParameter('tzid', fallback); floating = true }
      }
      if (invalid.length) {
        invalidDates.set(component, invalid); rejectedComponents.add(component); skipped = true
        warnings.push([calendarDateWarning(component, index, [...new Set(invalid)]), ...new Set(zoneFailures)].join(' '))
        continue
      }
      if (component.getFirstPropertyValue('status') === 'CANCELLED' && !component.hasProperty('dtstart') && component.hasProperty('recurrence-id')) component.addPropertyWithValue('dtstart', component.getFirstPropertyValue('recurrence-id'))
      // Decode after normalizing recurrence IDs, so a rejected exception can
      // still suppress the occurrence it overrides, including floating times.
      try { if (component.hasProperty('duration')) component.getFirstPropertyValue('duration') }
      catch { rejectedComponents.add(component); skipped = true; warnings.push('En økt har ugyldig DURATION og er utelatt.'); continue }
      if (component.getFirstPropertyValue('status') !== 'CANCELLED' && root.getFirstPropertyValue('method') !== 'CANCEL' && (!component.getFirstPropertyValue('summary')?.trim() || !component.getFirstPropertyValue('uid')?.trim())) {
        rejectedComponents.add(component); skipped = true; warnings.push('En økt mangler navn eller kilde-ID og er utelatt.')
      }
    }
    range ||= fileWindow(components.filter(component => !rejectedComponents.has(component)), fallback, warnings)
    const from = Date.parse(range.start), until = Date.parse(range.end)
    const normalizedTp = root.getFirstPropertyValue('x-studieplan-tp-normalized') === '1'
    const identityMode = !fileImport && !normalizedTp && String(root.getFirstPropertyValue('prodid') || '').includes('//UiO//TP') ? 'content' : 'uid'
    const sourceAuthoritative = String(root.getFirstPropertyValue('x-studieplan-authoritative') || '').toLowerCase() !== 'false'
    warnings.push(...root.getAllProperties('x-studieplan-warning').map(property=>String(property.getFirstValue())))
    const timeEdit = /timeedit/i.test(String(root.getFirstPropertyValue('prodid') || ''))
    const cancellations = components.filter(c => !rejectedComponents.has(c) && c.getFirstPropertyValue('status') === 'CANCELLED').map(c => ({ uid: c.getFirstPropertyValue('uid'), recurrence: c.getFirstPropertyValue('recurrence-id')?.toString() || null, ...occurrenceMetadata(c.getFirstPropertyValue('uid'), c.getFirstPropertyValue('recurrence-id'), fallback) }))
    if (identityMode === 'content') warnings.push('TP lager nye ID-er ved hver henting. Økter gjenkjennes på navn og tidspunkt. Flytting til en annen dato kan vises som avlysning og ny økt; egne notater beholdes.')
    const retainedComponents = new Set()
    let filteredOccurrences = 0, rejectedOccurrences = 0
    const exceptions = components.filter(c => !rejectedComponents.has(c) && c.hasProperty('recurrence-id'))
    const consumed = new Set()
    function append(item, start, end, recurrence, explicitPeriod = false) {
      if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return
      if (!start || !end) { rejectedOccurrences++; rejectedComponents.add(item.component); skipped = true; warnings.push('En økt mangler start eller slutt og er utelatt.'); return }
      const startTime = start.isDate ? Temporal.PlainDate.from(start.toString()).toZonedDateTime(fallback).epochMilliseconds : start.toUnixTime() * 1000
      const endTime = end.isDate ? Temporal.PlainDate.from(end.toString()).toZonedDateTime(fallback).epochMilliseconds : end.toUnixTime() * 1000
      const point = !explicitPeriod && !start.isDate && endTime === startTime && !item.component.hasProperty('dtend') && !item.component.hasProperty('duration')
      if (endTime < startTime || endTime === startTime && !point) { rejectedOccurrences++; rejectedComponents.add(item.component); skipped = true; warnings.push('En økt har manglende eller ugyldig varighet og er utelatt.'); return }
      if ((point ? startTime < from : endTime <= from) || startTime >= until) { filteredOccurrences++; return }
      const sourceTitle = item.summary?.trim(), rawKind = item.component.getFirstPropertyValue('x-studieplan-activity-kind'), activityKind = fileImport && rawKind === 'personal' ? 'personal' : normalizeActivityKind(rawKind)
      const assessment = activityKind === 'exam' || activityKind === 'assessment', title = sourceTitle
      // Older TP imports used this display prefix as part of content identity.
      // Keep that identity/group input stable without changing the source title shown to students.
      const identityTitle = sourceTitle && assessment ? `Vurdering fra kilden: ${sourceTitle}` : sourceTitle
      if (!title || !item.uid) { rejectedComponents.add(item.component); skipped = true; warnings.push('En økt mangler navn eller kilde-ID og er utelatt.'); return }
      const startISO = new Date(startTime).toISOString(), endISO = new Date(endTime).toISOString()
      const publishedGroups = [...new Set(item.component.getAllProperties('x-group').map(property => String(property.getFirstValue()).trim()).filter(Boolean))]
      const explicitGroup = publishedGroups.join(', ')
      const sourceKey = identityMode === 'content' ? JSON.stringify([identityTitle, recurrence?.toString() || startISO, explicitGroup || identityTitle, item.location || '']) : JSON.stringify([item.uid, recurrence?.toString() || 'single'])
      const occurrence = occurrenceMetadata(item.uid, recurrence, fallback)
      const duplicateKey = identityMode === 'uid' && occurrence.occurrenceInstant ? JSON.stringify([item.uid, occurrence.occurrenceInstant]) : sourceKey
      const identity = JSON.stringify([item.uid, title, startISO, endISO, explicitGroup, item.location, item.description])
      retainedComponents.add(item.component)
      if (seenKeys.has(duplicateKey)) {
        if (seenKeys.get(duplicateKey) !== identity) throw new Error('Aktiviteter med samme identitet kan ikke skilles sikkert. Velg en tydeligere gruppe- eller kalenderavgrensning.')
        return
      }
      seenKeys.set(duplicateKey, identity)
      const transparent = item.component.getFirstPropertyValue('transp') === 'TRANSPARENT'
      const information = /^(?:Kommentar kort:|Undervisningsfri)/i.test(title) || assessment && transparent
      if (information && !transparent) warnings.push('Kilden har kommentar-/informasjonsoppføringer uten TRANSP. De vises som informasjon og reserverer ikke arbeidstid.')
      const groupMissing = (timeEdit || normalizedTp) && !explicitGroup
      if (groupMissing) warnings.push('Kalenderkilden mangler gruppenummer. Aktivitetstypen er ikke en gruppeidentitet. Kontroller tidspunkt og sted; øvinger velges ikke automatisk.')
      const sourceYear = Number(item.component.getFirstPropertyValue('x-course-year')), sourceSemester = item.component.getFirstPropertyValue('x-course-semester')
      const publishedTerm = Number.isInteger(sourceYear) && sourceYear >= 1900 && sourceYear <= 2200 && ['spring', 'autumn'].includes(sourceSemester) ? { year: sourceYear, semester: sourceSemester } : {}
      events.push({ sourceKey, sourceUid: item.uid, ...occurrence, title, courseId, start: startISO, end: endISO, location: item.location || '', description: item.description || '', group: explicitGroup || identityTitle, publishedGroups, activityType: item.component.getFirstPropertyValue('x-studieplan-activity-type') || '', ...(activityKind ? { activityKind } : {}), ...(groupMissing ? { groupMissing: true } : {}), ...(fileImport ? { explicitGroup: explicitGroup || '', fileCourse: { code: item.component.getFirstPropertyValue('x-course-code') || '', name: item.component.getFirstPropertyValue('x-course-name') || '', university: item.component.getFirstPropertyValue('x-university') || '', sourceObjectId: item.component.getFirstPropertyValue('x-course-source-id') || '', campus: item.component.getFirstPropertyValue('x-course-campus') || '', campusCode: item.component.getFirstPropertyValue('x-course-campus-code') || '', ...publishedTerm } } : {}), transparent, information, ...(point ? { point: true } : {}), allDay: start.isDate, cancelled: false })
      if (events.length > 5000) throw new Error('Kalenderen har over 5000 økter i semesteret. Eksporter færre emner eller grupper.')
    }
    for (const component of components.filter(c => !rejectedComponents.has(c) && !c.hasProperty('recurrence-id'))) {
      if (component.getFirstPropertyValue('status') === 'CANCELLED') continue
      if (!component.hasProperty('dtstart')) { rejectedComponents.add(component); skipped = true; warnings.push('En økt mangler starttid og er utelatt.'); continue }
      const related = exceptions.filter(c => c.getFirstPropertyValue('uid') === component.getFirstPropertyValue('uid'))
      const rejectedOverrides = [...rejectedComponents].filter(c => c.hasProperty('recurrence-id') && !invalidDates.get(c)?.includes('recurrence-id') && c.getFirstPropertyValue('uid') === component.getFirstPropertyValue('uid'))
      const overriddenByRejected = occurrence => rejectedOverrides.some(c => c.getFirstPropertyValue('recurrence-id').compare(occurrence) === 0)
      const event = new ICAL.Event(component, { exceptions: related })
      // ICAL indexes an exception by its textual recurrence ID. Add its UTC
      // alias so a UTC master also finds an exception published with TZID.
      for (const exception of related) {
        const item = new ICAL.Event(exception), recurrence = item.recurrenceId
        const canonical = recurrence.isDate ? recurrence.toString() : recurrence.convertToZone(ICAL.Timezone.utcTimezone).toString()
        if (event.exceptions[canonical] && event.exceptions[canonical].component !== exception) throw new Error('Flere unntak gjelder samme kalenderforekomst. Ingen aktiviteter er endret.')
        event.exceptions[canonical] = item
      }
      const localExceptionIds = related.map(exception => exception.getFirstPropertyValue('recurrence-id').toString()).filter(value => !value.endsWith('Z') && value.includes('T'))
      for (const id of new Set(localExceptionIds)) if (localExceptionIds.filter(value => value === id).length > 1) delete event.exceptions[id]
      if (!event.isRecurring()) { append(event, event.startDate, event.endDate); continue }
      // Reject a provably excessive, unrestricted second-by-second series before
      // doing thousands of expensive timezone conversions on the UI thread.
      // Bounded series, interval limits and recurrence exceptions still use ICAL.
      if (!component.hasProperty('exdate') && !related.length && component.getAllProperties('rrule').some(property => {
        const rule = property.getFirstValue()
        return rule.freq === 'SECONDLY' && !rule.count && !rule.until && !Object.keys(rule.parts || {}).length &&
          (until - Math.max(from, event.startDate.toUnixTime() * 1000)) / ((rule.interval || 1) * 1000) > 20000
      })) throw new Error('Gjentakelsene er for omfattende. Eksporter en kalender avgrenset til semesteret.')
      if (!component.hasProperty('rrule') && !overriddenByRejected(event.startDate) && !component.getAllProperties('exdate').flatMap(p => p.getValues()).some(date => date.compare(event.startDate) === 0)) {
        const detail = event.getOccurrenceDetails(event.startDate)
        append(detail.item, detail.startDate, detail.endDate, event.startDate)
      }
      const iterator = event.iterator()
      const endlessFileSeries = fileImport && !semester && !year && component.getAllProperties('rrule').some(property => { const rule = property.getFirstValue(); return !rule.count && !rule.until })
      if (endlessFileSeries) boundedSeries = true
      const seriesUntil = endlessFileSeries ? Math.min(until, Temporal.Instant.fromEpochMilliseconds(event.startDate.toUnixTime() * 1000).toZonedDateTimeISO(fallback).add({ months: 6 }).epochMilliseconds) : until
      const appendOccurrence = value => {
        const period = value instanceof ICAL.Period ? value : null, occurrence = period ? period.start : value
        if (overriddenByRejected(occurrence) || component.getAllProperties('exdate').flatMap(property => property.getValues()).some(date => date.compare(occurrence) === 0)) return
        const detail = event.getOccurrenceDetails(occurrence)
        if (detail.item.isRecurrenceException()) consumed.add(detail.item.component)
        append(detail.item, detail.startDate, period && !detail.item.isRecurrenceException() ? period.getEnd() : detail.endDate, occurrence, Boolean(period && !detail.item.isRecurrenceException()))
      }
      let occurrence
      while ((occurrence = iterator.next())) {
        if (++iterations > 20000) throw new Error('Gjentakelsene er for omfattende. Eksporter en kalender avgrenset til semesteret.')
        const period = occurrence instanceof ICAL.Period ? occurrence : null
        if (period) occurrence = period.start
        if (occurrence.toUnixTime() * 1000 >= seriesUntil) break
        appendOccurrence(period || occurrence)
      }
      // The rule horizon is not a cutoff for dates explicitly listed by the
      // source. Process late RDATE values directly without expanding the rule
      // across the intervening months/years.
      if (endlessFileSeries) for (const property of component.getAllProperties('rdate')) for (const value of property.getValues()) {
        const date = value instanceof ICAL.Period ? value.start : value
        if (date.toUnixTime() * 1000 < seriesUntil) continue
        if (++iterations > 20000) throw new Error('Gjentakelsene er for omfattende. Eksporter en avgrenset kalender.')
        appendOccurrence(value)
      }
    }
    // Detached or moved exceptions can fall inside the semester even when the original occurrence does not.
    for (const component of exceptions.filter(c => !consumed.has(c))) {
      const event = new ICAL.Event(component)
      append(event, event.startDate, event.endDate, event.recurrenceId)
    }
    if (floating) warnings.push(`Klokkeslett uten tidssone tolkes som ${fallback}.`)
    if (root.getAllSubcomponents('vtodo').length) warnings.push('Kalenderen inneholder gjøremål. Disse importeres ikke som undervisning; registrer eventuelle innleveringsoppgaver manuelt.')
    const accounting = { total: components.length, retained: 0, partial: 0, filtered: 0, rejected: 0, cancelled: 0, occurrences: events.length, filteredOccurrences, rejectedOccurrences }
    for (const component of components) accounting[retainedComponents.has(component) ? rejectedComponents.has(component) ? 'partial' : 'retained' : rejectedComponents.has(component) ? 'rejected' : component.getFirstPropertyValue('status') === 'CANCELLED' ? 'cancelled' : 'filtered']++
    return { accounting, period: { mode: fileImport && !semester && !year ? 'automatic' : 'filter', ...range }, events: events.sort((a, b) => a.start.localeCompare(b.start) || a.sourceKey.localeCompare(b.sourceKey)), warnings: [...new Set(warnings)], authoritative: sourceAuthoritative && !skipped && !delta && !boundedSeries, cancellations, identityMode, name: root.getFirstPropertyValue('x-wr-calname') || '', range }
  } catch (error) {
    throw new Error(`Kalenderen kunne ikke leses. ${error.message}`)
  } finally { ICAL.TimezoneService.reset() }
}
