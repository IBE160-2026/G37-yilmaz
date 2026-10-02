import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { navigate, openTaskDetails, openMenu, edit, openCourseImport } from '../e2e/helpers.js'

test.describe.configure({ mode: 'serial' })
const phase = process.env.STUDIEPLAN_ACCEPTANCE_PHASE || 'create'
const snapshotPath = process.env.STUDIEPLAN_ACCEPTANCE_SNAPSHOT
const state = async page => {
  const response = await page.request.get('/api/state')
  expect(response.ok()).toBe(true)
  return response.json()
}
async function put(page, envelope) {
  const previous = await state(page)
  const response = await page.request.put('/api/state', { data: { expectedRevision: previous.revision, envelope } })
  expect(response.ok()).toBe(true)
  await page.reload()
}
async function proposal(page, text, action) {
  const registration = page.locator('#text-registration')
  await registration.getByLabel('Skriv hva du vil legge til eller endre').fill(text)
  await registration.getByRole('button', { name: 'Lag forslag', exact: true }).click()
  await registration.getByRole('button', { name: action, exact: true }).click()
}
async function calendarDate(page, date) {
  await navigate(page, 'calendar')
  await page.locator('#full-calendar-date').fill(date)
  await page.locator('#full-calendar-date').dispatchEvent('change')
  await page.getByRole('button', { name: 'Agenda', exact: true }).click()
}
async function persistSnapshot(page) {
  if (snapshotPath) await writeFile(snapshotPath, JSON.stringify(await state(page), null, 2))
}

test('production registration precision, edit/undo, calendar kinds and honest capacity', async ({ page }, info) => {
  test.skip(phase !== 'create')
  page.setDefaultTimeout(15_000)
  await page.goto('/')
  const empty = (await state(page)).envelope
  expect(empty.tasks).toEqual([])
  expect(empty.sessions || []).toEqual([])
  for (const field of ['courses', 'events', 'sources']) expect(empty.planner?.[field] || []).toEqual([])
  expect(await page.evaluate(() => globalThis.__STUDIEPLAN_API__)).toBe(true)
  await navigate(page, 'all')
  await page.locator('#new-task').click()
  await page.locator('#title').fill('Syntetisk titteloppgave')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  let data = (await state(page)).envelope
  const titleTask = data.tasks.find(task => task.title === 'Syntetisk titteloppgave')
  expect(titleTask).toMatchObject({ deadlineLocal: '', completed: false })
  expect(titleTask.courseId || '').toBe('')
  expect(titleTask.remainingMinutes == null).toBe(true)
  await page.locator('#new-task').click()
  await page.locator('#title').fill('Syntetisk datofrist')
  await openTaskDetails(page)
  await page.locator('#deadlineDate').fill('2026-10-04')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  const deadline = (await state(page)).envelope.tasks.find(task => task.title === 'Syntetisk datofrist')
  expect(deadline.deadlineLocal).toBe('2026-10-04')
  expect(deadline.courseId || '').toBe('')
  expect(deadline.remainingMinutes == null).toBe(true)
  await proposal(page, 'Legg til møte 4.10.2026 kl. 12–13', 'Legg til aktivitet')
  await proposal(page, 'Legg til tannlege 4.10.2026 kl. 15', 'Legg til aktivitet')
  await proposal(page, 'Legg til egen aktivitet bursdag 4.10.2026', 'Legg til aktivitet')
  data = (await state(page)).envelope
  const [exact, startOnly, dateOnly] = data.planner.events
  expect(exact).toMatchObject({ activityKind: 'personal', courseId: '', dateLocal: '2026-10-04', start: '2026-10-04T10:00:00Z', end: '2026-10-04T11:00:00Z' })
  expect(startOnly.start).toBe('2026-10-04T13:00:00Z'); expect(startOnly.end || '').toBe('')
  expect(dateOnly.start || '').toBe(''); expect(dateOnly.end || '').toBe('')
  await calendarDate(page, '2026-10-04')
  await page.locator(`[data-calendar-key="event:${exact.id}"]`).first().click()
  await page.getByRole('button', { name: 'Rediger', exact: true }).click()
  await page.getByLabel('Navn på egen aktivitet').fill('Syntetisk endret møte')
  await page.getByRole('button', { name: 'Lagre egen aktivitet', exact: true }).click()
  expect((await state(page)).envelope.planner.events.find(event => event.id === exact.id).title).toBe('Syntetisk endret møte')
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  expect((await state(page)).envelope.planner.events.find(event => event.id === exact.id)).toEqual(exact)

  // Clearly synthetic API fixtures only supplement the UI-created data with the
  // calendar kinds and relations unavailable through a title-only registration.
  data = (await state(page)).envelope
  data.planner.courses.push({ id: 'acceptance-course', code: 'SYN101', name: 'Syntetisk emne', university: 'Syntetisk', year: 2026, semester: 'autumn', notes: '' })
  for (const [id, title, activityKind, start, end] of [
    ['acceptance-teaching', 'Syntetisk undervisning', undefined, '08:00', '09:00'],
    ['acceptance-exam', 'Syntetisk avsluttende prøve', 'exam', '09:00', '10:00'],
  ]) data.planner.events.push({ id, title, courseId: 'acceptance-course', start: `2026-10-04T${start}:00Z`, end: `2026-10-04T${end}:00Z`, ...(activityKind ? { activityKind } : {}) })
  data.workWindows = [{ id: 'acceptance-window', label: 'Syntetisk seks timers arbeidstid', start: '2026-10-04T06:00:00Z', end: '2026-10-04T12:00:00Z' }]
  data.sessions = [{ id: 'acceptance-session', taskId: titleTask.id, dateLocal: '2026-10-04', startTime: '16:00', endTime: '16:30' }]
  await put(page, data)
  await navigate(page, 'capacity')
  await expect(page.locator('#capacity-summary')).toContainText('180 min beregnet ledig ut fra kjente tider')
  await expect(page.locator('#capacity-panel')).toContainText('Tiden behandles ikke som sikkert ledig')
  await calendarDate(page, '2026-10-04')
  for (const [key, label] of [[`task:${deadline.id}`, 'Frist'], [`event:${exact.id}`, 'Egen aktivitet'], ['event:acceptance-exam', 'Eksamen'], ['event:acceptance-teaching', 'Undervisning'], ['session:acceptance-session', 'Studieøkt']]) {
    await expect(page.locator(`[data-calendar-key="${key}"]`).first()).toContainText(label)
  }
  await page.locator('[data-calendar-key="event:acceptance-exam"]').first().click()
  await expect(page.locator('dialog.calendar-details')).toContainText('Eksamen')
  await page.getByRole('button', { name: 'Lukk detaljer', exact: true }).click()
  await expect(page.locator('dialog.calendar-details')).toBeHidden()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.locator('.full-calendar-viewport').evaluate(element => { element.scrollTop = 0 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`final-calendar-${width}.png`), fullPage: true, animations: 'disabled' })
    if (width === 390) {
      await page.locator('.full-calendar-viewport').evaluate(element => { element.scrollTop = element.scrollHeight })
      await page.screenshot({ path: info.outputPath('final-calendar-390-bottom.png'), fullPage: true, animations: 'disabled' })
    }
  }
  await page.reload()
  expect((await state(page)).envelope.planner.events).toEqual(data.planner.events)
  await persistSnapshot(page)
})

test('actual replan preview and accepted sessions avoid known intervals and disclose uncertain personal timing', async ({ page }, info) => {
  test.skip(phase !== 'create')
  page.setDefaultTimeout(15_000)
  await page.goto('/'); await navigate(page, 'all')
  await page.locator('#new-task').click()
  await page.locator('#title').fill('Syntetisk planarbeid')
  await page.locator('#remainingMinutes').fill('120')
  await openTaskDetails(page)
  await page.locator('#deadlineDate').fill('2026-10-04')
  await page.locator('#deadlineTime').fill('14:00')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  const data = (await state(page)).envelope
  const task = data.tasks.find(task => task.title === 'Syntetisk planarbeid')
  expect(task.remainingMinutes).toBe(120)
  data.sessions.push({ id: 'acceptance-must-move', taskId: task.id, dateLocal: '2026-10-04', startTime: '12:00', endTime: '12:30' })
  await put(page, data); await navigate(page, 'all')
  const beforePreview = await state(page)
  await page.getByRole('button', { name: 'Se planforslag «Syntetisk planarbeid»', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Planforslag for oppgaven', exact: true })
  await expect(dialog).toContainText('Flyttes fra søndag 4. oktober kl. 12:00–12:30')
  await expect(dialog).toContainText('Forslaget kan ikke garantere at denne tiden er ledig')
  const times = await dialog.locator('.proposed-session-time').allTextContents()
  expect(times.length).toBeGreaterThan(0)
  const proposed = times.map(text => {
    expect(text).toContain('søndag 4. oktober')
    const match = text.match(/kl\. (\d\d):(\d\d)–(\d\d):(\d\d)/)
    expect(match, text).toBeTruthy()
    return { start: Number(match[1]) * 60 + Number(match[2]), end: Number(match[3]) * 60 + Number(match[4]) }
  })
  for (const interval of proposed) {
    expect(interval.start).toBeGreaterThanOrEqual(8 * 60)
    expect(interval.end).toBeLessThanOrEqual(14 * 60)
    // Teaching 10–11, exam 11–12, and exact personal activity 12–13.
    expect(interval.end <= 10 * 60 || interval.start >= 13 * 60).toBe(true)
  }
  expect(proposed.reduce((sum, interval) => sum + interval.end - interval.start, 0)).toBe(120)
  expect(await state(page)).toEqual(beforePreview)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`actual-replan-preview-${width}.png`), fullPage: true, animations: 'disabled' })
  }
  await dialog.getByRole('button', { name: 'Bruk planen', exact: true }).click()
  await expect(dialog).toBeHidden()
  const accepted = await state(page)
  expect(accepted.revision).toBe(beforePreview.revision + 1)
  const sessions = accepted.envelope.sessions.filter(session => session.taskId === task.id)
  expect(sessions).toHaveLength(proposed.length)
  expect(sessions.some(session => session.id === 'acceptance-must-move')).toBe(true)
  const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  expect(sessions.map(session => ({ start: minutes(session.startTime), end: minutes(session.endTime) }))).toEqual(proposed)
  expect(accepted.envelope.planner.events).toEqual(beforePreview.envelope.planner.events)
  await page.reload(); expect((await state(page)).envelope.sessions).toEqual(accepted.envelope.sessions)
  await info.attach('actual-replan-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), taskId: task.id, explicitEstimateMinutes: 120, proposed, previewDidNotWrite: true, noKnownOverlap: true, uncertainTimingWarning: true, retainedMovedIdentity: 'acceptance-must-move' }) })
  await persistSnapshot(page)
})

test('genuine NTNU public import preview/confirm/calendar/detail/reload/repeat and controlled saved-source refresh failure preservation', async ({ page }, info) => {
  test.skip(phase !== 'create' || process.env.RUN_LIVE_TEACHING !== '1', 'Explicit public-source opt-in required; skipped is not import acceptance.')
  test.setTimeout(240_000)
  await page.goto('/')
  let first
  for (let attempt = 0; attempt < 2; attempt++) {
    await navigate(page, 'subjects'); await openCourseImport(page)
    await page.getByRole('button', { name: 'Neste: søk og semester', exact: true }).click()
    const form = page.locator('#course-import-form')
    await form.locator('[name=code]').fill('EXPH0100')
    await form.locator('[name=semester]').selectOption('autumn')
    await form.locator('[name=year]').fill('2026')
    await form.getByRole('button', { name: 'Søk emner', exact: true }).click()
    await page.locator('.wizard-results button').filter({ hasText: 'EXPH0100' }).first().click({ timeout: 45000 })
    const preview = page.locator('#import-preview')
    await preview.getByRole('button', { name: 'Hent undervisning fra TP', exact: true }).click()
    await preview.locator('summary').filter({ hasText: /^Aktivitetsutvalg/ }).click()
    await expect(preview.locator('.activity-choices input').first()).toBeVisible({ timeout: 45000 })
    await preview.getByRole('button', { name: 'Velg ingen aktiviteter', exact: true }).click()
    await preview.locator('.activity-choices input').first().check()
    const beforeConfirm = await state(page)
    await preview.getByRole('button', { name: 'Bekreft import', exact: true }).click()
    await expect(preview).toBeHidden()
    const current = (await state(page)).envelope
    const course = current.planner.courses.find(value => value.code === 'EXPH0100')
    expect(course).toMatchObject({ year: 2026, semester: 'autumn', teachingCheck: { status: 'success' } })
    const events = current.planner.events.filter(value => value.courseId === course.id)
    expect(events.length).toBeGreaterThan(0)
    if (first) expect(events.map(value => [value.id, value.sourceKey, value.courseId, value.start, value.end])).toEqual(first.events.map(value => [value.id, value.sourceKey, value.courseId, value.start, value.end]))
    else expect(beforeConfirm.envelope.planner.courses.some(value => value.code === 'EXPH0100')).toBe(false)
    first = { course, events }
    const visible = events.find(value => !value.excluded)
    expect(visible).toBeTruthy()
    expect(Date.parse(visible.start)).toBeGreaterThanOrEqual(Date.parse('2026-06-30T22:00:00Z'))
    expect(Date.parse(visible.end)).toBeLessThan(Date.parse('2026-12-31T23:00:00Z'))
    await calendarDate(page, visible.start.slice(0, 10))
    const escapedKey = await page.evaluate(value => CSS.escape(value), `event:${visible.id}`)
    const entry = page.locator(`[data-calendar-key="${escapedKey}"]`).first()
    await expect(entry).toContainText(visible.title)
    await expect(entry).toContainText('Undervisning')
    await entry.click(); await expect(page.locator('dialog.calendar-details')).toContainText(visible.title)
    await page.getByRole('button', { name: 'Lukk detaljer', exact: true }).click()
    await page.reload(); expect((await state(page)).envelope.planner.events.filter(value => value.courseId === course.id)).toEqual(events)
  }
  const beforeFailure = await state(page)
  await page.route('**/api/import/providers/ntnu/search?**', route => route.fulfill({ status: 502, json: { status: 'source-error', error: 'Syntetisk kontrollert kildefeil: upstream-unavailable' } }))
  await navigate(page, 'subjects'); await openCourseImport(page)
  await page.getByRole('button', { name: 'Neste: søk og semester', exact: true }).click()
  await page.locator('#course-import-form [name=code]').fill('EXPH0100')
  await page.locator('#course-import-form').getByRole('button', { name: 'Søk emner', exact: true }).click()
  await expect(page.locator('#subjects-panel')).toContainText(/kildefeil|upstream-unavailable/i)
  expect(await state(page)).toEqual(beforeFailure)
  await page.unroute('**/api/import/providers/ntnu/search?**')
  const source = beforeFailure.envelope.planner.sources.find(source => source.courseId === first.course.id)
  expect(source.url).toBeTruthy()
  let refreshCalls = 0
  await page.route('**/api/import/calendar', async route => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON().url).toBe(source.url)
    refreshCalls++
    await route.fulfill({ status: 400, json: refreshCalls === 1 ? { error: 'Syntetisk HTTP 401. Årsaken er ikke bekreftet.' } : { status: 'invalid-response', error: 'Syntetisk lenke returnerte ikke en kalender.' } })
  })
  // Refresh the genuine saved source through the actual user control. The
  // injected error targets its production calendar transport, not course search.
  const sourceCard = page.locator('#source-list .source-card').filter({ hasText: 'EXPH0100' })
  await sourceCard.getByRole('button', { name: 'Oppdater nå', exact: true }).click()
  await expect.poll(async () => (await state(page)).envelope.planner.courses.find(course => course.id === first.course.id).teachingCheck.status).toBe('transport-error')
  const failed = await state(page)
  const failedCourse = failed.envelope.planner.courses.find(course => course.id === first.course.id)
  const failedSource = failed.envelope.planner.sources.find(value => value.id === source.id)
  expect(refreshCalls).toBe(1)
  expect(failed.envelope.planner.events).toEqual(beforeFailure.envelope.planner.events)
  expect(failedSource.groups).toEqual(source.groups)
  expect(failedSource.excludedKeys).toEqual(source.excludedKeys)
  expect(failedSource.lastSuccess).toBe(source.lastSuccess)
  expect(Date.parse(failedSource.lastAttempt)).toBeGreaterThan(Date.parse(source.lastAttempt))
  expect(failedSource.failures).toBe((source.failures || 0) + 1)
  expect(failedCourse.teachingCheck).toMatchObject({ status: 'transport-error', lastSuccess: first.course.teachingCheck.lastSuccess, source: 'calendar-refresh' })
  expect(failedCourse.teachingCheck.eventCount).toBe(first.course.teachingCheck.eventCount)
  expect(Date.parse(failedCourse.teachingCheck.lastAttempt)).toBeGreaterThan(Date.parse(first.course.teachingCheck.lastAttempt))
  await navigate(page, 'subjects')
  await expect(page.locator('#source-list')).toContainText('Tidligere undervisning er beholdt')
  await expect(page.locator(`#course-list [data-course-id="${first.course.id}"] [data-teaching-check="transport-error"]`)).toContainText('Kilden kunne ikke kontaktes')
  await expect(page.locator(`#course-list [data-course-id="${first.course.id}"] [data-teaching-check="transport-error"]`)).toContainText('Siste vellykkede kontroll')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await page.locator(`#course-list [data-course-id="${first.course.id}"]`).scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`final-import-status-${width}.png`), fullPage: true, animations: 'disabled' })
  }
  await sourceCard.getByRole('button', { name: 'Oppdater nå', exact: true }).click()
  await expect.poll(async () => (await state(page)).envelope.planner.courses.find(course => course.id === first.course.id).teachingCheck.status).toBe('invalid-response')
  const invalid = await state(page)
  expect(refreshCalls).toBe(2)
  expect(invalid.envelope.planner.events).toEqual(beforeFailure.envelope.planner.events)
  const invalidSource = invalid.envelope.planner.sources.find(value => value.id === source.id)
  expect(invalidSource.groups).toEqual(source.groups)
  expect(invalidSource.excludedKeys).toEqual(source.excludedKeys)
  expect(invalidSource.lastSuccess).toBe(source.lastSuccess)
  expect(invalid.envelope.planner.courses.find(course => course.id === first.course.id).teachingCheck.lastSuccess).toBe(first.course.teachingCheck.lastSuccess)
  await info.attach('public-source-selection', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), institution: 'ntnu', code: 'EXPH0100', year: 2026, semester: 'autumn', courseId: first.course.id, eventIdentities: first.events.map(event => ({ id: event.id, sourceKey: event.sourceKey, start: event.start, end: event.end })), scope: 'One public course/term and explicit activity selection; no personal-group or national-coverage claim.' }) })
  await persistSnapshot(page)
})

test('fresh browser after recreation reads exact API state and UI backup restores exact envelope', async ({ page, browser }, info) => {
  test.skip(phase !== 'restore')
  page.setDefaultTimeout(15_000)
  expect(snapshotPath, 'Set snapshot from completed create phase before recreation').toBeTruthy()
  const expected = JSON.parse(await readFile(snapshotPath, 'utf8'))
  await page.goto('/')
  expect(await page.evaluate(() => localStorage.getItem('studieplanlegger:v1'))).toBeNull()
  expect(await state(page)).toEqual(expected)
  await navigate(page, 'settings')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
  const backup = await readFile(await (await downloading).path())
  const portable = JSON.parse(backup).data
  expect(portable.tasks).toEqual(expected.envelope.tasks)
  expect(portable.sessions).toEqual(expected.envelope.sessions)
  const identities = envelope => envelope.planner.events.map(({ id, courseId, sourceId, sourceKey, activityKind, dateLocal, start, end }) => ({ id, courseId, sourceId, sourceKey, activityKind, dateLocal, start, end }))
  expect(identities(portable)).toEqual(identities(expected.envelope))
  expect(portable.planner.courses.map(course => course.id)).toEqual(expected.envelope.planner.courses.map(course => course.id))
  // Backup intentionally disconnects URL feeds for privacy. Recreation above
  // requires byte-exact full state; restore requires the exact downloaded data.
  for (const source of portable.planner.sources.filter(source => source.kind === 'url')) {
    expect(source.url).toBeUndefined(); expect(source.reconnectRequired).toBe(true); expect(source.autoRefresh).toBe(false)
  }
  await navigate(page, 'all'); await openMenu(page, 'Syntetisk titteloppgave'); await edit(page, 'Syntetisk titteloppgave').click()
  await page.locator('#title').fill('Syntetisk midlertidig endring')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  const intervening = await state(page)
  await navigate(page, 'settings')
  await page.locator('#backup-file').setInputFiles({ name: 'synthetic-acceptance-backup.json', mimeType: 'application/json', buffer: backup })
  await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect(page.locator('#settings-panel [role=status]')).toContainText('Sikkerhetskopien er gjenopprettet')
  const restored = await state(page)
  expect(restored.envelope).toEqual(portable)
  expect(restored.revision).toBe(expected.revision + 2)
  const recoveryResponse = await page.request.get('/api/state/recovery')
  expect(recoveryResponse.ok()).toBe(true)
  expect((await recoveryResponse.json()).recovery.data).toEqual(intervening.envelope)
  const fresh = await browser.newContext({ baseURL: new URL(page.url()).origin, timezoneId: 'Europe/Oslo' })
  try { const clean = await fresh.newPage(); await clean.goto('/'); expect(await state(clean)).toEqual(restored) } finally { await fresh.close() }
  await info.attach('exact-persistence', { contentType: 'application/json', body: JSON.stringify({ recreationRevision: expected.revision, restoredRevision: restored.revision, exactEnvelope: true }) })
})
