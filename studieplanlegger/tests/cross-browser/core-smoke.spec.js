import { test, expect } from '@playwright/test'
import { exportBackup } from '../../src/backup.js'
import { navigate, saved } from '../e2e/helpers.js'

// All input is invented here. Every Playwright test receives an empty context.
test('built app saves a title-only task and retains settings theme after reload', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#read-error')).toBeHidden()
  await navigate(page, 'all')
  await page.locator('#new-task').click()
  await page.locator('#title').fill('Syntetisk nettleserprøve – æøå')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  const before = (await saved(page)).tasks
  expect(before).toHaveLength(1)
  expect(before[0]).toMatchObject({ title: 'Syntetisk nettleserprøve – æøå', remainingMinutes: null, completed: false })

  await navigate(page, 'settings')
  await page.getByRole('radio', { name: 'Mørkt', exact: true }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await navigate(page, 'all')
  await expect(page.locator('#task-list').getByRole('heading', { name: before[0].title, exact: true })).toBeVisible()
  expect((await saved(page)).tasks).toEqual(before)
  await navigate(page, 'settings')
  await page.getByRole('radio', { name: 'Lyst', exact: true }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect((await saved(page)).tasks).toEqual(before)
  expect(errors).toEqual([])
})

test('built app previews a synthetic backup and restores it only after confirmation', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const state = {
    schemaVersion: 1,
    tasks: [{ id: 'synthetic-cross-browser-task', title: 'Syntetisk gjenopprettet oppgave', course: '', deadlineLocal: '', remainingMinutes: 25, estimatedMinutes: 25, completed: false }],
  }
  const buffer = Buffer.from(JSON.stringify(exportBackup(state, new Date('2026-11-04T09:00:00Z'))))
  await page.goto('/')
  await navigate(page, 'settings')
  await page.locator('#backup-file').setInputFiles({ name: 'synthetic-cross-browser.json', mimeType: 'application/json', buffer })
  const dialog = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
  await expect(dialog).toBeVisible()
  expect((await saved(page))?.tasks || []).toEqual([])
  await dialog.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect((await saved(page)).tasks).toEqual(state.tasks)
  await page.reload()
  await navigate(page, 'all')
  await expect(page.locator('#task-list').getByRole('heading', { name: state.tasks[0].title, exact: true })).toBeVisible()
  expect((await saved(page)).tasks).toEqual(state.tasks)
  expect(errors).toEqual([])
})
