import { test, expect } from '@playwright/test'
import { freeze, instrumentWrites, key, navigate, raw, reveal, saved, tabTo, writes } from './helpers.js'

// Invented data in isolated Playwright profiles. Technical regression checks,
// not the owner's personal trial or the previously passed Outlook test.
const emptyState = () => ({
  schemaVersion: 1, tasks: [], sessions: [], planner: { courses: [], events: [], sources: [] },
  onboarding: { dismissed: true, completed: true },
})

async function boot(page, state, width) {
  await page.setViewportSize({ width, height: 1000 })
  await freeze(page, '2026-11-01T12:00:00+01:00')
  await page.goto('/')
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state })
  await instrumentWrites(page)
  await page.reload()
  await navigate(page, 'capacity')
  expect(await writes(page)).toEqual([])
}

for (const width of [1440, 390]) {
  test(`Norwegian session errors retain the draft and saved data at ${width}px`, async ({ page }, info) => {
    const state = emptyState()
    await boot(page, state, width)
    const before = await raw(page)
    await (await reveal(page.locator('#new-session'))).click()
    const form = page.locator('#session-form'), error = form.locator('#session-error')
    for (const [dateLocal, startTime, message] of [
      ['2026-10-25', '02:15', 'Klokkeslettet er tvetydig fordi det forekommer to ganger ved overgang til vintertid. Velg et klokkeslett utenfor den gjentatte timen.'],
      ['2026-03-29', '02:15', 'Klokkeslettet finnes ikke ved overgang til sommertid. Velg et klokkeslett før eller etter tidsskiftet.'],
      ['2026-11-01', '25:00', 'Oppgi en gyldig dato og et gyldig klokkeslett i norsk tid.'],
    ]) {
      await form.getByLabel('Dato for studieøkt', { exact: true }).fill(dateLocal)
      await form.getByLabel('Start (24 timer)', { exact: true }).fill(startTime)
      await form.getByLabel('Slutt (24 timer)', { exact: true }).fill('04:00')
      await tabTo(page, form.getByRole('button', { name: 'Lagre studieøkt', exact: true }))
      await page.keyboard.press('Enter')
      await expect(error).toHaveText(message)
      await expect(error).toHaveAttribute('role', 'alert')
      await expect(form.getByLabel('Dato for studieøkt', { exact: true })).toBeFocused()
      await expect(form.getByLabel('Start (24 timer)', { exact: true })).toHaveValue(startTime)
      await expect(form.getByLabel('Start (24 timer)', { exact: true })).toHaveAttribute('aria-invalid', 'true')
      expect(await raw(page)).toBe(before)
      expect(await writes(page)).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (dateLocal === '2026-10-25') await page.screenshot({ path: info.outputPath(`norwegian-time-error-${width}.png`) })
    }
    await form.getByLabel('Dato for studieøkt', { exact: true }).fill('2026-10-25')
    await form.getByLabel('Start (24 timer)', { exact: true }).fill('03:15')
    await form.getByLabel('Slutt (24 timer)', { exact: true }).fill('03:45')
    await form.getByRole('button', { name: 'Lagre studieøkt', exact: true }).click()
    await expect(form).toBeHidden()
    const after = await saved(page)
    expect(after.sessions).toHaveLength(1)
    expect(after.sessions[0]).toMatchObject({ dateLocal: '2026-10-25', startTime: '03:15', endTime: '03:45' })
    expect(after.tasks).toEqual(state.tasks)
    await page.reload()
    expect((await saved(page)).sessions).toEqual(after.sessions)
  })

  test(`six reservation warnings become one explanation without changing capacity at ${width}px`, async ({ page }, info) => {
    const task = { id: 'synthetic-capacity', title: 'Syntetisk kapasitet', course: '', estimatedMinutes: 1200, remainingMinutes: 1200, completed: false, splittable: true }
    const state = { ...emptyState(), tasks: [task],
      sessions: Array.from({ length: 6 }, (_, index) => ({ id: `synthetic-reservation-${index}`, taskId: task.id, dateLocal: '2026-10-30', startTime: `${String(8 + index).padStart(2, '0')}:00`, endTime: `${String(8 + index).padStart(2, '0')}:30` })),
      workWindows: [{ id: 'synthetic-work', start: '2026-11-02T08:00:00+01:00', end: '2026-11-02T16:00:00+01:00' }],
    }
    await boot(page, state, width)
    const row = page.locator(`[data-capacity-task="${task.id}"]`)
    await reveal(row)
    await expect(row).toBeVisible()
    const reason = 'Deler av reservasjonen er passert, opptatt eller utenfor arbeidstiden.'
    await expect(row).toContainText(reason)
    expect((await row.textContent()).split(reason)).toHaveLength(2)
    await expect(row).toContainText('720 min mangler før fristen i registrert arbeidstid.')
    await expect(row).toContainText('Forslag inkludert: 480 min')
    await expect(page.locator('#session-list > li')).toHaveCount(6)
    expect(await saved(page)).toEqual(state)
    expect(await writes(page)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await row.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`capacity-explanation-${width}.png`) })
  })
}
