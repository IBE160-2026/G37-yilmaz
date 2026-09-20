import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { hgutPrograms, hgutProgramUrl, hgutPdfUrl, parseHgutCatalogue, parseHgutBachelor, parseHgutModule, hgutAvailability } from '../../server/providers/hgut-programs.js'
import { emptyPlanner, mergeCourseOnly, validPlanner } from '../../src/planner.js'

const fixture = name => readFile(new URL(`../fixtures/public-programs/hgut-${name}`, import.meta.url), 'utf8')
const pages = async name => JSON.parse(await fixture(`${name}-pdf.json`))
const base = 'https://hgut.no/studietilbod/'
const bachelor = `${base}bachelorstudium-i-nyskaping-og-samfunnsutvikling/`
const query = { program: 'bachelorstudium-i-nyskaping-og-samfunnsutvikling', sourceUrl: bachelor, cohort: '2026', cohortFromStudent: 'true' }
function sourceFetch() {
  const map = { 'bachelorstudium-i-nyskaping-og-samfunnsutvikling': 'bachelor', 'samfunn-og-utvikling': 'rsu', 'regenerativt-landbruk': 'rl' }
  return vi.fn(async url => { if (url === 'https://hgut.no/') return fixture('home.html'); const code = new URL(url).pathname.split('/')[2]; if (code === 'okonomi-og-samfunn') throw Error('Kilden svarte med HTTP 404.'); return fixture(`${map[code] || code}.html`) })
}

describe('HGUt published programme and module contracts', () => {
  it('combines all published study choices and merges split links to the same circular-economy course', async () => {
    expect(parseHgutCatalogue(await fixture('home.html')).some(row => row.code === 'samfunn-og-utvikling')).toBe(true)
    const fetchText = sourceFetch(), result = await hgutPrograms('hgut', 'programs', {}, { fetchText })
    expect(result.results).toHaveLength(8)
    expect(result.results.find(row => row.code === 'sirkulaer-okonomi').name).toMatch(/Sirkulær.*verdiskaping/)
    expect(result.results.some(row => /generell|praksissamlingar|internasjonalisering/.test(row.code))).toBe(false)
    expect(fetchText).toHaveBeenCalledTimes(2)
  })
  it('keeps seven actual annual offerings, five elective choices and unknown calendar dates without fabricated codes', async () => {
    const { model } = parseHgutBachelor(await fixture('bachelor.html'), bachelor)
    expect(model.periods.map(period => period.courses.length)).toEqual([1, 5, 1])
    expect(model.periods.map(period => period.allowedStudySemesters)).toEqual([[1, 2], [3, 4], [5, 6]])
    expect(model.periods.every(period => period.studySemester === null && period.requiresStudentStudySemester && period.year === null && period.semester === null)).toBe(true)
    expect(model.periods[1].courses.every(course => course.credits === 30 && course.choice === 'V' && course.code === '')).toBe(true)
    expect(model.periods[0].courses[0].credits).toBe(60)
    expect(new Set(model.periods[1].courses.map(course => course.id)).size).toBe(5)
  })
  it('requires the PDF confirmation of parallel modules rather than turning Roman numerals into semesters', async () => {
    const html = await fixture('rsu.html'), pdf = await pages('rsu'), result = parseHgutModule(html, `${base}samfunn-og-utvikling/`, pdf)
    expect(result.model.periods).toHaveLength(1)
    expect(result.model.periods[0]).toMatchObject({ studySemester: null, requiresStudentStudySemester: true, year: null, semester: null })
    expect(result.model.periods[0].courses.map(course => course.credits)).toEqual([30, 30])
    expect(result.model.periods[0].requirements.join()).toContain('parallelt')
    expect(() => parseHgutModule(html, `${base}samfunn-og-utvikling/`, [])).toThrow(/organisering/)
    expect(() => parseHgutModule(html.replace('Modul I, 30', 'Modul I, 45'), `${base}samfunn-og-utvikling/`, pdf)).toThrow(/modulverdi/)
  })
  it('keeps the published NY1 and NY2 groups and their actual component values without double counting', async () => {
    const result = parseHgutModule(await fixture('nyskaping-og-utvikling.html'), `${base}nyskaping-og-utvikling/`, await pages('nyskaping-og-utvikling'))
    expect(result.model.periods[0].courses.map(course => [course.code, course.credits])).toEqual([['NY1', 30], ['NY2', 30]])
    expect(result.model.periods[0].courses[1].notes).toContain('(10 stp)')
    expect(result.model.periods[0].courses[1].notes).toContain('(20 stp)')
  })
  it('checks the agricultural PDF credits and keeps the full value of a course that spans two semesters', async () => {
    const html = await fixture('rl.html'), pdf = await pages('rl')
    expect(parseHgutModule(html, `${base}regenerativt-landbruk/`, pdf).model.periods[0].courses[0]).toMatchObject({ credits: 30, code: '', semester: null })
    const changed = structuredClone(pdf); for (const page of changed) page.lines = page.lines.map(line => line.replace('This course is a 30 stp course', 'This course is a 45 stp course'))
    expect(() => parseHgutModule(html, `${base}regenerativt-landbruk/`, changed)).toThrow(/ulike studiepoeng/)
    const circular = parseHgutModule(await fixture('sirkulaer-okonomi.html'), `${base}sirkulaer-okonomi/`, await pages('sirkulaer-okonomi'))
    expect(circular.model.periods[0].courses[0]).toMatchObject({ credits: 30, semester: null })
    expect(circular.model.periods[0].courses[0].notes).toContain('to semestre')
  })
  it('carries explicit cancellation periods from the actual course pages into the annual choices', async () => {
    for (const name of ['hest-i-naering', 'landskap-og-utvikling']) expect(hgutAvailability(await fixture(`${name}.html`))).toMatchObject({ unavailableCalendarPeriods: [{ year: 2026, semester: 'autumn' }, { year: 2027, semester: 'spring' }] })
    const result = await hgutPrograms('hgut', 'program-plan', query, { fetchText: sourceFetch(), fetchBytes: vi.fn(async () => Buffer.from('unavailable PDF in isolated test')) })
    expect(result.models[0].periods[1].courses.filter(course => course.unavailableCalendarPeriods).length).toBe(2)
    expect(result.models[0].periods[1].courses.find(course => course.sourceUrl.includes('okonomi-og-samfunn')).credits).toBe(30)
    expect(result.completeness.complete).toBe(false)
    expect(result.warnings.join()).toContain('HTTP 404')
    expect(result.warnings.join()).toContain('PDF-planen kunne ikke leses')
  })
  it('imports distinct unnamed-code electives repeatedly while preserving personal edits', async () => {
    const courses = parseHgutBachelor(await fixture('bachelor.html'), bachelor).model.periods[1].courses.map(course => ({ ...course, id: `${course.id}:2027:autumn`, year: 2027, semester: 'autumn' }))
    let planner = emptyPlanner(); for (const course of courses) planner = mergeCourseOnly(planner, course)
    planner.courses[0].notes = 'Mine notater'; planner.courses[0].name = 'Mitt kurs'
    for (const course of courses) planner = mergeCourseOnly(planner, course)
    expect(planner.courses).toHaveLength(5); expect(validPlanner(planner)).toBe(true)
    expect(planner.courses[0]).toMatchObject({ name: 'Mitt kurs', notes: 'Mine notater' })
  })
  it('requires explicit student cohort and rejects unsafe source selection before any public request', async () => {
    const fetchText = sourceFetch(), fetchBytes = vi.fn()
    await expect(hgutPrograms('hgut', 'program-plan', { ...query, sourceUrl: 'https://127.0.0.1/private' }, { fetchText, fetchBytes })).rejects.toThrow()
    expect(fetchText).not.toHaveBeenCalled()
    await expect(hgutPrograms('hgut', 'program-plan', { ...query, cohortFromStudent: undefined }, { fetchText, fetchBytes })).rejects.toThrow(/opptakskull/)
    expect(fetchBytes).not.toHaveBeenCalled()
    expect(() => hgutPdfUrl('https://hgut.no/wp-content/uploads/2024/01/execute.js')).toThrow()
    expect(() => hgutProgramUrl('https://hgut.no/wp-admin/')).toThrow()
  })
})
