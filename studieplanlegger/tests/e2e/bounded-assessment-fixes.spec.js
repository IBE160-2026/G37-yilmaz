import { test, expect } from '@playwright/test'
import { freeze, key, navigate, row, raw, saved, instrumentWrites, writes, tabTo } from './helpers.js'

// All names and identifiers in these fixtures are synthetic.
const task = { id: 'bounded-task', title: 'Syntetisk vurderingsoppgave', course: '', deadlineLocal: '2026-10-10T12:00', estimatedMinutes: 90, remainingMinutes: 90, completed: false }
const otherTask = { ...task, id: 'other-task', title: 'Syntetisk annen oppgave' }
const topic = { id: 'bounded-topic', taskId: task.id, title: 'Syntetisk delt tema', examDate: '2026-10-10' }
const historical = { id: 'old-assessment', topicId: topic.id, rating: 4, assessedAt: '2026-09-26T08:00:00Z' }
const actual = { id: 'actual-session', taskId: task.id, dateLocal: '2026-09-28', startTime: '10:00', endTime: '10:30' }
const base = () => ({ schemaVersion: 1, tasks: [task, otherTask], topics: [topic], assessments: [historical], sessions: [], onboarding: { dismissed: true, completed: true } })
const dialogFor = page => page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' })

async function seedState(page, state, view = 'all') {
  await freeze(page, '2026-09-28T12:00:00+02:00')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await instrumentWrites(page)
  await page.reload()
  await navigate(page, view)
}

async function openAssessment(page) {
  const taskRow = row(page, task.title)
  await taskRow.locator('.task-menu > summary').click()
  await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  const dialog = dialogFor(page)
  await dialog.getByText('Valgfri egenvurdering', { exact: true }).click()
  return dialog
}

test('reused-topic preview frees its invalidated old review and saves the same single-window time', async ({ page }) => {
  const oldReview = { ...actual, id: 'old-review', dateLocal: '2026-10-01', reviewKey: `review:${topic.id}:${historical.id}`, reviewTopicId: topic.id }
  const initial = { ...base(), sessions: [oldReview], reviewDecisions: [{ id: 'old-decision', reviewKey: oldReview.reviewKey, assessmentId: historical.id, status: 'approved', sessionId: oldReview.id, decidedAt: historical.assessedAt }],
    workWindows: [{ id: 'single-window', start: '2026-10-01T08:00:00Z', end: '2026-10-01T08:30:00Z' }] }
  await seedState(page, initial)
  const dialog = await openAssessment(page)
  await dialog.locator('[name=topicTitle]').fill(topic.title)
  await dialog.locator('[name=rating]').selectOption('2')
  await dialog.locator('[name=topicExamDate]').fill('2026-10-09')
  await expect(dialog.locator('[data-review] > .muted')).toContainText('Foreslått kollisjonsfri tid: 2026-10-01 kl. 10:00–10:30')
  await dialog.locator('[name=reviewStatus]').selectOption('approved')
  await expect(dialog.locator('[name=reviewDate]')).toHaveValue('2026-10-01')
  await expect(dialog.locator('[name=reviewStart]')).toHaveValue('10:00')
  await expect(dialog.locator('[name=reviewEnd]')).toHaveValue('10:30')
  expect(await writes(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  await expect(dialog).not.toBeVisible()
  const result = await saved(page)
  expect(result.sessions).toHaveLength(1)
  expect(result.sessions[0]).toMatchObject({ dateLocal: '2026-10-01', startTime: '10:00', endTime: '10:30' })
  expect(result.sessions[0].id).not.toBe(oldReview.id)
  expect(result.assessments[0]).toEqual(historical)
  expect(await writes(page)).toHaveLength(1)
})

for (const change of ['date', 'topic']) test(`changing ${change} clears an obsolete automatic review time and approval before save`, async ({ page }) => {
  const initial = { ...base(), workWindows: [{ id: 'window', start: '2026-10-01T08:00:00Z', end: '2026-10-01T10:00:00Z' }] }
  await seedState(page, initial)
  const before = await raw(page), dialog = await openAssessment(page)
  await dialog.locator('[name=topicTitle]').fill(topic.title)
  await dialog.locator('[name=rating]').selectOption('2')
  await dialog.locator('[name=reviewStatus]').selectOption('approved')
  await expect(dialog.locator('[name=reviewDate]')).toHaveValue('2026-10-01')
  if (change === 'date') await dialog.locator('[name=topicExamDate]').fill('')
  else await dialog.locator('[name=topicTitle]').fill('Nytt syntetisk tema uten dato')
  await dialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  await expect(dialog).toBeVisible()
  expect(await raw(page)).toBe(before)
  expect(await writes(page)).toEqual([])
  await expect(dialog.locator('[name=reviewStatus]')).toHaveValue('')
  for (const field of ['reviewDate', 'reviewStart', 'reviewEndDate', 'reviewEnd']) await expect(dialog.locator(`[name=${field}]`)).toHaveValue('')
  await expect(dialog.locator('[role=alert]')).toContainText('Velg om repetisjonen')
})

test('changing topic settings keeps explicitly edited review times and requires a fresh decision', async ({ page }) => {
  await seedState(page, { ...base(), workWindows: [{ id: 'window', start: '2026-10-01T08:00:00Z', end: '2026-10-01T10:00:00Z' }] })
  const dialog = await openAssessment(page)
  await dialog.locator('[name=topicTitle]').fill(topic.title)
  await dialog.locator('[name=rating]').selectOption('2')
  await dialog.locator('[name=reviewStatus]').selectOption('adjusted')
  await dialog.locator('[name=reviewStart]').fill('11:00')
  await dialog.locator('[name=reviewEnd]').fill('11:30')
  await dialog.locator('[name=topicExamDate]').fill('')
  await expect(dialog.locator('[name=reviewStatus]')).toHaveValue('')
  await dialog.locator('[name=reviewStatus]').selectOption('adjusted')
  await expect(dialog.locator('[name=reviewDate]')).toHaveValue('2026-10-01')
  await expect(dialog.locator('[name=reviewStart]')).toHaveValue('11:00')
  await expect(dialog.locator('[name=reviewEnd]')).toHaveValue('11:30')
  await dialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  await expect(dialog).not.toBeVisible()
  expect((await saved(page)).sessions[0]).toMatchObject({ dateLocal: '2026-10-01', startTime: '11:00', endTime: '11:30' })
})

test('reused topic date-clear keeps its draft after rejected save and retries as one atomic change', async ({ page }) => {
  await seedState(page, base())
  const before = await raw(page), dialog = await openAssessment(page)
  await dialog.locator('[name=topicTitle]').fill(topic.title)
  await dialog.locator('[name=topicExamDate]').fill('')
  await dialog.locator('[name=rating]').selectOption('4')
  await page.evaluate(() => { window.failWrite = true })
  await dialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[role=alert]')).not.toBeEmpty()
  expect(await raw(page)).toBe(before)
  await expect(dialog.locator('[name=topicTitle]')).toHaveValue(topic.title)
  await expect(dialog.locator('[name=topicExamDate]')).toHaveValue('')
  await expect(dialog.locator('[name=rating]')).toHaveValue('4')
  expect(await writes(page)).toHaveLength(1)
  await page.evaluate(() => { window.failWrite = false })
  await dialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  await expect(dialog).not.toBeVisible()
  const result = await saved(page)
  expect(result.topics).toHaveLength(1); expect(result.topics[0]).not.toHaveProperty('examDate')
  expect(result.assessments).toHaveLength(2); expect(result.assessments[0]).toEqual(historical)
  expect(result.workLogs).toHaveLength(1)
  const attempts = await writes(page)
  expect(attempts).toHaveLength(2)
  expect(attempts[1].previous).toBe(before)
  expect(attempts[1].value).toBe(await raw(page))
  await page.reload()
  expect((await saved(page)).assessments).toEqual(result.assessments)
  expect((await saved(page)).workLogs).toEqual(result.workLogs)
})

for (const clear of [false, true]) test(`reusing a topic ${clear ? 'explicitly clears' : 'preserves the prefilled'} exam date with atomic undo and reload`, async ({ page }) => {
  const completedSession = { ...actual, id: 'completed-review', dateLocal: '2026-09-26', reviewKey: `review:${topic.id}:${historical.id}`, reviewTopicId: topic.id }
  const completedDecision = { id: 'completed-decision', assessmentId: historical.id, reviewKey: completedSession.reviewKey, sessionId: completedSession.id, status: 'approved', decidedAt: historical.assessedAt }
  const futureAssessment = { ...historical, id: 'future-assessment', rating: 2 }
  const future = { ...actual, id: 'future-review', dateLocal: '2026-10-01', reviewKey: `review:${topic.id}:${futureAssessment.id}`, reviewTopicId: topic.id }
  const initial = { ...base(), topics: [topic, { ...topic, id: 'unrelated', title: 'Uavhengig tema', examDate: '2026-11-10' }], assessments: [historical, futureAssessment],
    sessions: [future], reviewDecisions: [completedDecision, { ...completedDecision, id: 'future-decision', assessmentId: futureAssessment.id, reviewKey: future.reviewKey, sessionId: future.id }],
    workLogs: [{ id: 'old-log', operationId: 'old-close', taskId: task.id, sessionId: completedSession.id, at: '2026-09-26T08:30:00Z', outcome: 'done', actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 90, interrupted: false, historyComplete: false, taskSnapshot: task, sessionSnapshot: completedSession }] }
  await seedState(page, initial)
  const dialog = await openAssessment(page)
  await dialog.locator('[name=topicTitle]').fill(topic.title.toUpperCase())
  await expect(dialog.locator('[name=topicExamDate]')).toHaveValue(topic.examDate)
  await expect(dialog.locator('[data-reused-topic]')).toContainText('Eksisterende tema')
  if (clear) await dialog.locator('[name=topicExamDate]').fill('')
  await dialog.locator('[name=rating]').selectOption('4')
  expect(await writes(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  await expect(dialog).not.toBeVisible()
  const result = await saved(page)
  expect(result.topics[0].examDate).toBe(clear ? undefined : topic.examDate)
  expect(result.topics[1]).toEqual(initial.topics[1])
  expect(result.assessments.slice(0, 2)).toEqual(initial.assessments)
  expect(result.assessments.at(-1)).toMatchObject({ topicId: topic.id, rating: 4 })
  expect(result.assessments.at(-1)).not.toHaveProperty('sessionId')
  expect(result.workLogs[0]).toEqual(initial.workLogs[0])
  expect(result.reviewDecisions).toEqual(clear ? [completedDecision] : initial.reviewDecisions)
  expect(result.sessions).toEqual(clear ? [] : initial.sessions)
  expect(await writes(page)).toHaveLength(1)
  await page.reload()
  expect((await saved(page)).assessments).toEqual(result.assessments)
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const restored = await saved(page)
  for (const field of ['tasks', 'topics', 'assessments', 'sessions', 'reviewDecisions', 'workLogs']) expect(restored[field]).toEqual(initial[field])
})

test('switching reused topics reloads destination settings and cancellation leaves every topic unchanged', async ({ page }) => {
  const initial = { ...base(), topics: [topic, { ...topic, id: 'second-topic', title: 'Syntetisk annet tema', examDate: '2026-11-20', reviewSuggestionsDisabled: true }] }
  await seedState(page, initial)
  const dialog = await openAssessment(page)
  await dialog.locator('[name=topicTitle]').fill(topic.title)
  await dialog.locator('[name=topicExamDate]').fill('')
  await dialog.locator('[name=topicTitle]').fill('Syntetisk annet tema')
  await expect(dialog.locator('[name=topicExamDate]')).toHaveValue('2026-11-20')
  await expect(dialog.locator('[name=disableReview]')).toBeChecked()
  await dialog.locator('[name=topicTitle]').fill(topic.title)
  await expect(dialog.locator('[name=topicExamDate]')).toHaveValue(topic.examDate)
  await expect(dialog.locator('[name=disableReview]')).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click()
  expect((await saved(page)).topics).toEqual(initial.topics)
  expect(await writes(page)).toEqual([])
})

for (const action of ['exam', 'disabled', 'rating', 'delete']) test(`existing assessment ${action} preserves another topic's independent session context and undo`, async ({ page }) => {
  const owner = { ...historical, rating: 2 }
  const review = { ...actual, id: 'referenced-review', dateLocal: '2026-10-01', reviewKey: `review:${topic.id}:${owner.id}`, reviewTopicId: topic.id }; delete review.taskId
  const independent = { ...historical, id: 'independent-assessment', topicId: 'independent-topic', sessionId: review.id }
  const initial = { ...base(), topics: [topic, { id: 'independent-topic', title: 'Uavhengig tema uten oppgave' }], assessments: [owner, independent], sessions: [review],
    reviewDecisions: [{ id: 'owner-decision', reviewKey: review.reviewKey, assessmentId: owner.id, status: 'approved', sessionId: review.id, decidedAt: owner.assessedAt }] }
  await seedState(page, initial)
  const dialog = await openAssessment(page)
  if (action === 'exam') await dialog.getByLabel(`Eksamensdato for ${topic.title}`, { exact: true }).fill('')
  if (action === 'disabled') await dialog.getByLabel('Ikke foreslå repetisjon', { exact: true }).check()
  if (action === 'rating') await dialog.getByLabel(`Vurdering av ${topic.title}`, { exact: true }).selectOption('4')
  if (action === 'exam') await expect(dialog.getByLabel(`Beslutning for ${topic.title}`, { exact: true })).not.toBeVisible()
  await dialog.getByRole('button', { name: action === 'delete' ? 'Slett vurdering' : 'Lagre vurdering', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const result = await saved(page)
  expect(result.assessments.find(value => value.id === independent.id)).toEqual(independent)
  if (['exam', 'disabled'].includes(action)) {
    expect(result.assessments).toEqual(initial.assessments)
    expect(result.sessions).toEqual(initial.sessions)
    expect(result.reviewDecisions).toEqual(initial.reviewDecisions)
    if (action === 'exam') expect(result.topics[0]).not.toHaveProperty('examDate')
    else expect(result.topics[0].reviewSuggestionsDisabled).toBe(true)
  } else {
    const { reviewKey, ...preservedSession } = review
    expect(result.sessions).toEqual([preservedSession])
    expect(result.reviewDecisions).toEqual([])
    if (action === 'delete') expect(result.assessments).toEqual([independent])
    else expect(result.assessments[0]).toEqual({ ...owner, rating: 4 })
  }
  expect(await writes(page)).toHaveLength(1)
  await page.reload()
  for (const field of ['topics', 'assessments', 'sessions', 'reviewDecisions']) expect((await saved(page))[field]).toEqual(result[field])
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const restored = await saved(page)
  for (const field of ['topics', 'assessments', 'sessions', 'reviewDecisions']) expect(restored[field]).toEqual(initial[field])
})

for (const width of [1440, 390]) test(`actual closeout session and cross-task historical contexts remain visible at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 })
  const crossSession = { ...actual, id: 'cross-task-session', taskId: otherTask.id, dateLocal: '2026-09-26' }
  const tasklessSession = { ...actual, id: 'taskless-session', dateLocal: '2026-09-25' }; delete tasklessSession.taskId
  const liveCross = { ...crossSession, id: 'live-cross-task', dateLocal: '2026-09-29' }
  const log = (session, logTask) => ({ id: `log-${session.id}`, operationId: `close-${session.id}`, taskId: logTask.id, sessionId: session.id, outcome: 'more', at: `${session.dateLocal}T08:30:00Z`, actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 90, interrupted: false, historyComplete: false, taskSnapshot: logTask, sessionSnapshot: session })
  const assessments = [historical, { ...historical, id: 'cross-assessment', sessionId: crossSession.id }, { ...historical, id: 'taskless-assessment', sessionId: tasklessSession.id }, { ...historical, id: 'live-cross-assessment', sessionId: liveCross.id }]
  const initial = { ...base(), tasks: [task, { ...otherTask, title: 'Nåværende navn på annen oppgave' }], assessments, sessions: [actual, { ...actual, id: 'more-recent-session', startTime: '11:00', endTime: '11:30' }, liveCross], workLogs: [log(crossSession, otherTask), log(tasklessSession, task)] }
  await seedState(page, initial, 'overview')
  if (width === 390) await page.addStyleTag({ content: 'html { font-size: 24px; }' })
  const dailyRow = page.locator('[data-daily-row="task:bounded-task"]')
  await dailyRow.locator('summary').click()
  await dailyRow.getByRole('button', { name: 'Avslutt økt 10:00–10:30', exact: true }).click()
  const dialog = dialogFor(page)
  await dialog.getByText('Valgfri egenvurdering', { exact: true }).click()
  await expect(dialog.locator('[data-assessment-context=current]')).toHaveText('Tilknyttet økt: 2026-09-28 kl. 10:00–10:30 · Oppgave: Syntetisk vurderingsoppgave.')
  await expect(dialog.locator('[data-assessment-context=saved]').filter({ hasText: 'Historisk økt: 2026-09-26' })).toHaveText('Historisk økt: 2026-09-26 kl. 10:00–10:30 · Oppgave: Syntetisk annen oppgave.')
  await expect(dialog.locator('[data-assessment-context=saved]').filter({ hasText: 'Historisk økt: 2026-09-25' })).toHaveText('Historisk økt: 2026-09-25 kl. 10:00–10:30 · Uten oppgave.')
  await expect(dialog.locator('[data-assessment-context=saved]').filter({ hasText: 'Tilknyttet økt: 2026-09-29' })).toContainText('Nåværende navn på annen oppgave')
  expect(await writes(page)).toEqual([])
  const context = dialog.locator('[data-assessment-context=saved]').filter({ hasText: 'Historisk økt: 2026-09-26' })
  await context.scrollIntoViewIfNeeded()
  const bounds = await context.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
  await page.screenshot({ path: testInfo.outputPath(`assessment-context-${width}.png`), fullPage: true })
  await dialog.locator('[name=topicTitle]').fill(topic.title)
  await dialog.locator('[name=rating]').selectOption('4')
  await tabTo(page, dialog.getByRole('button', { name: 'Lagre utfallet' }))
  await page.keyboard.press('Enter')
  await expect(dialog).not.toBeVisible()
  const result = await saved(page)
  expect(result.assessments.slice(0, 4)).toEqual(assessments)
  expect(result.assessments.at(-1).sessionId).toBe(actual.id)
  expect(result.workLogs.at(-1).sessionSnapshot).toEqual(actual)
  expect(result.sessions.map(value => value.id)).toEqual(['more-recent-session', liveCross.id])
  expect(await writes(page)).toHaveLength(1)
  await page.reload(); await navigate(page, 'all')
  const reopened = await openAssessment(page)
  await expect(reopened.locator('[data-assessment-context=saved]').filter({ hasText: 'Historisk økt: 2026-09-28' })).toContainText('10:00–10:30')
  await reopened.getByRole('button', { name: 'Avbryt', exact: true }).click()
})
