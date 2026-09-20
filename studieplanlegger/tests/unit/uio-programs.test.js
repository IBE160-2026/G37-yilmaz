import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parseUioCatalogue, parseUioPlan, uioPrograms, uioProgramUrl } from '../../server/providers/uio-programs.js'

const fixture = name => readFile(new URL(`../fixtures/uio-programs/${name}`, import.meta.url), 'utf8')
const sourceUrl = 'https://www.uio.no/studier/program/informatikk-programmering/'

describe('UiO current public programme structure', () => {
  it('deduplicates catalogue links and keeps full programme identities', async () => {
    const programs = parseUioCatalogue(await fixture('catalogue.html'))
    expect(programs).toEqual([
      { code: 'informatikk-programmering', name: 'Informatikk: programmering og systemarkitektur', level: 'Bachelor', sourceUrl, campuses: [] },
      { code: 'informatikk-programmering-master', name: 'Informatikk: programmering og systemarkitektur', level: 'Master', sourceUrl: 'https://www.uio.no/studier/program/informatikk-programmering-master/', campuses: [] },
    ])
  })

  it('preserves study semesters and alternatives without inventing calendar years', async () => {
    const selected = parseUioCatalogue(await fixture('catalogue.html'))[0]
    const plan = parseUioPlan(await fixture('informatikk.html'), { program: selected.code, cohort: '2026', cohortFromStudent: 'true' }, selected)
    expect(plan.models[0].periods.map(period => period.studySemester)).toEqual([6, 4, 1])
    expect(plan.models[0].periods.find(period => period.studySemester === 4).courses).toMatchObject([
      { code: 'IN2000', credits: 20, choice: 'O', year: null, semester: null },
      { code: 'IN2080', credits: null, choice: 'V' },
      { code: 'IN2100', credits: null, choice: 'V' },
    ])
    expect(plan.models[0].periods[0].requirements).toContain('Fritt emne')
    expect(plan.completeness.complete).toBe(false)
  })

  it('requires student cohort, validates catalogue membership and reuses catalogue reads', async () => {
    const catalogue = await fixture('catalogue.html'), plan = await fixture('informatikk.html')
    const fetchText = vi.fn(async url => url.endsWith('/oppbygging/') ? plan : catalogue)
    const query = { program: 'informatikk-programmering', sourceUrl }
    const cohorts = await uioPrograms('uio', 'program-cohorts', query, { fetchText })
    expect(cohorts.results[0].requiresStudentCohort).toBe(true)
    expect(cohorts.completeness).toMatchObject({ returned: 1, publishedCohorts: 0 })
    await expect(uioPrograms('uio', 'program-plan', { ...query, cohort: '2026' }, { fetchText })).rejects.toMatchObject({ status: 'invalid-selection' })
    const result = await uioPrograms('uio', 'program-plan', { ...query, cohort: '2026', cohortFromStudent: 'true' }, { fetchText })
    expect(result.program).toMatchObject({ code: 'informatikk-programmering', cohort: '2026' })
    expect(fetchText).toHaveBeenCalledTimes(2)
  })

  it('does not infer electives or duplicate cell credits from multiple links alone', async () => {
    const selected = parseUioCatalogue(await fixture('catalogue.html'))[0]
    const html = (await fixture('informatikk.html')).replace(/<\/a>\s*\/\s*<a href="\/studier\/emner\/matnat\/ifi\/IN2100/, '</a> og <a href="/studier/emner/matnat/ifi/IN2100')
    const plan = parseUioPlan(html, { program: selected.code, cohort: '2026', cohortFromStudent: 'true' }, selected)
    expect(plan.models[0].periods.find(period => period.studySemester === 4).courses.slice(1)).toMatchObject([
      { code: 'IN2080', credits: null, choice: 'O' },
      { code: 'IN2100', credits: null, choice: 'O' },
    ])
  })

  it('rejects substituted hosts, programme paths and unsupported tables', async () => {
    expect(() => uioProgramUrl('https://evil.test/studier/program/x/')).toThrow()
    expect(() => uioProgramUrl('https://www.uio.no/studier/program/x/?token=secret')).toThrow()
    const selected = parseUioCatalogue(await fixture('catalogue.html'))[0]
    expect(() => parseUioPlan('<h1>Changed</h1>', { program: selected.code, cohort: '2026', cohortFromStudent: 'true' }, selected)).toThrow(/semestertabell/)
  })
})
