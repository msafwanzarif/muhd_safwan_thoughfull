import { expect, it } from 'vitest';
import { parseDate } from '@internationalized/date';
import { dayBoundary, dayEvents, monday, type Session } from './schedule';

it('requests a Monday-to-Monday week with DST-aware UTC bounds', () => {
  expect(monday(parseDate('2026-11-10')).toString()).toBe('2026-11-09');
  const start = parseDate('2026-03-02');
  expect(
    (Date.parse(dayBoundary(start.add({ days: 7 }), 'America/New_York')) -
      Date.parse(dayBoundary(start, 'America/New_York'))) /
      3600000,
  ).toBe(167);
});

it('keeps repeated DST times in separate event lanes', () => {
  const sessions = [
    { id: 'a', startAt: '2026-11-01T05:00:00Z', endAt: '2026-11-01T05:50:00Z' },
    { id: 'b', startAt: '2026-11-01T06:00:00Z', endAt: '2026-11-01T06:50:00Z' },
  ] as Session[];
  const events = dayEvents(sessions, '2026-11-01', 'America/New_York');
  expect(events.map((event) => event.lane)).toEqual([0, 1]);
  expect(events.every((event) => event.lanes === 2)).toBe(true);
});
