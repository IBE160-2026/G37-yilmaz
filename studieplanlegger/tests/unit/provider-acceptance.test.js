import { describe, it, expect, vi } from 'vitest'
import { searchTimeEdit, nmbuDetails } from '../../server/providers/timeedit.js'
import { searchNtnu } from '../../server/providers/ntnu.js'
import { createSiktAdapter, SCHEMA_PROBE, SIKT_READ_SCOPE } from '../../server/providers/sikt.js'
import { mergeImport, sourceSnapshot, teachingOverlap } from '../../src/planner.js'

const query = { q: 'MATH-INF100', code: 'MATH-INF100', semester: 'autumn', year: 2026, campus: '' }
describe('provider acceptance regressions', () => {
  it('retains the complete published hyphenated TimeEdit course code', async () => {
    const response = await searchTimeEdit('nmbu', query, async () => '<div class="searchObject" data-id="123.5" data-name="MATH-INF100,2026 HØST"></div>')
    expect(response.results[0].code).toBe('MATH-INF100')
    expect(response.results[0].sourceObjectId).toBe('123.5')
  })
  it('does not invent an NMBU campus from an unverified search label', async () => {
    const response = await searchTimeEdit('nmbu', { ...query, campus: 'Ås' }, async () => '<div class="searchObject" data-id="123.5" data-name="MATH-INF100,2026 HØST"></div>')
    expect(response.results[0]).toMatchObject({ campus: '', campusVerified: false })
  })
  it('accepts hyphenated NMBU metadata and checks the academic year', async () => {
    const fetchText = vi.fn(async () => '<main><h1>MATH-INF100 Innføring</h1><input name="semester" value="2026-HØST-2027-VÅR"><div class="info-item"><dt>Studiepoeng</dt><dd>10</dd></div></main>')
    const result = await nmbuDetails(query, fetchText)
    expect(result.course).toMatchObject({ code: 'MATH-INF100', name: 'Innføring', credits: 10 })
    expect(fetchText).toHaveBeenCalledWith('https://www.nmbu.no/emne/math-inf100')
    expect((await nmbuDetails({ ...query, year: 2025 }, fetchText)).status).toBe('semester-unavailable')
  })
  it('does not declare an NTNU course nonexistent from an empty semester filter', async () => {
    const result = await searchNtnu({ ...query, q: 'TDT4110' }, async () => JSON.stringify({ courses: [], hasMoreResults: false }))
    expect(result.status).toBe('no-matching-results')
    expect(result.error).toContain('bekrefter ikke at emnet ikke finnes')
  })
  it('adopts a newly supported TRANSP source field on a legacy source baseline', () => {
    const course = { id: 'c', code: 'TEST', name: 'Test', university: 'Isolert', semester: 'autumn', year: 2026 }
    const source = { id: 's', courseId: 'c', kind: 'file', name: 'Test', groups: [], lastUpdated: '2026-09-08T06:00:00Z' }
    const current = { id: 'e', sourceId: 's', sourceKey: 'k', courseId: 'c', title: 'Informasjon', start: '2026-09-08T08:00:00Z', end: '2026-09-08T09:00:00Z', notes: 'Behold meg' }
    current.sourceBase = sourceSnapshot(current); delete current.sourceBase.transparent
    const remote = { ...current, transparent: true }
    const result = mergeImport({ courses: [course], events: [current], sources: [source] }, [remote], source)
    expect(result.planner.events[0]).toMatchObject({ id: 'e', transparent: true, notes: 'Behold meg' })
    expect(teachingOverlap(result.planner.events, new Date('2026-09-08T08:00:00Z'), 60).availableMinutes).toBe(60)
  })
})

describe('prepared Sikt read-only transport', () => {
  it('is disabled by default and never sends an unauthorised background request', async () => {
    const fetchImpl = vi.fn()
    expect((await createSiktAdapter({ env: {}, fetchImpl }).probeSchema()).status).toBe('access-required')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('requires a server-only token and refuses arbitrary endpoint configuration', async () => {
    const fetchImpl = vi.fn()
    expect((await createSiktAdapter({ env: { SIKT_ENABLED: 'true' }, fetchImpl }).probeSchema()).status).toBe('access-required')
    expect(createSiktAdapter({ env: { SIKT_ENVIRONMENT: 'https://example.test' }, fetchImpl }).status().status).toBe('configuration-error')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('only sends the fixed standard introspection query with the read contract', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { __schema: { queryType: { name: 'Query' }, types: [] } } })))
    const adapter = createSiktAdapter({ env: { SIKT_ENABLED: 'true', SIKT_ACCESS_TOKEN: 'ISOLATED_TEST_TOKEN' }, fetchImpl })
    const result = await adapter.probeSchema(), [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.fsweb.no/graphql')
    expect(options.redirect).toBe('error')
    expect(options.headers['Feature-Flags']).toBe('beta,experimental')
    expect(JSON.parse(options.body).query).toBe(SCHEMA_PROBE)
    expect(options.body).not.toMatch(/mutation|ISOLATED_TEST_TOKEN/)
    expect(result.scope).toBe(SIKT_READ_SCOPE)
    expect(JSON.stringify(result)).not.toContain('ISOLATED_TEST_TOKEN')
    expect((await adapter.search(query)).status).toBe('schema-verification-required')
  })
  it('reports authentication and schema gates without echoing credentials or remote errors', async () => {
    const env = { SIKT_ENABLED: 'true', SIKT_ACCESS_TOKEN: 'ISOLATED_SECRET' }
    const denied = await createSiktAdapter({ env, fetchImpl: async () => new Response('ISOLATED_SECRET', { status: 401 }) }).probeSchema()
    expect(denied.status).toBe('access-required'); expect(JSON.stringify(denied)).not.toContain('ISOLATED_SECRET')
    const invalid = await createSiktAdapter({ env, fetchImpl: async () => new Response(JSON.stringify({ errors: [{ message: 'ISOLATED_SECRET' }] })) }).probeSchema()
    expect(invalid.status).toBe('schema-verification-required'); expect(JSON.stringify(invalid)).not.toContain('ISOLATED_SECRET')
  })
})
