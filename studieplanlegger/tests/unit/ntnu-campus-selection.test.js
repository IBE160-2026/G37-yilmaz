import { describe, expect, it } from 'vitest'
import { searchNtnu } from '../../server/providers/ntnu.js'
import { parseNtnuPage } from '../../server/import-api.js'
import { ntnuCampusQuery as query, ntnuCampusSearch, ntnuCampusHtml } from '../helpers/ntnu-campus-search.js'

describe('NTNU published campus selection from search to details', () => {
  it('offers each published campus separately and passes the exact choice to details', async () => {
    const search = await searchNtnu(query, async () => ntnuCampusSearch)
    expect(search.results.map(item => item.campus)).toEqual(['Gjøvik', 'Trondheim'])
    for (const selected of search.results) {
      const { course } = parseNtnuPage(ntnuCampusHtml, selected)
      expect(course).toMatchObject({ code: query.code, year: 2026, semester: 'autumn', campus: selected.campus, sourceUrl: selected.sourceUrl })
      expect(course.notes).toContain('Gjøvik, Trondheim')
      expect(course.notes).toContain(`Valgt publisert campus: ${selected.campus}`)
    }
  })

  it('filters individual campus choices without accepting composite or unpublished choices', async () => {
    const filtered = await searchNtnu({ ...query, campus: 'Trondheim' }, async () => ntnuCampusSearch)
    expect(filtered.results.map(item => item.campus)).toEqual(['Trondheim'])
    expect((await searchNtnu({ ...query, campus: 'Oslo' }, async () => ntnuCampusSearch)).results).toEqual([])
    for (const campus of ['Gjøvik, Trondheim', 'Oslo']) expect(() => parseNtnuPage(ntnuCampusHtml, { ...query, campus })).toThrow(/finnes ikke blant studiestedene/)
    expect(parseNtnuPage(ntnuCampusHtml, query).course.campus).toBe('')
  })
})
