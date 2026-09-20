import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { ldhPdfPage, parseLdhPdfPlan, readLdhPdf } from '../../server/providers/ldh-pdf.js'
import { ldhProgramUrl } from '../../server/providers/ldh-programs.js'

const fixture = async name => JSON.parse(await readFile(new URL(`../fixtures/public-programs/ldh-${name}-pdf-metadata.json`, import.meta.url), 'utf8'))
const query = name => ({ program: name, programName: name, sourceUrl: `https://ldh.no/studietilbud/${name}/plan.pdf`, cohort: '2026' })
describe('LDH published PDF contracts', () => {
  it('reads VIB metadata for all seven courses without assuming a calendar period', async () => {
    const plan = parseLdhPdfPlan(await fixture('barsel'), query('barsel'))
    expect(plan.models[0].periods.map(period => period.courses.length)).toEqual([2, 2, 3])
    expect(plan.models[0].periods[0].courses[0]).toMatchObject({ code: 'VIB-101', name: 'Barselomsorg: observasjon, vurdering og familiedannelse', credits: 10, choice: '', year: null, semester: null })
    expect(plan.completeness.returned).toBe(7)
  })
  it('keeps the real MAKOP table/metadata contradiction unplaced and preserves spanning courses', async () => {
    const plan = parseLdhPdfPlan(await fixture('makop'), query('makop')), model = plan.models[0]
    expect(model.unplacedCourses.map(course => course.code)).toEqual(['MOPSY-200'])
    expect(model.unplacedCourses[0]).toMatchObject({ requiresSemesterChoice: true, choice: '' })
    expect(model.periods.flatMap(period => period.courses).some(course => course.code === 'MOPSY-200')).toBe(false)
    const spanning = model.periods.flatMap(period => period.courses).filter(course => course.code === 'MFSY-500')
    expect(spanning).toHaveLength(2)
    expect(spanning[0].id).toBe(spanning[1].id)
    expect(spanning.every(course => course.credits === 30)).toBe(true)
    expect(plan.warnings.join()).toContain('ulike semestre')
    expect(plan.completeness.complete).toBe(false)
  })
  it('reads MAL cross-page metadata and distinguishes the elective appendix including modules', async () => {
    const plan = parseLdhPdfPlan(await fixture('mal'), query('mal')), courses = plan.models[0].periods.flatMap(period => period.courses)
    expect(plan.completeness.returned).toBe(16)
    expect(courses.find(course => course.code === 'MALSY-100').credits).toBe(10)
    expect(courses.find(course => course.code === 'MFPV-126')).toMatchObject({ choice: 'V', credits: 5 })
    expect(courses.find(course => course.code === 'MALSY-400').choice).toBe('')
  })
  it('requires the explicit cover cohort and preserves identities after source revisions', async () => {
    const pages = await fixture('barsel'), a = parseLdhPdfPlan(pages, query('barsel'))
    expect(() => parseLdhPdfPlan(pages, { ...query('barsel'), cohort: '2025' })).toThrow(/opptakskull/)
    const changed = structuredClone(pages); changed[0].lines.push('Sist justert: 01.09.2026')
    const b = parseLdhPdfPlan(changed, query('barsel'))
    expect(a.models[0].periods[0].courses[0].id).toBe(b.models[0].periods[0].courses[0].id)
    expect(a.program.sourceEdition).not.toBe(b.program.sourceEdition)
  })
  it('uses labelled column positions to avoid reading credits or practice weeks as a semester', () => {
    const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y], hasEOL: true })
    const parsed = ldhPdfPage([item('Semester', 76, 709), item('Emnets kode og navn', 134, 709), item('2', 76, 580), item('MOPSY-200 Kirurgisk behandling', 134, 593), item('13', 361, 593), item('10', 412, 593), item('MOPNA-200 Fysiologi', 134, 567), item('Totalt', 76, 402), item('MFSY-500 i et annet avsnitt', 134, 390)], 8)
    expect(parsed.tableRows.map(row => [row.code, row.semester])).toEqual([['MOPSY-200', 2], ['MOPNA-200', 2]])
  })
  it('uses the guarded ten-megabyte binary transport and rejects non-PDF sources before parsing', async () => {
    const fetchBytes = vi.fn(async () => Buffer.from('<html>source error</html>')), url = query('barsel').sourceUrl
    await expect(readLdhPdf(fetchBytes, url, ldhProgramUrl)).rejects.toThrow(/støttet PDF/)
    expect(fetchBytes).toHaveBeenCalledWith(url, 0, ldhProgramUrl, { maxBytes: 10_000_000 })
    await expect(readLdhPdf(fetchBytes, 'https://evil.example/plan.pdf', ldhProgramUrl)).rejects.toThrow()
    expect(fetchBytes).toHaveBeenCalledTimes(1)
  })
})
