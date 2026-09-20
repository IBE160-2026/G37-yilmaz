const localOrigin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || '5174'}`
import { navigate } from './helpers.js'
import { test, expect } from '@playwright/test'
import { expectFocusFits, fillDeadline, tabTo, openTaskDetails } from './helpers.js'

for (const width of [360, 1280]) {
  test(`Norwegian keyboard and layout ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('requestfailed', request => errors.push(request.url()))
    page.on('response', response => { if (response.status() >= 400) errors.push(response.url()) })
    page.on('request', request => { if (new URL(request.url()).origin !== localOrigin) errors.push(request.url()) })
    await page.goto('/')
    await expect(page).toHaveTitle('Studieplan')
    await expect(page.locator('html')).toHaveAttribute('lang', 'nb')
    await expect(page.locator('#view-overview')).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Tab')
    await expectFocusFits(page, page.getByRole('link', { name: 'Hopp til hovedinnhold' }))
    await page.keyboard.press('Enter')
    await expect(page.getByRole('main')).toBeFocused()
    for (const view of ['overview', 'all', 'subjects', 'week', 'time', 'capacity']) {
      await navigate(page, view, { keyboard: true })
      await expect(page.locator(`#view-${view}`)).toHaveAttribute('aria-pressed', 'true')
    }
    await tabTo(page, page.locator('#view-all'))
    await page.keyboard.press('Enter')
    await tabTo(page, page.locator('#new-task'))
    await page.keyboard.press('Enter')
    await expectFocusFits(page, page.getByLabel('Tittel', { exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.locator('#title')).toHaveAttribute('aria-invalid', 'true')
    await expectFocusFits(page, page.locator('#title'))
    await page.screenshot({ path: testInfo.outputPath(`form-errors-${width}.png`), fullPage: true })
    await tabTo(page, page.locator('#task-form .task-optional-details > summary'))
    await page.keyboard.press('Enter')
    const stops = ['#title', '#remainingMinutes', '#course', '#deadlineDate', '#deadlineTime', '#requiresSubmission', '#task-form button[type="submit"]', '#cancel-task']
    for (const stop of stops.slice(1)) await tabTo(page, page.locator(stop))
    for (const stop of stops.slice(0, -1).reverse()) await tabTo(page, page.locator(stop), 'Shift+Tab')
    for (const stop of stops.slice(1)) await tabTo(page, page.locator(stop))
    await page.keyboard.press('Enter')
    await expectFocusFits(page, page.locator('#new-task'))
    const help = page.locator('summary').filter({ hasText: 'Hjelp og lokal lagring' })
    await tabTo(page, help)
    await page.keyboard.press('Enter')
    await expect(help.locator('..')).toHaveAttribute('open', '')
    await page.screenshot({ path: testInfo.outputPath(`sideskall-${width}.png`), fullPage: true })
    await page.keyboard.press('Space')
    await expect(help.locator('..')).not.toHaveAttribute('open')
    await tabTo(page, page.locator('#new-task'))
    await page.keyboard.press('Enter')
    await page.locator('#title').fill('Lang oppgave '.repeat(40))
    await openTaskDetails(page)
    await page.locator('#course').fill('IBE160')
    await fillDeadline(page, '2026-09-10T12:30')
    await page.locator('#remainingMinutes').fill('45')
    await tabTo(page, page.getByRole('checkbox', { name: 'Krever innlevering', exact: true }))
    await tabTo(page, page.getByRole('button', { name: 'Lagre', exact: true }))
    await page.keyboard.press('Enter')
    await expectFocusFits(page, page.locator('#new-task'))
    await expect(page.locator('#task-list > li')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`task-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}

test('explains unavailable task actions without JavaScript', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  try {
    await page.goto(localOrigin)
    await expect(page.locator('noscript p')).toContainText('Aktiver JavaScript')
    await expect(page.locator('noscript p')).toBeVisible()
    await expect(page.locator('#new-task')).toBeDisabled()
    await expect(page.locator('#empty-tasks')).not.toBeVisible()
  } finally { await context.close() }
})
