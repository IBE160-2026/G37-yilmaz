import { describe, it, expect } from 'vitest'
import { closeWork } from '../../src/work-log.js'
import { personalEstimate } from '../../src/personal-estimates.js'

function history(groups) {
  let state = { schemaVersion: 1, tasks: [], workLogs: [] }
  for (const [group, count, minutes, taskType = 'reading'] of groups) for (let i = 0; i < count; i++) {
    const id = `${group}-${i}`
    state.tasks.push({ id, title: id, course: group, courseId: group, taskType, deadlineLocal: '', estimatedMinutes: null, remainingMinutes: null, completed: false })
    const result = closeWork(state, { taskId: id, operationId: `work-${id}`, outcome: 'done', actualMinutes: minutes, historyComplete: true }, { now: new Date('2026-09-19T08:00:00Z') })
    expect(result.ok).toBe(true)
    state = result.state
  }
  return state
}

describe('R10 personal estimate course populations', () => {
  it.each(['task', 'session'])('prefers five same-type/same-course %s samples over other courses and types', kind => {
    const state = history([['A', 5, 20], ['B', 5, 100], ['C', 5, 200, 'writing']]), raw = JSON.stringify(state)
    expect(personalEstimate(state, { courseId: 'A', course: 'B', taskType: 'reading' }, { kind })).toMatchObject({ available: true, minutes: 20, count: 5, scope: 'samme oppgavetype og emne', range: [20, 20] })
    expect(personalEstimate(state, { courseId: 'B', taskType: 'reading' }, { kind })).toMatchObject({ minutes: 100, count: 5, scope: 'samme oppgavetype og emne' })
    expect(JSON.stringify(state)).toBe(raw)
  })
  it('falls back below five matching-course samples, then switches at the fifth', () => {
    const state = history([['A', 4, 20], ['B', 5, 100]])
    expect(personalEstimate(state, { courseId: 'A', taskType: 'reading' })).toMatchObject({ minutes: 100, count: 9, scope: 'samme oppgavetype' })
    const atFive = history([['A', 5, 20], ['B', 5, 100]])
    expect(personalEstimate(atFive, { courseId: 'A', taskType: 'reading' })).toMatchObject({ minutes: 20, count: 5, scope: 'samme oppgavetype og emne' })
  })
  it('uses legacy course text when no course ID exists and preserves broad fallback', () => {
    const state = history([['A', 5, 20], ['B', 5, 100]])
    expect(personalEstimate(state, { course: 'A', taskType: 'reading' })).toMatchObject({ minutes: 20, count: 5, scope: 'samme oppgavetype og emne' })
    expect(personalEstimate(state, { courseId: 'new', taskType: 'new-type' })).toMatchObject({ minutes: 60, count: 10, scope: 'hele den lokale historikken din' })
    expect(personalEstimate({ ...state, personalization: { enabled: false } }, { courseId: 'A', taskType: 'reading' }).available).toBe(false)
  })
})
