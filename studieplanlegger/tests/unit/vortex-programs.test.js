import { readFile } from 'node:fs/promises'
import { describe, it, expect, vi } from 'vitest'
import { canonicalVortexProgramUrl, parseVortexCatalogue, parseVortexCohorts, parseVortexPlan, vortexPrograms } from '../../server/providers/vortex-programs.js'

const fixture = name => readFile(new URL(`../fixtures/vortex-programs/${name}`, import.meta.url), 'utf8')
const sources = {
  himolde: { root: 'https://www.himolde.no/studier/programmer/', code: 'logistikk-scm', plan: 'https://www.himolde.no/studier/programmer/logistikk-scm/studieplaner/2026.html' },
  nih: { root: 'https://www.nih.no/studier/programmer/', code: 'bachelor-i-trenerrollen-og-idrettspsykologi', plan: 'https://www.nih.no/studier/programmer/bachelor-i-trenerrollen-og-idrettspsykologi/programplaner/2026h.html' },
  hiof: { root: 'https://www.hiof.no/studier/programmer/', code: 'bedok-bedriftsokonomi-arsstudium', plan: 'https://www.hiof.no/studier/programmer/bedok-bedriftsokonomi-arsstudium/studieplaner/h2026.html' }
}

describe('shared conservative Vortex programme source', () => {
  it('canonicalizes slash/index variants and retains distinct transition programmes', async () => {
    const molde = parseVortexCatalogue('himolde', await fixture('himolde-catalogue.html'), sources.himolde.root)
    expect(molde.results).toHaveLength(2)
    expect(molde.results.find(row => row.code === 'logistikk-scm').name).toBe('Logistikk og Supply Chain Management')
    expect(canonicalVortexProgramUrl('himolde', `${sources.himolde.root}logistikk-scm/index.html`).href).toBe(`${sources.himolde.root}logistikk-scm/`)
    const hiof = parseVortexCatalogue('hiof', await fixture('hiof-catalogue.html'), sources.hiof.root)
    expect(hiof.results.map(row => row.code)).toEqual(['bedok-bedriftsokonomi-arsstudium', '2-3bokad-okonomi-og-administrasjon--fra-og-med-2.-studiear'])
  })

  it('discovers only actually linked Molde cohorts and preserves unknown calendar placement', async () => {
    const programUrl = `${sources.himolde.root}${sources.himolde.code}/`, cohorts = parseVortexCohorts('himolde', await fixture('himolde-program.html'), programUrl)
    expect(cohorts.results.map(row => row.cohort)).toEqual(['2026', '2025'])
    const plan = parseVortexPlan('himolde', await fixture('himolde-plan.html'), { program: sources.himolde.code, cohort: '2026', sourceUrl: sources.himolde.plan }, { code: sources.himolde.code, name: 'Logistikk', sourceUrl: programUrl, campuses: [] })
    expect(plan.models[0].periods.map(period => [period.studySemester, period.year, period.semester, period.requiresStudentStudySemester])).toEqual([[null, 2026, 'autumn', true], [null, 2027, 'spring', true]])
    expect(plan.models[0].periods[0].courses.map(course => [course.code, course.choice, course.credits])).toEqual([['LOG220', 'O', 7.5], ['SCM120', '', 7.5]])
    expect(plan.completeness.complete).toBe(false)
  })

  it('requires a student cohort for an unversioned NIH page', async () => {
    const url = `${sources.nih.root}${sources.nih.code}/`, html = await fixture('nih-current-unversioned.html'), cohorts = parseVortexCohorts('nih', html, url)
    expect(cohorts.results).toEqual([expect.objectContaining({ cohort: 'student', requiresStudentCohort: true, sourceUrl: url })])
    const plan = parseVortexPlan('nih', html, { program: sources.nih.code, cohort: '2026', cohortFromStudent: 'true', sourceUrl: url }, { code: sources.nih.code, name: 'Bachelor', sourceUrl: url, campuses: [] })
    expect(plan.program).toMatchObject({ cohort: '2026', cohortFromStudent: true })
    expect(plan.models[0].periods[0]).toMatchObject({ id: 'student-placement', requiresStudentStudySemester: true, year: null, semester: null })
    expect(plan.models[0].periods[0].courses[0]).toMatchObject({ code: 'TI100', requiresSemesterChoice: true, year: null, semester: null })
  })

  it('exposes a concrete linked NIH archive edition but requires explicit historical confirmation', async () => {
    const programUrl = `${sources.nih.root}${sources.nih.code}/`, historical = 'https://www.nih.no/studier/program-og-emneplan-arkiv/bachelor-i-trenerrollen-og-idrettspsykologi-2022.html'
    const catalogue = await fixture('nih-catalogue.html'), programme = await fixture('nih-with-history.html'), plan = await fixture('nih-history-plan.html')
    const fetchText = vi.fn(async url => url === sources.nih.root ? catalogue : url === programUrl ? programme : plan)
    const choices = await vortexPrograms('nih', 'program-cohorts', { program: sources.nih.code, sourceUrl: programUrl }, { fetchText })
    expect(choices.results[0]).toMatchObject({ cohort: '2022', historical: true, requiresHistoricalConfirmation: true })
    const query = { program: sources.nih.code, cohort: '2022', sourceUrl: historical }
    await expect(vortexPrograms('nih', 'program-plan', query, { fetchText })).rejects.toMatchObject({ status: 'invalid-selection' })
    expect((await vortexPrograms('nih', 'program-plan', { ...query, historicalConfirmed: 'true' }, { fetchText })).models[0].name).toContain('Historisk')
  })

  it('reads actual HiØ course lists and keeps an unmarked course type unknown', async () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, plan = parseVortexPlan('hiof', await fixture('hiof-plan.html'), { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })
    expect(plan.models[0].periods.map(period => [period.year, period.semester])).toEqual([[2026, 'autumn'], [2027, 'spring']])
    expect(plan.models[0].periods[0].courses[0]).toMatchObject({ code: 'ØKA101', choice: 'O' })
    expect(plan.models[0].periods[1].courses[0]).toMatchObject({ code: 'SFB10120', choice: '' })
    expect(plan.warnings.join(' ')).toContain('markerer ikke emnet')
  })

  it('uses the calendar heading outside a wrapped course-list section', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`
    const html = `<main><h1>Bedriftsøkonomi</h1><div class="vrtx-fs-study-model"><h3>Høst 2026</h3><div><h3>Obligatoriske emner</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/hvo/oks/2026/host/oka101.html"><span class="course-code">ØKA101</span><span class="course-name">Bedriftsøkonomi</span><span class="course-study-points">10</span></a></li></ul></div></div></main>`
    const plan = parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })
    expect(plan.models[0].periods[0]).toMatchObject({ studySemester: null, year: 2026, semester: 'autumn', requiresStudentStudySemester: true })
    expect(plan.models[0].periods[0].courses[0]).toMatchObject({ code: 'ØKA101', choice: 'O' })
  })

  it('uses a studiesemester only when the source heading states it explicitly', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`
    const html = `<main><h1>Bedriftsøkonomi</h1><div class="vrtx-fs-study-model"><h3>3. semester · Høst 2026</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/oka301.html"><span class="course-code">ØKA301</span><span class="course-name">Fordypning</span></a></li></ul></div></main>`
    const plan = parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })
    expect(plan.models[0].periods[0]).toMatchObject({ id: '3', studySemester: 3, year: 2026, semester: 'autumn' })
    expect(plan.models[0].periods[0].requiresStudentStudySemester).toBeUndefined()
  })

  it('rejects two explicit study semesters for the same calendar term', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, list = (heading, code) => `<h3>${heading}</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/${code.toLowerCase()}.html"><span class="course-code">${code}</span><span class="course-name">Emne ${code}</span></a></li></ul>`
    const html = `<main><h1>Bedriftsøkonomi</h1><div class="vrtx-fs-study-model">${list('1. semester · Høst 2026', 'FEL101')}${list('2. semester · Høst 2026', 'FEL102')}</div></main>`
    expect(() => parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })).toThrow(/koblet til flere studiesemestre/)
  })

  it('rejects one explicit study semester mapped to two calendar terms', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, list = (heading, code) => `<h3>${heading}</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/${code.toLowerCase()}.html"><span class="course-code">${code}</span><span class="course-name">Emne ${code}</span></a></li></ul>`
    const html = `<main><h1>Bedriftsøkonomi</h1><div class="vrtx-fs-study-model">${list('1. semester · Høst 2026', 'FEL101')}${list('1. semester · Vår 2027', 'FEL102')}</div></main>`
    expect(() => parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })).toThrow(/koblet til flere kalenderterminer/)
  })

  it('rejects table captions that map one calendar term to different study semesters', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, table = (caption, code) => `<table><caption>${caption}</caption><tr><th>Emnekode</th><th>Emne</th><th>Studiepoeng</th><th>O/V</th></tr><tr><td>${code}</td><td>Emne ${code}</td><td>10</td><td>O</td></tr></table>`
    const html = `<main><h1>Bedriftsøkonomi</h1>${table('1. semester · Høst 2026', 'TAB101')}${table('2. semester · Høst 2026', 'TAB102')}</main>`
    expect(() => parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })).toThrow(/koblet til flere studiesemestre/)
  })

  it('rejects table captions that map one study semester to different calendar terms', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, table = (caption, code) => `<table><caption>${caption}</caption><tr><th>Emnekode</th><th>Emne</th><th>Studiepoeng</th><th>O/V</th></tr><tr><td>${code}</td><td>Emne ${code}</td><td>10</td><td>O</td></tr></table>`
    const html = `<main><h1>Bedriftsøkonomi</h1>${table('1. semester · Høst 2026', 'TAB101')}${table('1. semester · Vår 2027', 'TAB102')}</main>`
    expect(() => parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })).toThrow(/koblet til flere kalenderterminer/)
  })

  it('keeps the same table course code in two valid explicitly mapped periods', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, table = caption => `<table><caption>${caption}</caption><tr><th>Emnekode</th><th>Emne</th><th>Studiepoeng</th><th>O/V</th></tr><tr><td>TAB100</td><td>Fellesemne</td><td>10</td><td>O</td></tr></table>`
    const html = `<main><h1>Bedriftsøkonomi</h1>${table('1. semester · Høst 2026')}${table('2. semester · Vår 2027')}</main>`
    const plan = parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })
    const courses = plan.models[0].periods.flatMap(period => period.courses)
    expect(plan.models[0].periods.map(period => [period.studySemester, period.year, period.semester])).toEqual([[1, 2026, 'autumn'], [2, 2027, 'spring']])
    expect(courses.map(course => course.sourceRecordId)).toEqual([`${sources.hiof.code}:TAB100`, `${sources.hiof.code}:TAB100`])
    expect(new Set(courses.map(course => course.id)).size).toBe(2)
  })

  it('merges obligatory and elective lists for the same explicit calendar term', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`
    const html = `<main><h1>Bedriftsøkonomi</h1><div class="vrtx-fs-study-model"><h3>Høst 2026</h3>
      <div><h3>Obligatoriske emner</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/oka101.html"><span class="course-code">ØKA101</span><span class="course-name">Bedriftsøkonomi</span></a></li></ul></div>
      <div><h3>Valgemner</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/val100.html"><span class="course-code">VAL100</span><span class="course-name">Valgemne</span></a></li></ul></div></div></main>`
    const plan = parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })
    expect(plan.models).toHaveLength(1)
    expect(plan.models[0].periods).toHaveLength(1)
    expect(plan.models[0].periods[0].courses.map(course => [course.code, course.choice])).toEqual([['ØKA101', 'O'], ['VAL100', 'V']])
  })

  it('deduplicates identical rows but rejects conflicting O/V or course metadata in one period', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, row = (section, name = 'Fellesemne', points = '10') => `<div><h3>${section}</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/fel100.html"><span class="course-code">FEL100</span><span class="course-name">${name}</span><span class="course-study-points">${points}</span></a></li></ul></div>`
    const wrap = body => `<main><h1>Bedriftsøkonomi</h1><div class="vrtx-fs-study-model"><h3>Høst 2026</h3>${body}</div></main>`
    const query = { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, program = { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] }
    expect(parseVortexPlan('hiof', wrap(row('Obligatoriske emner') + row('Obligatoriske emner')), query, program).models[0].periods[0].courses).toHaveLength(1)
    expect(() => parseVortexPlan('hiof', wrap(row('Obligatoriske emner') + row('Valgemner')), query, program)).toThrow(/motstridende/)
    expect(() => parseVortexPlan('hiof', wrap(row('Obligatoriske emner') + row('Obligatoriske emner', 'Annet navn')), query, program)).toThrow(/motstridende/)
    expect(() => parseVortexPlan('hiof', wrap(row('Obligatoriske emner') + row('Obligatoriske emner', 'Fellesemne', '5')), query, program)).toThrow(/motstridende/)
  })

  it('keeps separate published model roots separate', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, list = (code, name) => `<h3>Høst 2026</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/${code.toLowerCase()}.html"><span class="course-code">${code}</span><span class="course-name">${name}</span></a></li></ul>`
    const html = `<main><h1>Bedriftsøkonomi</h1><div class="vrtx-fs-study-model">${list('MOD101', 'Modell én')}</div><div class="vrtx-fs-study-model">${list('MOD201', 'Modell to')}</div></main>`
    const plan = parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })
    expect(plan.models).toHaveLength(2)
    expect(new Set(plan.models.map(model => model.id)).size).toBe(2)
    expect(plan.models.map(model => model.periods[0].courses[0].code)).toEqual(['MOD101', 'MOD201'])
  })

  it('creates an importable clarification period when every list lacks a calendar term', () => {
    const programUrl = `${sources.nih.root}${sources.nih.code}/`
    const html = `<main><h1>Bachelor</h1><div class="vrtx-fs-study-model"><h3>Obligatoriske emner</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/ti100.html"><span class="course-code">TI100</span><span class="course-name">Treningslære</span></a></li></ul></div></main>`
    const plan = parseVortexPlan('nih', html, { program: sources.nih.code, cohort: '2026', cohortFromStudent: 'true', sourceUrl: programUrl }, { code: sources.nih.code, name: 'Bachelor', sourceUrl: programUrl, campuses: [] })
    expect(plan.models[0].unplacedCourses).toBeUndefined()
    expect(plan.models[0].periods[0]).toMatchObject({ id: 'student-placement', requiresStudentStudySemester: true })
    expect(plan.models[0].periods[0].courses[0]).toMatchObject({ code: 'TI100', requiresSemesterChoice: true })
  })

  it('keeps the same source record stable but gives its period occurrences distinct ids', () => {
    const programUrl = `${sources.hiof.root}${sources.hiof.code}/`, list = term => `<h3>${term}</h3><ul class="course-list"><li><a class="course-link" href="/studier/emner/fel100.html"><span class="course-code">FEL100</span><span class="course-name">Fellesemne</span></a></li></ul>`
    const html = `<main><h1>Bedriftsøkonomi</h1><div class="vrtx-fs-study-model">${list('Høst 2026')}${list('Vår 2027')}</div></main>`
    const plan = parseVortexPlan('hiof', html, { program: sources.hiof.code, cohort: '2026', sourceUrl: sources.hiof.plan }, { code: sources.hiof.code, name: 'Bedriftsøkonomi', sourceUrl: programUrl, campuses: [] })
    const courses = plan.models[0].periods.flatMap(period => period.courses)
    expect(courses.map(course => course.sourceRecordId)).toEqual([`${sources.hiof.code}:FEL100`, `${sources.hiof.code}:FEL100`])
    expect(new Set(courses.map(course => course.id)).size).toBe(2)
    expect(courses.every(course => course.id.includes('h2026.html'))).toBe(true)
  })

  it('reads the actual NIH programplan list variant with explicit calendar periods', async () => {
    const programUrl = `${sources.nih.root}${sources.nih.code}/`, cohorts = parseVortexCohorts('nih', await fixture('nih-current.html'), programUrl)
    expect(cohorts.results.map(row => row.cohort)).toEqual(['2026', '2025'])
    const plan = parseVortexPlan('nih', await fixture('nih-plan.html'), { program: sources.nih.code, cohort: '2026', sourceUrl: sources.nih.plan }, { code: sources.nih.code, name: 'Bachelor', sourceUrl: programUrl, campuses: [] })
    expect(plan.models[0].periods.map(period => [period.studySemester, period.year, period.semester, period.requiresStudentStudySemester])).toEqual([[null, 2026, 'autumn', true], [null, 2027, 'spring', true]])
    expect(plan.models[0].periods.flatMap(period => period.courses).map(course => course.code)).toEqual(['IDR107', 'IDR109'])
  })

  it('validates catalogue membership, linked plans, cohorts and source origins', async () => {
    const catalogue = await fixture('himolde-catalogue.html'), programme = await fixture('himolde-program.html'), plan = await fixture('himolde-plan.html'), programUrl = `${sources.himolde.root}${sources.himolde.code}/`
    const fetchText = vi.fn(async (url, _depth, guard) => { guard(new URL(url)); return url === sources.himolde.root ? catalogue : url === programUrl ? programme : plan })
    const result = await vortexPrograms('himolde', 'program-plan', { program: sources.himolde.code, cohort: '2026', sourceUrl: sources.himolde.plan }, { fetchText })
    expect(result.status).toBe('ok')
    await expect(vortexPrograms('himolde', 'program-plan', { program: sources.himolde.code, cohort: '2024', sourceUrl: sources.himolde.plan }, { fetchText })).rejects.toMatchObject({ status: 'invalid-selection' })
    expect(() => canonicalVortexProgramUrl('himolde', 'http://127.0.0.1/studier/programmer/x/')).toThrow()
    expect(() => canonicalVortexProgramUrl('hiof', 'https://www.hiof.no.example.com/studier/programmer/x/')).toThrow()
  })
})
