import { it, expect } from 'vitest';
import { seedProfessionals } from './seed-roster';
import { seedSchedule } from './seed-schedule';
import { validateWorkingHours } from '../availability/domain/working-hours';

it('creates stable, varied valid schedules for the fictional roster', () => {
  const schedules = seedProfessionals.map((p) => seedSchedule(p.email));
  expect(seedProfessionals).toHaveLength(15);
  for (let i = 0; i < schedules.length; i++) {
    expect(schedules[i]).toEqual(seedSchedule(seedProfessionals[i].email));
    expect(() => validateWorkingHours(schedules[i])).not.toThrow();
    const days = new Set(schedules[i].map((r) => r.weekday));
    expect(days.size).toBeGreaterThanOrEqual(3);
    expect(days.size).toBeLessThanOrEqual(6);
  }
  expect(new Set(schedules.map((s) => JSON.stringify(s))).size).toBe(15);
  expect(schedules.flat().some((r) => r.startMinute % 60 !== 0)).toBe(true);
  expect(schedules.flat().some((r) => r.weekday === 0 || r.weekday === 6)).toBe(
    true,
  );
});
