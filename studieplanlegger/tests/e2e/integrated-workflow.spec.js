import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { seed, row, saved, freeze, navigate, key } from './helpers.js'

const base = { id: 'integrated', title: 'Integrert oppgave', course: 'IBE160', deadlineLocal: '2026-10-10T12:00', estimatedMinutes: 120, remainingMinutes: 90, completed: false }

async function seedState(page, state, view) {
  await freeze(page, '2026-09-28T12:00:00+02:00')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload()
  await navigate(page, view)
}

for (const setting of ['exam', 'disabled']) test(`topic ${setting} change reconciles every future reservation but preserves completed review history and undo`, async ({ page }) => {
  const topic = { id: 't', title: 'Shared topic', taskId: base.id, examDate: '2026-10-10' }
  const assessments = [{ id: 'a', topicId: 't', rating: 4, assessedAt: '2026-09-26T08:00:00Z' }, { id: 'b', topicId: 't', rating: 2, assessedAt: '2026-09-27T08:00:00Z' }]
  const completed = { id: 'completed', taskId: base.id, reviewKey: 'review:t:a', reviewTopicId: 't', dateLocal: '2026-09-27', startTime: '10:00', endTime: '10:30' }
  const decisions = assessments.map((assessment, index) => ({ id: `d${index}`, assessmentId: assessment.id, reviewKey: `review:t:${assessment.id}`, sessionId: index ? 'future' : 'completed', status: 'approved', decidedAt: '2026-09-26T08:01:00Z' }))
  const workLogs = [{ id: 'log', operationId: 'close-completed', taskId: base.id, sessionId: 'completed', outcome: 'done', at: '2026-09-27T08:30:00Z', actualMinutes: 30, plannedMinutes: 30, remainingMinutes: 90, interrupted: false, historyComplete: false, taskSnapshot: base, sessionSnapshot: completed }]
  const initial = { schemaVersion: 1, tasks: [base], topics: [topic], assessments, reviewDecisions: decisions, workLogs, sessions: [{ ...completed, id: 'future', reviewKey: 'review:t:b', dateLocal: '2026-10-01' }], onboarding: { dismissed: true, completed: true } }
  await seedState(page, initial, 'all')
  const taskRow = row(page, base.title); await taskRow.locator('.task-menu > summary').click(); await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  const dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' })
  await dialog.getByText('Valgfri egenvurdering').click()
  if (setting === 'exam') await dialog.getByLabel('Eksamensdato for Shared topic').first().fill('2026-10-09')
  else await dialog.getByLabel('Ikke foreslå repetisjon', { exact: true }).first().check()
  await dialog.getByRole('button', { name: 'Lagre vurdering' }).first().click()
  const changed = await saved(page)
  expect(changed.assessments).toEqual(assessments)
  expect(changed.workLogs).toEqual(workLogs)
  expect(changed.reviewDecisions).toEqual([decisions[0]])
  expect(changed.sessions).toEqual([])
  await navigate(page, 'settings'); await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const restored = await saved(page)
  for (const field of ['topics', 'assessments', 'reviewDecisions', 'sessions', 'workLogs']) expect(restored[field]).toEqual(initial[field])
})

test('a due deferred review can be decided through the existing assessment controls without changing its rating', async ({ page }) => {
  await seedState(page, { schemaVersion: 1, tasks: [base], topics: [{ id: 't', title: 'Deferred topic', taskId: base.id }], assessments: [{ id: 'a', topicId: 't', rating: 2, assessedAt: '2026-09-26T08:00:00Z' }], reviewDecisions: [{ id: 'd', assessmentId: 'a', reviewKey: 'review:t:a', status: 'deferred', deferUntil: '2026-09-27', decidedAt: '2026-09-26T08:01:00Z' }], onboarding: { dismissed: true, completed: true } }, 'all')
  const taskRow = row(page, base.title); await taskRow.locator('.task-menu > summary').click(); await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  const dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' }); await dialog.getByText('Valgfri egenvurdering').click()
  await expect(dialog.getByLabel('Beslutning for Deferred topic')).toBeVisible()
  await dialog.getByLabel('Beslutning for Deferred topic').selectOption('rejected')
  await dialog.getByRole('button', { name: 'Lagre vurdering' }).click()
  const result = await saved(page)
  expect(result.assessments[0].rating).toBe(2)
  expect(result.reviewDecisions[0].status).toBe('rejected')
})

test('existing assessment adjustment supports an explicit overnight review and atomic undo, and creation offers all five ratings', async ({ page }) => {
  const assessment = { id: 'a', topicId: 't', rating: 4, assessedAt: '2026-09-26T08:00:00Z' }
  await seedState(page, { schemaVersion: 1, tasks: [base], topics: [{ id: 't', title: 'Night topic', taskId: base.id, examDate: '2026-10-10' }], assessments: [assessment], onboarding: { dismissed: true, completed: true } }, 'all')
  const taskRow = row(page, base.title); await taskRow.locator('.task-menu > summary').click(); await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  const dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' }); await dialog.getByText('Valgfri egenvurdering').click()
  expect(await dialog.locator('[name=rating] option').evaluateAll(options => options.map(option => option.value))).toEqual(['', '1', '2', '3', '4', '5'])
  await dialog.getByLabel('Vurdering av Night topic').selectOption('2')
  await dialog.getByLabel('Beslutning for Night topic').selectOption('adjusted')
  await dialog.getByLabel('Repetisjonsdato for Night topic').fill('2026-09-29')
  await dialog.getByLabel('Repetisjonsstart for Night topic').fill('23:00')
  await dialog.getByLabel('Repetisjonssluttdato for Night topic (ved nattøkt)').fill('2026-09-30')
  await dialog.getByLabel('Repetisjonsslutt for Night topic', { exact: true }).fill('00:30')
  await dialog.getByRole('button', { name: 'Lagre vurdering' }).click()
  const updated = await saved(page)
  expect(updated.sessions[0]).toMatchObject({ dateLocal: '2026-09-29', startTime: '23:00', endDateLocal: '2026-09-30', endTime: '00:30' })
  expect(updated.reviewDecisions[0].status).toBe('adjusted')
  await navigate(page, 'settings'); await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const restored = await saved(page)
  expect(restored.assessments).toEqual([assessment]); expect(restored.sessions || []).toEqual([]); expect(restored.reviewDecisions || []).toEqual([])
})

test('bulk editor keeps stable manual and categorized document steps until one approval', async ({ page }) => {
  await seed(page, [base], { view: 'all' })
  await row(page, base.title).locator('.task-menu > summary').click()
  await row(page, base.title).getByRole('button', { name: /Administrer arbeidssteg/ }).click()
  const dialog = page.locator('.work-steps-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Legg til manuelt steg' }).click()
  await dialog.getByLabel('Navn på steg 1').fill('Lag disposisjon')
  await dialog.getByLabel('Minutter for steg 1').fill('20')
  await dialog.getByText('Foreslå steg fra tekst eller dokumentutdrag').click()
  await dialog.getByLabel('Lokalt dokumentutdrag').fill('Krav: Lever kildekode\nMetode: Parprogrammering\nUklart eksamenstidspunkt')
  await dialog.getByRole('button', { name: 'Forbered forslag' }).click()
  await expect(dialog.getByText('Krav: Lever kildekode')).toBeVisible()
  await dialog.getByText('Metode: Parprogrammering').locator('input').check()
  await dialog.getByText('Krav: Lever kildekode').locator('input').uncheck()
  await dialog.getByRole('button', { name: 'Marker fullført' }).click()
  await dialog.getByLabel('Navn på steg 1').fill('Redigert etter fullføring')
  await dialog.getByLabel('Minutter for steg 1').fill('25')
  await dialog.getByRole('button', { name: 'Legg til manuelt steg' }).click()
  await dialog.locator('.work-step-list > li').nth(1).getByRole('button', { name: 'Fjern' }).click()
  await expect(dialog.getByText('Metode: Parprogrammering').locator('input')).toBeChecked()
  await expect(dialog.getByText('Krav: Lever kildekode').locator('input')).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Legg valgte i utkastet' }).click()
  expect((await saved(page)).tasks[0]).not.toHaveProperty('steps')
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  const state = await saved(page)
  expect(state.tasks[0].remainingMinutes).toBe(90)
  expect(state.tasks[0].steps.map(step => step.title)).toEqual(['Redigert etter fullføring', 'Parprogrammering'])
  expect(state.tasks[0].steps[0]).toMatchObject({ completed: true, estimatedMinutes: 25 })
  expect(state.tasks[0].steps[1].provenance.sourceExcerpt).toContain('Metode:')
})

test('work-step editor reads a local document, offers manual recovery, and blocks broken dependency graphs', async ({ page }) => {
  const task = { ...base, steps: [
    { id: 'existing', title: 'Eksisterende steg', completed: false, dependencyIds: ['prerequisite'], provenance: { kind: 'manual' } },
    { id: 'prerequisite', title: 'Forutsetning', completed: false, provenance: { kind: 'manual' } },
  ] }
  await seedState(page, { schemaVersion: 1, tasks: [task], onboarding: { dismissed: true, completed: true } }, 'all')
  if (!await row(page, task.title).locator('.task-menu').evaluate(node => node.open)) await row(page, task.title).locator('.task-menu > summary').click()
  await row(page, task.title).getByRole('button', { name: /Administrer arbeidssteg/ }).click()
  const dialog = page.locator('.work-steps-dialog')
  await dialog.locator('[data-step-id="existing"]').getByRole('button', { name: 'Marker fullført' }).click()
  await expect(dialog.locator('.work-step-error')).toContainText('forutsetninger først')
  await expect(dialog.locator('[data-step-id="existing"]')).toContainText('Åpent')
  await dialog.getByLabel('Forutsetninger for steg 2').selectOption('existing')
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  await expect(dialog.locator('p[role=alert]:not(.work-step-error)')).toContainText('ugyldig eller sirkulær')
  await dialog.getByLabel('Forutsetninger for steg 2').selectOption([])
  await dialog.locator('[data-step-id="prerequisite"]').getByRole('button', { name: 'Fjern' }).click()
  await expect(dialog.locator('.work-step-error')).toContainText('Eksisterende steg')
  await expect(dialog.locator('.work-step-error')).toContainText('Rediger forutsetningene')
  await expect(dialog.locator('[data-step-id="prerequisite"]')).toBeVisible()
  expect((await saved(page)).tasks[0].steps[0].dependencyIds).toEqual(['prerequisite'])
  await dialog.getByLabel('Forutsetninger for steg 1').selectOption([])
  await dialog.locator('[data-step-id="prerequisite"]').getByRole('button', { name: 'Fjern' }).click()
  await expect(dialog.locator('[data-step-id="prerequisite"]')).toHaveCount(0)
  await dialog.getByText('Foreslå steg fra tekst eller dokumentutdrag').click()
  const file = dialog.getByLabel('Eller velg lokal tekst-, PDF- eller DOCX-fil')
  await file.setInputFiles({ name: 'steg.txt', mimeType: 'text/plain', buffer: Buffer.from('Krav: Test løsningen\nMetode: Bruk parprogrammering') })
  await expect(dialog.getByText('Krav: Test løsningen')).toBeVisible()
  await expect(dialog.getByText('Metode: Bruk parprogrammering')).toBeVisible()
  await dialog.getByText('Metode: Bruk parprogrammering').locator('input').check()
  await dialog.getByRole('button', { name: 'Legg valgte i utkastet' }).click()
  await dialog.getByRole('button', { name: 'Lagre alle steg' }).click()
  expect((await saved(page)).tasks[0].steps.map(step => step.title)).toEqual(['Eksisterende steg', 'Test løsningen', 'Bruk parprogrammering'])

  if (!await row(page, task.title).locator('.task-menu').evaluate(node => node.open)) await row(page, task.title).locator('.task-menu > summary').click()
  await row(page, task.title).getByRole('button', { name: /Administrer arbeidssteg/ }).click()
  const reopened = page.locator('.work-steps-dialog')
  await reopened.locator('.planning-rules > summary').press('Enter')
  await reopened.getByLabel('Lokalt dokumentutdrag').fill('Ulagret lokal tekst')
  await reopened.getByLabel('Eller velg lokal tekst-, PDF- eller DOCX-fil').setInputFiles({ name: 'ukjent.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 2]) })
  await expect(reopened.getByRole('status')).toContainText('legg til steg manuelt')
  const toggle = reopened.locator('[data-step-id="existing"]').getByRole('button', { name: 'Marker fullført' })
  await toggle.click()
  await expect(reopened.locator('.planning-rules')).toHaveAttribute('open', '')
  await expect(reopened.getByLabel('Lokalt dokumentutdrag')).toHaveValue('Ulagret lokal tekst')
  await expect(reopened.locator('[data-step-id="existing"]').getByRole('button', { name: 'Åpne igjen' })).toBeFocused()
  await reopened.locator('[data-step-id="existing"]').getByRole('button', { name: 'Flytt ned' }).click()
  await expect(reopened.locator('[data-step-id="existing"]').getByRole('button', { name: 'Flytt ned' })).toBeFocused()
  await reopened.getByRole('button', { name: 'Lagre alle steg' }).click()
  let state = await saved(page)
  expect(state.tasks[0].steps[0].title).toBe('Test løsningen')
  expect(state.tasks[0].steps.find(step => step.id === 'existing').completed).toBe(true)
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  state = await saved(page)
  expect(state.tasks[0].steps[0].id).toBe('existing')
  expect(state.tasks[0].steps[0].completed).toBe(false)
})

for (const status of ['approved', 'adjusted', 'deferred', 'rejected']) test(`optional self-assessment supports ${status} review decision`, async ({ page }) => {
  await seed(page, [base], { view: 'all' })
  await row(page, base.title).locator('.task-menu > summary').click()
  await row(page, base.title).getByRole('button', { name: /Registrer arbeid/ }).click()
  const dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' })
  await dialog.getByText('Valgfri egenvurdering').click()
  await dialog.locator('[name=topicTitle]').fill('Normalisering')
  await dialog.locator('[name=rating]').selectOption('2')
  await dialog.locator('[name=reviewStatus]').selectOption(status)
  if (['approved', 'adjusted'].includes(status)) {
    await dialog.locator('[name=reviewDate]').fill('2026-10-01')
    await dialog.locator('[name=reviewStart]').fill('10:00')
    await dialog.locator('[name=reviewEnd]').fill('10:30')
  } else if (status === 'deferred') await dialog.locator('[name=deferUntil]').fill('2026-10-02')
  await dialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  const state = await saved(page)
  expect(state.topics).toHaveLength(1); expect(state.assessments).toHaveLength(1)
  expect(state.reviewDecisions[0].status).toBe(status)
  expect(state.sessions || []).toHaveLength(['approved', 'adjusted'].includes(status) ? 1 : 0)
})

test('skipping assessment keeps the existing closeout low friction', async ({ page }) => {
  await seed(page, [base], { view: 'all' })
  await row(page, base.title).locator('.task-menu > summary').click()
  await row(page, base.title).getByRole('button', { name: /Registrer arbeid/ }).click()
  await page.getByRole('button', { name: 'Lagre utfallet' }).click()
  const state = await saved(page)
  expect(state.workLogs).toHaveLength(1)
  expect(state).not.toHaveProperty('assessments')
})

test('low self-rating explains uncertainty and writes nothing until a review decision is complete', async ({ page }) => {
  await seed(page, [base], { view: 'all' })
  const before = await saved(page)
  await row(page, base.title).locator('.task-menu > summary').click()
  await row(page, base.title).getByRole('button', { name: /Registrer arbeid/ }).click()
  const dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' })
  await dialog.getByText('Valgfri egenvurdering').click()
  await dialog.locator('[name=topicTitle]').fill('Datamodell')
  await dialog.locator('[name=rating]').selectOption('1')
  await expect(dialog).toContainText('Eksamensdato er ukjent')
  await expect(dialog).toContainText('ingen kapasitet eller økt legges til automatisk')
  await dialog.getByRole('button', { name: 'Lagre utfallet' }).click()
  await expect(dialog.getByRole('alert')).toContainText('godkjennes, justeres, utsettes eller avvises')
  expect(await saved(page)).toEqual(before)
  await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click()
  expect(await saved(page)).toEqual(before)
})

test('dated self-assessments can be listed, edited, disabled for suggestions, and deleted', async ({ page }) => {
  await seedState(page, { schemaVersion: 1, tasks: [base], topics: [{ id: 'topic-edit', title: 'Normalisering', taskId: base.id }], assessments: [{ id: 'assessment-edit', topicId: 'topic-edit', rating: 5, assessedAt: '2026-09-27T08:00:00Z' }], onboarding: { dismissed: true, completed: true } }, 'all')
  let taskRow = row(page, base.title); await taskRow.locator('.task-menu > summary').click(); await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  let dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' }); await dialog.getByText('Valgfri egenvurdering').click()
  await expect(dialog).toContainText('27.9.2026 · Normalisering')
  await expect(dialog.getByLabel('Vurdering av Normalisering')).toHaveValue('5'); await dialog.getByLabel('Vurdering av Normalisering').selectOption('4')
  await dialog.getByLabel('Ikke foreslå repetisjon', { exact: true }).check()
  await dialog.getByRole('button', { name: 'Lagre vurdering' }).click()
  let state = await saved(page); expect(state.assessments[0].rating).toBe(4); expect(state.topics[0].reviewSuggestionsDisabled).toBe(true)
  taskRow = row(page, base.title); if (!await taskRow.locator('.task-menu').evaluate(node => node.open)) await taskRow.locator('.task-menu > summary').click(); await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' }); await dialog.getByText('Valgfri egenvurdering').click(); await dialog.getByRole('button', { name: 'Slett vurdering' }).click()
  state = await saved(page); expect(state.assessments).toEqual([])
})

test('assessment edits preserve timestamps and retain or replace review lifecycle atomically', async ({ page }) => {
  const assessedAt = '2026-09-27T08:00:00Z', reviewKey = 'review:topic-edit:assessment-edit'
  await seedState(page, { schemaVersion: 1, tasks: [base], topics: [{ id: 'topic-edit', title: 'Normalisering', taskId: base.id, examDate: '2026-10-10' }], assessments: [{ id: 'assessment-edit', topicId: 'topic-edit', rating: 2, assessedAt }], reviewDecisions: [{ id: 'decision-edit', assessmentId: 'assessment-edit', reviewKey, status: 'approved', sessionId: 'review-edit', decidedAt: '2026-09-27T08:01:00Z' }], sessions: [{ id: 'review-edit', reviewKey, reviewTopicId: 'topic-edit', dateLocal: '2026-10-01', startTime: '10:00', endTime: '10:30' }], onboarding: { dismissed: true, completed: true } }, 'all')
  let taskRow = row(page, base.title); await taskRow.locator('.task-menu > summary').click(); await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  let dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' }); await dialog.getByText('Valgfri egenvurdering').click(); await dialog.getByRole('button', { name: 'Lagre vurdering' }).click()
  let state = await saved(page); expect(state.assessments[0].assessedAt).toBe(assessedAt); expect(state.reviewDecisions).toHaveLength(1); expect(state.sessions).toHaveLength(1)
  taskRow = row(page, base.title); if (!await taskRow.locator('.task-menu').evaluate(node => node.open)) await taskRow.locator('.task-menu > summary').click(); await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' }); await dialog.getByText('Valgfri egenvurdering').click(); await dialog.getByLabel('Vurdering av Normalisering').selectOption('4'); await dialog.getByRole('button', { name: 'Lagre vurdering' }).click()
  state = await saved(page); expect(state.assessments[0]).toMatchObject({ rating: 4, assessedAt }); expect(state.reviewDecisions).toEqual([]); expect(state.sessions).toEqual([])
  taskRow = row(page, base.title); if (!await taskRow.locator('.task-menu').evaluate(node => node.open)) await taskRow.locator('.task-menu > summary').click(); await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  dialog = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' }); await dialog.getByText('Valgfri egenvurdering').click(); await dialog.getByLabel('Vurdering av Normalisering').selectOption('1'); await dialog.getByLabel('Beslutning for Normalisering').selectOption('rejected'); await dialog.getByRole('button', { name: 'Lagre vurdering' }).click()
  state = await saved(page); expect(state.assessments[0]).toMatchObject({ rating: 1, assessedAt }); expect(state.reviewDecisions).toHaveLength(1); expect(state.reviewDecisions[0].status).toBe('rejected')
})

test('new optional dialogs remain readable on a narrow screen with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page, [base], { view: 'all' })
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  const taskRow = row(page, base.title)
  await taskRow.locator('.task-menu > summary').click()
  await taskRow.getByRole('button', { name: /Administrer arbeidssteg/ }).click()
  const steps = page.locator('.work-steps-dialog')
  await expect(steps).toBeVisible()
  expect(await steps.evaluate(node => node.getBoundingClientRect().width <= innerWidth && node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await steps.getByRole('button', { name: 'Avbryt', exact: true }).click()
  if (!await taskRow.locator('.task-menu').evaluate(node => node.open)) await taskRow.locator('.task-menu > summary').click()
  await taskRow.getByRole('button', { name: /Registrer arbeid/ }).click()
  const closeout = page.locator('.connected-dialog').filter({ hasText: 'Hva skjedde?' })
  await closeout.getByText('Valgfri egenvurdering').click()
  expect(await closeout.evaluate(node => node.getBoundingClientRect().width <= innerWidth && node.scrollWidth <= node.clientWidth + 1)).toBe(true)
})

test('calendar export downloads the visible period as a standalone copy without inventing deadline duration', async ({ page }) => {
  await seedState(page, {
    schemaVersion: 1,
    tasks: [{ ...base, deadlineLocal: '2026-10-10' }],
    sessions: [{ id: 'study-export', taskId: base.id, dateLocal: '2026-10-08', startTime: '10:00', endTime: '10:30' }],
    planner: {
      courses: [{ id: 'export-course', code: 'IBE160', name: 'Digitalisering', university: '', semester: 'autumn', year: 2026, credits: 10, notes: '' }],
      sources: [],
      events: [{ id: 'teaching-export', courseId: 'export-course', title: 'Forelesning', start: '2026-10-08T06:00:00Z', end: '2026-10-08T07:00:00Z' }],
    },
    onboarding: { dismissed: true, completed: true },
  }, 'calendar')
  await page.locator('#full-calendar-date').fill('2026-10-08')
  await page.locator('#full-calendar-date').press('Enter')
  await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
  let exportDialog = page.getByRole('dialog', { name: 'Eksporter kalender' })
  await expect(exportDialog).toContainText('2026-10-05–2026-10-11')
  const pending = page.waitForEvent('download'); await exportDialog.getByRole('button', { name: 'Last ned .ics' }).click()
  const download = await pending
  const source = await readFile(await download.path(), 'utf8')
  expect(source).toContain('BEGIN:VEVENT')
  expect(source).not.toContain('BEGIN:VTODO')
  expect(source).toContain('SUMMARY:[IBE160] Frist: Integrert oppgave')
  expect(source).toContain('SUMMARY:[IBE160] Studieøkt: Integrert oppgave')
  expect(source).not.toContain('SUMMARY:Forelesning')
  const deadline = source.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g)?.find(component => component.includes('Frist:'))
  expect(deadline).toContain('DTSTART;VALUE=DATE:20261010')
  expect(deadline).toContain('TRANSP:TRANSPARENT')
  expect(deadline).not.toContain('DTEND:')
  await expect(page.getByRole('status').filter({ hasText: 'Kalenderfil lastet ned. Dette er en kopi, ikke synkronisering.' })).toBeVisible()

  await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
  exportDialog = page.getByRole('dialog', { name: 'Eksporter kalender' }); await exportDialog.getByLabel('Studieøkter').uncheck(); await exportDialog.getByLabel('Frister', { exact: true }).uncheck(); await exportDialog.getByLabel('Undervisning').check()
  const teachingPending = page.waitForEvent('download'); await exportDialog.getByRole('button', { name: 'Last ned .ics' }).click()
  const teachingSource = await readFile(await (await teachingPending).path(), 'utf8')
  expect(teachingSource).toContain('SUMMARY:[IBE160] Forelesning'); expect(teachingSource).not.toContain('VTODO')

  await page.locator('#full-calendar-date').fill('2027-01-08')
  await page.locator('#full-calendar-date').press('Enter')
  await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
  exportDialog = page.getByRole('dialog', { name: 'Eksporter kalender' }); await exportDialog.getByLabel('Studieøkter').uncheck(); await exportDialog.getByLabel('Frister', { exact: true }).uncheck()
  await expect(exportDialog).toContainText('Ingen aktiviteter finnes i valgt periode med valgte typer.')
  await expect(exportDialog.getByRole('button', { name: 'Last ned .ics' })).toBeDisabled()
})

test('Norwegian course catalogue is name-first, alphabetical and keeps the selected stable ID on mobile refresh', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const courses = [
    { id: 'a-last', name: 'Årsstudium', code: 'Å1', university: 'Test', semester: 'autumn', year: 2026, credits: 10, notes: '' },
    { id: 'same-b', name: 'Design', code: 'D1', university: 'Test', semester: 'autumn', year: 2026, credits: 10, notes: '' },
    { id: 'first', name: 'Anatomi', code: 'A1', university: 'Test', semester: 'autumn', year: 2026, credits: 10, notes: '' },
    { id: 'same-a', name: 'Design', code: 'D1', university: 'Test', semester: 'autumn', year: 2026, credits: 10, notes: '' },
    { id: 'o', name: 'Økonomi', code: 'Ø1', university: 'Test', semester: 'autumn', year: 2026, credits: 10, notes: '' },
    { id: 'ae', name: 'Æresstudium', code: 'Æ1', university: 'Test', semester: 'autumn', year: 2026, credits: 10, notes: '' },
  ]
  await seedState(page, { schemaVersion: 1, tasks: [], planner: { courses, sources: [], events: [] }, onboarding: { dismissed: true, completed: true } }, 'subjects')
  await expect(page.locator('#course-list h3')).toHaveText(['Anatomi · A1', 'Design · D1', 'Design · D1', 'Æresstudium · Æ1', 'Økonomi · Ø1', 'Årsstudium · Å1'])
  await page.screenshot({ path: testInfo.outputPath('sorted-course-list-390.png'), fullPage: true })
  await navigate(page, 'calendar')
  await page.locator('.full-calendar-filters > summary').click()
  const selector = page.locator('#full-calendar-course')
  await expect(selector.locator('option')).toHaveText(['Alle emner', 'Anatomi · A1', 'Design · D1', 'Design · D1', 'Æresstudium · Æ1', 'Økonomi · Ø1', 'Årsstudium · Å1'])
  await selector.selectOption('same-b')
  await page.waitForTimeout(1200)
  await expect(selector).toHaveValue('same-b')
})

test('plan comparison exposes all three same-baseline alternatives, applies one, and remains undoable', async ({ page }) => {
  await seedState(page, {
    schemaVersion: 1,
    tasks: [{ ...base, remainingMinutes: 220, priority: 3 }],
    sessions: [],
    workWindows: [{ id: 'comparison-window', label: 'Torsdag', start: '2026-10-01T08:00:00Z', end: '2026-10-01T12:00:00Z' }],
    onboarding: { dismissed: true, completed: true },
  }, 'capacity')
  const before = await saved(page)
  await page.getByRole('button', { name: 'Sammenlign planer', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Realistisk planforslag' })
  await dialog.getByRole('checkbox', { name: base.title, exact: true }).check()
  await dialog.getByRole('button', { name: 'Sammenlign planalternativer', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Behold dagens plan', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: /Redusert kapasitet/ })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Valgte prioriterte oppgaver', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Behold dagens plan', exact: true }).click()
  expect(await saved(page)).toEqual(before)
  await page.getByRole('button', { name: 'Sammenlign planer', exact: true }).click()
  const reopened = page.getByRole('dialog', { name: 'Realistisk planforslag' }); await reopened.getByRole('checkbox', { name: base.title, exact: true }).check(); await reopened.getByRole('button', { name: 'Sammenlign planalternativer', exact: true }).click()
  await expect(reopened.getByText('Alternativet har kapasitetsmangel; ikke alt arbeid får plass.').first()).toBeVisible()
  await expect(reopened.getByText(/repetisjonsøkter beholdes/).first()).toBeVisible()
  expect(await saved(page)).toEqual(before)
  const priorityScenario = reopened.getByRole('heading', { name: 'Valgte prioriterte oppgaver', exact: true }).locator('..')
  await priorityScenario.getByRole('button', { name: 'Velg dette utkastet' }).click()
  await expect(reopened.getByRole('button', { name: 'Bruk planen', exact: true })).toBeFocused()
  await reopened.getByRole('button', { name: 'Bruk planen', exact: true }).click()
  expect((await saved(page)).sessions).not.toHaveLength(0)
  await page.locator('.contextual-undo').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  const undone = await saved(page)
  expect(undone.sessions).toEqual([])
})

test('stale comparison stays open and writes nothing over a newer browser state', async ({ page }) => {
  await seedState(page, { schemaVersion: 1, tasks: [base], sessions: [], workWindows: [{ id: 'w', start: '2026-10-01T08:00:00Z', end: '2026-10-01T12:00:00Z' }], onboarding: { dismissed: true, completed: true } }, 'capacity')
  await page.getByRole('button', { name: 'Sammenlign planer', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Realistisk planforslag' })
  await dialog.getByRole('checkbox', { name: base.title, exact: true }).check(); await dialog.getByRole('button', { name: 'Sammenlign planalternativer' }).click()
  await dialog.getByRole('heading', { name: 'Valgte prioriterte oppgaver' }).locator('..').getByRole('button', { name: 'Velg dette utkastet' }).click()
  const newer = await saved(page); newer.tasks[0].title = 'Endret i en annen fane'
  await page.evaluate(({ key, newer }) => localStorage.setItem(key, JSON.stringify(newer)), { key, newer })
  await dialog.getByRole('button', { name: 'Bruk planen', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('annen fane har endret dataene')
  expect(await saved(page)).toEqual(newer)
})
