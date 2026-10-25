import { expect, it } from 'vitest'
import { parseDocumentCsv, parseDocumentIcs } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, refreshDocumentImportPreview } from '../../src/import-preview.js'
import { eventBlocksTime, validateEvent } from '../../src/planner.js'

// All inputs are invented, without external services or saved user state.
const empty = () => ({ schemaVersion: 1, tasks: [] })
const csv = (text, hash = 'a') => ({ ...parseDocumentCsv(text), contentHash: hash.repeat(64) })
const ics = (text, hash = 'a') => ({ ...parseDocumentIcs(text), contentHash: hash.repeat(64) })
const qualifiedCalendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:invented-qualified-cancellation', 'SUMMARY:Oppdiktet seminar', 'DTSTART:20390418T080007Z', 'DTEND:20390418T090009Z', 'X-COURSE-CODE:SYN981', 'X-COURSE-NAME:Oppdiktet emne', 'X-UNIVERSITY:uio', 'X-COURSE-SOURCE-ID:SYN981-variant', 'X-COURSE-CAMPUS-CODE:SYN-CAMPUS', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')

it('review: qualified cancellation after reload retains identity scope and releases the same event', () => {
  const before = empty(), first = buildDocumentImportCommit(before, createDocumentImportPreview(before, ics(qualifiedCalendar)))
  expect(first.ok).toBe(true)
  const loaded = JSON.parse(JSON.stringify(first.candidate)), entry = loaded.importSources[0].entries.find(entry => entry.kind === 'event'), event = loaded.planner.events[0]
  expect(entry.identityScope).toBeTruthy(); expect(eventBlocksTime(event)).toBe(true)
  const cancellation = ics('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:CANCEL\r\nBEGIN:VEVENT\r\nUID:invented-qualified-cancellation\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR', 'b')
  const preview = createDocumentImportPreview(loaded, cancellation, { sourceId: first.source.id })
  expect(preview.rows[0]).toMatchObject({ identityScope: entry.identityScope, identityValidated: true, matchEntryKey: entry.key, targetId: event.id })
  const result = buildDocumentImportCommit(loaded, preview)
  expect(result.ok).toBe(true); expect(result.candidate.planner.events).toEqual([{ ...event, cancelled: true }])
  expect(eventBlocksTime(result.candidate.planner.events[0])).toBe(false)
  expect(result.source.entries.find(item => item.kind === 'event').identityScope).toBe(entry.identityScope)
})

it.each([['csv', 'ordinary'], ['csv', 'transparent'], ['ics', 'ordinary'], ['ics', 'transparent'], ['ics', 'information']])('review: a %s point given duration follows its explicit %s semantics', (format, semantics) => {
  const transparent = semantics === 'transparent'
  const parsed = format === 'csv' ? csv(`summary;dtstart;dtend;transparent;point\nOppdiktet punkt;2039-04-18T10:00:07+02;;${transparent};true`) : ics(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:invented-point\r\nSUMMARY:${semantics === 'information' ? 'Kommentar kort: ' : ''}Oppdiktet punkt\r\nDTSTART:20390418T080007Z\r\n${transparent ? 'TRANSP:TRANSPARENT\r\n' : ''}END:VEVENT\r\nEND:VCALENDAR`)
  const state = empty(), preview = createDocumentImportPreview(state, parsed)
  expect(preview.rows[0].point).toBe(true)
  const point = buildDocumentImportCommit(state, preview)
  expect(point.ok).toBe(true); expect(eventBlocksTime(point.candidate.planner.events[0])).toBe(false)
  const edited = validateEvent({ title: preview.rows[0].title, courseId: '', startLocal: '2039-04-18T10:00:07', endLocal: '2039-04-18T11:00:09' }, point.candidate.planner.events[0])
  expect(eventBlocksTime(edited)).toBe(semantics === 'ordinary')
  preview.rows[0].endLocal = '2039-04-18T11:00:09'
  const result = buildDocumentImportCommit(state, preview)
  expect(result.ok).toBe(true)
  const event = result.candidate.planner.events[0]
  expect(event).toMatchObject({ point: false, end: '2039-04-18T09:00:09Z', transparent })
  expect(Date.parse(event.start)).toBe(Date.parse('2039-04-18T08:00:07Z'))
  expect(eventBlocksTime(event)).toBe(semantics === 'ordinary')
})

it('review: later CSV course names fill missing names but conflicting names require clarification', () => {
  const content = names => ['eventid;summary;courseid;coursename;university;dtstart;dtend', ...names.map((name, index) => `invented-${index};Oppdiktet aktivitet ${index};SYN982;${name};UiO;2039-04-18T10:00:07+02;2039-04-18T11:00:09+02`)].join('\n')
  const later = csv(content(['', 'Oppdiktet navn', 'Oppdiktet navn']))
  expect(later.rows.filter(row => row.kind === 'course')).toMatchObject([{ title: 'Oppdiktet navn' }])
  const conflicting = csv(content(['Første publiserte navn', 'Annet publisert navn', 'Første publiserte navn']))
  expect(conflicting.rows.filter(row => row.kind === 'course')).toMatchObject([{ title: '', courseNameConflict: true }])
  expect(conflicting.warnings.join(' ')).toContain('forskjellige navn')
  const state = empty(), preview = createDocumentImportPreview(state, conflicting)
  expect(buildDocumentImportCommit(state, preview).ok).toBe(false)
  preview.rows[0].title = 'Navn avklart av studenten'; preview.rows[0].titleOrigin = 'user'
  const result = buildDocumentImportCommit(state, preview)
  expect(result.ok).toBe(true); expect(result.candidate.planner.courses[0].name).toBe('Navn avklart av studenten')
})

it.each(['campus', 'campusCode', 'sourceObjectId'])('review: explicit CSV course rows retain %s and cannot suppress another qualified proposal', qualifier => {
  const column = { campus: 'campus', campusCode: 'campuscode', sourceObjectId: 'sourceobjectid' }[qualifier]
  const content = `id;type;title;courseid;coursename;university;year;semester;${column};dtstart;dtend\ncourse-a;course;Oppdiktet A;SYN983;;uio;2039;spring;FIRST;;\nevent-b;event;Oppdiktet aktivitet;SYN983;Oppdiktet B;uio;2039;spring;SECOND;2039-04-18T10:00:07+02;2039-04-18T11:00:09+02`
  const parsed = csv(content), courses = parsed.rows.filter(row => row.kind === 'course')
  expect(courses).toHaveLength(2)
  expect(courses.find(row => row.title === 'Oppdiktet A')[qualifier]).toBe('FIRST')
  expect(courses.find(row => row.title === 'Oppdiktet B')[qualifier]).toBe('SECOND')
  const same = parseDocumentCsv(content.replace('SECOND', 'FIRST').replace('Oppdiktet B', 'Oppdiktet A'))
  expect(same.rows.filter(row => row.kind === 'course')).toHaveLength(1)
  const state = empty(), result = buildDocumentImportCommit(state, createDocumentImportPreview(state, parsed))
  expect(result.ok).toBe(true); expect(result.candidate.planner.courses).toHaveLength(2)
  expect(result.candidate.planner.events[0].courseId).toBe(result.candidate.planner.courses.find(course => course[qualifier] === 'SECOND').id)
})

it('review: uploading a revision records file origin without losing safe identity or local notes', () => {
  const state = empty(), linked = { ...ics(qualifiedCalendar), fileName: 'Kalenderlenke – øyeblikksbilde', origin: { kind: 'link', publicUrl: 'https://tp.educloud.no/uio/app/schedule?semester=39v&scheduleType=course&course=SYN981' } }
  const first = buildDocumentImportCommit(state, createDocumentImportPreview(state, linked))
  expect(first.ok).toBe(true)
  const loaded = JSON.parse(JSON.stringify(first.candidate)); loaded.planner.events[0].notes = 'Behold mitt notat'
  const revised = { ...ics(qualifiedCalendar.replace('Oppdiktet seminar', 'Revidert seminar'), 'b'), fileName: 'invented-upload.ics' }
  const preview = createDocumentImportPreview(loaded, revised, { sourceId: first.source.id })
  expect(preview.origin).toEqual({ kind: 'file' })
  const result = buildDocumentImportCommit(loaded, preview)
  expect(result.ok).toBe(true); expect(result.source).toMatchObject({ id: first.source.id, origin: { kind: 'file' }, name: 'invented-upload.ics' })
  expect(result.candidate.planner.events).toEqual([{ ...loaded.planner.events[0], title: 'Revidert seminar' }])
})

it('review: ambiguity examples come from the actual later conflicting row', () => {
  const rows = ['title;name;dtstart;dtend', ...Array.from({ length: 4 }, (_, index) => `Lik tekst ${index};Lik tekst ${index};2039-04-18T10:00;2039-04-18T11:00`), 'Kalendertekst A;Kalendertekst B;2039-04-18T10:00;2039-04-18T11:00']
  let failure
  try { parseDocumentCsv(rows.join('\n')) } catch (error) { failure = error }
  expect(failure?.clarification.fields[0].examples).toEqual([{ column: 'title', values: ['Kalendertekst A'] }, { column: 'name', values: ['Kalendertekst B'] }])
})

it.each([
  ['valid', '2039-04-18T10:00:07.125+02:00', '2039-04-18T10:00:07.125', ''],
  ['malformed', 'not-a-calendar-time', '', 'Datoformatet kunne ikke leses'],
  ['invalid date', '2039-02-30T10:00', '', 'Dato eller klokkeslett er ugyldig'],
  ['ambiguous Oslo time', '2026-10-25T02:30', '', 'tvetydig ved tidsomstilling'],
])('review: repeated %s CSV timestamps keep independent values and issues within and across parses', (_label, raw, local, issue) => {
  const content = `id;title;dtstart;dtend\none;Oppdiktet første;${raw};${raw}\ntwo;Oppdiktet andre;${raw};${raw}`
  const parsed = parseDocumentCsv(content), originals = structuredClone(parsed.rows)
  expect(parsed.rows).toHaveLength(2)
  for (const row of parsed.rows) {
    expect(row).toMatchObject({ startRaw: raw, endRaw: raw, startLocal: local, endLocal: local })
    if (issue) { expect(row.startIssues.join(' ')).toContain(issue); expect(row.endIssues.join(' ')).toContain(issue) }
    else { expect(row.startIssues).toEqual([]); expect(row.endIssues.join(' ')).toContain('punktmarkør') }
  }
  expect(new Set(parsed.rows.flatMap(row => [row.startIssues, row.endIssues])).size).toBe(4)
  parsed.rows[0].startIssues.push('Oppdiktet lokal merknad')
  parsed.rows[0].startRaw = 'Endret lokalt'; parsed.rows[0].startLocal = '2039-04-19T12:00'
  expect(parsed.rows[0].endIssues).toEqual(originals[0].endIssues)
  expect(parsed.rows[1]).toEqual(originals[1])
  expect(parseDocumentCsv(content).rows).toEqual(originals)
})

it('review: CSV timestamp reuse preserves distinct explicit offsets and exact milliseconds', () => {
  const first = 'first;Oppdiktet første;2026-10-25T02:30:07.125+02:00;2026-10-25T02:45:09.875+02:00'
  const second = 'second;Oppdiktet andre;2026-10-25T02:30:07.875+01:00;2026-10-25T02:45:09.125+01:00'
  const rows = parseDocumentCsv(['id;title;dtstart;dtend', first, second, first.replace('first;', 'third;')].join('\n')).rows
  expect(rows.map(row => [row.originalStart, row.originalEnd])).toEqual([
    ['2026-10-25T00:30:07.125Z', '2026-10-25T00:45:09.875Z'],
    ['2026-10-25T01:30:07.875Z', '2026-10-25T01:45:09.125Z'],
    ['2026-10-25T00:30:07.125Z', '2026-10-25T00:45:09.875Z'],
  ])
  expect(rows.map(row => [row.startLocal, row.endLocal])).toEqual([
    ['2026-10-25T02:30:07.125', '2026-10-25T02:45:09.875'],
    ['2026-10-25T02:30:07.875', '2026-10-25T02:45:09.125'],
    ['2026-10-25T02:30:07.125', '2026-10-25T02:45:09.875'],
  ])
  expect(rows[0].startRaw).toBe('2026-10-25T02:30:07.125+02:00')
  expect(rows[1].startRaw).toBe('2026-10-25T02:30:07.875+01:00')
  expect(rows.every(row => !row.startIssues.length && !row.endIssues.length)).toBe(true)
})

it('review: cumulative exclusions reject over 5000 explicitly without mutation and allow a smaller update', () => {
  const revision = (batch, size) => csv(['id;title;dtstart;dtend', ...Array.from({ length: size }, (_, index) => `${batch}-${index};Oppdiktet ${batch}-${index};2039-04-18T10:00;2039-04-18T11:00`)].join('\n'), String(batch))
  let state = empty()
  for (let batch = 1; batch <= 5; batch++) {
    const preview = createDocumentImportPreview(state, revision(batch, 900), { sourceId: state.importSources?.[0].id })
    for (const row of preview.rows) row.selected = row.index === 0
    const result = buildDocumentImportCommit(state, preview)
    expect(result.ok).toBe(true); state = JSON.parse(JSON.stringify(result.candidate))
  }
  expect(state.importSources[0].excludedKeys).toHaveLength(4495)
  const before = structuredClone(state), preview = createDocumentImportPreview(state, revision(6, 900), { sourceId: state.importSources[0].id })
  for (const row of preview.rows) row.selected = row.index === 0
  const rejected = buildDocumentImportCommit(state, preview)
  expect(rejected.ok).toBe(false); expect(rejected.error).toContain('5000'); expect(rejected.error).toContain('Avgrens')
  expect(state).toEqual(before)
  const bounded = createDocumentImportPreview(state, revision(6, 500), { sourceId: state.importSources[0].id })
  for (const row of bounded.rows) row.selected = row.index === 0
  const accepted = buildDocumentImportCommit(state, bounded)
  expect(accepted.ok).toBe(true); expect(accepted.source.excludedKeys).toHaveLength(4994)
  expect(accepted.source.excludedKeys.slice(0, before.importSources[0].excludedKeys.length)).toEqual(before.importSources[0].excludedKeys)
  expect(accepted.candidate.planner.events.slice(0, 5)).toEqual(before.planner.events)
})

it('review: equivalent start aliases retain calendar classification when a deadline is also present', () => {
  const parsed = parseDocumentCsv('title;start;dtstart;dtend;deadline\nOppdiktet aktivitet;2039-04-18T10:00;2039-04-18T10:00;2039-04-18T11:00;2039-04-20T12:00')
  expect(parsed.rows[0]).toMatchObject({ kind: 'event', startLocal: '2039-04-18T10:00', endLocal: '2039-04-18T11:00' })
})

it('review: explicit provisional-title approval survives refresh and commit', () => {
  const state = empty(), parsed = csv('dtstart;dtend\n2039-04-18T10:00;2039-04-18T11:00'), preview = createDocumentImportPreview(state, parsed)
  preview.rows[0].title = preview.rows[0].titleSuggestion; preview.rows[0].titleOrigin = 'provisional'
  const refreshed = refreshDocumentImportPreview(state, preview)
  expect(refreshed.rows[0]).toMatchObject({ title: 'Aktivitet · 2039-04-18 10:00 (foreløpig)', titleOrigin: 'provisional' })
  const result = buildDocumentImportCommit(state, refreshed)
  expect(result.ok).toBe(true); expect(result.source.entries[0]).toMatchObject({ titleOrigin: 'provisional', sourceBase: { title: '' } })
})
