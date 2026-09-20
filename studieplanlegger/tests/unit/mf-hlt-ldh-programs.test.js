import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { mfPrograms, parseMfPlan, mfProgramUrl } from '../../server/providers/mf-programs.js'
import { hltPrograms, parseHltPlan, hltProgramUrl } from '../../server/providers/hlt-programs.js'
import { parseLdhHtmlPlan, ldhProgramUrl } from '../../server/providers/ldh-programs.js'
import { mergeCourseOnly, emptyPlanner, validPlanner } from '../../src/planner.js'

const fixture = name => readFile(new URL(`../fixtures/public-programs/${name}`, import.meta.url), 'utf8')
const current = (institution, program, sourceUrl) => ({ institution, program, sourceUrl, cohort: '2026', cohortFromStudent: 'true' })
const mf = program => current('mf', program, `https://mf.no/studier/programmer/${program}`)
const hlt = program => current('hlt', program, `https://hlt.no/${program}/`)

describe('MF public programme tables', () => {
  it('reads real professional and lektor models without inventing a cohort or calendar year', async () => {
    const professional = parseMfPlan(await fixture('mf-professional-current.html'), mf('profesjonsstudium-teologi'))
    expect(professional.program).toMatchObject({ cohort: '2026', cohortFromStudent: true })
    expect(professional.models[0].periods).toHaveLength(12)
    expect(professional.models[0].periods[0].courses.map(course => course.code)).toEqual(['TEOL1010', 'RL1010', 'RL1016'])
    expect(professional.models[0].periods[0].courses[0]).toMatchObject({ name: 'Bibelen', credits: 10, year: null, semester: null, choice: '' })
    expect(professional.models[0].unplacedCourses[0]).toMatchObject({ code: 'PRA1501', credits: 0 })
    expect(professional.completeness.complete).toBe(false)
    const lektor = parseMfPlan(await fixture('mf-lektor-current.html'), mf('Lektorprogram'))
    expect(lektor.models).toHaveLength(2)
    expect(lektor.models.every(model => model.periods.length === 10)).toBe(true)
    const choices = lektor.models[1].periods.find(period => period.studySemester === 5).courses
    expect(choices.filter(course => ['RL2014', 'RL2015'].includes(course.code)).every(course => course.choice === 'V')).toBe(true)
  })
  it('fetches both published status filters and caches unchanged public sources', async () => {
    const open = await fixture('mf-catalogue-current.html'), outgoing = await fixture('mf-catalogue-outgoing.html')
    const fetchText = vi.fn(async url => url.includes('open=2') ? outgoing : open)
    const first = await mfPrograms('mf', 'programs', { year: '2026' }, { fetchText })
    expect(first.results).toHaveLength(30)
    expect(first.results.some(item => item.sourceUrl === 'https://mf.no/studier/master-religion-contemporary-society')).toBe(true)
    expect(first.completeness.complete).toBe(true)
    await mfPrograms('mf', 'programs', { year: '2025', q: 'lektor' }, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(3)
  })
  it('requires explicit student cohort and preserves stable identities when source presentation changes', async () => {
    const html = await fixture('mf-professional-current.html'), query = mf('profesjonsstudium-teologi')
    expect(() => parseMfPlan(html, { ...query, cohortFromStudent: undefined })).toThrow(/kull/)
    const a = parseMfPlan(html, query), b = parseMfPlan(`${html}\n<!-- source presentation changed -->`, query)
    expect(a.program.sourceEdition).not.toBe(b.program.sourceEdition)
    expect(a.models[0].periods[0].courses[0].id).toBe(b.models[0].periods[0].courses[0].id)
  })
})

describe('HLT public programme models', () => {
  it('reads all six BATL directions and the separate BALA layout, including the nested fourth-semester heading', async () => {
    const batl = parseHltPlan(await fixture('hlt-batl-current.html'), hlt('batl'))
    expect(batl.models).toHaveLength(6)
    expect(batl.models.every(model => model.periods.length === 6)).toBe(true)
    expect(batl.models[5].periods[2].courses).toHaveLength(3)
    expect(batl.models[5].periods[3].courses).toHaveLength(3)
    expect(batl.models[0].periods[0]).toMatchObject({ year: null, semester: 'autumn' })
    expect(batl.models[0].periods[0].courses[0]).toMatchObject({ code: '', credits: 10, name: 'Religions- og livssynskunnskap' })
    expect(batl.models[0].periods[4].courses.find(course => course.name === 'Praksis 2').choice).toBe('')
    const bala = parseHltPlan(await fixture('hlt-bala-current.html'), hlt('bala'))
    expect(bala.models[0].periods.map(period => period.courses.length)).toEqual([3, 3, 3, 3, 1, 3])
    expect(bala.models[0].periods.every(period => period.year === null && period.semester === null)).toBe(true)
    expect(bala.models[0].periods[5].courses.slice(0, 2).every(course => course.choice === 'V')).toBe(true)
    expect(bala.models[0].periods[4].requirements.join()).toContain('Valgemne')
  })
  it('keeps other catalogue categories usable when one published category fails', async () => {
    const card = (href, title) => `<div class="main_content"><a class="image-link" href="${href}"></a><h3>${title}</h3></div>`
    const fetchText = vi.fn(async url => {
      if (url.endsWith('/studietilbud/')) return card('/bachelor/', 'Bachelor') + card('/videreutdanning/', 'Videreutdanning')
      if (url.endsWith('/bachelor/')) return card('/batl/', 'Bachelor i teologi og ledelse')
      throw new Error('HTTP 404')
    })
    const result = await hltPrograms('hlt', 'programs', { year: '2026' }, { fetchText })
    expect(result.results.map(item => item.code)).toEqual(['batl'])
    expect(result.completeness.complete).toBe(false)
    expect(result.warnings.join()).toContain('HTTP 404')
    expect(fetchText).toHaveBeenCalledTimes(3)
  })
  it('rejects a redirect to another selected-program path for both MF and HLT', async () => {
    const mfHtml = await fixture('mf-professional-current.html'), hltHtml = await fixture('hlt-batl-current.html')
    const redirected = (body, redirect) => async (_url, _redirects, validate) => { validate(new URL(redirect)); return body }
    await expect(mfPrograms('mf', 'program-plan', mf('profesjonsstudium-teologi'), { fetchText: redirected(mfHtml, 'https://www.mf.no/studier/programmer/lektorprogram') })).rejects.toMatchObject({ status: 'source-changed' })
    await expect(hltPrograms('hlt', 'program-plan', hlt('batl'), { fetchText: redirected(hltHtml, 'https://hlt.no/bala/') })).rejects.toMatchObject({ status: 'source-changed' })
  })
})

describe('LDH published cohort HTML', () => {
  it('retains all sixteen BIS26 courses and explicit 5/6-semester ambiguity', async () => {
    const result = parseLdhHtmlPlan(await fixture('ldh-bis26.html'), { program: 'bachelor-i-sykepleie', programName: 'Bachelor i sykepleie', sourceUrl: 'https://ldh.no/studietilbud/bachelor-i-sykepleie/emnerBIS/emnerBIS26', cohort: '2026' })
    const periods = result.models[0].periods
    expect(result.completeness.returned).toBe(16)
    expect(periods.map(period => period.courses.length)).toEqual([2, 3, 2, 4, 5, 5])
    expect(periods[4].courses.every(course => course.requiresSemesterChoice && course.choice !== 'O')).toBe(true)
    expect(periods[0].courses[0]).toMatchObject({ code: 'BSY-121', year: null, semester: null, credits: null })
    expect(() => parseLdhHtmlPlan('<main>Gjelder kull 2025.</main>', { cohort: '2026' })).toThrow(/opptakskullet/)
  })
  it('creates valid, repeatable courses from source names even when the code and period require clarification', async () => {
    const plan = parseHltPlan(await fixture('hlt-bala-current.html'), hlt('bala'))
    const course = { ...plan.models[0].periods[0].courses[0], year: 2026, semester: 'autumn' }
    let planner = mergeCourseOnly(emptyPlanner(), course)
    expect(validPlanner(planner)).toBe(true)
    planner = mergeCourseOnly(planner, course)
    expect(planner.courses).toHaveLength(1)
  })
  it('rejects off-origin URLs, credentials and unsupported source paths', () => {
    for (const validate of [mfProgramUrl, hltProgramUrl, ldhProgramUrl]) {
      expect(() => validate('https://127.0.0.1/private')).toThrow()
      expect(() => validate('https://user:secret@ldh.no/studietilbud')).toThrow()
    }
    expect(() => mfProgramUrl('https://mf.no/admin')).toThrow()
    expect(() => hltProgramUrl('https://hlt.no/wp-content/uploads/private.pdf')).toThrow()
  })
})
