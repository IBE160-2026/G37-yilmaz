import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { navigate, openTaskDetails } from './helpers.js'

const key = 'studieplanlegger:v1'
const courses = ['NTNU', 'HVL'].map((university, index) => ({
  id: `isolated-course-${index}`, code: 'MAT100', name: 'Matematikk', university,
  semester: 'autumn', year: 2026, credits: 10,
}))
async function seed(page) {
  await page.addInitScript(({ key, courses }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1, tasks: [], planner: { courses, sources: [], events: [] },
    }))
  }, { key, courses })
  await page.goto('/')
}
async function dataMenu(page) {
  await navigate(page, 'settings')
  const menu = page.locator('.data-menu')
  if (!await menu.evaluate(node => node.open)) await menu.locator('summary').click()
}

test('same-name courses at different institutions remain individually selectable', async ({ page }) => {
  await seed(page)
  await page.locator('#view-all').click()
  await page.locator('#new-task').click()
  await page.locator('#title').fill('Isolert valg av riktig emne')
  const options = await page.locator('#task-course-options option').evaluateAll(nodes => nodes.map(node => node.value))
  expect(options).toHaveLength(2)
  expect(new Set(options).size).toBe(2)
  const target = options.find(value => value.includes('HVL'))
  expect(target).toBeTruthy()
  await openTaskDetails(page)
  await page.locator('#course').fill(target)
  await page.locator('#task-form button[type=submit]').click()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  expect(saved.tasks).toHaveLength(1)
  expect(saved.tasks[0].courseId).toBe(courses[1].id)
  expect(saved.planner.courses).toEqual(courses)
})

test('local backup roundtrip preserves calendar date view and course filter', async ({ page }) => {
  await seed(page)
  await page.locator('#view-calendar').click()
  await page.locator('[data-calendar-view=month]').click()
  await page.locator('#full-calendar-date').fill('2026-10-20')
  await page.locator('.full-calendar-filters summary').click()
  await page.locator('#full-calendar-course').selectOption(courses[1].id)
  await dataMenu(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
  const download = await downloadPromise
  const bytes = await readFile(await download.path())
  await navigate(page, 'calendar')
  await page.locator('[data-calendar-view=day]').click()
  await page.locator('#full-calendar-date').fill('2026-12-01')
  await page.locator('#full-calendar-course').selectOption('')
  await navigate(page, 'settings')
  await page.locator('#backup-file').setInputFiles({ name: 'isolated-backup.json', mimeType: 'application/json', buffer: bytes })
  await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await page.reload()
  await page.locator('#view-calendar').click()
  await expect(page.locator('[data-calendar-view=month]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#full-calendar-date')).toHaveValue('2026-10-20')
  await page.locator('.full-calendar-filters summary').click()
  await expect(page.locator('#full-calendar-course')).toHaveValue(courses[1].id)
})
