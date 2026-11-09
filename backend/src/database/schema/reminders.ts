import { pgTable, uuid, unique, index } from 'drizzle-orm/pg-core';
import { id, time, audit } from './columns';
import { reminderStatus, reminderType } from './enums';
import { users } from './users';
import { bookingSessions } from './booking-sessions';

export const reminders = pgTable(
  'reminders',
  {
    id: id(),
    sessionId: uuid()
      .notNull()
      .references(() => bookingSessions.id),
    recipientId: uuid()
      .notNull()
      .references(() => users.id),
    type: reminderType().notNull(),
    dueAt: time().notNull(),
    status: reminderStatus().notNull().default('pending'),
    ...audit(),
  },
  (t) => [
    unique().on(t.sessionId, t.recipientId, t.type),
    index().on(t.status, t.dueAt),
  ],
);
