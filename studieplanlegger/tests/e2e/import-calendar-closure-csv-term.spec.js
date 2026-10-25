import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { navigate } from './helpers.js'
import { openTpImport, preview, confirmTpImport, courseRows, savedTpState, runtimeUrl, runtimeScenario, captureTp } from './tp-csv-helpers.js'

const fixture = name => readFileSync(new URL(`../fixtures/synthetic-calendar-closure/${name}`, import.meta.url))
const freshCsv = fixture('published-term.csv').toString('utf8')
const legacyCsv = fixture('legacy-csv-term.csv').toString('utf8')
// Generated with the preserved pre-task parser and preview. Its original
// event-date keys are intentionally different from the corrected CSV keys.
const legacyBytes = fixture('legacy-csv-term.json')
const legacy = JSON.parse(legacyBytes.toString('utf8')).data

test.beforeAll(() => {
  expect(createHash('sha256').update(fixture('legacy-csv-term.csv')).digest('hex'),
    'The historical CSV fixture must retain the exact bytes identified by its unchanged legacy backup; check .gitattributes before changing product expectations.').toBe(legacy.importSources[0].contentHash)
})

async function open(page, text, count) {
  await openTpImport(page, { text, name: text === freshCsv ? 'published-term.csv' : 'legacy-csv-term.csv' })
  await expect(courseRows(page)).toHaveCount(1)
  await expect(courseRows(page).locator('[data-field=semester]')).toHaveValue('autumn')
  await expect(courseRows(page).locator('[data-field=year]')).toHaveValue('2045')
  await expect(preview(page).locator('.document-confirmation-summary')).toContainText('0 må avklares')
  await expect(preview(page)).toContainText(`${count} valgte kalenderhendelser`)
  await expect(preview(page).getByRole('button', { name: 'Importer valgte', exact: true })).toBeEnabled()
}
function assertLegacy(state) {
  expect(state.planner.courses).toHaveLength(1)
  expect(state.planner.courses[0]).toEqual({ ...legacy.planner.courses[0], year: 2045, semester: 'autumn' })
  expect(state.planner.events).toEqual(legacy.planner.events)
  expect(state.tasks).toEqual(legacy.tasks)
  expect(state.importSources).toHaveLength(1)
  expect(state.importSources[0].id).toBe(legacy.importSources[0].id)
  expect(state.importSources[0].entries.map(entry => entry.key)).toEqual(legacy.importSources[0].entries.map(entry => entry.key))
  expect(state.importSources[0].excludedKeys).toContain(legacy.importSources[0].excludedKeys[0])
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic CSV uses no external source.' } }))
  await page.goto(runtimeUrl || '/')
})
test('Closure CSV term: published autumn and genuine legacy keys survive visible correction and reimport', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-csv-term', 'Needs its own isolated database.')
  await open(page, freshCsv, 2)
  await confirmTpImport(page)
  const first = await savedTpState(page)
  expect(first.planner.courses).toHaveLength(1)
  expect(first.planner.courses[0]).toMatchObject({ code: 'SYN974', university: 'HiMolde', year: 2045, semester: 'autumn' })
  expect(first.planner.events.map(event => ({ courseId: event.courseId, start: event.start, end: event.end }))).toEqual([
    { courseId: first.planner.courses[0].id, start: '2045-09-18T08:00:07Z', end: '2045-09-18T09:00:17Z' },
    { courseId: first.planner.courses[0].id, start: '2046-01-12T09:00:07Z', end: '2046-01-12T10:00:17Z' },
  ])
  await page.reload(); await open(page, freshCsv, 2); await confirmTpImport(page)
  expect((await savedTpState(page)).planner).toEqual(first.planner)

  await navigate(page, 'settings')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Importer sikkerhetskopi', exact: true }).click()
  await (await chooser).setFiles({ name: 'synthetic-legacy-csv-term.json', mimeType: 'application/json', buffer: legacyBytes })
  const dialog = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
  await dialog.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(await savedTpState(page)).toEqual(legacy)
  await open(page, legacyCsv, 1)
  await captureTp(page, info, 'closure-csv-term-legacy-preview.png', { target: preview(page).getByRole('button', { name: 'Importer valgte', exact: true }) })
  await confirmTpImport(page)
  const corrected = await savedTpState(page); assertLegacy(corrected)
  await page.reload(); await open(page, legacyCsv, 1); await confirmTpImport(page)
  const repeated = await savedTpState(page); assertLegacy(repeated)
  expect(repeated.planner).toEqual(corrected.planner)
  expect(repeated.importSources[0].entries).toEqual(corrected.importSources[0].entries)
})
test('Closure persisted CSV term: repaired publication and original keys exclusions and notes survive recreation', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-csv-term' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned persisted snapshot required.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected); assertLegacy(expected)
  await open(page, legacyCsv, 1); await confirmTpImport(page)
  const repeated = await savedTpState(page); assertLegacy(repeated)
  expect(repeated.planner).toEqual(expected.planner)
  expect(repeated.importSources[0].entries).toEqual(expected.importSources[0].entries)
})
