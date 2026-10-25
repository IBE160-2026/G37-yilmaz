import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { navigate } from './helpers.js'
import { runtimeUrl, runtimeScenario, savedTpState } from './tp-csv-helpers.js'

// Run only against the runner's freshly created synthetic SQLite resources.
// The downloaded backup is generated here; no user's export is opened.
test.use({ trace: 'off' })
test('Calendar corrections backup: downloaded state restores exact identities and links', async ({ page }) => {
  const mixedInstitutions = ['mixed', 'correction-ui', 'closure-courses'].includes(runtimeScenario)
  test.skip(!runtimeUrl || !(mixedInstitutions || runtimeScenario?.startsWith('closure-')) || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned synthetic runtime snapshot required.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Independent backup test uses no external source.' } }))
  await page.goto(runtimeUrl)
  expect(await savedTpState(page)).toEqual(expected)
  if (mixedInstitutions) {
    expect(expected.planner.courses.some(course => course.university === 'HiMolde')).toBe(true)
    expect(expected.planner.courses.some(course => course.university === 'NTNU')).toBe(true)
  }
  await navigate(page, 'settings')
  const downloadPending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
  const download = await downloadPending
  const bytes = readFileSync(await download.path())
  const backup = JSON.parse(bytes.toString('utf8'))
  expect(backup.format).toBe('studieplan-local-backup')
  expect(backup.data).toEqual(expected)

  // Make a visible, reversible difference so replacement is proved, not a no-op.
  if (expected.planner.courses.length) {
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: /^Ny oppgave i / }).first().click()
  } else {
    await navigate(page, 'all')
    await page.locator('#new-task').click()
  }
  await page.locator('#title').fill('Oppdiktet kontrolloppgave etter sikkerhetskopien')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  expect((await savedTpState(page)).tasks).toHaveLength(expected.tasks.length + 1)
  await navigate(page, 'settings')
  const chooserPending = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Importer sikkerhetskopi', exact: true }).click()
  await (await chooserPending).setFiles({ name: 'independent-calendar-backup.json', mimeType: 'application/json', buffer: bytes })
  const dialog = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
  await expect(dialog).toContainText(`Emner: ${expected.planner.courses.length} nå, ${expected.planner.courses.length} i filen`)
  await dialog.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Sikkerhetskopien er gjenopprettet.', { exact: false })).toBeVisible()
  expect(await savedTpState(page)).toEqual(expected)
  await page.reload()
  expect(await savedTpState(page)).toEqual(expected)
})
