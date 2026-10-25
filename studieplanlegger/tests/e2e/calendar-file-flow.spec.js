import { reveal } from './helpers.js'
import { test, expect } from '@playwright/test'
import { navigate, key, instrumentWrites, writes, openTaskDetails, edit } from './helpers.js'

// Invented courses, metadata and appointments; no student/provider data.
const calendar = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-a\r\nSUMMARY:SYN101 Forelesning\r\nDTSTART:20261026T090000Z\r\nDTEND:20261026T100000Z\r\nX-COURSE-CODE:SYN101\r\nX-COURSE-NAME:Syntetisk A\r\nX-UNIVERSITY:Syntetisk institusjon\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:synthetic-b\r\nSUMMARY:SYN102 Eksamen\r\nDTSTART:20261027T090000Z\r\nDTEND:20261027T100000Z\r\nX-COURSE-CODE:SYN102\r\nX-COURSE-NAME:Syntetisk B\r\nX-UNIVERSITY:Syntetisk institusjon\r\nX-STUDIEPLAN-ACTIVITY-KIND:exam\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:synthetic-c\r\nSUMMARY:Forelesning\r\nDTSTART:20261028T090000Z\r\nDTEND:20261028T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR`
const existing = { id: 'synthetic-existing', code: 'SYN101', name: 'Syntetisk lokalt navn', university: 'Syntetisk institusjon', year: 2026, semester: 'autumn', credits: null, notes: 'Syntetisk notat' }
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)

for (const mobile of [false, true]) test(`one calendar file, one confirmation, reload and unassigned editor ${mobile ? '390px larger text' : 'desktop'}`, async ({ page }, info) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00Z'))
  await page.goto('/')
  await page.evaluate(({ key, existing }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [existing], events: [], sources: [] } })), { key, existing })
  await instrumentWrites(page); await page.reload()
  if (mobile) await page.addStyleTag({ content: 'html { font-size: 125% !important; }' })
  await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic.ics', mimeType: 'text/calendar', buffer: Buffer.from(calendar) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  const preview = page.locator('.document-preview')
  await expect(preview).toContainText('Kalenderdatoer:')
  await expect(preview.getByRole('heading', { name: 'Dette fant jeg' })).toBeFocused()
  await expect(preview).toContainText('0 må avklares')
  expect(await writes(page)).toHaveLength(0)
  expect(await preview.locator('.document-preview-row[open]').count()).toBe(0)
  await page.screenshot({ path: info.outputPath('calendar-preview.png'), fullPage: true })
  const confirm = page.getByRole('button', { name: 'Importer valgte', exact: true })
  await (await reveal(confirm)).focus(); await confirm.press('Enter')
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Importen er lagret', exact: true })).toBeFocused()
  expect(await writes(page)).toHaveLength(1)
  const first = await saved(page)
  expect(first.planner.courses).toHaveLength(2)
  expect(first.planner.courses[0]).toEqual(existing)
  expect(first.planner.events).toHaveLength(3)
  expect(first.planner.events.find(item => item.title === 'Forelesning').courseId).toBe('')
  await page.reload(); expect((await saved(page)).planner).toEqual(first.planner)
  await navigate(page, 'subjects')
  const edit = page.getByRole('button', { name: 'Rediger undervisning Forelesning', exact: true })
  await (await reveal(edit)).click()
  await expect(page.locator('#subject-editor [name=courseId]')).toHaveValue('')
  await (await reveal(page.locator('#subject-editor [name=notes]'))).fill('Syntetisk lokalt aktivitetsnotat')
  await (await reveal(page.getByRole('button', { name: 'Lagre undervisning', exact: true }))).click()
  await expect(edit).toBeFocused()
  const after = (await saved(page)).planner.events.find(item => item.title === 'Forelesning')
  expect(after).toMatchObject({ id: first.planner.events.find(item => item.title === 'Forelesning').id, courseId: '', notes: 'Syntetisk lokalt aktivitetsnotat' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('calendar-editor-return.png'), fullPage: true })
})

test('refresh keeps reviewed edits and requires a new conflict choice before one commit', async ({ page }) => {
  await page.goto('/tests/fixtures/document-component.html')
  await page.evaluate(async calendar => {
    const { parseDocumentIcs } = await import('/src/document-parsers.js')
    const { createDocumentImportPreview, buildDocumentImportCommit, refreshDocumentImportPreview } = await import('/src/import-preview.js')
    const { renderDocumentImportPreview } = await import('/src/document-import.js')
    const initial = { schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } }
    const parsed = { ...parseDocumentIcs(calendar), contentHash: 'a'.repeat(64) }
    window.syntheticState = buildDocumentImportCommit(initial, createDocumentImportPreview(initial, parsed)).state
    window.syntheticState.planner.events[0].title = 'Lokalt navn'
    const updated = { ...parseDocumentIcs(calendar.replace('Forelesning', 'Kildens navn')), contentHash: 'b'.repeat(64) }
    let preview = createDocumentImportPreview(window.syntheticState, updated, { sourceId: window.syntheticState.importSources[0].id })
    window.syntheticCommits = 0
    const render = () => renderDocumentImportPreview(document.body, preview, { getState: () => window.syntheticState, onBack: () => {}, onRefresh: () => { preview = refreshDocumentImportPreview(window.syntheticState, preview); render() }, onConfirm: state => { window.syntheticCommits++; window.syntheticState = state; return { ok: true } } })
    render()
  }, 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-stale\r\nSUMMARY:Forelesning\r\nDTSTART:20261026T090000Z\r\nDTEND:20261026T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR')
  await (await reveal(page.getByLabel('Sted (valgfritt)', { exact: true }))).fill('Mitt rom')
  await (await reveal(page.getByLabel('Behold verdi for navn', { exact: true }))).selectOption('local')
  await page.evaluate(() => { window.syntheticState.planner.events[0].title = 'Endret etter kontroll' })
  await (await reveal(page.getByRole('button', { name: 'Importer valgte' }))).click()
  await expect(page.getByRole('alert')).toContainText('Planen er endret')
  await (await reveal(page.getByRole('button', { name: 'Oppdater forhåndsvisningen', includeHidden: true }))).click()
  await expect(page.getByLabel('Sted (valgfritt)', { exact: true })).toHaveValue('Mitt rom')
  await expect(page.getByLabel('Behold verdi for navn', { exact: true })).toHaveValue('')
  await (await reveal(page.getByRole('button', { name: 'Importer valgte' }))).click()
  expect(await page.evaluate(() => window.syntheticCommits)).toBe(0)
  await (await reveal(page.getByLabel('Behold verdi for navn', { exact: true }))).selectOption('local')
  await (await reveal(page.getByRole('button', { name: 'Importer valgte' }))).click()
  expect(await page.evaluate(() => window.syntheticCommits)).toBe(1)
})

test('visible course search focuses its query and priority offers one Normal while preserving legacy meaning', async ({ page }) => {
  await page.goto('/')
  await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Finn ett emne', exact: true }))).click()
  await expect(page.locator('#course-import-form')).toBeVisible()
  await (await reveal(page.getByRole('button', { name: 'Neste: søk og semester' }))).click()
  await expect(page.locator('#course-import-form [name=code]')).toBeFocused()
  await (await reveal(page.locator('#new-task'))).click(); await openTaskDetails(page)
  expect(await page.locator('#priority option').allTextContents()).toEqual(['Høy', 'Normal', 'Lav'])
})

test('zero program results transfer institution and SOS1002 into explicit course search', async ({ page }) => {
  let searched = false
  await page.route('**/api/import/providers/ntnu/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/search')) { expect(url.searchParams.get('q')).toBe('SOS1002'); expect(url.searchParams.get('year')).toBe('2026'); searched = true }
    await route.fulfill({ json: { status: 'ok', results: [], completeness: { complete: false }, warnings: ['Syntetisk kildevarsel'] } })
  })
  await page.goto('/'); await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Finn studieprogram', exact: true }))).click()
  const host = page.locator('.program-import')
  await (await reveal(host.locator('[name=institution]'))).selectOption('ntnu')
  await (await reveal(host.locator('[name=programQuery]'))).fill('SOS1002')
  await (await reveal(host.locator('[name=catalogueYear]'))).fill('2026')
  await (await reveal(host.getByRole('button', { name: 'Hent studieprogram', exact: true }))).click()
  await expect(host).toContainText('Ingen programtreff')
  await expect(host).toContainText('Listen er ikke bekreftet fullstendig.')
  await expect(host).toContainText('Syntetisk kildevarsel')
  const transfer = host.getByRole('button', { name: 'Søk etter ett enkelt emne', exact: true })
  await expect(transfer).toBeFocused(); await (await reveal(transfer)).click()
  const form = page.locator('#course-import-form')
  await expect(form.locator('[name=university]')).toHaveValue('ntnu')
  await expect(form.locator('[name=year]')).toHaveValue('2026')
  await expect(form.locator('[name=code]')).toHaveValue('SOS1002')
  await expect(form.locator('[name=code]')).toBeFocused()
  await (await reveal(form.getByRole('button', { name: 'Søk emner', exact: true }))).click()
  expect(searched).toBe(true)
  await expect(host.locator('[name=programQuery]')).toHaveValue('SOS1002')
})

test('stale program review retains teaching selections, reports one error and requires renewed confirmation', async ({ page }) => {
  await page.goto('/tests/fixtures/document-component.html')
  await page.evaluate(async () => {
    const { createProgramImportView } = await import('/src/program-import-view.js')
    window.syntheticState = { schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } }; window.syntheticCommits = 0
    const host = document.createElement('main'), feedback = document.createElement('p'); feedback.id = 'global-feedback'; document.body.replaceChildren(feedback, host)
    const sourceUrl = 'https://example.test/synthetic-program'
    const course = { id: 'synthetic-course', code: 'SYN101', name: 'Syntetisk emne', university: 'Høgskolen i Molde', year: 2026, semester: 'autumn', credits: 5, choice: 'O', sourceProvider: 'himolde', sourceRecordId: 'SYN101', sourceVersion: '2026H', sourceUrl, description: '', notes: '' }
    createProgramImportView({ host, getState: () => window.syntheticState, feedback: text => { feedback.textContent = text }, commitPlanner: planner => { window.syntheticState.planner = planner; window.syntheticCommits++; return { ok: true } }, api: async path => {
      const action = new URL(path, location.origin).pathname.split('/').at(-1)
      if (action === 'programs') return { status: 'ok', results: [{ code: 'SYN', name: 'Syntetisk program', sourceUrl }] }
      if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: '2026', sourceUrl }] }
      if (action === 'program-plan') return { status: 'ok', program: { code: 'SYN', name: 'Syntetisk program', cohort: '2026', sourceUrl, campuses: [] }, models: [{ id: 'common', name: 'Felles', periods: [{ id: 'first', label: 'Høst 2026', studySemester: 1, year: 2026, semester: 'autumn', courses: [course] }] }], warnings: [] }
      if (action === 'teaching-search') return { status: 'ok', results: [{ code: 'SYN101', sourceObjectId: 'SYN101¤1', label: 'SYN101 · Syntetisk emne', sourceUrl }] }
      if (action === 'teaching-calendar') return { status: 'ok', calendarUrl: 'https://example.test/synthetic.ics', commonGroups: ['Forelesning'], warnings: [], calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-program-event\r\nSUMMARY:SYN101 Forelesning\r\nDTSTART:20261026T090000Z\r\nDTEND:20261026T100000Z\r\nX-GROUP:Forelesning\r\nEND:VEVENT\r\nEND:VCALENDAR' }
      throw new Error('Uventet syntetisk testkall')
    } })
  })
  const host = page.locator('.program-import')
  await (await reveal(host.locator('[name=institution]'))).selectOption('himolde')
  await (await reveal(host.getByRole('button', { name: 'Hent studieprogram', exact: true }))).click()
  await (await reveal(host.locator('[name=program]'))).selectOption('0'); await (await reveal(host.locator('[name=cohort]'))).selectOption('0')
  await (await reveal(host.getByRole('button', { name: 'Hent studieplan', exact: true }))).click()
  await (await reveal(host.locator('[name=model]'))).selectOption('common'); await (await reveal(host.locator('[name=studySemester]'))).selectOption('first'); await (await reveal(host.locator('[name=calendarSemester]'))).selectOption('2026:autumn')
  await (await reveal(host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }))).click()
  await expect(host).toContainText('1 av 1 økter valgt')
  await page.evaluate(() => { window.syntheticState.planner.courses.push({ id: 'synthetic-local', code: 'LOCAL1', name: 'Lokalt emne', university: '', semester: 'autumn', year: 2026, credits: null, notes: 'Behold' }) })
  await (await reveal(host.getByRole('button', { name: 'Bekreft programimport', exact: true }))).click()
  await expect(host.locator('.program-action-status')).toContainText('Dataene er endret')
  await expect(page.locator('#global-feedback')).toBeEmpty()
  expect(await page.getByText(/Dataene er endret/).count()).toBe(1)
  expect(await page.evaluate(() => window.syntheticCommits)).toBe(0)
  await (await reveal(host.getByRole('button', { name: 'Oppdater forhåndsvisningen', exact: true, includeHidden: true }))).click()
  await expect(host).toContainText('1 av 1 økter valgt')
  expect(await page.evaluate(() => window.syntheticCommits)).toBe(0)
  await (await reveal(host.getByRole('button', { name: 'Bekreft programimport', exact: true }))).click()
  expect(await page.evaluate(() => window.syntheticCommits)).toBe(1)
  expect(await page.evaluate(() => window.syntheticState.planner.courses.find(course => course.id === 'synthetic-local').notes)).toBe('Behold')
  expect(await page.evaluate(() => window.syntheticState.planner.events.length)).toBe(1)
})

test('unknown code can be grouped without course and committed without editing its unnamed proposal', async ({ page }) => {
  await page.goto('/')
  await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-unknown.ics', mimeType: 'text/calendar', buffer: Buffer.from('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-unknown\r\nSUMMARY:SYN999 Forelesning\r\nDTSTART:20261026T090000Z\r\nDTEND:20261026T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR') })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  if (!await page.locator('.document-course-groups select').isVisible()) await page.locator('.document-course-groups > details > summary').first().click()
  await (await reveal(page.locator('.document-course-groups select'))).selectOption('')
  await (await reveal(page.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const state = await saved(page)
  expect(state.planner.courses).toHaveLength(0)
  expect(state.planner.events).toHaveLength(1)
  expect(state.planner.events[0].courseId).toBe('')
})

test('ambiguous course proposal can be retired by grouped Without course and source changes ignore local edits', async ({ page }) => {
  await page.goto('/tests/fixtures/document-component.html')
  await page.evaluate(async calendar => {
    const { parseDocumentIcs } = await import('/src/document-parsers.js')
    const { createDocumentImportPreview, buildDocumentImportCommit } = await import('/src/import-preview.js')
    const { renderDocumentImportPreview } = await import('/src/document-import.js')
    const courses = ['a', 'b'].map(id => ({ id, code: 'SYN101', name: 'Syntetisk emne', university: '', year: 2026, semester: 'autumn', credits: null }))
    window.syntheticState = { schemaVersion: 1, tasks: [], planner: { courses, events: [], sources: [] } }
    const parsed = { ...parseDocumentIcs(calendar), contentHash: 'd'.repeat(64) }
    window.syntheticCommits = 0
    const render = preview => renderDocumentImportPreview(document.body, preview, { getState: () => window.syntheticState, onBack() {}, onConfirm: state => { window.syntheticCommits++; window.syntheticState = state; return { ok: true } } })
    render(createDocumentImportPreview(window.syntheticState, parsed))
    window.reimportSynthetic = () => { window.syntheticState.planner.events[0].title = 'Lokalt navn'; render(createDocumentImportPreview(window.syntheticState, parsed, { sourceId: window.syntheticState.importSources[0].id })) }
  }, 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:ambiguous\r\nSUMMARY:SYN101 Eksamen\r\nDTSTART:20261026T090000Z\r\nDTEND:20261026T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR')
  await expect(page.locator('.document-preview-row').last().locator('summary').first()).toContainText('Eksamen')
  if (!await page.locator('.document-course-groups select').isVisible()) await page.locator('.document-course-groups > details > summary').first().click()
  await (await reveal(page.locator('.document-course-groups select'))).selectOption('')
  await (await reveal(page.getByRole('button', { name: 'Importer valgte' }))).click()
  expect(await page.evaluate(() => window.syntheticState.planner.events.length)).toBe(1)
  expect(await page.evaluate(() => window.syntheticState.planner.courses.length)).toBe(2)
  await page.evaluate(() => window.reimportSynthetic())
  await expect(page.locator('.document-preview')).toContainText('0 med kildeendringer')
  await (await reveal(page.getByRole('button', { name: 'Importer valgte' }))).click()
  expect(await page.evaluate(() => window.syntheticState.planner.events[0].title)).toBe('Lokalt navn')
  expect(await page.evaluate(() => window.syntheticCommits)).toBe(2)
})

test('explicit recurring group is selected together and individual exceptions survive course mapping', async ({ page }) => {
  await page.goto('/'); await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
  const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:grouped\r\nSUMMARY:Forelesning\r\nDTSTART:20261026T090000Z\r\nDTEND:20261026T100000Z\r\nRRULE:FREQ=DAILY;COUNT=12\r\nX-GROUP:Gruppe A\r\nEND:VEVENT\r\nEND:VCALENDAR'
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-group.ics', mimeType: 'text/calendar', buffer: Buffer.from(text) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  const group = page.getByRole('checkbox', { name: 'Ta med gruppen Gruppe A (12 økter)' })
  await expect(group).not.toBeChecked(); await (await reveal(group)).check()
  await (await reveal(page.getByLabel('Ta med i planen', { exact: true }).nth(3))).uncheck()
  if (!await page.locator('.document-course-groups select').isVisible()) await page.locator('.document-course-groups > details > summary').first().click()
  await (await reveal(page.locator('.document-course-groups select'))).selectOption('')
  await expect(page.getByLabel('Ta med i planen', { exact: true }).nth(3)).not.toBeChecked()
  await (await reveal(page.getByRole('button', { name: 'Importer valgte' }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  expect((await saved(page)).planner.events).toHaveLength(11)
})

test('editing unrelated task fields preserves legacy priority 2 and absent priority until explicit change', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'legacy', title: 'Legacy', course: 'SYN101', deadlineLocal: '', estimatedMinutes: 60, completed: false, priority: 2 }, { id: 'missing', title: 'Missing', course: 'SYN101', deadlineLocal: '', estimatedMinutes: 60, completed: false }] })), key)
  await page.reload()
  await navigate(page, 'all')
  for (const title of ['Legacy', 'Missing']) {
    await (await reveal(page.getByLabel(`Flere handlinger «${title}»`, { exact: true }))).click()
    await (await reveal(edit(page, title))).click(); await (await reveal(page.locator('#title'))).fill(`${title} edited`)
    await (await reveal(page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }))).click()
    const menu = page.getByLabel(`Flere handlinger «${title} edited»`, { exact: true })
    if (await menu.evaluate(node => node.parentElement.open)) await menu.click()
  }
  await page.reload()
  expect((await saved(page)).tasks[0].priority).toBe(2)
  expect((await saved(page)).tasks[1].priority).toBeUndefined()
  await navigate(page, 'all')
  await (await reveal(page.getByLabel('Flere handlinger «Legacy edited»', { exact: true }))).click()
  await (await reveal(edit(page, 'Legacy edited'))).click(); await openTaskDetails(page); await (await reveal(page.locator('#priority'))).selectOption('3')
  await (await reveal(page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }))).click(); await page.reload()
  expect((await saved(page)).tasks[0].priority).toBe(3)
})

test('imported personal editor shows fixed Without course and preserves its full interval', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/')
  await page.evaluate(async ({ key, existing }) => {
    const { parseDocumentIcs } = await import('/src/document-parsers.js')
    const { createDocumentImportPreview, buildDocumentImportCommit } = await import('/src/import-preview.js')
    const state = { schemaVersion: 1, tasks: [], planner: { courses: [existing], sources: [], events: [] } }
    const parsed = { ...parseDocumentIcs('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:personal\r\nSUMMARY:Syntetisk egen aktivitet\r\nDTSTART:20261026T090000Z\r\nDTEND:20261027T100000Z\r\nX-STUDIEPLAN-ACTIVITY-KIND:personal\r\nEND:VEVENT\r\nEND:VCALENDAR'), contentHash: 'e'.repeat(64) }
    localStorage.setItem(key, JSON.stringify(buildDocumentImportCommit(state, createDocumentImportPreview(state, parsed)).state))
  }, { key, existing })
  await page.reload(); await navigate(page, 'subjects')
  await (await reveal(page.locator('.event-card.is-personal').getByRole('button', { name: /Rediger/ }))).click()
  await expect(page.locator('#subject-editor select[name=courseId]')).toHaveCount(0)
  await expect(page.locator('#subject-editor')).toContainText('Uten emne')
  await (await reveal(page.locator('#subject-editor [name=notes]'))).fill('Behold intervallet')
  await page.screenshot({ path: info.outputPath('personal-editor-390.png') })
  await (await reveal(page.getByRole('button', { name: 'Lagre egen aktivitet', exact: true }))).click()
  expect((await saved(page)).planner.events[0]).toMatchObject({ courseId: '', start: '2026-10-26T09:00:00.000Z', end: '2026-10-27T10:00:00.000Z', notes: 'Behold intervallet' })
})
