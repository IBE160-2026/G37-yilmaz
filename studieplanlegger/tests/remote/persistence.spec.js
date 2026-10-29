import { test, expect, chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import ICAL from 'ical.js'
import { freeze, navigate, key, saved, openMenu, row, reveal } from '../e2e/helpers.js'
import { observe, browserMode } from './diagnostics.js'

const title = 'Syntetisk nettprøve: skriv et avgrenset notat'
const phase = process.env.AJOUR_REMOTE_PHASE || 'create'
const now = '2026-09-10T09:00:00+02:00'
const rawStorage = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^(studieplanlegger:|ajour[.:])/.test(key)).sort().map(key => [key, localStorage.getItem(key)])))
const appAssets = page => page.locator('script[src], link[rel=stylesheet]').evaluateAll(nodes => nodes.map(node => new URL(node.src || node.href).pathname).sort())

async function createPlan(page) {
  await freeze(page, '2026-09-09T09:00:00+02:00')
  await page.goto('/')
  await browserMode(page)
  expect(await saved(page)).toBeNull()
  await page.locator('#connected-onboarding').getByRole('button', { name: 'Legg til emne manuelt', exact: true }).click()
  await page.locator('#subject-editor [name=name]').fill('Syntetisk nettemne')
  await page.locator('#subject-editor [name=code]').fill('SYN160')
  await page.locator('#subject-editor').getByRole('button', { name: 'Lagre emne', exact: true }).click()
  const course = (await saved(page)).planner.courses[0]
  await navigate(page, 'overview')
  await page.locator('#connected-onboarding').getByRole('button', { name: 'Ny oppgave', exact: true }).click()
  await page.locator('#title').fill(title)
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  const task = (await saved(page)).tasks[0]
  expect(task).toMatchObject({ courseId: course.id, remainingMinutes: null })

  await navigate(page, 'capacity')
  const windowForm = page.locator('.work-window-form')
  for (const day of ['09', '10']) {
    await windowForm.locator('[name=startLocal]').fill(`2026-09-${day}T10:00`)
    await windowForm.locator('[name=endLocal]').fill(`2026-09-${day}T12:00`)
    await windowForm.getByRole('button', { name: 'Lagre tidsrom', exact: true }).click()
  }
  await navigate(page, 'overview')
  await page.locator('#connected-onboarding').getByRole('button', { name: 'Se planforslag', exact: true }).click()
  const proposal = page.getByRole('dialog', { name: 'Planforslag for oppgaven', exact: true })
  expect((await saved(page)).sessions || []).toEqual([])
  await proposal.getByRole('button', { name: 'Bruk planen', exact: true }).click()
  const initialSessions = (await saved(page)).sessions
  expect(initialSessions).toHaveLength(1)
  expect(initialSessions[0]).toMatchObject({ taskId: task.id, dateLocal: '2026-09-09' })
  await navigate(page, 'overview')
  await page.locator('#connected-onboarding').getByRole('button', { name: 'Fullfør oppstart', exact: true }).click()

  // Advance one day: the missed session must be proposed, approved and undoable.
  await page.clock.setFixedTime(new Date(now))
  await page.reload()
  await navigate(page, 'all')
  const planButton = page.getByRole('button', { name: `Se planforslag «${title}»`, exact: true })
  await (await reveal(planButton)).click()
  await expect(proposal).toContainText('Flyttes fra')
  const beforeProposal = await saved(page)
  await proposal.getByRole('button', { name: 'Ikke nå', exact: true }).click()
  expect(await saved(page)).toEqual(beforeProposal)
  await (await reveal(planButton)).click()
  await proposal.getByRole('button', { name: 'Bruk planen', exact: true }).click()
  expect((await saved(page)).sessions[0].dateLocal).toBe('2026-09-10')
  await navigate(page, 'settings')
  await page.locator('#settings-panel').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  expect((await saved(page)).sessions).toEqual(initialSessions)

  await navigate(page, 'capacity')
  await page.locator(`[data-session-id="${initialSessions[0].id}"]`).getByRole('button', { name: 'Avslutt økt', exact: true }).click()
  const work = page.getByRole('dialog', { name: 'Hva skjedde?', exact: true })
  await work.getByLabel('Faktisk arbeidstid (minutter, valgfritt)').fill('15')
  await work.getByRole('button', { name: 'Lagre utfallet', exact: true }).click()
  const afterWork = await saved(page)
  expect(afterWork.workLogs).toHaveLength(1)
  expect(afterWork.workLogs[0]).toMatchObject({ taskId: task.id, actualMinutes: 15, plannedMinutes: 30, outcome: 'more' })
  expect(afterWork.tasks[0]).toMatchObject({ completed: false, remainingMinutes: null })

  await navigate(page, 'all')
  await openMenu(page, title)
  await row(page, title).getByRole('button', { name: /Administrer arbeidssteg/ }).click()
  const steps = page.locator('.work-steps-dialog')
  await steps.getByRole('button', { name: 'Legg til manuelt steg', exact: true }).click()
  await steps.getByLabel('Navn på steg 1', { exact: true }).fill('Syntetisk første avsnitt')
  await steps.getByRole('button', { name: 'Marker fullført', exact: true }).click()
  await steps.getByRole('button', { name: 'Lagre alle steg', exact: true }).click()
  expect((await saved(page)).tasks[0]).toMatchObject({ completed: false, steps: [{ title: 'Syntetisk første avsnitt', completed: true }] })
  await (await reveal(planButton)).click()
  await proposal.getByRole('button', { name: 'Bruk planen', exact: true }).click()
  expect((await saved(page)).sessions.length).toBeGreaterThan(0)
}

async function backupAndCalendar(page, browser, baseURL, info) {
  await navigate(page, 'calendar')
  await page.locator('#full-calendar-date').fill('2026-09-10')
  await page.locator('[data-calendar-view=week]').click()
  await page.clock.runFor(500)
  await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
  const exportDialog = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
  const icsPending = page.waitForEvent('download')
  await exportDialog.getByRole('button', { name: 'Last ned .ics', exact: true }).click()
  const ics = await readFile(await (await icsPending).path(), 'utf8')
  const events = new ICAL.Component(ICAL.parse(ics)).getAllSubcomponents('vevent')
  expect(events.length).toBeGreaterThan(0)
  expect(events.some(event => String(event.getFirstPropertyValue('summary')).includes(title))).toBe(true)
  for (const event of events) {
    expect(event.getFirstPropertyValue('uid')).toBeTruthy()
    expect(event.getFirstPropertyValue('dtstart')).toBeTruthy()
  }
  await info.attach('synthetic-calendar.ics', { contentType: 'text/calendar', body: ics })
  await page.keyboard.press('Escape')
  await navigate(page, 'settings')
  const snapshot = await saved(page)
  const backupPending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksporter sikkerhetskopi', exact: true }).click()
  const bytes = await readFile(await (await backupPending).path())
  const backup = JSON.parse(bytes.toString())
  expect(backup.format).toBe('studieplan-local-backup')
  expect(backup.data).toEqual(snapshot)

  // A second, isolated profile starts empty at exactly the same origin. It gets
  // the plan only after the user explicitly restores the downloaded backup.
  const otherContext = await browser.newContext({ baseURL, timezoneId: 'Europe/Oslo' })
  try {
    const other = await otherContext.newPage()
    await freeze(other, now)
    await other.goto('/')
    await browserMode(other)
    expect(await saved(other)).toBeNull()
    await other.locator('#connected-onboarding').getByRole('button', { name: 'Legg til oppgave', exact: true }).click()
    await other.locator('#title').fill('Syntetisk bare i profil B')
    await other.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
    expect((await saved(other)).tasks).toHaveLength(1)
    expect(await saved(page)).toEqual(snapshot)
    await navigate(other, 'settings')
    const beforeRestore = await saved(other)
    await other.locator('#backup-file').setInputFiles({ name: 'synthetic-portable.json', mimeType: 'application/json', buffer: bytes })
    const restore = other.getByRole('dialog', { name: 'Forhåndsvis gjenoppretting', exact: true })
    await expect(restore).toBeVisible()
    expect(await saved(other)).toEqual(beforeRestore)
    await restore.getByRole('button', { name: 'Erstatt lokale data', exact: true }).click()
    expect(await saved(other)).toEqual(backup.data)
    await other.reload()
    expect(await saved(other)).toEqual(backup.data)
    expect(await saved(page)).toEqual(snapshot)
  } finally { await otherContext.close() }
}

test('owned synthetic profile survives browser close and same-origin redeployment', async ({ browser, baseURL }, info) => {
  test.setTimeout(180_000)
  const id = process.env.AJOUR_REMOTE_PROFILE
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(id || '')) throw new Error('Set AJOUR_REMOTE_PROFILE to a new synthetic run ID; use that same ID for verify.')
  const runDir = fileURLToPath(new URL(`../../artifacts/remote-persistence/${id}/`, import.meta.url))
  const marker = join(runDir, 'synthetic-profile.json')
  const snapshotPath = join(runDir, 'expected-state.json')
  const profile = join(runDir, 'browser-profile')
  const deployment = process.env.AJOUR_REMOTE_DEPLOYMENT || 'unlabelled'
  if (phase === 'create') {
    await mkdir(runDir, { recursive: true })
    await writeFile(marker, JSON.stringify({ syntheticOnly: true, origin: baseURL, createdAt: new Date().toISOString() }), { flag: 'wx' })
  } else {
    const owned = JSON.parse(await readFile(marker, 'utf8'))
    expect(owned).toMatchObject({ syntheticOnly: true, origin: baseURL })
  }
  const launch = () => chromium.launchPersistentContext(profile, { baseURL, timezoneId: 'Europe/Oslo', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', headless: true })
  let context = await launch()
  let expected
  try {
    const page = await context.newPage()
    const observations = observe(page)
    try {
      if (phase === 'create') {
        await createPlan(page)
        await backupAndCalendar(page, browser, baseURL, info)
        await page.clock.runFor(500)
        expected = { origin: baseURL, deployment, createdAt: new Date().toISOString(), assets: await appAssets(page), storage: await rawStorage(page) }
        await writeFile(snapshotPath, JSON.stringify(expected, null, 2), { flag: 'wx' })
      } else {
        expected = JSON.parse(await readFile(snapshotPath, 'utf8'))
        expect(expected.origin).toBe(baseURL)
        await freeze(page, now)
        await page.goto('/')
        await browserMode(page)
        expect(await rawStorage(page)).toEqual(expected.storage)
        await navigate(page, 'all')
        await expect(row(page, title)).toBeVisible()
        const state = await saved(page)
        expect(state.workLogs[0]).toMatchObject({ actualMinutes: 15, outcome: 'more' })
        expect(state.tasks[0].steps[0].completed).toBe(true)
        await info.attach('same-origin-persistence', { contentType: 'application/json', body: JSON.stringify({ origin: baseURL, createdAgainst: expected.deployment, verifiedAgainst: deployment, checkedAt: new Date().toISOString(), beforeAssets: expected.assets, afterAssets: await appAssets(page), exactStorage: true, note: 'Redeployment itself is evidenced by the release command; this test proves preservation across the two runs at the same origin.' }, null, 2) })
      }
    } finally { await observations.finish(info) }
  } finally { await context.close() }
  if (phase === 'create') {
    // A real Chromium process is closed and launched with the same owned profile.
    context = await launch()
    try {
      const reopened = await context.newPage()
      await freeze(reopened, now)
      await reopened.goto('/')
      await browserMode(reopened)
      expect(await rawStorage(reopened)).toEqual(expected.storage)
    } finally { await context.close() }
  }
})
