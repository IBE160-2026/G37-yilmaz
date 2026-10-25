import { it, expect, vi } from 'vitest'
import { parseDocumentBytes, parseDocumentCsv, parseDocumentIcs } from '../../src/document-parsers.js'
import { resolveDocumentCourses, retryDocumentCourseNames } from '../../src/document-course-resolution.js'
import { invalidateDocumentCourseName } from '../../src/document-course-identity.js'
import { createDocumentImportPreview, chooseDocumentCourse, buildDocumentImportCommit, refreshDocumentImportPreview } from '../../src/import-preview.js'
import { emptyPlanner, validPlanner } from '../../src/planner.js'
import { validImportSources } from '../../src/import-source-contract.js'
import { publicTpViewSelection, fetchPublicTpView, normalizeTpJsonEvents, parseTpCourses } from '../../server/providers/public-tp.js'
import { eventBlocksTime, osloLocal, osloLocalExact } from '../../src/planner.js'
import { recordChange, undoLast } from '../../src/history.js'

it('usability: empty/equivalent title aliases and repeated generic IDs require no technical question', () => {
  const parsed = parseDocumentCsv('id;eventid;summary;title;courseid;university;dtstart;dtend\nseries;ev-a;;Blå seminar;SYN972;UiO;2039-04-18T10:00:07+02;2039-04-18T11:00:09+02\nseries;ev-b;Neste seminar;Neste seminar;SYN972;UiO;2039-04-19T10:00:07+0200;2039-04-19T11:00:09+0200')
  const events = parsed.rows.filter(row => row.kind === 'event')
  expect(events.map(row => row.title)).toEqual(['Blå seminar', 'Neste seminar'])
  expect(events[0]).toMatchObject({ startLocal: '2039-04-18T10:00:07', originalStart: '2039-04-18T08:00:07Z' })
  expect(events.every(row => !row.identityAmbiguous)).toBe(true)
})

it('usability: the supported hyphenated teaching-method header retains its published activity type', () => {
  const csv = 'summary;teaching-method-name;dtstart;dtend\nOppdiktet aktivitet;Seminar;2039-04-18T10:00:07+02;2039-04-18T11:00:09+02'
  const event = parseDocumentCsv(csv, { columns: { title: 'summary' } }).rows[0]
  expect(event).toMatchObject({ title: 'Oppdiktet aktivitet', activityType: 'Seminar' })
  const fallback = parseDocumentCsv(csv.replace('Oppdiktet aktivitet;', ';')).rows[0]
  expect(fallback).toMatchObject({ title: 'Seminar', activityType: 'Seminar' })
})

it('usability: representative encoding sample finds Norwegian prose beyond empty metadata columns', async () => {
  const header = ['title', 'summary', 'name', 'coursename', 'courseid', 'campusname', 'emnenavn', 'navn', 'description', 'dtstart', 'dtend']
  const content = `${header.join(';')}\n;;;;;;;;Blå øvelse med ærlige spørsmål;2039-04-18 10:00;2039-04-18 11:00`
  await expect(parseDocumentBytes(buffer(Buffer.from(content, 'latin1')), { format: 'csv' })).rejects.toMatchObject({ clarification: { suggestedEncoding: 'windows-1252', sample: expect.stringContaining('Blå øvelse med ærlige spørsmål') } })
  const late = `title;dtstart;dtend\n${Array.from({ length: 8 }, (_, i) => `${i < 7 ? `SYN${i}` : 'Øvelse blå med spørsmål'};2039-04-18 10:00;2039-04-18 11:00`).join('\n')}`
  await expect(parseDocumentBytes(buffer(Buffer.from(late, 'latin1')), { format: 'csv' })).rejects.toMatchObject({ clarification: { sample: expect.stringContaining('Øvelse blå med spørsmål') } })
})

it('usability: title differences show examples, missing titles remain explicitly provisional', () => {
  try { parseDocumentCsv('summary;teaching-title;dtstart;dtend\nKort tittel;Lang forklaring;2039-04-18 10:00;2039-04-18 11:00'); throw new Error('Expected question') }
  catch (error) { expect(error.clarification.fields[0]).toMatchObject({ key: 'title', examples: [{ column: 'summary', values: ['Kort tittel'] }, { column: 'teaching-title', values: ['Lang forklaring'] }] }) }
  expect(parseDocumentCsv('summary;summary_nb;teaching-title;dtstart;dtend\n;;Oppdiktet publisert tittel;2039-04-18 10:00;2039-04-18 11:00').rows[0].title).toBe('Oppdiktet publisert tittel')
  const parsed = { ...parseDocumentCsv('dtstart;dtend\n2039-04-18 10:00;2039-04-18 11:00'), contentHash: 'a'.repeat(64) }, state = { schemaVersion: 1, tasks: [] }, preview = createDocumentImportPreview(state, parsed)
  expect(preview.rows[0]).toMatchObject({ title: '', titleSuggestion: 'Aktivitet · 2039-04-18 10:00 (foreløpig)' })
  expect(buildDocumentImportCommit(state, preview).errors[0].field).toBe('title')
  preview.rows[0].title = 'Mitt eget navn'
  const saved = buildDocumentImportCommit(state, preview)
  expect(saved.ok).toBe(true); expect(saved.source.entries[0].titleOrigin).toBe('user'); expect(saved.source.entries[0].sourceBase.title).toBe('')
})

it('usability: timestamp formats, DST and duration failures remain distinct without invented end times', () => {
  const parse = (start, end = '') => parseDocumentCsv(`title;dtstart;dtend\nOppdiktet;${start};${end}`).rows[0]
  expect(parse('2039-04-18T10:00:07.125+0200', '2039-04-18T10:00:08.125+02')).toMatchObject({ originalStart: '2039-04-18T08:00:07.125Z', originalEnd: '2039-04-18T08:00:08.125Z' })
  expect(parse('2026-10-25T02:15:07').startIssues.join(' ')).toContain('tidsomstilling')
  expect(parse('2026-03-29T02:15:07').startIssues.join(' ')).toContain('tidsomstilling')
  expect(parse('neste torsdag').startIssues.join(' ')).toContain('Datoformatet')
  const state = { schemaVersion: 1, tasks: [] }
  const commit = (start, end) => buildDocumentImportCommit(state, createDocumentImportPreview(state, { ...parseDocumentCsv(`title;dtstart;dtend\nOppdiktet;${start};${end || ''}`), contentHash: 'b'.repeat(64) }))
  expect(commit('2039-04-18 11:00', '2039-04-18 10:00').errors[0].message).toContain('Slutt må være etter start')
  const unknownEnd = commit('2039-04-18 10:00:07'); expect(unknownEnd.ok).toBe(false); expect(unknownEnd.errors[0].field).toBe('endLocal')
  expect(osloLocal('2039-04-18T08:00:07Z')).toBe('2039-04-18T10:00'); expect(osloLocalExact('2039-04-18T08:00:07Z')).toBe('2039-04-18T10:00:07')
})

const usabilityTp = () => {
  const semester = { id: '39v', year: 2039, season: 'SPRING' }
  const selected = parseTpCourses([{ id: 'SYN972', semesterid: '39v', nameNb: 'Oppdiktet gruppefag', campusid: 'SYN-CODE', term: [{ term: 1 }] }], semester, 'himolde')[0]
  const events = Array.from({ length: 8 }, (_, i) => ({ id: `activity-${i}`, eventid: `occurrence-${i}`, summary: 'Oppdiktet seminar', courseid: 'SYN972', semesterid: '39v', terminnr: 1, dtstart: `2039-04-${10 + i}T10:00:07+02`, dtend: `2039-04-${10 + i}T11:00:09+02`, status: 'active', teachingMethodName: 'Seminar', studentgroups: ['Oppdiktet publisert gruppe', ...(i === 0 ? ['Annen publisert gruppe'] : [])] }))
  return { semester, selected, events }
}
it('usability: TP groups and campus codes survive preview, exclusions, reload and update', () => {
  const { semester, selected, events } = usabilityTp()
  expect(selected).toMatchObject({ campus: '', campusCode: 'SYN-CODE' })
  const parse = (hash, input = events) => ({ ...parseDocumentIcs(normalizeTpJsonEvents({ events: input }, { institution: 'himolde', semester, selected }).calendar), contentHash: hash.repeat(64) })
  const parsed = parse('c'), state = { schemaVersion: 1, tasks: [] }, preview = createDocumentImportPreview(state, parsed)
  expect(preview.rows.filter(row => row.kind === 'event').every(row => !row.selected)).toBe(true)
  for (const row of preview.rows.filter(row => row.kind === 'event')) { row.selected = row !== preview.rows.at(-1); row.groupChoiceResolved = true }
  const first = buildDocumentImportCommit(state, preview); expect(first.ok).toBe(true); expect(first.candidate.planner.events).toHaveLength(7)
  expect(first.candidate.planner.courses[0]).toMatchObject({ university: 'himolde', campusCode: 'SYN-CODE' }); expect(first.candidate.planner.courses[0].campus).toBeUndefined()
  expect(first.candidate.planner.events[0]).toMatchObject({ publishedGroups: ['Oppdiktet publisert gruppe', 'Annen publisert gruppe'], activityType: 'Seminar' })
  const loaded = JSON.parse(JSON.stringify(first.candidate)), repeat = createDocumentImportPreview(loaded, parsed)
  expect(repeat.rows.at(-1).selected).toBe(false)
  expect(buildDocumentImportCommit(loaded, repeat).candidate.planner).toEqual(first.candidate.planner)
  const update = createDocumentImportPreview(loaded, parse('d', events.map(event => ({ ...event, summary: 'Nytt publisert aktivitetsnavn' }))))
  expect(update.sourceId).toBe(first.source.id); expect(update.rows.at(-1).selected).toBe(false)
  const saved = buildDocumentImportCommit(loaded, update); expect(saved.ok).toBe(true); expect(saved.candidate.planner.events.map(event => event.id)).toEqual(loaded.planner.events.map(event => event.id))
  expect(buildDocumentImportCommit({ ...loaded, tasks: [{ id: 'changed' }] }, update)).toMatchObject({ ok: false, stale: true })
})

it('usability: only source-qualified TP assessment markers release capacity; short CSV stays an interval', () => {
  const { semester, selected } = usabilityTp()
  const marker = { id: 'marker-one', active: true, publish: true, assessmentCode: 'SYN972', semesterid: '39v', courseid: 'SYN972', terminnr: 1, summary: 'Oppdiktet vurdering', dtstart: '2039-04-18T10:00:07+02', dtend: '2039-04-18T10:00:08+02' }
  const normalized = normalizeTpJsonEvents({ events: [marker] }, { institution: 'himolde', semester, selected })
  const tp = parseDocumentIcs(normalized.calendar).rows.find(row => row.kind === 'event')
  expect(tp).toMatchObject({ activityKind: 'assessment', transparent: true, startLocal: '2039-04-18T10:00:07', endLocal: '2039-04-18T10:00:08' }); expect(eventBlocksTime(tp)).toBe(false)
  const csv = parseDocumentCsv('summary;dtstart;dtend\nOppdiktet vurdering;2039-04-18T10:00:07+02;2039-04-18T10:00:08+02')
  expect(eventBlocksTime(csv.rows[0])).toBe(true); expect(csv.warnings.join(' ')).toContain('ikke at dette er en TP-vurderingsmarkør')
  const zero = parseDocumentIcs(normalizeTpJsonEvents({ events: [{ ...marker, dtend: marker.dtstart }] }, { institution: 'himolde', semester, selected }).calendar).rows.find(row => row.kind === 'event')
  expect(zero).toMatchObject({ point: true, endLocal: '' })
})

it('usability: malformed or long group identities cannot become invented merged groups', () => {
  for (const group of ['[""A"",42]', '[broken', 'x'.repeat(301)]) expect(() => parseDocumentCsv(`title;group;dtstart;dtend\nOppdiktet;"${group}";2039-04-18 10:00;2039-04-18 11:00`)).toThrow()
})

it('usability: unrelated CSV identifiers cannot silently overwrite an earlier source', () => {
  const state = { schemaVersion: 1, tasks: [] }
  const source = (title, day, hash) => ({ ...parseDocumentCsv(`id;summary;courseid;coursename;university;dtstart;dtend\n1;${title};SYN978;Oppdiktet fag;UiO;2039-04-${day} 10:00;2039-04-${day} 11:00`), contentHash: hash.repeat(64) })
  const first = buildDocumentImportCommit(state, createDocumentImportPreview(state, source('Første uavhengige kalender', '18', 'e')))
  const preview = createDocumentImportPreview(first.candidate, source('Annen uavhengig kalender', '19', 'f'))
  expect(preview.sourceId).not.toBe(first.source.id)
  expect(preview.warnings.join(' ')).toContain('Nummeret alene bekrefter ikke')
  const second = buildDocumentImportCommit(first.candidate, preview)
  expect(second.ok).toBe(true); expect(second.candidate.planner.events).toHaveLength(2); expect(second.candidate.planner.events[0]).toEqual(first.candidate.planner.events[0])
})

it('usability: sub-millisecond precision is explicitly unresolved instead of silently blank in browser controls', () => {
  const parsed = { ...parseDocumentCsv('summary;dtstart;dtend\nPresisjon;2039-04-18T10:00:00.123456+02;2039-04-18T11:00:00.123456789+02'), contentHash: 'b'.repeat(64) }
  expect(parsed.rows[0]).toMatchObject({ startLocal: '', startRaw: '2039-04-18T10:00:00.123456+02', startIssues: [expect.stringContaining('finere tidsnøyaktighet enn millisekunder')] })
  const state = { schemaVersion: 1, tasks: [] }, result = buildDocumentImportCommit(state, createDocumentImportPreview(state, parsed))
  expect(result.ok).toBe(false); expect(result.errors[0].message).toContain('rundes ikke automatisk')
})

it('usability: SQLite object-key reconstruction permits exact undo but true source changes still conflict', () => {
  const state = { schemaVersion: 1, tasks: [] }, parsed = { ...parseDocumentCsv('summary;dtstart;dtend\nOppdiktet historikk;2039-04-18T10:00:07+02;2039-04-18T11:00:09+02'), contentHash: 'a'.repeat(64) }
  const first = buildDocumentImportCommit(state, createDocumentImportPreview(state, parsed), { now: new Date('2039-04-01T10:00:00Z') })
  const second = buildDocumentImportCommit(first.candidate, createDocumentImportPreview(first.candidate, parsed), { now: new Date('2039-04-02T10:00:00Z') })
  const history = recordChange(first.candidate, second.candidate)
  const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)])) : value
  const fromSqlite = reverseKeys(JSON.parse(JSON.stringify(second.candidate)))
  const undo = undoLast(fromSqlite, history)
  expect(undo.ok).toBe(true); expect(undo.state).toEqual(first.candidate)
  const changed = structuredClone(fromSqlite); changed.importSources[0].entries[0].sourceBase.title = 'New real change'
  const baseline = structuredClone(changed)
  expect(undoLast(changed, history).ok).toBe(false); expect(changed).toEqual(baseline)
})

// These records and byte sequences are independently invented test data.
const text = 'type;title;start;end\nevent;Blå økt;2026-11-03 10:00;2026-11-03 11:00'
const buffer = value => Uint8Array.from(value).buffer
it('decodes BOM UTF-16 in both byte orders and requires explicit legacy selection', async () => {
  const little = Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, 'utf16le')])
  const big = Buffer.from(little); big.swap16()
  for (const bytes of [little, big]) expect((await parseDocumentBytes(buffer(bytes), { format: 'csv' })).rows[0].title).toBe('Blå økt')
  const legacy = buffer(Buffer.from(text, 'latin1'))
  await expect(parseDocumentBytes(legacy, { format: 'csv' })).rejects.toMatchObject({ clarification: { kind: 'encoding' } })
  expect((await parseDocumentBytes(legacy, { format: 'csv', encoding: 'windows-1252' })).rows[0].title).toBe('Blå økt')
  await expect(parseDocumentBytes(buffer([255, 254, 65]), { format: 'csv' })).rejects.toThrow('dekodes')
  await expect(parseDocumentBytes(buffer(new TextEncoder().encode('title\nBad\uFFFD')), { format: 'csv' })).rejects.toThrow('erstattede tegn')
  for (const encoding of ['utf-16le', 'utf-16be']) {
    const bytes = Buffer.from('title\nASCII', 'utf16le'); if (encoding === 'utf-16be') bytes.swap16()
    await expect(parseDocumentBytes(buffer(bytes), { format: 'csv' })).rejects.toMatchObject({ clarification: { kind: 'encoding' } })
    await expect(parseDocumentBytes(buffer(bytes), { format: 'csv', encoding: 'utf-8' })).rejects.toThrow('ugyldige')
    expect((await parseDocumentBytes(buffer(bytes), { format: 'csv', encoding })).rows[0].title).toBe('ASCII')
  }
})

it('retries negative lookup only explicitly and binds automatic names to identity', async () => {
  const preview = { rows: [row(), row({ code: 'MAN123', title: 'My deliberate name' })] }, api = vi.fn(async () => ({ status: 'ok', results: [] }))
  await resolveDocumentCourses(preview, { api }); await resolveDocumentCourses(preview, { api }); expect(api).toHaveBeenCalledTimes(1)
  api.mockImplementation(async () => ({ status: 'ok', results: [source()] }))
  retryDocumentCourseNames(preview); await resolveDocumentCourses(preview, { api }); expect(preview.rows[0].title).toBe('Invented public name')
  preview.rows[0].year = 2027; invalidateDocumentCourseName(preview.rows[0]); expect(preview.rows[0].title).toBe(''); expect(preview.rows[0].resolutionNote).toBeUndefined()
  preview.rows[0].year = 2026; await resolveDocumentCourses(preview, { api }); preview.rows[0].title = 'My corrected name'; preview.rows[0].code = 'OTHER843'; invalidateDocumentCourseName(preview.rows[0])
  expect(preview.rows[0].title).toBe('My corrected name'); expect(preview.rows[1].title).toBe('My deliberate name')
})

it.each(['qualified-preview', 'saved-resolver'])('usability: %s records saved-course name provenance without a network request', async path => {
  const course = { id: 'invented-saved-course', code: 'SYN978', name: 'Accepted saved name', university: 'NTNU', year: 2039, semester: 'spring', credits: null, notes: 'Keep saved note' }
  const state = { schemaVersion: 1, tasks: [], planner: { courses: [course], events: [], sources: [] } }, before = structuredClone(state)
  const parsed = { ...parseDocumentCsv(`eventid;summary;courseid;university;dtstart;dtend\ninvented-provenance;Invented event;SYN978;${path === 'qualified-preview' ? 'NTNU' : ''};2039-04-18T10:00:07+02;2039-04-18T11:00:09+02`), contentHash: '9'.repeat(64) }
  const preview = createDocumentImportPreview(state, parsed), proposal = preview.rows.find(row => row.kind === 'course'), api = vi.fn(async () => { throw new Error('Unexpected network') })
  proposal.university = 'NTNU'
  await resolveDocumentCourses(preview, { courses: state.planner.courses, api })
  const result = buildDocumentImportCommit(state, preview)
  expect(api).not.toHaveBeenCalled(); expect(result.ok).toBe(true); expect(state).toEqual(before)
  expect(result.candidate.planner.courses).toEqual([course])
  expect(result.source.entries.find(entry => entry.kind === 'course')).toMatchObject({ reference: true, titleOrigin: 'saved', targetId: course.id, sourceBase: { name: course.name } })
  const loaded = JSON.parse(JSON.stringify(result.candidate)), repeat = createDocumentImportPreview(loaded, parsed)
  await resolveDocumentCourses(repeat, { courses: loaded.planner.courses, api })
  const repeated = buildDocumentImportCommit(loaded, repeat)
  expect(repeated.ok).toBe(true); expect(api).not.toHaveBeenCalled()
  expect(repeated.candidate.planner).toEqual(result.candidate.planner)
  expect(repeated.source.entries).toEqual(result.source.entries)
})

it.each(['source', 'user', 'public', 'provisional'])('usability: an owned code-only revision retains the accepted %s name origin', origin => {
  const state = { schemaVersion: 1, tasks: [] }
  const content = name => `id;type;title;courseid;university;year;semester\ninvented-owned;course;${name};SYN978;NTNU;2039;spring`
  const initial = { ...parseDocumentCsv(content('Accepted original name')), contentHash: '6'.repeat(64) }, preview = createDocumentImportPreview(state, initial)
  preview.rows[0].titleOrigin = origin
  const first = buildDocumentImportCommit(state, preview); expect(first.ok).toBe(true)
  const revision = createDocumentImportPreview(first.candidate, { ...parseDocumentCsv(content('')), contentHash: '7'.repeat(64) }, { sourceId: first.source.id })
  const repeated = buildDocumentImportCommit(first.candidate, revision)
  expect(repeated.ok).toBe(true); expect(repeated.candidate.planner).toEqual(first.candidate.planner)
  expect(repeated.source.entries[0].titleOrigin).toBe(origin)
  expect(repeated.source.entries[0].reference).toBeUndefined()
})

it.each(['SYN-OTHER', undefined, 'syn-requested'])('usability: HiMolde name lookup qualifies requested campusCode against %s', async campusCode => {
  const item = row({ campusCode: 'SYN-REQUESTED' }), preview = { rows: [item] }
  const api = vi.fn(async () => ({ status: 'ok', results: [source({ campusCode })] }))
  await resolveDocumentCourses(preview, { api })
  expect(item.title).toBe(campusCode === 'syn-requested' ? 'Invented public name' : '')
  expect(Object.values(preview.courseLookupCache)).toEqual([item.title])
  await resolveDocumentCourses(preview, { api }); expect(api).toHaveBeenCalledTimes(1)
})

it.each(['SYN-OTHER', undefined, 'syn-requested'])('usability: NTNU details retain the selected campusCode against %s', async campusCode => {
  const item = row({ university: 'NTNU', campusCode: 'SYN-REQUESTED' }), selected = { code: item.code, university: 'NTNU', year: item.year, semester: item.semester, campusCode: item.campusCode }
  const api = vi.fn(async path => path.includes('/search?') ? { status: 'ok', results: [selected] } : { status: 'ok', course: { ...selected, campusCode, name: 'Invented qualified name' } })
  await resolveDocumentCourses({ rows: [item] }, { api })
  expect(item.title).toBe(campusCode === 'syn-requested' ? 'Invented qualified name' : '')
  expect(api).toHaveBeenCalledTimes(2)
})

it('consumes NTNU qualified search/details without accepting ambiguity or mismatched details', async () => {
  const selected = { code: 'SYN843', name: 'Invented search name', university: 'NTNU', semester: 'autumn', year: 2026, campus: 'Invented campus' }
  const run = async (results, course, failure) => {
    const preview = { rows: [row({ university: 'NTNU', campus: 'Invented campus' })] }
    const api = vi.fn(async path => { if (path.includes('/search?')) return { status: 'ok', results }; if (failure) throw failure; return { status: 'ok', course } })
    await resolveDocumentCourses(preview, { api }); return { preview, api }
  }
  const success = await run([selected], { ...selected, name: 'Invented verified NTNU' })
  expect(success.preview.rows[0].title).toBe('Invented verified NTNU'); expect(success.api).toHaveBeenCalledTimes(2)
  for (const results of [[selected, selected], [{ ...selected, year: 2027 }], [{ ...selected, campus: 'Other campus' }]]) expect((await run(results, selected)).preview.rows[0].title).toBe('')
  for (const course of [{ ...selected, year: 2027 }, { ...selected, campus: 'Other campus' }]) expect((await run([selected], course)).preview.rows[0].title).toBe('')
  for (const failure of [new Error('Invented transport failure'), new DOMException('Invented timeout', 'TimeoutError')]) {
    const result = await run([selected], null, failure); expect(result.preview.rows[0].title).toBe(''); expect(Object.keys(result.preview.courseLookupCache)).toHaveLength(0)
  }
})

const namedSource = (name, hash, identity = '') => ({ ...parseDocumentIcs(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:invented-name-conflict\r\nSUMMARY:Invented session\r\nDTSTART:20261103T090000Z\r\nX-COURSE-CODE:SYN843\r\nX-COURSE-NAME:${name}\r\nX-UNIVERSITY:HiMolde\r\n${identity}END:VEVENT\r\nEND:VCALENDAR`), contentHash: hash.repeat(64) })
it('preserves source identity through saved state, baselines, aliases and separate-source reuse', () => {
  const state = { schemaVersion: 1, tasks: [] }, parsed = namedSource('Invented identity', '1', 'X-COURSE-SOURCE-ID:SYN843¤1\r\nX-COURSE-CAMPUS:Invented North\r\n')
  const first = buildDocumentImportCommit(state, createDocumentImportPreview(state, parsed)); expect(first.ok).toBe(true)
  const loaded = JSON.parse(JSON.stringify(first.candidate)), course = loaded.planner.courses[0]
  expect(course).toMatchObject({ sourceObjectId: 'SYN843¤1', campus: 'Invented North' }); expect(loaded.importSources[0].entries[0].sourceBase).toMatchObject({ sourceObjectId: course.sourceObjectId, campus: course.campus })
  const other = structuredClone(parsed); other.contentHash = '2'.repeat(64); for (const item of other.rows) item.university = 'Høgskolen i Molde'
  expect(createDocumentImportPreview(loaded, other).rows[0].courseTarget).toBe(course.id)
  const reused = buildDocumentImportCommit(loaded, createDocumentImportPreview(loaded, other)); expect(reused.ok).toBe(true); expect(reused.candidate.planner.courses).toHaveLength(1)
  for (const item of other.rows) { item.sourceObjectId = 'SYN843¤2'; item.campus = 'Invented South' }
  expect(createDocumentImportPreview(loaded, other).rows[0].courseTarget).toBe('')
  const separate = buildDocumentImportCommit(loaded, createDocumentImportPreview(loaded, other)); expect(separate.ok).toBe(true); expect(separate.candidate.planner.courses.map(item => item.sourceObjectId)).toEqual(['SYN843¤1', 'SYN843¤2'])
  expect(JSON.parse(JSON.stringify(separate.candidate)).planner.courses[1].campus).toBe('Invented South')
  const invalid = structuredClone(loaded); invalid.planner.courses[0].sourceObjectId = { invalid: true }; expect(validPlanner(invalid.planner)).toBe(false)
  invalid.importSources[0].entries[0].sourceBase.campus = 'x'.repeat(301); expect(validImportSources(invalid.importSources)).toBe(false)
})
it('keeps owned source names and exposes local/incoming name conflicts', () => {
  const state = { schemaVersion: 1, tasks: [] }, initial = namedSource('Invented original', '3')
  const first = buildDocumentImportCommit(state, createDocumentImportPreview(state, initial)); expect(first.ok).toBe(true)
  const unchanged = createDocumentImportPreview(first.candidate, initial); expect(buildDocumentImportCommit(first.candidate, unchanged).candidate.planner.courses[0].name).toBe('Invented original')
  const changed = namedSource('Invented incoming', '4'), update = createDocumentImportPreview(first.candidate, changed, { sourceId: first.source.id })
  expect(update.rows[0].title).toBe('Invented incoming'); expect(buildDocumentImportCommit(first.candidate, update).candidate.planner.courses[0].name).toBe('Invented incoming')
  const local = structuredClone(first.candidate); local.planner.courses[0].name = 'My local name'
  const sameSourceName = createDocumentImportPreview(local, namedSource('Invented original', '5'), { sourceId: first.source.id })
  expect(buildDocumentImportCommit(local, sameSourceName).candidate.planner.courses[0].name).toBe('My local name')
  const conflict = createDocumentImportPreview(local, changed, { sourceId: first.source.id }); expect(buildDocumentImportCommit(local, conflict).ok).toBe(false)
  conflict.rows[0].conflictChoices.name = 'local'; expect(buildDocumentImportCommit(local, conflict).candidate.planner.courses[0].name).toBe('My local name')
  conflict.rows[0].conflictChoices.name = 'incoming'; expect(buildDocumentImportCommit(local, conflict).candidate.planner.courses[0].name).toBe('Invented incoming')
})
it('retains accepted code-only course names when the same source arrives with a changed byte hash', () => {
  for (const accepted of ['SYN843', 'Invented catalogue name']) {
    const state = { schemaVersion: 1, tasks: [] }, initial = namedSource('', '6')
    const draft = createDocumentImportPreview(state, initial); draft.rows[0].title = accepted
    const first = buildDocumentImportCommit(state, draft); expect(first.ok).toBe(true)
    const incoming = namedSource('', '7'), update = createDocumentImportPreview(first.candidate, incoming, { sourceId: first.source.id })
    expect(update.rows[0].title).toBe(accepted)
    const result = buildDocumentImportCommit(first.candidate, update)
    expect(result.ok).toBe(true); expect(result.candidate.planner).toEqual(first.candidate.planner)
    expect(result.source.entries.find(entry => entry.kind === 'course').sourceBase.name).toBe('')
  }
})
it('requires every ambiguous recognized field, keeps quoted delimiters and distinguishes malformed/layout errors', () => {
  expect(() => parseDocumentCsv('title;name;start;starttid\nA;B;2026-11-03 10:00;2026-11-04 11:00')).toThrow('Flere CSV-kolonner')
  const parsed = parseDocumentCsv('title;name;start;starttid\n"A; quoted";B;2026-11-03 10:00;2026-11-04 11:00', { columns: { title: 'title', start: 'starttid' } })
  expect(parsed.rows[0]).toMatchObject({ title: 'A; quoted', startLocal: '2026-11-04T11:00' })
  expect(() => parseDocumentCsv('title,name\n"unfinished')).toThrow('fullstendig')
  expect(() => parseDocumentCsv('unknown\nvalue')).toThrow('tittelkolonne')
})
const row = extra => ({ kind: 'course', selected: true, title: '', university: 'HiMolde', code: 'SYN843', semester: 'autumn', year: 2026, ...extra })
const source = (extra = {}) => ({ id: 'SYN843¤1', sourceObjectId: 'SYN843¤1', code: 'SYN843', name: 'Invented public name', term: 1, sourceUrl: 'https://tp.educloud.no/himolde/app/schedule?semester=26h&scheduleType=course&course=SYN843%C2%A41', ...extra })
it('preserves explicitly saved no-course choices on exact reimport and changed-source update', () => {
  const content = title => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:invented-no-course-reimport\r\nSUMMARY:${title}\r\nDTSTART:20261103T090000Z\r\nX-COURSE-CODE:SYN889\r\nX-UNIVERSITY:Invented University\r\nEND:VEVENT\r\nEND:VCALENDAR`
  const parsed = { ...parseDocumentIcs(content('Invented original')), contentHash: 'c'.repeat(64) }
  const state = { schemaVersion: 1, tasks: [] }, preview = createDocumentImportPreview(state, parsed)
  chooseDocumentCourse(preview, [preview.rows[1]], '')
  const first = buildDocumentImportCommit(state, preview)
  expect(first.ok).toBe(true)
  expect(first.candidate.planner.courses).toHaveLength(0)
  const reimport = createDocumentImportPreview(first.candidate, parsed)
  expect(reimport.rows[0].selected).toBe(false)
  const second = buildDocumentImportCommit(first.candidate, reimport)
  expect(second.ok).toBe(true)
  expect(second.candidate.planner).toEqual(first.candidate.planner)
  const update = createDocumentImportPreview(first.candidate, { ...parseDocumentIcs(content('Invented updated')), contentHash: 'd'.repeat(64) }, { sourceId: first.source.id })
  expect(update.rows[0].selected).toBe(false)
  const third = buildDocumentImportCommit(first.candidate, update)
  expect(third.ok).toBe(true)
  expect(third.candidate.planner.events[0]).toMatchObject({ id: first.candidate.planner.events[0].id, title: 'Invented updated', courseId: '' })
  expect(third.candidate.planner.courses).toHaveLength(0)
  // A fresh source still needs clarification; no saved decision justifies omission.
  expect(createDocumentImportPreview(state, parsed).rows[0].selected).toBe(true)
  const added = content('Invented updated').replace('END:VCALENDAR', 'BEGIN:VEVENT\r\nUID:invented-new-member\r\nSUMMARY:New unreviewed member\r\nDTSTART:20261104T090000Z\r\nX-COURSE-CODE:SYN889\r\nX-UNIVERSITY:Invented University\r\nEND:VEVENT\r\nEND:VCALENDAR')
  const withNew = createDocumentImportPreview(first.candidate, { ...parseDocumentIcs(added), contentHash: 'e'.repeat(64) }, { sourceId: first.source.id })
  expect(withNew.rows[0].selected).toBe(true)
  expect(withNew.rows.find(row => row.title === 'New unreviewed member').courseChoice).toBe('row:0')
})
it('keeps independently invented same-code source terms and campuses separate before lookup', async () => {
  const events = [1, 2].map(term => `BEGIN:VEVENT\r\nUID:invented-term-${term}\r\nSUMMARY:Invented session\r\nDTSTART:20261103T090000Z\r\nX-COURSE-CODE:SYN843\r\nX-UNIVERSITY:HiMolde\r\nX-COURSE-SOURCE-ID:SYN843¤${term}\r\nX-COURSE-CAMPUS:Invented ${term}\r\nEND:VEVENT`)
  const parsed = { ...parseDocumentIcs(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`), contentHash: 'b'.repeat(64) }
  const preview = createDocumentImportPreview({ planner: emptyPlanner(), tasks: [], importSources: [] }, parsed)
  expect(preview.rows.filter(row => row.kind === 'course')).toHaveLength(2)
  expect(preview.rows.slice(2).map(row => row.courseChoice)).toEqual(['row:0', 'row:1'])
  const results = [1, 2].map(term => source({ id: `SYN843¤${term}`, sourceObjectId: `SYN843¤${term}`, term, campus: `Invented ${term}`, name: `Invented name ${term}`, sourceUrl: source().sourceUrl.replace('%A41', `%A4${term}`) }))
  await resolveDocumentCourses(preview, { api: async () => ({ status: 'ok', results }) })
  expect(preview.rows.slice(0, 2).map(row => row.title)).toEqual(['Invented name 1', 'Invented name 2'])
})
it('saved qualified names win, explicit no-course and reselect retain consistent references', () => {
  const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:invented-linked\r\nSUMMARY:Invented\r\nDTSTART:20261103T090000Z\r\nX-COURSE-CODE:SYN843\r\nX-UNIVERSITY:HiMolde\r\nEND:VEVENT\r\nEND:VCALENDAR'
  const state = { version: 1, planner: emptyPlanner(), tasks: [], importSources: [] }, parsed = { ...parseDocumentIcs(ics), contentHash: 'a'.repeat(64) }
  state.planner.courses.push({ id: 'saved-invented', code: 'SYN843', name: 'Saved custom name', university: 'HiMolde', year: 2026, semester: 'autumn', credits: null, notes: '', description: '' })
  const preview = createDocumentImportPreview(state, parsed)
  expect(preview.rows[0]).toMatchObject({ title: 'Saved custom name', courseTarget: 'saved-invented' })
  const empty = createDocumentImportPreview({ ...state, planner: emptyPlanner() }, parsed)
  chooseDocumentCourse(empty, [empty.rows[1]], '')
  expect(empty.rows[0].selected).toBe(false)
  chooseDocumentCourse(empty, [empty.rows[1]], 'row:0')
  expect(empty.rows[0].selected).toBe(true)
  empty.rows[0].selected = false
  expect(buildDocumentImportCommit({ ...state, planner: emptyPlanner() }, empty)).toMatchObject({ ok: false, errors: [expect.objectContaining({ index: 0, field: 'selected' })] })
  empty.rows[0].title = 'My deliberate name'
  const refreshed = refreshDocumentImportPreview({ ...state, planner: emptyPlanner() }, empty)
  expect(refreshed.rows[0]).toMatchObject({ selected: false, title: 'My deliberate name' })
})
it('looks up a qualified group once, preserves ambiguity and does not send event content', async () => {
  const api = vi.fn(async () => ({ status: 'ok', results: [source()] })), preview = { rows: [row(), row()] }
  await resolveDocumentCourses(preview, { api })
  expect(api).toHaveBeenCalledTimes(1)
  expect(api.mock.calls[0][0]).toBe('/api/import/providers/himolde/teaching-search?q=SYN843&year=2026&semester=autumn')
  expect(preview.rows.every(item => item.title === 'Invented public name')).toBe(true)
  const ambiguous = { rows: [row()] }
  await resolveDocumentCourses(ambiguous, { api: async () => ({ status: 'ok', results: [source(), source({ id: 'SYN843¤2', term: 2, sourceUrl: source().sourceUrl.replace('%A41', '%A42') })] }) })
  expect(ambiguous.rows[0].title).toBe('')
  const wrongPeriod = { rows: [row()] }
  await resolveDocumentCourses(wrongPeriod, { api: async () => ({ status: 'ok', results: [source({ sourceUrl: source().sourceUrl.replace('26h', '27h') })] }) })
  expect(wrongPeriod.rows[0].title).toBe('')
})
it('retains editable drafts after transport failure and supports retry without guessing a name', async () => {
  const preview = { rows: [row(), row({ code: 'EDIT843', title: 'My choice' })] }
  await resolveDocumentCourses(preview, { api: async () => { throw new Error('invented transport failure') } })
  expect(preview.rows[0].title).toBe(''); expect(preview.rows[1].title).toBe('My choice')
  await resolveDocumentCourses(preview, { api: async () => ({ status: 'ok', results: [source()] }) })
  expect(preview.rows[0].title).toBe('Invented public name')
})
it('only recognizes exact public TP course views and derives export from verified metadata', async () => {
  const url = 'https://tp.educloud.no/uio/app/schedule?semester=26h&scheduleType=course&course=SYN843%C2%A41'
  expect(publicTpViewSelection(url)).toMatchObject({ institution: 'uio', query: { sourceObjectId: 'SYN843¤1', year: 2026, semester: 'autumn' } })
  for (const invalid of [url + '&token=synthetic', url + '&course=OTHER', url + '#secret', url.replace('scheduleType=course', 'scheduleType=person')]) expect(publicTpViewSelection(invalid)).toBeNull()
  const calls = [], fetchText = async (input, _redirects, guard) => {
    const url = new URL(input); guard?.(url); calls.push(url.href)
    if (url.pathname.endsWith('semesters.php')) return JSON.stringify([{ id: '26h', year: 2026, season: 'AUTUMN', fromdate: '2026-08-01', todate: '2026-12-31', random_int: 724, publish_timetable: true }])
    if (url.pathname.endsWith('info.php')) return JSON.stringify([{ id: 'SYN843', semesterid: '26h', nameNb: 'Invented source', term: [{ term: 1 }] }])
    if (url.pathname.endsWith('ical.php')) return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:invented-stable-id\r\nSUMMARY:Invented session\r\nDTSTART:20261103T090000Z\r\nDTEND:20261103T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR'
    throw new Error('Unexpected synthetic request')
  }
  const result = await fetchPublicTpView(url, { fetchText })
  expect(result.eventCount).toBe(1)
  const bare = await fetchPublicTpView(url.replace('%C2%A41', '') + '&filterOpen=false&summary=true&pastWeeks=false&tab=calendar', { fetchText })
  expect(bare.calendar).toBe(result.calendar)
  expect(result.calendar).toContain('invented-stable-id')
  expect(calls.some(url => url.includes('rkey=724'))).toBe(true)
  expect(calls.some(url => url.includes('/app/schedule'))).toBe(false)
})

it('CSV calendar aliases group unnamed courses and preserve times through reimport', async () => {
  const parsed = { ...parseDocumentCsv('uid;summary;courseid;dtstart;dtend;point\nsynth-991;"Øvelse; blå";SYN991;2026-11-04 10:00;2026-11-04 11:00;false\nsynth-992;Punkt;SYN991;2026-11-05 10:00;;true'), contentHash: 'a'.repeat(64) }
  expect(parsed.rows.map(row => row.kind)).toEqual(['course', 'event', 'event'])
  expect(parsed.rows[0]).toMatchObject({ title: '', code: 'SYN991', year: 2026, semester: 'autumn' })
  const state = { schemaVersion: 1, tasks: [] }, preview = createDocumentImportPreview(state, parsed)
  preview.rows[0].title = 'Godkjent foreløpig navn'
  const first = buildDocumentImportCommit(state, preview); expect(first.ok).toBe(true)
  expect(first.candidate.planner.events[0]).toMatchObject({ title: 'Øvelse; blå', start: '2026-11-04T09:00:00Z', end: '2026-11-04T10:00:00Z', courseId: first.candidate.planner.courses[0].id })
  expect(first.candidate.planner.events[1].point).toBe(true)
  const next = buildDocumentImportCommit(first.candidate, createDocumentImportPreview(first.candidate, parsed, { sourceId: first.source.id }))
  expect(next.ok).toBe(true); expect(next.candidate.planner).toEqual(first.candidate.planner)
})

it('missing context is actionable and then resolves a qualified saved course without transport', async () => {
  const preview = { rows: [row({ university: '' })] }, api = vi.fn()
  await resolveDocumentCourses(preview, { api }); expect(api).not.toHaveBeenCalled(); expect(preview.rows[0].resolutionNote).toContain('Velg lærested')
  preview.rows[0].university = 'NTNU'; preview.rows[0].courseTarget = '?'
  await resolveDocumentCourses(preview, { api, courses: [{ ...row({ university: 'NTNU' }), id: 'saved-991', name: 'Mitt godkjente navn' }] })
  expect(preview.rows[0]).toMatchObject({ courseTarget: 'saved-991', title: 'Mitt godkjente navn' }); expect(api).not.toHaveBeenCalled()
})

it('TP display flags do not permit private parameters or guessed terms', () => {
  const base = 'https://tp.educloud.no/uio/app/schedule?semester=26h&scheduleType=course&course=SYN771_8'
  expect(publicTpViewSelection(base).query).toMatchObject({ q: 'SYN771_8' }); expect(publicTpViewSelection(base).query.sourceObjectId).toBeUndefined()
  for (const suffix of ['&summary=secret', '&tab=private', '&filterOpen=true&filterOpen=false', '&token=invented', '&person=invented', '&pastWeeks=1']) expect(publicTpViewSelection(base + suffix)).toBeNull()
})

it('CSV BOM overrides a conflicting encoding choice and calendar seconds stay exact', async () => {
  const text = 'uid;summary;dtstart;dtend\nsynth-885;Blå økt;20261104T101530Z;20261104T111545Z'
  const parsed = await parseDocumentBytes(new TextEncoder().encode('\uFEFF' + text).buffer, { format: 'csv', encoding: 'windows-1252' })
  expect(parsed.rows[0]).toMatchObject({ title: 'Blå økt', originalStart: '2026-11-04T10:15:30Z', originalEnd: '2026-11-04T11:15:45Z' })
  const commit = buildDocumentImportCommit({ schemaVersion: 1, tasks: [] }, createDocumentImportPreview({ schemaVersion: 1, tasks: [] }, { ...parsed, contentHash: 'b'.repeat(64) }))
  expect(commit.ok).toBe(true); expect(commit.candidate.planner.events[0]).toMatchObject({ start: '2026-11-04T10:15:30Z', end: '2026-11-04T11:15:45Z' })
})

it('an in-flight name result cannot overwrite a later title or identity edit', async () => {
  for (const change of [item => { item.title = 'Mitt navn' }, item => { item.title = item.code }, item => { item.code = 'SYN999' }, item => { item.selected = false }, item => { item.courseTarget = 'saved-late-choice' }]) {
    const preview = { rows: [row()] }; let release
    const pending = resolveDocumentCourses(preview, { api: () => new Promise(resolve => { release = resolve }) })
    change(preview.rows[0]); release({ status: 'ok', results: [source()] }); await pending
    expect(preview.rows[0].title).not.toBe('Invented public name')
  }
})

it('CSV event identity is validated without asking about repeated activity ids', () => {
  const text = 'id;eventid;summary;dtstart;dtend\nactivity-77;event-771;First;2026-11-09 10:00;2026-11-09 11:00\nactivity-77;event-772;Second;2026-11-10 10:00;2026-11-10 11:00'
  const parsed = { ...parseDocumentCsv(text), contentHash: 'c'.repeat(64) }
  expect(parsed.rows.map(row => row.explicitId)).toEqual(['event-771', 'event-772'])
  const state = { schemaVersion: 1, tasks: [] }, first = buildDocumentImportCommit(state, createDocumentImportPreview(state, parsed))
  expect(first.ok).toBe(true); expect(new Set(first.candidate.planner.events.map(event => event.id)).size).toBe(2)
  const repeated = buildDocumentImportCommit(first.candidate, createDocumentImportPreview(first.candidate, parsed, { sourceId: first.source.id }))
  expect(repeated.ok).toBe(true); expect(repeated.candidate.planner.events).toEqual(first.candidate.planner.events)
})

it('a late failed lookup cannot replace notes after a name, identity, target or selection decision', async () => {
  for (const change of [item => { item.title = 'My accepted name' }, item => { item.code = 'SYN999' }, item => { item.selected = false }, item => { item.courseTarget = 'saved-choice' }]) {
    const preview = { rows: [row()] }; let reject
    const pending = resolveDocumentCourses(preview, { api: () => new Promise((resolve, fail) => { reject = fail }) })
    change(preview.rows[0]); preview.rows[0].resolutionNote = 'Current deliberate decision'
    reject(new Error('Invented stale failure')); await pending
    expect(preview.rows[0].resolutionNote).toBe('Current deliberate decision')
  }
})

it('CSV groups explicit and inferred years, preserves task deadlines and unresolved explicit semesters', () => {
  const parsed = { ...parseDocumentCsv('summary;courseid;dtstart;dtend;year\nFirst;SYN661;2026-11-10 10:00;2026-11-10 11:00;2026\nSecond;SYN661;2026-11-11 10:00;2026-11-11 11:00;'), contentHash: 'd'.repeat(64) }
  expect(parsed.rows.filter(row => row.kind === 'course')).toHaveLength(1)
  const state = { schemaVersion: 1, tasks: [] }, preview = createDocumentImportPreview(state, parsed); preview.rows[0].title = 'Accepted'
  const saved = buildDocumentImportCommit(state, preview); expect(saved.ok).toBe(true)
  expect(saved.candidate.planner.events.map(event => event.courseId)).toEqual([saved.candidate.planner.courses[0].id, saved.candidate.planner.courses[0].id])
  expect(parseDocumentCsv('title;start;deadline\nTask;2026-11-10 10:00;2026-11-12 12:00').rows[0]).toMatchObject({ kind: 'task', deadlineLocal: '2026-11-12T12:00' })
  const invalid = parseDocumentCsv('summary;courseid;dtstart;semester\nSession;SYN662;2026-11-10 10:00;invalid-term')
  expect(invalid.rows[0].semester).toBe(''); expect(invalid.rows[1].semester).toBe('')
  const bad = createDocumentImportPreview(state, { ...invalid, contentHash: 'e'.repeat(64) }); bad.rows[0].title = 'Accepted'
  expect(buildDocumentImportCommit(state, bad).ok).toBe(false)
})

it('NTNU lookup snapshots year through deferred search and keeps the original cache truthful', async () => {
  const item = row({ university: 'NTNU' }), preview = { rows: [item] }; let release
  const api = vi.fn(async path => {
    const query = new URL(path, 'https://synthetic.test').searchParams
    if (path.includes('/search')) return new Promise(resolve => { release = resolve })
    expect(query.get('year')).toBe('2026')
    return { status: 'ok', course: { code: 'SYN843', university: 'NTNU', year: 2026, semester: 'autumn', name: 'Original period' } }
  })
  const pending = resolveDocumentCourses(preview, { api }); item.year = 2027
  release({ status: 'ok', results: [{ code: 'SYN843', university: 'NTNU', year: 2026, semester: 'autumn' }] }); await pending
  expect(item.title).toBe(''); item.year = 2026; await resolveDocumentCourses(preview, { api })
  expect(item.title).toBe('Original period'); expect(api).toHaveBeenCalledTimes(2)
})

it('later pending row decisions survive an earlier deferred lookup and auto saved links invalidate by identity', async () => {
  const first = row(), later = row({ code: 'SYN555' }), preview = { rows: [first, later] }; let release
  const pending = resolveDocumentCourses(preview, { courses: [{ ...later, id: 'saved-later', name: 'Saved name' }], api: () => new Promise(resolve => { release = resolve }) })
  later.title = 'My edit'; release({ status: 'ok', results: [] }); await pending; expect(later.title).toBe('My edit'); expect(later.courseTarget).toBeUndefined()
  for (const deliberate of [false, true]) {
    const item = row(), saved = { ...item, id: 'saved-original', name: 'Saved name' }
    await resolveDocumentCourses({ rows: [item] }, { courses: [saved] })
    if (deliberate) { item.title = 'My new name'; item.courseTarget = 'deliberate-target' }
    item.year = 2027; invalidateDocumentCourseName(item)
    expect(item.courseTarget).toBe(deliberate ? 'deliberate-target' : ''); expect(item.title).toBe(deliberate ? 'My new name' : '')
  }
})

it('CSV retains overlap offsets, rejects ambiguous local times, and honors edited preview time', () => {
  const state = { schemaVersion: 1, tasks: [] }
  const parsed = { ...parseDocumentCsv('uid;summary;dtstart;dtend\na;Early;2026-10-25T02:15:30+02:00;2026-10-25T02:45:45+02:00\nb;Late;2026-10-25T02:15:30+01:00;2026-10-25T02:45:45+01:00'), contentHash: 'f'.repeat(64) }
  const preview = createDocumentImportPreview(state, parsed), saved = buildDocumentImportCommit(state, preview)
  expect(saved.ok).toBe(true); expect(saved.candidate.planner.events.map(event => event.start)).toEqual(['2026-10-25T00:15:30Z', '2026-10-25T01:15:30Z'])
  expect(saved.candidate.planner.events.map(event => event.end)).toEqual(['2026-10-25T00:45:45Z', '2026-10-25T01:45:45Z'])
  preview.rows[0].startLocal = '2026-10-24T12:00'
  expect(buildDocumentImportCommit(state, preview).candidate.planner.events[0].start).toBe('2026-10-24T10:00:00Z')
  const ambiguous = { ...parseDocumentCsv('summary;dtstart;dtend\nAmbiguous;2026-10-25 02:15;2026-10-25 02:45'), contentHash: '1'.repeat(64) }
  expect(buildDocumentImportCommit(state, createDocumentImportPreview(state, ambiguous)).ok).toBe(false)
})
