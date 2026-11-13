import { test, expect } from '@playwright/test'
import { task, seed, freeze, instrumentWrites, navigate, key, raw, writes } from './helpers.js'

const now = '2027-10-30T22:00:00Z'

for (const [choice, credited, offset] of [['earlier', 90, '+02:00'], ['later', 150, '+01:00']]) {
  test(`linked autumn reservation displays ${credited} minutes for the ${choice} deadline`, async ({ page }, testInfo) => {
    const state = {
      schemaVersion: 1,
      tasks: [{ ...task('reserved', '2027-10-31T02:30', 180), deadlineDisambiguation: choice }],
      sessions: [{ id: 'autumn', taskId: 'reserved', dateLocal: '2027-10-31', endDateLocal: '2027-10-31', startTime: '01:00', endTime: '03:00' }],
      workWindows: [{ id: 'work', start: '2027-10-30T23:00:00Z', end: '2027-10-31T02:00:00Z' }],
    }
    await freeze(page, now)
    await page.goto('/')
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
    await instrumentWrites(page)
    await page.reload()
    const before = await raw(page)
    await navigate(page, 'capacity')
    const entry = page.locator('[data-capacity-task="reserved"]')
    await expect(entry).toContainText(`UTC${offset}`)
    await expect(entry.locator('.capacity-minutes')).toContainText(`Reservert: ${credited} min · Forslag inkludert: ${credited} min`)
    await expect(entry).toContainText(`${180 - credited} min mangler før fristen`)
    await expect(entry).toContainText(`01:00–02:30: ${credited} min`)
    await page.screenshot({ path: testInfo.outputPath(`linked-${choice}.png`), fullPage: true, animations: 'disabled' })
    expect(await raw(page)).toBe(before)
    expect(await writes(page)).toEqual([])
  })
}

test('daily task rows use occurrence order without duplicating upcoming deadlines', async ({ page }, testInfo) => {
  const earlier = { ...task('z-earlier', '2027-10-31T02:45'), title: 'Første forekomst 02:45', deadlineDisambiguation: 'earlier' }
  const later = { ...task('a-later', '2027-10-31T02:15'), title: 'Andre forekomst 02:15', deadlineDisambiguation: 'later' }
  await seed(page, [later, earlier], { view: 'overview', now })
  const before = await raw(page)
  await expect(page.locator('#next-plan .daily-task h4')).toHaveText([earlier.title, later.title])
  await expect(page.locator('#next-plan .daily-task').nth(0)).toContainText('UTC+02:00')
  await expect(page.locator('#next-plan .daily-task').nth(1)).toContainText('UTC+01:00')
  await expect(page.locator('#next-plan .deadline-row')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('daily-task-occurrence-order.png'), fullPage: true, animations: 'disabled' })
  await page.getByLabel(`Flere handlinger for ${earlier.title}`, { exact: true }).click()
  await page.locator('#next-plan .daily-task').nth(0).getByRole('button', { name: 'Åpne oppgave og frist', exact: true }).click()
  await expect(page.locator('#title')).toHaveValue(earlier.title)
  await expect(page.locator('#deadlineDisambiguation')).toHaveValue('earlier')
  await page.locator('#cancel-task').click()
  expect(await raw(page)).toBe(before)
  expect(await writes(page)).toEqual([])
})

test('daily upcoming deadlines use occurrence order independently of visible task rows', async ({ page }, testInfo) => {
  const earlier = { ...task('z-earlier', '2027-10-31T02:45'), title: 'Første forekomst 02:45', deadlineDisambiguation: 'earlier' }
  const later = { ...task('a-later', '2027-10-31T02:15'), title: 'Andre forekomst 02:15', deadlineDisambiguation: 'later' }
  // Fill the three visible task rows first: the newer overview deliberately
  // removes those tasks from its independently sorted upcoming-deadline list.
  const visible = ['00:10', '00:20', '00:30'].map((time, index) => task(`visible-${index}`, `2027-10-31T${time}`))
  await seed(page, [later, earlier, ...visible], { view: 'overview', now })
  const before = await raw(page)
  await expect(page.locator('#next-plan .daily-task h4')).toHaveText(visible.map(item => item.title))
  const deadlines = page.locator('#next-plan .deadline-row')
  await expect(deadlines).toHaveCount(2)
  await expect(deadlines.nth(0)).toContainText(`${earlier.title} · i dag kl. 02:45`)
  await expect(deadlines.nth(0)).toContainText('UTC+02:00')
  await expect(deadlines.nth(1)).toContainText(`${later.title} · i dag kl. 02:15`)
  await expect(deadlines.nth(1)).toContainText('UTC+01:00')
  await page.screenshot({ path: testInfo.outputPath('daily-upcoming-occurrence-order.png'), fullPage: true, animations: 'disabled' })
  await deadlines.nth(0).getByRole('button', { name: `Åpne fristen for ${earlier.title}`, exact: true }).click()
  await expect(page.locator('#title')).toHaveValue(earlier.title)
  await expect(page.locator('#deadlineDisambiguation')).toHaveValue('earlier')
  await page.locator('#cancel-task').click()
  expect(await raw(page)).toBe(before)
  expect(await writes(page)).toEqual([])
})
