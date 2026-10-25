import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import ICAL from 'ical.js'
import { calendarUid } from '../../src/calendar-export.js'
import { eventBlocksTime, validPlanner } from '../../src/planner.js'
import { key, navigate, reveal, tabTo } from './helpers.js'
import { openTpImport, confirmTpImport, savedTpState, runtimeUrl, captureTp } from './tp-csv-helpers.js'

// Independently invented accepted legacy timestamps; CSV intentionally refuses
// sub-millisecond input. Personal intervals are then imported through real forms.
const legacy = {
  schemaVersion: 1, tasks: [], sessions: [], onboarding: { dismissed: true, completed: true },
  planner: {
    courses: [{ id: 'synthetic-export-course', code: 'SYN842', name: 'Oppdiktet eksportemne', university: '', year: 2026, semester: 'autumn', credits: null }],
    sources: [], events: [
      { id: 'synthetic-legacy-fraction', courseId: 'synthetic-export-course', title: 'Oppdiktet mikrosekund', start: '2026-10-25T09:00:00.000001Z', end: '2026-10-25T10:00:00.000001Z' },
      { id: 'synthetic-legacy-fold', courseId: 'synthetic-export-course', title: 'Oppdiktet gjentatt time', start: '2026-10-25T00:30:07Z', end: '2026-10-25T01:30:07Z' },
    ],
  },
}
const personal = ['BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:synthetic-export-days', 'SUMMARY:Oppdiktede hele dager', 'X-STUDIEPLAN-ACTIVITY-KIND:personal', 'DTSTART;VALUE=DATE:20261024', 'DTEND;VALUE=DATE:20261027', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:synthetic-export-night', 'SUMMARY:Oppdiktet nattaktivitet', 'X-STUDIEPLAN-ACTIVITY-KIND:personal', 'DTSTART:20261024T210000Z', 'DTEND:20261025T020000Z', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:synthetic-export-teaching-days', 'SUMMARY:Oppdiktede undervisningsdager', 'DTSTART;VALUE=DATE:20261024', 'DTEND;VALUE=DATE:20261027', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:synthetic-export-information', 'SUMMARY:Oppdiktet informasjon', 'DTSTART:20261025T110000Z', 'DTEND:20261025T120000Z', 'TRANSP:TRANSPARENT', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n')

test('Closure export edges: exact review and actual download retain personal dates and overlapping intervals', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl), 'Synthetic legacy localStorage state uses its isolated Vite browser only.')
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic export test uses no external source.' } }))
  await page.goto('/')
  await page.evaluate(({ key, legacy }) => localStorage.setItem(key, JSON.stringify(legacy)), { key, legacy })
  await page.reload()
  await openTpImport(page, { text: personal, name: 'synthetic-export-personal.ics' })
  await confirmTpImport(page)
  const imported = await savedTpState(page)
  expect(imported.planner.events).toHaveLength(6)
  expect(imported.planner.events.find(event => event.id === legacy.planner.events[0].id)).toEqual(legacy.planner.events[0])
  expect(imported.planner.events.filter(event => event.activityKind === 'personal')).toHaveLength(2)
  await navigate(page, 'calendar')
  await page.locator('[data-calendar-view=day]').click()
  await page.locator('#full-calendar-date').fill('2026-10-25')
  await page.locator('#full-calendar-date').press('Tab')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390) await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
    await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
    await dialog.getByLabel('Undervisning', { exact: true }).check()
    await dialog.getByLabel('Egne aktiviteter', { exact: true }).check()
    await expect(dialog.locator('[data-export-included] li')).toHaveCount(4)
    await expect(dialog.locator('[data-export-omissions] li')).toHaveCount(2)
    await expect(dialog.locator('[data-export-included]')).toContainText('2026-10-25 02:30:07 (+02:00) – 2026-10-25 02:30:07 (+01:00)')
    await expect(dialog.locator('[data-export-included]')).toContainText('2026-10-24 – 2026-10-27 (sluttdato ikke inkludert)')
    await expect(dialog.locator('[data-export-included]')).toContainText('Oppdiktet nattaktivitet')
    await expect(dialog.locator('[data-export-omissions]')).toContainText('2026-10-25 10:00:00.000001 (+01:00) – 2026-10-25 11:00:00.000001 (+01:00)')
    await expect(dialog.locator('[data-export-omissions]')).toContainText('hele sekunder')
    await expect(dialog.locator('[data-export-omissions]')).toContainText('Oppdiktet informasjon')
    await expect(dialog.locator('[data-export-omissions]')).toContainText('reserverer ikke tid')
    await dialog.getByLabel('Undervisning', { exact: true }).uncheck()
    await expect(dialog.locator('[data-export-included] li')).toHaveCount(2)
    await expect(dialog.locator('[data-export-omissions] li')).toHaveCount(0)
    await dialog.getByLabel('Undervisning', { exact: true }).check()
    await tabTo(page, dialog.getByRole('button', { name: 'Last ned .ics', exact: true }))
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await captureTp(page, info, `closure-export-edge-${width}.png`, { target: dialog.locator('[data-export-omissions]') })
    const before = await savedTpState(page)
    const pending = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    const source = readFileSync(await (await pending).path(), 'utf8')
    const output = new ICAL.Component(ICAL.parse(source)).getAllSubcomponents('vevent')
    expect(output).toHaveLength(4)
    expect(source).not.toContain('Oppdiktet mikrosekund')
    expect(source).not.toContain('Oppdiktet informasjon')
    const selected = imported.planner.events.filter(event => event.id !== 'synthetic-legacy-fraction' && !event.transparent)
    for (const event of selected) {
      const entry = output.find(item => item.getFirstPropertyValue('uid') === calendarUid(event.activityKind === 'personal' ? 'personal' : 'teaching', event.id))
      expect(entry).toBeTruthy()
      expect(entry.getFirstPropertyValue('transp')).toBe(eventBlocksTime(event) ? 'OPAQUE' : 'TRANSPARENT')
      if (event.allDay) {
        expect(entry.getFirstPropertyValue('dtstart').isDate).toBe(true)
        expect(entry.getFirstPropertyValue('dtend').isDate).toBe(true)
        expect(entry.getFirstPropertyValue('dtstart').toString()).toBe('2026-10-24')
        expect(entry.getFirstPropertyValue('dtend').toString()).toBe('2026-10-27')
      } else {
        expect(entry.getFirstPropertyValue('dtstart').toJSDate().getTime()).toBe(Date.parse(event.start))
        expect(entry.getFirstPropertyValue('dtend').toJSDate().getTime()).toBe(Date.parse(event.end))
      }
    }
    await expect(page.locator('.calendar-export-feedback')).toContainText('4 eksportert, 2 utelatt')
    expect(await savedTpState(page)).toEqual(before)
  }
  await page.reload()
  expect((await savedTpState(page)).planner).toEqual(imported.planner)
})

test('Closure export edited DATE: visible edits are disclosed and omitted from the actual download', async ({ page }, info) => {
  test.skip(Boolean(runtimeUrl), 'Synthetic edited-import state uses its isolated Vite browser only.')
  await page.clock.setFixedTime(new Date('2045-04-17T08:00:00Z'))
  await page.route('**/api/import/**', route => route.fulfill({ status: 500, json: { error: 'Synthetic export test uses no external source.' } }))
  await page.goto('/')
  const initial = { ...legacy, planner: { ...legacy.planner, events: [] } }
  await page.evaluate(({ key, initial }) => localStorage.setItem(key, JSON.stringify(initial)), { key, initial })
  await page.reload()
  const source = ['BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:synthetic-edited-personal-date', 'SUMMARY:Oppdiktet endret egen dag', 'X-STUDIEPLAN-ACTIVITY-KIND:personal', 'DTSTART;VALUE=DATE:20450418', 'DTEND;VALUE=DATE:20450420', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:synthetic-edited-teaching-date', 'SUMMARY:Oppdiktet endret undervisningsdag', 'DTSTART;VALUE=DATE:20450418', 'DTEND;VALUE=DATE:20450420', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:synthetic-unchanged-timed-control', 'SUMMARY:Oppdiktet uendret kontroll', 'DTSTART:20450418T110000Z', 'DTEND:20450418T120000Z', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n')
  await openTpImport(page, { text: source, name: 'synthetic-edited-calendar-dates.ics' })
  await confirmTpImport(page)
  await page.getByRole('button', { name: 'Tilbake til Mine emner', exact: true }).click()
  for (const [kind, title] of [['egen aktivitet', 'Oppdiktet endret egen dag'], ['undervisning', 'Oppdiktet endret undervisningsdag']]) {
    await (await reveal(page.getByRole('button', { name: `Rediger ${kind} ${title}`, exact: true }))).click()
    const editor = page.locator('#subject-editor')
    await editor.locator('[name=startLocal]').fill('2045-04-18T10:00')
    await editor.locator('[name=endLocal]').fill('2045-04-18T11:00')
    await editor.getByRole('button', { name: `Lagre ${kind}`, exact: true }).click()
    await expect(editor).toBeHidden()
  }
  const edited = await savedTpState(page)
  expect(edited.planner.events).toHaveLength(3)
  expect(validPlanner(edited.planner)).toBe(true)
  const omitted = edited.planner.events.filter(event => event.allDay)
  expect(omitted).toHaveLength(2)
  for (const event of omitted) expect(event).toMatchObject({ start: '2045-04-18T08:00:00Z', end: '2045-04-18T09:00:00Z', allDay: true })
  const included = edited.planner.events.find(event => !event.allDay)
  await navigate(page, 'calendar')
  await page.locator('[data-calendar-view=day]').click()
  await page.locator('#full-calendar-date').fill('2045-04-18')
  await page.locator('#full-calendar-date').press('Tab')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390) await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
    await page.getByRole('button', { name: 'Eksporter kalender', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Eksporter kalender', exact: true })
    await dialog.getByLabel('Undervisning', { exact: true }).check()
    await dialog.getByLabel('Egne aktiviteter', { exact: true }).check()
    await expect(dialog.locator('[data-export-included] li')).toHaveCount(1)
    await expect(dialog.locator('[data-export-omissions] li')).toHaveCount(2)
    for (const event of omitted) {
      const row = dialog.locator('[data-export-omissions] li').filter({ hasText: event.title })
      await expect(row).toContainText('2045-04-18 10:00 (+02:00) – 2045-04-18 11:00 (+02:00)')
      await expect(row).toContainText('Hele kalenderdager krever midnatt i norsk tid')
      await expect(row).toContainText('Heldagsmerkingen stemmer ikke med tidspunktene')
    }
    await tabTo(page, dialog.getByRole('button', { name: 'Last ned .ics', exact: true }))
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await captureTp(page, info, `closure-export-edited-date-${width}.png`, { target: dialog.locator('[data-export-omissions]') })
    const before = await savedTpState(page)
    const pending = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    const downloaded = readFileSync(await (await pending).path(), 'utf8')
    const output = new ICAL.Component(ICAL.parse(downloaded)).getAllSubcomponents('vevent')
    expect(output).toHaveLength(1)
    expect(output[0].getFirstPropertyValue('uid')).toBe(calendarUid('teaching', included.id))
    expect(output[0].getFirstPropertyValue('transp')).toBe('OPAQUE')
    expect(output[0].getFirstPropertyValue('dtstart').toString()).toBe('2045-04-18T11:00:00Z')
    expect(output[0].getFirstPropertyValue('dtend').toString()).toBe('2045-04-18T12:00:00Z')
    for (const event of omitted) expect(downloaded).not.toContain(event.title)
    expect(downloaded).not.toContain('VALUE=DATE')
    await expect(page.locator('.calendar-export-feedback')).toContainText('1 eksportert, 2 utelatt')
    expect(await savedTpState(page)).toEqual(before)
  }
  await page.reload()
  expect((await savedTpState(page)).planner).toEqual(edited.planner)
})
