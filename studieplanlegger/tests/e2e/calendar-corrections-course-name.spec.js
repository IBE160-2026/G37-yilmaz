import { test, expect } from '@playwright/test'
import { reveal } from './helpers.js'
import { preview, courseRows, openTpImport, confirmTpImport, savedTpState, tpCsvRows } from './tp-csv-helpers.js'

// Independently invented records; no private calendar or external provider data.
const csv = (code, name, university) => tpCsvRows([{
  uid: `synthetic-course-name-${code}`, summary: `Oppdiktet aktivitet ${code}`,
  courseid: code, coursename: name, university, year: '2041', semester: 'autumn',
  dtstart: '2041-11-01T11:00:07+01:00', dtend: '2041-11-01T12:00:17+01:00',
}])

test('correction course name: saved reference is read-only and switching to a new course retains the draft', async ({ page }) => {
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic fixture blocks external providers.' } }))
  await page.goto('/')
  await openTpImport(page, { text: csv('SYN974', 'Oppdiktet lagret emnenavn', 'HiMolde'), name: 'synthetic-course-name-saved.csv' })
  await confirmTpImport(page)
  const before = await savedTpState(page), existing = before.planner.courses[0]
  const draftName = 'Oppdiktet emnenavn fra filen'
  await openTpImport(page, { text: csv('SYN975', draftName, 'uio'), name: 'synthetic-course-name-draft.csv' })
  const row = courseRows(page).first()
  const name = row.getByLabel('Emnenavn', { exact: true })
  const target = row.getByLabel('Eksisterende eller nytt emne', { exact: true })
  const compactName = preview(page).locator('.document-affiliation-name')
  await (await reveal(name)).fill(draftName)
  const code = row.getByLabel('Emnekode (valgfritt)', { exact: true })
  const year = row.getByLabel('År', { exact: true })
  const semester = row.getByLabel('Kalendersemester', { exact: true })
  const credits = row.getByLabel('Studiepoeng (valgfritt)', { exact: true })
  await (await reveal(year)).fill('2042')
  await semester.selectOption('spring')
  await credits.fill('9.5')
  await target.selectOption(existing.id)
  await expect(name).toBeVisible()
  await expect(name).toHaveValue(existing.name)
  await expect(name).not.toBeEditable()
  await expect(row).toContainText('Emnenavnet er hentet fra det lagrede emnet.')
  await expect(compactName).toHaveText(`SYN975 · ${existing.name}`)
  await name.focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('Oppdiktet forsøk på redigering')
  await expect(name).toHaveValue(existing.name)
  for (const [control, value] of [[code, existing.code], [year, String(existing.year)], [credits, '']]) {
    await expect(control).toHaveValue(value)
    await expect(control).not.toBeEditable()
  }
  await expect(semester).toHaveValue(existing.semester)
  await expect(semester).toBeDisabled()
  await expect(name).toHaveValue(existing.name)
  await target.selectOption('')
  await expect(name).toBeEditable()
  await expect(name).toHaveValue(draftName)
  await expect(compactName).toHaveText(`SYN975 · ${draftName}`)
  await expect(code).toHaveValue('SYN975'); await expect(code).toBeEditable()
  await expect(year).toHaveValue('2042'); await expect(year).toBeEditable()
  await expect(semester).toHaveValue('spring'); await expect(semester).toBeEnabled()
  await expect(credits).toHaveValue('9.5'); await expect(credits).toBeEditable()
  const editedDraftName = 'Oppdiktet redigert utkast'
  await name.fill(editedDraftName)
  await target.selectOption(existing.id)
  await expect(name).toHaveValue(existing.name)
  await expect(name).not.toBeEditable()
  await target.selectOption('')
  await expect(name).toHaveValue(editedDraftName)
  await credits.fill('')
  await credits.pressSequentially('1e')
  expect(await credits.evaluate(input => input.validity.badInput)).toBe(true)
  await target.selectOption(existing.id)
  expect(await credits.evaluate(input => input.validity.badInput)).toBe(false)
  await expect(credits).toHaveValue('')
  await target.selectOption('')
  expect(await credits.evaluate(input => input.validity.badInput)).toBe(true)
  await credits.fill('9.5')
  await target.selectOption(existing.id)
  await confirmTpImport(page)
  const after = await savedTpState(page)
  expect(after.planner.courses).toEqual([existing])
  expect(after.planner.events).toHaveLength(2)
  expect(after.planner.events.every(event => event.courseId === existing.id)).toBe(true)
  expect(after.planner.events.find(event => event.id === before.planner.events[0].id)).toEqual(before.planner.events[0])
  await page.reload()
  expect((await savedTpState(page)).planner).toEqual(after.planner)
})
