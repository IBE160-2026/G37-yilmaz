import { describe, expect, it } from 'vitest'
import { parseWebflowPlan, webflowPrograms, webflowProgramUrl } from '../../server/providers/webflow-programs.js'

const query = institution => ({ sourceUrl: institution === 'steiner' ? 'https://www.steinerhoyskolen.no/studier/testprogram' : 'https://www.hfdk.no/for-studenter/studieplan-og-emner', program: institution === 'steiner' ? 'testprogram' : 'studieplan-og-emner', cohort: '2026', cohortFromStudent: 'true' })
const row = (code, name, points = '10', hidden = false) => `<div class="emne_filter${hidden ? ' w-condition-invisible' : ''}"><div class="emne_code">${code}</div><div class="emne_name">${name}</div><div class="course_points"><div>${points}</div><div>p</div></div></div>`
const steiner = `<div class="study_introduction"><h1>Testprogram</h1></div><div class="studieaar"><h4 lang="No">1. studieår</h4><h4 lang="En">Year 1</h4><div table="fall">${row('EX100', 'Skjult kopi', '20', true)}${row('EX200', 'Høstemne')}</div><div table="spring">${row('EX100', 'Skjult kopi', '20', true)}</div><div table="both">${row('EX100', 'Årsemne', '20')}${row('', 'Valgbar fordypning', '15')}${row('', 'Praksis første år', '')}</div></div>`
const hfdk = `<h1>Studieplan og emner</h1><p>Høyskolen vil med studiet bachelor i testfag gi studentene en faglig innføring.</p><div><h2>Studieløp</h2><div class="div-block-130"><strong>1. år</strong><div class="text-block-84 studiel-p">Innføring del 1<br>Fordypning del 1</div><div class="text-block-85 studiel-p">20<br>40</div></div></div>`

describe('public Webflow programme structures', () => {
  it('reads semester visibility rather than disabled duplicate HTML, preserving full-year credits', () => {
    const result = parseWebflowPlan(steiner, 'steiner', query('steiner')), periods = result.models[0].periods
    expect(periods.map(p => [p.studySemester, p.courses.map(c => c.name)])).toEqual([[1, ['Høstemne', 'Årsemne', 'Praksis første år']], [2, ['Årsemne', 'Praksis første år']]])
    expect(periods[0].courses.find(c => c.code === 'EX100').credits).toBe(20)
    expect(periods[1].courses.find(c => c.code === 'EX100').credits).toBe(20)
    expect(periods.every(p => p.year === null && p.semester === null && p.courses.every(c => c.choice === ''))).toBe(true)
    expect(periods[0].courses.at(-1).credits).toBeNull()
    expect(periods[0].requirements.join(' ')).toContain('Valgbar fordypning')
    expect(result.program.cohortFromStudent).toBe(true)
    expect(result.completeness.complete).toBe(false)
  })
  it('requires student clarification for annual HFDK subjects without inventing course codes', () => {
    const result = parseWebflowPlan(hfdk, 'hfdk', query('hfdk')), periods = result.models[0].periods
    expect(result.program.name).toBe('bachelor i testfag')
    expect(periods).toHaveLength(2)
    expect(periods[0].courses.map(c => [c.name, c.credits, c.code, c.requiresSemesterChoice])).toEqual([['Innføring del 1', 20, '', true], ['Fordypning del 1', 40, '', true]])
    expect(periods[0].courses.map(c => c.sourceRecordId)).toEqual(periods[1].courses.map(c => c.sourceRecordId))
    expect(periods.every(p => !p.year && !p.semester && p.courses.every(c => c.choice === ''))).toBe(true)
  })
  it('rejects mismatched annual credit columns rather than assigning the wrong credits', () => {
    expect(() => parseWebflowPlan(hfdk.replace('20<br>40', '20'), 'hfdk', query('hfdk'))).toThrow('stemmer ikke')
  })
  it('requires explicit cohort and matching program identity', () => {
    expect(() => parseWebflowPlan(steiner, 'steiner', { ...query('steiner'), cohortFromStudent: undefined })).toThrow('opptakskull')
    expect(() => parseWebflowPlan(steiner, 'steiner', { ...query('steiner'), program: 'another' })).toThrow('stemmer ikke')
  })
  it('does not turn a marketing-only page into a usable plan', () => {
    expect(() => parseWebflowPlan('<h1>Testprogram</h1><p>Treårig bachelor.</p>', 'steiner', query('steiner'))).toThrow('ingen støttet emneoppbygging')
  })
  it('collects published study links and pagination without demo programmes', async () => {
    const calls = []
    const fetchText = async url => { calls.push(url); return url.includes('page=1') ? '<a href="/studier/second">Andre program</a>' : '<a href="/studier/testprogram">Testprogram</a><a href="/studier/testprogram">Testprogram</a><a href="https://other.example/studier/wrong">Utenfor</a><a rel="next" href="?page=1">Neste</a>' }
    const result = await webflowPrograms('steiner', 'programs', {}, { fetchText })
    expect(result.results.map(item => item.code)).toEqual(['testprogram', 'second'])
    expect(calls).toHaveLength(2)
    expect(result.completeness).toMatchObject({ complete: true, pages: 2, returned: 2 })
  })
  it('rejects off-source or credential-bearing URLs before requesting a document', async () => {
    for (const url of ['http://www.steinerhoyskolen.no/studier/testprogram', 'https://user:pass@www.steinerhoyskolen.no/studier/testprogram', 'https://www.steinerhoyskolen.no/admin', 'https://other.example/studier/testprogram']) expect(() => webflowProgramUrl(url, 'steiner')).toThrow()
    let calls = 0
    await expect(webflowPrograms('hfdk', 'program-plan', { ...query('hfdk'), sourceUrl: 'http://127.0.0.1/' }, { fetchText: async () => { calls++ } })).rejects.toThrow()
    expect(calls).toBe(0)
  })
})
