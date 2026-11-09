import { pgTable, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { id, time, audit } from './columns';
import { notificationType } from './enums';
import { users } from './users';
import { bookingSessions } from './booking-sessions';

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    recipientId: uuid()
      .notNull()
      .references(() => users.id),
    type: notificationType().notNull(),
    sessionId: uuid()
      .notNull()
      .references(() => bookingSessions.id),
    data: jsonb().notNull(),
    readAt: time(),
    ...audit(),
  },
  (t) => [index().on(t.recipientId, t.createdAt, t.id)],
);
