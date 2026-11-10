import { describe, it, expect } from 'vitest';
import {
  calendarDateInZone,
  readDirectoryFilters,
  timezoneCity,
  validDate,
} from './professionals';

describe('directory URL filters', () => {
  it('normalizes invalid, repeated and out-of-range parameters', () => {
    expect(
      readDirectoryFilters({
        name: ['Alex', 'Sam'],
        spec: 'invalid',
        lang: 'invalid',
        date: '2026-02-30',
        page: '-3',
      }),
    ).toEqual({
      name: '',
      specialisation: '',
      language: '',
      date: '',
      page: 1,
    });
    expect(readDirectoryFilters({ page: '1000001' }).page).toBe(1);
    expect(readDirectoryFilters({ page: '1.5' }).page).toBe(1);
  });

  it('keeps supported filters and trims names', () => {
    expect(
      readDirectoryFilters({
        name: ' Alex ',
        spec: 'anxiety',
        lang: 'ms',
        date: '2028-02-29',
        page: '2',
      }),
    ).toEqual({
      name: 'Alex',
      specialisation: 'anxiety',
      language: 'ms',
      date: '2028-02-29',
      page: 2,
    });
    expect(validDate('2027-02-29')).toBe(false);
  });
});

it('uses the saved timezone calendar date at UTC boundaries and across DST', () => {
  const instant = new Date('2026-11-10T01:00:00Z');
  expect(calendarDateInZone(instant, 'America/Los_Angeles').toString()).toBe(
    '2026-11-09',
  );
  expect(calendarDateInZone(instant, 'Asia/Kuala_Lumpur').toString()).toBe(
    '2026-11-10',
  );
  expect(
    calendarDateInZone(new Date('2026-03-08T10:00:00Z'), 'America/Los_Angeles')
      .add({ days: 28 })
      .toString(),
  ).toBe('2026-04-05');
  expect(timezoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
});
