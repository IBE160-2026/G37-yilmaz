import { test, expect } from '@playwright/test'
import { freeze, key, navigate, reveal } from './helpers.js'

test.use({ timezoneId: 'America/Los_Angeles', viewport: { width: 1440, height: 900 } })

test('Oslo-perioden, emnefilteret og fristmerket virker også med eldre oppgaver', async ({ page }) => {
  const date = '2027-01-01'
  const course = { id: 'synthetic', name: 'Oppdiktet programmering', code: 'SYN100', university: 'Syntetisk', semester: 'spring', year: 2027, notes: '', credits: null }
  const other = { ...course, id: 'other', name: 'Oppdiktet matematikk', code: 'SYN200' }
  const task = { id: 'legacy', title: 'Eldre frist', course: course.name, deadlineLocal: date + 'T12:05', estimatedMinutes: 30, completed: false }
  const event = { courseId: course.id, title: 'Syntetisk undervisning', start: date + 'T09:00:00Z', end: date + 'T10:00:00Z', notes: '', location: '', cancelled: true }
  const initial = { schemaVersion: 1, tasks: [task, { ...task, id: 'other-task', title: 'Annen frist', course: other.name }],
    sessions: [{ id: 'slot', taskId: 'legacy', dateLocal: date, startTime: '11:00', endTime: '11:30' }],
    planner: { courses: [course, other], sources: [], events: [{ ...event, id: 'local', excluded: true, exclusionCancelled: false }, { ...event, id: 'cancelled', title: 'Avlyst undervisning' }] },
  }
  await freeze(page, '2026-12-31T23:30:00Z')
  await page.addInitScript(({ key, initial }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial)) }, { key, initial })
  await page.goto('/')
  await navigate(page, 'all')
  await expect(page.locator('#today-label')).toContainText('1. januar 2027')
  await navigate(page, 'calendar')
  await expect(page.locator('#full-calendar-date')).toHaveValue(date)
  await (await reveal(page.locator('[data-calendar-view="day"]'))).click()
  const calendar = page.locator('#full-calendar')
  await (await reveal(calendar.locator('#full-calendar-course'))).selectOption(course.id)
  await (await reveal(calendar.getByLabel('Vis avlysninger'))).check()
  await expect(calendar.locator('[data-calendar-key="task:legacy"]')).toBeAttached()
  await expect(calendar.locator('[data-calendar-key="task:other-task"]')).toHaveCount(0)
  await expect(calendar.locator('[data-calendar-geometry="session:slot"]')).toBeAttached()
  await expect(calendar.locator('[data-calendar-key="event:local"]')).toHaveCount(0)
  await expect(calendar.locator('[data-calendar-geometry="task:legacy"]')).toHaveCSS('top', '725px')
  await calendar.locator('.calendar-timeline [data-calendar-key="event:cancelled"]').click()
  await expect(page.locator('.calendar-details')).toContainText('Avlyst i kilden')
  await page.keyboard.press('Escape')
  await page.reload()
  await navigate(page, 'calendar')
  await expect(calendar.locator('#full-calendar-course')).toHaveValue(course.id)
  await expect(calendar.locator('[data-calendar-key="task:legacy"]')).toBeAttached()
})
