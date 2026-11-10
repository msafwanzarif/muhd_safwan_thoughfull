import { it, expect } from 'vitest';
import {
  cancellationDeadline,
  formatTime,
  localDate,
  meetsNotice,
  within24Hours,
} from './dates';
import { IdempotencyIntent } from './idempotency';

it('uses elapsed UTC hours for notice and the inclusive 24-hour boundary', () => {
  const now = Date.parse('2026-03-07T17:00:00Z');
  expect(within24Hours('2026-03-08T17:00:00Z', now)).toBe(false);
  expect(within24Hours('2026-03-08T16:59:59Z', now)).toBe(true);
  expect(cancellationDeadline('2026-03-08T17:00:00Z')).toBe(
    '2026-03-07T17:00:00.000Z',
  );
  expect(meetsNotice('2026-03-07T19:00:00Z', now)).toBe(true);
  expect(meetsNotice('2026-03-07T18:59:59Z', now)).toBe(false);
});

it('formats UTC slots in the saved timezone using 24-hour time', () => {
  expect(formatTime('2026-11-10T18:00:00Z', 'Asia/Kuala_Lumpur')).toBe('02:00');
  expect(localDate('2026-11-10T18:00:00Z', 'Asia/Kuala_Lumpur')).toBe(
    '2026-11-11',
  );
});

it('retains a key through retries and replaces it for changed intent or success', () => {
  const intent = new IdempotencyIntent();
  const body = { professionalId: 'p', startAt: '2026-11-10T18:00:00Z' };
  const first = intent.keyFor(body);
  expect(intent.keyFor({ ...body })).toBe(first);
  const changed = intent.keyFor({ ...body, startAt: '2026-11-10T19:00:00Z' });
  expect(changed).not.toBe(first);
  intent.reset();
  expect(intent.keyFor({ ...body, startAt: '2026-11-10T19:00:00Z' })).not.toBe(
    changed,
  );
});
