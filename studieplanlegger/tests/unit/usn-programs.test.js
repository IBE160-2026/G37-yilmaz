import { describe, it, expect, vi } from 'vitest'
import { parseUsnCatalogue, parseUsnCohorts, parseUsnPlan, usnPrograms } from '../../server/providers/usn-programs.js'
import { fetchPublicText } from '../../server/import-api.js'

// Synthetic response contracts. Actual external acceptance is tracked separately.
const ref = { id: 'TEST_2026_HØST', code: 'TEST', cohort: '2026', intake: 'autumn' }
const meta = { aarstall: '2026', semester: 'HØST', harinfo: '1', studieprogramnavn: 'Testprogram', studieprogramkode: 'TEST', appliesto: 'Kull 2026 HØST', studiemodell: '', updateTime: '09.09.2026' }
const row = { studieplanid: ref.id, studieplaninfodata: [{ language: 'B', metadatainfo: meta }] }
const payload = { studieplanid: ref.id, studieplandata: [{ language: 'B', metadata: meta }] }
const subject = { emnneplanid: 'EMNE100_1_2027_VÅR', emnenavn: 'Testemne', publisertEmneplan: false, studiepoeng: '7,5', terminnummer: '2', undtermin: '2027_VÅR', valgstatus: 'Obligatorisk', varighet: '1' }
const subjects = [{ language: 'B', studiemodellemne: [subject] }]
const page = 'https://www.usn.no/studier/studie-og-emneplaner/'
const sourceUrl = `${page}#/plan/TEST_2026_H%C3%98ST_B`

describe('USN public programme source contracts', () => {
  it('deduplicates full published catalogue versions, distinguishes both intakes, and excludes unpublished records', () => {
    const spring = { studieplanid: 'TEST_2026_VÅR', studieplaninfodata: [{ language: 'B', metadatainfo: { ...meta, semester: 'VÅR' } }] }
    const unpublished = { ...row, studieplaninfodata: [{ language: 'B', metadatainfo: { ...meta, harinfo: '0' } }] }
    const results = parseUsnCatalogue({ stedkode: [{ studieplaninfo: [row, row, spring, unpublished] }] })
    expect(results).toHaveLength(2)
    expect(new Set(results.map(item => item.intake))).toEqual(new Set(['spring', 'autumn']))
    expect(parseUsnCohorts([row], 'OTHER')).toEqual([])
  })
  it('rejects mismatched returned cohort rather than importing a fallback', () => {
    expect(() => parseUsnPlan({ ...payload, studieplanid: 'TEST_2025_HØST' }, subjects, ref)).toThrow('annen programplan')
    expect(() => parseUsnCatalogue({ stedkode: [{ studieplaninfo: [{ ...row, studieplanid: 'TEST_2025_HØST' }] }] })).toThrow('motstridende')
  })
  it('preserves actual study semester/calendar period and explicitly unpublished course details', () => {
    const period = parseUsnPlan(payload, subjects, ref).models[0].periods[0]
    expect(period).toMatchObject({ studySemester: 2, year: 2027, semester: 'spring' })
    expect(period.courses[0]).toMatchObject({ code: 'EMNE100', credits: 7.5, choice: 'O', sourceRecordId: subject.emnneplanid, sourceUrl })
    expect(period.courses[0].notes).toContain('ikke publisert')
  })
  it('does not guess calendar periods or branch choices', () => {
    const uncertain = [{ language: 'B', studiemodellemne: [{ ...subject, undtermin: '' }] }]
    expect(parseUsnPlan(payload, uncertain, ref).models[0].periods[0]).toMatchObject({ year: null, semester: null })
    const table = name => `<table><thead><tr><th><div class="header">${name}</div></th></tr></thead><tbody><tr><td><a class="studiemodell" href="${subject.emnneplanid}">Emne</a></td></tr></tbody></table>`
    const branched = { ...payload, studieplandata: [{ language: 'B', metadata: { ...meta, studiemodell: table('Retning A') + table('Retning B') } }] }
    const period = parseUsnPlan(branched, subjects, ref).models[0].periods[0]
    expect(period.courses[0].choice).toBe('V')
    expect(period.requirements[0]).toContain('Retning A')
    expect(period.requirements[0]).toContain('Retning B')
  })
  it('uses only the published period for the fixed read-only catalogue POST and caches it', async () => {
    const config = { year: '2026', semester: 'HØST', minYear: '2014', maxYear: '2026' }
    const fetchText = vi.fn(async url => url === page ? `<usn-study searchoptions='${JSON.stringify(config)}'></usn-study>` : JSON.stringify({ stedkode: [{ studieplaninfo: [row] }] }))
    expect((await usnPrograms('usn', 'programs', {}, { fetchText })).results).toHaveLength(1)
    await usnPrograms('usn', 'programs', {}, { fetchText })
    expect(fetchText).toHaveBeenCalledTimes(2)
    expect(fetchText.mock.calls[1][3]).toEqual({ usnCatalogue: { year: '2026', semester: 'HØST' } })
  })
  it('rejects external plan URLs and different requested cohorts before fetching', async () => {
    const fetchText = vi.fn()
    await expect(usnPrograms('usn', 'program-plan', { sourceUrl: 'https://localhost/' }, { fetchText })).rejects.toThrow()
    await expect(usnPrograms('usn', 'program-plan', { sourceUrl, cohort: '2025' }, { fetchText })).rejects.toThrow('stemmer ikke')
    expect(fetchText).not.toHaveBeenCalled()
  })
  it('rejects arbitrary POST hosts and private body fields before DNS/network access', async () => {
    await expect(fetchPublicText('https://example.com/', 0, undefined, { usnCatalogue: { year: '2026', semester: 'HØST' } })).rejects.toThrow('Ugyldig offentlig')
    await expect(fetchPublicText('https://s293.usn.no/v2/studieplan//', 0, undefined, { usnCatalogue: { year: '2026', semester: 'HØST', student: 'private' } })).rejects.toThrow('Ugyldig offentlig')
    await expect(fetchPublicText('https://s293.usn.no/v2/studieplan//', 1, undefined, { usnCatalogue: { year: '2026', semester: 'HØST' } })).rejects.toThrow('Ugyldig offentlig')
  })
})
