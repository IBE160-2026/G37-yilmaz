import { test, expect } from '@playwright/test'
import { load } from 'cheerio'

// Read-only public-source comparisons. No user data, private calendars or
// interception. These probes verify source/runtime behavior, not student trials.
const pdf = 'https://uit.no/Content/931776/cache=20261310132856/Studieplan%20Bachelor%20i%20geovitenskap%20H-2025.pdf'
const headers = () => ({ Origin: new URL(process.env.AJOUR_REMOTE_URL).origin })

test('live UiT H-2025 PDF is read by hosted runtime and reports the image-only table', async ({ request }, info) => {
  const source = await request.get(pdf)
  expect(source.status()).toBe(200)
  expect((await source.body()).subarray(0, 5).toString()).toBe('%PDF-')
  const query = new URLSearchParams({ program: 'UIT-279541', cohort: '2025', cohortFromStudent: 'true', sourceUrl: pdf })
  const response = await request.get(`/api/import/providers/uit/program-plan?${query}`, { headers: headers(), timeout: 60000 })
  expect(response.status()).toBe(200)
  const result = await response.json()
  expect(result.status).toBe('not-supported')
  expect(result.error).toContain('selve emnetabellen mangler lesbar tekst')
  expect(result.error).not.toContain('kunne ikke behandles')
  await info.attach('public-source-result', { body: JSON.stringify({ source: pdf, http: source.status(), hostedHttp: response.status(), status: result.status, imageTableFallback: true }), contentType: 'application/json' })
})

for (const code of ['HMS0004', 'AAR4619', 'AAR4711']) test(`live NTNU ${code} autumn 2026 matches its exact published calendar`, async ({ request }, info) => {
  const source = `https://www.ntnu.no/studier/emner/${code}/2026`
  const page = await request.get(source)
  expect(page.status()).toBe(200)
  const $ = load(await page.text())
  expect($('#selectedYear option[selected]').val()).toBe('2026')
  const calendar = new URL($('a.ical').attr('href'), source)
  expect(calendar.origin).toBe('https://tp.educloud.no')
  expect(calendar.pathname).toBe('/ntnu/timeplan/ical.php')
  calendar.searchParams.set('sem', '26h')
  const upstream = await request.get(calendar.href)
  expect(upstream.status()).toBe(200)
  const text = await upstream.text()
  expect(text).toContain('BEGIN:VCALENDAR')
  const directCount = (text.match(/BEGIN:VEVENT/g) || []).length
  const details = await request.get(`/api/import/providers/ntnu/details?${new URLSearchParams({ code, year: '2026', semester: 'autumn' })}`, { headers: headers() })
  const detail = await details.json()
  expect(detail.course.campus).toBe('Trondheim')
  expect(detail.calendarUrl).toBe(calendar.href)
  const hosted = await request.post('/api/import/calendar', { headers: headers(), data: { url: detail.calendarUrl } })
  expect(hosted.status()).toBe(200)
  const result = await hosted.json()
  expect(result.calendar).toContain('BEGIN:VCALENDAR')
  expect((result.calendar.match(/BEGIN:VEVENT/g) || []).length).toBe(directCount)
  await info.attach('public-source-result', { body: JSON.stringify({ code, source, calendar: calendar.href, directHttp: upstream.status(), directEvents: directCount, hostedHttp: hosted.status(), hostedEvents: (result.calendar.match(/BEGIN:VEVENT/g) || []).length }), contentType: 'application/json' })
})
