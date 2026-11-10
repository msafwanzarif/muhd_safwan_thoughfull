import {
  getDayOfWeek,
  parseDate,
  toZoned,
  type CalendarDate,
} from '@internationalized/date';
import type { components } from '~/types/api';
import { localDate } from '~/utils/dates';

export type Session = components['schemas']['SessionResponseDto'];
export type WorkingRange = components['schemas']['WorkingRangeDto'];

export function monday(date: CalendarDate): CalendarDate {
  return date.subtract({ days: getDayOfWeek(date, 'en-GB') });
}

export function dayBoundary(date: CalendarDate, timezone: string): string {
  return toZoned(date, timezone).toAbsoluteString();
}

export function wallMinute(instant: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(instant));
  return (
    Number(parts.find((part) => part.type === 'hour')?.value) * 60 +
    Number(parts.find((part) => part.type === 'minute')?.value)
  );
}

export function dayOfWeek(date: string): number {
  return getDayOfWeek(parseDate(date), 'en-US');
}

export function groupSessions(
  sessions: Session[],
  timezone: string,
): [string, Session[]][] {
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = localDate(session.startAt, timezone);
    const group = groups.get(key) ?? [];
    group.push(session);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// Separate lanes keep repeated DST clock times and cancelled history visible.
export function dayEvents(sessions: Session[], date: string, timezone: string) {
  const ends: number[] = [];
  const events = sessions
    .filter((session) => localDate(session.startAt, timezone) === date)
    .map((session) => {
      const start = wallMinute(session.startAt, timezone);
      const wallEnd = wallMinute(session.endAt, timezone);
      const end =
        localDate(session.endAt, timezone) !== date
          ? 1440
          : Math.max(start + 15, wallEnd);
      return { session, start, end };
    })
    .sort((a, b) => a.start - b.start);
  const placed = events.map((event) => {
    let lane = ends.findIndex((end) => end <= event.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = event.end;
    return { ...event, lane };
  });
  return placed.map((event) => ({ ...event, lanes: ends.length }));
}
