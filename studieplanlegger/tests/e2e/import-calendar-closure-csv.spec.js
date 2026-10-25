import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseDocumentCsv } from '../../src/document-parsers.js'
import { navigate } from './helpers.js'
import { openTpImport, preview, confirmTpImport, courseRows, savedTpState, runtimeUrl, runtimeScenario } from './tp-csv-helpers.js'

// Synthetic personal activities deliberately carry course hints and competing,
// individually valid identifier columns. The visible flow remains automatic.
const fileName = 'synthetic-personal-csv-closure.csv'
const fixture = 'title;id;eventid;courseid;activitykind;dtstart;dtend\nOppdiktet egen tur;synthetic-generic-a;synthetic-event-a;SYN981;personal;2026-10-25T02:30:07+02:00;2026-10-25T02:40:17+02:00\nOppdiktet egen pause;synthetic-generic-b;synthetic-event-b;SYN982;personal;2026-10-25T02:30:07+01:00;2026-10-25T02:40:17+01:00'
const expected = parseDocumentCsv(fixture).rows
function assertPersonal(state) {
  expect(state.tasks).toEqual([])
  expect(state.planner.courses).toEqual([])
  expect(state.planner.events).toHaveLength(2)
  expect(state.importSources).toHaveLength(1)
  expect(state.importSources[0].entries).toHaveLength(2)
  expect(state.importSources[0].entries.map(entry => entry.key)).toEqual(expected.map(row => row.key))
  expect(state.planner.events.map(event => ({ activityKind: event.activityKind, courseId: event.courseId, start: event.start, end: event.end }))).toEqual([
    { activityKind: 'personal', courseId: '', start: '2026-10-25T00:30:07Z', end: '2026-10-25T00:40:17Z' },
    { activityKind: 'personal', courseId: '', start: '2026-10-25T01:30:07Z', end: '2026-10-25T01:40:17Z' },
  ])
}
async function open(page) {
  await openTpImport(page, { text: fixture, name: fileName })
  await expect(courseRows(page)).toHaveCount(0)
  await expect(preview(page).locator('.document-confirmation-summary')).toContainText('0 må avklares')
  await expect(page.getByLabel('Hvilken kildeoppføring gjelder dette?', { exact: true })).toHaveCount(0)
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic CSV tests use no external source.' } }))
  await page.goto(runtimeUrl || '/')
})
test('Closure personal CSV: unused course hints do not block automatic identity and exact reimport', async ({ page }) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-personal-csv', 'Needs its own isolated database.')
  await open(page)
  expect((await savedTpState(page))?.planner?.courses || []).toEqual([])
  await confirmTpImport(page)
  const first = await savedTpState(page); assertPersonal(first)
  await page.reload(); await open(page); await confirmTpImport(page)
  const repeated = await savedTpState(page); assertPersonal(repeated)
  expect(repeated.planner).toEqual(first.planner)
  expect(repeated.importSources[0].entries).toEqual(first.importSources[0].entries)
  await navigate(page, 'subjects')
  await expect(page.locator('#event-list .source-badge')).toHaveText(['Importert fra fil · Uten emne', 'Importert fra fil · Uten emne'])
  await expect(page.locator('#event-list .event-card').nth(0)).toContainText('2026-10-25 02:30:07 (+02:00)')
  await expect(page.locator('#event-list .event-card').nth(1)).toContainText('2026-10-25 02:30:07 (+01:00)')
})
test('Closure persisted personal CSV: exact personal instants and identifiers survive recreation', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-personal-csv' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned persisted snapshot required.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected); assertPersonal(expected)
  await open(page); await confirmTpImport(page)
  const repeated = await savedTpState(page); assertPersonal(repeated)
  expect(repeated.planner).toEqual(expected.planner)
  expect(repeated.importSources[0].entries).toEqual(expected.importSources[0].entries)
})
