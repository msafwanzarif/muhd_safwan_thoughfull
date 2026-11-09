import { DateTime } from 'luxon';
import { WorkingRange } from './working-hours';

export function sessionWithinHours(
  startAt: Date,
  endAt: Date,
  timezone: string,
  ranges: WorkingRange[],
): boolean {
  const start = DateTime.fromJSDate(startAt, { zone: timezone }),
    end = DateTime.fromJSDate(endAt, { zone: timezone });
  const minute = start.hour * 60 + start.minute;

  return (
    start.toISODate() === end.toISODate() &&
    ranges.some(
      (r) =>
        r.weekday === start.weekday % 7 &&
        minute >= r.startMinute &&
        (minute - r.startMinute) % 60 === 0 &&
        end.hour * 60 + end.minute <= r.startMinute + r.lengthHours * 60,
    )
  );
}
