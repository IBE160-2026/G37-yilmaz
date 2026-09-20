import { describe, it, expect } from 'vitest'
import { parseLimpiPlan, limpiPdfUrl } from '../../server/providers/limpi-programs.js'
const sourceUrl = 'https://limpimusic.com/uploads/Limpi_STUDYPLAN_2026_vs3.pdf'
// Structural excerpt of the public PDF, read 2026-09-12. Names/metadata only.
const pages = [
  { page: 2, lines: ['2026/2027', 'Name of study program', 'Advanced one-year program in Professional Music Production and the International Music Industry', 'The program runs across two semesters; September to December and January to June.'] },
  { page: 6, lines: ['The compulsory courses', 'Semester One – Fall', '• Practical Production 1 (PPR1), 15 credits', '• Music Business 1 (MUB1), 5 credits', '• Music Creation (MUCO), 5 credits', '• Music Performance (MUPE), 5 credits', 'Semester Two – Spring', '• Practical Production 2 (PPR2), 15 credits', '• Music Business 2 (MUB2), 5 credits', 'Plus one specialization course from the following:', '• Artist (ARTS), 10 credits', '• Producer (PROD), 10 credits', '• Songwriter (SONG), 10 credits', 'The study program’s content'] },
  { page: 18, lines: ['MUCO: Music Collaboration'] },
]
describe('LIMPI published PDF plan', () => {
  it('separates mandatory first-semester work from explicit second-semester specialization choices', () => {
    const data = parseLimpiPlan(pages, sourceUrl), [first, second] = data.models[0].periods
    expect(data.program.cohort).toBe('2026')
    expect(first).toMatchObject({ year: 2026, semester: 'autumn', studySemester: 1 })
    expect(first.courses.map(c => c.code)).toEqual(['PPR1', 'MUB1', 'MUCO', 'MUPE'])
    expect(first.courses.every(c => c.choice === 'O')).toBe(true)
    expect(second).toMatchObject({ year: 2027, semester: 'spring', studySemester: 2 })
    expect(second.courses.filter(c => c.choice === 'V').map(c => c.code)).toEqual(['ARTS', 'PROD', 'SONG'])
    expect(second.requirements).toHaveLength(1)
    expect(data.completeness.returned).toBe(9)
  })
  it('preserves a source-name disagreement for explicit inspection', () => {
    const data = parseLimpiPlan(pages, sourceUrl), course = data.models[0].periods[0].courses.find(c => c.code === 'MUCO')
    expect(course.name).toBe('Music Creation')
    expect(course.notes).toContain('Music Collaboration')
    expect(data.warnings.some(w => w.startsWith('MUCO:'))).toBe(true)
  })
  it('reports described courses omitted from the semester table without inventing placement', () => {
    const data = parseLimpiPlan([...pages, { page: 31, lines: ['OTHER: Additional Course', 'Course Responsible Duration', 'KNOWLEDGE: The candidate'] }], sourceUrl)
    expect(data.completeness.complete).toBe(false)
    expect(data.models[0].periods.flatMap(p => p.courses).some(c => c.code === 'OTHER')).toBe(false)
  })
  it('does not infer a missing academic year or invent courses from a changed heading', () => {
    const altered = structuredClone(pages); altered[0].lines[0] = 'Published study plan'
    expect(() => parseLimpiPlan(altered, sourceUrl)).toThrow()
    altered[0] = pages[0]; altered[1].lines = altered[1].lines.filter(l => l !== 'Semester Two – Spring')
    expect(() => parseLimpiPlan(altered, sourceUrl)).toThrow()
  })
  it('rejects external and token-bearing PDF sources', () => {
    for (const url of ['https://example.com/uploads/plan.pdf', 'http://127.0.0.1/plan.pdf', `${sourceUrl}?token=x`, sourceUrl.replace('/uploads/', '/private/')]) expect(() => limpiPdfUrl(url)).toThrow()
  })
})
