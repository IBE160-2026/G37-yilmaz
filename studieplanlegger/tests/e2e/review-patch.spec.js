import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { key, freeze, navigate, saved, openCourseImport } from './helpers.js'
import { exportBackup } from '../../src/backup.js'
import { providerRequest } from '../../server/providers/index.js'
import { uitDetails } from '../../server/providers/uit.js'

const fixtures = Object.fromEntries(['uib-search', 'uib-course', 'uit-search', 'uit-course'].map(name => [name, readFileSync(new URL(`../fixtures/public-courses/${name}.html`, import.meta.url), 'utf8')]))
const course = { id: 'c', code: 'TEST101', name: 'Review course', university: 'Isolated', semester: 'autumn', year: 2026, credits: 10, notes: 'Keep course notes' }
const task = (id, extra = {}) => ({ id, title: 'Same title', course: 'TEST101', courseId: 'c', deadlineLocal: '2026-09-08T14:00', estimatedMinutes: 90, remainingMinutes: 90, completed: false, requiresSubmission: true, submitted: false, ...extra })
const event = (id, start, minutes, title = 'Same event title') => ({ id, title, courseId: 'c', start, end: new Date(Date.parse(start) + minutes * 60000).toISOString(), location: 'Rom 101', notes: 'Keep event notes' })
const state = () => ({ schemaVersion: 1, tasks: [task('a'), task('b', { deadlineLocal: '2026-09-08T15:00' })], sessions: [{ id: 's2', taskId: 'a', dateLocal: '2026-09-08', startTime: '11:00', endTime: '11:30' }, { id: 's1', taskId: 'a', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }], planner: { courses: [course], events: [], sources: [] } })
async function boot(page, data = state(), now = '2026-09-08T09:00:00+02:00') {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' }); await freeze(page, now)
  await page.goto('/'); await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key, data }); await page.reload()
  return errors
}
async function dailyMenu(page, id = 'a') {
  const summary = page.locator(`[data-daily-key="task:${id}:menu"]`)
  await summary.focus(); if (!await summary.evaluate(node => node.parentElement.open)) await page.keyboard.press('Enter')
}
async function clockTick(page, milliseconds = 2100) { await page.clock.runFor(milliseconds) }
async function calendar(page) {
  await navigate(page, 'calendar'); await page.locator('[data-calendar-view=week]').click(); await page.locator('#full-calendar-date').fill('2026-09-08'); await page.locator('#calendar-week-mode').selectOption('workweek')
}

test('review calendar dates distinguish same-title/time readable controls and preserve 1/5/10/clipped pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const data = state(); data.tasks = []; data.sessions = []
  data.planner.events = [event('one', '2026-09-08T08:00:00Z', 1), event('five', '2026-09-08T09:00:00Z', 5), event('ten', '2026-09-08T10:00:00Z', 10), event('clipped', '2026-09-08T21:59:00Z', 6), event('long-tue', '2026-09-08T12:00:00Z', 240), event('long-wed', '2026-09-09T12:00:00Z', 240)]
  const errors = await boot(page, data); await calendar(page)
  for (const [id, date, height] of [['one', '2026-09-08', 1], ['five', '2026-09-08', 5], ['ten', '2026-09-08', 10], ['clipped', '2026-09-08', 1], ['clipped', '2026-09-09', 5]]) {
    const block = page.locator(`.calendar-time-day[data-date="${date}"] [data-calendar-geometry="event:${id}"]`)
    expect((await block.boundingBox()).height).toBe(height)
    const readable = page.locator(`.calendar-readable-content [data-calendar-key="event:${id}"]`)
    expect((await readable.boundingBox()).height).toBeGreaterThanOrEqual(44)
    await expect(readable).toHaveAttribute('aria-label', /8\. september 2026/)
    await expect(readable.locator('.entry-time')).toContainText('8. september 2026')
  }
  for (const [id, day] of [['long-tue', '8'], ['long-wed', '9']]) {
    const control = page.locator(`[data-viewport-entry="event:${id}"]`)
    await expect(control).toHaveAttribute('aria-label', new RegExp(`${day}\\. september 2026`))
    await expect(control.locator('.entry-time')).toContainText(`${day}. september 2026`)
    await expect(control.locator('.entry-time')).toContainText('14:00'); await expect(control.locator('.entry-time')).toContainText('18:00')
  }
  await page.locator('.calendar-readable-content [data-calendar-key="event:one"]').click()
  await expect(page.locator('.calendar-details')).toContainText('Faktisk varighet: 1 minutter.')
  await page.keyboard.press('Escape'); expect(errors).toEqual([])
  expect((await saved(page)).planner.events).toEqual(data.planner.events)
})

for (const outcome of ['cancel', 'save']) test(`review daily task editor ${outcome} restores its daily key after clock rerenders`, async ({ page }) => {
  const errors = await boot(page); await dailyMenu(page)
  const opener = page.locator('[data-daily-key="task:a:edit"]'); await opener.focus(); await page.keyboard.press('Enter')
  const before = await saved(page), form = page.locator('#task-form')
  await form.locator('[name=title]').fill('Changed only task a'); await clockTick(page)
  if (outcome === 'cancel') await page.locator('#cancel-task').click()
  else await form.getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(form).toBeHidden(); await expect(opener).toBeFocused(); await clockTick(page)
  await expect(opener).toBeFocused()
  const after = await saved(page)
  expect(after.tasks.find(t => t.id === 'a').title).toBe(outcome === 'save' ? 'Changed only task a' : before.tasks.find(t => t.id === 'a').title)
  expect(after.tasks.find(t => t.id === 'b')).toEqual(before.tasks.find(t => t.id === 'b'))
  expect(after.sessions).toEqual(before.sessions); expect(errors).toEqual([])
})

for (const outcome of ['cancel', 'save']) test(`review daily session editor ${outcome} targets just s2 and returns to its daily menu control`, async ({ page }) => {
  const errors = await boot(page); const before = await saved(page)
  await dailyMenu(page)
  const opener = page.locator('[data-daily-key="session:s2:edit"]'); await opener.focus(); await page.keyboard.press('Enter')
  const form = page.locator('#session-form')
  await expect(form.locator('[name=startTime]')).toHaveValue('11:00')
  await form.locator('[name=startTime]').fill('11:15'); await form.locator('[name=endTime]').fill('11:45'); await clockTick(page)
  if (outcome === 'cancel') await page.locator('#cancel-session').click()
  else await form.getByRole('button', { name: 'Lagre studieøkt', exact: true }).click()
  await expect(form).toBeHidden(); await expect(opener).toBeFocused(); await clockTick(page); await expect(opener).toBeFocused()
  const after = await saved(page), original = before.sessions.find(session => session.id === 's2')
  expect(after.sessions.find(session => session.id === 's2')).toEqual(outcome === 'save' ? { ...original, startTime: '11:15', endTime: '11:45', locked: false } : original)
  expect(after.sessions.filter(session => session.id !== 's2')).toEqual(before.sessions.filter(session => session.id !== 's2'))
  expect(after.tasks).toEqual(before.tasks); expect(errors).toEqual([])
})

test('review midnight disappearance moves focused completed-task action to another daily action', async ({ page }) => {
  const data = state(); data.tasks = [task('a', { completed: true, submitted: true }), task('b', { deadlineLocal: '2026-09-09T14:00' })]
  data.sessions = [{ id: 'night', taskId: 'a', dateLocal: '2026-09-08', endDateLocal: '2026-09-09', startTime: '23:50', endTime: '00:00' }]
  await boot(page, data, '2026-09-08T23:59:50+02:00')
  await page.locator('[data-daily-key="task:a:primary"]').focus(); await clockTick(page, 11000)
  await expect(page.locator('[data-daily-row="task:a"]')).toHaveCount(0)
  await expect(page.locator('[data-daily-key="task:b:primary"]')).toBeFocused()
  expect(await page.evaluate(() => document.activeElement.tagName)).not.toBe('BODY')
})

test('review undo success survives ticks until dismissal and cannot undo an unrelated newer action', async ({ page }) => {
  await boot(page); const before = await saved(page), notice = page.locator('.contextual-undo')
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('Bekreft frigjøring'); await dialog.accept() })
  await page.locator('[data-daily-key="task:a:primary"]').click()
  expect((await saved(page)).sessions).toEqual([])
  await notice.getByRole('button', { name: 'Angre siste endring' }).click(); await clockTick(page, 5000)
  await expect(notice).toBeVisible(); await expect(notice).toContainText('Endringen er angret.')
  await expect(notice.getByRole('button', { name: 'Angre siste endring' })).toBeHidden()
  expect((await saved(page)).tasks).toEqual(before.tasks)
  expect((await saved(page)).sessions).toEqual(before.sessions)
  await notice.getByRole('button', { name: 'Lukk melding' }).click(); await clockTick(page); await expect(notice).toBeHidden()
  await page.locator('[data-daily-key="task:b:primary"]').click(); await expect(notice).toBeVisible()
  await dailyMenu(page); await page.locator('[data-daily-key="task:a:edit"]').click()
  await page.locator('#task-form [name=title]').fill('An unrelated later edit')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(notice).toBeHidden(); const newer = await saved(page)
  await notice.getByRole('button', { name: 'Angre siste endring', includeHidden: true }).dispatchEvent('click')
  expect(await saved(page)).toEqual(newer)
})

for (const createdAt of ['2026-09-08', '2026-09-08T08:00:00', 0]) test(`review accepted backup timestamp ${JSON.stringify(createdAt)} leaves cancel and restore usable`, async ({ page }) => {
  const errors = await boot(page), original = await saved(page)
  const backup = { ...exportBackup({ ...original, tasks: original.tasks.map(t => t.id === 'a' ? { ...t, title: 'Restored task a' } : t) }), createdAt }
  const file = { name: 'review-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }
  await navigate(page, 'settings'); await page.locator('#backup-file').setInputFiles(file)
  const dialog = page.locator('.data-dialog'); await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Erstatt lokale data' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click(); expect(await saved(page)).toEqual(original)
  await page.locator('#backup-file').setInputFiles(file); await dialog.getByRole('button', { name: 'Erstatt lokale data' }).click()
  const after = await saved(page); expect(after.tasks).toEqual(backup.data.tasks); expect(after.planner).toEqual(original.planner); expect(after.sessions).toEqual(original.sessions)
  expect(errors).toEqual([])
})

async function mockProvider(page, institution, variant = () => ({})) {
  await page.route(`**/api/import/providers/${institution}/**`, async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1), { semester = 'autumn', record = '923370' } = variant()
    const result = await providerRequest(institution, action, Object.fromEntries(url.searchParams), { fetchText: async (_url, _redirects, validate) => {
      validate?.(new URL(_url))
      let html = fixtures[`${institution}-${action === 'search' ? 'search' : 'course'}`]
      if (institution === 'uit') html = html.replaceAll('923370', record).replaceAll('Autumn 2026', semester === 'spring' ? 'Spring 2026' : 'Autumn 2026')
      return html
    } })
    await route.fulfill({ json: result })
  })
}
async function previewCourse(page, institution, code, semester = 'autumn', accepted = true) {
  await navigate(page, 'subjects'); const form = page.locator('#course-import-form')
  await openCourseImport(page)
  await form.locator('[name=university]').selectOption(institution); await page.getByRole('button', { name: 'Neste: søk og semester' }).click()
  await form.locator('[name=code]').fill(code); await form.locator('[name=year]').fill('2026'); await form.locator('[name=semester]').selectOption(semester)
  await form.getByRole('button', { name: 'Søk emner' }).click(); await page.locator('.wizard-results').getByRole('button', { name: new RegExp(`^${code} ·`) }).click()
  if (accepted) await expect(page.locator('#import-preview')).toBeVisible()
}

test('review legacy course created manually gains verified identity without changing local ID, notes or task links', async ({ page }) => {
  const errors = await boot(page, { schemaVersion: 1, tasks: [] }); await navigate(page, 'subjects'); await page.locator('#course-new').click()
  const editor = page.locator('#subject-editor')
  for (const [name, value] of Object.entries({ name: 'Space physics', code: 'FYS-3000', university: 'UiT', year: '2026', notes: 'Manual local note' })) await editor.locator(`[name=${name}]`).fill(value)
  await editor.locator('[name=semester]').selectOption('autumn'); await editor.getByRole('button', { name: 'Lagre emne', exact: true }).click()
  const manual = (await saved(page)).planner.courses[0]
  expect(manual).not.toHaveProperty('sourceRecordId'); expect(manual).not.toHaveProperty('sourceProvider')
  const linked = task('linked', { courseId: manual.id, course: 'FYS-3000', remainingMinutes: 37 })
  await page.evaluate(({ key, linked }) => { const data = JSON.parse(localStorage.getItem(key)); data.tasks = [linked]; localStorage.setItem(key, JSON.stringify(data)) }, { key, linked })
  await page.reload(); let record = '923370'; await mockProvider(page, 'uit', () => ({ record }))
  await previewCourse(page, 'uit', 'FYS-3000'); expect((await saved(page)).planner.courses[0]).not.toHaveProperty('sourceRecordId')
  await page.getByRole('button', { name: 'Importer bare emnet' }).click(); await page.reload()
  const bound = await saved(page)
  expect(bound.planner.courses).toHaveLength(1); expect(bound.planner.courses[0]).toMatchObject({ id: manual.id, notes: 'Manual local note', sourceProvider: 'uit', sourceRecordId: '923370', sourceVersion: '2026H' })
  expect(bound.tasks).toEqual([linked])
  record = '923371'; await previewCourse(page, 'uit', 'FYS-3000', 'autumn', false)
  await expect(page.locator('#subject-message')).toContainText('campus/emneversjon')
  expect((await saved(page)).planner).toEqual(bound.planner); expect((await saved(page)).tasks).toEqual([linked]); expect(errors).toEqual([])
})

test('review manual semester edit preserves old provenance until confirmed correct-period reimport', async ({ page }) => {
  const imported = await uitDetails({ code: 'FYS-3000', semester: 'autumn', year: '2026', sourceRecordId: '923370', sourceUrl: 'https://uit.no/utdanning/emner/emne?p_document_id=923370' }, async () => fixtures['uit-course'])
  const data = state(); data.planner.courses = [{ ...imported.course, id: 'c', notes: 'Keep course notes' }]
  data.tasks = data.tasks.map(t => ({ ...t, course: 'FYS-3000' })); data.planner.events = [event('original-event', '2026-09-08T08:00:00Z', 60)]
  data.planner.sources = [{ id: 'original-source', courseId: 'c', kind: 'file', name: 'Original calendar', groups: [], lastUpdated: '2026-09-08T06:00:00Z' }]
  const errors = await boot(page, data); await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Rediger emne FYS-3000', exact: true }).click()
  const editor = page.locator('#subject-editor'); await editor.locator('[name=semester]').selectOption('spring'); await editor.getByRole('button', { name: 'Lagre emne', exact: true }).click()
  const stale = await saved(page)
  expect(stale.planner.courses[0]).toMatchObject({ id: 'c', semester: 'spring', sourceVersion: '2026H', sourceRecordId: '923370', sourceBindingStale: { semester: 'autumn', sourceVersion: '2026H' } })
  await expect(page.locator('.source-binding-warning')).toContainText('Kildebindingen er utdatert')
  await page.reload(); await mockProvider(page, 'uit', () => ({ semester: 'spring', record: '923371' }))
  await previewCourse(page, 'uit', 'FYS-3000', 'spring')
  await expect(page.locator('#import-preview')).toContainText('Bekreft ny kildebinding')
  expect((await saved(page)).planner.courses[0].sourceRecordId).toBe('923370')
  await page.getByRole('button', { name: 'Importer bare emnet' }).click(); await page.reload()
  const after = await saved(page), current = after.planner.courses[0]
  expect(current).toMatchObject({ id: 'c', notes: 'Keep course notes', semester: 'spring', sourceRecordId: '923371', sourceVersion: '2026V' })
  expect(current).not.toHaveProperty('sourceBindingStale'); expect(current.sourceBindingHistory.at(-1)).toMatchObject({ sourceRecordId: '923370', sourceVersion: '2026H', semester: 'autumn' })
  expect(after.tasks).toEqual(stale.tasks); expect(after.sessions).toEqual(stale.sessions); expect(after.planner.events).toEqual(stale.planner.events); expect(after.planner.sources).toEqual(stale.planner.sources)
  expect(errors).toEqual([])
})

async function linkTargets(page, host, timetableName) {
  const source = host.getByRole('link', { name: 'Offisiell emnekilde', exact: true }), timetable = host.getByRole('link', { name: timetableName, exact: true })
  await source.focus(); await page.keyboard.press('Tab'); await expect(timetable).toBeFocused()
  const first = await source.boundingBox(), second = await timetable.boundingBox()
  expect(first.height).toBeGreaterThanOrEqual(44); expect(second.height).toBeGreaterThanOrEqual(44); expect(second.y).toBeGreaterThanOrEqual(first.y + first.height + 8)
  expect(await timetable.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid')
}
for (const width of [1280, 390]) test(`review UiB source and timetable links are separate keyboard/touch targets at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 }); await boot(page, { schemaVersion: 1, tasks: [] }); await mockProvider(page, 'uib')
  await previewCourse(page, 'uib', 'INF100'); await linkTargets(page, page.locator('#import-preview'), 'Åpne offisiell timeplan')
  await page.screenshot({ path: `artifacts/review-uib-links-${width}.png` })
  await page.getByRole('button', { name: 'Importer bare emnet' }).click(); await linkTargets(page, page.locator('.course-card'), 'Offisiell timeplan')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

for (const [width, fontSize] of [[1440, 16], [390, 16], [390, 24]]) test(`review compact agenda details are readable with real contrast and wrapping at ${width}/${fontSize}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  const data = state(); data.planner.events = [event('lecture', '2026-09-08T08:00:00Z', 60, 'A long lecture title with meaningful wrapping and complete information')]
  await boot(page, data); await page.evaluate(size => document.documentElement.style.fontSize = `${size}px`, fontSize); await clockTick(page, 100)
  const agenda = page.locator('.compact-agenda-list'); await expect(agenda).toBeVisible(); await agenda.scrollIntoViewIfNeeded()
  const measurements = await agenda.locator('.agenda-item-meta, .agenda-item-meta > span, .agenda-item-title, .agenda-item-details').evaluateAll(nodes => {
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number)
    const luminance = color => color.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
    return nodes.filter(node => node.getBoundingClientRect().height).map(node => {
      const style = getComputedStyle(node); let parent = node, background = [255, 255, 255]
      while (parent) { const color = rgb(getComputedStyle(parent).backgroundColor); if (color.length === 3 || color[3] === 1) { background = color; break } parent = parent.parentElement }
      const a = luminance(rgb(style.color)), b = luminance(background), bounds = node.closest('.agenda-entry').getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node)
      return { text: node.textContent, fontSize: parseFloat(style.fontSize), contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), fits: [...range.getClientRects()].every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1) }
    })
  })
  expect(measurements.length).toBeGreaterThan(3)
  if (fontSize === 24) {
    const stamps = await agenda.locator('.agenda-date-stamp').evaluateAll(nodes => nodes.map(node => {
      const [day, month] = node.children
      return { parts: [day, month].map(part => ({ text: part.textContent, whiteSpace: getComputedStyle(part).whiteSpace, width: part.clientWidth, content: part.scrollWidth })),
        monthBelowDay: month.getBoundingClientRect().top >= day.getBoundingClientRect().bottom }
    }))
    expect(stamps.length).toBeGreaterThan(0)
    for (const stamp of stamps) {
      expect(stamp.monthBelowDay).toBe(true)
      for (const part of stamp.parts) { expect(part.whiteSpace, part.text).toBe('nowrap'); expect(part.content, part.text).toBeLessThanOrEqual(part.width) }
    }
  }
  for (const item of measurements) { expect(item.fontSize, item.text).toBeGreaterThanOrEqual(14); expect(item.contrast, item.text).toBeGreaterThanOrEqual(4.5); expect(item.fits, item.text).toBe(true) }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `artifacts/review-agenda-${width}-${fontSize}.png` })
})

for (const fontSize of [16, 20]) test(`review narrow overlapping blocks use ellipsis without misleading partial clocks at 1280/${fontSize}`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const data = state(); data.tasks = []; data.sessions = []; data.planner.events = [event('long-a', '2026-09-08T07:00:00Z', 240, 'Long overlapping lecture with a complete readable title'), event('long-b', '2026-09-08T07:30:00Z', 210, 'Another overlapping lecture with a complete readable title')]
  await boot(page, data); await calendar(page); await page.evaluate(size => document.documentElement.style.fontSize = `${size}px`, fontSize); await clockTick(page, 100)
  const block = page.locator('.calendar-timeline [data-calendar-key="event:long-a"]'), title = block.locator('strong')
  await expect(title).toHaveCSS('white-space', 'nowrap'); await expect(title).toHaveCSS('text-overflow', 'ellipsis')
  await expect(block.locator('.entry-time')).toBeHidden(); expect((await block.boundingBox()).height).toBe(240)
  const readable = page.locator('.calendar-readable-content [data-calendar-key="event:long-a"]')
  await expect(page.locator('.calendar-readable-events')).toHaveJSProperty('open', true)
  await expect(readable).toHaveAttribute('aria-label', /8\. september 2026.*09:00.*13:00/)
  await expect(readable).toContainText(data.planner.events[0].title); expect((await readable.boundingBox()).height).toBeGreaterThanOrEqual(44)
  await readable.click(); await expect(page.locator('.calendar-details')).toContainText('Faktisk varighet: 240 minutter.')
  await expect(page.locator('.calendar-details')).toContainText(data.planner.events[0].title); await page.keyboard.press('Escape')
  await block.focus(); await expect(block).toBeFocused(); await expect(block).toHaveCSS('outline-style', 'solid')
  await page.screenshot({ path: `artifacts/review-overlap-1280-${fontSize}.png` })
  expect((await saved(page)).planner.events).toEqual(data.planner.events)
})
