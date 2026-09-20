import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { calendarRange, calendarEntries, dayBounds, entriesForDay } from '../../src/calendar-model.js'
import { validCalendarPreferences } from '../../src/calendar-preferences.js'
import { dailyOverview } from '../../src/daily-overview.js'
import { exportBackup, previewBackup } from '../../src/backup.js'
import { resolveImportedCourse, mergeCourseOnly, mergeImport } from '../../src/planner.js'
import { disappearancePolicy } from '../../src/source-coverage.js'
import { publicCourseUrl } from '../../server/providers/public-course.js'
import { searchUib, uibDetails } from '../../server/providers/uib.js'
import { searchUit, uitDetails } from '../../server/providers/uit.js'
import { providerRequest } from '../../server/providers/index.js'

const fixtures = Object.fromEntries(['uib-search', 'uib-course', 'uit-search', 'uit-course'].map(name => [name, readFileSync(new URL(`../fixtures/public-courses/${name}.html`, import.meta.url), 'utf8')]))
const query = { q: 'INF100', code: 'INF100', semester: 'autumn', year: '2026', sourceRecordId: 'inf100', sourceUrl: 'https://www4.uib.no/studier/emner/inf100' }
const uitQuery = { ...query, q: 'FYS-3000', code: 'FYS-3000', sourceRecordId: '923370', sourceUrl: 'https://uit.no/utdanning/emner/emne?p_document_id=923370', campus: 'Tromsø' }
const task = id => ({ id, title: 'Samme tittel', course: 'INF100', deadlineLocal: '2026-09-08T14:00', estimatedMinutes: 90, remainingMinutes: 35, completed: false })
const preferences = { version: 1, date: '2026-09-08', view: 'week', courseId: '', kinds: ['teaching', 'session', 'deadline'], completed: false, cancelled: false, scroll: { 'week:2026-09-08': { top: 520, left: 0 } } }

describe('calendar and daily identities', () => {
  it('keeps legacy seven-day weeks and crosses month/year boundaries with five days', () => {
    expect(calendarRange('2027-01-01', 'week')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
    expect(calendarRange('2027-01-01', 'week', 'workweek')).toHaveLength(5)
    expect(calendarRange('2027-01-08', 'week', 'workweek')[0]).toBe('2027-01-04')
  })
  it('accepts old preferences and roundtrips independent workweek scrolling in backups', () => {
    expect(validCalendarPreferences(preferences)).toBe(true)
    const value = { ...preferences, weekMode: 'workweek', scroll: { ...preferences.scroll, 'week:2026-09-08:workweek': { top: 600, left: 20 } } }
    const state = { schemaVersion: 1, tasks: [], calendarPreferences: value }
    expect(previewBackup(JSON.stringify(exportBackup(state)), state).data.calendarPreferences).toEqual(value)
    expect(validCalendarPreferences({ ...value, weekMode: 'invalid' })).toBe(false)
    expect(validCalendarPreferences({ ...value, scroll: { 'day:2026-09-08:workweek': { top: 0, left: 0 } } })).toBe(false)
  })
  it('joins task sessions and deadlines by ID without collapsing equal titles', () => {
    const model = { now: new Date('2026-09-08T07:00:00Z'), tasks: [task('a'), task('b')], sessions: [{ id: 's1', taskId: 'a', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }, { id: 's2', taskId: 'a', dateLocal: '2026-09-08', startTime: '12:00', endTime: '12:30' }] }
    const result = dailyOverview(model)
    expect(result.rows.map(row => row.key)).toEqual(['task:a', 'task:b'])
    expect(result.rows[0].sessions.map(s => s.id)).toEqual(['s1', 's2'])
    expect(result.rows[0].deadline.id).toBe('a')
    expect(result.rows[1].sessions).toEqual([])
  })
  it('does not join an unlinked session by its title and keeps submission work visible', () => {
    const result = dailyOverview({ now: new Date('2026-09-08T07:00:00Z'), tasks: [{ ...task('a'), completed: true, requiresSubmission: true, submitted: false }], sessions: [{ id: 's1', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }] })
    expect(result.rows).toHaveLength(1); expect(result.rows[0].sessions).toEqual([]); expect(result.today).toHaveLength(1)
  })
  it('retains exact short duration, midnight clipping and 23/25-hour Oslo days', () => {
    const entries = calendarEntries({ planner: { events: [{ id: 'short', title: 'Short', start: '2026-09-08T21:58:00Z', end: '2026-09-08T22:03:00Z' }] } })
    const entry = entriesForDay(entries, '2026-09-09')[0]
    expect(entry.end - entry.start).toBe(5 * 60000); expect(entry.clippedEnd - entry.clippedStart).toBe(3 * 60000)
    for (const [date, hours] of [['2026-03-29', 23], ['2026-10-25', 25]]) { const b = dayBounds(date); expect(b.end - b.start).toBe(hours * 3600000) }
  })
})

describe('bounded public metadata adapters', () => {
  it('parses one UiB card despite two links and marks semester verification as pending', async () => {
    const fetchText = vi.fn(async () => fixtures['uib-search']), result = await searchUib(query, fetchText)
    expect(result.results).toHaveLength(1); expect(result.results[0]).toMatchObject({ sourceRecordId: 'inf100', periodVerified: false, campus: '' })
    expect(fetchText).toHaveBeenCalledTimes(1); expect(fetchText.mock.calls[0][0]).toContain('keywords=INF100')
  })
  it.each([['uib', searchUib, query, 10], ['uit', searchUit, uitQuery, 50]])('bounds %s to one page and reports possible truncation', async (id, search, q, count) => {
    const source = fixtures[`${id}-search`], card = source.match(/<article[\s\S]*?<\/article>/)[0]
    const fetchText = vi.fn(async () => source.replace(card, Array(count).fill(card).join('\n')))
    const result = await search(q, fetchText)
    expect(fetchText).toHaveBeenCalledTimes(1); expect(result.truncated).toBe(true); expect(result.warnings.join(' ')).toContain('én resultatside')
  })
  it('uses published UiB version options and verifies the returned selected period', async () => {
    const fetchText = vi.fn(async url => url.includes('2026V') ? fixtures['uib-course'].replace('<option selected', '<option').replace('<option value="https://www4', '<option selected value="https://www4') : fixtures['uib-course'])
    const result = await uibDetails({ ...query, semester: 'spring' }, fetchText)
    expect(result.course).toMatchObject({ sourceVersion: '2026V', credits: 10, sourceRecordId: 'inf100' }); expect(fetchText).toHaveBeenCalledTimes(2)
    await expect(uibDetails({ ...query, year: '2020' }, async () => fixtures['uib-course'])).rejects.toMatchObject({ status: 'semester-unavailable' })
    await expect(uibDetails({ ...query, semester: 'spring' }, async () => fixtures['uib-course'])).rejects.toMatchObject({ status: 'semester-unavailable' })
  })
  it('retains UiT opaque record, campus and content period despite placeholder selector', async () => {
    const search = await searchUit(uitQuery, async () => fixtures['uit-search'])
    expect(search.results[0]).toMatchObject({ sourceRecordId: '923370', campus: 'Tromsø', semester: 'autumn', year: 2026 })
    const data = await uitDetails(uitQuery, async () => fixtures['uit-course'])
    expect(data.course).toMatchObject({ sourceRecordId: '923370', campus: 'Tromsø', sourceVersion: '2026H', credits: 10 })
    expect(data.calendarUrl).toBeNull(); expect(data.entryUrl).toContain('/uit/app/schedule')
    await expect(uitDetails({ ...uitQuery, campus: 'Alta' }, async () => fixtures['uit-course'])).rejects.toMatchObject({ status: 'campus-unavailable' })
    await expect(uitDetails({ ...uitQuery, semester: 'spring' }, async () => fixtures['uit-course'])).rejects.toMatchObject({ status: 'semester-unavailable' })
    await expect(uitDetails(uitQuery, async () => fixtures['uit-course'].replace('/923370/', '/923371/'))).rejects.toMatchObject({ status: 'invalid-selection' })
  })
  it.each(['https://127.0.0.1/studier/emner/inf100', 'https://www4.uib.no.evil.invalid/studier/emner/inf100', 'https://www4.uib.no/login', 'https://user:password@www4.uib.no/studier/emner/inf100', 'https://www4.uib.no/studier/emner/inf100?start_semester=2026H&start_semester=2025H'])('rejects invalid provider URLs: %s', url => {
    expect(() => publicCourseUrl(url, 'uib', 'inf100')).toThrow()
  })
  it('carries the record and institution guard to every redirect', async () => {
    const fetchText = async (_url, _redirects, validate) => { validate(new URL('https://uit.no/utdanning/emner/emne?p_document_id=923371')); return fixtures['uit-course'] }
    await expect(uitDetails(uitQuery, fetchText)).rejects.toMatchObject({ status: 'invalid-selection' })
  })
  it.each([['HTTP 403', 'transport-error'], ['HTTP 404', 'not-found'], ['timeout', 'transport-error']])('distinguishes %s without inferring login from HTTP denial', async (message, status) => {
    expect((await providerRequest('uib', 'search', query, { fetchText: async () => { throw Error(message) } })).status).toBe(status)
  })
  it('distinguishes no results from missing metadata', async () => {
    expect((await searchUib(query, async () => '<input name="keywords">')).status).toBe('no-matching-results')
    const data = await uibDetails(query, async () => fixtures['uib-course'].replace('<dd>10</dd>', '<dd></dd>'))
    expect(data.status).toBe('ok'); expect(data.course.credits).toBeNull(); expect(data.warnings.join(' ')).toContain('Studiepoeng mangler')
  })
})

describe('conservative reimport', () => {
  it('preserves local IDs, notes and task relationships on repeated metadata import', async () => {
    const { course } = await uibDetails(query, async () => fixtures['uib-course'])
    const first = mergeCourseOnly({ courses: [], events: [], sources: [] }, course)
    first.courses[0].id = 'local-course'; first.courses[0].notes = 'Private note'
    const next = mergeCourseOnly(first, course)
    expect(next.courses).toHaveLength(1); expect(next.courses[0]).toMatchObject({ id: 'local-course', notes: 'Private note', sourceRecordId: 'inf100' })
  })
  it('rejects ambiguous records and campus merges', async () => {
    const { course } = await uitDetails(uitQuery, async () => fixtures['uit-course'])
    for (const patch of [{ campus: 'Alta' }, { sourceRecordId: '999999' }, { sourceVersion: '2025H' }]) expect(() => resolveImportedCourse({ courses: [{ ...course, ...patch, id: 'local' }] }, course)).toThrow(/campus\/emneversjon/)
    expect(() => resolveImportedCourse({ courses: [{ ...course, id: 'a' }, { ...course, id: 'b' }] }, course)).toThrow(/tvetydig/)
  })
  it.each(['uib', 'uit'])('does not infer deletions from incomplete new %s timetable sources', id => {
    const course = { id: 'c', code: 'INF100', semester: 'autumn', year: 2026 }, source = { id: 's', kind: 'url', courseId: 'c', url: `https://tp.educloud.no/${id}/app/schedule?semester=26h` }
    const event = { id: 'e', title: 'Keep', sourceId: 's', sourceKey: 'stable', courseId: 'c', start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z' }
    const policy = disappearancePolicy(source, course, { authoritative: true, cancellations: [] })
    expect(policy.authoritative).toBe(false)
    expect(mergeImport({ courses: [course], events: [event], sources: [source] }, [], source, policy).planner.events[0]).toEqual(event)
  })
})
