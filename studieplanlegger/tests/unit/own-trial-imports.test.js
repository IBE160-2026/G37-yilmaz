import { describe, expect, it } from 'vitest'
import { parseCalendar } from '../../src/calendar-import.js'
import { teachingCalendarResult, teachingCheckText, checkedTeaching } from '../../src/teaching-check.js'
import { createCalendarSync } from '../../src/calendar-sync.js'
import { emptyPlanner, resolveImportedCourse, validPlanner } from '../../src/planner.js'
import { courseCampusLabel, teachingStatusLabel } from '../../src/program-import-model.js'
import { parseNtnuPage } from '../../server/import-api.js'
import { parseUitPdf } from '../../server/providers/uit-pdf.js'

const calendar = content => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ajour synthetic regression//NO\r\n${content}END:VCALENDAR\r\n`
const parse = content => parseCalendar(calendar(content), { courseId: 'synthetic', year: 2026, semester: 'autumn' })

describe('owner-trial import distinctions', () => {
  it('distinguishes a valid empty source, filtered events and rejected events', () => {
    const empty = teachingCalendarResult(parse(''))
    expect(empty.status).toBe('empty')
    expect(empty.detail).toContain('uttrekket er tomt')
    expect(empty.detail).toContain('bekrefter ikke at emnet mangler undervisning')
    const event = 'BEGIN:VEVENT\r\nUID:synthetic\r\nSUMMARY:Synthetic teaching\r\nDTSTART:20260115T090000Z\r\nDTEND:20260115T100000Z\r\nEND:VEVENT\r\n'
    expect(teachingCalendarResult(parse(event))).toMatchObject({ status: 'empty', detail: expect.stringContaining('ingen økter i valgt semester') })
    expect(() => teachingCalendarResult(parse(event.replace('DTSTART:20260115T090000Z', 'DTSTART:not-a-date')))).toThrow(/importfeil/)
    expect(teachingCalendarResult(parse(event.replaceAll('20260115', '20261030')))).toEqual({ status: 'success', detail: '' })
    expect(teachingStatusLabel('unsupported')).toContain('støttes ikke')
    expect(teachingCheckText({ status: 'empty', lastAttempt: '2026-10-29T18:00:00Z' })).toContain('valgt offentlig kalender')
  })

  it('retains an explicit campus fact and distinguishes student programme selection from course evidence', () => {
    const html = '<div id="course-details" data-coursecode="TEST101"><h1 class="course-name">Synthetic course</h1><select id="selectedYear"><option value="2026" selected>2026</option></select><div class="course-fact"><span class="course-fact-label">Sted</span><span class="course-fact-value">Trondheim</span></div></div>'
    const { course } = parseNtnuPage(html, { code: 'TEST101', semester: 'autumn', year: 2026, sourceUrl: 'https://www.ntnu.no/studier/emner/TEST101/2026' })
    expect(course.campus).toBe('Trondheim')
    expect(courseCampusLabel(course)).toBe('Campus (emnekilden): Trondheim')
    expect(courseCampusLabel({ campus: '', programBinding: { campus: 'Oslo' } })).toBe('Campus valgt i studieplan: Oslo')
    expect(courseCampusLabel({ campus: '' })).toBe('Campus: Ikke oppgitt')
  })

  it('keeps published multiple campuses as source evidence and resolves only the selected published campus', () => {
    const query = { code: 'TEST101', semester: 'autumn', year: 2026, sourceUrl: 'https://www.ntnu.no/studier/emner/TEST101/2026' }
    const html = '<div id="course-details" data-coursecode="TEST101"><h1 class="course-name">Synthetic course</h1><select id="selectedYear"><option value="2026" selected>2026</option></select><div class="course-fact"><span class="course-fact-label">Sted</span><span class="course-fact-value"><div>Gjøvik</div><div>Trondheim</div><div>Ålesund</div></span></div></div>'
    const ambiguous = parseNtnuPage(html, query)
    expect(ambiguous.course.campus).toBe('')
    expect(ambiguous.course.notes).toContain('Gjøvik, Trondheim, Ålesund')
    expect(ambiguous.warnings).toContain(ambiguous.course.notes)
    const selected = parseNtnuPage(html, { ...query, campus: 'Trondheim' }).course
    expect(selected.campus).toBe('Trondheim')
    expect(selected.notes).toContain('Valgt publisert campus: Trondheim')
    const bound = { ...selected, programBinding: { campus: 'Trondheim' } }
    expect(resolveImportedCourse(emptyPlanner(), bound)).toEqual(bound)
    expect(() => resolveImportedCourse(emptyPlanner(), { ...bound, programBinding: { campus: 'Oslo' } })).toThrow(/Valgt campus avviker/)
    expect(() => parseNtnuPage(html, { ...query, campus: 'Oslo' })).toThrow(/finnes ikke blant studiestedene/)
  })

  it.each(['invalid', 'partial'])('preserves imported teaching, choices and last success during %s background refresh', async outcome => {
    const stamp = '2026-10-28T08:00:00.000Z', now = new Date('2026-10-29T08:00:00.000Z')
    const course = checkedTeaching({ id: 'synthetic', code: 'TEST101', name: 'Synthetic', university: 'NTNU', semester: 'autumn', year: 2026, notes: 'Studentens emnenotat' }, 'success', { now: new Date(stamp), eventCount: 1 })
    const source = { id: 'saved-source', courseId: course.id, name: 'Synthetic', kind: 'url', url: 'https://example.test/source.ics', groups: ['Synthetic teaching'], excludedKeys: ['hidden'], allGroups: ['Synthetic teaching'], lastUpdated: stamp, lastSuccess: stamp }
    const event = { id: 'saved-event', courseId: course.id, sourceId: source.id, sourceKey: 'saved-key', title: 'Saved teaching', start: '2026-10-30T10:00:00.000Z', end: '2026-10-30T11:00:00.000Z', notes: 'Studentens øktnotat', group: 'Synthetic teaching' }
    const previous = { ...emptyPlanner(), courses: [course], sources: [source], events: [event] }
    let state = { planner: structuredClone(previous) }
    const valid = 'BEGIN:VEVENT\r\nUID:new-valid\r\nSUMMARY:Synthetic teaching\r\nDTSTART:20261030T090000Z\r\nDTEND:20261030T100000Z\r\nEND:VEVENT\r\n'
    const invalid = 'BEGIN:VEVENT\r\nUID:invalid\r\nSUMMARY:Invalid\r\nDTSTART:bad\r\nEND:VEVENT\r\n'
    const sync = createCalendarSync({ getState: () => state, commit: planner => { state = { planner }; return true }, isEditing: () => false, visible: () => true, clock: () => now.getTime(), fetchText: async () => calendar((outcome === 'partial' ? valid : '') + invalid) })
    await sync.tick()
    expect(state.planner.events.find(item => item.id === event.id)).toEqual(event)
    expect(state.planner.sources[0]).toMatchObject({ id: source.id, groups: source.groups, excludedKeys: source.excludedKeys })
    expect(state.planner.courses[0].notes).toBe(course.notes)
    if (outcome === 'invalid') {
      expect(state.planner.events).toEqual(previous.events)
      expect(state.planner.sources[0]).toMatchObject({ lastSuccess: stamp, lastUpdated: stamp, failures: 1 })
      expect(state.planner.courses[0].teachingCheck).toMatchObject({ status: 'invalid-response', eventCount: 1, lastSuccess: stamp, lastAttempt: now.toISOString(), detail: expect.stringContaining('importfeil') })
    } else {
      expect(state.planner.events).toHaveLength(2)
      expect(state.planner.courses[0].teachingCheck).toMatchObject({ status: 'success', eventCount: 1, detail: expect.stringContaining('Delvis kildeuttrekk: 1 gyldige økter') })
      expect(state.planner.courses[0].teachingCheck.detail).toContain('1 kalenderoppføringer har valideringsfeil')
    }
    expect(validPlanner(state.planner)).toBe(true)
  })

  it('recognizes a missing table even when the PDF page has readable narrative before and after it', () => {
    // Synthetic coordinates and text, shaped after UiT 931776 page 5 inspected
    // 2026-10-29. Its visible semester table is an image, not extractable text.
    // Source: https://uit.no/Content/931776/cache=20261310132856/Studieplan%20Bachelor%20i%20geovitenskap%20H-2025.pdf
    const item = (str, y) => ({ str, transform: [10, 0, 0, 10, 20, y], width: 200 })
    const pages = [
      { page: 1, items: [item('Studieplan Syntetisk bachelor', 700)] },
      { page: 5, items: [item('Forklarende løpende tekst. '.repeat(20), 700), item('Tabell: oppbygging av studieprogram', 500), item('Undervisnings-, lærings- og vurderingsformer', 200), item('Mer løpende tekst. '.repeat(20), 100)] },
    ]
    expect(() => parseUitPdf(pages, { label: 'Syntetisk H-2025', record: 'synthetic' }, { cohort: '2025', cohortFromStudent: 'true' })).toThrow(/selve emnetabellen mangler lesbar tekst/)
    expect(pages[1].items[0].str.length).toBeGreaterThan(150)
  })
})
