import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { Temporal } from '@js-temporal/polyfill'
import { withoutConnections } from '../../src/backup.js'
import { osloYear, sourceHref } from '../../src/planner.js'
import { validDeadline } from '../../src/tasks.js'
import { coursesFromLinks } from '../../server/providers/current-program-source.js'

describe('R26 bounded integrity corrections', () => {
  it('activates only credential-free HTTP(S) source links and leaves invalid legacy values inert', () => {
    expect(sourceHref('https://example.test/source')).toBe('https://example.test/source')
    expect(sourceHref('http://example.test/source')).toBe('http://example.test/source')
    expect(sourceHref('javascript:alert(1)')).toBe('')
    expect(sourceHref('https://user:password@example.test/source')).toBe('')
  })

  it.each(['privateToken', 'authToken', 'myClientSecret'])('redacts compound credential parameter %s without masking ordinary anchors', parameter => {
    const secret = 'R26_SYNTHETIC_SECRET'
    const privateUrl = `https://calendar.example.test/file.ics#${parameter}=${secret}`
    const portable = withoutConnections({ kind: 'url', id: 'source', courseId: 'course', groups: [], url: privateUrl, warning: `${privateUrl} ${secret}`, help: 'https://docs.example.test/guide#section-2' })
    expect(JSON.stringify(portable)).not.toContain(secret)
    expect(portable.help).toBe('https://docs.example.test/guide#section-2')
  })

  it('validates deadlines in Norwegian wall time independently of the device timezone', () => {
    expect(validDeadline('2026-03-29T02:30')).toBe(false)
    expect(validDeadline('2026-10-25T02:30')).toBe(true)
    expect(validDeadline('2026-03-29T03:30')).toBe(true)
  })

  it('derives the academic form year from Europe/Oslo at New Year', () => {
    expect(osloYear(Temporal.Instant.from('2026-12-31T23:30:00Z'))).toBe(2027)
    expect(osloYear(Temporal.Instant.from('2026-12-31T22:30:00Z'))).toBe(2026)
  })

  it('bounds provider notes before preview and reports the visible truncation', () => {
    const $ = load(`<div id="plan">${'Lang kildetekst '.repeat(1000)}<a href="https://example.test/course/TEST101">TEST101 Testemne</a> 10 ECTS</div>`)
    const result = coursesFromLinks($, $('#plan'), { sourceUrl: 'https://example.test/program', courseUrl: url => url, institution: 'test', university: 'Test', scope: 'current', number: 1 })
    expect(result.courses[0].notes.length).toBeLessThanOrEqual(12000)
    expect(result.warnings.join(' ')).toContain('forkortet')
  })
})
