import { test, expect } from '@playwright/test'
import { freeze, navigate, key, tabTo } from './helpers.js'

const stored = page => page.evaluate(key => localStorage.getItem(key), key)
const fixture = () => ({ schemaVersion: 1, tasks: [{ id: 'retained', title: 'Behold eksisterende arbeid', course: '', deadlineLocal: '2026-09-11T16:00', estimatedMinutes: null, remainingMinutes: 45, completed: false }], sessions: [{ id: 'tuesday', taskId: 'retained', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }], workWindows: [{ id: 'thursday', start: '2026-09-10T12:00:00Z', end: '2026-09-10T14:00:00Z' }] })

async function boot(page, state, { width = 1280, size = 16 } = {}) {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await freeze(page, '2026-09-09T09:00:00+02:00')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload()
  await page.addStyleTag({ content: `html { font-size: ${size}px !important; }` })
}

for (const outcome of ['cancel', 'timeout']) {
  test(`R6 mounted document worker ${outcome} stops parsing, preserves storage and permits a successful retry`, async ({ page }) => {
    await boot(page, fixture())
    await page.evaluate(() => {
      const NativeWorker = window.Worker
      window.documentWorkers = { created: 0, terminated: 0 }
      window.Worker = class extends NativeWorker {
        constructor(...args) { super(...args); window.documentWorkers.created++ }
        terminate() { window.documentWorkers.terminated++; return super.terminate() }
      }
    })
    const pattern = '**/src/document-parser.worker.js*'
    // Actual browser Worker, deliberately stuck in synchronous parsing after it
    // acknowledges the input. Only Worker.terminate can stop this execution.
    await page.route(pattern, route => route.fulfill({ contentType: 'text/javascript', body: 'self.onmessage = () => { self.postMessage({ documentImport: true, progress: "Kontrollert dokumentleser startet" }); while (true) {} }' }))
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
    await page.getByRole('button', { name: 'Fra dokument eller tekst', exact: true }).click()
    const text = 'Innlevering etter avbrudd frist 2026-09-16 kl. 14:00'
    await page.getByLabel('Eller lim inn tekst').fill(text)
    const before = await stored(page), read = page.getByRole('button', { name: 'Lag forhåndsvisning', exact: true })
    await read.click()
    await expect(page.locator('.document-import [role=status]')).toHaveText('Kontrollert dokumentleser startet')
    await expect(read).toBeDisabled()
    if (outcome === 'cancel') await page.getByRole('button', { name: 'Avbryt lesing', exact: true }).click()
    else await page.clock.fastForward(30001)
    await expect(page.locator('.document-import [role=alert]')).toContainText(outcome === 'cancel' ? 'avbrutt' : '30 sekunder og er stoppet')
    await expect(read).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Avbryt lesing', exact: true })).toBeHidden()
    await expect(page.getByLabel('Eller lim inn tekst')).toHaveValue(text)
    expect(await stored(page)).toBe(before)
    expect(await page.evaluate(() => window.documentWorkers)).toEqual({ created: 1, terminated: 1 })
    await page.unroute(pattern)
    await read.click()
    await expect(page.getByRole('heading', { name: 'Kontroller planen før import', exact: true })).toBeVisible()
    expect(await stored(page)).toBe(before)
    await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
    const after = JSON.parse(await stored(page))
    expect(after.tasks).toHaveLength(2)
    expect(after.tasks[0]).toEqual(fixture().tasks[0])
    expect(after.sessions).toEqual(fixture().sessions)
    expect(after.workWindows).toEqual(fixture().workWindows)
    expect(await page.evaluate(() => window.documentWorkers)).toEqual({ created: 2, terminated: 2 })
    await page.reload()
    expect(JSON.parse(await stored(page)).tasks).toHaveLength(2)
  })
}

for (const [width, size] of [[390, 24], [390, 32], [1440, 16]]) {
  test(`R6 replan dates remain readable and keyboard-editable at ${width}px with ${size}px text`, async ({ page }, info) => {
    await boot(page, fixture(), { width, size })
    const before = await stored(page)
    await page.locator('.connected-plan-actions').getByRole('button', { name: 'Jeg ligger etter', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Jeg ligger etter', exact: true })
    const date = dialog.getByLabel('Ny dato', { exact: true }).first()
    await tabTo(page, date)
    await expect(date).toHaveValue('2026-09-10')
    const layout = await date.evaluate(input => {
      const style = getComputedStyle(input), row = input.closest('.replan-row'), rowStyle = getComputedStyle(row)
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d'); context.font = style.font
      return { width: input.getBoundingClientRect().width, minimum: context.measureText('09/10/2026').width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 36, columns: rowStyle.gridTemplateColumns.split(' ').length, pageFits: document.documentElement.scrollWidth <= innerWidth }
    })
    expect(layout.width).toBeGreaterThanOrEqual(layout.minimum)
    expect(layout.columns).toBe(width < 760 ? 1 : 2)
    expect(layout.pageFits).toBe(true)
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await date.fill('2026-09-11')
    await expect(date).toHaveValue('2026-09-11')
    await date.fill('2026-09-10')
    await date.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`replan-date-${width}-${size}.png`) })
    await dialog.getByRole('button', { name: 'Forkast', exact: true }).click()
    expect(await stored(page)).toBe(before)
  })
}
