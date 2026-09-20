import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { parseNhfhPlan } from '../../server/providers/nhfh-programs.js'
import { navigate, key, saved, raw, instrumentWrites } from './helpers.js'

const code = 'bachelor-i-medisin', sourceUrl = `https://nhfh.no/${code}/`
function plan(reverse = false) {
  const rows = reverse ? [['Beta', 20], ['Alpha', 10]] : [['Alpha', 10], ['Beta', 20]]
  const html = `<h1>Bachelor i medisin</h1><div class="tags">180 studiepoeng Oslo Nett</div><main>${rows.map(([name, credits]) => `<p><strong>1. semester: ${name} (${credits} studiepoeng)</strong></p>`).join('')}</main>`
  const result = parseNhfhPlan(html, { code, sourceUrl, cohort: 2026 })
  result.program.campuses = ['Oslo', 'Bergen']
  return result
}
function originalState(duplicate = false) {
  const course = { ...plan().models[0].periods[0].courses[0], id: 'saved-alpha', name: 'Mitt lokale emnenavn', sourceRecordId: `${code}:semester-1`, year: 2026, semester: 'autumn', notes: 'Behold mine notater', sourceBase: { name: 'Alpha', credits: 10, description: '1. semester: Alpha (10 studiepoeng)' }, programBinding: { institution: 'nhfh', programCode: code, programName: 'Bachelor i medisin', cohort: '2026', modelId: 'published-current', modelName: 'Publisert emneoversikt', studySemester: 1, calendarYear: 2026, calendarSemester: 'autumn', campus: 'Oslo', choice: '', sourceNotes: '', sourceUrl, checkedAt: '2026-09-19T08:00:00Z' } }
  return { schemaVersion: 1, tasks: [{ id: 'saved-task', title: 'Behold oppgavekoblingen', course: 'Alpha', courseId: course.id, completed: false, estimatedMinutes: null, deadlineLocal: '' }], planner: {
    courses: [course, ...(duplicate ? [{ ...structuredClone(course), id: 'ambiguous-alpha' }] : [])],
    events: [{ id: 'saved-event', courseId: course.id, sourceId: 'saved-calendar', title: 'Min undervisning', start: '2026-09-20T10:00:00Z', end: '2026-09-20T11:00:00Z', notes: 'Behold romnotatet' }],
    sources: [{ id: 'saved-calendar', courseId: course.id, kind: 'file', name: 'Min kalenderfil', groups: [], lastUpdated: '2026-09-19T08:00:00Z' }],
  } }
}
async function seed(page, state) {
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await instrumentWrites(page); await page.reload()
  expect(await raw(page)).toBe(JSON.stringify(state))
  expect(await page.evaluate(() => window.writeAttempts)).toEqual([])
}
async function sourceRoutes(page, getPlan) {
  await page.route('**/api/import/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs' ? { results: [{ code, name: 'Bachelor i medisin', sourceUrl }] } : action === 'program-cohorts' ? { results: [{ cohort: 'current', label: 'Gjeldende studieside', sourceUrl, requiresStudentCohort: true }] } : action === 'program-plan' ? getPlan() : { status: 'not-supported', error: 'Testen tillater bare den syntetiske programkilden.' }
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
}
async function prepare(page, campus = 'Oslo') {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('nhfh')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0'); await host.locator('[name=cohort]').selectOption('0')
  await host.locator('[name=studentCohort]').fill('2026')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption('published-current'); await host.locator('[name=studySemester]').selectOption('1')
  await host.locator('[name=clarifiedYear]').fill('2026'); await host.locator('[name=clarifiedSemester]').selectOption('autumn'); await host.locator('[name=programCampus]').selectOption(campus)
  await host.getByRole('checkbox', { name: /Alpha.*studiepoeng/ }).check(); await host.getByRole('checkbox', { name: /Beta.*studiepoeng/ }).check()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  return host
}

for (const reverse of [false, true]) test(`R11 saved NHFH identity survives a two-course edition, reordering and backup (reverse=${reverse})`, async ({ page }, info) => {
  let reversed = reverse
  await sourceRoutes(page, () => plan(reversed))
  const original = originalState()
  await seed(page, original)
  const host = await prepare(page)
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeVisible()
  expect(await saved(page)).toEqual(original)
  if (!reverse) { await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: info.outputPath('nhfh-two-course-preview-desktop.png'), fullPage: true }) }
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect.poll(async () => (await saved(page)).planner.courses.length).toBe(2)
  const first = await saved(page), alpha = first.planner.courses.find(course => course.id === 'saved-alpha')
  expect(alpha).toMatchObject({ name: 'Mitt lokale emnenavn', notes: 'Behold mine notater', campus: '', programBinding: { campus: 'Oslo' } })
  expect(alpha.campusVerified).not.toBe(true)
  expect(alpha.sourceRecordId).toMatch(/semester-1:named-[a-f0-9]{32}$/)
  expect(first.tasks).toEqual(original.tasks); expect(first.planner.events).toEqual(original.planner.events); expect(first.planner.sources).toEqual(original.planner.sources)
  await page.reload(); expect(await saved(page)).toEqual(first)
  expect(await page.evaluate(() => window.writeAttempts)).toEqual([])
  reversed = !reversed
  const repeat = await prepare(page)
  await repeat.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(repeat.getByRole('status')).toContainText('2 emner og valgte undervisningsøkter er lagret')
  const second = await saved(page)
  expect(second.planner.courses.map(course => course.id)).toEqual(first.planner.courses.map(course => course.id))
  expect(second.planner.events).toEqual(original.planner.events); expect(second.tasks).toEqual(original.tasks)
  if (!reverse) {
    await navigate(page, 'settings')
    const menu = page.locator('#settings-panel .data-menu'); if (!await menu.evaluate(node => node.open)) await menu.locator(':scope > summary').click()
    const downloading = page.waitForEvent('download')
    await menu.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
    const download = await downloading, bytes = await readFile(await download.path())
    await page.evaluate(key => localStorage.removeItem(key), key); await page.reload(); await navigate(page, 'settings')
    await page.locator('#backup-file').setInputFiles({ name: 'nhfh-isolert.json', mimeType: 'application/json', buffer: bytes })
    await page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true }).getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
    const restored = await saved(page)
    expect(restored.planner).toEqual(second.planner); expect(restored.tasks).toEqual(second.tasks)
    await page.reload(); expect((await saved(page)).planner).toEqual(second.planner)
  }
})

test('R11 changed campus and ambiguous legacy matches remain visible, non-mutating failures', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await sourceRoutes(page, () => plan())
  const original = originalState()
  await seed(page, original)
  const host = await prepare(page, 'Bergen')
  await expect(host.getByRole('status')).toContainText('campus/emneversjon')
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeHidden()
  expect(await saved(page)).toEqual(original)
  await page.addStyleTag({ content: 'html { font-size: 150% !important; }' })
  await host.getByRole('status').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('nhfh-campus-conflict-mobile-large.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await host.locator('[name=programCampus]').selectOption('Oslo')
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeVisible()
  expect(await saved(page)).toEqual(original)
  await seed(page, originalState(true))
  const before = await raw(page), ambiguous = await prepare(page)
  await expect(ambiguous.getByRole('status')).toContainText('tvetydig campus/emneversjon')
  expect(await raw(page)).toBe(before)
})
