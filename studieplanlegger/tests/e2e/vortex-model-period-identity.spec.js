import { test, expect } from '@playwright/test'
import { parseVortexPlan } from '../../server/providers/vortex-programs.js'
import { navigate, saved } from './helpers.js'

const sourceUrl = 'https://www.hiof.no/studier/programmer/testprogram/'
const planUrl = `${sourceUrl}studieplaner/h2026.html`
const program = { code: 'testprogram', name: 'Testprogram', sourceUrl, campuses: [] }
const courseList = (term, code, name) => `<h3>${term}</h3><ul class="course-list"><li class="mandatory"><a class="course-link" href="/studier/emner/test/${code.toLowerCase()}.html"><span class="course-code">${code}</span><span class="course-name">${name}</span><span class="course-study-points">10</span></a></li></ul>`
const html = `<main><h1>Testprogram</h1>
  <div class="vrtx-fs-study-model"><h2>Retning én</h2>${courseList('Høst 2026', 'ANN100', 'Annet emne')}</div>
  <div class="vrtx-fs-study-model"><h2>Retning to</h2>${courseList('Høst 2026', 'FEL100', 'Fellesemne')}${courseList('Vår 2027', 'FEL100', 'Fellesemne')}</div>
</main>`
const plan = parseVortexPlan('hiof', html, { program: program.code, cohort: '2026', sourceUrl: planUrl }, program)

async function importPeriod(page, periodIndex, studySemester) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('hiof')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption(plan.models[1].id)
  const period = plan.models[1].periods[periodIndex]
  await host.locator('[name=studySemester]').selectOption(period.id)
  await host.locator('[name=clarifiedStudySemester]').fill(String(studySemester))
  await host.locator('[name=calendarSemester]').selectOption(`${period.year}:${period.semester}`)
  await host.locator('[name=programCampus]').selectOption('__unknown')
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.getByRole('status')).toContainText(/lagret/i)
}

test('Vortex model two stores, reloads and repeats the same course code in two periods', async ({ page }) => {
  expect(plan.models).toHaveLength(2)
  expect(plan.models[1].periods.map(period => [period.studySemester, period.requiresStudentStudySemester])).toEqual([[null, true], [null, true]])
  await page.route('**/api/import/providers/hiof/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs' ? { results: [program] } : action === 'program-cohorts' ? { results: [{ cohort: '2026', sourceUrl: planUrl }] } : plan
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  await page.goto('/')
  await importPeriod(page, 0, 1)
  await page.reload()
  await importPeriod(page, 1, 2)
  const first = await saved(page), courses = first.planner.courses.filter(course => course.sourceRecordId === 'testprogram:FEL100')
  expect(courses).toHaveLength(2)
  expect(new Set(courses.map(course => course.id)).size).toBe(2)
  expect(courses.map(course => [course.year, course.semester, course.programBinding.modelId, course.programBinding.studySemester])).toEqual([
    [2026, 'autumn', plan.models[1].id, 1],
    [2027, 'spring', plan.models[1].id, 2],
  ])
  const ids = courses.map(course => course.id)
  await page.reload()
  expect((await saved(page)).planner.courses.filter(course => course.sourceRecordId === 'testprogram:FEL100').map(course => course.id)).toEqual(ids)
  await importPeriod(page, 0, 1)
  await page.reload()
  await importPeriod(page, 1, 2)
  const repeated = (await saved(page)).planner.courses.filter(course => course.sourceRecordId === 'testprogram:FEL100')
  expect(repeated.map(course => course.id)).toEqual(ids)
})
