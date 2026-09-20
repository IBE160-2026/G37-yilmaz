import { test, expect } from '@playwright/test'
import { freeze, navigate } from './helpers.js'

const key = 'studieplanlegger:v1'
const task = (id = 'task', patch = {}) => ({ id, title: 'Skriv rapport', course: '', estimatedMinutes: 120, remainingMinutes: 45, deadlineLocal: '2026-09-11T16:00', completed: false, ...patch })
const initial = () => ({ schemaVersion: 1, tasks: [task()], sessions: [{ id: 'missed', taskId: 'task', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }], workWindows: [{ id: 'thu', start: '2026-09-10T08:00:00Z', end: '2026-09-10T10:00:00Z' }] })
async function setup(page, state) {
  await freeze(page, '2026-09-09T09:00:00+02:00'); await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state }); await page.reload()
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)

test('A02/A04 empty startup writes nothing; a title-only task and explicit unknown survive reload', async ({ page }) => {
  await page.goto('/'); expect(await stored(page)).toBeNull()
  await expect(page.locator('#connected-onboarding')).toBeVisible()
  await page.locator('#connected-onboarding').getByRole('button', { name: 'Legg til første oppgave', exact: true }).click()
  await page.locator('#title').fill('Bare en tittel')
  await expect(page.locator('.task-optional-details')).not.toHaveAttribute('open', '')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  expect((await stored(page)).tasks[0]).toMatchObject({ title: 'Bare en tittel', course: '', deadlineLocal: '', remainingMinutes: null, estimatedMinutes: null })
  await page.reload(); await navigate(page, 'all')
  await expect(page.locator('#task-list')).toContainText('Bare en tittel')
  await expect(page.locator('#task-list')).toContainText('Gjenstående arbeid: ukjent')
})

test('A07/A08 planned work records actual and remaining independently; skip creates no work sample', async ({ page }) => {
  await setup(page, initial()); await navigate(page, 'capacity')
  await page.locator('[data-session-id=missed]').getByRole('button', { name: 'Avslutt økt' }).click()
  const dialog = page.getByRole('dialog', { name: 'Hvordan gikk arbeidet?' })
  await dialog.getByLabel('Faktisk arbeidstid (minutter, valgfritt)').fill('30')
  await dialog.getByLabel('Gjenstående arbeid (minutter)', { exact: true }).fill('45')
  await dialog.getByRole('button', { name: 'Bekreft arbeid' }).click()
  const state = await stored(page)
  expect(state.tasks[0]).toMatchObject({ estimatedMinutes: 120, remainingMinutes: 45, completed: false })
  expect(state.workLogs[0]).toMatchObject({ actualMinutes: 30, plannedMinutes: 30, outcome: 'more' })
  expect(state.sessions).toEqual([])
  await page.reload(); expect((await stored(page)).workLogs).toHaveLength(1)
  await page.locator('.connected-plan-actions').getByRole('button', { name: 'Jeg ligger etter' }).click()
  await page.getByRole('button', { name: 'Godta hele planen' }).click()
  await navigate(page, 'capacity')
  await page.locator('#session-list').getByRole('button', { name: 'Avslutt økt' }).first().click()
  await dialog.getByLabel('Resultat').selectOption('not-started')
  await dialog.getByRole('button', { name: 'Bekreft arbeid' }).click()
  const after = await stored(page)
  expect(after.tasks[0].remainingMinutes).toBe(45); expect(after.workLogs.at(-1)).toMatchObject({ outcome: 'not-started', actualMinutes: null })
})

test('A09/A10 recovery preview rejects an invalid adjustment and undoes a whole accepted plan', async ({ page }) => {
  const before = initial(); await setup(page, before)
  await page.locator('.connected-plan-actions').getByRole('button', { name: 'Jeg ligger etter' }).click()
  const dialog = page.getByRole('dialog', { name: 'Jeg ligger etter' })
  await expect(dialog).toContainText('Fra: 2026-09-08 10:00–10:30')
  expect(await stored(page)).toEqual(before)
  await dialog.getByLabel('Ny start', { exact: true }).first().fill('07:00')
  await dialog.getByRole('button', { name: 'Godta hele planen' }).click()
  await expect(dialog.getByRole('alert')).not.toBeEmpty(); expect(await stored(page)).toEqual(before)
  await dialog.getByRole('button', { name: 'Beregn nytt forslag' }).click()
  await dialog.getByRole('button', { name: 'Godta hele planen' }).click()
  expect((await stored(page)).sessions[0]).toMatchObject({ id: 'missed', dateLocal: '2026-09-10' })
  await navigate(page, 'settings'); await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const after = await stored(page); expect(after.tasks).toEqual(before.tasks); expect(after.sessions).toEqual(before.sessions)
})

test('A11 full completion displays release and undo restores task, log and reservations together', async ({ page }) => {
  const before = initial(); before.sessions[0].dateLocal = '2026-09-10'; before.tasks[0].requiresSubmission = true; before.tasks[0].submitted = false
  await setup(page, before); await navigate(page, 'capacity')
  await page.locator('[data-session-id=missed]').getByRole('button', { name: 'Avslutt økt' }).click()
  const dialog = page.getByRole('dialog', { name: 'Hvordan gikk arbeidet?' })
  await dialog.getByLabel('Resultat').selectOption('done')
  await expect(dialog).toContainText('2026-09-10 10:00–10:30')
  await dialog.getByRole('button', { name: 'Bekreft arbeid' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Bekreft frigjøring')
  await dialog.getByRole('checkbox', { name: 'Frigjør disse reservasjonene når jeg bekrefter ferdig' }).check()
  await dialog.getByRole('button', { name: 'Bekreft arbeid' }).click()
  expect((await stored(page)).tasks[0]).toMatchObject({ completed: true, submitted: false }); expect((await stored(page)).sessions).toEqual([])
  await navigate(page, 'settings'); await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const after = await stored(page); expect(after.tasks).toEqual(before.tasks); expect(after.sessions).toEqual(before.sessions); expect(after.workLogs).toBeUndefined()
})

test('A05/A06 integrated document import creates one confirmed plan and repeats without duplicate tasks', async ({ page }) => {
  await page.goto('/'); await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan' }).click()
  await page.getByRole('button', { name: 'Fra dokument eller tekst' }).click()
  await page.getByLabel('Eller lim inn tekst').fill('Innlevering 1 frist 2026-09-16 kl. 14:00')
  await page.getByRole('button', { name: 'Lag forhåndsvisning' }).click()
  await expect(page.getByRole('heading', { name: 'Kontroller planen før import' })).toBeVisible()
  expect(await stored(page)).toBeNull()
  await page.getByRole('button', { name: 'Bekreft valgt plan' }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const state = await stored(page); expect(state.tasks).toHaveLength(1); expect(state.importSources).toHaveLength(1)
  await page.reload(); await navigate(page, 'subjects'); await page.getByRole('button', { name: 'Importer emner og plan' }).click(); await page.getByRole('button', { name: 'Fra dokument eller tekst' }).click()
  await page.getByLabel('Eller lim inn tekst').fill('Innlevering 1 frist 2026-09-16 kl. 14:00'); await page.getByRole('button', { name: 'Lag forhåndsvisning' }).click(); await page.getByRole('button', { name: 'Bekreft valgt plan' }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const after = await stored(page); expect(after.tasks[0].id).toBe(state.tasks[0].id); expect(after.tasks).toHaveLength(1)
})

test('A12 mobile suggestions show registered unblocking action and reject a cycle on edit', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  const state = { schemaVersion: 1, tasks: [task('a', { title: 'Les forutsetning', remainingMinutes: 240, nextStep: { description: 'Les første avsnitt', estimatedMinutes: 20 } }), task('b', { title: 'Blokkert rapport', dependencyIds: ['a'] })] }
  await setup(page, state)
  const suggestions = page.locator('#dashboard-suggestions'), prerequisite = suggestions.locator('[data-task-id=a]')
  await expect(prerequisite.getByRole('heading', { name: 'Les forutsetning', exact: true })).toBeVisible()
  await expect(prerequisite.locator('.next-action')).toHaveText('Les første avsnitt')
  await expect(prerequisite.getByRole('button', { name: 'Åpne oppgave «Les forutsetning»', exact: true })).toBeEnabled()
  await expect(suggestions.locator('[data-task-id=b]')).toHaveCount(0)
  await navigate(page, 'all'); await page.locator('#task-list [data-task-id=a] .task-menu summary').click(); await page.getByRole('button', { name: 'Rediger «Les forutsetning»', exact: true }).click()
  await page.getByLabel('Forutsetninger', { exact: true }).selectOption('b'); await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(page.locator('#dependencyIds-error')).toContainText('sirkel')
  expect(await stored(page)).toEqual(state); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('A13 accepting a personal estimate on a legacy task persists the remaining value and current type controls scope', async ({ page }) => {
  const legacy = task('legacy', { title: 'Eldre oppgave', taskType: 'lesing' }); delete legacy.remainingMinutes
  const state = { schemaVersion: 1, tasks: [legacy], workLogs: [] }
  for (let index = 0; index < 5; index++) {
    const snapshot = task(`sample-${index}`, { taskType: 'lesing' })
    state.tasks.push({ ...snapshot, completed: true, remainingMinutes: 0 })
    state.workLogs.push({ id: `log-${index}`, operationId: `op-${index}`, taskId: snapshot.id, at: '2026-09-08T12:00:00Z', outcome: 'done', actualMinutes: 30 + index * 10, plannedMinutes: null, remainingMinutes: 0, interrupted: false, historyComplete: true, taskSnapshot: snapshot })
  }
  await setup(page, state); await navigate(page, 'all')
  await page.locator('#task-list [data-task-id=legacy] .task-menu summary').click()
  await page.getByRole('button', { name: 'Rediger «Eldre oppgave»', exact: true }).click()
  await page.locator('.personal-estimate summary').click()
  await expect(page.locator('.personal-estimate')).toContainText('samme oppgavetype')
  await page.getByLabel('Oppgavetype (valgfritt)', { exact: true }).fill('skriving')
  await expect(page.locator('.personal-estimate')).toContainText('hele den lokale historikken din')
  await page.getByRole('button', { name: 'Bruk som gjenstående estimat' }).click()
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  expect((await stored(page)).tasks[0]).toMatchObject({ estimatedMinutes: 120, remainingMinutes: 50, taskType: 'skriving' })
  await page.reload(); expect((await stored(page)).tasks[0].remainingMinutes).toBe(50)
})
