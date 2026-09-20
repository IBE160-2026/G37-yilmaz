import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { deriveCapacity } from '../../src/capacity.js'
import { selectTasksForMinutes, suggestionReason } from '../../src/tasks.js'
import { providerRequest } from '../../server/providers/index.js'
import { semesterTableUrl } from '../../server/providers/semester-table-programs.js'
import { institutions } from '../../src/institutions.js'

const task = (id, patch = {}) => ({ id, title: id, course: '', completed: false, estimatedMinutes: 30, deadlineLocal: '2026-09-14T15:00', ...patch })
const session = { id: 'legacy-slot', dateLocal: '2026-09-14', startTime: '10:00', endTime: '11:00' }
const now = new Date('2026-09-14T09:00:00+02:00')

describe('connected repairs across legacy capacity and next actions', () => {
  it('never allocates blocked work ahead of its prerequisite in an older unassigned session', () => {
    const tasks = [task('later-step', { dependencyIds: ['first'], deadlineLocal: '2026-09-14T12:00' }), task('first')]
    const before = structuredClone({ tasks, session })
    const result = deriveCapacity(tasks, [session], now)
    expect(result.tasks[0]).toMatchObject({ allocatedMinutes: 0, missingMinutes: 30 })
    expect(result.tasks[0].reasons.join(' ')).toContain('Venter på «first»')
    expect(result.tasks[1].allocations[0].startLocal).toBe('2026-09-14T10:00')
    expect({ tasks, session }).toEqual(before)
    expect(deriveCapacity([tasks[0], { ...tasks[1], completed: true }], [session], now).tasks[0].allocatedMinutes).toBe(30)
  })
  it('retains missing prerequisites and external waiting as capacity blockers', () => {
    const tasks = [task('missing', { dependencyIds: ['gone'], missingDependencyIds: ['gone'] }), task('waiting', { waitingReason: 'Venter på tilbakemelding' })]
    const result = deriveCapacity(tasks, [session], now)
    expect(result.totalAllocatedMinutes).toBe(0)
    expect(result.tasks[0].reasons.join(' ')).toContain('slettet eller mangler')
    expect(result.tasks[1].reasons.join(' ')).toContain('Venter på tilbakemelding')
    const unknown = deriveCapacity([task('unknown', { remainingMinutes: null })], [session], now)
    expect(unknown.unknownTaskCount).toBe(1)
    expect(unknown.tasks[0].reasons.join(' ')).toContain('ukjent')
  })
  it('explains a fitting step without claiming that the whole task fits, or that an unblocking task has the closest deadline', () => {
    const tasks = [task('urgent', { deadlineLocal: '2026-09-14T12:00', dependencyIds: ['first'] }), task('first'), task('earlier', { deadlineLocal: '2026-09-14T11:00' })]
    const candidates = selectTasksForMinutes(tasks, 30)
    expect(candidates.map(item => item.id)).toEqual(['earlier', 'first'])
    expect(suggestionReason(candidates[1], 30, now, 1, tasks)).toContain('«urgent», med registrert frist 2026-09-14 kl. 12:00')
    const step = task('step', { estimatedMinutes: 240, nextStep: { description: 'Les kravene', estimatedMinutes: 20 } })
    expect(suggestionReason(step, 30, now)).toContain('Passer innen 30 minutter')
    expect(suggestionReason(step, 30, now)).toContain('Hele oppgaven er ikke ferdig')
  })
})

describe('new program families are reachable through the real provider boundary', () => {
  it.each([
    ['hivolda', 'ANIBV', 'volda-animation-2026.html', 'https://www.hivolda.no/studieplaner/2026/ANIBV/Haust'],
    ['noroff', 'BCYSE', 'noroff-cyber-2026.html', 'https://studiekatalog.edutorium.no/nuc/en/programme/BCYSE/2026-autumn'],
  ])('routes %s and validates its exact public identity', async (institution, program, filename, sourceUrl) => {
    const html = readFileSync(new URL(`../fixtures/public-programs/${filename}`, import.meta.url), 'utf8')
    const fetchText = async (_url, _depth, guard) => { guard(new URL(sourceUrl)); return html }
    const result = await providerRequest(institution, 'program-plan', { program, cohort: '2026', sourceUrl }, { fetchText })
    expect(result.status).toBe('ok')
    expect(result.models[0].periods).toHaveLength(6)
    expect(result.program.code).toBe(program)
    const invalid = await providerRequest(institution, 'program-plan', { program, cohort: '2025', sourceUrl }, { fetchText })
    expect(invalid.status).toBe('invalid-selection')
  })
  it('allows only the observed Volda landing redirect and keeps student clarification separate from direct import evidence', () => {
    expect(semesterTableUrl('https://www.hivolda.no/students%C3%B8rvis/studieinnhald/studieplanar', 'hivolda').protocol).toBe('https:')
    expect(() => semesterTableUrl('https://www.hivolda.no/students%C3%B8rvis/private', 'hivolda')).toThrow()
    expect(semesterTableUrl('https://studiekatalog.edutorium.no/nuc/en/programme/BCYSE/2026-autumn#', 'noroff').href).toBe('https://studiekatalog.edutorium.no/nuc/en/programme/BCYSE/2026-autumn')
    const uib = institutions.find(row => row.id === 'uib')
    expect(uib.datatypes.cohort.status).toBe('Ikke implementert')
    expect(uib.datatypes.calendarSemester.status).toBe('Ikke implementert')
    expect(uib.datatypes.programs.status).toBe('Ekte import verifisert')
  })
})
