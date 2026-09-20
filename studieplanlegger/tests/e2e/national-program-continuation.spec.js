import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { parseNordProgramPlan } from '../../server/providers/nord-programs.js'
import { parseUiaProgramPlan } from '../../server/providers/uia-programs.js'
import { parseUioCatalogue, parseUioPlan } from '../../server/providers/uio-programs.js'
import { parseVortexPlan } from '../../server/providers/vortex-programs.js'
import { parseSkrivekunstProgramme } from '../../server/providers/skrivekunst-programs.js'
import { navigate, key, saved } from './helpers.js'

const fixture = path => readFile(new URL(`../fixtures/${path}`, import.meta.url), 'utf8')

async function samples() {
  const nordSource = 'https://www.nord.no/studier/studieplaner/testprogram-test-bachelor-host-2026'
  const nord = parseNordProgramPlan(await fixture('nord-program-plan.html'), { program: 'testprogram-test-bachelor', cohort: '2026', sourceUrl: nordSource })
  const uioSelected = parseUioCatalogue(await fixture('uio-programs/catalogue.html'))[0]
  const uio = parseUioPlan(await fixture('uio-programs/informatikk.html'), { program: uioSelected.code, cohort: '2026', cohortFromStudent: 'true' }, uioSelected)
  const moldeProgram = { code: 'logistikk-scm', name: 'Logistikk og Supply Chain Management', sourceUrl: 'https://www.himolde.no/studier/programmer/logistikk-scm/', campuses: [] }
  const molde = parseVortexPlan('himolde', await fixture('vortex-programs/himolde-plan.html'), { program: moldeProgram.code, cohort: '2026', sourceUrl: 'https://www.himolde.no/studier/programmer/logistikk-scm/studieplaner/2026.html' }, moldeProgram)
  const uiaSource = 'https://www.uia.no/studier/program/data-ingeniorutdanning-bachelor/studieplaner/2026h.html'
  const uiaProgram = { code: 'data-ingeniorutdanning-bachelor', name: 'Dataingeniør, bachelor', sourceUrl: 'https://www.uia.no/studier/program/data-ingeniorutdanning-bachelor/', campuses: ['Grimstad'] }
  const uia = parseUiaProgramPlan(await fixture('uia-program-plan.html'), { program: uiaProgram.code, cohort: '2026', sourceUrl: uiaSource })
  const nihProgram = { code: 'bachelor-i-trenerrollen-og-idrettspsykologi', name: 'Bachelor i trenerrollen og idrettspsykologi', sourceUrl: 'https://www.nih.no/studier/programmer/bachelor-i-trenerrollen-og-idrettspsykologi/', campuses: [] }
  const nihSource = 'https://www.nih.no/studier/program-og-emneplan-arkiv/bachelor-i-trenerrollen-og-idrettspsykologi-2022.html'
  const nih = parseVortexPlan('nih', await fixture('vortex-programs/nih-history-plan.html'), { program: nihProgram.code, cohort: '2022', sourceUrl: nihSource }, nihProgram)
  const hiofProgram = { code: 'bedok-bedriftsokonomi-arsstudium', name: 'Bedriftsøkonomi, årsstudium', sourceUrl: 'https://www.hiof.no/studier/programmer/bedok-bedriftsokonomi-arsstudium/', campuses: [] }
  const hiofSource = 'https://www.hiof.no/studier/programmer/bedok-bedriftsokonomi-arsstudium/studieplaner/h2026.html'
  const hiof = parseVortexPlan('hiof', await fixture('vortex-programs/hiof-plan.html'), { program: hiofProgram.code, cohort: '2026', sourceUrl: hiofSource }, hiofProgram)
  const writing = parseSkrivekunstProgramme(await fixture('public-programs/skrivekunst-arsstudium.html'))
  const skrivekunst = { status: 'ok', program: { ...writing.program, cohort: writing.cohort, sourceEdition: writing.sourceEdition }, models: [writing.model], warnings: writing.warnings, completeness: { complete: true, pages: 1, returned: 1 } }
  return [
    { id: 'nord', plan: nord, program: { code: nord.program.code, name: nord.program.name, sourceUrl: nordSource, campuses: nord.program.campuses }, cohort: { cohort: '2026', sourceUrl: nordSource } },
    { id: 'uio', plan: uio, program: uioSelected, cohort: { cohort: 'student', sourceUrl: uioSelected.sourceUrl, requiresStudentCohort: true } },
    { id: 'himolde', plan: molde, program: moldeProgram, cohort: { cohort: '2026', sourceUrl: molde.program.sourceUrl } },
    { id: 'uia', plan: uia, program: uiaProgram, cohort: { cohort: '2026', sourceUrl: uiaSource } },
    { id: 'nih', plan: nih, program: nihProgram, cohort: { cohort: '2022', sourceUrl: nihSource, historical: true, requiresHistoricalConfirmation: true }, historical: true },
    { id: 'hiof', plan: hiof, program: hiofProgram, cohort: { cohort: '2026', sourceUrl: hiofSource } },
    { id: 'skrivekunst', plan: skrivekunst, program: writing.program, cohort: { cohort: writing.cohort, sourceUrl: writing.program.sourceUrl } },
  ]
}

async function importFirstPeriod(page, sample, options = {}) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption(sample.id)
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0'); await host.locator('[name=cohort]').selectOption('0')
  if (sample.cohort.requiresStudentCohort) await host.locator('[name=studentCohort]').fill('2026')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption(sample.plan.models[0].id)
  const period = options.period || sample.plan.models[0].periods.find(item => item.courses?.length) || sample.plan.models[0].periods[0]
  await host.locator('[name=studySemester]').selectOption(period.id)
  if (period.year && period.semester) await host.locator('[name=calendarSemester]').selectOption(`${period.year}:${period.semester}`)
  else { await host.locator('[name=clarifiedYear]').fill(String(options.year || 2026)); await host.locator('[name=clarifiedSemester]').selectOption(options.semester || 'autumn') }
  if (period.requiresStudentStudySemester) await host.locator('[name=clarifiedStudySemester]').fill(String(options.studySemester || period.allowedStudySemesters?.[0] || 1))
  await host.locator('[name=programCampus]').selectOption(sample.plan.program.campuses?.[0] || '__unknown')
  const checked = host.locator('fieldset input[type=checkbox]:checked')
  if (!await checked.count()) await host.locator('fieldset input[type=checkbox]').first().check()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeVisible()
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  return host
}

for (const samplePromise of [0, 1, 2, 3, 4, 5, 6]) test(`new national programme structure ${samplePromise + 1} previews, saves, reloads and repeats`, async ({ page }) => {
  const sample = (await samples())[samplePromise]
  const planRequests = []
  await page.route(`**/api/import/providers/${sample.id}/**`, async route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    if (action === 'program-plan') planRequests.push(route.request().url())
    const data = action === 'programs' ? { results: [sample.program], completeness: { complete: true } } : action === 'program-cohorts' ? { results: [sample.cohort] } : sample.plan
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  await page.goto('/')
  const host = await importFirstPeriod(page, sample)
  await expect.poll(async () => (await saved(page)).planner.courses.length).toBeGreaterThan(0)
  const first = await saved(page), ids = first.planner.courses.map(course => course.id)
  await page.reload(); expect((await saved(page)).planner.courses.map(course => course.id)).toEqual(ids)
  await importFirstPeriod(page, sample)
  const second = await saved(page)
  expect(second.planner.courses.map(course => course.id)).toEqual(ids)
  if (sample.historical) expect(new URL(planRequests[0]).searchParams.get('historicalConfirmed')).toBe('true')
  expect(await page.evaluate(key => localStorage.getItem(key) !== null, key)).toBe(true)
  await expect(host.getByRole('status')).toContainText(/lagret/i)
  if (['uia', 'nih', 'hiof'].includes(sample.id)) await page.screenshot({ path: `artifacts/national-${sample.id}-programme-final-20260919.png`, fullPage: true })
})

test('the Skrivekunst annual unit remains one 60-credit unit across both study semesters', async ({ page }) => {
  const sample = (await samples()).find(item => item.id === 'skrivekunst')
  await page.route('**/api/import/providers/skrivekunst/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs' ? { results: [sample.program], completeness: { complete: true } } : action === 'program-cohorts' ? { results: [sample.cohort] } : sample.plan
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  await page.goto('/')
  await importFirstPeriod(page, sample, { studySemester: 1, year: 2026, semester: 'autumn' })
  await page.reload()
  await importFirstPeriod(page, sample, { studySemester: 2, year: 2027, semester: 'spring' })
  const state = await saved(page)
  const units = state.planner.courses.filter(course => course.sourceProvider === 'skrivekunst-program')
  expect(units).toHaveLength(1)
  expect(units[0].credits).toBe(60)
  expect(units[0].programBinding.studySemesters).toEqual([1, 2])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'artifacts/national-skrivekunst-mobile-final-20260919.png', fullPage: true })
})

test('a Vortex plan without published terms remains selectable through explicit student placement', async ({ page }) => {
  const program = { code: 'bachelor-i-trenerrollen-og-idrettspsykologi', name: 'Bachelor i trenerrollen og idrettspsykologi', sourceUrl: 'https://www.nih.no/studier/programmer/bachelor-i-trenerrollen-og-idrettspsykologi/', campuses: [] }
  const plan = parseVortexPlan('nih', await fixture('vortex-programs/nih-current-unversioned.html'), { program: program.code, cohort: '2026', cohortFromStudent: 'true', sourceUrl: program.sourceUrl }, program)
  const sample = { id: 'nih', program, plan, cohort: { cohort: 'student', sourceUrl: program.sourceUrl, requiresStudentCohort: true } }
  expect(plan.models[0].periods[0]).toMatchObject({ id: 'student-placement', requiresStudentStudySemester: true, year: null, semester: null })
  await page.route('**/api/import/providers/nih/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs' ? { results: [program], completeness: { complete: true } } : action === 'program-cohorts' ? { results: [sample.cohort] } : plan
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  await page.goto('/')
  await importFirstPeriod(page, sample, { studySemester: 1, year: 2026, semester: 'autumn' })
  expect((await saved(page)).planner.courses.some(course => course.sourceProvider === 'nih')).toBe(true)
})
