import { test, expect } from '@playwright/test'
import { Temporal } from '@js-temporal/polyfill'
import { navigate, key } from './helpers.js'

// Opt-in checks use the real public API in a fresh browser context. They never
// read an existing browser profile or replace a source response with a fixture.
// Traces are disabled because source-list responses contain public sharing keys.
test.use({ trace: 'off', video: 'off' })

const samples = [
  { kind: 'fih', button: 'Hent offentlige Fjellhaug-klasser', className: 'BTFL 1. år · PDF-oversikt', classes: 29, events: 164, unresolved: 0, selectedTitle: 'BTM1001/RLE1001 (R)' },
  { kind: 'ansgar', button: 'Hent offentlige Ansgar-timeplaner', className: 'Årsstudium i psykologi / Bachelor i psykologi · Første år', classes: 16, events: 87, unresolved: 3, selectedTitle: 'PSY131 Innføring i psykologiens perspektiver' },
]
const utc = local => Temporal.PlainDateTime.from(local).toZonedDateTime('Europe/Oslo').toInstant().toString({ fractionalSecondDigits: 3 })

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
    await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
    await page.getByRole('button', { name: 'Fra kalenderfil eller lenke', exact: true }).click()
    const form = page.locator('.institutional-calendar-import')
    if (!await form.evaluate(node => node.open)) await form.locator(':scope > summary').click()
    await form.getByRole('combobox', { name: 'Offentlig kalenderkilde', exact: true }).selectOption(sample.kind)
    await form.getByRole('button', { name: sample.button, exact: true }).click()
    const classes = form.getByRole('combobox', { name: 'Publisert klasseplan', exact: true })
    await expect(classes.locator('option')).toHaveCount(sample.classes + 1, { timeout: 60_000 })
    await expect(classes).toHaveValue('')
    await classes.selectOption({ label: sample.className })
    await form.getByLabel('Kalenderår', { exact: true }).fill('2026')
    await form.getByRole('combobox', { name: 'Kalendersemester', exact: true }).selectOption('autumn')
    const before = await saved()
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/import/calendar') && response.request().method() === 'POST')
    await form.getByRole('button', { name: 'Forhåndsvis institusjonskalender', exact: true }).click()
    const response = await responsePromise, result = await response.json()
    expect(response.status()).toBe(200)
    expect(result.sourceKind).toBe(`${sample.kind}-public-class`)
    expect(result.authoritative).toBe(false)
    expect(result.count).toBe(sample.events)
    expect(result.unresolved || []).toHaveLength(sample.unresolved)
    const preview = form.locator('.document-preview')
    await expect(preview.getByRole('heading', { name: 'Kontroller planen før import', exact: true })).toBeVisible({ timeout: 60_000 })
    expect(await saved()).toEqual(before)
    const rows = preview.locator('.document-preview-row')
    await expect(rows).toHaveCount(sample.events)
    const validPreviewEvents = await rows.count()
    await expect(rows.getByLabel('Emne (valgfritt)', { exact: true })).toHaveCount(sample.events)
    expect(await rows.locator('input[type=checkbox]').evaluateAll(nodes => nodes.every(node => !node.checked))).toBe(true)
    expect(await rows.getByLabel('Emne (valgfritt)', { exact: true }).evaluateAll(nodes => nodes.every(node => node.value === ''))).toBe(true)
    if (sample.unresolved) await expect(preview).toContainText('Uavklart')
    const selectedIndex = await rows.evaluateAll(nodes => nodes.findIndex(node => {
      const value = node.querySelector('input[type=datetime-local]')?.value
      return value >= '2026-09-12' && value < '2026-10-01'
    }))
    expect(selectedIndex).toBeGreaterThanOrEqual(0)
    const selected = rows.nth(selectedIndex)
    if (!await selected.evaluate(node => node.open)) await selected.locator(':scope > summary').click()
    const selectedFields = {
      title: await selected.getByLabel('Navn', { exact: true }).inputValue(),
      start: utc(await selected.getByLabel('Start i norsk tid', { exact: true }).inputValue()),
      end: utc(await selected.getByLabel('Slutt i norsk tid', { exact: true }).inputValue()),
    }
    expect(selectedFields.title).toBe(sample.selectedTitle)
    await selected.getByRole('checkbox', { name: 'Ta med i planen', exact: true }).check()
    expect(await rows.locator('input[type=checkbox]:checked').count()).toBe(1)
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
    await preview.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
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
    evidence.runs.push({ responseStatus: response.status(), rawSourceEvents: result.count, validPreviewEvents, unresolvedSourceRows: (result.unresolved || []).length, selectedEvents: 1, savedEvents: state.planner.events.length, savedCourses: state.planner.courses.length, savedTasks: state.tasks.length, savedSources: state.importSources.length, selectedEvent: selectedFields, sourceId: state.importSources[0].id, eventId: state.planner.events[0].id })
    await page.reload()
    expect((await saved()).planner).toEqual(state.planner)
    expect((await saved()).importSources).toEqual(state.importSources)
  }
  expect(pageErrors).toEqual([])
  evidence.scope = 'Actual public class choice to isolated local app; no fixture responses. Preview writes nothing; one explicit activity is preserved through reload and repeat. No course or personal membership was inferred. Source sharing keys are omitted from this evidence.'
  await info.attach('real-public-class-evidence', { contentType: 'application/json', body: JSON.stringify(evidence, null, 2) })
})
