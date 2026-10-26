import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import * as cheerio from 'cheerio'
import { calendarPersonFindings, calendarTextContract, calendarTextContractFindings, fixtureMetadataFindings, teachingPersonHtmlFindings, xmlPersonMetadataFindings } from '../helpers/fixture-privacy.js'

// Read ZIP parts with the same dependency that the installed DOCX extractor uses.
const require = createRequire(import.meta.url)
const JSZip = createRequire(require.resolve('mammoth'))('jszip')

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
  it('keeps PHS bachelor study content without unrelated video embedding or stream parameters', () => {
    const source = fixture('phs-programs/bachelor.html')
    const $ = cheerio.load(source)
    expect($('iframe, video, source, .vrtx-media-player, vrtx-component-block, .vrtx-media-button-holder').length).toBe(0)
    const decoded = decodeURIComponent(source)
    // Assert booleans so a regression cannot print a copied access-like value.
    expect(/streamUrl\s*=/i.test(decoded)).toBe(false)
    expect(/[?&]token\s*=/i.test(decoded)).toBe(false)
    expect($('main h1').text().trim()).toBe('Bachelor - Politiutdanning')
    expect($('main a[href]').toArray().some(node => $(node).text().trim() === 'Se alle studieplaner'
      && $(node).attr('href') === '/studier/politiutdanning/studieplaner/')).toBe(true)
  })

  it('keeps PHS bibliography targets without encoded Safe Links recipient metadata', () => {
    const source = fixture('phs-programs/bachelor-cohorts.html')
    const decoded = decodeURIComponent(source)
    expect(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(decoded)).toBe(false)
    expect(decoded.includes('safelinks.protection.outlook.com')).toBe(false)
    const $ = cheerio.load(source)
    const targets = $('a[href]').toArray().map(node => $(node).attr('href'))
      .filter(href => href.startsWith('https://bibsys-xq.alma.exlibrisgroup.com/'))
      .map(href => new URL(href))
    // Nine unwrapped links and two already-direct links in the source page.
    expect(targets.length).toBe(11)
    for (const target of targets) {
      expect(target.searchParams.get('auth')).toBe('SAML')
      expect(target.searchParams.has('subject')).toBe(true)
      expect(target.searchParams.has('faculty')).toBe(true)
      expect(target.searchParams.has('publication')).toBe(true)
      expect(['data', 'sdata', 'reserved'].some(key => target.searchParams.has(key))).toBe(false)
    }
  })

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
    const uis = cheerio.load(fixture('public-programs/uis-data-program.html'))
    // Report a boolean so a newly copied personal profile is never printed by an assertion.
    expect(uis('a[href]').toArray().some(node => /\/(?:ansatte|employees|staff|people|persons|profile)\//i.test(uis(node).attr('href')))).toBe(false)
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
      expect(/\/SYNTHETIC_PUBLIC_SHARE_\d{4}$/.test(sourceUrl.pathname)).toBe(true)
      expect(sourceUrl.searchParams.size === 1 && sourceUrl.searchParams.get('e') === 'SYNTHETIC').toBe(true)
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
    expect(hvl.length).toBe(54)
    expect(hvlTeachers.length).toBe(32)
    expect(hvlTeachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const nmbu = icsEvents(fixture('public-programs/timeedit-nmbu-math100-2026.ics'))
    const nmbuTeachers = nmbu.flatMap(event => event.SUMMARY?.[0] ? [event.SUMMARY[0].split('\\,')[1]] : [])
    expect(nmbu.length).toBe(68)
    expect(nmbuTeachers.length).toBe(63)
    expect(nmbu.filter(event => event.SUMMARY?.[0]).every(event => event.SUMMARY[0].split('\\,').length === 2)).toBe(true)
    expect(nmbuTeachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const mf = icsEvents(fixture('public-timeedit/mf-calendar.ics'))
    const mfTeachers = mf.map(event => event.DESCRIPTION[0].split('\\n')[0])
    expect(mf.length).toBe(40)
    expect(new Set(mfTeachers).size).toBe(8)
    expect(mfTeachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const steiner = icsEvents(fixture('public-timeedit/steiner-calendar.ics'))
    const steinerTeachers = steiner.flatMap(event => event.SUMMARY[0].split('\\,').filter(segment => syntheticTeacher.test(segment.trim())))
    expect(steiner.length).toBe(34)
    expect(steinerTeachers.length).toBe(43)
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
    expect(volda.length).toBe(52)
    expect(voldaTeachers.every(value => syntheticTeacher.test(value))).toBe(true)

    const uib = icsEvents(fixture('public-tp/uib.ics'))
    const uibMatches = uib.flatMap(event => [...(event.SUMMARY || []), ...(event.DESCRIPTION || [])].flatMap(value => [...value.matchAll(/foreles\p{L}*\s+(Testunderviser [A-Z]+)(?=\\n)/giu)]))
    expect(uib.length).toBe(294)
    expect(uibMatches.length).toBe(26)
    expect(new Set(uibMatches.map(match => match[1])).size).toBe(1)

    const uit = icsEvents(fixture('public-tp/uit.ics'))
    const uitTeachers = uit.flatMap(event => (event.DESCRIPTION || []).flatMap(value => {
      const parts = value.split('\\n')
      return parts.length === 10 && /\bforeles\p{L}*\b/iu.test(parts[1]) ? [parts[4].trim()] : []
    }))
    expect(uit.length).toBe(16)
    expect(uitTeachers.length).toBe(6)
    expect(uitTeachers.every(value => syntheticTeacher.test(value))).toBe(true)
  })

  it('retains NIH table and HiMolde array shapes with synthetic staff values', () => {
    const $ = cheerio.load(fixture('public-timeedit/nih-schedule.html'))
    const rows = $('tbody tr')
    const teachers = rows.toArray().map(row => $(row).find('td').eq(5).text().trim()).filter(Boolean)
    expect(rows.length).toBe(75)
    expect(teachers.length).toBe(32)
    expect(new Set(teachers).size).toBe(11)
    expect(teachers.every(value => syntheticTeacher.test(value))).toBe(true)

    // The page also has datepicker tables. Check the schedule itself explicitly.
    const scheduleRows = $('table.restable tr')
    const scheduleTeachers = scheduleRows.toArray().map(row => $(row).children('td').eq(5).text().trim()).filter(Boolean)
    expect(scheduleRows.length).toBe(62)
    expect(scheduleRows.toArray().filter(row => $(row).children('td').length === 9).length).toBe(30)
    expect(scheduleTeachers.length).toBe(27)
    expect(new Set(scheduleTeachers).size).toBe(7)
    expect(scheduleTeachers.every(value => syntheticTeacher.test(value))).toBe(true)
    expect(teachingPersonHtmlFindings(fixture('public-timeedit/nih-schedule.html'))).toEqual([])

    const himolde = JSON.parse(fixture('public-tp/himolde-events.json'))
    expect(himolde.events.map(event => event.staffnames.length)).toEqual([1, 0, 0])
    expect(himolde.events[0].staffnames.every(value => syntheticTeacher.test(value))).toBe(true)
  })

  it('minimizes both NIH lecturer filters including labels, identifiers, links and attributes', () => {
    const $ = cheerio.load(fixture('public-timeedit/nih-schedule.html'))
    const filters = $('select[data-name="Foreleser"]')
    expect(filters.length).toBe(2)
    filters.each((filterIndex, node) => {
      const options = $(node).find('option')
      expect(options.length).toBe(7)
      expect(options.toArray().every(option => syntheticTeacher.test($(option).text().trim()))).toBe(true)
      expect(options.toArray().every(option => Object.keys(option.attribs).length === 1)).toBe(true)
      expect(options.toArray().every(option => filterIndex === 0
        ? /^https:\/\/example\.invalid\/teacher\/SYNTHETIC_TEACHER_[A-Z]+\.html$/.test($(option).attr('value'))
        : /^SYNTHETIC_TEACHER_[A-Z]+$/.test($(option).attr('value')))).toBe(true)
    })
  })

  // Keep the complete recursive audit, with a separate result/time budget per
  // fixture so machine load cannot turn the whole corpus into one timed test.
  it.each(walk(fixtureUrl).filter(url => /\.(?:json|html)$/.test(url.pathname))
    .map(url => url.pathname.slice(fixtureUrl.pathname.length)))('checks JSON/HTML fixture %s recursively, including encoded HTML and metadata', relative => {
    const format = relative.endsWith('.html') ? 'html' : 'json'
    const source = fixture(relative)
    const findings = fixtureMetadataFindings(format === 'json' ? JSON.parse(source) : source, format)
      .map(finding => ({ file: relative, ...finding }))
    expect(findings).toEqual([])
  })

  it.each([
    ['public-programs/timeedit-hvl-dat100-2026.ics', 'hvl'],
    ['public-programs/timeedit-nmbu-math100-2026.ics', 'nmbu'],
    ['public-timeedit/mf-calendar.ics', 'mf'],
    ['public-timeedit/nih-calendar.ics', 'nih'],
    ['public-tp/uib.ics', 'uib'],
    ['public-tp/uit.ics', 'uit'],
  ])('checks all person-bearing segments in %s', (name, kind) => {
    expect(calendarPersonFindings(fixture(name), kind)).toEqual([])
  })

  it('requires reviewed text contracts for all eleven captured ICS files', () => {
    // Approved academic/location/group text after the 2026-10-25 minimization.
    // Static digests are not regenerated from the fixture under test. A changed
    // capture requires content review, not automatically accepting a new digest.
    const contracts = {
      'public-programs/fih-calendar-btfl1.ics': '3421b227c4bf8264a6303802a220a235999f3aa5270699f33f2dcd6089416ddb',
      'public-programs/timeedit-hvl-dat100-2026.ics': 'a46a7e7db6e85aba50e55e1f19435076cc9be8c0c649ab39942f35b3e4bab876',
      'public-programs/timeedit-nmbu-math100-2026.ics': '27674509694ccf0240560bf843975bec83966fb094d72349d0c7b28eca62fb4f',
      'public-timeedit/kristiania-calendar.ics': '308f3b49e427efc183d9d96614359e4fcb9c39fa1e3b0da0db2dfeeb468e0400',
      'public-timeedit/ldh-calendar.ics': 'e8c07e527cfb67e4fc5952539df027eca7ab8923705b7307a49687ffa4246435',
      'public-timeedit/mf-calendar.ics': 'd145f839f32193e28209d499fc9f09e2841a3a2221e7c48ed6dfd0c9d09d6b27',
      'public-timeedit/nih-calendar.ics': 'c5df701d902192453fa0fea9b4404e36b688209a03bd3ff2a27bae221304e21d',
      'public-timeedit/steiner-calendar.ics': '59e678d81e6295a12392e073df363c195e8d1cb976aaec2dfe3e606b59b0e097',
      'public-timeedit/volda-calendar.ics': '0a4dc07c258746789af109ef843a1f0a792b82e8d35cc395c126f30a67c1e2b3',
      'public-tp/uib.ics': 'a795db034fb6bf2cea095e17f5cfcab0b06283aa5240a707ea76bb8acc389b3d',
      'public-tp/uit.ics': 'fa8b8b0fc2e58d71bc60520bfff78b6619ac1f857004006da46e738a363d571c',
    }
    const files = walk(fixtureUrl).filter(url => url.pathname.endsWith('.ics'))
    expect(files.length).toBe(Object.keys(contracts).length)
    for (const url of files) {
      const name = url.pathname.slice(fixtureUrl.pathname.length)
      const source = fixture(url)
      expect(Object.hasOwn(contracts, name)).toBe(true)
      expect(calendarTextContractFindings(source, contracts[name]).map(finding => ({ file: name, ...finding }))).toEqual([])
      expect(calendarPersonFindings(source).filter(finding => finding.category === 'calendar-person-property' || finding.category === 'calendar-person-parameter').map(finding => ({ file: name, ...finding }))).toEqual([])
    }
  })

  it('keeps the synthetic DOCX free of author, comment, revision and embedded metadata', async () => {
    const zip = await JSZip.loadAsync(readFileSync(new URL('connected-semester.docx', fixtureUrl)))
    const names = Object.keys(zip.files).filter(name => !zip.files[name].dir)
    expect(names.length).toBe(3)
    expect(names.every(name => ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'].includes(name))).toBe(true)
    for (const name of names) {
      const xml = await zip.files[name].async('string')
      expect(xmlPersonMetadataFindings(xml)).toEqual([])
    }
  })

  it('omits unnecessary HGUt biographies without dropping academic module structure', () => {
    for (const name of ['hgut-hest-i-naering-pdf.json', 'hgut-nyskaping-og-utvikling-pdf.json']) {
      const pages = JSON.parse(fixture(`public-programs/${name}`))
      const text = pages.flatMap(page => page.lines).join('\n')
      expect(/\b(?:Educators|Course Leader|Studieansvarleg)\b/i.test(text)).toBe(false)
      expect(pages.every(page => Array.isArray(page.lines))).toBe(true)
      expect(pages.length).toBe(name.includes('hest') ? 10 : 6)
    }
  })
})

describe('privacy guards with wholly invented negative examples', () => {
  const calendar = (field, value) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:synthetic-1@example.invalid\r\n${field}:${value}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
  const personFilters = () => [6, 37].map((id, index) => `<div class="headlineLink" data-id=""><label for="te_link_${id}" class="bl" title="Foreleser">Foreleser</label><select id="te_link_${id}" data-name="Foreleser" class="fancyformfieldsearchselect${index === 0 ? ' hasURL' : ''}" multiple="" size="3"><option value="${index === 0 ? 'https://example.invalid/teacher/SYNTHETIC_TEACHER_A.html' : 'SYNTHETIC_TEACHER_A'}">Testunderviser A</option><option value="SYNTHETIC_TEACHER_B">Testunderviser B</option></select></div>`).join('')
  const personTable = (column, value) => `<table><tr>${'<th>Emne</th>'.repeat(column)}<th>Foreleser</th></tr><tr>${'<td>TEST101</td>'.repeat(column)}<td class="column1 columnLine c-1">${value}</td></tr></table>`

  it.each([0, 1])('checks every option and attribute of lecturer filter %i independently', filterIndex => {
    expect(teachingPersonHtmlFindings(personFilters())).toEqual([])
    const mutations = [
      field => field.find('option').last().text('fiktiv personrest'),
      field => field.find('option').last().text('Testunderviser B, fiktiv personrest'),
      field => field.find('option').last().text('Testunderviser B\nfiktiv personrest'),
      field => field.find('option').last().attr('value', '987654321'),
      field => field.find('option').last().attr('value', 'https://example.invalid/person/FIKTIV_PERSONREST'),
      field => field.find('option').last().attr('value', 'SYNTHETIC_TEACHER_B FIKTIV_PERSONREST'),
      field => field.find('option').last().attr('data-id', 'FIKTIV_PERSONREST'),
      field => field.find('option').last().attr('title', 'FIKTIV_PERSONREST'),
      field => field.find('option').last().attr('data-settings', '{"personId":"FIKTIV_PERSONREST"}'),
      field => field.attr('data-person-url', 'https://example.invalid/person/FIKTIV_PERSONREST'),
      field => field.attr('title', 'Testunderviser A FIKTIV_PERSONREST'),
      field => field.parent().attr('data-id', 'FIKTIV_PERSONREST'),
      field => field.siblings('label').attr('title', 'FIKTIV_PERSONREST'),
    ]
    for (const mutate of mutations) {
      const $ = cheerio.load(personFilters()); mutate($('select').eq(filterIndex))
      const findings = teachingPersonHtmlFindings($.html())
      expect(findings.length).toBeGreaterThan(0)
      expect(findings.every(finding => finding.path.startsWith(`person-filter[${filterIndex}]`))).toBe(true)
      expect(JSON.stringify(findings).includes('PERSONREST')).toBe(false)
    }
  })

  it.each([0, 1, 5])('checks all person-column segments, descendants and attributes at column %i', column => {
    expect(teachingPersonHtmlFindings(personTable(column, 'Testunderviser A, Testunderviser B'))).toEqual([])
    for (const value of ['fiktiv personrest', 'Testunderviser A; fiktiv personrest', 'Testunderviser A<br><span>fiktiv personrest</span>', '<a href="https://example.invalid/person/FIKTIV_PERSONREST">Testunderviser A</a>', '<span data-id="FIKTIV_PERSONREST">Testunderviser A</span>']) {
      const findings = teachingPersonHtmlFindings(personFilters() + personTable(column, value))
      expect(findings.length).toBeGreaterThan(0)
      expect(findings.every(finding => finding.path.startsWith('person-column['))).toBe(true)
      expect(JSON.stringify(findings).includes('PERSONREST')).toBe(false)
    }
    const $ = cheerio.load(personTable(column, 'Testunderviser A'))
    $('td').last().attr('title', 'FIKTIV_PERSONREST')
    expect(teachingPersonHtmlFindings($.html()).some(finding => finding.category === 'html-teaching-person-attribute')).toBe(true)
  })

  it.each([0, 1])('checks complete labels and outside-select wrapper text for filter %i', filterIndex => {
    const mutations = [
      field => field.siblings('label').append(' FIKTIV_PERSONREST'),
      field => field.siblings('label').prepend('FIKTIV_PERSONREST '),
      field => field.siblings('label').append('<span>FIKTIV_PERSONREST</span>'),
      field => field.after('<span>FIKTIV_PERSONREST</span>'),
      field => field.before('<span>Testunderviser A FIKTIV_PERSONREST</span>'),
      field => field.parent().append('FIKTIV_PERSONREST'),
      field => { field.removeAttr('data-name'); field.siblings('label').append(' FIKTIV_PERSONREST') },
    ]
    for (const mutate of mutations) {
      const $ = cheerio.load(personFilters()); mutate($('select').eq(filterIndex))
      const findings = teachingPersonHtmlFindings($.html())
      expect(findings.length).toBeGreaterThan(0)
      expect(findings.every(finding => finding.path.startsWith(`person-filter[${filterIndex}]`))).toBe(true)
      expect(JSON.stringify(findings).includes('PERSONREST')).toBe(false)
      expect(fixtureMetadataFindings({ safe: 'Testunderviser A', html: $.html() }).length).toBeGreaterThan(0)
    }
  })

  it.each([0, 1])('checks associated labels outside the wrapper for filter %i', filterIndex => {
    for (const residue of ['text', 'attribute', 'role-from-title']) {
      const $ = cheerio.load(personFilters()), field = $('select').eq(filterIndex)
      const label = field.siblings('label').insertBefore(field.parent())
      expect(teachingPersonHtmlFindings($.html())).toEqual([])
      if (residue === 'attribute') label.attr('title', 'FIKTIV_PERSONREST')
      else {
        if (residue === 'role-from-title') field.removeAttr('data-name')
        label.append('<span>FIKTIV_PERSONREST</span>')
      }
      const findings = teachingPersonHtmlFindings($.html())
      expect(findings.length).toBeGreaterThan(0)
      expect(findings.every(finding => finding.path.startsWith(`person-filter[${filterIndex}]`))).toBe(true)
      expect(JSON.stringify(findings).includes('PERSONREST')).toBe(false)
    }
  })

  it('discovers filters from associated labels and checks HTML embedded in JSON', () => {
    const $ = cheerio.load(personFilters())
    $('select').removeAttr('data-name')
    $('select').last().find('option').last().text('fiktiv personrest')
    expect(teachingPersonHtmlFindings($.html()).length).toBeGreaterThan(0)
    expect(fixtureMetadataFindings({ safe: 'Testunderviser A', html: $.html() }).length).toBeGreaterThan(0)
  })
  // Intentionally fictional invalid labels. No regression depends on a real name.
  it.each([
    ['hvl', 'DESCRIPTION', 'Fiktiv Personrest\\nTestunderviser A\\nID 1'],
    ['nmbu', 'DESCRIPTION', 'Fiktiv Personrest\\nID 1'],
    ['mf', 'DESCRIPTION', 'Testunderviser A\\nFiktiv Personrest\\nID 1'],
    ['nih', 'SUMMARY', 'IDR107_1_2026 HØST\\, Testunderviser A\\, Fiktiv Personrest'],
    ['uib', 'DESCRIPTION', 'INF100\\nForelesning Testunderviser A\\nF. Personrest\\n'],
    ['uit', 'DESCRIPTION', 'INF-0101\\nLab\\nTestunderviser A, F. Personrest\\n\\nTestunderviser B'],
    ['mf', 'DESCRIPTION', 'Testunderviser A Fiktiv Personrest\\nID 1'],
    ['hvl', 'DESCRIPTION', 'Testunderviser A\\nFiktiv\r\n Personrest\\nID 1'],
  ])('rejects later, alternate, mixed or folded %s person segments', (kind, field, value) => {
    const findings = calendarPersonFindings(calendar(field, value), kind)
    expect(findings.length).toBeGreaterThan(0)
    expect(JSON.stringify(findings).includes('Personrest')).toBe(false)
  })

  it('keeps UID identity, room names, groups and complete synthetic teacher lists', () => {
    expect(calendarPersonFindings(calendar('DESCRIPTION', 'INF-0101\\nLab\\nTestunderviser A, Testunderviser B\\n'), 'uit')).toEqual([])
    expect(calendarPersonFindings(calendar('SUMMARY', 'IDR107_1_2026 HØST\\, Gruppe 2\\, Testunderviser A').replace('END:VEVENT', 'LOCATION:Store Sal\r\nEND:VEVENT'), 'nih')).toEqual([])
  })

  it.each([
    'BEGIN:VCALENDAR\r\nCONTACT:Fiktiv Personrest\r\nEND:VCALENDAR',
    'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nATTENDEE:mailto:synthetic@example.invalid\r\nEND:VTODO\r\nEND:VCALENDAR',
    'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nCONTACT:Fiktiv Personrest\r\nEND:VTODO\r\nEND:VCALENDAR',
    calendar('X-TEACHER', 'Fiktiv Personrest'),
  ])('checks person metadata outside the event text projection %#', source => {
    const findings = calendarPersonFindings(source)
    expect(findings.length).toBeGreaterThan(0)
    expect(JSON.stringify(findings).includes('Personrest')).toBe(false)
  })

  it.each(['SUMMARY', 'DESCRIPTION', 'LOCATION', 'X-ALT-DESC'])('rejects arbitrary residue in every %s value, regardless of name form', field => {
    const safe = calendar(field, 'TEST101\\nGruppe 2\\nTestunderviser A')
    const digest = calendarTextContract(safe)
    expect(calendarTextContractFindings(safe.replace('Testunderviser A', 'Testunderviser ZZ'), digest)).toEqual([])
    for (const residue of ['rest', 'fiktiv personrest', 'FIKTIV', 'Testunderviser A rest', 'rest Testunderviser A']) {
      for (const changed of [
        safe.replace('Testunderviser A', residue),
        safe.replace('END:VEVENT', `${field}:${residue}\r\nEND:VEVENT`),
        safe.replace('Testunderviser A', `Testunderviser A\\n${residue}`),
      ]) {
        const findings = calendarTextContractFindings(changed, digest)
        expect(findings.length).toBe(1)
        expect(JSON.stringify(findings).includes(residue)).toBe(false)
      }
    }
  })

  it.each([
    { nested: [{ author: 'Fiktiv Personrest' }] },
    { nested: { serialized: JSON.stringify({ creator: 'Fiktiv Personrest' }) } },
    { pages: [{ html: '<meta name="author" content="Fiktiv Personrest">' }] },
    { html: '<script type="application/ld+json">{"@graph":[{"@type":"Person","name":"Fiktiv Personrest"}]}</script>' },
    { html: '<div data-settings="{&quot;author&quot;:&quot;Fiktiv Personrest&quot;}"></div>' },
    { html: '<span itemprop="author">Fiktiv Personrest</span>' },
    { html: '<div data-author="Fiktiv Personrest"></div>' },
    { html: '<div class="persons"><a href="https://example.invalid/profile/synthetic">Fiktiv Personrest</a></div>' },
    { nested: { profile: { name: 'Fiktiv Personrest' } } },
    { staffnames: ['Testunderviser A', 'Fiktiv Personrest'] },
    { nested: { '@type': ['Person', 'Thing'], name: 'Fiktiv Personrest' } },
    { nested: { '@type': 'https://schema.org/Person', name: 'Fiktiv Personrest' } },
    { author: { '@type': ['Organization', 'Person'], name: 'Fiktiv Personrest' } },
    { html: '<meta name="DC.creator" content="Fiktiv Personrest">' },
    { html: '<meta name="dcterms.creator" content="Fiktiv Personrest">' },
    { html: '<span itemprop="author name">Fiktiv Personrest</span>' },
    { person: 'Testunderviser A', person_id: 'FIKTIV_PERSONREST' },
    { teacher: 'Testunderviser A', teacherUrl: 'https://example.invalid/FIKTIV_PERSONREST' },
    { '@type': 'Person', name: 'Testunderviser A', identifier: 'FIKTIV_PERSONREST' },
    { '@type': 'Person', name: 'Testunderviser A', url: 'https://example.invalid/FIKTIV_PERSONREST' },
    { html: '<span data-teacher-id="FIKTIV_PERSONREST">Testunderviser A</span>' },
  ])('rejects nested person metadata with category-only diagnostics %#', value => {
    const findings = fixtureMetadataFindings(value)
    expect(findings.length).toBeGreaterThan(0)
    expect(JSON.stringify(findings).includes('Personrest')).toBe(false)
  })

  it('retains academic titles, organizational metadata and explicit synthetic staff', () => {
    expect(fixtureMetadataFindings({ name: 'Fiktiv Forfatters teori', provider: { '@type': 'Organization', name: 'Testinstitusjon' }, author: null, staffnames: ['Testunderviser A'] })).toEqual([])
    for (const type of ['Organization', 'https://schema.org/Organization', ['Organization', 'Thing']]) {
      expect(fixtureMetadataFindings({ author: { '@type': type, name: 'Testinstitusjon' } })).toEqual([])
    }
    expect(calendarPersonFindings(calendar('X-TEACHER', 'Testunderviser A'))).toEqual([])
  })

  it.each([
    '<cp:coreProperties><dc:creator>Fiktiv Personrest</dc:creator></cp:coreProperties>',
    '<cp:lastModifiedBy>Fiktiv Personrest</cp:lastModifiedBy>',
    '<w:comment w:author="Fiktiv Personrest">synthetic</w:comment>',
    '<w:ins w:author="Fiktiv Personrest"><w:t>synthetic</w:t></w:ins>',
  ])('rejects synthetic hidden document metadata without reporting its value %#', xml => {
    const findings = xmlPersonMetadataFindings(xml)
    expect(findings.length).toBeGreaterThan(0)
    expect(JSON.stringify(findings).includes('Personrest')).toBe(false)
  })
})
