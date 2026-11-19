import { test, expect } from '@playwright/test'
import { navigate, openImportMethod, key, reveal } from './helpers.js'

const samples = [
  { institution: 'onh', query: 'freds', program: '362-416316081a867ec4', edition: /Studieplan for bachelor i freds- og konfliktstudier 2026\/2027/, model: 'pdf-2026-2027', period: 'semester-1', code: 'SIR1010', credits: 15, campus: 'Oslo', studentCohort: '2026', pdfPath: 'https://oslonyehoyskole.no/sites/default/files/s3/' },
  { institution: 'uit', query: 'UIT-279505', program: 'UIT-279505', edition: /PDF · Studieplan Bachelor i informatikk, datamaskinsystemer gjeldende fra høsten 2025/, model: 'table-1', period: 'semester-1', code: 'INF-0101', credits: 5, campus: 'Tromsø', studentCohort: '2025', pdfId: '868804' },
  { institution: 'uit', query: 'UIT-661259', program: 'UIT-661259', edition: /PDF · Studieplan B-SYKEPL 2020 og senere/, model: 'matrix-2022', period: 'semester-1', code: 'SYP-1121', credits: 15, campus: 'Tromsø', studentCohort: '2022', pdfId: '803726' },
  { institution: 'uit', query: 'UIT-446226', program: 'UIT-446226', edition: /PDF · 2025 Studieplan Elektronikk ingeniør/, model: 'year-table-1', period: 'year-1', code: 'TEK-1507', credits: 10, campus: 'Narvik', studentCohort: '2025', calendarYear: '2025', pdfId: '870086', clarifyStudySemester: true },
]
for (const sample of samples) test(`live published programme PDF edition: ${sample.institution} ${sample.program}`, async ({ page }, info) => {
  test.skip(process.env.RUN_LIVE_PROGRAM_ARCHIVES !== '1', 'Opt-in bounded actual public PDF checks')
  test.setTimeout(180000)
  await page.setViewportSize({ width: 390, height: 1000 })
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  let first
  async function choose(control, predicate) {
    await expect.poll(() => control.locator('option').count(), { timeout: 60000 }).toBeGreaterThan(1)
    await expect(control).toBeEnabled()
    const rows = await control.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label: node.textContent })))
    const choice = rows.find(row => row.value !== '' && predicate(row))
    expect(choice, JSON.stringify(rows)).toBeTruthy(); await control.selectOption(choice.value)
    return choice
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await state()
    await navigate(page, 'subjects'); await openImportMethod(page, 'institution')
    const host = page.locator('.program-import')
    await host.locator('[name=institution]').selectOption(sample.institution)
    await host.locator('[name=programQuery]').fill(sample.query)
    await host.locator('[name=catalogueYear]').fill('2026')
    await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
    await choose(host.locator('[name=program]'), row => row.label.split(' · ').includes(sample.program))
    await choose(host.locator('[name=cohort]'), row => sample.edition.test(row.label))
    if (await host.locator('[name=studentCohort]').isVisible()) await host.locator('[name=studentCohort]').fill(sample.studentCohort)
    await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
    await choose(host.locator('[name=model]'), row => row.value === sample.model)
    await choose(host.locator('[name=studySemester]'), row => row.value === sample.period)
    if (sample.clarifyStudySemester) {
      await expect(host.locator('[name=clarifiedStudySemester]')).toBeVisible()
      await expect(host.locator('.activity-choices input:checked')).toHaveCount(0)
    }
    const calendarYear = sample.calendarYear || '2026'
    if (await host.locator('[name=calendarSemester]').isVisible()) await choose(host.locator('[name=calendarSemester]'), row => row.value === `${calendarYear}:autumn`)
    else { await host.locator('[name=clarifiedYear]').fill(calendarYear); await host.locator('[name=clarifiedSemester]').selectOption('autumn') }
    const campus = await choose(host.locator('[name=programCampus]'), row => row.label === sample.campus || sample.institution === 'uit' && row.value === '__unknown')
    for (const box of await host.locator('.activity-choices input').all()) await box.uncheck()
    await host.getByRole('checkbox', { name: new RegExp(`\\b${sample.code}\\b`) }).check()
    if (sample.clarifyStudySemester) {
      await host.getByRole('button', { name: /^(Forbered og kontroller undervisning for|Forhåndsvis (?:1 emne|\d+ emner)|Velg emner$)/ }).click()
      await expect(host.getByRole('status')).toContainText('Oppgi hvilket studiesemester')
      expect(await state()).toEqual(before)
      await host.locator('[name=clarifiedStudySemester]').fill('3')
      await host.getByRole('button', { name: /^(Forbered og kontroller undervisning for|Forhåndsvis (?:1 emne|\d+ emner)|Velg emner$)/ }).click()
      await expect(host.getByRole('status')).toContainText('innen kildens oppgitte studieår')
      expect(await state()).toEqual(before)
      await host.locator('[name=clarifiedStudySemester]').fill('1')
    }
    await host.getByRole('button', { name: /^(Forbered og kontroller undervisning for|Forhåndsvis (?:1 emne|\d+ emner)|Velg emner$)/ }).click()
    await expect(host.getByRole('button', { name: /^Legg til (?:1 emne|\d+ emner)$/ })).toBeVisible({ timeout: 60000 })
    expect(await state()).toEqual(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (!attempt) {
      await page.screenshot({ path: info.outputPath('public-pdf-edition-preview.png'), fullPage: true })
      await page.setViewportSize({ width: 1440, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await page.screenshot({ path: info.outputPath('public-pdf-edition-preview-desktop.png'), fullPage: true })
      await page.setViewportSize({ width: 390, height: 1000 })
    }
    await host.getByRole('button', { name: /^Legg til (?:1 emne|\d+ emner)$/ }).click()
    await expect(host.locator('.import-preview')).toBeHidden()
    const current = await state()
    expect(current.planner.courses).toHaveLength(1)
    expect(current.planner.events).toHaveLength(0)
    expect(current.tasks).toHaveLength(0)
    const course = current.planner.courses[0]
    expect(course.code).toBe(sample.code)
    if (sample.credits !== undefined) expect(course.credits).toBe(sample.credits)
    if (sample.pdfId) {
      expect(course.sourceUrl).toContain(`/Content/${sample.pdfId}/`)
      expect(course.programBinding.sourceEdition).toContain(`pdf-${sample.pdfId}:`)
    }
    if (sample.pdfPath) expect(course.sourceUrl).toContain(sample.pdfPath)
    expect(course.programBinding).toMatchObject({ modelId: sample.model, cohort: sample.studentCohort, studySemester: 1, calendarYear: Number(calendarYear), calendarSemester: 'autumn', campus: campus.value === '__unknown' ? '' : campus.value })
    if (first) expect(current.planner.courses.map(row => row.id)).toEqual(first.planner.courses.map(row => row.id))
    else first = current
    await page.reload(); expect((await state()).planner).toEqual(current.planner)
  }
  expect(errors).toEqual([])
  await info.attach('actual-pdf-programme-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), sample, course: first.planner.courses[0], scope: 'One actual explicitly selected public PDF edition, course and student period; preview/save/reload/repeat. No teaching or full programme/institution coverage inferred.' }, null, 2) })
})

for (const sample of [
  { program: 'UIT-661259', edition: /PDF · Studieplan B-SYKEPL 2025/ },
  { program: 'UIT-279541', edition: /PDF · Studieplan Bachelor i geovitenskap H-2025/ },
]) test(`live UiT image-table edition ${sample.program} retains existing data and offers a document alternative`, async ({ page }, info) => {
  test.skip(process.env.RUN_LIVE_PROGRAM_ARCHIVES !== '1', 'Opt-in bounded actual public PDF checks')
  test.setTimeout(180000)
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.goto('/')
  await page.locator('#connected-onboarding').getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
  await page.locator('#title').fill('Behold mitt eksisterende arbeid')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  const before = await page.evaluate(key => localStorage.getItem(key), key)
  await navigate(page, 'subjects'); await openImportMethod(page, 'institution')
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('uit')
  await host.locator('[name=programQuery]').fill(sample.program)
  await host.locator('[name=catalogueYear]').fill('2026')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  const program = host.locator('[name=program]')
  const option = program.locator('option', { hasText: sample.program })
  await expect(option).toHaveCount(1, { timeout: 60000 })
  await program.selectOption(await option.getAttribute('value'))
  const cohort = host.locator('[name=cohort]')
  const edition = cohort.locator('option', { hasText: sample.edition })
  await expect(edition).toHaveCount(1, { timeout: 60000 })
  await cohort.selectOption(await edition.getAttribute('value'))
  await host.locator('[name=studentCohort]').fill('2025')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  const message = host.locator(':scope > p[aria-live=polite]:not([role=status])')
  await expect(message).toContainText('selve emnetabellen mangler lesbar tekst', { timeout: 60000 })
  await expect(message).toContainText('en eldre plan erstatter ikke denne utgaven')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before)
  await expect(host.getByRole('button', { name: 'Hent studieplan', exact: true })).toBeEnabled()
  await expect(host.locator('.import-preview')).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('uit-image-table-explanation-mobile.png'), fullPage: true })
  await openImportMethod(page, 'document')
  await expect(await reveal(page.getByLabel('Eller lim inn tekst'))).toBeVisible()
  await page.reload()
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before)
})
