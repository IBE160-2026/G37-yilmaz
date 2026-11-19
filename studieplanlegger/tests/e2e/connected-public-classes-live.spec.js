import { reveal } from './helpers.js'
import { test, expect } from '@playwright/test'
import { Temporal } from '@js-temporal/polyfill'
import { navigate, key } from './helpers.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { filterInstitutionalSemester } from '../../src/institutional-calendar-period.js'

// Opt-in checks use the real public API in a fresh browser context. They never
// read an existing browser profile or replace a source response with a fixture.
// Traces are disabled because source-list responses contain public sharing keys.
test.use({ trace: 'off', video: 'off' })

const samples = [
  { kind: 'fih', button: 'Hent offentlige Fjellhaug-klasser', className: 'BTFL 1. år · PDF-oversikt' },
  { kind: 'ansgar', button: 'Hent offentlige Ansgar-timeplaner', className: 'Årsstudium i psykologi / Bachelor i psykologi · Første år', selectedTitle: 'PSY131 Innføring i psykologiens perspektiver' },
]
const utc = local => Temporal.PlainDateTime.from(local).toZonedDateTime('Europe/Oslo').toInstant().toString({ fractionalSecondDigits: 3 })
const period = { year: 2026, semester: 'autumn' }

for (const sample of samples) test(`live ${sample.kind} public class preview, explicit selection, save, reload and repeat`, async ({ page }, info) => {
  test.skip(process.env.RUN_LIVE_PUBLIC_CLASSES !== '1', 'Requires an explicitly authorized check of actual public class sources')
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  const evidence = { checkedAt: new Date().toISOString(), kind: sample.kind, selectedClass: sample.className, calendarSemester: '2026 Høst', runs: [] }
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto('/')
  expect(await saved()).toBeNull()
  let first
  for (let attempt = 0; attempt < 2; attempt++) {
    await navigate(page, 'subjects')
    await (await reveal(page.getByRole('button', { name: 'Finn studieprogram', exact: true }))).click()
    await (await reveal(page.getByRole('button', { name: 'Fra kalenderlenke', exact: true }))).click()
    const form = page.locator('.institutional-calendar-import')
    if (!await form.evaluate(node => node.open)) await form.locator(':scope > summary').click()
    await (await reveal(form.getByRole('combobox', { name: 'Offentlig kalenderkilde', exact: true }))).selectOption(sample.kind)
    await (await reveal(form.getByRole('button', { name: sample.button, exact: true }))).click()
    const classes = form.getByRole('combobox', { name: 'Publisert klasseplan', exact: true })
    await expect(classes.locator('option', { hasText: sample.className })).toHaveCount(1, { timeout: 60_000 })
    await expect(classes).toHaveValue('')
    await (await reveal(classes)).selectOption({ label: sample.className })
    await (await reveal(form.getByLabel('Kalenderår', { exact: true }))).fill('2026')
    await (await reveal(form.getByRole('combobox', { name: 'Kalendersemester', exact: true }))).selectOption('autumn')
    const before = await saved()
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/import/calendar') && response.request().method() === 'POST')
    await (await reveal(form.getByRole('button', { name: 'Forhåndsvis institusjonskalender', exact: true }))).click()
    const response = await responsePromise, result = await response.json()
    expect(response.status()).toBe(200)
    expect(result.sourceKind).toBe(`${sample.kind}-public-class`)
    expect(result.authoritative).toBe(false)
    expect(result.count).toBe((result.calendar.match(/^BEGIN:VEVENT\r?$/gm) || []).length)
    const scoped = filterInstitutionalSemester(parseDocumentIcs(result.calendar, period), period)
    const expectedEvents = scoped.rows.filter(row => row.kind === 'event')
    const expectedCourses = scoped.rows.filter(row => row.kind === 'course')
    expect(expectedEvents.length).toBeGreaterThan(0)
    const preview = form.locator('.document-preview')
    await expect(preview.getByRole('heading', { name: 'Dette fant jeg', exact: true })).toBeVisible({ timeout: 60_000 })
    expect(await saved()).toEqual(before)
    const rows = preview.locator('.document-preview-row')
    await expect(rows).toHaveCount(scoped.rows.length)
    if (result.unresolved?.length) await expect(preview).toContainText('Uavklart')
    const target = expectedEvents.find(row => sample.selectedTitle ? row.title === sample.selectedTitle : !!row.endLocal)
    expect(target).toBeTruthy()
    const selected = preview.locator(`.document-preview-row[data-row-index="${scoped.rows.indexOf(target)}"]`)
    const choice = selected.getByRole('checkbox', { name: 'Ta med i planen', exact: true, includeHidden: true })
    await reveal(choice)
    const selectedFields = {
      title: await selected.getByLabel('Navn', { exact: true }).inputValue(),
      start: utc(await selected.getByLabel('Start i norsk tid', { exact: true }).inputValue()),
      end: utc(await selected.getByLabel('Slutt i norsk tid', { exact: true }).inputValue()),
    }
    expect(selectedFields).toEqual({ title: target.title, start: target.originalStart, end: target.originalEnd })
    expect(await rows.locator('input[data-field=selected]:checked').count()).toBe(attempt)
    await choice.check()
    expect(await rows.locator('input[data-field=selected]:checked').count()).toBe(1)
    if (!attempt) {
      await selected.scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`${sample.kind}-class-preview-mobile.png`) })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await page.setViewportSize({ width: 1440, height: 1000 })
      await selected.scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`${sample.kind}-class-preview-desktop.png`) })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await page.setViewportSize({ width: 390, height: 844 })
    }
    expect(await saved()).toEqual(before)
    await (await reveal(preview.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
    await expect(form.getByRole('status')).toContainText('Institusjonskalender lagret')
    const state = await saved()
    expect(state.planner.courses).toEqual([])
    expect(state.tasks).toEqual([])
    expect(state.sessions || []).toEqual([])
    expect(state.planner.events).toHaveLength(1)
    expect(state.planner.events[0]).toMatchObject({ ...selectedFields, courseId: '', transparent: false, information: false })
    expect(state.importSources).toHaveLength(1)
    if (first) {
      expect(state.planner).toEqual(first.planner)
      expect(state.importSources[0].id).toBe(first.importSources[0].id)
    } else first = state
    evidence.runs.push({ responseStatus: response.status(), rawSourceEvents: result.count, validPreviewEvents: expectedEvents.length, proposedCourses: expectedCourses.length, unresolvedSourceRows: (result.unresolved || []).length, selectedEvents: 1, savedEvents: state.planner.events.length, savedCourses: state.planner.courses.length, savedTasks: state.tasks.length, savedSources: state.importSources.length, selectedEvent: selectedFields, sourceId: state.importSources[0].id, eventId: state.planner.events[0].id })
    await page.reload()
    expect((await saved()).planner).toEqual(state.planner)
    expect((await saved()).importSources).toEqual(state.importSources)
  }
  expect(pageErrors).toEqual([])
  evidence.scope = 'Actual public class choice to isolated local app; no fixture responses. Preview writes nothing; one explicit activity is preserved through reload and repeat. No course or personal membership was inferred. Source sharing keys are omitted from this evidence.'
  await info.attach('real-public-class-evidence', { contentType: 'application/json', body: JSON.stringify(evidence, null, 2) })
})
