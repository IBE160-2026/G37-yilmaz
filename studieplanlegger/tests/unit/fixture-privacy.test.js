import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as cheerio from 'cheerio'

const fixtureUrl = new URL('../fixtures/', import.meta.url)
const fixture = relative => readFileSync(new URL(relative, fixtureUrl), 'utf8')
const syntheticTeacher = /^Testunderviser [A-Z]+$/

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory)
    return entry.isDirectory() ? walk(url) : [url]
  })
}

function logicalIcsLines(source) {
  return source.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
}

function icsEvents(source) {
  const events = []
  let event = null
  for (const line of logicalIcsLines(source)) {
    if (line === 'BEGIN:VEVENT') event = {}
    else if (line === 'END:VEVENT') {
      events.push(event)
      event = null
    } else if (event) {
      const colon = line.indexOf(':')
      if (colon < 0) continue
      const name = line.slice(0, colon).split(';')[0]
      event[name] ??= []
      event[name].push(line.slice(colon + 1))
    }
  }
  return events
}

describe('fixture privacy minimization', () => {
  it('uses only explicit synthetic values for copied calendar access parameters', () => {
    const html = fixture('public-programs/fih-calendar-html.html')
    const links = fixture('public-programs/fih-calendar-links.json')
    expect(html.match(/pwd=C0DEC0DEC0DEC0DE/g)).toHaveLength(14)
    expect(links.match(/pwd=C0DEC0DEC0DEC0DE/g)).toHaveLength(15)

    const values = walk(fixtureUrl).flatMap(url => {
      const source = readFileSync(url, 'utf8')
      let decoded = source
      try { decoded = decodeURIComponent(source) } catch {}
      return [...source.matchAll(/(?:pwd|passcode|access_token)=([^\s&#"']+)/gi), ...decoded.matchAll(/(?:pwd|passcode|access_token)=([^\s&#"']+)/gi)].map(match => match[1])
    })
    expect(values.length).toBeGreaterThan(0)
    expect(values.every(value => value === 'C0DEC0DEC0DEC0DE' || /^SYNTHETIC_[A-Z0-9_]+$/.test(value))).toBe(true)
  })

  it('removes complete contact, profile, portrait and author-metadata blocks', () => {
    const absentSelectors = new Map([
      ['uit-programs/b-inf.html', ['.undervisere', '.studentintervju2024']],
      ['phs-programs/master.html', ['#vrtx-fs-studieprogram-contact']],
      ['phs-programs/bachelor.html', ['#vrtx-fs-studieprogram-contact']],
      ['business-programs/nhh-accounting.html', ['aside.researcherCard']],
      ['business-programs/nhh-bachelor.html', ['.researcherCard']],
      ['business-programs/nhh-beds.html', ['aside.researcherCard']],
      ['business-programs/nhh-master-family.html', ['aside.researcherCard']],
      ['public-programs/uis-data-program.html', ['#kontaktinfo']],
      ['public-programs/barrattdue-instrumental.html', ['.persons', '.persons-list.employees-list']],
      ['public-programs/barrattdue-ppu.html', ['.persons', '.persons-list.employees-list']],
      ['public-programs/barrattdue-vocal.html', ['.persons', '.persons-list.employees-list']],
    ])
    for (const [relative, selectors] of absentSelectors) {
      const source = fixture(relative)
      const $ = cheerio.load(source)
      expect(selectors.every(selector => $(selector).length === 0)).toBe(true)
    }
    const uit = cheerio.load(fixture('uit-programs/b-inf.html'))
    expect(uit('[src^="data:image"], [srcset*="data:image"], [style*="data:image"]').length).toBe(0)
    expect(/"author"\s*:\s*null/.test(fixture('public-programs/kristiania-catalogue.html'))).toBe(true)

    for (const name of ['hgut-bachelor.html', 'hgut-hest-i-naering.html', 'hgut-nyskaping-og-utvikling.html', 'hgut-sirkulaer-okonomi.html']) {
      const $ = cheerio.load(fixture(`public-programs/${name}`))
      expect($('.elementor-widget-text-editor').toArray().some(node => /(?:studie|emne).*ansvar|ansvarlig/iu.test($(node).text()))).toBe(false)
    }
    for (const name of ['vuoma.html', 'vuoma510.html', 'gmoa.html', 'master-language.html', 'tolking.html']) {
      const $ = cheerio.load(fixture(`samas-programs/${name}`))
      expect($('.field--name-contact-reference-profile, .view-site-settings-contact').length).toBe(0)
      expect($('.field--name-body a[href^="mailto:"]').length).toBe(0)
    }
    for (const name of ['fih-ateol.html', 'fih-btfl.html', 'fih-mtm.html']) {
      expect(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(fixture(`public-programs/${name}`))).toBe(false)
    }
    const nhfh = JSON.parse(fixture('nhfh-programs.json'))
    expect(Object.values(nhfh).every(value => typeof value !== 'string' || !/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value))).toBe(true)
    for (const name of ['kristiania-catalogue.html', 'kristiania-pgr102-2025.html', 'kristiania-programming.html']) {
      const addresses = [...fixture(`public-programs/${name}`).matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)].map(match => match[0])
      expect(addresses.every(value => value === 'synthetic-contact@example.invalid')).toBe(true)
    }
  })

  it('keeps Ansgar PDF coordinates while synthesizing instructor fields', () => {
    const files = [
      ['ansgar-timetable-0.json', 177],
      ['ansgar-timetable-7.json', 105],
      ['ansgar-timetable-10.json', 112],
      ['ansgar-timetable-15.json', 105],
    ]
    const labels = new Set()
    for (const [name, markerIndex] of files) {
      const data = JSON.parse(fixture(name))
      const sourceUrl = new URL(data.source.sourceUrl)
      expect(sourceUrl.pathname).toMatch(/\/SYNTHETIC_PUBLIC_SHARE_\d{4}$/)
      expect([...sourceUrl.searchParams]).toEqual([['e', 'SYNTHETIC']])
      const items = data.pages[0].items
      const marker = items[markerIndex]
      const lecturerItems = items.filter(item => Math.abs(item.transform[5] - marker.transform[5]) <= 2 && item.transform[4] > marker.transform[4] && /\p{L}/u.test(item.str))
      expect(lecturerItems.length).toBeGreaterThan(0)
      expect(lecturerItems.every(item => !item.str || syntheticTeacher.test(item.str))).toBe(true)
      expect(lecturerItems.every(item => Array.isArray(item.transform) && typeof item.width === 'number')).toBe(true)
      for (const rowMarker of items.filter(item => /^(?:forelesere?|emneansvarlig):?$/iu.test(item.str.trim()))) {
        const values = items.filter(item => Math.abs(item.transform[5] - rowMarker.transform[5]) <= 2 && item.transform[4] > rowMarker.transform[4] && /\p{L}/u.test(item.str))
        expect(values.every(item => !item.str || syntheticTeacher.test(item.str))).toBe(true)
      }
      const syntheticItems = items.filter(item => item.str.includes('Testunderviser'))
      expect(syntheticItems.some(item => !syntheticTeacher.test(item.str))).toBe(true)
      expect(items.some(item => /^(?!Testunderviser )\p{Lu}\p{Ll}+(?:[-']\p{L}+)*\s+(?:Gr\.|\d+\s+uker)/u.test(item.str))).toBe(false)
      syntheticItems.flatMap(item => item.str.match(/Testunderviser [A-Z]+/g) || []).forEach(value => labels.add(value))
    }
    expect(labels.size).toBeGreaterThanOrEqual(16)
  })

  it('preserves calendar event counts and uses synthetic teachers in the exact source fields', () => {
    const hvl = icsEvents(fixture('public-programs/timeedit-hvl-dat100-2026.ics'))
    const hvlTeachers = hvl.flatMap(event => (event.DESCRIPTION || []).flatMap(value => {
      const parts = value.split('\\n')
      return parts.length === 3 ? [parts[1]] : []
    }))
    expect(hvl).toHaveLength(54)
    expect(hvlTeachers).toHaveLength(32)
    expect(hvlTeachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const nmbu = icsEvents(fixture('public-programs/timeedit-nmbu-math100-2026.ics'))
    const nmbuTeachers = nmbu.flatMap(event => event.SUMMARY?.[0] ? [event.SUMMARY[0].split('\\,')[1]] : [])
    expect(nmbu).toHaveLength(68)
    expect(nmbuTeachers).toHaveLength(63)
    expect(nmbu.filter(event => event.SUMMARY?.[0]).every(event => event.SUMMARY[0].split('\\,').length === 2)).toBe(true)
    expect(nmbuTeachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const mf = icsEvents(fixture('public-timeedit/mf-calendar.ics'))
    const mfTeachers = mf.map(event => event.DESCRIPTION[0].split('\\n')[0])
    expect(mf).toHaveLength(40)
    expect(new Set(mfTeachers).size).toBe(8)
    expect(mfTeachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const steiner = icsEvents(fixture('public-timeedit/steiner-calendar.ics'))
    const steinerTeachers = steiner.flatMap(event => event.SUMMARY[0].split('\\,').filter(segment => syntheticTeacher.test(segment.trim())))
    expect(steiner).toHaveLength(34)
    expect(steinerTeachers).toHaveLength(43)
    expect(new Set(steinerTeachers.map(value => value.trim())).size).toBe(11)
    const strictPerson = /^[\p{Lu}][\p{Ll}'-]+(?:\s+[\p{Lu}][\p{Ll}'-]+){1,3}$/u
    const lowerTailPerson = /^[\p{Lu}][\p{Ll}'-]+(?:\s+[\p{Ll}][\p{Ll}'-]+){1,2}$/u
    const lowerTailSlots = new Set(['2/4', '2/5', '3/5', '4/5', '4/7', '5/7'])
    expect(steiner.every(event => {
      const parts = event.SUMMARY[0].split('\\,').map(value => value.trim())
      const location = event.LOCATION?.[0]?.trim()
      return parts.every((value, index) => index < 2 || value === location || syntheticTeacher.test(value) || (!strictPerson.test(value) && !(lowerTailSlots.has(`${index}/${parts.length}`) && lowerTailPerson.test(value))))
    })).toBe(true)

    const volda = icsEvents(fixture('public-timeedit/volda-calendar.ics'))
    const voldaTeachers = volda.map(event => event.SUMMARY[0].split('\\,')[0])
    expect(volda).toHaveLength(52)
    expect(voldaTeachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const uib = icsEvents(fixture('public-tp/uib.ics'))
    const uibMatches = uib.flatMap(event => [...(event.SUMMARY || []), ...(event.DESCRIPTION || [])].flatMap(value => [...value.matchAll(/foreles\p{L}*\s+(Testunderviser [A-Z]+)(?=\\n)/giu)]))
    expect(uib).toHaveLength(294)
    expect(uibMatches).toHaveLength(26)
    expect(new Set(uibMatches.map(match => match[1])).size).toBe(1)

    const uit = icsEvents(fixture('public-tp/uit.ics'))
    const uitTeachers = uit.flatMap(event => (event.DESCRIPTION || []).flatMap(value => {
      const parts = value.split('\\n')
      return parts.length === 10 && /\bforeles\p{L}*\b/iu.test(parts[1]) ? [parts[4].trim()] : []
    }))
    expect(uit).toHaveLength(16)
    expect(uitTeachers).toHaveLength(6)
    expect(uitTeachers.every(value => syntheticTeacher.test(value))).toBe(true)
  })

  it('retains NIH table and HiMolde array shapes with synthetic staff values', () => {
    const $ = cheerio.load(fixture('public-timeedit/nih-schedule.html'))
    const rows = $('tbody tr')
    const teachers = rows.toArray().map(row => $(row).find('td').eq(5).text().trim()).filter(Boolean)
    expect(rows).toHaveLength(75)
    expect(teachers).toHaveLength(32)
    expect(new Set(teachers).size).toBe(11)
    expect(teachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const himolde = JSON.parse(fixture('public-tp/himolde-events.json'))
    expect(himolde.events.map(event => event.staffnames.length)).toEqual([1, 0, 0])
    expect(himolde.events[0].staffnames).toEqual(['Testunderviser A'])
  })
})
