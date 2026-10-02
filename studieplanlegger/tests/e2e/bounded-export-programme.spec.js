import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import ICAL from 'ical.js'
import { calendarUid } from '../../src/calendar-export.js'
import { freeze, key, navigate, raw, saved, tabTo } from './helpers.js'

// Entirely synthetic state and simulated public responses; no live source is used.
const task = (id, title, deadlineLocal) => ({ id, title, deadlineLocal, course: '', estimatedMinutes: null, completed: false })
const review = (id, reviewTopicId, startTime, endTime) => ({ id, reviewTopicId, dateLocal: '2026-10-25', startTime, endTime })
const parseEvents = source => new ICAL.Component(ICAL.parse(source)).getAllSubcomponents('vevent')
async function seedState(page, state, view) {
  await freeze(page, '2026-10-25T10:00:00+01:00')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, onboarding: { dismissed: true, completed: true }, ...state })), { key, state })
  await page.reload()
  await navigate(page, view)
}
async function openProgram(page) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  return page.locator('.program-import')
}
async function settleDayCalendarLayout(page) {
  await page.evaluate(() => document.fonts.ready)
  let previous, stableFrames = 0
  await expect.poll(async () => {
    // Advancing the frozen clock runs layout RAF callbacks. Native resize and
    // scroll events are delivered separately; wait for their persisted result.
    await page.clock.runFor(32)
    const layout = await page.locator('.full-calendar-viewport').evaluate((viewport, key) => {
      const raw = localStorage.getItem(key), preferences = JSON.parse(raw).calendarPreferences
      return { raw, fonts: document.fonts.status, bounds: viewport.getBoundingClientRect().toJSON(),
        headerHeight: viewport.querySelector('.calendar-time-day > h3').getBoundingClientRect().height,
        pointsHeight: viewport.querySelector('.calendar-points').getBoundingClientRect().height,
        top: viewport.scrollTop, left: viewport.scrollLeft,
        saved: preferences.scroll[`day:${preferences.date}`] || { top: 440, left: 0 } }
    }, key)
    const current = JSON.stringify(layout)
    stableFrames = current === previous ? stableFrames + 1 : 0
    previous = current
    return stableFrames >= 2 && layout.fonts === 'loaded' && layout.top === layout.saved.top && layout.left === layout.saved.left
  }, { message: 'Calendar layout and persisted scroll must settle before export', intervals: [20, 50, 100] }).toBe(true)
}

test('mixed export names omitted deadlines and downloads exact topic titles and unchanged identities on desktop and enlarged mobile', async ({ page }, info) => {
  const topicTitle = 'Ærlig, tema; med \\ tegn\nog ny linje'
  await seedState(page, {
    tasks: [task('date', 'Datofrist', '2026-10-25'), task('time', 'Klokkeslettfrist', '2026-10-25T12:00'),
      task('omitted-a', '<syntetisk> Uavklart levering', '2026-10-25T02:30'), task('omitted-b', 'Uavklart utkast', '2026-10-25T02:45')],
    topics: [{ id: 'topic', title: topicTitle }],
    sessions: [review('known-review', 'topic', '10:00', '10:30'), review('missing-review', 'unavailable', '11:00', '11:30')],
  }, 'calendar')
  await page.locator('[data-calendar-view=day]').click()
  const downloads = []
  page.on('download', download => downloads.push(download))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390) await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
    // Enlarged text changes the sticky header, causing scroll anchoring and a
    // queued preference write. Settle it before comparing the entire envelope.
    await settleDayCalendarLayout(page)
    const before = await raw(page)
    await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
    await expect(dialog.locator('[data-export-status]')).toContainText('4 aktiviteter blir eksportert. 2 frister er utelatt.')
    await expect(dialog.getByRole('list', { name: 'Utelatte frister' }).getByRole('listitem')).toHaveText([
      '<syntetisk> Uavklart levering (2026-10-25T02:30): Klokkeslettet forekommer to ganger ved overgangen til vintertid i norsk tid. Velg et entydig klokkeslett i oppgaven.',
      'Uavklart utkast (2026-10-25T02:45): Klokkeslettet forekommer to ganger ved overgangen til vintertid i norsk tid. Velg et entydig klokkeslett i oppgaven.',
    ])
    expect(await dialog.locator('[data-export-omissions] syntetisk').count()).toBe(0)
    await dialog.getByLabel('Frister', { exact: true }).uncheck()
    await expect(dialog.locator('[data-export-status]')).toHaveText('2 aktiviteter blir eksportert.')
    await expect(dialog.locator('[data-export-omissions]')).toBeHidden()
    await dialog.getByLabel('Frister', { exact: true }).check()
    const downloadButton = dialog.getByRole('button', { name: 'Last ned .ics', exact: true })
    await tabTo(page, downloadButton)
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`bounded-export-${width}.png`), fullPage: true })
    const pending = page.waitForEvent('download')
    await downloadButton.press('Enter')
    const source = await readFile(await (await pending).path(), 'utf8'), events = parseEvents(source)
    expect(events).toHaveLength(4)
    const byUid = new Map(events.map(event => [event.getFirstPropertyValue('uid'), event]))
    expect(byUid.get(calendarUid('session', 'known-review')).getFirstPropertyValue('summary')).toBe(`Repetisjon: ${topicTitle}`)
    expect(byUid.get(calendarUid('session', 'known-review')).getFirstPropertyValue('dtstart').toString()).toBe('2026-10-25T09:00:00Z')
    expect(byUid.get(calendarUid('session', 'missing-review')).getFirstPropertyValue('summary')).toBe('Repetisjon (tema ikke tilgjengelig)')
    expect(byUid.get(calendarUid('deadline', 'date')).getFirstPropertyValue('dtstart').isDate).toBe(true)
    expect(byUid.get(calendarUid('deadline', 'date')).hasProperty('dtend')).toBe(false)
    expect(byUid.get(calendarUid('deadline', 'time')).getFirstPropertyValue('dtstart').toString()).toBe('2026-10-25T11:00:00Z')
    expect(source).not.toContain('Uavklart')
    expect(await raw(page)).toBe(before)
  }
  expect(downloads).toHaveLength(2)
})

test('all-omitted export explains the exact deadline, stays disabled, and writes nothing', async ({ page }) => {
  await seedState(page, { tasks: [task('only', 'Bare tvetydig frist', '2026-10-25T02:30')] }, 'calendar')
  await page.locator('[data-calendar-view=day]').click()
  const before = await raw(page), downloads = []
  page.on('download', download => downloads.push(download))
  await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
  await expect(dialog.locator('[data-export-status]')).toContainText('Ingen aktiviteter finnes i valgt periode med valgte typer. 1 frist er utelatt.')
  await expect(dialog.getByRole('listitem')).toContainText('Bare tvetydig frist (2026-10-25T02:30): Klokkeslettet forekommer to ganger')
  await expect(dialog.getByRole('button', { name: 'Last ned .ics' })).toBeDisabled()
  await dialog.getByLabel('Frister', { exact: true }).uncheck()
  await expect(dialog.getByRole('button', { name: 'Last ned .ics' })).toBeDisabled()
  await dialog.getByLabel('Frister', { exact: true }).check()
  await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click()
  expect(downloads).toEqual([])
  expect(await raw(page)).toBe(before)
})

test('actual programme selector uses Norwegian name and tie ordering while preserving variant and source groups through restoration', async ({ page }, info) => {
  const source = id => `https://example.test/synthetic-programmes/${id}`
  const programmes = [
    { id: 'aa', name: 'Årsstudium', code: 'Å1' },
    { id: 'm-b', name: 'Design', code: 'D1', level: 'Master', cohort: '2027', intake: 'autumn' },
    { id: 'd2', name: 'design', code: 'D2', level: 'Bachelor' },
    { id: 'oe', name: 'Økonomi', code: 'Ø1' },
    { id: 'anatomy-z', name: 'anatomi', code: 'A2' },
    { id: 'm-a', name: 'design', code: 'D1', level: 'Master', cohort: '2026', intake: 'spring' },
    { id: 'b', name: 'DESIGN', code: 'D1', level: 'Bachelor' },
    { id: 'ae', name: 'Æresstudium', code: 'Æ1' },
    { id: 'anatomy-a', name: 'Anatomi', code: 'A1' },
  ].map(programme => ({ ...programme, sourceUrl: source(programme.id) }))
  // Expected order is deliberately literal, independent of the production sorter.
  const expectedIds = ['anatomy-a', 'anatomy-z', 'b', 'm-a', 'm-b', 'd2', 'ae', 'oe', 'aa']
  const labels = ['Velg studieprogram', 'Anatomi · A1', 'anatomi · A2', 'DESIGN · D1 · Bachelor',
    'design · D1 · Master · Kull 2026 · vår', 'Design · D1 · Master · Kull 2027 · høst',
    'design · D2 · Bachelor', 'Æresstudium · Æ1', 'Økonomi · Ø1', 'Årsstudium · Å1']
  const makeCourse = (id, name) => ({ id, code: id.toUpperCase(), name, choice: 'V', credits: 5, university: 'Syntetisk lærested', year: 2027, semester: 'autumn', notes: '', sourceProvider: 'himolde', sourceRecordId: id, sourceVersion: '2027', sourceUrl: source('m-b') })
  const groups = [
    { id: 'z-group', label: 'Øvingsgruppe fra kilden', options: [
      { id: 'z-option', label: 'Årlig variant', courseIds: ['course-z'] },
      { id: 'a-option', label: 'Alminnelig variant', courseIds: ['course-a'] },
    ] },
    { id: 'a-group', label: 'Andre kildegruppe', options: [
      { id: 'same-b', label: 'Lik variant', courseIds: ['course-b'] },
      { id: 'same-a', label: 'Lik variant', courseIds: ['course-c'] },
    ] },
  ]
  const plan = { program: { code: 'D1', name: 'Design', cohort: '2027', sourceUrl: source('m-b'), campuses: [] }, models: [
    { id: 'z-model', name: 'Z-modell først i kilden', periods: [
      { id: '2', label: 'Kildens første periode', studySemester: 2, year: 2027, semester: 'autumn', alternativeGroups: groups, courses: [makeCourse('course-z', 'Årlig emne'), makeCourse('course-a', 'Alminnelig emne'), makeCourse('course-b', 'Lik B'), makeCourse('course-c', 'Lik A')] },
      { id: '1', label: 'Kildens andre periode', studySemester: 1, year: 2027, semester: 'spring', courses: [] },
    ] },
    { id: 'a-model', name: 'A-modell sist i kilden', periods: [] },
  ], warnings: [] }
  const requests = []
  await page.route('**/api/import/providers/himolde/**', async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1)
    requests.push({ action, program: url.searchParams.get('program'), sourceUrl: url.searchParams.get('sourceUrl') })
    const data = action === 'programs' ? { results: programmes, completeness: { complete: true } }
      : action === 'program-cohorts' ? { results: [{ cohort: '2027', sourceUrl: url.searchParams.get('sourceUrl') }] }
        : action === 'program-plan' ? plan : { results: [] }
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  await seedState(page, { tasks: [] }, 'subjects')
  const host = await openProgram(page)
  await host.locator('[name=institution]').selectOption('himolde')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await expect(host.locator('[name=program] option')).toHaveText(labels)
  const draftKey = 'studieplanlegger:program-import-draft:v1'
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).programs.map(item => item.id), draftKey)).toEqual(expectedIds)
  await host.locator('[name=program]').selectOption({ label: 'Design · D1 · Master · Kull 2027 · høst' })
  await host.locator('[name=cohort]').selectOption('0')
  expect(requests.find(item => item.action === 'program-cohorts')).toMatchObject({ program: 'D1', sourceUrl: source('m-b') })
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  expect(requests.find(item => item.action === 'program-plan')).toMatchObject({ program: 'D1', sourceUrl: source('m-b') })
  await expect(host.locator('[name=model] option')).toHaveText(['Velg studiemodell eller retning', 'Z-modell først i kilden', 'A-modell sist i kilden'])
  await host.locator('[name=model]').selectOption('z-model')
  await expect(host.locator('[name=studySemester] option')).toHaveText(['Velg studiesemester', 'Kildens første periode', 'Kildens andre periode'])
  await host.locator('[name=studySemester]').selectOption('2')
  await host.locator('[name=calendarSemester]').selectOption('2027:autumn')
  await expect(host.locator('.programme-alternatives > legend')).toHaveText(['Øvingsgruppe fra kilden', 'Andre kildegruppe'])
  expect(await host.locator('input[name=alternative-z-group]').evaluateAll(nodes => nodes.map(node => node.value))).toEqual(['a-option', 'z-option'])
  expect(await host.locator('input[name=alternative-a-group]').evaluateAll(nodes => nodes.map(node => node.value))).toEqual(['same-a', 'same-b'])
  await host.locator('input[name=alternative-z-group][value=z-option]').check()
  await host.locator('input[name=alternative-a-group][value=same-b]').focus()
  await page.keyboard.press('Space')
  const unchanged = await raw(page)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390) await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`bounded-programme-${width}.png`), fullPage: true })
  }
  // Older drafts can contain a different catalogue order. Preserve the selected
  // object as its array position changes during restoration and sorting.
  await page.evaluate(key => {
    const draft = JSON.parse(sessionStorage.getItem(key)), selected = draft.programs[Number(draft.values.program)]
    draft.programs.reverse(); draft.values.program = String(draft.programs.indexOf(selected))
    sessionStorage.setItem(key, JSON.stringify(draft))
  }, draftKey)
  await page.reload()
  await openProgram(page)
  await expect(host.locator('[name=program] option')).toHaveText(labels)
  await expect(host.locator('[name=program] option:checked')).toHaveText('Design · D1 · Master · Kull 2027 · høst')
  await expect(host.locator('[name=model]')).toHaveValue('z-model')
  await expect(host.locator('[name=studySemester]')).toHaveValue('2')
  await expect(host.locator('.programme-alternatives > legend')).toHaveText(['Øvingsgruppe fra kilden', 'Andre kildegruppe'])
  await expect(host.locator('input[name=alternative-z-group][value=z-option]')).toBeChecked()
  await expect(host.locator('input[name=alternative-a-group][value=same-b]')).toBeChecked()
  expect(await raw(page)).toBe(unchanged)
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeEnabled()
  await expect(host.locator('.import-preview article.course-card > h4')).toHaveText(['COURSE-Z Årlig emne', 'COURSE-B Lik B'])
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText('2 emner er lagret samlet')
  const imported = (await saved(page)).planner.courses
  expect(imported.map(course => course.id)).toEqual(['course-z', 'course-b'])
  for (const course of imported) expect(course.programBinding).toMatchObject({ programCode: 'D1', cohort: '2027', modelId: 'z-model', studySemester: 2, sourceUrl: source('m-b') })
})
