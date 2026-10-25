import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { navigate, tabTo, reveal } from './helpers.js'
import { preview, eventRows, courseRows, openPreviewRow, captureTp, runtimeUrl, runtimeScenario, savedTpState, confirmTpImport, fixtureRows, tpCsvRows } from './tp-csv-helpers.js'

// Independently invented synthetic content. No student calendar or live source.
const mixedName = 'synthetic-clarity-mixed.ics'
const pointName = 'synthetic-clarity-points.csv'
const pointTitle = index => index === 0 ? 'Eksamen i oppdiktet SYN953' : `Oppdiktet tidspunkt ${index + 1}`
const mixedCalendar = ({ omitAffiliations = false } = {}) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...[
  ['SYN851', 'HiMolde', 'Oppdiktet emne A'], ['SYN852', 'NTNU', 'Oppdiktet emne B'], ['SYN853', '', 'Oppdiktet emne C'], ['SYN851', 'HiMolde', 'Oppdiktet emne A'],
].flatMap(([code, university, name], index) => ['BEGIN:VEVENT', `UID:synthetic-clarity-${code}-${index}`, `SUMMARY:Oppdiktet aktivitet ${index + 1}`, `DTSTART:2041110${index + 1}T100007Z`, `DTEND:2041110${index + 1}T100017Z`, `X-COURSE-CODE:${code}`, `X-COURSE-NAME:${name}`, ...(!omitAffiliations && university ? [`X-UNIVERSITY:${university}`] : []), 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n')
const pointCsv = () => tpCsvRows(fixtureRows().slice(0, 5).map((row, index) => ({ ...row, year: '2041', semester: 'autumn', eventid: `synthetic-clarity-point-${index}`, 'teaching-title_nb': pointTitle(index), dtstart: index === 3 ? 'synthetic-invalid-start' : `2041-11-0${index + 1}T11:00:07+01:00`, dtend: [ '2041-11-01T11:00:07+01:00', '', 'synthetic-invalid-end', '', '2041-11-05T11:00:17+01:00' ][index] })))

test.use({ trace: 'off' })
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic clarity tests do not contact external sources.' } }))
  await page.goto(runtimeUrl || '/')
})

async function openClarityFile(page, text, name, sourceId) {
  await navigate(page, 'subjects')
  await expect(page.getByRole('button', { name: 'Importer', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Importer kalenderfil', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  if (sourceId) {
    const details = page.locator('details').filter({ has: page.getByLabel('Ny kilde eller oppdatering', { exact: true }) })
    if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').click()
    await page.getByLabel('Ny kilde eller oppdatering', { exact: true }).selectOption(sourceId)
  }
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name, mimeType: name.endsWith('.ics') ? 'text/calendar' : 'text/csv', buffer: Buffer.from(text) })
  await expect(preview(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(preview(page)).toBeVisible()
  await expect(preview(page).getByRole('button', { name: 'Importer valgte', exact: true })).toHaveCount(1)
}

async function openSourceDetails(page) {
  const details = preview(page).locator('.document-source-details')
  if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').click()
}

function assertClarityLinks(state, name, { courseCount, eventCount }) {
  const source = state.importSources.find(item => item.name === name)
  expect(source).toBeTruthy()
  const courses = state.planner.courses.filter(item => item.importSourceId === source.id)
  const events = state.planner.events.filter(item => item.importSourceId === source.id)
  expect(courses).toHaveLength(courseCount)
  expect(events).toHaveLength(eventCount)
  expect(new Set(events.map(item => item.id)).size).toBe(eventCount)
  for (const item of [...courses, ...events]) expect(source.entries.find(entry => entry.key === item.importEntryKey)?.targetId).toBe(item.id)
  for (const event of events) expect(courses.some(course => course.id === event.courseId)).toBe(true)
  expect(state.tasks).toHaveLength(0)
  return { source, courses, events }
}

function assertMixed(state) {
  const linked = assertClarityLinks(state, mixedName, { courseCount: 3, eventCount: 3 })
  expect(linked.courses.map(({ code, name, university }) => ({ code, name, university }))).toEqual([
    { code: 'SYN851', name: 'Oppdiktet emne A', university: 'HiMolde' },
    { code: 'SYN852', name: 'Oppdiktet emne B', university: 'NTNU' },
    { code: 'SYN853', name: 'Oppdiktet emne C', university: '' },
  ])
  for (const [index, event] of linked.events.entries()) {
    expect(event).toMatchObject({ title: `Oppdiktet aktivitet ${index + 1}`, courseId: linked.courses[index].id })
    expect(Date.parse(event.start)).toBe(Date.parse(`2041-11-0${index + 1}T10:00:07Z`))
    expect(Date.parse(event.end) - Date.parse(event.start)).toBe(10_000)
  }
  expect(linked.source.excludedKeys).toHaveLength(1)
  return linked
}

function assertPoints(state, { edited = false } = {}) {
  const linked = assertClarityLinks(state, pointName, { courseCount: 1, eventCount: 4 })
  expect(linked.source.excludedKeys).toHaveLength(1)
  for (const index of [0, 1, 2]) {
    const event = linked.events.find(item => item.title === pointTitle(index))
    expect(event).toBeTruthy()
    if (index === 1 && edited) {
      expect(event.point).toBe(false)
      expect(event.pointProvenance).toBeUndefined()
      expect(Date.parse(event.end) - Date.parse(event.start)).toBe(30_000)
    } else {
      expect(event).toMatchObject({ point: true, pointProvenance: 'user', start: `2041-11-0${index + 1}T10:00:07Z`, end: `2041-11-0${index + 1}T10:00:07Z` })
    }
    const entry = linked.source.entries.find(item => item.targetId === event.id)
    expect(entry.sourceBase.point).not.toBe(true)
    expect(entry.sourceBase.pointProvenance).not.toBe('user')
    expect(event.activityKind).not.toBe('assessment')
    expect(event.activityKind).not.toBe('exam')
  }
  const interval = linked.events.find(item => item.title === 'Oppdiktet tidspunkt 5')
  expect(interval.point).not.toBe(true)
  expect(Date.parse(interval.end) - Date.parse(interval.start)).toBe(10_000)
  return linked
}

async function rejectedRuntimeWrites(page, verifyDraft) {
  if (!runtimeUrl) return
  const before = await savedTpState(page)
  const reject = route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, json: { error: 'synthetic-clarity-write-failure' } }) : route.continue()
  await page.route('**/api/state', reject)
  const failed = page.waitForResponse(response => response.url().endsWith('/api/state') && response.request().method() === 'PUT')
  await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
  expect((await failed).status()).toBe(500)
  await expect(preview(page).getByRole('alert')).not.toBeEmpty()
  expect(await savedTpState(page)).toEqual(before)
  await verifyDraft()
  await page.unroute('**/api/state', reject)
  const current = await (await page.request.get(`${runtimeUrl}/api/state`)).json()
  const concurrent = await page.request.put(`${runtimeUrl}/api/state`, { data: { expectedRevision: current.revision, envelope: current.envelope } })
  expect(concurrent.status()).toBe(200)
  const stale = page.waitForResponse(response => response.url().endsWith('/api/state') && response.request().method() === 'PUT')
  await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
  expect((await stale).status()).toBe(409)
  await expect(preview(page).getByRole('alert')).not.toBeEmpty()
  expect(await savedTpState(page)).toEqual(before)
  await verifyDraft()
}

async function editEvent(page, event, { notes, end } = {}) {
  await navigate(page, 'subjects')
  await page.locator(`[data-event-id="${event.id}"]`).getByRole('button', { name: `Rediger undervisning ${event.title}`, exact: true }).click()
  const editor = page.locator('#subject-editor')
  if (notes) await editor.getByLabel('Egne notater', { exact: true }).fill(notes)
  if (end) await editor.getByLabel('Slutt (valgfri; legg til varighet)', { exact: true }).fill(end)
  await editor.getByRole('button', { name: 'Lagre undervisning', exact: true }).click()
  await expect(editor).toBeHidden()
}

async function inspectImportedCalendar(page, event, { point = false, expectedEnd = '11:00:17' } = {}) {
  await page.getByRole('button', { name: 'Åpne kalenderen', exact: true }).click()
  await expect(page.locator('#view-calendar')).toHaveAttribute('aria-pressed', 'true')
  const calendar = page.locator('#full-calendar')
  await calendar.getByRole('button', { name: 'Agenda', exact: true }).click()
  await calendar.locator('#full-calendar-date').fill(event.start.slice(0, 10))
  await calendar.locator('#full-calendar-date').press('Tab')
  const entry = calendar.locator(`[data-calendar-key="event:${event.id}"]`)
  await expect(entry).toContainText(event.title)
  await expect(entry).toContainText('11:00:07')
  await expect(entry).not.toHaveClass(/is-exam/)
  await expect(entry.locator('.exam-badge')).toHaveCount(0)
  if (point) {
    await expect(entry).toHaveClass(/is-point/)
  }
  else await expect(entry).toContainText(`11:00:07–${expectedEnd}`)
  await entry.click()
  const details = page.getByRole('dialog', { name: event.title, exact: true })
  await expect(details).toBeVisible()
  await expect(details).toContainText('Europe/Oslo')
  await expect(details).not.toHaveClass(/is-exam/)
  await expect(details.locator('.eyebrow')).toHaveText('Undervisning')
  if (point) {
    await expect(details.getByText(/^Faktisk varighet:/)).toHaveCount(0)
  }
  await details.getByRole('button', { name: 'Lukk detaljer', exact: true }).click()
}

async function inspectReceiptAndSource(page, linked) {
  const receipt = page.locator('.document-import-receipt')
  await expect(receipt.getByRole('heading', { name: 'Importen er lagret', exact: true })).toBeFocused()
  await expect(receipt.locator('button.primary')).toHaveCount(1)
  await expect(receipt).toContainText(`${linked.courses.length} emner, ${linked.events.length} kalenderaktiviteter og 0 oppgaver`)
  await expect(receipt).toContainText('1 aktiviteter eller oppgaver utelatt av utvalget.')
  await expect(receipt).toContainText('Importen er en kopi og oppdateres ikke automatisk.')
  const card = page.locator(`.document-source-card[data-source-id="${linked.source.id}"]`)
  await expect(card.getByText('Kopi av fil / dokument · oppdateres ikke automatisk.', { exact: true })).toBeVisible()
  await expect(card.getByText(`${linked.courses.length} lagrede emner · ${linked.events.length} kalenderaktiviteter · 0 oppgaver.`, { exact: false })).toBeVisible()
  await expect(card.getByText('Sist oppdatert:', { exact: false })).toBeVisible()
  const details = card.locator('details[data-document-source]')
  await expect(details).not.toHaveAttribute('open', '')
  await expect(details.getByText('Dokumentkilde · revisjon', { exact: false })).toBeHidden()
  await details.locator(':scope > summary').click()
  await expect(details.getByText('1 kildeoppføringer er markert utelatt.', { exact: false })).toBeVisible()
}

async function clarifyMixed(page) {
  await openClarityFile(page, mixedCalendar(), mixedName)
  await expect(courseRows(page)).toHaveCount(3)
  await expect(eventRows(page)).toHaveCount(4)
  await preview(page).getByText('Filen inneholder flere læresteder', { exact: true }).click()
  for (const [code, university] of [['SYN851', 'HiMolde'], ['SYN852', 'NTNU'], ['SYN853', '']]) {
    const affiliation = preview(page).getByLabel(`Lærested for ${code}`, { exact: true })
    await expect(affiliation).toHaveValue(university)
    await expect(affiliation.locator('option[value=""]')).toContainText('Ukjent')
  }
  const common = preview(page).getByLabel('Lærested for emner uten institusjon', { exact: true })
  await common.selectOption('HiMolde')
  await preview(page).getByRole('button', { name: 'Bruk lærested og finn emnenavn', exact: true, includeHidden: true }).click()
  await expect(preview(page).getByLabel('Lærested for SYN851', { exact: true })).toHaveValue('HiMolde')
  await expect(preview(page).getByLabel('Lærested for SYN852', { exact: true })).toHaveValue('NTNU')
  await expect(preview(page).getByLabel('Lærested for SYN853', { exact: true })).toHaveValue('HiMolde')
  await preview(page).getByLabel('Lærested for SYN853', { exact: true }).selectOption('')
  const omitted = eventRows(page).nth(3)
  await openPreviewRow(omitted)
  await omitted.getByLabel('Ta med i planen', { exact: true }).uncheck()
}

test('Import clarity mixed institutions: explicit preview, registry choices and omitted affiliation reimport', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'mixed', 'Needs its own isolated database.')
  await clarifyMixed(page)
  await captureTp(page, info, 'import-clarity-mixed-desktop.png', { target: preview(page).getByLabel('Lærested for SYN852', { exact: true }) })
  await rejectedRuntimeWrites(page, async () => {
    await expect(eventRows(page).nth(3).getByLabel('Ta med i planen', { exact: true })).not.toBeChecked()
    await expect(preview(page).getByLabel('Lærested for SYN852', { exact: true })).toHaveValue('NTNU')
  })
  if (runtimeUrl) { await page.reload(); await clarifyMixed(page) }
  await confirmTpImport(page)
  const initial = await savedTpState(page), linked = assertMixed(initial)
  await inspectReceiptAndSource(page, linked)
  await expect(page.getByRole('button', { name: 'Åpne kalenderen', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Angre importen', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Importen er angret', exact: true })).toBeFocused()
  expect((await savedTpState(page)).planner?.events || []).toHaveLength(0)
  await page.reload(); await clarifyMixed(page); await confirmTpImport(page)
  expect((await savedTpState(page)).planner).toEqual(initial.planner)
  await inspectReceiptAndSource(page, linked)
  await inspectImportedCalendar(page, linked.events[0])
  await editEvent(page, linked.events[1], { notes: 'Syntetisk notat fra bruker, beholdes ved reimport.' })
  await expect(page.locator(`details[data-document-source="${linked.source.id}"]`)).toHaveAttribute('open', '')
  const edited = await savedTpState(page)
  await page.reload()
  await openClarityFile(page, mixedCalendar({ omitAffiliations: true }), mixedName, linked.source.id)
  await expect(preview(page).locator(':scope > [role=status]').first()).toContainText('0 må avklares')
  // An omitted UID has no saved course relationship. Any optional matching
  // control for that omitted row must not become a required selected decision.
  await expect(preview(page).locator('.document-preview-row').filter({ has: page.locator('[data-field=selected]:checked') }).locator('[data-field=matchChoice]')).toHaveCount(0)
  await expect(eventRows(page).nth(3).getByLabel('Ta med i planen', { exact: true })).not.toBeChecked()
  await confirmTpImport(page)
  const repeated = await savedTpState(page)
  assertMixed(repeated)
  expect(repeated.planner).toEqual(edited.planner)
  expect(repeated.importSources).toHaveLength(1)
  expect(repeated.importSources[0].entries.map(item => item.targetId)).toEqual(edited.importSources[0].entries.map(item => item.targetId))
})

test('Import clarity preview correction: a positive end immediately replaces a user point with an interval', async ({ page }) => {
  test.skip(Boolean(runtimeUrl), 'Focused preview control regression; runtime journeys exercise persisted point-to-interval edits.')
  const input = fixtureRows()[0]
  const text = tpCsvRows([{ ...input, eventid: 'synthetic-clarity-point-to-interval', 'teaching-title_nb': 'Eksamen i oppdiktet SYN954', dtstart: '2041-11-01T11:00:07+01:00', dtend: '2041-11-01T11:00:07+01:00' }])
  await openClarityFile(page, text, 'synthetic-clarity-point-to-interval.csv')
  const row = eventRows(page).first()
  await openPreviewRow(row)
  await row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('point')
  await expect(row.getByText('Punkt uten varighet, bekreftet av deg.', { exact: false })).toBeVisible()
  const end = row.getByLabel('Slutt i norsk tid (valgfri)', { exact: true })
  await (await reveal(end)).fill('2041-11-01T11:00:27')
  await page.keyboard.press('Tab')
  await expect(row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true })).toHaveValue('interval')
  await expect(row.getByText('Punkt uten varighet, bekreftet av deg.', { exact: false })).toHaveCount(0)
  await expect(row.locator(':scope > summary')).toContainText('Fast undervisning / aktivitet')
  await expect(preview(page)).toContainText('1 valgte kalenderhendelser (0 punktmarkører)')
  await expect(preview(page).locator(':scope > [role=status]').first()).toContainText('0 må avklares')
  await confirmTpImport(page)
  const saved = await savedTpState(page), event = saved.planner.events[0]
  expect(event).toMatchObject({ start: '2041-11-01T10:00:07Z', end: '2041-11-01T10:00:27Z', point: false })
  expect(event.pointProvenance).toBeUndefined()
  expect(saved.tasks).toHaveLength(0)
  await expect(page.locator(`#event-list [data-event-id="${event.id}"]`)).not.toHaveClass(/is-exam/)
  await inspectImportedCalendar(page, event, { expectedEnd: '11:00:27' })
})

test('Import clarity user points: explicit decisions survive refresh, edits, undo and reimport', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'points', 'Needs its own isolated database.')
  await openClarityFile(page, pointCsv(), pointName)
  await expect(eventRows(page)).toHaveCount(5)
  for (const index of [0, 1, 2]) {
    const row = eventRows(page).nth(index)
    await openPreviewRow(row)
    await row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('point')
  }
  await openSourceDetails(page)
  await preview(page).getByRole('button', { name: 'Oppdater forhåndsvisningen', exact: true, includeHidden: true }).click()
  for (const index of [0, 1, 2]) await expect(eventRows(page).nth(index).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true })).toHaveValue('point')
  await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
  await expect(preview(page).getByRole('alert')).not.toBeEmpty()
  expect((await savedTpState(page))?.planner?.events || []).toHaveLength(0)
  await eventRows(page).nth(3).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('omit')
  await rejectedRuntimeWrites(page, async () => {
    for (const index of [0, 1, 2]) await expect(eventRows(page).nth(index).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true })).toHaveValue('point')
    await expect(eventRows(page).nth(3).getByLabel('Ta med i planen', { exact: true })).not.toBeChecked()
  })
  if (runtimeUrl) {
    await page.reload(); await openClarityFile(page, pointCsv(), pointName)
    for (const index of [0, 1, 2, 3]) {
      await openPreviewRow(eventRows(page).nth(index))
      await eventRows(page).nth(index).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption(index === 3 ? 'omit' : 'point')
    }
  }
  await captureTp(page, info, 'import-clarity-points-desktop.png', { target: eventRows(page).first() })
  await confirmTpImport(page)
  const initial = await savedTpState(page), linked = assertPoints(initial)
  await inspectReceiptAndSource(page, linked)
  await expect(page.locator(`#event-list [data-event-id="${linked.events[0].id}"]`)).not.toHaveClass(/is-exam/)
  await inspectImportedCalendar(page, linked.events[0], { point: true })
  await page.reload()
  expect((await savedTpState(page)).planner).toEqual(initial.planner)
  await editEvent(page, linked.events[0], { notes: 'Syntetisk punktnotat uten opptatt varighet.' })
  await editEvent(page, linked.events[1], { end: '2041-11-02T11:00:37' })
  const edited = await savedTpState(page)
  assertPoints(edited, { edited: true })
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const undone = await savedTpState(page)
  assertPoints(undone)
  expect(undone.planner.events.find(item => item.id === linked.events[0].id).notes).toBe('Syntetisk punktnotat uten opptatt varighet.')
  await editEvent(page, linked.events[1], { end: '2041-11-02T11:00:37' })
  await page.reload()
  await openClarityFile(page, pointCsv(), pointName, linked.source.id)
  await expect(preview(page).locator(':scope > [role=status]').first()).toContainText('0 må avklares')
  await confirmTpImport(page)
  const repeated = await savedTpState(page)
  assertPoints(repeated, { edited: true })
  expect(repeated.planner).toEqual(edited.planner)
  expect(repeated.importSources).toHaveLength(1)
  expect(repeated.importSources[0].excludedKeys).toEqual(initial.importSources[0].excludedKeys)
})

for (const scenario of ['mixed', 'points']) test(`Import clarity persisted ${scenario}: fresh browser and exact source relationships after recreation`, async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== scenario || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned runtime harness only.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected)
  const linked = scenario === 'mixed' ? assertMixed(expected) : assertPoints(expected, { edited: true })
  await navigate(page, 'subjects')
  await expect(page.locator('#event-list .event-card')).toHaveCount(linked.events.length)
  for (const event of linked.events) await expect(page.locator('#event-list')).toContainText(event.title)
  if (scenario === 'points') await expect(page.locator(`#event-list [data-event-id="${linked.events[0].id}"]`)).not.toHaveClass(/is-exam/)
  await openClarityFile(page, scenario === 'mixed' ? mixedCalendar({ omitAffiliations: true }) : pointCsv(), scenario === 'mixed' ? mixedName : pointName, linked.source.id)
  await expect(preview(page).locator(':scope > [role=status]').first()).toContainText('0 må avklares')
  await confirmTpImport(page)
  const repeated = await savedTpState(page)
  expect(repeated.planner).toEqual(expected.planner)
  expect(repeated.tasks).toEqual(expected.tasks)
  expect(repeated.importSources[0].entries).toEqual(expected.importSources[0].entries)
  expect(repeated.importSources[0].excludedKeys).toEqual(expected.importSources[0].excludedKeys)
})

for (const enlarged of [false, true]) test(`Import clarity mobile390${enlarged ? ' enlarged' : ''}: keyboard decisions preserve focus, open rows and scroll`, async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl), 'Synthetic browser layout journey.')
  await page.setViewportSize({ width: 390, height: 844 })
  if (enlarged) await page.addStyleTag({ content: 'html { font-size: 150% !important; }' })
  await openClarityFile(page, pointCsv(), pointName)
  const row = eventRows(page).first(), choice = row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true })
  await openPreviewRow(row)
  await row.locator(':scope > summary').focus()
  await tabTo(page, choice)
  const scroll = await page.evaluate(() => scrollY)
  await choice.selectOption('point')
  await expect(choice).toBeFocused()
  await expect(row).toHaveAttribute('open', '')
  expect(Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThanOrEqual(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await captureTp(page, info, `import-clarity-points-mobile390${enlarged ? '-enlarged' : ''}.png`, { target: choice })
  for (const index of [1, 2, 3]) {
    await openPreviewRow(eventRows(page).nth(index))
    await eventRows(page).nth(index).getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('omit')
  }
  await confirmTpImport(page)
  const saved = await savedTpState(page)
  expect(saved.planner.events).toHaveLength(2)
  expect(saved.importSources[0].excludedKeys).toHaveLength(3)
})
