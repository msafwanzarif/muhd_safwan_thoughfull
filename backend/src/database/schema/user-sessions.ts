import { pgTable, uuid, text, index } from 'drizzle-orm/pg-core';
import { id, time, audit } from './columns';
import { users } from './users';

export const userSessions = pgTable(
  'user_sessions',
  {
    id: id(),
    tokenHash: text().notNull().unique(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    lastActiveAt: time().notNull().defaultNow(),
    expiresAt: time().notNull(),
    ...audit(),
  },
  (t) => [index().on(t.userId), index().on(t.expiresAt)],
);
