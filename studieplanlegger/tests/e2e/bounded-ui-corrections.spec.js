import { test, expect } from '@playwright/test'
import { key, navigate, saved } from './helpers.js'

const course = { id: 'bounded-course', code: 'IBE160', name: 'Programmering', university: 'Test', year: 2026, semester: 'autumn', credits: 10, notes: 'Preserve this note' }
const task = (id, deadlineLocal = '2026-09-08T16:00') => ({ id, title: 'Innlevering med en lang tittel som skal kunne leses i sin helhet', courseId: course.id, course: course.code, deadlineLocal, estimatedMinutes: 90, remainingMinutes: 60, completed: false, requiresSubmission: true, submitted: false })
const event = (id, start, end, title) => ({ id, title, courseId: course.id, start: `2026-09-08T${start}:00+02:00`, end: `2026-09-08T${end}:00+02:00`, location: 'Rom 101', notes: 'Preserve event note' })
const initial = () => ({ schemaVersion: 1, tasks: [task('bounded-task'), task('other-task', '2026-09-08T17:00')], sessions: [{ id: 'bounded-session', taskId: 'bounded-task', dateLocal: '2026-09-08', startTime: '11:00', endTime: '12:00' }], planner: { courses: [course], sources: [], events: [event('later', '14:00', '15:30', 'Senere forelesning'), event('ten', '13:00', '13:10', 'Ti minutter med fullstendig aktivitetstittel'), event('overlap', '12:55', '14:25', 'Overlappende forelesning med lang tittel'), event('early', '10:00', '10:30', 'Tidlig aktivitet')] } })
async function boot(page, data, size = 16, now = '2026-09-08T09:00:00+02:00') {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.setFixedTime(new Date(now))
  await page.addInitScript(({ key, data, size }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data)); document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = size + 'px' }) }, { key, data, size })
  await page.goto('/'); await expect(page.locator('#daily-overview')).toBeVisible()
  return errors
}
async function assertCards(page) {
  const bad = await page.locator('.calendar-readable-content .calendar-entry, .calendar-points .calendar-entry, .calendar-timeline > .calendar-entry').evaluateAll(nodes => nodes.flatMap(node => {
    const rect = node.getBoundingClientRect()
    const clipped = [...node.children].filter(child => getComputedStyle(child).display !== 'none').some(child => child.getBoundingClientRect().bottom > rect.bottom + 1)
    return clipped || node.scrollHeight > node.clientHeight + 1 ? [{ text: node.textContent, height: rect.height, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }] : []
  }))
  expect(bad, 'Visible card text must not be vertically clipped').toEqual([])
}
for (const [width, height] of [[1440, 900], [1280, 800], [390, 844]]) for (const size of [16, 24]) {
  test(`bounded visual acceptance ${width}/${size}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, timezoneId: 'Europe/Oslo' })
    const page = await context.newPage(), data = initial(), errors = await boot(page, data, size)
    const row = page.locator('[data-daily-row="task:bounded-task"]')
    await expect(row).toContainText('Frist i dag kl. 16:00'); await expect(row).toContainText('11:00–12:00')
    const widths = await row.evaluate(node => ({ row: node.getBoundingClientRect().width, copy: node.querySelector('.daily-task-copy').getBoundingClientRect().width, minimum: parseFloat(getComputedStyle(document.documentElement).fontSize) * 18 }))
    expect(widths.copy, 'Actions must wrap before they squeeze the task text').toBeGreaterThanOrEqual(Math.min(widths.row, widths.minimum) - 1)
    await expect(page.locator('[data-daily-row^="task:"]')).toHaveCount(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `artifacts/bounded-daily-${width}-${size}.png`, fullPage: true })
    const primary = row.locator('[data-daily-key="task:bounded-task:primary"]'), menu = row.locator('summary')
    for (const control of [primary, menu]) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44)
    await menu.focus(); await menu.press('Enter'); await expect(row.getByRole('button', { name: 'Åpne oppgave og frist' })).toBeVisible(); await menu.press('Escape')
    await navigate(page, 'calendar')
    await page.locator(`[data-calendar-view="${width === 390 ? 'day' : 'week'}"]`).click()
    await page.locator('#full-calendar-date').fill('2026-09-08')
    const viewport = page.locator('.full-calendar-viewport')
    await viewport.evaluate(node => { node.scrollTop = 660 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.locator('[data-calendar-short="event:ten"]').evaluate(node => {
      const viewport = node.closest('.full-calendar-viewport'), top = node.closest('.calendar-time-day').querySelector('.calendar-points').getBoundingClientRect().bottom + 8, rect = node.getBoundingClientRect()
      if (rect.top < top || rect.bottom > viewport.getBoundingClientRect().bottom - 8) viewport.scrollTop += rect.top - top
    })
    await expect(page.locator('.calendar-short-control[data-calendar-short="event:ten"]')).toBeInViewport()
    const marker = page.locator('[data-calendar-geometry="event:ten"]'), control = page.locator('[data-calendar-short="event:ten"]')
    expect(await marker.evaluate(node => ({ top: node.style.top, height: node.getBoundingClientRect().height }))).toEqual({ top: '780px', height: 10 })
    expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44)
    expect(await control.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === node })).toBe(true)
    await assertCards(page)
    const order = await page.locator('.calendar-readable-content button').evaluateAll(nodes => nodes.map(node => node.dataset.calendarKey || node.dataset.viewportEntry))
    expect(order).toEqual(['event:early', 'session:bounded-session', 'event:overlap', 'event:ten', 'event:later'])
    await expect(page.locator('.calendar-readable-events summary')).toContainText('Aktiviteter')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width !== 390) expect(await viewport.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `artifacts/bounded-calendar-${width}-${size}.png`, fullPage: true })
    for (const mode of ['click', 'touch', 'keyboard']) {
      if (mode === 'click') await control.click()
      else if (mode === 'touch') await control.tap()
      else { await control.focus(); await control.press('Enter') }
      await expect(page.locator('.calendar-details[open]')).toContainText('Ti minutter med fullstendig aktivitetstittel')
      await expect(page.locator('.calendar-details[open]')).toContainText('Faktisk varighet: 10 minutter.')
      await expect(page.locator('.calendar-details[open]')).toContainText('13:00–13:10')
      await expect(page.locator('.calendar-details[open]')).toContainText('Rom 101')
      await page.keyboard.press('Escape'); await expect(control).toBeFocused()
    }
    for (const selector of ['.calendar-points [data-calendar-key="task:bounded-task"]', '.calendar-readable-content [data-calendar-key="session:bounded-session"]']) {
      const card = page.locator(selector); await card.focus(); await card.press('Enter')
      await expect(page.locator('.calendar-details[open]')).toContainText(data.tasks[0].title)
      await page.keyboard.press('Escape'); await expect(card).toBeFocused()
    }
    const after = await saved(page)
    expect(after.tasks).toEqual(data.tasks); expect(after.sessions).toEqual(data.sessions); expect(after.planner).toEqual(data.planner); expect(errors).toEqual([])
    await testInfo.attach('measurements', { body: JSON.stringify({ width, size, order, noVerticalClipping: true, exactTenMinutes: true, interactions: ['click', 'touch', 'keyboard'] }), contentType: 'application/json' })
    await context.close()
  })
}
test('short-event overlap group offers every event without an intercepted target', async ({ page }) => {
  const data = initial(); data.planner.events.push(event('one', '13:05', '13:06', 'Ett minutt'), event('five', '13:10', '13:15', 'Fem minutter'))
  await boot(page, data); await navigate(page, 'calendar'); await page.locator('[data-calendar-view=day]').click()
  await page.locator('.full-calendar-viewport').evaluate(node => { node.scrollTop = 660 })
  const control = page.locator('[data-calendar-short="event:ten event:one event:five"]')
  for (const [title, minutes] of [['Ti minutter', 10], ['Ett minutt', 1], ['Fem minutter', 5]]) {
    await control.focus(); await control.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Korte aktiviteter' })).toBeVisible()
    await page.locator('.calendar-short-chooser').getByRole('button', { name: new RegExp(title) }).click()
    await expect(page.locator('.calendar-details[open]')).toContainText(`Faktisk varighet: ${minutes} minutter.`)
    await page.keyboard.press('Escape'); await expect(control).toBeFocused()
  }
})
test('ambiguous Oslo deadline stays visible and keeps its warning', async ({ page }) => {
  const data = initial(); data.tasks = [task('ambiguous', '2026-10-25T02:30')]; data.sessions = []; data.planner.events = []
  const errors = await boot(page, data, 24, '2026-10-25T00:00:00+02:00')
  await expect(page.locator('#daily-overview')).toContainText('Frist i dag kl. 02:30 (må presiseres)')
  await expect(page.locator('#daily-overview')).toContainText('tvetydig eller ugyldig klokkeslett')
  expect(errors).toEqual([])
})
test('only the Oslo date changes during a cross-midnight activity', async ({ page }) => {
  const data = initial(); data.tasks = []; data.sessions = []
  data.planner.events = [{ id: 'night', courseId: course.id, title: 'Nattarbeid', start: '2026-09-08T23:00:00+02:00', end: '2026-09-09T01:00:00+02:00' }]
  const errors = await boot(page, data, 16, '2026-09-08T23:59:00+02:00')
  await expect(page.locator('#daily-overview')).toContainText('i dag kl. 23:00–01:00 (til 9. september 2026)')
  await page.clock.setFixedTime(new Date('2026-09-09T00:01:00+02:00')); await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('#daily-overview')).toContainText('8. september 2026 kl. 23:00–01:00 (til 9. september 2026)')
  expect(errors).toEqual([])
})
test('cross-midnight sessions and exclusive all-day ends retain their actual dates', async ({ page }) => {
  const data = initial(); data.planner.events = []; data.sessions = [{ id: 'night', taskId: 'bounded-task', dateLocal: '2026-09-08', endDateLocal: '2026-09-09', startTime: '23:00', endTime: '01:00' }]
  await boot(page, data, 16, '2026-09-08T22:00:00+02:00')
  await expect(page.locator('#daily-overview')).toContainText('23:00–01:00 (til 9. september 2026)')
  await page.evaluate(key => { const data = JSON.parse(localStorage.getItem(key)); data.sessions = []; data.planner.events = [{ id: 'all-day', courseId: data.planner.courses[0].id, title: 'Hele tirsdagen', allDay: true, start: '2026-09-08T00:00:00+02:00', end: '2026-09-09T00:00:00+02:00' }]; localStorage.setItem(key, JSON.stringify(data)) }, key)
  await page.reload()
  const activity = page.locator('[data-daily-row="event:all-day"]')
  await expect(activity).toContainText('i dag · Hele dagen'); await expect(activity).not.toContainText('kl. Hele dagen'); await expect(activity).not.toContainText('9. september')
})
test('cancelled short events, midnight markers and tablet scrolling remain distinguishable', async ({ page }) => {
  const data = initial(); data.tasks = []; data.sessions = []
  data.planner.events = [{ ...event('cancelled', '13:00', '13:10', 'Avlyst aktivitet'), cancelled: true }, event('active', '13:05', '13:10', 'Aktiv aktivitet'), { id: 'midnight', courseId: course.id, title: 'Over midnatt', start: '2026-09-08T23:59:00+02:00', end: '2026-09-09T00:05:00+02:00' }]
  await page.setViewportSize({ width: 900, height: 900 }); await boot(page, data); await navigate(page, 'calendar'); await page.locator('[data-calendar-view=week]').click()
  await page.locator('.full-calendar-filters summary').click(); await page.getByLabel('Vis avlysninger', { exact: true }).check(); await page.locator('.full-calendar-filters summary').click()
  await expect(page.locator('.calendar-narrow-week-hint')).toBeVisible()
  expect(await page.locator('.calendar-time-day').first().evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(140)
  await expect(page.locator('[data-calendar-geometry="event:cancelled"]')).toHaveClass(/is-cancelled/)
  const group = page.locator('[data-calendar-short="event:cancelled event:active"]'); await group.focus(); await group.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Korte aktiviteter' }).getByRole('button', { name: /^Avlyst:/ })).toBeVisible()
  await page.keyboard.press('Escape'); await expect(group).toBeFocused()
  const first = page.locator('.calendar-time-day[data-date="2026-09-08"] [data-calendar-geometry="event:midnight"]'), last = page.locator('.calendar-time-day[data-date="2026-09-09"] [data-calendar-geometry="event:midnight"]')
  await expect(first).toHaveClass(/continues-after/); await expect(last).toHaveClass(/continues-before/)
  expect((await first.boundingBox()).height).toBe(1); expect((await last.boundingBox()).height).toBe(5)
})
