import { test, expect } from '@playwright/test'
import { key, navigate, saved, seed, task } from './helpers.js'

// All files and storage in this suite are synthetic. Only File.text() completion
// is controlled; the real backup validator, dialog and storage actions run.
const replacement = page => page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
const backup = id => JSON.stringify({
  format: 'studieplan-local-backup', backupVersion: 1, createdAt: '2026-11-04T09:00:00Z',
  data: { schemaVersion: 1, tasks: [task(id)] },
})

async function setup(page, { recovery = false } = {}) {
  await seed(page, [task('original')], { view: 'settings' })
  if (recovery) {
    await page.evaluate(() => localStorage.setItem('studieplanlegger:recovery:v1', JSON.stringify({
      savedAt: '2026-11-04T09:00:00Z',
      data: { schemaVersion: 1, tasks: [{ id: 'recovered', title: 'Syntetisk lokal kopi', course: '', completed: false }] },
    })))
    await page.reload()
    await navigate(page, 'settings')
  }
  await page.evaluate(() => {
    const original = File.prototype.text
    window.pendingBackupReads = new Map()
    File.prototype.text = function () {
      const content = original.call(this)
      return new Promise((resolve, reject) => window.pendingBackupReads.set(this.name, {
        resolve: async () => { resolve(await content) },
        reject: () => reject(new Error('Synthetic delayed read failure')),
      }))
    }
  })
}

async function select(page, name, content = backup(name)) {
  await page.locator('#backup-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) })
  await expect.poll(() => page.evaluate(name => window.pendingBackupReads.has(name), name)).toBe(true)
}

async function finish(page, name, reject = false) {
  await page.evaluate(async ({ name, reject }) => {
    await window.pendingBackupReads.get(name)[reject ? 'reject' : 'resolve']()
    // Flush the file-read continuation without advancing the frozen app clock.
    await Promise.resolve()
  }, { name, reject })
}

test('backup import: last selected file wins when older read completes last', async ({ page }) => {
  await setup(page)
  await select(page, 'A.json')
  await select(page, 'B.json')
  await finish(page, 'B.json')
  await expect(replacement(page)).toContainText('Valgt fil: B.json')
  await finish(page, 'A.json')
  await expect(replacement(page)).toContainText('Valgt fil: B.json')
  await expect(replacement(page)).not.toContainText('Valgt fil: A.json')
  expect((await saved(page)).tasks[0].id).toBe('original')
  await replacement(page).getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  expect((await saved(page)).tasks.map(item => item.id)).toEqual(['B.json'])
  await page.reload()
  expect((await saved(page)).tasks.map(item => item.id)).toEqual(['B.json'])
})

test('backup import: stale read failure cannot change newer successful preview', async ({ page }) => {
  await setup(page)
  await select(page, 'A.json')
  await select(page, 'B.json')
  await finish(page, 'B.json')
  await finish(page, 'A.json', true)
  await expect(replacement(page)).toContainText('Valgt fil: B.json')
  await expect(page.locator('#settings-panel > [role="status"]')).toBeEmpty()
  await replacement(page).getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  expect((await saved(page)).tasks.map(item => item.id)).toEqual(['B.json'])
})

test('backup import: older result stays hidden while the newest file is still reading', async ({ page }) => {
  await setup(page)
  await select(page, 'A.json')
  await select(page, 'B.json')
  await finish(page, 'A.json')
  await expect(replacement(page)).not.toBeVisible()
  expect((await saved(page)).tasks[0].id).toBe('original')
  await finish(page, 'B.json')
  await expect(replacement(page)).toContainText('Valgt fil: B.json')
})

test('backup import: newer invalid file prevents older valid preview from opening', async ({ page }) => {
  await setup(page)
  const before = await saved(page)
  await select(page, 'A.json')
  await select(page, 'invalid.json', '{}')
  await finish(page, 'invalid.json')
  await expect(page.locator('#settings-panel > [role="status"]')).toContainText('Ugyldig sikkerhetskopi')
  await finish(page, 'A.json')
  await expect(replacement(page)).not.toBeVisible()
  await expect(page.locator('#settings-panel > [role="status"]')).toContainText('Ugyldig sikkerhetskopi')
  expect(await saved(page)).toEqual(before)
})

test('backup import: cancelled preview cannot reopen from an older pending read', async ({ page }) => {
  await setup(page)
  const before = await saved(page)
  await select(page, 'A.json')
  await select(page, 'B.json')
  await finish(page, 'B.json')
  await replacement(page).getByRole('button', { name: 'Avbryt', exact: true }).click()
  await finish(page, 'A.json')
  await expect(replacement(page)).not.toBeVisible()
  expect(await saved(page)).toEqual(before)
})

test('backup import: file chooser cancellation invalidates an unfinished read', async ({ page }) => {
  await setup(page)
  const before = await saved(page)
  await select(page, 'A.json')
  // Playwright cannot press Cancel in a native picker. Dispatch its standard
  // cancel event on the real input to verify the application boundary.
  await page.locator('#backup-file').dispatchEvent('cancel')
  await finish(page, 'A.json')
  await expect(replacement(page)).not.toBeVisible()
  expect(await saved(page)).toEqual(before)
})

test('backup import: local recovery takes priority over an unfinished file read', async ({ page }) => {
  await setup(page, { recovery: true })
  await select(page, 'A.json')
  await page.getByRole('button', { name: 'Gjenopprett forrige kopi', exact: true }).click()
  await expect(replacement(page)).toContainText('Dette er den rå lokale kopien')
  await finish(page, 'A.json')
  await expect(replacement(page)).toContainText('Dette er den rå lokale kopien')
  await expect(replacement(page)).not.toContainText('Valgt fil: A.json')
  await replacement(page).getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  expect((await saved(page)).tasks.map(item => item.id)).toEqual(['recovered'])
})

test('backup import: a changed baseline still blocks replacement', async ({ page }) => {
  await setup(page)
  await select(page, 'A.json')
  await finish(page, 'A.json')
  // Simulate another writer after preview; the existing storage revision guard
  // must remain effective alongside the new file-request guard.
  const changed = { schemaVersion: 1, tasks: [task('other-writer')] }
  await page.evaluate(({ key, changed }) => localStorage.setItem(key, JSON.stringify(changed)), { key, changed })
  await replacement(page).getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect(replacement(page)).toBeVisible()
  await expect(replacement(page).getByRole('alert')).not.toBeEmpty()
  expect(await saved(page)).toEqual(changed)
})
