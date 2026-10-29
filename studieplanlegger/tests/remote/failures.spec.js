import { test, expect } from '@playwright/test'
import { themeFixture } from '../e2e/ajour-theme-fixture.js'
import { freeze, navigate, key, saved, openImportMethod, reveal } from '../e2e/helpers.js'
import { observe, browserMode } from './diagnostics.js'
import { exportBackup } from '../../src/backup.js'

const recoveryKey = 'studieplanlegger:recovery:v1'
const exactStorage = page => page.evaluate(({ key, recoveryKey }) => ({ state: localStorage.getItem(key), recovery: localStorage.getItem(recoveryKey) }), { key, recoveryKey })
async function seedRecovery(page) {
  await page.evaluate(({ key, recoveryKey }) => {
    const raw = localStorage.getItem(key)
    localStorage.setItem(recoveryKey, JSON.stringify({ savedAt: '2026-10-25T08:00:00.000Z', raw, data: JSON.parse(raw) }))
  }, { key, recoveryKey })
}
async function openCalendarDraft(page) {
  await navigate(page, 'subjects')
  await openImportMethod(page, 'calendar')
  await (await reveal(page.getByLabel('Bruk kalenderlenken som', { exact: true }))).selectOption('subscription')
  await page.locator('#calendar-import-form [name=url]').fill('https://synthetic.example.test/outage.ics')
}

// These failures are deliberately injected. They establish UI preservation,
// never availability of the live institution or the deployed import function.
async function boot(page) {
  await freeze(page, '2026-10-26T09:00:00+01:00')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state: themeFixture() })
  await page.reload()
  await browserMode(page)
}

for (const failure of ['QuotaExceededError', 'SecurityError']) test(`injected ${failure} preserves saved data and the unsaved draft`, async ({ page }, info) => {
  const observations = observe(page)
  try {
    await boot(page)
    const before = await saved(page)
    await page.evaluate(({ key, failure }) => {
      const original = Storage.prototype.setItem
      window.syntheticWriteFailure = true
      Storage.prototype.setItem = function (name, value) {
        if (name === key && window.syntheticWriteFailure) throw new DOMException('Synthetic storage rejection', failure)
        return original.call(this, name, value)
      }
    }, { key, failure })
    await navigate(page, 'all')
    await page.locator('#new-task').click()
    await page.locator('#title').fill('Syntetisk utkast som skal bevares')
    await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
    await expect(page.locator('#task-form')).toBeVisible()
    await expect(page.locator('#title')).toHaveValue('Syntetisk utkast som skal bevares')
    await expect(page.locator('#task-form [role=status]')).toContainText('Endringen ble ikke lagret. Utkastet er beholdt.')
    expect(await saved(page)).toEqual(before)
    await page.evaluate(() => { window.syntheticWriteFailure = false })
    await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
    expect((await saved(page)).tasks).toHaveLength(before.tasks.length + 1)
  } finally { await observations.finish(info) }
})

test('invalid saved JSON and invalid backup are retained without replacing good data', async ({ page }, info) => {
  const observations = observe(page)
  try {
    await boot(page)
    const before = await saved(page)
    await navigate(page, 'settings')
    await page.locator('#backup-file').setInputFiles({ name: 'synthetic-invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') })
    await expect(page.locator('#settings-panel [role=status]')).not.toBeEmpty()
    await expect(page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })).toBeHidden()
    expect(await saved(page)).toEqual(before)
    await page.evaluate(key => localStorage.setItem(key, '{synthetic-invalid'), key)
    await page.reload()
    await expect(page.locator('#read-error')).toBeVisible()
    await expect(page.locator('#new-task')).toBeDisabled()
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{synthetic-invalid')
  } finally { await observations.finish(info) }
})

for (const failure of ['getter', 'getItem']) test(`startup localStorage ${failure} failure preserves saved state and recovery`, async ({ page }, info) => {
  const observations = observe(page)
  try {
    await boot(page)
    await seedRecovery(page)
    const before = await exactStorage(page)
    await page.addInitScript(({ key, recoveryKey, failure }) => {
      const storage = window.localStorage, getItem = Storage.prototype.getItem
      const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
      window.syntheticReadOriginalStorage = () => ({ state: getItem.call(storage, key), recovery: getItem.call(storage, recoveryKey) })
      if (failure === 'getter') Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Synthetic startup denial', 'SecurityError') } })
      else Storage.prototype.getItem = function () { throw new DOMException('Synthetic startup denial', 'SecurityError') }
      window.syntheticRestoreStorage = () => { Object.defineProperty(window, 'localStorage', descriptor); Storage.prototype.getItem = getItem }
    }, { key, recoveryKey, failure })
    await page.reload()
    await expect(page.locator('#read-error')).toBeVisible()
    await expect(page.locator('#new-task')).toBeDisabled()
    expect(await page.evaluate(() => window.syntheticReadOriginalStorage())).toEqual(before)
    await page.evaluate(() => window.syntheticRestoreStorage())
    await page.locator('#retry-read').click()
    await expect(page.locator('#read-error')).toBeHidden()
    await expect(page.locator('#new-task')).toBeEnabled()
    expect(await exactStorage(page)).toEqual(before)
  } finally { await observations.finish(info) }
})

for (const failure of ['recovery', 'main']) test(`valid backup ${failure} write failure retains exact originals and restore preview`, async ({ page }, info) => {
  const observations = observe(page)
  try {
    await boot(page)
    await seedRecovery(page)
    const before = await exactStorage(page)
    const target = JSON.parse(before.state)
    target.tasks[0].title = 'Syntetisk gjenopprettet oppgave'
    const backup = exportBackup(target, new Date('2026-10-26T08:00:00.000Z'))
    await navigate(page, 'settings')
    await page.locator('#backup-file').setInputFiles({ name: 'synthetic-valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
    const preview = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
    await expect(preview).toBeVisible()
    expect(await exactStorage(page)).toEqual(before)
    await page.evaluate(({ blockedKey }) => {
      const original = Storage.prototype.setItem
      window.syntheticWriteFailure = true
      Storage.prototype.setItem = function (name, value) {
        if (name === blockedKey && window.syntheticWriteFailure) throw new DOMException('Synthetic restore rejection', 'QuotaExceededError')
        return original.call(this, name, value)
      }
    }, { blockedKey: failure === 'recovery' ? recoveryKey : key })
    await preview.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
    await expect(preview).toBeVisible()
    await expect(preview.locator('[role=alert]')).not.toBeEmpty()
    expect(await exactStorage(page)).toEqual(before)
    await page.evaluate(() => { window.syntheticWriteFailure = false })
    await preview.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
    await expect(preview).toBeHidden()
    expect(await saved(page)).toEqual(backup.data)
    expect(JSON.parse((await exactStorage(page)).recovery).raw).toBe(before.state)
  } finally { await observations.finish(info) }
})

test('injected source outage preserves prior courses, tasks and teaching', async ({ page }, info) => {
  const observations = observe(page, {
    expectedHttpErrors: [{ path: '/api/import/calendar', status: 503, count: 1 }],
    expectedConsoleErrors: [{ path: '/api/import/calendar', category: 'resource-http', status: 503, count: 1 }],
  })
  try {
    await boot(page)
    const before = await saved(page)
    await page.route('**/api/import/calendar', route => route.fulfill({ status: 503, json: { error: 'Syntetisk kildefeil. Bruk filimport eller prøv igjen.' } }))
    await openCalendarDraft(page)
    await page.getByRole('button', { name: 'Hent kalenderlenke', exact: true }).click()
    await expect(page.locator('#subject-message')).toContainText('Syntetisk kildefeil')
    expect(await saved(page)).toEqual(before)
    await page.reload()
    expect(await saved(page)).toEqual(before)
  } finally { await observations.finish(info) }
})

for (const failure of ['network-abort', 'malformed-json', 'malformed-calendar']) test(`injected ${failure} preserves exact stored data and calendar draft`, async ({ page }, info) => {
  const observations = observe(page, failure === 'network-abort' ? {
    expectedFailedRequests: [{ path: '/api/import/calendar', code: 'net::ERR_FAILED', count: 1 }],
    expectedConsoleErrors: [{ path: '/api/import/calendar', category: 'resource-network', code: 'net::ERR_FAILED', count: 1 }],
  } : {})
  try {
    await boot(page)
    await seedRecovery(page)
    const before = await exactStorage(page)
    await page.route('**/api/import/calendar', route => failure === 'network-abort' ? route.abort('failed') : failure === 'malformed-json'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '{synthetic-malformed' })
      : route.fulfill({ status: 200, json: { calendar: 'SYNTHETIC_NOT_AN_ICS_CALENDAR' } }))
    await openCalendarDraft(page)
    await page.getByRole('button', { name: 'Hent kalenderlenke', exact: true }).click()
    const expectedMessage = failure === 'network-abort' ? 'Kunne ikke kontakte importtjenesten.' : failure === 'malformed-json'
      ? 'Importtjenestens svar kunne ikke valideres.' : 'Filen er ikke en fullstendig .ics-kalender'
    await expect(page.locator('#subject-message')).toBeVisible()
    await expect(page.locator('#subject-message')).toContainText(expectedMessage)
    await expect(page.locator('#calendar-import-form [name=url]')).toHaveValue('https://synthetic.example.test/outage.ics')
    await expect(page.getByRole('button', { name: 'Hent kalenderlenke', exact: true })).toBeEnabled()
    expect(await exactStorage(page)).toEqual(before)
  } finally { await observations.finish(info) }
})
