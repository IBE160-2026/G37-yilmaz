import { describe, it, expect } from 'vitest'
import { searchTimeEdit, hvlTimeEditMetadata } from '../../server/providers/timeedit.js'
import { hostedCalendarSource } from '../../server/hosted-import-policy.js'
import { resolveImportedCourse, mergeCourseOnly } from '../../src/planner.js'
import { hvlSearchHtml, hvlLabels, legacyHvlCourse } from '../helpers/hvl-direct-search.js'

const query = { q: 'DAT100', year: 2026, semester: 'autumn' }
describe('HVL direct TimeEdit metadata (stress report F09)', () => {
  it('separates five published variants, names and actual campuses while preserving raw labels and identities', async () => {
    const result = await searchTimeEdit('hvl', query, async () => hvlSearchHtml)
    expect(result.results).toHaveLength(5)
    expect(result.results.map(item => item.name)).toEqual(Array(5).fill('Grunnleggende programmering'))
    expect(result.results.map(item => item.campus)).toEqual(['', 'Bergen', 'Bergen', 'Førde', 'Haugesund'])
    expect(result.results.map(item => item.campusVerified)).toEqual([false, true, true, true, true])
    expect(result.results.map(item => item.label)).toEqual(hvlLabels)
    expect(result.results[1]).toMatchObject({ code: 'DAT100', variant: 'Bergen - Dataingeniør', sourceObjectId: '72901.36', year: 2026, semester: 'autumn' })
    expect(new Set(result.results.map(item => item.sourceObjectId)).size).toBe(5)
    expect(result.results.every(item => item.credits == null && !item.description)).toBe(true)
  })
  it('never infers a singular campus from an unknown, combined or title-only value', () => {
    for (const variant of ['Bergen / Førde', 'Unknown', 'Bergen og Haugesund', 'Bergen - Førde', 'Bergen - Dataingeniør i Førde']) {
      const label = `DAT100, 2026 HØST, DAT100 ${variant}, Grunnleggende programmering, 2026 HØST`
      expect(hvlTimeEditMetadata(label, 'DAT100', '2026 HØST')).toMatchObject({ campus: '', campusVerified: false, name: 'Grunnleggende programmering' })
    }
    expect(hvlTimeEditMetadata('DAT100 Bergen 2026 HØST', 'DAT100', '2026 HØST')).toMatchObject({ campus: '', campusVerified: false })
    expect(hvlTimeEditMetadata('DAT100, 2026 HØST, Programmering i Bergen, 2026 HØST', 'DAT100', '2026 HØST')).toMatchObject({ campus: '', name: 'Programmering i Bergen' })
  })
  it('keeps TimeEdit record identity distinct for two programmes on the same campus', () => {
    const course = { id: 'synthetic-hvl-record', code: 'DAT100', name: 'Grunnleggende programmering', university: 'HVL', campus: 'Bergen', year: 2026, semester: 'autumn', sourceProvider: 'hvl-timeedit', sourceRecordId: '72901.36', sourceVersion: '2026:autumn' }
    expect(resolveImportedCourse({ courses: [course] }, { ...course })).toEqual(course)
    expect(() => resolveImportedCourse({ courses: [course] }, { ...course, id: 'synthetic-other-record', sourceRecordId: '72902.36' })).toThrow(/emneversjon/)
  })
  for (const index of [0, 1]) it(`repairs only the same legacy HVL object on explicit import, retaining local edits and links (${index})`, async () => {
    const result = await searchTimeEdit('hvl', query, async () => hvlSearchHtml), item = result.results[index]
    const previous = legacyHvlCourse(item, 'Mitt redigerte emnenavn')
    const course = { ...item, id: previous.id, credits: null, description: '', notes: '', sourceProvider: 'hvl-timeedit', sourceRecordId: item.sourceObjectId, sourceVersion: '2026:autumn' }
    const planner = { courses: [previous], events: [{ id: 'keep-event', courseId: previous.id, title: 'Syntetisk avtale', start: '20261101T090000Z', end: '20261101T100000Z', notes: 'Behold' }], sources: [] }, before = structuredClone(planner)
    const resolved = resolveImportedCourse(planner, course)
    expect(resolved.id).toBe(previous.id)
    expect(planner).toEqual(before)
    const merged = mergeCourseOnly(planner, resolved)
    expect(merged.courses).toHaveLength(1)
    expect(merged.courses[0]).toMatchObject({ id: previous.id, name: previous.name, notes: previous.notes, campus: item.campus, campusVerified: item.campusVerified, sourceObjectId: item.sourceObjectId, sourceRecordId: item.sourceObjectId, label: item.label })
    expect(merged.events).toEqual(before.events)
    expect(mergeCourseOnly(merged, course).courses).toHaveLength(1)
    expect(planner).toEqual(before)
    const untouched = mergeCourseOnly({ ...before, courses: [legacyHvlCourse(item)] }, course)
    expect(untouched.courses[0].name).toBe('Grunnleggende programmering')
  })
  it('does not use the legacy repair for another object, source, campus or manually edited source metadata', async () => {
    const { results } = await searchTimeEdit('hvl', query, async () => hvlSearchHtml), item = results[1]
    const previous = legacyHvlCourse(item)
    const course = { ...item, id: previous.id, sourceProvider: 'hvl-timeedit', sourceRecordId: item.sourceObjectId, sourceVersion: '2026:autumn' }
    for (const changes of [{ sourceObjectId: '72902.36', sourceRecordId: '72902.36' }, { campus: 'Førde' }, { sourceUrl: 'https://example.test/not-hvl' }, { sourceUrl: `${item.sourceUrl}&changed=1` }]) {
      expect(() => resolveImportedCourse({ courses: [previous] }, { ...course, ...changes })).toThrow(/campus\/emneversjon/)
    }
    for (const changes of [{ campus: 'Førde' }, { sourceBase: { ...previous.sourceBase, name: 'En annen kildeetikett' } }, { sourceProvider: 'another-provider' }]) {
      expect(() => resolveImportedCourse({ courses: [{ ...previous, ...changes }] }, course)).toThrow(/campus\/emneversjon/)
    }
  })
  it.each([['DAT100', 'Grunnleggende programmering'], ['Grunnleggende programmering', 'DAT100']])('repairs the same old record after changing search from %s to %s', async (oldQuery, newQuery) => {
    const oldItem = (await searchTimeEdit('hvl', { ...query, q: oldQuery }, async () => hvlSearchHtml)).results[1]
    const item = (await searchTimeEdit('hvl', { ...query, q: newQuery }, async () => hvlSearchHtml)).results[1]
    const previous = legacyHvlCourse(oldItem, 'Mitt beholdte emnenavn')
    const course = { ...item, id: previous.id, credits: null, description: '', sourceProvider: 'hvl-timeedit', sourceRecordId: item.sourceObjectId, sourceVersion: '2026:autumn' }
    const planner = { courses: [previous], events: [], sources: [] }, before = structuredClone(planner)
    for (const max of ['100', '1000', '5000']) {
      const changedSize = new URL(item.sourceUrl); changedSize.searchParams.set('max', max)
      const merged = mergeCourseOnly(planner, { ...course, sourceUrl: changedSize.href })
      expect(merged.courses).toHaveLength(1)
      expect(merged.courses[0]).toMatchObject({ id: previous.id, name: previous.name, notes: previous.notes, campus: 'Bergen', sourceRecordId: item.sourceObjectId })
      expect(planner).toEqual(before)
    }
  })
  it('requires the complete known search contract on both old and incoming HVL sources', async () => {
    const item = (await searchTimeEdit('hvl', query, async () => hvlSearchHtml)).results[1]
    const previous = legacyHvlCourse(item)
    const course = { ...item, id: previous.id, sourceProvider: 'hvl-timeedit', sourceRecordId: item.sourceObjectId, sourceVersion: '2026:autumn' }
    const changes = [
      url => url.searchParams.set('fe', '80.2025%20H%C3%98ST'),
      url => url.searchParams.set('sid', '3'), url => url.searchParams.set('types', '5'),
      url => url.searchParams.set('unknown', 'value'), url => url.searchParams.append('sid', '74'),
      url => url.searchParams.delete('objects'), url => url.searchParams.set('max', '5001'),
      url => url.searchParams.set('search_text', ''), url => url.searchParams.set('search_text', 'x'.repeat(121)),
      url => { url.hash = 'changed' }, url => { url.protocol = 'http:' },
    ]
    for (const change of changes) {
      const url = new URL(item.sourceUrl); change(url)
      for (const side of ['old', 'incoming', 'both']) {
        const stored = { ...previous, sourceUrl: side === 'incoming' ? previous.sourceUrl : url.href }
        const incoming = { ...course, sourceUrl: side === 'old' ? course.sourceUrl : url.href }
        expect(() => resolveImportedCourse({ courses: [stored] }, incoming), `${side}: ${url.href}`).toThrow(/campus\/emneversjon/)
      }
    }
  })
})

describe('calendar link boundary (stress report F04)', () => {
  it.each(['https://www.gov.uk/bank-holidays/england-and-wales.ics', 'https://tp.educloud.no/uib/app/schedule?course=INF100&filterOpen=true&pastWeeks=true&scheduleType=course&semester=26h&summary=false&tab=list'])('still rejects unsupported public link %s before transport', url => {
    expect(() => hostedCalendarSource(url)).toThrow(/gjenkjente offentlige studiekilder.*filimport/)
  })
  it('retains recognized public calendar forms', () => {
    for (const url of ['https://tp.educloud.no/ntnu/timeplan/ical.php?sem=26h&id%5B0%5D=HMS0004&type=course', 'https://cloud.timeedit.net/hvl/web/pen/ri.ics?objects=72901.36&p=20260701.x,20261231.x']) expect(() => hostedCalendarSource(url)).not.toThrow()
  })
})
