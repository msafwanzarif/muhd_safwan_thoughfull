import { timezoneCity } from '~/utils/professionals';

export function scheduleTimezone(timezone: string) {
  const offset =
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  return { city: timezoneCity(timezone), offset };
}

export function scheduleDate(
  instant: string,
  timezone: string,
  weekday = false,
): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    ...(weekday ? { weekday: 'short' as const } : {}),
  })
    .format(new Date(instant))
    .replaceAll(',', '');
}

export function scheduleInitials(name: string): string {
  const words = name
    .trim()
    .replace(/^(?:Dr|Prof|Mr|Mrs|Ms)\.?\s+/i, '')
    .split(/\s+/);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toUpperCase();
}
