import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parseSkrivekunstProgramme, skrivekunstPrograms } from '../../server/providers/skrivekunst-programs.js'
import { emptyPlanner, mergeCourseOnly, validPlanner } from '../../src/planner.js'

const fixture = await readFile(new URL('../fixtures/public-programs/skrivekunst-arsstudium.html', import.meta.url), 'utf8')
const sourceUrl = 'https://www.skrivekunst.no/arsstudium/'

describe('Skrivekunstakademiet published year programme', () => {
  it('models the actual 60-credit year programme as one multi-semester unit', () => {
    const parsed = parseSkrivekunstProgramme(fixture), period = parsed.model.periods[0], unit = period.courses[0]
    expect(parsed).toMatchObject({ cohort: '2026', sourceEdition: '2026/27', program: { code: 'arsstudium-skapande-skriving', campuses: ['Bergen'] } })
    expect(period).toMatchObject({ studySemester: null, requiresStudentStudySemester: true, allowedStudySemesters: [1, 2], allowedCalendarPeriodsByStudySemester: { 1: { year: 2026, semester: 'autumn' }, 2: { year: 2027, semester: 'spring' } }, year: null, semester: null })
    expect(period.courses).toHaveLength(1)
    expect(unit).toMatchObject({ code: '', name: 'Årsstudium i skapande skriving', credits: 60, choice: 'O', campus: 'Bergen', spansStudySemesters: [1, 2], requiresSemesterChoice: true })
    expect(unit.notes).toContain('én samlet programenhet')
    expect(period.requirements.join(' ')).not.toMatch(/\bfrist\s+\d|kl\.\s*23/i)
  })

  it('supports catalogue, source year and plan without inventing the separate course', async () => {
    const fetchText = vi.fn(async (_url, _attempt, guard) => { guard?.(new URL(sourceUrl)); return fixture })
    const listed = await skrivekunstPrograms('skrivekunst', 'programs', {}, { fetchText })
    expect(listed.results).toHaveLength(1)
    expect(listed.results.some(row => /Påbygg/i.test(row.name))).toBe(false)
    const query = { program: listed.results[0].code, sourceUrl }
    const cohorts = await skrivekunstPrograms('skrivekunst', 'program-cohorts', query, { fetchText })
    const plan = await skrivekunstPrograms('skrivekunst', 'program-plan', { ...query, cohort: cohorts.results[0].cohort }, { fetchText })
    expect(cohorts.results).toEqual([{ cohort: '2026', label: 'Studieåret 2026/27', sourceUrl }])
    expect(plan.models[0].periods[0].courses).toHaveLength(1)
    expect(plan.completeness).toMatchObject({ complete: true, returned: 1 })
    expect(fetchText).toHaveBeenCalledTimes(1)
  })

  it('keeps one 60-credit identity when the same year unit is imported for both study semesters', () => {
    const parsed = parseSkrivekunstProgramme(fixture), unit = parsed.model.periods[0].courses[0]
    const binding = studySemester => ({
      institution: 'skrivekunst', programCode: parsed.program.code, programName: parsed.program.name,
      cohort: parsed.cohort, modelId: parsed.model.id, modelName: parsed.model.name,
      studySemester, studySemesters: [...unit.spansStudySemesters], studySemesterClarifiedByStudent: true,
      calendarYear: studySemester === 1 ? 2026 : 2027, calendarSemester: studySemester === 1 ? 'autumn' : 'spring',
      calendarClarifiedByStudent: true, campus: 'Bergen', choice: 'O', sourceNotes: unit.notes,
      sourceUrl, checkedAt: '2026-09-19T12:00:00Z'
    })
    const course = studySemester => ({ ...unit, id: `${unit.id}:${studySemester}`, year: studySemester === 1 ? 2026 : 2027, semester: studySemester === 1 ? 'autumn' : 'spring', programBinding: binding(studySemester) })
    let planner = mergeCourseOnly(emptyPlanner(), course(1))
    const stableId = planner.courses[0].id
    planner = mergeCourseOnly(planner, course(2))
    expect(planner.courses).toHaveLength(1)
    expect(planner.courses.reduce((total, row) => total + row.credits, 0)).toBe(60)
    expect(planner.courses[0]).toMatchObject({ id: stableId, year: 2027, semester: 'spring', programBinding: { studySemester: 2, studySemesters: [1, 2], calendarYear: 2027, calendarSemester: 'spring' } })
    expect(validPlanner(planner)).toBe(true)

    const legacy = course(1)
    legacy.id = 'saved-before-multisemester-support'
    delete legacy.programBinding.studySemesters
    let upgraded = mergeCourseOnly(emptyPlanner(), legacy)
    upgraded = mergeCourseOnly(upgraded, course(2))
    expect(upgraded.courses).toHaveLength(1)
    expect(upgraded.courses[0]).toMatchObject({ id: legacy.id, year: 2027, semester: 'spring', programBinding: { studySemester: 2, studySemesters: [1, 2] } })

    const ordinary = studySemester => ({ ...course(studySemester), id: `ordinary-period-${studySemester}`, sourceRecordId: 'ordinary', programBinding: { ...binding(studySemester) } })
    const ordinaryFirst = ordinary(1), ordinarySecond = ordinary(2)
    delete ordinaryFirst.programBinding.studySemesters; delete ordinarySecond.programBinding.studySemesters
    const separate = mergeCourseOnly(mergeCourseOnly(emptyPlanner(), ordinaryFirst), ordinarySecond)
    expect(separate.courses).toHaveLength(2)
  })

  it('rejects changed structure, a substituted source and an unsupported year', async () => {
    expect(() => parseSkrivekunstProgramme(fixture.replace('60 stp.', '30 stp.'))).toThrow(/60 studiepoeng/)
    expect(() => parseSkrivekunstProgramme(fixture.replace('entry-title', 'other-title'))).toThrow(/60 studiepoeng/)
    const fetchText = async () => fixture
    await expect(skrivekunstPrograms('skrivekunst', 'program-cohorts', { program: 'arsstudium-skapande-skriving', sourceUrl: 'https://evil.example/arsstudium/' }, { fetchText })).rejects.toThrow(/utenfor/)
    await expect(skrivekunstPrograms('skrivekunst', 'program-plan', { program: 'arsstudium-skapande-skriving', sourceUrl, cohort: '2025' }, { fetchText })).rejects.toThrow(/bekrefter ikke/)
  })
})
