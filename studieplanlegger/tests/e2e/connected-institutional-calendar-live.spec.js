import { test, expect } from '@playwright/test'
import { navigate, key } from './helpers.js'

for (const source of ['gestalt', 'phs']) test(`live ${source} published calendar preserves explicit class, deadline and information semantics`, async ({ page }, info) => {
  test.skip(process.env.RUN_LIVE_INSTITUTION_CALENDAR !== '1', 'Requires an explicitly authorized public source check')
  test.setTimeout(180000)
  await page.setViewportSize({ width: 390, height: 844 })
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), responses = []
  page.on('response', async response => { if (response.url().endsWith('/api/import/calendar')) { const data = await response.json(); responses.push({ sourceKind: data.sourceKind, count: data.count, unresolved: data.unresolved, authoritative: data.authoritative }) } })
  await page.goto('/')
  let first
  for (let run = 0; run < 2; run++) {
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
    await page.getByRole('button', { name: 'Fra kalenderfil eller lenke', exact: true }).click()
    const form = page.locator('.institutional-calendar-import')
    if (!await form.evaluate(node => node.open)) await form.locator(':scope > summary').click()
    await form.getByRole('combobox', { name: 'Offentlig kalenderkilde', exact: true }).selectOption(source)
    await form.getByRole('button', { name: source === 'gestalt' ? 'Hent offentlige Gestalt-klasser' : 'Hent offentlige eksamensoversikter', exact: true }).click()
    const classes = form.getByRole('combobox', { name: source === 'gestalt' ? 'Publisert klasseplan' : 'Publisert eksamensoversikt', exact: true })
    await expect.poll(() => classes.locator('option').count(), { timeout: 60000 }).toBeGreaterThan(1)
    const value = await classes.locator('option').evaluateAll((items, source) => items.find(item => source === 'gestalt' ? decodeURIComponent(item.value).includes('gestaltterapi:1:helg') : item.value.endsWith('-ba'))?.value, source)
    expect(value).toBeTruthy(); await classes.selectOption(value)
    await form.getByLabel('Kalenderår', { exact: true }).fill('2026')
    await form.getByRole('combobox', { name: 'Kalendersemester', exact: true }).selectOption('autumn')
    const before = await saved()
    await form.getByRole('button', { name: 'Forhåndsvis institusjonskalender', exact: true }).click()
    await expect(form.getByRole('heading', { name: 'Kontroller planen før import' })).toBeVisible({ timeout: 60000 })
    expect(await saved()).toEqual(before)
    const choices = form.getByRole('checkbox', { name: 'Ta med i planen', exact: true })
    expect(await choices.evaluateAll(nodes => nodes.every(node => !node.checked))).toBe(true)
    if (source === 'gestalt') await choices.first().check()
    else {
      for (const name of [/FOREBYGG01-2.*Ordinær/, /STRAFF01.*Ny/, /POLISAMF01.*Ordinær/]) {
        const row = form.locator('.document-preview details').filter({ has: page.locator('summary').filter({ hasText: name }) })
        await expect(row).toHaveCount(1)
        if (!await row.evaluate(node => node.open)) await row.locator(':scope > summary').click()
        await row.getByRole('checkbox', { name: 'Ta med i planen', exact: true }).check()
      }
      const deadlineValues = await form.locator('input[type=datetime-local]').evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean))
      expect(deadlineValues.every(value => value >= '2026-07-01' && value < '2027-01-01')).toBe(true)
      await expect(form.locator('.document-preview')).toContainText('Ukedag og datofelt stemmer ikke overens')
    }
    if (!run) { await form.locator('.document-preview').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath(`${source}-calendar-preview-mobile.png`) }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true) }
    await form.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
    await expect(form.getByRole('status')).toContainText('Institusjonskalender lagret')
    const state = await saved()
    expect(state.planner.courses).toEqual([]); expect(state.sessions || []).toEqual([])
    if (source === 'gestalt') {
      expect(state.planner.events).toHaveLength(1)
      expect(state.planner.events[0]).toMatchObject({ courseId: '', start: '2026-09-17T08:30:00.000Z', end: '2026-09-17T15:00:00.000Z', transparent: false })
    } else {
      expect(state.tasks).toHaveLength(1)
      expect(state.tasks[0]).toMatchObject({ deadlineLocal: '2026-12-14T12:00', requiresSubmission: true, remainingMinutes: null, completed: false })
      expect(state.planner.events).toHaveLength(2)
      expect(state.planner.events.find(item => item.title.includes('STRAFF01'))).toMatchObject({ start: '2026-10-13T07:00:00.000Z', end: '2026-10-13T13:00:00.000Z', transparent: false })
      expect(state.planner.events.find(item => item.title.includes('POLISAMF01'))).toMatchObject({ allDay: true, transparent: true, information: true })
    }
    if (first) { expect(state.planner).toEqual(first.planner); expect(state.tasks).toEqual(first.tasks) } else first = state
    await page.reload(); expect((await saved()).planner).toEqual(state.planner)
  }
  await info.attach('real-public-calendar-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), source, responses, tasks: first.tasks, events: first.planner.events, scope: 'Actual public source to fresh local app; explicit published class or exam choice, semester filtering, mixed semantic types, save/reload/repeat. Personal membership was not inferred.' }, null, 2) })
})

test('live public Plandisc preview, explicit selection, save, reload and repeat remain informational', async ({ page }, info) => {
  test.skip(process.env.RUN_LIVE_INSTITUTION_CALENDAR !== '1', 'Requires an explicitly authorized public source check')
  test.setTimeout(120000)
  await page.setViewportSize({ width: 390, height: 844 })
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), calls = []
  page.on('response', async response => {
    if (!response.url().endsWith('/api/import/calendar')) return
    const json = await response.json(); calls.push({ status: response.status(), institutional: json.institutional, warnings: json.warnings })
  })
  await page.goto('/')
  let first
  for (let attempt = 0; attempt < 2; attempt++) {
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
    await page.getByRole('button', { name: 'Fra kalenderfil eller lenke', exact: true }).click()
    const form = page.locator('.institutional-calendar-import')
    if (!await form.evaluate(node => node.open)) await form.locator(':scope > summary').click()
    await form.getByLabel('Offentlig Plandisc-lenke', { exact: true }).fill('https://create.plandisc.com/wheel/showPublic/EJuyq2e')
    await form.getByLabel('Kalenderår', { exact: true }).fill('2026')
    await form.getByRole('combobox', { name: 'Kalendersemester', exact: true }).selectOption('autumn')
    const before = await saved()
    await form.getByRole('button', { name: 'Forhåndsvis institusjonskalender', exact: true }).click()
    await expect(form.getByRole('heading', { name: 'Kontroller planen før import' })).toBeVisible({ timeout: 60000 })
    const choices = form.getByRole('checkbox', { name: 'Ta med i planen', exact: true })
    expect(await choices.count()).toBeGreaterThan(0)
    expect(await choices.evaluateAll(nodes => nodes.every(node => !node.checked))).toBe(true)
    expect(await saved()).toEqual(before)
    await choices.first().check()
    if (attempt === 0) {
      await choices.first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath('public-calendar-preview-mobile.png') })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    }
    await form.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
    await expect(form.getByRole('status')).toContainText('Institusjonskalender lagret')
    const state = await saved()
    expect(state.planner.courses).toEqual([])
    expect(state.planner.events).toHaveLength(1)
    expect(state.planner.events[0]).toMatchObject({ courseId: '', transparent: true, information: true })
    expect(state.sessions || []).toEqual([])
    expect(state.importSources).toHaveLength(1)
    if (first) expect(state.planner.events).toEqual(first.planner.events)
    else first = state
    await page.reload()
    expect((await saved()).planner).toEqual(state.planner)
  }
  await info.attach('real-public-calendar-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), calls, event: first.planner.events[0], source: first.importSources[0], scope: 'Actual public institutional calendar, explicit one-event selection, save/reload/repeat. Not teaching or personal timetable verification.' }, null, 2) })
})

test('live HØFY class PDF preserves uncertain source rows and reserves only explicitly selected teaching', async ({ page }, info) => {
  test.skip(process.env.RUN_LIVE_INSTITUTION_CALENDAR !== '1', 'Requires an explicitly authorized public source check')
  test.setTimeout(120000)
  await page.setViewportSize({ width: 390, height: 844 })
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), responses = []
  page.on('response', async response => {
    if (response.url().endsWith('/api/import/calendar')) responses.push(await response.json())
  })
  await page.goto('/')
  let first
  for (let run = 0; run < 2; run++) {
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
    await page.getByRole('button', { name: 'Fra kalenderfil eller lenke', exact: true }).click()
    const form = page.locator('.institutional-calendar-import')
    if (!await form.evaluate(node => node.open)) await form.locator(':scope > summary').click()
    await form.getByRole('combobox', { name: 'Offentlig kalenderkilde', exact: true }).selectOption('hfy')
    await form.getByRole('button', { name: 'Hent offentlige HØFY-klasseplaner', exact: true }).click()
    const classes = form.getByRole('combobox', { name: 'Publisert klasseplan', exact: true })
    await expect.poll(() => classes.locator('option').count()).toBeGreaterThan(1)
    const value = await classes.locator('option').evaluateAll(items => items.find(item => item.value.includes('klasse-a'))?.value)
    expect(value).toBeTruthy(); await classes.selectOption(value)
    await form.getByLabel('Kalenderår', { exact: true }).fill('2026')
    await form.getByRole('combobox', { name: 'Kalendersemester', exact: true }).selectOption('autumn')
    const before = await saved()
    await form.getByRole('button', { name: 'Forhåndsvis institusjonskalender', exact: true }).click()
    await expect(form.getByRole('heading', { name: 'Kontroller planen før import' })).toBeVisible({ timeout: 60000 })
    await expect(form.locator('.document-preview')).toContainText('Uavklart kildeoppføring')
    expect(await saved()).toEqual(before)
    const row = form.locator('.document-preview details').filter({ has: page.locator('summary').filter({ hasText: /Samling 1, dag 1/ }) }).first()
    if (!await row.evaluate(node => node.open)) await row.locator(':scope > summary').click()
    await row.getByRole('checkbox', { name: 'Ta med i planen', exact: true }).check()
    if (run === 0) { await row.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('hfy-class-source-mobile.png') }) }
    await form.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
    await expect(form.getByRole('status')).toContainText('Institusjonskalender lagret')
    const state = await saved()
    expect(state.planner.courses).toEqual([]); expect(state.planner.events).toHaveLength(1)
    expect(state.planner.events[0]).toMatchObject({ courseId: '', transparent: false, information: false, start: '2026-09-21T07:00:00.000Z', end: '2026-09-21T14:30:00.000Z' })
    if (first) expect(state.planner.events).toEqual(first.planner.events); else first = state
    await page.reload(); expect((await saved()).planner).toEqual(state.planner)
  }
  expect(responses.every(result => result.authoritative === false && result.unresolved.length > 0)).toBe(true)
  await info.attach('real-public-calendar-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), event: first.planner.events[0], sourceChecks: responses.map(result => ({ sourceKind: result.sourceKind, authoritative: result.authoritative, unresolved: result.unresolved, count: result.count })), scope: 'Actual public HØFY Oslo A PDF to isolated app; one explicit class day, preview/save/reload/repeat, source conflicts retained. Not personal membership or full calendar coverage.' }, null, 2) })
})
