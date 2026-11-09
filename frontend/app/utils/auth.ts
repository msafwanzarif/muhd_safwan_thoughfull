import type { components } from '~/types/api';

export type Signup = components['schemas']['SignUpDto'];

export function roleHome(role: 'member' | 'professional'): string {
  return role === 'professional' ? '/pro/schedule' : '/professionals';
}

export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/')) return;

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || decoded.includes('\\')) return;
    if ([...decoded].some((character) => character.charCodeAt(0) <= 32)) return;
    const path = decoded.split(/[?#]/)[0];
    if (['/login', '/signup', '/'].includes(path ?? '')) return;
    return value;
  } catch {
    return;
  }
}

export function authMessage(error: unknown): string {
  const value = error as { status?: number; code?: string; message?: string };
  if (value.status === 429)
    return 'Too many attempts. Please wait a minute before trying again.';
  if (value.status === 401) return 'The email or password is incorrect.';
  if (value.code === 'EMAIL_ALREADY_REGISTERED')
    return 'An account already uses this email. Please log in instead.';
  if (value.code === 'REQUEST_IN_PROGRESS')
    return 'Your request is still processing. Please try again shortly.';
  return value.message ?? 'Unable to connect. Please try again.';
}

export const specialisations = [
  { value: 'anxiety', label: 'Anxiety' },
  { value: 'depression', label: 'Depression' },
  { value: 'stress_and_burnout', label: 'Stress and burnout' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'grief', label: 'Grief' },
  { value: 'career_coaching', label: 'Career coaching' },
] as const;

export const languages = [
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Malay' },
  { value: 'zh', label: 'Mandarin' },
  { value: 'ta', label: 'Tamil' },
  { value: 'yue', label: 'Cantonese' },
  { value: 'id', label: 'Indonesian' },
] as const;
