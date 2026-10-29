import { test, expect } from '@playwright/test'
import { freeze, navigate, openRowMenu, key } from './helpers.js'

// Isolated synthetic data. Images are review evidence, not golden screenshots.
const fixture = () => ({ schemaVersion: 1, tasks: [{
  id: 'synthetic-choice-task', title: 'Syntetisk kontroll av valg', course: '',
  remainingMinutes: 30, estimatedMinutes: 30, completed: false,
  deadlineLocal: '2026-10-30T20:00', requiresSubmission: true,
}] })

async function assertChoiceGeometry(radios) {
  const geometry = await radios.evaluateAll(inputs => inputs.map(input => {
    const box = input.getBoundingClientRect(), label = input.closest('label')
    const copy = label.querySelector('span'), text = copy.getBoundingClientRect()
    return { width: box.width, height: box.height, gap: text.left - box.right,
      labelHeight: label.getBoundingClientRect().height, textWidth: text.width }
  }))
  for (const box of geometry) {
    expect(box.width).toBeGreaterThanOrEqual(18)
    expect(box.width).toBeLessThanOrEqual(24)
    expect(box.height).toBe(box.width)
    expect(box.gap).toBeGreaterThanOrEqual(6)
    expect(box.gap).toBeLessThanOrEqual(14)
    expect(box.labelHeight).toBeGreaterThanOrEqual(44)
    expect(box.textWidth).toBeGreaterThan(20)
  }
}

async function capture(page, dialog, radio, info, name) {
  await expect(radio).toBeFocused()
  expect(await radio.evaluate(node => node.matches(':focus-visible'))).toBe(true)
  expect(await radio.evaluate(node => Number.parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThanOrEqual(2)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function activateWithKeyboard(page, dialog, name) {
  const cancel = dialog.getByRole('button', { name, exact: true })
  // Start at the selected native radio. Traverse actual focus order, including
  // editable fields/disclosures, without programmatically focusing the footer.
  for (let count = 0; count < 40 && !await cancel.evaluate(node => node === document.activeElement); count++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  }
  await expect(cancel).toBeFocused()
  await expect(cancel).toBeInViewport({ ratio: 1 })
  expect(await cancel.evaluate(node => {
    const box = node.getBoundingClientRect(), style = getComputedStyle(node)
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return node.matches(':focus-visible') && Number.parseFloat(style.outlineWidth) >= 2
      && box.top >= 0 && box.bottom <= innerHeight && (hit === node || node.contains(hit))
  })).toBe(true)
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
}

for (const theme of ['light', 'dark']) for (const width of [390, 900, 1440]) for (const textSize of [100, 200]) {
  test(`owner-trial controls ${theme} ${width}px ${textSize}% text`, async ({ page }, info) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await freeze(page, '2026-10-29T17:00:00+01:00')
    await page.goto('/')
    const state = fixture()
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
    await page.reload()
    if (textSize === 200) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await page.evaluate(() => document.fonts.ready)
    await navigate(page, 'all')
    const row = page.locator('#task-list > li').filter({ hasText: state.tasks[0].title })
    await openRowMenu(row)
    await row.getByRole('button', { name: 'Registrer arbeid', exact: false }).click()
    const outcome = page.getByRole('dialog', { name: 'Hva skjedde?', exact: true })
    await expect(outcome).toBeVisible()
    await assertChoiceGeometry(outcome.getByRole('radio'))
    await outcome.getByRole('radio', { name: 'Ikke utført', exact: true }).locator('..').locator('span').click()
    await expect(outcome.getByRole('radio', { name: 'Ikke utført', exact: true })).toBeChecked()
    await page.keyboard.press('ArrowUp')
    const more = outcome.getByRole('radio', { name: 'Trenger mer tid', exact: true })
    await expect(more).toBeChecked()
    await capture(page, outcome, more, info, `outcome-${theme}-${width}-${textSize}`)
    await activateWithKeyboard(page, outcome, 'Avbryt')
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(state)
    await openRowMenu(row)
    await row.getByRole('button', { name: 'Se planforslag', exact: false }).click()
    const planning = page.getByRole('dialog', { name: 'Planforslag for oppgaven', exact: true })
    await expect(planning).toBeVisible()
    await assertChoiceGeometry(planning.getByRole('radio'))
    await planning.locator('.study-time-option').filter({ hasText: 'På dagtid i ukedagene' }).locator('strong').click()
    await expect(planning.getByRole('radio', { name: 'På dagtid i ukedagene', exact: false })).toBeChecked()
    await page.keyboard.press('ArrowDown')
    const evening = planning.getByRole('radio', { name: 'På kvelden i ukedagene', exact: false })
    await expect(evening).toBeChecked()
    await capture(page, planning, evening, info, `planning-${theme}-${width}-${textSize}`)
    await activateWithKeyboard(page, planning, 'Ikke nå')
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(state)
    if (theme === 'dark' && width === 390 && textSize === 200) {
      await openRowMenu(row)
      await row.getByRole('button', { name: 'Registrer arbeid', exact: false }).click()
      await outcome.getByRole('radio', { name: 'Trenger mer tid', exact: true }).check()
      await outcome.locator('[name=actualMinutes]').fill('10')
      await outcome.locator('[name=remainingChoice]').selectOption('exact')
      await outcome.locator('[name=remainingMinutes]').fill('20')
      await activateWithKeyboard(page, outcome, 'Lagre utfallet')
      const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
      expect(persisted.tasks[0]).toMatchObject({ id: state.tasks[0].id, completed: false, remainingMinutes: 20 })
      expect(persisted.workLogs).toHaveLength(1)
      expect(persisted.workLogs[0]).toMatchObject({ taskId: state.tasks[0].id, actualMinutes: 10, outcome: 'more' })
      await page.reload()
      expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).workLogs).toEqual(persisted.workLogs)
    }
    expect(errors).toEqual([])
  })
}
