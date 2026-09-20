import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { parseDocumentText, parseDocumentCsv, parseDocumentDate, parseDocumentIcs, guardDocxArchive, parseDocumentBytes } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit } from '../../src/import-preview.js'
import { validImportSources } from '../../src/import-source-contract.js'

const empty = () => ({ schemaVersion: 1, tasks: [] })
const hash = 'a'.repeat(64)
const preview = (state, parsed, options = {}) => createDocumentImportPreview(state, { ...parsed, contentHash: hash }, options)
const csv = text => parseDocumentCsv(text)
const commit = (state, p) => buildDocumentImportCommit(state, p, { now: new Date('2026-09-09T09:00:00Z') })
function zip(parts, { dishonest = false } = {}) {
  const locals = [], entries = []; let offset = 0
  for (const [name, content] of Object.entries(parts)) {
    const filename = Buffer.from(name), raw = Buffer.from(content), data = deflateRawSync(raw), local = Buffer.alloc(30), central = Buffer.alloc(46)
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(dishonest ? 1 : raw.length, 22); local.writeUInt16LE(filename.length, 26)
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(dishonest ? 1 : raw.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42)
    locals.push(local, filename, data); entries.push(central, filename); offset += local.length + filename.length + data.length
  }
  const central = Buffer.concat(entries), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(parts).length, 8); end.writeUInt16LE(Object.keys(parts).length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16)
  const buffer = Buffer.concat([...locals, central, end]); return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length)
}
const docxParts = {
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Innlevering 1, frist 2026-09-16 kl. 14:00</w:t></w:r></w:p></w:body></w:document>',
}

describe('local document parsing without invented precision', () => {
  it.each(['16.09', '16.09.2026', '09/10/2026 12:00', '2026-02-30T12:00'])('leaves unresolved date %s without a invented deadline', raw => {
    expect(parseDocumentDate(raw).value).toBe(''); expect(parseDocumentDate(raw).issues.length).toBeGreaterThan(0)
  })
  it('parses complete dates and converts explicitly offset dates to Oslo', () => {
    expect(parseDocumentDate('16.09.2026 kl. 14:00').value).toBe('2026-09-16T14:00')
    expect(parseDocumentDate('2026-09-16T12:00:00Z').value).toBe('2026-09-16T14:00')
  })
  it('recognizes Norwegian month names while requiring missing years and unclear deadline expressions to be resolved', () => {
    expect(parseDocumentDate('14. september 2026 kl. 12:00').value).toBe('2026-09-14T12:00')
    expect(parseDocumentDate('14.sep. 2026 12:00').value).toBe('2026-09-14T12:00')
    const state = empty(), parsed = parseDocumentText('Innlevering 14. september kl. 12:00\nSkriv rapport, frist før neste seminar\nLes pensum'), p = preview(state, parsed)
    expect(p.rows[0].deadlineIssues).toContain('Datoen mangler et entydig år eller datoformat.')
    expect(p.rows.slice(0, 2).map(row => row.deadlineMode)).toEqual(['?', '?'])
    expect(p.rows[2].deadlineMode).toBe('none')
    expect(commit(state, p).ok).toBe(false)
    p.rows[0].deadlineMode = 'value'; p.rows[0].deadlineLocal = '2026-09-14T12:00'; p.rows[1].deadlineMode = 'none'
    expect(commit(state, p).ok).toBe(true)
    expect(parseDocumentText('Forelesning 14. september 2026 kl. 12:00–14:00').rows[0]).toMatchObject({ startLocal: '2026-09-14T12:00', endLocal: '2026-09-14T14:00' })
  })
  it('retains source positions, missing data, unknown lines and empty estimates', () => {
    const parsed = parseDocumentText('Emne: IBE160 – Programmering\nInnlevering 1 frist 16.09\nBakgrunnstekst uten planhandling')
    expect(parsed.rows.map(r => r.kind)).toEqual(['course', 'task', 'task'])
    expect(parsed.rows[0]).toMatchObject({ year: '', semester: '', position: 'Linje 1' })
    expect(parsed.rows[1]).toMatchObject({ deadlineLocal: '', remainingMinutes: null, courseHint: 'IBE160' })
    expect(parsed.rows[2].selected).toBe(false)
  })
  it('handles BOM, semicolon, quoted multiline CSV and marks unknown columns', () => {
    const parsed = csv('\uFEFFid;tittel;frist;minutter;kommentar\r\n1;"Les, skriv\nog lever";2026-09-16T14:00;0;Ekstra')
    expect(parsed.rows[0]).toMatchObject({ title: 'Les, skriv\nog lever', deadlineLocal: '2026-09-16T14:00', remainingMinutes: 0, explicitId: '1' })
    expect(parsed.warnings.join(' ')).toContain('kommentar')
    expect(() => csv('tittel;frist\n"uferdig;2026-09-16')).toThrow(/CSV/)
  })
  it('keeps VTODO deadlines separate from teaching and unresolved date-only due', () => {
    const parsed = parseDocumentIcs('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:todo1\r\nSUMMARY:Lever oppgave\r\nDUE;VALUE=DATE:20260916\r\nEND:VTODO\r\nEND:VCALENDAR')
    expect(parsed.rows[0]).toMatchObject({ kind: 'task', deadlineLocal: '', explicitId: 'todo1' })
    expect(parsed.rows[0].deadlineIssues.length).toBeGreaterThan(0)
  })
  it('requires explicit teaching period, preserves fixed activities and rejects excessive recurrence', () => {
    const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:e1\r\nSUMMARY:Forelesning\r\nDTSTART:20260916T100000Z\r\nDTEND:20260916T110000Z\r\nEND:VEVENT\r\nEND:VCALENDAR'
    expect(() => parseDocumentIcs(text)).toThrow(/kalendersemester/)
    expect(parseDocumentIcs(text, { semester: 'autumn', year: 2026 }).rows[0]).toMatchObject({ kind: 'event', startLocal: '2026-09-16T12:00', endLocal: '2026-09-16T13:00' })
    expect(() => parseDocumentIcs(text.replace('END:VEVENT', 'RRULE:FREQ=SECONDLY\r\nEND:VEVENT'), { semester: 'autumn', year: 2026 })).toThrow(/omfattende/)
  })
  it('checks actual DOCX expansion and rejects macros/oversize/untruthful archives', async () => {
    await expect(guardDocxArchive(zip(docxParts))).resolves.toMatchObject({ entries: 3 })
    await expect(guardDocxArchive(zip(docxParts, { dishonest: true }))).rejects.toThrow(/feil størrelse/)
    await expect(guardDocxArchive(zip({ ...docxParts, 'word/vbaProject.bin': 'macro' }))).rejects.toThrow(/makroer/)
    await expect(guardDocxArchive(zip({ ...docxParts, 'word/huge.xml': 'x'.repeat(8_000_001) }))).rejects.toThrow(/stor/)
  })
  it('extracts real DOCX raw text locally and explains unreadable text', async () => {
    const parsed = await parseDocumentBytes(zip(docxParts), { format: 'docx' })
    expect(parsed.rows[0]).toMatchObject({ kind: 'task', position: 'Avsnitt 1', deadlineLocal: '2026-09-16T14:00' })
    await expect(parseDocumentBytes(new TextEncoder().encode('   ').buffer)).rejects.toThrow(/Ingen lesbar tekst/)
  })
})

describe('one atomic document plan with stable source/local revisions', () => {
  it('requires missing fields or explicit omission and leaves input untouched on a partial failure', () => {
    const state = empty(), parsed = csv('id;tittel;frist\n1;Les kapittel;16.09\n2;Skriv notater;2026-09-18T12:00'), p = preview(state, parsed), before = JSON.stringify(state)
    expect(commit(state, p).ok).toBe(false); expect(JSON.stringify(state)).toBe(before)
    p.rows[0].deadlineMode = 'none'
    const result = commit(state, p)
    expect(result.ok).toBe(true); expect(result.state.tasks).toHaveLength(2)
    expect(result.state.tasks[0]).toMatchObject({ course: '', deadlineLocal: '', remainingMinutes: null, completed: false })
    expect(validImportSources(result.state.importSources, result.state)).toBe(true)
  })
  it('commits a course, linked task and unassigned teaching together without proposed work sessions', () => {
    const state = empty(), p = preview(state, csv('id;type;tittel;emne;år;semester;frist;start;slutt\nc;emne;Programmering;IBE160;2026;høst;;;\nt;oppgave;Innlevering;IBE160;;;2026-09-16T14:00;;\ne;undervisning;Felles seminar;;;;;2026-09-17T10:00;2026-09-17T12:00'))
    const result = commit(state, p)
    expect(result.ok).toBe(true); expect(result.state.planner.courses).toHaveLength(1); expect(result.state.tasks[0].courseId).toBe(result.state.planner.courses[0].id)
    expect(result.state.planner.events[0].courseId).toBe(''); expect(result.state.sessions).toBeUndefined()
  })
  it('reimports the same bytes without duplicates and preserves local edits', () => {
    const parsed = csv('id;tittel;frist\n1;Les pensum;2026-09-16T14:00'), first = commit(empty(), preview(empty(), parsed)).state
    first.tasks[0].title = 'Min presise oppgave'; first.tasks[0].remainingMinutes = 45
    const repeat = commit(first, preview(first, parsed, { name: 'Nytt filnavn.csv' }))
    expect(repeat.ok).toBe(true); expect(repeat.state.tasks).toHaveLength(1); expect(repeat.state.tasks[0].id).toBe(first.tasks[0].id)
    expect(repeat.state.tasks[0]).toMatchObject({ title: 'Min presise oppgave', remainingMinutes: 45 })
    expect(repeat.source.revision).toBe(1)
  })
  it('shows three-way conflicts, preserves local values after explicit choice and applies unedited changes', () => {
    const firstParsed = csv('id;tittel;frist\n1;Les pensum;2026-09-16T14:00'), first = commit(empty(), preview(empty(), firstParsed)).state
    first.tasks[0].title = 'Min tittel'
    const next = csv('id;tittel;frist\n1;Les nytt pensum;2026-09-17T14:00'), p = preview(first, next, { sourceId: first.importSources[0].id, contentHash: 'b'.repeat(64) })
    expect(p.rows[0].conflicts.map(c => c.field)).toContain('title'); expect(commit(first, p).ok).toBe(false)
    p.rows[0].conflictChoices.title = 'local'
    const result = commit(first, p)
    expect(result.ok).toBe(true); expect(result.state.tasks[0]).toMatchObject({ title: 'Min tittel', deadlineLocal: '2026-09-17T14:00' }); expect(result.source.revision).toBe(2)
  })
  it('does not delete deselected/absent entries or silently recreate local deletions', () => {
    const parsed = csv('id;tittel\n1;Les\n2;Skriv'), first = commit(empty(), preview(empty(), parsed)).state
    const p = preview(first, parsed); p.rows[0].selected = false
    expect(commit(first, p).state.tasks).toHaveLength(2)
    first.tasks.splice(0, 1)
    const deleted = preview(first, parsed)
    expect(deleted.rows[0].deletedLocally).toBe(true); expect(commit(first, deleted).ok).toBe(false)
    deleted.rows[0].recreate = true
    expect(commit(first, deleted).state.tasks).toHaveLength(2)
  })
  it('requires user rematching for ambiguous changed documents', () => {
    const parsed = csv('tittel;frist\nLes;2026-09-16T14:00\nLes;2026-09-17T14:00'), first = commit(empty(), preview(empty(), parsed)).state
    const changed = preview(first, parsed, { sourceId: first.importSources[0].id, contentHash: 'b'.repeat(64) })
    expect(changed.rows[0].matchChoice).toBe('?'); expect(commit(first, changed).ok).toBe(false)
  })
  it('rejects stale previews, invalid relations and invalid source envelopes', () => {
    const state = empty(), p = preview(state, csv('tittel\nLes pensum'))
    state.tasks.push({ id: 'manual', title: 'Lokal', course: '', deadlineLocal: '', estimatedMinutes: null, completed: false })
    expect(commit(state, p)).toMatchObject({ ok: false, stale: true })
    const result = commit(empty(), preview(empty(), csv('tittel\nLes pensum'))).state
    const corrupt = structuredClone(result.importSources); corrupt[0].entries[0].sourceBase.remainingMinutes = -1
    expect(validImportSources(corrupt)).toBe(false)
    const original = structuredClone(result.importSources); original[0].originalFile = 'private original content'
    expect(validImportSources(original)).toBe(false)
    result.tasks[0].importEntryKey = 'unknown'
    expect(validImportSources(result.importSources, result)).toBe(false)
  })
  it('previews explicit ICS cancellation while retaining other unreturned activities', () => {
    const calendar = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR`
    const event = (uid, title) => `BEGIN:VEVENT\r\nUID:${uid}\r\nSUMMARY:${title}\r\nDTSTART:20260916T100000Z\r\nDTEND:20260916T110000Z\r\nEND:VEVENT`
    const parse = text => parseDocumentIcs(text, { semester: 'autumn', year: 2026 })
    const first = commit(empty(), preview(empty(), parse(calendar(`${event('a', 'Forelesning')}\r\n${event('b', 'Seminar')}`)))).state
    const cancellation = parse(calendar('BEGIN:VEVENT\r\nUID:a\r\nSTATUS:CANCELLED\r\nEND:VEVENT'))
    const p = preview(first, cancellation, { sourceId: first.importSources[0].id, contentHash: 'c'.repeat(64) })
    expect(p.rows).toHaveLength(1); expect(p.rows[0].cancelled).toBe(true)
    const result = commit(first, p)
    expect(result.ok).toBe(true); expect(result.state.planner.events).toHaveLength(2)
    expect(result.state.planner.events[0]).toMatchObject({ id: first.planner.events[0].id, cancelled: true })
    expect(result.state.planner.events[1]).toEqual(first.planner.events[1])
    expect(result.source.entries).toHaveLength(2)
  })
  it('applies a recurrence-instance cancellation only to that instance', () => {
    const parse = text => parseDocumentIcs(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${text}\r\nEND:VCALENDAR`, { semester: 'autumn', year: 2026 })
    const first = commit(empty(), preview(empty(), parse('BEGIN:VEVENT\r\nUID:weekly\r\nSUMMARY:Forelesning\r\nDTSTART:20260916T100000Z\r\nDTEND:20260916T110000Z\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nEND:VEVENT'))).state
    const cancelled = parse('BEGIN:VEVENT\r\nUID:weekly\r\nRECURRENCE-ID:20260923T100000Z\r\nSTATUS:CANCELLED\r\nEND:VEVENT')
    const result = commit(first, preview(first, cancelled, { sourceId: first.importSources[0].id, contentHash: 'c'.repeat(64) }))
    expect(result.ok).toBe(true); expect(result.state.planner.events.map(event => event.cancelled)).toEqual([false, true])
  })
})
