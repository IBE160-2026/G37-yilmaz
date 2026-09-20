import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { parseMfPlan } from '../../server/providers/mf-programs.js'
import { parseHltPlan } from '../../server/providers/hlt-programs.js'
import { parseFihPlan } from '../../server/providers/fih-programs.js'
import { parseAnsgarCalendar } from '../../server/providers/ansgar-programs.js'
import { parseLdhPdfPlan } from '../../server/providers/ldh-pdf.js'
import { parseBarrattduePlan } from '../../server/providers/barrattdue-programs.js'
import { emptyPlanner, mergeCourseOnly, validPlanner } from '../../src/planner.js'

const fixture = name => readFile(new URL(`../fixtures/public-programs/${name}`, import.meta.url), 'utf8')
const current = (program, sourceUrl) => ({ program, sourceUrl, cohort: '2026', cohortFromStudent: 'true' })
function repeat(before, after) {
  const clarify = course => ({ ...course, year: 2026, semester: 'autumn' })
  let planner = mergeCourseOnly(emptyPlanner(), clarify(before))
  planner.courses[0].notes = 'Mine egne opplysninger'; planner.courses[0].name = 'Mitt emnenavn'
  planner = mergeCourseOnly(planner, clarify(after))
  expect(planner.courses).toHaveLength(1)
  expect(planner.courses[0]).toMatchObject({ notes: 'Mine egne opplysninger', name: 'Mitt emnenavn' })
  expect(validPlanner(planner)).toBe(true)
}
it('upgrades the known legacy page-hash edition only when public identity and semester match', () => {
  const course = { id: 'existing', code: 'TEOL1010', name: 'Bibelen', university: 'MF', year: 2026, semester: 'autumn', sourceProvider: 'mf', sourceRecordId: 'TEOL1010', sourceUrl: 'https://mf.no/studier/emner/teol1010', sourceVersion: 'side-0123456789abcdef', notes: '' }
  let planner = mergeCourseOnly(emptyPlanner(), course); planner.courses[0].notes = 'Mitt notat'
  const updated = mergeCourseOnly(planner, { ...course, sourceVersion: 'current' })
  expect(updated.courses).toHaveLength(1); expect(updated.courses[0]).toMatchObject({ id: 'existing', notes: 'Mitt notat', sourceVersion: 'current' })
  expect(planner.courses[0].sourceVersion).toBe(course.sourceVersion)
  for (const change of [{ sourceUrl: 'https://mf.no/studier/emner/other' }, { sourceRecordId: 'OTHER' }, { sourceVersion: 'cohort:2025' }, { sourceProvider: 'unknown' }]) expect(() => mergeCourseOnly(planner, { ...course, sourceVersion: 'current', ...change })).toThrow(/emneversjon/)
  const genuine = mergeCourseOnly(emptyPlanner(), { ...course, sourceVersion: 'cohort:2025' })
  expect(() => mergeCourseOnly(genuine, { ...course, sourceVersion: 'current' })).toThrow(/emneversjon/)
})
it.each([
  ['mf-professional-current.html', parseMfPlan, current('profesjonsstudium-teologi', 'https://mf.no/studier/programmer/profesjonsstudium-teologi')],
  ['hlt-bala-current.html', parseHltPlan, current('bala', 'https://hlt.no/bala/')],
  ['fih-mtm.html', parseFihPlan, current('mtm', 'https://fih.fjellhaug.no/studier/mtm')],
  ['barrattdue-vocal.html', parseBarrattduePlan, current('hoyere-utdanning/bachelor-i-utovende-musikk/studieplan-bachelor-utovende-musikk-vokal', 'https://barrattdue.no/studier/hoyere-utdanning/bachelor-i-utovende-musikk/studieplan-bachelor-utovende-musikk-vokal/')],
])('%s source presentation updates retain local course identity and edits', async (name, parse, query) => {
  const html = await fixture(name), a = parse(html, query), b = parse(`${html}\n<!-- public source presentation revision -->`, query)
  expect(a.program.sourceEdition).not.toBe(b.program.sourceEdition)
  for (let m = 0; m < a.models.length; m++) for (let p = 0; p < a.models[m].periods.length; p++) {
    const first = a.models[m].periods[p].courses, next = b.models[m].periods[p].courses
    for (let i = 0; i < first.length; i++) repeat(first[i], next[i])
  }
})
it('Ansgar calendar revisions preserve the actual calendar edition and local course', async () => {
  const html = await fixture('ansgar-calendar.html'), a = parseAnsgarCalendar(html), b = parseAnsgarCalendar(`${html}\n<!-- revision -->`)
  expect(a[0].edition).not.toBe(b[0].edition)
  repeat(a[0].periods[0].courses[0], b[0].periods[0].courses[0])
})
it('LDH PDF revisions preserve the confirmed cohort course and local edits', async () => {
  const pages = JSON.parse(await fixture('ldh-barsel-pdf-metadata.json')), q = { program: 'barsel', programName: 'Barsel', sourceUrl: 'https://ldh.no/studietilbud/barsel/plan.pdf', cohort: '2026' }, a = parseLdhPdfPlan(pages, q)
  pages[0].lines.push('Sist justert 12.09.2026')
  const b = parseLdhPdfPlan(pages, q)
  expect(a.program.sourceEdition).not.toBe(b.program.sourceEdition)
  repeat(a.models[0].periods[0].courses[0], b.models[0].periods[0].courses[0])
})
it('imports a whole HLT semester with different source courses that have no published code, then updates it without duplicates', async () => {
  const q = current('bala', 'https://hlt.no/bala/'), html = await fixture('hlt-bala-current.html')
  const initial = parseHltPlan(html, q).models[0].periods[0].courses, changed = parseHltPlan(`${html}\n<!-- revised -->`, q).models[0].periods[0].courses
  let planner = emptyPlanner()
  for (const course of initial) planner = mergeCourseOnly(planner, { ...course, year: 2026, semester: 'autumn' })
  expect(planner.courses).toHaveLength(3)
  planner.courses[0].name = 'Mitt eget emnenavn'; planner.courses[0].notes = 'Mine egne notater'
  for (const course of changed) planner = mergeCourseOnly(planner, { ...course, year: 2026, semester: 'autumn' })
  expect(planner.courses).toHaveLength(3)
  expect(planner.courses[0]).toMatchObject({ name: 'Mitt eget emnenavn', notes: 'Mine egne notater' })
  expect(validPlanner(planner)).toBe(true)
})
