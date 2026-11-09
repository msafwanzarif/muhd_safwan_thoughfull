export interface WorkingRange {
  weekday: number;
  startMinute: number;
  lengthHours: number;
}

export function validateWorkingHours(ranges: WorkingRange[]): void {
  const ordered = [...ranges].sort(
    (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute,
  );
  for (let i = 0; i < ordered.length; i++) {
    const range = ordered[i];
    if (
      !Number.isInteger(range.weekday) ||
      range.weekday < 0 ||
      range.weekday > 6 ||
      !Number.isInteger(range.startMinute) ||
      range.startMinute < 0 ||
      range.startMinute % 15 !== 0 ||
      !Number.isInteger(range.lengthHours) ||
      range.lengthHours < 1 ||
      range.startMinute + range.lengthHours * 60 > 1440
    ) {
      throw new Error(
        'Ranges must use weekday 0–6, 15-minute starts, whole-hour lengths and end by midnight',
      );
    }
    const previous = ordered[i - 1];
    if (
      previous?.weekday === range.weekday &&
      previous.startMinute + previous.lengthHours * 60 > range.startMinute
    ) {
      throw new Error('Working-hour ranges cannot overlap');
    }
  }
}
