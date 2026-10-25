import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { createDocumentImportPreview, buildDocumentImportCommit, chooseDocumentCourse } from '../../src/import-preview.js'
import { emptyPlanner } from '../../src/planner.js'
import { navigate, reveal } from './helpers.js'
import { preview, courseRows, eventRows, confirmTpImport, captureTp, runtimeUrl, runtimeScenario, savedTpState } from './tp-csv-helpers.js'

// Entirely invented inputs. The legacy backup models the documented absence of
// course-choice provenance; neither a private calendar nor user storage is read.
const fileName = 'synthetic-closure-courses.ics'
const fixture = () => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...[
  ['hm', 'SYN976 – oppdiktet seminar', ['SYN976', 'Oppdiktet Moldefag', 'HiMolde']],
  ['nt', 'Oppdiktet seminar i SYN976', ['SYN976', 'Oppdiktet Trondheimfag', 'NTNU']],
  ['unknown', 'Oppdiktet SYN976 seminar', ['SYN976', 'Oppdiktet ukjent fag', '']],
  ['repair-a', 'Oppdiktet repetisjon i SYN977', null],
  ['repair-b', 'Neste oppdiktede repetisjon i SYN977', null],
  ['none-a', 'Oppdiktet samtale om SYN978', null],
  ['none-b', 'Neste oppdiktede samtale om SYN978', null],
].flatMap(([id, title, course], i) => ['BEGIN:VEVENT', `UID:synthetic-closure-${id}`, `DTSTART:204504${11 + i}T080007Z`, `DTEND:204504${11 + i}T090017Z`, `SUMMARY:${title}`, ...(course ? [`X-COURSE-CODE:${course[0]}`, `X-COURSE-NAME:${course[1]}`, `X-UNIVERSITY:${course[2]}`] : []), 'END:VEVENT']), 'END:VCALENDAR', ''].join('\r\n')

function legacyState() {
  const text = fixture(), parsed = { ...parseDocumentIcs(text), contentHash: createHash('sha256').update(text).digest('hex') }
  parsed.rows = parsed.rows.filter(row => row.kind !== 'course' || row.code === 'SYN976').map(row => row.kind === 'event' && ['SYN977', 'SYN978'].includes(row.courseHint) ? { ...row, code: '', courseHint: '', courseCodes: [] } : row)
  const empty = { schemaVersion: 1, tasks: [], planner: emptyPlanner() }, draft = createDocumentImportPreview(empty, parsed, { name: fileName })
  const unknown = draft.rows.find(row => row.kind === 'course' && !row.university)
  chooseDocumentCourse(draft, draft.rows.filter(row => row.kind === 'event' && row.courseHint === 'SYN976' && !row.university), `row:${unknown.index}`)
  const saved = buildDocumentImportCommit(empty, draft)
  expect(saved.ok, JSON.stringify(saved.errors || saved.error)).toBe(true)
  for (const entry of saved.source.entries) delete entry.courseDecision
  saved.candidate.planner.events.find(event => event.title === 'Oppdiktet repetisjon i SYN977').notes = 'Mitt oppdiktede notat skal beholdes'
  return saved.candidate
}

async function restoreLegacy(page) {
  const legacy = legacyState()
  await navigate(page, 'settings')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Importer sikkerhetskopi', exact: true }).click()
  await (await chooser).setFiles({ name: 'synthetic-legacy-closure.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'studieplan-local-backup', backupVersion: 1, createdAt: '2045-04-01T08:00:00Z', data: legacy })) })
  const dialog = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
  await dialog.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect((await savedTpState(page)).planner).toEqual(legacy.planner)
  return legacy
}

async function openFile(page) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: fileName, mimeType: 'text/calendar', buffer: Buffer.from(fixture()) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(preview(page)).toBeVisible()
  await expect(eventRows(page)).toHaveCount(7)
}

function assertSaved(state) {
  expect(state.planner.courses).toHaveLength(4)
  expect(state.planner.events).toHaveLength(7)
  const affiliations = state.planner.courses.filter(course => course.code === 'SYN976')
  expect(affiliations.map(course => course.university).sort()).toEqual(['', 'HiMolde', 'NTNU'])
  for (const course of affiliations) expect(state.planner.events.filter(event => event.courseId === course.id)).toHaveLength(1)
  const repaired = state.planner.courses.find(course => course.code === 'SYN977')
  expect(state.planner.events.filter(event => event.title.includes('SYN977')).every(event => event.courseId === repaired.id)).toBe(true)
  expect(state.planner.events.filter(event => event.title.includes('SYN978')).every(event => event.courseId === '')).toBe(true)
  expect(state.planner.events.find(event => event.title === 'Oppdiktet repetisjon i SYN977').notes).toBe('Mitt oppdiktede notat skal beholdes')
  expect(state.importSources[0].entries.filter(entry => entry.kind === 'event' && /SYN977|SYN978/.test(entry.sourceBase.title)).every(entry => entry.courseDecision.origin === 'user')).toBe(true)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic closure fixture uses no external source.' } }))
  await page.goto(runtimeUrl || '/')
})

test('Closure courses: qualified title codes and grouped legacy decisions preserve identity', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl) && runtimeScenario !== 'closure-courses', 'Requires its own isolated database.')
  const before = await restoreLegacy(page)
  await openFile(page)
  expect((await savedTpState(page)).planner).toEqual(before.planner)
  await expect(preview(page).getByText('Tidligere lagring viser ikke om manglende emnekobling', { exact: false })).toHaveCount(2)
  const noneGroup = preview(page).locator('[data-group-control]').filter({ has: page.locator('summary').filter({ hasText: /^SYN978/ }) }).first()
  await noneGroup.locator('select').first().selectOption('')
  // Input .value is updated by the UI; the row summary identifies the source code.
  const repair = courseRows(page).filter({ hasText: 'SYN977' }).first()
  const index = await repair.getAttribute('data-row-index')
  const repairGroup = preview(page).locator('[data-group-control]').filter({ has: page.locator('summary').filter({ hasText: /^SYN977/ }) }).first()
  await repairGroup.locator('select').first().selectOption(`row:${index}`)
  await (await reveal(repair.locator('[data-field=title]'))).fill('Oppdiktet reparert emne')
  await repair.locator('[data-field=title]').press('Tab')
  await expect(preview(page).locator('.document-confirmation-summary')).toContainText('0 må avklares')
  await expect(preview(page).locator('button.primary')).toHaveCount(1)
  const secondaryBackground = await preview(page).getByRole('button', { name: 'Rett', exact: true }).evaluate(button => getComputedStyle(button).backgroundColor)
  await expect(preview(page).getByRole('button', { name: 'Importer valgte', exact: true })).not.toHaveCSS('background-color', secondaryBackground)
  for (const name of ['Opprett nytt emne for SYN977', 'Opprett nytt emne for SYN978', 'Behold 2 oppføringer uten emne']) {
    const optional = preview(page).getByRole('button', { name, exact: true }).first()
    await expect(optional).toBeVisible()
    await expect(optional).toHaveCSS('background-color', secondaryBackground)
  }
  await captureTp(page, info, 'closure-courses-desktop.png', { target: preview(page).getByRole('button', { name: 'Importer valgte', exact: true }) })
  await page.setViewportSize({ width: 390, height: 844 })
  await captureTp(page, info, 'closure-courses-mobile.png', { target: preview(page).getByRole('button', { name: 'Importer valgte', exact: true }) })
  await page.addStyleTag({ content: 'html { font-size: 150%; }' })
  await captureTp(page, info, 'closure-courses-large-text.png', {
    target: preview(page).getByRole('button', { name: 'Importer valgte', exact: true }),
    additionalTargets: [{ target: preview(page).getByRole('button', { name: 'Opprett nytt emne for SYN978', exact: true }), suffix: 'secondary' }],
  })
  await expect(preview(page).getByRole('button', { name: 'Importer valgte', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (runtimeUrl) {
    const oldEnvelope = await savedTpState(page)
    const reject = route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, json: { error: 'Synthetic closure write rejection' } }) : route.continue()
    await page.route('**/api/state', reject)
    await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
    await expect(preview(page).locator('[role=alert]')).not.toBeEmpty()
    expect(await savedTpState(page)).toEqual(oldEnvelope)
    await expect(page.getByText('Importen er lagret', { exact: true })).toHaveCount(0)
    await page.unroute('**/api/state', reject)
  }
  const confirm = preview(page).getByRole('button', { name: 'Importer valgte', exact: true })
  await confirm.focus(); await expect(confirm).toBeFocused(); await page.keyboard.press('Enter')
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const first = await savedTpState(page); assertSaved(first)
  expect(first.planner.events.map(event => event.id)).toEqual(before.planner.events.map(event => event.id))
  await page.reload(); expect((await savedTpState(page)).planner).toEqual(first.planner)
  await openFile(page)
  await expect(preview(page).getByText('Tidligere lagring viser ikke om manglende emnekobling', { exact: false })).toHaveCount(0)
  await expect(preview(page).locator('.document-confirmation-summary')).toContainText('0 må avklares')
  await confirmTpImport(page)
  const repeated = await savedTpState(page); assertSaved(repeated)
  expect(repeated.planner).toEqual(first.planner)
  await navigate(page, 'subjects')
  const edited = page.locator('#event-list .event-card').filter({ has: page.getByRole('heading', { name: /Oppdiktet repetisjon i SYN977/ }) })
  await expect(edited.locator('.source-badge')).toContainText('Importert fra fil · Egne endringer')
})

test('Closure persisted courses: exact links affiliations and decisions survive reimport', async ({ page }) => {
  test.skip(!runtimeUrl || runtimeScenario !== 'closure-courses' || !process.env.TP_CSV_VERIFY_SNAPSHOT, 'Owned persisted snapshot required.')
  const expected = JSON.parse(readFileSync(process.env.TP_CSV_VERIFY_SNAPSHOT, 'utf8'))
  expect(await savedTpState(page)).toEqual(expected); assertSaved(expected)
  await openFile(page)
  await expect(preview(page).locator('.document-confirmation-summary')).toContainText('0 må avklares')
  await confirmTpImport(page)
  const repeated = await savedTpState(page); assertSaved(repeated)
  expect(repeated.planner).toEqual(expected.planner)
  expect(repeated.importSources[0].entries).toEqual(expected.importSources[0].entries)
})
