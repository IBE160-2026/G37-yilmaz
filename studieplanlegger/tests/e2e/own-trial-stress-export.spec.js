import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import ICAL from 'ical.js'
import { freeze, key, navigate, saved } from './helpers.js'

test('F07 and F08 actual downloads retain one course prefix and stable event identity with a fresh UTC stamp', async ({ page }) => {
  await freeze(page, '2026-11-02T10:00:00+01:00')
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, tasks: [], sessions: [], onboarding: { completed: true, dismissed: true },
    planner: { sources: [], courses: [{ id: 'synthetic-export-course', code: 'QA001', name: 'Syntetisk emne', university: '', year: 2026, semester: 'autumn', credits: null, notes: '' }],
      events: [{ id: 'synthetic-export-event', courseId: 'synthetic-export-course', title: '[QA001] Syntetisk undervisning – æøå', start: '2026-11-02T10:00:00Z', end: '2026-11-02T11:00:00Z', location: 'Syntetisk rom', notes: '' }] },
  })), key)
  await page.reload()
  await navigate(page, 'calendar')
  await page.locator('[data-calendar-view=day]').click()
  await page.locator('#full-calendar-date').fill('2026-11-02')
  await page.locator('#full-calendar-date').press('Tab')
  const outputs = []
  for (const now of ['2026-11-02T09:00:00Z', '2026-11-02T09:01:00Z']) {
    await page.clock.setSystemTime(new Date(now))
    const before = await saved(page)
    await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
    await dialog.getByLabel('Undervisning', { exact: true }).check()
    const pending = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Last ned .ics', exact: true }).click()
    const source = await readFile(await (await pending).path(), 'utf8')
    const calendar = new ICAL.Component(ICAL.parse(source)), events = calendar.getAllSubcomponents('vevent')
    expect(calendar.getFirstPropertyValue('method')).toBe('PUBLISH')
    expect(events).toHaveLength(1)
    const value = name => events[0].getFirstPropertyValue(name)?.toString()
    expect(value('summary')).toBe('[QA001] Syntetisk undervisning – æøå')
    expect(value('dtstamp')).toBe(now)
    expect(value('dtstart')).toBe('2026-11-02T10:00:00Z')
    expect(value('dtend')).toBe('2026-11-02T11:00:00Z')
    expect(value('location')).toBe('Syntetisk rom')
    outputs.push(value('uid'))
    expect((await saved(page)).planner).toEqual(before.planner)
  }
  expect(outputs[1]).toBe(outputs[0])
})
