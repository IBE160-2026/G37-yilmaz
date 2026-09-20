import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseNtnuProgramPlan } from '../../server/providers/ntnu-programs.js'
import { parseNlaPlan } from '../../server/providers/nla-programs.js'
import { parseUibProgram } from '../../server/providers/uib-programs.js'
import { parseAnsgarCalendar } from '../../server/providers/ansgar-calendar.js'

const group = code => ({ courses: [{ code, name: code, credit: 10, studyChoice: { code: 'V' } }] })
const direction = (code, course, children) => ({ code, name: code, courseGroups: course ? [group(course)] : [], studyDirection: children })
const ntnu = studyPeriods => parseNtnuProgramPlan({ studyplan: { code: 'TEST', year: 2026, startTerm: 'H', studyPeriods } }, { program: 'TEST', cohort: '2026' }, 'https://www.ntnu.no/studier/studieplan')
const table = (period, code) => `<table><tr><td>${period}</td><td>Obligatorisk ${code}</td></tr></table>`
function nla(tables) {
  const props = { dropdown: { selected: '2026' }, items: { 2026: { title: 'Test', table: { list: [] }, accordions: [
    { title: 'Emneoversikt', content: ['A100', 'B200'].map(code => `<p><a href="/your-studies/emneplan/${code}/2026">${code}</a> - ${code} - 10 Studiepoeng</p>`).join('') },
    { title: 'Oppbygging', content: tables },
  ] } } }
  return parseNlaPlan(`<script type="application/json" data-react4xp-app-name="no.seeds.nla">${JSON.stringify({ jsxPath: 'StudieplanPage', props })}</script>`, 'https://www.nla.no/your-studies/studieplan/TEST/2026', '2026')
}
const link = code => `<a href="/emner/${code.toLowerCase()}">${code} – Emne ${code}</a>`
const uib = html => parseUibProgram(`<main><h1>Test</h1><details><h2>Oppbygging</h2><div class="accordion__main"><p>1. semester, høst</p>${html}</div></details></main>`, '<main><h1>Studieplan høst 2026</h1></main>', { program: 'test', cohort: '2026', cohortFromStudent: 'true' }, 'https://www4.uib.no/studier/program/test').models[0].periods[0].courses

describe('R12 faithful course rows, ancestor periods and unknown teaching weeks', () => {
  it('inherits every NTNU ancestor semester without sibling courses, independent of source order', () => {
    const periods = [
      { periodNumber: 1, direction: { courseGroups: [group('C101')] } },
      { periodNumber: 3, direction: direction('A', 'A301') },
      { periodNumber: 3, direction: direction('A2', 'OTHER301') },
      { periodNumber: 5, direction: direction('A', null, [direction('B', 'B501'), direction('C', 'SIBLING501')]) },
    ]
    for (const input of [periods, [...periods].reverse()]) {
      const result = ntnu(input).models.find(model => model.id === 'A/B')
      expect(result.periods.map(period => period.studySemester)).toEqual([1, 3, 5])
      expect(result.periods.flatMap(period => period.courses.map(course => course.code))).toEqual(['C101', 'A301', 'B501'])
      expect(result.periods.flatMap(period => period.courses).every(course => course.choice === 'V')).toBe(true)
    }
  })

  it('keeps the closest published NTNU period when common, parent and child share the ordinal', () => {
    const result = ntnu([
      { periodNumber: 3, direction: { courseGroups: [group('COMMON301')] } },
      { periodNumber: 3, direction: direction('A', 'PARENT301') },
      { periodNumber: 3, direction: direction('A', null, [direction('B', 'CHILD301')]) },
      { periodNumber: 5, direction: direction('A', null, [direction('B', 'B501'), direction('C', 'C501')]) },
    ])
    expect(result.models.find(model => model.id === 'A/B').periods.flatMap(period => period.courses.map(course => course.code))).toEqual(['CHILD301', 'B501'])
    expect(result.models.find(model => model.id === 'A/C').periods.flatMap(period => period.courses.map(course => course.code))).toEqual(['PARENT301', 'C501'])
  })

  it.each(['1. semester Høst 2027', '1. semester Vår 2026'])('rejects conflicting NLA period %s without returning mixed mandatory courses', other => {
    expect(() => nla(table('1. semester Høst 2026', 'A100') + table(other, 'B200'))).toThrow(/motstridende kalenderperioder/)
    expect(() => nla(table('1. semester', 'A100') + table('1. semester Høst 2026', 'A100') + table(other, 'B200'))).toThrow(/motstridende kalenderperioder/)
  })

  it('keeps compatible NLA repetitions and genuinely undated periods without guessing', () => {
    const undated = nla(table('1. semester', 'A100') + table('1. semester', 'B200')).models[0].periods[0]
    expect(undated).toMatchObject({ year: null, semester: null })
    const published = nla(table('1. semester', 'A100') + table('1. semester Høst 2026', 'B200') + table('1. semester Haust 2026', 'A100')).models[0].periods[0]
    expect(published).toMatchObject({ year: 2026, semester: 'autumn' })
    expect(published.courses.map(course => [course.code, course.year, course.semester])).toEqual([['A100', 2026, 'autumn'], ['B200', 2026, 'autumn']])
  })

  it.each([
    `<ul><li>${link('A100')} (5 studiepoeng)</li><li>${link('B200')} (15 studiepoeng)</li></ul>`,
    `<table><tr><td>${link('A100')}</td><td>(5 studiepoeng)</td></tr><tr><td>${link('B200')}</td><td>(15 studiepoeng)</td></tr></table>`,
  ])('reads UiB credits from each individual structural course row', html => {
    expect(uib(html).map(course => [course.code, course.credits])).toEqual([['A100', 5], ['B200', 15]])
  })

  it('leaves UiB multi-course prose credits unknown while retaining unambiguous nested rows', () => {
    expect(uib(`<p>${link('A100')} eller ${link('B200')} (15 studiepoeng)</p>`).map(course => course.credits)).toEqual([null, null])
    expect(uib(`<p><span>${link('A100')}</span> (7,5 studiepoeng)</p>`)[0].credits).toBe(7.5)
  })

  it('retains the captured UiB applied-mathematics structure and its explicit ten-credit rows', () => {
    const fixture = name => readFileSync(new URL(`../fixtures/public-programs/${name}`, import.meta.url), 'utf8')
    const result = parseUibProgram(fixture('uib-math-current.html'), fixture('uib-math-formal.html'), { program: 'anvendt-matematikk-bachelor', cohort: '2026', cohortFromStudent: 'true' }, 'https://www4.uib.no/studier/program/anvendt-matematikk-bachelor')
    const periods = result.models[0].periods
    expect(periods.map(period => period.studySemester)).toEqual([1, 2, 3, 4, 5, 6])
    expect(periods[0].courses.map(course => course.code)).toEqual(['INF100', 'MAT111', 'MAT100'])
    expect(periods.flatMap(period => period.courses).map(course => course.credits)).toEqual(Array(11).fill(10))
    expect(periods.every(period => period.year === null)).toBe(true)
    expect(result.completeness.complete).toBe(false)
  })

  it.each(['X uker', '? uker', 'ukjente uker', 'Uke X'])('keeps Ansgar %s unresolved and preserves every concrete event identity', marker => {
    const data = JSON.parse(readFileSync(new URL('../fixtures/ansgar-timetable-7.json', import.meta.url), 'utf8'))
    const before = parseAnsgarCalendar(data.pages, data.source)
    for (const page of data.pages) for (const item of page.items) item.str = item.str.replace(/11 uker/g, marker)
    const after = parseAnsgarCalendar(data.pages, data.source)
    expect(after.count).toBe(87)
    expect(after.unresolved).toHaveLength(3)
    expect(after.unresolved.every(row => row.reason.includes('Ingen datoer er gjettet'))).toBe(true)
    expect(after.calendar).toBe(before.calendar)
  })
})
