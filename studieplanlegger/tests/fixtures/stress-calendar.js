import { validateCourse } from '../../src/planner.js'

// Invented calendar/course data for F01. No downloaded or personal entries.
export const stressCourseCode = index => `QA${String(index % 25 + 1).padStart(3, '0')}`
export const stressCourses = () => Array.from({ length: 25 }, (_, index) => validateCourse({
  id: `synthetic-existing-${index}`, code: stressCourseCode(index), name: `Syntetisk emne ${index + 1}`,
  year: 2026, semester: 'autumn', notes: `Behold syntetisk notat ${index + 1}`,
}))
export function stressCalendar({ count = 500, revised = false } = {}) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...Array.from({ length: count }, (_, index) => {
    const day = String(1 + Math.floor(index / 25)).padStart(2, '0')
    return ['BEGIN:VEVENT', `UID:synthetic-large-${index}@example.invalid`,
      `SUMMARY:[${stressCourseCode(index)}] Syntetisk aktivitet ${index}${revised && index === count - 1 ? ' revidert' : ''}`,
      `DTSTART:202611${day}T090000Z`, `DTEND:202611${day}T100000Z`, `LOCATION:Syntetisk rom ${index % 25 + 1}`, 'END:VEVENT'].join('\r\n')
  }), 'END:VCALENDAR'].join('\r\n')
}
