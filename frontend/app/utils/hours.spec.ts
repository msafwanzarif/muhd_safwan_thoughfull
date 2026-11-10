import { it, expect } from 'vitest';
import { minuteLabel, rangeError } from './hours';

it('accepts split ranges and exactly midnight, and rejects overlap and midnight crossing', () => {
  expect(
    rangeError([
      { weekday: 1, startMinute: 540, lengthHours: 4 },
      { weekday: 1, startMinute: 840, lengthHours: 3 },
    ]),
  ).toBe('');
  expect(rangeError([{ weekday: 1, startMinute: 1380, lengthHours: 1 }])).toBe(
    '',
  );
  expect(minuteLabel(1440)).toBe('24:00');
  expect(
    rangeError([
      { weekday: 1, startMinute: 540, lengthHours: 4 },
      { weekday: 1, startMinute: 720, lengthHours: 2 },
    ]),
  ).toContain('overlap');
  expect(
    rangeError([{ weekday: 1, startMinute: 1395, lengthHours: 1 }]),
  ).toContain('midnight');
  expect(
    rangeError([{ weekday: 1, startMinute: 541, lengthHours: 1 }]),
  ).toContain('15-minute');
  expect(
    rangeError([{ weekday: 1, startMinute: 540, lengthHours: 1.5 }]),
  ).toContain('whole-hour');
});
