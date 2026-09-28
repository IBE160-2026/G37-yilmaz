import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { edit, openMenu } from './helpers.js'

test('fresh browser reads recreated SQLite state and UI backup restores new fields', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  expect(await page.evaluate(() => localStorage.getItem('studieplanlegger:v1'))).toBeNull()

  const persisted = await page.evaluate(async () => (await fetch('/api/state')).json())
  const task = persisted.envelope.tasks.find(value => value.id === 'legacy-task')
  expect(task).toMatchObject({
    id: 'legacy-task', title: 'Database-confirmed edit', courseId: 'legacy-course',
    remainingEstimate: { minMinutes: 241, maxMinutes: null }, deadlinePromptDismissed: true,
  })
  expect(task.remainingMinutes).toBeUndefined()
  expect(persisted.envelope.sessions.find(value => value.id === 'legacy-session')).toMatchObject({ taskId: 'legacy-task' })
  expect(persisted.envelope.planner.courses.find(value => value.id === 'legacy-course')).toMatchObject({ sourceExtra: 'retained' })

  await page.locator('#view-all').click()
  await expect(page.locator('.task-title', { hasText: 'Database-confirmed edit' })).toBeVisible()
  await page.locator('#view-settings').click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
  const download = await downloadPromise
  const backupBytes = await readFile(await download.path())
  const backup = JSON.parse(backupBytes.toString('utf8'))
  expect(backup.data.tasks.find(value => value.id === 'legacy-task')).toMatchObject({
    remainingEstimate: { minMinutes: 241, maxMinutes: null }, deadlinePromptDismissed: true,
  })

  await page.locator('#view-all').click()
  await openMenu(page, 'Database-confirmed edit')
  await edit(page, 'Database-confirmed edit').click()
  await page.locator('#title').fill('Temporary post-recreate edit')
  await page.getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(page.locator('.task-title', { hasText: 'Temporary post-recreate edit' })).toBeVisible()

  await page.locator('#view-settings').click()
  await page.locator('#backup-file').setInputFiles({ name: 'docker-ui-backup.json', mimeType: 'application/json', buffer: backupBytes })
  await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect(page.locator('#settings-panel [role=status]')).toContainText('Sikkerhetskopien er gjenopprettet')

  const restored = await page.evaluate(async () => (await fetch('/api/state')).json())
  expect(restored.envelope.tasks.find(value => value.id === 'legacy-task')).toMatchObject({
    title: 'Database-confirmed edit', courseId: 'legacy-course',
    remainingEstimate: { minMinutes: 241, maxMinutes: null }, deadlinePromptDismissed: true,
  })
  expect(restored.envelope.sessions.find(value => value.id === 'legacy-session')).toMatchObject({ taskId: 'legacy-task' })
  const recovery = await page.evaluate(async () => (await fetch('/api/state/recovery')).json())
  expect(recovery.recovery.data.tasks.find(value => value.id === 'legacy-task')).toMatchObject({ title: 'Temporary post-recreate edit' })
})
