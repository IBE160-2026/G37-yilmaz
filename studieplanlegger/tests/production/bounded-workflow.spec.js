import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import ICAL from 'ical.js'
import { navigate, row, openMenu, edit, freeze } from '../e2e/helpers.js'
import { calendarUid } from '../../src/calendar-export.js'

// Synthetic-only extension of the existing production harness. Run create,
// recreate the owned SQLite service with its same volume, then run restore in a
// fresh browser. No external source or user storage participates.
const phase = process.env.STUDIEPLAN_ACCEPTANCE_PHASE || 'create'
const snapshotPath = process.env.STUDIEPLAN_ACCEPTANCE_SNAPSHOT
const base = { id: 'production-bounded', title: 'Syntetisk avgrenset arbeidsflyt', course: '', deadlineLocal: '2026-10-25', estimatedMinutes: 90, remainingMinutes: 60, completed: false }
const other = { ...base, id: 'production-other', title: 'Syntetisk tvetydig frist', deadlineLocal: '2026-10-25T02:30' }
const topic = { id: 'production-topic', taskId: base.id, title: 'Syntetisk gjenbrukt tema', examDate: '2026-10-30' }
const reviewTitle = 'Syntetisk Æ-tema, med; tegn \\ og\nlinjeskift'
const readState = async page => { const response = await page.request.get('/api/state'); expect(response.ok()).toBe(true); return response.json() }
async function put(page, envelope) {
  const before = await readState(page)
  const response = await page.request.put('/api/state', { data: { expectedRevision: before.revision, envelope } })
  expect(response.ok()).toBe(true); await page.reload()
}
async function steps(page) {
  await navigate(page, 'all'); await openMenu(page, base.title)
  await row(page, base.title).getByRole('button', { name: /Administrer arbeidssteg/ }).click()
  return page.locator('.work-steps-dialog')
}
async function assessment(page) {
  await navigate(page, 'all'); await openMenu(page, base.title)
  await row(page, base.title).getByRole('button', { name: /Registrer arbeid/ }).click()
  const dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' })
  await dialog.getByText('Valgfri egenvurdering', { exact: true }).click()
  return dialog
}

test('bounded production create: mixed steps, reused date, actual assessment context and ICS persist in SQLite', async ({ page }, info) => {
  test.skip(phase !== 'create')
  await freeze(page, '2026-10-02T12:00:00+02:00')
  await page.goto('/')
  expect(await page.evaluate(() => globalThis.__STUDIEPLAN_API__)).toBe(true)
  expect((await readState(page)).envelope.tasks).toEqual([])
  const archived = { id: 'production-archived', dateLocal: '2026-10-01', startTime: '09:00', endTime: '09:30' }
  const cross = { id: 'production-cross', taskId: other.id, dateLocal: '2026-10-24', startTime: '10:00', endTime: '10:30' }
  const initial = { schemaVersion: 1, onboarding: { dismissed: true, completed: true }, tasks: [{ ...base,
    nextStep: { description: 'Syntetisk eldre steg', estimatedMinutes: 15 }, steps: [
      { id: 'production-bounded:legacy-next-step', title: 'Syntetisk forutsetning', completed: false, notes: 'Bevart notat' },
      { id: 'production-dependent', title: 'Syntetisk avhengig steg', completed: false, dependencyIds: ['production-bounded:legacy-next-step'] },
    ],
  }, other], topics: [topic, { id: 'production-review-topic', title: reviewTitle }],
    assessments: [
      { id: 'production-history-rating', topicId: topic.id, sessionId: archived.id, rating: 4, assessedAt: '2026-10-01T07:30:00Z' },
      { id: 'production-cross-rating', topicId: topic.id, sessionId: cross.id, rating: 3, assessedAt: '2026-10-01T08:00:00Z' },
      { id: 'production-review-owner', topicId: topic.id, rating: 2, assessedAt: '2026-10-01T08:00:00Z' },
      { id: 'production-context-consumer', topicId: 'production-review-topic', sessionId: 'production-referenced-review', rating: 4, assessedAt: '2026-10-01T08:30:00Z' },
    ],
    sessions: [cross, { id: 'production-review', reviewTopicId: 'production-review-topic', dateLocal: '2026-10-25', startTime: '10:00', endTime: '10:30' },
      { id: 'production-referenced-review', reviewKey: 'review:production-topic:production-review-owner', reviewTopicId: topic.id, dateLocal: '2026-10-26', startTime: '10:00', endTime: '10:30' }],
    reviewDecisions: [{ id: 'production-referenced-decision', assessmentId: 'production-review-owner', sessionId: 'production-referenced-review', reviewKey: 'review:production-topic:production-review-owner', status: 'approved', decidedAt: '2026-10-01T08:00:00Z' }],
    workLogs: [{ id: 'production-log', operationId: 'production-archived-close', taskId: base.id, sessionId: archived.id, outcome: 'more', at: '2026-10-01T07:30:00Z', actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 60, interrupted: false, historyComplete: false, taskSnapshot: base, sessionSnapshot: archived }],
    planner: { courses: [], events: [], sources: [] },
  }
  await put(page, initial)
  const original = await readState(page), dialog = await steps(page)
  await expect(dialog.locator('.work-step-list > li')).toHaveCount(3)
  expect(await readState(page)).toEqual(original)
  await dialog.locator('[data-step-id="production-bounded:legacy-next-step"]').getByRole('button', { name: 'Fjern', exact: true }).click()
  await expect(dialog.locator('.work-step-error')).toContainText('Syntetisk avhengig steg')
  expect(await readState(page)).toEqual(original)
  await dialog.locator('[data-step-id="production-bounded:legacy-next-step:2"]').getByRole('button', { name: 'Marker fullført' }).click()
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  let changed = await readState(page)
  expect(changed.revision).toBe(original.revision + 1)
  expect(changed.envelope.tasks[0]).not.toHaveProperty('nextStep')
  expect(changed.envelope.tasks[0].steps.slice(0, 2)).toEqual(initial.tasks[0].steps)
  expect(changed.envelope.tasks[0].steps[2]).toMatchObject({ id: 'production-bounded:legacy-next-step:2', title: 'Syntetisk eldre steg', completed: true })
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  expect((await readState(page)).envelope.tasks).toEqual(initial.tasks)
  const reopened = await steps(page)
  await reopened.locator('[data-step-id="production-bounded:legacy-next-step:2"]').getByRole('button', { name: 'Marker fullført' }).click()
  await reopened.getByRole('button', { name: 'Lagre alle steg' }).click()
  const assessmentDialog = await assessment(page)
  await expect(assessmentDialog.locator('[data-assessment-context=saved]').filter({ hasText: 'Historisk økt' })).toContainText('Uten oppgave')
  await expect(assessmentDialog.locator('[data-assessment-context=saved]').filter({ hasText: 'Tilknyttet økt' })).toContainText(other.title)
  await assessmentDialog.locator('[name=topicTitle]').fill(topic.title)
  await expect(assessmentDialog.locator('[name=topicExamDate]')).toHaveValue(topic.examDate)
  await assessmentDialog.locator('[name=topicExamDate]').fill('')
  await assessmentDialog.locator('[name=rating]').selectOption('4')
  await assessmentDialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  changed = await readState(page)
  expect(changed.envelope.topics[0]).not.toHaveProperty('examDate')
  expect(changed.envelope.topics[1]).toEqual(initial.topics[1])
  expect(changed.envelope.assessments.slice(0, initial.assessments.length)).toEqual(initial.assessments)
  // Clearing shared settings cannot invalidate another topic's assessment by
  // deleting the live review session it already uses as independent context.
  expect(changed.envelope.reviewDecisions).toEqual(initial.reviewDecisions)
  expect(changed.envelope.sessions).toEqual(initial.sessions)
  expect(changed.envelope.assessments.at(-1)).not.toHaveProperty('sessionId')
  expect(changed.envelope.workLogs[0]).toEqual(initial.workLogs[0])
  await navigate(page, 'calendar')
  await page.locator('#full-calendar-date').fill('2026-10-25'); await page.locator('#full-calendar-date').dispatchEvent('change')
  await page.locator('[data-calendar-view=day]').click()
  await page.clock.runFor(500)
  let beforeExport = await readState(page)
  await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
  const exporting = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
  await expect(exporting.locator('[data-export-status]')).toContainText('2 aktiviteter blir eksportert. 1 frist er utelatt.')
  await expect(exporting.locator('[data-export-omissions]')).toContainText(other.title)
  expect(await readState(page)).toEqual(beforeExport)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390) await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
    await exporting.getByRole('button', { name: 'Last ned .ics' }).focus()
    expect(await exporting.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`bounded-production-export-${width}.png`), fullPage: true })
  }
  // Settle calendar scroll preferences caused by resizing before measuring the
  // export action's exact no-write contract.
  await page.clock.runFor(500)
  beforeExport = await readState(page)
  const download = page.waitForEvent('download')
  await exporting.getByRole('button', { name: 'Last ned .ics' }).press('Enter')
  const source = await readFile(await (await download).path(), 'utf8')
  const events = new ICAL.Component(ICAL.parse(source)).getAllSubcomponents('vevent')
  expect(events).toHaveLength(2)
  expect(events.find(event => event.getFirstPropertyValue('uid') === calendarUid('session', 'production-review')).getFirstPropertyValue('summary')).toBe(`Repetisjon: ${reviewTitle}`)
  expect(await readState(page)).toEqual(beforeExport)
  await page.reload(); expect(await readState(page)).toEqual(beforeExport)
  await writeFile(snapshotPath, JSON.stringify(beforeExport, null, 2))
})

test('bounded production restore: fresh context after recreation, exact backup restore and recovery', async ({ page, browser }, info) => {
  test.skip(phase !== 'restore')
  const expected = JSON.parse(await readFile(snapshotPath, 'utf8'))
  await page.goto('/')
  expect(await page.evaluate(() => localStorage.getItem('studieplanlegger:v1'))).toBeNull()
  expect(await readState(page)).toEqual(expected)
  const dialog = await steps(page)
  await expect(dialog.locator('.work-step-list > li')).toHaveCount(3)
  await expect(dialog.locator('[data-step-id="production-bounded:legacy-next-step:2"]')).toContainText('Fullført')
  await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click()
  const contexts = await assessment(page)
  await expect(contexts.locator('[data-assessment-context=saved]').filter({ hasText: 'Historisk økt' })).toContainText('Uten oppgave')
  await contexts.getByRole('button', { name: 'Avbryt', exact: true }).click()
  await navigate(page, 'settings')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
  const backup = await readFile(await (await downloading).path()), portable = JSON.parse(backup).data
  for (const field of ['tasks', 'topics', 'assessments', 'sessions', 'reviewDecisions', 'workLogs', 'history']) expect(portable[field]).toEqual(expected.envelope[field])
  await navigate(page, 'all'); await openMenu(page, base.title); await edit(page, base.title).click()
  await page.locator('#title').fill('Syntetisk mellomliggende tittel')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  const intervening = await readState(page)
  await navigate(page, 'settings')
  await page.locator('#backup-file').setInputFiles({ name: 'synthetic-bounded-backup.json', mimeType: 'application/json', buffer: backup })
  await page.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
  await expect(page.locator('#settings-panel [role=status]')).toContainText('Sikkerhetskopien er gjenopprettet')
  const restored = await readState(page)
  expect(restored.envelope).toEqual(portable); expect(restored.revision).toBe(expected.revision + 2)
  const recovery = await page.request.get('/api/state/recovery')
  expect((await recovery.json()).recovery.data).toEqual(intervening.envelope)
  const fresh = await browser.newContext({ baseURL: new URL(page.url()).origin, timezoneId: 'Europe/Oslo' })
  try { const clean = await fresh.newPage(); await clean.goto('/'); expect(await readState(clean)).toEqual(restored) } finally { await fresh.close() }
  await info.attach('bounded-exact-persistence', { contentType: 'application/json', body: JSON.stringify({ beforeRecreation: expected.revision, afterRestore: restored.revision, exactEnvelope: true }) })
})
