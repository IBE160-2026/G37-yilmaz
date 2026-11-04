import { test, expect } from '@playwright/test'
import { seed, row, raw, saved, writes } from './helpers.js'

// Synthetic documents and tasks only. Hold the actual File reads to force
// overlapping selections; parsing, proposal approval and storage stay real.
const tasks = ['first', 'second'].map(id => ({ id: `synthetic-step-${id}`, title: `Syntetisk filprøve ${id}`, course: '', deadlineLocal: '', estimatedMinutes: 30, completed: false }))
const fileInput = dialog => dialog.getByLabel('Eller velg lokal tekst-, PDF- eller DOCX-fil')

async function openEditor(page, task = tasks[0]) {
  // Closing the editor restores focus to its still-open task menu. Close that
  // disclosure before choosing another task so its popup cannot cover the row.
  for (const expanded of await page.locator('#task-list .task-menu[open]').all()) {
    await expanded.locator(':scope > summary').click()
    await expect(expanded).toHaveJSProperty('open', false)
  }
  const item = row(page, task.title), menu = item.locator('.task-menu')
  if (!await menu.evaluate(node => node.open)) await menu.locator(':scope > summary').click()
  await item.getByRole('button', { name: /Administrer arbeidssteg/ }).click()
  const dialog = page.locator('.work-steps-dialog[open]')
  await dialog.locator('.planning-rules > summary').click()
  return dialog
}

async function setup(page) {
  await seed(page, tasks, { view: 'all' })
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer
    window.syntheticStepReads = {}
    File.prototype.arrayBuffer = function () {
      if (!this.name.startsWith('synthetic-step-')) return original.call(this)
      return new Promise((resolve, reject) => {
        window.syntheticStepReads[this.name] = {
          finish: async () => resolve(await original.call(this)),
          fail: () => reject(new Error('Syntetisk foreldet lesefeil')),
        }
      })
    }
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    window.syntheticStepDigests = []
    crypto.subtle.digest = (...args) => {
      const pending = digest(...args)
      window.syntheticStepDigests.push(pending)
      return pending
    }
    // Observe actual parser lifecycle without changing worker behavior.
    const OriginalWorker = Worker
    window.syntheticStepWorkers = []
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args)
        if (String(args[0]).includes('document-parser')) {
          const record = { terminated: false }
          window.syntheticStepWorkers.push(record)
          const terminate = this.terminate.bind(this)
          this.terminate = () => { record.terminated = true; return terminate() }
          const post = this.postMessage.bind(this)
          this.postMessage = (...message) => {
            if (!window.syntheticStepHoldNextWorker) return post(...message)
            window.syntheticStepHoldNextWorker = false
            const callback = this.onmessage
            record.staleProgress = () => callback({ data: { documentImport: true, progress: 'Syntetisk foreldet fremdrift' } })
          }
        }
      }
    }
  })
  return openEditor(page)
}

async function selectFile(dialog, letter) {
  await fileInput(dialog).setInputFiles({ name: `synthetic-step-${letter}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`Krav: Syntetisk krav ${letter}`) })
}

async function finishFile(page, letter, failure = false) {
  await page.evaluate(async ({ letter, failure }) => {
    const read = window.syntheticStepReads[`synthetic-step-${letter}.txt`]
    if (failure) read.fail()
    else await read.finish()
  }, { letter, failure })
}

async function drainParser(page) {
  // Wait for real digest/worker events; the app's fake clock stays paused.
  await page.evaluate(async () => { await Promise.all(window.syntheticStepDigests) })
  await expect.poll(() => page.evaluate(() => window.syntheticStepWorkers.every(worker => worker.terminated))).toBe(true)
}

test('only the latest selected document can provide and save steps when reads finish backwards', async ({ page }) => {
  const dialog = await setup(page), original = await raw(page)
  await selectFile(dialog, 'A'); await selectFile(dialog, 'B')
  await finishFile(page, 'B')
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-B.txt: 1 forslag')
  await expect(dialog.getByRole('checkbox')).toHaveCount(1)
  await finishFile(page, 'A'); await drainParser(page)
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-B.txt: 1 forslag')
  await expect(dialog.getByRole('checkbox', { name: 'Krav: Syntetisk krav B', exact: true })).toBeChecked()
  await expect(dialog).not.toContainText('Syntetisk krav A')
  expect(await raw(page)).toBe(original)
  await dialog.getByRole('button', { name: 'Legg valgte i utkastet' }).click()
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  expect((await saved(page)).tasks[0].steps.map(step => step.title)).toEqual(['Syntetisk krav B'])
  expect(await writes(page)).toHaveLength(1)
})

test('an older file error cannot replace the latest successful proposal or status', async ({ page }) => {
  const dialog = await setup(page)
  await selectFile(dialog, 'A'); await selectFile(dialog, 'B'); await finishFile(page, 'B')
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-B.txt: 1 forslag')
  await finishFile(page, 'A', true)
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-B.txt: 1 forslag')
  await expect(dialog).not.toContainText('Syntetisk foreldet lesefeil')
  expect(await writes(page)).toEqual([])
})

test('superseding an active parser terminates its worker and ignores a queued progress callback', async ({ page }) => {
  const dialog = await setup(page)
  await page.evaluate(() => { window.syntheticStepHoldNextWorker = true })
  await selectFile(dialog, 'A'); await finishFile(page, 'A')
  await expect.poll(() => page.evaluate(() => window.syntheticStepWorkers.length)).toBe(1)
  await selectFile(dialog, 'B')
  expect(await page.evaluate(() => window.syntheticStepWorkers[0].terminated)).toBe(true)
  await page.evaluate(() => window.syntheticStepWorkers[0].staleProgress())
  await expect(dialog.getByRole('status')).toHaveText('Leser dokumentet lokalt …')
  await finishFile(page, 'B')
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-B.txt: 1 forslag')
  await page.evaluate(() => window.syntheticStepWorkers[0].staleProgress())
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-B.txt: 1 forslag')
  await expect(dialog).not.toContainText('Syntetisk foreldet fremdrift')
  expect(await writes(page)).toEqual([])
})

test('a new invalid selection clears the old proposal even after a draft rerender', async ({ page }) => {
  const dialog = await setup(page)
  await selectFile(dialog, 'A'); await finishFile(page, 'A')
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-A.txt: 1 forslag')
  await fileInput(dialog).setInputFiles({ name: 'synthetic-step-invalid.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0]) })
  await expect(dialog.getByRole('status')).toContainText('Velg en tekst-')
  await dialog.getByRole('button', { name: 'Legg til manuelt steg' }).click()
  await expect(dialog.getByRole('button', { name: 'Legg valgte i utkastet' })).toHaveCount(0)
  await expect(dialog).not.toContainText('Syntetisk krav A')
  expect(await writes(page)).toEqual([])
})

test('text editing invalidates a pending document and keeps only the explicit text proposal', async ({ page }) => {
  const dialog = await setup(page)
  await selectFile(dialog, 'A')
  await dialog.getByLabel('Lokalt dokumentutdrag').fill('Krav: Syntetisk tekstkrav')
  await dialog.getByRole('button', { name: 'Forbered forslag' }).click()
  await finishFile(page, 'A'); await drainParser(page)
  await expect(dialog.getByRole('checkbox', { name: 'Krav: Syntetisk tekstkrav', exact: true })).toBeChecked()
  await expect(dialog).not.toContainText('Syntetisk krav A')
  await expect(fileInput(dialog)).toHaveValue('')
  await dialog.getByRole('button', { name: 'Legg valgte i utkastet' }).click()
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  expect((await saved(page)).tasks[0].steps.map(step => step.title)).toEqual(['Syntetisk tekstkrav'])
})

test('closing a pending read prevents it from reviving on another task or when reopened', async ({ page }) => {
  let dialog = await setup(page)
  await selectFile(dialog, 'A')
  await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click()
  dialog = await openEditor(page, tasks[1])
  await selectFile(dialog, 'B'); await finishFile(page, 'B')
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-B.txt: 1 forslag')
  await finishFile(page, 'A'); await drainParser(page)
  await expect(dialog).not.toContainText('Syntetisk krav A')
  await dialog.getByRole('button', { name: 'Legg valgte i utkastet' }).click()
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  expect((await saved(page)).tasks[0].steps).toBeUndefined()
  expect((await saved(page)).tasks[1].steps.map(step => step.title)).toEqual(['Syntetisk krav B'])
  dialog = await openEditor(page)
  await expect(dialog.getByRole('button', { name: 'Legg valgte i utkastet' })).toHaveCount(0)
  await expect(dialog.getByRole('status')).toBeEmpty()
})

test('a pending current document publishes into controls recreated by manual draft editing', async ({ page }) => {
  const dialog = await setup(page)
  await selectFile(dialog, 'A')
  await dialog.getByRole('button', { name: 'Legg til manuelt steg' }).click()
  await finishFile(page, 'A')
  await expect(dialog.getByRole('status')).toContainText('synthetic-step-A.txt: 1 forslag')
  await expect(dialog.getByRole('checkbox', { name: 'Krav: Syntetisk krav A', exact: true })).toBeChecked()
  await dialog.getByRole('button', { name: 'Legg valgte i utkastet' }).click()
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  expect((await saved(page)).tasks[0].steps.map(step => step.title)).toEqual(['Nytt steg', 'Syntetisk krav A'])
})
