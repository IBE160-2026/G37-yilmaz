import { test, expect } from '@playwright/test'
import { navigate, openImportMethod, tabTo, key, freeze, raw, saved, instrumentWrites, writes } from './helpers.js'

const existingPlan = {
  schemaVersion: 1,
  tasks: [{ id: 'saved-task', title: 'Behold oppgaven', course: 'FIN5002', courseId: 'existing', deadlineLocal: '', estimatedMinutes: null, completed: false }],
  planner: {
    courses: [
      { id: 'existing', code: 'FIN5002', name: 'Første lagrede emne', university: 'Nord', year: 2026, semester: 'autumn', notes: 'Behold emnenotatet' },
      { id: 'current-course', code: 'FIN5003', name: 'Andre lagrede emne', university: 'Nord', year: 2027, semester: 'spring', notes: 'Andre emnenotat' },
    ],
    events: [{ id: 'saved-event', courseId: 'existing', title: 'Behold undervisningen', start: '2026-10-01T08:00:00Z', end: '2026-10-01T09:00:00Z', notes: 'Behold undervisningsnotatet' }],
    sources: [],
  },
}
const calendar = (title, date = '20261015', uid = title) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART:${date}T100000Z\r\nDTEND:${date}T110000Z\r\nSUMMARY:${title}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
const currentOptions = [{ label: 'Gjeldende timeplan A', sourceObjectId: 'current-a' }, { label: 'Gjeldende timeplan B', sourceObjectId: 'current-b' }]
const calendarResponse = (title, date = '20261015', uid = title) => ({ status: 'ok', calendarUrl: `https://calendar.example.test/${uid}.ics`, calendar: calendar(title, date, uid), warnings: [] })

async function bootSavedPlan(page, data = existingPlan) {
  await freeze(page, '2026-09-19T12:00:00+02:00')
  // Every import response in these cases is supplied locally; an unmatched API
  // request must not reach an institution or mutate the synthetic saved plan.
  await page.route('**/api/import/**', route => route.fulfill({ status: 503, json: { error: 'Uventet forespørsel i lokal prøve' } }))
  await page.goto('/')
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key, data })
  await instrumentWrites(page)
  await page.reload(); await navigate(page, 'subjects')
  expect(await writes(page)).toEqual([])
}

async function openSavedTeaching(page) {
  await openImportMethod(page, 'calendar')
  await page.getByText('Finn offentlig undervisning for et lagret emne', { exact: true }).click()
  const form = page.locator('form').filter({ has: page.getByRole('combobox', { name: 'Lagret emne for undervisning', exact: true }) })
  const institution = form.getByRole('combobox', { name: 'Lærested for offentlig undervisning', exact: true })
  const course = form.getByRole('combobox', { name: 'Lagret emne for undervisning', exact: true })
  await institution.selectOption('nord'); await course.selectOption('existing')
  return {
    form, course,
    query: form.getByLabel('Emnekode, emnenavn eller publisert kullnavn', { exact: true }),
    options: form.getByRole('combobox', { name: 'Publisert timeplanvalg', exact: true, includeHidden: true }),
    search: form.getByRole('button', { name: 'Søk offentlig undervisning', exact: true }),
    load: form.getByRole('button', { name: 'Forhåndsvis valgt offentlig undervisning', exact: true, includeHidden: true }),
  }
}

async function fetchSavedPreview(page, controls, option = '0') {
  await controls.search.click(); await expect(controls.options).toBeVisible()
  await controls.options.selectOption(option); await controls.load.click()
  await expect(page.locator('#import-preview')).toBeVisible()
  return page.locator('#import-preview')
}

test('R14 saved program source notes remain one readable text paragraph after reload', async ({ page }, info) => {
  const note = 'Kilden oppgir ikke hvilket valgemne studenten skal ta. Bekreft valget selv. <img src=x onerror=alert(1)> er bare kildetekst.'
  const data = structuredClone(existingPlan)
  const binding = { institution: 'nord', programCode: 'SYNTHETIC', programName: 'Syntetisk program', cohort: '2026', modelId: 'common', modelName: '', campus: '', choice: 'V', sourceUrl: 'https://example.test/studieplan', checkedAt: '2026-09-19T10:00:00Z', studySemester: 1, calendarYear: 2026, calendarSemester: 'autumn', sourceNotes: note }
  data.planner.courses[0].programBinding = binding
  data.planner.courses[1].programBinding = { ...binding, sourceNotes: '' }
  await page.setViewportSize({ width: 390, height: 900 })
  await bootSavedPlan(page, data)
  await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
  const card = page.locator('.course-card[data-course-id="existing"]')
  await expect(card.locator('.import-warning')).toHaveCount(1)
  await expect(card.locator('.import-warning')).toHaveText(note)
  await expect(card.locator('img')).toHaveCount(0)
  await expect(page.locator('.course-card[data-course-id="current-course"] .import-warning')).toHaveCount(0)
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('saved-program-source-notes-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(await saved(page)).toEqual(data)
  await page.reload(); await navigate(page, 'subjects')
  await expect(card.locator('.import-warning')).toHaveCount(1)
  await expect(card.locator('.import-warning')).toHaveText(note)
  expect(await writes(page)).toEqual([])
})

test('R14 select all restores saved excluded occurrences with exact IDs and local notes', async ({ page }, info) => {
  await bootSavedPlan(page)
  const events = [['a', 'Første forelesning', 'Forelesninger', '15'], ['b', 'Andre forelesning', 'Forelesninger', '16'], ['c', 'Seminar', 'Seminargruppe 1', '17']]
  const data = { status: 'ok', calendarUrl: 'https://calendar.example.test/stable-selection.ics', warnings: [], calendar: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.map(([uid, title, group, day]) => `BEGIN:VEVENT\r\nUID:selection-${uid}\r\nDTSTART:202610${day}T100000Z\r\nDTEND:202610${day}T110000Z\r\nSUMMARY:${title}\r\nX-GROUP:${group}\r\nEND:VEVENT\r\n`).join('')}END:VCALENDAR\r\n` }
  await page.route('**/api/import/providers/nord/teaching-search?*', route => route.fulfill({ json: { status: 'ok', results: currentOptions } }))
  await page.route('**/api/import/providers/nord/teaching-calendar?*', route => route.fulfill({ json: data }))
  let controls = await openSavedTeaching(page)
  const preview = await fetchSavedPreview(page, controls)
  const all = preview.getByRole('button', { name: 'Velg alle aktiviteter i dette timeplanvalget', exact: true })
  const none = preview.getByRole('button', { name: 'Velg ingen aktiviteter', exact: true })
  const confirm = preview.getByRole('button', { name: 'Bekreft import', exact: true })
  await all.click(); await expect(preview.getByText(/^3 valgte økter:/)).toBeVisible()
  expect(await writes(page)).toEqual([])
  await confirm.click(); await expect(preview).toBeHidden()
  const first = (await saved(page)).planner.events.find(event => event.sourceUid === 'selection-a')
  await page.getByRole('button', { name: 'Rediger undervisning Første forelesning', exact: true }).click()
  await page.locator('#subject-editor').getByLabel('Egne notater', { exact: true }).fill('Mitt lokale notat må følge denne forekomsten')
  await page.locator('#subject-editor').getByRole('button', { name: 'Lagre undervisning', exact: true }).click()
  const withNotes = await saved(page)
  await fetchSavedPreview(page, controls)
  await preview.getByRole('checkbox', { name: /^Ta med Første forelesning / }).uncheck()
  await expect(preview.getByText(/^2 valgte økter:/)).toBeVisible()
  expect(await saved(page)).toEqual(withNotes)
  await confirm.click(); await expect(preview).toBeHidden()
  const excluded = await saved(page), source = excluded.planner.sources[0]
  expect(source.excludedKeys).toEqual([first.sourceKey])
  expect(excluded.planner.events.find(event => event.id === first.id)).toMatchObject({ excluded: true, notes: 'Mitt lokale notat må følge denne forekomsten' })
  await page.reload(); await navigate(page, 'subjects')
  expect(await saved(page)).toEqual(excluded)
  controls = await openSavedTeaching(page)
  await fetchSavedPreview(page, controls)
  await expect(preview.getByText(/^2 valgte økter:/)).toBeVisible()
  await expect(preview.getByRole('checkbox', { name: /^Ta med Første forelesning / })).not.toBeChecked()
  await all.click()
  await expect(preview.getByText(/^3 valgte økter:/)).toBeVisible()
  await expect(preview.getByText(/1 valgt igjen/)).toBeVisible()
  await expect(preview.locator('.preview-events input:checked')).toHaveCount(3)
  await none.click(); await expect(preview.getByText(/^0 valgte økter:/)).toBeVisible()
  await all.click(); await all.click()
  await preview.getByRole('checkbox', { name: /^Ta med Andre forelesning / }).uncheck()
  await expect(preview.getByText(/^2 valgte økter:/)).toBeVisible()
  await all.click(); await expect(preview.getByText(/^3 valgte økter:/)).toBeVisible()
  expect(await saved(page)).toEqual(excluded)
  expect(await writes(page)).toEqual([])
  await page.screenshot({ path: info.outputPath('saved-occurrences-selected-again.png'), fullPage: true })
  await confirm.click(); await expect(preview).toBeHidden()
  const restored = await saved(page)
  expect(restored.planner.sources).toHaveLength(1)
  expect(restored.planner.sources[0]).toMatchObject({ id: source.id, excludedKeys: [], groups: ['Forelesninger', 'Seminargruppe 1'] })
  expect(restored.planner.events.map(event => event.id)).toEqual(excluded.planner.events.map(event => event.id))
  expect(restored.planner.events.filter(event => event.excluded)).toHaveLength(0)
  expect(restored.planner.events.find(event => event.id === first.id)).toMatchObject({ notes: 'Mitt lokale notat må følge denne forekomsten', cancelled: false })
  expect(restored.planner.courses).toEqual(excluded.planner.courses)
  expect(restored.tasks).toEqual(excluded.tasks)
  await page.reload(); await navigate(page, 'subjects')
  expect(await saved(page)).toEqual(restored)
  controls = await openSavedTeaching(page)
  await fetchSavedPreview(page, controls)
  await expect(preview.getByText(/^3 valgte økter: 0 nye,/)).toBeVisible()
  await none.click(); await all.click(); await none.click()
  await preview.getByRole('button', { name: 'Avbryt import', exact: true }).click()
  expect(await saved(page)).toEqual(restored)
  expect(await writes(page)).toEqual([])
})

for (const phase of ['search', 'calendar']) for (const changed of phase === 'search' ? ['course', 'query'] : ['course', 'query', 'object']) {
  test(`R14 held saved-course ${phase} ignores an obsolete ${changed} choice, then imports the current selection`, async ({ page }, info) => {
    await bootSavedPlan(page)
    const controls = await openSavedTeaching(page), before = await raw(page)
    let release, held = false
    const calls = []
    await page.route('**/api/import/providers/nord/teaching-*?*', async route => {
      const url = new URL(route.request().url()), action = url.pathname.endsWith('teaching-search') ? 'search' : 'calendar'
      calls.push({ action, ...Object.fromEntries(url.searchParams) })
      if (!held && action === phase) {
        held = true
        await new Promise(resolve => { release = resolve })
        await route.fulfill({ json: phase === 'search' ? { status: 'ok', results: [{ label: 'Foreldet timeplan', sourceObjectId: 'obsolete' }] } : calendarResponse('Foreldet undervisning') })
      } else await route.fulfill({ json: action === 'search' ? { status: 'ok', results: currentOptions } : calendarResponse('Gjeldende undervisning', url.searchParams.get('year') === '2027' ? '20270315' : '20261015', url.searchParams.get('sourceObjectId')) })
    })
    await controls.search.click()
    if (phase === 'calendar') {
      await expect(controls.options).toBeVisible(); await controls.options.selectOption('0'); await controls.load.click()
    }
    await expect.poll(() => Boolean(release)).toBe(true)
    if (changed === 'course') await controls.course.selectOption('current-course')
    if (changed === 'query') await controls.query.fill('Gjeldende søk')
    if (changed === 'object') await controls.options.selectOption('1')
    expect(await raw(page)).toBe(before)
    release()
    await expect(phase === 'search' ? controls.search : controls.load).toBeEnabled()
    await expect(page.locator('#import-preview')).toBeHidden()
    await expect(controls.form.locator('option').filter({ hasText: 'Foreldet timeplan' })).toHaveCount(0)
    await expect(page.getByText('Foreldet undervisning', { exact: true })).toHaveCount(0)
    if (changed === 'object') await expect(controls.options).toHaveValue('1')
    else { await expect(controls.options).toBeHidden(); await expect(controls.options.locator('option')).toHaveCount(1) }
    expect(await raw(page)).toBe(before)
    expect(await writes(page)).toEqual([])
    if (changed === 'object') await controls.load.click()
    else await fetchSavedPreview(page, controls)
    const preview = page.locator('#import-preview')
    await expect(preview).toBeVisible()
    await preview.getByRole('button', { name: 'Velg alle aktiviteter i dette timeplanvalget', exact: true }).click()
    await expect(preview.getByText(/^1 valgte økter:/)).toBeVisible()
    await expect(preview.locator('.preview-events').getByText(/Gjeldende undervisning/)).toBeVisible()
    expect(await raw(page)).toBe(before)
    if (phase === 'calendar' && changed === 'object') await page.screenshot({ path: info.outputPath('saved-course-current-object-after-late-response.png'), fullPage: true })
    await preview.getByRole('button', { name: 'Bekreft import', exact: true }).click()
    await expect(preview).toBeHidden()
    const committed = await saved(page), target = changed === 'course' ? 'current-course' : 'existing'
    expect(committed.planner.events).toHaveLength(2)
    expect(committed.planner.events[0]).toEqual(existingPlan.planner.events[0])
    expect(committed.planner.events[1]).toMatchObject({ title: 'Gjeldende undervisning', courseId: target, sourceUid: changed === 'object' ? 'current-b' : 'current-a' })
    expect(committed.planner.sources).toHaveLength(1)
    expect(committed.planner.sources[0].courseId).toBe(target)
    expect(committed.tasks).toEqual(existingPlan.tasks)
    expect(committed.planner.courses.map(course => [course.id, course.notes])).toEqual(existingPlan.planner.courses.map(course => [course.id, course.notes]))
    expect(calls.at(-1)).toMatchObject({ action: 'calendar', q: changed === 'query' ? 'Gjeldende søk' : changed === 'course' ? 'FIN5003' : 'FIN5002', year: changed === 'course' ? '2027' : '2026', semester: changed === 'course' ? 'spring' : 'autumn', sourceObjectId: changed === 'object' ? 'current-b' : 'current-a' })
    await page.reload(); await navigate(page, 'subjects')
    expect(await saved(page)).toEqual(committed)
    expect(await writes(page)).toEqual([])
  })
}

test('saved-course teaching can be selected by keyboard with large text and a failed refresh preserves the plan', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 900 })
  let unavailable = false
  await page.route('**/api/import/providers/nord/teaching-search?*', route => route.fulfill({ json: unavailable ? { status: 'source-unavailable', error: 'Midlertidig kildefeil. Lagret undervisning er beholdt.' } : { status: 'ok', results: [{ label: 'FIN5002 · Publisert testutvalg', sourceObjectId: 'FIN5002¤1' }] } }))
  const warning = 'Kilden dokumenterer ikke gruppetilhørighet.'
  await page.route('**/api/import/providers/nord/teaching-calendar?*', route => route.fulfill({ json: { status: 'ok', calendarUrl: 'https://calendar.example.test/course.ics', warnings: [warning, warning], calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:stable-fixture-lecture\r\nDTSTART:20260915T100000Z\r\nDTEND:20260915T110000Z\r\nSUMMARY:Testforelesning\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n' } }))
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [{ id: 'existing', code: 'FIN5002', name: 'Lokalt testemne', university: 'Nord', year: 2026, semester: 'autumn' }], events: [], sources: [] } })), key)
  await page.reload()
  await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
  await navigate(page, 'subjects'); await openImportMethod(page, 'calendar')
  const summary = page.getByText('Finn offentlig undervisning for et lagret emne', { exact: true })
  await tabTo(page, summary); await page.keyboard.press('Enter')
  await expect(page.locator('#calendar-import-form')).toBeHidden()
  const institution = page.getByRole('combobox', { name: 'Lærested for offentlig undervisning', exact: true })
  await tabTo(page, institution); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await expect(institution).toHaveValue('nord')
  const course = page.getByRole('combobox', { name: 'Lagret emne for undervisning', exact: true })
  await tabTo(page, course); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await expect(page.getByLabel('Emnekode, emnenavn eller publisert kullnavn', { exact: true })).toHaveValue('FIN5002')
  const search = page.getByRole('button', { name: 'Søk offentlig undervisning', exact: true })
  await tabTo(page, search); await page.keyboard.press('Enter')
  const options = page.getByRole('combobox', { name: 'Publisert timeplanvalg', exact: true })
  await expect(options).toHaveValue('')
  await tabTo(page, options); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  const load = page.getByRole('button', { name: 'Forhåndsvis valgt offentlig undervisning', exact: true })
  await tabTo(page, load); await page.keyboard.press('Enter')
  const preview = page.locator('#import-preview')
  await expect(preview).toBeVisible()
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).planner.events).toEqual([])
  const sourceDetails = preview.locator('.source-details')
  await sourceDetails.locator(':scope > summary').click()
  await expect(sourceDetails.getByText(warning, { exact: true })).toHaveCount(1)
  await sourceDetails.locator(':scope > summary').click()
  await tabTo(page, preview.locator('summary').filter({ hasText: /^Aktivitetsutvalg/ })); await page.keyboard.press('Enter')
  const activity = preview.locator('.activity-choices input')
  await expect(activity).not.toBeChecked()
  await tabTo(page, activity); await page.keyboard.press('Space')
  await page.screenshot({ path: info.outputPath('public-teaching-keyboard-large-text.png'), fullPage: true })
  const confirm = preview.getByRole('button', { name: 'Bekreft import', exact: true })
  await tabTo(page, confirm); await page.keyboard.press('Enter')
  await expect(preview).toBeHidden()
  const committed = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  expect(committed.planner.events).toHaveLength(1)
  expect(committed.planner.events[0].courseId).toBe('existing')
  unavailable = true
  await search.click()
  await expect(page.getByRole('status').filter({ hasText: 'Midlertidig kildefeil. Lagret undervisning er beholdt.' })).toBeVisible()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(committed)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
