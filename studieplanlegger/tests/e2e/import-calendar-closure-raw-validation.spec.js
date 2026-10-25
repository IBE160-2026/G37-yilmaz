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
  await expect(preview(page).getByText('6 kildeoppføringer er avvist', { exact: false })).toBeVisible()
  const details = preview(page).locator('.document-source-details')
  if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').click()
  await expect(details).toContainText('8 kildeoppføringer · 2 beholdt · 0 delvis beholdt · 0 utenfor periode eller uten forekomster · 6 avvist')
  await expect(preview(page)).toContainText('Synthetic/Nowhere')
  await expect(preview(page)).toContainText('DURATION')
}

test('Raw calendar validation: visible mixed import rejects six malformed components and preserves exact valid siblings', async ({ page }, info) => {
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
  expect(first.importSources[0]).toMatchObject({ complete: false, accounting: { total: 8, retained: 2, rejected: 6 } })
  await page.reload()
  expect((await savedTpState(page)).planner).toEqual(first.planner)
  await open(page)
  await confirmTpImport(page)
  const repeated = await savedTpState(page)
  expect(repeated.planner).toEqual(first.planner)
  expect(repeated.importSources[0].entries).toEqual(first.importSources[0].entries)
})
