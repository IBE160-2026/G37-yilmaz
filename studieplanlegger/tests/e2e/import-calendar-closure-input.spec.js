import { test, expect } from '@playwright/test'
import { openTpImport, preview, eventRows, courseRows, openPreviewRow, savedTpState, confirmTpImport } from './tp-csv-helpers.js'
import { reveal } from './helpers.js'

test('Closure input: typing coalesces summary work while changes and confirmation validate the latest draft', async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Independent synthetic input has no external source.' } }))
  await page.goto('/')
  const csv = ['uid;title;dtstart;dtend', ...Array.from({ length: 120 }, (_, index) => `synthetic-summary-${index};Oppdiktet aktivitet ${index};2045-09-18T10:00:07+02:00;2045-09-18T11:00:17+02:00`)].join('\n')
  await openTpImport(page, { text: csv, name: 'synthetic-summary-input.csv' })
  const row = eventRows(page).first()
  await openPreviewRow(row)
  const name = row.getByLabel('Navn', { exact: true })
  await name.focus()
  const scroll = await page.evaluate(() => scrollY)
  const immediate = await name.evaluate(input => {
    const summary = document.querySelector('.document-confirmation-summary')
    window.summaryChanges = 0
    window.summaryObserver = new MutationObserver(records => { window.summaryChanges += records.length })
    window.summaryObserver.observe(summary, { childList: true })
    for (let n = 1; n <= 12; n++) {
      input.value = `Oppdiktet redigert tittel ${n}`
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const synchronous = window.summaryObserver.takeRecords().length
    window.summaryChanges += synchronous
    return synchronous
  })
  expect(immediate).toBe(0)
  await expect.poll(() => page.evaluate(() => window.summaryChanges)).toBe(1)
  await expect(name).toBeFocused()
  await expect(row).toHaveAttribute('open', '')
  expect(Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThanOrEqual(2)

  // A change flushes the full validation synchronously and cancels the queued
  // input update. Confirmation cannot use the previously valid summary.
  const invalid = await name.evaluate(input => {
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return document.querySelector('.document-confirmation-summary').textContent
  })
  expect(invalid).toContain('1 må avklares')
  await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
  await expect(preview(page).getByRole('alert')).not.toBeEmpty()
  expect((await savedTpState(page))?.planner?.events || []).toEqual([])
  await name.fill('Oppdiktet siste utkast')
  await name.press('Enter')
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
  const state = await savedTpState(page)
  expect(state.planner.events).toHaveLength(120)
  expect(state.planner.events[0].title).toBe('Oppdiktet siste utkast')
})

test('Closure input: incomplete numeric draft survives saved references name retry and full refresh', async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic reference input has no external source.' } }))
  await page.goto('/')
  const csv = code => `uid;title;courseid;coursename;university;dtstart;dtend\nsynthetic-draft-${code};Oppdiktet økt;${code};Oppdiktet emne ${code};HiMolde;2045-09-18T10:00:07+02:00;2045-09-18T11:00:17+02:00`
  await openTpImport(page, { text: csv('SYN986'), name: 'synthetic-saved-reference.csv' })
  await (await reveal(courseRows(page).getByLabel('Studiepoeng (valgfritt)', { exact: true }))).fill('7.5')
  await confirmTpImport(page)
  const before = await savedTpState(page), savedCourse = before.planner.courses[0]
  await openTpImport(page, { text: csv('SYN987'), name: 'synthetic-native-draft.csv' })
  const row = courseRows(page).first(), credits = row.getByLabel('Studiepoeng (valgfritt)', { exact: true })
  const target = row.getByLabel('Eksisterende eller nytt emne', { exact: true })
  await (await reveal(credits)).fill('')
  await credits.pressSequentially('1e')
  for (const action of ['Prøv emnenavn på nytt', 'Oppdater forhåndsvisningen']) {
    expect(await credits.evaluate(input => input.validity.badInput)).toBe(true)
    await target.selectOption(savedCourse.id)
    await expect(credits).toHaveValue('7.5'); await expect(credits).not.toBeEditable()
    expect(await credits.evaluate(input => input.validity.badInput)).toBe(false)
    const oldForm = await preview(page).elementHandle()
    await (await reveal(preview(page).getByRole('button', { name: action, exact: true, includeHidden: true }))).click()
    await expect.poll(() => oldForm.evaluate(form => form.isConnected)).toBe(false)
    await expect(credits).toHaveValue('7.5'); await expect(credits).not.toBeEditable()
    await (await reveal(target)).selectOption('')
    await expect(credits).toBeEditable()
    expect(await credits.evaluate(input => input.validity.badInput)).toBe(true)
    await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
    await expect(preview(page).getByRole('alert')).toContainText('ufullstendig eller ugyldig verdi')
    expect(await savedTpState(page)).toEqual(before)
  }
  // Choosing another input starts a fresh draft even when its bytes happen
  // to match. A detached invalid editor must not leak into that new preview.
  await target.selectOption(savedCourse.id)
  await preview(page).getByRole('button', { name: 'Rett', exact: true }).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'synthetic-replaced-draft.csv', mimeType: 'text/csv', buffer: Buffer.from(csv('SYN987')) })
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await (await reveal(credits)).focus()
  expect(await credits.evaluate(input => input.validity.badInput)).toBe(false)
  await expect(credits).toHaveValue('')
  await credits.fill('9.5')
  await confirmTpImport(page)
  const after = await savedTpState(page)
  expect(after.planner.courses).toHaveLength(2)
  expect(after.planner.courses.find(course => course.id === savedCourse.id)).toEqual(savedCourse)
  expect(after.planner.courses.find(course => course.code === 'SYN987').credits).toBe(9.5)
})
