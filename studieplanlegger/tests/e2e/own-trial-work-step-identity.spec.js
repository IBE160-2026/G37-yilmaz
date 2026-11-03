import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { freeze, key, navigate, openMenu, reveal, row, saved } from './helpers.js'

// Synthetic regression fixtures and a frozen clock, separate from the real-time
// seven-scenario production-build trial. Only initial setup writes fixture storage;
// every action under test uses the UI in fresh Playwright BrowserContexts.
const now = '2026-11-02T12:00:00+01:00'
const title = 'Syntetisk arbeid med to steg'
const first = { id: 'synthetic-step-a', title: 'Les første syntetiske del', estimatedMinutes: 60, completed: false }
const second = { id: 'synthetic-step-b', title: 'Skriv andre syntetiske del', estimatedMinutes: 20, completed: false }
const task = {
  id: 'synthetic-step-task', title, course: '', deadlineLocal: '2026-11-05T16:00',
  estimatedMinutes: null, remainingMinutes: 60, completed: false,
  requiresSubmission: true, submitted: false, steps: [first, second],
}
const other = {
  id: 'synthetic-other-task', title: 'Syntetisk uavhengig oppgave', course: '',
  deadlineLocal: '', estimatedMinutes: null, remainingMinutes: 30, completed: false,
}
const otherSession = {
  id: 'synthetic-other-session', taskId: other.id,
  dateLocal: '2026-11-03', startTime: '11:00', endTime: '11:30',
}
const fixture = (patch = {}) => ({
  schemaVersion: 1, tasks: [{ ...task, ...patch }, other], sessions: [otherSession], workLogs: [],
  workWindows: [{ id: 'synthetic-step-window', start: '2026-11-03T09:00:00Z', end: '2026-11-03T11:00:00Z' }],
  busyWindows: [], planner: { courses: [], events: [], sources: [] },
  planningPreferences: { minimumMinutes: 15, sessionMinutes: 30, maximumMinutes: 30, breakMinutes: 10 },
  onboarding: { dismissed: true, completed: true },
})

async function boot(page, state) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await freeze(page, now)
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload()
}

async function startOutcome(page, heading) {
  await navigate(page, 'overview')
  await page.getByRole('button', { name: '30 min', exact: true }).click()
  await page.locator('#dashboard-suggestions').getByRole('button', { name: `Start «${title}»`, exact: true }).click()
  const session = page.getByRole('dialog', { name: heading, exact: true })
  await expect(session).toBeVisible()
  await session.getByRole('button', { name: 'Start økten', exact: true }).click()
  await session.getByRole('button', { name: 'Avslutt økten', exact: true }).click()
  return page.getByRole('dialog', { name: 'Hva skjedde?', exact: true })
}

async function more(dialog) {
  await dialog.getByRole('radio', { name: 'Trenger mer tid', exact: true }).check()
  await dialog.getByLabel('Faktisk arbeidstid (minutter, valgfritt)', { exact: true }).fill('30')
  await dialog.locator('[name=remainingChoice]').selectOption('exact')
  await dialog.locator('[name=remainingMinutes]').fill('75')
  await dialog.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  await expect(dialog).not.toBeVisible()
}

async function steps(page) {
  await navigate(page, 'all')
  await openMenu(page, title)
  await row(page, title).getByRole('button', { name: `Administrer arbeidssteg «${title}»`, exact: true }).click()
  return page.getByRole('dialog', { name: `Arbeidssteg · ${title}`, exact: true })
}

async function exportFile(page) {
  await navigate(page, 'settings')
  const download = page.waitForEvent('download')
  await (await reveal(page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }))).click()
  return readFile(await (await download).path())
}

test('finishing a named unblocking step releases the wait, preserves its snapshot and can be undone after reload', async ({ page }) => {
  const initial = fixture({ waitingReason: 'Avklar den syntetiske oppgaven',
    steps: [{ ...first, estimatedMinutes: 10, unblocksWaiting: true }, second] })
  await boot(page, initial)
  const outcome = await startOutcome(page, first.title)
  await expect(outcome.getByText(`Arbeidssteg: ${first.title}`, { exact: true })).toBeVisible()
  await outcome.getByRole('radio', { name: 'Utført', exact: true }).check()
  await outcome.getByLabel('Faktisk arbeidstid (minutter, valgfritt)', { exact: true }).fill('10')
  await outcome.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  await expect(outcome).not.toBeVisible()
  const completed = await saved(page)
  expect(completed.tasks[0]).toMatchObject({ waitingReason: '', remainingMinutes: 60, completed: false, submitted: false })
  expect(completed.tasks[0].steps).toEqual([{ ...initial.tasks[0].steps[0], completed: true }, second])
  expect(completed.workLogs[0]).toMatchObject({ stepId: first.id, stepCompleted: true, taskCompleted: false,
    actualMinutes: 10, taskSnapshot: initial.tasks[0] })
  expect(completed.sessions).toEqual(initial.sessions)
  await expect(page.locator('#dashboard-suggestions')).toContainText(second.title)
  await expect(page.locator('#dashboard-suggestions').getByRole('button', { name: `Start «${title}»`, exact: true })).toBeEnabled()
  await page.reload()
  expect(await saved(page)).toEqual(completed)
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const undone = await saved(page)
  expect(undone.tasks).toEqual(initial.tasks)
  expect(undone.workLogs).toEqual(initial.workLogs)
  expect(undone.sessions).toEqual(initial.sessions)
  await navigate(page, 'overview')
  await expect(page.locator('#dashboard-suggestions')).toContainText(first.title)
  await page.reload()
  expect(await saved(page)).toEqual(undone)
})

test('the step manager resolves waiting only after saving completion and cancellation and undo preserve the original wait', async ({ page }) => {
  const initial = fixture({ waitingReason: 'Avklar den syntetiske oppgaven',
    steps: [{ ...first, unblocksWaiting: true }, second] })
  await boot(page, initial)
  let editor = await steps(page)
  await editor.locator(`[data-step-id="${first.id}"]`).getByRole('button', { name: 'Marker fullført', exact: true }).click()
  expect(await saved(page)).toEqual(initial)
  await editor.getByRole('button', { name: 'Avbryt', exact: true }).click()
  expect(await saved(page)).toEqual(initial)
  editor = await steps(page)
  await editor.locator(`[data-step-id="${first.id}"]`).getByRole('button', { name: 'Marker fullført', exact: true }).click()
  await editor.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  const completed = await saved(page)
  expect(completed.tasks[0]).toMatchObject({ waitingReason: '', remainingMinutes: 60, completed: false, submitted: false })
  expect(completed.tasks[0].steps).toEqual([{ ...initial.tasks[0].steps[0], completed: true }, second])
  expect(completed.workLogs).toEqual(initial.workLogs)
  expect(completed.sessions).toEqual(initial.sessions)
  await navigate(page, 'overview')
  await expect(page.locator('#dashboard-suggestions')).toContainText(second.title)
  await page.reload()
  expect(await saved(page)).toEqual(completed)
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const undone = await saved(page)
  expect(undone.tasks).toEqual(initial.tasks)
  expect(undone.workLogs).toEqual(initial.workLogs)
  expect(undone.sessions).toEqual(initial.sessions)
})

test('named step identity survives replan undo, equal titles, reorder, removal and fresh-context backup restore', async ({ page, browser }, info) => {
  const initial = fixture()
  await boot(page, initial)
  let outcome = await startOutcome(page, first.title)
  await expect(outcome.getByText(`Arbeidssteg: ${first.title}`, { exact: true })).toBeVisible()
  await expect(outcome.getByRole('combobox', { name: 'Gjenstående arbeid for hele oppgaven', exact: true })).toBeVisible()
  expect(await saved(page)).toEqual(initial)
  await outcome.getByRole('radio', { name: 'Trenger mer tid', exact: true }).check()
  await outcome.locator('[name=actualMinutes]').fill('30')
  await outcome.locator('[name=remainingChoice]').selectOption('exact')
  await outcome.locator('[name=remainingMinutes]').fill('75')
  await page.screenshot({ path: info.outputPath('named-step-exact-remainder.png') })
  await outcome.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  const recorded = await saved(page)
  expect(recorded.tasks[0]).toMatchObject({ remainingMinutes: 75, completed: false, submitted: false, steps: initial.tasks[0].steps })
  expect(recorded.workLogs).toHaveLength(1)
  expect(recorded.workLogs[0]).toMatchObject({ taskId: task.id, stepId: first.id, actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 75, outcome: 'more' })
  expect(recorded.workLogs[0]).not.toHaveProperty('sessionId')
  expect(recorded.workLogs[0].taskSnapshot.steps).toEqual(initial.tasks[0].steps)

  // This remains task-level calendar planning; it must not invent step links.
  await navigate(page, 'all')
  await row(page, title).getByRole('button', { name: `Se planforslag «${title}»`, exact: true }).click()
  const plan = page.getByRole('dialog', { name: 'Planforslag for oppgaven', exact: true })
  await expect(plan.locator('.proposed-session-time').first()).toBeVisible()
  expect(await saved(page)).toEqual(recorded)
  await plan.getByRole('button', { name: 'Bruk planen', exact: true }).click()
  const planned = await saved(page)
  const taskSessions = planned.sessions.filter(session => session.taskId === task.id)
  expect(taskSessions.length).toBeGreaterThan(0)
  for (const session of taskSessions) expect(session).not.toHaveProperty('stepId')
  expect(planned.sessions.find(session => session.id === otherSession.id)).toEqual(otherSession)
  expect(planned.workLogs).toEqual(recorded.workLogs)
  await page.locator('.contextual-undo').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const undone = await saved(page)
  expect(undone.sessions).toEqual(recorded.sessions)
  expect(undone.tasks).toEqual(recorded.tasks)
  expect(undone.workLogs).toEqual(recorded.workLogs)

  let editor = await steps(page)
  const secondRow = editor.locator(`[data-step-id="${second.id}"]`)
  await secondRow.getByRole('textbox').fill(first.title)
  await secondRow.getByRole('button', { name: 'Flytt opp', exact: true }).click()
  await editor.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  expect((await saved(page)).tasks[0].steps.map(step => step.id)).toEqual([second.id, first.id])
  outcome = await startOutcome(page, first.title)
  await expect(outcome.getByText(`Arbeidssteg: ${first.title}`, { exact: true })).toBeVisible()
  await outcome.getByRole('radio', { name: 'Utført', exact: true }).check()
  await expect(outcome.getByLabel('Hele oppgaven er ferdig', { exact: true })).not.toBeChecked()
  await outcome.locator('[name=actualMinutes]').fill('20')
  await outcome.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  const stepDone = await saved(page)
  expect(stepDone.tasks[0]).toMatchObject({ completed: false, submitted: false, remainingMinutes: 75 })
  expect(stepDone.tasks[0].steps.find(step => step.id === second.id).completed).toBe(true)
  expect(stepDone.tasks[0].steps.find(step => step.id === first.id).completed).toBe(false)
  expect(stepDone.workLogs[1]).toMatchObject({ taskId: task.id, stepId: second.id, stepCompleted: true, outcome: 'done', actualMinutes: 20 })
  expect(stepDone.workLogs[0]).toEqual(recorded.workLogs[0])

  // Historical attribution must resolve against its snapshot even when the
  // current step is renamed or removed, not against today's first matching title.
  editor = await steps(page)
  await editor.locator(`[data-step-id="${first.id}"]`).getByRole('textbox').fill('Nytt syntetisk navn på første del')
  await editor.locator(`[data-step-id="${second.id}"]`).getByRole('button', { name: 'Fjern', exact: true }).click()
  await editor.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  const changed = await saved(page)
  expect(changed.workLogs).toEqual(stepDone.workLogs)
  expect(changed.tasks[0].steps.map(step => step.id)).toEqual([first.id])

  await openMenu(page, title)
  await row(page, title).getByRole('checkbox', { name: `Ferdig med arbeidet «${title}»`, exact: true }).check()
  expect((await saved(page)).tasks[0]).toMatchObject({ completed: true, submitted: false, remainingMinutes: 0 })
  expect((await saved(page)).workLogs.at(-1)).not.toHaveProperty('stepId')
  await row(page, title).getByRole('button', { name: `Bekreft levert «${title}»`, exact: true }).click()
  expect((await saved(page)).tasks[0].submitted).toBe(true)
  const buffer = await exportFile(page), portable = JSON.parse(buffer.toString()).data
  expect(portable.workLogs.slice(0, 2)).toEqual(stepDone.workLogs)
  expect(portable.sessions).toEqual([otherSession])
  await page.reload()
  expect(await saved(page)).toEqual(portable)

  const fresh = await browser.newContext({ baseURL: new URL(page.url()).origin, timezoneId: 'Europe/Oslo' })
  try {
    const restored = await fresh.newPage()
    await freeze(restored, now)
    await restored.goto('/')
    expect(await saved(restored)).toBeNull()
    await navigate(restored, 'settings')
    await restored.locator('#backup-file').setInputFiles({ name: 'synthetic-work-step-identity.json', mimeType: 'application/json', buffer })
    const preview = restored.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
    await expect(preview).toBeVisible()
    expect(await saved(restored)).toBeNull()
    await preview.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
    await restored.reload()
    expect(await saved(restored)).toEqual(portable)
    await navigate(restored, 'all')
    await expect(row(restored, title)).toContainText('Levert')
    const restoredEditor = await steps(restored)
    await expect(restoredEditor.locator('.work-step-list > li')).toHaveCount(1)
    await expect(restoredEditor.getByLabel('Navn på steg 1')).toHaveValue('Nytt syntetisk navn på første del')
    await restoredEditor.getByRole('button', { name: 'Avbryt', exact: true }).click()
    await restored.screenshot({ path: info.outputPath('restored-step-history.png'), fullPage: true })
  } finally { await fresh.close() }
})

test('named-step exact remainder replaces an earlier range and remains separate from actual work', async ({ page }) => {
  await boot(page, fixture({ remainingMinutes: null, remainingEstimate: { minMinutes: 60, maxMinutes: 120 } }))
  const outcome = await startOutcome(page, first.title)
  await expect(outcome.getByText(`Arbeidssteg: ${first.title}`, { exact: true })).toBeVisible()
  await more(outcome)
  const result = await saved(page)
  expect(result.tasks[0]).toMatchObject({ remainingMinutes: 75, completed: false, submitted: false })
  expect(result.tasks[0]).not.toHaveProperty('remainingEstimate')
  expect(result.workLogs[0]).toMatchObject({ stepId: first.id, outcome: 'more', actualMinutes: 30, remainingMinutes: 75 })
  expect(result.workLogs[0]).not.toHaveProperty('remainingEstimate')
  expect(result.workLogs[0].taskSnapshot.remainingEstimate).toEqual({ minMinutes: 60, maxMinutes: 120 })
  await page.reload()
  expect(await saved(page)).toEqual(result)
})

for (const kind of ['no-step Start', 'task-level scheduled work with steps']) {
  test(`${kind} does not invent a work-step link`, async ({ page }) => {
    const initial = fixture(kind === 'no-step Start' ? { steps: [] } : {})
    if (kind !== 'no-step Start') initial.sessions.push({ id: 'synthetic-finished-session', taskId: task.id, dateLocal: '2026-11-02', startTime: '10:00', endTime: '10:30' })
    await boot(page, initial)
    let outcome
    if (kind === 'no-step Start') outcome = await startOutcome(page, title)
    else {
      await navigate(page, 'capacity')
      await (await reveal(page.locator('[data-session-id="synthetic-finished-session"]').getByRole('button', { name: 'Avslutt økt', exact: true }))).click()
      outcome = page.getByRole('dialog', { name: 'Hva skjedde?', exact: true })
    }
    await expect(outcome.getByText(/^Arbeidssteg:/)).toHaveCount(0)
    await more(outcome)
    const result = await saved(page), log = result.workLogs[0]
    expect(log).toMatchObject({ taskId: task.id, actualMinutes: 30, remainingMinutes: 75, outcome: 'more' })
    expect(log).not.toHaveProperty('stepId')
    expect(result.tasks[0].steps).toEqual(initial.tasks[0].steps)
    expect(result.tasks[0]).toMatchObject({ remainingMinutes: 75, completed: false, submitted: false })
    if (kind === 'no-step Start') expect(log).not.toHaveProperty('sessionId')
    else {
      expect(log.sessionId).toBe('synthetic-finished-session')
      expect(log.sessionSnapshot).toEqual(initial.sessions.at(-1))
      expect(result.sessions).toEqual([otherSession])
    }
    await page.reload()
    expect(await saved(page)).toEqual(result)
  })
}

test('named-step Start keeps its identity without changing the task when work was not performed', async ({ page }) => {
  const initial = fixture()
  await boot(page, initial)
  const outcome = await startOutcome(page, first.title)
  await expect(outcome.getByText(`Arbeidssteg: ${first.title}`, { exact: true })).toBeVisible()
  await outcome.locator('[name=actualMinutes]').fill('15')
  await outcome.getByRole('radio', { name: 'Ikke utført', exact: true }).check()
  await expect(outcome.locator('[name=actualMinutes]')).not.toBeVisible()
  expect(await saved(page)).toEqual(initial)
  await outcome.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  await expect(outcome).not.toBeVisible()
  const result = await saved(page)
  expect(result.tasks).toEqual(initial.tasks)
  expect(result.sessions).toEqual(initial.sessions)
  expect(result.workLogs).toHaveLength(1)
  expect(result.workLogs[0]).toMatchObject({
    taskId: task.id, stepId: first.id, outcome: 'not-started', actualMinutes: null,
    plannedMinutes: 30, remainingMinutes: 60, interrupted: false, historyComplete: false, taskCompleted: false,
    taskSnapshot: initial.tasks[0],
  })
  expect(result.workLogs[0]).not.toHaveProperty('stepCompleted')
  expect(result.workLogs[0]).not.toHaveProperty('sessionId')
  await page.reload()
  expect(await saved(page)).toEqual(result)
})

test('whole-task completion from a named step requires reservation release and leaves submission separate', async ({ page }) => {
  const future = {
    id: 'synthetic-task-future-session', taskId: task.id,
    dateLocal: '2026-11-03', startTime: '09:00', endTime: '09:30',
  }
  const initial = fixture()
  initial.sessions.push(future)
  await boot(page, initial)
  const outcome = await startOutcome(page, first.title)
  await expect(outcome.getByText(`Arbeidssteg: ${first.title}`, { exact: true })).toBeVisible()
  await outcome.getByRole('radio', { name: 'Utført', exact: true }).check()
  await outcome.locator('[name=actualMinutes]').fill('30')
  const whole = outcome.getByLabel('Hele oppgaven er ferdig', { exact: true })
  await expect(whole).not.toBeChecked()
  await expect(outcome.locator('[data-release]')).not.toBeVisible()
  await whole.check()
  const release = outcome.locator('[data-release]')
  await expect(release).toBeVisible()
  await expect(release.getByRole('listitem')).toHaveText(['2026-11-03 09:00–09:30'])
  await outcome.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  await expect(outcome.getByRole('alert')).toHaveText('Bekreft frigjøring av de viste reservasjonene før du fullfører.')
  expect(await saved(page)).toEqual(initial)
  await expect(whole).toBeChecked()
  await expect(outcome.locator('[name=actualMinutes]')).toHaveValue('30')
  await release.getByLabel('Frigjør disse reservasjonene når jeg bekrefter ferdig', { exact: true }).check()
  await outcome.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  await expect(outcome).not.toBeVisible()
  const completed = await saved(page)
  expect(completed.tasks[0]).toMatchObject({ completed: true, submitted: false, remainingMinutes: 0 })
  expect(completed.tasks[0].steps).toEqual(initial.tasks[0].steps.map(step => ({ ...step, completed: true })))
  expect(completed.tasks[1]).toEqual(initial.tasks[1])
  expect(completed.sessions).toEqual([otherSession])
  expect(completed.workLogs).toHaveLength(1)
  expect(completed.workLogs[0]).toMatchObject({
    taskId: task.id, stepId: first.id, outcome: 'done', stepCompleted: true, taskCompleted: true,
    actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 0, taskSnapshot: initial.tasks[0],
  })
  expect(completed.workLogs[0]).not.toHaveProperty('sessionId')
  await page.reload()
  expect(await saved(page)).toEqual(completed)
  await navigate(page, 'all')
  await openMenu(page, title)
  await row(page, title).getByRole('button', { name: `Bekreft levert «${title}»`, exact: true }).click()
  const submitted = await saved(page)
  expect(submitted.tasks[0]).toMatchObject({ completed: true, submitted: true, remainingMinutes: 0 })
  expect(submitted.workLogs).toEqual(completed.workLogs)
  expect(submitted.sessions).toEqual(completed.sessions)
  await page.reload()
  expect(await saved(page)).toEqual(submitted)
})

test('legacy nextStep is shown by Start and keeps its identity through migration and reload', async ({ page }) => {
  const legacy = { description: 'Eldre syntetisk neste handling', estimatedMinutes: 60 }
  const previousStep = { ...second, completed: true }
  const initial = fixture({ steps: [previousStep], nextStep: legacy })
  const legacyId = `${task.id}:legacy-next-step`
  await boot(page, initial)
  let outcome = await startOutcome(page, legacy.description)
  await expect(outcome.getByText(`Arbeidssteg: ${legacy.description}`, { exact: true })).toBeVisible()
  expect(await saved(page)).toEqual(initial)
  await more(outcome)
  const recorded = await saved(page)
  expect(recorded.tasks[0]).not.toHaveProperty('nextStep')
  expect(recorded.tasks[0]).toMatchObject({ remainingMinutes: 75, completed: false, submitted: false })
  expect(recorded.tasks[0].steps).toEqual([
    previousStep,
    { id: legacyId, title: legacy.description, estimatedMinutes: 60, completed: false, provenance: { kind: 'legacy-next-step' } },
  ])
  expect(recorded.workLogs).toHaveLength(1)
  expect(recorded.workLogs[0]).toMatchObject({
    taskId: task.id, stepId: legacyId, outcome: 'more', actualMinutes: 30, remainingMinutes: 75,
    taskSnapshot: initial.tasks[0],
  })
  expect(recorded.sessions).toEqual(initial.sessions)
  await page.reload()
  expect(await saved(page)).toEqual(recorded)
  outcome = await startOutcome(page, legacy.description)
  await expect(outcome.getByText(`Arbeidssteg: ${legacy.description}`, { exact: true })).toBeVisible()
  await outcome.getByRole('radio', { name: 'Utført', exact: true }).check()
  await expect(outcome.getByLabel('Hele oppgaven er ferdig', { exact: true })).not.toBeChecked()
  await outcome.locator('[name=actualMinutes]').fill('20')
  await outcome.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  await expect(outcome).not.toBeVisible()
  const completed = await saved(page)
  expect(completed.tasks[0]).toMatchObject({ remainingMinutes: 75, completed: false, submitted: false })
  expect(completed.tasks[0].steps).toEqual(recorded.tasks[0].steps.map(step => ({ ...step, completed: true })))
  expect(completed.workLogs).toHaveLength(2)
  expect(completed.workLogs[0]).toEqual(recorded.workLogs[0])
  expect(completed.workLogs[1]).toMatchObject({
    taskId: task.id, stepId: legacyId, outcome: 'done', stepCompleted: true,
    actualMinutes: 20, remainingMinutes: 75, taskSnapshot: recorded.tasks[0],
  })
  await page.reload()
  expect(await saved(page)).toEqual(completed)
})
