import { CalendarDate, parseDate } from '@internationalized/date';
import type { components } from '~/types/api';
import { languages, specialisations } from '~/utils/auth';

export type Professional = components['schemas']['ProfessionalResponseDto'];

export interface DirectoryFilters {
  name: string;
  specialisation: string;
  language: string;
  date: string;
  page: number;
}

function single(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    return parseDate(value).toString() === value;
  } catch {
    return false;
  }
}

export function readDirectoryFilters(
  query: Record<string, unknown>,
): DirectoryFilters {
  const spec = single(query.spec);
  const lang = single(query.lang);
  const date = single(query.date);
  const page = Number(single(query.page) || '1');

  return {
    name: single(query.name).trim().slice(0, 100),
    specialisation: specialisations.some((item) => item.value === spec)
      ? spec
      : '',
    language: languages.some((item) => item.value === lang) ? lang : '',
    date: validDate(date) ? date : '',
    page: Number.isInteger(page) && page >= 1 && page <= 1000000 ? page : 1,
  };
}

export function timezoneCity(timezone: string): string {
  return (timezone.split('/').at(-1) ?? timezone).replaceAll('_', ' ');
}

export function timezoneLabel(timezone: string): string {
  const offset = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  })
    .formatToParts()
    .find((part) => part.type === 'timeZoneName')?.value;
  return `${timezoneCity(timezone)} (${offset})`;
}

export function calendarDateInZone(now: Date, timezone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new CalendarDate(value('year'), value('month'), value('day'));
}

export function specialisationLabel(code: string): string {
  return specialisations.find((item) => item.value === code)?.label ?? code;
}

export function languageLabel(code: string): string {
  return languages.find((item) => item.value === code)?.label ?? code;
}
