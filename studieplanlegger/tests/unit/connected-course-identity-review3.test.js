import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseNhfhPlan, nhfhProgramUrl } from '../../server/providers/nhfh-programs.js'
import { emptyPlanner, mergeCourseOnly, resolveImportedCourse } from '../../src/planner.js'
import { createStorage, STORAGE_KEY, validEnvelope } from '../../src/storage.js'
import { exportBackup, previewBackup } from '../../src/backup.js'

const code = 'bachelor-i-medisin', sourceUrl = `https://nhfh.no/${code}/`
const fixture = JSON.parse(readFileSync(new URL('../fixtures/nhfh-programs.json', import.meta.url), 'utf8'))
const html = rows => `<h1>Bachelor i medisin</h1><div class="tags">180 studiepoeng Oslo Nett</div><main>${rows.map(([name, credits, suffix = '']) => `<p><strong>1. semester: ${name} (${credits} studiepoeng)</strong>${suffix}</p>`).join('')}</main>`
const parsed = rows => parseNhfhPlan(html(rows), { code, sourceUrl, cohort: 2026 })
const binding = { institution: 'nhfh', programCode: code, programName: 'Bachelor i medisin', cohort: '2026', modelId: 'published-current', modelName: 'Publisert emneoversikt', studySemester: 1, calendarYear: 2026, calendarSemester: 'autumn', campus: 'Oslo', choice: '', sourceUrl, checkedAt: '2026-09-19T10:00:00Z' }
const imported = rows => parsed(rows).models[0].periods[0].courses.map(course => ({ ...course, id: `${course.id}:2026:autumn`, year: 2026, semester: 'autumn', notes: '', programBinding: { ...binding } }))
function legacyPlanner() {
  const course = { ...imported([['Alpha', 10]])[0], id: 'local-alpha', sourceRecordId: `${code}:semester-1`, notes: 'Mine notater' }
  const planner = mergeCourseOnly(emptyPlanner(), course)
  planner.events.push({ id: 'local-event', sourceId: 'local-source', courseId: course.id, title: 'Behold undervisning', start: '2026-09-20T10:00:00Z', end: '2026-09-20T11:00:00Z', notes: 'Mitt rom' })
  planner.sources.push({ id: 'local-source', courseId: course.id, kind: 'file', name: 'Min kalender', groups: [], lastUpdated: '2026-09-19T10:00:00Z' })
  return planner
}
const envelope = planner => ({ schemaVersion: 1, tasks: [{ id: 'task', courseId: 'local-alpha', title: 'Behold oppgaven', course: 'Alpha', deadlineLocal: '', estimatedMinutes: null, completed: false }], planner })

describe('R11: NHFH named rows and compatible legacy identities', () => {
  it('retains two named courses in one semester with IDs independent of order, credits and prose', () => {
    const first = imported([['Alpha', 10], ['Beta', 20]])
    const reordered = imported([['Beta', 15, 'Oppdatert beskrivelse'], ['Alpha', 15]])
    expect(first.map(course => course.name)).toEqual(['Alpha', 'Beta'])
    expect(new Set(first.map(course => course.sourceRecordId)).size).toBe(2)
    expect(reordered.map(course => course.sourceRecordId)).toEqual(first.toReversed().map(course => course.sourceRecordId))
    expect(parsed([['Alpha', 10], ['Beta', 20]]).completeness).toMatchObject({ complete: true, returned: 2, total: 2 })
  })

  it('deduplicates an identical repeated source row but rejects distinct rows sharing an ambiguous name', () => {
    expect(imported([['Alpha', 10], ['Alpha', 10]])).toHaveLength(1)
    expect(() => imported([['Alpha', 10], ['Alpha', 20]])).toThrow(/flere ulike rader/)
    expect(() => imported([['Alpha', 10, 'Første del'], ['Alpha', 10, 'Andre del']])).toThrow(/entydig emneidentitet/)
  })

  it.each([false, true])('upgrades only the matching saved row through a two-course edition and exact repeat (reverse=%s)', reverse => {
    const original = legacyPlanner(), before = structuredClone(original)
    original.courses[0].name = 'Mitt lokale navn'
    const rows = imported(reverse ? [['Beta', 20], ['Alpha', 10]] : [['Alpha', 10], ['Beta', 20]])
    let next = rows.reduce(mergeCourseOnly, original)
    expect(next.courses).toHaveLength(2)
    expect(next.courses.find(course => course.id === 'local-alpha')).toMatchObject({ name: 'Mitt lokale navn', notes: 'Mine notater', sourceRecordId: rows.find(course => course.name === 'Alpha').sourceRecordId })
    expect(next.courses.find(course => course.name === 'Beta').id).not.toBe('local-alpha')
    expect(next.events).toEqual(before.events); expect(next.sources).toEqual(before.sources)
    const ids = next.courses.map(course => course.id)
    next = rows.toReversed().reduce(mergeCourseOnly, next)
    expect(next.courses.map(course => course.id)).toEqual(ids)
    expect(original.courses[0].sourceRecordId).toBe(`${code}:semester-1`)
    expect(validEnvelope(envelope(next), { relations: true })).toBe(true)
  })

  it('rejects multiple compatible legacy targets without mutating either row', () => {
    const planner = legacyPlanner()
    planner.courses.push({ ...structuredClone(planner.courses[0]), id: 'duplicate' })
    const before = structuredClone(planner)
    expect(() => mergeCourseOnly(planner, imported([['Alpha', 10]])[0])).toThrow(/tvetydig campus\/emneversjon/)
    expect(planner).toEqual(before)
  })

  it.each([
    course => { course.sourceUrl = 'https://another.test/bachelor-i-medisin/'; course.programBinding.sourceUrl = course.sourceUrl },
    course => { course.programBinding.programCode = 'another-program' },
    course => { course.programBinding.studySemester = 2 },
    course => { course.sourceBase.name = 'Different source name' },
    course => { course.sourceProvider = 'another-provider' },
  ])('does not rebind a legacy row with conflicting source/program/semester/name/provider evidence', alter => {
    const planner = legacyPlanner(); alter(planner.courses[0])
    expect(() => mergeCourseOnly(planner, imported([['Alpha', 10]])[0])).toThrow(/campus\/emneversjon/)
  })

  it('loads an old backup without migration, saves the explicit upgrade once, reloads and roundtrips all relations', () => {
    const original = envelope(legacyPlanner()), values = new Map([[STORAGE_KEY, JSON.stringify(original)]])
    const backing = { getItem: key => values.get(key) ?? null, setItem: vi.fn((key, value) => values.set(key, value)) }
    const storage = createStorage(() => backing)
    expect(storage.read().ok).toBe(true); expect(backing.setItem).not.toHaveBeenCalled()
    const oldBackup = previewBackup(JSON.stringify(exportBackup(original)), { schemaVersion: 1, tasks: [] })
    expect(oldBackup.ok).toBe(true); expect(oldBackup.data.planner).toEqual(original.planner)
    const planner = imported([['Beta', 20], ['Alpha', 10]]).reduce(mergeCourseOnly, original.planner)
    expect(storage.write(original.tasks, undefined, planner)).toEqual({ ok: true })
    expect(backing.setItem).toHaveBeenCalledTimes(1)
    const reloaded = createStorage(() => backing); expect(reloaded.read().ok).toBe(true)
    expect(backing.setItem).toHaveBeenCalledTimes(1)
    const next = JSON.parse(values.get(STORAGE_KEY)), restored = previewBackup(JSON.stringify(exportBackup(next)), { schemaVersion: 1, tasks: [] })
    expect(restored.ok).toBe(true); expect(restored.data).toEqual(next)
    expect(next.tasks).toEqual(original.tasks); expect(next.planner.events).toEqual(original.planner.events); expect(next.planner.sources).toEqual(original.planner.sources)
  })

  it.each([code, 'forside/halvarsstudium-i-anatomi-og-fysiologi'])('retains a captured semester row through the exact known programme path %s', programCode => {
    const url = `https://nhfh.no/${programCode}/`
    expect(nhfhProgramUrl(url).href).toBe(url)
    if (programCode.startsWith('forside/')) expect(fixture.catalogue).toContain(url)
    const row = parseNhfhPlan(fixture.medicine, { code: programCode, sourceUrl: url, cohort: 2026 }).models[0].periods[0].courses[0]
    const incoming = { ...row, year: 2026, semester: 'autumn', notes: '', programBinding: { ...binding, programCode, sourceUrl: url } }
    const old = { ...incoming, id: 'saved-captured-row', sourceRecordId: `${programCode}:semester-1`, name: 'Lokalt navn', notes: 'Behold', sourceBase: { name: row.name, credits: row.credits, description: row.description } }
    const next = mergeCourseOnly({ courses: [old], sources: [], events: [] }, incoming)
    expect(next.courses).toHaveLength(1)
    expect(next.courses[0]).toMatchObject({ id: old.id, name: old.name, notes: old.notes, sourceRecordId: incoming.sourceRecordId })
  })
})

describe('R11 P3-01: explicit NHFH unavailable academic years', () => {
  const nutritionContext = { code: 'bachelor-i-ernaering', sourceUrl: 'https://nhfh.no/bachelor-i-ernaering/', cohort: 2026 }
  it('retains the captured restriction as two calendar semesters and visible source notes without inferring a cohort', () => {
    const plan = parseNhfhPlan(fixture.nutrition, nutritionContext), courses = plan.models[0].periods.flatMap(period => period.courses)
    expect(courses).toHaveLength(6)
    for (const course of courses) expect(course).toMatchObject({ year: null, semester: null, unavailableCalendarPeriods: [{ year: 2026, semester: 'autumn' }, { year: 2027, semester: 'spring' }], sourceAvailabilityNote: 'Studiet tilbys ikke studieåret 2026/2027', notes: 'Studiet tilbys ikke studieåret 2026/2027' })
    expect(plan.warnings.join(' ')).toContain('Studiet tilbys ikke studieåret 2026/2027')
    expect(plan.program).toMatchObject({ cohort: 2026, cohortFromStudent: true })
    expect(parseNhfhPlan(fixture.medicine, { code, sourceUrl, cohort: 2026 }).models[0].periods[0].courses[0]).not.toHaveProperty('unavailableCalendarPeriods')
  })
  it.each(['2026/2028', '2026/28', '2026', 'neste år', '2026/2027/2028', '1899/1900', '2200/2201'])('rejects the explicit malformed/out-of-range exclusion %s', year => {
    expect(() => parseNhfhPlan(fixture.nutrition.replace('Studiet tilbys ikke studieåret 2026/2027', `Studiet tilbys ikke studieåret ${year}`), nutritionContext)).toThrow(/uklart studieår/)
  })
  it('accepts the source short-year spelling while retaining the exact quoted note', () => {
    const course = parseNhfhPlan(fixture.nutrition.replace('Studiet tilbys ikke studieåret 2026/2027', 'Studiet tilbys ikke studieåret 2026/27'), nutritionContext).models[0].periods[0].courses[0]
    expect(course.unavailableCalendarPeriods).toEqual([{ year: 2026, semester: 'autumn' }, { year: 2027, semester: 'spring' }])
    expect(course.sourceAvailabilityNote).toContain('2026/27')
  })
})

describe('R11: student campus remains part of the saved course identity', () => {
  it('rejects Oslo to Bergen even when source campus is empty, and preserves the complete original plan', () => {
    const planner = legacyPlanner(), incoming = imported([['Alpha', 10]])[0], before = structuredClone(planner)
    expect(incoming.campus).toBe(''); expect(planner.courses[0].campus).toBe('')
    incoming.programBinding.campus = 'Bergen'
    expect(() => resolveImportedCourse(planner, incoming)).toThrow(/campus\/emneversjon/)
    expect(planner).toEqual(before)
  })

  it('preserves same-campus ID, notes, links and source verification distinction', () => {
    const planner = legacyPlanner(), incoming = imported([['Alpha', 10]])[0]
    const next = mergeCourseOnly(planner, incoming)
    expect(next.courses[0]).toMatchObject({ id: 'local-alpha', notes: 'Mine notater', campus: '', programBinding: { campus: 'Oslo' } })
    expect(next.courses[0].campusVerified).not.toBe(true)
    expect(next.events).toEqual(planner.events); expect(next.sources).toEqual(planner.sources)
  })

  it('rejects a student selection conflicting with source campus even on the first import', () => {
    const course = imported([['Alpha', 10]])[0]; course.campus = 'Bergen'; course.campusVerified = true
    expect(() => mergeCourseOnly(emptyPlanner(), course)).toThrow(/Valgt campus avviker/)
  })
})
