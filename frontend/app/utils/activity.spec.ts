import { it, expect } from 'vitest';
import { idleStage, LOGOUT_AFTER, WARNING_AFTER } from './activity';

it('warns at 28 minutes and expires at 30 based on human activity', () => {
  const last = 100000;
  expect(idleStage(last, last + WARNING_AFTER - 1)).toBe('active');
  expect(idleStage(last, last + WARNING_AFTER)).toBe('warning');
  expect(idleStage(last, last + LOGOUT_AFTER - 1)).toBe('warning');
  expect(idleStage(last, last + LOGOUT_AFTER)).toBe('expired');
  expect(idleStage(last, last - 1000)).toBe('active');
});
