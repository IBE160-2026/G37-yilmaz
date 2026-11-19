import { describe, expect, it } from 'vitest'
import { parseDocumentIcs, parseDocumentText } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, refreshDocumentImportPreview, refreshDocumentConflicts, documentSourceChanged, addDocumentCourseDraft } from '../../src/import-preview.js'
import { validateCourse, validateEvent, validPlanner } from '../../src/planner.js'
import { validImportSources } from '../../src/import-source-contract.js'
import { calendarEntries, entriesForDay } from '../../src/calendar-model.js'
import { generateCalendarIcs } from '../../src/calendar-export.js'
import { recordChange, undoLast } from '../../src/history.js'

// All names, IDs and calendar metadata in this file are invented test data.
const empty = () => ({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } })
const event = (uid, title = 'Forelesning', fields = '', date = '20261026') => `BEGIN:VEVENT\r\nUID:${uid}\r\nSUMMARY:${title}\r\nDTSTART:${date}T090000Z\r\nDTEND:${date}T100000Z\r\n${fields}\r\nEND:VEVENT`
const calendar = (...events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UiO//TP Synthetic//EN\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`
const parsed = (text, hash = 'a') => ({ ...parseDocumentIcs(text), contentHash: hash.repeat(64) })
const draft = (state, text, hash = 'a', sourceId) => createDocumentImportPreview(state, parsed(text, hash), { sourceId })
const save = (state, preview) => { const result = buildDocumentImportCommit(state, preview); expect(result.ok, JSON.stringify(result)).toBe(true); return result.state }
const course = (id, code, university = 'Syntetisk institusjon', year = 2026) => validateCourse({ id, code, name: `Syntetisk ${code}`, university, year, semester: 'autumn', credits: '' })
const metadata = (code, name) => `X-COURSE-CODE:${code}\r\nX-COURSE-NAME:${name}\r\nX-UNIVERSITY:Syntetisk institusjon`

describe('one bounded calendar file with stable independent identity', () => {
  it.each(['Europe/Oslo', 'America/New_York', 'Pacific/Auckland'])('I02 keeps exclusive all-day dates through display, export and a fresh import from %s', zone => {
    const ics = calendar(
      'X-WR-TIMEZONE:' + zone,
      'BEGIN:VEVENT\r\nUID:one-day\r\nSUMMARY:En heldag\r\nDTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121\r\nEND:VEVENT',
      'BEGIN:VEVENT\r\nUID:several-days\r\nSUMMARY:Flere heldager\r\nDTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261123\r\nEND:VEVENT',
      'BEGIN:VEVENT\r\nUID:timed\r\nSUMMARY:Tidsbestemt aktivitet\r\nDTSTART;TZID=' + zone + ':20261120T120000\r\nDTEND;TZID=' + zone + ':20261120T130000\r\nEND:VEVENT',
    )
    const initial = save(empty(), draft(empty(), ics))
    const readDay = (state, day) => entriesForDay(calendarEntries(state), day).map(item => item.title)
    expect(initial.planner.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'En heldag', allDay: true, start: '2026-11-19T23:00:00.000Z', end: '2026-11-20T23:00:00.000Z' }),
      expect.objectContaining({ title: 'Flere heldager', allDay: true, start: '2026-11-19T23:00:00.000Z', end: '2026-11-22T23:00:00.000Z' }),
    ]))
    const timed = initial.planner.events.find(item => item.title === 'Tidsbestemt aktivitet')
    expect(timed.start).toBe({
      'Europe/Oslo': '2026-11-20T11:00:00.000Z',
      'America/New_York': '2026-11-20T17:00:00.000Z',
      'Pacific/Auckland': '2026-11-19T23:00:00.000Z',
    }[zone])
    expect(Date.parse(timed.end) - Date.parse(timed.start)).toBe(60 * 60_000)
    const copy = generateCalendarIcs(initial, { includeTeaching: true })
    expect(copy).toContain('DTSTART;VALUE=DATE:20261120')
    expect(copy).toContain('DTEND;VALUE=DATE:20261121')
    expect(copy).toContain('DTEND;VALUE=DATE:20261123')
    const restored = save(empty(), draft(empty(), copy, 'c'))
    const times = state => state.planner.events.map(({ start, end, allDay }) => [start, end, allDay]).sort()
    expect(times(restored)).toEqual(times(initial))
    for (const state of [initial, restored]) {
      expect(readDay(state, '2026-11-19')).toEqual([])
      expect(readDay(state, '2026-11-20')).toHaveLength(3)
      expect(readDay(state, '2026-11-21')).toHaveLength(1)
      expect(readDay(state, '2026-11-22')).toHaveLength(1)
      expect(readDay(state, '2026-11-23')).toEqual([])
    }
  })

  it.each([
    ['20.11.2026 kl. 23.30–01.00', '2026-11-20T23:30', '2026-11-21T01:00', '2026-11-20T22:30:00Z', '2026-11-21T00:00:00Z'],
    ['2026-11-20T23:30-05:00 – 01:00', '2026-11-21T05:30', '2026-11-21T07:00', '2026-11-21T04:30:00Z', '2026-11-21T06:00:00Z'],
    ['2026-11-20T23:30-05:00 – 2026-11-22T01:00-05:00', '2026-11-21T05:30', '2026-11-22T07:00', '2026-11-21T04:30:00Z', '2026-11-22T06:00:00Z'],
  ])('keeps the ending date and source offset of overnight teaching %s', (range, startLocal, endLocal, start, end) => {
    const state = empty()
    const parsed = parseDocumentText('Syntetisk seminar ' + range)
    expect(parsed.rows[0]).toMatchObject({ kind: 'event', startLocal, endLocal })
    const result = save(state, createDocumentImportPreview(state, { ...parsed, contentHash: 'a'.repeat(64) }))
    expect(JSON.parse(JSON.stringify(result)).planner.events[0]).toMatchObject({ start, end })
  })

  it.each([
    ['Synthetic/Clock', 'DUE;TZID=Synthetic/Clock:20261120T233000'],
    ['Synthetic/Clock', 'DUE:20261120T233000'],
    ['America/New_York', 'DUE;TZID=America/New_York:20261120T233000'],
  ])('keeps the calendar-provided timezone for VTODO %s, %s, alongside VEVENT', (zone, due) => {
    const text = calendar(
      'X-WR-TIMEZONE:' + zone,
      'BEGIN:VTIMEZONE\r\nTZID:' + zone + '\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:-0800\r\nTZOFFSETTO:-0800\r\nEND:STANDARD\r\nEND:VTIMEZONE',
      'BEGIN:VEVENT\r\nUID:seminar\r\nSUMMARY:Kveldsseminar\r\nDTSTART;TZID=' + zone + ':20261120T233000\r\nDTEND;TZID=' + zone + ':20261121T010000\r\nEND:VEVENT',
      'BEGIN:VTODO\r\nUID:todo\r\nSUMMARY:Lever oppgaven\r\n' + due + '\r\nEND:VTODO',
    )
    const state = empty(), preview = draft(state, text)
    expect(preview.rows.find(row => row.kind === 'event')).toMatchObject({ startLocal: '2026-11-21T08:30', endLocal: '2026-11-21T10:00' })
    expect(preview.rows.find(row => row.kind === 'task')).toMatchObject({ deadlineLocal: '2026-11-21T08:30', deadlineMode: 'value' })
    const restored = JSON.parse(JSON.stringify(save(state, preview)))
    expect(restored.tasks[0].deadlineLocal).toBe('2026-11-21T08:30')
    expect(restored.planner.events[0]).toMatchObject({ start: '2026-11-21T07:30:00.000Z', end: '2026-11-21T09:00:00.000Z' })
  })

  it('partial reimport preserves IDs, local notes, course relations and unaffected events while applying case-insensitive cancellation', () => {
    const initialText = calendar(event('retained', 'Oppdiktet beholdt'), event('cancelled', 'Oppdiktet avlyst'), event('unaffected', 'Oppdiktet uberørt'))
    const state = save(empty(), draft(empty(), initialText)), sourceId = state.importSources[0].id
    state.planner.courses.push(course('synthetic-course', 'SYN974'))
    state.planner.events.forEach(item => { item.notes = 'Oppdiktet lokalt notat'; item.courseId = 'synthetic-course' })
    const before = structuredClone(state)
    const partial = calendar(event('retained', 'Oppdiktet beholdt'), event('unaffected', 'Oppdiktet ugyldig erstatning', 'DURATION:PT1H'), 'BEGIN:VEVENT\r\nUID:cancelled\r\nSTATUS:caNCellEd\r\nEND:VEVENT', 'BEGIN:VEVENT\r\nUID:unaffected\r\nUID:retained\r\nSTATUS:CANCELLED\r\nEND:VEVENT')
    const preview = draft(state, partial, 'b', sourceId)
    expect(preview.accounting).toMatchObject({ total: 4, retained: 1, rejected: 2, cancelled: 1 })
    const saved = save(state, preview)
    expect(saved.planner.events.map(item => item.id)).toEqual(before.planner.events.map(item => item.id))
    expect(saved.planner.events.map(item => [item.notes, item.courseId, item.importEntryKey])).toEqual(before.planner.events.map(item => [item.notes, item.courseId, item.importEntryKey]))
    expect(saved.planner.events.find(item => item.title === 'Oppdiktet avlyst').cancelled).toBe(true)
    expect(saved.planner.events.find(item => item.title === 'Oppdiktet uberørt')).toEqual(before.planner.events.find(item => item.title === 'Oppdiktet uberørt'))
    expect(saved.importSources[0].complete).toBe(false)
    const recreated = JSON.parse(JSON.stringify(saved))
    expect(save(recreated, draft(recreated, partial, 'b', sourceId)).planner).toEqual(saved.planner)
    expect(validImportSources(recreated.importSources, recreated)).toBe(true)
    expect(state).toEqual(before)
  })
  it('keeps personal activities unassigned when a grouped course is proposed or resolved', () => {
    const state = empty(), preview = draft(state, calendar(event('personal'), event('teaching')))
    const personal = preview.rows[0]; personal.activityKind = 'personal'
    const row = addDocumentCourseDraft(state, preview, [...preview.rows])
    Object.assign(row, { title: 'Synthetic course', semester: 'autumn', year: 2026 })
    expect(personal.courseChoice).toBe('')
    // A stale grouped choice must still not override the domain's personal semantics.
    personal.courseChoice = `row:${row.index}`
    const result = save(state, preview)
    expect(result.planner.events[0].courseId).toBe('')
    expect(result.planner.events[1].courseId).toBe(result.planner.courses[0].id)
  })
  for (const name of ['', 'Synthetic original']) it(`retires an unused ${name ? 'valid' : 'incomplete'} proposal while preserving shared proposals`, () => {
    const state = empty(), preview = draft(state, calendar(event('replace-a', 'SYN901 A', metadata('SYN901', name)), event('replace-b', 'SYN901 B', metadata('SYN901', name))))
    const original = preview.rows.find(row => row.kind === 'course'), members = preview.rows.filter(row => row.kind === 'event')
    const replacement = addDocumentCourseDraft(state, preview, [members[0]])
    expect(original.selected).toBe(true)
    addDocumentCourseDraft(state, preview, members)
    expect(original.selected).toBe(false)
    Object.assign(replacement, { title: 'Synthetic replacement', semester: 'autumn', year: 2026 })
    const result = save(state, preview)
    expect(result.planner.courses).toHaveLength(1)
    expect(result.planner.events.every(event => event.courseId === result.planner.courses[0].id)).toBe(true)
  })
  it('reuses an existing course draft at the row limit and explains how to reduce source rows', () => {
    const state = empty(), preview = draft(state, calendar(event('limit-a'), event('limit-b'))), members = [...preview.rows]
    const existing = addDocumentCourseDraft(state, preview, [members[0]])
    while (preview.rows.length < 1000) preview.rows.push({ key: `synthetic-padding-${preview.rows.length}`, kind: 'event', selected: false })
    expect(addDocumentCourseDraft(state, preview, [members[0]])).toBe(existing)
    expect(() => addDocumentCourseDraft(state, preview, [members[1]])).toThrow('mindre kildefil eller bruk en kortere kalenderperiode')
  })
  it('retains an explicit new course draft across period refresh and reimport without duplicating relations', () => {
    const state = empty(), text = calendar(event('manual-course')), preview = draft(state, text)
    const row = addDocumentCourseDraft(state, preview, preview.rows.filter(row => row.kind === 'event'))
    Object.assign(row, { title: 'Syntetisk manuelt emne', semester: 'autumn', year: '2026' })
    const refreshed = refreshDocumentImportPreview(state, preview, parsed(text))
    expect(refreshed.rows.find(item => item.kind === 'course')).toMatchObject({ title: row.title, semester: 'autumn', year: '2026' })
    const result = save(state, refreshed)
    expect(result.planner.events[0].courseId).toBe(result.planner.courses[0].id)
    expect(save(result, draft(result, text)).planner).toEqual(result.planner)
    expect(state).toEqual(empty())
  })
  it('reports one course clarification for linked rows, then commits provisional names atomically', () => {
    const state = empty(), preview = draft(state, calendar(event('code-a', 'SYN999 økt', metadata('SYN999', '')), event('code-b', 'SYN999 økt', metadata('SYN999', ''))))
    const proposed = preview.rows.find(row => row.kind === 'course')
    const missingName = buildDocumentImportCommit(state, preview)
    expect(missingName.ok).toBe(false)
    expect(missingName.errors).toHaveLength(1)
    expect(missingName.errors[0]).toMatchObject({ index: proposed.index, field: 'title' })
    proposed.title = proposed.code
    proposed.selected = false
    const omitted = buildDocumentImportCommit(state, preview)
    expect(omitted.errors).toHaveLength(1)
    expect(omitted.errors[0]).toMatchObject({ index: proposed.index, field: 'selected' })
    proposed.selected = true
    const result = save(state, preview)
    expect(result.planner.courses[0].name).toBe('SYN999')
    expect(result.planner.events.every(row => row.courseId === result.planner.courses[0].id)).toBe(true)
    expect(state).toEqual(empty())
    expect(save(result, draft(result, calendar(event('code-a', 'SYN999 økt', metadata('SYN999', '')), event('code-b', 'SYN999 økt', metadata('SYN999', ''))))).planner).toEqual(result.planner)
  })
  it('counts source task deadline changes independently of local titles and optional fields', () => {
    const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:todo\r\nSUMMARY:Les kapitlet\r\nDUE:20261026T090000Z\r\nEND:VTODO\r\nEND:VCALENDAR'
    const state = save(empty(), draft(empty(), text)); state.tasks[0].title = 'Min lokale tittel'
    const same = draft(state, text), changed = draft(state, text.replace('20261026', '20261027'), 'b', state.importSources[0].id)
    expect(documentSourceChanged(same.rows[0], same, state)).toBe(false)
    expect(documentSourceChanged(changed.rows[0], changed, state)).toBe(true)
  })
  it('accepts RDATE periods with either an end or a duration through ICAL', () => {
    const result = parseDocumentIcs(calendar(event('periods', 'Forelesning', 'RDATE;VALUE=PERIOD:20261102T090000Z/20261102T120000Z,20261109T090000Z/PT2H')))
    expect(result.rows.filter(row => row.kind === 'event').map(row => [row.originalStart, row.originalEnd])).toEqual([
      ['2026-10-26T09:00:00.000Z', '2026-10-26T10:00:00.000Z'],
      ['2026-11-02T09:00:00.000Z', '2026-11-02T12:00:00.000Z'],
      ['2026-11-09T09:00:00.000Z', '2026-11-09T11:00:00.000Z'],
    ])
  })
  it('does not create a course from incidental room text or personal metadata', () => {
    for (const text of [calendar(event('room', 'Møte ROM101')), calendar(event('personal', 'SYN101 egen aktivitet', `${metadata('SYN101', '')}\r\nX-STUDIEPLAN-ACTIVITY-KIND:personal`))]) {
      const preview = draft(empty(), text)
      expect(preview.rows).toHaveLength(1)
      expect(preview.rows[0].courseChoice).toBe('')
      expect(save(empty(), preview).planner.courses).toHaveLength(0)
    }
  })
  it('commits existing and new courses plus unknown teaching and exam together, preserving IDs through reimport and undo', () => {
    const before = empty(); before.planner.courses.push(course('existing', 'SYN101'))
    const text = calendar(event('a', 'SYN101 Forelesning', metadata('SYN101', 'Syntetisk A')), event('b', 'SYN102 Eksamen', `${metadata('SYN102', 'Syntetisk B')}\r\nX-STUDIEPLAN-ACTIVITY-KIND:exam`), event('c'))
    const preview = draft(before, text), state = save(before, preview)
    expect(state.planner.courses).toHaveLength(2)
    expect(state.planner.courses[0]).toEqual(before.planner.courses[0])
    expect(state.planner.events.map(item => item.courseId)).toEqual(['existing', state.planner.courses[1].id, ''])
    expect(state.planner.events[1].activityKind).toBe('exam')
    const reloaded = JSON.parse(JSON.stringify(state)); reloaded.planner.events[0].notes = 'Syntetisk lokalt notat'
    const again = save(reloaded, draft(reloaded, text))
    expect(again.planner).toEqual(reloaded.planner)
    expect(validImportSources(again.importSources, again)).toBe(true)
    const history = recordChange(before, state, undefined, 'Syntetisk filimport')
    expect(undoLast(state, history).state).toEqual(before)
    const edited = structuredClone(state); edited.planner.events[0].notes = 'Senere endring'
    expect(undoLast(edited, history).ok).toBe(false)
  })

  it('does not invent course names or institutional context, and requires ambiguous identity choices', () => {
    const before = empty(); before.planner.courses.push(course('a', 'SYN101', 'Syntetisk A'), course('b', 'SYN101', 'Syntetisk B'))
    const preview = draft(before, calendar(event('a', 'SYN101 Forelesning'), event('b', 'Forelesning')))
    expect(preview.rows[0]).toMatchObject({ kind: 'course', title: '', university: '', credits: null, courseTarget: '?' })
    expect(preview.rows.at(-1).courseChoice).toBe('')
    expect(buildDocumentImportCommit(before, preview).ok).toBe(false)
    preview.rows[0].courseTarget = 'b'
    expect(save(before, preview).planner.events[0].courseId).toBe('b')
    const unassigned = draft(empty(), calendar(event('code-only', 'SYN999 Forelesning')))
    unassigned.rows[0].selected = false; unassigned.rows[1].courseChoice = ''
    expect(save(empty(), unassigned).planner.events[0].courseId).toBe('')
    const mismatch = empty(); mismatch.planner.courses.push(course('old', 'SYN101', 'Syntetisk institusjon', 2025))
    const newPeriod = draft(mismatch, calendar(event('a', 'SYN101', metadata('SYN101', 'Syntetisk nytt emne'))))
    expect(newPeriod.rows[0].courseTarget).toBe('')
  })

  it('retains UID and occurrence identity through title/time/course changes, and never merges new UIDs or independent sources', () => {
    const text = calendar(event('a'))
    const state = save(empty(), draft(empty(), text)), id = state.planner.events[0].id
    state.planner.events[0].notes = 'Behold'
    const changed = draft(state, calendar(event('a', 'Revidert seminar', '', '20261027')), 'b', state.importSources[0].id)
    const updated = save(state, changed)
    expect(updated.planner.events[0]).toMatchObject({ id, notes: 'Behold', title: 'Revidert seminar' })
    updated.planner.courses.push(course('reassigned', 'SYN999'))
    updated.planner.events[0].courseId = 'reassigned'
    const remapped = save(updated, draft(updated, calendar(event('a', 'Revidert seminar', '', '20261027')), 'b', state.importSources[0].id))
    expect(remapped.planner.events[0]).toMatchObject({ id, courseId: 'reassigned', notes: 'Behold' })
    const newUid = save(updated, draft(updated, calendar(event('new', 'Revidert seminar', '', '20261027')), 'c', state.importSources[0].id))
    expect(newUid.planner.events).toHaveLength(2)
    const independent = save(state, draft(state, calendar(event('a', 'Annen fil')), 'd'))
    expect(independent.planner.events).toHaveLength(2)
    expect(independent.importSources).toHaveLength(2)
  })

  it('preserves missing events and applies explicit cancellation only after review', () => {
    const state = save(empty(), draft(empty(), calendar(event('a'), event('b', 'Seminar'))))
    const revised = save(state, draft(state, calendar(event('a')), 'b', state.importSources[0].id))
    expect(revised.planner.events).toHaveLength(2)
    const cancellation = calendar('BEGIN:VEVENT\r\nUID:b\r\nSTATUS:CANCELLED\r\nEND:VEVENT')
    const preview = draft(revised, cancellation, 'c', state.importSources[0].id)
    expect(revised.planner.events.every(item => !item.cancelled)).toBe(true)
    expect(save(revised, preview).planner.events.find(item => item.title === 'Seminar').cancelled).toBe(true)
    expect(draft(empty(), cancellation).warnings.join(' ')).toContain('kunne ikke knyttes')
  })

  it('expands finite recurrence across semesters and limits each endless series independently', () => {
    const finite = parsed(calendar(event('a', 'Seminar', 'RRULE:FREQ=MONTHLY;COUNT=8')))
    expect(finite.rows.filter(row => row.kind === 'event')).toHaveLength(8)
    expect(finite.rows.at(-1).startLocal).toContain('2027-05-26')
    const endless = parsed(calendar(event('a', 'Seminar', 'RRULE:FREQ=MONTHLY'), event('b', 'Senere enkeltdato', '', '20301026')))
    expect(endless.rows.filter(row => row.title === 'Seminar')).toHaveLength(6)
    expect(endless.warnings.join(' ')).toContain('seks måneder')
    expect(endless.rows.find(row => row.title === 'Senere enkeltdato').startLocal).toContain('2030-10-26')
    expect(() => parsed(calendar(event('a', 'Seminar', 'RRULE:FREQ=SECONDLY;COUNT=20001')))).toThrow(/omfattende/)
  })

  it('does not auto-select a personal group, and preserves cancelled recurrence exceptions', () => {
    const text = calendar(event('a', 'Seminar', 'RRULE:FREQ=WEEKLY;COUNT=3\r\nX-GROUP:Syntetisk gruppe 1'), 'BEGIN:VEVENT\r\nUID:a\r\nRECURRENCE-ID:20261102T090000Z\r\nSTATUS:CANCELLED\r\nEND:VEVENT')
    const result = parsed(text)
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every(row => !row.selected && row.requiresGroupChoice)).toBe(true)
    expect(result.cancellations).toHaveLength(1)
  })

  it('refreshes full-state changes while retaining edits and requires renewed decisions for changed conflicts', () => {
    const text = calendar(event('a'))
    const state = save(empty(), draft(empty(), text)); state.planner.events[0].title = 'Lokalt navn'
    const preview = draft(state, calendar(event('a', 'Kildens nye navn')), 'b', state.importSources[0].id)
    preview.rows[0].conflictChoices.title = 'local'; preview.rows[0].location = 'Mitt rom'
    state.planner.events[0].title = 'Endret igjen'; state.studyTimePreference = { preset: 'morning' }
    expect(buildDocumentImportCommit(state, preview).stale).toBe(true)
    const refreshed = refreshDocumentImportPreview(state, preview)
    expect(refreshed.rows[0].location).toBe('Mitt rom')
    expect(refreshed.rows[0].conflictChoices.title).toBeUndefined()
    expect(buildDocumentImportCommit(state, refreshed).ok).toBe(false)
    refreshed.rows[0].conflictChoices.title = 'local'
    refreshDocumentConflicts(state, refreshed)
    expect(refreshed.rows[0].conflictChoices.title).toBe('local')
    delete state.studyTimePreference
    const final = refreshDocumentImportPreview(state, refreshed)
    expect(save(state, final).planner.events[0]).toMatchObject({ title: 'Endret igjen', location: 'Mitt rom' })
  })

  it('preserves explicitly personal multi-day all-day dates, provenance and editable interval without reclassifying unknown teaching', () => {
    const text = calendar('BEGIN:VEVENT\r\nUID:personal\r\nSUMMARY:Syntetisk egen avtale\r\nDTSTART;VALUE=DATE:20261026\r\nDTEND;VALUE=DATE:20261029\r\nX-STUDIEPLAN-ACTIVITY-KIND:personal\r\nEND:VEVENT', event('teaching'))
    const state = save(empty(), draft(empty(), text)), own = state.planner.events.find(item => item.activityKind === 'personal')
    expect(own).toMatchObject({ dateLocal: '2026-10-26', allDay: true, courseId: '' })
    expect(entriesForDay(calendarEntries(state), '2026-10-28').find(item => item.id === own.id)).toMatchObject({ kind: 'personal', allDay: true })
    expect(calendarEntries(state).find(item => item.title === 'Forelesning').kind).toBe('teaching')
    const edited = validateEvent({ title: own.title, courseId: '', startLocal: '2026-10-26T00:00', endLocal: '2026-10-30T00:00', notes: 'Syntetisk notat' }, own)
    state.planner.events[state.planner.events.indexOf(own)] = edited
    expect(validPlanner(state.planner)).toBe(true); expect(validImportSources(state.importSources, state)).toBe(true)
    expect(edited.importSourceId).toBe(own.importSourceId)
  })
})
