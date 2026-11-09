import { it, expect } from 'vitest';
import { reminderSchedule } from './schedule-reminders';

it('only creates future reminders, excluding exactly-now due times', () => {
  const now = new Date('2027-01-01T00:00:00Z');
  expect(
    reminderSchedule(new Date(now.getTime() + 25 * 3600000), now),
  ).toHaveLength(2);
  expect(
    reminderSchedule(new Date(now.getTime() + 24 * 3600000), now).map(
      (r) => r.type,
    ),
  ).toEqual(['1h']);
  expect(reminderSchedule(new Date(now.getTime() + 3600000), now)).toEqual([]);
});
