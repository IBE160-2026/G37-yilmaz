import { test, expect } from '@playwright/test'
import { reveal } from './helpers.js'
import { preview, courseRows, eventRows, openTpImport, openPreviewRow, confirmTpImport, savedTpState, tpCsvRows } from './tp-csv-helpers.js'

// Minimal invented records. Provider responses below are local test fixtures.
const csv = (rows = [{}]) => tpCsvRows(rows.map((row, index) => ({
  uid: `synthetic-review-${row.courseid || 'SYN961'}-${index}`,
  summary: `Oppdiktet aktivitet ${index + 1}`, courseid: 'SYN961', coursename: 'Oppdiktet emne',
  university: 'uio', year: '2041', semester: 'autumn',
  dtstart: `2041-11-${String(index + 1).padStart(2, '0')}T11:00:07+01:00`,
  dtend: `2041-11-${String(index + 1).padStart(2, '0')}T12:00:17+01:00`,
  sourceobjectid: '', campuscode: '', activitytype: 'Seminar', studentgroups: '', ...row,
})))
const read = (page, text, name = 'synthetic-review.csv', sourceId) => openTpImport(page, { text, name, sourceId })
const compact = page => preview(page).locator('.document-affiliation-choices')
const rowButton = row => row.getByRole('button', { name: 'Bruk emnekoden som foreløpig navn', exact: true, includeHidden: true })
const all = page => preview(page).getByRole('button', { name: 'Velg alle aktiviteter', exact: true, includeHidden: true })

test.use({ trace: 'off' })
test.beforeEach(async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic review fixture blocks external providers.' } }))
  await page.goto('/')
})

async function delayedName(page) {
  let calls = 0, arrive, release
  const arrived = new Promise(resolve => { arrive = resolve })
  const gate = new Promise(resolve => { release = resolve })
  const result = { code: 'SYN963', university: 'NTNU', year: 2041, semester: 'autumn', name: 'Oppdiktet kontrollert navn' }
  await page.route('**/api/import/providers/ntnu/search?**', async route => {
    calls++
    if (calls === 1) return route.fulfill({ json: { status: 'ok', results: [] } })
    arrive(); await gate
    await route.fulfill({ json: { status: 'ok', results: [result] } })
  })
  await page.route('**/api/import/providers/ntnu/details?**', route => route.fulfill({ json: { status: 'ok', course: result } }))
  return { arrived, release }
}

for (const action of ['individual', 'all', 'group']) test(`review selection ${action}: omission and reselection preserve the explicit user point`, async ({ page }) => {
  await read(page, csv([{ dtend: '2041-11-01T11:00:07+01:00', studentgroups: 'Oppdiktet gruppe' }]))
  const row = eventRows(page).first()
  await openPreviewRow(row)
  await row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('point')
  await row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('omit')
  await expect(row.getByLabel('Ta med i planen', { exact: true })).not.toBeChecked()
  if (action === 'individual') await row.getByLabel('Ta med i planen', { exact: true }).check()
  if (action === 'all') await (await reveal(all(page))).click()
  if (action === 'group') await (await reveal(preview(page).getByRole('checkbox', { name: /^Ta med gruppen Oppdiktet gruppe/, includeHidden: true }))).check()
  await expect(row.getByLabel('Ta med i planen', { exact: true })).toBeChecked()
  await expect(row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true })).toHaveValue('point')
  await expect(row).toContainText('Punkt uten varighet, bekreftet av deg.')
  await confirmTpImport(page)
  const saved = await savedTpState(page)
  expect(saved.planner.events).toHaveLength(1)
  expect(saved.planner.events[0]).toMatchObject({ point: true, pointProvenance: 'user', start: '2041-11-01T10:00:07Z', end: '2041-11-01T10:00:07Z' })
  expect(saved.importSources[0].excludedKeys).toHaveLength(0)
})

for (const difference of ['source and campus', 'source only', 'campus only']) test(`review group identities ${difference}: same-code controls remain distinct`, async ({ page }) => {
  const contexts = [
    [difference === 'campus only' ? 'SYN961-SHARED' : 'SYN961-A', difference === 'source only' ? 'SYN-SHARED' : 'SYN-NORTH'],
    [difference === 'campus only' ? 'SYN961-SHARED' : 'SYN961-B', difference === 'source only' ? 'SYN-SHARED' : 'SYN-SOUTH'],
  ]
  await read(page, csv(contexts.map(([sourceobjectid, campuscode]) => ({ sourceobjectid, campuscode, studentgroups: 'Oppdiktet gruppe' }))))
  const groups = preview(page).locator('details[data-group-control]')
  await expect(groups).toHaveCount(2)
  const summaries = await groups.locator(':scope > summary').allTextContents()
  expect(new Set(summaries).size).toBe(2)
  for (const [index, [source, campus]] of contexts.entries()) {
    const group = groups.nth(index)
    const discriminators = [...(difference !== 'campus only' ? [source] : []), ...(difference !== 'source only' ? [campus] : [])]
    for (const discriminator of discriminators) await expect(group.locator(':scope > summary')).toContainText(discriminator)
    for (const prefix of ['Ta med alle aktiviteter', 'Ta med typen Seminar', 'Ta med gruppen Oppdiktet gruppe']) {
      const control = group.getByRole('checkbox', { name: new RegExp(`^${prefix}`), includeHidden: true })
      await reveal(control)
      for (const discriminator of discriminators) await expect(control).toHaveAccessibleName(new RegExp(discriminator))
    }
    await (await reveal(group.getByRole('checkbox', { name: /^Ta med gruppen/, includeHidden: true }))).check()
  }
  await confirmTpImport(page)
  const saved = await savedTpState(page)
  expect(saved.planner.courses).toHaveLength(2)
  expect(new Set(saved.planner.events.map(event => event.courseId)).size).toBe(2)
  expect(saved.planner.courses.map(({ sourceObjectId, campusCode }) => [sourceObjectId, campusCode])).toEqual(contexts)
})

test('review institution consent: compact and detailed decisions synchronize and changed values revoke consent', async ({ page }) => {
  const text = csv([{ university: 'HiMolde' }])
  await read(page, text); await confirmTpImport(page)
  const before = await savedTpState(page)
  await read(page, text, 'synthetic-review.csv', before.importSources[0].id)
  const row = courseRows(page).first(), institution = compact(page).getByLabel('Lærested for SYN961', { exact: true })
  await (await reveal(institution)).selectOption('NTNU')
  const shortConsent = compact(page).getByRole('checkbox', { name: /^Jeg retter institusjonen/, includeHidden: true })
  const detailedConsent = row.locator('.document-course-metadata').getByRole('checkbox', { name: /^Jeg retter institusjonen/, includeHidden: true })
  await (await reveal(shortConsent)).check()
  await expect(detailedConsent).toBeChecked()
  await (await reveal(detailedConsent)).uncheck()
  await expect(shortConsent).not.toBeChecked()
  await detailedConsent.check()
  await expect(shortConsent).toBeChecked()
  await shortConsent.uncheck()
  await expect(detailedConsent).not.toBeChecked()
  await shortConsent.check()
  await institution.selectOption('uio')
  await expect(shortConsent).not.toBeChecked(); await expect(detailedConsent).not.toBeChecked()
  await institution.selectOption('NTNU')
  await expect(shortConsent).not.toBeChecked(); await expect(detailedConsent).not.toBeChecked()
  expect(await savedTpState(page)).toEqual(before)
})

test('review course target: compact affiliation immediately follows reference and new-course choices', async ({ page }) => {
  await read(page, csv([{ courseid: 'SYN970', university: 'HiMolde' }]), 'synthetic-saved-reference.csv')
  await confirmTpImport(page)
  const saved = await savedTpState(page), existing = saved.planner.courses[0]
  await read(page, csv([{ courseid: 'SYN971', university: 'uio' }]), 'synthetic-new-reference.csv')
  const row = courseRows(page).first(), institution = compact(page).getByLabel('Lærested for SYN971', { exact: true })
  await reveal(institution); await expect(institution).toBeEnabled(); await expect(institution).toHaveValue('uio')
  const target = row.getByLabel('Eksisterende eller nytt emne', { exact: true })
  await (await reveal(target)).selectOption(existing.id)
  await expect(institution).toBeDisabled(); await expect(institution).toHaveValue('HiMolde')
  await expect(row.locator(':scope > summary')).toContainText('Lærested: HiMolde')
  await expect(compact(page)).toContainText('Koblet til lagret emne; lærestedet beholdes.')
  await target.selectOption('')
  await expect(institution).toBeEnabled(); await expect(institution).toHaveValue('uio')
  await expect(row.locator(':scope > summary')).toContainText('Lærested: uio')
  await expect(compact(page)).not.toContainText('Koblet til lagret emne; lærestedet beholdes.')
  await confirmTpImport(page)
  const after = await savedTpState(page)
  expect(after.planner.courses.map(({ code, university }) => [code, university])).toEqual([['SYN970', 'HiMolde'], ['SYN971', 'uio']])
  expect(after.planner.courses[0]).toEqual(existing)
})

test('review delayed retry: repeated row buttons retain focus in the same row', async ({ page }) => {
  const lookup = await delayedName(page)
  await read(page, csv([{ courseid: 'SYN961', coursename: '' }, { courseid: 'SYN962', coursename: '' }, { courseid: 'SYN963', coursename: '', university: 'NTNU' }]))
  await (await reveal(preview(page).getByRole('button', { name: 'Prøv emnenavn på nytt', exact: true, includeHidden: true }))).click()
  await lookup.arrived
  const second = courseRows(page).filter({ hasText: 'SYN962' }), button = rowButton(second)
  await (await reveal(button)).focus()
  const scroll = await page.evaluate(() => scrollY)
  lookup.release()
  await expect(preview(page)).toContainText('Oppdiktet kontrollert navn')
  await expect(button).toBeFocused()
  await expect(second).toHaveAttribute('open', '')
  expect(Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThanOrEqual(2)
  await page.keyboard.press('Enter')
  await expect(second.getByLabel('Emnenavn', { exact: true })).toHaveValue('SYN962')
  await expect(courseRows(page).filter({ hasText: 'SYN961' }).getByLabel('Emnenavn', { exact: true })).toHaveValue('')
})

test('review collapsed point: summary retains the explicit user decision', async ({ page }) => {
  await read(page, csv([{ dtend: '' }]))
  const row = eventRows(page).first()
  await openPreviewRow(row)
  await row.getByLabel('Hvordan skal tidspunktet brukes?', { exact: true }).selectOption('point')
  await row.locator(':scope > summary').click()
  await expect(row).not.toHaveAttribute('open', '')
  await expect(row.locator(':scope > summary')).toContainText(/punkt uten varighet/i)
  await expect(row.locator(':scope > summary')).toContainText(/(?:ditt valg|bekreftet av deg)/i)
})

for (const action of ['retry', 'refresh']) test(`review native number ${action}: incomplete input survives replacement and later edits bind the current row`, async ({ page }) => {
  const lookup = action === 'retry' ? await delayedName(page) : null
  await read(page, csv([{ courseid: 'SYN963', coursename: action === 'retry' ? '' : 'Oppdiktet navn', university: action === 'retry' ? 'NTNU' : 'uio' }]))
  const row = courseRows(page).first(), credits = row.getByLabel('Studiepoeng (valgfritt)', { exact: true })
  await (await reveal(credits)).pressSequentially('1e')
  expect(await credits.evaluate(input => input.validity.badInput)).toBe(true)
  if (lookup) {
    await (await reveal(preview(page).getByRole('button', { name: 'Prøv emnenavn på nytt', exact: true, includeHidden: true }))).click()
    await lookup.arrived; lookup.release()
    await expect(preview(page)).toContainText('Oppdiktet kontrollert navn')
  } else await (await reveal(preview(page).getByRole('button', { name: 'Oppdater forhåndsvisningen', exact: true, includeHidden: true }))).click()
  expect(await credits.evaluate(input => input.validity.badInput)).toBe(true)
  await expect(credits).toBeVisible()
  await preview(page).getByRole('button', { name: 'Importer valgte', exact: true }).click()
  await expect(credits).toHaveAttribute('aria-invalid', 'true')
  expect((await savedTpState(page))?.planner?.events || []).toHaveLength(0)
  await (await reveal(credits)).fill('7.5')
  await row.getByLabel('Emnenavn', { exact: true }).fill('Oppdiktet navn etter full oppdatering')
  await confirmTpImport(page)
  expect((await savedTpState(page)).planner.courses[0]).toMatchObject({ credits: 7.5, name: 'Oppdiktet navn etter full oppdatering' })
})

test('review resolved group: a manually closed published group stays closed after another course edit', async ({ page }) => {
  await read(page, csv([...Array.from({ length: 11 }, () => ({ studentgroups: 'Oppdiktet gruppe' })), { courseid: 'SYN962', coursename: 'Oppdiktet annet emne' }]))
  await (await reveal(all(page))).click()
  const group = preview(page).locator('.document-preview-group').filter({ hasText: 'Oppdiktet aktivitet 1' }).first()
  await expect(group).toHaveAttribute('open', '')
  await group.locator(':scope > summary').click()
  await expect(group).not.toHaveAttribute('open', '')
  await (await reveal(compact(page).getByLabel('Lærested for SYN962', { exact: true }))).selectOption('NTNU')
  await expect(group).not.toHaveAttribute('open', '')
  await expect(preview(page).locator('.document-selection-summary')).toContainText('12 aktiviteter valgt')
})

test('review stale receipt: retained undo rejects a later visible edit without changing the stored envelope', async ({ page }) => {
  await read(page, csv()); await confirmTpImport(page)
  const receipt = await page.locator('.document-import-receipt').elementHandle()
  const undo = await page.getByRole('button', { name: 'Angre importen', exact: true }).elementHandle()
  const imported = await savedTpState(page), event = imported.planner.events[0]
  await page.locator(`[data-event-id="${event.id}"]`).getByRole('button', { name: `Rediger undervisning ${event.title}`, exact: true }).click()
  const editor = page.locator('#subject-editor')
  await editor.getByLabel('Egne notater', { exact: true }).fill('Oppdiktet senere endring skal beholdes.')
  await editor.getByRole('button', { name: 'Lagre undervisning', exact: true }).click()
  await expect(editor).toBeHidden()
  const after = await savedTpState(page)
  expect(after).not.toEqual(imported)
  // Exercise the actual previously rendered handler even if refresh detached
  // its receipt; no synthetic state mutation or replacement undo is involved.
  await undo.evaluate(button => button.click())
  await expect.poll(() => receipt.evaluate(node => node.querySelector('[role=alert]')?.textContent || '')).not.toBe('')
  expect(await savedTpState(page)).toEqual(after)
})
