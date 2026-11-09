import { describe, it, expect } from 'vitest';
import { validateWorkingHours } from './working-hours';

describe('weekly working hours', () => {
  it('allows split days, adjacent ranges and quarter-hour starts', () => {
    expect(() =>
      validateWorkingHours([
        { weekday: 0, startMinute: 555, lengthHours: 2 },
        { weekday: 0, startMinute: 675, lengthHours: 1 },
        { weekday: 6, startMinute: 1380, lengthHours: 1 },
      ]),
    ).not.toThrow();
  });
  it.each([
    { weekday: 7, startMinute: 540, lengthHours: 1 },
    { weekday: 1, startMinute: 541, lengthHours: 1 },
    { weekday: 1, startMinute: 540, lengthHours: 1.5 },
    { weekday: 1, startMinute: 1425, lengthHours: 1 },
    { weekday: 1, startMinute: 540, lengthHours: 0 },
  ])('rejects invalid range %j', (range) => {
    expect(() => validateWorkingHours([range])).toThrow();
  });
  it('rejects unsorted overlapping ranges', () => {
    expect(() =>
      validateWorkingHours([
        { weekday: 2, startMinute: 600, lengthHours: 2 },
        { weekday: 2, startMinute: 555, lengthHours: 1 },
      ]),
    ).toThrow('overlap');
  });
});
