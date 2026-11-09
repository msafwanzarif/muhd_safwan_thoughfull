import { describe, expect, it } from 'vitest';
import { authMessage, roleHome, safeRedirect } from './auth';

describe('post-login destinations', () => {
  it('preserves internal routes and query filters', () => {
    expect(safeRedirect('/professionals?lang=ms&page=2')).toBe(
      '/professionals?lang=ms&page=2',
    );
    expect(roleHome('professional')).toBe('/pro/schedule');
  });

  it.each([
    'https://example.com',
    '//example.com',
    '/%2fexample.com',
    '/\\example.com',
    '/%5cexample.com',
    '/%0aexample.com',
    '/login?redirect=/sessions',
    '/signup',
    '/%invalid',
    undefined,
    ['//example.com'],
  ])('rejects unsafe or circular redirect %s', (value) => {
    expect(safeRedirect(value)).toBeUndefined();
  });
});

it('explains credential errors and throttling without server details', () => {
  expect(authMessage({ status: 401 })).toContain('email or password');
  expect(authMessage({ status: 429 })).toContain('wait a minute');
});
