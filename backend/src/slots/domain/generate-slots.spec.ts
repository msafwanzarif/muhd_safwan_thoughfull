import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  generateSlots,
  bookingWindowEnd,
  type SlotInput,
} from './generate-slots';

const base: SlotInput = {
  now: new Date('2027-01-04T00:00:00Z'),
  memberTimezone: 'UTC',
  professionalTimezone: 'UTC',
  ranges: [
    { weekday: 1, startMinute: 540, lengthHours: 2 },
    { weekday: 1, startMinute: 780, lengthHours: 1 },
  ],
  blockedDates: [],
  professionalSessions: [],
  memberSessions: [],
};
const onDate = (input: SlotInput, date: string) =>
  generateSlots(input).filter(
    (s) =>
      DateTime.fromISO(s.startAt)
        .setZone(input.professionalTimezone)
        .toISODate() === date,
  );
describe('virtual slot generation', () => {
  it('generates hourly starts and a 50-minute final session across split ranges', () => {
    const slots = onDate(base, '2027-01-04');
    expect(slots.map((s) => s.startAt.slice(11, 16))).toEqual([
      '09:00',
      '10:00',
      '13:00',
    ]);
    expect(slots[1].endAt.slice(11, 16)).toBe('10:50');
  });
  it.each([
    ['Asia/Kolkata', '03:45'],
    ['Asia/Kathmandu', '03:30'],
  ])('converts quarter-hour starts in %s', (zone, utc) => {
    const slots = onDate(
      {
        ...base,
        professionalTimezone: zone,
        ranges: [{ weekday: 1, startMinute: 555, lengthHours: 1 }],
      },
      '2027-01-04',
    );
    expect(slots[0].startAt.slice(11, 16)).toBe(utc);
  });
  it('includes exactly two hours notice and omits earlier/past starts', () => {
    const slots = onDate(
      { ...base, now: new Date('2027-01-04T07:00:00Z') },
      '2027-01-04',
    );
    expect(slots[0].startAt.slice(11, 16)).toBe('09:00');
    expect(
      onDate(
        { ...base, now: new Date('2027-01-04T07:00:00.001Z') },
        '2027-01-04',
      )[0].startAt.slice(11, 16),
    ).toBe('10:00');
  });
  it('skips spring-forward nonexistent clocks', () => {
    const input = {
      ...base,
      now: new Date('2027-03-13T00:00:00Z'),
      professionalTimezone: 'America/New_York',
      ranges: [{ weekday: 0, startMinute: 60, lengthHours: 3 }],
    };
    expect(
      onDate(input, '2027-03-14').map((s) => s.startAt.slice(11, 16)),
    ).toEqual(['06:00', '07:00']);
  });
  it('chooses the earlier fall-back occurrence only', () => {
    const input = {
      ...base,
      now: new Date('2027-11-06T00:00:00Z'),
      professionalTimezone: 'America/New_York',
      ranges: [{ weekday: 0, startMinute: 60, lengthHours: 2 }],
    };
    expect(
      onDate(input, '2027-11-07').map((s) => s.startAt.slice(11, 16)),
    ).toEqual(['05:00', '07:00']);
  });
  it('uses member-local calendar days for the 28-day horizon', () => {
    const input = {
      ...base,
      memberTimezone: 'Asia/Kuala_Lumpur',
      ranges: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        startMinute: 0,
        lengthHours: 24,
      })),
    };
    const end = bookingWindowEnd(input.now, input.memberTimezone);
    expect(end.toUTC().toISO()).toBe('2027-02-01T16:00:00.000Z');
    const slots = generateSlots(input);
    expect(slots.at(-1)?.startAt).toBe('2027-02-01T15:00:00.000Z');
    expect(slots.every((s) => Date.parse(s.endAt) <= end.toMillis())).toBe(
      true,
    );
  });
  it('omits blocked local dates and professional-busy slots without exposing bookings', () => {
    expect(
      onDate({ ...base, blockedDates: ['2027-01-04'] }, '2027-01-04'),
    ).toHaveLength(0);
    const slots = onDate(
      {
        ...base,
        professionalSessions: [
          {
            startAt: new Date('2027-01-04T09:00:00Z'),
            endAt: new Date('2027-01-04T09:50:00Z'),
          },
        ],
      },
      '2027-01-04',
    );
    expect(slots.map((s) => s.startAt.slice(11, 16))).toEqual([
      '10:00',
      '13:00',
    ]);
  });
  it('marks only the member own overlaps unavailable with a reason', () => {
    const slots = onDate(
      {
        ...base,
        memberSessions: [
          {
            startAt: new Date('2027-01-04T09:30:00Z'),
            endAt: new Date('2027-01-04T10:20:00Z'),
          },
        ],
      },
      '2027-01-04',
    );
    expect(slots.map((s) => s.available)).toEqual([false, false, true]);
    expect(slots[0].reason).toBe('MEMBER_OVERLAP');
  });
  it('returns no slots without working hours', () => {
    expect(generateSlots({ ...base, ranges: [] })).toEqual([]);
  });
});
