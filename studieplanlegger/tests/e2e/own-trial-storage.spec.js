import { readFile, writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { stressCalendar } from '../fixtures/stress-calendar.js'
import { storageStressFixture, syntheticStorageBackup, smallStorageFixture, syntheticLegacyRecovery } from '../fixtures/storage-stress.js'
import { freeze, key, navigate, reveal, saved } from './helpers.js'

const recoveryKey = 'studieplanlegger:recovery:v1'
const rawKeys = page => page.evaluate(([main, recovery]) => [localStorage.getItem(main), localStorage.getItem(recovery)], [key, recoveryKey])
const writes = page => page.evaluate(() => window.syntheticStorageWrites)
const replacement = page => page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })

async function seedStorage(page, state, recovery = null) {
  await freeze(page, '2026-11-01T17:00:00+01:00')
  await page.goto('/')
  await page.evaluate(({ key, recoveryKey, state, recovery }) => {
    localStorage.removeItem(key); localStorage.removeItem(recoveryKey)
    if (state) localStorage.setItem(key, JSON.stringify(state))
    if (recovery) localStorage.setItem(recoveryKey, recovery)
  }, { key, recoveryKey, state, recovery })
  // Record sizes and failures only. No real data or full synthetic backups are
  // written into test reports. A fresh context owns all storage under test.
  await page.addInitScript(([main, recovery]) => {
    window.syntheticStorageWrites = []
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (![main, recovery].includes(name)) return original.call(this, name, value)
      const entry = { key: name, codeUnits: value.length, utf8Bytes: new TextEncoder().encode(value).length }
      window.syntheticStorageWrites.push(entry)
      try {
        if (window.syntheticStorageFault?.key === name) {
          const fault = window.syntheticStorageFault; window.syntheticStorageFault = null
          entry.injected = true
          if (fault.errorName === 'Error') throw new Error('Synthetic controlled storage failure')
          throw new DOMException('Synthetic controlled storage failure', fault.errorName)
        }
        return original.call(this, name, value)
      } catch (error) { entry.errorName = error.name; throw error }
    }
  }, [key, recoveryKey])
  await page.reload()
  expect(await writes(page)).toEqual([])
}

async function metrics(page) {
  return page.evaluate(([main, recovery]) => {
    const raw = localStorage.getItem(main), backup = localStorage.getItem(recovery), data = JSON.parse(raw || '{}')
    const { history, ...domain } = data
    const bytes = value => new TextEncoder().encode(value || '').length
    return {
      main: { utf8Bytes: bytes(raw), codeUnits: raw?.length || 0 },
      recovery: { utf8Bytes: bytes(backup), codeUnits: backup?.length || 0 },
      domainUtf8Bytes: bytes(JSON.stringify(domain)), historyUtf8Bytes: bytes(JSON.stringify(history)),
      undoEntries: history?.undo.length || 0,
      courses: data.planner?.courses.length || 0, events: data.planner?.events.length || 0,
      writes: window.syntheticStorageWrites,
    }
  }, [key, recoveryKey])
}

async function attachMetrics(info, measurements) {
  const path = info.outputPath('synthetic-storage-metrics.json')
  await writeFile(path, JSON.stringify(measurements, null, 2))
  await info.attach('Synthetic storage sizes and write results', { path, contentType: 'application/json' })
}

async function previewCalendar(page, calendar) {
  await navigate(page, 'subjects')
  const open = await reveal(page.getByRole('button', { name: 'Finn studieprogram', exact: true }))
  if (await open.getAttribute('aria-expanded') !== 'true') await open.click()
  await (await reveal(page.getByRole('button', { name: 'Fra fil eller tekst', exact: true }))).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-stress-500.ics', mimeType: 'text/calendar', buffer: Buffer.from(calendar) })
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  const preview = page.locator('.document-preview')
  await expect(preview.locator('.document-preview-row')).toHaveCount(525, { timeout: 35_000 })
  return preview
}

async function importCalendar(page, calendar) {
  const preview = await previewCalendar(page, calendar)
  await preview.getByRole('button', { name: 'Importer valgte', exact: true }).click()
  return page.getByText('Planen er lagret:', { exact: false })
}

async function previewBackup(page, state) {
  await navigate(page, 'settings')
  const file = syntheticStorageBackup(state)
  await page.locator('#backup-file').setInputFiles({ name: 'synthetic-storage-backup.json', mimeType: 'application/json', buffer: Buffer.from(file) })
  await expect(replacement(page)).toBeVisible({ timeout: 30_000 })
  return file
}

async function confirmReplacement(page) {
  await replacement(page).getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
}

async function expectPreservedAfterReload(page, baseline) {
  await expectRawCopies(page, baseline)
  await page.reload()
  await expectRawCopies(page, baseline)
}

async function expectRawCopies(page, baseline) {
  const actual = await rawKeys(page)
  // Exact byte preservation, without dumping megabytes of synthetic records
  // into assertion output when a storage regression occurs.
  expect(actual.map((value, index) => value === baseline[index]), 'main and recovery must both remain byte-for-byte unchanged').toEqual([true, true])
}

test('storage: identical 500-event imports make zero writes and retain legacy undo/recovery after reload', async ({ page }, info) => {
  test.setTimeout(120_000)
  const { calendar, legacy } = storageStressFixture()
  await seedStorage(page, legacy, syntheticLegacyRecovery(smallStorageFixture()))
  const baseline = await rawKeys(page), before = await metrics(page)
  for (const hour of [18, 19]) {
    await page.clock.setFixedTime(new Date(`2026-11-01T${hour}:00:00+01:00`))
    await expect(await importCalendar(page, calendar)).toContainText('0 nye, 0 oppdaterte og 525 uendrede')
    await expectRawCopies(page, baseline)
    expect(await writes(page)).toEqual([])
  }
  const after = await metrics(page)
  await expectPreservedAfterReload(page, baseline)
  expect((await saved(page)).history).toEqual(legacy.history)
  await attachMetrics(info, { before, after, afterReload: await metrics(page) })
})

test('storage: a real changed UID updates once, preserves local notes and supports undo after reload', async ({ page }, info) => {
  test.setTimeout(120_000)
  const { first } = storageStressFixture()
  first.planner.events[0].notes = 'Syntetisk lokalt notat som importen skal bevare'
  await seedStorage(page, first)
  const before = await metrics(page)
  await expect(await importCalendar(page, stressCalendar({ revised: true }))).toContainText('0 nye, 1 oppdaterte og 524 uendrede')
  const changed = await saved(page)
  expect(changed.planner.events.map(event => event.id)).toEqual(first.planner.events.map(event => event.id))
  expect(changed.planner.events[0]).toEqual(first.planner.events[0])
  expect(changed.planner.events.find(event => event.id === first.planner.events.at(-1).id).title).toBe(`${first.planner.events.at(-1).title} revidert`)
  expect(changed.history.undo).toHaveLength(first.history.undo.length + 1)
  const after = await metrics(page)
  await page.reload()
  expect(await saved(page)).toEqual(changed)
  await navigate(page, 'settings')
  await (await reveal(page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }))).click()
  const undone = await saved(page)
  expect(undone.planner).toEqual(first.planner)
  expect(undone.history.undo).toEqual(first.history.undo)
  expect(undone.importSources[0].entries).toEqual(first.importSources[0].entries)
  expect(undone.importSources[0].contentHash).toBe(first.importSources[0].contentHash)
  await page.reload()
  expect(await saved(page)).toEqual(undone)
  await attachMetrics(info, { before, after, afterUndoReload: await metrics(page) })
})

for (const [errorName, diagnosis] of [
  ['QuotaExceededError', 'Nettleseren avviste skrivingen ved lagringsgrensen'],
  ['SecurityError', 'Nettleseren tillater ikke lokal lagring her.'],
  ['Error', 'Lagringen kunne ikke fullføres; årsaken er ikke fastslått.'],
]) {
  test(`storage: failed changed-UID document import diagnoses ${errorName} and retains its draft and prior copies`, async ({ page }, info) => {
    test.setTimeout(120_000)
    const { first } = storageStressFixture()
    first.planner.events[0].notes = 'Syntetisk eksisterende lokalt notat'
    await seedStorage(page, first, syntheticLegacyRecovery(smallStorageFixture()))
    const baseline = await rawKeys(page), before = await metrics(page)
    const preview = await previewCalendar(page, stressCalendar({ revised: true }))
    const edited = preview.locator('.document-preview-row').filter({ has: page.locator(':scope > summary', { hasText: 'Syntetisk aktivitet 499 revidert' }) })
    await (await reveal(edited.locator(':scope > summary'))).click()
    const location = edited.getByLabel('Sted (valgfritt)', { exact: true })
    await (await reveal(location)).fill('Syntetisk rettet rom som skal beholdes i utkastet')
    await page.evaluate(fault => { window.syntheticStorageFault = fault }, { key, errorName })
    await preview.getByRole('button', { name: 'Importer valgte', exact: true }).click()
    const alert = preview.getByRole('alert')
    await expect(alert).toContainText('Kunne ikke lagre.')
    await expect(alert).toContainText(diagnosis)
    await expect(alert).toContainText('Tidligere data og utkast er beholdt.')
    if (errorName !== 'QuotaExceededError') await expect(alert).not.toContainText('lagringsgrensen')
    await expect(preview).toBeVisible()
    await expect(preview.locator('.document-preview-row')).toHaveCount(525)
    await expect(location).toHaveValue('Syntetisk rettet rom som skal beholdes i utkastet')
    await expect(preview.getByRole('button', { name: 'Importer valgte', exact: true })).toBeEnabled()
    expect(await writes(page)).toEqual([expect.objectContaining({ key, errorName, injected: true })])
    const after = await metrics(page)
    await expectPreservedAfterReload(page, baseline)
    await attachMetrics(info, { before, after, afterReload: await metrics(page) })
  })
}

test('storage: a synthetic 6.8 MB full backup restores in an empty profile and exports its complete history', async ({ page }, info) => {
  test.setTimeout(120_000)
  const { legacy } = storageStressFixture()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await seedStorage(page, null)
  const file = await previewBackup(page, legacy)
  expect(Buffer.byteLength(file)).toBeGreaterThan(6_500_000)
  expect(Buffer.byteLength(file)).toBeLessThan(7_000_000)
  expect(Buffer.byteLength(JSON.stringify(legacy))).toBeLessThan(4_500_000)
  await confirmReplacement(page)
  await expect(replacement(page)).not.toBeVisible()
  expect(await saved(page)).toEqual(legacy)
  await page.reload()
  expect(await saved(page)).toEqual(legacy)
  await navigate(page, 'settings')
  await expect(page.locator('#settings-panel')).toContainText('En full sikkerhetskopi inneholder også Angre-historikk og papirkurv.')
  await page.screenshot({ path: info.outputPath('storage-backup-disclosure-1440.png'), fullPage: true })
  const download = page.waitForEvent('download')
  await (await reveal(page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }))).click()
  const exported = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(exported.data).toEqual(legacy)
  expect(exported.data.history.undo).toHaveLength(3)
  await attachMetrics(info, { prettyFileUtf8Bytes: Buffer.byteLength(file), restored: await metrics(page) })
})

test('storage: restoring an identical large backup writes nothing and retains the prior recovery copy', async ({ page }, info) => {
  test.setTimeout(120_000)
  const { legacy } = storageStressFixture()
  await seedStorage(page, legacy, syntheticLegacyRecovery(smallStorageFixture()))
  const baseline = await rawKeys(page), before = await metrics(page)
  await previewBackup(page, legacy)
  await confirmReplacement(page)
  await expect(replacement(page)).not.toBeVisible()
  await expect(page.locator('#settings-panel')).toContainText('Ingenting er skrevet')
  expect(await writes(page)).toEqual([])
  await expectPreservedAfterReload(page, baseline)
  await attachMetrics(info, { before, afterReload: await metrics(page) })
})

test('storage: changed large backup and compressed recovery both survive reload and restore the exact prior history', async ({ page }, info) => {
  test.setTimeout(120_000)
  const { legacy } = storageStressFixture(), changed = structuredClone(legacy)
  changed.planner.events[0].notes = 'Syntetisk endring i stor sikkerhetskopi'
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page, legacy, syntheticLegacyRecovery(smallStorageFixture()))
  const before = await metrics(page)
  await previewBackup(page, changed)
  expect(await replacement(page).evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('storage-large-restore-390.png'), fullPage: true })
  const restoreStarted = Date.now()
  await confirmReplacement(page)
  await expect(replacement(page)).not.toBeVisible()
  const restoreElapsedMs = Date.now() - restoreStarted
  expect(await saved(page)).toEqual(changed)
  const after = await metrics(page)
  expect(after.recovery.utf8Bytes).toBeGreaterThan(0)
  expect(after.recovery.codeUnits).toBeLessThan(before.main.codeUnits / 2)
  await page.reload()
  expect(await saved(page)).toEqual(changed)
  await navigate(page, 'settings')
  await (await reveal(page.getByRole('button', { name: 'Gjenopprett forrige kopi', exact: true }))).click()
  await expect(replacement(page)).toContainText('rå lokale kopien')
  const recoveryStarted = Date.now()
  await confirmReplacement(page)
  await expect(replacement(page)).not.toBeVisible()
  const recoveryElapsedMs = Date.now() - recoveryStarted
  expect(await saved(page)).toEqual(legacy)
  await page.reload()
  expect(await saved(page)).toEqual(legacy)
  await attachMetrics(info, { restoreElapsedMs, recoveryElapsedMs, before, after, recoveredAfterReload: await metrics(page) })
})

for (const [failedKey, errorName] of [[recoveryKey, 'SecurityError'], [key, 'SecurityError'], [key, 'QuotaExceededError']]) {
  test(`storage: controlled ${errorName} on ${failedKey} preserves both prior copies after reload`, async ({ page }, info) => {
    const current = smallStorageFixture(), candidate = smallStorageFixture('Syntetisk erstatningsoppgave')
    await seedStorage(page, current, syntheticLegacyRecovery(smallStorageFixture('Syntetisk eldre kopi')))
    const baseline = await rawKeys(page), before = await metrics(page)
    await previewBackup(page, candidate)
    await page.evaluate(fault => { window.syntheticStorageFault = fault }, { key: failedKey, errorName })
    await confirmReplacement(page)
    const alert = replacement(page).getByRole('alert')
    await expect(alert).toContainText('Tidligere data er beholdt.')
    await expect(alert).toContainText(errorName === 'SecurityError' ? 'Nettleseren tillater ikke lokal lagring her.' : 'Nettleseren avviste skrivingen ved lagringsgrensen')
    if (errorName === 'SecurityError') await expect(alert).not.toContainText('lagringsgrensen')
    await expect(replacement(page).getByRole('button', { name: 'Erstatt lokale data', exact: true })).toBeEnabled()
    expect((await writes(page)).filter(write => write.errorName)).toEqual([expect.objectContaining({ key: failedKey, errorName, injected: true })])
    const after = await metrics(page)
    await expectPreservedAfterReload(page, baseline)
    await attachMetrics(info, { before, after, afterReload: await metrics(page) })
  })
}

test('storage: actual quota rejection of the compressed recovery write preserves main, recovery and owned filler', async ({ page }, info) => {
  test.setTimeout(120_000)
  const { legacy } = storageStressFixture(), changed = structuredClone(legacy)
  changed.planner.events[0].notes = 'Syntetisk erstatning med nesten full lokal lagring'
  await seedStorage(page, legacy, syntheticLegacyRecovery(smallStorageFixture()))
  const baseline = await rawKeys(page)
  const fillerKey = 'ajour:synthetic-storage-quota-filler'
  const filler = await page.evaluate(fillerKey => {
    // This context is owned by this test. Probe only its new synthetic key;
    // never clear or overwrite the active state, recovery or another key.
    let low = 0, high = 6_000_000
    while (low + 1 < high) {
      const length = Math.floor((low + high) / 2)
      try { localStorage.setItem(fillerKey, 's'.repeat(length)); low = length }
      catch (error) { if (error.name !== 'QuotaExceededError') throw error; high = length }
    }
    const value = 's'.repeat(Math.max(0, low - 1024))
    localStorage.setItem(fillerKey, value)
    return value
  }, fillerKey)
  expect(filler.length).toBeGreaterThan(1024)
  const before = await metrics(page)
  expect(before.writes).toEqual([])
  await previewBackup(page, changed)
  await confirmReplacement(page)
  await expect(replacement(page).getByRole('alert')).toContainText('Nettleseren avviste skrivingen ved lagringsgrensen da gjenopprettingskopien skulle lagres.')
  await expect(replacement(page).getByRole('alert')).toContainText('Tidligere data er beholdt.')
  const attempts = await writes(page)
  expect(attempts).toEqual([expect.objectContaining({ key: recoveryKey, errorName: 'QuotaExceededError' })])
  expect(attempts[0].injected).toBeUndefined()
  expect(attempts[0].codeUnits).toBeLessThan(before.main.codeUnits / 2)
  const after = await metrics(page)
  expect(await page.evaluate(key => localStorage.getItem(key), fillerKey) === filler).toBe(true)
  await expectPreservedAfterReload(page, baseline)
  expect(await page.evaluate(key => localStorage.getItem(key), fillerKey) === filler).toBe(true)
  await attachMetrics(info, { fillerCodeUnits: filler.length, before, after, afterReload: await metrics(page) })
})

test('storage: actual Chromium quota rejection preserves the large active state and older recovery after reload', async ({ page }, info) => {
  test.setTimeout(180_000)
  const { legacy } = storageStressFixture(), oversized = structuredClone(legacy)
  // Still a valid <20 MB export, but its compact main value alone exceeds the
  // measured localStorage limit. No storage exception is injected in this case.
  for (const [index, event] of oversized.planner.events.entries()) event.notes = `Synthetic event ${index}: ${'x'.repeat(14_000)}`
  const file = syntheticStorageBackup(oversized)
  expect(Buffer.byteLength(file)).toBeLessThan(20_000_000)
  expect(JSON.stringify(oversized).length).toBeGreaterThan(10_000_000)
  await seedStorage(page, legacy, syntheticLegacyRecovery(smallStorageFixture()))
  const baseline = await rawKeys(page), before = await metrics(page)
  await previewBackup(page, oversized)
  await confirmReplacement(page)
  await expect(replacement(page).getByRole('alert')).toContainText('Nettleseren avviste skrivingen ved lagringsgrensen')
  const errors = (await writes(page)).filter(write => write.errorName)
  expect(errors).toEqual([expect.objectContaining({ key, errorName: 'QuotaExceededError' })])
  expect(errors[0].injected).toBeUndefined()
  const after = await metrics(page)
  await expectPreservedAfterReload(page, baseline)
  await attachMetrics(info, { prettyFileUtf8Bytes: Buffer.byteLength(file), before, after, afterReload: await metrics(page) })
})
