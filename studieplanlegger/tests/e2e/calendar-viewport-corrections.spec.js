import { test, expect } from '@playwright/test'
import { key, navigate, saved } from './helpers.js'

const course = { id: 'c', code: 'TEST101', name: 'Isolated course', university: 'Isolated', semester: 'autumn', year: 2026, credits: 10, notes: 'Keep local notes' }
const event = (id, start, end, title = id) => ({ id, courseId: 'c', title, start, end, location: 'Rom 101', notes: 'Keep values' })
const long = event('clipped', '2026-09-08T04:30:00Z', '2026-09-08T08:30:00Z', 'Lang hendelse som starter f\u00f8r synlig tidsrom')
const data = (events = [long], tasks = []) => ({ schemaVersion: 1, tasks, planner: { courses: [course], sources: [], events } })
async function boot(page, initial = data(), paused = false) {
  await page.setViewportSize({ width: 1280, height: 800 })
  if (paused) { await page.clock.install({ time: new Date('2026-09-08T05:59:00Z') }); await page.clock.pauseAt(new Date('2026-09-08T06:00:00Z')) }
  else await page.clock.setFixedTime(new Date('2026-09-08T06:00:00Z'))
  await page.addInitScript(({ key, initial }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial)) }, { key, initial })
  await page.goto('/'); await navigate(page, 'calendar')
  if (paused) await page.clock.runFor(250)
}
async function settleDialog(page, paused = false) {
  if (paused) await page.clock.runFor(300)
  await expect(page.locator('.calendar-details')).toHaveCSS('display', 'none')
  await expect(page.locator('.calendar-details')).toHaveCSS('overlay', 'none')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
}
async function metrics(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('.full-calendar-viewport'), bounds = viewport.getBoundingClientRect()
    const day = document.querySelector('.calendar-time-day[data-date="2026-09-08"]'), points = day.querySelector('.calendar-points').getBoundingClientRect()
    return { scroll: viewport.scrollTop, left: viewport.scrollLeft, gridTop: points.bottom, gridBottom: bounds.bottom, visibleMinutes: bounds.bottom - points.bottom,
      columns: document.querySelectorAll('.calendar-time-day').length, widthFits: viewport.scrollWidth <= viewport.clientWidth + 1,
      pageFits: document.documentElement.scrollWidth <= innerWidth }
  })
}

test('viewport clipping follows scroll and resize without changing duration, focus, values or reload state', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await boot(page); const before = await saved(page), viewport = page.locator('.full-calendar-viewport')
  const block = page.locator('.calendar-timeline [data-calendar-key="event:clipped"]')
  const control = page.locator('[data-viewport-entry="event:clipped"]')
  await expect.poll(async () => (await metrics(page)).scroll).toBe(440)
  await expect(control).toContainText('Starter f\u00f8r synlig tidsrom')
  await expect(control).toContainText('06:30'); await expect(control).toContainText('10:30')
  expect(await block.evaluate(node => ({ top: node.style.top, height: node.getBoundingClientRect().height }))).toEqual({ top: '390px', height: 240 })
  await control.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.calendar-details')).toContainText('Faktisk varighet: 240 minutter')
  await page.keyboard.press('Escape'); await settleDialog(page)
  await expect(control).toBeFocused(); expect((await metrics(page)).scroll).toBe(440)
  await page.screenshot({ path: 'artifacts/targeted-correction-clipped-top.png' })
  await viewport.evaluate(node => { node.scrollTop = 300 })
  await expect(block).not.toHaveClass(/viewport-continues-before/)
  await expect(control).toBeFocused(); expect((await metrics(page)).scroll).toBe(300)
  await page.setViewportSize({ width: 1280, height: 600 })
  await expect(control).toContainText('Fortsetter etter synlig tidsrom')
  await expect(control).toBeFocused(); expect((await metrics(page)).scroll).toBe(300)
  expect((await block.boundingBox()).height).toBe(240)
  await page.screenshot({ path: 'artifacts/targeted-correction-clipped-bottom-resize.png' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(control.locator('.entry-viewport-continuation')).toBeHidden()
  await expect(control).toBeFocused(); expect((await metrics(page)).scroll).toBe(300)
  await page.reload(); await navigate(page, 'calendar')
  expect((await metrics(page)).scroll).toBe(300)
  const after = await saved(page); expect(after.planner).toEqual(before.planner); expect(after.tasks).toEqual(before.tasks)
  expect(errors).toEqual([])
  await testInfo.attach('viewport-state.json', { body: JSON.stringify({ metrics: await metrics(page), before: before.planner, after: after.planner }), contentType: 'application/json' })
})

function dense() {
  return data([long, event('short', '2026-09-08T08:00:00Z', '2026-09-08T08:05:00Z', 'Fem minutter med fullstendig tittel'),
    event('overlap', '2026-09-08T08:00:00Z', '2026-09-08T09:30:00Z', 'Overlappende undervisning'),
    event('late', '2026-09-08T21:30:00Z', '2026-09-09T00:00:00Z', 'Fortsetter over midnatt')],
  Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, title: `Frist ${i + 1} med en lang og lesbar tittel`, course: 'TEST101', courseId: 'c', deadlineLocal: `2026-09-08T1${i}:00`, estimatedMinutes: 45, remainingMinutes: 37, completed: false })))
}

test('compact desktop bands leave useful clock space with every workweek column and honest short geometry', async ({ page }, testInfo) => {
  await boot(page, dense()); await page.locator('#calendar-week-mode').selectOption('workweek')
  await expect.poll(async () => (await metrics(page)).visibleMinutes).toBeGreaterThanOrEqual(300)
  const measured = await metrics(page)
  expect(measured).toMatchObject({ scroll: 440, columns: 5, widthFits: true, pageFits: true })
  await expect(page.locator('.calendar-readable-events')).toHaveJSProperty('open', true)
  await expect(page.locator('.full-calendar-filters .calendar-general-help')).toBeHidden()
  await expect(page.locator('.calendar-narrow-week-hint')).toBeHidden()
  const labels = await page.locator('.full-calendar-toolbar > label').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height).map(node => ({
    height: node.getBoundingClientRect().height, fieldHeight: node.querySelector('input, select').getBoundingClientRect().height,
  })))
  for (const label of labels) { expect(label.fieldHeight).toBeGreaterThanOrEqual(44); expect(label.height).toBeLessThanOrEqual(label.fieldHeight + 1) }
  const short = page.locator('.calendar-time-day[data-date="2026-09-08"] [data-calendar-geometry="event:short"]')
  expect((await short.boundingBox()).height).toBe(5)
  const ten = page.locator('.calendar-timeline [data-calendar-key="event:overlap"]')
  const tenBounds = await ten.boundingBox(); expect(tenBounds.y).toBeGreaterThan(measured.gridTop); expect(tenBounds.y + 44).toBeLessThan(measured.gridBottom)
  await expect(page.locator('.calendar-readable-events summary')).toBeInViewport()
  await expect(page.locator('.calendar-readable-content')).toBeVisible()
  await page.screenshot({ path: 'artifacts/targeted-correction-calendar-1280.png' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect.poll(async () => (await metrics(page)).visibleMinutes).toBeGreaterThan(300)
  await page.screenshot({ path: 'artifacts/targeted-correction-calendar-1440.png' })
  await testInfo.attach('compact-bands.json', { body: JSON.stringify({ desktop1280: measured, desktop1440: await metrics(page) }), contentType: 'application/json' })
})

test('large text evidence waits for actual dialog overlay removal with a paused clock', async ({ page }, testInfo) => {
  await boot(page, dense(), true)
  await page.evaluate(() => document.documentElement.style.fontSize = '20px'); await page.clock.runFor(250)
  const control = page.locator('.calendar-readable-content button').first()
  await control.focus(); await page.keyboard.press('Enter'); await page.clock.runFor(250)
  await expect(page.locator('.calendar-details')).toBeVisible()
  await page.keyboard.press('Escape')
  const closing = await page.locator('.calendar-details').evaluate(node => ({ open: node.open, display: getComputedStyle(node).display, overlay: getComputedStyle(node).overlay, animations: node.getAnimations().map(a => ({ playState: a.playState, currentTime: a.currentTime })) }))
  await settleDialog(page, true)
  await expect(control).toBeFocused()
  expect((await metrics(page)).pageFits).toBe(true)
  expect((await metrics(page)).columns).toBe(7)
  await page.screenshot({ path: 'artifacts/targeted-correction-calendar-large-text-stable.png', animations: 'allow' })
  await testInfo.attach('dialog-animation.json', { body: JSON.stringify({ closing, settled: await page.locator('.calendar-details').evaluate(node => ({ open: node.open, display: getComputedStyle(node).display, overlay: getComputedStyle(node).overlay })), metrics: await metrics(page) }), contentType: 'application/json' })
})

test('mobile reduced motion retains day and agenda access after compact band changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await boot(page, dense())
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('[data-calendar-view="week"]').click()
  await expect(page.locator('.calendar-narrow-week-hint')).toBeInViewport()
  await expect(page.locator('.calendar-narrow-week-hint')).toHaveText('Rull sidelengs for alle ukedagene.')
  await page.screenshot({ path: 'artifacts/targeted-correction-calendar-390-week.png' })
  await page.locator('[data-calendar-view="day"]').click()
  await expect(page.locator('.calendar-narrow-week-hint')).toBeHidden()
  await page.evaluate(() => document.documentElement.style.fontSize = '24px')
  await page.locator('[data-calendar-view="agenda"]').click()
  await expect(page.locator('.calendar-narrow-week-hint')).toBeHidden()
  await expect(page.locator('.calendar-full-agenda .calendar-entry').first()).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'artifacts/targeted-correction-calendar-390-large-text.png' })
})
