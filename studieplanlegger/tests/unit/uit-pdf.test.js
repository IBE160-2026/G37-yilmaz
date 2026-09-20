import { readFile } from 'node:fs/promises'
import { describe, it, expect, vi } from 'vitest'
import { parseUitPdf } from '../../server/providers/uit-pdf.js'
import { uitPrograms } from '../../server/providers/uit-programs.js'

const fixture = (name, encoding = 'utf8') => readFile(new URL(`../fixtures/uit-programs/${name}`, import.meta.url), encoding)
const { sources } = JSON.parse(await fixture('pdf/sources.json'))
// The initial source manifest predates reading the named elective appendix.
// These final counts include that appendix without assigning it a semester.
const finalCourseCounts = { '921058': 39, '870086': 33, '837518': 34, '837390': 34 }
const source = id => sources.find(row => row.id === id)
const pagesFor = async id => JSON.parse(await fixture(`pdf/${id}.json`))
const infoFor = id => {
  const selected = source(id)
  return { ...selected, pdfId: id, pdfUrl: selected.url, sourceUrl: `https://uit.no/utdanning/program/${selected.record}/published`, name: selected.studyCode, campuses: selected.studyCode === 'B-IE' ? ['Narvik'] : ['Tromsø'] }
}
const queryFor = (id, cohort = source(id).cohort) => ({ program: `UIT-${source(id).record}`, cohort, cohortFromStudent: 'true' })
const planFor = async (id, cohort) => parseUitPdf(await pagesFor(id), infoFor(id), queryFor(id, cohort))
const courseRows = plan => plan.models.flatMap(model => [...model.periods.flatMap(period => period.courses), ...model.unplacedCourses])

describe('UiT published PDF study plans, replayed from actual public extracts', () => {
  it.each(sources.filter(row => !row.error))('reads the separate $studyCode PDF edition $id without inventing calendar dates', async selected => {
    const plan = await planFor(selected.id)
    expect(plan.status).toBe('ok')
    expect(plan.program).toMatchObject({ code: `UIT-${selected.record}`, cohort: selected.cohort, cohortFromStudent: true })
    expect(plan.program.sourceEdition).toMatch(new RegExp(`^pdf-${selected.id}:side-`))
    expect(plan.completeness).toMatchObject({ complete: false, pages: selected.pages, returned: finalCourseCounts[selected.id] ?? selected.courses })
    expect(plan.models.map(model => model.id)).toEqual(selected.models.map(model => model.id))
    for (const model of plan.models) {
      expect(model.periods).toHaveLength(selected.models.find(row => row.id === model.id).semesters)
      for (const period of model.periods) {
        expect(period).toMatchObject({ year: null, semester: null })
        expect(new Set(period.courses.map(course => course.code)).size).toBe(period.courses.length)
      }
    }
    for (const course of courseRows(plan)) expect(course).toMatchObject({ year: null, semester: null, sourceVersion: `pdf-${selected.id}`, sourceUrl: selected.url })
  })

  it('keeps historical alternatives optional and merged-cell credits unknown', async () => {
    const plan = await planFor('868803'), periods = plan.models[0].periods
    expect(periods[0].courses.map(row => [row.code, row.credits, row.choice])).toEqual([
      ['INF-1100', 10, 'O'], ['MAT-0001', 10, 'V'], ['MAT-1001', 10, 'V'], ['MAT-1005', 10, 'O'],
    ])
    expect(periods[3].courses.find(row => row.code === 'INF-2201')).toMatchObject({ credits: null, choice: 'O' })
    expect(periods[3].requirements.join(' ')).toContain('Valgfritt emne')
    const master = await planFor('933374')
    expect(master.models.map(model => model.name)).toEqual(['Studieretning «Datamaskinsystemer»', 'Studieretning «Medisinsk informatikk»', 'Studieretning «Cybersikkerhet»'])
    expect(master.models[0].periods[9].courses.find(row => row.code === 'INF-3981').credits).toBeNull()
    expect(master.models[0].unplacedCourses.length).toBeGreaterThan(0)
    expect(master.models[0].unplacedCourses.every(row => row.choice === 'V' && row.requiresSemesterChoice && row.credits === null)).toBe(true)
  })

  it('selects the nursing matrix for the stated cohort and preserves whole-course credits, campus choices and practice rotation', async () => {
    const old = await planFor('803726', '2020'), next = await planFor('803726', '2021'), current = await planFor('803726', '2022')
    expect(old.models.map(model => model.id)).toEqual(['matrix-2020'])
    expect(next.models.map(model => model.id)).toEqual(['matrix-2021'])
    expect(current.models.map(model => model.id)).toEqual(['matrix-2022'])
    expect((await planFor('803726', '2023')).models.map(model => model.id)).toEqual(['matrix-2022'])
    const periods = current.models[0].periods
    expect(old.models[0].periods[0].courses.some(row => row.code === 'SYP-1120')).toBe(true)
    expect(periods[0].courses.some(row => row.code === 'SYP-1120')).toBe(false)
    const repeated = [periods[0], periods[1]].map(period => period.courses.find(row => row.code === 'SYP-1121'))
    expect(repeated[0].id).toBe(repeated[1].id)
    expect(repeated.map(row => row.credits)).toEqual([15, 15])
    const rotations = periods[2].courses.filter(row => /^SYP-219\d$/.test(row.code))
    expect(rotations).toHaveLength(4)
    expect(rotations.every(row => row.requiresSemesterChoice && /Praksisrullering/.test(row.notes))).toBe(true)
    const campuses = periods[4].courses.filter(row => row.campus)
    expect(campuses.map(row => row.campus)).toEqual(['Tromsø', 'Hammerfest', 'Harstad', 'Narvik'])
    expect(campuses.every(row => row.choice === 'V' && row.requiresSemesterChoice)).toBe(true)
    expect(periods[0].requirements.join(' ')).toMatch(/HEL-.*0700\/30\/50\/60/)
    expect(courseRows(current).some(row => row.code.startsWith('HEL-'))).toBe(false)
    await expect(planFor('803726', '2019')).rejects.toThrow(/valgte kullet/)
  })

  it('keeps study-year allocation separate from semester and route choices', async () => {
    const plan = await planFor('921058')
    expect(plan.models.map(model => model.id)).toEqual(['year-table-1', 'year-table-2'])
    expect(plan.models[1].name).toBe('Y-vei:')
    for (const model of plan.models) {
      expect(model.periods.map(period => period.allowedStudySemesters)).toEqual([[1, 2], [3, 4], [5, 6]])
      model.periods.forEach((period, index) => expect(period).toMatchObject({ sourceStudyYear: index + 1, studySemester: null, requiresStudentStudySemester: true, year: null, semester: null }))
      expect(model.periods.flatMap(period => period.courses).every(row => row.requiresSemesterChoice)).toBe(true)
      expect(model.unplacedCourses.every(row => row.requiresSemesterChoice && row.choice === 'V' && row.credits === null)).toBe(true)
    }
    expect(plan.models[0].periods[0].courses.find(row => row.code === 'TEK-1510')).toMatchObject({ credits: 10, choice: 'V', requiresSemesterChoice: true })
    expect(plan.models[1].periods[0].courses.find(row => row.code === 'TEK-1509').credits).toBe(20)
    expect(plan.models[0].periods[1].courses.find(row => row.code === 'STE-2603').credits).toBe(10)
    expect(courseRows(plan).some(row => /[Xx]/.test(row.code))).toBe(false)
  })

  it('requires explicit student cohort and respects source lower bounds, exact covers and listed cohorts', async () => {
    const pages = await pagesFor('868804')
    expect(() => parseUitPdf(pages, infoFor('868804'), { ...queryFor('868804'), cohortFromStudent: 'false' })).toThrow(/Oppgi ditt eget kull/)
    await expect(planFor('868804', '2024')).rejects.toThrow(/kullgrense/)
    expect((await planFor('868804', '2026')).program.cohort).toBe('2026')
    await expect(planFor('860933', '2023')).rejects.toThrow(/kullgrense/)
    await expect(planFor('860933', '2025')).rejects.toThrow(/kullgrense/)
    await expect(planFor('837390', '2024')).rejects.toThrow(/kullgrense/)
    expect((await planFor('763294', '2022')).program.cohort).toBe('2022')
    await expect(planFor('763294', '2023')).rejects.toThrow(/kullgrense/)
    await expect(planFor('921058', '2025')).rejects.toThrow(/kullgrense/)
  })

  it('explains an image-only course table instead of substituting courses from an older nursing edition', async () => {
    const pages = await pagesFor('876230')
    expect(pages.flatMap(page => page.items).length).toBeGreaterThan(100)
    expect(() => parseUitPdf(pages, infoFor('876230'), queryFor('876230'))).toThrow(/selve emnetabellen mangler lesbar tekst.*eldre plan erstatter ikke/)
    expect(() => parseUitPdf([], infoFor('876230'), queryFor('876230'))).toThrow(/lesbar studieplanforside/)
  })

  it('rejects missing semester marks and broken semester sequences without returning a partial successful plan', async () => {
    const matrix = await pagesFor('860933'), page = matrix.find(page => page.items.some(item => item.str === 'Emnekode'))
    page.items = page.items.filter(item => !/^x$/i.test(item.str))
    expect(() => parseUitPdf(matrix, infoFor('860933'), queryFor('860933'))).toThrow(/semestermerke/)
    const table = await pagesFor('868803')
    const semester = table.find(page => page.page === 5).items.find(item => item.str === '4.' && Math.abs(item.transform[4] - 228.35) < 1)
    expect(semester).toBeDefined()
    semester.str = '5.'
    expect(() => parseUitPdf(table, infoFor('868803'), queryFor('868803'))).toThrow(/gjentar et studiesemester/)
  })

  it('keeps source IDs stable on repeat parsing and distinguishes a revised source edition', async () => {
    const pages = await pagesFor('868804'), first = parseUitPdf(pages, infoFor('868804'), queryFor('868804'))
    expect(parseUitPdf(structuredClone(pages), infoFor('868804'), queryFor('868804'))).toEqual(first)
    const changed = structuredClone(pages)
    changed[0].items.push({ str: 'Ny godkjenningsmerknad', transform: [10, 0, 0, 10, 74, 100], width: 100 })
    const revised = parseUitPdf(changed, infoFor('868804'), queryFor('868804'))
    expect(courseRows(revised).map(row => row.id)).toEqual(courseRows(first).map(row => row.id))
    expect(revised.program.sourceEdition).not.toBe(first.program.sourceEdition)
  })
})

describe('UiT PDF import transport contract (cached public files, no live requests)', () => {
  const setup = async () => {
    const catalogue = await fixture('catalogue.html'), programme = await fixture('b-inf.html')
    const fetchText = vi.fn(async (input, _depth, guard) => {
      const url = new URL(input); guard(url)
      if (url.pathname === '/utdanning') return catalogue
      if (url.pathname.startsWith('/go/target/279505/')) return JSON.stringify({ data: { URL: 'https://uit.no/utdanning/program/279505/informatikk_datamaskinsystemer_-_bachelor' } })
      if (url.pathname === '/utdanning/program/279505/informatikk_datamaskinsystemer_-_bachelor') return programme
      throw Error(`Unpublished fixture request: ${url.pathname}`)
    })
    const fetchBytes = vi.fn(async (input, _depth, guard, options) => {
      guard(input)
      expect(options.maxBytes).toBe(10_000_000)
      expect(input).toBe(source('868803').url)
      return fixture('pdf/868803.pdf', null)
    })
    return { fetchText, fetchBytes }
  }

  it('follows a linked edition through catalogue identity and the local PDF runtime, and caches repeated reads', async () => {
    const transport = await setup(), query = { ...queryFor('868803'), sourceUrl: source('868803').url }
    const plan = await uitPrograms('uit', 'program-plan', query, transport)
    expect(plan.models[0].periods[0].courses[0]).toMatchObject({ code: 'INF-1100', credits: 10, sourceVersion: 'pdf-868803' })
    expect(plan.models[0].periods[3].courses[0].credits).toBeNull()
    expect(await uitPrograms('uit', 'program-plan', query, transport)).toEqual(plan)
    expect(transport.fetchBytes).toHaveBeenCalledTimes(1)
  }, 15_000)

  it('does not fetch arbitrary or redirected PDF identities', async () => {
    const transport = await setup()
    await expect(uitPrograms('uit', 'program-plan', { ...queryFor('868803'), sourceUrl: source('868803').url.replace('/868803/', '/123456/') }, transport)).rejects.toThrow(/ikke faktisk lenket/)
    expect(transport.fetchBytes).not.toHaveBeenCalled()
    transport.fetchBytes.mockImplementation(async (_input, _depth, guard) => guard(source('868804').url))
    await expect(uitPrograms('uit', 'program-plan', { ...queryFor('868803'), sourceUrl: source('868803').url }, transport)).rejects.toThrow(/annen PDF-utgave/)
  })
})
