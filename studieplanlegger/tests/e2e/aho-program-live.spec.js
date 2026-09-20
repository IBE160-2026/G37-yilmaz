import { test, expect } from '@playwright/test'
import { navigate, key, saved } from './helpers.js'

test('AHO public design plan previews, saves, reloads and repeats', async ({ page }) => {
  test.skip(process.env.LIVE_PUBLIC_SOURCES !== '1', 'Kjører bare ved uttrykkelig kontroll av offentlig AHO-kilde.')

  async function runImport() {
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
    await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
    const host = page.locator('.program-import')
    await host.locator('[name=institution]').selectOption('aho')
    await host.locator('[name=programQuery]').fill('Master i design')
    await host.locator('[name=catalogueYear]').fill('2026')
    await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
    await expect(host.getByRole('status')).toContainText('programtreff')
    await host.locator('[name=program]').selectOption({ label: 'no:master-i-design · Master i design · Master' })
    await expect(host.locator('[name=cohort] option')).toHaveCount(4)
    await host.locator('[name=cohort]').selectOption({ label: 'Planutgave 2026–2031' })
    await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
    await host.locator('[name=model]').selectOption('published-study-model')
    await host.locator('[name=studySemester]').selectOption('semester-1')
    await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
    await host.locator('[name=programCampus]').selectOption('AHO OSLO')
    await expect(host.locator('fieldset input[type=checkbox]:checked')).toHaveCount(2)
    await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
    await expect(host).toContainText('70 111')
    await expect(host).toContainText('AHO OSLO')
    await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
    await expect(host.getByRole('status')).toContainText(/lagret/i)
    return host
  }

  await page.goto('/')
  await runImport()
  const first = await saved(page), ids = first.planner.courses.filter(row => row.sourceProvider === 'aho-program').map(row => row.id)
  expect(ids).toHaveLength(2)
  await page.reload()
  expect((await saved(page)).planner.courses.filter(row => row.sourceProvider === 'aho-program').map(row => row.id)).toEqual(ids)
  await runImport()
  expect((await saved(page)).planner.courses.filter(row => row.sourceProvider === 'aho-program').map(row => row.id)).toEqual(ids)
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey) !== null, key)).toBe(true)
  await page.screenshot({ path: 'artifacts/aho-program-live-20260919.png', fullPage: true })
})
