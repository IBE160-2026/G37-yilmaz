import { test, expect } from '@playwright/test'

const key = 'studieplanlegger:v1'
const now = '2026-09-07T07:00:00.000Z'
const state = {
  schemaVersion: 1,
  tasks: [
    { id: 'presentation', title: 'Presentasjonen', course: 'DES100', deadlineLocal: '2026-09-07T12:00', estimatedMinutes: null, remainingEstimate: { minMinutes: 60, maxMinutes: 120 }, nextStep: { description: 'Skriv disposisjon', estimatedMinutes: 30 }, completed: false },
    { id: 'reading', title: 'Les pensum', course: 'DES100', deadlineLocal: '2026-09-09T12:00', estimatedMinutes: 45, nextStep: { description: 'Les kapittel 3', estimatedMinutes: 15 }, completed: false },
    { id: 'references', title: 'Kontroller kilder', course: 'MET100', deadlineLocal: '2026-09-10T12:00', estimatedMinutes: 30, nextStep: { description: 'Kontroller referanselisten', estimatedMinutes: 20 }, completed: false },
  ],
  sessions: [],
  workWindows: [{ id: 'today', start: '2026-09-07T08:00:00Z', end: '2026-09-07T09:15:00Z' }],
  busyWindows: [],
  planningPreferences: { minimumMinutes: 15, sessionMinutes: 45, maximumMinutes: 60, breakMinutes: 0 },
  planner: { courses: [], events: [], sources: [] },
  onboarding: { dismissed: true, completed: true },
}

async function boot(page, width, fontSize = 16) {
  await page.setViewportSize({ width, height: 1000 })
  await page.clock.install({ time: new Date(now) })
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await page.reload()
  await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` })
}

for (const width of [1440, 1280, 390]) {
  test(`oversikt og umiddelbare forslag ved ${width}px`, async ({ page }, info) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await boot(page, width, width === 390 ? 20 : 16)

    await expect(page.getByRole('heading', { name: 'Status i dag' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Presentasjonen har anslagsvis 1–2 timer arbeid igjen')
    await expect(page.getByRole('status')).toContainText('Det kan mangle opptil 45 minutter')
    await expect(page.getByRole('heading', { name: 'Jeg har tid nå' })).toBeVisible()
    await expect(page.getByText('Hvor mye tid har du?')).toBeVisible()

    await page.getByRole('button', { name: '15 min', exact: true }).click()
    await expect(page.locator('#dashboard-suggestions')).toContainText('Les kapittel 3')
    await page.getByRole('button', { name: '30 min', exact: true }).click()
    await expect(page.locator('#dashboard-suggestions')).toContainText('Skriv disposisjon')
    await expect(page.locator('#dashboard-suggestions > li:visible')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Vis neste' })).toBeVisible()
    await page.getByRole('button', { name: 'Vis neste' }).click()
    await expect(page.locator('#dashboard-suggestions > li:visible')).toHaveCount(3)
    await expect(page.locator('#dashboard-suggestions > li').nth(1)).toContainText('Alternativ')
    await expect(page.locator('#dashboard-suggestions > li').nth(1)).toContainText('Kontroller referanselisten')
    await expect(page.locator('#dashboard-suggestions > li').nth(2)).toContainText('Kort oppgave')
    await expect(page.locator('#dashboard-suggestions > li').nth(2)).toContainText('Les kapittel 3')

    const labels = await page.locator('.view-actions > button:visible, .view-actions > .nav-secondary > button:visible').allTextContents()
    expect(width === 390 ? labels : labels.slice(0, 6)).toEqual(width === 390
      ? ['Oversikt', 'Kalender', 'Oppgaver', 'Emner', 'Mer']
      : ['Oversikt', 'Kalender', 'Alle oppgaver', 'Mine emner', 'Planlegg uken', 'Innstillinger'])

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 390) {
      const order = await page.evaluate(() => ['#daily-overview', '#focus-panel', '#dashboard-suggestions', '#next-plan'].map(selector => document.querySelector(selector)?.getBoundingClientRect().top))
      expect(order.every((value, index) => index === 0 || value >= order[index - 1])).toBe(true)
      const nav = page.locator('.view-actions')
      expect((await nav.boundingBox()).y + (await nav.boundingBox()).height).toBeLessThanOrEqual(1000)
    }
    expect(errors).toEqual([])
    await page.screenshot({ path: info.outputPath(`oversikt-${width}.png`), fullPage: true })
  })
}

test('positiv dagsstatus viser at planen går opp uten omplanleggingsknapp', async ({ page }) => {
  const positive = structuredClone(state)
  positive.tasks[0].remainingEstimate = { minMinutes: 60, maxMinutes: 60 }
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.clock.install({ time: new Date(now) })
  await page.goto('/')
  await page.evaluate(({ key, positive }) => localStorage.setItem(key, JSON.stringify(positive)), { key, positive })
  await page.reload()
  await expect(page.getByRole('status')).toContainText('Planen går opp')
  await expect(page.getByRole('button', { name: 'Se realistisk forslag' })).toHaveCount(0)
})

test('start, øktutfall, arbeidskrav og realistisk forslag er eksplisitte', async ({ page }, info) => {
  await boot(page, 1280)
  await page.getByRole('button', { name: '30 min', exact: true }).click()
  await page.getByRole('button', { name: 'Start «Presentasjonen»' }).click()
  const session = page.getByRole('dialog', { name: 'Skriv disposisjon' })
  await expect(session).toContainText('Planlagt varighet: 30 minutter')
  await session.getByRole('button', { name: 'Start økten' }).click()
  await expect(session).toContainText('Ingenting regnes som utført')
  await session.getByRole('button', { name: 'Avslutt økten' }).click()

  const outcome = page.getByRole('dialog', { name: 'Hva skjedde?' })
  await outcome.getByLabel('Trenger mer tid').check()
  await outcome.getByLabel('Gjenstående arbeid').selectOption('from120to240')
  await outcome.getByRole('button', { name: 'Lagre utfallet' }).click()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  expect(saved.tasks.find(task => task.id === 'presentation').remainingEstimate).toEqual({ minMinutes: 120, maxMinutes: 240 })
  expect(saved.tasks.find(task => task.id === 'presentation').completed).toBe(false)

  await page.getByRole('button', { name: 'Legg inn arbeidskrav' }).click()
  await expect(page.getByRole('heading', { name: 'Legg inn arbeidskrav' })).toBeVisible()
  await expect(page.getByText(/lokalt i nettleseren/)).toBeVisible()
  await expect(page.getByLabel('Velg fil')).toHaveAttribute('accept', /pdf/)
  await expect(page.getByLabel('Eller lim inn tekst')).toBeVisible()

  await page.getByRole('button', { name: 'Oversikt', exact: true }).click()
  await page.getByRole('button', { name: 'Se realistisk forslag' }).click()
  const replan = page.getByRole('dialog', { name: 'Planforslag for oppgaven' })
  await expect(replan).toContainText('Presentasjonen')
  await expect(replan).toContainText('2 økter legges til')
  await expect(replan).toContainText('45–165 min mangler')
  await expect(replan.getByRole('button', { name: 'Bruk planen' })).toBeVisible()
  await expect(replan.getByRole('button', { name: 'Ikke nå' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('realistisk-forslag.png'), fullPage: true })
})

test('utført arbeidssteg kan fullføre oppgaven uten å markere den levert', async ({ page }) => {
  await boot(page, 1280)
  await page.getByRole('button', { name: '30 min', exact: true }).click()
  await page.getByRole('button', { name: 'Start «Presentasjonen»' }).click()
  const session = page.getByRole('dialog', { name: 'Skriv disposisjon' })
  await session.getByRole('button', { name: 'Start økten' }).click()
  await session.getByRole('button', { name: 'Avslutt økten' }).click()
  const outcome = page.getByRole('dialog', { name: 'Hva skjedde?' })
  await outcome.getByRole('radio', { name: 'Utført', exact: true }).check()
  await outcome.getByLabel('Hele oppgaven er ferdig').check()
  await outcome.getByRole('button', { name: 'Lagre utfallet' }).click()

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  const task = saved.tasks.find(candidate => candidate.id === 'presentation')
  expect(task).toMatchObject({ completed: true })
  expect(task.submittedAt ?? null).toBeNull()
  expect(task.remainingEstimate).toBeUndefined()
})

test('tom konto viser ett oppstartssteg og tillater oppgave uten emne', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date(now) })
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [] })), key)
  await page.reload()
  const onboarding = page.locator('#connected-onboarding')
  await expect(onboarding).toContainText('STEG 1 AV 3')
  await expect(onboarding.getByRole('heading', { name: 'Legg til et emne' })).toBeVisible()
  await onboarding.getByRole('button', { name: 'Hopp over import' }).click()
  await expect(page.locator('#task-form')).toBeVisible()
  await page.getByLabel('Tittel').fill('Oppgave uten emne')
  await page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(onboarding).toContainText('STEG 3 AV 3')
  await expect(onboarding.getByRole('button', { name: 'Se planforslag' })).toBeVisible()
  await expect(onboarding.getByRole('button', { name: 'Tilbake' })).toBeVisible()
})

test('større tekst og tastatur beholder fokus og bredde på mobil', async ({ page }) => {
  await boot(page, 390, 24)
  const choice = page.getByRole('button', { name: '45 min', exact: true })
  await choice.focus()
  await expect(choice).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#available-minutes')).toHaveValue('45')
  await expect(choice).toHaveCSS('outline-style', 'solid')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement.getBoundingClientRect().right <= innerWidth)).toBe(true)
})
