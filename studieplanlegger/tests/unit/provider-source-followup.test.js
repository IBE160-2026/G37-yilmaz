import { describe, expect, it, vi } from 'vitest'
import { ntnuPrograms } from '../../server/providers/ntnu-programs.js'
import { parseAhoPlan } from '../../server/providers/aho-programs.js'
import { parseUitPdf } from '../../server/providers/uit-pdf.js'
import { ahoFixture, ahoSource, ahoTerms, ntnuCataloguePage, ntnuEmptyIndex, uitInfo, uitQuery, uitTermPages } from '../fixtures/provider-followup.js'

const ntnuTransport = (data, page = ntnuCataloguePage) => ({ fetchText: vi.fn(async (url, _depth, guard) => {
  guard(url)
  return new URL(url).searchParams.has('p_p_resource_id') ? JSON.stringify(data) : page
}) })
const ahoPlan = terms => parseAhoPlan(ahoFixture(terms), ahoSource, 'no:master-i-arkitektur', '2026')

describe('Reported public source limits, 1 November 2026 (synthetic fixtures)', () => {
  it.each(['', 'Datateknologi'])('distinguishes an empty upstream NTNU index from no match for "%s"', async q => {
    const result = await ntnuPrograms('programs', { q, year: '2026' }, ntnuTransport(ntnuEmptyIndex))
    expect(result).toMatchObject({ status: 'source-empty', results: [], sourceUrl: 'https://www.ntnu.no/studier/alle', completeness: { complete: false, returned: 0, total: 0 } })
    expect(result.error).toMatch(/tom samlet programliste.*ikke at programmet mangler/)
    expect(result.error).toContain('søk etter ett enkelt emne')
  })

  it('keeps a real no-match result distinct when a nonempty complete catalogue was read', async () => {
    const transport = ntnuTransport({ numFound: 1, docs: [{ studyprogCode: 'SYNTH', studyprogName: 'Syntetisk studieprogram', studyprogCities: ['Trondheim'], studyprogCampuses: ['Syntetisk campus'] }] })
    const absent = await ntnuPrograms('programs', { q: 'Datateknologi' }, transport)
    expect(absent).toMatchObject({ status: 'ok', results: [], completeness: { complete: true, returned: 1, total: 1 } })
    const all = await ntnuPrograms('programs', { q: '' }, transport)
    expect(all.results[0]).toMatchObject({ code: 'SYNTH', campuses: ['Trondheim'], campusNames: ['Syntetisk campus'] })
    expect(transport.fetchText).toHaveBeenCalledTimes(2)
  })

  it.each([
    'https://source.invalid/studier/alle?p_p_resource_id=allStudies&p_p_lifecycle=2',
    'https://www.ntnu.no/private?p_p_resource_id=allStudies&p_p_lifecycle=2',
    'https://www.ntnu.no/studier/alle?p_p_resource_id=allStudies&p_p_lifecycle=2&unapproved=1',
  ])('rejects a substituted NTNU endpoint before reading it: %s', async endpoint => {
    const transport = ntnuTransport(ntnuEmptyIndex, `<div data-allstudiesurl="${endpoint}"></div>`)
    await expect(ntnuPrograms('programs', {}, transport)).rejects.toMatchObject({ status: 'invalid-selection' })
    expect(transport.fetchText).toHaveBeenCalledTimes(1)
  })

  it('retains source years and course identities across the AHO 2029–2031 gap', () => {
    const result = ahoPlan(), periods = result.models[0].periods
    expect(periods.map(period => period.studySemester)).toEqual([1, 2, 3, 4, 5, 6, 7, 10, 11])
    expect(periods.map(period => `${period.semester === 'spring' ? 'Vår' : 'Høst'} ${period.year}`)).toEqual(ahoTerms)
    expect(periods[7]).toMatchObject({ id: 'semester-10', label: '10. studiesemester · Vår 2031', year: 2031, semester: 'spring' })
    expect(periods[7].courses[0]).toMatchObject({ id: 'aho:no:master-i-arkitektur:2031:spring:/studier/emner/2026/host/synthetic-8.html', year: 2031, semester: 'spring', sourceRecordId: '/studier/emner/2026/host/synthetic-8.html', sourceVersion: '2026-2031', sourceUrl: 'https://www.aho.no/studier/emner/2026/host/synthetic-8.html' })
    expect(result.completeness).toMatchObject({ complete: false, returned: 9 })
    expect(result.completeness.reason).toContain('Vår 2030, Høst 2030')
    expect(periods.some(period => period.year === 2030)).toBe(false)
  })

  it('also computes a gap from an explicitly published spring start without assuming autumn', () => {
    const result = ahoPlan(['Vår 2026', 'Høst 2026', 'Høst 2027'])
    expect(result.models[0].periods.map(period => period.studySemester)).toEqual([1, 2, 4])
    expect(result.completeness.reason).toContain('Vår 2027')
    expect(ahoPlan(['Høst 2026', 'Vår 2027']).completeness.complete).toBe(true)
  })

  it('requires a known cohort start and rejects duplicate or reversed calendar periods', () => {
    expect(() => ahoPlan(['Vår 2027', 'Høst 2027'])).toThrow(/startsemester i valgt opptaksår/)
    expect(() => ahoPlan(['Høst 2026', 'Vår 2027', 'Vår 2027'])).toThrow(/samme kalendersemester/)
    expect(() => ahoPlan(['Høst 2026', 'Høst 2027', 'Vår 2027'])).toThrow(/kronologisk rekkefølge/)
  })

  it.each(['Program description', 'Programme description', 'Study plan'])('recognizes the readable English cover "%s" while refusing to invent semesters from terms', cover => {
    expect(() => parseUitPdf(uitTermPages(cover), uitInfo, uitQuery)).toThrow(expect.objectContaining({ status: 'not-supported', message: expect.stringMatching(/PDF-en er lesbar.*terminer og ECTS-kolonner.*ingen kalenderår eller studiepoeng er gjettet/) }))
  })

  it('still distinguishes a truly unreadable cover and a readable unsupported non-term table', () => {
    expect(() => parseUitPdf([], uitInfo, uitQuery)).toThrow(expect.objectContaining({ status: 'source-changed', message: expect.stringContaining('lesbar studieplanforside') }))
    const pages = uitTermPages().slice(0, 1)
    expect(() => parseUitPdf(pages, uitInfo, uitQuery)).toThrow(expect.objectContaining({ status: 'not-supported', message: expect.stringContaining('ingen entydig støttet semesterfordeling') }))
    expect(() => parseUitPdf(uitTermPages(), uitInfo, { ...uitQuery, cohortFromStudent: 'false' })).toThrow(/Oppgi ditt eget kull/)
  })
})
