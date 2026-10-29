import { test, expect } from '@playwright/test'
import { freeze, instrumentWrites, navigate, reveal, saved } from './helpers.js'

// Synthetic responses use the bounded HiMolde IT 2026 choice contract already
// exercised in simplified-study-import.spec.js. No live calendar or student data
// is copied here. Actual source transport remains a separate opt-in live test.
const codes = ['IBE110', 'IBE430', 'IBE160']
const sourceUrl = 'https://www.himolde.no/studier/programmer/it/studieplaner/2026.html'
const courseId = code => `himolde:synthetic-it:2026:1:${code}`
const course = (code, choice = 'O') => ({
  id: courseId(code), code, name: `Syntetisk emne ${code}`, choice,
  credits: code === 'IBE160' ? 15 : 7.5, university: 'Høgskolen i Molde',
  year: 2026, semester: 'autumn', sourceProvider: 'himolde',
  sourceRecordId: code, sourceVersion: '2026', sourceUrl, description: '', notes: '',
})
const calendar = code => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ajour synthetic programme repeat//NO',
  ...['Forelesning', 'Seminar'].flatMap((group, index) => [
    'BEGIN:VEVENT', `UID:synthetic-${code}-${index}`, 'DTSTART:20260914T080000Z',
    'DTEND:20260914T090000Z', `SUMMARY:${code} Syntetisk ${group}`,
    `X-GROUP:${group}`, 'END:VEVENT',
  ]), 'END:VCALENDAR', '',
].join('\r\n')

async function fixture(page) {
  const calls = { plans: 0, searches: [], calendars: [] }
  await page.route('**/api/import/providers/himolde/**', async route => {
    const url = new URL(route.request().url())
    const action = url.pathname.split('/').at(-1), code = url.searchParams.get('q')
    let data
    if (action === 'programs') data = { results: [{ code: 'IT', name: 'Syntetisk IT', sourceUrl }], completeness: { complete: true } }
    else if (action === 'program-cohorts') data = { results: [{ cohort: '2026', sourceUrl }] }
    else if (action === 'program-plan') {
      calls.plans++
      data = {
        program: { code: 'IT', name: 'Syntetisk IT', cohort: '2026', sourceUrl, campuses: [] },
        models: [{ id: 'common', name: 'Felles', periods: [{
          id: '1', label: '1. studiesemester · Høst 2026', studySemester: 1, year: 2026, semester: 'autumn',
          courses: [course('IBE110'), course('IBE430'), course('IBE160', 'V'), course('IBE102', 'V'), course('IBE152', 'V')],
          requiredCourseIds: ['IBE110', 'IBE430'].map(courseId),
          alternativeGroups: [{ id: 'synthetic-choice', label: 'Programmeringsalternativ', sourceRequirement: 'Velg enten IBE160 eller IBE102 og IBE152.', options: [
            { id: 'one', label: 'IBE160', courseIds: [courseId('IBE160')], credits: 15 },
            { id: 'pair', label: 'IBE102 og IBE152', courseIds: ['IBE102', 'IBE152'].map(courseId), credits: 15 },
          ] }],
        }] }], warnings: [],
      }
    } else if (action === 'teaching-search') {
      expect(codes).toContain(code)
      calls.searches.push(code)
      data = { results: [{ code, sourceObjectId: `${code}¤1`, label: `${code} · Syntetisk undervisning` }] }
    } else if (action === 'teaching-calendar') {
      expect(codes).toContain(code)
      expect(url.searchParams.get('sourceObjectId')).toBe(`${code}¤1`)
      calls.calendars.push(code)
      data = { calendar: calendar(code), calendarUrl: `https://synthetic.example.test/${code}.ics`, commonGroups: [], warnings: [] }
    } else throw new Error('Unexpected synthetic programme request')
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  return calls
}

async function preview(page, attempt) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Finn studieprogram', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('himolde')
  await host.locator('[name=catalogueYear]').fill('2026')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption('common')
  await host.locator('[name=studySemester]').selectOption('1')
  await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
  for (const code of ['IBE110', 'IBE430']) await expect(host.getByRole('checkbox', { name: new RegExp(`${code}.*Påkrevd`) })).toBeChecked()
  await expect(host.getByRole('radio', { name: /IBE160/ })).not.toBeChecked()
  await host.getByRole('radio', { name: /IBE160/ }).check()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeEnabled()
  for (const code of codes) {
    const card = host.locator('.import-preview article.course-card').filter({ hasText: new RegExp(`^${code}\\b`) }).first()
    await card.locator('summary').filter({ hasText: new RegExp(`^Undervisningsgrupper for ${code}`) }).click()
    const group = card.getByRole('group', { name: `Undervisningsgrupper for ${code}`, exact: true })
    await expect(group.getByRole('checkbox').first()).toBeVisible()
    const lecture = group.getByRole('checkbox', { name: /Forelesning/ })
    const seminar = group.getByRole('checkbox', { name: /Seminar/ })
    await expect(seminar).not.toBeChecked()
    if (attempt === 0) {
      await expect(lecture).not.toBeChecked()
      await lecture.check()
    } else await expect(lecture).toBeChecked()
  }
  return host
}

test('synthetic full HiMolde programme repeat preserves identities, choices and local edits after reload', async ({ page }, info) => {
  await freeze(page, '2026-09-12T09:00:00+02:00')
  const calls = await fixture(page)
  await instrumentWrites(page)
  await page.goto('/')
  let initial
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await saved(page)
    const host = await preview(page, attempt)
    expect(await saved(page)).toEqual(before)
    expect(await page.evaluate(() => window.writeAttempts.length)).toBe(0)
    await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
    await expect(host.getByRole('status')).toContainText('3 emner er lagret samlet')
    expect(await page.evaluate(() => window.writeAttempts.length)).toBe(1)
    const after = await saved(page)
    expect(after.planner.courses.map(item => item.code).sort()).toEqual([...codes].sort())
    expect(after.planner.sources).toHaveLength(3)
    expect(after.planner.events).toHaveLength(3)
    expect(after.planner.courses.every(item => item.programBinding.institution === 'himolde' && item.teachingCheck.status === 'success')).toBe(true)
    expect(after.planner.sources.every(item => item.groups.length === 1 && item.groups[0] === 'Forelesning')).toBe(true)
    if (attempt === 0) {
      initial = after
      await (await reveal(page.getByRole('button', { name: 'Rediger emne IBE160', exact: true }))).click()
      await (await reveal(page.locator('#subject-editor [name=notes]'))).fill('Syntetisk eget notat beholdes ved gjentakelse')
      await page.getByRole('button', { name: 'Lagre emne', exact: true }).click()
    } else {
      for (const collection of ['courses', 'sources', 'events']) expect(after.planner[collection].map(item => item.id).sort()).toEqual(initial.planner[collection].map(item => item.id).sort())
      expect(after.planner.courses.find(item => item.code === 'IBE160').notes).toBe('Syntetisk eget notat beholdes ved gjentakelse')
      expect(after.planner.events).toEqual(before.planner.events)
      expect(after.planner.sources.map(item => ({ id: item.id, courseId: item.courseId, groups: item.groups }))).toEqual(before.planner.sources.map(item => ({ id: item.id, courseId: item.courseId, groups: item.groups })))
    }
    const committed = await saved(page)
    await page.reload()
    expect(await saved(page)).toEqual(committed)
  }
  expect(calls.plans).toBe(2)
  for (const code of codes) {
    expect(calls.searches.filter(item => item === code)).toHaveLength(2)
    expect(calls.calendars.filter(item => item === code)).toHaveLength(2)
  }
  await info.attach('synthetic-programme-repeat', { contentType: 'application/json', body: JSON.stringify({ source: 'synthetic-fixture', completeProgramPasses: 2, courseCount: 3, teachingSourceCount: 3, eventCount: 3, stableIdentities: true, retainedActivityChoices: true, retainedLocalNotes: true, writesPerConfirmation: 1, noPreapprovalWrites: true }) })
})
