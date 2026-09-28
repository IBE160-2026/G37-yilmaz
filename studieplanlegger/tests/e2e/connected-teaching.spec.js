import { test, expect } from '@playwright/test'
import { freeze, instrumentWrites, navigate, key } from './helpers.js'

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
const sourceUrl = 'https://www.usn.no/studier/studie-og-emneplaner/testprogram'
const calendarUrl = 'https://cloud.timeedit.net/usn/web/publikk/test.ics'
const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Synthetic acceptance//NO\r\nBEGIN:VEVENT\r\nUID:synthetic-usn-lecture\r\nDTSTART:20260914T100000Z\r\nDTEND:20260914T110000Z\r\nSUMMARY:TEST101 Forelesning\r\nLOCATION:Testrom\r\nEND:VEVENT\r\nEND:VCALENDAR'

test('public teaching requires an explicit source object and groups, then saves atomically and repeats without duplicates', async ({ page }) => {
  await freeze(page, '2026-09-12T09:00:00+02:00')
  let calendarCalls = 0, failSearch = false
  await page.route('**/api/import/providers/usn/**', async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1)
    let data
    if (action === 'programs') data = { results: [{ code: 'TEST', name: 'Syntetisk studieprogram', sourceUrl }], completeness: { complete: true } }
    if (action === 'program-cohorts') data = { results: [{ cohort: '2026', sourceUrl }] }
    if (action === 'program-plan') data = { program: { code: 'TEST', name: 'Syntetisk studieprogram', cohort: '2026', sourceUrl, campuses: [] }, models: [{ id: 'common', name: 'Felles studieløp', periods: [{ id: 'first', label: '1. studiesemester · Høst 2026', studySemester: 1, year: 2026, semester: 'autumn', courses: [{ id: 'usn-test', code: 'TEST101', name: 'Testemne', university: 'USN', year: 2026, semester: 'autumn', credits: 10, choice: 'O', sourceUrl, sourceProvider: 'usn', sourceRecordId: 'TEST101', sourceVersion: '2026H' }] }] }] }
    if (action === 'teaching-search') data = failSearch ? { status: 'transport-error', error: 'Syntetisk kildefeil' } : { results: [{ sourceObjectId: '123.199', label: 'TEST101 · Felles undervisning', sourceUrl: 'https://cloud.timeedit.net/usn/web/publikk/ri1Q5084.html' }], warnings: ['Velg objektet selv.'] }
    if (action === 'teaching-calendar') {
      calendarCalls++
      expect(url.searchParams.get('sourceObjectId')).toBe('123.199')
      data = { calendar, calendarUrl, warnings: [] }
    }
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  async function previewProgram() {
    await navigate(page, 'subjects')
    await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
    await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
    const host = page.locator('.program-import')
    await host.locator('[name=institution]').selectOption('usn')
    await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
    await host.locator('[name=program]').selectOption('0')
    await host.locator('[name=cohort]').selectOption('0')
    await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
    await host.locator('[name=model]').selectOption('common')
    await host.locator('[name=studySemester]').selectOption('first')
    await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
    await expect(host.locator('[name=programCampus]')).toBeHidden()
    await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
    await expect(host.locator('.program-action-status')).toBeFocused()
    return host
  }
  await page.goto('/')
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await stored(page), host = await previewProgram()
    const timetable = host.locator('details').filter({ has: page.getByLabel('Timeplansøk for TEST101', { exact: true }) })
    if (!await timetable.evaluate(node => node.open)) await timetable.locator(':scope > summary').click()
    await host.getByRole('button', { name: 'Søk offentlig undervisning for TEST101', exact: true }).click()
    await expect(host.getByLabel('Timeplanobjekt for TEST101', { exact: true })).toHaveValue('')
    await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
    expect(calendarCalls).toBe(attempt)
    expect(await stored(page)).toEqual(before)
    await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).selectOption('0')
    await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
    await expect(host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true })).toBeFocused()
    await host.locator('summary').filter({hasText:/Undervisningsgrupper for TEST101 ·/}).click()
    const groups = host.getByRole('group', { name: 'Undervisningsgrupper for TEST101', exact: true })
    if (attempt === 0) await expect(groups.getByRole('checkbox').first()).not.toBeChecked()
    await groups.getByRole('checkbox').first().check()
    expect(await stored(page)).toEqual(before)
    await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
    await expect(host.getByRole('status')).toBeFocused()
    await expect.poll(async () => (await stored(page))?.planner?.events?.length).toBe(1)
    const after = await stored(page)
    expect(after.planner.courses).toHaveLength(1)
    expect(after.planner.sources).toHaveLength(1)
    if (before) expect(after.planner.events[0].id).toBe(before.planner.events[0].id)
    await page.reload()
  }
  const beforeFailure = await stored(page), host = await previewProgram()
  failSearch = true
  const timetable = host.locator('details').filter({ has: page.getByLabel('Timeplansøk for TEST101', { exact: true }) })
  if (!await timetable.evaluate(node => node.open)) await timetable.locator(':scope > summary').click()
  await host.getByRole('button', { name: 'Søk offentlig undervisning for TEST101', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('Syntetisk kildefeil')
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeEnabled()
  expect(await stored(page)).toEqual(beforeFailure)
})

test('one programme preparation fetches an exact teaching object and commits once', async ({ page }) => {
  const exactCalendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:ibe160-lecture\r\nDTSTART:20260914T080000Z\r\nDTEND:20260914T100000Z\r\nSUMMARY:IBE160 Forelesning\r\nX-GROUP:Forelesning\r\nLOCATION:A-1\r\nEND:VEVENT\r\nEND:VCALENDAR'
  let calendarCalls = 0
  await page.route('**/api/import/providers/himolde/**', async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1)
    let data
    if (action === 'programs') data = { results: [{ code: 'IT', name: 'Informasjonsteknologi', sourceUrl: 'https://example.test/program' }], completeness: { complete: true } }
    else if (action === 'program-cohorts') data = { results: [{ cohort: '2026', sourceUrl: 'https://example.test/program' }] }
    else if (action === 'program-plan') data = { program: { code: 'IT', name: 'Informasjonsteknologi', cohort: '2026', sourceUrl: 'https://example.test/program', campuses: [] }, models: [{ id: 'common', name: 'Felles', periods: [{ id: 'first', label: '1. studiesemester · Høst 2026', studySemester: 1, year: 2026, semester: 'autumn', courses: [{ id: 'ibe160', code: 'IBE160', name: 'Programmering', university: 'Høgskolen i Molde', year: 2026, semester: 'autumn', credits: 15, choice: 'O', sourceProvider: 'himolde', sourceRecordId: 'IBE160', sourceVersion: '2026H', sourceUrl: 'https://example.test/course', description: '', notes: 'Kildeutdrag: Høst 2026; IBE160 Programmering; 15 studiepoeng.' }] }] }], warnings: [] }
    else if (action === 'teaching-search') data = { results: [{ code: 'IBE160', sourceObjectId: 'IBE160¤1', label: 'IBE160 · Programmering', sourceUrl: 'https://example.test/timetable' }] }
    else if (action === 'teaching-calendar') { calendarCalls++; data = { calendar: exactCalendar, calendarUrl: 'https://example.test/ibe160.ics', commonGroups:['Forelesning'], warnings: [] } }
    else data = { status: 'not-supported', error: 'Uventet testkall' }
    await route.fulfill({ json: { status: 'ok', ...data } })
  })

  await page.goto('/')
  await instrumentWrites(page)
  await page.reload()
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('himolde')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption('common')
  await host.locator('[name=studySemester]').selectOption('first')
  await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()

  await expect(host.getByText('Undervisning: Undervisning klar for import', { exact: true })).toBeVisible()
  await expect(host.getByLabel('Timeplanobjekt for IBE160', { exact: true })).toHaveValue('0')
  expect(calendarCalls).toBe(1)
  expect(await page.evaluate(() => window.writeAttempts)).toEqual([])
  const details = host.locator('details').filter({ hasText: /Undervisningsgrupper for IBE160/ }).first()
  await details.locator(':scope > summary').click()
  const group = host.getByRole('group', { name: 'Undervisningsgrupper for IBE160', exact: true })
  await expect(group.getByRole('checkbox').first()).toBeChecked()
  await group.getByRole('checkbox').first().focus()
  await expect(group.getByRole('checkbox').first()).toBeFocused()
  await expect(details).toHaveAttribute('open', '')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: 'artifacts/streamlined-import-desktop-1440.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  const largeText = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'artifacts/streamlined-import-mobile-390-200percent.png', fullPage: true })
  await largeText.evaluate(node => node.remove())
  await page.setViewportSize({ width: 1440, height: 1000 })

  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText('1 emne er lagret samlet. 1 undervisningshendelse ble importert')
  expect(calendarCalls).toBe(1)
  expect(await page.evaluate(() => window.writeAttempts.length)).toBe(1)
  const saved = await stored(page)
  expect(saved.planner.courses.map(course => course.code)).toEqual(['IBE160'])
  expect(saved.planner.events).toHaveLength(1)
  expect(saved.planner.sources[0].groups).toHaveLength(1)
})

test('legacy teaching layer shows course identity and clears stale colour when a reused row loses its course code', async ({ page }) => {
  await page.goto('/')
  const result=await page.evaluate(async()=>{
    const {createTeachingLayer}=await import('/src/teaching-calendar.js')
    const host=document.createElement('section')
    host.innerHTML='<div class="calendar-legend"></div><div class="calendar-month-view"></div><button data-calendar-date="2026-09-14" aria-pressed="true" aria-label="14. september"></button>'
    document.body.append(host)
    const layer=createTeachingLayer(host,{}),event={id:'teaching-1',courseId:'course-1',title:'Forelesning',start:'2026-09-14T08:00:00.000Z',end:'2026-09-14T10:00:00.000Z',location:'A-1'}
    layer.render({events:[event],courses:[{id:'course-1',code:'IBE160'}]})
    const row=host.querySelector('[data-calendar-event="teaching-1"]'),before={text:row.textContent,color:row.style.getPropertyValue('--course-color')}
    layer.render({events:[event],courses:[]})
    return{before,after:{text:row.textContent,color:row.style.getPropertyValue('--course-color')}}
  })
  expect(result.before.text).toContain('IBE160')
  expect(result.before.color).not.toBe('')
  expect(result.after.text).not.toContain('IBE160')
  expect(result.after.color).toBe('')
})
