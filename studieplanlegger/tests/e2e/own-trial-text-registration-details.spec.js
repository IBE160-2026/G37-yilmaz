import { test, expect } from '@playwright/test'
import { freeze, instrumentWrites, key, navigate, reveal, saved, writes } from './helpers.js'

// Synthetic reproductions of the 2026-11-04 text-registration report. Each
// Playwright test gets a fresh browser context; only setup seeds localStorage.
// Confirmation and reload exercise the application's actual storage adapter.
const course = { id: 'synthetic-course', code: 'SYN101', name: 'Syntetisk testemne', university: 'Testuniversitetet', semester: 'autumn', year: 2026, credits: 10, notes: '' }
const fixedNow = '2026-11-04T12:00:00+01:00'

async function boot(page) {
  await freeze(page, fixedNow)
  await page.goto('/')
  expect(await page.evaluate(() => globalThis.__STUDIEPLAN_API__ === true)).toBe(false)
  await page.evaluate(({ key, course }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [course], events: [], sources: [] } })), { key, course })
  await instrumentWrites(page)
  await page.reload()
  await expect(page.locator('#text-registration')).toBeVisible()
  expect(await writes(page)).toEqual([])
  return saved(page)
}

async function propose(page, command) {
  const registration = page.locator('#text-registration')
  await (await reveal(registration.getByLabel('Skriv hva du vil legge til eller endre'))).fill(command)
  await registration.getByRole('button', { name: 'Lag forslag', exact: true }).click()
  return { registration, summary: registration.locator('.text-registration-summary'), details: registration.locator('.text-registration-details') }
}

async function unchanged(page, before) {
  expect(await saved(page)).toEqual(before)
  expect(await writes(page)).toEqual([])
}

async function confirm(page, registration, kind, title, expectedWrites = 1) {
  await registration.getByRole('button', { name: kind === 'activity' ? 'Legg til aktivitet' : 'Legg til oppgave', exact: true }).click()
  await expect(registration.locator('.text-registration-feedback')).toContainText(kind === 'activity' ? `Egen aktivitet «${title}» er lagt til.` : `Oppgaven «${title}» er opprettet.`)
  await expect(registration.locator('.text-registration-proposal')).toBeHidden()
  expect(await writes(page)).toHaveLength(expectedWrites)
  const after = await saved(page)
  await page.reload()
  expect(await saved(page)).toEqual(after)
  expect(await writes(page)).toEqual([])
  return after
}

for (const [input, start, end, storedStart, storedEnd] of [
  ['9:00–9:30', '09:00', '09:30', '08:00', '08:30'],
  ['09:00–09:30', '09:00', '09:30', '08:00', '08:30'],
  ['9:30–10:30', '09:30', '10:30', '08:30', '09:30'],
]) {
  test(`activity interval ${input} survives native time fields, confirmation and reload`, async ({ page }) => {
    const before = await boot(page)
    const { registration, summary, details } = await propose(page, `Egen aktivitet: Tannlege 5.11.2026 kl. ${input}`)
    await details.locator(':scope > summary').click()
    const startField = registration.getByLabel('Start (valgfri)', { exact: true })
    const endField = registration.getByLabel('Slutt (valgfri)', { exact: true })
    await expect(startField).toHaveAttribute('type', 'time')
    await expect(endField).toHaveAttribute('type', 'time')
    await expect(startField).toHaveValue(start)
    await expect(endField).toHaveValue(end)
    await expect(summary).toContainText(`Tid: ${start}–${end}`)
    await expect(summary).toContainText('Dato: 5. november 2026')
    await unchanged(page, before)
    const after = await confirm(page, registration, 'activity', 'Tannlege')
    expect(after.planner.events).toHaveLength(1)
    expect(after.planner.events[0]).toMatchObject({ title: 'Tannlege', activityKind: 'personal', courseId: '', dateLocal: '2026-11-05', start: `2026-11-05T${storedStart}:00Z`, end: `2026-11-05T${storedEnd}:00Z` })
    await navigate(page, 'subjects')
    await expect(page.locator('#event-list')).toContainText('Tannlege')
  })
}

test('task details update title, normalized course, 30 to 90 minutes and timed deadline before confirmation', async ({ page }) => {
  const before = await boot(page)
  const { registration, summary, details } = await propose(page, 'Lag oppgave Syntetisk kladd i SYN101 frist 5.11.2026 kl. 09:00 arbeid 30 min')
  await expect(summary).toContainText('Arbeidsmengde: 30 min')
  await details.locator(':scope > summary').click()
  await registration.getByLabel('Tittel', { exact: true }).fill('  Syntetisk ferdig rapport  ')
  await registration.getByLabel('Emne (valgfritt, nøyaktig kode eller navn)', { exact: true }).fill('syntetisk testemne')
  await registration.getByLabel('Gjenstående arbeid (valgfritt)', { exact: true }).fill('1,5 timer')
  await registration.getByLabel('Frist (valgfritt)', { exact: true }).fill('6.11.2026 kl. 9:30')
  await details.locator(':scope > summary').click()
  await expect(summary).toContainText('Tittel: Syntetisk ferdig rapport')
  await expect(summary).toContainText('Arbeidsmengde: 90 min')
  await expect(summary).toContainText('Frist: 6. november 2026 kl. 09:30')
  await expect(summary).toContainText('SYN101')
  await expect(summary).not.toContainText('Syntetisk kladd')
  await unchanged(page, before)
  const after = await confirm(page, registration, 'task', 'Syntetisk ferdig rapport')
  expect(after.tasks).toHaveLength(1)
  expect(after.tasks[0]).toMatchObject({ title: 'Syntetisk ferdig rapport', course: 'SYN101', courseId: course.id, remainingMinutes: 90, deadlineLocal: '2026-11-06T09:30' })
  await navigate(page, 'all')
  await expect(page.locator('#task-list')).toContainText('Syntetisk ferdig rapport')
})

test('activity details update title, date and native time interval before confirmation', async ({ page }) => {
  const before = await boot(page)
  const { registration, summary, details } = await propose(page, 'Egen aktivitet: Tannlege 5.11.2026 kl. 09:00–09:30')
  await details.locator(':scope > summary').click()
  await registration.getByLabel('Tittel', { exact: true }).fill('  Lege  ')
  await registration.getByLabel('Dato', { exact: true }).fill('6.11.2026')
  await registration.getByLabel('Start (valgfri)', { exact: true }).fill('10:15')
  await registration.getByLabel('Slutt (valgfri)', { exact: true }).fill('11:00')
  await details.locator(':scope > summary').click()
  await expect(summary).toContainText('Tittel: Lege')
  await expect(summary).toContainText('Dato: 6. november 2026')
  await expect(summary).toContainText('Tid: 10:15–11:00')
  await expect(summary).not.toContainText('Tannlege')
  await unchanged(page, before)
  const after = await confirm(page, registration, 'activity', 'Lege')
  expect(after.planner.events[0]).toMatchObject({ title: 'Lege', dateLocal: '2026-11-06', start: '2026-11-06T09:15:00Z', end: '2026-11-06T10:00:00Z' })
})

test('invalid task edits are visible and rejected; cleared optional values remain unknown', async ({ page }) => {
  const before = await boot(page)
  const { registration, summary, details } = await propose(page, 'Lag oppgave Syntetisk validering i SYN101 frist 5.11.2026 arbeid 30 min')
  await details.locator(':scope > summary').click()
  await registration.getByLabel('Tittel', { exact: true }).fill('')
  await registration.getByLabel('Emne (valgfritt, nøyaktig kode eller navn)', { exact: true }).fill('UKJENT999')
  await registration.getByLabel('Gjenstående arbeid (valgfritt)', { exact: true }).fill('bananer')
  await registration.getByLabel('Frist (valgfritt)', { exact: true }).fill('31.11.2026')
  for (const label of ['Tittel:', 'Arbeidsmengde:', 'Frist:']) await expect(summary.locator('p').filter({ hasText: label })).toContainText(/må avklares|ugyldig/i)
  await expect(summary).toContainText(/emne.*(?:må avklares|ugyldig)|(?:må avklares|ugyldig).*emne/i)
  await registration.getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
  await expect(registration.locator('.text-registration-feedback')).not.toBeEmpty()
  await unchanged(page, before)
  await registration.getByLabel('Tittel', { exact: true }).fill('Syntetisk ukjent arbeid')
  await registration.getByLabel('Emne (valgfritt, nøyaktig kode eller navn)', { exact: true }).fill('uten emne')
  await registration.getByLabel('Gjenstående arbeid (valgfritt)', { exact: true }).fill('')
  await registration.getByLabel('Frist (valgfritt)', { exact: true }).fill('')
  await expect(summary).toContainText('Tittel: Syntetisk ukjent arbeid')
  await expect(summary).toContainText('Arbeidsmengde: ikke oppgitt')
  await expect(summary).toContainText('Frist: ikke oppgitt')
  await expect(summary).toContainText('Uten emne')
  await unchanged(page, before)
  const after = await confirm(page, registration, 'task', 'Syntetisk ukjent arbeid')
  expect(after.tasks[0]).toMatchObject({ title: 'Syntetisk ukjent arbeid', deadlineLocal: '' })
  expect(after.tasks[0].remainingMinutes == null).toBe(true)
  expect(after.tasks[0].courseId || '').toBe('')
})

test('invalid activity date and reversed time are explained and rejected before corrected values are saved', async ({ page }) => {
  const before = await boot(page)
  const { registration, summary, details } = await propose(page, 'Egen aktivitet: Syntetisk timekontroll 5.11.2026 kl. 09:00–09:30')
  await details.locator(':scope > summary').click()
  await registration.getByLabel('Dato', { exact: true }).fill('31.11.2026')
  await expect(summary.locator('p').filter({ hasText: 'Dato:' })).toContainText(/må avklares|ugyldig/i)
  await registration.getByRole('button', { name: 'Legg til aktivitet', exact: true }).click()
  await unchanged(page, before)
  await registration.getByLabel('Dato', { exact: true }).fill('6.11.2026')
  await registration.getByLabel('Slutt (valgfri)', { exact: true }).fill('08:30')
  await expect(summary.locator('p').filter({ hasText: 'Tid:' })).toContainText(/må avklares|ugyldig/i)
  await registration.getByRole('button', { name: 'Legg til aktivitet', exact: true }).click()
  await unchanged(page, before)
  await registration.getByLabel('Slutt (valgfri)', { exact: true }).fill('10:00')
  const start = registration.getByLabel('Start (valgfri)', { exact: true })
  await start.fill('09:00:30')
  await expect(summary.locator('p').filter({ hasText: 'Tid:' })).toContainText(/må avklares|ugyldig/i)
  await registration.getByRole('button', { name: 'Legg til aktivitet', exact: true }).click()
  await unchanged(page, before)
  await start.fill('09:00')
  await expect(summary).toContainText('Tid: 09:00–10:00')
  const after = await confirm(page, registration, 'activity', 'Syntetisk timekontroll')
  expect(after.planner.events[0]).toMatchObject({ dateLocal: '2026-11-06', start: '2026-11-06T08:00:00Z', end: '2026-11-06T09:00:00Z' })
})

test('missing activity clocks remain unknown through native fields and persisted reload', async ({ page }) => {
  const before = await boot(page)
  const { registration, summary, details } = await propose(page, 'Egen aktivitet: Syntetisk aktivitet uten tid 5.11.2026')
  await details.locator(':scope > summary').click()
  await expect(registration.getByLabel('Start (valgfri)', { exact: true })).toHaveValue('')
  await expect(registration.getByLabel('Slutt (valgfri)', { exact: true })).toHaveValue('')
  await expect(summary).toContainText('Tid: ikke oppgitt')
  await unchanged(page, before)
  const after = await confirm(page, registration, 'activity', 'Syntetisk aktivitet uten tid')
  expect(after.planner.events[0]).toMatchObject({ dateLocal: '2026-11-05' })
  expect(after.planner.events[0].start || '').toBe('')
  expect(after.planner.events[0].end || '').toBe('')
})

test('out-of-range parsed activity clocks cannot silently become missing time in native fields', async ({ page }) => {
  const before = await boot(page)
  const { registration, summary } = await propose(page, 'Egen aktivitet: Syntetisk ugyldig tid 5.11.2026 kl. 24:00–24:30')
  await expect(summary.locator('p').filter({ hasText: 'Tid:' })).toContainText(/må avklares|ugyldig/i)
  await registration.getByRole('button', { name: 'Legg til aktivitet', exact: true }).click()
  await expect(registration.locator('.text-registration-feedback')).not.toBeEmpty()
  await unchanged(page, before)
  await (await reveal(registration.getByLabel('Start (valgfri)', { exact: true }))).fill('09:00')
  await registration.getByLabel('Slutt (valgfri)', { exact: true }).fill('09:30')
  await expect(summary).toContainText('Tid: 09:00–09:30')
  await unchanged(page, before)
  const after = await confirm(page, registration, 'activity', 'Syntetisk ugyldig tid')
  expect(after.planner.events[0]).toMatchObject({ dateLocal: '2026-11-05', start: '2026-11-05T08:00:00Z', end: '2026-11-05T08:30:00Z' })
})

for (const clearKey of ['Backspace', 'Delete']) {
  test(`explicit deletion with ${clearKey} clears rejected optional clocks to unknown`, async ({ page }) => {
    const before = await boot(page)
    const { registration, summary } = await propose(page, 'Egen aktivitet: Syntetisk ukjent klokke 5.11.2026 kl. 24:00–24:30')
    await expect(summary).toContainText(/må avklares|ugyldig/i)
    for (const label of ['Start (valgfri)', 'Slutt (valgfri)']) {
      const input = await reveal(registration.getByLabel(label, { exact: true }))
      // Some engines display rejected text; others sanitize it to empty.
      // The same explicit select/delete gesture must clear either case.
      await input.press('ControlOrMeta+A')
      await input.press(clearKey)
      await expect(input).toHaveValue('')
      expect(await input.evaluate(field => field.validity.valid)).toBe(true)
    }
    await expect(summary).toContainText('Tid: ikke oppgitt')
    await unchanged(page, before)
    const after = await confirm(page, registration, 'activity', 'Syntetisk ukjent klokke')
    expect(after.planner.events[0].start || '').toBe('')
    expect(after.planner.events[0].end || '').toBe('')
  })
}

test('course changes refresh an open proposal without discarding edited details', async ({ page }) => {
  await boot(page)
  const { registration, summary } = await propose(page, 'Lag oppgave Syntetisk emneendring i SYN101 arbeid 30 min')
  await (await reveal(registration.getByLabel('Tittel', { exact: true }))).fill('Syntetisk bevart kladd')
  await expect(summary).toContainText('SYN101')
  await navigate(page, 'subjects')
  page.once('dialog', dialog => dialog.accept())
  await (await reveal(page.getByRole('button', { name: 'Slett emne SYN101', exact: true }))).click()
  const afterCourseDelete = await saved(page)
  expect(afterCourseDelete.planner.courses).toHaveLength(0)
  expect(await writes(page)).toHaveLength(1)
  await navigate(page, 'overview')
  await expect(summary).toContainText('Syntetisk bevart kladd')
  await expect(summary).toContainText(/må avklares.*[Ee]mne/)
  await registration.getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
  expect(await saved(page)).toEqual(afterCourseDelete)
  expect(await writes(page)).toHaveLength(1)
  await registration.getByLabel('Emne (valgfritt, nøyaktig kode eller navn)', { exact: true }).fill('uten emne')
  await expect(summary).toContainText('Uten emne')
  const after = await confirm(page, registration, 'task', 'Syntetisk bevart kladd', 2)
  expect(after.tasks[0]).toMatchObject({ title: 'Syntetisk bevart kladd', course: '', remainingMinutes: 30 })
  expect(after.tasks[0].courseId || '').toBe('')
})

for (const kind of ['create', 'activity']) {
  test(`ambiguous dated proposal updates edited title, date and selected type ${kind}`, async ({ page }) => {
    const before = await boot(page)
    const { registration, summary, details } = await propose(page, 'Syntetisk datovalg 5.11.2026')
    await expect(summary).toContainText('Velg type før lagring')
    await details.locator(':scope > summary').click()
    await registration.getByLabel('Tittel', { exact: true }).fill('Syntetisk avklart dato')
    await registration.getByLabel('Dato', { exact: true }).fill('7.11.2026')
    await registration.getByRole('combobox', { name: 'Er dette en oppgave eller egen aktivitet?', exact: true }).selectOption(kind)
    await details.locator(':scope > summary').click()
    await expect(summary).toContainText('Tittel: Syntetisk avklart dato')
    await expect(summary).toContainText('7. november 2026')
    await expect(summary).toContainText(kind === 'activity' ? 'Type: Egen aktivitet' : /Type: Oppgave/)
    await expect(summary).not.toContainText('Velg type før lagring')
    await unchanged(page, before)
    const after = await confirm(page, registration, kind, 'Syntetisk avklart dato')
    if (kind === 'activity') {
      expect(after.planner.events[0]).toMatchObject({ title: 'Syntetisk avklart dato', dateLocal: '2026-11-07' })
      expect(after.planner.events[0].start || '').toBe('')
      expect(after.planner.events[0].end || '').toBe('')
    }
    else expect(after.tasks[0]).toMatchObject({ title: 'Syntetisk avklart dato', deadlineLocal: '2026-11-07' })
  })
}
