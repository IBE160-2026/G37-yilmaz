import { describe, expect, it, vi } from 'vitest'
import { ahoProgramUrl, parseAhoCatalogue, parseAhoProgrammePage, parseAhoPlanArchive, parseAhoPlan, ahoPrograms } from '../../server/providers/aho-programs.js'

const catalogue = `
<main id="vrtx-main-content">
  <h2>Femårig master</h2>
  <h3><a href="/studier/program/master-i-arkitektur/">Master i arkitektur</a></h3>
  <h3><a href="/studier/program/master-i-design/">Master i design</a></h3>
  <h2>Two-year master</h2>
  <h3><a href="/english/studies/programmes/master-of-design/">Master of Design</a></h3>
</main>`

const programme = `
<main>
  <div class="plan-links">
    <a class="current-plan button" href="/studier/program/master-i-design/studieplaner/2026.html">Studieplan 2026-2031</a>
    <a class="all-plans" href="/studier/program/master-i-design/studieplaner/">Se eldre studieplaner</a>
  </div>
</main>`

const archive = `
<main>
  <a class="vrtx-title vrtx-title-link" href="/studier/program/master-i-design/studieplaner/2026.html">Studieplan for Master i design (2026–2031)</a>
  <a class="vrtx-title vrtx-title-link" href="/studier/program/master-i-design/studieplaner/2025.html">Studieplan for Master i design (2025–2030)</a>
</main>`

const plan = `
<main>
  <h1>Studieplan for Master i design (2026–2031)</h1>
  <div class="facts-wrapper"><div class="dg"><dt>Studiested:</dt><dd>AHO OSLO</dd></div></div>
  <div class="vrtx-fs-study-model">
    <div class="term">
      <h3>Høst 2026</h3>
      <div class="combination"><h4>Obligatoriske emner 1. år</h4><ul>
        <li class="mandatory"><a class="course-link" href="https://www.aho.no/studier/emner/2026/host/70-111.html"><span class="course-code">70 111</span><span class="course-name">Introduksjon til design</span><span class="course-study-points"><span>24</span><span>stp</span></span></a></li>
      </ul></div>
    </div>
    <div class="term">
      <h3>Vår 2027</h3>
      <div class="combination"><h4>Valgbare studioemner</h4><p>Velg ett studio</p><ul>
        <li class="mandatory"><a class="course-link" href="https://www.aho.no/studier/emner/2026/var/valg2.html"><span class="course-code">VALG2</span><span class="course-name">Valgemne GK2 Design</span><span class="course-study-points"><span>6</span><span>stp</span></span></a></li>
        <li><a class="course-link" href="https://www.aho.no/english/studies/courses/2026/spring/70-512.html"><span class="course-code">70 512</span><span class="course-name">Interaction Design</span><span class="course-study-points"><span>24</span><span>stp</span></span></a></li>
      </ul></div>
    </div>
  </div>
</main>`

describe('AHO published study plans', () => {
  it('lists every unique degree link from the official programme page', () => {
    expect(parseAhoCatalogue(catalogue)).toEqual([
      expect.objectContaining({ code: 'no:master-i-arkitektur', name: 'Master i arkitektur' }),
      expect.objectContaining({ code: 'no:master-i-design', name: 'Master i design' }),
      expect.objectContaining({ code: 'en:master-of-design', name: 'Master of Design' })
    ])
  })

  it('separates the current edition from the historical archive', () => {
    const base = 'https://www.aho.no/studier/program/master-i-design/'
    const page = parseAhoProgrammePage(programme, base)
    const editions = parseAhoPlanArchive(archive, page.archiveUrl, page.current.sourceUrl)
    expect(page.current).toMatchObject({ cohort: '2026', sourceUrl: `${base}studieplaner/2026.html` })
    expect(editions).toEqual([
      expect.objectContaining({ cohort: '2026' }),
      expect.objectContaining({ cohort: '2025', historical: true })
    ])
  })

  it('keeps admission edition, study semester and calendar semester separate', () => {
    const parsed = parseAhoPlan(plan, 'https://www.aho.no/studier/program/master-i-design/studieplaner/2026.html', 'no:master-i-design', '2026')
    expect(parsed.program).toMatchObject({ cohort: '2026', sourceEdition: '2026–2031', campuses: ['AHO OSLO'] })
    expect(parsed.models[0].periods).toEqual([
      expect.objectContaining({ studySemester: 1, year: 2026, semester: 'autumn', courses: [expect.objectContaining({ code: '70 111', credits: 24, choice: 'O' })] }),
      expect.objectContaining({ studySemester: 2, year: 2027, semester: 'spring', courses: [expect.objectContaining({ code: 'VALG2', choice: 'V' }), expect.objectContaining({ code: '70 512', choice: 'V' })] })
    ])
    expect(parsed.completeness).toMatchObject({ complete: true, returned: 3 })
  })

  it('runs catalogue, editions and current plan through the provider contract', async () => {
    const pages = new Map([
      ['https://www.aho.no/studier/program/', catalogue],
      ['https://www.aho.no/studier/program/master-i-design/', programme],
      ['https://www.aho.no/studier/program/master-i-design/studieplaner/', archive],
      ['https://www.aho.no/studier/program/master-i-design/studieplaner/2026.html', plan]
    ])
    const fetchText = vi.fn(async url => pages.get(url) ?? (() => { throw new Error(`unexpected ${url}`) })())
    const listed = await ahoPrograms('aho', 'programs', { q: 'design' }, { fetchText })
    const selected = listed.results.find(row => row.code === 'no:master-i-design')
    const cohorts = await ahoPrograms('aho', 'program-cohorts', { program: selected.code, sourceUrl: selected.sourceUrl }, { fetchText })
    const result = await ahoPrograms('aho', 'program-plan', { program: selected.code, cohort: '2026', sourceUrl: cohorts.results[0].sourceUrl }, { fetchText })
    expect(result.models[0].periods[1].courses).toHaveLength(2)
    expect(cohorts.results.some(row => row.historical)).toBe(true)
    await expect(ahoPrograms('aho', 'program-plan', { program: selected.code, cohort: '2025', sourceUrl: cohorts.results[1].sourceUrl }, { fetchText })).rejects.toThrow(/historisk/)
  })

  it('rejects substituted hosts, mismatched programmes and ambiguous source rows', () => {
    expect(() => ahoProgramUrl('https://evil.example/studier/program/master-i-design/')).toThrow(/utenfor/)
    expect(() => parseAhoPlan(plan, 'https://www.aho.no/studier/program/master-i-design/studieplaner/2026.html', 'no:master-i-arkitektur', '2026')).toThrow(/tilhører ikke/)
    expect(() => parseAhoPlan(plan.replace('Høst 2026', 'Semester 2026'), 'https://www.aho.no/studier/program/master-i-design/studieplaner/2026.html', 'no:master-i-design', '2026')).toThrow(/kalendersemester/)
  })
})
