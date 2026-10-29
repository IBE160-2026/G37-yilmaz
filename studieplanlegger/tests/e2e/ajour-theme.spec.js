import { test, expect } from '@playwright/test'
import { themeFixture } from './ajour-theme-fixture.js'
import { freeze, instrumentWrites, navigate, openTaskDetails, openImportMethod, reveal, saved, writes } from './helpers.js'
import { openTpImport, confirmTpImport, preview, courseRows, eventRows, openPreviewRow, fixtureRows, tpCsvRows } from './tp-csv-helpers.js'

const preferenceKey = 'ajour:appearance:v1'
const colorKey = 'ajour.course-colors.v1'
async function boot(page, { theme = 'light', width = 1440, fontSize = 16, state = themeFixture() } = {}) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await freeze(page, '2026-10-26T09:00:00+01:00')
  await instrumentWrites(page)
  await page.goto('/')
  await page.evaluate(data => localStorage.setItem('studieplanlegger:v1', JSON.stringify(data)), state)
  await page.reload()
  await expect(page.locator('#read-error')).toBeHidden()
  await expect(page.locator('#theme-toggle')).toBeVisible()
  await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important }` })
  await page.evaluate(() => document.fonts.ready)
}
async function capture(page, info, name) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
  await page.screenshot({ path: info.outputPath(`${name}-viewport.png`) })
}
async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function assignments(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)).assignments, colorKey)
}
// Locate by domain task/event identity, then compare actual paint with the fixture's
// expected course. A renderer's data-course-* attributes are not the test oracle.
async function expectCourseMarker(locator, courseId, colors, { pseudo, fill = false, shadow = false, minWidth = 3 } = {}) {
  await expect(locator).toBeVisible()
  const result = await locator.evaluate((node, { slot, pseudo, fill, shadow }) => {
    const sample = document.createElement('span')
    sample.style.color = `var(--course-${slot}-marker)`; document.documentElement.append(sample)
    const expected = getComputedStyle(sample).color; sample.remove()
    const style = getComputedStyle(node, pseudo || null)
    return {
      expected, actual: shadow ? style.boxShadow.match(/rgba?\([^)]+\)/)?.[0] : fill ? style.backgroundColor : style.borderInlineStartColor,
      width: shadow && style.boxShadow.includes('inset') ? parseFloat(style.boxShadow.replace(/rgba?\([^)]+\)/, '').replace('inset', '').trim()) : fill ? parseFloat(style.width) : parseFloat(style.borderInlineStartWidth),
      displayed: style.display !== 'none' && style.visibility !== 'hidden',
    }
  }, { slot: courseId ? colors[courseId] : 'neutral', pseudo, fill, shadow })
  expect(result.displayed).toBe(true)
  expect(result.width).toBeGreaterThanOrEqual(minWidth)
  expect(result.actual).toBe(result.expected)
}
async function renderedCourseContrast(page) {
  return page.locator('.course-card').evaluateAll(cards => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3) }
    const luminance = color => rgb(color).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0)
    const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
    return cards.map(card => {
      const style = getComputedStyle(card), title = getComputedStyle(card.querySelector('h3'))
      const swatch = document.createElement('span'); card.append(swatch)
      swatch.style.color = 'var(--course-color)'; const marker = getComputedStyle(swatch).color
      swatch.style.color = 'var(--course-bg)'; const background = getComputedStyle(swatch).color
      swatch.style.color = 'var(--course-text)'; const foreground = getComputedStyle(swatch).color
      swatch.remove()
      return { slot: card.dataset.courseSlot, marker, courseText: ratio(foreground, background), markerRatio: ratio(marker, background), titleRatio: ratio(title.color, style.backgroundColor) }
    })
  })
}
async function eventTextContrast(control) {
  return control.evaluate(node => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const luminance = color => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1)
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0)
    }
    const background = luminance(getComputedStyle(node).backgroundColor)
    return [...node.querySelectorAll('strong, span')].filter(n => n.textContent && n.checkVisibility()).map(n => {
      const text = luminance(getComputedStyle(n).color)
      return (Math.max(text, background) + .05) / (Math.min(text, background) + .05)
    })
  })
}

test('synchronous bootstrap paints explicit dark before a deliberately delayed app module', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 1, theme: 'dark' })), preferenceKey)
  let release
  let intercepted = false
  const hold = new Promise(resolve => { release = resolve })
  await page.route(url => url.pathname === '/src/main.js' || /^\/assets\/index-[^/]+\.js$/.test(url.pathname), async route => {
    intercepted = true
    await hold
    await route.continue()
  })
  await page.goto('/', { waitUntil: 'commit' })
  try {
    await expect.poll(() => intercepted).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(33, 29, 36)')
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await expect(page.locator('#settings-panel')).toHaveCount(0)
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#211d24')
  } finally { release() }
  await expect(page.locator('#settings-panel')).toHaveCount(1)
  await expect(page.locator('#theme-toggle')).toHaveAccessibleName('Bytt til lyst tema')
})

test('System follows OS; keyboard toggle and settings persist explicit precedence without domain writes', async ({ page }) => {
  await boot(page)
  await expect(page.locator('#theme-toggle')).toHaveAccessibleName('Bytt til mørkt tema')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.locator('#theme-toggle').focus(); await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('#theme-toggle')).toBeFocused()
  await page.emulateMedia({ colorScheme: 'light' }); await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await navigate(page, 'settings')
  await expect(page.getByRole('radio', { name: 'Lyst', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'Mørkt', exact: true }).check()
  expect(await saved(page)).toEqual(themeFixture())
  expect(await writes(page)).toEqual([])
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await navigate(page, 'settings')
  await page.getByRole('radio', { name: 'System', exact: true }).check()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await saved(page)).toEqual(themeFixture())
  expect(await writes(page)).toEqual([])
})

test('real OS changes retain modal draft, focus, open disclosure, scroll and calendar state', async ({ page }) => {
  await boot(page, { width: 390, fontSize: 32 })
  await navigate(page, 'all'); await page.locator('#new-task').click()
  await page.locator('#title').fill('Syntetisk tema-utkast med æ, ø og å')
  await openTaskDetails(page)
  const dialog = page.locator('dialog[open]'), form = page.locator('#task-form')
  await page.locator('#deadlineTime').focus()
  const before = await dialog.evaluate(node => ({ scroll: node.scrollTop, active: document.activeElement.id, details: [...node.querySelectorAll('details')].map(d => d.open), values: [...node.querySelectorAll('input, select, textarea')].map(n => [n.id, n.value, n.checked]) }))
  const original = await form.elementHandle()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await original.evaluate(node => node.isConnected)).toBe(true)
  expect(await dialog.evaluate(node => ({ scroll: node.scrollTop, active: document.activeElement.id, details: [...node.querySelectorAll('details')].map(d => d.open), values: [...node.querySelectorAll('input, select, textarea')].map(n => [n.id, n.value, n.checked]) }))).toEqual(before)
  expect(await writes(page)).toEqual([])
  await page.keyboard.press('Escape')
  await navigate(page, 'calendar')
  await page.locator('[data-calendar-view="week"]').click()
  await page.locator('#full-calendar-date').fill('2026-10-27')
  const filters = page.locator('.full-calendar-filters'); await filters.locator('summary').click()
  await page.locator('#full-calendar-course').selectOption('theme-course-01')
  const viewport = page.locator('.full-calendar-viewport')
  await viewport.evaluate(node => { node.scrollTop = 420; node.scrollLeft = 120; node.focus() })
  await page.clock.runFor(300)
  // Advancing the fake clock does not flush native scroll events. Wait for the
  // actual scroll save before taking the baseline for the theme-only change.
  await expect.poll(async () => (await saved(page)).calendarPreferences?.scroll?.['week:2026-10-27'])
    .toEqual({ top: 420, left: 120 })
  const calendarBefore = await saved(page), writesBefore = await writes(page)
  const scroll = await viewport.evaluate(node => ({ top: node.scrollTop, left: node.scrollLeft, page: scrollY }))
  const current = await viewport.elementHandle()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await current.evaluate(node => node.isConnected)).toBe(true)
  await expect(viewport).toBeFocused(); await expect(filters).toHaveJSProperty('open', true)
  await expect(page.locator('#full-calendar-date')).toHaveValue('2026-10-27')
  await expect(page.locator('#full-calendar-course')).toHaveValue('theme-course-01')
  expect(await viewport.evaluate(node => ({ top: node.scrollTop, left: node.scrollLeft, page: scrollY })) ).toEqual(scroll)
  expect(await saved(page)).toEqual(calendarBefore); expect(await writes(page)).toEqual(writesBefore)
})

for (const theme of ['light', 'dark']) for (const [width, fontSize] of [[1440, 16], [900, 16], [390, 16], [390, 32]]) {
  test(`${theme} coherent routes, twelve course identities and readable controls at ${width}px / ${fontSize}px text`, async ({ page }, info) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await boot(page, { theme, width, fontSize })
    const originalAssignments = await assignments(page)
    expect(new Set(Object.values(originalAssignments)).size).toBe(12)
    await fits(page); await capture(page, info, `${theme}-overview-${width}-${fontSize}`)
    for (const view of ['calendar', 'all', 'subjects']) {
      await navigate(page, view); await fits(page)
      await capture(page, info, `${theme}-${view}-${width}-${fontSize}`)
    }
    const contrast = await renderedCourseContrast(page)
    expect(contrast).toHaveLength(12)
    expect(new Set(contrast.map(row => row.marker)).size).toBe(12)
    for (const row of contrast) {
      expect(row.courseText, `${theme} course ${row.slot} text`).toBeGreaterThanOrEqual(4.5)
      expect(row.markerRatio, `${theme} course ${row.slot} marker`).toBeGreaterThanOrEqual(3)
      expect(row.titleRatio, `${theme} course ${row.slot} heading`).toBeGreaterThanOrEqual(4.5)
    }
    await page.locator('#course-new').click()
    await page.locator('#subject-editor [name="name"]').fill('Syntetisk emneutkast')
    await capture(page, info, `${theme}-dialog-${width}-${fontSize}`)
    await page.keyboard.press('Escape')
    await page.locator('#theme-toggle').focus()
    const focus = await page.locator('#theme-toggle').evaluate(node => ({ width: parseFloat(getComputedStyle(node).outlineWidth), style: getComputedStyle(node).outlineStyle }))
    expect(focus.style).toBe('solid'); expect(focus.width).toBeGreaterThanOrEqual(2)
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark')
    await expect(page.locator('#theme-toggle')).toBeFocused()
    expect(await assignments(page)).toEqual(originalAssignments)
    expect(errors).toEqual([])
  })
}

for (const theme of ['light', 'dark']) test(`${theme} keeps identity and activity semantics across every calendar mode`, async ({ page }, info) => {
  await boot(page, { theme })
  await navigate(page, 'calendar')
  await page.locator('.full-calendar-filters > summary').click()
  await page.getByLabel('Vis avlysninger', { exact: true }).check()
  await page.getByLabel('Vis ferdige frister', { exact: true }).check()
  const colors = await assignments(page)
  for (const mode of ['day', 'week', 'month', 'agenda']) {
    await page.locator(`[data-calendar-view="${mode}"]`).click()
    await fits(page)
    const painted = await page.locator('#full-calendar [data-course-color-id]').evaluateAll(nodes => nodes.map(n => [n.dataset.courseColorId, Number(n.dataset.courseSlot)]))
    expect(painted.length).toBeGreaterThan(0)
    for (const [id, slot] of painted) expect(slot).toBe(colors[id])
    if (mode === 'day') {
      const sessionMarker = page.locator('.calendar-duration-marker.entry-session')
      await expect(sessionMarker).toHaveCount(1)
      expect(await sessionMarker.evaluate(node => {
        const sample = document.createElement('span'); sample.style.color = 'var(--course-color)'; node.append(sample)
        const matches = getComputedStyle(node).backgroundColor === getComputedStyle(sample).color; sample.remove(); return matches
      })).toBe(true)
    }
    await capture(page, info, `${theme}-calendar-${mode}`)
  }
  const event = page.locator('#full-calendar .calendar-entry[data-course-color-id="theme-course-01"]').first()
  for (const ratio of await eventTextContrast(event)) expect(ratio).toBeGreaterThanOrEqual(4.5)
  await event.hover()
  for (const ratio of await eventTextContrast(event)) expect(ratio).toBeGreaterThanOrEqual(4.5)
  await event.focus()
  for (const ratio of await eventTextContrast(event)) expect(ratio).toBeGreaterThanOrEqual(4.5)
  await expect(page.locator('#full-calendar .is-exam').first()).toContainText('Eksamen')
  await expect(page.locator('#full-calendar .is-cancelled').first()).toContainText('Avlyst')
  await expect(page.locator('#full-calendar .entry-deadline').first()).toContainText('Frist')
  await expect(page.locator('#full-calendar .entry-session').first()).toContainText('Studieøkt')
  await expect(page.locator('#full-calendar .is-unassigned[data-course-slot="neutral"]').first()).toBeVisible()
  await expect(page.locator('#full-calendar [data-calendar-key="task:theme-task-9"]').first()).toContainText('Klar til levering')
  await expect(page.locator('#full-calendar [data-calendar-key="task:theme-task-10"]').first()).toContainText('Levert')
  await expect(page.locator('#full-calendar [data-calendar-key="task:theme-task-12"]').first()).toContainText('Fullført')
})

test('corrupt or denied appearance preferences leave app and theme controls usable', async ({ page }) => {
  await page.addInitScript(({ appearanceKey, colorsKey }) => {
    localStorage.setItem(appearanceKey, '{invalid')
    localStorage.setItem(colorsKey, '{invalid')
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    Storage.prototype.getItem = function (key) { if (key === appearanceKey || key === colorsKey) throw Error('Synthetic denied preference read'); return get.call(this, key) }
    Storage.prototype.setItem = function (key, value) { if (key === appearanceKey || key === colorsKey) throw Error('Synthetic denied preference write'); return set.call(this, key, value) }
  }, { appearanceKey: preferenceKey, colorsKey: colorKey })
  await boot(page, { theme: 'dark' })
  await page.locator('#theme-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await navigate(page, 'subjects')
  expect(new Set(await page.locator('.course-card').evaluateAll(cards => cards.map(card => card.dataset.courseSlot))).size).toBe(12)
  expect(await saved(page)).toEqual(themeFixture())
})

for (const theme of ['light', 'dark']) test(`${theme} review regression paints expected course identities on cards, filters, editors and imports`, async ({ page }) => {
  const fixture = themeFixture()
  await boot(page, { theme, state: fixture })
  const colors = await assignments(page)
  await expectCourseMarker(page.locator('#dashboard-suggestions [data-task-id="theme-task-1"] .course-tag'), fixture.tasks[0].courseId, colors, { pseudo: '::before', fill: true })
  await navigate(page, 'all')
  for (const task of fixture.tasks) await expectCourseMarker(page.locator(`#task-list [data-task-id="${task.id}"] .course-tag`), task.courseId, colors, { pseudo: '::before', fill: true })
  const exam = page.locator('#compact-agenda [data-agenda-key="event:theme-event-11-3"]')
  await expect(exam).toContainText('Eksamen')
  await expectCourseMarker(exam.locator('..'), 'theme-course-11', colors)
  const compactFilter = page.locator('#calendar-course-filter')
  await compactFilter.selectOption('theme-course-02')
  await expectCourseMarker(compactFilter, 'theme-course-02', colors)
  await compactFilter.selectOption('')
  await expectCourseMarker(compactFilter, null, colors)

  await navigate(page, 'calendar')
  await page.locator('[data-calendar-view="agenda"]').click()
  await page.locator('.full-calendar-filters > summary').click()
  await page.getByLabel('Vis avlysninger', { exact: true }).check()
  await page.getByLabel('Vis ferdige frister', { exact: true }).check()
  for (const event of fixture.planner.events.filter(event => event.id.endsWith('-3') || event.id === 'theme-personal')) {
    await expectCourseMarker(page.locator(`#full-calendar [data-calendar-key="event:${event.id}"]`).first(), event.courseId, colors)
  }
  for (const task of fixture.tasks.filter(task => task.deadlineLocal)) await expectCourseMarker(page.locator(`#full-calendar [data-calendar-key="task:${task.id}"]`).first(), task.courseId, colors)
  await expectCourseMarker(page.locator('#full-calendar [data-calendar-key="session:theme-session"]').first(), fixture.tasks[0].courseId, colors)
  await page.locator('#full-calendar-course').selectOption('theme-course-02')
  await expectCourseMarker(page.locator('#full-calendar-course'), 'theme-course-02', colors)

  await navigate(page, 'subjects')
  const course = fixture.planner.courses[1]
  await page.locator(`[data-course-id="${course.id}"]`).getByRole('button', { name: `Rediger emne ${course.code}`, exact: true }).click()
  await expectCourseMarker(page.locator('dialog[open]').filter({ has: page.locator('#subject-editor') }), course.id, colors, { minWidth: 1 })
  await page.keyboard.press('Escape')
  await page.locator('[data-event-id="theme-event-2-3"]').getByRole('button', { name: /Rediger undervisning/ }).click()
  const editorDialog = page.locator('dialog[open]').filter({ has: page.locator('#subject-editor') })
  await expectCourseMarker(editorDialog, course.id, colors, { minWidth: 1 })
  await page.locator('#subject-editor [name="courseId"]').selectOption('theme-course-01')
  await expectCourseMarker(editorDialog, 'theme-course-01', colors, { minWidth: 1 })
  await page.keyboard.press('Escape')

  const beforeImports = await saved(page), priorWrites = await writes(page)
  const csv = tpCsvRows([{ ...fixtureRows()[0], id: 'synthetic-theme-marker-row', eventid: 'synthetic-theme-marker-event' }])
  await openTpImport(page, { text: csv, name: 'synthetic-theme-markers.csv' })
  const courseRow = courseRows(page).first()
  await openPreviewRow(courseRow)
  await courseRow.locator('[data-field="courseTarget"]').selectOption('theme-course-03')
  await openPreviewRow(courseRows(page).first())
  await expectCourseMarker(courseRows(page).first(), 'theme-course-03', colors, { shadow: true })
  const eventRow = eventRows(page).first(); await openPreviewRow(eventRow)
  await expectCourseMarker(eventRow, 'theme-course-03', colors, { shadow: true })
  await eventRow.locator('[data-field="startLocal"]').fill('')
  await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
  await expect(eventRows(page).first().locator('[data-field="startLocal"]')).toHaveAttribute('aria-invalid', 'true')
  await expectCourseMarker(eventRows(page).first(), 'theme-course-03', colors, { shadow: true })
  expect(await eventRows(page).first().evaluate(node => getComputedStyle(node).borderTopColor)).toBe(await page.evaluate(() => {
    const sample = document.createElement('span'); sample.style.color = 'var(--danger)'; document.body.append(sample)
    const color = getComputedStyle(sample).color; sample.remove(); return color
  }))
  expect(await saved(page)).toEqual(beforeImports); expect(await writes(page)).toEqual(priorWrites)
  const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-theme-preview\r\nSUMMARY:Syntetisk kontroll\r\nDTSTART:20261026T090000Z\r\nDTEND:20261026T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR'
  await page.route('**/api/import/calendar', route => route.fulfill({ json: { calendar, calendarUrl: 'https://synthetic.example.test/theme.ics' } }))
  await openImportMethod(page, 'calendar')
  await (await reveal(page.locator('#calendar-link-import-mode'))).selectOption('subscription')
  await page.locator('#calendar-import-form [name="courseId"]').selectOption('theme-course-04')
  await page.locator('#calendar-import-form [name="url"]').fill('https://synthetic.example.test/theme.ics')
  await page.locator('#calendar-import-form button[type="submit"]').click()
  await expectCourseMarker(page.locator('#import-preview'), 'theme-course-04', colors, { shadow: true })
  expect(await saved(page)).toEqual(beforeImports); expect(await writes(page)).toEqual(priorWrites)
})

for (const theme of ['light', 'dark']) test(`${theme} review regression distinguishes same-code short activities and preserves chooser focus`, async ({ page }) => {
  const fixture = themeFixture()
  fixture.planner.events.push(...[0, 1].map(index => ({
    id: `theme-short-${index}`, title: 'Syntetisk kort aktivitet', courseId: fixture.planner.courses[index].id,
    start: '2026-10-26T09:00:00Z', end: '2026-10-26T09:10:00Z', location: '', notes: '', ...(index === 0 ? { activityKind: 'exam', cancelled: true } : {}),
  })))
  await boot(page, { theme, state: fixture })
  const colors = await assignments(page)
  await navigate(page, 'calendar')
  await page.locator('[data-calendar-view="day"]').click()
  await page.locator('.full-calendar-filters > summary').click()
  await page.getByLabel('Vis avlysninger', { exact: true }).check()
  const trigger = page.locator('[data-calendar-short~="event:theme-short-0"]')
  const before = await saved(page)
  await trigger.click()
  const chooser = page.getByRole('dialog', { name: 'Korte aktiviteter', exact: true })
  for (const index of [0, 1]) {
    const control = chooser.locator(`[data-calendar-key="event:theme-short-${index}"]`)
    await expect(control).toContainText(fixture.planner.courses[index].name)
    await expect(control).toContainText('SYN101')
    await expect(control).toContainText(index === 0 ? 'Eksamen' : 'Undervisning')
    await expectCourseMarker(control, fixture.planner.courses[index].id, colors)
  }
  await expect(chooser.locator('[data-calendar-key="event:theme-short-0"]')).toContainText('Avlyst')
  await chooser.locator('[data-calendar-key="event:theme-short-1"]').click()
  const details = page.locator('.calendar-details[open]')
  await expect(details).toContainText(fixture.planner.courses[1].name)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect((await saved(page)).planner).toEqual(before.planner)
})

test('actual UI lifecycle keeps course identities through rename, filtering, thirteenth addition, undo and unchanged reimport', async ({ page }) => {
  const fixture = themeFixture(), thirteenth = themeFixture(13).planner.courses[12]
  await boot(page, { state: fixture })
  const original = await assignments(page), originalIds = fixture.planner.courses.map(course => course.id)
  const unchanged = async () => { const current = await assignments(page); for (const id of originalIds) expect(current[id], id).toBe(original[id]) }
  await navigate(page, 'subjects')
  const beforeOrder = await page.locator('#course-list > [data-course-id]').evaluateAll(nodes => nodes.map(node => node.dataset.courseId))
  const first = page.locator('[data-course-id="theme-course-01"]')
  await first.getByRole('button', { name: 'Rediger emne SYN101', exact: true }).click()
  await page.locator('#subject-editor [name="name"]').fill('Å syntetisk navneendring sist i listen')
  await page.locator('#subject-editor').getByRole('button', { name: 'Lagre emne', exact: true }).click()
  const afterOrder = await page.locator('#course-list > [data-course-id]').evaluateAll(nodes => nodes.map(node => node.dataset.courseId))
  expect(afterOrder).not.toEqual(beforeOrder); expect([...afterOrder].sort()).toEqual([...originalIds].sort()); await unchanged()
  await navigate(page, 'calendar'); await page.locator('.full-calendar-filters > summary').click()
  await page.locator('#full-calendar-course').selectOption('theme-course-02'); await unchanged()
  await navigate(page, 'subjects'); await page.locator('#course-new').click()
  for (const name of ['name', 'code', 'university']) await page.locator(`#subject-editor [name="${name}"]`).fill(thirteenth[name])
  await page.locator('#subject-editor').getByRole('button', { name: 'Lagre emne', exact: true }).click()
  const added = await saved(page)
  expect(added.planner.courses).toHaveLength(13); await unchanged()
  const addedCourse = added.planner.courses.find(course => !originalIds.includes(course.id))
  expect(addedCourse).toMatchObject({ name: thirteenth.name, code: thirteenth.code })
  const thirteenColors = await assignments(page)
  expect(new Set(added.planner.courses.map(course => thirteenColors[course.id])).size).toBe(12)
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-course-id="theme-course-01"]').getByRole('button', { name: 'Slett emne SYN101', exact: true }).click()
  expect((await saved(page)).planner.courses).toHaveLength(12)
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const restored = await saved(page)
  expect(restored.planner).toEqual(added.planner); expect(restored.tasks).toEqual(added.tasks)
  expect(await assignments(page)).toEqual(thirteenColors)
  await page.reload(); expect((await saved(page)).planner).toEqual(restored.planner); await unchanged()

  const csv = tpCsvRows([{ ...fixtureRows()[0], id: 'synthetic-theme-repeat-row', eventid: 'synthetic-theme-repeat-event' }])
  await openTpImport(page, { text: csv, name: 'synthetic-theme-repeat.csv' })
  await openPreviewRow(courseRows(page).first())
  await courseRows(page).first().locator('[data-field="courseTarget"]').selectOption('theme-course-03')
  await confirmTpImport(page)
  const imported = await saved(page), importedColors = await assignments(page)
  expect(imported.planner.courses.map(course => course.id)).toEqual(restored.planner.courses.map(course => course.id))
  expect(imported.planner.events).toHaveLength(restored.planner.events.length + 1); await unchanged()
  const source = imported.importSources.find(source => source.name === 'synthetic-theme-repeat.csv')
  await page.reload()
  await openTpImport(page, { text: csv, name: 'synthetic-theme-repeat.csv', sourceId: source.id })
  await confirmTpImport(page)
  const repeated = await saved(page)
  expect(repeated.planner).toEqual(imported.planner)
  expect(repeated.tasks).toEqual(imported.tasks)
  expect(repeated.importSources[0].entries).toEqual(source.entries)
  expect(await assignments(page)).toEqual(importedColors)
})
