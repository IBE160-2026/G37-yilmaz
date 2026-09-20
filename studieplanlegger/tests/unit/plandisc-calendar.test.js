import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parsePublicPlandisc, fetchPlandiscCalendar, isPublicPlandiscUrl } from '../../server/providers/plandisc-calendar.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { subtractTeaching } from '../../src/planner.js'
import { calendarEntries } from '../../src/calendar-model.js'

const url = 'https://create.plandisc.com/wheel/showPublic/EJuyq2e'
const fixture = async () => JSON.parse(await readFile(new URL('../fixtures/public-programs/barrattdue-plandisc.json', import.meta.url), 'utf8'))
const rows = data => data.wheel.rings[0].calendarRingDetails.meetings
const read = (calendar, year = 2026, semester = 'autumn') => parseCalendar(calendar, { courseId: '', year, semester })

describe('explicitly public Plandisc institution calendar', () => {
  it('preserves actual all-day and timed dates beyond a stale display window, without reserving study time', async () => {
    const parsed = parsePublicPlandisc(await fixture(), url)
    expect(parsed.count).toBe(3); expect(parsed.name).toBe('Høyskolen Barratt Dues Undervisningskalender')
    const current = read(parsed.calendar).events
    expect(current).toHaveLength(1)
    expect(current[0]).toMatchObject({ title: 'Offisiell åpning studieåret', allDay: true, transparent: true, start: '2026-08-18T22:00:00.000Z', end: '2026-08-19T22:00:00.000Z', courseId: '' })
    const timed = read(parsed.calendar, 2025).events[0]
    expect(timed).toMatchObject({ allDay: false, start: '2025-08-20T10:00:00.000Z', end: '2025-08-20T13:00:00.000Z' })
    expect(read(parsed.calendar, 2027, 'spring').events[0].title).toBe('Vitnemålsutdeling')
    const intervals = [{ start: Date.parse(current[0].start), end: Date.parse(current[0].end) }]
    expect(subtractTeaching(intervals, current)).toEqual(intervals)
    expect(calendarEntries({ planner: { events: current } })[0].kind).toBe('information')
  })
  it('uses stable source identity for changed dates and explicit cancellation, and ignores duplicate identical records', async () => {
    const data = await fixture(), first = read(parsePublicPlandisc(data, url).calendar).events[0]
    rows(data)[0].start = '2026-08-20T00:00:00Z'; rows(data)[0].end = '2026-08-21T00:00:00Z'
    rows(data).push(structuredClone(rows(data)[0]))
    const updated = parsePublicPlandisc(data, url)
    expect(updated.count).toBe(3); expect(read(updated.calendar).events[0].sourceKey).toBe(first.sourceKey)
    rows(data).pop(); rows(data)[0].isDeleted = true
    const cancelled = read(parsePublicPlandisc(data, url).calendar)
    expect(cancelled.events).toHaveLength(0); expect(cancelled.cancellations[0].uid).toBe(first.sourceUid)
  })
  it('rejects ambiguous dates, recurrence, conflicting identities and revoked sharing without emitting a partial calendar', async () => {
    for (const edit of [d => { rows(d)[0].start = '2026-02-30T00:00:00Z' }, d => { rows(d)[0].timezone = null }, d => { rows(d)[0].recurringRule = 'FREQ=YEARLY' }, d => { rows(d).push({ ...rows(d)[0], title: 'Conflicting title' }) }, d => { d.tokenStatus = 1 }]) {
      const data = await fixture(); edit(data); expect(() => parsePublicPlandisc(data, url)).toThrow()
    }
  })
  it('keeps imported text as text and respects public ring visibility', async () => {
    const data = await fixture(); rows(data)[0].title = '<script>throw 1</script>Ærlig\r\nBEGIN:VEVENT; lang ' + 'ø'.repeat(140)
    data.wheel.rings.push({ id: 'hidden', active: false, calendarRingDetails: { meetings: [{ broken: true }] } })
    const result = parsePublicPlandisc(data, url)
    expect(result.count).toBe(3); expect(result.calendar.match(/^BEGIN:VEVENT$/gm)).toHaveLength(3)
    expect(result.calendar).not.toContain('throw 1')
    expect(result.calendar.split('\r\n').every(line => Buffer.byteLength(line) <= 75)).toBe(true)
    expect(read(result.calendar).events[0].title).toContain('Ærlig BEGIN:VEVENT; lang')
  })
  it('fetches only the original published share once and enforces its redirect boundary', async () => {
    const data = await fixture(), fetchText = vi.fn(async () => JSON.stringify(data))
    await fetchPlandiscCalendar(url, { fetchText }); await fetchPlandiscCalendar(url, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(1)
    const [api, hop, validate] = fetchText.mock.calls[0]
    expect(api).toBe('https://create.plandisc.com/api/wheels/public/EJuyq2e'); expect(hop).toBe(0)
    expect(() => validate('https://create.plandisc.com/api/wheels/private/EJuyq2e')).toThrow()
    expect(() => validate('https://create.plandisc.com/api/wheels/public/ANOTHER')).toThrow()
    for (const invalid of [url + '?token=private', url.replace('/showPublic/', '/edit/'), 'https://127.0.0.1/wheel/showPublic/EJuyq2e']) expect(isPublicPlandiscUrl(invalid)).toBe(false)
  })
})
