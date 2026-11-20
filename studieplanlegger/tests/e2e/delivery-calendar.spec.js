import { test, expect } from '@playwright/test'
import { freeze, key, navigate, reveal } from './helpers.js'

test.use({ timezoneId: 'America/Los_Angeles', viewport: { width: 1440, height: 900 } })

for (const colorScheme of ['light', 'dark']) {
  test(`kalenderkort leses i synlig rekkefølge i ${colorScheme}`, async ({ page }) => {
    const date = '2026-11-19'
    const course = { id: 'synthetic', name: 'Oppdiktet programmering', code: 'SYN100', university: 'Syntetisk', semester: 'autumn', year: 2026, notes: '', credits: null }
    const task = { id: 'accessible', title: 'Øv på presentasjonen', course: '', deadlineLocal: `${date}T23:00`, estimatedMinutes: 30, completed: false }
    const event = { id: 'class', courseId: course.id, title: 'Syntetisk forelesning', start: `${date}T11:00:00Z`, end: `${date}T13:00:00Z`, notes: '', location: '' }
    const initial = { schemaVersion: 1, tasks: [task], sessions: [], planner: { courses: [course], sources: [], events: [event] } }
    await page.emulateMedia({ colorScheme })
    await freeze(page, `${date}T09:00:00Z`)
    await page.addInitScript(({ key, initial }) => localStorage.setItem(key, JSON.stringify(initial)), { key, initial })
    await page.goto('/')
    await navigate(page, 'all')
    await expect(page.locator('#compact-agenda [data-agenda-key="task:accessible"]'))
      .toHaveAccessibleName('19 NOV Frist kl. 23:00 Øv på presentasjonen, 2026')
    await navigate(page, 'calendar')
    const calendar = page.locator('#full-calendar')
    for (const view of ['agenda', 'day', 'week', 'month']) {
      await (await reveal(calendar.locator(`[data-calendar-view="${view}"]`))).click()
      const card = calendar.locator(`.full-calendar-viewport[data-mode="${view}"] [data-calendar-key="event:class"]`)
      await expect(card).toHaveAccessibleName(/12:00.*14:00.*Syntetisk forelesning.*Undervisning/iu)
    }
  })
}

test('compact agenda and month teaching list preserve seconds and midnight points', async ({ page }) => {
  const date = '2026-11-19'
  const course = { id: 'precision-course', name: 'Syntetisk emne', code: 'SYN100', university: 'Syntetisk', semester: 'autumn', year: 2026 }
  const source = { id: 'precision-source', courseId: course.id, name: 'Syntetisk kalender', kind: 'file', groups: [], lastUpdated: '2026-11-18T15:00:00Z' }
  const events = [
    { id: 'short', title: 'Kort undervisning', courseId: course.id, start: `${date}T09:00:07Z`, end: `${date}T09:00:53Z` },
    { id: 'midnight', title: 'Tidspunkt ved midnatt', courseId: course.id, sourceId: source.id, start: '2026-11-18T23:00:00Z', end: '2026-11-18T23:00:00Z', point: true },
  ]
  const initial = { schemaVersion: 1, tasks: [], planner: { courses: [course], sources: [source], events } }
  await freeze(page, '2026-11-18T22:30:00Z')
  await page.addInitScript(({ key, initial }) => localStorage.setItem(key, JSON.stringify(initial)), { key, initial })
  await page.goto('/')
  await navigate(page, 'all')

  const checkPrecision = async selector => {
    const short = page.locator(`${selector}short"]`)
    const midnight = page.locator(`${selector}midnight"]`)
    await expect(short).toBeVisible()
    await expect(midnight).toBeVisible()
    await expect.soft(short).toContainText('10:00:07–10:00:53')
    await expect.soft(short).toHaveAccessibleName(/10:00:07–10:00:53/)
    await expect.soft(midnight).toContainText('00:00')
    await expect.soft(midnight).toHaveAccessibleName(/00:00/)
    await expect.soft(midnight).not.toContainText('00:00–00:00')
    await expect.soft(midnight).not.toHaveAccessibleName(/00:00–00:00/)
  }
  await checkPrecision('#compact-agenda [data-agenda-key="event:')
  await page.getByRole('button', { name: 'Månedsvisning', exact: true }).click()
  await page.locator(`[data-calendar-date="${date}"]`).click()
  await checkPrecision('.calendar-teaching [data-calendar-event="')
})

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
