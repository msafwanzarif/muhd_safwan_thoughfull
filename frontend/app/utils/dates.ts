import { calendarDateInZone } from '~/utils/professionals';

export function localDate(instant: string, timezone: string): string {
  return calendarDateInZone(new Date(instant), timezone).toString();
}

export function formatTime(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instant));
}

export function formatDate(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(instant));
}

export function formatSession(
  start: string,
  end: string,
  timezone: string,
): string {
  return `${formatDate(start, timezone)}, ${formatTime(start, timezone)}–${formatTime(end, timezone)}`;
}

export function within24Hours(start: string, now = Date.now()): boolean {
  return Date.parse(start) - now < 24 * 60 * 60 * 1000;
}

export function cancellationDeadline(start: string): string {
  return new Date(Date.parse(start) - 24 * 60 * 60 * 1000).toISOString();
}

export function meetsNotice(start: string, now = Date.now()): boolean {
  return Date.parse(start) - now >= 2 * 60 * 60 * 1000;
}
