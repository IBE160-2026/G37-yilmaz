import { test, expect } from '@playwright/test'
import { freeze, key, navigate, raw, reveal, saved, task } from './helpers.js'
import { ntnuPrograms } from '../../server/providers/ntnu-programs.js'
import { parseAhoPlan } from '../../server/providers/aho-programs.js'
import { parseUitPdf } from '../../server/providers/uit-pdf.js'
import { ahoFixture, ahoSource, ntnuCataloguePage, ntnuEmptyIndex, uitInfo, uitPdfUrl, uitQuery, uitTermPages } from '../fixtures/provider-followup.js'

// Isolated synthetic browser records and intercepted source responses.
// Live HTTP checks are separate; these tests do not claim live source coverage.
async function start(page, institution, planner = { courses: [], events: [], sources: [] }) {
  await freeze(page, '2026-11-01T12:00:00+01:00')
  await page.goto('/')
  await page.evaluate(({ key, existingTask, planner }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, tasks: [existingTask], planner,
    onboarding: { dismissed: true, completed: true },
  })), { key, existingTask: { ...task('synthetic-provider-preservation', '2026-11-15T12:00', 1200), ...(planner.courses[0] ? { courseId: planner.courses[0].id } : {}) }, planner })
  await page.reload()
  const before = await raw(page)
  await openProgrammes(page)
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption(institution)
  return { host, before }
}

async function openProgrammes(page) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Finn studieprogram', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
}
const sourceMessage = host => host.locator(':scope > p[aria-live]:not([role])')

test('NTNU empty source index gives a source limitation and keyboard-accessible next action without changing saved work', async ({ page }) => {
  const result = await ntnuPrograms('programs', { q: 'Datateknologi' }, { fetchText: async url => new URL(url).searchParams.has('p_p_resource_id') ? JSON.stringify(ntnuEmptyIndex) : ntnuCataloguePage })
  await page.route('**/api/import/providers/ntnu/programs?*', route => route.fulfill({ json: result }))
  const { host, before } = await start(page, 'ntnu')
  await host.locator('[name=programQuery]').fill('Datateknologi')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  const message = sourceMessage(host)
  await expect(message).toContainText('tom samlet programliste før søket ditt ble filtrert')
  await expect(message).toContainText('Det bekrefter ikke at programmet mangler')
  await expect(message).toContainText('Lagrede data er beholdt')
  await expect(message).toBeFocused()
  await expect(host.locator('[name=program]')).toBeHidden()
  const link = host.getByRole('link', { name: 'Åpne offentlig programkilde', exact: true })
  await expect(link).toHaveAttribute('href', 'https://www.ntnu.no/studier/alle')
  await page.keyboard.press('Tab')
  await expect(link).toBeFocused()
  await expect(host.getByRole('button', { name: 'Søk etter ett enkelt emne', exact: true })).toBeEnabled()
  expect(await raw(page)).toBe(before)
  await page.reload()
  expect(await raw(page)).toBe(before)
  await openProgrammes(page)
  await expect(page.locator('.program-import [name=programQuery]')).toHaveValue('Datateknologi')
})

test('AHO gap-aware reimport corrects old semester 8/9 bindings without duplicates or lost notes and remains undoable after reload', async ({ page }) => {
  const plan = parseAhoPlan(ahoFixture(), ahoSource, 'no:master-i-arkitektur', '2026')
  const model = plan.models[0], correctedPeriods = model.periods.slice(-2)
  // Before the fix, these same published calendar periods/course identities
  // were labelled 8/9 because missing source periods were compressed away.
  const existingCourses = correctedPeriods.map((period, index) => {
    const row = period.courses[0]
    return {
      ...row, notes: `Syntetisk lokalt emnenotat ${index + 1} som skal beholdes`,
      sourceBase: { name: row.name, credits: row.credits, description: row.description },
      programBinding: {
        institution: 'aho', programCode: plan.program.code, programName: plan.program.name, cohort: '2026',
        modelId: model.id, modelName: model.name, studySemester: index + 8,
        calendarYear: period.year, calendarSemester: period.semester,
        studySemesterClarifiedByStudent: false, calendarClarifiedByStudent: false,
        campus: 'AHO OSLO', choice: row.choice, sourceNotes: row.notes,
        sourceUrl: ahoSource, checkedAt: '2026-10-30T10:00:00.000Z',
      },
    }
  })
  await page.route('**/api/import/providers/aho/**', route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs' ? { status: 'ok', results: [plan.program] } : action === 'program-cohorts' ? { status: 'ok', results: [{ cohort: '2026', sourceUrl: ahoSource }] } : plan
    return route.fulfill({ json: data })
  })
  const { host, before } = await start(page, 'aho', { courses: existingCourses, events: [], sources: [] })
  const initial = JSON.parse(before), ids = initial.planner.courses.map(course => course.id)
  expect(initial.planner.courses.map(course => course.programBinding.studySemester)).toEqual([8, 9])
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await expect(sourceMessage(host)).toContainText('mangler perioder for Vår 2030, Høst 2030')
  await host.locator('[name=model]').selectOption('published-study-model')
  const periods = host.locator('[name=studySemester]')
  await expect(periods.locator('option[value="semester-10"]')).toHaveText('10. studiesemester · Vår 2031')
  await expect(periods.locator('option[value="semester-11"]')).toHaveText('11. studiesemester · Høst 2031')
  await expect(periods.locator('option[value="semester-8"], option[value="semester-9"]')).toHaveCount(0)
  expect(await raw(page)).toBe(before)

  const snapshots = [initial]
  for (const [index, period] of correctedPeriods.entries()) {
    await periods.selectOption(period.id)
    const calendarValue = `${period.year}:${period.semester}`
    await expect(host.locator(`[name=calendarSemester] option[value="${calendarValue}"]`)).toHaveText(`${period.semester === 'spring' ? 'Vår' : 'Høst'} 2031`)
    await host.locator('[name=calendarSemester]').selectOption(calendarValue)
    await host.locator('[name=programCampus]').selectOption('AHO OSLO')
    await expect(host).toContainText(period.courses[0].name)
    const beforePreview = await raw(page)
    await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
    await expect(host.locator('.import-preview')).toContainText(`${period.studySemester}. studiesemester`)
    expect(await raw(page)).toBe(beforePreview)
    await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
    await expect(host.locator('.program-action-status')).toContainText('1 emne er lagret samlet')
    const committed = await saved(page)
    expect(committed.planner.courses.map(course => course.id)).toEqual(ids)
    expect(new Set(committed.planner.courses.map(course => course.id)).size).toBe(2)
    expect(committed.planner.courses.map(course => course.notes)).toEqual(existingCourses.map(course => course.notes))
    expect(committed.planner.courses[index]).toMatchObject({
      id: existingCourses[index].id, sourceProvider: 'aho-program',
      sourceRecordId: existingCourses[index].sourceRecordId, sourceVersion: existingCourses[index].sourceVersion,
      sourceUrl: existingCourses[index].sourceUrl, year: 2031, semester: period.semester,
      programBinding: { institution: 'aho', programCode: plan.program.code, modelId: model.id, cohort: '2026',
        studySemester: period.studySemester, calendarYear: 2031, calendarSemester: period.semester,
        sourceUrl: ahoSource, sourceNotes: period.courses[0].notes, calendarClarifiedByStudent: false, studySemesterClarifiedByStudent: false },
    })
    expect(committed.tasks).toEqual(initial.tasks)
    expect(committed.planner.events).toEqual(initial.planner.events)
    expect(committed.planner.sources).toEqual(initial.planner.sources)
    if (!index) expect(committed.planner.courses[1]).toEqual(existingCourses[1])
    snapshots.push(committed)
  }
  expect(snapshots[2].planner.courses.map(course => course.programBinding.studySemester)).toEqual([10, 11])
  await page.reload()
  expect((await saved(page)).planner).toEqual(snapshots[2].planner)
  expect((await saved(page)).tasks).toEqual(initial.tasks)
  for (const previous of [snapshots[1], initial]) {
    await navigate(page, 'settings')
    await (await reveal(page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }))).click()
    expect((await saved(page)).planner).toEqual(previous.planner)
    expect((await saved(page)).tasks).toEqual(initial.tasks)
    await page.reload()
    expect((await saved(page)).planner).toEqual(previous.planner)
    expect((await saved(page)).tasks).toEqual(initial.tasks)
  }
})

test('UiT readable English term PDF explains its actual support limit and preserves source edition and draft', async ({ page }) => {
  let failure
  try { parseUitPdf(uitTermPages(), uitInfo, uitQuery) } catch (error) { failure = { status: error.status, error: error.message } }
  expect(failure.status).toBe('not-supported')
  await page.route('**/api/import/providers/uit/**', route => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    const data = action === 'programs' ? { status: 'ok', results: [{ code: uitQuery.program, name: uitInfo.name, sourceUrl: uitInfo.sourceUrl }] } : action === 'program-cohorts' ? { status: 'ok', results: [{ cohort: 'pdf-941723', label: uitInfo.label, sourceUrl: uitPdfUrl, requiresStudentCohort: true }] } : failure
    return route.fulfill({ json: data })
  })
  const { host, before } = await start(page, 'uit')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.locator('[name=studentCohort]').fill('2026')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  const message = sourceMessage(host)
  await expect(message).toContainText('PDF-en er lesbar')
  await expect(message).toContainText('terminer og ECTS-kolonner som denne importen ikke støtter')
  await expect(message).toContainText('ingen kalenderår eller studiepoeng er gjettet')
  await expect(message).not.toContainText('mangler en lesbar studieplanforside')
  await expect(message).toContainText('Lagrede data er beholdt')
  await expect(host.getByRole('link', { name: 'Åpne valgt PDF-kilde', exact: true })).toHaveAttribute('href', uitPdfUrl)
  await expect(host.locator('[name=model]')).toBeHidden()
  expect(await raw(page)).toBe(before)
  await page.reload()
  expect(await raw(page)).toBe(before)
  await openProgrammes(page)
  await expect(page.locator('.program-import [name=studentCohort]')).toHaveValue('2026')
  await expect(page.locator('.program-import [name=cohort] option:checked')).toHaveText(uitInfo.label)
})
