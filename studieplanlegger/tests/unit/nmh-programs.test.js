import { readFile } from 'node:fs/promises'
import { describe, it, expect, vi } from 'vitest'
import { parseNmhCatalogue, nmhPrograms, searchNmh, nmhDetails } from '../../server/providers/nmh-programs.js'
import { parseNmhPdf, readNmhPdf } from '../../server/providers/nmh-pdf.js'
const fixture = name => readFile(new URL(`../fixtures/arts-programs/${name}`, import.meta.url), 'utf8')
const pages = name => fixture(`nmh-${name}-2022-pdf.json`).then(JSON.parse)
const options = (name, code) => ({ code, name, cohort: '2022', sourceUrl: `https://student.nmh.no/studiehandboker/startkull-2022/studier/${name}`, pdfUrl: `https://nmh-nettsted.s3.amazonaws.com/files/Studieh%C3%A5ndb%C3%B8ker/2022/${name}.pdf` })
const currentUrl = 'https://student.nmh.no/studiehandboker/startkull-2026/studieprogram/bachelorstudiet-i-komposisjon'

describe('NMH public cohort books, course descriptions and source-linked PDF plans', () => {
  it('reads the complete current and archived books without mixing programmes and courses', async () => {
    const current = parseNmhCatalogue(await fixture('nmh-catalogue-2026.html'), '2026'), archive = parseNmhCatalogue(await fixture('nmh-catalogue-2022.html'), '2022')
    expect([current.programs.length, current.courses.length]).toEqual([44, 428])
    expect([archive.programs.length, archive.courses.length]).toEqual([37, 389])
    expect(current.programs.find(row => row.code === 'BAKP').sourceUrl).toBe(currentUrl)
    expect(archive.programs.some(row => row.code === 'KAKP')).toBe(true)
    expect(current.courses.every(row => row.sourceCohort === '2026')).toBe(true)
    expect(() => parseNmhCatalogue('<main><h1>Startkull 2025</h1></main>', '2026')).toThrow(/bekrefter ikke/)
  })
  it('keeps a source with an empty current programme model unavailable instead of borrowing an old cohort', async () => {
    const fetchText = vi.fn(async (_url, _depth, guard) => { guard(new URL(currentUrl)); return fixture('nmh-composition-2026.html') }), query = { program: 'BAKP', sourceUrl: currentUrl }
    const cohorts = await nmhPrograms('nmh', 'program-cohorts', query, { fetchText })
    expect(cohorts.results).toEqual([{ cohort: '2026', label: 'Startkull 2026', sourceUrl: currentUrl }])
    await expect(nmhPrograms('nmh', 'program-plan', { ...query, cohort: '2026' }, { fetchText })).rejects.toThrow(/tom «Emneoversikt»/)
    expect(fetchText).toHaveBeenCalledTimes(1)
    await expect(nmhPrograms('nmh', 'program-plan', { ...query, cohort: '2022' }, { fetchText })).rejects.toThrow(/opptakskull/)
  })
  it('reads actual annual allocations while keeping semester unknown, full course credits and optional requirements', async () => {
    const source = await pages('composition'), plan = parseNmhPdf(source, options('composition', 'KAKP')), periods = plan.models[0].periods
    expect(plan.completeness.returned).toBe(17)
    expect(periods.map(period => period.courses.length)).toEqual([8, 9, 3, 3])
    expect(periods.every(period => period.studySemester === null && period.requiresStudentStudySemester && period.year === null && period.semester === null)).toBe(true)
    const first = periods[0].courses.find(course => course.code === 'KPKOMP10'), second = periods[1].courses.find(course => course.code === 'KPKOMP10')
    expect(first).toMatchObject({ credits: 30, sourceVersion: '2022', requiresSemesterChoice: true })
    expect(second.id).toBe(first.id)
    expect(periods.flatMap(period => period.courses).some(course => course.code === 'VALG30')).toBe(false)
    expect(periods[2].requirements.join(' ')).toContain('10 studiepoeng')
    expect(() => parseNmhPdf(source, { ...options('composition', 'KAKP'), cohort: '2026' })).toThrow(/PDF-forsiden/)
    expect(() => parseNmhPdf(source, options('composition', 'BAKP'))).toThrow(/PDF-forsiden/)
  })
  it('uses the fulltime therapy model only as stated by the publishing page and never turns asterisks into zero credits', async () => {
    const plan = parseNmhPdf(await pages('therapy'), { ...options('therapy', 'MAMT'), fulltimeOnly: true })
    expect(plan.models).toHaveLength(1)
    expect(plan.models[0].name).toContain('heltid over 2 år')
    expect(plan.models[0].periods.map(period => period.courses.length)).toEqual([4, 4])
    expect(plan.models[0].periods[0].courses.find(course => course.code === 'MTPRAKS70').credits).toBeNull()
    expect(plan.warnings.join(' ')).toContain('Deltidstabellen er derfor ikke brukt')
  })
  it('rejects a changed allocation instead of silently placing a course in an incorrect year', async () => {
    const source = await pages('composition'), row = source[2].rows.find(row => row.cells.some(cell => cell.text === 'KPKOMP10'))
    row.cells.at(-1).text = '20'
    expect(() => parseNmhPdf(source, options('composition', 'KAKP'))).toThrow(/entydig støttet emnetabell/)
  })
  it('provides real course search and description with source cohort independent of selected calendar term', async () => {
    const fetchText = vi.fn(async (url, _depth, guard) => { guard(new URL(url)); return fixture(url.endsWith('startkull-2026') ? 'nmh-catalogue-2026.html' : 'nmh-course.html') })
    const search = await searchNmh({ q: 'KPKOMP10', year: '2026', semester: 'autumn' }, fetchText)
    expect(search.results.some(row => row.code === 'KPKOMP10')).toBe(true)
    const query = { code: 'KPKOMP10', year: '2026', semester: 'autumn', sourceUrl: 'https://student.nmh.no/studiehandboker/startkull-2025/emner/komposisjon-i' }, detail = await nmhDetails(query, fetchText)
    expect(detail.course).toMatchObject({ code: 'KPKOMP10', credits: 30, sourceVersion: '2025', year: 2026, semester: 'autumn' })
    expect(detail.course.description).toContain('Læringsmål')
    expect(detail.course.notes).toContain('startkull 2025')
    await expect(nmhDetails({ ...query, code: 'MAMT' }, fetchText)).rejects.toThrow(/kildekull/)
    await expect(nmhDetails({ ...query, sourceUrl: 'https://localhost/emner/x' }, fetchText)).rejects.toThrow(/utenfor/)
  })
  it('refuses non-PDF bytes and external or mismatched published PDF links before reading them', async () => {
    await expect(readNmhPdf(async () => Buffer.from('<html>error</html>'), 'https://nmh.no/plan.pdf', () => {})).rejects.toThrow(/ikke med en støttet PDF/)
    const html = (await fixture('nmh-composition-2022.html')).replace('https://nmh-nettsted.s3.amazonaws.com/', 'https://other.example/'), fetchBytes = vi.fn(), query = { program: 'KAKP', cohort: '2022', sourceUrl: 'https://student.nmh.no/studiehandboker/startkull-2022/studier/bachelorstudiet-i-komposisjon' }
    await expect(nmhPrograms('nmh', 'program-plan', query, { fetchText: async () => html, fetchBytes })).rejects.toThrow(/utenfor/)
    expect(fetchBytes).not.toHaveBeenCalled()
  })
})
