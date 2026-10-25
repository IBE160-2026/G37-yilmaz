import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { parseDocumentCsv } from '../../src/document-parsers.js'

const fixture = name => readFileSync(new URL(`../fixtures/synthetic-tp-csv/${name}`, import.meta.url), 'utf8')
const main = fixture('main.csv')
const source = Papa.parse(main, { header: true, skipEmptyLines: 'greedy', delimiter: ';' })
const sample = source.data[0]
const titles = ['teaching-title_nb', 'teaching-title_nn', 'teaching-title_en', 'teaching-title', 'summary_nb', 'summary_nn', 'summary_en', 'summary', 'title', 'teaching-method-name']
const emptyTitles = Object.fromEntries(titles.map(field => [field, '']))
const csv = (overrides, extraFields = []) => Papa.unparse({ fields: [...source.meta.fields, ...extraFields], data: overrides.map((fields, index) => ({ ...sample, ...emptyTitles, eventid: `synthetic-case-${index}`, ...fields })) }, { delimiter: ';' })
const events = parsed => parsed.rows.filter(row => row.kind === 'event')

describe('recognized TP CSV text roles', () => {
  it('imports the full 50-column, 30-event header with row-specific fallbacks and unknown real course name', () => {
    expect(source.meta.fields).toHaveLength(50)
    expect(source.data).toHaveLength(30)
    expect(source.data.filter(row => !titles.slice(0, 4).some(field => row[field]))).toHaveLength(8)
    const parsed = parseDocumentCsv(main), rows = events(parsed)
    expect(parsed.recognizedCsv).toBe('tp')
    expect(rows).toHaveLength(30)
    expect(rows.every(row => row.selected && row.title && !row.identityAmbiguous)).toBe(true)
    expect(rows.slice(0, 22).map(row => row.title)).toEqual(Array.from({ length: 22 }, (_, index) => `Syntetisk undervisning ${String(index + 1).padStart(2, '0')}`))
    expect(rows.slice(22).map(row => row.title)).toEqual([
      'Syntetisk sammendrag bokmål', 'Syntetisk samandrag nynorsk', 'Synthetic English summary', 'Syntetisk basissammendrag',
      'Syntetisk supplerende tittel', 'Syntetisk seminar',
      'Aktivitet · SYN742 (foreløpig)', 'Aktivitet · SYN742 (foreløpig)',
    ])
    expect(rows.filter(row => row.titleStatus === 'provisional')).toHaveLength(2)
    expect(rows.every(row => row.courseName === '' && row.university === '')).toBe(true)
    const courses = parsed.rows.filter(row => row.kind === 'course')
    expect(courses).toHaveLength(1)
    expect(courses[0]).toMatchObject({ title: '', code: 'SYN742', university: '', nameStatus: 'provisional', year: 2041, semester: 'autumn' })
    expect(rows[0].description).toBe('Syntetisk beskrivelse med æ, ø og å.\n\nSyntetisk tilleggstekst, bevart som beskrivelse.')
    expect(rows.every(row => row.location === 'Syntetisk rom 42')).toBe(true)
    expect(rows.slice(28).every(row => !/lesestoff|ressursreferanse|ukjent navnerolle/.test(row.title + row.description))).toBe(true)
  })

  it('keeps language and source roles distinct without a technical column choice', () => {
    const parsed = parseDocumentCsv(csv([
      { 'teaching-title_nb': 'Bokmål', 'teaching-title_nn': 'Nynorsk', 'teaching-title_en': 'English', 'teaching-title': 'Base', summary_nb: 'Summary', title: 'Supplement' },
      { 'teaching-title_nn': 'Nynorsk', 'teaching-title_en': 'English', 'teaching-title': 'Base' },
      { 'teaching-title_en': 'English', 'teaching-title': 'Base' },
      { 'teaching-title': 'Base', summary_nb: 'Summary' },
      { summary_nb: 'Summary', summary: 'Base summary', title: 'Supplement' },
      { title: 'Supplement', 'teaching-method-name': 'Seminar' },
    ]))
    expect(events(parsed).map(row => row.title)).toEqual(['Bokmål', 'Nynorsk', 'English', 'Base', 'Summary', 'Supplement'])
    expect(events(parsed)[0].description).toBe('Summary\n\nSupplement')
    expect(events(parsed)[4].description).toBe('Supplement')
    const duplicate = events(parseDocumentCsv(csv([{ 'teaching-title_nb': 'Samme tittel', summary_nb: 'samme tittel', title: ' SAMME TITTEL ' }])))[0]
    expect(duplicate.description).toBe('')
  })

  it('retains deliberate column choice and keeps generic alias conflicts outside the recognized family', () => {
    const selected = events(parseDocumentCsv(csv([{ 'teaching-title_nb': 'Teaching', summary: 'Chosen summary' }]), { columns: { title: 'summary' } }))[0]
    expect(selected.title).toBe('Chosen summary')
    expect(() => parseDocumentCsv('summary;teaching-title;dtstart;dtend\nShort;Long;2041-11-01 10:00;2041-11-01 11:00')).toThrow('Flere CSV-kolonner')
    const generic = parseDocumentCsv('dtstart;dtend\n2041-11-01 10:00;2041-11-01 11:00')
    expect(generic.recognizedCsv).toBeUndefined()
    expect(generic.rows[0]).toMatchObject({ title: '', titleSuggestion: 'Aktivitet · 2041-11-01 10:00 (foreløpig)' })
    expect(generic.rows[0].titleStatus).toBeUndefined()
  })

  it('accepts an explicit actual course name but never marks conflicting actual names provisional', () => {
    const extra = ['coursename', 'university']
    const named = parseDocumentCsv(csv([{ 'teaching-title': 'Session', coursename: 'Syntetisk fag med faktisk navn', university: 'NTNU' }], extra))
    const course = named.rows.find(row => row.kind === 'course')
    expect(course).toMatchObject({ code: 'SYN742', title: 'Syntetisk fag med faktisk navn', university: 'NTNU' })
    expect(course.nameStatus).toBeUndefined()
    const conflicting = parseDocumentCsv(csv([
      { 'teaching-title': 'First', coursename: 'Syntetisk navn A', university: 'NTNU' },
      { 'teaching-title': 'Second', coursename: 'Syntetisk navn B', university: 'NTNU' },
    ], extra)).rows.find(row => row.kind === 'course')
    expect(conflicting).toMatchObject({ title: '', courseNameConflict: true })
    expect(conflicting.nameStatus).toBeUndefined()
  })

  it('does not derive universal identity from repeated IDs, source display text or opaque fields', () => {
    const before = events(parseDocumentCsv(main))
    const renamed = events(parseDocumentCsv(main.replace('Syntetisk undervisning 01', 'Syntetisk korrigert tittel')))
    expect(before[0].key).toBe(renamed[0].key)
    expect(before[0].explicitId).toBe('synthetic-tp-01')
    expect(before.every(row => !row.identityValidated)).toBe(true)
    const coincident = events(parseDocumentCsv(csv([{ 'teaching-title': 'Same', eventid: '', id: 'repeated' }, { 'teaching-title': 'Same', eventid: '', id: 'repeated' }])))
    expect(coincident.every(row => row.identityAmbiguous)).toBe(true)
  })
})

describe('CSV exact times and positive point evidence', () => {
  it('preserves the precise ten-second interval and does not infer a point from duration', () => {
    const precise = events(parseDocumentCsv(main))[10]
    expect(precise).toMatchObject({ startLocal: '2041-11-11T11:00:07', endLocal: '2041-11-11T11:00:17', originalStart: '2041-11-11T10:00:07Z', originalEnd: '2041-11-11T10:00:17Z', point: false })
    expect(Date.parse(precise.originalEnd) - Date.parse(precise.originalStart)).toBe(10_000)
    expect(precise.endIssues).toEqual([])
  })

  it('distinguishes marked points from equal, missing, invalid and reversed end values', () => {
    const rows = events(parseDocumentCsv(fixture('time-exceptions.csv')))
    expect(rows.map(row => row.point)).toEqual([true, false, false, false, false, false, true])
    expect(rows.map(row => row.endIssues.length > 0)).toEqual([false, true, true, true, true, false, false])
    expect(rows[1].endRaw).toBe('2041-11-02T11:00:07+01:00')
    expect(rows[2]).toMatchObject({ endRaw: '', endLocal: '' })
    expect(rows[3]).toMatchObject({ endRaw: 'syntetisk-ugyldig-tid', endLocal: '' })
    expect(rows[3].originalEnd).toBeUndefined()
    expect(rows[6]).toMatchObject({ endRaw: '', endLocal: '', originalStart: '2041-11-07T10:00:07Z' })
  })

  it.each([
    ['18. april 2039 kl. 10:00', '18. april 2039 kl. 10:00', 'true', true],
    ['18. april 2039 kl. 10:00', '', 'true', true],
    ['18. april 2039 kl. 10:00', 'syntetisk-ugyldig-tid', 'true', false],
    ['syntetisk-ugyldig-start', 'syntetisk-ugyldig-slutt', 'true', false],
    ['syntetisk-ugyldig-start', '', 'true', false],
    ['18. april 2039 kl. 10:00', '18. april 2039 kl. 10:00', 'false', false],
    ['18. april 2039 kl. 10:00', '', 'false', false],
    ['18. april 2039 kl. 10:00', '', '', false],
    ['18. april 2039 kl. 10:00', '18. april 2039 kl. 10:01', 'true', false],
  ])('requires valid instants even with the fallback date grammar (%s, %s, %s)', (start, end, marker, point) => {
    const row = parseDocumentCsv(`title;dtstart;dtend;point\nSyntetisk aktivitet;${start};${end};${marker}`).rows[0]
    expect(row.point).toBe(point)
    if (point) expect(row.originalStart).toBe('2039-04-18T08:00:00Z')
    if (marker === 'true' && end.includes('ugyldig')) expect(row.endIssues.length).toBeGreaterThan(0)
  })
})
