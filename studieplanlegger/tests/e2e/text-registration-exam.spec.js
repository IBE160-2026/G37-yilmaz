import { test, expect } from '@playwright/test'
import { freeze, instrumentWrites, key, navigate, openTaskDetails } from './helpers.js'

const course = { id: 'c1', name: 'Digitalisering', code: 'IBE160', university: 'Testuniversitetet', notes: '', semester: 'autumn', year: 2026, credits: 10 }
const secondCourse = { ...course, id: 'c2', name: 'Matematikk', code: 'MAT100' }
const event = (id, title, activityKind) => ({ id, title, courseId: 'c1', start: '2026-09-30T08:00:00.000Z', end: '2026-09-30T10:00:00.000Z', location: 'A1', notes: '', ...(activityKind ? { activityKind } : {}) })
const baseTask = (id, courseId = 'c1', courseCode = 'IBE160') => ({ id, title: 'rapport', course: courseCode, courseId, deadlineLocal: '2026-10-12', estimatedMinutes: null, remainingMinutes: 120, completed: false })

async function installState(page, { tasks = [], events = [], courses = [course] } = {}) {
  await page.goto('/')
  await page.evaluate(({ key, tasks, events, courses }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks, planner: { courses, events, sources: [] } })), { key, tasks, events, courses })
  await instrumentWrites(page); await page.reload()
}

test('renaming a pending target with unchanged ID and value rejects stale identity and keeps the proposal editable', async ({ page }) => {
  await freeze(page, '2026-09-29T12:00:00+02:00')
  await installState(page, { tasks: [baseTask('a')] })
  const registration = page.locator('#text-registration')
  await registration.getByLabel('Skriv hva du vil legge til eller endre').fill('Endre fristen på rapporten til 13. oktober')
  await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await navigate(page, 'all')
  const row = page.locator('#task-list > li').filter({ hasText: 'rapport' }).first()
  await row.getByLabel('Flere handlinger «rapport»').click()
  await row.getByRole('button', { name: /Rediger/ }).click()
  await page.locator('#title').fill('Omdøpt rapport')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  const before = await page.evaluate(key => localStorage.getItem(key), key)
  const writes = await page.evaluate(() => window.writeAttempts.length)
  await registration.getByRole('button', { name: 'Lagre endring' }).click()
  await expect(registration).toContainText('identitet')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before)
  expect(await page.evaluate(() => window.writeAttempts.length)).toBe(writes)
  await expect(registration.getByLabel('Oppgavenavn (må matche nøyaktig)')).toHaveValue('rapporten')
  await expect(registration.getByLabel('Ny frist')).toHaveValue('2026-10-13')
  await registration.getByLabel('Oppgavenavn (må matche nøyaktig)').fill('Omdøpt rapport')
  await expect(registration.getByLabel('Oppgavenavn (må matche nøyaktig)')).toHaveValue('Omdøpt rapport')
})

test('timed task proposals confirm ISO clocks and selected years preserve the clock', async ({ page }) => {
  await freeze(page, '2026-09-29T12:00:00+02:00'); await installState(page)
  const registration = page.locator('#text-registration'), command = registration.getByLabel('Skriv hva du vil legge til eller endre')
  await command.fill('Legg til rapport med frist 12. oktober kl. 14')
  await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await registration.getByRole('button', { name: 'Legg til oppgave' }).click()
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).tasks[0].deadlineLocal).toBe('2026-10-12T14:00')
  await command.fill('Legg til vårarbeid med frist 12. mai kl. 14')
  await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await registration.locator('[name=yearChoice]').selectOption('2027')
  await registration.getByRole('button', { name: 'Legg til oppgave' }).click()
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).tasks[1].deadlineLocal).toBe('2027-05-12T14:00')
})

test('text proposal writes once, is undoable, and exams use shared marking', async ({ page }) => {
  await freeze(page, '2026-09-29T12:00:00+02:00')
  const events = [event('exam', 'Avsluttende prøve', 'exam'), event('prep', 'Eksamensforberedelse')]
  await installState(page, { events })

  const registration = page.locator('#text-registration')
  await registration.getByLabel('Skriv hva du vil legge til eller endre').fill('Lag oppgave Skriv rapport i IBE160 frist i morgen arbeid 1,5 timer')
  await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await expect(registration.getByLabel('Tittel')).toHaveValue('Skriv rapport')
  await expect(registration.getByLabel('Frist (valgfritt)')).toHaveValue('2026-09-30')
  await registration.getByRole('button', { name: 'Legg til oppgave' }).click()
  expect(await page.evaluate(() => window.writeAttempts.length)).toBe(1)
  let stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  expect(stored.tasks).toHaveLength(1)
  expect(stored.tasks[0]).toMatchObject({ title: 'Skriv rapport', courseId: 'c1', deadlineLocal: '2026-09-30', remainingMinutes: 90 })
  await registration.getByRole('button', { name: 'Angre' }).click()
  stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  expect(stored.tasks).toHaveLength(0)
  await page.reload(); expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).tasks).toHaveLength(0)
  await expect(page.locator('#next-plan')).toContainText('📝 Eksamen')

  await navigate(page, 'calendar')
  await expect(page.locator('#full-calendar .calendar-entry.is-exam').filter({ hasText: 'Avsluttende prøve' }).first()).toContainText('Eksamen')
  await expect(page.locator('#full-calendar .calendar-entry.is-exam').filter({ hasText: 'Eksamensforberedelse' })).toHaveCount(0)
  await expect(page.locator('#full-calendar .calendar-entry').filter({ hasText: 'Eksamensforberedelse' }).first()).toContainText('Undervisning')
  await page.locator('.full-calendar-filters > summary').click(); const teachingFilter = page.getByRole('checkbox', { name: 'Undervisning', exact: true }); await teachingFilter.uncheck(); await expect(page.locator('#full-calendar .calendar-entry.is-exam')).toHaveCount(0); await teachingFilter.check()

  await page.locator('#full-calendar-date').evaluate(input => { input.value = '2026-09-30'; input.dispatchEvent(new Event('change', { bubbles: true })) })
  for (const mode of ['Måned', 'Dag', 'Agenda', 'Uke']) {
    const button = page.getByRole('button', { name: mode, exact: true }); await button.focus(); await page.keyboard.press('Enter')
    await expect(page.locator('#full-calendar')).toContainText('Eksamen')
  }
  const examControl = page.locator('#full-calendar .calendar-entry.is-exam').filter({ hasText: 'Avsluttende prøve' }).first()
  await examControl.focus(); await page.keyboard.press('Enter'); await expect(page.locator('dialog.calendar-details')).toContainText('📝 Eksamen'); await page.getByRole('button', { name: 'Lukk detaljer' }).click()
  await navigate(page, 'subjects'); await expect(page.locator('#event-list .event-card.is-exam')).toContainText('📝 Eksamen')
})

test('partial correction, duplicate choice, unchanged, stale, failure and double activation are safe', async ({ page }) => {
  await freeze(page, '2026-09-29T12:00:00+02:00')
  await installState(page, { tasks: [baseTask('a'), { ...baseTask('b', 'c2', 'MAT100'), deadlineLocal: '2026-10-15' }], courses: [course, secondCourse] })
  const registration = page.locator('#text-registration'), command = registration.getByLabel('Skriv hva du vil legge til eller endre')

  await command.fill('Legg til notat i IBE999 med frist 31. februar gjenstår 90 min'); await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await expect(registration).toContainText('Korriger forslaget'); await expect(registration.getByLabel('Tittel')).toHaveValue('notat'); await expect(registration.getByLabel('Gjenstående arbeid (valgfritt)')).toHaveValue('90 min')
  await registration.getByLabel('Emne (valgfritt, nøyaktig kode eller navn)').fill('IBE160'); await registration.getByLabel('Frist (valgfritt)').fill('12. oktober'); await registration.getByRole('button', { name: 'Legg til oppgave' }).click()
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).tasks).toHaveLength(3)

  await command.fill('Endre fristen på rapporten til 13. oktober'); await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await expect(registration.getByLabel('Hvilken oppgave?')).toBeVisible(); await registration.getByLabel('Hvilken oppgave?').selectOption('b'); await expect(registration.locator('.text-registration-old-value')).toHaveText('Fra: 2026-10-15'); await registration.getByRole('button', { name: 'Lagre endring' }).click()
  let state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); expect(state.tasks.find(task => task.id === 'b').deadlineLocal).toBe('2026-10-13'); expect(state.tasks.find(task => task.id === 'a').deadlineLocal).toBe('2026-10-12')

  const writesBefore = await page.evaluate(() => window.writeAttempts.length)
  await command.fill('Endre fristen på rapporten til 12. oktober'); await registration.getByRole('button', { name: 'Lag forslag' }).click(); await registration.getByLabel('Hvilken oppgave?').selectOption('a'); await registration.getByRole('button', { name: 'Lagre endring' }).click()
  expect(await page.evaluate(() => window.writeAttempts.length)).toBe(writesBefore); await expect(registration).toContainText('Ingen endring å lagre')

  await command.fill('Sett gjenstående arbeid på rapporten til 90 min'); await registration.getByRole('button', { name: 'Lag forslag' }).click(); await registration.getByLabel('Hvilken oppgave?').selectOption('a')
  await page.locator('#view-all').click(); const taskRow = page.locator('#task-list > li').filter({ hasText: 'rapport' }).first(); await taskRow.getByLabel('Flere handlinger «rapport»').click(); await taskRow.getByRole('button', { name: /Rediger/ }).click(); await page.locator('#remainingMinutes').fill('80'); await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  await registration.getByRole('button', { name: 'Lagre endring' }).click(); await expect(registration).toContainText('Verdien er endret siden forslaget')

  await registration.getByRole('button', { name: 'Avbryt' }).click(); await command.fill('Sett gjenstående arbeid på rapporten til 75 min'); await registration.getByRole('button', { name: 'Lag forslag' }).click(); await registration.getByLabel('Hvilken oppgave?').selectOption('a'); await page.evaluate(() => { window.failWrite = true }); const failingConfirm = registration.getByRole('button', { name: 'Lagre endring' }); await failingConfirm.scrollIntoViewIfNeeded(); const scrollBeforeFailure = await page.evaluate(() => scrollY); await failingConfirm.click(); await expect(registration.getByLabel('Nytt gjenstående arbeid')).toHaveValue('75 min'); await expect(registration).toContainText('Kunne ikke lagre'); await expect(failingConfirm).toBeFocused(); expect(Math.abs(await page.evaluate(() => scrollY) - scrollBeforeFailure)).toBeLessThan(2)
  await page.evaluate(() => { window.failWrite = false }); const beforeRetry = await page.evaluate(() => window.writeAttempts.length); const confirm = registration.getByRole('button', { name: 'Lagre endring' }); await confirm.evaluate(button => { button.click(); button.click() }); expect(await page.evaluate(() => window.writeAttempts.length)).toBe(beforeRetry + 1)
})

test('partial knowledge stays compact and a personal interval survives CRUD, reload and undo', async ({ page }) => {
  await freeze(page, '2026-09-29T12:00:00+02:00')
  await installState(page, { courses: [course] })
  const registration = page.locator('#text-registration'), command = registration.getByLabel('Skriv hva du vil legge til eller endre')

  await command.fill('Øve på koding'); await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await expect(registration.locator('.text-registration-summary')).toContainText('Uten emne')
  await expect(registration.locator('.text-registration-summary')).toContainText('Arbeidsmengde: ikke oppgitt')
  await expect(registration.locator('.text-registration-details')).not.toHaveAttribute('open', '')
  await expect(registration.getByLabel('Tittel')).not.toBeVisible()
  await registration.getByRole('button', { name: 'Legg til oppgave' }).click()

  await command.fill('Lever fysikkoppgave innen 4.10'); await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await expect(registration.locator('.text-registration-summary')).toContainText('4. oktober 2026')
  await registration.getByRole('button', { name: 'Legg til oppgave' }).click()

  await command.fill('Legg til møte 4.10 kl. 12–13'); await registration.getByRole('button', { name: 'Lag forslag' }).click()
  await expect(registration.locator('.text-registration-summary')).toContainText('Type: Egen aktivitet')
  await registration.getByRole('button', { name: 'Legg til aktivitet' }).click()
  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  expect(saved.tasks.map(task => ({ title: task.title, courseId: task.courseId, deadline: task.deadlineLocal, remaining: task.remainingMinutes }))).toEqual([
    { title: 'Øve på koding', courseId: undefined, deadline: '', remaining: undefined },
    { title: 'Lever fysikkoppgave', courseId: undefined, deadline: '2026-10-04', remaining: undefined },
  ])
  expect(saved.planner.events[0]).toMatchObject({ title: 'møte', activityKind: 'personal', courseId: '', dateLocal: '2026-10-04', start: '2026-10-04T10:00:00Z', end: '2026-10-04T11:00:00Z' })

  await page.reload(); await navigate(page, 'calendar')
  await page.locator('#full-calendar-date').evaluate(input => { input.value = '2026-10-04'; input.dispatchEvent(new Event('change', { bubbles: true })) })
  const activity = page.locator('#full-calendar .calendar-entry.entry-personal').filter({ hasText: 'møte' }).first()
  await expect(activity).toContainText('Egen aktivitet'); await activity.click()
  await expect(page.locator('dialog.calendar-details')).toContainText('Uten emne')
  await page.getByRole('button', { name: 'Rediger', exact: true }).click()
  await page.getByLabel('Navn på egen aktivitet').fill('Tannlege')
  await page.getByRole('button', { name: 'Lagre egen aktivitet' }).click()
  await navigate(page, 'subjects')
  await expect(page.locator('#event-list')).toContainText('Tannlege')

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Slett egen aktivitet Tannlege' }).click()
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); expect(saved.planner.events).toEqual([])
  await page.locator('.contextual-undo').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); expect(saved.planner.events[0]).toMatchObject({ title: 'Tannlege', activityKind: 'personal', courseId: '' })
})

test('synthetic final screenshots have no document overflow and retain focused proposal', async ({ page }) => {
  await freeze(page, '2026-09-29T12:00:00+02:00')
  await installState(page, { tasks: [{ ...baseTask('a'), deadlineLocal: '2026-09-30' }], events: [event('exam', 'Avsluttende prøve', 'exam')], courses: [course] })
  const registration = page.locator('#text-registration'), command = registration.getByLabel('Skriv hva du vil legge til eller endre')
  await command.fill('Legg til rapport i IBE160 med frist fredag kl. 14.'); await registration.getByRole('button', { name: 'Lag forslag' }).click(); const addTask = registration.getByRole('button', { name: 'Legg til oppgave' }); await addTask.focus(); await registration.scrollIntoViewIfNeeded()
  await expect(page.locator('#next-plan')).toContainText('rapport')
  await expect(page.locator('#next-plan')).not.toContainText('kl. 00:00')
  const shots = [{ width: 1440, height: 1000, name: '1440' }, { width: 1280, height: 900, name: '1280' }, { width: 390, height: 844, name: '390' }]
  for (const shot of shots) { await page.setViewportSize(shot); await registration.scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await expect(addTask).toBeFocused(); await page.screenshot({ path: `artifacts/rule-text-exam-${shot.name}.png`, fullPage: true }) }
  await registration.getByText('Endre detaljer').click(); await page.addStyleTag({ content: 'html { font-size: 24px !important; }' }); await page.setViewportSize({ width: 390, height: 844 }); await command.focus(); await registration.getByLabel('Tittel').focus()
  for (const control of [registration.getByLabel('Tittel'), registration.getByLabel('Emne (valgfritt, nøyaktig kode eller navn)'), registration.getByLabel('Frist (valgfritt)'), registration.getByLabel('Gjenstående arbeid (valgfritt)'), registration.getByRole('button', { name: 'Legg til oppgave' })]) {
    await expect(control).toBeFocused(); const bounds = await control.evaluate(element => ({ bottom: element.getBoundingClientRect().bottom, navTop: document.querySelector('.view-actions').getBoundingClientRect().top })); expect(bounds.bottom).toBeLessThanOrEqual(bounds.navTop - 8); await page.keyboard.press('Tab')
  }
  await registration.getByLabel('Tittel').focus(); await registration.scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: 'artifacts/rule-text-exam-390-large-text.png', fullPage: true })
})

test('automated activation measurement compares text and ordinary journeys', async ({ page }, testInfo) => {
  await freeze(page, '2026-09-29T12:00:00+02:00'); await installState(page, { tasks: [baseTask('a')], courses: [course] })
  await page.evaluate(() => { window.activationCount = 0; document.addEventListener('click', event => { if (event.target.closest('button,summary')) window.activationCount++ }) })
  const count = () => page.evaluate(() => window.activationCount), registration = page.locator('#text-registration')
  let before = await count(); await registration.getByLabel('Skriv hva du vil legge til eller endre').fill('Ny oppgave: Tekstoppgave.'); await registration.getByRole('button', { name: 'Lag forslag' }).click(); await registration.getByRole('button', { name: 'Legg til oppgave' }).click(); const textCreate = await count() - before
  before = await count(); await page.locator('#new-task').click(); await page.locator('#title').fill('Skjemaoppgave'); await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click(); const formCreate = await count() - before
  before = await count(); await registration.getByLabel('Skriv hva du vil legge til eller endre').fill('Endre fristen på rapporten til 13. oktober'); await registration.getByRole('button', { name: 'Lag forslag' }).click(); await registration.getByRole('button', { name: 'Lagre endring' }).click(); const textChange = await count() - before
  await navigate(page, 'all'); const row = page.locator('#task-list > li').filter({ hasText: 'rapport' }).first(); before = await count(); await row.getByLabel('Flere handlinger «rapport»').click(); await row.getByRole('button', { name: /Rediger/ }).click(); await openTaskDetails(page); await page.locator('#deadlineDate').fill('2026-10-14'); await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click(); const formChange = await count() - before
  expect({ textCreate, formCreate, textChange, formChange }).toEqual({ textCreate: 2, formCreate: 2, textChange: 2, formChange: 3 })
  await testInfo.attach('activation-counts.json', { body: JSON.stringify({ textCreate, formCreate, textChange, formChange }, null, 2), contentType: 'application/json' })
})

test('a text receipt never undoes a newer unrelated edit and remains usable after normal undo', async ({ page }) => {
  await freeze(page, '2026-09-29T12:00:00+02:00'); await installState(page, { tasks: [baseTask('a')], courses: [course] })
  const registration = page.locator('#text-registration')
  await registration.getByLabel('Skriv hva du vil legge til eller endre').fill('Ny oppgave: Tekstoppgave.')
  await registration.getByRole('button', { name: 'Lag forslag' }).click(); await registration.getByRole('button', { name: 'Legg til oppgave' }).click()
  const receiptUndo = registration.getByRole('button', { name: 'Angre', exact: true })
  await page.locator('#new-task').click(); await page.locator('#title').fill('Nyere skjemaoppgave'); await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  await receiptUndo.click(); await expect(registration).toContainText('En nyere endring er lagret')
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).tasks.map(task => task.title)).toEqual(['rapport', 'Tekstoppgave', 'Nyere skjemaoppgave'])
  await expect(receiptUndo).toBeVisible()
  await navigate(page, 'settings'); await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).tasks.map(task => task.title)).toEqual(['rapport', 'Tekstoppgave'])
  await navigate(page, 'overview'); await receiptUndo.click()
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).tasks.map(task => task.title)).toEqual(['rapport'])
})
