import { describe, it, expect } from 'vitest';
import { capacityNotice } from '../../src/capacity-notice.js';

const now = new Date('2026-09-07T10:00:00+02:00');
const task = { id: 'isolated-design-task', title: 'Test', course: 'TEST', deadlineLocal: '2026-09-08T12:00', estimatedMinutes: 30, completed: false };
describe('honest capacity messages', () => {
  it('does not call an unplanned day a shortage', () => {
    expect(capacityNotice(task, [], [], now)).toEqual({ tone: 'quiet', text: 'Ingen studieøkt planlagt ennå.' });
  });
  it('distinguishes unallocated work from all available time', () => {
    expect(capacityNotice(task, [{ id: 'isolated-future-session', dateLocal: '2026-09-08', startTime: '10:00', endTime: '10:10' }], [], now).tone).toBe('planning');
  });
  it('identifies a hard deadline shortage independently of planned sessions', () => {
    expect(capacityNotice({ ...task, deadlineLocal: '2026-09-07T10:20' }, [], [], now).tone).toBe('danger');
  });
  it('subtracts overlapping teaching once and ignores cancelled teaching', () => {
    const start = new Date('2026-09-07T10:00:00+02:00').toISOString();
    const end = new Date('2026-09-07T10:20:00+02:00').toISOString();
    const near = { ...task, deadlineLocal: '2026-09-07T10:45' };
    expect(capacityNotice(near, [], [{ start, end }, { start, end }], now).tone).toBe('danger');
    expect(capacityNotice(near, [], [{ start, end, cancelled: true }], now).tone).toBe('quiet');
  });
  it('does not invent estimates or deadlines', () => {
    expect(capacityNotice({ ...task, estimatedMinutes: null }, [], [], now).text).toContain('tidsestimat');
    expect(capacityNotice({ ...task, deadlineLocal: '' }, [], [], now).tone).toBe('quiet');
  });
  it('recognizes expired sessions, passed deadlines and completed work', () => {
    expect(capacityNotice(task, [{ id: 'isolated-expired-session', dateLocal: '2026-09-06', startTime: '14:00', endTime: '15:00' }], [], now).text).toContain('kommende');
    expect(capacityNotice({ ...task, deadlineLocal: '2026-09-06T12:00' }, [], [], now).tone).toBe('warning');
    expect(capacityNotice({ ...task, completed: true }, [], [], now)).toBeNull();
  });
});
