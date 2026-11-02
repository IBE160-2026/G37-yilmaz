import { test, expect } from '@playwright/test'
import { navigate, reveal } from './helpers.js'

// All content is synthetic. The Friday reproduction is supplied in the
// 2026-11-02 request, not reconstructed from the historical F03 attachment.
const friday = 'Les kapittel 4 innen fredag kl. 14'
const explicit = 'Innlevering syntetisk test, frist 2026-11-06 kl. 14:00'
const prior = 'Innlevering tidligere syntetisk test, frist 2026-11-05 kl. 13:00'
test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ request, baseURL }) => {
  // Only the isolated SQLite runner shares state between browser contexts.
  // Start each scenario fresh so earlier explicit import corrections cannot
  // turn the next unresolved-source reproduction into an intentional reimport.
  if (!process.env.PLAYWRIGHT_DATABASE_PORT || !process.env.STUDIEPLAN_DB) return
  const origin = new URL(baseURL)
  expect(origin.hostname).toBe('127.0.0.1')
  expect(origin.port).toBe(process.env.PLAYWRIGHT_DATABASE_PORT)
  const state = await (await request.get('/api/state')).json()
  const reset = await request.put('/api/state', { data: { expectedRevision: state.revision, envelope: { schemaVersion: 1, tasks: [] } } })
  expect(reset.ok()).toBe(true)
})

async function boot(page, width) {
  await page.setViewportSize({ width, height: 950 })
  await page.clock.setFixedTime(new Date('2026-11-02T10:00:00Z'))
  await page.goto('/')
  await expect(page.locator('#text-registration')).toBeVisible()
}

async function stored(page) {
  return page.evaluate(async () => globalThis.__STUDIEPLAN_API__ === true
    ? (await (await fetch('/api/state')).json()).envelope
    : JSON.parse(localStorage.getItem('studieplanlegger:v1')) || { schemaVersion: 1, tasks: [] })
}

async function openImport(page, text, name) {
  await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Finn studieprogram', exact: true }))).click()
  await (await reveal(page.getByRole('button', { name: 'Fra fil eller tekst', exact: true }))).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dette fant jeg', exact: true })).toBeVisible()
}

async function confirmImport(page) {
  await page.getByRole('button', { name: 'Importer valgte', exact: true }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
}

async function screenshot(page, info, name, locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await locator.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(name) })
}

for (const [width, multiple, resolution] of [[1440, false, 'date'], [390, true, 'time'], [1440, true, 'none'], [390, true, 'omit']]) {
  test(`unparsed deadline ${multiple ? 'multiple' : 'single'} lines: ${resolution} at ${width}px preserves prior data`, async ({ page }, info) => {
    await boot(page, width)
    await navigate(page, 'all')
    await page.locator('#new-task').click()
    await page.locator('#title').fill(`Eksisterende syntetisk oppgave ${resolution}`)
    await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
    await openImport(page, prior, `prior-${resolution}.txt`)
    await confirmImport(page)
    await page.reload()
    const before = await stored(page)
    await openImport(page, multiple ? `${friday}\n${explicit}` : friday, `friday-${resolution}.txt`)
    const row = page.locator('.document-preview-row').first()
    const rowSummary = row.locator(':scope > summary')
    await expect(row.locator('[data-field=selected]')).toBeChecked()
    await expect(row.locator('[data-field=deadlineMode]')).toHaveValue('?')
    if (await row.evaluate(node => node.open)) await rowSummary.click()
    await expect(rowSummary).toContainText('Frist må avklares')
    await expect(rowSummary).toContainText(/Uten frist/)
    await expect(page.locator('.document-confirmation-summary')).toContainText(`${multiple ? 1 : 0} av ${multiple ? 2 : 1} oppføringer klare`)
    await expect(page.locator('.document-confirmation-summary')).toContainText('1 må avklares')
    await screenshot(page, info, `unresolved-${resolution}-${width}.png`, rowSummary)
    const requests = []
    page.on('request', request => { if (request.url().endsWith('/api/state') && request.method() === 'PUT') requests.push(request) })
    await page.evaluate(() => {
      globalThis.deadlineTestWrites = []
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('studieplanlegger:')) globalThis.deadlineTestWrites.push(key)
        return original.call(this, key, value)
      }
    })
    await page.getByRole('button', { name: 'Importer valgte', exact: true }).click()
    await expect(page.locator('.document-preview')).toContainText('Ingen del av planen er lagret')
    expect(await stored(page)).toEqual(before)
    expect(requests).toHaveLength(0)
    expect(await page.evaluate(() => globalThis.deadlineTestWrites)).toEqual([])
    if (resolution === 'omit') await row.locator('[data-field=selected]').uncheck()
    else if (resolution === 'none') await row.locator('[data-field=deadlineMode]').selectOption('none')
    else {
      await row.locator('[data-field=deadlineMode]').selectOption(resolution === 'date' ? 'date' : 'value')
      await row.locator('[data-field=deadlineLocal]').fill(resolution === 'date' ? '2026-11-06' : '2026-11-06T15:30')
      await row.locator('[data-field=deadlineLocal]').press('Tab')
    }
    await expect(page.locator('.document-confirmation-summary')).toContainText('0 må avklares')
    await confirmImport(page)
    const after = await stored(page)
    for (const task of before.tasks) expect(after.tasks.find(item => item.id === task.id)).toEqual(task)
    for (const source of before.importSources || []) expect(after.importSources.find(item => item.id === source.id)).toEqual(source)
    const added = after.tasks.filter(task => !before.tasks.some(item => item.id === task.id))
    expect(added).toHaveLength((multiple ? 2 : 1) - (resolution === 'omit' ? 1 : 0))
    if (resolution !== 'omit') expect(added.find(task => task.title === friday)?.deadlineLocal).toBe(resolution === 'date' ? '2026-11-06' : resolution === 'time' ? '2026-11-06T15:30' : '')
    if (multiple) expect(added.find(task => task.title === explicit)?.deadlineLocal).toBe('2026-11-06T14:00')
    await page.reload()
    expect(await stored(page)).toEqual(after)
  })
}

test('ordinary tasks, incidental weekdays and manually corrected unknown text remain usable', async ({ page }) => {
  await boot(page, 1440)
  const before = await stored(page)
  await openImport(page, 'Les kapittel 4\nLes notatene fra fredag\nSyntetisk bakgrunn uten planhandling\nAnnen syntetisk bakgrunn', 'ordinary-deadline-test.txt')
  const rows = page.locator('.document-preview-row')
  for (const index of [0, 1]) await expect(await reveal(rows.nth(index).locator('[data-field=selected]'))).toBeChecked()
  for (const index of [2, 3]) await expect(await reveal(rows.nth(index).locator('[data-field=selected]'))).not.toBeChecked()
  await rows.nth(2).locator('[data-field=selected]').check()
  await rows.nth(2).locator('[data-field=title]').fill('Manuelt korrigert syntetisk oppgave')
  await rows.nth(2).locator('[data-field=title]').press('Tab')
  await confirmImport(page)
  const after = await stored(page)
  const added = after.tasks.filter(task => !before.tasks.some(item => item.id === task.id))
  expect(added.map(task => task.title)).toEqual(['Les kapittel 4', 'Les notatene fra fredag', 'Manuelt korrigert syntetisk oppgave'])
  expect(added.every(task => task.deadlineLocal === '')).toBe(true)
  await page.reload()
  expect(await stored(page)).toEqual(after)
})

test('populated import deadlines convert between date and time only by explicit choice', async ({ page }) => {
  await boot(page, 390)
  const text = 'Innlevering syntetisk datobytte, frist 2026-11-06 kl. 14:00'
  await openImport(page, text, 'synthetic-date-switch.txt')
  let row = page.locator('.document-preview-row').first()
  await row.locator('[data-field=deadlineMode]').selectOption('date')
  await expect(row.getByLabel('Dato uten klokkeslett', { exact: true })).toHaveValue('2026-11-06')
  await expect(page.locator('.document-confirmation-summary')).toContainText('0 må avklares')
  await confirmImport(page)
  const dated = await stored(page)
  const task = dated.tasks.find(item => item.title === text)
  expect(task.deadlineLocal).toBe('2026-11-06')
  await page.reload()
  expect(await stored(page)).toEqual(dated)
  await openImport(page, text, 'synthetic-date-switch.txt')
  row = page.locator('.document-preview-row').first()
  await row.locator('[data-field=deadlineMode]').selectOption('value')
  await expect(row.getByLabel('Dato og klokkeslett i norsk tid', { exact: true })).toHaveValue('')
  await expect(page.locator('.document-confirmation-summary')).toContainText('1 må avklares')
  await page.getByRole('button', { name: 'Importer valgte', exact: true }).click()
  expect(await stored(page)).toEqual(dated)
  await row.getByLabel('Dato og klokkeslett i norsk tid', { exact: true }).fill('2026-11-06T16:00')
  await confirmImport(page)
  const timed = await stored(page)
  expect(timed.tasks.find(item => item.id === task.id)?.deadlineLocal).toBe('2026-11-06T16:00')
  await page.reload()
  expect(await stored(page)).toEqual(timed)
})

test('year-choice confirmation respects clearing and a fully specified edited deadline', async ({ page }) => {
  await boot(page, 1440)
  const registration = page.locator('#text-registration')
  for (const [name, value] of [['tømt', ''], ['rettet', '2027-05-12T15:45']]) {
    const title = `Syntetisk årvalg ${name}`
    await (await reveal(registration.getByLabel('Skriv hva du vil legge til eller endre'))).fill(`Legg til ${title} med frist 12. mai kl. 14`)
    await registration.getByRole('button', { name: 'Lag forslag', exact: true }).click()
    await registration.getByRole('combobox', { name: 'Hvilket år?', exact: true }).selectOption('2027')
    const details = registration.locator('.text-registration-details')
    await (await reveal(registration.getByLabel('Frist (valgfritt)', { exact: true }))).fill(value)
    await details.locator(':scope > summary').click()
    await expect(registration.locator('.text-registration-summary')).toContainText(value ? '12. mai 2027 kl. 15:45' : 'ikke oppgitt')
    await registration.getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
    expect((await stored(page)).tasks.find(task => task.title === title)?.deadlineLocal).toBe(value)
  }
})

for (const width of [1440, 390]) {
  test(`text confirmation exposes complete effective deadlines at ${width}px`, async ({ page }, info) => {
    await boot(page, width)
    const registration = page.locator('#text-registration')
    for (const [name, initial, edited] of [
      ['timed', '2026-11-06 kl. 14:00', '2026-11-07T16:45'],
      ['date', '2026-11-06', '2026-11-08'],
      ['none', '', ''],
      ['clear', '2026-11-06 kl. 14:00', ''],
    ]) {
      const title = `Syntetisk ${name} ${width}`
      await (await reveal(registration.getByLabel('Skriv hva du vil legge til eller endre'))).fill(`Legg til ${title}${initial ? ` med frist ${initial}` : ''}`)
      await registration.getByRole('button', { name: 'Lag forslag', exact: true }).click()
      const summary = registration.locator('.text-registration-summary')
      const details = registration.locator('.text-registration-details')
      await expect(details).not.toHaveAttribute('open', '')
      if (initial.includes('14:00')) await expect(summary).toContainText('6. november 2026 kl. 14:00')
      else if (initial) { await expect(summary).toContainText('6. november 2026'); await expect(summary).not.toContainText('kl.') }
      else await expect(summary).toContainText(/Ingen frist|ikke oppgitt/i)
      await (await reveal(registration.getByLabel('Frist (valgfritt)', { exact: true }))).fill(edited)
      await details.locator(':scope > summary').click()
      if (edited.includes('T')) await expect(summary).toContainText('7. november 2026 kl. 16:45')
      else if (edited) { await expect(summary).toContainText('8. november 2026'); await expect(summary).not.toContainText('kl.') }
      else await expect(summary).toContainText(/Ingen frist|ikke oppgitt/i)
      await screenshot(page, info, `confirmation-${name}-${width}.png`, summary)
      await registration.getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
      expect((await stored(page)).tasks.find(task => task.title === title)?.deadlineLocal).toBe(edited)
    }
    const after = await stored(page)
    await page.reload()
    expect(await stored(page)).toEqual(after)
  })

  test(`help matches actual storage mode at ${width}px`, async ({ page }, info) => {
    await boot(page, width)
    const sqlite = await page.evaluate(() => globalThis.__STUDIEPLAN_API__ === true)
    const help = page.locator('.local-help')
    await help.locator(':scope > summary').click()
    await expect(help).toContainText('Innstillinger → Data og sikkerhetskopi')
    await expect(help.locator('a[href*="localhost"]')).toHaveCount(0)
    const description = page.locator('#storage-help-description')
    if (sqlite) {
      await expect(description).toContainText('SQLite')
      await expect(page.locator('#storage-help-local-server')).toBeVisible()
      await expect(description).not.toContainText('bare i denne nettleserprofilen')
    } else {
      await expect(description).toContainText('nettleserprofilen på denne nettadressen')
      await expect(description).toContainText('Sletting av nettleserdata kan slette planen')
      await expect(description).toContainText('Enheter synkroniseres ikke')
      await expect(page.locator('#storage-help-local-server')).toBeHidden()
      expect(await help.innerText()).not.toMatch(/localhost|lokale.*server|SQLite/)
    }
    await screenshot(page, info, `help-${sqlite ? 'sqlite' : 'browser'}-${width}.png`, help)
    const text = await description.textContent()
    await navigate(page, 'settings')
    await expect(page.locator('#settings-panel')).toContainText(text)
    await expect(page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true })).toBeVisible()
  })
}
