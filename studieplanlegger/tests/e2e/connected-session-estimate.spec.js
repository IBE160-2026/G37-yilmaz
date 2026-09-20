import { test, expect } from '@playwright/test'
import { freeze, key } from './helpers.js'

const rules = { sessionMinutes: 30, minimumMinutes: 15, maximumMinutes: 60, breakMinutes: 10 }
function fixture({ count = 5, enabled = true } = {}) {
  const task = { id: 'next', title: 'Skriv utkastet', course: '', deadlineLocal: '2026-09-11T16:00', estimatedMinutes: null, remainingMinutes: 120, completed: false }
  const state = { schemaVersion: 1, tasks: [task], sessions: [{ id: 'missed', taskId: task.id, dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }], workWindows: [{ id: 'thu', start: '2026-09-10T08:00:00Z', end: '2026-09-10T11:00:00Z' }], workLogs: [], planningPreferences: { ...rules }, personalization: { enabled } }
  const add = (id, actualMinutes, patch = {}) => {
    const snapshot = { ...task, id, title: `Tidligere arbeid ${id}` }
    state.tasks.push({ ...snapshot, completed: true, remainingMinutes: 0 })
    state.workLogs.push({ id: `log-${id}`, operationId: `op-${id}`, taskId: id, taskSnapshot: snapshot, at: '2026-09-08T12:00:00Z', outcome: 'more', actualMinutes, plannedMinutes: null, remainingMinutes: 20, interrupted: false, historyComplete: false, ...patch })
  }
  for (let i = 0; i < count; i++) add(`sample-${i}`, [30, 40, 50, 60, 120][i])
  // Neither a missed session nor interrupted time contributes to the median.
  add('missed-sample', null, { outcome: 'not-started' })
  add('interrupted-sample', 480, { interrupted: true })
  return state
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
async function boot(page, state) {
  await freeze(page, '2026-09-09T09:00:00+02:00'); await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state }); await page.reload()
}
async function open(page) {
  await page.locator('.connected-plan-actions').getByRole('button', { name: 'Jeg ligger etter', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Jeg ligger etter', exact: true })
  await dialog.locator('.planning-rules > summary').click()
  return dialog
}

test('A13 session-length suggestion changes only an editable draft; rejecting preserves the whole plan', async ({ page }, info) => {
  const before = fixture()
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, before)
  await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
  const dialog = await open(page), suggestion = dialog.locator('.personal-session-estimate')
  await expect(suggestion).toContainText('Median av 5 utførte økter fra hele den lokale historikken din')
  await expect(suggestion).toContainText('Forslag: 50 min')
  await expect(dialog.getByLabel('Vanlig økt (min)', { exact: true })).toHaveValue('30')
  expect(await stored(page)).toEqual(before)
  await suggestion.getByRole('button', { name: 'Bruk som vanlig økt', exact: true }).click()
  await expect(dialog.getByLabel('Vanlig økt (min)', { exact: true })).toHaveValue('50')
  for (const [label, value] of [['Minste økt (min)', '15'], ['Lengste økt (min)', '60'], ['Pause mellom økter (min)', '10']]) await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(value)
  await expect(dialog.getByRole('button', { name: 'Godta hele planen', exact: true })).toBeDisabled()
  expect(await stored(page)).toEqual(before)
  await dialog.getByRole('button', { name: 'Beregn nytt forslag', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Godta hele planen', exact: true })).toBeEnabled()
  await expect(dialog.getByLabel('Ny slutt', { exact: true }).first()).toHaveValue('10:50')
  expect(await stored(page)).toEqual(before)
  await suggestion.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('personal-session-length-mobile-large-text.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await dialog.getByRole('button', { name: 'Forkast', exact: true }).click()
  expect(await stored(page)).toEqual(before)
  await page.reload(); expect(await stored(page)).toEqual(before)
})

test('A10/A13 adopted session length requires valid recomputation and permits a corrected value before saving', async ({ page }) => {
  const before = fixture(); await boot(page, before)
  const dialog = await open(page), accept = dialog.getByRole('button', { name: 'Godta hele planen', exact: true }), compute = dialog.getByRole('button', { name: 'Beregn nytt forslag', exact: true })
  await dialog.getByRole('button', { name: 'Bruk som vanlig økt', exact: true }).click()
  await dialog.getByLabel('Lengste økt (min)', { exact: true }).fill('45')
  await expect(accept).toBeDisabled(); await compute.click()
  await expect(dialog.getByRole('alert')).toContainText('Kontroller lengde og pauser')
  await expect(accept).toBeDisabled(); expect(await stored(page)).toEqual(before)
  await dialog.getByLabel('Lengste økt (min)', { exact: true }).fill('60')
  await dialog.getByLabel('Vanlig økt (min)', { exact: true }).fill('40')
  await expect(accept).toBeDisabled(); await compute.click()
  await expect(accept).toBeEnabled()
  await expect(dialog.getByLabel('Ny slutt', { exact: true }).first()).toHaveValue('10:40')
  expect(await stored(page)).toEqual(before)
  await accept.click()
  const after = await stored(page)
  expect(after.planningPreferences).toEqual({ ...rules, sessionMinutes: 40 })
  expect(after.tasks).toEqual(before.tasks); expect(after.workLogs).toEqual(before.workLogs); expect(after.workWindows).toEqual(before.workWindows)
  expect(after.sessions).toHaveLength(3)
  expect(after.sessions[0]).toMatchObject({ id: 'missed', dateLocal: '2026-09-10', startTime: '10:00', endTime: '10:40' })
  await page.reload(); expect((await stored(page)).planningPreferences).toEqual(after.planningPreferences)
})

for (const sample of [{ name: 'no performed history', count: 0, enabled: true, reason: 'Du har 0' }, { name: 'sparse history', count: 4, enabled: true, reason: 'Du har 4' }, { name: 'disabled personalization', count: 5, enabled: false, reason: 'Personlige forslag er slått av' }]) {
  test(`A13 ${sample.name} gives no session-length adoption and keeps the plan unchanged`, async ({ page }) => {
    const before = fixture(sample); await boot(page, before)
    const dialog = await open(page)
    await expect(dialog.locator('.personal-session-estimate')).toContainText(sample.reason)
    await expect(dialog.getByRole('button', { name: 'Bruk som vanlig økt', exact: true })).toHaveCount(0)
    await expect(dialog.getByLabel('Vanlig økt (min)', { exact: true })).toHaveValue('30')
    await dialog.getByRole('button', { name: 'Forkast', exact: true }).click()
    expect(await stored(page)).toEqual(before)
  })
}
