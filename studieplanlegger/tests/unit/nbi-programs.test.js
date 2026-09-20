import { describe, it, expect } from 'vitest'
import { parseNbiCatalogue, parseNbiPdfPlan, nbiPdfUrl } from '../../server/providers/nbi-programs.js'
const sourceUrl = 'https://barnebokinstituttet.no/wp-content/uploads/2026/04/Studieplan-masterstudet-2026.pdf'
const query = { program: 'masterstudiet-i-skrivekunst-og-formidling', cohort: '2026', cohortFromStudent: 'true', sourceUrl }
const program = { code: query.program, name: 'Master i skrivekunst og formidling', campuses: [] }
// Short metadata excerpts from the actual 2026 PDF, read 2026-09-12.
const pages = [
  { page: 4, lines: ['Barnelitterære formater', 'Emnet er obligatorisk og gir 10 studiepoeng. Emnet gis i studiets første semester.'] },
  { page: 5, lines: ['Målgrupperettet formidling', 'Emnet gir 20 studiepoeng. Undervisning skjer i andre semester. Det åpnes for utveksling i deler av', 'emnet.'] },
  { page: 6, lines: ['Skrivekunst', 'Emnet gir 30 studiepoeng. Undervisning gis i tre bolker i første og andre semester. Det åpnes for'] },
  { page: 7, lines: ['Kunstnerisk research', 'Emnet er obligatorisk og gir 5 studiepoeng. Undervisningen gis i tredje semester.', 'Kunstnerisk refleksjon', 'Emnet er obligatorisk og gir 10 studiepoeng. Emnet gis i tredje og fjerde semester.'] },
  { page: 8, lines: ['Masterprosjekt', 'Emnet gir 45 studiepoeng. Emnet gis i tredje og fjerde semester.'] },
]
describe('NBI public programme PDFs', () => {
  it('reads all programme links including the master link in the public navigation', () => {
    const data = parseNbiCatalogue('<nav><a href="/utdanninger-og-kurs/masterstudiet-i-skrivekunst-og-formidling/">Master</a></nav><a href="/utdanninger-og-kurs/forfatterutdanningen/">Forfatterutdanningen</a><a href="/utdanninger-og-kurs/undervisningsstab/">Ansatte</a>')
    expect(data).toHaveLength(2)
    expect(data[0].code).toBe(query.program)
  })
  it('preserves published credits and multi-semester courses without inventing codes or calendar years', () => {
    const data = parseNbiPdfPlan(pages, query, program), periods = data.models[0].periods
    expect(data.completeness.returned).toBe(6)
    expect(periods.map(p => p.studySemester)).toEqual([1, 2, 3, 4])
    expect(periods.every(p => p.year === null && p.semester === null)).toBe(true)
    expect(periods[0].courses.map(c => c.name)).toEqual(['Barnelitterære formater', 'Skrivekunst'])
    expect(periods[0].courses[1]).toMatchObject({ code: '', credits: 30, choice: '', requiresSemesterChoice: true })
    expect(periods[3].courses.find(c => c.name === 'Masterprosjekt').credits).toBe(45)
    expect(data.program.cohortFromStudent).toBe(true)
  })
  it('also reads the numeric semester metadata of the writer programme', () => {
    const data = parseNbiPdfPlan([{ page: 5, lines: ['Skrivekunst 1: Barnelitterære sjangre', 'Emnet er obligatorisk, går i 1. og 2. semester og gir 10 studiepoeng.'] }], query, program)
    expect(data.models[0].periods.map(p => p.studySemester)).toEqual([1, 2])
    expect(data.models[0].periods[0].courses[0]).toMatchObject({ choice: 'O', credits: 10 })
  })
  it('keeps source identity stable through an unrelated PDF content revision', () => {
    const before = parseNbiPdfPlan(pages, query, program), after = parseNbiPdfPlan([...pages, { page: 10, lines: ['Revidert bakgrunnstekst'] }], query, program)
    expect(after.models[0].periods[0].courses).toEqual(before.models[0].periods[0].courses)
    expect(after.program.sourceEdition).not.toBe(before.program.sourceEdition)
  })
  it('requires actual student cohort input and does not manufacture unnamed modules', () => {
    expect(() => parseNbiPdfPlan(pages, { ...query, cohortFromStudent: undefined }, program)).toThrow()
    expect(() => parseNbiPdfPlan([{ page: 3, lines: ['Studieprogrammet er bygd opp av åtte moduler som fordeles over to semestre.'] }], query, program)).toThrow(/ingen støttede navngitte emner/)
  })
  it('requires student placement for a named course with no published semester', () => {
    const data = parseNbiPdfPlan([{ page: 4, lines: ['Et navngitt emne', 'Emnet gir 5 studiepoeng. Tidspunkt avklares senere.'] }], query, program)
    expect(data.models[0].periods[0]).toMatchObject({ studySemester: null, requiresStudentStudySemester: true })
  })
  it('rejects unrelated PDF hosts, credentials and private query parameters', () => {
    for (const url of [sourceUrl.replace('barnebokinstituttet.no', 'evil.test'), `${sourceUrl}?token=x`, sourceUrl.replace('https://', 'https://name@')]) expect(() => nbiPdfUrl(url)).toThrow()
  })
})
