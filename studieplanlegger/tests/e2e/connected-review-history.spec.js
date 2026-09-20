import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { freeze, key, navigate } from './helpers.js'
import { closeWork } from '../../src/work-log.js'
import { recordChange } from '../../src/history.js'

const recoveryKey = 'studieplanlegger:recovery:v1'
function fixture() {
  const task = { id: 'read', title: 'Les ferdig kapitlet', course: '', deadlineLocal: '', estimatedMinutes: null, remainingMinutes: 40, completed: false }
  const before = { schemaVersion: 1, tasks: [task], sessions: [] }
  const after = closeWork(before, { taskId: 'read', operationId: 'closed', outcome: 'done', actualMinutes: 40, historyComplete: true }, { now: new Date('2026-09-18T09:00:00Z') }).state
  after.history = recordChange(before, after, undefined, 'Registrert arbeid')
  return after
}
const raws = page => page.evaluate(({ key, recoveryKey }) => [localStorage.getItem(key), localStorage.getItem(recoveryKey)], { key, recoveryKey })
async function boot(page) {
  const state = fixture(), recovery = { savedAt: '2026-09-18T10:00:00Z', raw: JSON.stringify(state), data: state }
  await freeze(page, '2026-09-19T09:00:00+02:00')
  await page.goto('/')
  await page.evaluate(({ key, recoveryKey, state, recovery }) => { localStorage.setItem(key, JSON.stringify(state)); localStorage.setItem(recoveryKey, JSON.stringify(recovery)) }, { key, recoveryKey, state, recovery })
  await page.reload(); await navigate(page, 'settings')
  return state
}

test('review R3: confirmed history purge survives actual recovery, reload and exported backup', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await boot(page), panel = page.locator('#settings-panel')
  const before = await raws(page)
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('gjenopprettingskopi'); await dialog.dismiss() })
  await panel.getByRole('button', { name: 'Slett arbeidshistorikk', exact: true }).click()
  expect(await raws(page)).toEqual(before)
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('nedlastede sikkerhetskopier endres ikke'); await dialog.accept() })
  await panel.getByRole('button', { name: 'Slett arbeidshistorikk', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('også fra appens gjenopprettingskopi')
  const purged = await raws(page)
  expect(purged.join('\n')).not.toContain('actualMinutes')
  expect(JSON.parse(purged[0]).tasks).toEqual(state.tasks)
  expect(JSON.parse(purged[0]).history.undo).toEqual([])
  await panel.getByRole('status').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('history-purge-mobile.png') })
  await page.reload(); await navigate(page, 'settings')
  await panel.getByRole('button', { name: 'Gjenopprett forrige kopi', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting' })
  await dialog.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  expect((await raws(page)).join('\n')).not.toContain('actualMinutes')
  await expect(panel.getByRole('button', { name: 'Angre siste endring', exact: true })).toBeDisabled()
  const download = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
  expect(await readFile(await (await download).path(), 'utf8')).not.toContain('actualMinutes')
  await page.reload()
  expect(JSON.parse((await raws(page))[0]).tasks).toEqual(state.tasks)
})

test('review R3: main storage failure preserves both snapshots and visible retry succeeds', async ({ page }) => {
  await boot(page)
  const panel = page.locator('#settings-panel'), before = await raws(page)
  await page.evaluate(key => {
    const set = Storage.prototype.setItem
    window.failHistoryPurge = true
    Storage.prototype.setItem = function (name, value) {
      if (name === key && window.failHistoryPurge) throw new DOMException('Synthetic quota limit', 'QuotaExceededError')
      return set.call(this, name, value)
    }
  }, key)
  page.on('dialog', dialog => dialog.accept())
  await panel.getByRole('button', { name: 'Slett arbeidshistorikk', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('kunne ikke slettes')
  expect(await raws(page)).toEqual(before)
  await page.evaluate(() => { window.failHistoryPurge = false })
  await panel.getByRole('button', { name: 'Slett arbeidshistorikk', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('er slettet')
  expect((await raws(page)).join('\n')).not.toContain('actualMinutes')
})
