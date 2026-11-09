import { it, expect } from 'vitest';
import { canMemberChangeSession } from './cancellation-rules';

it('allows exactly 24 hours but rejects one millisecond inside the boundary and past sessions', () => {
  const now = new Date('2027-01-01T00:00:00Z');
  expect(canMemberChangeSession(new Date('2027-01-02T00:00:00Z'), now)).toBe(
    true,
  );
  expect(
    canMemberChangeSession(new Date('2027-01-01T23:59:59.999Z'), now),
  ).toBe(false);
  expect(canMemberChangeSession(now, now)).toBe(false);
});
