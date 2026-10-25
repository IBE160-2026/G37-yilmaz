import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'

const syntheticTeacher = /^Testunderviser [A-Z]+$/
const syntheticPeople = value => String(value).split(/\s*(?:,|\\n|;)\s*/).every(part => syntheticTeacher.test(part.trim()))
const populated = value => value != null && value !== '' && (!Array.isArray(value) || value.length > 0)
const schemaTypes = value => (Array.isArray(value) ? value : [value]).filter(type => typeof type === 'string')
  .map(type => type.replace(/^https?:\/\/schema\.org\//i, '').toLowerCase())
const organization = value => value && typeof value === 'object' && !Array.isArray(value)
  && schemaTypes(value['@type']).includes('organization') && !schemaTypes(value['@type']).includes('person')

// Findings deliberately contain only categories and structural indexes. Never return
// source values, arbitrary JSON keys, URLs or DOM identifiers in assertion output.
export function fixtureMetadataFindings(input, format = 'json') {
  const findings = []
  const add = (category, path) => findings.push({ category, path })
  const personalKey = /^(?:authors?|creators?|lastModifiedBy|staffnames|staff|teachers?|lecturers?|instructors?|persons?|profiles?|profileUrl|contactperson|emneansvarlig|organizer|attendees?)$/i
  const synthetic = value => Array.isArray(value) ? value.every(synthetic) : typeof value === 'string' && syntheticPeople(value)
  function json(value, path) {
    if (Array.isArray(value)) return value.forEach((child, index) => json(child, `${path}[${index}]`))
    if (value && typeof value === 'object') {
      if (schemaTypes(value['@type']).includes('person') && !synthetic(value.name)) add('person-schema', path)
      Object.entries(value).forEach(([key, child], index) => {
        const childPath = `${path}.field[${index}]`
        if (personalKey.test(key) && populated(child) && !synthetic(child) && !organization(child)) add('person-metadata', childPath)
        json(child, childPath)
      })
    } else if (typeof value === 'string') text(value, path)
  }
  function text(value, path) {
    const trimmed = value.trim()
    if (/^[\[{]/.test(trimmed)) {
      try { json(JSON.parse(trimmed), `${path}.json`); return } catch { /* ordinary text */ }
    }
    if (/<(?:html|head|body|main|section|div|p|a|script|meta|span)\b/i.test(value)) html(value, `${path}.html`)
  }
  function html(value, path) {
    const $ = cheerio.load(value)
    $('meta').each((index, node) => {
      if (/(?:^|[.:])(?:author|creator|lastmodifiedby|profile)(?:[.:]|$)/i.test($(node).attr('name') || $(node).attr('property') || '') && $(node).attr('content')?.trim()) add('html-person-metadata', `${path}.meta[${index}]`)
    })
    $('[itemtype],[itemprop],[rel]').each((index, node) => {
      const types = ($(node).attr('itemtype') || '').split(/\s+/)
      const properties = [$(node).attr('itemprop'), $(node).attr('rel')].filter(Boolean).flatMap(value => value.split(/\s+/))
      if (types.some(type => /\/Person\/?$/i.test(type)) || properties.some(property => /^(?:author|creator)$/i.test(property))) add('html-person-schema', `${path}.node[${index}]`)
    })
    $('.person, .persons, .employees-list, .researcherCard, .field--name-contact-reference-profile').each((index, node) => {
      if ($(node).text().trim() || $(node).find('img, a[href]').length) add('html-person-block', `${path}.person-block[${index}]`)
    })
    $('script').each((index, node) => text($(node).html() || '', `${path}.script[${index}]`))
    $('*').each((index, node) => {
      Object.entries(node.attribs || {}).forEach(([key, child], attributeIndex) => {
        if (/^data-(?:author|creator|person|profile)$/i.test(key) && child.trim()) add('html-person-attribute', `${path}.node[${index}].attribute[${attributeIndex}]`)
        if (key.startsWith('data-')) text(child, `${path}.node[${index}].attribute[${attributeIndex}]`)
      })
    })
  }
  if (format === 'html') html(input, '$')
  else json(input, '$')
  return findings
}

export function xmlPersonMetadataFindings(xml) {
  return /(?:\b(?:author|initials)\s*=|<(?:\w+:)?(?:creator|lastModifiedBy|comments?|ins|del|customXml|object)\b)/i.test(xml)
    ? [{ category: 'document-person-metadata', path: 'xml.metadata' }] : []
}

export function fixtureIcsEvents(source) {
  const events = []
  let event
  for (const line of source.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    if (/^BEGIN:VEVENT$/i.test(line)) event = {}
    else if (/^END:VEVENT$/i.test(line)) { events.push(event); event = null }
    else if (event) {
      const colon = line.indexOf(':')
      if (colon < 0) continue
      const name = line.slice(0, colon).split(';')[0].toUpperCase()
      event[name] ??= []
      event[name].push(line.slice(colon + 1))
    }
  }
  return events
}

export function calendarTextContract(source) {
  // Include every occurrence and segment, including empty fields. Only complete
  // synthetic person labels are normalized; a prefixed/suffixed residue remains.
  const projection = fixtureIcsEvents(source).map(event => Object.fromEntries(
    ['SUMMARY', 'DESCRIPTION', 'LOCATION', 'X-ALT-DESC'].filter(field => event[field]).map(field => [field,
      event[field].map(value => value.split(/(\\n|\\,|,)/).map(part =>
        /^\s*Testunderviser [A-Z]+\s*$/.test(part) ? part.replace(/Testunderviser [A-Z]+/, 'Testunderviser SYNTHETIC') : part).join('')),
    ]),
  ))
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex')
}

export function calendarTextContractFindings(source, expectedDigest) {
  return calendarTextContract(source) === expectedDigest ? [] : [{ category: 'calendar-text-contract', path: 'events.text-properties' }]
}

// These are source-specific contracts, not a universal detector for human names.
// Validate complete person-bearing segments, not a match inside a longer string.
export function calendarPersonFindings(source, kind) {
  const findings = []
  const add = (event, field, segment, category = 'calendar-person-segment') => findings.push({ category, path: `event[${event}].${field}[${segment}]` })
  const initialName = /^(?:\p{Lu}\.\s*)+\s*\p{Lu}[\p{L}'’-]+/u
  const fullName = /^[\p{Lu}][\p{Ll}'’-]+(?:\s+[\p{Lu}][\p{Ll}'’-]+){1,5}$/u
  const logicalLines = source.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  if (logicalLines.some(line => /^[^:]*;CN=/i.test(line))) findings.push({ category: 'calendar-person-parameter', path: 'properties.parameters' })
  // Person metadata may occur at calendar level or in VTODO/other components.
  // The bounded X-property names are metadata roles, not a blacklist of names.
  logicalLines.forEach((line, index) => {
    const match = /^(ORGANIZER|ATTENDEE|CONTACT|X-(?:TEACHER|LECTURER|INSTRUCTOR|AUTHOR|STAFF))(?:;[^:]*)?:(.*)$/i.exec(line)
    if (match && match[2].trim() && (!/^X-/i.test(match[1]) || !syntheticPeople(match[2]))) findings.push({ category: 'calendar-person-property', path: `properties[${index}]` })
  })
  fixtureIcsEvents(source).forEach((event, index) => {
    for (const field of ['ORGANIZER', 'ATTENDEE', 'CONTACT']) if (event[field]?.some(populated)) add(index, field, 0, 'calendar-person-property')
    for (const [field, values] of Object.entries(event)) values.forEach((value, occurrence) => {
      if (!['SUMMARY', 'DESCRIPTION', 'LOCATION'].includes(field)) return
      const parts = value.split(/\\n|\\,/)
      parts.forEach((raw, segment) => {
        const part = raw.trim()
        const at = occurrence * 1000 + segment
        // A synthetic label followed by copied prose is still a regression.
        if (/Testunderviser/.test(part) && !syntheticPeople(part) && !/^Forelesning Testunderviser [A-Z]+$/.test(part) && !/^INF100 Forelesning Testunderviser [A-Z]+$/.test(part)) add(index, field, at, 'mixed-synthetic-person-segment')
        if (field === 'DESCRIPTION' && ['hvl', 'nmbu', 'mf'].includes(kind)) {
          if (part && !syntheticTeacher.test(part) && !/^ID \d+$/.test(part) && !/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2} - \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(part)) add(index, field, at)
        }
        if (kind === 'nmbu' && field === 'SUMMARY' && segment > 0 && !syntheticTeacher.test(part)) add(index, field, at)
        if (kind === 'nih' && field === 'SUMMARY' && fullName.test(part) && !syntheticTeacher.test(part) && !(event.LOCATION || []).some(location => location.split(/\\,/).map(s => s.trim()).includes(part))) add(index, field, at)
        if (kind === 'uib' && field === 'DESCRIPTION' && initialName.test(part)) add(index, field, at)
      })
      // UiT lists staff in the third newline segment for lectures, labs and
      // independent work alike; commas separate people inside that segment.
      if (kind === 'uit' && field === 'DESCRIPTION') {
        const staff = value.split('\\n')[2]?.trim()
        if (staff && !syntheticPeople(staff)) add(index, field, occurrence * 1000 + 2)
      }
    })
  })
  return findings
}
