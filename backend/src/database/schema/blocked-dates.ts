import { pgTable, uuid, text, date, unique } from 'drizzle-orm/pg-core';
import { id } from './columns';
import { actorAudit } from './actor-audit';
import { users } from './users';

export const blockedDates = pgTable(
  'blocked_dates',
  {
    id: id(),
    professionalId: uuid()
      .notNull()
      .references(() => users.id),
    localDate: date().notNull(),
    reason: text(),
    ...actorAudit(),
  },
  (t) => [unique().on(t.professionalId, t.localDate)],
);
