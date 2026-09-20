import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { navigate, saved, key } from './helpers.js'

const course = { id: 'c', code: 'TEST101', name: 'Isolated course', university: 'Isolated', semester: 'autumn', year: 2026, credits: 10, notes: '' }
const task = { id: 't', title: 'Keep remaining work', course: 'TEST101', courseId: 'c', deadlineLocal: '2026-09-08T12:00', estimatedMinutes: 90, remainingMinutes: 45, completed: false }
const lesson = (id, start, end) => ({ id, title: `Teaching ${id}`, courseId: 'c', start, end, location: 'Room A101', notes: 'Preserve notes' })
const initial = () => ({ schemaVersion: 1, tasks: [task], planner: { courses: [course], sources: [], events: [lesson('morning', '2026-09-08T08:00:00Z', '2026-09-08T09:00:00Z')] }, workWindows: [{ id: 'w', label: 'Original window', start: '2026-09-08T06:00:00Z', end: '2026-09-08T08:00:00Z' }] })
async function seed(page, data = initial()) {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-09-08T06:00:00Z'))
  await page.addInitScript(({ key, data }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data)) }, { key, data })
  await page.goto('/'); return errors
}
async function menu(page) { await navigate(page, 'settings'); const control = page.locator('.data-menu'); if (!await control.evaluate(node => node.open)) await control.locator('summary').click() }

test('mobile 200 percent modes stay whole and selected content is reachable above navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const errors = await seed(page)
  await navigate(page, 'calendar'); await page.evaluate(() => document.documentElement.style.fontSize = '200%')
  const modes = page.locator('.full-calendar-modes button')
  const widths = await modes.evaluateAll(nodes => nodes.map(node => ({ width: node.clientWidth, content: node.scrollWidth, whiteSpace: getComputedStyle(node).whiteSpace })))
  expect(widths.every(item => item.content <= item.width && item.whiteSpace === 'nowrap')).toBe(true)
  await modes.last().scrollIntoViewIfNeeded(); await page.screenshot({ path: 'artifacts/focused-mobile-200-modes.png' })
  await page.locator('[data-calendar-view=agenda]').focus(); await page.keyboard.press('Enter')
  const viewport = page.locator('.full-calendar-viewport'), nav = await page.locator('.view-actions').boundingBox(), bounds = await viewport.boundingBox()
  expect(bounds.height).toBeGreaterThanOrEqual(200); expect(bounds.y + bounds.height).toBeLessThanOrEqual(nav.y)
  await expect(page.locator('.calendar-full-agenda .calendar-entry').first()).toBeInViewport()
  await page.screenshot({ path: 'artifacts/focused-mobile-200-content.png' })
  await page.locator('.calendar-full-agenda [data-calendar-key="event:morning"]').click(); await expect(page.locator('.calendar-details')).toContainText('TEST101')
  await expect(page.locator('.calendar-details')).toContainText('Room A101')
  await page.keyboard.press('Escape'); expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('work-window kind changes preserve identity and tasks, survive reload, and undo exactly', async ({ page }) => {
  await seed(page); const before = await saved(page); await navigate(page, 'capacity')
  await page.locator('.work-window-row').getByRole('button', { name: 'Rediger tidsrom' }).click()
  const form = page.locator('.work-window-form'); await form.locator('[name=kind]').selectOption('busy')
  await form.getByRole('button', { name: 'Lagre tidsrom' }).click()
  let data = await saved(page); expect(data.workWindows).toEqual([]); expect(data.busyWindows).toEqual(before.workWindows); expect(data.tasks).toEqual(before.tasks)
  await page.reload(); await navigate(page, 'capacity'); await expect(page.locator('.work-window-row')).toContainText('Opptatt: Original window')
  await navigate(page, 'settings'); await page.getByRole('button', { name: 'Angre siste endring' }).click(); await navigate(page, 'capacity')
  data = await saved(page); expect(data.workWindows).toEqual(before.workWindows); expect(data.busyWindows).toBeUndefined(); expect(data.tasks).toEqual(before.tasks)
  await page.locator('.work-window-row').getByRole('button', { name: 'Rediger tidsrom' }).click(); await form.locator('[name=kind]').selectOption('busy'); await form.getByRole('button', { name: 'Lagre tidsrom' }).click()
  await page.locator('.work-window-row').getByRole('button', { name: 'Rediger tidsrom' }).click(); await form.locator('[name=kind]').selectOption('work'); await form.getByRole('button', { name: 'Lagre tidsrom' }).click()
  data = await saved(page); expect(data.workWindows).toEqual(before.workWindows); expect(data.busyWindows).toEqual([])
  await navigate(page, 'overview'); await page.locator('#focus-panel').scrollIntoViewIfNeeded()
  await expect(page.locator('.focus-visual img')).toBeVisible(); await page.screenshot({ path: 'artifacts/focused-compact-illustration.png' })
})

test('portable legacy backup rekeys safely but local recovery restores raw connections and IDs', async ({ page }) => {
  const data = initial(), url = 'https://calendar.example.invalid/private.ics?token=PRIVATE_BROWSER_SECRET_9182', sourceId = `legacy:${url}`
  data.planner.sources = [{ id: sourceId, courseId: 'c', kind: 'url', url, name: 'Private isolated source', groups: ['lecture'], lastUpdated: '2026-09-08T06:00:00Z', autoRefresh: false }]
  Object.assign(data.planner.events[0], { id: `event:${sourceId}:one`, sourceId, sourceKey: 'one' })
  await seed(page, data); const before = await saved(page); await menu(page)
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Eksporter sikkerhetskopi' }).click()
  const download = await downloadPromise, raw = await readFile(await download.path(), 'utf8'), backup = JSON.parse(raw)
  expect(raw).not.toContain('PRIVATE_BROWSER_SECRET_9182'); expect(backup.rekeyedIds).toBeGreaterThanOrEqual(2)
  expect(await saved(page)).toEqual(before)
  backup.data.tasks[0].title = 'Temporary replacement'
  await page.locator('#backup-file').setInputFiles({ name: 'portable.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await page.getByRole('button', { name: 'Erstatt lokale data' }).click()
  expect((await saved(page)).planner.sources[0].url).toBeUndefined()
  await page.getByRole('button', { name: 'Gjenopprett forrige kopi' }).click()
  await expect(page.locator('.data-dialog')).toContainText('tilkoblinger og opprinnelige ID-er beholdes')
  await expect(page.locator('.data-dialog')).not.toContainText('PRIVATE_BROWSER_SECRET_9182')
  await page.getByRole('button', { name: 'Erstatt lokale data' }).click()
  expect(await saved(page)).toEqual(before); await page.reload(); expect(await saved(page)).toEqual(before)
})

for (const [season, date, friday, morning, transition] of [
  ['spring', '2026-03-29', '2026-03-27T07:00:00Z', '2026-03-29T06:00:00Z', [['jump', '2026-03-29T00:00:00Z', '2026-03-29T01:00:00Z']]],
  ['autumn', '2026-10-25', '2026-10-23T06:00:00Z', '2026-10-25T07:00:00Z', [['first-hour', '2026-10-25T00:00:00Z', '2026-10-25T01:00:00Z'], ['second-hour', '2026-10-25T01:00:00Z', '2026-10-25T02:00:00Z']]],
]) test(`DST ${season} week aligns clock time and shows actual transition duration`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const end = start => new Date(Date.parse(start) + 3600000).toISOString(), data = initial()
  data.tasks = []; data.workWindows = []; data.planner.events = [lesson('friday-eight', friday, end(friday)), lesson('sunday-eight', morning, end(morning)), ...transition.map(args => lesson(...args))]
  const errors = await seed(page, data); await navigate(page, 'calendar'); await page.locator('[data-calendar-view=week]').click(); await page.locator('#full-calendar-date').fill(date)
  const viewport = page.locator('.full-calendar-viewport'); await viewport.evaluate(node => { node.scrollLeft = node.scrollWidth; node.scrollTop = 60 })
  const fridayTop = (await page.locator('.calendar-timeline [data-calendar-key="event:friday-eight"]').boundingBox()).y, sundayTop = (await page.locator('.calendar-timeline [data-calendar-key="event:sunday-eight"]').boundingBox()).y
  expect(Math.abs(fridayTop - sundayTop)).toBeLessThan(1)
  await expect(page.locator(`.calendar-time-day[data-date="${date}"]`)).toHaveAttribute('data-actual-minutes', season === 'spring' ? '1380' : '1500')
  await expect(page.locator('.calendar-clock-gap').first()).toBeVisible()
  for (const [id] of transition) expect((await page.locator(`.calendar-timeline [data-calendar-key="event:${id}"]`).boundingBox()).height).toBe(60)
  await page.screenshot({ path: `artifacts/focused-dst-${season}-week.png` })
  await page.locator(`.calendar-timeline [data-calendar-key="event:${transition[0][0]}"]`).click(); await expect(page.locator('.calendar-details')).toContainText('Faktisk varighet: 60 minutter')
  await expect(page.locator('.calendar-details')).toContainText('+02:00'); await expect(page.locator('.calendar-details')).toContainText('+01:00')
  await page.screenshot({ path: `artifacts/focused-dst-${season}-details.png` }); expect(errors).toEqual([])
})

test('manual refresh preview also preserves disappearance from unknown URL feeds', async ({ page }) => {
  const data = initial(), sourceId = 'unknown-source'
  data.planner.sources = [{ id: sourceId, courseId: 'c', kind: 'url', url: 'https://calendar.example.invalid/rolling.ics', name: 'Rolling', groups: ['lecture'], allGroups: ['lecture'], lastUpdated: '2026-09-08T06:00:00Z', autoRefresh: false }]
  Object.assign(data.planner.events[0], { sourceId, sourceKey: 'known', sourceUid: 'known', group: 'lecture' })
  await page.route('**/api/import/calendar', route => route.fulfill({ json: { calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n' } }))
  await seed(page, data); await navigate(page, 'subjects'); await page.getByRole('button', { name: 'Oppdater nå', exact: true }).click()
  await expect(page.locator('#import-preview')).toContainText('Manglende økter beholdes')
  await page.getByRole('button', { name: 'Bekreft import', exact: true }).click()
  expect((await saved(page)).planner.events[0].cancelled).not.toBe(true)
})
