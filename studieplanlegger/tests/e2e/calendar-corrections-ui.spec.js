import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { navigate, reveal } from './helpers.js'
import { preview, eventRows, openTpImport, confirmTpImport, savedTpState, tpCsv, tpCsvRows, runtimeUrl, runtimeScenario } from './tp-csv-helpers.js'

// Independently invented input, identical to the eleven-row October 24 baseline.
// No private calendar or live institutional source is used.
const headers = tpCsv().split(/\r?\n/)[0].split(';')
const elevenRows = () => Array.from({ length: 11 }, (_, i) => ({
  ...Object.fromEntries(headers.map(key => [key, ''])), semesterid: '43h', courseid: 'SYN643', 'title-intro': 'SYN643', courseversion: '1',
  actid: `oct24-csv-invented-act-${i}`, id: 'oct24-csv-invented-group',
  dtstart: `2043-09-${String(i + 3).padStart(2, '0')}T${i === 5 ? '14:20' : '09:30'}+02:00`,
  dtend: `2043-09-${String(i + 3).padStart(2, '0')}T${i === 5 ? '14:20' : '10:15'}+02:00`,
  lopenr: String(i + 1), 'teaching-method': 'SYNTH', party: '', 'teaching-method-name': 'Oppdiktet verksted',
  'teaching-title': `Oppdiktet mosaikkøvelse ${i + 1}`, 'teaching-title_nb': `Oppdiktet mosaikkøvelse ${i + 1}`,
  summary_nb: 'Selvstendig syntetisk kontroll.', room: 'Oppdiktet fargerom', aid: `oct24-csv-invented-aid-${i}`, active: '1', eventid: `oct24-csv-invented-event-${i}`,
}))
const confirm = page => preview(page).getByRole('button', { name: 'Importer valgte', exact: true })
const status = page => preview(page).locator('.document-confirmation-summary')
async function visibleMetrics(page) {
  return preview(page).evaluate(root => {
    const visible = node => node.checkVisibility() && !node.closest('details:not([open])')
    const button = [...root.querySelectorAll('button')].find(node => node.textContent === 'Importer valgte'), rect = button.getBoundingClientRect()
    return { visibleFields: [...root.querySelectorAll('input:not([type=checkbox]),select,textarea')].filter(visible).length,
      visibleRequiredAttributes: [...root.querySelectorAll('[required]')].filter(visible).length,
      primary: { top: rect.top, bottom: rect.bottom, fullyWithinViewport: rect.top >= 0 && rect.bottom <= innerHeight },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth }
  })
}
async function screenshot(page, info, name) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))) })
  await page.screenshot({ path: info.outputPath(name) })
}
test.use({ trace: 'off' })
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic correction fixture: no external source.' } }))
  await page.goto(runtimeUrl || '/')
})

for (const [name, width, height, fontSize] of [['desktop', 1365, 950, 16], ['mobile390', 390, 844, 16], ['mobile390-large', 390, 844, 24]]) {
  test(`correction confirmation ${name}: same eleven rows, one decision, no required typing`, async ({ page }, info) => {
    test.skip(Boolean(runtimeUrl), 'The layout matrix uses isolated browser storage; runtime has a separate identity journey.')
    await page.setViewportSize({ width, height })
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px` }, fontSize)
    await openTpImport(page, { text: tpCsvRows(elevenRows()), name: 'independent-eleven-time-question.csv' })
    const row = eventRows(page).nth(5), choice = row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true })
    await expect(eventRows(page)).toHaveCount(11)
    await choice.scrollIntoViewIfNeeded(); await choice.focus()
    const before = await visibleMetrics(page)
    await screenshot(page, info, `${name}-before-point.png`)
    await info.attach('before-decision-metrics', { body: JSON.stringify(before), contentType: 'application/json' })
    expect(before.primary.fullyWithinViewport).toBe(true)
    expect(before.visibleFields).toBe(1)
    expect(before.visibleRequiredAttributes).toBe(0)
    expect(before.horizontalOverflow).toBe(false)
    await expect(row).toContainText('Oppdiktet mosaikkøvelse 6')
    await expect(row).toContainText('2043-09-08 14:20')
    await expect(row).toContainText('Kilden oppgir samme tidspunkt for start og slutt.')
    await expect(choice.locator('option')).toHaveText(['Avklar tidspunkt', 'Rett tiden', 'Vis som tidspunkt uten varighet', 'Ikke importer denne'])
    expect(await choice.evaluate(node => Math.abs(node.getBoundingClientRect().width - node.closest('.document-preview-fields').getBoundingClientRect().width))).toBeLessThan(2)
    await expect(status(page)).toContainText('10 av 11 aktiviteter klare')
    await expect(status(page)).toContainText('1 må avklares')
    // Native keyboard selection preserves the existing one semantic decision.
    await choice.press('Home'); await choice.press('ArrowDown'); await choice.press('ArrowDown'); await choice.press('Enter'); await choice.press('Escape')
    await expect(choice).toHaveValue('point'); await expect(choice).toBeFocused()
    await expect(status(page)).toContainText('11 av 11 aktiviteter klare')
    await expect(status(page)).toContainText('0 må avklares')
    const after = await visibleMetrics(page)
    expect(after.primary.fullyWithinViewport).toBe(true)
    expect(after.visibleFields).toBe(1)
    await screenshot(page, info, `${name}-after-point.png`)
    await info.attach('after-decision-metrics', { body: JSON.stringify({ ...after, minimumActionsFromMineEmner: 5, requiredTimeDecisions: 1, requiredManualTextValues: 0 }), contentType: 'application/json' })
    writeFileSync(info.outputPath(`${name}-measurements.json`), JSON.stringify({ before, after, minimumActionsFromMineEmner: 5, requiredTimeDecisions: 1, requiredManualTextValues: 0 }, null, 2))
    // Reach the single confirmation by actual reverse tab traversal.
    for (let i = 0; i < 20 && !await confirm(page).evaluate(node => node === document.activeElement); i++) await page.keyboard.press('Shift+Tab')
    await expect(confirm(page)).toBeFocused(); await expect(confirm(page)).toBeInViewport()
    await screenshot(page, info, `${name}-keyboard-confirmation.png`)
    await page.keyboard.press('Enter')
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
    const state = await savedTpState(page), point = state.planner.events.find(event => event.title === 'Oppdiktet mosaikkøvelse 6')
    expect(state.planner.events).toHaveLength(11)
    expect(point).toMatchObject({ point: true, pointProvenance: 'user', start: '2043-09-08T12:20:00Z', end: '2043-09-08T12:20:00Z' })
    await page.reload(); expect((await savedTpState(page)).planner).toEqual(state.planner)
  })
}

test('correction causes: distinguish missing and invalid end while allowing correction and omission', async ({ page }) => {
  test.skip(Boolean(runtimeUrl), 'Runtime persistence is covered by the identity journey.')
  const rows = elevenRows().slice(0, 3); rows[0].dtend = ''; rows[1].dtend = 'synthetic-invalid-end'
  await openTpImport(page, { text: tpCsvRows(rows), name: 'synthetic-distinct-end-causes.csv' })
  const missing = eventRows(page).nth(0), invalid = eventRows(page).nth(1)
  await expect(missing).toContainText('Sluttidspunktet mangler.')
  await expect(invalid).toContainText('Sluttidspunktet er ugyldig.')
  await missing.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('interval')
  await missing.getByLabel('Slutt i norsk tid', { exact: true }).fill('2043-09-03T10:30')
  await invalid.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('omit')
  await expect(status(page)).toContainText('2 av 2 aktiviteter klare')
  await confirmTpImport(page)
  const state = await savedTpState(page)
  expect(state.planner.events).toHaveLength(2)
  expect(state.importSources[0].excludedKeys).toHaveLength(1)
  expect(state.planner.events[0]).toMatchObject({ start: '2043-09-03T07:30:00Z', end: '2043-09-03T08:30:00Z' })
})

const mixedName = 'synthetic-compact-institutions.ics'
const mixed = (omit = false) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...[
  ['SYN744', 'Oppdiktet keramikk', 'HiMolde'], ['SYN744', 'Oppdiktet astronomi', 'NTNU'], ['SYN745', 'Oppdiktet botanikk', ''],
].flatMap(([code, name, university], index) => [
  'BEGIN:VEVENT', `UID:synthetic-compact-course-${index}`, `SUMMARY:Oppdiktet kursøkt ${index}`,
  `X-COURSE-CODE:${code}`, `X-COURSE-NAME:${name}`, ...(!omit && university ? [`X-UNIVERSITY:${university}`] : []),
  `DTSTART:2043090${index + 3}T073000Z`, `DTEND:2043090${index + 3}T081500Z`, 'END:VEVENT',
]), 'END:VCALENDAR'].join('\r\n')
async function openMixedImport(page, { omit = false, sourceId } = {}) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  if (sourceId) await (await reveal(page.getByLabel('Ny kilde eller oppdatering', { exact: true }))).selectOption(sourceId)
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: mixedName, mimeType: 'text/calendar', buffer: Buffer.from(mixed(omit)) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(preview(page)).toBeVisible()
}
test('correction institutions: compact names and same-code identities survive explicit unknown and reimport', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'correction-ui', 'Separate isolated runtime scenario.')
  await openMixedImport(page)
  const affiliations = preview(page).locator('.document-affiliation')
  await reveal(affiliations.first().locator('select'))
  await expect(affiliations).toHaveCount(3)
  for (const [index, name] of ['Oppdiktet keramikk', 'Oppdiktet astronomi', 'Oppdiktet botanikk'].entries()) {
    await expect(affiliations.nth(index).locator('.document-affiliation-name')).toHaveText(new RegExp(name))
    await expect(affiliations.nth(index).locator('select option')).toHaveCount(50)
  }
  const firstCourse = preview(page).locator('.document-preview-row').filter({ has: page.locator('[data-field=courseTarget]') }).first()
  const year = firstCourse.getByLabel('År', { exact: true })
  await (await reveal(year)).fill('2044')
  await expect(affiliations.first().locator('.document-affiliation-context')).toHaveText('Høst · 2044')
  await year.fill('2043')
  await firstCourse.locator(':scope > summary').click()
  const common = preview(page).getByLabel('Lærested for emner uten institusjon', { exact: true })
  await common.selectOption('HiMolde')
  await preview(page).getByRole('button', { name: 'Bruk lærested og finn emnenavn', exact: true }).click()
  await expect(affiliations.nth(0).locator('select')).toHaveValue('HiMolde')
  await expect(affiliations.nth(1).locator('select')).toHaveValue('NTNU')
  await expect(affiliations.nth(2).locator('select')).toHaveValue('HiMolde')
  await affiliations.nth(2).locator('select').focus()
  await affiliations.nth(2).locator('select').selectOption('')
  await expect(affiliations.nth(2).locator('select')).toBeFocused()
  await screenshot(page, info, 'compact-institutions-desktop.png')
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { document.documentElement.style.fontSize = '24px' })
  await affiliations.nth(1).scrollIntoViewIfNeeded()
  expect((await visibleMetrics(page)).horizontalOverflow).toBe(false)
  await screenshot(page, info, 'compact-institutions-mobile-large.png')
  await confirmTpImport(page)
  const state = await savedTpState(page), courses = state.planner.courses
  expect(courses.map(({ code, name, university }) => ({ code, name, university }))).toEqual([
    { code: 'SYN744', name: 'Oppdiktet keramikk', university: 'HiMolde' }, { code: 'SYN744', name: 'Oppdiktet astronomi', university: 'NTNU' }, { code: 'SYN745', name: 'Oppdiktet botanikk', university: '' },
  ])
  expect(new Set(courses.map(course => course.id)).size).toBe(3)
  expect(state.planner.events.map(event => event.courseId)).toEqual(courses.map(course => course.id))
  await page.reload(); expect((await savedTpState(page)).planner).toEqual(state.planner)
  await openMixedImport(page, { omit: true, sourceId: state.importSources[0].id })
  await confirmTpImport(page)
  expect((await savedTpState(page)).planner).toEqual(state.planner)
})

test('correction persisted institutions: fresh browser retains exact same-code affiliations after recreation', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'correction-ui' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime harness only.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected)
  const source = expected.importSources.find(item => item.name === mixedName)
  expect(source).toBeTruthy()
  expect(expected.planner.courses.map(course => course.university)).toEqual(['HiMolde', 'NTNU', ''])
  expect(new Set(expected.planner.courses.map(course => course.id)).size).toBe(3)
  expect(expected.planner.events.map(event => event.courseId)).toEqual(expected.planner.courses.map(course => course.id))
  await openMixedImport(page, { omit: true, sourceId: source.id })
  await expect(preview(page).locator(':scope > [role=status]').first()).toContainText('0 må avklares')
  await confirmTpImport(page)
  const repeated = await savedTpState(page), repeatedSource = repeated.importSources.find(item => item.id === source.id)
  expect(repeated.planner).toEqual(expected.planner)
  expect(repeated.tasks).toEqual(expected.tasks)
  expect(repeated.importSources).toHaveLength(expected.importSources.length)
  expect(repeatedSource.entries).toEqual(source.entries)
  expect(repeatedSource.excludedKeys).toEqual(source.excludedKeys)
})
