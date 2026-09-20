import { navigate } from './helpers.js'
import { studyData } from './helpers.js'
import { test, expect } from '@playwright/test'
import { task, freeze, instrumentWrites, key, saved, raw, writes, row, openMenu,
  fillDraft, save, deleteTask } from './helpers.js'

test('every task lifecycle action preserves study sessions, including a failed action and retry', async ({ page }, testInfo) => {
  const parent = { ...task('lifecycle', '2026-09-07T13:00', 120), remainingMinutes: 90,
    requiresSubmission: true, submitted: false }
  const sessions = [
    { id: 'morning', dateLocal: '2026-09-07', startTime: '10:00', endTime: '11:00' },
    { id: 'noon', dateLocal: '2026-09-07', startTime: '11:00', endTime: '12:00' },
  ]
  const activeSummary = '90 min kjent arbeid · 90 min satt av · 0 min ikke planlagt · 30 min ledig i øktene.'
  const doneSummary = '0 min kjent arbeid · 0 min satt av · 0 min ikke planlagt · 120 min ledig i øktene.'
  const action = caption => row(page, parent.title).getByRole('button', { name: `${caption} «${parent.title}»`, exact: true })
  const completed = () => row(page, parent.title).getByRole('checkbox', { name: `Ferdig med arbeidet «${parent.title}»`, exact: true })

  async function assertState(expectedTasks, summary = activeSummary) {
    const { workLogs, ...data } = await studyData(page)
    expect(data).toEqual({ schemaVersion: 1, tasks: expectedTasks, sessions })
    if (workLogs) expect(workLogs).toEqual([expect.objectContaining({ taskId: parent.id, outcome: 'done', remainingMinutes: 0, actualMinutes: null })])
    await navigate(page, 'capacity')
    await expect(page.locator('#capacity-summary')).toHaveText(summary)
    const capacityText = await page.locator('[data-capacity-task="lifecycle"]').innerText()
    await navigate(page, 'all')
    return capacityText
  }
  async function addStep(description) {
    await openMenu(page, parent.title)
    await action('Legg til neste steg').click()
    await page.locator('#step-description').fill(description)
    await page.locator('#step-estimatedMinutes').fill('15')
    await page.locator('#step-form').getByRole('button', { name: 'Lagre neste steg', exact: true }).click()
    return { ...parent, nextStep: { description, estimatedMinutes: 15 } }
  }

  await freeze(page, '2026-09-07T09:00:00+02:00')
  await page.goto('/')
  await page.evaluate(({ key, parent, sessions }) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [parent], sessions }))
  }, { key, parent, sessions })
  await instrumentWrites(page)
  await page.reload()
  const initialCapacity = await assertState([parent])
  expect(await writes(page)).toEqual([])

  await page.locator('#new-task').click()
  await fillDraft(page, { title: 'Kontroller én kilde', course: 'IBE160', deadlineLocal: '2026-09-07T14:00',
    estimatedMinutes: '30', remainingMinutes: '20' })
  await save(page).click()
  const created = (await saved(page)).tasks.find(item => item.title === 'Kontroller én kilde')
  expect(created).toEqual({ id: expect.any(String), title: 'Kontroller én kilde', course: 'IBE160',
    deadlineLocal: '2026-09-07T14:00', estimatedMinutes: null, remainingMinutes: 20,
    completed: false, requiresSubmission: false, submitted: false })
  await assertState([parent, created], '110 min kjent arbeid · 110 min satt av · 0 min ikke planlagt · 10 min ledig i øktene.')
  await deleteTask(page, created.title)
  expect(await assertState([parent])).toBe(initialCapacity)

  const withStep = await addStep('Les oppgaveteksten')
  expect(await assertState([withStep])).toBe(initialCapacity)
  const beforeFailure = await raw(page)
  const attemptsBeforeFailure = (await writes(page)).length
  await page.evaluate(() => { window.failWrite = true })
  await openMenu(page, parent.title)
  await action('Fjern neste steg').click()
  await expect(row(page, parent.title).getByRole('alert')).toContainText('ikke lagret')
  await expect(row(page, parent.title)).toContainText('Les oppgaveteksten')
  expect(await raw(page)).toBe(beforeFailure)
  expect(await writes(page)).toHaveLength(attemptsBeforeFailure + 1)
  expect(await assertState([withStep])).toBe(initialCapacity)
  await page.evaluate(() => { window.failWrite = false })
  await openMenu(page, parent.title)
  await action('Fjern neste steg').click()
  await expect(row(page, parent.title).locator('.next-step-box')).toBeHidden()
  expect(await assertState([parent])).toBe(initialCapacity)
  expect(await writes(page)).toHaveLength(attemptsBeforeFailure + 2)

  const secondStep = await addStep('Lag en disposisjon')
  expect(await assertState([secondStep])).toBe(initialCapacity)
  await action('Neste steg gjort').click()
  expect(await assertState([parent])).toBe(initialCapacity)
  await openMenu(page, parent.title)
  await completed().check()
  const ready = { ...parent, completed: true, remainingMinutes: 0 }
  await assertState([ready], doneSummary)
  await expect(row(page, parent.title)).toContainText('Klar til levering')
  await action('Bekreft levert').click()
  await assertState([{ ...ready, submitted: true }], doneSummary)
  await openMenu(page, parent.title)
  await expect(completed()).toBeDisabled()
  await action('Angre levering').click()
  await assertState([ready], doneSummary)
  await openMenu(page, parent.title)
  await completed().uncheck()
  await openMenu(page, parent.title)
  await action('Rediger').click()
  await page.locator('#remainingMinutes').fill('90')
  await save(page).click()
  expect(await assertState([parent])).toBe(initialCapacity)

  const beforeReload = await raw(page)
  await page.reload()
  expect(await assertState([parent])).toBe(initialCapacity)
  expect(await raw(page)).toBe(beforeReload)
  expect(await writes(page)).toEqual([])
})
