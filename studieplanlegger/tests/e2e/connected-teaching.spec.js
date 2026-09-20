import { test, expect } from '@playwright/test'
import { freeze, navigate, key } from './helpers.js'

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
const sourceUrl = 'https://www.usn.no/studier/studie-og-emneplaner/testprogram'
const calendarUrl = 'https://cloud.timeedit.net/usn/web/publikk/test.ics'
const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Synthetic acceptance//NO\r\nBEGIN:VEVENT\r\nUID:synthetic-usn-lecture\r\nDTSTART:20260914T100000Z\r\nDTEND:20260914T110000Z\r\nSUMMARY:TEST101 Forelesning\r\nLOCATION:Testrom\r\nEND:VEVENT\r\nEND:VCALENDAR'

test('public teaching requires an explicit source object and groups, then saves atomically and repeats without duplicates', async ({ page }) => {
  await freeze(page, '2026-09-12T09:00:00+02:00')
  let calendarCalls = 0, failSearch = false
  await page.route('**/api/import/providers/usn/**', async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1)
    let data
    if (action === 'programs') data = { results: [{ code: 'TEST', name: 'Syntetisk studieprogram', sourceUrl }], completeness: { complete: true } }
    if (action === 'program-cohorts') data = { results: [{ cohort: '2026', sourceUrl }] }
    if (action === 'program-plan') data = { program: { code: 'TEST', name: 'Syntetisk studieprogram', cohort: '2026', sourceUrl, campuses: [] }, models: [{ id: 'common', name: 'Felles studieløp', periods: [{ id: 'first', label: '1. studiesemester · Høst 2026', studySemester: 1, year: 2026, semester: 'autumn', courses: [{ id: 'usn-test', code: 'TEST101', name: 'Testemne', university: 'USN', year: 2026, semester: 'autumn', credits: 10, choice: 'O', sourceUrl, sourceProvider: 'usn', sourceRecordId: 'TEST101', sourceVersion: '2026H' }] }] }] }
    if (action === 'teaching-search') data = failSearch ? { status: 'transport-error', error: 'Syntetisk kildefeil' } : { results: [{ sourceObjectId: '123.199', label: 'TEST101 · Felles undervisning', sourceUrl: 'https://cloud.timeedit.net/usn/web/publikk/ri1Q5084.html' }], warnings: ['Velg objektet selv.'] }
    if (action === 'teaching-calendar') {
      calendarCalls++
      expect(url.searchParams.get('sourceObjectId')).toBe('123.199')
      data = { calendar, calendarUrl, warnings: [] }
    }
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  async function previewProgram() {
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
    await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
    const host = page.locator('.program-import')
    await host.locator('[name=institution]').selectOption('usn')
    await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
    await host.locator('[name=program]').selectOption('0')
    await host.locator('[name=cohort]').selectOption('0')
    await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
    await host.locator('[name=model]').selectOption('common')
    await host.locator('[name=studySemester]').selectOption('first')
    await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
    await host.locator('[name=programCampus]').selectOption('__unknown')
    await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
    await expect(host.getByRole('heading', { name: 'Kontroller programimport', exact: true })).toBeFocused()
    return host
  }
  await page.goto('/')
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await stored(page), host = await previewProgram()
    await host.getByText('Offentlig timeplan for TEST101', { exact: true }).click()
    await host.getByRole('button', { name: 'Søk offentlig undervisning for TEST101', exact: true }).click()
    await expect(host.getByLabel('Timeplanobjekt for TEST101', { exact: true })).toHaveValue('')
    await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
    expect(calendarCalls).toBe(attempt)
    expect(await stored(page)).toEqual(before)
    await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).selectOption('0')
    await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
    await expect(host.getByRole('heading', { name: 'Kontroller programimport', exact: true })).toBeFocused()
    await host.locator('summary').filter({hasText:/Undervisningsgrupper for TEST101 ·/}).click()
    const groups = host.getByRole('group', { name: 'Undervisningsgrupper for TEST101', exact: true })
    if (attempt === 0) await expect(groups.getByRole('checkbox').first()).not.toBeChecked()
    await groups.getByRole('checkbox').first().check()
    expect(await stored(page)).toEqual(before)
    await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
    await expect(host.getByRole('status')).toBeFocused()
    await expect.poll(async () => (await stored(page))?.planner?.events?.length).toBe(1)
    const after = await stored(page)
    expect(after.planner.courses).toHaveLength(1)
    expect(after.planner.sources).toHaveLength(1)
    if (before) expect(after.planner.events[0].id).toBe(before.planner.events[0].id)
    await page.reload()
  }
  const beforeFailure = await stored(page), host = await previewProgram()
  failSearch = true
  await host.getByText('Offentlig timeplan for TEST101', { exact: true }).click()
  await host.getByRole('button', { name: 'Søk offentlig undervisning for TEST101', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('Syntetisk kildefeil')
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeEnabled()
  expect(await stored(page)).toEqual(beforeFailure)
})
