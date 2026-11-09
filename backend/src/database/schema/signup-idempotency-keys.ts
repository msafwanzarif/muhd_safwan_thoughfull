import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { id, audit } from './columns';

export const signupIdempotencyKeys = pgTable('signup_idempotency_keys', {
  id: id(),
  keyHash: text().notNull().unique(),
  requestHash: text().notNull(),
  responseBody: jsonb()
    .$type<{ id: string; role: 'member' | 'professional'; timezone: string }>()
    .notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  ...audit(),
});
