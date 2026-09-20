import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { key, freeze, navigate, saved, deleteTask, openCourseImport } from './helpers.js'
import { providerRequest } from '../../server/providers/index.js'
import { exportBackup } from '../../src/backup.js'

const course = { id: 'c', code: 'INF100', name: 'Programmering', university: 'UiB', semester: 'autumn', year: 2026, credits: 10, notes: '' }
const task = id => ({ id, title: 'Samme tittel', course: 'INF100', courseId: 'c', deadlineLocal: '2026-09-08T14:00', estimatedMinutes: 90, remainingMinutes: 37, completed: false, requiresSubmission: true, submitted: false })
const state = () => ({ schemaVersion: 1, tasks: [task('a'), task('b')], sessions: [{ id: 's', taskId: 'a', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }], planner: { courses: [course], sources: [], events: [{ id: 'short', title: 'Fem minutter med lesbar tittel', courseId: 'c', start: '2026-09-08T08:00:00Z', end: '2026-09-08T08:05:00Z', location: 'Rom 101' }, { id: 'long', title: 'Overlappende forelesning', courseId: 'c', start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:30:00Z', location: 'Rom 102' }] } })
async function boot(page, data = state()) {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await freeze(page, '2026-09-08T09:00:00+02:00'); await page.goto('/')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key, data }); await page.reload()
  return errors
}
async function calendar(page, mode = 'week') {
  await navigate(page, 'calendar'); await page.locator(`[data-calendar-view="${mode}"]`).click(); await page.locator('#full-calendar-date').fill('2026-09-08')
}
const fixtures = Object.fromEntries(['uib-search', 'uib-course', 'uit-search', 'uit-course'].map(name => [name, readFileSync(new URL(`../fixtures/public-courses/${name}.html`, import.meta.url), 'utf8')]))
async function mockProvider(page, institution) {
  await page.route(`**/api/import/providers/${institution}/**`, async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1)
    const result = await providerRequest(institution, action, Object.fromEntries(url.searchParams), { fetchText: async (url, _redirects, validate) => { validate?.(new URL(url)); return fixtures[`${institution}-${action === 'search' ? 'search' : 'course'}`] } })
    await route.fulfill({ json: result })
  })
}
async function previewCourse(page, institution, code) {
  await navigate(page, 'subjects')
  await openCourseImport(page)
  const form = page.locator('#course-import-form')
  await form.locator('[name=university]').selectOption(institution)
  await page.getByRole('button', { name: 'Neste: søk og semester' }).click()
  await form.locator('[name=code]').fill(code); await form.locator('[name=year]').fill('2026'); await form.locator('[name=semester]').selectOption('autumn')
  const searched = page.waitForResponse(response => response.url().includes(`/api/import/providers/${institution}/search?`))
  await form.getByRole('button', { name: 'Søk emner' }).click()
  const result = await (await searched).json(); expect(result.status, result.error || 'Public course search').toBe('ok')
  await page.locator('.wizard-results').getByRole('button', { name: new RegExp(`^${code} ·`) }).click()
  await expect(page.locator('#import-preview')).toBeVisible()
}

for (const [width, height] of [[1440, 900], [1280, 800]]) test(`five and seven complete columns, range and persisted workweek at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); const errors = await boot(page); await calendar(page)
  for (const [mode, count] of [['full', 7], ['workweek', 5]]) {
    await page.locator('#calendar-week-mode').selectOption(mode)
    await expect(page.locator('.calendar-time-day')).toHaveCount(count)
    const bounds = await page.locator('.full-calendar-viewport').evaluate(viewport => ({ width: viewport.clientWidth, scroll: viewport.scrollWidth, right: viewport.getBoundingClientRect().right, last: viewport.querySelector('.calendar-time-day:last-child').getBoundingClientRect().right }))
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1); expect(bounds.last).toBeLessThanOrEqual(bounds.right)
  }
  await page.screenshot({ path: `artifacts/targeted-calendar-${width}.png` })
  await page.locator('#full-calendar-date').fill('2027-01-01')
  await expect(page.locator('#full-calendar-heading')).toHaveText('Uke · 28. desember 2026 – 1. januar 2027')
  await page.getByRole('button', { name: 'Neste periode' }).click()
  await expect(page.locator('#full-calendar-date')).toHaveValue('2027-01-08')
  await page.locator('.full-calendar-viewport').evaluate(node => { node.scrollTop = 550; node.dispatchEvent(new Event('scroll')) })
  await navigate(page, 'overview'); await navigate(page, 'calendar')
  expect(await page.locator('.full-calendar-viewport').evaluate(node => node.scrollTop)).toBe(550)
  await page.reload(); await navigate(page, 'calendar')
  await expect(page.locator('#calendar-week-mode')).toHaveValue('workweek'); await expect(page.locator('#full-calendar-date')).toHaveValue('2027-01-08')
  expect((await saved(page)).calendarPreferences.scroll['week:2027-01-08:workweek'].top).toBe(550)
  expect(errors).toEqual([])
})

test('short blocks retain duration with a visible readable target, full details and aligned resize bands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await boot(page); await calendar(page)
  const marker = page.locator('[data-calendar-geometry="event:short"]'), control = page.locator('.calendar-point-extras [data-calendar-key="event:short"]')
  expect(await marker.evaluate(node => node.getBoundingClientRect().height)).toBe(5)
  await expect(control).toBeVisible(); expect(await control.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  expect(await control.locator('.entry-time').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14)
  await control.click(); const dialog = page.locator('.calendar-details')
  await expect(dialog).toContainText('Faktisk varighet: 5 minutter.'); await expect(dialog).toContainText('Rom 101'); await expect(dialog).toContainText('Fem minutter med lesbar tittel')
  await page.keyboard.press('Escape'); await expect(control).toBeFocused()
  await page.setViewportSize({ width: 1280, height: 800 }); await page.addStyleTag({ content: 'html { font-size: 20px; }' }); await page.clock.runFor(100)
  const tops = await page.locator('.calendar-time-day > .calendar-timeline').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
  await page.clock.runFor(300)
  await expect(page.locator('.calendar-details')).toHaveCSS('display', 'none')
  await expect(page.locator('.calendar-details')).toHaveCSS('overlay', 'none')
  await page.screenshot({ path: 'artifacts/targeted-calendar-large-text.png', animations: 'allow' })
})

test('mobile day, agenda, settings and enlarged text remain reachable with keyboard and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await boot(page)
  await navigate(page, 'calendar', { keyboard: true }); await expect(page.locator('.full-calendar-viewport')).toHaveAttribute('data-mode', 'day')
  await page.locator('[data-calendar-view=agenda]').click(); await expect(page.locator('.calendar-full-agenda')).toBeVisible()
  await page.screenshot({ path: 'artifacts/targeted-calendar-390.png' })
  await page.addStyleTag({ content: 'html { font-size: 24px; }' }); await page.clock.runFor(100)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'artifacts/targeted-calendar-390-large-text.png' })
  await navigate(page, 'settings', { keyboard: true }); await expect(page.locator('#settings-panel')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importer sikkerhetskopi' })).toBeVisible()
  await page.screenshot({ path: 'artifacts/targeted-settings-390.png' })
})

test('one task row combines session and deadline, equal titles stay distinct and focus uses IDs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const data = state(); data.planner.events = []; await boot(page, data)
  const rows = page.locator('#daily-overview [data-daily-row^="task:"]')
  await expect(rows).toHaveCount(2)
  const first = page.locator('[data-daily-row="task:a"]'), second = page.locator('[data-daily-row="task:b"]')
  await expect(first).toContainText('10:00'); await expect(first).toContainText('Frist i dag kl. 14:00')
  await expect(first.locator('.daily-task-actions > button')).toHaveCount(1)
  const summary = second.locator('summary'); await summary.focus(); await summary.press('Enter')
  const edit = second.getByRole('button', { name: 'Åpne oppgave og frist' }); await edit.focus()
  await page.clock.setFixedTime(new Date('2026-09-08T10:01:00+02:00')); await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(edit).toBeFocused(); await expect(first).toContainText('Pågår nå')
  await page.screenshot({ path: 'artifacts/targeted-daily-1440.png' })
})

test('contextual undo restores exact values and persistent trash restores session links', async ({ page }) => {
  const original = state(); original.tasks = [task('a')]; await boot(page, original)
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('Bekreft frigjøring'); await dialog.accept() })
  await page.locator('[data-daily-row="task:a"]').getByRole('button', { name: 'Marker arbeid ferdig' }).click()
  await expect(page.locator('.contextual-undo')).toBeVisible(); await page.locator('.contextual-undo').getByRole('button', { name: 'Angre siste endring' }).click()
  expect((await saved(page)).tasks).toEqual(original.tasks)
  expect((await saved(page)).sessions).toEqual(original.sessions)
  await navigate(page, 'all'); await deleteTask(page, 'Samme tittel'); await page.reload(); await navigate(page, 'settings')
  await page.getByRole('button', { name: /^Papirkurv/ }).click(); await page.locator('.data-dialog').getByRole('button', { name: 'Gjenopprett', exact: true }).click()
  expect((await saved(page)).tasks).toEqual(original.tasks); expect((await saved(page)).sessions).toEqual(original.sessions)
})

test('recovery remains available with corrupt storage and backup retains workweek preferences', async ({ page }) => {
  const original = state(); original.calendarPreferences = { version: 1, view: 'week', weekMode: 'workweek', date: '2026-09-08', courseId: 'c', kinds: ['deadline'], completed: false, cancelled: false, scroll: { 'week:2026-09-08:workweek': { top: 500, left: 0 } } }
  await boot(page, original)
  await page.evaluate(key => localStorage.setItem(key, '{corrupt'), key); await page.reload()
  await expect(page.locator('#workspace')).toBeHidden(); await expect(page.getByRole('button', { name: 'Importer sikkerhetskopi' })).toBeVisible()
  await page.locator('#backup-file').setInputFiles({ name: 'isolated-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exportBackup(original))) })
  await page.getByRole('button', { name: 'Erstatt lokale data' }).click()
  expect((await saved(page)).calendarPreferences).toEqual(original.calendarPreferences)
  await navigate(page, 'calendar'); await expect(page.locator('.calendar-time-day')).toHaveCount(5)
})

for (const [institution, code, record] of [['uib', 'INF100', 'inf100'], ['uit', 'FYS-3000', '923370']]) {
  for (const live of [false, true]) test(`${live ? 'live public' : 'fixture'} ${institution}: search, preview, save, reload and repeat without losing notes or task IDs`, async ({ page }, testInfo) => {
    test.skip(live && process.env.RUN_LIVE_PUBLIC !== '1', 'Explicit bounded public-source acceptance run')
    test.setTimeout(120000)
    const errors = await boot(page, { schemaVersion: 1, tasks: [] })
    if (!live) await mockProvider(page, institution)
    await previewCourse(page, institution, code)
    await expect(page.locator('#import-preview')).toContainText(`Emnepost: ${record}`)
    await expect(page.getByRole('button', { name: 'Hent undervisning fra TP' })).toHaveCount(0)
    await expect(page.locator('#import-preview').getByRole('link', { name: 'Åpne offisiell timeplan' })).toBeVisible()
    if (live) await page.screenshot({ path: `artifacts/targeted-live-${institution}-preview.png` })
    await page.getByRole('button', { name: 'Importer bare emnet' }).click()
    const first = await saved(page), id = first.planner.courses[0].id
    await page.getByRole('button', { name: `Rediger emne ${code}`, exact: true }).click()
    await page.locator('#subject-editor [name=notes]').fill('Isolert lokalt notat'); await page.locator('#subject-editor').getByRole('button', { name: 'Lagre emne', exact: true }).click()
    const linked = { ...task('linked'), courseId: id, course: code }
    await page.evaluate(({ key, linked }) => { const data = JSON.parse(localStorage.getItem(key)); data.tasks = [linked]; localStorage.setItem(key, JSON.stringify(data)) }, { key, linked })
    await page.reload(); await previewCourse(page, institution, code); await page.getByRole('button', { name: 'Importer bare emnet' }).click(); await page.reload()
    const repeated = await saved(page)
    expect(repeated.planner.courses).toHaveLength(1); expect(repeated.planner.courses[0]).toMatchObject({ id, notes: 'Isolert lokalt notat', sourceRecordId: record, sourceVersion: '2026H', credits: 10 })
    expect(repeated.tasks).toEqual([linked]); expect(repeated.planner.events).toEqual([]); expect(repeated.planner.sources).toEqual([])
    if (live) {
      const response = await page.request.get(`/api/import/providers/${institution}/search?${new URLSearchParams({ q: institution === 'uib' ? 'Programmering' : 'satellite', semester: 'autumn', year: '2026' })}`)
      const result = await response.json(); expect(result.status).toBe('ok')
      await testInfo.attach(`${institution}-acceptance`, { contentType: 'application/json', body: Buffer.from(JSON.stringify({ institution, code, record, id, sourceUrl: repeated.planner.courses[0].sourceUrl, campus: repeated.planner.courses[0].campus, phases: ['search', 'preview', 'save', 'reload', 'repeat', 'name-search'], nameResults: result.results.length, automaticTeaching: false })) })
    }
    expect(errors).toEqual([])
  })
}
