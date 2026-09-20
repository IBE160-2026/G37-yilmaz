import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { freeze, navigate, key } from './helpers.js'

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
const task = (id, patch = {}) => ({ id, title: `Arbeid ${id}`, course: '', deadlineLocal: '2026-09-11T16:00', estimatedMinutes: null, remainingMinutes: 45, completed: false, ...patch })
async function boot(page, state, width, size) {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await freeze(page, '2026-09-09T09:00:00+02:00')
  await page.goto('/')
  if (state) { await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state }); await page.reload() }
  await page.addStyleTag({ content: `html { font-size: ${size}px !important; }` })
}

test('A05/A06 DOCX, CSV and VTODO go through local workers and actual app confirmation', async ({ page }) => {
  const external = []
  page.on('request', request => { if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url()) })
  await boot(page, null, 1280, 16)
  const files = [
    { name: 'semester.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await readFile(new URL('../fixtures/connected-semester.docx', import.meta.url)), title: 'Innlevering lokal test, frist 2026-09-16 kl. 14:00' },
    { name: 'semester.csv', mimeType: 'text/csv', buffer: Buffer.from('id;type;tittel;emne;år;semester;frist;start;slutt\nc;emne;Testemne;TEST100;2026;høst;;;\nt;oppgave;CSV-innlevering;TEST100;;;2026-09-17T14:00;;\ne;undervisning;Fast testseminar;TEST100;;;;2026-09-18T10:00;2026-09-18T11:00'), title: 'CSV-innlevering' },
    { name: 'oppgave.ics', mimeType: 'text/calendar', buffer: Buffer.from('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:local-delivery-test\r\nSUMMARY:Kalenderoppgave\r\nDUE:20260919T120000Z\r\nEND:VTODO\r\nEND:VCALENDAR'), title: 'Kalenderoppgave' },
  ]
  for (const file of files) {
    for (let repeat = 0; repeat < 2; repeat++) {
      await navigate(page, 'subjects')
      await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
      await page.getByRole('button', { name: 'Fra dokument eller tekst', exact: true }).click()
      await page.getByLabel('Velg fil', { exact: true }).setInputFiles({ name: repeat ? `kopi-${file.name}` : file.name, mimeType: file.mimeType, buffer: file.buffer })
      await page.getByRole('button', { name: 'Lag forhåndsvisning', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Kontroller planen før import' })).toBeVisible({ timeout: 35000 })
      const before = await stored(page)
      if (repeat === 0) expect(before?.tasks?.some(item => item.title === file.title) || false).toBe(false)
      await page.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
      await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
      const after = await stored(page)
      expect(after.tasks.filter(item => item.title === file.title)).toHaveLength(1)
      if (repeat) expect(after.tasks).toEqual(before.tasks)
      await page.reload()
    }
  }
  const state = await stored(page)
  expect(state.tasks).toHaveLength(3)
  expect(state.planner.courses).toHaveLength(1); expect(state.planner.events).toHaveLength(1)
  expect(state.tasks.find(item => item.title === 'CSV-innlevering').courseId).toBe(state.planner.courses[0].id)
  expect(state.planner.events[0].courseId).toBe(state.planner.courses[0].id)
  expect(state.tasks.find(item => item.title === 'Kalenderoppgave').deadlineLocal).toBe('2026-09-19T14:00')
  expect(state.sessions || []).toEqual([])
  expect(external).toEqual([])
})
async function capture(page, info, name, target) {
  if (target) await target.evaluate(node => { node.scrollTop = 0 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (target) expect(await target.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: !target })
}

for (const [width, size] of [[1440, 16], [390, 16], [390, 32]]) {
  test(`A07–A12 connected recovery and work closure at ${width}px / ${size}px text`, async ({ page }, info) => {
    const first = task('report', { title: 'Skriv rapporten', requiresSubmission: true, submitted: false, splittable: false })
    const waiting = task('waiting', { title: 'Avklar gruppens problemstilling', waitingReason: 'Venter på avklaring av problemstillingen', nextStep: { description: 'Be om avklaringen som gruppen trenger', estimatedMinutes: 10, unblocksWaiting: true } })
    const before = { schemaVersion: 1, tasks: [first, waiting], sessions: [{ id: 'tuesday', taskId: first.id, dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:30' }], workWindows: [{ id: 'thursday', start: '2026-09-10T12:00:00Z', end: '2026-09-10T14:00:00Z' }] }
    await boot(page, before, width, size)
    await expect(page.locator('#dashboard-suggestions')).toContainText('Be om avklaringen')
    await capture(page, info, 'next-action')
    const open = page.locator('.connected-plan-actions').getByRole('button', { name: 'Jeg ligger etter', exact: true })
    await open.click()
    const replan = page.getByRole('dialog', { name: 'Jeg ligger etter', exact: true })
    await expect(replan).toContainText('Fra: 2026-09-08 10:00–10:30')
    await expect(replan.getByLabel('Ny dato', { exact: true }).first()).toHaveValue('2026-09-10')
    await expect(replan.getByLabel('Ny start', { exact: true }).first()).toHaveValue('14:00')
    await capture(page, info, 'recovery-preview', replan)
    await replan.getByRole('button', { name: 'Forkast', exact: true }).click()
    expect(await stored(page)).toEqual(before)
    await open.click(); await replan.getByRole('button', { name: 'Godta hele planen', exact: true }).click()
    expect((await stored(page)).sessions[0]).toMatchObject({ id: 'tuesday', dateLocal: '2026-09-10', startTime: '14:00' })
    await navigate(page, 'settings')
    await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
    expect((await stored(page)).sessions).toEqual(before.sessions)
    await navigate(page, 'capacity')
    await page.locator('[data-session-id=tuesday]').getByRole('button', { name: 'Avslutt økt', exact: true }).click()
    const work = page.getByRole('dialog', { name: 'Hvordan gikk arbeidet?', exact: true })
    await work.getByLabel('Faktisk arbeidstid (minutter, valgfritt)').fill('30')
    await work.getByLabel('Gjenstående arbeid (minutter)', { exact: true }).fill('45')
    await capture(page, info, 'work-closure', work)
    await work.getByRole('button', { name: 'Bekreft arbeid', exact: true }).click()
    const after = await stored(page)
    expect(after.tasks[0]).toMatchObject({ remainingMinutes: 45, completed: false, submitted: false })
    expect(after.workLogs).toHaveLength(1)
    expect(after.workLogs[0]).toMatchObject({ actualMinutes: 30, plannedMinutes: 30, outcome: 'more' })
    await page.reload(); expect((await stored(page)).workLogs).toHaveLength(1)
  })

  test(`A05/A06 real document controls retain a clarified date across repeated imports at ${width}px / ${size}px text`, async ({ page }, info) => {
    await boot(page, null, width, size)
    const text = 'Innlevering rapport frist 16.09 kl. 14:00'
    async function preview() {
      await navigate(page, 'subjects')
      await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
      await page.getByRole('button', { name: 'Fra dokument eller tekst', exact: true }).click()
      await page.getByLabel('Eller lim inn tekst').fill(text)
      await page.getByRole('button', { name: 'Lag forhåndsvisning', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Kontroller planen før import' })).toBeVisible()
    }
    await preview()
    const confirm = page.getByRole('button', { name: 'Bekreft valgt plan', exact: true })
    await confirm.click()
    await expect(page.locator('.document-preview [role=alert]')).toContainText('Ingen del av planen er lagret')
    expect(await stored(page)).toBeNull()
    await capture(page, info, 'document-uncertain-date')
    await page.getByLabel('Dato og klokkeslett i norsk tid', { exact: true }).fill('2026-09-16T14:00')
    await confirm.click()
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
    const first = await stored(page)
    expect(first.tasks).toHaveLength(1); expect(first.tasks[0].deadlineLocal).toBe('2026-09-16T14:00')
    await page.reload(); await preview()
    await expect(page.locator('.document-preview')).toContainText('Din tidligere avklaring av fristen er beholdt')
    await confirm.click()
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
    expect((await stored(page)).tasks).toEqual(first.tasks)
  })
}
