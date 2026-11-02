import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { freeze, key, navigate, openMenu, openTaskDetails, reveal, saved, tabTo } from './helpers.js'

// Invented tasks in a fresh Playwright profile. This reproduces the reported
// 2026-11-01 shape; it neither reads personal data nor completes SC-07 for its owner.
const task = {
  id: 'synthetic-sc07-large', title: 'Syntetisk SC-07 – 1200 minutter', course: '',
  deadlineLocal: '2026-11-15T20:00', estimatedMinutes: null, remainingMinutes: 1200,
  completed: false, requiresSubmission: true, submitted: false,
  splittable: true, waitingReason: '', dependencyIds: [],
}
const fixture = (tasks = [task]) => ({
  schemaVersion: 1, tasks, sessions: [], workLogs: [],
  workWindows: [{ id: 'synthetic-sc07-time', start: '2026-11-02T07:00:00Z', end: '2026-11-03T07:00:00Z' }],
  planningPreferences: { minimumMinutes: 15, sessionMinutes: 30, maximumMinutes: 30, breakMinutes: 0 },
  planner: { courses: [], events: [], sources: [] },
  onboarding: { dismissed: true, completed: true },
})

async function boot(page, state = fixture(), width = 1440) {
  await page.setViewportSize({ width, height: 1000 })
  await freeze(page, '2026-11-01T12:00:00+01:00')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload()
}

async function editTask(page, title = task.title) {
  await navigate(page, 'all')
  await openMenu(page, title)
  await page.getByRole('button', { name: `Rediger «${title}»`, exact: true }).click()
  return page.locator('#task-form')
}

async function capture(page, info, name, dialog) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (dialog) expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: !dialog })
}

test('SC-07: 1200 remaining without work steps offers 30 minutes without mutating the plan', async ({ page }) => {
  const before = fixture()
  await boot(page, before)
  await page.getByRole('button', { name: '30 min', exact: true }).click()
  const suggestions = page.locator('#dashboard-suggestions')
  await expect(suggestions.getByRole('button', { name: `Start «${task.title}»`, exact: true })).toBeVisible()
  await expect(suggestions).toContainText('En deløkt på 30 min av 20 timer gjenstående arbeid')
  expect(await saved(page)).toEqual(before)
})

for (const width of [1440, 390]) {
  test(`SC-07: short session keeps actual time, remaining work and submission separate at ${width}px`, async ({ page }, info) => {
    const before = fixture()
    await boot(page, before, width)
    await expect(page.locator('#daily-overview')).toContainText('Planen går opp')
    await expect(page.getByText('Hvor lenge vil du jobbe nå?', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '30 min', exact: true }).click()
    const suggestions = page.locator('#dashboard-suggestions')
    const start = suggestions.getByRole('button', { name: `Start «${task.title}»`, exact: true })
    await expect(start).toBeVisible()
    await expect(suggestions).toContainText('En deløkt på 30 min av 20 timer gjenstående arbeid')
    await expect(suggestions.locator('.task-session-duration')).toBeVisible()
    await expect(suggestions.locator('.task-session-duration')).toContainText('Arbeid nå: 30 min · deløkt. Totalanslaget endres ikke av forslaget.')
    await expect(suggestions.locator('.task-estimate')).toBeHidden()
    await expect(suggestions.locator('.task-remaining')).toHaveText('Gjenstående arbeid: 20 timer')
    await capture(page, info, `sc07-suggestion-${width}`)
    expect(await saved(page)).toEqual(before)

    const form = await editTask(page)
    const details = form.locator('.task-optional-details')
    if (await details.evaluate(node => node.open)) await details.locator(':scope > summary').click()
    await expect(form.getByLabel('Totalt gjenstående arbeid (minutter)', { exact: true })).toHaveValue('1200')
    await expect(form.getByLabel('Kan deles i flere økter', { exact: true })).toBeVisible()
    await expect(form.getByLabel('Kan deles i flere økter', { exact: true })).toBeChecked()
    await expect(form.locator('#splittable-help')).toContainText('Faktisk arbeid og nytt gjenstående anslag registreres hver for seg')
    await capture(page, info, `sc07-estimate-${width}`, page.locator('dialog[open]'))
    await form.getByRole('button', { name: 'Avbryt', exact: true }).click()
    expect(await saved(page)).toEqual(before)
    await navigate(page, 'overview')

    await start.click()
    const session = page.getByRole('dialog', { name: task.title, exact: true })
    await expect(session).toContainText('Planlagt varighet: 30 minutter')
    await expect(session).toContainText('deløkt')
    await expect(session).toContainText('20 timer')
    await expect(session).not.toContainText('Dette gjelder hele den registrerte oppgaven')
    await session.getByRole('button', { name: 'Avbryt', exact: true }).click()
    expect(await saved(page)).toEqual(before)
    await start.click()
    await session.getByRole('button', { name: 'Start økten', exact: true }).click()
    expect(await saved(page)).toEqual(before)
    await session.getByRole('button', { name: 'Avbryt', exact: true }).click()
    expect(await saved(page)).toEqual(before)

    await start.click()
    await session.getByRole('button', { name: 'Start økten', exact: true }).click()
    await session.getByRole('button', { name: 'Avslutt økten', exact: true }).click()
    const outcome = page.getByRole('dialog', { name: 'Hva skjedde?', exact: true })
    await expect(outcome.getByRole('radio', { name: 'Trenger mer tid', exact: true })).toBeChecked()
    await expect(outcome.getByRole('radio', { name: 'Utført', exact: true })).not.toBeChecked()
    await outcome.getByLabel('Faktisk arbeidstid (minutter, valgfritt)', { exact: true }).fill('17')
    await outcome.getByRole('combobox', { name: 'Gjenstående arbeid', exact: true }).selectOption('exact')
    await outcome.locator('[name=remainingMinutes]').fill('1140')
    expect(await saved(page)).toEqual(before)
    await outcome.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
    const after = await saved(page)
    expect(after.tasks[0]).toMatchObject({ ...task, remainingMinutes: 1140 })
    expect(after.workLogs).toHaveLength(1)
    expect(after.workLogs[0]).toMatchObject({ taskId: task.id, actualMinutes: 17, plannedMinutes: 30, remainingMinutes: 1140, outcome: 'more' })
    expect(after.sessions).toEqual(before.sessions)
    expect(after.workWindows).toEqual(before.workWindows)
    await page.reload()
    expect(await saved(page)).toEqual(after)

    if (width === 1440) {
      await navigate(page, 'settings')
      const menu = page.locator('#settings-panel .data-menu').filter({ hasText: 'Data og sikkerhetskopi' })
      if (!await menu.evaluate(node => node.open)) await menu.locator(':scope > summary').click()
      const downloaded = page.waitForEvent('download')
      await menu.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
      const file = await readFile(await (await downloaded).path())
      const backup = JSON.parse(file.toString())
      expect(backup.data.tasks).toEqual(after.tasks)
      expect(backup.data.workLogs).toEqual(after.workLogs)
      expect(await saved(page)).toEqual(after)
      await page.locator('#backup-file').setInputFiles({ name: 'synthetic-sc07-backup.json', mimeType: 'application/json', buffer: file })
      const restore = page.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
      expect(await saved(page)).toEqual(after)
      await restore.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
      await page.reload()
      expect((await saved(page)).tasks).toEqual(after.tasks)
      expect((await saved(page)).workLogs).toEqual(after.workLogs)
    }
  })
}

test('SC-07: calendar still previews forty 30-minute sessions without saving the proposal', async ({ page }) => {
  const before = fixture()
  await boot(page, before)
  await navigate(page, 'all')
  await (await reveal(page.getByRole('button', { name: `Se planforslag «${task.title}»`, exact: true }))).click()
  const plan = page.getByRole('dialog', { name: 'Planforslag for oppgaven', exact: true })
  await expect(plan.locator('.proposed-session-time')).toHaveCount(40)
  expect(await saved(page)).toEqual(before)
  await plan.getByRole('button', { name: 'Ikke nå', exact: true }).click()
  expect(await saved(page)).toEqual(before)
})

test('SC-07: a short remaining total caps a longer work-step session without completing either', async ({ page }) => {
  const capped = { ...task, remainingMinutes: 15, nextStep: { description: 'Syntetisk langt arbeidssteg', estimatedMinutes: 1200 } }
  const before = fixture([capped])
  await boot(page, before)
  await page.getByRole('button', { name: '30 min', exact: true }).click()
  const suggestions = page.locator('#dashboard-suggestions')
  await expect(suggestions.locator('.task-session-duration')).toContainText('Arbeid nå: 15 min')
  await suggestions.getByRole('button', { name: `Start «${task.title}»`, exact: true }).click()
  const session = page.getByRole('dialog', { name: capped.nextStep.description, exact: true })
  await expect(session).toContainText('Planlagt varighet: 15 minutter')
  await session.getByRole('button', { name: 'Start økten', exact: true }).click()
  await session.getByRole('button', { name: 'Avslutt økten', exact: true }).click()
  const outcome = page.getByRole('dialog', { name: 'Hva skjedde?', exact: true })
  await expect(outcome.getByRole('radio', { name: 'Trenger mer tid', exact: true })).toBeChecked()
  await expect(outcome.getByRole('radio', { name: 'Utført', exact: true })).not.toBeChecked()
  expect(await saved(page)).toEqual(before)
  await outcome.getByRole('button', { name: 'Avbryt', exact: true }).click()
  expect(await saved(page)).toEqual(before)
})

for (const scenario of ['waiting', 'prerequisite', 'indivisible']) {
  test(`SC-07: ${scenario} prevents an unsafe short session and explains the actual constraint`, async ({ page }) => {
    const prerequisite = { ...task, id: 'synthetic-sc07-prerequisite', title: 'Syntetisk forutsetning', remainingMinutes: 60, waitingReason: 'Syntetisk klarsignal' }
    const target = {
      ...task,
      ...(scenario === 'waiting' ? { waitingReason: 'Syntetisk tilbakemelding' } : {}),
      ...(scenario === 'prerequisite' ? { dependencyIds: [prerequisite.id] } : {}),
      ...(scenario === 'indivisible' ? { splittable: false } : {}),
    }
    const before = fixture(scenario === 'prerequisite' ? [target, prerequisite] : [target])
    await boot(page, before)
    await page.getByRole('button', { name: '30 min', exact: true }).click()
    await expect(page.locator('#dashboard-suggestions > li')).toHaveCount(0)
    const empty = page.locator('#suggestion-empty')
    await expect(empty).toBeVisible()
    if (scenario === 'waiting') await expect(empty).toContainText('Venter på: Syntetisk tilbakemelding')
    if (scenario === 'prerequisite') await expect(empty).toContainText('Venter på «Syntetisk forutsetning»')
    if (scenario === 'indivisible') {
      await expect(empty).toContainText('kan ikke deles')
      await expect(empty).toContainText('1200 minutter sammenhengende')
      await expect(empty).toContainText('Kan deles i flere økter')
      await expect(empty.getByRole('button', { name: 'Velg mer tid', exact: true })).toBeVisible()
    }
    await empty.getByRole('button', { name: 'Alle oppgaver', exact: true }).click()
    expect(await saved(page)).toEqual(before)
    const form = await editTask(page)
    if (scenario === 'waiting') await expect(form.locator('[name=waitingReason]')).toHaveValue('Syntetisk tilbakemelding')
    if (scenario === 'prerequisite') await expect(form.getByLabel('Forutsetninger', { exact: true })).toHaveValues([prerequisite.id])
    if (scenario === 'indivisible') await expect(form.getByLabel('Kan deles i flere økter', { exact: true })).not.toBeChecked()
    await form.getByRole('button', { name: 'Avbryt', exact: true }).click()
    expect(await saved(page)).toEqual(before)
    await page.reload()
    expect(await saved(page)).toEqual(before)
  })
}

for (const width of [1440, 390]) {
  test(`SC-07: clearing prerequisites works by keyboard, is cancellable, persistent and undoable at ${width}px`, async ({ page }, info) => {
    const first = { ...task, id: 'synthetic-sc07-first', title: 'Syntetisk første forutsetning', remainingMinutes: 0, completed: true, requiresSubmission: false }
    const second = { ...task, id: 'synthetic-sc07-second', title: 'Syntetisk andre forutsetning', remainingMinutes: 60, waitingReason: 'Syntetisk avklaring' }
    const dependent = { ...task, dependencyIds: [first.id, second.id] }
    const before = fixture([dependent, first, second])
    await boot(page, before, width)
    const form = await editTask(page)
    await openTaskDetails(page)
    const dependencies = form.getByLabel('Forutsetninger', { exact: true })
    const selected = () => dependencies.locator('option:checked').evaluateAll(nodes => nodes.map(node => node.value))
    const options = () => dependencies.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, text: node.textContent })))
    const originalOptions = await options()
    await expect(form.locator('#dependencyIds-help')).toContainText('Velg eksisterende oppgaver som må være ferdige før denne oppgaven kan startes')
    expect(await selected()).toEqual([first.id, second.id])
    const clear = form.getByRole('button', { name: 'Fjern alle forutsetninger', exact: true })
    await dependencies.focus()
    await tabTo(page, clear)
    await page.keyboard.press('Enter')
    await expect(clear).toBeFocused()
    expect(await selected()).toEqual([])
    expect(await options()).toEqual(originalOptions)
    await expect(form.locator('[data-dependency-status]')).toContainText('Endringen lagres når du lagrer oppgaven')
    await expect(form.getByLabel('Totalt gjenstående arbeid (minutter)', { exact: true })).toHaveValue('1200')
    await capture(page, info, `sc07-prerequisites-${width}`, page.locator('dialog[open]'))
    expect(await saved(page)).toEqual(before)
    await form.getByRole('button', { name: 'Avbryt', exact: true }).click()
    expect(await saved(page)).toEqual(before)
    await editTask(page)
    expect(await selected()).toEqual([first.id, second.id])
    await dependencies.focus()
    await tabTo(page, clear)
    await page.keyboard.press('Space')
    expect(await selected()).toEqual([])
    await form.getByRole('button', { name: 'Lagre', exact: true }).click()
    expect((await saved(page)).tasks[0]).toMatchObject({ ...task, dependencyIds: [] })
    await page.reload()
    expect((await saved(page)).tasks[0].dependencyIds).toEqual([])
    await page.getByRole('button', { name: '30 min', exact: true }).click()
    await expect(page.locator('#dashboard-suggestions').getByRole('button', { name: `Start «${task.title}»`, exact: true })).toBeVisible()
    await navigate(page, 'settings')
    await (await reveal(page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }))).click()
    expect((await saved(page)).tasks).toEqual(before.tasks)
    await page.reload()
    expect((await saved(page)).tasks).toEqual(before.tasks)
  })
}
