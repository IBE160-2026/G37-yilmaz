import { describe, it, expect } from 'vitest'
import { parseDocumentCsv, parseDocumentIcs } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, chooseDocumentCourse } from '../../src/import-preview.js'
import { emptyPlanner } from '../../src/planner.js'
import { validImportSources } from '../../src/import-source-contract.js'
import { validEnvelope } from '../../src/storage.js'
import { previewBackup } from '../../src/backup.js'

// Entirely invented course/calendar examples; no private original is used.
const ics = (title = 'Prøve i SYN971', description = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Synthetic closure//NO\r\n${[1, 2].map(n => `BEGIN:VEVENT\r\nUID:synthetic-${n}\r\nDTSTART:203904${17 + n}T080000Z\r\nDTEND:203904${17 + n}T090000Z\r\nSUMMARY:${title}\r\nDESCRIPTION:${description}\r\nEND:VEVENT`).join('\r\n')}\r\nEND:VCALENDAR\r\n`
const parsed = (title, description) => ({ ...parseDocumentIcs(ics(title, description)), contentHash: 'b'.repeat(64) })
const state = () => ({ schemaVersion: 1, tasks: [], planner: emptyPlanner() })
const tpCsv = (extras = '', values = '', dates = ['2045-09-18', '2046-01-12']) => `semesterid;courseid;dtstart;dtend;title-intro;teaching-title;summary;teaching-method-name;eventid;coursename;university${extras}\n${dates.map((date, i) => `45h;SYN973;${date}T10:00:07+01:00;${date}T11:00:17+01:00;SYN973;Oppdiktet økt ${i};Oppdiktet økt ${i};Seminar;synthetic-term-${i};Oppdiktet termfag;HiMolde${values}`).join('\n')}`
const ready = preview => { for (const row of preview.rows.filter(row => row.kind === 'course')) { row.title ||= 'Oppdiktet emne'; row.courseTarget = row.courseTarget === '?' ? '' : row.courseTarget } return preview }
const legacy = () => {
  const input = parsed(), old = { ...input, rows: input.rows.filter(row => row.kind === 'event').map(row => ({ ...row, courseHint: '', code: '' })) }
  const saved = buildDocumentImportCommit(state(), createDocumentImportPreview(state(), old))
  expect(saved.ok).toBe(true)
  for (const entry of saved.source.entries) delete entry.courseDecision
  saved.candidate.planner.events[0].notes = 'Mitt bevarte notat'
  return saved.candidate
}

describe('import/calendar closure: course recognition and durable choices', () => {
  it('recognizes later title codes and explicit description fields without deriving exam classification', () => {
    for (const input of [parsed('Prøve i SYN971'), parsed('Arbeidsøkt', 'Emne: SYN971'), parsed('SYN971 – repetisjon av SYN971')]) {
      expect(input.rows.filter(row => row.kind === 'course')).toHaveLength(1)
      expect(input.rows.filter(row => row.kind === 'event').every(row => row.courseHint === 'SYN971' && !row.activityKind)).toBe(true)
      const preview = ready(createDocumentImportPreview(state(), input)), saved = buildDocumentImportCommit(state(), preview)
      expect(saved.ok).toBe(true)
      expect(saved.candidate.planner.events.every(row => row.courseId === saved.candidate.planner.courses[0].id)).toBe(true)
    }
  })
  it('keeps multiple unqualified codes unresolved as one shared course question', () => {
    const input = parsed('Fellesøkt SYN971 og SYN972'), preview = createDocumentImportPreview(state(), input)
    expect(input.rows.filter(row => row.kind === 'course')).toHaveLength(0)
    expect(preview.rows.every(row => row.courseChoice === '?')).toBe(true)
    chooseDocumentCourse(preview, preview.rows, '')
    const saved = buildDocumentImportCommit(state(), preview)
    expect(saved.ok).toBe(true)
    expect(saved.candidate.planner.courses).toHaveLength(0)
    expect(createDocumentImportPreview(saved.candidate, input).rows.every(row => row.courseChoice === '')).toBe(true)
  })
  it('does not reinterpret numbered prose or room labels as new courses or competing codes', () => {
    for (const title of ['Møte ROM101', 'Møte ROOM205', 'Møte SAL42', 'Les kapittel 12', 'Løs oppgave 12', 'Les KAPITTEL 12']) {
      const input = parsed(title)
      expect(input.rows.filter(row => row.kind === 'course'), title).toHaveLength(0)
      expect(createDocumentImportPreview(state(), input).rows.every(row => row.courseChoice === '')).toBe(true)
    }
    for (const title of ['SYN971 – kapittel 12 og oppgave 14', 'Les kapittel 12 og oppgave 14 for SYN971', 'Seminar i SYN 971']) {
      const input = parsed(title)
      expect(input.rows.filter(row => row.kind === 'course')).toHaveLength(1)
      expect(input.rows.filter(row => row.kind === 'event').every(row => row.courseHint === 'SYN971')).toBe(true)
    }
    const explicit = { ...parseDocumentIcs(ics('Møte ROM101').replaceAll('SUMMARY:', 'X-COURSE-CODE:ROM101\r\nX-COURSE-NAME:Uttrykkelig kildeemne\r\nSUMMARY:')), contentHash: 'c'.repeat(64) }
    expect(explicit.rows.filter(row => row.kind === 'course')).toHaveLength(1)
  })
  it('keeps two title codes ambiguous when only one has qualified file metadata', () => {
    const input = { ...parseDocumentIcs(ics('SYN971 og SYN972').replace('SUMMARY:SYN971 og SYN972', 'X-COURSE-CODE:SYN971\r\nX-COURSE-NAME:Oppdiktet fag\r\nX-UNIVERSITY:HiMolde\r\nSUMMARY:SYN971')), contentHash: 'c'.repeat(64) }
    const draft = createDocumentImportPreview(state(), input)
    expect(draft.rows.filter(row => row.kind === 'course')).toHaveLength(1)
    expect(draft.rows.filter(row => row.kind === 'event').map(row => row.courseChoice)).toEqual(['row:0', '?'])
    expect(buildDocumentImportCommit(state(), draft).ok).toBe(false)
  })
  it.each(['link', 'none'])('asks once for legacy empty links and preserves %s decisions and IDs on unchanged reimport', choice => {
    const before = legacy(), input = parsed(), preview = ready(createDocumentImportPreview(before, input))
    const events = preview.rows.filter(row => row.kind === 'event'), course = preview.rows.find(row => row.kind === 'course')
    expect(events.every(row => row.courseChoice === '?' && row.legacyCourseChoice)).toBe(true)
    expect(buildDocumentImportCommit(before, preview).ok).toBe(false)
    chooseDocumentCourse(preview, events, choice === 'link' ? `row:${course.index}` : '')
    if (choice === 'none') course.selected = false
    const saved = buildDocumentImportCommit(before, preview)
    expect(saved.ok).toBe(true)
    expect(saved.candidate.planner.events.map(row => row.id)).toEqual(before.planner.events.map(row => row.id))
    expect(saved.candidate.planner.events[0].notes).toBe('Mitt bevarte notat')
    expect(saved.source.entries.filter(row => row.kind === 'event').every(row => row.courseDecision.origin === 'user')).toBe(true)
    const reimport = createDocumentImportPreview(saved.candidate, input), repeated = buildDocumentImportCommit(saved.candidate, reimport)
    expect(reimport.rows.filter(row => row.kind === 'event').every(row => row.courseChoice !== '?' && !row.legacyCourseChoice)).toBe(true)
    expect(repeated.ok).toBe(true)
    expect(repeated.candidate.planner).toEqual(saved.candidate.planner)
  })
  it('does not change a deliberate local unlink or explicit personal classification', () => {
    const input = parsed(), first = buildDocumentImportCommit(state(), ready(createDocumentImportPreview(state(), input)))
    expect(first.ok).toBe(true)
    first.candidate.planner.events[0].courseId = ''
    delete first.source.entries.find(row => row.kind === 'event').courseDecision
    const next = createDocumentImportPreview(first.candidate, input)
    expect(next.rows.find(row => row.kind === 'event').courseChoice).toBe('')
    expect(buildDocumentImportCommit(first.candidate, next).ok).toBe(true)
    const personal = parseDocumentCsv('title;courseid;activitykind;dtstart;dtend\nEgen tur;SYN971;personal;2039-04-18 10:00;2039-04-18 11:00')
    expect(personal.rows).toHaveLength(1)
    expect(personal.rows[0].activityKind).toBe('personal')
  })
  it('honors a valid requested CSV identity column and rejects invalid values instead of substituting', () => {
    const csv = 'title;id;eventid;dtstart;dtend\nA;mine-a;source-a;2039-04-18 10:00;2039-04-18 11:00\nB;mine-b;source-b;2039-04-19 10:00;2039-04-19 11:00'
    expect(parseDocumentCsv(csv, { columns: { explicitId: 'id' } }).rows.map(row => row.explicitId)).toEqual(['mine-a', 'mine-b'])
    expect(parseDocumentCsv(csv).rows.map(row => row.explicitId)).toEqual(['source-a', 'source-b'])
    expect(() => parseDocumentCsv(csv.replace('mine-b', 'mine-a'), { columns: { explicitId: 'id' } })).toThrow(/identitet|identifikator/i)
    expect(() => parseDocumentCsv(csv.replace('mine-b', ''), { columns: { explicitId: 'id' } })).toThrow(/identitet|identifikator/i)
  })
  it('uses recognized TP CSV publication term across September and January without changing times', () => {
    const input = { ...parseDocumentCsv(tpCsv()), contentHash: 'd'.repeat(64) }
    expect(input.rows.filter(row => row.kind === 'course')).toHaveLength(1)
    expect(input.rows.every(row => row.year === 2045 && row.semester === 'autumn')).toBe(true)
    const first = buildDocumentImportCommit(state(), createDocumentImportPreview(state(), input))
    expect(first.ok).toBe(true)
    expect(first.candidate.planner.events.map(row => row.start)).toEqual(['2045-09-18T09:00:07Z', '2046-01-12T09:00:07Z'])
    expect(buildDocumentImportCommit(first.candidate, createDocumentImportPreview(first.candidate, input)).candidate.planner).toEqual(first.candidate.planner)
    const noTerm = parseDocumentCsv(tpCsv().replaceAll('45h;', ';'))
    expect(noTerm.rows.filter(row => row.kind === 'course')).toHaveLength(2)
  })
  it.each([
    () => tpCsv().replaceAll('45h;', 'unknown;'),
    () => tpCsv(';year', ';2046'),
    () => tpCsv(';semester', ';spring'),
    () => tpCsv('', '', ['2048-01-12']),
  ])('rejects invalid/conflicting published CSV term without substituting the event semester', input => {
    expect(() => parseDocumentCsv(input())).toThrow(/semesterid/)
  })
  it('repairs the owned January CSV course from identical legacy bytes', () => {
    const input = { ...parseDocumentCsv(tpCsv('', '', ['2046-01-12'])), contentHash: 'd'.repeat(64) }
    const old = structuredClone(input)
    for (const row of old.rows) { row.year = 2046; row.semester = 'spring'; row.publishedTerm = false }
    const first = buildDocumentImportCommit(state(), createDocumentImportPreview(state(), old)); expect(first.ok).toBe(true)
    const next = buildDocumentImportCommit(first.candidate, createDocumentImportPreview(first.candidate, input)); expect(next.ok).toBe(true)
    expect(next.candidate.planner.courses).toHaveLength(1)
    expect(next.candidate.planner.courses[0]).toMatchObject({ id: first.candidate.planner.courses[0].id, semester: 'autumn', year: 2045 })
    expect(next.candidate.planner.events).toEqual(first.candidate.planner.events)
  })
  it('preserves older term-derived CSV occurrence keys and exclusions without an explicit event identifier', () => {
    const csv = tpCsv('', '', ['2046-01-12', '2046-01-13']).replace(';eventid', '').replace(/;synthetic-term-\d/g, '')
    const input = { ...parseDocumentCsv(csv), contentHash: 'd'.repeat(64) }
    // The old parser ignored semesterid. The generic branch recreates its
    // actual event-date identity, rather than mutating the new parser's keys.
    const old = { ...parseDocumentCsv(csv.replace('semesterid', 'archived-period')), contentHash: input.contentHash }
    expect(old.rows[1].key).not.toBe(input.rows[1].key)
    const initial = createDocumentImportPreview(state(), old)
    initial.rows[2].selected = false
    const first = buildDocumentImportCommit(state(), initial); expect(first.ok).toBe(true)
    first.candidate.planner.events[0].notes = 'Bevart eget notat'
    const next = createDocumentImportPreview(first.candidate, input)
    expect(next.rows[1].matchEntryKey).toBe(old.rows[1].key)
    expect(next.rows[2].selected).toBe(false)
    const saved = buildDocumentImportCommit(first.candidate, next); expect(saved.ok).toBe(true)
    expect(saved.candidate.planner.courses).toHaveLength(1)
    expect(saved.candidate.planner.courses[0]).toMatchObject({ id: first.candidate.planner.courses[0].id, year: 2045, semester: 'autumn' })
    expect(saved.candidate.planner.events).toEqual(first.candidate.planner.events)
    expect(saved.source.entries.map(entry => entry.key)).toEqual(first.source.entries.map(entry => entry.key))
    expect(saved.source.excludedKeys).toContain(old.rows[2].key)
    const changed = createDocumentImportPreview(first.candidate, { ...input, contentHash: 'e'.repeat(64) }, { sourceId: first.source.id })
    expect(changed.rows[1].matchEntryKey).toBe('')
  })
  it.each([null, {}, { origin: 'guessed', courseId: '' }, { origin: 'user', courseId: 12 }, { origin: 'user', courseId: '', extra: true }])('rejects malformed course decision provenance %j', value => {
    const saved = buildDocumentImportCommit(state(), ready(createDocumentImportPreview(state(), parsed())))
    expect(saved.ok).toBe(true)
    saved.source.entries.find(row => row.kind === 'event').courseDecision = value
    const unchanged = structuredClone(saved.candidate)
    expect(validImportSources(saved.candidate.importSources, saved.candidate)).toBe(false)
    expect(validEnvelope(saved.candidate, { relations: true })).toBe(false)
    expect(previewBackup(JSON.stringify({ format: 'studieplan-local-backup', backupVersion: 1, createdAt: '2039-04-18T00:00:00Z', data: saved.candidate }), state()).ok).toBe(false)
    expect(saved.candidate).toEqual(unchanged)
  })
  it('links title-only occurrences to unique explicit file courses without inventing an extra course', () => {
    const text = ics('Øvelse i SYN971').replace('SUMMARY:Øvelse i SYN971', 'X-COURSE-CODE:SYN971\r\nX-COURSE-NAME:Oppdiktet fag\r\nX-UNIVERSITY:himolde\r\nSUMMARY:Øvelse i SYN971')
    const input = { ...parseDocumentIcs(text), contentHash: 'c'.repeat(64) }
    expect(input.rows.filter(row => row.kind === 'course')).toHaveLength(1)
    const saved = buildDocumentImportCommit(state(), ready(createDocumentImportPreview(state(), input)))
    expect(saved.ok).toBe(true)
    expect(saved.candidate.planner.courses).toHaveLength(1)
    expect(saved.candidate.planner.events.every(event => event.courseId === saved.candidate.planner.courses[0].id)).toBe(true)
  })
  it('repairs a uniquely owned wrong published term without replacing course/event identities or edits', () => {
    const input = { ...parseDocumentIcs(ics('SYN971').replaceAll('203904', '204601').replaceAll('SUMMARY:SYN971', 'X-COURSE-CODE:SYN971\r\nX-COURSE-NAME:Oppdiktet fag\r\nX-UNIVERSITY:himolde\r\nX-COURSE-YEAR:2045\r\nX-COURSE-SEMESTER:autumn\r\nSUMMARY:SYN971')), contentHash: 'd'.repeat(64) }
    const old = structuredClone(input)
    for (const row of old.rows) { row.year = 2046; row.semester = 'spring'; row.publishedTerm = false }
    const first = buildDocumentImportCommit(state(), ready(createDocumentImportPreview(state(), old)))
    expect(first.ok).toBe(true)
    first.candidate.planner.events[0].notes = 'Bevart notat'
    const next = createDocumentImportPreview(first.candidate, input), saved = buildDocumentImportCommit(first.candidate, next)
    expect(saved.ok).toBe(true)
    expect(saved.candidate.planner.courses).toHaveLength(1)
    expect(saved.candidate.planner.courses[0]).toMatchObject({ id: first.candidate.planner.courses[0].id, year: 2045, semester: 'autumn' })
    expect(saved.candidate.planner.events).toEqual(first.candidate.planner.events)
  })
  it('does not merge two legacy term courses automatically', () => {
    const text = ics('SYN971').replace('20390418', '20450918').replace('20390418', '20450918').replaceAll('20390419', '20460119').replaceAll('SUMMARY:SYN971', 'X-COURSE-CODE:SYN971\r\nX-COURSE-NAME:Oppdiktet fag\r\nX-UNIVERSITY:himolde\r\nSUMMARY:SYN971')
    const old = { ...parseDocumentIcs(text), contentHash: 'e'.repeat(64) }
    const first = buildDocumentImportCommit(state(), ready(createDocumentImportPreview(state(), old)))
    expect(first.ok).toBe(true); expect(first.candidate.planner.courses).toHaveLength(2)
    const corrected = { ...parseDocumentIcs(text.replaceAll('X-COURSE-CODE:', 'X-COURSE-YEAR:2045\r\nX-COURSE-SEMESTER:autumn\r\nX-COURSE-CODE:')), contentHash: 'f'.repeat(64) }
    const next = createDocumentImportPreview(first.candidate, corrected, { sourceId: first.source.id })
    const course = next.rows.find(row => row.kind === 'course')
    expect(course.matchChoice).toBe('?'); expect(course.matchCandidates).toHaveLength(2)
    expect(buildDocumentImportCommit(first.candidate, next).ok).toBe(false)
    expect(first.candidate.planner.courses).toHaveLength(2)
  })
  it('preserves an explicit no-course choice when a changed title introduces another code', () => {
    const input = parsed(), draft = ready(createDocumentImportPreview(state(), input))
    chooseDocumentCourse(draft, draft.rows.filter(row => row.kind === 'event'), '')
    const first = buildDocumentImportCommit(state(), draft); expect(first.ok).toBe(true)
    const changed = { ...parsed('Ny samtale i SYN972'), contentHash: 'a'.repeat(64) }
    const next = createDocumentImportPreview(first.candidate, changed, { sourceId: first.source.id })
    expect(next.rows.filter(row => row.kind === 'event').every(row => row.courseChoice === '')).toBe(true)
    const saved = buildDocumentImportCommit(first.candidate, next)
    expect(saved.ok).toBe(true); expect(saved.candidate.planner.courses).toHaveLength(0)
    expect(saved.candidate.planner.events.map(event => event.id)).toEqual(first.candidate.planner.events.map(event => event.id))
  })
  it('auto-detects only a unique qualified owned source for published term repair', () => {
    const source = ics('SYN971').replaceAll('203904', '204601').replaceAll('SUMMARY:SYN971', 'X-COURSE-CODE:SYN971\r\nX-COURSE-NAME:Oppdiktet fag\r\nX-UNIVERSITY:himolde\r\nX-COURSE-SOURCE-ID:SYN971-1\r\nSUMMARY:SYN971')
    const old = { ...parseDocumentIcs(source), contentHash: 'a'.repeat(64) }, first = buildDocumentImportCommit(state(), ready(createDocumentImportPreview(state(), old)))
    expect(first.ok).toBe(true)
    const corrected = { ...parseDocumentIcs(source.replaceAll('SUMMARY:SYN971', 'X-COURSE-YEAR:2045\r\nX-COURSE-SEMESTER:autumn\r\nSUMMARY:SYN971')), contentHash: 'b'.repeat(64) }
    expect(createDocumentImportPreview(first.candidate, corrected).sourceId).toBe(first.source.id)
    for (const [field, value] of [['university', 'NTNU'], ['sourceObjectId', 'SYN971-other'], ['campus', 'Another campus']]) {
      const different = structuredClone(corrected)
      for (const row of different.rows) row[field] = value
      expect(createDocumentImportPreview(first.candidate, different).sourceId).not.toBe(first.source.id)
    }
    const duplicate = structuredClone(first.candidate)
    const other = { ...old, contentHash: 'c'.repeat(64) }
    // A separate source is explicitly requested by an isolated initial import,
    // then composed as independent records to model an ambiguous legacy state.
    const second = buildDocumentImportCommit(state(), ready(createDocumentImportPreview(state(), other)))
    duplicate.importSources.push(second.source); duplicate.planner.courses.push(...second.candidate.planner.courses); duplicate.planner.events.push(...second.candidate.planner.events)
    expect(() => createDocumentImportPreview(duplicate, corrected)).toThrow(/flere kilder/)
  })
  it('preserves recurrence identity when cancellation changes between TZID and UTC forms', () => {
    const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-series\r\nDTSTART;TZID=Europe/Oslo:20450418T100007\r\nDTEND;TZID=Europe/Oslo:20450418T110017\r\nRRULE:FREQ=DAILY;COUNT=2\r\nSUMMARY:Oppdiktet serie\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    const input = { ...parseDocumentIcs(text), contentHash: 'a'.repeat(64) }, first = buildDocumentImportCommit(state(), createDocumentImportPreview(state(), input))
    expect(first.ok).toBe(true)
    const cancel = { ...parseDocumentIcs('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:CANCEL\r\nBEGIN:VEVENT\r\nUID:synthetic-series\r\nRECURRENCE-ID:20450419T080007Z\r\nDTSTART:20450419T080007Z\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'), contentHash: 'b'.repeat(64) }
    for (const legacy of [false, true]) {
      const before = structuredClone(first.candidate)
      if (legacy) for (const entry of before.importSources[0].entries) delete entry.calendarOccurrenceInstant
      const saved = buildDocumentImportCommit(before, createDocumentImportPreview(before, cancel, { sourceId: first.source.id }))
      expect(saved.ok).toBe(true)
      expect(saved.candidate.planner.events.map(event => event.id)).toEqual(before.planner.events.map(event => event.id))
      expect(saved.candidate.planner.events.map(event => Boolean(event.cancelled))).toEqual([false, true])
      expect(saved.source.entries.map(entry => entry.calendarOccurrence)).toEqual(before.importSources[0].entries.map(entry => entry.calendarOccurrence))
    }
    const edited = structuredClone(first.candidate)
    for (const entry of edited.importSources[0].entries) delete entry.calendarOccurrenceInstant
    edited.planner.events[1].start = '2045-04-20T08:00:07Z'
    edited.planner.events[1].end = '2045-04-20T09:00:17Z'
    const editedResult = buildDocumentImportCommit(edited, createDocumentImportPreview(edited, cancel, { sourceId: first.source.id }))
    expect(editedResult.ok).toBe(true)
    expect(editedResult.candidate.planner.events[1]).toMatchObject({ start: edited.planner.events[1].start, end: edited.planner.events[1].end, cancelled: true })
    // A local recurrence hash without its original source instant is not
    // enough evidence, even if the current edited event happens to match.
    const uncertain = structuredClone(first.candidate)
    for (const entry of uncertain.importSources[0].entries) {
      delete entry.calendarOccurrenceInstant
      entry.sourceBase.start = '2045-04-20T08:00:07Z'
      entry.sourceBase.end = '2045-04-20T09:00:17Z'
    }
    const before = structuredClone(uncertain)
    const unresolved = createDocumentImportPreview(uncertain, cancel, { sourceId: first.source.id })
    expect(unresolved.rows).toHaveLength(0)
    expect(unresolved.warnings.some(warning => warning.includes('avlysning kunne ikke'))).toBe(true)
    expect(uncertain).toEqual(before)
  })
  it.each([null, 1, '', '2045-04-18T10:00:00', '2045-02-31T10:00:00Z', '2045-04-18T10:00:00.123Z', '2045-13-01'])('rejects malformed recurrence instant provenance %j at storage and backup boundaries', value => {
    const first = buildDocumentImportCommit(state(), ready(createDocumentImportPreview(state(), parsed())))
    const entry = first.source.entries.find(entry => entry.kind === 'event'); entry.calendarOccurrenceInstant = value
    const before = structuredClone(first.candidate)
    expect(validEnvelope(first.candidate, { relations: true })).toBe(false)
    expect(previewBackup(JSON.stringify({ format: 'studieplan-local-backup', backupVersion: 1, createdAt: '2039-04-18T00:00:00Z', data: first.candidate }), state()).ok).toBe(false)
    expect(first.candidate).toEqual(before)
  })
})
