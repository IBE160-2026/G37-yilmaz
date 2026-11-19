import { test, expect } from '@playwright/test'
import { freeze, navigate, reveal, saved } from './helpers.js'
import { syntheticDocx, syntheticPdf } from '../helpers/synthetic-documents.js'

const deadlineSamples = [
  ['Oppgave publisert 20.11.2026 kl. 09:00, frist 27.11.2026 kl. 23:59', '2026-11-27T23:59'],
  ['Publisert 1. november, frist 20. november kl. 14', '2026-11-20T14:00'],
  ['Les kapittel 2.10 før frist 19. november 2026 kl. 12:00', '2026-11-19T12:00'],
  ['Frist ikke bestemt', ''],
  ['Oppgave med frist 20.11.2026 kl. 14:00 eller 27.11.2026 kl. 14:00', '2026-11-27T14:00'],
]

for (const format of ['text', 'txt', 'pdf', 'docx']) {
  test('I01 previews, saves, reloads and undoes contextual deadlines from ' + format, async ({ page }) => {
    await freeze(page, '2026-11-19T09:00:00+01:00')
    await page.goto('/')
    await navigate(page, 'subjects')
    await (await reveal(page.getByRole('button', { name: 'Finn studieprogram', exact: true }))).click()
    await (await reveal(page.getByRole('button', { name: 'Fra fil eller tekst', exact: true }))).click()
    const lines = deadlineSamples.map(([title]) => title)
    if (format === 'text') await (await reveal(page.getByLabel('Eller lim inn tekst'))).fill(lines.join('\n'))
    else {
      const mimeType = { txt: 'text/plain', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[format]
      const buffer = format === 'pdf' ? syntheticPdf(lines) : format === 'docx' ? await syntheticDocx(lines) : Buffer.from(lines.join('\n'))
      await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: 'syntetiske-frister.' + format, mimeType, buffer })
    }

    await page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Dette fant jeg', exact: true })).toBeVisible({ timeout: 35000 })
    const rows = page.locator('.document-preview-row')
    const summary = page.locator('.document-confirmation-summary')
    const deadlineInput = row => row.getByLabel('Dato og klokkeslett i norsk tid', { exact: true })
    await expect(rows).toHaveCount(deadlineSamples.length)
    for (const [index, [title, expected]] of deadlineSamples.slice(0, 4).entries()) {
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
}
