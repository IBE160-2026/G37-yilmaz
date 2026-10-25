import { test, expect } from '@playwright/test'
import { navigate } from './helpers.js'
import { preview, eventRows, confirmTpImport, savedTpState, runtimeUrl } from './tp-csv-helpers.js'

// Independently invented malformed components and valid siblings. No source data.
const name = 'synthetic-raw-calendar-validation.ics'
const input = ['BEGIN:VCALENDAR', 'VERSION:2.0', ...[
  ['wrong-type', 'DTSTART;VALUE=DATE:20450418T090007Z'],
  ['fractional-duration', 'DTSTART:20450418T090007Z\r\nDURATION:PT1.5H'],
  ['suffix-duration', 'DTSTART:20450418T090007Z\r\nDURATION:PT1Hgarbage'],
  ['unfinished-duration', 'DTSTART:20450418T090007Z\r\nDURATION:PT1H30'],
  ['duplicate-start', 'DTSTART:20450418T090007Z\r\nDTSTART:20450419T090007Z'],
  ['unknown-zone', 'DTSTART;TZID=Synthetic/Nowhere:20450418T110007'],
  ['duplicate-uid', 'UID:synthetic-raw-browser-valid-interval\r\nSTATUS:cancelled'],
  ['duration-conflict', 'DTSTART:20450418T090007Z\r\nDTEND:20450418T100007Z\r\nDURATION:PT1H'],
  ['until-type', 'DTSTART:20450418T090007Z\r\nRRULE:freq=daily;until=20450420'],
  ['valid-interval', 'DTSTART:20450418T090007Z\r\nDTEND:20450418T100017Z'],
  ['valid-point', 'DTSTART:20450419T090007Z'],
].flatMap(([id, fields]) => ['BEGIN:VEVENT', `UID:synthetic-raw-browser-${id}`, `SUMMARY:Oppdiktet ${id}`, fields, 'END:VEVENT']), 'END:VCALENDAR', ''].join('\r\n')

async function open(page) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name, mimeType: 'text/calendar', buffer: Buffer.from(input) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(preview(page)).toBeVisible()
  await expect(eventRows(page)).toHaveCount(2)
  await expect(preview(page).getByText('9 kildeoppføringer er avvist', { exact: false })).toBeVisible()
  const details = preview(page).locator('.document-source-details')
  if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').click()
  await expect(details).toContainText('11 kildeoppføringer · 2 beholdt · 0 delvis beholdt · 0 utenfor periode eller uten forekomster · 9 avvist')
  await expect(preview(page)).toContainText('Synthetic/Nowhere')
  await expect(preview(page)).toContainText('DURATION')
  await expect(preview(page)).toContainText('UID')
  await expect(preview(page)).toContainText('RRULE UNTIL')
}

test('Raw calendar validation: visible mixed import rejects nine malformed components and preserves exact valid siblings', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl), 'Local parser/UI regression; owned runtime journeys are selected separately.')
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic raw calendar has no external provider.' } }))
  await page.goto('/')
  await open(page)
  expect((await savedTpState(page))?.planner?.events || []).toEqual([])
  await page.screenshot({ path: info.outputPath('raw-calendar-validation-preview.png'), fullPage: true })
  await confirmTpImport(page)
  const first = await savedTpState(page)
  expect(first.tasks).toEqual([])
  expect(first.planner.events.map(({ title, start, end, point }) => ({ title, start, end, point: Boolean(point) }))).toEqual([
    { title: 'Oppdiktet valid-interval', start: '2045-04-18T09:00:07.000Z', end: '2045-04-18T10:00:17.000Z', point: false },
    { title: 'Oppdiktet valid-point', start: '2045-04-19T09:00:07.000Z', end: '2045-04-19T09:00:07.000Z', point: true },
  ])
  expect(first.importSources[0]).toMatchObject({ complete: false, accounting: { total: 11, retained: 2, rejected: 9 } })
  await page.reload()
  expect((await savedTpState(page)).planner).toEqual(first.planner)
  await open(page)
  await confirmTpImport(page)
  const repeated = await savedTpState(page)
  expect(repeated.planner).toEqual(first.planner)
  expect(repeated.importSources[0].entries).toEqual(first.importSources[0].entries)
})

test('Raw calendar validation: contradictory duplicate components show a visible error and leave saved state intact', async ({ page }) => {
  test.skip(Boolean(runtimeUrl), 'Local parser/UI regression; runtime journeys exercise partial imports separately.')
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic calendar has no external provider.' } }))
  await page.goto('/')
  await open(page)
  await confirmTpImport(page)
  const before = await savedTpState(page)
  const duplicate = extra => ['BEGIN:VEVENT', 'UID:synthetic-ambiguity', 'SUMMARY:Oppdiktet konflikt', 'DTSTART:20450418T090007Z', extra, 'END:VEVENT'].join('\r\n')
  const ambiguous = ['BEGIN:VCALENDAR', 'VERSION:2.0', duplicate('TRANSP:OPAQUE'), duplicate('TRANSP:transparent'), 'END:VCALENDAR'].join('\r\n')
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-ambiguous.ics', mimeType: 'text/calendar', buffer: Buffer.from(ambiguous) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(page.getByText(/Motstridende kalenderoppføringer mangler en entydig nyere revisjon/)).toBeVisible()
  expect(await savedTpState(page)).toEqual(before)
})
