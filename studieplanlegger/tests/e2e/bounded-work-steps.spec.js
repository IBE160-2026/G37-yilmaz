import { test, expect } from '@playwright/test'
import { seed, row, saved, navigate, raw, writes } from './helpers.js'

// Synthetic mixed representation with a deliberate collision, existing notes,
// completed work and dependencies. Opening the editor must not migrate storage.
const task = { id: 'bounded-mixed', title: 'Syntetiske blandede steg', course: '', deadlineLocal: '', estimatedMinutes: 60, completed: false,
  nextStep: { description: 'Eldre separat steg', estimatedMinutes: 15 },
  steps: [
    { id: 'bounded-mixed:legacy-next-step', title: 'Første forutsetning', completed: false, notes: 'Opprinnelig notat' },
    { id: 'dependent', title: 'Steg som trenger forutsetningen', completed: false, dependencyIds: ['bounded-mixed:legacy-next-step'] },
    { id: 'done', title: 'Allerede fullført', completed: true },
  ],
}
async function editor(page) {
  const item = row(page, task.title)
  if (!await item.locator('.task-menu').evaluate(node => node.open)) await item.locator('.task-menu > summary').click()
  await item.getByRole('button', { name: /Administrer arbeidssteg/ }).click()
  return page.locator('.work-steps-dialog')
}

test('mixed steps keep content through cancellation, completion, reorder, save, reload and atomic undo', async ({ page }) => {
  await seed(page, [task], { view: 'all' })
  const original = await raw(page)
  let dialog = await editor(page)
  await expect(dialog.locator('.work-step-list > li')).toHaveCount(4)
  await expect(dialog.getByLabel('Navn på steg 4')).toHaveValue('Eldre separat steg')
  expect(await raw(page)).toBe(original)
  await dialog.getByLabel('Navn på steg 4').fill('Avbrutt endring')
  await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click()
  expect(await raw(page)).toBe(original)
  dialog = await editor(page)
  const legacy = dialog.locator('[data-step-id="bounded-mixed:legacy-next-step:2"]')
  await legacy.getByRole('button', { name: 'Marker fullført' }).click()
  await legacy.getByRole('button', { name: 'Flytt opp' }).click()
  await legacy.getByRole('button', { name: 'Åpne igjen' }).click()
  await legacy.getByRole('textbox').fill('Redigert eldre steg')
  await dialog.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  const changed = (await saved(page)).tasks[0]
  expect(changed).not.toHaveProperty('nextStep')
  expect(changed.steps.map(step => step.id)).toEqual(['bounded-mixed:legacy-next-step', 'dependent', 'bounded-mixed:legacy-next-step:2', 'done'])
  expect(changed.steps[0]).toEqual(task.steps[0]); expect(changed.steps[1]).toEqual(task.steps[1]); expect(changed.steps[3]).toEqual(task.steps[2])
  expect(changed.steps[2]).toMatchObject({ title: 'Redigert eldre steg', estimatedMinutes: 15, completed: false, provenance: { kind: 'legacy-next-step' } })
  await page.reload(); expect((await saved(page)).tasks[0]).toEqual(changed)
  dialog = await editor(page)
  await expect(dialog.locator('.work-step-list > li')).toHaveCount(4)
  await dialog.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  expect((await saved(page)).tasks[0]).toEqual(changed)
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  expect((await saved(page)).tasks[0]).toEqual(task)
})

test('both removal controls explain dependent steps and remain readable with keyboard at desktop and enlarged mobile', async ({ page }, info) => {
  await seed(page, [task], { view: 'all' })
  const original = await raw(page), item = row(page, task.title)
  await item.locator('.task-menu > summary').click()
  await item.getByRole('button', { name: /Fjern neste steg/ }).click()
  await expect(item).toContainText('Steg som trenger forutsetningen')
  await expect(item).toContainText('Rediger forutsetningene')
  expect(await raw(page)).toBe(original)
  const dialog = await editor(page)
  const remove = dialog.locator('[data-step-id="bounded-mixed:legacy-next-step"]').getByRole('button', { name: 'Fjern', exact: true })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390) await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
    await remove.focus(); await page.keyboard.press('Enter')
    await expect(remove).toBeFocused()
    await expect(dialog.locator('.work-step-error')).toContainText('Rediger forutsetningene')
    expect(await raw(page)).toBe(original)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await dialog.locator('.work-step-error').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`bounded-steps-${width}.png`), fullPage: true })
  }
  await dialog.getByLabel('Forutsetninger for steg 2').selectOption([])
  await remove.focus(); await page.keyboard.press('Enter')
  await expect(dialog.locator('.work-step-list > li')).toHaveCount(3)
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  const result = (await saved(page)).tasks[0]
  expect(result.steps.map(step => step.id)).toEqual(['dependent', 'done', 'bounded-mixed:legacy-next-step:2'])
  expect(result.steps[0]).not.toHaveProperty('dependencyIds')
})

test('keyboard removal focuses the next or previous remaining step and finally the Add control', async ({ page }) => {
  const independent = { ...task, steps: ['first', 'middle', 'last'].map(id => ({ id, title: id, completed: false })) }
  delete independent.nextStep
  await seed(page, [independent], { view: 'all' })
  const original = await raw(page), dialog = await editor(page)
  const removal = id => dialog.locator(`[data-step-id="${id}"]`).getByRole('button', { name: 'Fjern', exact: true })
  await removal('middle').focus(); await page.keyboard.press('Enter'); await page.clock.runFor(1)
  await expect(removal('last')).toBeFocused()
  await page.keyboard.press('Enter'); await page.clock.runFor(1)
  await expect(removal('first')).toBeFocused()
  await page.keyboard.press('Enter'); await page.clock.runFor(1)
  await expect(dialog.getByRole('button', { name: 'Legg til manuelt steg', exact: true })).toBeFocused()
  await expect(dialog.locator('.work-step-list > li')).toHaveCount(0)
  expect(await raw(page)).toBe(original)
  await dialog.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  expect((await saved(page)).tasks[0].steps).toEqual([])
})

test('an open work-step dialog closes safely if another tab removes the task', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.evaluate(async task => {
    const { createWorkStepsView } = await import('/src/work-steps-view.js')
    const model = { tasks: [task] }
    const view = createWorkStepsView({ state: () => model, onClose: () => {} })
    view.open(task.id)
    model.tasks = []
  }, task)
  const dialog = page.locator('.work-steps-dialog[open]')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Legg til manuelt steg', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(errors).toEqual([])
})

test('rejected mixed-step save retains raw state and draft, then retries one atomic normalization without duplicates', async ({ page }) => {
  await seed(page, [task], { view: 'all' })
  const original = await raw(page), dialog = await editor(page)
  await dialog.getByLabel('Navn på steg 4').fill('Behold utkast etter feil')
  await dialog.getByLabel('Minutter for steg 4').fill('23')
  await page.evaluate(() => { window.failWrite = true })
  await dialog.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('alert').last()).toContainText('Kunne ikke lagre')
  expect(await raw(page)).toBe(original)
  await expect(dialog.getByLabel('Navn på steg 4')).toHaveValue('Behold utkast etter feil')
  await expect(dialog.getByLabel('Minutter for steg 4')).toHaveValue('23')
  await expect(dialog.locator('.work-step-list > li')).toHaveCount(4)
  expect(await writes(page)).toHaveLength(1)
  await page.evaluate(() => { window.failWrite = false })
  await dialog.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const result = await saved(page), attempts = await writes(page)
  expect(attempts).toHaveLength(2)
  expect(attempts.map(attempt => attempt.previous)).toEqual([original, original])
  const rejected = JSON.parse(attempts[0].value)
  expect(rejected.tasks).toEqual(result.tasks)
  expect(rejected.history.undo[0].changes).toEqual(result.history.undo[0].changes)
  expect(JSON.parse(attempts[1].value)).toEqual(result)
  expect(result.tasks[0]).not.toHaveProperty('nextStep')
  expect(result.tasks[0].steps.slice(0, 3)).toEqual(task.steps)
  expect(result.tasks[0].steps[3]).toMatchObject({ id: 'bounded-mixed:legacy-next-step:2', title: 'Behold utkast etter feil', estimatedMinutes: 23 })
  expect(new Set(result.tasks[0].steps.map(step => step.id)).size).toBe(4)
  expect(result.history.undo).toHaveLength(1)
  await page.reload()
  expect(await saved(page)).toEqual(result)
})
