import { describe, expect, it } from 'vitest'
import { exactTeachingObject, isProgrammeAdditionInScope, programmeAdditionScope, selectedAlternative, suggestedCommonSeries, teachingStatusLabel, validateProgrammeSelection } from '../../src/program-import-model.js'
import { semanticRefreshNoop } from '../../src/subjects-view.js'
import { calendarEntries } from '../../src/calendar-model.js'

const period = { alternativeGroups: [{
  id: 'programming',
  label: 'Programmeringsalternativ',
  options: [
    { id: 'single', label: 'IBE160', courseIds: ['ibe160'] },
    { id: 'pair', label: 'IBE102 og IBE152', courseIds: ['ibe102', 'ibe152'] },
  ],
}] }
const course = id => ({ id })

describe('programme alternative selection', () => {
  it('requires exactly one complete source alternative', () => {
    expect(() => validateProgrammeSelection(period, [])).toThrow(/nøyaktig ett/)
    expect(() => validateProgrammeSelection(period, [course('ibe102')])).toThrow(/hele alternativet/)
    expect(() => validateProgrammeSelection(period, [course('ibe160'), course('ibe102'), course('ibe152')])).toThrow(/nøyaktig ett/)
    expect(validateProgrammeSelection(period, [course('ibe160')])).toBe(true)
    expect(validateProgrammeSelection(period, [course('ibe102'), course('ibe152')])).toBe(true)
  })

  it('reports the selected branch without using credit totals', () => {
    const result = selectedAlternative(period, ['ibe102', 'ibe152'])
    expect(result[0].complete.map(option => option.id)).toEqual(['pair'])
  })

  it('accepts a complete branch that is also a partial prefix of a larger source branch', () => {
    const overlapping = { alternativeGroups: [{ id: 'overlap', label: 'Overlapp', options: [
      { id: 'x', label: 'X', courseIds: ['x'] },
      { id: 'xy', label: 'X og Y', courseIds: ['x', 'y'] },
    ] }] }
    expect(validateProgrammeSelection(overlapping, [course('x')])).toBe(true)
    expect(validateProgrammeSelection(overlapping, [course('x'), course('y')])).toBe(true)
  })

  it('keeps unavailable teaching distinct from ready teaching', () => {
    expect(teachingStatusLabel('ready')).toMatch(/klar/)
    expect(teachingStatusLabel('empty')).toMatch(/Ingen/)
    expect(teachingStatusLabel('failed')).toMatch(/ikke hentes/)
    expect(teachingStatusLabel('access-required')).toMatch(/tilgang/)
  })
})

describe('streamlined teaching import invariants', () => {
  it('auto-selects only one exact course-code match', () => {
    const exact = { code: 'IBE160', label: 'Programmering', sourceObjectId: '1' }
    expect(exactTeachingObject([exact, { code: 'IBE100', label: 'IBE160 intro' }], 'ibe160')).toBe(exact)
    expect(exactTeachingObject([{ ...exact }, { ...exact, sourceObjectId: '2' }], 'IBE160')).toBeNull()
    expect(exactTeachingObject([{ code: '', label: 'IBE160' }], 'IBE160')).toBeNull()
  })

  it('suggests common series but never ambiguous or numbered alternatives', () => {
    const events = ['Forelesning', 'Forelesning', 'Parallell 2', 'Gruppe 4', 'Seminar 1', 'Labaktivitet 3'].map(group => ({ group }))
    events.push({ group: 'Øving', groupMissing: true })
    expect(suggestedCommonSeries(events)).toEqual([])
    expect(suggestedCommonSeries(events, { commonGroups: ['Forelesning', 'Gruppe 4'] })).toEqual(['Forelesning'])
    expect(suggestedCommonSeries([{ group: 'Felles', commonSeries: true }])).toEqual(['Felles'])
  })

  it('scopes student-added courses to the selected model and period as well as the calendar term', () => {
    const scope=programmeAdditionScope('model-a','period-1',{year:2026,semester:'autumn'})
    expect(isProgrammeAdditionInScope({...scope,code:'IBE160'},scope)).toBe(true)
    expect(isProgrammeAdditionInScope({...scope,addedModelId:'model-b'},scope)).toBe(false)
    expect(isProgrammeAdditionInScope({...scope,addedPeriodId:'period-2'},scope)).toBe(false)
  })

  it('uses the no-change message only for a reviewed semantic no-op', () => {
    const source = { id:'source',courseId:'course',kind:'url',url:'https://example.test/a.ics',identityMode:'source-uid',coverage:{kind:'unknown'},syncWarnings:['Kontroller kilden.'],groups: ['Forelesning'], excludedKeys: ['x'], allGroups: ['Forelesning'], pendingGroups: [] }
    const zero = { added: 0, updated: 0, cancelled: 0, conflicts: 0, excluded: 0, reselected: 0 }
    expect(semanticRefreshNoop(source, structuredClone(source), zero)).toBe(true)
    expect(semanticRefreshNoop(source, { ...source, groups: [] }, zero)).toBe(false)
    expect(semanticRefreshNoop(source, { ...source, pendingGroups: ['Gruppe 1'] }, zero)).toBe(false)
    expect(semanticRefreshNoop(source, { ...source, allGroups: ['Forelesning', 'Gruppe 1'] }, zero)).toBe(false)
    expect(semanticRefreshNoop(source, { ...source, url:'https://example.test/b.ics' }, zero)).toBe(false)
    expect(semanticRefreshNoop(source, { ...source, coverage:{kind:'complete'} }, zero)).toBe(false)
    expect(semanticRefreshNoop(source, { ...source, syncWarnings:['Ny advarsel'] }, zero)).toBe(false)
    expect(semanticRefreshNoop({...source,lastUpdated:'2026-09-25T08:00:00Z'}, {...source,lastUpdated:'2026-09-26T08:00:00Z'}, zero)).toBe(true)
    expect(semanticRefreshNoop(source, structuredClone(source), { ...zero, excluded: 1 })).toBe(false)
  })

  it('carries stable course codes onto all course-bound calendar entries', () => {
    const result = calendarEntries({
      planner: { courses: [{ id: 'c1', code: 'IBE160' }], events: [{ id: 'e1', courseId: 'c1', title: 'Forelesning', start: '2026-09-08T08:00:00Z', end: '2026-09-08T10:00:00Z' }] },
      tasks: [{ id: 't1', courseId: 'c1', title: 'Oppgave', deadlineLocal: '2026-09-09T12:00', estimatedMinutes: 60, remainingMinutes: 60 }],
      sessions: [{ id: 's1', taskId: 't1', dateLocal: '2026-09-08', startTime: '12:00', endTime: '12:30' }],
    })
    expect(result.filter(entry => ['teaching', 'deadline', 'session'].includes(entry.kind)).map(entry => entry.courseCode)).toEqual(['IBE160', 'IBE160', 'IBE160'])
  })
})
