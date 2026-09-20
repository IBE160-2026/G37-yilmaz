import { describe, expect, it } from 'vitest'
import { deriveCapacity } from '../../src/capacity.js'

const date = '2026-09-07'
const local = minutes => `${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const session = (id, start, end) => Object.freeze({ id, dateLocal: date, startTime: local(start).slice(11), endTime: local(end).slice(11) })
const task = (id, deadline, remaining, patch = {}) => Object.freeze({
  id, title: `Oppgave ${id}`, course: 'IBE160', deadlineLocal: local(deadline),
  estimatedMinutes: remaining || 30, remainingMinutes: remaining, completed: false, ...patch,
})

describe('independent capacity invariants', () => {
  it('keeps every assigned minute inside a real session and deadline, never assigns it twice, and preserves input', () => {
    // Varied synthetic workloads exercise invariants rather than prescribing the
    // implementation's allocation order. The overlapping intervals are deliberate.
    for (let scenario = 0; scenario < 24; scenario++) {
      const now = new Date(`${date}T08:30:30`)
      const sessions = Object.freeze([
        session('past', 420, 480), session('ongoing', 480, 540),
        session('overlap', 510, 570), session('afternoon', 720, 810),
        session('nested', 735, 765), session('adjacent', 810, 840),
      ])
      const tasks = Object.freeze([
        task('overdue', 500, 20),
        ...Array.from({ length: 8 }, (_, index) => task(`t-${index}`,
          540 + ((index * 47 + scenario * 13) % 340),
          10 + ((index * 29 + scenario * 17) % 140),
          index === 3 ? { nextStep: Object.freeze({ description: 'Les starten', estimatedMinutes: 15 }) } : {})),
        task('done', 650, 200, { completed: true }),
        task('ready', 650, 100, { completed: true, requiresSubmission: true, submitted: false }),
        task('zero', 600, 0),
        task('legacy', 900, 35, { remainingMinutes: undefined }),
      ])
      const before = JSON.stringify({ tasks, sessions })
      const plan = deriveCapacity(tasks, sessions, now)
      expect(plan.tasks).toHaveLength(tasks.length)
      const usedMinutes = new Set()
      for (const entry of plan.tasks) {
        const original = tasks.find(value => value.id === entry.taskId)
        const expectedWork = original.completed ? 0 : original.remainingMinutes ?? original.estimatedMinutes
        expect(entry.requiredMinutes).toBe(expectedWork)
        expect(entry.allocatedMinutes).toBeGreaterThanOrEqual(0)
        expect(entry.allocatedMinutes).toBeLessThanOrEqual(expectedWork)
        expect(entry.missingMinutes).toBe(expectedWork - entry.allocatedMinutes)
        let allocated = 0
        for (const block of entry.allocations) {
          const source = sessions.find(value => value.id === block.sessionId)
          expect(source).toBeDefined()
          expect(block.startLocal >= `${source.dateLocal}T${source.startTime}`).toBe(true)
          expect(block.endLocal <= `${source.dateLocal}T${source.endTime}`).toBe(true)
          expect(block.endLocal <= original.deadlineLocal).toBe(true)
          expect(block.startLocal >= local(511)).toBe(true)
          const start = new Date(block.startLocal).getTime()
          const end = new Date(block.endLocal).getTime()
          expect(block.minutes).toBeGreaterThan(0)
          expect(Number.isSafeInteger(block.minutes)).toBe(true)
          expect((end - start) / 60_000).toBe(block.minutes)
          for (let minute = start; minute < end; minute += 60_000) {
            expect(usedMinutes.has(minute), `Minute allocated twice: ${minute}`).toBe(false)
            usedMinutes.add(minute)
          }
          allocated += block.minutes
        }
        expect(entry.allocatedMinutes).toBe(allocated)
      }
      expect(plan.totalAllocatedMinutes).toBe(usedMinutes.size)
      expect(plan.totalMissingMinutes).toBe(plan.tasks.reduce((sum, entry) => sum + entry.missingMinutes, 0))
      expect(plan.totalRequiredMinutes).toBe(plan.totalAllocatedMinutes + plan.totalMissingMinutes)
      expect(JSON.stringify({ tasks, sessions })).toBe(before)
      expect(now.getTime()).toBe(new Date(`${date}T08:30:30`).getTime())
    }
  })

  it('adding an identical or contained interval cannot create more capacity', () => {
    const work = Object.freeze([task('large', 900, 1000)])
    const now = new Date(`${date}T08:00:00`)
    const original = [session('one', 600, 720)]
    const duplicates = [...original, session('same', 600, 720), session('inside', 630, 660)]
    const single = deriveCapacity(work, original, now)
    const repeated = deriveCapacity(work, duplicates, now)
    expect(single.totalAllocatedMinutes).toBe(120)
    expect(repeated.totalAllocatedMinutes).toBe(120)
    expect(repeated.totalMissingMinutes).toBe(880)
  })
})
