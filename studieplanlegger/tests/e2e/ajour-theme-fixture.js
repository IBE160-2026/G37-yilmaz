// Entirely invented presentation fixture. No institution transport, personal data,
// source URLs or production browser profiles are used.
export function themeFixture(count = 12) {
  const names = ['Algoritmer og problemløsing', 'Samme kode ved et annet lærested', 'Databaser og informasjonsforvaltning', 'Mennesker, teknologi og samfunn', 'Matematikk og modellering', 'Nettverk og kommunikasjon', 'Forskningsmetode og kildevurdering', 'Programmering med lange norske oppgavebeskrivelser', 'Prosjektarbeid og samarbeid', 'Universell utforming', 'Statistikk og analyse', 'Etikk og bærekraft', 'Ekstra syntetisk emne']
  const courses = Array.from({ length: count }, (_, i) => ({
    id: `theme-course-${String(i + 1).padStart(2, '0')}`, code: i < 2 ? 'SYN101' : `SYN${101 + i}`,
    name: `Syntetisk ${names[i % names.length]}`, university: i === 1 ? 'Syntetisk lærested B' : 'Syntetisk lærested A',
    semester: 'autumn', year: 2026, credits: 7.5, notes: '',
  }))
  const tasks = courses.map((course, i) => ({
    id: `theme-task-${i + 1}`, title: `Syntetisk arbeidskrav ${i + 1}: ${names[i % names.length]}`,
    courseId: course.id, course: course.code, deadlineLocal: `2026-10-${26 + i % 5}T${14 + i % 4}:00`,
    estimatedMinutes: 90, remainingMinutes: 60, completed: [8, 9, 11].includes(i), requiresSubmission: i % 3 === 0 || i === 8, submitted: i === 9,
    steps: [{ id: `theme-step-${i + 1}`, title: 'Skriv et avgrenset førsteutkast', estimatedMinutes: 25, completed: false }],
  }))
  tasks.push({ id: 'theme-no-course', title: 'Syntetisk oppgave uten emne og anslag', course: '', completed: false })
  const events = courses.flatMap((course, i) => [5, 12, 19, 26].map((day, week) => ({
    id: `theme-event-${i + 1}-${week}`, title: `Syntetisk ${i === 10 ? 'eksamen' : 'seminar'} ${i + 1}`,
    courseId: course.id, start: `2026-10-${String(day + i % 5).padStart(2, '0')}T${String(8 + Math.floor(i / 5)).padStart(2, '0')}:00:00Z`,
    end: `2026-10-${String(day + i % 5).padStart(2, '0')}T${String(10 + Math.floor(i / 5)).padStart(2, '0')}:00:00Z`,
    location: `Syntetisk rom ${i + 1}`, notes: '', ...(i === 10 ? { activityKind: 'exam' } : {}), ...(i === 9 && week === 3 ? { cancelled: true } : {}),
  })))
  events.push({ id: 'theme-personal', title: 'Syntetisk egen aktivitet uten emne', activityKind: 'personal', courseId: '', dateLocal: '2026-10-26', start: '2026-10-26T11:00:00Z', end: '2026-10-26T11:30:00Z', location: '', notes: '', cancelled: false })
  return {
    schemaVersion: 1, onboarding: { dismissed: true, completed: true }, tasks,
    sessions: [{ id: 'theme-session', taskId: 'theme-task-1', dateLocal: '2026-10-26', startTime: '13:00', endTime: '13:30' }],
    planner: { courses, sources: [], events },
  }
}
