import { test, expect } from '@playwright/test'
import { openTaskDetails } from './helpers.js'

const key = 'studieplanlegger:v1'
const courses = [
  { id: 'visual-course-1', code: 'TDT4110', name: 'Informasjonsteknologi, grunnkurs', university: 'NTNU', semester: 'autumn', year: 2026, credits: 7.5, notes: '' },
  { id: 'visual-course-2', code: 'EXPH0300', name: 'Examen philosophicum for naturvitenskap og teknologi', university: 'NTNU', semester: 'autumn', year: 2026, credits: 7.5, notes: '' },
]
const tasks = [
  { id: 'visual-best', title: 'Fullfør funksjoner og løkker', course: 'TDT4110', courseId: courses[0].id, deadlineLocal: '2026-09-09T14:00', estimatedMinutes: 90, remainingMinutes: 25, completed: false, priority: 3 },
  { id: 'visual-other', title: 'Les om argumentasjon og vitenskapelige forklaringer', course: 'EXPH0300', courseId: courses[1].id, deadlineLocal: '2026-09-11T12:00', estimatedMinutes: 45, completed: false },
  { id: 'visual-short', title: 'Forbered spørsmål til seminaret', course: 'EXPH0300', courseId: courses[1].id, deadlineLocal: '2026-09-12T09:00', estimatedMinutes: 15, completed: false },
]
const events = [
  { id: 'visual-teaching-1', title: 'Forelesning: problemløsing med Python', courseId: courses[0].id, start: '2026-09-08T10:15:00Z', end: '2026-09-08T12:00:00Z', location: 'Realfagbygget, R1', notes: '' },
  { id: 'visual-teaching-2', title: 'Seminar: kunnskap og vitenskap', courseId: courses[1].id, start: '2026-09-10T08:15:00Z', end: '2026-09-10T10:00:00Z', location: 'Dragvoll, D10', notes: '' },
]
const sessions = [{ id: 'visual-session', dateLocal: '2026-10-01', startTime: '10:00', endTime: '11:00' }]
const state = kind => ({ schemaVersion: 1, tasks: kind === 'populated' ? tasks : [], sessions: kind === 'empty' ? [] : sessions,
  planner: { courses: kind === 'empty' ? [] : courses, events: kind === 'empty' ? [] : events, sources: [] } })

async function seed(page, kind) {
  await page.clock.setFixedTime(new Date('2026-09-08T08:00:00Z'))
  await page.goto('/')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key, data: state(kind) })
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
}
async function navigate(page, view) {
  const button = page.locator('#view-' + view)
  if (!await button.isVisible()) await page.locator('#mobile-navigation-more').click()
  await button.click()
}

for (const width of [1440, 390]) {
  for (const kind of ['empty', 'partial', 'populated']) {
    test(`${kind} overview, real actions and screenshot at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
      const errors = []; page.on('pageerror', error => errors.push(error.message))
      await seed(page, kind)
      await expect(page.locator('#page-heading')).toHaveText('Oversikt')
      expect(await page.evaluate(() => [...document.fonts].some(font => font.family === 'Manrope' && font.status === 'loaded'))).toBe(true)
      expect(await page.locator('body').innerText()).not.toMatch(/Ã|Â|â€|â†/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      if (kind === 'empty') {
        await expect(page.locator('#connected-onboarding')).toBeVisible()
        await expect(page.locator('#focus-panel')).toBeHidden()
        await expect(page.locator('#overview-summary')).toBeHidden()
        await expect(page.locator('#calendar-panel')).toBeHidden()
        await expect(page.locator('#new-task')).toBeHidden()
      } else {
        await expect(page.locator('#compact-agenda')).toContainText('Realfagbygget, R1')
        await expect(page.locator('#compact-agenda')).toContainText('12:15–14:00')
        if (kind === 'partial') await expect(page.locator('#focus-panel')).toBeHidden()
        else {
          const primary = page.locator('#dashboard-suggestions .primary-suggestion')
          await expect(primary).toContainText(tasks[0].title)
          // The daily overview is now primary; quick suggestions remain below it.
          const actionBounds = await page.locator('#daily-overview button').first().boundingBox()
          expect(actionBounds.y + actionBounds.height).toBeLessThan(width === 1440 ? 900 : (await page.locator('.view-actions').boundingBox()).y)
          if (width === 1440) expect((await page.locator('#calendar-panel').boundingBox()).x).toBeGreaterThan((await primary.boundingBox()).x)
        }
      }
      await page.screenshot({ path: `artifacts/studieplan-${kind}-${width}.png`, animations: 'disabled' })
      if (width === 390) await page.screenshot({ path: `artifacts/studieplan-${kind}-${width}-full.png`, fullPage: true, animations: 'disabled' })
      const before = await page.evaluate(key => localStorage.getItem(key), key)
      if (kind === 'empty') {
        const firstTask = page.locator('#connected-onboarding').getByRole('button', { name: 'Legg til første oppgave', exact: true })
        await firstTask.click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await expect(page.locator('#title')).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(firstTask).toBeFocused()
        await navigate(page, 'capacity')
        await expect(page.locator('#capacity-panel')).toBeVisible()
        await page.locator('#new-session').click()
        await expect(page.locator('#session-dateLocal')).toBeFocused()
        await page.locator('#cancel-session').click()
        await navigate(page, 'subjects')
        await expect(page.locator('#empty-dashboard')).toBeHidden()
        await page.locator('#course-new').click()
        await expect(page.locator('#subject-editor [name=name]')).toBeFocused()
        await page.keyboard.press('Escape')
      } else if (kind === 'partial') {
        await page.locator('[data-agenda-key="event:visual-teaching-1"]').click()
        await expect(page.locator('#subject-editor [name=title]')).toHaveValue(events[0].title)
        await expect(page.locator('#subject-editor [name=startLocal]')).toHaveValue('2026-09-08T12:15')
        await page.keyboard.press('Escape')
        await navigate(page, 'overview')
        await page.locator('#calendar-course-filter').selectOption(courses[1].id)
        await expect(page.locator('#compact-agenda')).not.toContainText(events[0].title)
        await expect(page.locator('#compact-agenda')).toContainText(events[1].title)
      } else {
        for (const [minutes, count] of [[15, 3], [30, 3], [45, 3], [60, 3]]) {
          await page.locator('[data-minutes="' + minutes + '"]').click()
          await expect(page.locator('#available-minutes')).toHaveValue(String(minutes))
          await expect(page.locator('#filter-summary')).toHaveText(`${count} forslag innen ${minutes} minutter.`)
        }
        await page.locator('#available-minutes').fill('25')
        await page.locator('#time-form button[type=submit]').click()
        await page.locator('#dashboard-suggestions .primary-suggestion .task-primary').click()
        await expect(page.locator('#title')).toHaveValue(tasks[0].title)
        await page.keyboard.press('Escape')
        await page.getByRole('button', { name: 'Månedsvisning', exact: true }).click()
        await page.locator('[data-calendar-date="2026-09-08"]').click()
        await expect(page.locator('.calendar-teaching')).toContainText('12:15–14:00')
        await page.getByRole('button', { name: 'Agenda', exact: true }).click()
        await page.locator('.agenda-more').click()
        await expect(page.locator('#compact-agenda')).toContainText('Avsatt studietid')
      }
      if (kind === 'empty') {
        const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
        expect(stored.tasks).toEqual([])
        expect(stored.sessions).toEqual([])
        expect(stored.planner).toEqual(state(kind).planner)
        expect(stored.onboarding).toMatchObject({ dismissed: false })
      } else expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before)
      expect(errors).toEqual([])
    })
  }
}

test('larger text, reduced motion, keyboard focus and modal focus containment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page, 'populated')
  await page.addStyleTag({ content: 'html { font-size: 32px; }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await expect(page.locator('#focus-panel')).toHaveCSS('opacity', '1')
  await expect(page.locator('.focus-visual img')).toHaveCSS('animation-name', 'none')
  await page.locator('#new-task').click()
  await page.locator('#cancel-task').focus()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('#new-task')).toBeFocused()
  await page.locator('#mobile-navigation-more').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('#mobile-navigation-more')).toBeFocused()
  await expect(page.locator('#mobile-navigation-more')).toHaveCSS('outline-style', 'solid')
})

for (const width of [1440, 390]) {
  test(`forms, course page and measured text contrast at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await seed(page, 'populated')
    const contrasts = await page.evaluate(() => {
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
      }
      return [['#focus-heading', '#focus-panel'], ['.custom-time label', '#focus-panel'], ['#time-form button[type=submit]', '#time-form button[type=submit]'], ['.task-title', '.primary-suggestion'], ['.agenda-item-details', '#calendar-panel']].map(([selector, surface]) => {
        const a = luminance(getComputedStyle(document.querySelector(selector)).color)
        const b = luminance(getComputedStyle(document.querySelector(surface)).backgroundColor)
        return { selector, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
      })
    })
    for (const entry of contrasts) expect(entry.ratio, entry.selector).toBeGreaterThanOrEqual(4.5)
    await page.locator('#new-task').click()
    await page.locator('#title').fill('Forbered presentasjon om bærekraftig teknologi')
    await openTaskDetails(page)
    await page.locator('#course').fill(courses[0].code)
    await page.locator('#remainingMinutes').fill('45')
    if (width === 390) {
      const saveBounds = await page.locator('#task-form button[type=submit]').boundingBox()
      const dialogBounds = await page.locator('dialog[open]').boundingBox()
      expect(saveBounds.y + saveBounds.height).toBeLessThanOrEqual(dialogBounds.y + dialogBounds.height)
    }
    await page.screenshot({ path: `artifacts/studieplan-dialog-${width}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    await navigate(page, 'subjects')
    await page.screenshot({ path: `artifacts/studieplan-subjects-${width}.png`, animations: 'disabled' })
    await page.locator('#course-new').click()
    await page.locator('#subject-editor [name=name]').fill('Økonomi, bærekraft og samfunnsansvar')
    await page.screenshot({ path: `artifacts/studieplan-course-dialog-${width}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(state('populated'))
  })
}
