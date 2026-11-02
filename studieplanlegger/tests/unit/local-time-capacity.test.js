import { describe, expect, it } from 'vitest'
import { toInstant } from '../../src/planner.js'
import { validateSession } from '../../src/capacity.js'
import { deriveWorkCapacity } from '../../src/work-capacity.js'

const invalidTime = 'Oppgi en gyldig dato og et gyldig klokkeslett i norsk tid.'
const repeatedTime = 'Klokkeslettet er tvetydig fordi det forekommer to ganger ved overgang til vintertid. Velg et klokkeslett utenfor den gjentatte timen.'
const missingTime = 'Klokkeslettet finnes ikke ved overgang til sommertid. Velg et klokkeslett før eller etter tidsskiftet.'

describe('Norwegian local-time validation without guessing an instant', () => {
  it.each([
    ['2026-10-25', '02:15', repeatedTime],
    ['2026-03-29', '02:15', missingTime],
    ['2026-02-30', '10:00', invalidTime],
    ['2026-11-01', '25:00', invalidTime],
  ])('explains rejected %s %s and leaves the session draft unchanged', (dateLocal, startTime, error) => {
    const session = { id: 'synthetic-local-time', dateLocal, startTime, endTime: '12:00' }
    const before = structuredClone(session)
    expect(validateSession(session)).toEqual({ valid: false, error })
    expect(() => toInstant(`${dateLocal}T${startTime}`)).toThrow(error)
    expect(session).toEqual(before)
  })

  it.each([
    ['2026-03-29T01:15', '2026-03-29T00:15:00Z'],
    ['2026-03-29T03:15', '2026-03-29T01:15:00Z'],
    ['2026-10-25T01:15', '2026-10-24T23:15:00Z'],
    ['2026-10-25T03:15', '2026-10-25T02:15:00Z'],
    ['2026-11-01T10:15:37', '2026-11-01T09:15:37Z'],
  ])('keeps exact valid conversion from %s', (local, instant) => {
    expect(toInstant(local)).toBe(instant)
  })

  it('keeps the explicit end-date requirement for sessions crossing a time change', () => {
    const session = { id: 'synthetic-crossing', dateLocal: '2026-10-25', startTime: '01:00', endTime: '04:00' }
    expect(validateSession(session)).toEqual({ valid: false, error: 'Oppgi eksplisitt sluttdato for en økt som krysser sommer- eller vintertid.' })
    expect(validateSession({ ...session, endDateLocal: session.dateLocal })).toEqual({ valid: true })
    expect(validateSession({ ...session, dateLocal: '2026-11-01', endDateLocal: '2026-11-02', startTime: '23:00', endTime: '01:00' })).toEqual({ valid: true })
  })
})

describe('repeated reservation explanations', () => {
  it('shows one identical reason per task while preserving distinct reasons and capacity', () => {
    // Invented tasks and six past reservations each; no personal plan or source data.
    const tasks = ['a', 'b'].map(id => ({ id, title: `Syntetisk ${id}`, estimatedMinutes: 1200, remainingMinutes: 1200, completed: false, splittable: true }))
    const sessions = tasks.flatMap(task => Array.from({ length: 6 }, (_, index) => ({
      id: `${task.id}-${index}`, taskId: task.id, dateLocal: '2026-10-30',
      startTime: `${String(8 + index).padStart(2, '0')}:00`, endTime: `${String(8 + index).padStart(2, '0')}:30`,
    })))
    const workWindows = [{ id: 'synthetic-window', start: '2026-11-02T08:00:00+01:00', end: '2026-11-02T16:00:00+01:00' }]
    const before = structuredClone({ tasks, sessions, workWindows })
    const result = deriveWorkCapacity(tasks, sessions, new Date('2026-11-01T12:00:00Z'), [], workWindows)
    expect(result).toMatchObject({ totalCapacityMinutes: 480, totalAllocatedMinutes: 480, totalMissingMinutes: 1920, totalReservedMinutes: 0 })
    for (const [index, missing] of [[0, 720], [1, 1200]]) {
      expect(result.tasks[index]).toMatchObject({ state: 'insufficient', requiredMinutes: 1200, missingMinutes: missing, reasons: [
        'Deler av reservasjonen er passert, opptatt eller utenfor arbeidstiden.',
        `${missing} min mangler før fristen i registrert arbeidstid.`,
      ] })
    }
    expect({ tasks, sessions, workWindows }).toEqual(before)
  })
})
