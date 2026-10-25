import { reveal } from './helpers.js'
import { test, expect } from '@playwright/test'
import { navigate, saved, key } from './helpers.js'

// Invented from scratch, never derived from a personal calendar or export.
const csv = () => ['title;summary;name;courseid;coursename;university;dtstart;dtend',
  ...Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.UTC(2041, 2, i + 1)).toISOString().slice(0, 10)
    return `Seminar ${i % 2 + 1};Seminar ${i % 2 + 1};Alternativ ${i % 2 + 1};SYN731;Oppdiktet testemne;uio;${date}T10:00:00+01:00;${date}T11:00:00+01:00`
  })].join('\n')

async function readCsv(page, title, text = csv()) {
  await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-reimport.csv', mimeType: 'text/csv', buffer: Buffer.from(text) })
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  await expect(page.getByLabel('Hvilken tekst skal vises i kalenderen?')).toBeVisible()
  if (title) {
    await (await reveal(page.getByLabel('Hvilken tekst skal vises i kalenderen?'))).selectOption(title)
    await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
    await expect(page.locator('.document-preview')).toBeVisible()
  }
}

test('repair: CSV title alternatives must be distinguishable on the same dated event', async ({ page }) => {
  await page.goto('/'); await navigate(page, 'subjects'); await readCsv(page)
  const labels = await page.getByLabel('Hvilken tekst skal vises i kalenderen?').locator('option:not([value=""])').allTextContents()
  console.log(JSON.stringify({ syntheticScenario: 'title-options', labels }))
  expect(new Set(labels).size).toBe(labels.length)
  expect(labels).toHaveLength(2)
  await expect(page.getByText('Samme oppføringer i alternativene:', { exact: false })).toContainText('2041-03-01')
})

test('repair: changing CSV display title retains 30 prior activity identities after reload', async ({ page }) => {
  await page.goto('/'); await navigate(page, 'subjects'); await readCsv(page, 'title')
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const before = await saved(page)
  expect(before.planner.events).toHaveLength(30)
  await page.reload(); await navigate(page, 'subjects'); await readCsv(page, 'name')
  const matches = page.locator('.document-preview [data-field=matchChoice]')
  console.log(JSON.stringify({ syntheticScenario: 'changed-title', questions: await matches.count(), firstOptions: await matches.first().locator('option').allTextContents() }))
  expect(await matches.count()).toBe(0)
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  expect((await saved(page)).planner.events.map(event => event.id).sort()).toEqual(before.planner.events.map(event => event.id).sort())
  expect((await saved(page)).planner.events.every(event => event.title.startsWith('Alternativ'))).toBe(true)
})

test('repair control: institution clarification and unchanged ICS reimport preserve 108 events', async ({ page }) => {
  const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', ...Array.from({ length: 108 }, (_, i) => {
    const date = new Date(Date.UTC(2041, 2, i + 1)).toISOString().slice(0, 10).replaceAll('-', '')
    return ['BEGIN:VEVENT', `UID:invented-reimport-${i}@example.invalid`, `SUMMARY:Seminar ${i % 2 + 1}`,
      `X-COURSE-CODE:SYN${740 + i % 4}`, `DTSTART:${date}T090000Z`,
      ...(i < 19 ? [] : [`DTEND:${date}T100000Z`]), 'END:VEVENT'].join('\r\n')
  }), 'END:VCALENDAR'].join('\r\n')
  async function read() {
    await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
    await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-108.ics', mimeType: 'text/calendar', buffer: Buffer.from(text) })
    await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
    await expect(page.locator('.document-preview')).toBeVisible()
  }
  await page.goto('/'); await navigate(page, 'subjects'); await read()
  await (await reveal(page.getByLabel('Lærested for emner uten institusjon'))).selectOption('uio')
  await (await reveal(page.getByRole('button', { name: 'Bruk lærested og finn emnenavn', includeHidden: true }))).click()
  await (await reveal(page.getByRole('button', { name: 'Bruk emnekoder som foreløpige navn' }))).click()
  await expect(page.locator('.document-preview > button').filter({ hasText: 'Prøv emnenavn på nytt' })).toHaveCount(0)
  const sourceDetails = page.locator('.document-preview .document-source-details')
  if (await sourceDetails.evaluate(element => element.open)) await sourceDetails.locator(':scope > summary').click()
  await expect(page.getByRole('button', { name: 'Prøv emnenavn på nytt', exact: true, includeHidden: true })).not.toBeVisible()
  await (await reveal(page.getByRole('button', { name: 'Velg alle aktiviteter', exact: true, includeHidden: true }))).click()
  await expect(page.locator('.document-preview [data-field=recreate]')).toHaveCount(0)
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const before = await saved(page)
  expect(before.planner.courses).toHaveLength(4)
  expect(before.planner.events).toHaveLength(108)
  expect(before.planner.events.filter(event => event.point)).toHaveLength(19)
  await page.reload(); await navigate(page, 'subjects'); await read()
  await expect(page.locator('.document-preview [data-field=recreate]')).toHaveCount(0)
  await expect(page.locator('.document-preview [data-field=matchChoice]')).toHaveCount(0)
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  expect((await saved(page)).planner).toEqual(before.planner)
})
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const legacy = JSON.parse(readFileSync(new URL('../fixtures/synthetic-reimport/legacy.json', import.meta.url)))

for (const restore of [false, true]) test(`repair: pre-fix deletion and exclusion survive title changes with grouped ${restore ? 'restore' : 'keep'}`, async ({ page }) => {
  const state = structuredClone(legacy.state)
  state.importSources[0].contentHash = createHash('sha256').update(legacy.csv).digest('hex')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload(); await navigate(page, 'subjects'); await readCsv(page, 'name', legacy.csv)
  await expect(page.locator('[data-field=matchChoice]')).toHaveCount(0)
  await expect(page.locator('[data-field=recreate]')).toHaveCount(1)
  await expect(page.locator('.document-preview-row').nth(3).locator('[data-field=selected]')).not.toBeChecked()
  await (await reveal(page.getByRole('button', { name: restore ? 'Gjenopprett alle manglende oppføringer' : 'Behold manglende oppføringer utelatt', exact: true }))).click()
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const after = await saved(page)
  expect(after.planner.events).toHaveLength(restore ? 2 : 1)
  expect(after.planner.events[0].id).toBe(state.planner.events[0].id)
  expect(after.planner.events[0].title).toBe('Alternative')
  if (restore) expect(after.planner.events[1].id).toBe(state.importSources[0].entries[2].targetId)
  await (await reveal(page.getByRole('button', { name: 'Tilbake til Mine emner', exact: true }))).click()
  await navigate(page, 'settings')
  await (await reveal(page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }))).click()
  expect((await saved(page)).planner).toEqual(state.planner)
  await page.reload(); await navigate(page, 'subjects'); await readCsv(page, 'name', legacy.csv)
  await expect(page.locator('[data-field=matchChoice]')).toHaveCount(0)
  await expect(page.locator('[data-field=recreate]')).toHaveCount(1)
  await expect(page.locator('[data-field=recreate]')).not.toBeChecked()
  await expect(page.locator('.document-preview-row').nth(3).locator('[data-field=selected]')).not.toBeChecked()
})
test('repair: all three title alternatives differ visibly when two first diverge on the fourth dated event', async ({ page }) => {
  const text = ['title;summary;name;courseid;dtstart;dtend', ...Array.from({ length: 4 }, (_, i) => `${i === 3 ? 'Late A' : 'Shared'};${i === 3 ? 'Late B' : 'Shared'};Different C;SYN731;2041-03-0${i+1}T10:00:00Z;2041-03-0${i+1}T11:00:00Z`)].join('\n')
  await page.goto('/'); await navigate(page, 'subjects'); await readCsv(page, undefined, text)
  const select = page.getByLabel('Hvilken tekst skal vises i kalenderen?')
  const labels = await select.locator('option:not([value=""])').allTextContents()
  expect(labels).toEqual(['Late A', 'Late B', 'Different C'])
  await expect(page.getByText('Samme oppføringer i alternativene:', { exact: false })).toContainText('SYN731 · 2041-03-04T10:00:00Z')
  await expect(page.getByText('title: Late A', { exact: true })).not.toBeVisible()
  await (await reveal(page.getByText('Kolonnedetaljer', { exact: true }))).click()
  await expect(page.getByText('title: Late A', { exact: true })).toBeVisible()
})
test('repair: selecting a missing match updates grouped recovery and never transfers recreation consent', async ({ page }) => {
  const state = structuredClone(legacy.state); state.planner.events = []
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload(); await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
  await (await reveal(page.getByLabel('Ny kilde eller oppdatering'))).selectOption(state.importSources[0].id)
  const text = ['title;courseid;coursename;university;dtstart;dtend', 'Seminar;SYN731;Invented course;uio;2041-03-01T12:00:00+01:00;2041-03-01T13:00:00+01:00'].join('\n')
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-match.csv', mimeType: 'text/csv', buffer: Buffer.from(text) })
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  const recovery = page.locator('.document-recovery'), matches = page.locator('[data-field=matchChoice]')
  await expect(matches).toHaveCount(1); await expect(recovery).toBeHidden()
  const [first, second] = state.importSources[0].entries.filter(entry => entry.kind === 'event')
  await (await reveal(matches)).selectOption(first.key)
  await expect(recovery).toBeVisible(); await expect(recovery).toContainText('0 emner og 1 aktiviteter/oppgaver mangler')
  await (await reveal(recovery.getByRole('button', { name: 'Gjenopprett alle manglende oppføringer', exact: true }))).click()
  await expect(page.locator('[data-field=recreate]')).toBeChecked()
  await (await reveal(matches)).selectOption(second.key)
  await expect(page.locator('[data-field=recreate]')).not.toBeChecked()
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.locator('.document-preview [role=alert]')).toContainText('Velg uttrykkelig')
  expect((await saved(page)).planner.events).toHaveLength(0)
  await (await reveal(matches)).selectOption('new'); await expect(recovery).toBeHidden()
  await (await reveal(matches)).selectOption(second.key); await expect(recovery).toBeVisible()
  await (await reveal(recovery.getByRole('button', { name: 'Gjenopprett alle manglende oppføringer', exact: true }))).click()
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  expect((await saved(page)).planner.events.map(event => event.id)).toEqual([second.targetId])
})
test('repair: undoing the initial CSV import then reopening the same file preserves exact IDs without false tombstones', async ({ page }) => {
  await page.goto('/'); await navigate(page, 'subjects'); await readCsv(page, 'title')
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const original = await saved(page)
  expect(original.planner.events).toHaveLength(30)
  await (await reveal(page.getByRole('button', { name: 'Tilbake til Mine emner', exact: true }))).click()
  await navigate(page, 'settings')
  await (await reveal(page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }))).click()
  const undone = await saved(page)
  expect(undone.planner?.events || []).toHaveLength(0)
  expect(undone.importSources || []).toHaveLength(0)
  await page.reload(); await navigate(page, 'subjects'); await readCsv(page, 'title')
  await expect(page.locator('[data-field=matchChoice]')).toHaveCount(0)
  await expect(page.locator('[data-field=recreate]')).toHaveCount(0)
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const reopened = await saved(page)
  expect(reopened.planner.events.map(event => event.id)).toEqual(original.planner.events.map(event => event.id))
  expect(reopened.planner.courses.map(course => course.id)).toEqual(original.planner.courses.map(course => course.id))
  expect(reopened.planner.events).toEqual(original.planner.events)
})
import { parseDocumentCsv } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit } from '../../src/import-preview.js'
const ambiguousExclusions = JSON.parse(readFileSync(new URL('../fixtures/synthetic-reimport/ambiguous-exclusions.json', import.meta.url)))
function syntheticState(text) {
  const state = { schemaVersion: 1, tasks: [] }, parsed = { ...parseDocumentCsv(text), contentHash: createHash('sha256').update(text).digest('hex') }
  const result = buildDocumentImportCommit(state, createDocumentImportPreview(state, parsed))
  expect(result.ok, JSON.stringify(result.errors)).toBe(true)
  return result.state
}
async function seedImport(page, state) {
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload(); await navigate(page, 'subjects')
}
async function readPlainCsv(page, text, sourceId) {
  await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
  if (sourceId) await (await reveal(page.getByLabel('Ny kilde eller oppdatering'))).selectOption(sourceId)
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'invented-review.csv', mimeType: 'text/csv', buffer: Buffer.from(text) })
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  await expect(page.locator('.document-preview')).toBeVisible()
}
const primaryCounts = page => page.locator('.document-preview > [role=status]').first()

test('review: task reimport candidates display supported local deadlines and retain the chosen task ID', async ({ page }) => {
  const text = 'title;deadline\nOriginal task;2041-03-01T10:00'
  const state = syntheticState(text)
  await seedImport(page, state)
  await readPlainCsv(page, text.replace('Original task', 'Updated task'), state.importSources[0].id)
  const matches = page.locator('[data-field=matchChoice]')
  await expect(matches).toHaveCount(1)
  await expect(matches).toContainText('2041-03-01 10:00')
  await (await reveal(matches)).selectOption(state.importSources[0].entries[0].key)
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  expect((await saved(page)).tasks[0]).toMatchObject({ id: state.tasks[0].id, title: 'Updated task', deadlineLocal: '2041-03-01T10:00' })
})
for (const mobile of [false, true]) test(`review: uncertain legacy omissions require informed selection ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, info) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  const state = structuredClone(ambiguousExclusions.state)
  state.importSources[0].contentHash = createHash('sha256').update(ambiguousExclusions.csv).digest('hex')
  await seedImport(page, state); await readCsv(page, 'title', ambiguousExclusions.csv)
  await expect(page.locator('.document-preview')).toContainText('Tidligere tittelvalg gir forskjellige utelatelser')
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.locator('.document-preview [role=alert]')).toContainText('Velg uttrykkelig hvilke aktiviteter')
  expect((await saved(page)).planner.events).toHaveLength(1)
  await page.screenshot({ path: info.outputPath('uncertain-legacy.png'), fullPage: true })
  await (await reveal(page.getByRole('button', { name: 'Velg alle aktiviteter', exact: true, includeHidden: true }))).click()
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  expect((await saved(page)).planner.events).toHaveLength(3)
})
for (const long of [false, true]) test(`review: actual CSV title choices remain readable after ${long ? 'long common prefix' : 'URL differences'}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const first = long ? 'x'.repeat(650) + ' Meaningful A' : 'https://example.invalid/one'
  const second = long ? 'x'.repeat(650) + ' Meaningful B' : 'https://example.invalid/two'
  const text = `title;name;startLocal;coursecode;endLocal\n${first};${second};2041-03-01T10:00;SYN731;2041-03-01T11:00`
  await page.goto('/'); await navigate(page, 'subjects'); await readCsv(page, undefined, text)
  const labels = await page.getByLabel('Hvilken tekst skal vises i kalenderen?').locator('option:not([value=""])').allTextContents()
  expect(new Set(labels).size).toBe(2)
  expect(labels[0]).toContain(long ? 'Meaningful A' : first); expect(labels[1]).toContain(long ? 'Meaningful B' : second)
  await expect(page.getByText('Samme oppføringer i alternativene:', { exact: false })).toContainText('SYN731 · 2041-03-01T10:00')
  expect(await page.locator('.document-import a[href^="https://example.invalid"]').count()).toBe(0)
  if (long) {
    await expect(page.locator('.document-csv-alternative').nth(0)).toHaveText(`Alternativ 1: ${first}`)
    await expect(page.locator('.document-csv-alternative').nth(1)).toHaveText(`Alternativ 2: ${second}`)
    expect(await page.locator('.document-csv-alternative').first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('title-alternatives.png'), fullPage: true })
})
const oneEventCsv = (title = 'Source title') => `title;courseid;coursename;university;dtstart;dtend\n${title};SYN736;Invented course;uio;2041-03-01T10:00:00Z;2041-03-01T11:00:00Z`
for (const scenario of ['preview edit', 'keep local conflict', 'restore changed target']) test(`review: action totals reflect actual mutually exclusive outcomes for ${scenario}`, async ({ page }) => {
  const text = oneEventCsv(), state = syntheticState(text)
  if (scenario === 'keep local conflict') state.planner.events[0].title = 'My local title'
  if (scenario === 'restore changed target') state.planner.events = []
  await seedImport(page, state)
  await readPlainCsv(page, scenario === 'preview edit' ? text : oneEventCsv('Incoming title'), state.importSources[0].id)
  if (scenario === 'preview edit') {
    await expect(primaryCounts(page)).toHaveText('0 legges til · 0 oppdateres · 2 beholdes · 0 må avklares.')
    await (await reveal(page.locator('.document-preview-row').nth(1).locator('summary').first())).click()
    await (await reveal(page.locator('.document-preview-row').nth(1).getByLabel('Navn', { exact: true }))).fill('My preview edit')
    await expect(primaryCounts(page)).toHaveText('0 legges til · 1 oppdateres · 1 beholdes · 0 må avklares.')
  } else if (scenario === 'keep local conflict') {
    await (await reveal(page.locator('[data-field="conflict:title"]'))).selectOption('local')
    await expect(primaryCounts(page)).toHaveText('0 legges til · 0 oppdateres · 2 beholdes · 0 må avklares.')
  } else {
    await (await reveal(page.locator('[data-field=recreate]'))).check()
    await expect(primaryCounts(page)).toHaveText('1 legges til · 0 oppdateres · 1 beholdes · 0 må avklares.')
  }
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  expect((await saved(page)).planner.events[0].title).toBe(scenario === 'preview edit' ? 'My preview edit' : scenario === 'keep local conflict' ? 'My local title' : 'Incoming title')
})
for (const mobile of [false, true]) test(`review: coincident alternatives remain manual and expose available end place and campus ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, info) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  const header = 'title;courseid;coursename;university;campus;sourceobjectid;dtstart;dtend;location'
  const text = `${header}\nSame seminar;SYN737;Invented;uio;North;public-A;2041-03-01T10:00:00Z;2041-03-01T11:00:00Z;Room A\nSame seminar;SYN737;Invented;uio;North;public-A;2041-03-01T10:00:00Z;2041-03-01T12:00:00Z;Room B`
  const state = syntheticState(text)
  await seedImport(page, state)
  await readPlainCsv(page, `${header}\nSame seminar;SYN737;Invented;uio;North;public-A;2041-03-01T10:00:00Z;2041-03-01T10:30:00Z;New room`, state.importSources[0].id)
  const matches = page.locator('[data-field=matchChoice]')
  await expect(matches).toHaveValue('?')
  const labels = await matches.locator('option').allTextContents()
  expect(labels.some(text => text.includes('Room A') && text.includes('12:00') && text.includes('Campus: North') && text.includes('Kildevalg: public-A'))).toBe(true)
  expect(labels.some(text => text.includes('Room B') && text.includes('13:00'))).toBe(true)
  expect(new Set(labels).size).toBe(labels.length)
  for (const entry of state.importSources[0].entries) expect(labels.some(text => text.includes(entry.key))).toBe(false)
  await expect(page.locator('.document-match-alternatives')).toContainText('Room A')
  await expect(page.locator('.document-match-alternatives')).toContainText('Room B')
  expect(await page.locator('.document-match-alternatives p').first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('coincident-candidates.png'), fullPage: true })
  const target = state.importSources[0].entries.filter(entry => entry.kind === 'event')[1]
  await (await reveal(matches)).selectOption(target.key)
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  expect((await saved(page)).planner.events.find(event => event.id === target.targetId).location).toBe('New room')
})
for (const mobile of [false, true]) test(`review: search beyond twenty matching candidates preserves selection through another filter ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, info) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  const header = 'title;courseid;coursename;university;dtstart;dtend'
  const text = [header, ...Array.from({ length: 25 }, (_, index) => `Same seminar;SYN738;Invented;uio;2041-03-${String(index + 1).padStart(2, '0')}T10:00:00Z;2041-03-${String(index + 1).padStart(2, '0')}T11:00:00Z`)].join('\n')
  const state = syntheticState(text), target = state.importSources[0].entries.filter(entry => entry.kind === 'event')[0]
  await seedImport(page, state)
  await readPlainCsv(page, `${header}\nSame seminar;SYN738;Invented;uio;2041-04-01T10:00:00Z;2041-04-01T11:00:00Z`, state.importSources[0].id)
  const matches = page.locator('[data-field=matchChoice]'), search = page.getByLabel('Finn tidligere oppføring med navn eller dato')
  await expect(matches.locator('option')).toHaveCount(22)
  expect(await matches.locator('option').evaluateAll(options => options.map(option => option.value))).not.toContain(target.key)
  await (await reveal(search)).fill('2041-03-01'); await search.press('Tab')
  await expect(matches.locator('option')).toHaveCount(3)
  await (await reveal(matches)).selectOption(target.key)
  await (await reveal(search)).fill('2041-03-25'); await search.press('Tab')
  await expect(matches).toHaveValue(target.key)
  await expect(matches.locator('option')).toHaveCount(4)
  await expect(page.getByText('Viser 1 av 1 alternativer, nærmeste dato først. Det tidligere valget vises også, selv om det ikke passer søket.', { exact: false })).toBeVisible()
  await page.screenshot({ path: info.outputPath('beyond-twenty-candidates.png'), fullPage: true })
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const after = await saved(page)
  expect(after.planner.events).toHaveLength(25)
  expect(after.planner.events.map(event => event.id).sort()).toEqual(state.planner.events.map(event => event.id).sort())
  expect(after.planner.events.find(event => event.id === target.targetId).start).toBe('2041-04-01T10:00:00Z')
})
