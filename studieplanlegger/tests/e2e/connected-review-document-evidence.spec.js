import { test, expect } from '@playwright/test'
import { freeze, navigate, key } from './helpers.js'

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
async function boot(page, { width = 1440, size = 16 } = {}) {
  await page.setViewportSize({ width, height: 900 })
  await freeze(page, '2026-09-19T09:00:00+02:00')
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [] })), key)
  await page.reload()
  await page.addStyleTag({ content: `html { font-size: ${size}px !important; }` })
}
async function open(page, file, { calendar = false } = {}) {
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra dokument eller tekst', exact: true }).click()
  await page.getByLabel('Velg fil', { exact: true }).setInputFiles(file)
  if (calendar) {
    await page.getByLabel('Kalendersemester for ICS-undervisning', { exact: true }).selectOption('autumn')
    await page.getByLabel('År for ICS-undervisning', { exact: true }).fill('2026')
  }
  await page.getByRole('button', { name: 'Lag forhåndsvisning', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Kontroller planen før import', exact: true })).toBeVisible({ timeout: 35000 })
}
async function confirm(page) {
  await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
  await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
}
function partialPdf() {
  const stream = 'BT /F1 12 Tf 40 750 Td (Innlevering frist 2026-09-21 kl. 14:00) Tj ET'
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 7 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Length 0 >>\nstream\n\nendstream']
  let text = '%PDF-1.4\n'; const offsets = []
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${object}\nendobj\n` }
  const start = Buffer.byteLength(text)
  text += `xref\n0 8\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 8 >>\nstartxref\n${start}\n%%EOF`
  return Buffer.from(text)
}

test('R8 long VEVENT descriptions remain editable and persist completely through browser save, reload and backup', async ({ page }) => {
  await boot(page)
  const description = 'Beskrivelse '.repeat(833) + 'slutt', expected = description.padEnd(10001, '!')
  const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:long-event', 'SUMMARY:Seminar', 'DTSTART:20260920T100000Z', 'DTEND:20260920T110000Z', `DESCRIPTION:${expected}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  await open(page, { name: 'lang-beskrivelse.ics', mimeType: 'text/calendar', buffer: Buffer.from(text) }, { calendar: true })
  await expect(page.getByLabel('Beskrivelse (valgfritt)', { exact: true })).toHaveValue(expected)
  await page.getByLabel('Ta med i planen', { exact: true }).check()
  await confirm(page)
  const state = await stored(page)
  expect(state.planner.events[0].description).toBe(expected)
  expect(state.importSources[0].entries[0].sourceBase.description).toBe(expected)
  await page.reload()
  expect((await stored(page)).planner.events[0].description).toBe(expected)
  const backup = await page.evaluate(async key => {
    const { exportBackup, previewBackup } = await import('/src/backup.js')
    return previewBackup(JSON.stringify(exportBackup(JSON.parse(localStorage.getItem(key)))), { schemaVersion: 1, tasks: [] })
  }, key)
  expect(backup.ok).toBe(true)
  expect(backup.data.planner.events[0].description).toBe(expected)
})

for (const [width, size] of [[1440, 16], [390, 24]]) {
  test(`R8 later invalid rows open and keyboard corrections retain all edits at ${width}px/${size}px`, async ({ page }, info) => {
    await boot(page, { width, size })
    const lines = Array.from({ length: 10 }, (_, index) => `${index + 1};${index === 9 ? '' : `Oppgave ${index + 1}`};${index === 8 ? '16.09' : ''}`)
    await open(page, { name: 'flere-rader.csv', mimeType: 'text/csv', buffer: Buffer.from(['id;tittel;frist', ...lines].join('\n')) })
    const rows = page.locator('.document-preview-row'), confirmButton = page.getByRole('button', { name: 'Bekreft valgt plan', exact: true })
    await rows.first().getByLabel('Navn', { exact: true }).fill('Behold mitt redigerte navn')
    await rows.first().getByLabel('Gjenstående minutter (tomt = vet ikke)', { exact: true }).fill('45')
    expect(await rows.nth(8).evaluate(node => node.open)).toBe(false)
    expect(await rows.nth(9).evaluate(node => node.open)).toBe(false)
    const before = await stored(page)
    await confirmButton.focus(); await page.keyboard.press('Enter')
    const deadline = rows.nth(8).getByLabel('Frist', { exact: true })
    await expect(deadline).toBeFocused(); await expect(deadline).toHaveAttribute('aria-invalid', 'true')
    expect(await rows.nth(8).evaluate(node => node.open)).toBe(true)
    expect(await rows.nth(9).evaluate(node => node.open)).toBe(true)
    expect(await deadline.evaluate(node => document.getElementById(node.getAttribute('aria-describedby')).textContent)).toContain('Avklar dato')
    await expect(rows.first().getByLabel('Navn', { exact: true })).toHaveValue('Behold mitt redigerte navn')
    expect(await stored(page)).toEqual(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`document-correction-${width}-${size}.png`) })
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
    await expect(deadline).toHaveValue('none')
    await confirmButton.focus(); await page.keyboard.press('Enter')
    const name = rows.nth(9).getByLabel('Navn', { exact: true })
    await expect(name).toBeFocused(); await expect(name).toHaveAttribute('aria-invalid', 'true')
    await page.keyboard.type('Rettet siste rad')
    await confirmButton.focus(); await page.keyboard.press('Enter')
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
    const state = await stored(page)
    expect(state.tasks).toHaveLength(10)
    expect(state.tasks[0]).toMatchObject({ title: 'Behold mitt redigerte navn', remainingMinutes: 45 })
    expect(state.tasks[8].deadlineLocal).toBe('')
    expect(state.tasks[9].title).toBe('Rettet siste rad')
  })
}

test('R8 partial PDF evidence survives actual worker import, reload, source update controls and backup restoration', async ({ page }, info) => {
  await boot(page)
  const nonlocal = []
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) nonlocal.push(request.url()) })
  await open(page, { name: 'delvis-plan.pdf', mimeType: 'application/pdf', buffer: partialPdf() })
  await expect(page.locator('.document-preview')).toContainText('1 sider mangler lesbar tekst')
  await expect(page.locator('.document-preview')).toContainText('Kilden er ufullstendig')
  await confirm(page)
  const first = await stored(page), source = first.importSources[0]
  expect(source).toMatchObject({ format: 'pdf', revision: 1, complete: false })
  await page.reload(); await navigate(page, 'subjects')
  await expect(page.locator('#source-list')).toContainText('1 sider mangler lesbar tekst')
  await expect(page.locator('#source-list')).toContainText('delvis-plan.pdf')
  await page.getByRole('button', { name: 'Oppdater dokumentkilde', exact: true }).click()
  await expect(page.getByLabel('Ny kilde eller oppdatering', { exact: true })).toHaveValue(source.id)
  await expect(page.locator('.document-source-evidence')).toContainText('revisjon 1')
  await expect(page.locator('.document-source-evidence')).toContainText('1 sider mangler lesbar tekst')
  await page.locator('.document-source-evidence').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('document-source-partial.png') })
  const restored = await page.evaluate(async key => {
    const { exportBackup, previewBackup } = await import('/src/backup.js'), { createStorage } = await import('/src/storage.js')
    const preview = previewBackup(JSON.stringify(exportBackup(JSON.parse(localStorage.getItem(key)))), { schemaVersion: 1, tasks: [] })
    if (!preview.ok) return preview
    const storage = createStorage(() => localStorage); storage.read()
    return storage.replace(preview.data)
  }, key)
  expect(restored.ok).toBe(true)
  await page.reload(); await navigate(page, 'subjects')
  expect((await stored(page)).importSources[0]).toEqual(source)
  await expect(page.locator('#source-list')).toContainText('1 sider mangler lesbar tekst')
  expect(nonlocal).toEqual([])
})

test('R8 unfinished native number input remains a correctable field error while explicit empty values stay unknown', async ({ page }) => {
  await boot(page)
  await open(page, { name: 'tall.csv', mimeType: 'text/csv', buffer: Buffer.from('type;tittel;år;semester;studiepoeng;minutter\nemne;Testemne;2026;høst;5;\noppgave;Les kapitlet;;;;45') })
  const before = await stored(page), confirmButton = page.getByRole('button', { name: 'Bekreft valgt plan', exact: true })
  for (const label of ['Gjenstående minutter (tomt = vet ikke)', 'Studiepoeng (valgfritt)', 'År']) {
    const input = page.locator('.document-preview').getByLabel(label, { exact: true })
    await input.fill(''); await input.press('e')
    expect(await input.evaluate(node => node.validity.badInput)).toBe(true)
    await confirmButton.focus(); await page.keyboard.press('Enter')
    await expect(input).toBeFocused(); await expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(await input.evaluate(node => node.validity.badInput)).toBe(true)
    expect(await stored(page)).toEqual(before)
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('Backspace')
    expect(await input.evaluate(node => node.validity.badInput)).toBe(false)
    if (label === 'År') await page.keyboard.type('2026')
  }
  await confirm(page)
  const state = await stored(page)
  expect(state.tasks[0].remainingMinutes).toBeNull()
  expect(state.planner.courses[0]).toMatchObject({ year: 2026, credits: null })
})

test('R9 changing a document draft terminates the active reader, preserves input and permits retry', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const NativeWorker = window.Worker
    window.documentTerminations = 0
    window.Worker = class extends NativeWorker { terminate() { window.documentTerminations++; return super.terminate() } }
  })
  const pattern = '**/src/document-parser.worker.js*'
  await page.route(pattern, route => route.fulfill({ contentType: 'text/javascript', body: 'self.onmessage = () => { self.postMessage({documentImport:true,progress:"Leser gammelt utkast"}); while(true){} }' }))
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra dokument eller tekst', exact: true }).click()
  const paste = page.getByLabel('Eller lim inn tekst'), read = page.getByRole('button', { name: 'Lag forhåndsvisning', exact: true })
  await paste.fill('Les det gamle kapitlet'); const before = await stored(page)
  await read.click(); await expect(page.locator('.document-import [role=status]')).toHaveText('Leser gammelt utkast')
  await paste.fill('Les det nye kapitlet')
  await expect(read).toBeEnabled()
  await expect(paste).toHaveValue('Les det nye kapitlet')
  expect(await page.evaluate(() => window.documentTerminations)).toBe(1)
  expect(await stored(page)).toEqual(before)
  await expect(page.locator('.document-preview')).toHaveCount(0)
  await page.unroute(pattern); await read.click()
  await expect(page.getByRole('heading', { name: 'Kontroller planen før import', exact: true })).toBeVisible()
  await expect(page.getByLabel('Navn', { exact: true })).toHaveValue('Les det nye kapitlet')
  await confirm(page)
  expect((await stored(page)).tasks[0].title).toBe('Les det nye kapitlet')
})
