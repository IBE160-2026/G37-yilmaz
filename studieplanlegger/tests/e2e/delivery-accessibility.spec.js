import { test, expect } from '@playwright/test'
import { navigate, row, saved, seed } from './helpers.js'

const task = { id: 'delivery-task', title: 'Syntetisk innlevering', course: '', completed: false, requiresSubmission: true, estimatedMinutes: 30, deadlineLocal: '2026-09-06T12:00' }

for (const width of [320, 390, 1440]) {
  test.describe(`oppgavemeny ved ${width} piksler`, () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: true })
    test('alle synlige valg ligger på skjermen og status kan endres med tastatur og berøring', async ({ page }) => {
      await seed(page, [task], { view: 'all' })
      const item = row(page, task.title)
      const summary = item.locator('.task-menu > summary')
      const checkbox = item.getByRole('checkbox', { name: /Ferdig med arbeidet/ })
      await summary.tap()
      for (const control of await item.locator('.task-menu-items :is(button, label):visible').all()) {
        const box = await control.boundingBox()
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
      }
      await summary.focus()
      await page.keyboard.press('Tab')
      await expect(checkbox).toBeFocused()
      await page.keyboard.press('Space')
      expect((await saved(page)).tasks[0].completed).toBe(true)
      await page.reload()
      await navigate(page, 'all')
      await summary.tap()
      await expect(checkbox).toBeChecked()
      await checkbox.tap()
      expect((await saved(page)).tasks[0].completed).toBe(false)
    })
  })
}

for (const theme of ['light', 'dark']) {
  test.describe(`stor tekst og tilgjengelige navn i ${theme}`, () => {
    test.use({ viewport: { width: 320, height: 950 }, colorScheme: theme })
    test('hovedvisningene og oppgavekortet får plass ved dobbel tekststørrelse', async ({ page }) => {
      await seed(page, [task], { view: 'all' })
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
      const assertFits = async label => {
        const layout = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll('body *')].flatMap(node => {
            const box = node.getBoundingClientRect()
            const edge = box.right + Math.max(0, node.scrollWidth - node.clientWidth)
            return box.width && edge > innerWidth + 1 && !node.closest('.calendar-viewport') ? [`${node.id || node.className || node.tagName} ${Math.round(edge)}`] : []
          }).slice(0, 20),
        }))
        expect(layout.width, `${label}: ${layout.overflow.join(', ')}`).toBeLessThanOrEqual(320)
      }
      await row(page, task.title).locator('.task-menu > summary').click()
      await assertFits('oppgavemeny')
      await expect(page.locator('#compact-agenda').getByRole('button', { name: /^06 SEP Frist kl\. 12:00 Syntetisk innlevering.*2026$/ })).toBeVisible()
      for (const view of ['overview', 'capacity', 'subjects', 'calendar', 'settings']) {
        await navigate(page, view)
        await assertFits(view)
      }
      await navigate(page, 'subjects')
      await page.getByRole('button', { name: 'Finn studieprogram', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Studieprogram', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Studieprogram', exact: true }).click()
      await assertFits('studieprogram')
    })
  })
}
