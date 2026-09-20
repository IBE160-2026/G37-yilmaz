import { test, expect } from '@playwright/test'
import { navigate, key } from './helpers.js'

const sourceUrl = 'https://www.skrivekunst.no/arsstudium/'
const unit = {
  id: 'skrivekunst:arsstudium-skapande-skriving:2026/27', code: '', name: 'Årsstudium i skapande skriving',
  credits: 60, choice: 'O', sourceProvider: 'skrivekunst-program', sourceRecordId: 'arsstudium-skapande-skriving',
  sourceVersion: '2026/27', sourceUrl, university: 'Skrivekunstakademiet', description: '', notes: 'En samlet programenhet over studiesemester 1 og 2.',
  year: null, semester: null, campus: 'Bergen', spansStudySemesters: [1, 2], requiresSemesterChoice: true,
}
const plan = {
  program: { code: 'arsstudium-skapande-skriving', name: 'Årsstudium i skapande skriving', cohort: '2026', sourceEdition: '2026/27', sourceUrl, campuses: ['Bergen'] },
  models: [{ id: 'published-2026-2027', name: 'Publisert årsstudium 2026/27', periods: [{ id: 'studiesemester-1-2', label: 'Hele årsstudiet', studySemester: null, requiresStudentStudySemester: true, allowedStudySemesters: [1, 2], allowedCalendarPeriodsByStudySemester: { 1: { year: 2026, semester: 'autumn' }, 2: { year: 2027, semester: 'spring' } }, year: null, semester: null, courses: [unit], requirements: [] }] }],
}

async function importSemester(page, studySemester, year, semester) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('skrivekunst')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0'); await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption(plan.models[0].id); await host.locator('[name=studySemester]').selectOption('studiesemester-1-2')
  await host.locator('[name=clarifiedStudySemester]').fill(String(studySemester))
  await host.locator('[name=clarifiedYear]').fill(String(year)); await host.locator('[name=clarifiedSemester]').selectOption(semester)
  await host.locator('[name=programCampus]').selectOption('Bergen')
  await host.locator('.activity-choices input[type=checkbox]').check()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('1 emner')
}

test('Skrivekunst year unit keeps one identity and its two-semester binding', async ({ page }) => {
  await page.route('**/api/import/providers/skrivekunst/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs'
      ? { results: [{ code: plan.program.code, name: plan.program.name, sourceUrl }] }
      : action === 'program-cohorts'
        ? { results: [{ cohort: '2026', label: 'Studieåret 2026/27', sourceUrl }] }
        : plan
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  await page.goto('/')
  await importSemester(page, 1, 2026, 'autumn')
  const first = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).planner.courses, key)
  expect(first).toHaveLength(1)
  await page.reload()
  await importSemester(page, 2, 2027, 'spring')
  const second = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).planner.courses, key)
  expect(second).toHaveLength(1)
  expect(second.reduce((total, course) => total + course.credits, 0)).toBe(60)
  expect(second[0]).toMatchObject({ id: first[0].id, year: 2027, semester: 'spring', programBinding: { studySemester: 2, studySemesters: [1, 2], calendarYear: 2027, calendarSemester: 'spring' } })
  await page.reload()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).planner.courses, key)).toEqual(second)
})

test('Skrivekunst rejects a calendar period outside the published study-year mapping', async ({ page }) => {
  await page.route('**/api/import/providers/skrivekunst/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs' ? { results: [{ code: plan.program.code, name: plan.program.name, sourceUrl }] } : action === 'program-cohorts' ? { results: [{ cohort: '2026', label: 'Studieåret 2026/27', sourceUrl }] } : plan
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  await page.goto('/')
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('skrivekunst')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0'); await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption(plan.models[0].id); await host.locator('[name=studySemester]').selectOption('studiesemester-1-2')
  await host.locator('[name=clarifiedStudySemester]').fill('1')
  await expect(host.locator('[name=clarifiedYear]')).toHaveValue('2026')
  await host.locator('[name=clarifiedYear]').fill('2200')
  await host.locator('[name=programCampus]').selectOption('Bergen')
  await host.locator('.activity-choices input[type=checkbox]').check()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('Kilden knytter 1. studiesemester til høst 2026')
  const stored = await page.evaluate(key => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw).planner.courses : [] }, key)
  expect(stored).toHaveLength(0)
})
