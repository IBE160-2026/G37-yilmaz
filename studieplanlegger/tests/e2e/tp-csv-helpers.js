import { expect } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Papa from 'papaparse'
import { key, navigate } from './helpers.js'

// Shared by the browser and isolated SQLite/Docker journeys. Fixture values are
// independently invented; only the header structure comes from public evidence.
export const tpCsv = () => readFileSync(new URL('../fixtures/synthetic-tp-csv/main.csv', import.meta.url), 'utf8')
export const fixtureRows = () => Papa.parse(tpCsv(), { header: true, delimiter: ';', skipEmptyLines: true }).data
export const tpExceptionsCsv = () => readFileSync(new URL('../fixtures/synthetic-tp-csv/time-exceptions.csv', import.meta.url), 'utf8')
export const tpCsvRows = rows => Papa.unparse(rows, { delimiter: ';' })
export const preview = page => page.locator('.document-preview')
export const eventRows = page => preview(page).locator('.document-preview-row').filter({ has: page.locator('[data-field=startLocal]') })
export const courseRows = page => preview(page).locator('.document-preview-row').filter({ has: page.locator('[data-field=courseTarget]') })
export const runtimeUrl = process.env.TP_CSV_RUNTIME_URL
export const runtimeScenario = process.env.TP_CSV_RUNTIME_SCENARIO

export async function savedTpState(page) {
  if (runtimeUrl) {
    const response = await page.request.get(`${runtimeUrl}/api/state`)
    expect(response.ok()).toBe(true)
    return (await response.json()).envelope
  }
  return page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key)
}

export async function openTpImport(page, { text = tpCsv(), name = 'synthetic-tp-main.csv', sourceId } = {}) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Importer fil eller tekst', exact: true })).toBeVisible()
  if (sourceId) {
    const details = page.locator('details').filter({ has: page.getByLabel('Ny kilde eller oppdatering', { exact: true }) })
    if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').click()
    await page.getByLabel('Ny kilde eller oppdatering', { exact: true }).selectOption(sourceId)
  }
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) })
  // Reading a file and confirming its preview are separate explicit actions.
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(preview(page)).toBeVisible()
  await expect(page.getByLabel('Hvilken tekst skal vises i kalenderen?', { exact: true })).toHaveCount(0)
  return preview(page)
}

export async function confirmTpImport(page) {
  await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
}

export async function openPreviewRow(row) {
  const group = row.locator('..')
  if (await group.evaluate(node => node.matches('details:not([open])'))) await group.locator(':scope > summary').click()
  if (await row.getAttribute('open') === null) await row.locator(':scope > summary').click()
}

export async function captureTp(page, info, name, { target, align = 'center', additionalTargets = [] } = {}) {
  const directory = process.env.TP_CSV_EVIDENCE_DIR
  if (directory) mkdirSync(directory, { recursive: true })
  const output = filename => directory ? join(directory, filename) : info.outputPath(filename)
  await page.screenshot({ path: output(name), fullPage: true })
  // Long mobile pages remain available as context. Separate, unscaled viewport
  // captures make the actual explanation and controls readable during review.
  for (const focus of [{ target, align, suffix: '' }, ...additionalTargets]) {
    if (focus.target) {
      await focus.target.evaluate((element, block) => element.scrollIntoView({ block, behavior: 'instant' }), focus.align || 'center')
      await expect(focus.target).toBeInViewport()
    }
    const filename = name.replace(/\.png$/, `${focus.suffix ? `-${focus.suffix}` : ''}-viewport.png`)
    await page.screenshot({ path: output(filename), fullPage: false })
  }
}

export function assertTpLinks(state, { name = 'synthetic-tp-main.csv', eventCount = 30 } = {}) {
  const source = state.importSources.find(item => item.name === name)
  expect(source).toBeTruthy()
  expect(source).toMatchObject({ kind: 'document', format: 'csv', origin: { kind: 'file' } })
  expect(source.period).toBeUndefined()
  expect(source.accounting).toBeUndefined()
  const courses = state.planner.courses.filter(course => course.importSourceId === source.id)
  const events = state.planner.events.filter(event => event.importSourceId === source.id)
  expect(courses).toHaveLength(1)
  expect(events).toHaveLength(eventCount)
  expect(new Set(events.map(event => event.id)).size).toBe(eventCount)
  expect(events.every(event => event.courseId === courses[0].id)).toBe(true)
  for (const item of [...courses, ...events]) {
    expect(source.entries.find(entry => entry.key === item.importEntryKey)?.targetId).toBe(item.id)
  }
  return { source, course: courses[0], events }
}

export function assertTpExceptions(state) {
  const linked = assertTpLinks(state, { name: 'synthetic-tp-exceptions.csv', eventCount: 3 })
  expect(linked.source.excludedKeys).toHaveLength(4)
  expect(new Set(linked.source.excludedKeys).size).toBe(4)
  expect(linked.events.map(event => ({ title: event.title, start: event.start, end: event.end, point: Boolean(event.point) }))).toEqual([
    { title: 'Syntetisk uttrykkelig punkt', start: '2041-11-01T10:00:07Z', end: '2041-11-01T10:00:07Z', point: true },
    { title: 'Syntetisk ti sekunder', start: '2041-11-06T10:00:07Z', end: '2041-11-06T10:00:17Z', point: false },
    { title: 'Syntetisk punkt uten slutt', start: '2041-11-07T10:00:07Z', end: '2041-11-07T10:00:07Z', point: true },
  ])
  return linked
}
