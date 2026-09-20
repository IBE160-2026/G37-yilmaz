import { getRemainingMinutes } from './tasks.js';
import { toInstant, eventBlocksTime } from './planner.js';
import { extendedSessionInterval } from './work-capacity.js';

// A missing allocation is not evidence that the student's whole day is full.
// Only the hard deadline window can establish a definite time shortage.
export function capacityNotice(task, sessions = [], events = [], now = new Date()) {
  const remaining = getRemainingMinutes(task);
  if (remaining === null || !Number.isFinite(remaining)) {
    return { tone: 'quiet', text: 'Legg til et tidsestimat for å sammenligne arbeid og tid.' };
  }
  if (remaining <= 0 || task.completed || task.submittedAt) return null;
  const start = now.getTime();
  let deadline = NaN;
  try { if (task.deadlineLocal) deadline = Date.parse(toInstant(task.deadlineLocal)); } catch { /* Ambiguous deadlines do not prove a shortage. */ }
  if (Number.isFinite(deadline) && deadline <= start) {
    return { tone: 'warning', text: 'Fristen er passert. Vurder hva som må følges opp.' };
  }
  if (Number.isFinite(deadline)) {
    const intervals = events.filter(eventBlocksTime)
      .map(event => [Math.max(start, Date.parse(event.start)), Math.min(deadline, Date.parse(event.end))])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
      .sort((a, b) => a[0] - b[0]);
    let busy = 0;
    let through = start;
    for (const [a, b] of intervals) {
      busy += Math.max(0, b - Math.max(a, through));
      through = Math.max(through, b);
    }
    const maximumMinutes = Math.max(0, Math.floor((deadline - start - busy) / 60000));
    if (remaining > maximumMinutes) {
      return { tone: 'danger', text: `For lite tid før fristen: ${remaining} min arbeid, høyst ${maximumMinutes} min igjen.`,
        detail: 'Selv hele tidsrommet fram til fristen, uten registrert undervisning, er kortere enn arbeidet. Søvn og andre avtaler er ikke trukket fra.' };
    }
  }
  if (!sessions.length) return { tone: 'quiet', text: 'Ingen studieøkt planlagt ennå.' };
  const futureSessions = sessions.filter(session => { try { return extendedSessionInterval(session).end > start; } catch { return false; } });
  if (!futureSessions.length) return { tone: 'quiet', text: 'Ingen kommende studieøkt planlagt.' };
  return { tone: 'planning', text: 'Arbeid gjenstår å planlegge i studieøktene.',
    detail: 'Beregningen gjelder bare registrerte studieøkter. Den sier ikke at all annen tid er opptatt.' };
}
