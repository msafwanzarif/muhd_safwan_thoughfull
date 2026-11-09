import { it, expect } from 'vitest';
import { toApiError } from './api-error';
it('preserves API problem codes for actionable retry decisions', () => {
  const error = toApiError({
    statusCode: 409,
    data: { code: 'SLOT_TAKEN', detail: 'Choose another slot' },
  });
  expect(error.status).toBe(409);
  expect(error.code).toBe('SLOT_TAKEN');
  expect(error.message).toBe('Choose another slot');
});
it('handles network failures without exposing internal errors', () => {
  expect(toApiError(new Error('internal detail')).code).toBe('NETWORK_ERROR');
});
