import { pgEnum } from 'drizzle-orm/pg-core';
export const role = pgEnum('user_role', ['member', 'professional']);
export const bookingStatus = pgEnum('booking_status', [
  'active',
  'cancelled',
  'rescheduled',
]);
export const reminderStatus = pgEnum('reminder_status', [
  'pending',
  'sent',
  'skipped',
  'cancelled',
]);
export const reminderType = pgEnum('reminder_type', ['24h', '1h']);
export const notificationType = pgEnum('notification_type', [
  'reminder_24h',
  'reminder_1h',
  'session_cancelled',
  'session_rescheduled',
]);
export const idempotencyStatus = pgEnum('idempotency_status', [
  'in_progress',
  'completed',
]);
