import { DateTime } from 'luxon';
import { WorkingRange } from '../../availability/domain/working-hours';

export interface OccupiedSession {
  startAt: Date;
  endAt: Date;
}

export interface Slot {
  startAt: string;
  endAt: string;
  available: boolean;
  reason?: 'MEMBER_OVERLAP';
}

export interface SlotInput {
  now: Date;
  memberTimezone: string;
  professionalTimezone: string;
  ranges: WorkingRange[];
  blockedDates: string[];
  professionalSessions: OccupiedSession[];
  memberSessions: OccupiedSession[];
}
const overlaps = (
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number,
) => start < otherEnd && end > otherStart;
export function bookingWindowEnd(now: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(now, { zone: timezone })
    .startOf('day')
    .plus({ days: 29 });
}

export function generateSlots(input: SlotInput): Slot[] {
  const now = input.now.getTime();
  const minimum = now + 2 * 60 * 60 * 1000;
  const windowEnd = bookingWindowEnd(
    input.now,
    input.memberTimezone,
  ).toMillis();
  const blocked = new Set(input.blockedDates);
  const slots: Slot[] = [];
  let day = DateTime.fromJSDate(input.now, {
    zone: input.professionalTimezone,
  }).startOf('day');
  while (day.toMillis() < windowEnd) {
    if (!blocked.has(day.toISODate()!)) {
      for (const range of input.ranges.filter(
        (r) => r.weekday === day.weekday % 7,
      )) {
        for (
          let minute = range.startMinute;
          minute + 50 <= range.startMinute + range.lengthHours * 60;
          minute += 60
        ) {
          const hour = Math.floor(minute / 60),
            clockMinute = minute % 60;
          const candidate = DateTime.fromObject(
            {
              year: day.year,
              month: day.month,
              day: day.day,
              hour,
              minute: clockMinute,
            },
            { zone: input.professionalTimezone },
          );
          // Luxon shifts nonexistent clocks forward; reject those wall times explicitly.
          if (candidate.hour !== hour || candidate.minute !== clockMinute) {
            continue;
          }
          const start = candidate
            .getPossibleOffsets()
            .sort((a, b) => a.toMillis() - b.toMillis())[0];
          const startMs = start.toMillis();
          const endMs = startMs + 50 * 60000;
          const localEnd = DateTime.fromMillis(endMs, {
            zone: input.professionalTimezone,
          });
          if (
            startMs < minimum ||
            endMs > windowEnd ||
            localEnd.toISODate() !== day.toISODate() ||
            localEnd.hour * 60 + localEnd.minute >
              range.startMinute + range.lengthHours * 60
          ) {
            continue;
          }
          if (
            input.professionalSessions.some((s) =>
              overlaps(
                startMs,
                startMs + 60 * 60000,
                s.startAt.getTime(),
                s.startAt.getTime() + 60 * 60000,
              ),
            )
          ) {
            continue;
          }
          const memberConflict = input.memberSessions.some((s) =>
            overlaps(startMs, endMs, s.startAt.getTime(), s.endAt.getTime()),
          );
          slots.push({
            startAt: start.toUTC().toISO()!,
            endAt: DateTime.fromMillis(endMs, { zone: 'utc' }).toISO()!,
            available: !memberConflict,
            ...(memberConflict ? { reason: 'MEMBER_OVERLAP' as const } : {}),
          });
        }
      }
    }
    day = day.plus({ days: 1 }).startOf('day');
  }

  return slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
}
