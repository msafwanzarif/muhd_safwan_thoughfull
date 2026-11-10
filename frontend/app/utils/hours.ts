import type { WorkingRange } from '~/utils/schedule';

export function rangeError(ranges: WorkingRange[]): string {
  if (ranges.length > 168) return 'Use no more than 168 ranges per week.';
  const ordered = [...ranges].sort(
    (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute,
  );
  for (let index = 0; index < ordered.length; index++) {
    const range = ordered[index]!;
    if (
      !Number.isInteger(range.weekday) ||
      range.weekday < 0 ||
      range.weekday > 6 ||
      !Number.isInteger(range.startMinute) ||
      range.startMinute < 0 ||
      range.startMinute % 15 ||
      !Number.isInteger(range.lengthHours) ||
      range.lengthHours < 1 ||
      range.lengthHours > 24 ||
      range.startMinute + range.lengthHours * 60 > 1440
    )
      return 'Use 15-minute starts and whole-hour lengths. Each range must finish by midnight.';
    const previous = ordered[index - 1];
    if (
      previous?.weekday === range.weekday &&
      previous.startMinute + previous.lengthHours * 60 > range.startMinute
    )
      return 'Ranges on the same day cannot overlap.';
  }
  return '';
}

export function minuteLabel(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function copyRanges(ranges: WorkingRange[]): WorkingRange[] {
  return ranges.map(({ weekday, startMinute, lengthHours }) => ({
    weekday,
    startMinute,
    lengthHours,
  }));
}
