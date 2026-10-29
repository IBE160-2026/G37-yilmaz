import { test, expect } from '@playwright/test'
import { themeFixture } from '../e2e/ajour-theme-fixture.js'
import { freeze, navigate, key, openImportMethod } from '../e2e/helpers.js'
import { browserMode, observe } from './diagnostics.js'

// Five current views × two themes × three widths = exactly 30 review images.
// Entirely synthetic fixture; screenshots are review evidence, not golden files.
for (const theme of ['light', 'dark']) for (const width of [1440, 900, 390]) {
  test(`remote visual matrix ${theme} ${width}px`, async ({ page }, info) => {
    const observations = observe(page)
    try {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await freeze(page, '2026-10-26T09:00:00+01:00')
      await page.goto('/')
      await browserMode(page)
      await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state: themeFixture() })
      await page.reload()
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const originalColors = await page.evaluate(() => JSON.parse(localStorage.getItem('ajour.course-colors.v1')).assignments)
      expect(new Set(Object.values(originalColors)).size).toBe(12)
      for (const view of ['overview', 'calendar', 'all', 'subjects', 'settings']) {
        await navigate(page, view)
        if (view === 'subjects') {
          expect(new Set(await page.locator('.course-card').evaluateAll(nodes => nodes.map(node => node.dataset.courseSlot))).size).toBe(12)
          await openImportMethod(page, 'institution')
          await expect(page.locator('.program-import')).toBeVisible()
        }
        await page.clock.runFor(400)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${view} fits ${width}px`).toBe(true)
        const name = `${view === 'subjects' ? 'import' : view}-${theme}-${width}.png`
        const path = info.outputPath(name)
        await page.screenshot({ path, fullPage: true })
        await info.attach(name, { path, contentType: 'image/png' })
      }
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ajour.course-colors.v1')).assignments)).toEqual(originalColors)
    } finally { await observations.finish(info) }
  })
}
