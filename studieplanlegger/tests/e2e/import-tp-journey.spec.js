import { reveal } from './helpers.js'
import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { importMiddleware } from '../../server/import-api.js'
import { navigate, openImportMethod, key } from './helpers.js'

// An isolated transport fixture exercises the real import middleware and TP
// adapter. All records are invented; no request reaches a public service.
async function fixture(page, fetchTextImpl) {
  const server = createServer((req, res) => importMiddleware(req, res, () => { res.writeHead(404); res.end() }, { fetchTextImpl }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = `http://127.0.0.1:${server.address().port}`
  await page.route('**/api/import/calendar', async route => {
    const response = await fetch(`${address}/api/import/calendar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: route.request().postData() })
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() })
  })
  return async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}

test('usability: eight published TP group members save with one group action and one confirmation', async ({ page }) => {
  const close = await fixture(page, async (input, _redirects, guard) => {
    const url = new URL(input); guard?.(url)
    if (url.pathname.endsWith('semesters.php')) return JSON.stringify([{ id: '39v', year: 2039, season: 'SPRING', fromdate: '2039-01-01', todate: '2039-06-30', random_int: 972, publish_timetable: true }])
    if (url.pathname.endsWith('info.php')) return JSON.stringify([{ id: 'SYN972', semesterid: '39v', nameNb: 'Oppdiktet publisert gruppefag', campusid: 'SYN-CAMPUS', term: [{ term: 1 }] }])
    if (url.pathname.endsWith('/ws/timeplan/')) return JSON.stringify({ events: Array.from({ length: 8 }, (_, i) => ({ id: `invented-activity-${i}`, eventid: `invented-occasion-${i}`, summary: 'Oppdiktet seminar', courseid: 'SYN972', semesterid: '39v', terminnr: 1, status: 'active', dtstart: `2039-04-${10 + i}T10:00:07+02`, dtend: `2039-04-${10 + i}T11:00:09+02`, teachingMethodName: 'Seminar', studentgroups: ['Oppdiktet publisert gruppe'] })) })
    if (url.pathname.endsWith('/app/schedule')) return '<!doctype html><title>Synthetic public TP</title>'
    if (url.pathname.endsWith('inst.php') || url.pathname.endsWith('session.php')) return '{}'
    throw new Error('Unexpected synthetic group request')
  })
  try {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await page.addStyleTag({ content: 'html { font-size: 150% !important; }' }); await navigate(page, 'subjects'); await openImportMethod(page, 'calendar')
    await (await reveal(page.getByLabel('Kalenderlenke (HTTPS eller webcal)'))).fill('https://tp.educloud.no/himolde/app/schedule?semester=39v&scheduleType=course&course=SYN972')
    await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
    const preview = page.locator('.document-preview'), group = page.getByLabel('Ta med gruppen Oppdiktet publisert gruppe (8 økter) – SYN972 · himolde · Vår · 2039', { exact: true })
    await reveal(group)
    await expect(group).toBeVisible(); await expect(preview).toContainText('0 valgte kalenderhendelser')
    await expect(preview).toContainText('Kildevalg: SYN972¤1')
    await expect(preview).toContainText('Campuskode: SYN-CAMPUS')
    await page.evaluate(() => { window.syntheticActions = []; document.querySelector('.document-preview').addEventListener('click', event => { if (event.target.matches('button, input[type=checkbox]')) window.syntheticActions.push(event.target.textContent || event.target.type) }) })
    await (await reveal(group)).check(); await expect(group).toBeFocused(); await expect(preview).toContainText('8 valgte kalenderhendelser')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await (await reveal(preview.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible(); expect(await page.evaluate(() => window.syntheticActions)).toHaveLength(2)
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
    expect(saved.planner.events).toHaveLength(8); expect(saved.planner.events.every(event => event.publishedGroups[0] === 'Oppdiktet publisert gruppe')).toBe(true)
    expect(saved.planner.courses[0]).toMatchObject({ campusCode: 'SYN-CAMPUS', university: 'himolde' }); expect(saved.planner.courses[0].campus).toBeUndefined()
    await page.reload(); await navigate(page, 'subjects')
    await expect(page.locator('.course-card')).toContainText('Importert fra kalenderlenke (øyeblikksbilde)')
    await expect(page.locator('.course-card')).toContainText('Fysisk campus er ikke bekreftet')
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).planner, key)).toEqual(saved.planner)
  } finally { await close() }
})

for (const selection of ['SYN731%C2%A41', 'SYN731']) test(`public TP course view ${selection} passes through existing adapter and visible confirmation into calendar`, async ({ page }) => {
  const calls = []
  const close = await fixture(page, async (input, _redirects, guard) => {
    const url = new URL(input); guard?.(url); calls.push(url.href)
    expect(url.origin).toBe('https://tp.educloud.no')
    if (url.pathname === '/uio/ws/services/semesters.php') return JSON.stringify([{ id: '37v', year: 2037, season: 'SPRING', fromdate: '2037-01-01', todate: '2037-06-30', random_int: 731, publish_timetable: true }])
    if (url.pathname === '/uio/ws/timeplan/info.php') return JSON.stringify([{ id: 'SYN731', semesterid: '37v', nameNb: 'Oppdiktet TP-emne', term: [{ term: 1 }] }])
    if (url.pathname === '/uio/timeplan/ical.php') return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:invented-tp-journey-731', 'SUMMARY:Oppdiktet TP-forelesning', 'DTSTART:20370512T080000Z', 'DTEND:20370512T090000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    throw new Error('Unexpected fixture request')
  })
  try {
    await page.clock.setFixedTime(new Date('2037-05-12T07:00:00Z'))
    await page.goto('/'); await navigate(page, 'subjects'); await openImportMethod(page, 'calendar')
    await (await reveal(page.getByLabel('Kalenderlenke (HTTPS eller webcal)'))).fill(`https://tp.educloud.no/uio/app/schedule?semester=37v&scheduleType=course&course=${selection}`)
    await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
    const preview = page.locator('.document-preview')
    await expect(preview).toContainText('Oppdiktet TP-emne')
    // The adapter explicitly leaves personal group membership unknown. Select
    // this invented lecture through its visible control; never auto-select it.
    await expect(preview).toContainText('0 valgte kalenderhendelser')
    const event = preview.locator('.document-preview-row').filter({ has: page.locator('[data-field=startLocal]') })
    const group = event.locator('..')
    if (await group.evaluate(node => node.matches('details:not([open])'))) await group.locator(':scope > summary').click()
    if (await event.getAttribute('open') === null) await event.locator(':scope > summary').click()
    await (await reveal(event.getByLabel('Ta med i planen', { exact: true }))).check()
    await expect(preview).toContainText('1 valgte kalenderhendelser')
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key))?.planner?.courses?.length || 0, key)).toBe(0)
    await (await reveal(preview.getByRole('button', { name: 'Importer valgte', exact: true }))).click()
    await expect(page.getByText('Planen er lagret:', { exact: false })).toBeVisible()
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
    expect(saved.planner.courses).toHaveLength(1); expect(saved.planner.events).toHaveLength(1)
    expect(saved.planner.events[0]).toMatchObject({ courseId: saved.planner.courses[0].id, start: '2037-05-12T08:00:00.000Z', end: '2037-05-12T09:00:00.000Z' })
    await page.reload(); await navigate(page, 'calendar'); await (await reveal(page.getByRole('button', { name: 'Agenda', exact: true }))).click()
    await expect(page.locator('#full-calendar')).toContainText('Oppdiktet TP-forelesning')
    expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).planner.events).toEqual(saved.planner.events)
    expect(calls.some(url => url.includes('/app/schedule'))).toBe(false)
    expect(calls.some(url => url.includes('rkey=731'))).toBe(true)
  } finally { await close() }
})

test('bare TP literal underscore identity requires a published term choice', async ({ page }) => {
  const calls = []
  const close = await fixture(page, async (input, _redirects, guard) => {
    const url = new URL(input); guard?.(url); calls.push(url.href)
    if (url.pathname.endsWith('semesters.php')) return JSON.stringify([{ id: '38v', year: 2038, season: 'SPRING', fromdate: '2038-01-01', todate: '2038-06-30', random_int: 819, publish_timetable: true }])
    if (url.pathname.endsWith('info.php')) return JSON.stringify([{ id: 'SYN819_7', semesterid: '38v', nameNb: 'Oppdiktet valg', term: [{ term: 2 }, { term: 4 }] }])
    if (url.pathname.endsWith('ical.php')) { expect(url.searchParams.get('id[]')).toBe('SYN819_7,4'); return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:invented-choice-819\r\nSUMMARY:Oppdiktet valgøkt\r\nDTSTART:20380405T080000Z\r\nDTEND:20380405T090000Z\r\nEND:VEVENT\r\nEND:VCALENDAR' }
    throw new Error('Unexpected synthetic request')
  })
  try {
    await page.goto('/'); await navigate(page, 'subjects'); await openImportMethod(page, 'calendar')
    await (await reveal(page.getByLabel('Kalenderlenke (HTTPS eller webcal)'))).fill('https://tp.educloud.no/uio/app/schedule?semester=38v&scheduleType=course&course=SYN819_7&filterOpen=false&summary=true&pastWeeks=false&tab=calendar')
    await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
    const choices = page.getByLabel('Publisert TP-undervisningstermin')
    await expect(choices).toBeVisible(); expect(calls.some(url => url.includes('ical.php'))).toBe(false)
    await (await reveal(choices)).selectOption({ label: 'SYN819_7 · Oppdiktet valg · kildens undervisningstermin 4' })
    await expect(page.locator('.document-preview')).toContainText('Oppdiktet valgøkt')
  } finally { await close() }
})

for (const type of ['html', 'transport']) test(`link ${type} failure is not an empty calendar`, async ({ page }) => {
  const close = await fixture(page, async () => {
    if (type === 'html') return '<!doctype html><html><body>Invented sign-in page</body></html>'
    throw new Error('Invented transport failure')
  })
  try {
    await page.goto('/'); await navigate(page, 'subjects'); await openImportMethod(page, 'calendar')
    await (await reveal(page.getByLabel('Kalenderlenke (HTTPS eller webcal)'))).fill('https://synthetic.example.test/calendar')
    await (await reveal(page.getByRole('button', { name: 'Vis forhåndsvisning', exact: true }))).click()
    await expect(page.locator('#subject-message')).toContainText(type === 'html' ? 'nettside' : 'Invented transport failure')
    await expect(page.locator('.document-preview')).toHaveCount(0)
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key))?.planner?.events?.length || 0, key)).toBe(0)
  } finally { await close() }
})
