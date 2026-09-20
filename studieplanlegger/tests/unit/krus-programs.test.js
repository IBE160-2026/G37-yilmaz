import { expect, it } from 'vitest'
import { parseKrusCatalogue, parseKrusPlan, krusPrograms } from '../../server/providers/krus-programs.js'

const source = 'https://www.krus.no/for-aspiranter-og-studenter/aspirant-heltidsutdanningen'
const query = { program: 'aspirant-heltidsutdanningen', sourceUrl: source, cohort: '2026', cohortFromStudent: 'true' }
const wrap = body => `<h1>Testløp</h1><div><h2>Emneoversikt</h2><div class="sv-text-portlet-content">${body}</div></div>`
it('parses shared semester sections, preserves total credits and does not invent calendar or mandatory status', () => {
  const r = parseKrusPlan(wrap('<h3>1.semester</h3><p>KRUS1000 Innføring 10 stp.</p><h3>2. og 3. semester</h3><p>KRUS2000 Sikkerhet 30 stp.</p><h3>4. semester</h3><p>KRUS2400 Etikk 7,5 stp.</p><h3>Pliktår</h3><p>Ingen emner her.</p>'), query)
  expect(r.models[0].periods.map(p => [p.studySemester, p.courses[0].credits])).toEqual([[1, 10], [2, 30], [3, 30], [4, 7.5]])
  expect(r.models[0].periods.every(p => p.year === null && p.semester === null && p.courses[0].choice === '')).toBe(true)
  expect(r.models[0].periods[1].requirements[0]).toContain('hele emnet')
  expect(r.program.cohortFromStudent).toBe(true)
})
it('preserves alternatives and unlinked course rows in numbered-word semester lists', () => {
  const r = parseKrusPlan(wrap('<h3>Første semester</h3><ul><li>KRUS1000D Innføring</li></ul><h3>Andre semester</h3><ul><li>KRUS2100D Miljøarbeid og/eller KRUS2000D Sikkerhet</li></ul><h3>Tredje semester</h3><p>Studentene velger et av disse valgfrie emnene:</p><p>KRUS3201 Testvalg</p>'), query)
  const p = r.models[0].periods
  expect(p[0].courses[0].credits).toBeNull()
  expect(p[1].courses.map(c => [c.code, c.name, c.choice])).toEqual([['KRUS2100D', 'Miljøarbeid', 'V'], ['KRUS2000D', 'Sikkerhet', 'V']])
  expect(p[2].courses[0].choice).toBe('V')
  expect(p[2].requirements[0]).toContain('velger et')
})
it('collects all distinct programme entry links from the source catalogue', () => {
  const html = `<a href="${source}">Heltid</a><a href="${source}">Heltid</a><a href="/for-aspiranter-og-studenter/aspirant-deltidsutdanningen">Deltid</a><a href="/for-aspiranter-og-studenter/student-bachelorpabygg-og-enkeltemner">Bachelor</a><a href="https://wrong.example/for-aspiranter-og-studenter/aspirant-heltidsutdanningen">Feil</a>`
  expect(parseKrusCatalogue(html)).toHaveLength(3)
})
it('rejects an unconfirmed cohort and mismatched programme rather than choosing a PDF year', () => {
  expect(() => parseKrusPlan(wrap('<h3>1. semester</h3><p>KRUS1000 Test</p>'), { ...query, cohortFromStudent: undefined })).toThrow('kull')
  expect(() => parseKrusPlan('', { ...query, program: 'wrong' })).toThrow('stemmer ikke')
})
it('rejects changed structure or out-of-source references with no partial plan', () => {
  expect(() => parseKrusPlan('<h1>Markedsføring</h1>', query)).toThrow('emneoversikt')
  expect(() => parseKrusPlan(wrap('<h3>1. semester</h3><p><a href="https://other.example/private">KRUS1000 Test</a></p>'), query)).toThrow('utenfor')
})
it('rejects unapproved document paths before network access', async () => {
  let calls = 0
  await expect(krusPrograms('krus', 'program-plan', { ...query, sourceUrl: 'https://www.krus.no/admin' }, { fetchText: async () => { calls++ } })).rejects.toThrow()
  expect(calls).toBe(0)
})
