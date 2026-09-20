import { readFile } from 'node:fs/promises'
import { load } from 'cheerio'
import { describe, it, expect, vi } from 'vitest'
import { phsPrograms, phsDetails, parsePhsCatalogue, parsePhsCohorts, parsePhsPlan, parsePhsNumberedPdf } from '../../server/providers/phs-programs.js'
const fixture = name => readFile(new URL(`../fixtures/phs-programs/${name}.html`, import.meta.url), 'utf8')
const origin = 'https://www.politihogskolen.no', bachelor = `${origin}/studier/politiutdanning/`, master = `${origin}/studier/master-etter-og-videreutdanninger/master-i-politivitenskap/`
const query = { program: 'POLITIUTDANNING', cohort: '2026H' }

describe('PHS published Vortex programmes and actual calendar terms', () => {
  it('reads all 133 current catalogue cards including linked English programmes', async () => {
    const results = parsePhsCatalogue(load(await fixture('catalogue')), origin).results
    expect(results).toHaveLength(133)
    expect(results.filter(row => row.sourceUrl.includes('/english/'))).toHaveLength(17)
    expect(results.find(row => row.code === 'MASTER-I-POLITIVITENSKAP').notes).toContain('ikke opp nye')
  })
  it('reads all published cohort links and keeps source semester in the cohort identity', async () => {
    const results = parsePhsCohorts(load(await fixture('bachelor-cohorts')), `${bachelor}studieplaner/`).results
    expect(results.some(row => row.cohort === '2026H')).toBe(true)
    expect(results.filter(row => !row.requiresStudentCohort).map(row => row.cohort).sort()).toEqual(['2023H', '2024H', '2025H', '2026H'])
    expect(results.filter(row => row.requiresStudentCohort).every(row => row.sourceUrl.endsWith('.pdf'))).toBe(true)
    expect(new Set(results.map(row => row.sourceUrl)).size).toBe(results.length)
  })
  it('preserves actual bachelor calendar terms, split courses, zero credits and available campus choices', async () => {
    const plan = parsePhsPlan(await fixture('bachelor-plan'), query, `${bachelor}studieplaner/2026h.html`), periods = plan.models[0].periods
    expect(plan.program.campuses).toEqual(['Oslo', 'Bodø', 'Stavern', 'Alta'])
    expect(periods.map(period => [period.studySemester, period.year, period.semester, period.courses.length])).toEqual([[1, 2026, 'autumn', 4], [2, 2027, 'spring', 4], [3, 2027, 'autumn', 6], [4, 2028, 'spring', 6], [5, 2028, 'autumn', 4], [6, 2029, 'spring', 4]])
    expect(periods[0].courses.find(course => course.code === 'PATRULJE01-2')).toMatchObject({ credits: 15, choice: 'O', year: 2026, semester: 'autumn' })
    expect(periods[2].courses.find(course => course.code === 'EGNETHET02').credits).toBe(0)
    expect(periods[1].courses[0].sourceUrl).toContain('/2026/host/')
    expect(periods[1].courses[0].year).toBe(2027)
    expect(plan.completeness.returned).toBe(17)
  })
  it('requires a separate fulltime or parttime model and never calls an elective placeholder a course', async () => {
    const plan = parsePhsPlan(await fixture('master-plan'), { program: 'MASTER-I-POLITIVITENSKAP', cohort: '2025H' }, `${master}studieplaner/2025h.html`), [parttime, fulltime] = plan.models
    expect(plan.models).toHaveLength(2)
    expect(parttime.name).toContain('deltid')
    expect(fulltime.name).toContain('heltid')
    expect(parttime.periods.map(period => period.studySemester)).toEqual([1, 2, 3, 4, 5, 6, 8])
    expect(fulltime.periods.map(period => period.studySemester)).toEqual([1, 2, 3, 4])
    expect(fulltime.periods[1].requirements.join(' ')).toContain('MA-914')
    expect(fulltime.periods.flatMap(period => period.courses).some(course => course.code === 'MA-914')).toBe(false)
    expect(parttime.periods[0].courses).toHaveLength(1)
    expect(fulltime.periods[0].courses).toHaveLength(2)
  })
  it('rejects a requirement-only source, wrong cohort, substituted course URL and cyclic source direction', async () => {
    const source = `${bachelor}studieplaner/2026h.html`, html = await fixture('bachelor-plan')
    expect(() => parsePhsPlan(html, { ...query, cohort: '2025H' }, source)).toThrow(/startkull/)
    expect(() => parsePhsPlan(html.replace('/2026/host/forebygg01-2.html', '/2026/host/straff01.html'), query, source)).toThrow(/emnekoden/)
    const investigation = await fixture('investigation-plan')
    expect(() => parsePhsPlan(investigation, { program: 'ERFARINGSBASERT-MASTER-I-ETTERFORSKNING', cohort: '2022V' }, `${origin}/studier/master-etter-og-videreutdanninger/erfaringsbasert-master-i-etterforskning/studieplaner/2022var.html`)).toThrow(/bare eventuelle valgemnekrav/)
    const cycle = '<input id="cycle" name="education-plan-choices" value="A->A"><label for="cycle">Cycle</label>'
    expect(() => parsePhsPlan(html.replace('vrtx-fs-study-model">', `vrtx-fs-study-model">${cycle}`), query, source)).toThrow(/startvalg/)
  })
  it('uses public catalogue membership for cohort selection, reuses source reads and returns linked details separately', async () => {
    const fetchText = vi.fn(async (url, _depth, guard) => { guard?.(new URL(url)); return fixture(url.includes('/emner/') ? 'course' : url.endsWith('/2026h.html') ? 'bachelor-plan' : url.endsWith('/studieplaner/') ? 'bachelor-cohorts' : 'bachelor') })
    const plan = await phsPrograms('phs', 'program-plan', { ...query, sourceUrl: bachelor }, { fetchText })
    expect(plan.models[0].periods[0].courses[0].code).toBe('FOREBYGG01-2')
    const detail = await phsDetails({ code: 'FOREBYGG01-2', year: '2027', semester: 'spring', sourceUrl: `${origin}/studier/emner/2026/host/forebygg01-2.html` }, fetchText)
    expect(detail.course).toMatchObject({ code: 'FOREBYGG01-2', credits: 9, year: 2027, semester: 'spring', sourceVersion: '2026H' })
    expect(detail.course.description).toContain('Læringsutbytte')
    const before = fetchText.mock.calls.length
    await phsPrograms('phs', 'program-cohorts', { program: query.program, sourceUrl: bachelor }, { fetchText })
    expect(fetchText.mock.calls.length).toBe(before)
  })
  it('reads five named PDF courses and keeps numbering, study semester, optional credit requirement and student cohort separate', async () => {
    const pages = JSON.parse(await readFile(new URL('../fixtures/phs-programs/investigation-pdf.json', import.meta.url), 'utf8')), query = { program: 'ERFARINGSBASERT-MASTER-I-ETTERFORSKNING', cohort: '2022', cohortFromStudent: 'true' }, plan = parsePhsNumberedPdf(pages, query, `${master}studieplaner/source.pdf`), period = plan.models[0].periods[0]
    expect(period.courses).toHaveLength(5)
    expect(period.studySemester).toBeNull()
    expect(period.requiresStudentStudySemester).toBe(true)
    expect(period.courses[0]).toMatchObject({ code: '', name: 'Etterforskning som fenomenområde', credits: 15, sourceRecordId: 'emne-1', requiresSemesterChoice: true, sourceVersion: 'published-pdf' })
    expect(period.requirements.join(' ')).toContain('Valgfrie emner')
    expect(plan.program.cohortFromStudent).toBe(true)
    expect(() => parsePhsNumberedPdf(pages, { ...query, cohortFromStudent: 'false' }, `${master}studieplaner/source.pdf`)).toThrow(/eget kull/)
    const broken = structuredClone(pages); broken.forEach(page => { page.lines = page.lines.map(line => line.replace('Emne 6:', 'Annet:')) })
    expect(() => parsePhsNumberedPdf(broken, query, `${master}studieplaner/source.pdf`)).toThrow(/entydig/)
  })
})
