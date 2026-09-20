import { createHash } from 'node:crypto'
import { clean, fail, asCredits } from './program-source.js'

export const sourceEdition = html => `side-${createHash('sha256').update(html).digest('hex').slice(0, 16)}`
export function studentCohort(query) {
  if (query.cohortFromStudent !== 'true' || !/^\d{4}$/.test(String(query.cohort)) || +query.cohort < 1900 || +query.cohort > 2200) fail('invalid-selection', 'Denne programkilden bekrefter ikke opptakskull. Oppgi ditt eget kull uttrykkelig og kontroller at den gjeldende planen gjelder deg.')
  return String(query.cohort)
}
export const unknownPeriod = number => ({ id: String(number), studySemester: number, year: null, semester: null, label: `${number}. studiesemester · avklar kalendersemester`, courses: [], requirements: [] })
export const textWithSpaces = ($, node) => { const copy = $(node).clone(); copy.find('br').replaceWith(' '); return clean(copy.text()) }

// Only source links delimit courses; prose such as "valgfritt emne" is kept as
// a requirement, never converted into an invented course or deadline.
export function coursesFromLinks($, node, { sourceUrl, courseUrl, institution, university, scope, number, mandatory = false }) {
  const copy = $(node).clone(), records = [], warnings = [], seen = new Set(), rawNotes = textWithSpaces($, node), notes = rawNotes.slice(0, 11500)
  if (rawNotes.length > notes.length) warnings.push('Kildens lange studieplanutdrag er forkortet før forhåndsvisning og lagring. Kontroller den publiserte kilden for resten av teksten.')
  copy.find('br').replaceWith('\n')
  copy.find('a[href]').each((_, link) => {
    let url
    try { url = courseUrl(new URL($(link).attr('href'), sourceUrl)) } catch { return }
    const label = clean($(link).text())
    if (!label) { $(link).remove(); return }
    const index = records.length, precedingText = clean(link.prev?.data || $(link).prev().text())
    records.push({ url, label, precedingText }); $(link).replaceWith(`\n[[course:${index}]]${label}`)
  })
  const text = copy.text(), sections = [...text.matchAll(/\[\[course:(\d+)\]\]([\s\S]*?)(?=\[\[course:\d+\]\]|$)/g)]
  const courses = []
  for (const [index, section] of sections.entries()) {
    const record = records[Number(section[1])], segment = clean(section[2])
    if (seen.has(record.url.href)) continue
    seen.add(record.url.href)
    const labelCode = record.label.match(/^([A-ZÆØÅ]{2,}[\d-][A-Z\d_-]*)(?:\s|$)/)?.[1] || (/^[A-ZÆØÅ]{2,}\d+[A-Z]?$/i.test(record.label) ? record.label.toUpperCase() : '')
    const code = labelCode || ''
    const creditsMatch = segment.match(/\(?\b(\d+(?:[.,]\d+)?)\s*(?:stp\.?|studiepoeng|ECTS)\b/i)
    const credits = creditsMatch ? asCredits(creditsMatch[1]) : null
    const textName = (code ? segment.slice(segment.toUpperCase().indexOf(code.toUpperCase()) + code.length) : record.label).replace(/\(?\b\d+(?:[.,]\d+)?\s*(?:stp\.?|studiepoeng)(?:\s*\/\s*ECTS)?\)?/ig, '').replace(/\s*\beller\s*$/i, '').trim()
    const name = textName || record.label
    const ownLine = clean(String(section[2]).split(/\r?\n/, 1)[0])
    const previousTail = String(sections[index - 1]?.[2] || '').split(/\r?\n/).map(clean).filter(Boolean).at(-1) || ''
    const optional = /\beller\b/i.test(String(section[2])) || /\b(?:valgfri(?:tt)?\s+emne|valgemne)\b/i.test(ownLine) || /(?:^|[:;]\s*)\b(?:valgfri(?:tt)?\s+emne|valgemne)\b\s*:?$/i.test(record.precedingText) || /^eller$/i.test(record.precedingText) || /^eller$/i.test(previousTail)
    const recordId = decodeURIComponent(record.url.pathname).replace(/^\/+|\/+$/g, '')
    const notesText = `Kildeutdrag: ${notes}${code ? '' : ' Emnekode er ikke oppgitt i denne lenketeksten.'}`
    courses.push({ id: `${institution}:${scope}:${number}:${recordId}`, code, name, credits, choice: optional ? 'V' : mandatory ? 'O' : '', sourceProvider: institution, sourceRecordId: recordId, sourceVersion: scope, sourceUrl: record.url.href, university, description: '', notes: notesText, year: null, semester: null, campus: '' })
    if (!code) warnings.push(`${record.label}: emnekoden må kontrolleres i emnekilden; lenkens navn er beholdt.`)
  }
  return { courses, warnings, text: notes }
}
