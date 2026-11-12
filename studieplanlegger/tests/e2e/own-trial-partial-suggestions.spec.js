import { test, expect } from '@playwright/test'
import { task, seed, navigate, openTaskDetails, openMenu, save, saved, row } from './helpers.js'

const suggestionIds = page => page.locator('#dashboard-suggestions > li').evaluateAll(items => items.map(item => item.dataset.taskId))
const suggestion = (page, title) => page.locator('#dashboard-suggestions > li').filter({ has: page.getByRole('heading', { name: title, exact: true, includeHidden: true }) })
async function chooseMinutes(page, minutes) {
  await navigate(page, 'overview')
  await page.locator(`[data-minutes="${minutes}"]`).click()
  const alternatives = page.locator('#toggle-alternatives')
  if (await alternatives.isVisible() && await alternatives.getAttribute('aria-expanded') === 'false') await alternatives.click()
}

for (const splittable of [true, false]) {
  test(`45-minute task at 15/60 minutes with splitting ${splittable ? 'on' : 'off'} and an explicit next step`, async ({ page }) => {
    const short = { ...task('synthetic-short', '', 15), remainingMinutes: 15 }
    const title = `Syntetisk 45 minutter, oppdeling ${splittable ? 'på' : 'av'}`
    await seed(page, [short], { view: 'all' })
    await page.locator('#new-task').click()
    await page.locator('#title').fill(title)
    await page.locator('#remainingMinutes').fill('45')
    await openTaskDetails(page)
    const split = page.getByRole('checkbox', { name: 'Kan deles i flere økter', exact: true })
    await expect(split).toBeChecked()
    if (!splittable) await split.uncheck()
    await save(page).click()
    const long = (await saved(page)).tasks.find(item => item.title === title)
    expect(long.remainingMinutes).toBe(45)
    expect(long.splittable !== false).toBe(splittable)

    // Current Ajour deliberately offers a bounded partial session for splittable
    // work. The older local walkthrough's strict filter is not this UI's contract.
    await chooseMinutes(page, '15')
    expect(await suggestionIds(page)).toEqual(splittable ? [short.id, long.id] : [short.id])
    if (splittable) await expect(suggestion(page, title)).toContainText('En deløkt på 15 min')
    await page.reload()
    await chooseMinutes(page, '15')
    expect(await suggestionIds(page)).toEqual(splittable ? [short.id, long.id] : [short.id])
    await chooseMinutes(page, '60')
    expect(await suggestionIds(page)).toEqual([short.id, long.id])
    await expect(suggestion(page, title)).toBeVisible()

    await navigate(page, 'all')
    await openMenu(page, title)
    await row(page, title).getByRole('button', { name: `Legg til neste steg «${title}»`, exact: true }).click()
    await page.locator('#step-description').fill('Les oppgaveteksten')
    await page.locator('#step-estimatedMinutes').fill('15')
    await page.getByRole('button', { name: 'Lagre neste steg', exact: true }).click()
    await chooseMinutes(page, '15')
    expect(await suggestionIds(page)).toEqual([short.id, long.id])
    await expect(suggestion(page, title)).toContainText('Neste steg: «Les oppgaveteksten», 15 min')
    await expect(suggestion(page, title)).toContainText('Hele oppgaven er ikke ferdig etter steget')
    await page.reload()
    await chooseMinutes(page, '15')
    expect(await suggestionIds(page)).toEqual([short.id, long.id])
    await expect(suggestion(page, title)).toContainText('Les oppgaveteksten')
    const persisted = (await saved(page)).tasks.find(item => item.id === long.id)
    expect(persisted.remainingMinutes).toBe(45)
    expect(persisted.splittable !== false).toBe(splittable)
    expect(persisted.completed).toBe(false)
  })
}
