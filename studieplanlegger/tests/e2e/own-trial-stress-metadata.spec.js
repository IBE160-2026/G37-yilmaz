import { test, expect } from '@playwright/test'
import { freeze, key, navigate, saved } from './helpers.js'
import { searchTimeEdit } from '../../server/providers/timeedit.js'
import { hostedCalendarSource } from '../../server/hosted-import-policy.js'
import { hvlSearchHtml, hvlLabels, legacyHvlCourse } from '../helpers/hvl-direct-search.js'

async function start(page) {
  await freeze(page, '2026-10-29T18:00:00+01:00')
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] }, onboarding: { dismissed: true, completed: true } })), key)
  await page.reload(); await navigate(page, 'subjects')
}

async function chooseHvl(page, variant, query = 'DAT100') {
  await page.getByRole('button', { name: 'Finn ett emne', exact: true }).click()
  const form = page.locator('#course-import-form')
  await form.locator('[name=university]').selectOption('hvl')
  await page.getByRole('button', { name: 'Neste: søk og semester', exact: true }).click()
  await form.locator('[name=code]').fill(query)
  await form.locator('[name=year]').fill('2026')
  await form.getByRole('button', { name: 'Søk emner', exact: true }).click()
  await expect(page.locator('.wizard-results button')).toHaveCount(5)
  await page.getByRole('button', { name: `Grunnleggende programmering · DAT100 · ${variant || 'Campus mangler'}`, exact: true }).click()
  return page.locator('#import-preview')
}

test('calendar-link limits and usable file alternative are visible before any fetch in both modes', async ({ page }) => {
  const requests = []
  await page.route('**/api/import/calendar', async route => {
    requests.push(route.request().postDataJSON().url)
    try { hostedCalendarSource(requests.at(-1)); throw new Error('Test expected rejection') }
    catch (error) { await route.fulfill({ status: 400, json: { error: error.message } }) }
  })
  await start(page)
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await page.getByRole('button', { name: 'Fra kalenderlenke', exact: true }).click()
  const form = page.locator('#calendar-import-form')
  await expect(form.locator('#calendar-link-help')).toContainText('Andre offentlige ICS-lenker kan derfor bli avvist')
  await expect(form.locator('#calendar-link-help')).toContainText('tp.educloud.no')
  await expect(form).toContainText('En vanlig timeplanside er en nettside')
  expect(requests).toEqual([])
  await form.locator('[name=importMode]').selectOption('subscription')
  await expect(form.locator('#calendar-link-help')).toBeVisible()
  await form.locator('[name=importMode]').selectOption('snapshot')
  for (const url of ['https://www.gov.uk/bank-holidays/england-and-wales.ics', 'https://tp.educloud.no/uib/app/schedule?course=INF100&filterOpen=true&pastWeeks=true&scheduleType=course&semester=26h&summary=false&tab=list']) {
    await form.locator('[name=url]').fill(url)
    await form.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
    await expect(page.locator('#subject-message')).toContainText('gjenkjente offentlige studiekilder')
  }
  await form.getByRole('button', { name: 'Bruk filimport i stedet', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Fra fil eller tekst', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.document-import input[type=file]')).toBeVisible()
  expect((await saved(page)).planner).toEqual({ courses: [], events: [], sources: [] })
})

test('HVL direct search keeps course title, campus, variant and missing metadata distinct through save and reload', async ({ page }) => {
  const response = await searchTimeEdit('hvl', { q: 'DAT100', year: 2026, semester: 'autumn' }, async () => hvlSearchHtml)
  await page.route('**/api/import/providers/hvl/search?**', route => route.fulfill({ json: response }))
  await start(page)
  const preview = await chooseHvl(page, 'Bergen - Dataingeniør')
  await expect(preview.getByRole('heading', { name: 'DAT100 Grunnleggende programmering', exact: true })).toBeVisible()
  await expect(preview).toContainText('Campus (emnekilden): Bergen')
  await expect(preview).toContainText('Studiepoeng mangler')
  await expect(preview).toContainText('Beskrivelse er ikke hentet')
  await preview.getByText('Valgt emnepost i TimeEdit', { exact: true }).click()
  await expect(preview.getByText(hvlLabels[1], { exact: true })).toBeVisible()
  await preview.getByRole('button', { name: 'Importer bare emnet', exact: true }).click()
  const before = await saved(page)
  expect(before.planner.courses).toHaveLength(1)
  expect(before.planner.courses[0]).toMatchObject({ name: 'Grunnleggende programmering', campus: 'Bergen', credits: null, description: '', sourceObjectId: '72901.36', sourceRecordId: '72901.36', label: hvlLabels[1] })
  expect(before.planner.events).toEqual([])
  await page.reload(); await navigate(page, 'subjects')
  expect((await saved(page)).planner).toEqual(before.planner)
  await expect(page.locator('#course-list')).toContainText('Campus (emnekilden): Bergen')
})

for (const index of [0, 1]) test(`legacy HVL import repairs raw campus only after confirmation and preserves edited name, notes and task/event links (${index})`, async ({ page }) => {
  const oldQuery = index ? 'Grunnleggende programmering' : 'DAT100', newQuery = index ? 'DAT100' : 'Grunnleggende programmering'
  const response = await searchTimeEdit('hvl', { q: oldQuery, year: 2026, semester: 'autumn' }, async () => hvlSearchHtml), item = response.results[index]
  await page.route('**/api/import/providers/hvl/search?**', async route => route.fulfill({ json: await searchTimeEdit('hvl', { q: new URL(route.request().url()).searchParams.get('q'), year: 2026, semester: 'autumn' }, async () => hvlSearchHtml) }))
  await start(page)
  const legacy = legacyHvlCourse(item, 'Mitt manuelt redigerte HVL-emne')
  const envelope = await saved(page)
  envelope.planner.courses = [legacy]
  envelope.planner.events = [{ id: 'synthetic-legacy-event', courseId: legacy.id, title: 'Syntetisk lagret undervisning', start: '2026-11-01T09:00:00Z', end: '2026-11-01T10:00:00Z', notes: 'Syntetisk øktnotat', location: '' }]
  envelope.tasks = [{ id: 'synthetic-legacy-task', courseId: legacy.id, course: 'DAT100', title: 'Syntetisk koblet oppgave', estimatedMinutes: 30, deadlineLocal: '', completed: false }]
  await page.evaluate(({ key, envelope }) => localStorage.setItem(key, JSON.stringify(envelope)), { key, envelope })
  await page.reload(); await navigate(page, 'subjects')
  const before = await saved(page)
  expect(before.planner.courses[0].campus).toBe(item.label)
  for (let attempt = 0; attempt < 2; attempt++) {
    const persisted = await saved(page)
    const preview = await chooseHvl(page, item.variant, newQuery)
    await expect(preview.getByRole('button', { name: 'Importer bare emnet', exact: true })).toBeVisible()
    expect(await saved(page)).toEqual(persisted)
    await preview.getByRole('button', { name: 'Importer bare emnet', exact: true }).click()
    await expect(page.locator('#course-list')).toContainText(legacy.name)
    const after = await saved(page)
    expect(after.planner.courses).toHaveLength(1)
    expect(after.planner.courses[0]).toMatchObject({ id: legacy.id, name: legacy.name, notes: legacy.notes, campus: item.campus, campusVerified: item.campusVerified, sourceRecordId: item.sourceObjectId })
    expect(after.tasks).toEqual(before.tasks)
    expect(after.planner.events).toEqual(before.planner.events)
    await page.reload(); await navigate(page, 'subjects')
    expect((await saved(page)).planner).toEqual(after.planner)
  }
  for (const variant of ['Bergen - Informasjonsteknologi', 'Førde - Informasjonsteknologi']) {
    const persisted = await saved(page)
    await chooseHvl(page, variant)
    await expect(page.locator('#subject-message')).toContainText('annen eller tvetydig campus/emneversjon')
    expect(await saved(page)).toEqual(persisted)
  }
})
