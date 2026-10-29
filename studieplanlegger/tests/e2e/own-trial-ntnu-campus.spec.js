import { test, expect } from '@playwright/test'
import { freeze, key, navigate, saved } from './helpers.js'
import { searchNtnu } from '../../server/providers/ntnu.js'
import { parseNtnuPage } from '../../server/import-api.js'
import { ntnuCampusQuery, ntnuCampusSearch, ntnuCampusHtml } from '../helpers/ntnu-campus-search.js'

for (const campus of ['Gjøvik', 'Trondheim']) test(`NTNU multi-campus search preserves the explicit ${campus} choice through preview, save and repeat`, async ({ page }) => {
  const details = []
  await page.route('**/api/import/providers/ntnu/search?**', async route => route.fulfill({ json: await searchNtnu(ntnuCampusQuery, async () => ntnuCampusSearch) }))
  await page.route('**/api/import/providers/ntnu/details?**', async route => {
    const query = Object.fromEntries(new URL(route.request().url()).searchParams)
    details.push(query)
    try { await route.fulfill({ json: { status: 'ok', ...parseNtnuPage(ntnuCampusHtml, query) } }) }
    catch (error) { await route.fulfill({ json: { status: 'transport-error', error: error.message } }) }
  })
  await freeze(page, '2026-10-29T18:00:00+01:00')
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] }, onboarding: { dismissed: true, completed: true } })), key)
  await page.reload()
  let first
  for (let attempt = 0; attempt < 2; attempt++) {
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: 'Finn ett emne', exact: true }).click()
    await page.getByRole('button', { name: 'Neste: søk og semester', exact: true }).click()
    const form = page.locator('#course-import-form')
    await form.locator('[name=code]').fill('TEST1001')
    await form.locator('[name=year]').fill('2026')
    await form.locator('[name=semester]').selectOption('autumn')
    await form.getByRole('button', { name: 'Søk emner', exact: true }).click()
    await expect(page.locator('.wizard-results button')).toHaveCount(2)
    const before = await saved(page)
    await page.getByRole('button', { name: `Syntetisk flercampusemne · TEST1001 · ${campus}`, exact: true }).click()
    const preview = page.locator('#import-preview')
    await expect(preview).toBeVisible()
    expect(details.at(-1)).toMatchObject({ campus, code: 'TEST1001', semester: 'autumn', year: '2026' })
    await expect(preview).toContainText(`Campus (emnekilden): ${campus}`)
    await expect(preview).toContainText('Emnekilden oppgir flere studiesteder: Gjøvik, Trondheim.')
    expect(await saved(page)).toEqual(before)
    await preview.getByRole('button', { name: 'Importer bare emnet', exact: true }).click()
    const after = await saved(page)
    expect(after.planner.courses).toHaveLength(1)
    expect(after.planner.courses[0]).toMatchObject({ code: 'TEST1001', campus })
    expect(after.planner.events).toEqual([])
    if (first) expect(after.planner.courses).toEqual(first.planner.courses)
    else first = after
    await page.reload()
    expect((await saved(page)).planner).toEqual(after.planner)
  }
})
