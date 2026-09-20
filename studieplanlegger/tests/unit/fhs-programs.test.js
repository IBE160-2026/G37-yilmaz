import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fhsPrograms, fhsProgramUrl, parseFhsCohorts, parseFhsPlan } from '../../server/providers/fhs-programs.js'

const base = 'https://www.forsvaret.no/utdanning/utdanninger', code = 'master-i-militaere-studier-forsvarets-hogskole-milma'
const root = `${base}/${code}`, sourceUrl = `${root}/MAMIL90-26`, query = { program: code, cohort: '2026', sourceUrl }
const fixture = readFileSync(new URL('../fixtures/public-programs/fhs-master.html', import.meta.url), 'utf8')
const index = `<script data-part-id="main" type="application/json">${JSON.stringify({ perPage: 2, serviceUrl: '/utdanning/utdanninger/_/service/no.bouvet.forsvaret/list-education-service?locations=public' })}</script>`
const row = (id, type = 'Master') => ({ _id: String(id), title: `Studium ${id}`, url: `${root}${id === 1 ? '' : id}`, data: { type, location: 'Oslo' } })
const cohorts = `<h1>Master</h1><a href="${sourceUrl}">Master i militære studier, kull 2026</a>`

describe('Forsvarets public study catalogue', () => {
  it('follows the published start/count pages, preserving every degree row', async () => {
    const seen = [], fetchText = async url => {
      seen.push(url)
      if (url === base) return index
      const start = new URL(url).searchParams.get('start')
      return JSON.stringify({ total: 3, hits: start === '0' ? [row(1), row(2, 'Lærling med førstegangstjeneste')] : [row(3, 'Bachelor')] })
    }
    const data = await fhsPrograms('fhs', 'programs', {}, { fetchText })
    expect(data.results.map(p => p.name)).toEqual(['Studium 1', 'Studium 3'])
    expect(data.completeness).toMatchObject({ complete: true, pages: 2, sourceReturned: 3, sourceTotal: 3 })
    expect(seen.at(-1)).toContain('start=2&count=2')
  })
  it('stops a repeated page and marks the returned catalogue incomplete', async () => {
    const data = await fhsPrograms('fhs', 'programs', {}, { fetchText: async url => url === base ? index : JSON.stringify({ total: 4, hits: [row(1), row(2)] }) })
    expect(data.results).toHaveLength(2)
    expect(data.completeness.complete).toBe(false)
    expect(data.completeness.pages).toBe(2)
  })
  it('does not turn conflicting published start years into a confirmed cohort', () => {
    const html = `<a href="${base}/flyger/LK-FLYNAV-2026-H%C3%98ST">Oppstart høst 25</a>`
    expect(parseFhsCohorts(html, `${base}/flyger`)[0]).toMatchObject({ cohort: 'student', requiresStudentCohort: true })
  })
  it('uses actual semester headings instead of older course-description versions', () => {
    const plan = parseFhsPlan(fixture, query, { code, campuses: [] }), periods = plan.models[0].periods
    expect(periods.map(p => [p.studySemester, p.year, p.semester])).toEqual([[1, 2026, 'autumn'], [2, 2027, 'spring'], [3, 2027, 'autumn']])
    expect(periods[0].courses.map(c => c.code)).toEqual(['MAKE4101', 'MAKE4102', 'MAKE4103'])
    const practice = periods[1].courses.find(c => c.code === 'MAKE4301')
    expect(practice).toMatchObject({ credits: 0, choice: 'O', year: 2027, sourceVersion: '2026-VÅR', versionUncertain: true })
    expect(periods[1].courses.find(c => c.code === 'MAFE4201').choice).toBe('V')
    expect(periods[2].courses[0].credits).toBe(30)
  })
  it('requires calendar clarification when the source has an ambiguous number of terms', () => {
    const plan = parseFhsPlan(fixture.replace('Høst 2026 / Vår 2027', 'Studieår 2026–2027'), query, { code, campuses: [] })
    expect(plan.models[0].periods[0]).toMatchObject({ year: null, semester: null })
    expect(plan.completeness.complete).toBe(false)
  })
  it('checks that a plan URL is actually published under the chosen programme', async () => {
    const fetchText = async url => url === base ? index : url.includes('list-education-service') ? JSON.stringify({ total: 1, hits: [row(1)] }) : url === root ? cohorts : fixture
    expect((await fhsPrograms('fhs', 'program-plan', query, { fetchText })).status).toBe('ok')
    await expect(fhsPrograms('fhs', 'program-plan', { ...query, cohort: '2025' }, { fetchText })).rejects.toMatchObject({ status: 'invalid-selection' })
    await expect(fhsPrograms('fhs', 'program-plan', { ...query, sourceUrl: `${root}/invented` }, { fetchText })).rejects.toMatchObject({ status: 'invalid-selection' })
  })
  it('rejects foreign sources, credentials, query parameters and plan redirects', async () => {
    for (const url of ['http://127.0.0.1/test', sourceUrl.replace('www.forsvaret.no', 'www.forsvaret.no.example.com'), `${sourceUrl}?redirect=private`, sourceUrl.replace('https://', 'https://user@')]) expect(() => fhsProgramUrl(url)).toThrow()
    await expect(fhsPrograms('fhs', 'program-cohorts', { program: code, sourceUrl: root }, { fetchText: async (url, _, validate) => {
      if (url === base) return index
      if (url.includes('list-education-service')) return JSON.stringify({ total: 1, hits: [row(1)] })
      validate(`${base}/another-programme`); return cohorts
    } })).rejects.toMatchObject({ status: 'invalid-selection' })
  })
})
