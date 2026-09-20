import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { basPrograms, basProgramUrl, basDocumentUrl, parseBasCatalogue, parseBasGeneral, basArchiveModel } from '../../server/providers/bas-programs.js'
import { basPdfLines, readBasPdf } from '../../server/providers/bas-pdf.js'
import { emptyPlanner, mergeCourseOnly, validPlanner } from '../../src/planner.js'

const fixture = name => readFile(new URL(`../fixtures/public-programs/bas-${name}`, import.meta.url), 'utf8')
const pages = async () => JSON.parse(await fixture('general-typography.json'))
const sourceUrl = 'https://bas.org/en/master-i-arkitektur/', pdfUrl = 'https://bas.org/wp-content/uploads/2020/12/General-course-catalogue-1-2-and-3-year-BAS.doc.pdf'
const query = { program: 'master-i-arkitektur', sourceUrl, cohort: '2026', cohortFromStudent: 'true' }

describe('BAS public general catalogue and dated archive', () => {
  it('reads the complete published thirty-course archive using link dates, not PDF upload dates', async () => {
    const catalogue = parseBasCatalogue(await fixture('programme.html')), model = basArchiveModel(catalogue.archive)
    expect(catalogue.archive).toHaveLength(30); expect(catalogue.documentUrl).toBe(pdfUrl)
    expect(model.periods).toHaveLength(10)
    expect(model.periods[0]).toMatchObject({ year: 2025, semester: 'spring', studySemester: null, requiresStudentStudySemester: true, allowedStudySemesters: [7, 8, 9, 10] })
    expect(model.periods[0].courses).toHaveLength(2)
    expect(model.periods.some(period => period.year >= 2026)).toBe(false)
    expect(model.periods[0].courses[0]).toMatchObject({ year: 2025, semester: 'spring', code: '', credits: null, choice: 'V', allowedCalendarPeriods: [{ year: 2025, semester: 'spring' }] })
  })
  it('reads actual course typography across pages and distinguishes semester courses, annual additions, duration and prose', async () => {
    const model = parseBasGeneral(await pages(), pdfUrl)
    expect(model.periods.map(period => period.courses.length)).toEqual([9, 9, 5, 5, 1, 2, 7])
    expect(model.periods[0].courses[6].name).toBe('Maling etter lytting til musikk/Painting after listening to music (DAV)')
    expect(model.periods[3].courses[0].name).toContain('Barnas Byrom / Den andre/')
    expect(model.periods[4].courses[0].name).toBe('Byrom')
    expect(model.periods[5].courses.map(course => course.name)).toEqual(['Bygrend', 'Complex building'])
    expect(model.periods[6]).toMatchObject({ studySemester: null, allowedStudySemesters: [5, 6], year: null, semester: null })
    expect(model.periods[6].courses.map(course => course.name)).toContain('Study trip')
    const all = model.periods.flatMap(period => period.courses)
    expect(all.every(course => course.code === '' && course.credits === null && course.year === null)).toBe(true)
    expect(all.some(course => /^(Exam|10 days|5 weeks|Objectives|References)$/.test(course.name))).toBe(false)
    expect(model.periods[3].requirements.join()).toContain('Eksamen')
  })
  it('joins split words geometrically and preserves separate words without specific course-name substitutions', () => {
    const item = (str, x, y, width, height = 10) => ({ str, transform: [1, 0, 0, height, x, y], width, height, fontName: 'b' })
    const lines = basPdfLines([item('Build', 70, 600, 20), item('ing', 90, 600, 12), item('Studio', 105, 600, 30), item('1', 70, 500, 8, 16), item('st', 78, 506, 8, 9), item('year, autumn term', 89, 500, 100, 16)], { b: { name: 'Embedded Font,Bold' } })
    expect(lines.map(line => line.text)).toEqual(['Building Studio', '1st year, autumn term'])
    expect(lines.every(line => line.bold)).toBe(true)
  })
  it('imports the complete first semester with no invented codes and preserves local edits after repeated import', async () => {
    const model = parseBasGeneral(await pages(), pdfUrl), courses = model.periods[0].courses.map(course => ({ ...course, id: `${course.id}:2026:autumn`, year: 2026, semester: 'autumn' }))
    let planner = emptyPlanner(); for (const course of courses) planner = mergeCourseOnly(planner, course)
    planner.courses[0].notes = 'Mine notater'; planner.courses[0].name = 'Mitt kursnavn'
    for (const course of courses) planner = mergeCourseOnly(planner, course)
    expect(planner.courses).toHaveLength(9); expect(validPlanner(planner)).toBe(true)
    expect(planner.courses[0]).toMatchObject({ name: 'Mitt kursnavn', notes: 'Mine notater' })
  })
  it('keeps the independently published course archive available if the general PDF fails, with a precise limitation', async () => {
    const fetchText = vi.fn(async () => fixture('programme.html')), fetchBytes = vi.fn(async () => Buffer.from('<html>source failed</html>'))
    const catalogue = await basPrograms('bas', 'programs', {}, { fetchText, fetchBytes })
    expect(catalogue.results).toHaveLength(1)
    const result = await basPrograms('bas', 'program-plan', query, { fetchText, fetchBytes })
    expect(result.models.map(model => model.id)).toEqual(['master-archive'])
    expect(result.completeness.complete).toBe(false); expect(result.warnings.join()).toContain('Generalkatalogen kunne ikke importeres')
    expect(fetchText).toHaveBeenCalledTimes(1); expect(fetchBytes).toHaveBeenCalledWith(pdfUrl, 0, basDocumentUrl, { maxBytes: 10_000_000 })
    await expect(basPrograms('bas', 'program-plan', { ...query, cohortFromStudent: undefined }, { fetchText, fetchBytes })).rejects.toThrow(/opptakskull/)
    expect(fetchBytes).toHaveBeenCalledTimes(1)
  })
  it('rejects broken typography and unsafe source selection before importing anything', async () => {
    const broken = await pages(); broken.forEach(page => page.lines.forEach(line => { line.bold = false; line.boldText = '' }))
    expect(() => parseBasGeneral(broken, pdfUrl)).toThrow(/endret seg/)
    for (const validate of [basProgramUrl, basDocumentUrl]) expect(() => validate('https://127.0.0.1/private')).toThrow()
    expect(() => basDocumentUrl('https://bas.org/wp-content/uploads/2020/12/plan.js')).toThrow()
    const fetchBytes = vi.fn()
    await expect(readBasPdf(fetchBytes, 'https://other.example/plan.pdf', basDocumentUrl)).rejects.toThrow()
    expect(fetchBytes).not.toHaveBeenCalled()
  })
})
