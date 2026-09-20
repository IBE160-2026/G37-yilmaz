import { navigate } from './helpers.js'
import { openMenu, tabTo } from './helpers.js'
import { test, expect } from '@playwright/test'
import { task, seed, rows, row, checkbox, edit, save, saved, writes, ids, filter, deleteTask, fillDraft, expectFocusFits } from './helpers.js'

test('100 synthetic tasks remain operable across views and mutations without executing HTML or transmitting task data', async ({ page }, testInfo) => {
  const requests = []
  const frames = []
  const pageErrors = []
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() || '' }))
  page.on('websocket', socket => {
    requests.push({ url: socket.url(), method: 'WEBSOCKET', body: '' })
    socket.on('framesent', event => frames.push(String(event.payload)))
  })
  page.on('pageerror', error => pageErrors.push(error.message))
  const dates = ['2026-08-24T12:00', '2026-08-31T12:00', '2026-09-07T12:00', '2026-09-14T12:00']
  const tasks = Array.from({ length: 100 }, (_, i) => ({ ...task(`synthetic-${i}`, dates[i % 4], (i % 4 + 1) * 10, i % 10 === 0), splittable: false }))
  await seed(page, tasks)
  const ordered = list => [...list].sort((a, b) => a.deadlineLocal.localeCompare(b.deadlineLocal))
  expect(await ids(page)).toEqual(tasks.filter((_, i) => i % 4 === 1).map(item => item.id))
  await navigate(page, 'all')
  await expect(rows(page)).toHaveCount(100)
  expect(await ids(page)).toEqual(ordered(tasks).map(item => item.id))
  await filter(page)
  let source = [...tasks]
  const eligible = () => ordered(source.filter(item => !item.completed && (item.remainingMinutes ?? item.estimatedMinutes) <= 30)).map(item => item.id)
  expect(await ids(page)).toEqual(eligible())
  const changed = tasks[1]
  await openMenu(page, changed.title)
  await edit(page, changed.title).click()
  await page.locator('#remainingMinutes').fill('45')
  await save(page).click()
  source = source.map(item => item.id === changed.id ? { ...item, remainingMinutes: 45 } : item)
  expect(await ids(page)).toEqual(eligible())
  const finished = tasks[2]
  await openMenu(page, finished.title)
  await checkbox(page, finished.title).click()
  source = source.map(item => item.id === finished.id ? { ...item, completed: true, remainingMinutes: 0 } : item)
  expect(await ids(page)).toEqual(eligible())
  const removed = tasks[4]
  await deleteTask(page, removed.title)
  source = source.filter(item => item.id !== removed.id)
  expect(await ids(page)).toEqual(eligible())
  const literalTitle = '<img src="https://example.invalid/PRIVATE_TASK_7319" onerror="window.taskTextExecuted=true">'
  const course = 'PRIVATE_COURSE_7319'
  await page.locator('#new-task').click()
  await fillDraft(page, { title: literalTitle, course, deadlineLocal: '2026-09-03T11:00', estimatedMinutes: '15' })
  await save(page).click()
  const created = (await saved(page)).tasks.at(-1)
  source.push(created)
  expect(created).toMatchObject({ title: literalTitle, course, completed: false, estimatedMinutes: null, remainingMinutes: 15 })
  expect(await ids(page)).toEqual(eligible())
  await expect(row(page, literalTitle)).toContainText(literalTitle)
  await expect(page.locator('#task-list img, #task-list script')).toHaveCount(0)
  expect(await page.evaluate(() => window.taskTextExecuted)).toBeUndefined()
  expect((await saved(page)).tasks).toEqual(source)
  expect(await writes(page)).toHaveLength(4)
  await navigate(page, 'all')
  await expect(rows(page)).toHaveCount(100)
  await navigate(page, 'week')
  await page.clock.runFor(2000)
  await page.reload()
  await navigate(page, 'all')
  await expect(rows(page)).toHaveCount(100)
  expect((await saved(page)).tasks).toEqual(source)
  await expect(row(page, literalTitle)).toContainText(literalTitle)
  await page.waitForLoadState('networkidle')
  expect(requests.some(request => /\/(?:src\/main\.js|assets\/index-[^/]+\.js)(?:\?|$)/.test(request.url))).toBe(true)
  expect(requests.filter(request => {
    const url = new URL(request.url)
    return !['http:', 'ws:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== (process.env.PLAYWRIGHT_PORT || '5174')
  })).toEqual([])
  expect(requests.filter(request => /PRIVATE_TASK_7319|PRIVATE_COURSE_7319|synthetic-\d|deadlineLocal|estimatedMinutes/.test(decodeURIComponent(request.url) + request.body))).toEqual([])
  expect(requests.filter(request => request.method !== 'GET' && request.method !== 'WEBSOCKET')).toEqual([])
  expect(frames.filter(frame => /PRIVATE_TASK_7319|PRIVATE_COURSE_7319|synthetic-\d|deadlineLocal|estimatedMinutes/.test(frame))).toEqual([])
  expect(pageErrors).toEqual([])
})

for (const width of [360, 1280]) {
  test(`week/all/time, completion/undo, filter errors and empty routes work with visible keyboard focus at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const selected = { ...task('keyboard', '2026-09-03T12:00', 30), title: 'LangOppgave'.repeat(16), course: 'LangtEmnenavn'.repeat(12) }
    await seed(page, [selected, { ...task('too-long-for-session', '2026-09-03T16:00', 240), splittable: false }])
    await page.screenshot({ path: testInfo.outputPath(`week-view-${width}.png`), fullPage: true })
    for (const view of ['all', 'week', 'time']) {
      await navigate(page, view, { keyboard: true })
      await expect(page.locator(`#view-${view}`)).toHaveAttribute('aria-pressed', 'true')
    }
    await tabTo(page, page.locator('#available-minutes'))
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('30')
    await tabTo(page, page.locator('#time-form button[type=submit]'))
    await page.keyboard.press('Enter')
    await expect(rows(page)).toHaveCount(1)
    await tabTo(page, row(page, selected.title).locator('.task-menu > summary'))
    if (!await row(page, selected.title).locator('.task-menu').evaluate(element => element.open)) await page.keyboard.press('Enter')
    await tabTo(page, checkbox(page, selected.title))
    await page.clock.runFor(2000)
    await expectFocusFits(page, checkbox(page, selected.title))
    await page.screenshot({ path: testInfo.outputPath(`time-filter-${width}.png`), fullPage: true })
    await page.keyboard.press('Space')
    await expectFocusFits(page, page.locator('#available-minutes'))
    await expect(page.locator('#empty-tasks')).toContainText('Ingen oppgaver passer tiden')
    await tabTo(page, page.locator('#empty-minutes'))
    await page.keyboard.press('Enter')
    await expectFocusFits(page, page.locator('#available-minutes'))
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('0')
    await page.keyboard.press('Enter')
    await expect(page.locator('#available-minutes')).toHaveAttribute('aria-invalid', 'true')
    await expectFocusFits(page, page.locator('#available-minutes'))
    await page.screenshot({ path: testInfo.outputPath(`time-filter-error-${width}.png`), fullPage: true })
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('30')
    await page.keyboard.press('Enter')
    await tabTo(page, page.locator('#empty-all'))
    await page.keyboard.press('Enter')
    await expectFocusFits(page, page.locator('#view-all'))
    await tabTo(page, row(page, selected.title).locator('.task-menu > summary'))
    if (!await row(page, selected.title).locator('.task-menu').evaluate(element => element.open)) await page.keyboard.press('Enter')
    await tabTo(page, checkbox(page, selected.title))
    await expect(checkbox(page, selected.title)).toBeChecked()
    await page.keyboard.press('Space')
    await expect(checkbox(page, selected.title)).not.toBeChecked()
    await expectFocusFits(page, checkbox(page, selected.title))
    await page.screenshot({ path: testInfo.outputPath(`completion-undo-${width}.png`), fullPage: true })
    expect(await writes(page)).toHaveLength(2)
  })
}
