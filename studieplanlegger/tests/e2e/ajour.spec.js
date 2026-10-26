import { test, expect } from '@playwright/test'
import { freeze, instrumentWrites, navigate, openTaskDetails, reveal, saved, tabTo, writes } from './helpers.js'
import { openTpImport, preview, eventRows, openPreviewRow, tpCsvRows } from './tp-csv-helpers.js'

// Deliberately synthetic: no institution transport or user browser profile.
const state = {
  schemaVersion: 1, onboarding: { dismissed: true, completed: true },
  tasks: [
    { id: 'ajour-known', title: 'Syntetisk rapport om en lang og sammensatt problemstilling', course: 'SYN101', courseId: 'ajour-course', deadlineLocal: '2026-10-30T16:00', estimatedMinutes: 90, remainingMinutes: 60, completed: false, requiresSubmission: true, steps: [{ id: 'ajour-step', title: 'Skriv disposisjon', estimatedMinutes: 25, completed: false }] },
    { id: 'ajour-unknown', title: 'Syntetisk oppgave uten anslag', course: '', completed: false },
  ],
  sessions: [{ id: 'ajour-session', taskId: 'ajour-known', dateLocal: '2026-10-26', startTime: '13:00', endTime: '13:30' }],
  planner: { courses: [{ id: 'ajour-course', code: 'SYN101', name: 'Syntetisk metode og læring', university: 'Syntetisk lærested', semester: 'autumn', year: 2026, credits: 7.5, notes: '' }], sources: [], events: [
    { id: 'ajour-event', title: 'Syntetisk seminar', courseId: 'ajour-course', start: '2026-10-26T09:00:00Z', end: '2026-10-26T10:00:00Z', location: 'Syntetisk rom', notes: '' },
    { id: 'ajour-exam', title: 'Syntetisk eksamen', kind: 'exam', courseId: 'ajour-course', start: '2026-10-30T08:00:00Z', end: '2026-10-30T11:00:00Z', location: 'Syntetisk sal', notes: '' },
  ] },
}
async function boot(page, width, populated = true, fontSize = 16) {
  await page.setViewportSize({ width, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await freeze(page, '2026-10-26T09:00:00+01:00')
  await page.goto('/')
  if (populated) {
    await page.evaluate(data => localStorage.setItem('studieplanlegger:v1', JSON.stringify(data)), typeof populated === 'object' ? populated : state)
    await page.reload()
  }
  await instrumentWrites(page)
  await page.reload()
  await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` })
  await page.evaluate(() => document.fonts.ready)
}
async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function capture(page, info, name) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
  await page.screenshot({ path: info.outputPath(`${name}-viewport.png`) })
}

for (const [width, fontSize] of [[1440, 16], [900, 16], [390, 16], [390, 32]]) {
  test(`Ajour hierarchy, routes and local assets at ${width}px / ${fontSize}px text`, async ({ page }, info) => {
    const errors = [], external = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) external.push(request.url()) })
    await boot(page, width, true, fontSize)
    await expect(page).toHaveTitle('Ajour – Kom ajour.')
    await expect(page.locator('#ajour-heading')).toHaveText('Kom ajour.')
    await expect(page.locator('.ajour-tagline')).toHaveText('Planer endrer seg. Det er helt greit.')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(252, 250, 248)')
    await expect(page.locator('#dashboard-suggestions')).toContainText('Skriv disposisjon')
    await expect(page.locator('#next-plan')).toContainText('Syntetisk eksamen')
    const seminar = page.locator('[data-daily-row="event:ajour-event"]')
    await expect(seminar).toContainText('SYN101 Syntetisk metode og læring')
    await expect(seminar).toContainText('Syntetisk rom')
    await expect(seminar.getByRole('button')).toHaveAccessibleName(/Åpne Syntetisk seminar/)
    await expect(page.locator('[data-daily-row="event:ajour-exam"]').getByRole('button')).toHaveAccessibleName(/Åpne Syntetisk eksamen/)
    await expect(page.locator('#tasks-panel')).toBeHidden()
    await expect(page.locator('#calendar-panel')).toBeHidden()
    await expect(page.locator('#overview-summary')).toBeHidden()
    const positions = await page.evaluate(() => ['.view-actions', '#ajour-intro', '#focus-panel', '#next-plan'].map(s => document.querySelector(s).getBoundingClientRect().top))
    expect(positions.every((top, i) => !i || top >= positions[i - 1])).toBe(true)
    if (width > 760) {
      const upcoming = await page.locator('#next-plan').boundingBox(), replan = await page.locator('#daily-overview').boundingBox()
      expect(replan.x).toBeGreaterThan(upcoming.x)
      expect(Math.abs(replan.y - upcoming.y)).toBeLessThan(2)
    } else await expect(page.locator('.ajour-intro > img')).toBeHidden()
    const timeChoices = page.getByRole('group', { name: 'Hvor mye tid har du?', exact: true })
    await expect(timeChoices.locator('.quick-times')).toBeVisible()
    await expect(timeChoices.getByLabel('Egendefinert tid (minutter)')).toBeVisible()
    if (width === 900) {
      const heading = await page.locator('#focus-heading').evaluate(n => ({ height: n.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(n).lineHeight) }))
      expect(heading.height).toBeLessThanOrEqual(heading.lineHeight + 1)
      const legend = await timeChoices.locator('legend').boundingBox(), choices = await timeChoices.locator('.quick-times').boundingBox()
      expect(Math.abs(legend.x - choices.x)).toBeLessThan(2)
      expect(choices.y - legend.y - legend.height).toBeLessThan(50)
    }
    if (width === 390 && fontSize === 16) {
      expect((await page.locator('#ajour-intro').boundingBox()).height).toBeLessThan(85)
      expect((await page.locator('#dashboard-suggestions .task-primary').boundingBox()).y).toBeLessThan(650)
      for (const control of await timeChoices.locator('button:not([hidden]), input').all()) expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44)
    }
    if (fontSize === 16) expect((await page.locator('#dashboard-suggestions .task-primary').boundingBox()).y).toBeLessThan(1000)
    await fits(page)
    await capture(page, info, `ajour-overview-${width}-${fontSize}`)
    expect(await writes(page)).toEqual([])
    expect(await saved(page)).toEqual(state)
    for (const path of ['/brand/wordmark.svg', '/brand/notebook.svg', '/brand/companion.svg', '/favicon.svg']) {
      const response = await page.request.get(path)
      expect(response.ok()).toBe(true)
      expect(response.headers()['content-type']).toContain('image/svg+xml')
    }
    await page.locator('[data-daily-key="navigation:calendar"]').click()
    await expect(page.locator('#full-calendar')).toBeVisible()
    const viewport = await page.locator('.full-calendar-viewport').boundingBox()
    expect(viewport.height).toBeGreaterThanOrEqual(240)
    expect(viewport.height).toBeLessThanOrEqual(1000)
    if (fontSize === 32) {
      const visibleTimeline = await page.locator('.full-calendar-viewport').evaluate(element => {
        const bounds = element.getBoundingClientRect(), day = element.querySelector('.calendar-time-day')
        return Math.min(bounds.bottom, innerHeight) - Math.max(bounds.top, day.querySelector('h3').getBoundingClientRect().bottom, day.querySelector('.calendar-points').getBoundingClientRect().bottom)
      })
      expect(visibleTimeline).toBeGreaterThanOrEqual(120)
      const event = page.locator('.calendar-readable-content [data-calendar-key="event:ajour-event"]')
      await tabTo(page, event)
      await page.clock.runFor(300)
      const before = await saved(page), beforeWrites = await writes(page)
      await page.keyboard.press('Enter')
      const details = page.locator('.calendar-details')
      await expect(details).toBeVisible()
      await expect(details).toContainText('Syntetisk seminar')
      await expect(details).toContainText('Faktisk varighet: 60 minutter')
      await expect(details.getByRole('button', { name: 'Lukk detaljer' })).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(details).toBeHidden()
      await expect(event).toBeFocused()
      expect(await saved(page)).toEqual(before)
      expect(await writes(page)).toEqual(beforeWrites)
      for (const key of ['tasks', 'sessions', 'planner']) expect(before[key]).toEqual(state[key])
    }
    await fits(page)
    await capture(page, info, `ajour-calendar-${width}-${fontSize}`)
    await navigate(page, 'overview')
    await page.locator('[data-daily-key="navigation:tasks"]').click()
    await expect(page.locator('#task-list [data-task-id="ajour-unknown"]')).toContainText(/ukjent/i)
    await fits(page)
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })
}

test('empty Ajour captures only a title and preserves a draft, focus and disclosure through refresh', async ({ page }, info) => {
  await boot(page, 390, false)
  await expect(page.locator('#connected-onboarding')).toBeVisible()
  await expect(page.locator('#focus-panel')).toBeHidden()
  await expect(page.locator('#connected-onboarding')).toContainText('En tittel er nok.')
  await expect(page.locator('#connected-onboarding')).toContainText('Import er valgfritt.')
  const onboardingControls = await page.locator('.onboarding-actions > button').all()
  for (let i = 1; i < onboardingControls.length; i++) {
    const previous = await onboardingControls[i - 1].boundingBox(), current = await onboardingControls[i].boundingBox()
    expect(current.y >= previous.y + previous.height + 8 || current.x >= previous.x + previous.width + 8).toBe(true)
  }
  await capture(page, info, 'ajour-empty-mobile')
  await page.getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
  await page.locator('#title').fill('Syntetisk oppgave med bare tittel')
  await openTaskDetails(page)
  await page.locator('#title').focus()
  await page.locator('#title').evaluate(input => input.setSelectionRange(10, 17))
  const scroll = await page.locator('dialog[open]').evaluate(dialog => dialog.scrollTop)
  await page.clock.runFor(2100)
  await expect(page.locator('#title')).toBeFocused()
  await expect(page.locator('#title')).toHaveValue('Syntetisk oppgave med bare tittel')
  await expect(page.locator('#task-form .task-optional-details')).toHaveAttribute('open', '')
  expect(await page.locator('#title').evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([10, 17])
  expect(await page.locator('dialog[open]').evaluate(dialog => dialog.scrollTop)).toBe(scroll)
  expect(await writes(page)).toEqual([])
  await page.locator('#task-form button[type=submit]').click()
  const data = await saved(page)
  expect(data.tasks).toHaveLength(1)
  expect(data.tasks[0]).toMatchObject({ title: 'Syntetisk oppgave med bare tittel', completed: false })
  expect(data.tasks[0].estimatedMinutes ?? null).toBeNull()
  expect(data.tasks[0].deadlineLocal || '').toBe('')
  expect(data.tasks[0].remainingMinutes ?? null).toBeNull()
  await page.reload()
  expect((await saved(page)).tasks).toEqual(data.tasks)
  const disclosure = page.locator('.text-registration-disclosure')
  await expect(disclosure).toHaveJSProperty('open', false)
  await disclosure.locator(':scope > summary').click()
  const command = disclosure.getByLabel('Skriv hva du vil legge til eller endre')
  await command.fill('Syntetisk utkast som ikke skal lagres ennå')
  await page.clock.runFor(1200)
  await expect(command).toBeFocused()
  await navigate(page, 'all')
  await navigate(page, 'overview')
  await expect(disclosure).toHaveJSProperty('open', true)
  await expect(command).toHaveValue('Syntetisk utkast som ikke skal lagres ennå')
  expect((await saved(page)).tasks).toEqual(data.tasks)
  await fits(page)
})

test('onboarding preserves the plan opener and explicit Back until saved progress changes', async ({ page }) => {
  await boot(page, 390, false)
  const onboarding = page.locator('#connected-onboarding')
  await onboarding.getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
  await page.locator('#title').fill('Syntetisk oppstartsoppgave')
  await page.locator('#task-form button[type=submit]').click()
  await expect(onboarding).toContainText('STEG 3 AV 3')
  const before = await saved(page), beforeWrites = await writes(page)
  const trigger = onboarding.getByRole('button', { name: 'Se planforslag', exact: true }), original = await trigger.elementHandle()
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.replanning-preview')).toBeVisible()
  await page.clock.runFor(2100)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect(await original.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true)
  for (const step of [2, 1]) {
    await onboarding.getByRole('button', { name: 'Tilbake', exact: true }).click()
    await page.clock.runFor(2100)
    await expect(onboarding).toContainText(`STEG ${step} AV 3`)
  }
  await onboarding.getByRole('button', { name: 'Rediger oppgaven', exact: true }).click()
  await expect(page.locator('#title')).toHaveValue('Syntetisk oppstartsoppgave')
  await page.keyboard.press('Escape')
  await expect(onboarding).toContainText('STEG 2 AV 3')
  await onboarding.getByRole('button', { name: 'Neste', exact: true }).click()
  await expect(onboarding).toContainText('STEG 3 AV 3')
  expect(await saved(page)).toEqual(before)
  expect(await writes(page)).toEqual(beforeWrites)
})

test('daily rows retain the fourth task session and only deduplicate visible task deadlines', async ({ page }) => {
  const initial = structuredClone(state)
  initial.planner.events = []
  initial.tasks = Array.from({ length: 5 }, (_, index) => ({ id: `daily-task-${index + 1}`, title: `Syntetisk oppgave nummer ${index + 1}`, course: 'SYN101', courseId: 'ajour-course', deadlineLocal: `2026-10-${index < 4 ? '26' : '27'}T${10 + index}:00`, estimatedMinutes: 30, completed: false }))
  initial.sessions = initial.tasks.slice(0, 4).map((task, index) => ({ id: `daily-session-${index + 1}`, taskId: task.id, dateLocal: '2026-10-26', startTime: `${14 + index}:00`, endTime: `${14 + index}:30` }))
  await boot(page, 900, initial)
  const plan = page.locator('#next-plan')
  await expect(plan.locator('.daily-task')).toHaveCount(3)
  for (const index of [1, 2, 3]) {
    await expect(plan.locator(`[data-daily-row="task:daily-task-${index}"]`)).toContainText(`i dag kl. ${13 + index}:00–${13 + index}:30`)
    await expect(plan.locator(`[data-daily-row="session:daily-session-${index}"]`)).toHaveCount(0)
    await expect(plan.locator(`[data-daily-key="deadline:daily-task-${index}:open"]`)).toHaveCount(0)
  }
  const fourth = plan.locator('[data-daily-row="session:daily-session-4"]')
  await expect(fourth).toContainText('Studieøkt: Syntetisk oppgave nummer 4')
  await expect(fourth).toContainText('17:00–17:30')
  await expect(fourth).toContainText('SYN101 Syntetisk metode og læring')
  await expect(fourth.getByRole('button')).toHaveAccessibleName(/Åpne Studieøkt: Syntetisk oppgave nummer 4/)
  await expect(plan.getByText('Ingen kommende aktivitet er registrert.')).toHaveCount(0)
  await expect(plan.locator('.deadline-row')).toHaveCount(2)
  for (const index of [4, 5]) await expect(plan.getByRole('button', { name: `Åpne fristen for Syntetisk oppgave nummer ${index}`, exact: true })).toBeVisible()
  expect(await saved(page)).toEqual(initial)
  expect(await writes(page)).toEqual([])
})

test('sessions inside visible task rows prevent the no-activity message', async ({ page }) => {
  const initial = structuredClone(state)
  initial.planner.events = []
  await boot(page, 390, initial)
  await expect(page.locator('#next-plan .daily-task')).toContainText('Neste aktivitet: i dag kl. 13:00–13:30')
  await expect(page.locator('#next-plan').getByText('Ingen kommende aktivitet er registrert.')).toHaveCount(0)
  expect(await writes(page)).toEqual([])
})

for (const scenario of ['good', 'unknown']) {
test(`Ajour replanning from ${scenario} status opens an honest write-free preview and returns keyboard focus`, async ({ page }) => {
  const initial = structuredClone(state)
  initial.sessions = []
  if (scenario === 'good') {
    initial.tasks = [initial.tasks[0]]
    initial.workWindows = [{ id: 'ajour-work', start: '2026-10-26T11:00:00Z', end: '2026-10-26T15:00:00Z' }]
  } else initial.tasks = [initial.tasks[1]]
  await boot(page, 900, initial)
  const status = page.locator('#daily-overview .daily-status')
  await expect(status).toHaveClass(scenario === 'good' ? 'daily-status is-good' : 'daily-status is-neutral')
  await expect(status).toContainText(scenario === 'good' ? 'Planen går opp' : 'Kan ikke vurderes ennå. Gjenstående arbeid er ukjent.')
  expect((await status.textContent()).split(initial.tasks[0].title)).toHaveLength(2)
  const before = await saved(page), trigger = page.locator('#daily-overview > button')
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('dialog[open]')).toBeVisible()
  expect(await saved(page)).toEqual(before)
  expect(await writes(page)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveCSS('outline-style', 'solid')
  expect(await saved(page)).toEqual(before)
  expect(await writes(page)).toEqual([])
})
}

test('nonzero overview reminders follow the primary card and focus actual ready and overdue tasks without writes', async ({ page }, info) => {
  const initial = structuredClone(state)
  initial.tasks.push(
    { id: 'ajour-ready', title: 'Syntetisk levering uten frist', course: '', completed: true, requiresSubmission: true, submitted: false },
    { id: 'ajour-overdue', title: 'Syntetisk forfalt oppgave', course: '', completed: false, deadlineLocal: '2026-10-25T16:00', estimatedMinutes: 30 },
    { id: 'ajour-submitted', title: 'Syntetisk levert oppgave', course: '', completed: true, requiresSubmission: true, submitted: true },
  )
  await boot(page, 390, initial)
  const summary = page.locator('#overview-summary'), focus = page.locator('#focus-panel')
  await expect(summary).toBeVisible()
  const reminder = page.locator('#delivery-reminders'), start = page.locator('#dashboard-suggestions .primary-suggestion .task-primary')
  expect((await reminder.boundingBox()).y).toBeGreaterThan((await start.boundingBox()).y + (await start.boundingBox()).height)
  await expect(reminder).toContainText('Klar til levering')
  await expect(reminder).not.toContainText('Syntetisk levert oppgave')
  await expect(reminder.getByRole('button')).toHaveText('Syntetisk levering uten frist')
  expect(await reminder.getByRole('button').evaluate(n => getComputedStyle(n).backgroundColor)).not.toBe(await start.evaluate(n => getComputedStyle(n).backgroundColor))
  expect((await summary.boundingBox()).y).toBeGreaterThanOrEqual((await focus.boundingBox()).y + (await focus.boundingBox()).height)
  expect((await summary.boundingBox()).height).toBeLessThanOrEqual(60)
  await expect(page.locator('#summary-week')).toBeHidden()
  await capture(page, info, 'ajour-flagged-mobile')
  for (const [kind, id, label] of [['ready', 'ajour-ready', 'Til levering'], ['overdue', 'ajour-overdue', 'Forfalt']]) {
    const shortcut = page.locator(`#summary-${kind}`)
    await expect(shortcut.locator('strong')).toHaveText('1')
    await expect(shortcut.locator('span:last-child')).toHaveText(label)
    expect((await shortcut.boundingBox()).height).toBeGreaterThanOrEqual(44)
    await shortcut.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#view-all')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(`#task-list [data-task-id="${id}"] .task-primary`)).toBeFocused()
    await expect(page.locator(`#task-list [data-task-id="${id}"]`)).toBeVisible()
    expect(await saved(page)).toEqual(initial)
    expect(await writes(page)).toEqual([])
    await navigate(page, 'overview')
  }
  await fits(page)
})

test('mobile Mer visibly and accessibly identifies each selected secondary route and clears on ordinary navigation', async ({ page }) => {
  await boot(page, 390)
  const more = page.locator('#mobile-navigation-more')
  for (const [route, label] of [['capacity', 'Planlegg uken'], ['settings', 'Innstillinger']]) {
    await navigate(page, route, { keyboard: true })
    await expect(more).toHaveAccessibleName(`Mer – ${label} er valgt`)
    await expect(more).toHaveAttribute('data-active-route', '')
    await expect(more).toHaveAttribute('aria-expanded', 'false')
    await expect(more).toHaveAttribute('aria-controls', 'navigation-secondary')
    expect(await more.getAttribute('aria-pressed')).toBeNull()
    expect(await more.evaluate(element => {
      const marker = getComputedStyle(element, '::after')
      return marker.display !== 'none' && marker.transform === 'none' && Number.parseFloat(marker.height) >= 3 && marker.backgroundColor !== 'rgba(0, 0, 0, 0)'
    })).toBe(true)
    await more.press('Enter')
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator(`#view-${route}`)).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await expect(more).toBeFocused()
    await navigate(page, 'all', { keyboard: true })
    await expect(more).toHaveAccessibleName('Mer')
    await expect(more).not.toHaveAttribute('data-active-route')
    expect(await more.evaluate(element => getComputedStyle(element, '::after').display)).toBe('none')
  }
  expect(await saved(page)).toEqual(state)
  expect(await writes(page)).toEqual([])
})

test('suggestion explanation opens by keyboard and retains visible reason, open state and focus through refresh without writes', async ({ page }) => {
  await boot(page, 900)
  const details = page.locator('#dashboard-suggestions .suggestion-explanation'), summary = details.locator(':scope > summary')
  const reason = details.locator('.suggestion-reason')
  await expect(details).toHaveJSProperty('open', false)
  await expect(reason).toBeHidden()
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(details).toHaveJSProperty('open', true)
  await expect(reason).toBeVisible()
  await expect(reason).toContainText('Skriv disposisjon')
  const explanation = await reason.textContent()
  await page.clock.runFor(2100)
  await expect(summary).toBeFocused()
  await expect(details).toHaveJSProperty('open', true)
  await expect(reason).toBeVisible()
  await expect(reason).toHaveText(explanation)
  expect(await saved(page)).toEqual(state)
  expect(await writes(page)).toEqual([])
})

for (const kind of ['task', 'course', 'session', 'step']) {
test(`390px / 200% ${kind} dialog scrolls every control above its visible actions and preserves the draft`, async ({ page }, info) => {
  await boot(page, 390, true, 32)
  await page.setViewportSize({ width: 390, height: 844 })
  let opener, form
  if (kind === 'course') {
    await navigate(page, 'subjects'); opener = page.locator('#course-new'); form = page.locator('#subject-editor')
  } else if (kind === 'session') {
    await navigate(page, 'capacity'); opener = page.locator('#new-session'); form = page.locator('#session-form')
  } else {
    await navigate(page, 'all')
    if (kind === 'task') { opener = page.locator('#new-task'); form = page.locator('#task-form') }
    else {
      const row = page.locator('#task-list [data-task-id="ajour-unknown"]')
      await row.locator('.task-menu > summary').click()
      opener = row.getByRole('button', { name: /Legg til neste steg/ }); form = page.locator('#step-form')
    }
  }
  await opener.click()
  const dialog = page.locator('dialog[open]')
  await expect(form).toBeVisible()
  if (kind === 'task') {
    await page.locator('#title').fill('Syntetisk utkast med æ, ø og å')
    for (const details of await form.locator('details').all()) {
      if (!await details.evaluate(n => n.open)) await details.locator(':scope > summary').click()
    }
  } else if (kind === 'course') await form.locator('[name=name]').fill('Syntetisk emneutkast')
  else if (kind === 'step') await page.locator('#step-description').fill('Syntetisk arbeidssteg')
  const expected = await form.evaluate(form => {
    const controls = [...form.querySelectorAll('input:not([type=hidden]), select, textarea, button, summary')].filter(n => !n.disabled && n.checkVisibility())
    controls.forEach((n, i) => n.dataset.reachabilityCheck = String(i))
    controls[0].focus()
    return controls.map(n => n.dataset.reachabilityCheck)
  })
  const values = await form.evaluate(form => [...form.querySelectorAll('input, select, textarea')].map(n => [n.name, n.value, n.checked]))
  const seen = new Set(), scrollPositions = []
  for (let i = 0; i < expected.length * 5; i++) {
    const observation = await dialog.evaluate(dialog => {
      const active = document.activeElement, footer = dialog.querySelector('form > .actions'), bounds = active.getBoundingClientRect(), area = dialog.getBoundingClientRect(), actions = footer.getBoundingClientRect()
      return { key: active.dataset.reachabilityCheck, top: bounds.top, bottom: bounds.bottom, start: area.top + 1, end: footer.contains(active) ? area.bottom - 1 : actions.top, scroll: dialog.scrollTop, actions: [...footer.querySelectorAll('button')].map(n => ({ top: n.getBoundingClientRect().top, bottom: n.getBoundingClientRect().bottom })), viewport: innerHeight }
    })
    expect(observation.key).toBeDefined()
    expect(observation.top, `${kind} control ${observation.key} above dialog`).toBeGreaterThanOrEqual(observation.start - 1)
    expect(observation.bottom, `${kind} control ${observation.key} covered by footer`).toBeLessThanOrEqual(observation.end + 1)
    for (const action of observation.actions) { expect(action.top).toBeGreaterThanOrEqual(0); expect(action.bottom).toBeLessThanOrEqual(observation.viewport) }
    seen.add(observation.key); scrollPositions.push(observation.scroll)
    if (seen.size === expected.length) break
    await page.keyboard.press('Tab')
  }
  expect([...seen].sort()).toEqual(expected.sort())
  if (kind !== 'step') {
    expect(await dialog.evaluate(n => n.scrollHeight > n.clientHeight)).toBe(true)
    expect(Math.max(...scrollPositions) - Math.min(...scrollPositions)).toBeGreaterThan(50)
  }
  const before = await dialog.evaluate(n => ({ scroll: n.scrollTop, focus: document.activeElement.dataset.reachabilityCheck, opened: [...n.querySelectorAll('details')].map(d => d.open) }))
  await page.clock.runFor(2100)
  expect(await form.evaluate(form => [...form.querySelectorAll('input, select, textarea')].map(n => [n.name, n.value, n.checked]))).toEqual(values)
  expect(await dialog.evaluate(n => ({ scroll: n.scrollTop, focus: document.activeElement.dataset.reachabilityCheck, opened: [...n.querySelectorAll('details')].map(d => d.open) }))).toEqual(before)
  await page.screenshot({ path: info.outputPath(`${kind}-dialog-390-text200.png`) })
  await form.getByRole('button', { name: 'Avbryt', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  expect(await saved(page)).toEqual(state)
  expect(await writes(page)).toEqual([])
})
}

for (const [width, fontSize] of [[1440, 16], [900, 16], [390, 32]]) {
for (const kind of ['empty', 'flagged']) {
test(`Ajour ${kind} actions and visual evidence at ${width}px / ${fontSize}px text`, async ({ page }, info) => {
  const initial = structuredClone(state)
  initial.tasks.push(
    { id: 'ajour-ready', title: 'Syntetisk levering uten frist', course: '', completed: true, requiresSubmission: true, submitted: false },
    { id: 'ajour-overdue', title: 'Syntetisk forfalt oppgave', course: '', completed: false, deadlineLocal: '2026-10-25T16:00', estimatedMinutes: 30 },
  )
  await boot(page, width, kind === 'empty' ? false : initial, fontSize)
  if (width === 390) await page.setViewportSize({ width, height: 844 })
  await fits(page)
  await capture(page, info, `ajour-${kind}-${width}-${fontSize}`)
  if (kind === 'empty') {
    await page.locator('#connected-onboarding').getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
    await expect(page.locator('#title')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('#connected-onboarding').getByRole('button', { name: 'Ny oppgave', exact: true })).toBeFocused()
  } else {
    await page.locator('#delivery-reminders').getByRole('button', { name: 'Syntetisk levering uten frist', exact: true }).click()
    await expect(page.locator('#title')).toHaveValue('Syntetisk levering uten frist')
    await page.keyboard.press('Escape')
    await expect(page.locator('#delivery-reminders').getByRole('button')).toBeFocused()
    expect(await saved(page)).toEqual(initial)
  }
  expect(await writes(page)).toEqual([])
})
}
}

for (const scenario of ['events-only', 'courses-only', 'completed-only', 'ready-only']) {
test(`Ajour ${scenario} status offers an existing next action without writing on open`, async ({ page }) => {
  const initial = structuredClone(state)
  initial.tasks = []
  initial.sessions = []
  if (scenario !== 'events-only') initial.planner.events = []
  if (scenario === 'completed-only' || scenario === 'ready-only') initial.tasks = [{ ...state.tasks[0], completed: true, requiresSubmission: scenario === 'ready-only', submitted: false }]
  await boot(page, 900, initial)
  const trigger = page.locator('#daily-overview > button'), original = await trigger.elementHandle()
  await expect(trigger).toHaveText(scenario === 'ready-only' ? 'Se oppgaver til levering' : 'Legg til oppgave')
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.replanning-preview')).toBeHidden()
  if (scenario === 'ready-only') {
    await expect(page.locator('#view-all')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#task-list [data-task-id="ajour-known"] .task-primary')).toBeFocused()
    await expect(page.locator('#task-list [data-task-id="ajour-known"] .task-primary')).toHaveText('Bekreft levert')
    await navigate(page, 'overview')
  } else {
    await expect(page.locator('#task-form')).toBeVisible()
    await expect(page.locator('#title')).toHaveValue('')
    await page.clock.runFor(2100)
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  }
  expect(await original.evaluate(node => node.isConnected)).toBe(true)
  expect(await saved(page)).toEqual(initial)
  expect(await writes(page)).toEqual([])
})
}

test('short calendar markers have nontext contrast while preserving five-minute geometry', async ({ page }) => {
  const initial = structuredClone(state)
  initial.planner.events = [{ id: 'ajour-short', title: 'Syntetisk femminuttersaktivitet', courseId: 'ajour-course', start: '2026-10-26T09:15:00Z', end: '2026-10-26T09:20:00Z', location: 'Syntetisk rom' }]
  await boot(page, 900, initial)
  await navigate(page, 'calendar')
  const marker = page.locator('[data-calendar-geometry="event:ajour-short"]')
  await expect(marker).toHaveClass(/entry-teaching/)
  expect((await marker.boundingBox()).height).toBe(5)
  const measured = await marker.evaluate(element => {
    const rgb = value => {
      const match = value.match(/^rgb\((\d+), (\d+), (\d+)\)$/)
      if (!match) throw new Error(`Expected opaque RGB paint, got ${value}`)
      return match.slice(1).map(Number)
    }
    const style = getComputedStyle(element)
    if (style.backgroundImage !== 'none' || style.opacity !== '1') throw new Error('Expected a solid duration marker')
    let background
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const paint = getComputedStyle(ancestor).backgroundColor
      if (paint !== 'rgba(0, 0, 0, 0)') { background = rgb(paint); break }
    }
    if (!background) throw new Error('Missing rendered calendar surface')
    const luminance = channels => channels.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
    const front = luminance(rgb(style.backgroundColor)), back = luminance(background)
    return { ratio: (Math.max(front, back) + .05) / (Math.min(front, back) + .05), minuteOffset: parseFloat(element.style.top) % 60 }
  })
  // The five-minute marker sits between the timeline's hourly grid lines.
  expect(measured.minuteOffset).toBe(15)
  expect(measured.ratio).toBeGreaterThanOrEqual(3)
  await page.clock.runFor(300)
  const before = await saved(page), beforeWrites = await writes(page)
  const event = page.locator('.calendar-readable-content [data-calendar-key="event:ajour-short"]')
  await event.click()
  await expect(page.locator('.calendar-details')).toContainText('10:15–10:20')
  await expect(page.locator('.calendar-details')).toContainText('Faktisk varighet: 5 minutter')
  expect(await saved(page)).toEqual(before)
  expect(await writes(page)).toEqual(beforeWrites)
  for (const key of ['tasks', 'sessions', 'planner']) expect(before[key]).toEqual(initial[key])
})

for (const [width, fontSize] of [[1440, 16], [900, 16], [390, 16], [390, 32]]) {
test(`Ajour import preview, explicit time choice and reachable approval at ${width}px / ${fontSize}px text`, async ({ page }, info) => {
  await boot(page, width, true, fontSize)
  if (width === 390) await page.setViewportSize({ width, height: 844 })
  const text = tpCsvRows(Array.from({ length: 8 }, (_, i) => ({ uid: `synthetic-ajour-followup-${i}`, summary: `Syntetisk seminar med lang norsk beskrivelse ${i + 1}`, courseid: 'SYN962', coursename: 'Syntetisk kildevurdering', university: 'HiMolde', year: '2041', semester: 'autumn', dtstart: `2041-11-${String(i + 1).padStart(2, '0')}T11:00:07+01:00`, dtend: i === 0 ? '' : `2041-11-${String(i + 1).padStart(2, '0')}T12:00:17+01:00`, sourceobjectid: '', campuscode: '', activitytype: 'Seminar', studentgroups: 'Syntetisk gruppe' })))
  await openTpImport(page, { text, name: 'synthetic-ajour-followup.csv' })
  await (await reveal(preview(page).getByRole('button', { name: 'Velg alle aktiviteter', exact: true }))).click()
  const first = eventRows(page).first()
  await openPreviewRow(first)
  const choice = first.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true })
  await choice.selectOption('point')
  const confirm = preview(page).getByRole('button', { name: 'Importer valgte', exact: true })
  await tabTo(page, confirm, 'Shift+Tab')
  const bounds = await confirm.boundingBox()
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height)
  await fits(page)
  await capture(page, info, `ajour-import-${width}-${fontSize}`)
  expect(await writes(page)).toEqual([])
  expect(await saved(page)).toEqual(state)
  await page.keyboard.press('Enter')
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const data = await saved(page)
  expect(data.planner.events).toHaveLength(state.planner.events.length + 8)
  expect(data.planner.events.find(e => e.title === 'Syntetisk seminar med lang norsk beskrivelse 1').point).toBe(true)
  await page.reload()
  expect((await saved(page)).planner).toEqual(data.planner)
})
}
