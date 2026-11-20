import { test, expect } from '@playwright/test'
import { freeze, navigate, reveal, saved } from './helpers.js'
import { syntheticDocx, syntheticPdf } from '../helpers/synthetic-documents.js'

const deadlineSamples = [
  ['Oppgave publisert 20.11.2026 kl. 09:00, frist 27.11.2026 kl. 23:59', '2026-11-27T23:59'],
  ['Publisert 1. november, frist 20. november kl. 14', '2026-11-20T14:00'],
  ['Les kapittel 2.10 før frist 19. november 2026 kl. 12:00', '2026-11-19T12:00'],
  ['Frist ikke bestemt', ''],
  ['Oppgave: Frist 20.11.2026 kl. 09:00 er flyttet til 27.11.2026 kl. 23:59', '2026-11-27T23:59'],
  ['Oppgave publisert 20.11.2026 kl. 09:00, innleveringsfrist 27.11.2026 kl. 23:59', '2026-11-27T23:59'],
  ['Leveringsfrist 27.11.2026 kl. 23:59', '2026-11-27T23:59'],
  ['Oppgave: fristen er 27.11.2026 kl. 23:59', '2026-11-27T23:59'],
  ['Assignment published November 20, 2026, due date is November 27, 2026 at 11:59 pm', '2026-11-27T23:59'],
  ['Oppgave med frist 20.11.2026 kl. 14:00 eller 27.11.2026 kl. 14:00', '2026-11-27T14:00'],
]

const deadlineChanges = [
  ['forlenget', 'Oppgave: Fristen 20.11.2026 kl. 09:00 er forlenget til 27.11.2026 kl. 23:59.'],
  ['utsatt', 'Oppgave: Fristen 20.11.2026 kl. 09:00 er nå utsatt til 27.11.2026 kl. 23:59.'],
  ['ny dato', 'Oppgave: Frist 20.11.2026 kl. 09:00 (ny dato: 27.11.2026 kl. 23:59).'],
  ['fremskyndet', 'Oppgave: Fristen 04.12.2026 kl. 09:00 er fremskyndet til 27.11.2026 kl. 23:59.'],
]
const newDeadline = '2026-11-27T23:59'

async function previewDocument(page, format, name, lines) {
  await freeze(page, '2026-11-19T09:00:00+01:00')
  await page.goto('/')
  await navigate(page, 'subjects')
  await (await reveal(page.getByRole('button', { name: 'Finn studieprogram', exact: true }))).click()
  await (await reveal(page.getByRole('button', { name: 'Fra fil eller tekst', exact: true }))).click()
  if (format === 'text') await (await reveal(page.getByLabel('Eller lim inn tekst'))).fill(lines.join('\n'))
  else {
    const mimeType = { txt: 'text/plain', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[format]
    const buffer = format === 'pdf' ? syntheticPdf(lines) : format === 'docx' ? await syntheticDocx(lines) : Buffer.from(lines.join('\n'))
    await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: name + '.' + format, mimeType, buffer })
  }
  await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dette fant jeg', exact: true })).toBeVisible({ timeout: 35000 })
}

for (const format of ['text', 'txt', 'pdf', 'docx']) {
  for (const [wording, title] of deadlineChanges) {
    test(`changed deadline (${wording}) from ${format} previews and persists the new deadline`, async ({ page }) => {
      await previewDocument(page, format, 'syntetisk-ny-frist', [title])
      const row = page.locator('.document-preview-row')
      await expect(row).toHaveCount(1)
      await expect(row.locator('summary').first()).toContainText(title)
      await expect(row.getByLabel('Dato og klokkeslett i norsk tid', { exact: true })).toHaveValue(newDeadline)
      await page.getByRole('button', { name: 'Importer valgte', exact: true }).click()
      await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()

      await page.reload()
      await navigate(page, 'all')
      await expect(page.locator('#task-list').getByRole('heading', { name: title, exact: true })).toBeVisible()
      expect((await saved(page)).tasks.map(({ title, deadlineLocal }) => ({ title, deadlineLocal }))).toEqual([{ title, deadlineLocal: newDeadline }])
    })
  }

  test(`changed deadline with two possible dates from ${format} requires a choice before saving`, async ({ page }) => {
    const title = 'Oppgave: Fristen 20.11.2026 kl. 09:00 er forlenget til 27.11.2026 kl. 23:59 eller 28.11.2026 kl. 09:00.'
    await previewDocument(page, format, 'syntetisk-uklar-ny-frist', [title])
    const row = page.locator('.document-preview-row')
    const deadline = row.getByLabel('Dato og klokkeslett i norsk tid', { exact: true })
    await expect(row.getByLabel('Frist', { exact: true })).toHaveValue('?')
    await expect(deadline).toHaveValue('')
    const confirm = page.getByRole('button', { name: 'Importer valgte', exact: true })
    await confirm.click()
    await expect(page.locator('.document-preview').getByRole('alert')).toContainText('Ingen del av planen er lagret')
    expect((await saved(page))?.tasks || []).toEqual([])

    await (await reveal(deadline)).fill(newDeadline)
    await confirm.click()
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
    await page.reload()
    expect((await saved(page)).tasks).toMatchObject([{ title, deadlineLocal: newDeadline }])
  })

  test('I01 previews, saves, reloads and undoes contextual deadlines from ' + format, async ({ page }) => {
    await previewDocument(page, format, 'syntetiske-frister', deadlineSamples.map(([title]) => title))
    const rows = page.locator('.document-preview-row')
    const summary = page.locator('.document-confirmation-summary')
    const deadlineInput = row => row.getByLabel('Dato og klokkeslett i norsk tid', { exact: true })
    await expect(rows).toHaveCount(deadlineSamples.length)
    for (const [index, [title, expected]] of deadlineSamples.slice(0, -1).entries()) {
      const row = rows.nth(index)
      await expect(row.locator('summary').first()).toContainText(title)
      await expect(deadlineInput(row)).toHaveValue(expected)
    }
    await expect(rows.nth(1)).toContainText('Kontroller det foreslåtte årstallet')
    await expect(rows.nth(3).getByLabel('Frist', { exact: true })).toHaveValue('none')
    await expect(summary).toContainText('1 må avklares')
    const confirm = page.getByRole('button', { name: 'Importer valgte', exact: true })
    await confirm.click()
    await expect(page.locator('.document-preview').getByRole('alert')).toContainText('Ingen del av planen er lagret')
    expect((await saved(page))?.tasks || []).toEqual([])
    await (await reveal(deadlineInput(rows.last()))).fill(deadlineSamples.at(-1)[1])
    await expect(summary).toContainText('0 må avklares')
    await confirm.click()
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()

    await page.reload()
    expect((await saved(page)).tasks.map(({ title, deadlineLocal }) => [title, deadlineLocal])).toEqual(deadlineSamples)
    await navigate(page, 'settings')
    await (await reveal(page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }))).click()
    await page.reload()
    expect((await saved(page))?.tasks || []).toEqual([])
  })

  test('teaching from ' + format + ' previews and retains explicit offsets and seconds after saving and reloading', async ({ page }) => {
    const samples = [
      { title: 'Seminar 2026-11-20T12:00Z - 13:00-08:00', start: '2026-11-20T12:00:00Z', end: '2026-11-20T21:00:00Z', localStart: '2026-11-20T13:00', localEnd: '2026-11-20T22:00' },
      { title: 'Seminar 2026-11-20T12:00:07Z - 13:00:45-08:00', start: '2026-11-20T12:00:07Z', end: '2026-11-20T21:00:45Z', localStart: '2026-11-20T13:00:07', localEnd: '2026-11-20T22:00:45' },
    ]
    await previewDocument(page, format, 'syntetisk-undervisning', samples.map(({ title }) => title))
    for (const { title, localStart, localEnd } of samples) {
      const row = page.locator('.document-preview-row').filter({ hasText: title })
      await expect(await reveal(row.getByLabel('Start i norsk tid', { exact: true }))).toHaveValue(localStart)
      await expect(row.getByLabel('Slutt i norsk tid', { exact: true })).toHaveValue(localEnd)
      await row.getByText('Nøyaktige tidspunkter fra kilden').click()
      await expect(row.getByText(/Kildeverdier:/)).toContainText(title.split(' - ')[1])
    }
    await page.getByRole('button', { name: 'Importer valgte', exact: true }).click()
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
    await page.reload()
    expect((await saved(page)).planner.events).toMatchObject(samples.map(({ title, start, end }) => ({ title, start, end })))
    await navigate(page, 'settings')
    await (await reveal(page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }))).click()
    await page.reload()
    expect((await saved(page))?.planner?.events || []).toEqual([])
  })
}
