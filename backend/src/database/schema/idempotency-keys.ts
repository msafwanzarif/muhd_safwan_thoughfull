import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  unique,
  check,
  index,
} from 'drizzle-orm/pg-core';
import { id, audit } from './columns';
import { idempotencyStatus } from './enums';
import { users } from './users';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    key: text().notNull(),
    requestHash: text().notNull(),
    status: idempotencyStatus().notNull().default('in_progress'),
    responseStatus: integer(),
    responseBody: jsonb(),
    ...audit(),
  },
  (t) => [
    unique().on(t.userId, t.key),
    index().on(t.createdAt),
    check(
      'idempotency_keys_response',
      sql`${t.status} <> 'completed' or (${t.responseStatus} between 100 and 599 and ${t.responseBody} is not null)`,
    ),
  ],
);
