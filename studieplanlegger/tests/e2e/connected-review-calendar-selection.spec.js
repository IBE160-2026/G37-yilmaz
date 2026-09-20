import { test, expect } from '@playwright/test'
import { navigate, openImportMethod, key } from './helpers.js'

const raw = page => page.evaluate(key => localStorage.getItem(key), key)
const calendar = name => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-${name}\r\nDTSTART:20261015T100000Z\r\nDTEND:20261015T110000Z\r\nSUMMARY:${name}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
const plandisc = 'https://create.plandisc.com/wheel/showPublic/TestCalendar'
const classA = 'https://fih.edupage.org/webcal?class=A', classB = 'https://fih.edupage.org/webcal?class=B'
const classList = { status: 'ok', results: [{ name: 'Klasse A', sourceUrl: classA }, { name: 'Klasse B', sourceUrl: classB }] }
const calendarData = (name = 'Ny kalender', institutional = true) => ({ institutional, ...(institutional ? {} : { sourceKind: 'fih-public-class' }), name, calendar: calendar(name), warnings: [] })
const initial = { schemaVersion: 1, tasks: [], planner: { courses: [{ id: 'saved-course', name: 'Lagret emne', code: 'OLD101', university: '', year: 2026, semester: 'autumn', credits: null, description: '', notes: '' }], events: [{ id: 'saved-event', courseId: 'saved-course', title: 'Lagret undervisning', start: '2026-10-01T08:00:00Z', end: '2026-10-01T09:00:00Z', location: '', description: '', notes: '' }], sources: [] } }

async function boot(page) {
  await page.goto('/')
  await page.evaluate(({ key, initial }) => localStorage.setItem(key, JSON.stringify(initial)), { key, initial })
  await page.reload(); await navigate(page, 'subjects')
}
async function institutional(page, kind = 'plandisc') {
  await openImportMethod(page, 'calendar')
  const host = page.locator('.institutional-calendar-import')
  if (!await host.evaluate(node => node.open)) await host.locator(':scope > summary').click()
  await host.getByRole('combobox', { name: 'Offentlig kalenderkilde', exact: true }).selectOption(kind)
  if (kind === 'plandisc') await host.getByLabel('Offentlig Plandisc-lenke', { exact: true }).fill(plandisc)
  await host.getByLabel('Kalenderår', { exact: true }).fill('2026')
  await host.getByRole('combobox', { name: 'Kalendersemester', exact: true }).selectOption('autumn')
  return host
}
const readCalendar = host => host.getByRole('button', { name: 'Forhåndsvis institusjonskalender', exact: true })
async function previewCalendar(host) {
  await readCalendar(host).click()
  await expect(host.locator('.document-preview')).toBeVisible()
  await host.getByRole('checkbox', { name: 'Ta med i planen', exact: true }).check()
}

for (const changed of ['class', 'url', 'year', 'semester']) {
  test(`R9 institutional ${changed} change discards only the fetched draft`, async ({ page }) => {
    await page.route('**/api/import/calendar-sources/fih', route => route.fulfill({ json: classList }))
    await page.route('**/api/import/calendar', route => route.fulfill({ json: calendarData('Valgt undervisning', changed !== 'class') }))
    await boot(page)
    const host = await institutional(page, changed === 'class' ? 'fih' : 'plandisc'), before = await raw(page)
    if (changed === 'class') {
      await host.getByRole('button', { name: 'Hent offentlige Fjellhaug-klasser', exact: true }).click()
      await host.getByRole('combobox', { name: 'Publisert klasseplan', exact: true }).selectOption(classA)
    }
    await previewCalendar(host)
    if (changed === 'class') await host.getByRole('combobox', { name: 'Publisert klasseplan', exact: true }).selectOption(classB)
    if (changed === 'url') await host.getByLabel('Offentlig Plandisc-lenke', { exact: true }).fill(`${plandisc}Next`)
    if (changed === 'year') await host.getByLabel('Kalenderår', { exact: true }).fill('2027')
    if (changed === 'semester') await host.getByRole('combobox', { name: 'Kalendersemester', exact: true }).selectOption('spring')
    await expect(host.locator('.document-preview')).toHaveCount(0)
    await expect(host.getByRole('status')).toContainText('Hent en ny forhåndsvisning')
    expect(await raw(page)).toBe(before)
    await expect(readCalendar(host)).toBeEnabled()
  })
}

test('R9 institutional confirmation rechecks the selection even without an input event; back keeps the input', async ({ page }) => {
  await page.route('**/api/import/calendar', route => route.fulfill({ json: calendarData() }))
  await boot(page); const host = await institutional(page), before = await raw(page)
  await previewCalendar(host)
  await host.getByLabel('Kalenderår', { exact: true }).evaluate(input => { input.value = '2027' })
  await host.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
  await expect(host.locator('.document-preview')).toContainText('Kalendervalget er endret')
  expect(await raw(page)).toBe(before)
  await host.getByRole('button', { name: 'Tilbake til dokumentet', exact: true }).click()
  await expect(host.getByLabel('Offentlig Plandisc-lenke', { exact: true })).toHaveValue(plandisc)
  await expect(host.getByLabel('Kalenderår', { exact: true })).toHaveValue('2027')
  await host.getByLabel('Kalenderår', { exact: true }).fill('2026')
  await previewCalendar(host)
  await host.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('Institusjonskalender lagret')
  expect(JSON.parse(await raw(page)).planner.events).toHaveLength(2)
})

for (const phase of ['classes', 'calendar']) {
  test(`R9 cancelling institutional ${phase} aborts the actual subjects fetch and retry keeps choices`, async ({ page }) => {
    let held, calls = 0
    const path = phase === 'classes' ? '**/api/import/calendar-sources/fih' : '**/api/import/calendar'
    const data = phase === 'classes' ? classList : calendarData()
    await page.route(path, async route => {
      if (!calls++) await new Promise(resolve => { held = resolve })
      await route.fulfill({ json: data }).catch(() => {})
    })
    await boot(page)
    await page.evaluate(() => {
      const nativeFetch = window.fetch; window.fetchAborts = 0
      window.fetch = (url, options) => {
        if (String(url).includes('/api/import/calendar')) options.signal.addEventListener('abort', () => window.fetchAborts++, { once: true })
        return nativeFetch(url, options)
      }
    })
    const host = await institutional(page, phase === 'classes' ? 'fih' : 'plandisc'), before = await raw(page)
    const read = phase === 'classes' ? host.getByRole('button', { name: 'Hent offentlige Fjellhaug-klasser', exact: true }) : readCalendar(host)
    await read.click(); await expect.poll(() => Boolean(held)).toBe(true)
    await host.getByRole('button', { name: 'Avbryt henting', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.fetchAborts)).toBe(1)
    held(); await expect(read).toBeEnabled()
    await expect(host.getByRole('status')).toContainText('avbrutt')
    expect(await raw(page)).toBe(before)
    await expect(host.getByLabel('Kalenderår', { exact: true })).toHaveValue('2026')
    await expect(host.getByRole('combobox', { name: 'Kalendersemester', exact: true })).toHaveValue('autumn')
    await read.click()
    if (phase === 'classes') await expect(host.getByRole('combobox', { name: 'Publisert klasseplan', exact: true }).locator('option')).toHaveCount(3)
    else await expect(host.locator('.document-preview')).toBeVisible()
    expect(await raw(page)).toBe(before)
  })
}

test('R9 late institutional network response is ignored after a changed year even if transport ignores abort', async ({ page }) => {
  await page.route('**/api/import/calendar', route => route.fulfill({ json: calendarData('Aktuell kalender') }))
  await boot(page)
  await page.evaluate(data => {
    const nativeFetch = window.fetch; let hold = true
    window.fetch = (url, options) => {
      if (hold && url === '/api/import/calendar') { hold = false; return new Promise(resolve => { window.releaseCalendar = () => resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })) }) }
      return nativeFetch(url, options)
    }
  }, calendarData('Foreldet kalender'))
  const host = await institutional(page), before = await raw(page)
  await readCalendar(host).click(); await expect.poll(() => page.evaluate(() => typeof window.releaseCalendar)).toBe('function')
  await host.getByLabel('Kalenderår', { exact: true }).fill('2027')
  await page.evaluate(() => window.releaseCalendar())
  await expect(host.locator('.document-preview')).toHaveCount(0)
  await host.getByLabel('Kalenderår', { exact: true }).fill('2026'); await previewCalendar(host)
  await expect(host.locator('.document-preview')).toContainText('Aktuell kalender')
  await expect(host.locator('.document-preview')).not.toContainText('Foreldet kalender')
  expect(await raw(page)).toBe(before)
})

test('R9 the subjects request keeps its timeout alongside caller cancellation and retains a retry draft', async ({ page }) => {
  let held, calls = 0
  await page.route('**/api/import/calendar', async route => {
    if (!calls++) await new Promise(resolve => { held = resolve })
    await route.fulfill({ json: calendarData() }).catch(() => {})
  })
  await boot(page)
  await page.evaluate(() => {
    const nativeTimeout = AbortSignal.timeout
    AbortSignal.timeout = milliseconds => {
      if (milliseconds !== 30000) return nativeTimeout(milliseconds)
      const controller = new AbortController()
      window.expireImportTimeout = () => controller.abort(new DOMException('Kontrollert tidsgrense', 'TimeoutError'))
      return controller.signal
    }
  })
  const host = await institutional(page), before = await raw(page)
  await readCalendar(host).click(); await expect.poll(() => Boolean(held)).toBe(true)
  await page.evaluate(() => window.expireImportTimeout())
  await expect(readCalendar(host)).toBeEnabled()
  await expect(host.getByRole('status')).toContainText('Kunne ikke kontakte importtjenesten')
  held(); expect(await raw(page)).toBe(before)
  await expect(host.getByLabel('Offentlig Plandisc-lenke', { exact: true })).toHaveValue(plandisc)
  await previewCalendar(host)
  expect(await raw(page)).toBe(before)
})

test('R9 institutional cancel terminates a real busy document worker and permits retry', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.route('**/api/import/calendar', route => route.fulfill({ json: calendarData() }))
  await boot(page)
  await page.addStyleTag({ content: 'html { font-size: 24px !important; }' })
  await page.evaluate(() => {
    const NativeWorker = window.Worker; window.parserTerminations = 0; window.parserStarted = false
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); this.addEventListener('message', ({ data }) => { if (data.progress) window.parserStarted = true }) }
      terminate() { window.parserTerminations++; return super.terminate() }
    }
  })
  const workerPath = '**/src/document-parser.worker.js*'
  await page.route(workerPath, route => route.fulfill({ contentType: 'text/javascript', body: 'self.onmessage=()=>{self.postMessage({documentImport:true,progress:"Parsing started"});while(true){}}' }))
  const host = await institutional(page), before = await raw(page)
  await readCalendar(host).click(); await expect.poll(() => page.evaluate(() => window.parserStarted)).toBe(true)
  await page.screenshot({ path: info.outputPath('institutional-cancel-mobile.png'), fullPage: true })
  await host.getByRole('button', { name: 'Avbryt henting', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.parserTerminations)).toBe(1)
  expect(await raw(page)).toBe(before)
  await expect(host.getByLabel('Offentlig Plandisc-lenke', { exact: true })).toHaveValue(plandisc)
  await page.unroute(workerPath); await previewCalendar(host)
  await host.getByRole('button', { name: 'Bekreft valgt plan', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('Institusjonskalender lagret')
  expect(JSON.parse(await raw(page)).planner.events).toHaveLength(2)
  expect(await page.evaluate(() => window.parserTerminations)).toBe(2)
})

async function program(page) {
  const sourceUrl = 'https://www.usn.no/studier/studie-og-emneplaner/synthetic'
  await page.route('**/api/import/providers/usn/**', async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1)
    const data = action === 'programs' ? { results: [{ code: 'TEST', name: 'Syntetisk program', sourceUrl }] }
      : action === 'program-cohorts' ? { results: [{ cohort: '2026', sourceUrl }] }
      : action === 'program-plan' ? { program: { code: 'TEST', name: 'Syntetisk program', cohort: '2026', sourceUrl, campuses: [] }, models: [{ id: 'common', name: 'Felles', periods: [{ id: 'first', label: 'Første semester', studySemester: 1, year: 2026, semester: 'autumn', courses: [{ id: 'usn-test', code: 'TEST101', name: 'Testemne', university: 'USN', year: 2026, semester: 'autumn', credits: 10, choice: 'O', sourceUrl, sourceProvider: 'usn', sourceRecordId: 'TEST101', sourceVersion: '2026H' }] }] }] }
      : action === 'teaching-search' ? { results: [{ sourceObjectId: 'A', label: 'Variant A' }, { sourceObjectId: 'B', label: 'Variant B' }] }
      : { calendar: calendar(`Variant ${url.searchParams.get('sourceObjectId')}`), calendarUrl: `https://cloud.timeedit.net/usn/web/publikk/${url.searchParams.get('sourceObjectId')}.ics` }
    await route.fulfill({ json: { status: 'ok', ...data } })
  })
  await boot(page); await openImportMethod(page, 'institution')
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('usn')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0'); await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption('common'); await host.locator('[name=studySemester]').selectOption('first')
  await host.locator('[name=calendarSemester]').selectOption('2026:autumn'); await host.locator('[name=programCampus]').selectOption('__unknown')
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await host.getByText('Offentlig timeplan for TEST101', { exact: true }).click()
  await host.getByRole('button', { name: 'Søk offentlig undervisning for TEST101', exact: true }).click()
  await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).selectOption('0')
  return host
}
async function teaching(host) {
  await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
  await host.locator('summary').filter({ hasText: /Undervisningsgrupper for TEST101 ·/ }).click()
  await host.getByRole('button', { name: 'Velg alle aktiviteter i dette timeplanvalget', exact: true }).click()
}

for (const changed of ['query', 'object', 'silent-object']) {
  test(`R9 program teaching ${changed} change cannot import the previous selected activities`, async ({ page }) => {
    const host = await program(page), before = await raw(page)
    await teaching(host)
    if (changed === 'query') await host.getByLabel('Timeplansøk for TEST101', { exact: true }).fill('Annet emne')
    else if (changed === 'object') await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).selectOption('1')
    else await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).evaluate(input => { input.value = '1' })
    await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
    if (changed === 'silent-object') {
      await expect(host.getByRole('status')).toContainText('Timeplanvalget er endret')
      expect(await raw(page)).toBe(before)
    } else {
      await expect(host.getByRole('status')).toContainText('lagret samlet')
      const saved = JSON.parse(await raw(page))
      expect(saved.planner.courses).toHaveLength(2)
      expect(saved.planner.events).toEqual(initial.planner.events)
      expect(saved.planner.sources).toEqual([])
    }
  })
}

test('R9 program teaching ignores a late object response and retries the current object', async ({ page }) => {
  const host = await program(page), before = await raw(page)
  await page.evaluate(() => {
    const nativeFetch = window.fetch; let hold = true
    window.fetch = (url, options) => {
      if (hold && String(url).includes('/teaching-calendar?')) { hold = false; return new Promise(resolve => { window.releaseTeaching = data => resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })) }) }
      return nativeFetch(url, options)
    }
  })
  await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
  await expect.poll(() => page.evaluate(() => typeof window.releaseTeaching)).toBe('function')
  // Fields are disabled while fetching, but cancellation makes the retained
  // draft editable immediately while an obsolete transport may still resolve.
  await host.getByRole('button', { name: 'Avbryt henting', exact: true }).click()
  await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).selectOption('1')
  await page.evaluate(data => window.releaseTeaching(data), { status: 'ok', calendar: calendar('Foreldet A'), calendarUrl: 'https://cloud.timeedit.net/usn/web/publikk/A.ics' })
  await teaching(host)
  await expect(host).not.toContainText('Foreldet A')
  expect(await raw(page)).toBe(before)
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('lagret samlet')
  const saved = JSON.parse(await raw(page))
  expect(saved.planner.events.map(event => event.title)).toEqual(['Lagret undervisning', 'Variant B'])
  expect(saved.planner.sources[0].url).toContain('/B.ics')
})

test('R9 program fetch rechecks the displayed search and object before requesting teaching', async ({ page }) => {
  const host = await program(page), before = await raw(page)
  await host.getByLabel('Timeplansøk for TEST101', { exact: true }).evaluate(input => { input.value = 'Ny kode' })
  await host.getByRole('button', { name: 'Hent valgt timeplan for TEST101', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('Timeplansøket er endret')
  await expect(host.getByLabel('Timeplansøk for TEST101', { exact: true })).toHaveValue('Ny kode')
  expect(await raw(page)).toBe(before)
  const timetable = host.locator('details').filter({ has: page.getByLabel('Timeplansøk for TEST101', { exact: true }) })
  if (!await timetable.evaluate(node => node.open)) await timetable.locator(':scope > summary').click()
  await host.getByRole('button', { name: 'Søk offentlig undervisning for TEST101', exact: true }).click()
  await host.getByLabel('Timeplanobjekt for TEST101', { exact: true }).evaluate(input => { input.value = '1' })
  await teaching(host)
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.getByRole('status')).toContainText('lagret samlet')
  expect(JSON.parse(await raw(page)).planner.events.map(event => event.title)).toEqual(['Lagret undervisning', 'Variant B'])
})
