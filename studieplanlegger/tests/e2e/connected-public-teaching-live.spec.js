import { test, expect } from '@playwright/test'
import { navigate, openCourseImport, openImportMethod, key } from './helpers.js'

test.describe.configure({ mode: 'serial' })

// These are explicit choices made by the isolated test student. They do not
// infer a real student's campus, group, programme, or teaching term.
const samples = [
  ['uit', 'INF-0101', /INF-0101.*undervisningstermin 1/, 1440],
  ['uib', 'INF100', /INF100.*undervisningstermin 1/, 390],
  ['oslomet', 'DAPE1400', /DAPE1400.*undervisningstermin 1/, 390],
  ['nord', 'FIN5002', /FIN5002.*undervisningstermin 1/, 390],
  ['inn', 'PSY1009', /PSY1009.*undervisningstermin 1/, 1440],
  ['uis', 'BST120', /BST120.*undervisningstermin 1/, 390],
  ['uio', 'IN1000', /IN1000.*undervisningstermin 1/, 1440],
  ['uia', 'IS-100', /IS-100.*undervisningstermin 1/, 390],
  ['hiof', 'ITF10219', /ITF10219.*undervisningstermin 1/, 390],
  ['ldh', 'BSY-121A', /BSY-121A.*2026.*Høst/i, 390],
  ['steiner', 'D-MAT1.1', /D-MAT1\.1.*2026.*HØST/i, 390],
  ['hivolda', 'ANI161', /ANI161.*2026.*HØST/i, 1440],
  ['kristiania', 'PGR102', /PGR102.*2026.*HØST/i, 390, '161320.5'],
  ['nih', 'IDR107', /IDR107_1_2026.*HØST/i, 390, '25097.10'],
  ['himolde', 'IBE110', /IBE110.*undervisningstermin 1/i, 390, 'IBE110¤1'],
  ['himolde', 'IBE430', /IBE430.*undervisningstermin 1/i, 1440, 'IBE430¤1'],
  ['himolde', 'IBE160', /IBE160.*undervisningstermin 1/i, 390, 'IBE160¤1'],
]
for (const [institution, code, objectLabel, width, expectedSourceObjectId] of samples) test(`live public teaching for saved course: ${institution} ${code}`, async ({ page }, testInfo) => {
  test.skip(process.env.RUN_LIVE_TEACHING !== '1', 'Opt-in bounded public source requests')
  test.setTimeout(120000)
  await page.setViewportSize({ width, height: 1000 })
  const errors = [], saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.evaluate(({ key, institution, code }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [{ id: 'test-course', code, name: code, university: institution, year: 2026, semester: 'autumn', credits: null, notes: '' }], events: [], sources: [] } })), { key, institution, code })
  await page.reload()
  let first, selectedLabel, sourceEvidence
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await saved()
    await navigate(page, 'subjects')
    await openImportMethod(page, 'calendar')
    await page.getByText('Finn offentlig undervisning for et lagret emne', { exact: true }).click()
    await page.getByRole('combobox', { name: 'Lærested for offentlig undervisning', exact: true }).selectOption(institution)
    await page.getByRole('combobox', { name: 'Lagret emne for undervisning', exact: true }).selectOption('test-course')
    await expect(page.getByLabel('Emnekode, emnenavn eller publisert kullnavn', { exact: true })).toHaveValue(code)
    await page.getByRole('button', { name: 'Søk offentlig undervisning', exact: true }).click()
    const options = page.getByRole('combobox', { name: 'Publisert timeplanvalg', exact: true })
    await expect(options).toBeVisible({ timeout: 45000 })
    await expect(options).toHaveValue('')
    const items = await options.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label: node.textContent })))
    const selected = items.find(item => item.value !== '' && item.label.includes(code) && objectLabel.test(item.label))
    expect(selected, JSON.stringify(items)).toBeTruthy()
    selectedLabel = selected.label
    await options.selectOption(selected.value)
    const calendarResponse = expectedSourceObjectId ? page.waitForResponse(response => response.url().includes(`/api/import/providers/${institution}/teaching-calendar?`)) : null
    await page.getByRole('button', { name: 'Forhåndsvis valgt offentlig undervisning', exact: true }).click()
    if (calendarResponse) {
      const result = await (await calendarResponse).json()
      expect(result.status).toBe('ok')
      expect(result.selected.sourceObjectId).toBe(expectedSourceObjectId)
      sourceEvidence = { ...sourceEvidence, sourceObjectId: result.selected.sourceObjectId, publicationBoundaries: result.publicationBoundaries, rawEvents: (result.calendar.match(/^BEGIN:VEVENT\s*$/gm) || []).length }
    }
    const preview = page.locator('#import-preview')
    await expect(preview).toBeVisible({ timeout: 45000 })
    await preview.locator('summary').filter({ hasText: /^Aktivitetsutvalg/ }).click()
    const groups = preview.locator('.activity-choices input')
    await expect(groups.first()).toBeVisible()
    const labelsDoNotOverlap = await preview.locator('.activity-choices label').evaluateAll(labels => labels.every((label, index) => !labels[index + 1] || label.getBoundingClientRect().bottom <= labels[index + 1].getBoundingClientRect().top))
    expect(labelsDoNotOverlap).toBe(true)
    expect(await saved()).toEqual(before)
    if (attempt === 0) expect(await groups.evaluateAll(nodes => nodes.every(node => !node.checked))).toBe(true)
    await groups.first().check()
    if (institution === 'kristiania' && attempt === 0) {
      const sourceDetails = preview.locator('.source-details')
      await sourceDetails.locator('summary').click()
      sourceEvidence.warnings = await sourceDetails.locator('.import-warning').allTextContents()
      expect(sourceEvidence.warnings.some(text => /manglende eller ugyldig varighet/.test(text))).toBe(true)
      for (const screenshotWidth of [390, 1440]) {
        await page.setViewportSize({ width: screenshotWidth, height: 1000 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
        await page.screenshot({ path: testInfo.outputPath(`public-teaching-preview-${screenshotWidth}.png`), fullPage: true })
      }
      await page.setViewportSize({ width, height: 1000 })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (attempt === 0) await page.screenshot({ path: testInfo.outputPath('public-teaching-preview.png'), fullPage: true })
    await preview.getByRole('button', { name: 'Bekreft import', exact: true }).click()
    await expect(preview).toBeHidden()
    const current = await saved()
    expect(current.planner.courses).toHaveLength(1)
    expect(current.planner.sources).toHaveLength(1)
    expect(current.planner.events.length).toBeGreaterThan(0)
    expect(current.planner.events.every(event => event.courseId === 'test-course')).toBe(true)
    expect(current.tasks).toHaveLength(0)
    if (first) {
      expect(current.planner.events.map(event => event.id)).toEqual(first.planner.events.map(event => event.id))
      expect(current.planner.sources[0].id).toBe(first.planner.sources[0].id)
    } else first = current
    await page.reload()
    expect((await saved()).planner.events).toEqual(current.planner.events)
  }
  expect(errors).toEqual([])
  await testInfo.attach('public-teaching-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), institution, code, selectedLabel, sourceEvidence, events: first.planner.events.length, eventIds: first.planner.events.map(event => event.id), scope: 'Actual public teaching for one explicitly selected object, saved existing course and activity selection; preview, save, reload and repeat. Does not verify programme import or personal group membership.' }, null, 2) })
})

for (const code of ['ARK1001', 'EXPH0100']) test(`live NTNU course and teaching round-trip: ${code}`, async ({ page }, testInfo) => {
  test.skip(process.env.RUN_LIVE_TEACHING !== '1', 'Opt-in bounded public source requests')
  test.setTimeout(180000)
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } })), key)
  await page.reload()
  let first
  for (let attempt = 0; attempt < 2; attempt++) {
    await navigate(page, 'subjects')
    await openCourseImport(page)
    await page.getByRole('button', { name: 'Neste: søk og semester', exact: true }).click()
    const form = page.locator('#course-import-form')
    await form.locator('[name=code]').fill(code)
    await form.locator('[name=semester]').selectOption('autumn')
    await form.locator('[name=year]').fill('2026')
    await form.getByRole('button', { name: 'Søk emner', exact: true }).click()
    const result = page.locator('.wizard-results button').filter({ hasText: code }).first()
    await expect(result).toBeVisible({ timeout: 45000 })
    await result.click()
    const preview = page.locator('#import-preview')
    await expect(preview).toBeVisible({ timeout: 45000 })
    await preview.getByRole('button', { name: 'Hent undervisning fra TP', exact: true }).click()
    await preview.locator('summary').filter({ hasText: /^Aktivitetsutvalg/ }).click()
    await expect(preview.locator('.activity-choices input').first()).toBeVisible({ timeout: 45000 })
    const choices = preview.locator('.activity-choices input')
    expect(await choices.evaluateAll(nodes => nodes.some(node => !node.checked))).toBe(true)
    await preview.getByRole('button', { name: 'Velg ingen aktiviteter', exact: true }).click()
    expect(await choices.evaluateAll(nodes => nodes.every(node => !node.checked))).toBe(true)
    await choices.first().check()
    const previewRows = preview.locator('.preview-events li')
    await expect(previewRows.first()).toBeVisible()
    const previewText = await previewRows.first().innerText()
    await preview.getByRole('button', { name: 'Bekreft import', exact: true }).click()
    await expect(preview).toBeHidden()
    const current = await saved(), course = current.planner.courses.find(item => item.code === code)
    expect(course).toBeTruthy()
    expect(course.teachingCheck).toMatchObject({ status: 'success', eventCount: expect.any(Number) })
    expect(course.teachingCheck.eventCount).toBeGreaterThan(0)
    expect(current.planner.sources).toHaveLength(1)
    expect(current.planner.events.length).toBeGreaterThan(0)
    expect(current.planner.events.every(event => event.courseId === course.id && Number.isFinite(Date.parse(event.start)) && Number.isFinite(Date.parse(event.end)) && Date.parse(event.end) > Date.parse(event.start))).toBe(true)
    const distinctGroups = new Set(current.planner.events.map(event => event.group))
    expect(current.planner.sources[0].groups.length).toBeGreaterThan(0)
    if (distinctGroups.size > 1) expect(current.planner.sources[0].groups.length).toBeLessThan(distinctGroups.size)
    const selectedEvent=current.planner.events.find(event => !event.excluded)||current.planner.events[0],compact=text=>text.replace(/[·\s]+/g,' ').trim()
    expect(compact(previewText)).toContain(compact(selectedEvent.title))
    expect(compact(await page.locator('#event-list').innerText())).toContain(compact(selectedEvent.title))
    const courseCard=page.locator('.course-card').filter({hasText:code})
    await expect(courseCard.locator('[data-teaching-check=success]')).toContainText(`${course.teachingCheck.eventCount} publiserte undervisningsøkter ble hentet`)
    await expect(courseCard.locator('[data-teaching-check=success]')).not.toContainText('0 publiserte')
    if (first) {
      expect(current.planner.events.map(event => [event.id, event.sourceKey, event.start, event.end, event.courseId])).toEqual(first.planner.events.map(event => [event.id, event.sourceKey, event.start, event.end, event.courseId]))
      expect(current.planner.sources[0].id).toBe(first.planner.sources[0].id)
      expect(current.planner.courses[0].id).toBe(first.planner.courses[0].id)
    } else {
      first = current
      await page.screenshot({ path: testInfo.outputPath(`ntnu-${code}-teaching-preview-saved.png`), fullPage: true })
    }
    await page.reload()
    expect((await saved()).planner.events).toEqual(current.planner.events)
  }
  expect(errors).toEqual([])
  await testInfo.attach('ntnu-live-teaching-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), code, events: first.planner.events.map(event => ({ id: event.id, sourceKey: event.sourceKey, start: event.start, end: event.end, courseId: event.courseId, group: event.group })), selectedGroups: first.planner.sources[0].groups, scope: 'Actual public NTNU course metadata and timetable through preview, one explicit activity choice, save, rendered teaching, reload and repeat. No claim of complete or personal group membership.' }, null, 2) })
})
