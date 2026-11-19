import { test, expect } from '@playwright/test'
import { navigate, key, saved } from './helpers.js'

const samples = [
  { id: 'nord', query: 'MAENM', program: /maenm-master · Kull 2026/i, cohort: /^Høst 2026$/ },
  { id: 'nord', query: 'Advanced English Language and Literature: Spring Package', program: /^Advanced English Language and Literature: Spring Package ·/, cohort: /^Vår 2026$/, period: /Vår 2026/, codes: ['ENG2005'], calendar: [2026, 'spring'] },
  { id: 'uia', query: 'data-ingeniorutdanning-bachelor', program: /data-ingeniorutdanning-bachelor|Dataingeniør/i, cohort: /2026/i },
  { id: 'uio', query: 'informatikk-programmering', program: /\binformatikk-programmering\b/i, studentCohort: '2026' },
  { id: 'himolde', query: 'logistikk-scm', program: /\blogistikk-scm\b/i, cohort: /2026/i, period: /Vår 2029/, alternative: /SCM600 Bacheloroppgave \+ LOG530 \+ TRA610/, codes: ['LOG530', 'SCM600', 'TRA610'], calendar: [2029, 'spring'], studySemester: '6' },
  { id: 'nih', query: 'bachelor-i-trenerrollen-og-idrettspsykologi', program: /\bbachelor-i-trenerrollen-og-idrettspsykologi\b/i, cohort: /2026|gjeldende/i, studentCohort: '2026' },
  { id: 'hiof', query: 'bedok-bedriftsokonomi-arsstudium', program: /\bbedok-bedriftsokonomi-arsstudium\b/i, cohort: /2026/i },
  { id: 'skrivekunst', query: 'arsstudium-skapande-skriving', program: /\barsstudium-skapande-skriving\b/i, cohort: /2026\/27|2026/i },
]

async function choose(control, predicate = () => true) {
  await expect.poll(() => control.locator('option').count(), { timeout: 210_000 }).toBeGreaterThan(1)
  const options = await control.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label: node.textContent.trim() })))
  const selected = options.find(option => option.value && predicate(option))
  expect(selected, JSON.stringify(options)).toBeTruthy()
  await control.selectOption(selected.value)
  return selected
}

async function choosePeriodWithCourses(host, sample) {
  const control = host.locator('[name=studySemester]')
  if (sample.period) return choose(control, option => sample.period.test(option.label))
  await expect.poll(() => control.locator('option').count(), { timeout: 210_000 }).toBeGreaterThan(1)
  const options = await control.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label: node.textContent.trim() })).filter(option => option.value))
  for (const option of options) {
    await control.selectOption(option.value)
    if (await host.locator('.activity-choices input:is([type=checkbox],[type=radio])').count()) return option
  }
  throw new Error(`Ingen publiserte emner i noen studiesemestre: ${JSON.stringify(options)}`)
}

async function runImport(page, sample) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Finn studieprogram', exact: true }).click()
  await page.getByRole('button', { name: 'Studieprogram', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption(sample.id)
  await host.locator('[name=programQuery]').fill(sample.query)
  await host.locator('[name=catalogueYear]').fill('2026')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  const program = await choose(host.locator('[name=program]'), option => sample.program.test(option.label))
  const cohort = await choose(host.locator('[name=cohort]'), option => !sample.cohort || sample.cohort.test(option.label))
  if (await host.locator('[name=studentCohort]').isVisible()) await host.locator('[name=studentCohort]').fill(sample.studentCohort || '2026')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  const model = await choose(host.locator('[name=model]'))
  const period = await choosePeriodWithCourses(host, sample)
  if (await host.locator('[name=clarifiedStudySemester]').isVisible()) {
    const allowed = await host.locator('[name=clarifiedStudySemester]').getAttribute('data-allowed')
    await host.locator('[name=clarifiedStudySemester]').fill(sample.studySemester || allowed?.split(',')[0] || '1')
  }
  if (await host.locator('[name=calendarSemester]').isVisible()) await choose(host.locator('[name=calendarSemester]'))
  else {
    if (await host.locator('[name=clarifiedYear]').isVisible()) await host.locator('[name=clarifiedYear]').fill('2026')
    if (await host.locator('[name=clarifiedSemester]').isVisible()) await host.locator('[name=clarifiedSemester]').selectOption('autumn')
  }
  if (await host.locator('[name=programCampus]').isVisible()) await choose(host.locator('[name=programCampus]'))
  const choices = host.locator('.activity-choices input[type=checkbox]')
  if (sample.alternative) await host.getByRole('radio', { name: sample.alternative }).check()
  else if (sample.codes) await host.getByRole('checkbox', { name: new RegExp(`\\b${sample.codes[0]}\\b`) }).check()
  else {
    await expect.poll(() => choices.count(), { timeout: 30_000 }).toBeGreaterThan(0)
    if (!await host.locator('.activity-choices input[type=checkbox]:checked').count()) await choices.first().check()
  }
  await host.getByRole('button', { name: /^(Forbered og kontroller undervisning for|Forhåndsvis (?:1 emne|\d+ emner)|Velg emner$)/ }).click()
  await expect(host.getByRole('button', { name: /^Legg til (?:1 emne|\d+ emner)$/ })).toBeVisible({ timeout: 30_000 })
  const preview = await host.locator('.import-preview').innerText()
  await host.getByRole('button', { name: /^Legg til (?:1 emne|\d+ emner)$/ }).click()
  await expect(host.getByRole('status')).toContainText(/lagret/i)
  return { program, cohort, model, period, preview }
}

for (const sample of samples) test(`live national programme flow: ${sample.id} · ${sample.query}`, async ({ page }, info) => {
  test.skip(process.env.LIVE_PUBLIC_SOURCES !== '1', 'Opt-in bounded checks against actual public programme sources')
  test.setTimeout(480_000)
  await page.goto('/')
  expect(await saved(page)).toBeNull()
  const sourceResponses = []
  page.on('response', response => {
    if (response.url().includes(`/api/import/providers/${sample.id}/`)) sourceResponses.push({ url: response.url(), status: response.status() })
  })
  const firstSelection = await runImport(page, sample)
  const first = await saved(page)
  const imported = first.planner.courses.filter(course => course.programBinding?.institution === sample.id || course.sourceProvider?.startsWith(sample.id))
  expect(imported.length).toBeGreaterThan(0)
  expect(imported.every(course => /^https:\/\//.test(course.sourceUrl))).toBe(true)
  if (sample.codes) expect(imported.map(course => course.code).sort()).toEqual(sample.codes)
  if (sample.calendar) expect(imported.every(course => course.year === sample.calendar[0] && course.semester === sample.calendar[1])).toBe(true)
  const identities = imported.map(course => `${course.sourceProvider}:${course.sourceRecordId}:${course.programBinding?.studySemester || ''}`).sort()
  await page.screenshot({ path: info.outputPath(`${sample.id}-actual-program-import.png`), fullPage: true })
  await page.reload()
  expect((await saved(page)).planner.courses.filter(course => course.programBinding?.institution === sample.id || course.sourceProvider?.startsWith(sample.id)).map(course => `${course.sourceProvider}:${course.sourceRecordId}:${course.programBinding?.studySemester || ''}`).sort()).toEqual(identities)
  const secondSelection = await runImport(page, sample)
  const repeated = (await saved(page)).planner.courses.filter(course => course.programBinding?.institution === sample.id || course.sourceProvider?.startsWith(sample.id))
  expect(repeated.map(course => `${course.sourceProvider}:${course.sourceRecordId}:${course.programBinding?.studySemester || ''}`).sort()).toEqual(identities)
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey) !== null, key)).toBe(true)
  expect(sourceResponses.length).toBeGreaterThanOrEqual(6)
  expect(sourceResponses.every(response => response.status === 200)).toBe(true)
  await info.attach('actual-public-program-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), institution: sample.id, firstSelection, secondSelection, sourceResponses, imported: repeated.map(course => ({ id: course.id, code: course.code, name: course.name, credits: course.credits, sourceUrl: course.sourceUrl, sourceProvider: course.sourceProvider, sourceRecordId: course.sourceRecordId, programBinding: course.programBinding })) }, null, 2) })
})
