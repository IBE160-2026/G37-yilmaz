import { test, expect } from '@playwright/test'
import { freeze } from './helpers.js'

const key = 'studieplanlegger:v1'
const stored = page => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key)
const task = (id, patch = {}) => ({ id, title: `Oppgave ${id}`, course: '', deadlineLocal: '', estimatedMinutes: null, remainingMinutes: null, completed: false, ...patch })
async function seed(page, state) {
  await freeze(page, '2026-09-25T09:00:00+02:00'); await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state }); await page.reload()
}
async function shot(page, info, name) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

test('first use goes from title-only task through one checked move to apply and exact undo in 8 actions', async ({ page }, info) => {
  await freeze(page, '2026-09-25T09:00:00+02:00'); await page.goto('/')
  let actions = 0
  const act = async fn => { actions++; await fn() }
  await act(() => page.locator('#connected-onboarding').getByRole('button', { name: 'Hopp over import' }).click())
  await act(() => page.getByLabel('Tittel', { exact: true }).fill('Skriv refleksjonsnotat'))
  await act(() => page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click())
  await act(() => page.locator('#connected-onboarding').getByRole('button', { name: 'Se planforslag', exact: true }).click())
  const dialog = page.getByRole('dialog', { name: 'Planforslag for oppgaven' })
  await expect(dialog).toContainText('Foreløpig antakelse')
  await expect(dialog).toContainText('ikke et estimat for hele oppgaven')
  await act(() => dialog.getByRole('radio', { name: /På kvelden i ukedagene/ }).check())
  await expect(dialog).toContainText('Forslag hvis disse tidene passer')
  await act(() => dialog.getByRole('button', { name: 'Flytt', exact: true }).first().click())
  const alternative = dialog.locator('.move-options').getByRole('button', { name: /kl\. 18:30–19:00/ }).first()
  await expect(alternative).toBeVisible()
  await shot(page, info, 'simple-plan-move-options-desktop')
  await act(() => alternative.click())
  await expect(dialog.locator('.proposed-session-time').first()).toContainText('18:30–19:00')
  expect((await stored(page)).sessions || []).toHaveLength(0)
  await shot(page, info, 'simple-plan-desktop')
  await act(() => dialog.getByRole('button', { name: 'Bruk planen', exact: true }).click())
  expect(actions).toBe(8)
  const after = await stored(page)
  expect(after.tasks).toHaveLength(1)
  expect(after.sessions).toHaveLength(1)
  expect(after.sessions[0]).toMatchObject({ taskId: after.tasks[0].id, startTime: '18:30', endTime: '19:00' })
  expect(after.studyTimePreference).toMatchObject({ kind: 'evening', startTime: '18:00', endTime: '20:00' })
  const undo = page.locator('.contextual-undo')
  await expect(undo).toBeVisible(); await undo.getByRole('button', { name: 'Angre siste endring' }).click()
  const undone = await stored(page)
  expect(undone.tasks).toHaveLength(1)
  expect(undone.sessions || []).toHaveLength(0)
  expect(undone.studyTimePreference).toBeUndefined()
})

test('later use reuses the preference and completes the corrected flow in 7 actions on mobile and large text', async ({ page }, info) => {
  await seed(page, { schemaVersion: 1, tasks: [task('old', { remainingMinutes: 0, completed: true })], sessions: [], onboarding: { dismissed: true, completed: false }, studyTimePreference: { kind: 'weekend', label: 'I helgene', days: [6, 7], startTime: '10:00', endTime: '14:00' } })
  await page.setViewportSize({ width: 390, height: 844 }); await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  let actions = 0; const act = async fn => { actions++; await fn() }
  await act(() => page.locator('#new-task').click())
  await act(() => page.getByLabel('Tittel', { exact: true }).fill('Ny oppgave uten detaljfelter'))
  await act(() => page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click())
  await act(() => page.locator('#feedback-plan').click())
  const dialog = page.getByRole('dialog', { name: 'Planforslag for oppgaven' })
  await expect(dialog.getByRole('radio', { name: /I helgene/ })).toBeChecked()
  const move = dialog.getByRole('button', { name: 'Flytt', exact: true }).first()
  await move.focus(); await act(() => page.keyboard.press('Enter'))
  await shot(page, info, 'simple-plan-move-options-mobile-large-text')
  await act(() => page.keyboard.press('Enter'))
  await shot(page, info, 'simple-plan-mobile-large-text')
  await act(() => dialog.getByRole('button', { name: 'Bruk planen', exact: true }).click())
  expect(actions).toBe(7)
  const after = await stored(page)
  expect(after.tasks).toHaveLength(2)
  expect(after.sessions).toHaveLength(1)
  expect(after.studyTimePreference.kind).toBe('weekend')
})

test('varies, cancel, known appointments, manual fallback and stale preview remain honest and write-safe', async ({ page }) => {
  const workStart = '2026-09-26T08:00:00Z', workEnd = '2026-09-26T10:00:00Z'
  await seed(page, { schemaVersion: 1, tasks: [task('one', { remainingMinutes: 30 })], sessions: [], onboarding: { dismissed: true, completed: true },
    workWindows: [{ id: 'work', label: 'Bekreftet', start: workStart, end: workEnd }], busyWindows: [{ id: 'busy', label: 'Avtale', start: workStart, end: '2026-09-26T09:00:00Z' }] })
  const before = await stored(page), row = page.locator('.task-card').filter({ hasText: 'Oppgave one' }).first()
  await row.getByRole('button', { name: /Se planforslag/ }).click()
  let dialog = page.getByRole('dialog', { name: 'Planforslag for oppgaven' })
  await expect(dialog).toContainText('registrert som tilgjengelig')
  await expect(dialog.locator('.proposed-session-time')).toContainText('11:00–11:30')
  await dialog.getByRole('button', { name: 'Flytt', exact: true }).click()
  await dialog.getByRole('button', { name: 'Velg tidspunkt selv', exact: true }).click()
  const manual = dialog.locator('.manual-move'); await expect(manual).toBeVisible()
  await manual.getByLabel('Start', { exact: true }).fill('10:30'); await manual.getByLabel('Slutt', { exact: true }).fill('11:00')
  await manual.getByRole('button', { name: 'Bruk tidspunktet i utkastet' }).click()
  await expect(dialog.getByRole('alert')).toContainText('opptatt')
  await manual.getByLabel('Start', { exact: true }).fill('11:30'); await manual.getByLabel('Slutt', { exact: true }).fill('12:00')
  await manual.getByRole('button', { name: 'Bruk tidspunktet i utkastet' }).click()
  await expect(dialog.locator('.proposed-session-time')).toContainText('11:30–12:00')
  await dialog.getByRole('button', { name: 'Ikke nå', exact: true }).click()
  expect(await stored(page)).toEqual(before)

  await row.getByRole('button', { name: /Se planforslag/ }).click(); dialog = page.getByRole('dialog', { name: 'Planforslag for oppgaven' })
  await dialog.getByRole('button', { name: 'Flytt', exact: true }).click(); await dialog.getByRole('button', { name: 'Velg tidspunkt selv', exact: true }).click()
  const applyManual = dialog.locator('.manual-move'); await applyManual.getByLabel('Start', { exact: true }).fill('11:30'); await applyManual.getByLabel('Slutt', { exact: true }).fill('12:00')
  await applyManual.getByRole('button', { name: 'Bruk tidspunktet i utkastet' }).click(); await dialog.getByRole('button', { name: 'Bruk planen' }).click()
  const manuallyApplied = await stored(page); expect(manuallyApplied.sessions).toHaveLength(1); expect(manuallyApplied.sessions[0]).toMatchObject({ startTime: '11:30', endTime: '12:00' })

  await row.getByRole('button', { name: /Se planforslag/ }).click(); dialog = page.getByRole('dialog', { name: 'Planforslag for oppgaven' })
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00+02:00'))
  await dialog.getByRole('button', { name: 'Bruk planen', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('passert')
  expect(await stored(page)).toEqual(manuallyApplied)
})

test('varies uses concrete candidates and clears an obsolete recurring pattern', async ({ page }) => {
  await seed(page, { schemaVersion: 1, tasks: [task('one', { remainingMinutes: 30 })], sessions: [], onboarding: { dismissed: true, completed: true }, studyTimePreference: { kind: 'evening', label: 'På kvelden i ukedagene', days: [1, 2, 3, 4, 5], startTime: '18:00', endTime: '20:00' } })
  await page.locator('.task-card').first().getByRole('button', { name: /Se planforslag/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Planforslag for oppgaven' })
  await dialog.getByRole('radio', { name: /Det varierer/ }).check()
  await expect(dialog).toContainText('Konkrete tidspunkter de neste sju dagene')
  await dialog.getByRole('button', { name: 'Bruk planen' }).click()
  const after = await stored(page)
  expect(after.sessions).toHaveLength(1)
  expect(after.studyTimePreference).toBeUndefined()
})

test('danger status opens the affected task and rule edits recompute the visible draft', async ({ page }) => {
  await seed(page, { schemaVersion: 1, tasks: [task('urgent', { remainingMinutes: 60, deadlineLocal: '2026-09-25T12:00' })], sessions: [], onboarding: { dismissed: true, completed: true },
    workWindows: [{ id: 'short', label: 'Kort vindu', start: '2026-09-25T08:00:00Z', end: '2026-09-25T08:30:00Z' }], busyWindows: [] })
  await page.getByRole('button', { name: 'Se realistisk forslag' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planforslag for oppgaven' })
  await expect(dialog).toContainText('Oppgave urgent')
  await expect(dialog.locator('.proposed-session-time')).toContainText('30 min')
  await dialog.locator('.planning-rules').getByText('Øktlengde og pauser').click()
  await dialog.getByLabel('Vanlig økt (min)').fill('15'); await dialog.getByLabel('Vanlig økt (min)').blur()
  await expect(dialog.locator('.proposed-session-time')).toContainText('15 min')
})
