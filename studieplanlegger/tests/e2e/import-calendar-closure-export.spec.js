import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import ICAL from 'ical.js'
import { calendarUid } from '../../src/calendar-export.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { eventBlocksTime } from '../../src/planner.js'
import { navigate, tabTo } from './helpers.js'
import { openTpImport, confirmTpImport, savedTpState, runtimeUrl, runtimeScenario, captureTp } from './tp-csv-helpers.js'

// Independently invented CSV; imported through the actual file/preview controls.
const filename = 'synthetic-closure-export.csv'
const csv = () => 'eventid;title;dtstart;dtend;point;activitykind\n' + [
  ['synthetic-fold-first', 'Oppdiktet foerste punkt', '2026-10-25T00:30:07Z', '2026-10-25T00:30:07Z', 'true', ''],
  ['synthetic-fold-second', 'Oppdiktet andre punkt', '2026-10-25T01:30:07Z', '2026-10-25T01:30:07Z', 'true', ''],
  ['synthetic-fraction', 'Oppdiktet presis undervisning', '2026-10-25T09:00:07.125Z', '2026-10-25T09:00:07.875Z', '', ''],
  ['synthetic-personal-fraction', 'Oppdiktet presist eget punkt', '2026-10-25T10:00:07.125Z', '2026-10-25T10:00:07.125Z', 'true', 'personal'],
  ['synthetic-whole', 'Oppdiktet helt intervall', '2026-10-25T11:00:07Z', '2026-10-25T11:00:17Z', '', ''],
].map(row => row.join(';')).join('\n')

async function calendar(page) {
  await navigate(page, 'calendar')
  await page.locator('[data-calendar-view=day]').click()
  await page.locator('#full-calendar-date').fill('2026-10-25')
  await page.locator('#full-calendar-date').press('Tab')
}
async function exportDialog(page) {
  await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
  await dialog.getByLabel('Undervisning', { exact: true }).check()
  await dialog.getByLabel('Egne aktiviteter', { exact: true }).check()
  return dialog
}
function assertState(state) {
  expect(state.planner.courses).toHaveLength(0)
  expect(state.planner.events).toHaveLength(5)
  expect(state.importSources).toHaveLength(1)
  expect(state.importSources[0].entries).toHaveLength(5)
  expect(state.planner.events.filter(event => event.start.includes('.125'))).toHaveLength(2)
  expect(state.planner.events.filter(event => event.point)).toHaveLength(3)
}
async function downloadAndCheck(page, state) {
  const dialog = await exportDialog(page)
  await expect(dialog.locator('[data-export-status]')).toHaveText('3 aktiviteter blir eksportert. 2 oppføringer er utelatt. Se årsaken for hver oppføring nedenfor.')
  await expect(dialog.locator('[data-export-included] li')).toHaveCount(3)
  await expect(dialog.getByRole('heading', { name: 'Blir med i kopien', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Utelates fra kopien', exact: true })).toBeVisible()
  await expect(dialog.locator('[data-export-omissions] li')).toHaveCount(2)
  await expect(dialog.locator('[data-export-omissions]')).toContainText('2026-10-25 10:00:07.125 (+01:00) – 2026-10-25 10:00:07.875 (+01:00)')
  await expect(dialog.locator('[data-export-omissions]')).toContainText('Oppdiktet presist eget punkt')
  await expect(dialog.locator('[data-export-omissions]')).toContainText('hele sekunder')
  const before = await savedTpState(page)
  const pending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Last ned .ics', exact: true }).click()
  const source = readFileSync(await (await pending).path(), 'utf8')
  const output = new ICAL.Component(ICAL.parse(source)).getAllSubcomponents('vevent')
  expect(output).toHaveLength(3)
  const supported = state.planner.events.filter(event => !event.start.includes('.125'))
  for (const event of supported) {
    const result = output.find(item => item.getFirstPropertyValue('uid') === calendarUid('teaching', event.id))
    expect(result).toBeTruthy()
    expect(result.getFirstPropertyValue('dtstart').toJSDate().getTime()).toBe(Date.parse(event.start))
    expect(result.getFirstPropertyValue('transp')).toBe(eventBlocksTime(event) ? 'OPAQUE' : 'TRANSPARENT')
    expect(result.hasProperty('dtend')).toBe(!event.point)
    if (!event.point) expect(result.getFirstPropertyValue('dtend').toJSDate().getTime()).toBe(Date.parse(event.end))
  }
  expect(source).not.toContain('Oppdiktet presis')
  const parsed = parseDocumentIcs(source)
  expect(parsed.rows.filter(row => row.kind === 'event')).toHaveLength(3)
  expect(parsed.rows.filter(row => row.point)).toHaveLength(2)
  expect(parsed.complete).toBe(true)
  await expect(page.locator('.calendar-export-feedback')).toContainText('3 eksportert, 2 utelatt')
  expect(await savedTpState(page)).toEqual(before)
}

test('Closure export: precise import, fold labels and reviewed actual download', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-export', 'Own isolated scenario required.')
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic export journey has no external source.' } }))
  await page.goto('/')
  await openTpImport(page, { text: csv(), name: filename })
  await confirmTpImport(page)
  const initial = await savedTpState(page)
  assertState(initial)
  const downloads = []
  page.on('download', value => downloads.push(value))
  await calendar(page)
  for (const [title, offset] of [['Oppdiktet foerste punkt', '+02:00'], ['Oppdiktet andre punkt', '+01:00']]) {
    const entry = page.locator('.calendar-entry').filter({ has: page.getByText(title, { exact: true }) }).first()
    await expect(entry).toContainText(`02:30:07 (${offset})`)
    await entry.click()
    await expect(page.getByRole('dialog', { name: title, exact: true })).toContainText(`02:30:07 (${offset})`)
    await page.getByRole('button', { name: 'Lukk detaljer', exact: true }).click()
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390) await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
    const dialog = await exportDialog(page)
    await expect(dialog.locator('[data-export-omissions]')).toContainText('2026-10-25 10:00:07.125 (+01:00)')
    await tabTo(page, dialog.getByRole('button', { name: 'Last ned .ics', exact: true }))
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await captureTp(page, info, `closure-export-${width}.png`, { target: dialog.locator('[data-export-omissions]') })
    await dialog.getByLabel('Undervisning', { exact: true }).uncheck()
    await expect(dialog.getByRole('button', { name: 'Last ned .ics', exact: true })).toBeDisabled()
    await expect(dialog.locator('[data-export-status]')).toContainText('1 oppføring er utelatt')
    await expect(page.locator('.calendar-export-feedback')).toBeEmpty()
    await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click()
    expect(downloads).toHaveLength(0)
  }
  await downloadAndCheck(page, initial)
  expect(downloads).toHaveLength(1)
  const empty = await exportDialog(page)
  await empty.getByLabel('Undervisning', { exact: true }).uncheck()
  await expect(empty.getByRole('button', { name: 'Last ned .ics', exact: true })).toBeDisabled()
  await expect(page.locator('.calendar-export-feedback')).toBeEmpty()
  await empty.getByRole('button', { name: 'Avbryt', exact: true }).click()
  expect(downloads).toHaveLength(1)
  await page.reload()
  expect((await savedTpState(page)).planner).toEqual(initial.planner)
})

test('Closure persisted export: exact instants and identities survive fresh-browser reimport', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-export' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime harness only.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  await page.goto('/')
  expect(await savedTpState(page)).toEqual(expected)
  await openTpImport(page, { text: csv(), name: filename, sourceId: expected.importSources[0].id })
  await confirmTpImport(page)
  const current = await savedTpState(page)
  assertState(current)
  expect(current.planner).toEqual(expected.planner)
  expect(current.importSources[0].entries).toEqual(expected.importSources[0].entries)
  await calendar(page)
  await downloadAndCheck(page, current)
})
