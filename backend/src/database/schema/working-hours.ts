import { sql } from 'drizzle-orm';
import { pgTable, uuid, integer, check } from 'drizzle-orm/pg-core';
import { id } from './columns';
import { actorAudit } from './actor-audit';
import { users } from './users';

export const workingHours = pgTable(
  'working_hours',
  {
    id: id(),
    professionalId: uuid()
      .notNull()
      .references(() => users.id),
    weekday: integer().notNull(),
    startMinute: integer().notNull(),
    lengthHours: integer().notNull(),
    ...actorAudit(),
  },
  (t) => [
    check(
      'working_hours_valid',
      sql`${t.weekday} between 0 and 6 and ${t.startMinute} >= 0 and ${t.startMinute} % 15 = 0 and ${t.lengthHours} between 1 and 24 and ${t.startMinute} + ${t.lengthHours} * 60 <= 1440`,
    ),
  ],
);
