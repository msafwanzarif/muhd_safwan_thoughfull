import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  check,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { id, time } from './columns';
import { bookingStatus } from './enums';
import { actorAudit } from './actor-audit';
import { users } from './users';

export const bookingSessions = pgTable(
  'booking_sessions',
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => users.id),
    professionalId: uuid()
      .notNull()
      .references(() => users.id),
    startAt: time().notNull(),
    endAt: time().notNull(),
    status: bookingStatus().notNull().default('active'),
    cancelledBy: uuid().references(() => users.id),
    cancelledAt: time(),
    reason: text(),
    rescheduledFromId: uuid()
      .references((): AnyPgColumn => bookingSessions.id)
      .unique(),
    ...actorAudit(),
  },
  (t) => [
    check(
      'booking_sessions_duration',
      sql`${t.endAt} = ${t.startAt} + interval '50 minutes'`,
    ),
    check(
      'booking_sessions_distinct_users',
      sql`${t.memberId} <> ${t.professionalId}`,
    ),
    index().on(t.memberId, t.startAt),
    index().on(t.professionalId, t.startAt),
  ],
);
