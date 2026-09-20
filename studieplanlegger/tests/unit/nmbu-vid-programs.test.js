import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { parseNmbuCatalogue, parseNmbuPlan, nmbuPrograms } from '../../server/providers/nmbu-programs.js'
import { parseVidDescription, parseVidWay, fetchVidCatalogue, vidPrograms } from '../../server/providers/vid-programs.js'

const fixture = name => readFileSync(new URL(`../fixtures/public-programs/${name}`, import.meta.url), 'utf8')
const nmbuPlan = fixture('nmbu-olit-2026.html'), vidHtml = fixture('vid-verd-2026.html'), vidWay = fixture('vid-verd-2026.json')
const vidSource = 'https://www.vid.no/studier/studieplaner/verdibasert-ledelse-host-2026'
const nmbuSource = 'https://www.nmbu.no/studier/bachelor/okonomi-ledelse-og-it'
const nmbuCatalogue = rows => JSON.stringify({ count: rows.length, data: rows.map((row, index) => ({ type: 'node--study_program', attributes: { drupal_internal__nid: row.code || index + 1, title: row.name || `Program ${index}`, path: { alias: row.path || `/studier/bachelor/program-${index}` } } })) })
const vidDescription = parseVidDescription(vidHtml)
const vidPage = (page, total) => JSON.stringify({ page, start: (page - 1) * 10, count: 10, total, hits: Array.from({ length: Math.max(0, Math.min(10, total - (page - 1) * 10)) }, (_, index) => ({ href: `/studier/studieplaner/program-${(page - 1) * 10 + index}-2026`, title: `Program ${(page - 1) * 10 + index}`, term: 'Høst 2026', locations: ['Oslo'] })) })
const resourceHtml = data => `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { resource: data } } })}</script>`

describe('NMBU public program contracts', () => {
  it('reads all 90 catalogue records and checks completeness against the source count', () => {
    const data = parseNmbuCatalogue(nmbuCatalogue(Array.from({ length: 90 }, () => ({}))))
    expect(data.results).toHaveLength(90)
    expect(data.completeness.complete).toBe(true)
    const partial = JSON.parse(nmbuCatalogue([{}])); partial.count = 90
    expect(parseNmbuCatalogue(JSON.stringify(partial)).completeness.complete).toBe(false)
  })
  it('parses the captured current plan, explicit intake, block placements and mobility alternatives', () => {
    const plan = parseNmbuPlan(nmbuPlan, { program: { code: '54489' }, cohort: '2026', sourceUrl: 'https://www.nmbu.no/node/44441' })
    const periods = plan.models[0].periods
    expect(periods).toHaveLength(6)
    expect(periods[0]).toMatchObject({ year: 2026, semester: 'autumn', studySemester: 1 })
    expect(periods[0].courses.map(course => [course.code, course.credits, course.choice])).toEqual([['ECN180', 5, 'O'], ['BUS101', 5, 'O'], ['INF120', 10, 'O'], ['MATH100', 10, 'O']])
    expect(periods[3].courses.map(course => course.code)).toContain('BUS238')
    expect(periods[5]).toMatchObject({ year: 2029, semester: 'spring', studySemester: 6 })
    expect(periods[5].courses.map(course => course.choice)).toEqual(['', ''])
    expect(plan.completeness.complete).toBe(false)
  })
  it('never promotes the obsolete legacy JSON body over the rendered plan or invents its cohort', () => {
    const obsolete = resourceHtml({ body: { value: '<p>Oppstart høsten 2025</p><h2>År 1</h2><h4>Høstparallell</h4><p><a href="/emne/BAD100">BAD100 Gammelt emne (5)</a></p>' } })
    const result = parseNmbuPlan(`${obsolete}${nmbuPlan}`, { program: { code: '54489' }, cohort: '2026', sourceUrl: nmbuSource })
    expect(result.models[0].periods.flatMap(p => p.courses).some(c => c.code === 'BAD100')).toBe(false)
    expect(() => parseNmbuPlan(nmbuPlan, { program: { code: '54489' }, cohort: '2025', sourceUrl: nmbuSource })).toThrow('bekrefter ikke')
  })
  it('follows the programme structure and labelled archive once, reuses reads and validates cohort membership', async () => {
    const fetchText = vi.fn(async url => {
      if (url.includes('/api/')) return nmbuCatalogue([{ code: '54489', path: new URL(nmbuSource).pathname }])
      if (url === nmbuSource) return resourceHtml({ type: 'node--study_program', drupal_internal__nid: 54489, field_program_structure: { value: '<a href="/node/44441">Studieplan</a>' }, field_flexible: { value: '<p>Campus Ås</p>', summary: 'Studiested' } })
      if (url.endsWith('/44441')) return nmbuPlan
      if (url.endsWith('/53400')) return '<main><a href="/node/57676">Oppstart 2025</a></main>'
      throw new Error('Unexpected URL')
    })
    const cohorts = await nmbuPrograms('nmbu', 'program-cohorts', { program: '54489', sourceUrl: nmbuSource }, { fetchText })
    expect(cohorts.results.map(row => row.cohort)).toEqual(['2026', '2025'])
    const plan = await nmbuPrograms('nmbu', 'program-plan', { program: '54489', sourceUrl: 'https://www.nmbu.no/node/44441', cohort: '2026' }, { fetchText })
    expect(plan.program.campuses).toEqual(['Campus Ås'])
    expect(fetchText).toHaveBeenCalledTimes(4)
    await expect(nmbuPrograms('nmbu', 'program-plan', { program: '54489', sourceUrl: 'https://www.nmbu.no/node/99999', cohort: '2026' }, { fetchText })).rejects.toThrow('ikke publisert')
  })
  it('rejects external and private destinations without fetching', async () => {
    const fetchText = vi.fn()
    await expect(nmbuPrograms('nmbu', 'program-plan', { program: '123', sourceUrl: 'https://localhost/node/1' }, { fetchText })).rejects.toThrow()
    expect(fetchText).not.toHaveBeenCalled()
  })
})

describe('VID public program contracts', () => {
  it('follows every source page with the published page size, including the final partial page', async () => {
    const fetchText = vi.fn(async url => vidPage(Number(new URL(url).searchParams.get('page')), 197))
    const result = await fetchVidCatalogue(fetchText)
    expect(result.results).toHaveLength(197)
    expect(result.completeness).toMatchObject({ complete: true, pages: 20, returned: 197, total: 197 })
    expect(fetchText).toHaveBeenCalledTimes(20)
    await fetchVidCatalogue(fetchText)
    expect(fetchText).toHaveBeenCalledTimes(20)
  })
  it('exposes partial source failures and repeated/changed pages without claiming a complete catalogue', async () => {
    for (const broken of [() => { throw new Error('HTTP 503') }, () => vidPage(1, 197), () => vidPage(2, 198), () => JSON.stringify({ page: 2, start: 10, total: 197, hits: [] })]) {
      const fetchText = vi.fn(async url => Number(new URL(url).searchParams.get('page')) === 1 ? vidPage(1, 197) : broken())
      const result = await fetchVidCatalogue(fetchText)
      expect(result.completeness.complete).toBe(false)
      expect(result.results).toHaveLength(10)
      expect(result.warnings.join(' ')).toContain('ufullstendig')
      expect(fetchText).toHaveBeenCalledTimes(2)
    }
  })
  it('parses captured source periods without merging work-path semesters and calendar terms', () => {
    const result = parseVidWay(vidWay, { description: vidDescription, way: vidDescription.ways[0], program: 'verdibasert-ledelse-host-2026' })
    expect(result.model.periods[0]).toMatchObject({ year: 2026, semester: 'autumn', studySemester: 1 })
    expect(result.model.periods[1]).toMatchObject({ year: 2027, semester: 'spring', studySemester: 2 })
    expect(result.model.periods[0].courses[0]).toMatchObject({ code: 'VUVERD8010', name: 'Verdibevisst ledelse og organisering', credits: 15, choice: 'O' })
    const data = JSON.parse(vidWay); data.hit[0].title = 'Neste høst'; data.hit[0].coursesOptional = data.hit[0].coursesObligatory.splice(0)
    const uncertain = parseVidWay(JSON.stringify(data), { description: vidDescription, way: vidDescription.ways[0], program: 'verdibasert-ledelse-host-2026' })
    expect(uncertain.model.periods[0]).toMatchObject({ year: null, semester: null })
    expect(uncertain.model.periods[0].courses[0].choice).toBe('V')
  })
  it('validates period totals and linked course versions', () => {
    const data = JSON.parse(vidWay); data.total = 3
    expect(() => parseVidWay(JSON.stringify(data), { description: vidDescription, way: vidDescription.ways[0], program: 'TEST' })).toThrow('ufullstendig')
    data.total = 2; data.hit[0].coursesObligatory[0].href = data.hit[0].coursesObligatory[0].href.replace('year=2026', 'year=2025')
    const result = parseVidWay(JSON.stringify(data), { description: vidDescription, way: vidDescription.ways[0], program: 'TEST' })
    expect(result.model.periods[0].courses[0].versionUncertain).toBe(true)
    expect(result.model.periods[0].year).toBe(2026)
  })
  it('reads only source-published cohorts/ways and rejects substituted programme or cohort', async () => {
    const fetchText = vi.fn(async url => url.includes('/listStudyPlanWay?') ? vidWay : vidHtml)
    const query = { program: 'verdibasert-ledelse-host-2026', sourceUrl: vidSource, cohort: '2026' }
    const cohorts = await vidPrograms('vid', 'program-cohorts', query, { fetchText })
    expect(cohorts.results.map(row => row.cohort)).toEqual(['2026', '2025', '2024'])
    const result = await vidPrograms('vid', 'program-plan', query, { fetchText })
    expect(result.models).toHaveLength(1)
    expect(result.program.campuses).toEqual(['Stavanger'])
    expect(fetchText).toHaveBeenCalledTimes(2)
    await expect(vidPrograms('vid', 'program-plan', { ...query, cohort: '2025' }, { fetchText })).rejects.toThrow('annet program eller kull')
    await expect(vidPrograms('vid', 'program-plan', { ...query, sourceUrl: 'https://www.vid.no/studier/studieplaner/not-a-published-sibling' }, { fetchText })).rejects.toThrow('ikke et publisert kull')
  })
  it('does not follow untrusted course URLs or execute imported JSON', () => {
    const data = JSON.parse(vidWay); data.hit[0].coursesObligatory[0].href = 'https://127.0.0.1/private'
    expect(() => parseVidWay(JSON.stringify(data), { description: vidDescription, way: vidDescription.ways[0], program: 'TEST' })).toThrow('utenfor')
    expect(() => parseVidDescription('<script>throw new Error("do not run")</script>')).toThrow('mangler')
  })
})
