import { test, expect } from '@playwright/test'
import { navigate, key } from './helpers.js'

// Opt-in only: bounded real public requests, isolated browser storage, no accounts.
const samples = [
  { institution: 'nmh', query: 'KAKP', program: 'KAKP', code: 'EXMUS11', catalogueYear: '2022', period: /^2\./, studySemester: '3', teachingQuery: 'EXMUS11K', objectLabel: /EXMUS11K/, width: 390 },
  { institution: 'samas', query: 'tolking', program: 'DUL-1000-INNFORING-I-TOLKING-SORSAMISK-NORSK', code: 'DUL-1001', objectLabel: /DUL-1001/, unavailableTeaching: true, width: 390 },
  { institution: 'khio', query: 'BAKK', program: 'BAKK', code: 'KK101', objectLabel: /BAKK.?1/i, activityLabel: /Fagverktøy/, width: 390 },
  { institution: 'nhh', query: 'bachelor', program: 'studier:bachelor-i-okonomi-og-administrasjon', code: 'BED1', object: '29936.6', objectLabel: /^BED1, 2026 HØST/, width: 390 },
  { institution: 'nmbu', query: 'ledelse', program: '54489', code: 'MATH100', object: '101051.5', objectLabel: /^MATH100, 2026 HØST$/, width: 1440 },
  { institution: 'usn', query: 'vernepleie', program: '060', code: 'VPEMN1', objectLabel: /VPEMN1.*2026/, width: 390 },
  { institution: 'hvl', query: 'DATA', program: 'dataingenior', code: 'DAT100', object: '264289.36', objectLabel: /^DAT100, 2026 HØST, DAT100 Bergen - Dataingeniør/, width: 1440 },
  { institution: 'mf', query: 'profesjonsstudium', program: 'profesjonsstudium-teologi', code: 'TEOL1010', object: '4351.5', objectLabel: /^TEOL1010, Bibelen$/, width: 390 },
]
for (const sample of samples) test(`${sample.unavailableTeaching ? 'live programme with unusable public teaching source' : 'live public programme and TimeEdit teaching'}: ${sample.institution}`, async ({ page }, testInfo) => {
  test.skip(process.env.RUN_LIVE_TEACHING !== '1', 'Requires explicit bounded public source verification')
  test.setTimeout(180000)
  await page.setViewportSize({ width: sample.width, height: 1000 })
  const calls = [], errors = [], saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', async response => {
    if (!response.url().includes('/api/import/')) return
    try { const data = await response.json(); calls.push({ url: response.url(), status: data.status, error: data.error, completeness: data.completeness }) } catch { /* response may be cancelled by navigation */ }
  })
  async function selectValue(control, predicate) {
    await expect.poll(() => control.locator('option').count(), { timeout: 60000 }).toBeGreaterThan(1)
    await expect(control).toBeEnabled()
    const options = await control.locator('option').evaluateAll(items => items.map(o => ({ text: o.textContent, value: o.value })))
    const option = options.find(predicate)
    expect(option, `Expected published option among ${JSON.stringify(options)}`).toBeTruthy()
    await control.selectOption(option.value)
  }
  async function prepare() {
    await navigate(page, 'subjects')
    await page.locator('#connected-import-open').click()
    await page.locator('[data-method=institution]').click()
    const host = page.locator('.program-import')
    await host.locator('[name=institution]').selectOption(sample.institution)
    await host.locator('[name=programQuery]').fill(sample.query)
    await host.locator('[name=catalogueYear]').fill(sample.catalogueYear || '2026')
    await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
    await selectValue(host.locator('[name=program]'), o => o.text.startsWith(`${sample.program} ·`))
    await selectValue(host.locator('[name=cohort]'), o => o.value !== '' && (o.text.includes(sample.catalogueYear || '2026') || /oppgi/i.test(o.text)))
    if (await host.locator('[name=studentCohort]').isVisible()) await host.locator('[name=studentCohort]').fill('2026')
    await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
    await selectValue(host.locator('[name=model]'), o => o.value !== '')
    await selectValue(host.locator('[name=studySemester]'), o => (sample.period || /^1\./).test(o.text))
    if (await host.locator('[name=clarifiedStudySemester]').isVisible()) await host.locator('[name=clarifiedStudySemester]').fill(sample.studySemester || '1')
    if (await host.locator('[name=calendarSemester]').isVisible()) await selectValue(host.locator('[name=calendarSemester]'), o => o.value === '2026:autumn')
    else { await host.locator('[name=clarifiedYear]').fill('2026'); await host.locator('[name=clarifiedSemester]').selectOption('autumn') }
    await selectValue(host.locator('[name=programCampus]'), o => o.value !== '')
    // Exercise the actual published course, selected explicitly by this test student.
    for (const control of await host.locator('.activity-choices input').all()) await control.uncheck()
    await host.getByRole('checkbox', { name: new RegExp(`^${sample.code} `) }).check()
    await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
    const summary = host.getByText(`Offentlig timeplan for ${sample.code}`, { exact: true })
    await expect(summary).toBeVisible({ timeout: 60000 }); await summary.click()
    if (sample.teachingQuery) await host.getByRole('textbox', { name: `Timeplansøk for ${sample.code}`, exact: true }).fill(sample.teachingQuery)
    await host.getByRole('button', { name: `Søk offentlig undervisning for ${sample.code}`, exact: true }).click()
    const objects = host.getByLabel(`Timeplanobjekt for ${sample.code}`, { exact: true })
    await expect(objects).toHaveValue('')
    await selectValue(objects, o => o.value !== '' && sample.objectLabel.test(o.text))
    await host.getByRole('button', { name: `Hent valgt timeplan for ${sample.code}`, exact: true }).click()
    if (sample.unavailableTeaching) {
      const details = host.locator('details').filter({ has: page.locator(':scope > summary').filter({ hasText: 'Kildeopplysninger og mangler' }) })
      if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').click()
      await expect(host).toContainText('En økt mangler navn eller kilde-ID og er utelatt.')
      await expect(host).toContainText('En økt har manglende eller ugyldig varighet og er utelatt.')
      return host
    }
    await host.locator('summary').filter({ hasText: new RegExp(`^(?:Aktivitetsutvalg|Undervisningsgrupper) for ${sample.code}`) }).click()
    const groups = host.getByRole('group', { name: new RegExp(`^(?:Aktivitetsutvalg|Undervisningsgrupper) for ${sample.code}$`) })
    await expect(groups.getByRole('checkbox').first()).toBeVisible({ timeout: 60000 })
    if (sample.activityLabel) await groups.getByRole('checkbox', { name: sample.activityLabel }).first().check()
    else await groups.getByRole('checkbox').first().check()
    return host
  }
  await page.goto('/')
  let first
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await saved(), host = await prepare()
    expect(await saved()).toEqual(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (attempt === 0) await page.screenshot({ path: testInfo.outputPath('real-teaching-preview.png'), fullPage: true })
    await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
    await expect.poll(async () => (await saved())?.planner?.courses?.length || 0).toBe(1)
    if (sample.unavailableTeaching) expect((await saved()).planner.events).toHaveLength(0)
    else await expect.poll(async () => (await saved())?.planner?.events?.length || 0).toBeGreaterThan(0)
    await expect(host.locator('.import-preview')).toBeHidden()
    const current = await saved()
    expect(current.planner.courses).toHaveLength(1)
    expect(current.planner.events.every(event => event.courseId === current.planner.courses[0].id)).toBe(true)
    if (first) {
      expect(current.planner.courses.map(c => c.id)).toEqual(first.planner.courses.map(c => c.id))
      expect(current.planner.events.map(event => event.id)).toEqual(first.planner.events.map(event => event.id))
    } else first = current
    await page.reload()
    expect((await saved()).planner).toEqual(current.planner)
  }
  expect(errors).toEqual([])
  await testInfo.attach('real-public-source-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), sample, calls, course: first.planner.courses[0], events: first.planner.events.length, eventIds: first.planner.events.map(e => e.id), scope: sample.unavailableTeaching ? 'Actual programme saves and repeats while the public teaching source contains zero valid activities. Verifies safe source failure, not successful teaching import.' : 'Actual public programme and selected teaching object/group; preview, save, reload and repeat in isolated storage. This sample does not verify all programmes, courses or personal group membership.' }, null, 2) })
})
