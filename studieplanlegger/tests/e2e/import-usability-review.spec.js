import { reveal } from './helpers.js'
import { test, expect } from '@playwright/test'
import { navigate, openImportMethod, saved, instrumentWrites, writes } from './helpers.js'

// Independently invented regression inputs. Every saved record is created or
// changed through visible forms; storage is read only to verify persisted IDs.
const calendar = (events, properties = []) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...properties, ...events, 'END:VCALENDAR'].join('\r\n')
const qualifiedEvent = ({ uid, title, code, name, start = '20400418T080000Z', end = '20400418T090000Z', properties = [] }) => [
  'BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART:${start}`, `DTEND:${end}`,
  `X-COURSE-CODE:${code}`, `X-COURSE-NAME:${name}`, 'X-UNIVERSITY:uio',
  `X-COURSE-SOURCE-ID:${code}-invented-term-one`, 'X-COURSE-CAMPUS-CODE:SYNTHETIC-CAMPUS',
  ...properties, 'END:VEVENT',
].join('\r\n')

const preview = page => page.locator('.document-preview')
const activityRow = (page, title) => preview(page).locator('.document-preview-row')
  .filter({ has: page.locator('[data-field=startLocal]') }).filter({ hasText: title })
const courseRow = (page, code) => preview(page).locator('.document-preview-row')
  .filter({ has: page.locator('[data-field=courseTarget]') }).filter({ hasText: code })

async function openRow(row) {
  const parent = row.locator('..')
  if (await parent.evaluate(node => node.matches('details:not([open])'))) await parent.locator(':scope > summary').click()
  if (await row.getAttribute('open') === null) await row.locator(':scope > summary').click()
}

async function readFile(page, name, text, { sourceId } = {}) {
  await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
  if (sourceId) await (await reveal(page.getByLabel('Ny kilde eller oppdatering', { exact: true }))).selectOption(sourceId)
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({
    name, mimeType: name.endsWith('.ics') ? 'text/calendar' : 'text/csv', buffer: Buffer.from(text),
  })
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  await expect(preview(page)).toBeVisible()
}

async function confirmImport(page) {
  await (await reveal(preview(page).getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
}

test('review: qualified ICS cancellation updates the saved event after reload without changing its identity', async ({ page }) => {
  const input = { uid: 'synthetic-cancellation-981', title: 'Oppdiktet avlysningsøkt', code: 'SYN981', name: 'Oppdiktet emne for avlysning' }
  await instrumentWrites(page)
  await page.goto('/'); await navigate(page, 'subjects')
  await readFile(page, 'invented-qualified-initial.ics', calendar([qualifiedEvent(input)]))
  expect(await writes(page)).toHaveLength(0)
  await confirmImport(page)
  const first = await saved(page), original = first.planner.events[0], source = first.importSources[0]
  expect(first.planner.events).toHaveLength(1)
  expect(first.planner.courses).toHaveLength(1)
  expect(source.entries.find(entry => entry.kind === 'event').identityScope).toBeTruthy()
  expect(original).toMatchObject({ cancelled: false, courseId: first.planner.courses[0].id })
  await page.reload(); await navigate(page, 'subjects')
  expect((await saved(page)).planner).toEqual(first.planner)

  await readFile(page, 'invented-qualified-cancel.ics', calendar([qualifiedEvent({ ...input, properties: ['STATUS:CANCELLED'] })], ['METHOD:CANCEL']), { sourceId: source.id })
  const cancellation = activityRow(page, input.title)
  await openRow(cancellation)
  await expect(cancellation.getByText('Kilden avlyser denne aktiviteten.', { exact: false })).toBeVisible()
  await expect(cancellation.getByLabel('Ta med i planen', { exact: true })).toBeChecked()
  expect((await saved(page)).planner).toEqual(first.planner)
  expect(await writes(page)).toHaveLength(0)
  await confirmImport(page)

  const result = await saved(page)
  expect(result.planner.events).toEqual([{ ...original, cancelled: true }])
  expect(result.planner.courses).toEqual(first.planner.courses)
  expect(result.importSources).toHaveLength(1)
  expect(result.importSources[0]).toMatchObject({ id: source.id, revision: source.revision + 1 })
  expect(result.importSources[0].entries.find(entry => entry.kind === 'event')).toMatchObject({ targetId: original.id, identityScope: source.entries.find(entry => entry.kind === 'event').identityScope, sourceBase: { cancelled: true } })
  await page.reload()
  expect((await saved(page)).planner).toEqual(result.planner)
})

test('review: a CSV point with an entered end reserves capacity while explicit transparency stays nonblocking', async ({ page }) => {
  const ordinary = 'Oppdiktet punkt som blir en økt', transparent = 'Oppdiktet transparent informasjon'
  const csv = [
    'eventid;summary;dtstart;dtend;transparent;point',
    `invented-point-982;${ordinary};2040-04-18T10:00:00+02;;false;true`,
    `invented-transparent-983;${transparent};2040-04-18T12:00:00+02;;true;true`,
  ].join('\n')
  await page.clock.setFixedTime(new Date('2040-04-18T07:00:00Z'))
  await page.goto('/'); await navigate(page, 'subjects')
  await readFile(page, 'invented-points-with-real-ends.csv', csv)
  await expect(preview(page)).toContainText('2 valgte kalenderhendelser (2 punktmarkører)')
  for (const [title, end] of [[ordinary, '2040-04-18T11:00'], [transparent, '2040-04-18T13:00']]) {
    const row = activityRow(page, title)
    await openRow(row)
    await expect(row.getByLabel('Slutt i norsk tid (valgfri)', { exact: true })).toHaveValue('')
    await (await reveal(row.getByLabel('Slutt i norsk tid (valgfri)', { exact: true }))).fill(end)
  }
  await confirmImport(page)
  const first = await saved(page)
  expect(first.planner.events).toHaveLength(2)
  expect(first.planner.events.find(event => event.title === ordinary)).toMatchObject({ point: false, information: false, transparent: false })
  expect(first.planner.events.find(event => event.title === transparent)).toMatchObject({ point: false, transparent: true })
  for (const event of first.planner.events) expect(Date.parse(event.end) - Date.parse(event.start)).toBe(60 * 60 * 1000)
  await page.reload(); expect((await saved(page)).planner).toEqual(first.planner)

  await navigate(page, 'capacity')
  await (await reveal(page.locator('#new-session'))).click()
  await (await reveal(page.locator('#session-dateLocal'))).fill('2040-04-18')
  await (await reveal(page.locator('#session-startTime'))).fill('10:00')
  await (await reveal(page.locator('#session-endTime'))).fill('13:00')
  await (await reveal(page.locator('#session-form button[type=submit]'))).click()
  await expect(page.locator('#session-form')).toBeHidden()
  await expect(page.locator('#capacity-warnings')).toContainText('60 min undervisning overlapper studieøktene og er trukket fra kapasiteten.')
  await expect(page.locator('#capacity-summary')).toContainText('120 min ledig i øktene')
  await page.reload(); await navigate(page, 'capacity')
  await expect(page.locator('#capacity-warnings')).toContainText('60 min undervisning overlapper studieøktene')
  await expect(page.locator('#capacity-summary')).toContainText('120 min ledig i øktene')
})

test('review: conflicting CSV course names require clarification and a later published name fills an empty proposal', async ({ page }) => {
  const accepted = 'Mitt avklarte oppdiktede emnenavn', laterName = 'Oppdiktet navn fra senere rad'
  const csv = [
    'eventid;summary;courseid;coursename;university;dtstart;dtend',
    'invented-name-984a;Oppdiktet første økt;SYN984;Oppdiktet alternativ A;uio;2040-04-18T10:00:00+02;2040-04-18T11:00:00+02',
    'invented-name-984b;Oppdiktet andre økt;SYN984;Oppdiktet alternativ B;uio;2040-04-19T10:00:00+02;2040-04-19T11:00:00+02',
    'invented-name-984c;Oppdiktet tredje økt;SYN984;Oppdiktet alternativ A;uio;2040-04-20T10:00:00+02;2040-04-20T11:00:00+02',
    'invented-name-985a;Oppdiktet navnløs emnepost;SYN985;;uio;2040-04-18T12:00:00+02;2040-04-18T13:00:00+02',
    `invented-name-985b;Oppdiktet senere emnepost;SYN985;${laterName};uio;2040-04-19T12:00:00+02;2040-04-19T13:00:00+02`,
  ].join('\n')
  await instrumentWrites(page)
  await page.goto('/'); await navigate(page, 'subjects')
  await readFile(page, 'invented-conflicting-and-later-names.csv', csv)
  const conflict = courseRow(page, 'SYN984'), populated = courseRow(page, 'SYN985')
  await openRow(conflict); await openRow(populated)
  await expect(conflict.getByLabel('Emnenavn', { exact: true })).toHaveValue('')
  await expect(populated.getByLabel('Emnenavn', { exact: true })).toHaveValue(laterName)
  await expect(preview(page)).toContainText(/forskjellige navn.*SYN984|SYN984.*forskjellige navn/)
  await (await reveal(preview(page).getByRole('button', { name: 'Importer valgte', exact: true }))).click()
  await expect(preview(page).getByRole('alert')).toContainText('Kilden oppgir forskjellige emnenavn. Velg et eksisterende emne eller skriv navnet som skal brukes.')
  expect(await writes(page)).toHaveLength(0)
  await (await reveal(conflict.getByLabel('Emnenavn', { exact: true }))).fill(accepted)
  await confirmImport(page)
  const result = await saved(page)
  expect(result.planner.courses).toHaveLength(2)
  expect(result.planner.events).toHaveLength(5)
  for (const [code, name, count, origin] of [['SYN984', accepted, 3, 'user'], ['SYN985', laterName, 2, 'source']]) {
    const course = result.planner.courses.find(item => item.code === code)
    expect(course.name).toBe(name)
    expect(result.planner.events.filter(event => event.courseId === course.id)).toHaveLength(count)
    expect(result.importSources[0].entries.find(entry => entry.kind === 'course' && entry.targetId === course.id).titleOrigin).toBe(origin)
  }
  await page.reload(); await navigate(page, 'subjects')
  await expect(page.locator('#course-list')).toContainText(accepted)
  await expect(page.locator('#course-list')).toContainText(laterName)
  expect((await saved(page)).planner).toEqual(result.planner)
})

test('review: a file revision of a link snapshot shows the current file origin after save and reload', async ({ page }) => {
  const input = { uid: 'synthetic-origin-986', title: 'Oppdiktet kildeøkt', code: 'SYN986', name: 'Oppdiktet emne for kildebytte' }
  const initial = calendar([qualifiedEvent(input)]), filename = 'invented-current-file-revision.ics'
  await page.route('**/api/import/calendar', route => route.fulfill({ json: { calendar: initial, warnings: [] } }))
  await page.goto('/'); await navigate(page, 'subjects'); await openImportMethod(page, 'calendar')
  await (await reveal(page.getByLabel('Kalenderlenke (HTTPS eller webcal)', { exact: true }))).fill('https://calendar.example.invalid/invented-origin.ics')
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  await expect(preview(page)).toBeVisible()
  await confirmImport(page)
  const first = await saved(page)
  expect(first.importSources[0].origin).toMatchObject({ kind: 'link' })
  await page.reload(); await navigate(page, 'subjects')
  const card = page.locator('#course-list .course-card').filter({ hasText: 'SYN986' })
  await expect(card.locator('.source-badge')).toContainText('Importert fra kalenderlenke (øyeblikksbilde)')

  await readFile(page, filename, calendar([qualifiedEvent({ ...input, end: '20400418T093000Z' })]), { sourceId: first.importSources[0].id })
  expect((await saved(page)).planner).toEqual(first.planner)
  await confirmImport(page)
  const result = await saved(page)
  expect(result.importSources).toHaveLength(1)
  expect(result.importSources[0]).toMatchObject({ id: first.importSources[0].id, revision: first.importSources[0].revision + 1, origin: { kind: 'file' }, name: filename })
  expect(result.importSources[0].origin.publicUrl).toBeUndefined()
  expect(result.planner.events).toHaveLength(1)
  expect(result.planner.events[0]).toMatchObject({ id: first.planner.events[0].id, start: first.planner.events[0].start, end: '2040-04-18T09:30:00.000Z' })
  expect(result.planner.courses.map(course => course.id)).toEqual(first.planner.courses.map(course => course.id))
  await page.reload(); await navigate(page, 'subjects')
  await expect(card.locator('.source-badge')).toHaveText(`Importert fra ICS-fil · ${filename}`)
  await expect(card.locator('.source-badge')).not.toContainText('kalenderlenke')
  expect((await saved(page)).importSources).toEqual(result.importSources)
})

test('review: simultaneous start and end questions show the differing values from a later CSV row', async ({ page }) => {
  const lastTitle = 'Oppdiktet økt med senere tidsvalg'
  const csv = ['type;eventid;summary;start;dtstart;end;dtend', ...Array.from({ length: 8 }, (_, index) => {
    const day = `2040-04-${18 + index}`, late = index === 7
    return ['event', `invented-alias-${index}`, late ? lastTitle : `Oppdiktet lik tidsrad ${index + 1}`,
      `${day}T${late ? '12:00:07' : '10:00:07'}+02`, `${day}T${late ? '14:00:17' : '10:00:07'}+02`,
      `${day}T${late ? '13:00:09' : '11:00:09'}+02`, `${day}T${late ? '15:00:19' : '11:00:09'}+02`,
    ].join(';')
  })].join('\n')
  await instrumentWrites(page)
  await page.goto('/'); await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Importer', exact: true }))).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'invented-late-time-aliases.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  const start = page.getByLabel('Når starter aktiviteten?', { exact: true }), end = page.getByLabel('Når slutter aktiviteten?', { exact: true })
  await expect(start).toBeVisible(); await expect(end).toBeVisible()
  await expect(start.locator('option[value=""]')).toHaveText('Velg starttidspunkt')
  await expect(end.locator('option[value=""]')).toHaveText('Velg sluttidspunkt')
  await expect(start.locator('option[value=start]')).toContainText('2040-04-25T12:00:07+02')
  await expect(start.locator('option[value=dtstart]')).toContainText('2040-04-25T14:00:17+02')
  await expect(end.locator('option[value=end]')).toContainText('2040-04-25T13:00:09+02')
  await expect(end.locator('option[value=dtend]')).toContainText('2040-04-25T15:00:19+02')
  expect(await writes(page)).toHaveLength(0)
  await (await reveal(start)).selectOption('dtstart'); await (await reveal(end)).selectOption('dtend')
  await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
  const row = activityRow(page, lastTitle)
  await openRow(row)
  await expect(row.getByLabel('Start i norsk tid', { exact: true })).toHaveValue('2040-04-25T14:00:17')
  await expect(row.getByLabel('Slutt i norsk tid', { exact: true })).toHaveValue('2040-04-25T15:00:19')
  expect(await writes(page)).toHaveLength(0)
  await confirmImport(page)
  const result = await saved(page)
  expect(result.planner.events).toHaveLength(8)
  expect(result.planner.events.find(event => event.title === lastTitle)).toMatchObject({ start: '2040-04-25T12:00:17Z', end: '2040-04-25T13:00:19Z' })
  await page.reload(); expect((await saved(page)).planner).toEqual(result.planner)
})
